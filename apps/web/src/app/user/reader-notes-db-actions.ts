/**
 * Reader Notes DB Actions — dev-only server actions for reader notes
 * DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ReaderNoteRepository.
 *
 * ALL writes/reads are blocked unless the reader-notes-db-guard passes.
 *
 * @module reader-notes-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaReaderNoteRepository,
  type ReaderNoteRecord,
} from "@learning-agent-platform/db";

import {
  evaluateReaderNotesDbGuard,
  type ReaderNotesDbGuardResult,
} from "./reader-notes-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderNotesDbActionInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteText: string;
  excerptPreview?: string | null;
  sourceType: string;
  ownerId: string;
}

export interface ReaderNotesDbUpdateInput {
  noteId: string;
  noteText: string;
  excerptPreview?: string | null;
  progressRatio?: number;
  ownerId: string;
}

export interface ReaderNotesDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  noteId: string;
  bookId: string;
  chapterId: string;
  ownerIdPreview: string;
  reasonCode: string;
  productionReady: false;
  createdAt?: string;
  noteTextPreview?: string;
}

export interface ReaderNotesDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  noteId: string | null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ReaderNotesDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  noteId: string | null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ReaderNotesDbActionResult =
  | ReaderNotesDbActionSuccess
  | ReaderNotesDbActionBlocked
  | ReaderNotesDbActionError;

// ---------------------------------------------------------------------------
// Dangerous field patterns
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
  /\bfullChapterContent\b/i,
  /\brawText\b/i,
];

function hasDangerousFields(input: Record<string, unknown>): boolean {
  const json = JSON.stringify(input);
  return DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NOTE_TEXT_LENGTH = 1000;
const MAX_EXCERPT_PREVIEW_LENGTH = 160;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateNoteInput(
  input: ReaderNotesDbActionInput,
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
  if (typeof input.noteText !== "string") {
    return "noteText 必须为字符串。";
  }
  if (input.noteText.length > MAX_NOTE_TEXT_LENGTH) {
    return `noteText 长度不能超过 ${MAX_NOTE_TEXT_LENGTH} 字。`;
  }
  if (input.noteText.trim().length === 0) {
    return "noteText 不能为空。";
  }
  if (
    input.excerptPreview !== null &&
    input.excerptPreview !== undefined &&
    typeof input.excerptPreview === "string" &&
    input.excerptPreview.length > MAX_EXCERPT_PREVIEW_LENGTH
  ) {
    return `excerptPreview 长度不能超过 ${MAX_EXCERPT_PREVIEW_LENGTH} 字。`;
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

function validateNoteUpdateInput(
  input: ReaderNotesDbUpdateInput,
): string | null {
  if (typeof input.noteId !== "string" || input.noteId.trim().length === 0) {
    return "noteId 必须为非空字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (typeof input.noteText !== "string") {
    return "noteText 必须为字符串。";
  }
  if (input.noteText.length > MAX_NOTE_TEXT_LENGTH) {
    return `noteText 长度不能超过 ${MAX_NOTE_TEXT_LENGTH} 字。`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a reader note in the database.
 */
export async function doAddReaderNote(
  input: ReaderNotesDbActionInput,
  guard: ReaderNotesDbGuardResult,
): Promise<ReaderNotesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "reader-notes-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateNoteInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "invalid-note-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderNoteRepository(prisma);

    const record = await repository.addReaderNote({
      userId: input.ownerId.trim(),
      bookId: input.bookId.trim(),
      chapterId: input.chapterId.trim(),
      bookTitle: input.bookTitle.trim(),
      chapterTitle: input.chapterTitle.trim(),
      progressRatio: clampProgressRatio(input.progressRatio),
      noteText: input.noteText.slice(0, MAX_NOTE_TEXT_LENGTH),
      excerptPreview: normalizeExcerptForDb(input.excerptPreview),
      sourceType: input.sourceType.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      noteId: record.id,
      bookId: record.bookId,
      chapterId: record.chapterId,
      ownerIdPreview: record.userId,
      reasonCode: "note-added",
      productionReady: false,
      createdAt: record.createdAt.toISOString(),
      noteTextPreview: record.noteText.length > 80
        ? record.noteText.slice(0, 80) + "..."
        : record.noteText,
    };
  } catch (error: unknown) {
    return mapNoteActionError(error, normalizeField(input.bookId), normalizeField(input.chapterId), normalizeField(input.ownerId));
  }
}

/**
 * Update an existing reader note in the database.
 */
export async function doUpdateReaderNote(
  input: ReaderNotesDbUpdateInput,
  guard: ReaderNotesDbGuardResult,
): Promise<ReaderNotesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: normalizeField(input.noteId),
      bookId: null,
      chapterId: null,
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "reader-notes-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateNoteUpdateInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: normalizeField(input.noteId),
      bookId: null,
      chapterId: null,
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "invalid-note-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderNoteRepository(prisma);

    const record = await repository.updateReaderNote({
      userId: input.ownerId.trim(),
      noteId: input.noteId.trim(),
      noteText: input.noteText.slice(0, MAX_NOTE_TEXT_LENGTH),
      excerptPreview: normalizeExcerptForDb(input.excerptPreview),
      progressRatio: input.progressRatio !== undefined
        ? clampProgressRatio(input.progressRatio)
        : undefined,
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      noteId: record.id,
      bookId: record.bookId,
      chapterId: record.chapterId,
      ownerIdPreview: record.userId,
      reasonCode: "note-updated",
      productionReady: false,
      noteTextPreview: record.noteText.length > 80
        ? record.noteText.slice(0, 80) + "..."
        : record.noteText,
    };
  } catch (error: unknown) {
    return mapNoteActionError(error, null, null, normalizeField(input.ownerId), normalizeField(input.noteId));
  }
}

/**
 * Remove a reader note from the database.
 */
export async function doRemoveReaderNote(
  noteId: string,
  ownerId: string,
  guard: ReaderNotesDbGuardResult,
): Promise<ReaderNotesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: normalizeField(noteId),
      bookId: null,
      chapterId: null,
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "reader-notes-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof noteId !== "string" || noteId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      noteId: null,
      bookId: null,
      chapterId: null,
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "invalid-note-payload",
      blockedReasons: ["noteId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderNoteRepository(prisma);

    await repository.removeReaderNote({
      userId: ownerId.trim(),
      noteId: noteId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      noteId: noteId.trim(),
      bookId: null,
      chapterId: null,
      ownerIdPreview: ownerId.trim(),
      reasonCode: "note-removed",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapNoteActionError(error, null, null, normalizeField(ownerId), normalizeField(noteId));
  }
}

/**
 * List all reader notes for the current dev session owner.
 */
export async function doListReaderNotesByOwner(
  ownerId: string,
  guard: ReaderNotesDbGuardResult,
): Promise<ReaderNoteRecord[]> {
  if (!guard.enabled) return [];
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) return [];

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReaderNoteRepository(prisma);

    return repository.listReaderNotesByOwner({
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

function normalizeExcerptForDb(
  excerpt: string | null | undefined,
): string | null {
  if (excerpt === null || excerpt === undefined) return null;
  if (typeof excerpt !== "string") return null;
  const trimmed = excerpt.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_EXCERPT_PREVIEW_LENGTH);
}

function mapNoteActionError(
  error: unknown,
  bookId: string | null,
  chapterId: string | null,
  ownerIdPreview: string | null,
  noteId?: string | null,
): ReaderNotesDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    noteId: noteId ?? null,
    bookId,
    chapterId,
    ownerIdPreview,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地笔记不受影响。`,
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

export function readerNotesDbActionResultIsSafe(
  result: ReaderNotesDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
