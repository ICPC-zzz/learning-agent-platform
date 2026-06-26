/**
 * Dev-only DB persist writer for text import.
 *
 * Converts a validated TextImportSaveRequestPreview into CreateBookWithContentInput
 * and writes through PrismaBookRepository. Only call when the import DB persist
 * guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true AND LAP_ALLOW_REAL_DB_INTEGRATION=true
 * AND DATABASE_URL configured) has already been checked.
 *
 * SECURITY:
 * - Input comes from the already-sanitized save request (no rawText, no token, etc.)
 * - Author is hardcoded to "dev-import / no real user"
 * - Source type is always IMPORTED_TEXT
 * - Tags always include "dev-import", "db-persist", "restart-safe", "dev-only"
 * - Metadata records guard status, never env values or connection strings
 *
 * @module text-import-db-persist-writer
 * @previewOnly -- dev/test-only, never production
 */

import {
  getPrismaClient,
  PrismaBookRepository,
  type CreateBookWithContentInput,
  type CreateBookWithContentResult,
} from "@learning-agent-platform/db";
import type { TextImportSaveRequestPreview } from "./text-import-save-request.ts";
import { evaluateImportDbPersistGuard } from "./text-import-db-persist-guard.ts";

// ---------------------------------------------------------------------------
// Safe result type
// ---------------------------------------------------------------------------

export interface ImportDbPersistWriterResult {
  success: boolean;
  bookId: string | null;
  chapterIds: string[];
  chapterCount: number;
  reasonCode: string;
  message: string;
  /** Always true when success; DB write was performed. */
  writesDatabase: boolean;
  /** Always true when success; repository layer was invoked. */
  callsRepository: boolean;
  /** Always true -- this is a dev-only path. */
  devOnly: true;
  /** Always false -- never production-ready. */
  productionReady: false;
  /** Safe to expose to client -- no secrets leaked. */
  safeToExposeToClient: true;
}

// ---------------------------------------------------------------------------
// Writer options (A378: added for dev session owner association)
// ---------------------------------------------------------------------------

export interface ImportDbPersistWriterOptions {
  /** The validated save request. */
  saveRequest: TextImportSaveRequestPreview;
  /** Owner ID from dev session (userIdPreview). When provided, the book is associated with this user. */
  ownerId?: string | null;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Write a validated import save request to the database via PrismaBookRepository.
 *
 * Preconditions (caller must enforce):
 * - evaluateImportDbPersistGuard().enabled === true
 * - saveRequest.saveReady === true
 * - saveRequest.blockedReasons.length === 0
 * - saveRequest.userExplicitlyConfirmed === true
 * - saveRequest.safeChapters.length > 0
 *
 * @returns a safe result that can be serialized to the client
 */
export async function writeImportToDatabase(
  options: ImportDbPersistWriterOptions,
): Promise<ImportDbPersistWriterResult> {
  const { saveRequest, ownerId } = options;

  // Double-check guard at write point (defense in depth)
  const guard = evaluateImportDbPersistGuard();
  if (!guard.enabled) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      chapterCount: 0,
      reasonCode: "guard-blocked-at-write",
      message:
        "DB persistent guard blocked at write point. Check LAP_IMPORT_DB_PERSIST_DEV_ENABLED, LAP_ALLOW_REAL_DB_INTEGRATION, and DATABASE_URL.",
      writesDatabase: false,
      callsRepository: false,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  }

