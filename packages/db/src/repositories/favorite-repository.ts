import type { PrismaClient } from "@prisma/client";

import type {
  AddFavoriteBookInput,
  BookFavoriteRecord,
  FavoriteRepository,
  IsFavoriteBookInput,
  ListFavoritesByOwnerInput,
  RemoveFavoriteBookInput,
} from "../types.js";

/**
 * Prisma-backed FavoriteRepository for dev-only book favorites.
 *
 * ALL methods are dev-only. The guard (favorites-db-guard) must pass
 * before any method is called.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 */
export class PrismaFavoriteRepository implements FavoriteRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addFavoriteBook(
    input: AddFavoriteBookInput,
  ): Promise<BookFavoriteRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const bookTitle = normalizeRequiredText(input.bookTitle, "bookTitle required");
    const sourceType = normalizeRequiredText(input.sourceType, "sourceType required");
    const firstChapterId = normalizeOptionalText(input.firstChapterId);

    // Upsert: idempotent for same userId+bookId
    return this.prisma.bookFavorite.upsert({
      where: {
        userId_bookId: { userId, bookId },
      },
      create: {
        userId,
        bookId,
        bookTitle,
        sourceType,
        firstChapterId,
      },
      update: {
        bookTitle,
        sourceType,
        firstChapterId,
      },
    });
  }

  async removeFavoriteBook(
    input: RemoveFavoriteBookInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");

    try {
      await this.prisma.bookFavorite.delete({
        where: {
          userId_bookId: { userId, bookId },
        },
      });
      return true;
    } catch (error: unknown) {
      // Prisma throws if record not found — safe to ignore
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
    input: ListFavoritesByOwnerInput,
  ): Promise<BookFavoriteRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.bookFavorite.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async isFavoriteBook(
    input: IsFavoriteBookInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");

    const count = await this.prisma.bookFavorite.count({
      where: { userId, bookId },
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

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
