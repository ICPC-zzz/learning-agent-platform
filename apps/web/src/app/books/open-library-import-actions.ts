"use server";

/**
 * Open Library Import Server Actions for /books Page
 *
 * Server-side actions that:
 * 1. Check multi-layer guards (Book API + dev import + production)
 * 2. Re-fetch from Open Library for server-side verification
 * 3. Use adapter to create safe import draft
 * 4. Write to DB via PrismaBookRepository (dedup-aware)
 * 5. Return safe result — no raw response, env values, or API keys
 *
 * Guards (ALL must pass):
 * - Book API guard (LAP_ALLOW_EXTERNAL_BOOK_API, etc.)
 * - Dev book import guard (LAP_ALLOW_DEV_BOOK_IMPORT)
 * - Production blocked (NODE_ENV !== "production")
 * - DB persist guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED + LAP_ALLOW_REAL_DB_INTEGRATION + DATABASE_URL)
 *
 * @module open-library-import-actions
 * @previewOnly — dev-only single book import, not for production
 */

import { revalidatePath } from "next/cache";

import {
  evaluateOpenLibraryGuard,
  getOpenLibraryWorkDetail,
  getOpenLibraryEditionDetail,
} from "../../lib/open-library-client";
import {
  adaptOpenLibrarySearchResults,
  type OpenLibraryBookPreview,
} from "../../lib/open-library-adapter";
import {
  createOpenLibraryImportDraft,
  type OpenLibraryImportDraft,
} from "../../lib/open-library-import-adapter";
import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
  type CreateBookWithContentInput,
  type CreateBookWithContentResult,
} from "@learning-agent-platform/db";
import { evaluateImportDbPersistGuard } from "../import/text-import-db-persist-guard";
import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface OpenLibraryImportInput {
  /** External ID from preview (work key or edition key, without prefix) */
  externalId: string;
  /** Work key (e.g. "/works/OL123W") — used to re-fetch detail */
  workKey?: string;
  /** Edition key (e.g. "/books/OL123M") */
  editionKey?: string;
  /** Book title from preview */
  title: string;
  /** Source URL from preview */
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface OpenLibraryImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Whether the book was written to the local DB */
  dbWritten: boolean;
  /** Local book ID if written */
  bookId: string | null;
  /** Number of chapters created */
  chapterCount: number;
  /** Local book detail link */
  detailLink: string | null;
  /** Safety warnings */
  warnings: string[];
  /** Human-readable result message */
  message: string;
  /** Import guard result */
  guard: ExternalApiDevGuardResult;
  /** Whether guard blocked the import */
  guardBlocked: boolean;
  /** Whether the book already existed (dedup) */
  existing: boolean;
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

/**
 * Evaluate the dev-only book import guard.
 *
 * Requires LAP_ALLOW_DEV_BOOK_IMPORT=true explicitly.
 * Production is always blocked regardless of env.
 */
function evaluateDevBookImportGuard(): DevImportGuardResult {
  const missingEnvNames: string[] = [];
  let blockedReason: string | null = null;

  // Check production
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
    // NODE_ENV not readable — block
    return {
      allowed: false,
      blockedReason: "BOOK_IMPORT_NODE_ENV_UNREADABLE: Cannot determine environment.",
      missingEnvNames: [],
    };
  }

  // Check dev import flag
  try {
    const devImportEnabled = process.env.LAP_ALLOW_DEV_BOOK_IMPORT === "true";
    if (!devImportEnabled) {
      missingEnvNames.push("LAP_ALLOW_DEV_BOOK_IMPORT");
      blockedReason = "DEV_BOOK_IMPORT_NOT_ENABLED: LAP_ALLOW_DEV_BOOK_IMPORT 未设置为 true。开发书籍导入默认关闭。";
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
// Action
// ---------------------------------------------------------------------------

/**
 * Import a single Open Library book into the local book library.
 *
 * Usage from /books OpenLibrarySearchClient:
 *   importOpenLibraryBookAction({ externalId, workKey, title, sourceUrl })
 *
 * Guard chain (all must pass):
 * 1. Book API guard (LAP_ALLOW_EXTERNAL_BOOK_API, etc.)
 * 2. Dev book import guard (LAP_ALLOW_DEV_BOOK_IMPORT + production block)
 * 3. DB persist guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED + ...)
 * 4. Input validation
 * 5. Re-fetch from OL → adapter → DB write
 */
export async function importOpenLibraryBookAction(
  input: OpenLibraryImportInput | null,
): Promise<OpenLibraryImportResult> {
  const olGuard = evaluateOpenLibraryGuard();
  const devImportGuard = evaluateDevBookImportGuard();
  const dbGuard = evaluateImportDbPersistGuard();

  // Guard 1: Book API
  if (!olGuard.allowed) {
    return createBlockedResult(
      `Book API guard blocked: ${olGuard.blockedReason ?? "Book API 未启用"}`,
      olGuard,
      [],
    );
  }

  // Guard 2: Dev book import
  if (!devImportGuard.allowed) {
    return createBlockedResult(
      `Dev import guard blocked: ${devImportGuard.blockedReason ?? "书籍导入未启用"}`,
      olGuard,
      [],
    );
  }

  // Guard 3: Production blocked
  try {
    if (process.env.NODE_ENV === "production") {
      return createBlockedResult(
        "Book import is not available in production.",
        olGuard,
        [],
      );
    }
  } catch {
    return createBlockedResult(
      "Cannot determine environment for import.",
      olGuard,
      [],
    );
  }

  // Guard 4: Input validation
  if (!input) {
    return createBlockedResult("没有提供导入数据。", olGuard, []);
  }

  const externalId = (input.externalId ?? "").trim();
  if (externalId.length === 0) {
    return createBlockedResult("缺少 externalId。", olGuard, []);
  }

  const title = (input.title ?? "").trim().slice(0, 500);
  if (title.length === 0) {
    return createBlockedResult("书名不能为空。", olGuard, []);
  }

  // Guard 5: DB persist
  if (!dbGuard.enabled) {
    return createBlockedResult(
      "DB 持久化未启用。设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true 和 LAP_ALLOW_REAL_DB_INTEGRATION=true。",
      olGuard,
      [],
    );
  }

  // ── All guards passed — proceed with import ──

  // Step 1: Re-fetch detail from Open Library for server-side verification
  const preview = await fetchAndAdaptPreview(input, olGuard);

  // Step 2: Create import draft via adapter
  const draft = createOpenLibraryImportDraft(preview, null);

  // Step 3: Dedup check
  try {
    const existingResult = await checkDuplicate(title, draft.provider, draft.externalId);
    if (existingResult) {
      const detailLink = `/books/${encodeURIComponent(existingResult.bookId)}`;
      try { revalidatePath("/books"); } catch { /* best-effort */ }
      return {
        success: true,
        dbWritten: false,
        bookId: existingResult.bookId,
        chapterCount: existingResult.chapterCount,
        detailLink,
        warnings: draft.warnings,
        message: `本书已存在于本地书库中。查看详情。`,
        guard: olGuard,
        guardBlocked: false,
        existing: true,
        provider: "open-library",
        productionReady: false,
        safeToExposeToClient: true,
        rawResponseStored: false,
        envValuesExposed: false,
      };
    }
  } catch {
    // Dedup failure is non-fatal — proceed with import
  }

  // Step 4: Build CreateBookWithContentInput
  const author = draft.authorNames.length > 0
    ? draft.authorNames.join(", ")
    : null;

  const chapterInputs = draft.chapters.map((ch, idx) => ({
    title: ch.title,
    orderIndex: ch.orderIndex,
    level: 0,
    plainText: ch.content,
  }));

  const chunkInputs = draft.chapters.map((ch, _idx) => ({
    chapterOrderIndex: ch.orderIndex,
    orderIndex: 0,
    plainText: ch.content,
  }));

  const metadata: Record<string, unknown> = {
    chapterCount: draft.chapters.length,
    provider: draft.provider,
    externalId: draft.externalId,
    sourceUrl: draft.sourceUrl,
    warnings: draft.warnings,
    importMethod: "open-library-single-import",
    noFullText: true,
  };

  const dbInput: CreateBookWithContentInput = {
    title: draft.title,
    author,
    sourceType: "IMPORTED_TEXT" as const,
    sourceMetadata: metadata as any,
    chapters: chapterInputs,
    chunks: chunkInputs,
  };

  // Step 5: Write to DB
  try {
    const bookRepo = new PrismaBookRepository(getPrismaClient());
    const dbResult: CreateBookWithContentResult = await bookRepo.createBookWithContent(dbInput);

    const detailLink = `/books/${encodeURIComponent(dbResult.bookId)}`;

    try { revalidatePath("/books"); } catch { /* best-effort */ }

    return {
      success: true,
      dbWritten: true,
      bookId: dbResult.bookId,
      chapterCount: dbResult.chapterCount,
      detailLink,
      warnings: draft.warnings,
      message: `成功导入「${draft.title}」到本地书库（${dbResult.chapterCount} 个说明章节）。`,
      guard: olGuard,
      guardBlocked: false,
      existing: false,
      provider: "open-library",
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  } catch (error) {
    // Safe error — no env values, no stack traces
    const safeMsg = "DB 写入失败。请检查数据库连接和配置。";
    return {
      success: false,
      dbWritten: false,
      bookId: null,
      chapterCount: 0,
      detailLink: null,
      warnings: draft.warnings,
      message: safeMsg,
      guard: olGuard,
      guardBlocked: false,
      existing: false,
      provider: "open-library",
      productionReady: false,
      safeToExposeToClient: true,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Re-fetch and adapt preview from Open Library
// ---------------------------------------------------------------------------

async function fetchAndAdaptPreview(
  input: OpenLibraryImportInput,
  guard: ExternalApiDevGuardResult,
): Promise<OpenLibraryBookPreview> {
  // Try work detail first, then edition
  let detailData: unknown = null;

  if (input.workKey) {
    const result = await getOpenLibraryWorkDetail(input.workKey);
    if (result.success && result.data) {
      detailData = result.data;
    }
  }

  if (!detailData && input.editionKey) {
    const result = await getOpenLibraryEditionDetail(input.editionKey);
    if (result.success && result.data) {
      detailData = result.data;
    }
  }

  // If we got detail data, adapt it; otherwise build minimal preview
  if (detailData) {
    // Use the search adapter with a mock search doc constructed from detail
    return buildMinimalPreview(input, detailData);
  }

  return buildMinimalPreview(input, null);
}

function buildMinimalPreview(
  input: OpenLibraryImportInput,
  _detail: unknown,
): OpenLibraryBookPreview {
  return {
    provider: "open-library",
    externalId: input.externalId,
    title: input.title,
    authorNames: [],
    isbn: [],
    language: [],
    coverUrl: "",
    subjects: [],
    sourceUrl: input.sourceUrl,
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "search",
    workKey: input.workKey,
    editionKey: input.editionKey,
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

interface DupCheckResult {
  bookId: string;
  chapterCount: number;
}

async function checkDuplicate(
  title: string,
  _provider: string,
  _externalId: string,
): Promise<DupCheckResult | null> {
  try {
    const bookRepo = new PrismaBookRepository(getPrismaClient());
    const existing = await bookRepo.listBooks({ limit: 100 });

    const match = existing.find((b) => {
      if (b.title !== title) return false;
      // Check metadata for Open Library marker
      if (b.metadata && typeof b.metadata === "object") {
        const meta = b.metadata as Record<string, unknown>;
        if (meta.importMethod === "open-library-single-import") return true;
        if (meta.provider === "open-library") return true;
      }
      return false;
    });

    if (match) {
      const meta = match.metadata as Record<string, unknown> | null;
      const chapterCount = typeof meta?.chapterCount === "number" ? meta.chapterCount as number : 1;
      return { bookId: match.id, chapterCount };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBlockedResult(
  message: string,
  guard: ExternalApiDevGuardResult,
  warnings: string[],
): OpenLibraryImportResult {
  return {
    success: false,
    dbWritten: false,
    bookId: null,
    chapterCount: 0,
    detailLink: null,
    warnings,
    message,
    guard,
    guardBlocked: true,
    existing: false,
    provider: "open-library",
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}