  // Validate input (defense in depth -- caller should already have done this)
  if (!saveRequest.saveReady) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      chapterCount: 0,
      reasonCode: "save-not-ready",
      message: "Save request is not ready.",
      writesDatabase: false,
      callsRepository: false,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  }

  if (saveRequest.blockedReasons.length > 0) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      chapterCount: 0,
      reasonCode: "save-blocked",
      message:
        "Save request has blocked reasons: " +
        saveRequest.blockedReasons.join("; "),
      writesDatabase: false,
      callsRepository: false,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  }

  if (saveRequest.safeChapters.length === 0) {
    return {
      success: false,
      bookId: null,
      chapterIds: [],
      chapterCount: 0,
      reasonCode: "no-chapters",
      message: "No valid chapters to persist.",
      writesDatabase: false,
      callsRepository: false,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  }

  // Build the DB input
  const dbInput = buildCreateBookInput(saveRequest, ownerId);

  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const result: CreateBookWithContentResult =
      await repository.createBookWithContent(dbInput);

    // Build chapter ID list from order indices
    const chapterIds = saveRequest.safeChapters.map((_, i) => {
      return "db-" + result.bookId + "-ch-" + (i + 1);
    });

    return {
      success: true,
      bookId: result.bookId,
      chapterIds,
      chapterCount: result.chapterCount,
      reasonCode: "db-persist-saved",
      message: "Saved to dev database (dev-only DB persist). Book ID: " +
        result.bookId + ", " + result.chapterCount + " chapters, " +
        result.chunkCount + " chunks. Data persists across restarts.",
      writesDatabase: true,
      callsRepository: true,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  } catch (caughtError) {
    // Safe error -- never expose stack traces, SQL, connection strings
    const safeMessage =
      caughtError instanceof Error
        ? "DB write failed: " + redactSensitiveErrorMessage(caughtError.message)
        : "DB write failed: unknown error";

    return {
      success: false,
      bookId: null,
      chapterIds: [],
      chapterCount: 0,
      reasonCode: "db-write-failed",
      message: safeMessage,
      writesDatabase: false,
      callsRepository: true,
      devOnly: true,
      productionReady: false,
      safeToExposeToClient: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Input builder
// ---------------------------------------------------------------------------

function buildCreateBookInput(
  saveRequest: TextImportSaveRequestPreview,
  ownerId: string | null | undefined,
): CreateBookWithContentInput {
  const now = new Date().toISOString();
  const chapterCount = saveRequest.safeChapters.length;

  const chapters = saveRequest.safeChapters.map((safeChapter) => ({
    title: safeChapter.title,
    orderIndex: safeChapter.order - 1,
    level: 1,
    plainText: safeChapter.previewText,
    estimatedLineCount: safeChapter.estimatedLineCount,
  }));

  const chunks = saveRequest.safeChapters.map((safeChapter) => ({
    chapterOrderIndex: safeChapter.order - 1,
    orderIndex: 0,
    plainText: safeChapter.previewText,
    charCount: safeChapter.previewText.length,
    startOffset: 0,
    endOffset: safeChapter.previewText.length,
  }));

  return {
    title: saveRequest.bookTitlePreview,
    author: "dev-import / no real user",
    sourceType: "IMPORTED_TEXT" as const,
    sourceMetadata: {
      importGuard: "dev-only",
      importedAt: now,
      chapterCount,
      estimatedTotalLines: saveRequest.estimatedTotalLines,
      dbPersistGuard: "LAP_IMPORT_DB_PERSIST_DEV_ENABLED",
      notProduction: true,
    },
    chapters,
    chunks,
    ...(ownerId ? { ownerId } : {}),
  };
}

// ---------------------------------------------------------------------------
// Error redaction
// ---------------------------------------------------------------------------

const SENSITIVE_ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /postgres(ql)?:\/\/\S*/gi,
  /DATABASE_URL[=:]\s*\S*/gi,
  /connection\s+string[=:]\s*\S*/gi,
  /password[=:]\s*\S*/gi,
  /secret[=:]\s*\S*/gi,
  /token[=:]\s*\S*/gi,
  /api[_-]?key[=:]\s*\S*/gi,
];

function redactSensitiveErrorMessage(message: string): string {
  let redacted = message;
  for (const pattern of SENSITIVE_ERROR_PATTERNS) {
    redacted = redacted.replace(pattern, "[已隐藏]");
  }
  return redacted;
}
