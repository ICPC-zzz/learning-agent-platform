/**
 * Problem Practice DB Actions — dev-only server actions for problem
 * practice activity DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ProblemPractice repository.
 *
 * ALL writes/reads are blocked unless the problem-practice-db-guard passes.
 *
 * @module problem-practice-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaProblemPracticeRepository,
} from "@learning-agent-platform/db";

import {
  evaluateProblemPracticeDbGuard,
  type ProblemPracticeDbGuardResult,
} from "./problem-practice-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PracticeStatusType = "not-started" | "practiced" | "completed" | "needs-review";

export interface ProblemPracticeDbActionInput {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: PracticeStatusType;
  tags?: string[];
  ownerId: string;
}

export interface ProblemPracticeDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  problemId: string;
  ownerIdPreview: string;
  status: PracticeStatusType | null;
  reasonCode: string;
  productionReady: false;
  updatedAt?: string;
}

export interface ProblemPracticeDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  problemId: string | null;
  ownerIdPreview: string | null;
  status: PracticeStatusType | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ProblemPracticeDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  problemId: string | null;
  ownerIdPreview: string | null;
  status: PracticeStatusType | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ProblemPracticeDbActionResult =
  | ProblemPracticeDbActionSuccess
  | ProblemPracticeDbActionBlocked
  | ProblemPracticeDbActionError;

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
];

function hasDangerousFields(input: Record<string, unknown>): boolean {
  const json = JSON.stringify(input);
  return DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "not-started",
  "practiced",
  "completed",
  "needs-review",
]);

const VALID_DIFFICULTIES: ReadonlySet<string> = new Set([
  "EASY", "easy",
  "MEDIUM", "medium",
  "HARD", "hard",
  "CHALLENGE", "challenge",
]);

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validatePracticeInput(
  input: ProblemPracticeDbActionInput,
): string | null {
  if (typeof input.problemId !== "string" || input.problemId.trim().length === 0) {
    return "problemId 必须为非空字符串。";
  }
  if (typeof input.problemTitle !== "string" || input.problemTitle.trim().length === 0) {
    return "problemTitle 必须为非空字符串。";
  }
  if (typeof input.difficulty !== "string" || input.difficulty.trim().length === 0) {
    return "difficulty 必须为非空字符串。";
  }
  if (typeof input.status !== "string" || !VALID_STATUSES.has(input.status)) {
    return `status 必须是以下之一: ${Array.from(VALID_STATUSES).join(", ")}.`;
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

function safeDifficulty(input: string): string {
  const trimmed = input.trim().toLowerCase();
  return VALID_DIFFICULTIES.has(trimmed) || VALID_DIFFICULTIES.has(input.trim())
    ? trimmed
    : "unknown";
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Record a practice activity in the database.
 * Uses PrismaProblemPracticeRepository for native problem practice storage.
 * Upsert model — same userId+problemId updates the existing record.
 */
export async function doRecordPracticeActivity(
  input: ProblemPracticeDbActionInput,
  guard: ProblemPracticeDbGuardResult,
): Promise<ProblemPracticeDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(input.problemId),
      ownerIdPreview: normalizeField(input.ownerId),
      status: input.status as PracticeStatusType,
      reasonCode: "practice-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validatePracticeInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(input.problemId),
      ownerIdPreview: normalizeField(input.ownerId),
      status: null,
      reasonCode: "invalid-practice-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemPracticeRepository(prisma);

    const record = await repository.recordPractice({
      userId: input.ownerId.trim(),
      problemId: input.problemId.trim(),
      problemTitle: input.problemTitle.trim(),
      difficulty: safeDifficulty(input.difficulty),
      status: input.status,
      tags: normalizeTags(input.tags),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: record.problemId,
      ownerIdPreview: record.userId,
      status: record.status as PracticeStatusType,
      reasonCode: "practice-recorded-db",
      productionReady: false,
      updatedAt: record.updatedAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(input.problemId), normalizeField(input.ownerId));
  }
}

export async function doRemovePracticeActivity(
  problemId: string,
  ownerId: string,
  guard: ProblemPracticeDbGuardResult,
): Promise<ProblemPracticeDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      status: null,
      reasonCode: "practice-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof problemId !== "string" || problemId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: null,
      ownerIdPreview: normalizeField(ownerId),
      status: null,
      reasonCode: "invalid-practice-payload",
      blockedReasons: ["problemId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: null,
      status: null,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemPracticeRepository(prisma);

    await repository.removeProblemPractice({
      userId: ownerId.trim(),
      problemId: problemId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: problemId.trim(),
      ownerIdPreview: ownerId.trim(),
      status: null,
      reasonCode: "practice-removed-db",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(problemId), normalizeField(ownerId));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapActionError(
  error: unknown,
  _guard: ProblemPracticeDbGuardResult,
  problemId: string | null,
  ownerIdPreview: string | null,
): ProblemPracticeDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    problemId,
    ownerIdPreview,
    status: null,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地练习记录不受影响。`,
    productionReady: false,
  };
}

function normalizeField(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Safe result check
// ---------------------------------------------------------------------------

export function problemPracticeDbActionResultIsSafe(
  result: ProblemPracticeDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
