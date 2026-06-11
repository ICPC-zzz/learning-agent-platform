import type { PrismaClient } from "@prisma/client";

import type {
  AddReaderBookmarkInput,
  IsReaderBookmarkedInput,
  ListReaderBookmarksByOwnerInput,
  ReaderBookmarkRecord,
  ReaderBookmarkRepository,
  RemoveReaderBookmarkInput,
} from "../types.js";

/**
 * Prisma-backed ReaderBookmarkRepository for dev-only reader bookmarks.
 *
 * ALL methods are dev-only. The guard (reader-bookmarks-db-guard) must pass
 * before any method is called.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 *
 * @devOnly — not production-ready
 */
export class PrismaReaderBookmarkRepository implements ReaderBookmarkRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addReaderBookmark(
    input: AddReaderBookmarkInput,
  ): Promise<ReaderBookmarkRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");
    const bookTitle = normalizeRequiredText(input.bookTitle, "bookTitle required");
    const chapterTitle = normalizeRequiredText(input.chapterTitle, "chapterTitle required");
    const progressRatio = normalizeProgressRatio(input.progressRatio);
    const sourceType = normalizeRequiredText(input.sourceType, "sourceType required");

    // Upsert: idempotent for same userId+bookId+chapterId
    return this.prisma.readerBookmark.upsert({
      where: {
        userId_bookId_chapterId: { userId, bookId, chapterId },
      },
      create: {
        userId,
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        progressRatio,
        sourceType,
      },
      update: {
        bookTitle,
        chapterTitle,
        progressRatio,
        sourceType,
      },
    });
  }

  async removeReaderBookmark(
    input: RemoveReaderBookmarkInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");

    try {
      await this.prisma.readerBookmark.delete({
        where: {
          userId_bookId_chapterId: { userId, bookId, chapterId },
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

  async listReaderBookmarksByOwner(
    input: ListReaderBookmarksByOwnerInput,
  ): Promise<ReaderBookmarkRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.readerBookmark.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async isReaderBookmarked(
    input: IsReaderBookmarkedInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");

    const count = await this.prisma.readerBookmark.count({
      where: { userId, bookId, chapterId },
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

function normalizeProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
