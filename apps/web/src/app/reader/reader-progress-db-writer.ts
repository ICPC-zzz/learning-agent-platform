/**
 * Reader Progress DB Writer — dev-only DB write path for reader progress.
 *
 * Takes a safe payload and writes to the DB via PrismaReadingProgressRepository.
 * ALL writes are blocked unless the reader-progress-db-guard passes.
 *
 * The writer binds progress to the dev session owner's userIdPreview —
 * NOT a real DB User primary key. See A378 for ownerId strategy.
 *
 * Safety:
 * - Validates progressRatio in [0, 1]
 * - Validates bookId/chapterId non-empty
 * - Rejects dangerous fields in payload
 * - Returns safe error on failure (no stack traces, no env values)
 * - Uses upsert (idempotent for same owner+book+chapter)
 *
 * @module reader-progress-db-writer
 * @previewOnly — dev-only DB write; never production sync
 */

import {
  getPrismaClient,
  PrismaReadingProgressRepository,
  type ReadingProgressRecord,
} from "@learning-agent-platform/db";

import { evaluateReaderProgressDbGuard, type ReaderProgressDbGuardResult } from "./reader-progress-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderProgressDbWriteInput {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  ownerId: string;
  source?: string;
}

export interface ReaderProgressDbWriteSuccess {
  success: true;
  devOnly: true;
  writesDatabase: true;
  callsRepository: true;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  ownerId: string;
  updatedAt: string;
  source: string;
  productionReady: false;
}

export interface ReaderProgressDbWriteBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  bookId: string | null;
  chapterId: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ReaderProgressDbWriteError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  bookId: string | null;
  chapterId: string | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ReaderProgressDbWriteResult =
  | ReaderProgressDbWriteSuccess
  | ReaderProgressDbWriteBlocked
  | ReaderProgressDbWriteError;

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

function hasDangerousFields(input: ReaderProgressDbWriteInput): boolean {
  const json = JSON.stringify(input);
  return DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateWriteInput(
  input: ReaderProgressDbWriteInput,
): string | null {
  if (typeof input.bookId !== "string" || input.bookId.trim().length === 0) {
    return "bookId 必须为非空字符串。";
  }

  if (typeof input.chapterId !== "string" || input.chapterId.trim().length === 0) {
    return "chapterId 必须为非空字符串。";
  }

  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }

  if (!Number.isFinite(input.progressRatio) || input.progressRatio < 0 || input.progressRatio > 1) {
    return "progressRatio 必须在 0 到 1 之间。";
  }

  if (hasDangerousFields(input)) {
    return "payload 包含敏感字段，已拒绝写入。";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Write reader progress to the database.
 *
 * @param input - Validated write input (bookId, chapterId, progressRatio, ownerId)
 * @param guard - Pre-evaluated guard result (from evaluateReaderProgressDbGuard)
 * @returns Safe result — never leaks SQL, DATABASE_URL, or stack traces
 */
export async function writeReaderProgressToDb(
  input: ReaderProgressDbWriteInput,
  guard: ReaderProgressDbGuardResult,
): Promise<ReaderProgressDbWriteResult> {
  // Step 1: Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeFieldForResult(input.bookId),
      chapterId: normalizeFieldForResult(input.chapterId),
      reasonCode: "reader-progress-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Step 2: Input validation
  const validationError = validateWriteInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeFieldForResult(input.bookId),
      chapterId: normalizeFieldForResult(input.chapterId),
      reasonCode: "invalid-progress-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  // Step 3: Write to DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReadingProgressRepository(prisma);

    const record = await repository.upsertReadingProgress({
      userId: input.ownerId,
      bookId: input.bookId.trim(),
      chapterId: input.chapterId.trim(),
      progressRatio: input.progressRatio,
    });

    return mapWriteSuccess(record, input.ownerId, input.source);
  } catch (error: unknown) {
    return mapWriteError(
      error,
      guard,
      normalizeFieldForResult(input.bookId),
      normalizeFieldForResult(input.chapterId),
    );
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapWriteSuccess(
  record: ReadingProgressRecord,
  ownerId: string,
  source?: string,
): ReaderProgressDbWriteSuccess {
  return {
    success: true,
    devOnly: true,
    writesDatabase: true,
    callsRepository: true,
    bookId: record.bookId,
    chapterId: record.chapterId,
    progressRatio: record.progressRatio,
    ownerId,
    updatedAt: record.updatedAt.toISOString(),
    source: source ?? "dev-session-progress",
    productionReady: false,
  };
}

function mapWriteError(
  error: unknown,
  guard: ReaderProgressDbGuardResult,
  bookId: string | null,
  chapterId: string | null,
): ReaderProgressDbWriteError {
  // NEVER expose stack traces, SQL errors, or connection strings
  const brief =
    error instanceof Error
      ? error.constructor.name
      : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    bookId,
    chapterId,
    reasonCode: "db-write-failed",
    message: `数据库写入失败（${brief}）。本地阅读不受影响。`,
    productionReady: false,
  };
}

function normalizeFieldForResult(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Safe result check (for tests)
// ---------------------------------------------------------------------------

/**
 * Verify that a write result contains no sensitive fields.
 * Always returns true for valid results — this is for test assertions.
 */
export function readerProgressDbWriteResultIsSafe(
  result: ReaderProgressDbWriteResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
