"use server";

/**
 * Dev-only server action to import a Book API preview result into the local
 * book library via the existing text import → DB pipeline.
 *
 * Guards:
 * - LAP_ALLOW_EXTERNAL_BOOK_API must be true/1
 * - LAP_BOOK_API_BASE_URL must be set
 * - LAP_BOOK_API_PROVIDER must be set
 * - NODE_ENV !== production
 * - LAP_IMPORT_DB_PERSIST_DEV_ENABLED (for DB write)
 * - LAP_ALLOW_REAL_DB_INTEGRATION (for DB write)
 *
 * @module book-api-import-server-action
 * @previewOnly — dev-only; never production
 */

import { cookies } from "next/headers";
import { getBookApiPreviewStatus } from "./book-api-preview-status";
import { isTextImportSaveDevEnabled } from "./text-import-save-dev-guard";
import {
  evaluateImportDbPersistGuard,
  type ImportDbPersistGuardResult,
} from "./text-import-db-persist-guard";
import {
  writeImportToDatabase,
  type ImportDbPersistWriterResult,
} from "./text-import-db-persist-writer";
import { resolveImportOwnerContext } from "./text-import-owner-context";
import type { TextImportSaveRequestPreview } from "./text-import-save-request";
import {
  createDevHttpBookSourceProvider,
} from "@learning-agent-platform/book-engine";
import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BookApiImportInput {
  providerId: string;
  externalBookId: string;
  title: string;
  authors: string[];
  description: string;
  language: string;
  sourceUrl: string;
  licenseHint: string;
  coverImageUrl: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface BookApiImportResult {
  success: boolean;
  /** Whether the book was written to the local DB. */
  dbWritten: boolean;
  /** The local book ID. */
  bookId: string | null;
  /** Chapter IDs if DB written. */
  chapterIds: string[];
  /** Chapter count. */
  chapterCount: number;
  /** Detail page link. */
  detailLink: string | null;
  /** Reader link. */
  readerLink: string | null;
  /** Import timestamp (ISO). */
  importedAt: string | null;
  /** Human-readable message. */
  message: string;
  /** Reason code. */
  reasonCode: string;
  /** Dev-only flag. */
  devOnly: true;
  /** Never production-ready. */
  productionReady: false;
  /** Safe to expose. */
  safeToExposeToClient: true;
  /** Raw response never stored. */
  rawResponseStored: false;
  /** Guard status detail. */
  dbPersistGuard: ImportDbPersistGuardResult;
  /** Whether this was an existing/duplicate import. */
  existing: boolean;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function importBookApiItemAction(
  input: BookApiImportInput | null,
): Promise<BookApiImportResult> {
  // Guard 1: book API must be enabled
  const bookApiStatus = getBookApiPreviewStatus();
  if (bookApiStatus.providerMode === "blocked") {
    return createBlockedResult("Book API is blocked.", "book-api-blocked");
  }

  // Guard 2: NODE_ENV not production
  const nodeEnv = safeReadNodeEnv();
  if (nodeEnv === "production") {
    return createBlockedResult("Book import is not available in production.", "production-blocked");
  }

  // Guard 3: validate input
  if (!input) {
    return createBlockedResult("No book data provided.", "invalid-input");
  }

  const sanitizedTitle = input.title.trim().slice(0, 200);
  if (sanitizedTitle.length === 0) {
    return createBlockedResult("Book title is required.", "invalid-input");
  }

  // Guard 4: dev save must be enabled
  if (!isTextImportSaveDevEnabled()) {
    return createBlockedResult("Dev save is not enabled.", "dev-save-disabled");
  }

  const dbPersistGuard = evaluateImportDbPersistGuard();
  const now = new Date().toISOString();

  if (dbPersistGuard.enabled) {
    // Fetch book detail from provider to get real chapters
    let chapters: Array<{
      order: number;
      title: string;
      previewText: string;
      estimatedLineCount: number;
    }> = [];
    let chapterFetchFailed = false;

    try {
      const baseUrl = readEnvString("LAP_BOOK_API_BASE_URL");
      if (baseUrl) {
        const provider = createDevHttpBookSourceProvider({
          timeoutMs: 15_000,
          env: {
            bookApiDevEnabled: true,
            allowExternalBookApi: true,
            bookApiBaseUrl: baseUrl,
          },
        });
        const detailResult = await provider.getBookDetail(input.externalBookId);
        const chapterPreviews = detailResult.chapterPreviews ?? [];

        if (chapterPreviews.length > 0) {
          chapters = chapterPreviews.map((ch) => ({
            order: ch.orderIndex + 1,
            title: ch.title || `Chapter ${ch.orderIndex + 1}`,
            previewText: ch.bodyAvailable
              ? `[Chapter content from external API: ${ch.title}]`
              : `[Chapter preview: ${ch.title}. Full content not available from this source.]`,
            estimatedLineCount: Math.max(1, Math.ceil(ch.estimatedCharCount / 80)),
          }));
        }
      }
    } catch {
      chapterFetchFailed = true;
      // Fall through to placeholder chapter
    }

    // Fallback: if chapter fetch failed or returned empty, use description as single chapter
    if (chapters.length === 0) {
      const descriptionContent = input.description || `Book imported from ${input.providerId}. ${input.licenseHint || ""}`;
      chapters = [
        {
          order: 1,
          title: chapterFetchFailed ? "Preview Content (chapter fetch failed)" : "Preview Content",
          previewText: descriptionContent,
          estimatedLineCount: Math.ceil(descriptionContent.length / 80),
        },
      ];
    }

    // Dedup: check if a book with same title+source already exists in DB
    let existingBookId: string | null = null;
    let existingChapterCount = 0;
    try {
      if (isDbReadAllowed()) {
        const bookRepo = new PrismaBookRepository(getPrismaClient());
        const existing = await bookRepo.listBooks({ limit: 100 });
        const match = existing.find((b) =>
          b.title === sanitizedTitle &&
          b.sourceType === "IMPORTED_TEXT" &&
          typeof b.metadata === "object" && b.metadata !== null &&
          (b.metadata as Record<string, unknown>).providerId === input.providerId
        );
        if (match) {
          existingBookId = match.id;
          existingChapterCount = typeof match.metadata === "object" && match.metadata !== null
            ? ((match.metadata as Record<string, unknown>).chapterCount as number) ?? 0
            : 0;
        }
      }
    } catch {
      // Ignore dedup failure — proceed with import
    }

    if (existingBookId) {
      return {
        success: true,
        dbWritten: true,
        bookId: existingBookId,
        chapterIds: [],
        chapterCount: existingChapterCount,
        detailLink: `/books/${encodeURIComponent(existingBookId)}`,
        readerLink: `/reader?bookId=${encodeURIComponent(existingBookId)}`,
        importedAt: now,
        message: `本书已存在于数据库中（ID: ${existingBookId}）。未重复写入。`,
        reasonCode: "existing-db",
        devOnly: true,
        productionReady: false,
        safeToExposeToClient: true,
        rawResponseStored: false,
        dbPersistGuard,
        existing: true,
      };
    }

    // Build a TextImportSaveRequestPreview for the existing pipeline
    const authorStr = input.authors.length > 0 ? input.authors.join(", ") : "Unknown";

    const saveRequest: TextImportSaveRequestPreview = {
      previewOnly: true,
      implemented: false,
      saveReady: true,
      blockedReasons: [],
      userExplicitlyConfirmed: true,
      requiresExplicitUserConfirmation: true,
      safeToExposeToClient: true,
      bookTitlePreview: sanitizedTitle,
      confirmationStatus: "ready",
      effectiveChapterCount: chapters.length,
      excludedChapterCount: 0,
      safeChapters: chapters,
      estimatedTotalLines: chapters.reduce((sum, ch) => sum + ch.estimatedLineCount, 0),
      writesDatabase: false,
      callsRepository: false,
    };

    try {
      let ownerId: string | null = null;
      try {
        const cookieStore = await cookies();
        const raw = cookieStore.get("lap-web-dev-session")?.value;
        const ownerContext = resolveImportOwnerContext(raw);
        if (ownerContext.hasOwner) {
          ownerId = ownerContext.ownerId;
        }
      } catch {
        // Cookie read failed — proceed without owner
      }

      const dbResult: ImportDbPersistWriterResult = await writeImportToDatabase({
        saveRequest,
        ownerId,
      });

      return {
        success: dbResult.success,
        dbWritten: dbResult.writesDatabase,
        bookId: dbResult.bookId,
        chapterIds: dbResult.chapterIds,
        chapterCount: dbResult.chapterCount,
        detailLink: dbResult.bookId ? `/books/${dbResult.bookId}` : null,
        readerLink: dbResult.bookId ? `/reader?bookId=${dbResult.bookId}` : null,
        importedAt: now,
        message: dbResult.message,
        reasonCode: dbResult.reasonCode,
        devOnly: true,
        productionReady: false,
        safeToExposeToClient: true,
        rawResponseStored: false,
        dbPersistGuard,
        existing: false,
      };
    } catch (error) {
      const safeMsg = error instanceof Error
        ? `DB write failed: ${redactSensitive(error.message)}`
        : "DB write failed: unknown error";

      return {
        success: false,
        dbWritten: false,
        bookId: null,
        chapterIds: [],
        chapterCount: 0,
        detailLink: null,
        readerLink: null,
        importedAt: null,
        message: safeMsg,
        reasonCode: "db-write-failed",
        devOnly: true,
        productionReady: false,
        safeToExposeToClient: true,
        rawResponseStored: false,
        dbPersistGuard,
        existing: false,
      };
    }
  }

  // No DB available — return blocked
  return {
    success: false,
    dbWritten: false,
    bookId: null,
    chapterIds: [],
    chapterCount: 0,
    detailLink: null,
    readerLink: null,
    importedAt: null,
    message: "DB persist guard is not enabled. Set LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true and LAP_ALLOW_REAL_DB_INTEGRATION=true.",
    reasonCode: "db-guard-blocked",
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    dbPersistGuard,
    existing: false,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBlockedResult(message: string, reasonCode: string): BookApiImportResult {
  return {
    success: false,
    dbWritten: false,
    bookId: null,
    chapterIds: [],
    chapterCount: 0,
    detailLink: null,
    readerLink: null,
    importedAt: null,
    message,
    reasonCode,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
    dbPersistGuard: evaluateImportDbPersistGuard(),
    existing: false,
  };
}

function safeReadNodeEnv(): string | undefined {
  try {
    return process.env.NODE_ENV;
  } catch {
    return undefined;
  }
}

function readEnvString(key: string): string | null {
  try {
    const value = process.env[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /postgres(ql)?:\/\/\S*/gi,
  /DATABASE_URL[=:]\s*\S*/gi,
  /password[=:]\s*\S*/gi,
  /secret[=:]\s*\S*/gi,
  /token[=:]\s*\S*/gi,
  /api[_-]?key[=:]\s*\S*/gi,
];

function redactSensitive(message: string): string {
  let result = message;
  for (const p of SENSITIVE_PATTERNS) {
    result = result.replace(p, "[hidden]");
  }
  return result;
}

function isDbReadAllowed(): boolean {
  try {
    if (!hasDatabaseUrl()) return false;
    if (process.env["LAP_ALLOW_REAL_DB_INTEGRATION"] !== "true") return false;
    if (process.env["LAP_IMPORT_DB_PERSIST_DEV_ENABLED"] !== "true") return false;
    return true;
  } catch {
    return false;
  }
}
