/**
 * Problem Wrong Book DB Actions — dev-only server actions for problem
 * wrong book DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ProblemWrongBook repository.
 *
 * ALL writes/reads are blocked unless the problem-wrong-book-db-guard passes.
 *
 * @module problem-wrong-book-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaProblemWrongBookRepository,
} from "@learning-agent-platform/db";

import {
  evaluateProblemWrongBookDbGuard,
  type ProblemWrongBookDbGuardResult,
} from "./problem-wrong-book-db-guard";
import type { WrongBookReviewStatus } from "../../lib/local-problem-wrong-book-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProblemWrongBookDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  problemId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  productionReady: false;
  wrongBookRecord?: {
    problemId: string;
    wrongCount: number;
    reviewStatus: string;
    lastWrongAt?: string;
    notePreview?: string | null;
  } | null;
}

export interface ProblemWrongBookDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  problemId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ProblemWrongBookDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  problemId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ProblemWrongBookDbActionResult =
  | ProblemWrongBookDbActionSuccess
  | ProblemWrongBookDbActionBlocked
  | ProblemWrongBookDbActionError;

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

const VALID_REVIEW_STATUSES: ReadonlySet<string> = new Set([
  "needs-review",
  "reviewed",
  "mastered",
]);

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateAddInput(input: {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  ownerId: string;
}): string | null {
  if (typeof input.problemId !== "string" || input.problemId.trim().length === 0) {
    return "problemId 必须为非空字符串。";
  }
  if (typeof input.problemTitle !== "string" || input.problemTitle.trim().length === 0) {
    return "problemTitle 必须为非空字符串。";
  }
  if (typeof input.difficulty !== "string" || input.difficulty.trim().length === 0) {
    return "difficulty 必须为非空字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function doAddProblemToWrongBook(
  problemId: string,
  problemTitle: string,
  difficulty: string,
  tags: string[] | undefined,
  ownerId: string,
  guard: ProblemWrongBookDbGuardResult,
): Promise<ProblemWrongBookDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "wrong-book-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateAddInput({ problemId, problemTitle, difficulty, ownerId });
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "invalid-wrong-book-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    const record = await repository.addProblemToWrongBook({
      ownerId: ownerId.trim(),
      problemId: problemId.trim(),
      problemTitle: problemTitle.trim(),
      difficulty: difficulty.trim(),
      tags,
      sourceType: "manual",
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: record.problemId,
      ownerIdPreview: record.ownerId,
      reasonCode: "wrong-book-added-db",
      productionReady: false,
      wrongBookRecord: {
        problemId: record.problemId,
        wrongCount: record.wrongCount,
        reviewStatus: record.reviewStatus,
        lastWrongAt: record.lastWrongAt.toISOString(),
        notePreview: record.notePreview,
      },
    };
  } catch (error: unknown) {
    return mapActionError(error, problemId, ownerId, true);
  }
}

export async function doRecordProblemWrong(
  problemId: string,
  problemTitle: string,
  difficulty: string,
  tags: string[] | undefined,
  ownerId: string,
  guard: ProblemWrongBookDbGuardResult,
): Promise<ProblemWrongBookDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "wrong-book-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateAddInput({ problemId, problemTitle, difficulty, ownerId });
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "invalid-wrong-book-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    const record = await repository.recordProblemWrong({
      ownerId: ownerId.trim(),
      problemId: problemId.trim(),
      problemTitle: problemTitle.trim(),
      difficulty: difficulty.trim(),
      tags,
      sourceType: "manual",
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: record.problemId,
      ownerIdPreview: record.ownerId,
      reasonCode: "wrong-book-recorded-db",
      productionReady: false,
      wrongBookRecord: {
        problemId: record.problemId,
        wrongCount: record.wrongCount,
        reviewStatus: record.reviewStatus,
        lastWrongAt: record.lastWrongAt.toISOString(),
        notePreview: record.notePreview,
      },
    };
  } catch (error: unknown) {
    return mapActionError(error, problemId, ownerId, true);
  }
}

export async function doRemoveProblemFromWrongBook(
  problemId: string,
  ownerId: string,
  guard: ProblemWrongBookDbGuardResult,
): Promise<ProblemWrongBookDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "wrong-book-db-disabled-by-default",
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
      reasonCode: "invalid-wrong-book-payload",
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
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    await repository.removeProblemFromWrongBook({
      ownerId: ownerId.trim(),
      problemId: problemId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: problemId.trim(),
      ownerIdPreview: ownerId.trim(),
      reasonCode: "wrong-book-removed-db",
      productionReady: false,
      wrongBookRecord: null,
    };
  } catch (error: unknown) {
    return mapActionError(error, problemId, ownerId, true);
  }
}

export async function doUpdateWrongBookReviewStatus(
  problemId: string,
  ownerId: string,
  reviewStatus: WrongBookReviewStatus,
  guard: ProblemWrongBookDbGuardResult,
): Promise<ProblemWrongBookDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "wrong-book-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (!VALID_REVIEW_STATUSES.has(reviewStatus)) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "invalid-review-status",
      blockedReasons: [`reviewStatus 必须是以下之一: ${Array.from(VALID_REVIEW_STATUSES).join(", ")}.`],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    const record = await repository.updateProblemWrongBookReviewStatus({
      ownerId: ownerId.trim(),
      problemId: problemId.trim(),
      reviewStatus,
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: record.problemId,
      ownerIdPreview: record.ownerId,
      reasonCode: "wrong-book-review-status-updated-db",
      productionReady: false,
      wrongBookRecord: {
        problemId: record.problemId,
        wrongCount: record.wrongCount,
        reviewStatus: record.reviewStatus,
        lastWrongAt: record.lastWrongAt?.toISOString(),
        notePreview: record.notePreview,
      },
    };
  } catch (error: unknown) {
    return mapActionError(error, problemId, ownerId, true);
  }
}

export async function doUpdateWrongBookNote(
  problemId: string,
  ownerId: string,
  notePreview: string | null,
  guard: ProblemWrongBookDbGuardResult,
): Promise<ProblemWrongBookDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      reasonCode: "wrong-book-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Sanitize note preview
  let safeNote: string | null = null;
  if (notePreview !== null && notePreview !== undefined) {
    const trimmed = String(notePreview).trim();
    if (trimmed.length > 0) {
      if (hasDangerousFields({ note: trimmed })) {
        return {
          success: false,
          devOnly: true,
          writesDatabase: false,
          callsRepository: false,
          problemId: normalizeField(problemId),
          ownerIdPreview: normalizeField(ownerId),
          reasonCode: "dangerous-note-content",
          blockedReasons: ["错题备注包含敏感字段，已拒绝。"],
          productionReady: false,
        };
      }
      safeNote = trimmed.slice(0, 300);
    }
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemWrongBookRepository(prisma);

    const record = await repository.updateProblemWrongBookNote({
      ownerId: ownerId.trim(),
      problemId: problemId.trim(),
      notePreview: safeNote,
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      problemId: record.problemId,
      ownerIdPreview: record.ownerId,
      reasonCode: "wrong-book-note-updated-db",
      productionReady: false,
      wrongBookRecord: {
        problemId: record.problemId,
        wrongCount: record.wrongCount,
        reviewStatus: record.reviewStatus,
        notePreview: record.notePreview,
      },
    };
  } catch (error: unknown) {
    return mapActionError(error, problemId, ownerId, true);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapActionError(
  error: unknown,
  problemId: string,
  ownerId: string,
  calledRepository: boolean,
): ProblemWrongBookDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: calledRepository,
    problemId: normalizeField(problemId),
    ownerIdPreview: normalizeField(ownerId),
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地错题本记录不受影响。`,
    productionReady: false,
  };
}

function normalizeField(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Safe result check
// ---------------------------------------------------------------------------

export function problemWrongBookDbActionResultIsSafe(
  result: ProblemWrongBookDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
