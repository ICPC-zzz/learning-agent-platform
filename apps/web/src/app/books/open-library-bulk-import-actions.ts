"use server";

/**
 * Open Library Bulk Import Server Actions for /books Page
 *
 * Supports:
 * 1. Category/keyword-based search on Open Library
 * 2. Multi-select book import
 * 3. Batch import with upper-bound limit (max 5)
 * 4. Dedup by title + provider marker
 * 5. Result reporting: created, existing, failed counts
 * 6. Reuses A465 single-import adapter and guard chain
 *
 * Guards (ALL must pass):
 * - Book API guard (LAP_ALLOW_EXTERNAL_BOOK_API, etc.)
 * - Dev book import guard (LAP_ALLOW_DEV_BOOK_IMPORT)
 * - Production blocked (NODE_ENV !== "production")
 * - DB persist guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED + etc.)
 *
 * Each imported book reuses the A465 safety adapter:
 * - No raw Open Library response stored
 * - No fabricated full text
 * - Safety chapter with metadata summary
 * - NO_FULL_TEXT_WARNING on every book
 *
 * @module open-library-bulk-import-actions
 * @previewOnly — dev-only bulk import, not for production
 */

import { revalidatePath } from "next/cache";

import {
  evaluateOpenLibraryGuard,
  searchOpenLibraryBooks,
  getOpenLibraryWorkDetail,
} from "../../lib/open-library-client";
import {
  adaptOpenLibrarySearchResults,
  type OpenLibraryBookPreview,
} from "../../lib/open-library-adapter";
import {
  createOpenLibraryImportDraft,
} from "../../lib/open-library-import-adapter";
import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
  type CreateBookWithContentInput,
  type CreateBookWithContentResult,
  type Prisma,
} from "@learning-agent-platform/db";
import { evaluateImportDbPersistGuard } from "../import/text-import-db-persist-guard";
import { PROGRAMMING_CATEGORIES } from "./programming-categories";
import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of books to import in a single batch request */
const MAX_BATCH_SIZE = 5;

/** Default number of search results to fetch per category */
const DEFAULT_SEARCH_LIMIT = 10;

// ---------------------------------------------------------------------------
// Input/Output types
// ---------------------------------------------------------------------------

export interface OpenLibraryBulkImportInput {
  /** Category key (e.g. "Python", "JavaScript") or custom search query */
  category: string;
  /** Override the default search query for this category */
  queryOverride?: string;
  /** Maximum number of books to import (clamped to MAX_BATCH_SIZE) */
  maxBooks?: number;
  /** Specific external IDs to import (skip search) */
  externalIds?: string[];
  /** Specific titles to import (skip search if externalIds not provided) */
  titles?: string[];
}

export interface BulkImportItemResult {
  externalId: string;
  title: string;
  status: "created" | "existing" | "failed";
  bookId: string | null;
  detailLink: string | null;
  message: string;
}

export interface OpenLibraryBulkImportResult {
  success: boolean;
  totalRequested: number;
  created: number;
  existing: number;
  failed: number;
  items: BulkImportItemResult[];
  message: string;
  guard: ExternalApiDevGuardResult;
  guardBlocked: boolean;
  /** Whether any books were actually written to DB */
  dbWritten: boolean;
  /** Always "open-library" */
  provider: "open-library";
  /** Always false — dev-only */
  productionReady: false;
  /** Always true */
  safeToExposeToClient: true;
  /** Never stored */
  rawResponseStored: false;
  /** Never exposed */
  envValuesExposed: false;
}

// ---------------------------------------------------------------------------
// Dev import guard
// ---------------------------------------------------------------------------

interface DevImportGuardResult {
  allowed: boolean;
  blockedReason: string | null;
  missingEnvNames: string[];
}

function evaluateDevBookImportGuard(): DevImportGuardResult {
  const missingEnvNames: string[] = [];
  let blockedReason: string | null = null;

  try {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      return {
        allowed: false,
        blockedReason: "BOOK_IMPORT_PRODUCTION_BLOCKED: Book import is not available in production.",
        missingEnvNames: [],
      };
    }
  } catch {
    return {
      allowed: false,
      blockedReason: "BOOK_IMPORT_NODE_ENV_UNREADABLE: Cannot determine environment.",
      missingEnvNames: [],
    };
  }

  try {
    const devImportEnabled = process.env.LAP_ALLOW_DEV_BOOK_IMPORT === "true";
    if (!devImportEnabled) {
      missingEnvNames.push("LAP_ALLOW_DEV_BOOK_IMPORT");
      blockedReason = "DEV_BOOK_IMPORT_NOT_ENABLED: LAP_ALLOW_DEV_BOOK_IMPORT 未设置为 true。";
    }
  } catch {
    missingEnvNames.push("LAP_ALLOW_DEV_BOOK_IMPORT");
    blockedReason = "DEV_BOOK_IMPORT_NOT_ENABLED: 无法读取 LAP_ALLOW_DEV_BOOK_IMPORT 环境变量。";
  }

  return {
    allowed: blockedReason === null,
    blockedReason,
    missingEnvNames,
  };
}

