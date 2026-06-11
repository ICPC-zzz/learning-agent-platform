/**
 * Reader Bookmarks DB Actions — dev-only server actions for reader bookmarks
 * DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ReaderBookmarkRepository.
 *
 * ALL writes/reads are blocked unless the reader-bookmarks-db-guard passes.
 *
 * @module reader-bookmarks-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaReaderBookmarkRepository,
  type ReaderBookmarkRecord,
} from "@learning-agent-platform/db";

import {
  evaluateReaderBookmarksDbGuard,
  type ReaderBookmarksDbGuardResult,
} from "./reader-bookmarks-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderBookmarksDbActionInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
  ownerId: string;
}

export interface ReaderBookmarksDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  bookmarkId: string;
  bookId: string;
  chapterId: string;
  ownerIdPreview: string;
  isBookmarked: boolean;
  reasonCode: string;
  productionReady: false;
  createdAt?: string;
}

export interface ReaderBookmarksDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  bookmarkId: string | null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  isBookmarked: boolean;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ReaderBookmarksDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  bookmarkId: string | null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  isBookmarked: boolean;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ReaderBookmarksDbActionResult =
  | ReaderBookmarksDbActionSuccess
  | ReaderBookmarksDbActionBlocked
  | ReaderBookmarksDbActionError;

// ---------------------------------------------------------------------------
// Dangerous field patterns (defense in depth)
// ---------------------------------------------------------------------------

const DANGEROUS_FIELD_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
];

function hasDangerousFields(input: Record<string, unknown>): boolean {
  const json = JSON.stringify(input);
  return DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateBookmarkInput(
  input: ReaderBookmarksDbActionInput,
): string | null {
  if (typeof input.bookId !== "string" || input.bookId.trim().length === 0) {
    return "bookId 必须为非空字符串。";
  }
  if (typeof input.chapterId !== "string" || input.chapterId.trim().length === 0) {
    return "chapterId 必须为非空字符串。";
  }
  if (typeof input.bookTitle !== "string" || input.bookTitle.trim().length === 0) {
    return "bookTitle 必须为非空字符串。";
  }
  if (typeof input.chapterTitle !== "string" || input.chapterTitle.trim().length === 0) {
    return "chapterTitle 必须为非空字符串。";
  }
  if (typeof input.sourceType !== "string" || input.sourceType.trim().length === 0) {
    return "sourceType 必须为非空字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (!Number.isFinite(input.progressRatio) || input.progressRatio < 0 || input.progressRatio > 1) {
    return "progressRatio 必须在 0-1 之间。";
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a reader bookmark in the database.
 * Idempotent — duplicate adds are safe (upsert by userId+bookId+chapterId).
 */
export async function doAddReaderBookmark(
  input: ReaderBookmarksDbActionInput,
  guard: ReaderBookmarksDbGuardResult,
): Promise<ReaderBookmarksDbActionResult> {
  // Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookmarkId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      isBookmarked: false,
      reasonCode: "reader-bookmarks-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Input validation
  const validationError = validateBookmarkInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookmarkId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      isBookmarked: false,
      reasonCode: "invalid-bookmark-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  // Write to DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderBookmarkRepository(prisma);

    const record = await repository.addReaderBookmark({
      userId: input.ownerId.trim(),
      bookId: input.bookId.trim(),
      chapterId: input.chapterId.trim(),
      bookTitle: input.bookTitle.trim(),
      chapterTitle: input.chapterTitle.trim(),
      progressRatio: clampProgressRatio(input.progressRatio),
      sourceType: input.sourceType.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      bookmarkId: record.id,
      bookId: record.bookId,
      chapterId: record.chapterId,
      ownerIdPreview: record.userId,
      isBookmarked: true,
      reasonCode: "bookmark-added",
      productionReady: false,
      createdAt: record.createdAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, normalizeField(input.bookId), normalizeField(input.chapterId), normalizeField(input.ownerId));
  }
}

/**
 * Remove a reader bookmark from the database.
 */
export async function doRemoveReaderBookmark(
  bookId: string,
  chapterId: string,
  ownerId: string,
  guard: ReaderBookmarksDbGuardResult,
): Promise<ReaderBookmarksDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookmarkId: null,
      bookId: normalizeField(bookId),
      chapterId: normalizeField(chapterId),
      ownerIdPreview: normalizeField(ownerId),
      isBookmarked: false,
      reasonCode: "reader-bookmarks-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof bookId !== "string" || bookId.trim().length === 0) {
    return buildBlocked("bookId 必须为非空字符串。", null, normalizeField(chapterId), normalizeField(ownerId));
  }
  if (typeof chapterId !== "string" || chapterId.trim().length === 0) {
    return buildBlocked("chapterId 必须为非空字符串。", normalizeField(bookId), null, normalizeField(ownerId));
  }
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return buildBlocked("ownerId 必须为非空字符串。", normalizeField(bookId), normalizeField(chapterId), null);
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderBookmarkRepository(prisma);

    await repository.removeReaderBookmark({
      userId: ownerId.trim(),
      bookId: bookId.trim(),
      chapterId: chapterId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      bookmarkId: null,
      bookId: bookId.trim(),
      chapterId: chapterId.trim(),
      ownerIdPreview: ownerId.trim(),
      isBookmarked: false,
      reasonCode: "bookmark-removed",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, normalizeField(bookId), normalizeField(chapterId), normalizeField(ownerId));
  }
}

/**
 * List all reader bookmarks for the current dev session owner.
 */
export async function doListReaderBookmarksByOwner(
  ownerId: string,
  guard: ReaderBookmarksDbGuardResult,
): Promise<ReaderBookmarkRecord[]> {
  if (!guard.enabled) return [];
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) return [];

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderBookmarkRepository(prisma);

    return repository.listReaderBookmarksByOwner({
      userId: ownerId.trim(),
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function mapActionError(
  error: unknown,
  bookId: string | null,
  chapterId: string | null,
  ownerIdPreview: string | null,
): ReaderBookmarksDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    bookmarkId: null,
    bookId,
    chapterId,
    ownerIdPreview,
    isBookmarked: false,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地书签不受影响。`,
    productionReady: false,
  };
}

function buildBlocked(
  reason: string,
  bookId: string | null,
  chapterId: string | null,
  ownerIdPreview: string | null,
): ReaderBookmarksDbActionBlocked {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: false,
    bookmarkId: null,
    bookId,
    chapterId,
    ownerIdPreview,
    isBookmarked: false,
    reasonCode: "invalid-bookmark-payload",
    blockedReasons: [reason],
    productionReady: false,
  };
}

function normalizeField(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Safe result check (for tests)
// ---------------------------------------------------------------------------

export function readerBookmarksDbActionResultIsSafe(
  result: ReaderBookmarksDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
