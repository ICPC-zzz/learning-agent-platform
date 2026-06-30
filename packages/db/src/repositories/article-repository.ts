import type { PrismaClient } from "@prisma/client";

import type {
  AddFavoriteArticleInput,
  ArticleFavoriteRecord,
  ArticleReadingRecord,
  ArticleRepository,
  IsFavoriteArticleInput,
  ListArticleReadingsByOwnerInput,
  ListFavoriteArticlesByOwnerInput,
  RecordArticleReadingInput,
  RemoveFavoriteArticleInput,
} from "../types.js";

export class PrismaArticleRepository implements ArticleRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addFavoriteArticle(input: AddFavoriteArticleInput): Promise<ArticleFavoriteRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const articleId = normalizeRequiredText(input.articleId, "articleId required");
    const articleTitle = normalizeRequiredText(input.articleTitle, "articleTitle required");
    const sourcePlatform = normalizeRequiredText(input.sourcePlatform, "sourcePlatform required");
    const sourceName = normalizeRequiredText(input.sourceName, "sourceName required");
    const originalUrl = normalizeRequiredText(input.originalUrl, "originalUrl required");

    return this.prisma.articleFavorite.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: {
        userId,
        articleId,
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
      },
      update: {
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
      },
    });
  }

  async removeFavoriteArticle(input: RemoveFavoriteArticleInput): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const articleId = normalizeRequiredText(input.articleId, "articleId required");

    try {
      await this.prisma.articleFavorite.delete({
        where: { userId_articleId: { userId, articleId } },
      });
      return true;
    } catch (error: unknown) {
      if (isPrismaNotFoundError(error)) return false;
      throw error;
    }
  }

  async listFavoriteArticlesByOwner(input: ListFavoriteArticlesByOwnerInput): Promise<ArticleFavoriteRecord[]> {
    return this.prisma.articleFavorite.findMany({
      where: { userId: normalizeRequiredText(input.userId, "userId required") },
      take: normalizeListLimit(input.limit),
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  async isFavoriteArticle(input: IsFavoriteArticleInput): Promise<boolean> {
    const count = await this.prisma.articleFavorite.count({
      where: {
        userId: normalizeRequiredText(input.userId, "userId required"),
        articleId: normalizeRequiredText(input.articleId, "articleId required"),
      },
    });
    return count > 0;
  }

  async recordArticleReading(input: RecordArticleReadingInput): Promise<ArticleReadingRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const articleId = normalizeRequiredText(input.articleId, "articleId required");
    const articleTitle = normalizeRequiredText(input.articleTitle, "articleTitle required");
    const sourcePlatform = normalizeRequiredText(input.sourcePlatform, "sourcePlatform required");
    const sourceName = normalizeRequiredText(input.sourceName, "sourceName required");
    const originalUrl = normalizeRequiredText(input.originalUrl, "originalUrl required");
    const lastReadAt = normalizeDate(input.lastReadAt);

    return this.prisma.articleReading.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: {
        userId,
        articleId,
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
        lastReadAt,
      },
      update: {
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
        lastReadAt,
      },
    });
  }

  async listArticleReadingsByOwner(input: ListArticleReadingsByOwnerInput): Promise<ArticleReadingRecord[]> {
    return this.prisma.articleReading.findMany({
      where: {
        userId: normalizeRequiredText(input.userId, "userId required"),
        ...(input.since instanceof Date && !Number.isNaN(input.since.getTime())
          ? { lastReadAt: { gte: input.since } }
          : {}),
      },
      take: normalizeListLimit(input.limit),
      orderBy: [{ lastReadAt: "desc" }, { id: "asc" }],
    });
  }
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(errorMessage);
  return normalized;
}

function normalizeDate(value: Date | undefined): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return new Date();
  return value;
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}