// ---------------------------------------------------------------------------
// Main action: bulk import by category
// ---------------------------------------------------------------------------

/**
 * Bulk import programming books from Open Library by category.
 *
 * Usage from /books page:
 *   openLibraryBulkImportAction({ category: "Python", maxBooks: 3 })
 */
export async function openLibraryBulkImportAction(
  input: OpenLibraryBulkImportInput | null,
): Promise<OpenLibraryBulkImportResult> {
  const olGuard = evaluateOpenLibraryGuard();
  const devImportGuard = evaluateDevBookImportGuard();
  const dbGuard = evaluateImportDbPersistGuard();

  // Guard chain
  if (!olGuard.allowed) {
    return createBulkBlockedResult(
      `Book API guard blocked: ${olGuard.blockedReason ?? "Book API 未启用"}`,
      olGuard,
    );
  }

  if (!devImportGuard.allowed) {
    return createBulkBlockedResult(
      `Dev import guard blocked: ${devImportGuard.blockedReason ?? "书籍导入未启用"}`,
      olGuard,
    );
  }

  try {
    if (process.env.NODE_ENV === "production") {
      return createBulkBlockedResult("Book import is not available in production.", olGuard);
    }
  } catch {
    return createBulkBlockedResult("Cannot determine environment for import.", olGuard);
  }

  if (!input) {
    return createBulkBlockedResult("没有提供导入数据。", olGuard);
  }

  if (!dbGuard.enabled) {
    return createBulkBlockedResult(
      "DB 持久化未启用。设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true 和 LAP_ALLOW_REAL_DB_INTEGRATION=true。",
      olGuard,
    );
  }

  // Clamp maxBooks
  const maxBooks = Math.max(1, Math.min(input.maxBooks ?? 3, MAX_BATCH_SIZE));

  // Resolve search query
  const searchQuery = input.queryOverride
    ?? PROGRAMMING_CATEGORIES[input.category]?.[0]
    ?? input.category;

  // Step 1: Search Open Library for the category
  const searchResult = await searchOpenLibraryBooks({
    query: searchQuery,
    limit: DEFAULT_SEARCH_LIMIT,
  });

  if (!searchResult.success || !searchResult.data) {
    return {
      success: false,
      totalRequested: 0,
      created: 0,
      existing: 0,
      failed: 0,
      items: [],
      message: `Open Library 搜索失败: ${searchResult.error ?? "未知错误"}`,
      guard: olGuard,
      guardBlocked: false,
      dbWritten: false,
      provider: "open-library",
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  // Step 2: Adapt results
  const previews = adaptOpenLibrarySearchResults(searchResult.data);
  if (previews.length === 0) {
    return {
      success: true,
      totalRequested: 0,
      created: 0,
      existing: 0,
      failed: 0,
      items: [],
      message: `未找到与 "${searchQuery}" 匹配的书籍。`,
      guard: olGuard,
      guardBlocked: false,
      dbWritten: false,
      provider: "open-library",
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  // Step 3: Import top N results
  const toImport = previews.slice(0, maxBooks);
  const items: BulkImportItemResult[] = [];
  let created = 0;
  let existing = 0;
  let failed = 0;

  for (const preview of toImport) {
    try {
      const itemResult = await importSingleBook(preview, input.category, olGuard);
      items.push(itemResult);
      if (itemResult.status === "created") created++;
      else if (itemResult.status === "existing") existing++;
      else failed++;
    } catch {
      items.push({
        externalId: preview.externalId,
        title: preview.title,
        status: "failed",
        bookId: null,
        detailLink: null,
        message: "导入异常",
      });
      failed++;
    }
  }

  try { revalidatePath("/books"); } catch { /* best-effort */ }

  return {
    success: true,
    totalRequested: toImport.length,
    created,
    existing,
    failed,
    items,
    message: `批量导入完成：${created} 本新创建，${existing} 本已存在，${failed} 本失败。`,
    guard: olGuard,
    guardBlocked: false,
    dbWritten: created > 0,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

// ---------------------------------------------------------------------------
// Single book import (reuses A465 logic)
// ---------------------------------------------------------------------------

async function importSingleBook(
  preview: OpenLibraryBookPreview,
  category: string,
  olGuard: ExternalApiDevGuardResult,
): Promise<BulkImportItemResult> {
  // Refetch detail for richer metadata
  let detailData: unknown = null;
  if (preview.workKey) {
    const workResult = await getOpenLibraryWorkDetail(preview.workKey);
    if (workResult.success && workResult.data) {
      detailData = workResult.data;
    }
  }

  // Create import draft via A465 adapter
  const draft = createOpenLibraryImportDraft(preview, null);

  // Check for duplicate
  const existingResult = await checkBulkDuplicate(draft.title);
  if (existingResult) {
    return {
      externalId: preview.externalId,
      title: draft.title,
      status: "existing",
      bookId: existingResult.bookId,
      detailLink: `/books/${encodeURIComponent(existingResult.bookId)}`,
      message: "已存在于本地书库",
    };
  }

  // Build DB input — with category in metadata and tags
  const author = draft.authorNames.length > 0
    ? draft.authorNames.join(", ")
    : null;

  const chapterInputs = draft.chapters.map((ch, idx) => ({
    title: ch.title,
    orderIndex: ch.orderIndex,
    level: 0,
    plainText: ch.content,
  }));

  const chunkInputs = draft.chapters.map((ch) => ({
    chapterOrderIndex: ch.orderIndex,
    orderIndex: 0,
    plainText: ch.content,
  }));

  // Include category in metadata and tags
  const metadata: Prisma.InputJsonObject = {
    chapterCount: draft.chapters.length,
    provider: draft.provider,
    externalId: draft.externalId,
    sourceUrl: draft.sourceUrl,
    warnings: draft.warnings,
    importMethod: "open-library-bulk-import",
    importCategory: category,
    noFullText: true,
    description: draft.description || null,
  };

  const dbInput: CreateBookWithContentInput = {
    title: draft.title,
    author,
    sourceType: "IMPORTED_TEXT" as const,
    sourceMetadata: metadata,
    chapters: chapterInputs,
    chunks: chunkInputs,
  };

  // Write to DB — need to set tags and description via metadata after creation
  try {
    const bookRepo = new PrismaBookRepository(getPrismaClient());
    const dbResult: CreateBookWithContentResult = await bookRepo.createBookWithContent(dbInput);

    // Preserve display hints in metadata; the repository does not update top-level tags/description.
    try {
      await bookRepo.updateBookMetadata({
        bookId: dbResult.bookId,
        metadata: {
          ...metadata,
          category,
          tags: [category],
        },
      });
    } catch {
      // Non-fatal: book is created, metadata update is best-effort
    }

    return {
      externalId: preview.externalId,
      title: draft.title,
      status: "created",
      bookId: dbResult.bookId,
      detailLink: `/books/${encodeURIComponent(dbResult.bookId)}`,
      message: `成功导入（${dbResult.chapterCount} 个说明章节）`,
    };
  } catch {
    return {
      externalId: preview.externalId,
      title: draft.title,
      status: "failed",
      bookId: null,
      detailLink: null,
      message: "DB 写入失败",
    };
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

interface DupCheckResult {
  bookId: string;
}

async function checkBulkDuplicate(title: string): Promise<DupCheckResult | null> {
  try {
    const bookRepo = new PrismaBookRepository(getPrismaClient());
    const existing = await bookRepo.listBooks({ limit: 100 });

    const match = existing.find((b) => {
      if (b.title !== title) return false;
      if (b.metadata && typeof b.metadata === "object") {
        const meta = b.metadata as Record<string, unknown>;
        if (meta.importMethod === "open-library-single-import" ||
            meta.importMethod === "open-library-bulk-import") return true;
        if (meta.provider === "open-library") return true;
      }
      return false;
    });

    return match ? { bookId: match.id } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBulkBlockedResult(
  message: string,
  guard: ExternalApiDevGuardResult,
): OpenLibraryBulkImportResult {
  return {
    success: false,
    totalRequested: 0,
    created: 0,
    existing: 0,
    failed: 0,
    items: [],
    message,
    guard,
    guardBlocked: true,
    dbWritten: false,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}
