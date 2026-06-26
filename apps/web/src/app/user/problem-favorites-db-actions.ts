/**
 * Problem Favorites DB Actions — dev-only server actions for problem
 * favorites DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the ProblemFavorite repository.
 *
 * ALL writes/reads are blocked unless the problem-favorites-db-guard passes.
 *
 * @module problem-favorites-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaProblemFavoriteRepository,
} from "@learning-agent-platform/db";

import {
  evaluateProblemFavoritesDbGuard,
  type ProblemFavoritesDbGuardResult,
} from "./problem-favorites-db-guard";

// Types

export interface ProblemFavoritesDbActionInput {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags?: string[];
  ownerId: string;
}

export interface ProblemFavoritesDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  problemId: string;
  ownerIdPreview: string;
  isFavorite: boolean;
  reasonCode: string;
  productionReady: false;
  createdAt?: string;
}

export interface ProblemFavoritesDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  problemId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ProblemFavoritesDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  problemId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ProblemFavoritesDbActionResult =
  | ProblemFavoritesDbActionSuccess
  | ProblemFavoritesDbActionBlocked
  | ProblemFavoritesDbActionError;

// Dangerous field patterns

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

// Input validation

function validateFavoriteInput(input: ProblemFavoritesDbActionInput): string | null {
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

// Valid difficulties

const VALID_DIFFICULTIES: ReadonlySet<string> = new Set([
  "EASY", "easy", "MEDIUM", "medium", "HARD", "hard", "CHALLENGE", "challenge",
]);

function safeDifficulty(input: string): string {
  const trimmed = input.trim().toLowerCase();
  return VALID_DIFFICULTIES.has(trimmed) || VALID_DIFFICULTIES.has(input.trim())
    ? trimmed
    : "unknown";
}

// Actions

export async function doAddFavoriteProblem(
  input: ProblemFavoritesDbActionInput,
  guard: ProblemFavoritesDbGuardResult,
): Promise<ProblemFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(input.problemId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false, reasonCode: "problem-favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons], productionReady: false,
    };
  }

  const validationError = validateFavoriteInput(input);
  if (validationError !== null) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(input.problemId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false, reasonCode: "invalid-favorite-payload",
      blockedReasons: [validationError], productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemFavoriteRepository(prisma);

    const record = await repository.addFavoriteProblem({
      userId: input.ownerId.trim(),
      problemId: input.problemId.trim(),
      problemTitle: input.problemTitle.trim(),
      difficulty: safeDifficulty(input.difficulty),
      tags: normalizeTags(input.tags),
    });

    return {
      success: true, devOnly: true, writesDatabase: true, callsRepository: true,
      problemId: record.problemId, ownerIdPreview: record.userId,
      isFavorite: true, reasonCode: "favorite-added-db", productionReady: false,
      createdAt: record.createdAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, guard,
      normalizeField(input.problemId), normalizeField(input.ownerId));
  }
}

export async function doRemoveFavoriteProblem(
  problemId: string, ownerId: string,
  guard: ProblemFavoritesDbGuardResult,
): Promise<ProblemFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false, reasonCode: "problem-favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons], productionReady: false,
    };
  }

  if (typeof problemId !== "string" || problemId.trim().length === 0) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: null, ownerIdPreview: normalizeField(ownerId), isFavorite: false,
      reasonCode: "invalid-favorite-payload",
      blockedReasons: ["problemId 必须为非空字符串。"], productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(problemId), ownerIdPreview: null, isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"], productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemFavoriteRepository(prisma);

    await repository.removeFavoriteProblem({
      userId: ownerId.trim(), problemId: problemId.trim(),
    });

    return {
      success: true, devOnly: true, writesDatabase: true, callsRepository: true,
      problemId: problemId.trim(), ownerIdPreview: ownerId.trim(),
      isFavorite: false, reasonCode: "favorite-removed-db", productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard,
      normalizeField(problemId), normalizeField(ownerId));
  }
}

export async function doIsFavoriteProblem(
  problemId: string, ownerId: string,
  guard: ProblemFavoritesDbGuardResult,
): Promise<ProblemFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(problemId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false, reasonCode: "problem-favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons], productionReady: false,
    };
  }

  if (typeof problemId !== "string" || problemId.trim().length === 0) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: null, ownerIdPreview: normalizeField(ownerId), isFavorite: false,
      reasonCode: "invalid-problemId",
      blockedReasons: ["problemId 必须为非空字符串。"], productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false, devOnly: true, writesDatabase: false, callsRepository: false,
      problemId: normalizeField(problemId), ownerIdPreview: null, isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"], productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemFavoriteRepository(prisma);

    const isFav = await repository.isFavoriteProblem({
      userId: ownerId.trim(), problemId: problemId.trim(),
    });

    return {
      success: true, devOnly: true, writesDatabase: false, callsRepository: true,
      problemId: problemId.trim(), ownerIdPreview: ownerId.trim(),
      isFavorite: isFav,
      reasonCode: isFav ? "is-favorite-db" : "is-not-favorite-db",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard,
      normalizeField(problemId), normalizeField(ownerId));
  }
}

// Helpers

function mapActionError(
  error: unknown, _guard: ProblemFavoritesDbGuardResult,
  problemId: string | null, ownerIdPreview: string | null,
): ProblemFavoritesDbActionError {
  const brief = error instanceof Error ? error.constructor.name : "unknown";
  return {
    success: false, devOnly: true, writesDatabase: false, callsRepository: true,
    problemId, ownerIdPreview, isFavorite: false, reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地收藏不受影响。`,
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

// Safe result check

export function problemFavoritesDbActionResultIsSafe(
  result: ProblemFavoritesDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
