import type { PrismaClient } from "@prisma/client";

import type {
  AddProblemFavoriteInput,
  IsProblemFavoriteInput,
  ListProblemFavoritesByOwnerInput,
  ProblemFavoriteRecord,
  ProblemFavoriteRepository,
  RemoveProblemFavoriteInput,
} from "../types.js";

/**
 * Prisma-backed ProblemFavoriteRepository for dev-only problem favorites.
 *
 * ALL methods are dev-only. The guard (problem-favorites-db-guard) must pass
 * before any method is called.
 *
 * Uses the ProblemFavorite model (added in A387 schema) for native problem
 * favorite storage. No BookFavorite prefix hack.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 */
export class PrismaProblemFavoriteRepository implements ProblemFavoriteRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addFavoriteProblem(
    input: AddProblemFavoriteInput,
  ): Promise<ProblemFavoriteRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const problemTitle = normalizeRequiredText(input.problemTitle, "problemTitle required");
    const difficulty = normalizeRequiredText(input.difficulty, "difficulty required");
    const tags = normalizeTags(input.tags);

    // Upsert: idempotent for same userId+problemId
    return this.prisma.problemFavorite.upsert({
      where: {
        userId_problemId: { userId, problemId },
      },
      create: {
        userId,
        problemId,
        problemTitle,
        difficulty,
        tags,
      },
      update: {
        problemTitle,
        difficulty,
        tags,
      },
    });
  }

  async removeFavoriteProblem(
    input: RemoveProblemFavoriteInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    try {
      await this.prisma.problemFavorite.delete({
        where: {
          userId_problemId: { userId, problemId },
        },
      });
      return true;
    } catch (error: unknown) {
      // Prisma throws P2025 if record not found — safe to ignore
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2025"
      ) {
        return false;
      }
      throw error;
    }
  }

  async listFavoritesByOwner(
    input: ListProblemFavoritesByOwnerInput,
  ): Promise<ProblemFavoriteRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.problemFavorite.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async isFavoriteProblem(
    input: IsProblemFavoriteInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    const count = await this.prisma.problemFavorite.count({
      where: { userId, problemId },
    });
    return count > 0;
  }
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 50);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
