/**
 * Learning Activity DB Actions — dev-only server actions for learning activity
 * DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the LearningActivityRepository.
 *
 * ALL writes/reads are blocked unless the learning-activity-db-guard passes.
 *
 * @module learning-activity-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaLearningActivityRepository,
  type LearningActivityRecord,
} from "@learning-agent-platform/db";

import {
  evaluateLearningActivityDbGuard,
  type LearningActivityDbGuardResult,
} from "./learning-activity-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordLearningActivityDbInput {
  activityType: string;
  title: string;
  targetType: string;
  targetId: string;
  bookId?: string | null;
  chapterId?: string | null;
  problemId?: string | null;
  sourceType: string;
  occurredAt: string;
  durationSeconds?: number | null;
  metadataPreview?: string | null;
  ownerId: string;
}

export interface LearningActivityDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  activityId: string;
  activityType: string;
  ownerIdPreview: string;
  reasonCode: string;
  productionReady: false;
  occurredAt?: string;
}

export interface LearningActivityDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  activityId: null;
  activityType: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface LearningActivityDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  activityId: null;
  activityType: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type LearningActivityDbActionResult =
  | LearningActivityDbActionSuccess
  | LearningActivityDbActionBlocked
  | LearningActivityDbActionError;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "read-book",
  "practice-problem",
  "favorite-book",
  "favorite-problem",
  "add-note",
  "add-bookmark",
  "import-book",
  "daily_challenge_completed",
]);

const VALID_TARGET_TYPES: ReadonlySet<string> = new Set([
  "book",
  "chapter",
  "problem",
  "note",
  "bookmark",
]);

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

function validateActivityInput(
  input: RecordLearningActivityDbInput,
): string | null {
  if (!VALID_ACTIVITY_TYPES.has(input.activityType)) {
    return `无效 activityType: ${input.activityType}。必须是: ${Array.from(VALID_ACTIVITY_TYPES).join(", ")}。`;
  }
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    return "title 必须为非空字符串。";
  }
  if (input.title.length > 300) {
    return "title 长度不能超过 300 字。";
  }
  if (!VALID_TARGET_TYPES.has(input.targetType)) {
    return `无效 targetType: ${input.targetType}。`;
  }
  if (typeof input.targetId !== "string" || input.targetId.trim().length === 0) {
    return "targetId 必须为非空字符串。";
  }
  if (typeof input.sourceType !== "string" || input.sourceType.trim().length === 0) {
    return "sourceType 必须为非空字符串。";
  }
  if (typeof input.occurredAt !== "string" || Number.isNaN(Date.parse(input.occurredAt))) {
    return "occurredAt 必须为有效 ISO 日期字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (input.durationSeconds !== null && input.durationSeconds !== undefined) {
    if (typeof input.durationSeconds !== "number" || !Number.isFinite(input.durationSeconds)) {
      return "durationSeconds 必须为有效数字。";
    }
    if (input.durationSeconds < 0 || input.durationSeconds > MAX_DURATION_SECONDS) {
      return `durationSeconds 必须在 0-${MAX_DURATION_SECONDS} 之间。`;
    }
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
 * Record a learning activity in the database.
 */
export async function doRecordLearningActivity(
  input: RecordLearningActivityDbInput,
  guard: LearningActivityDbGuardResult,
): Promise<LearningActivityDbActionResult> {
  // Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      activityId: null,
      activityType: normalizeField(input.activityType),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "learning-activity-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Input validation
  const validationError = validateActivityInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      activityId: null,
      activityType: normalizeField(input.activityType),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "invalid-activity-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  // Write to DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaLearningActivityRepository(prisma);

    const record = await repository.recordLearningActivity({
      userId: input.ownerId.trim(),
      activityType: input.activityType as any,
      title: input.title.trim().slice(0, 300),
      targetType: input.targetType as any,
      targetId: input.targetId.trim(),
      bookId: normalizeField(input.bookId),
      chapterId: normalizeField(input.chapterId),
      problemId: normalizeField(input.problemId),
      sourceType: input.sourceType.trim(),
      occurredAt: new Date(input.occurredAt),
      durationSeconds: normalizeDuration(input.durationSeconds),
      metadataPreview: normalizeMetadataPreview(input.metadataPreview),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      activityId: record.id,
      activityType: record.activityType,
      ownerIdPreview: record.userId,
      reasonCode: "activity-recorded",
      productionReady: false,
      occurredAt: record.occurredAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, normalizeField(input.activityType), normalizeField(input.ownerId));
  }
}

/**
 * List learning activities for the current dev session owner from DB.
 */
export async function doListLearningActivitiesByOwner(
  ownerId: string,
  guard: LearningActivityDbGuardResult,
  limit?: number,
): Promise<LearningActivityRecord[]> {
  if (!guard.enabled) return [];
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) return [];

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaLearningActivityRepository(prisma);

    return repository.listLearningActivitiesByOwner({
      userId: ownerId.trim(),
      limit,
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapActionError(
  error: unknown,
  activityType: string | null,
  ownerIdPreview: string | null,
): LearningActivityDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    activityId: null,
    activityType,
    ownerIdPreview,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地学习活动不受影响。`,
    productionReady: false,
  };
}

function normalizeField(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Math.min(Math.trunc(value), MAX_DURATION_SECONDS);
}

function normalizeMetadataPreview(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 500);
}

// ---------------------------------------------------------------------------
// Safe result check (for tests)
// ---------------------------------------------------------------------------

export function learningActivityDbActionResultIsSafe(
  result: LearningActivityDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
