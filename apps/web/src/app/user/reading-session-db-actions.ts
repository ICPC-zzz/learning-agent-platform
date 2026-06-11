/**
 * Reading Session DB Actions — dev-only server actions for reading session
 * DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ReadingSessionRepository.
 *
 * ALL writes/reads are blocked unless the reading-session-db-guard passes.
 *
 * @module reading-session-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaReadingSessionRepository,
  type ReadingSessionRecord,
  type ReadingSessionSummary,
} from "@learning-agent-platform/db";

import {
  evaluateReadingSessionDbGuard,
  type ReadingSessionDbGuardResult,
} from "./reading-session-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StartReadingSessionDbInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  startedAt: string;
  durationSeconds: number;
  progressRatio: number;
  sourceType: string;
  ownerId: string;
}

export interface ReadingSessionDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  sessionId: string;
  bookId: string;
  chapterId: string;
  ownerIdPreview: string;
  durationSeconds: number;
  reasonCode: string;
  productionReady: false;
  startedAt?: string;
}

export interface ReadingSessionDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  sessionId: null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  durationSeconds: number;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ReadingSessionDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  sessionId: null;
  bookId: string | null;
  chapterId: string | null;
  ownerIdPreview: string | null;
  durationSeconds: number;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ReadingSessionDbActionResult =
  | ReadingSessionDbActionSuccess
  | ReadingSessionDbActionBlocked
  | ReadingSessionDbActionError;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DURATION_SECONDS = 28800;

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

function validateSessionInput(
  input: StartReadingSessionDbInput,
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
  if (typeof input.startedAt !== "string" || Number.isNaN(Date.parse(input.startedAt))) {
    return "startedAt 必须为有效 ISO 日期字符串。";
  }
  if (typeof input.durationSeconds !== "number" || !Number.isFinite(input.durationSeconds)) {
    return "durationSeconds 必须为有效数字。";
  }
  if (input.durationSeconds < 0 || input.durationSeconds > MAX_DURATION_SECONDS) {
    return `durationSeconds 必须在 0-${MAX_DURATION_SECONDS} 之间。`;
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
 * Start (record) a reading session in the database.
 */
export async function doStartReadingSession(
  input: StartReadingSessionDbInput,
  guard: ReadingSessionDbGuardResult,
): Promise<ReadingSessionDbActionResult> {
  // Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      sessionId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      durationSeconds: clampDuration(input.durationSeconds),
      reasonCode: "reading-session-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Input validation
  const validationError = validateSessionInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      sessionId: null,
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      ownerIdPreview: normalizeField(input.ownerId),
      durationSeconds: clampDuration(input.durationSeconds),
      reasonCode: "invalid-session-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  // Write to DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReadingSessionRepository(prisma);

    const record = await repository.startReadingSession({
      userId: input.ownerId.trim(),
      bookId: input.bookId.trim(),
      chapterId: input.chapterId.trim(),
      bookTitle: input.bookTitle.trim(),
      chapterTitle: input.chapterTitle.trim(),
      startedAt: new Date(input.startedAt),
      durationSeconds: clampDuration(input.durationSeconds),
      progressRatio: clampProgressRatio(input.progressRatio),
      sourceType: input.sourceType.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      sessionId: record.id,
      bookId: record.bookId,
      chapterId: record.chapterId,
      ownerIdPreview: record.userId,
      durationSeconds: record.durationSeconds,
      reasonCode: "session-started",
      productionReady: false,
      startedAt: record.startedAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, normalizeField(input.bookId), normalizeField(input.chapterId), normalizeField(input.ownerId), clampDuration(input.durationSeconds));
  }
}

/**
 * List reading sessions for the current dev session owner from DB.
 */
export async function doListReadingSessionsByOwner(
  ownerId: string,
  guard: ReadingSessionDbGuardResult,
  limit?: number,
): Promise<ReadingSessionRecord[]> {
  if (!guard.enabled) return [];
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) return [];

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReadingSessionRepository(prisma);

    return repository.listReadingSessionsByOwner({
      userId: ownerId.trim(),
      limit,
    });
  } catch {
    return [];
  }
}

/**
 * Summarize reading sessions for the current dev session owner from DB.
 */
export async function doSummarizeReadingSessionsByOwner(
  ownerId: string,
  guard: ReadingSessionDbGuardResult,
): Promise<ReadingSessionSummary> {
  if (!guard.enabled) {
    return { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 };
  }
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReadingSessionRepository(prisma);

    return repository.summarizeReadingSessionsByOwner(ownerId.trim());
  } catch {
    return { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), MAX_DURATION_SECONDS);
}

function clampProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function mapActionError(
  error: unknown,
  bookId: string | null,
  chapterId: string | null,
  ownerIdPreview: string | null,
  durationSeconds: number,
): ReadingSessionDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    sessionId: null,
    bookId,
    chapterId,
    ownerIdPreview,
    durationSeconds,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地阅读计时不受影响。`,
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

export function readingSessionDbActionResultIsSafe(
  result: ReadingSessionDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
