/**
 * Article Favorites DB Actions — dev-only server actions for article
 * favorites persistence.
 */

import {
  getPrismaClient,
  PrismaArticleRepository,
} from "@learning-agent-platform/db";

import {
  evaluateArticleLibraryDbGuard,
  type ArticleLibraryDbGuardResult,
} from "./article-library-db-guard";

export interface ArticleFavoritesDbActionInput {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  ownerId: string;
}

export interface ArticleFavoritesDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  articleId: string;
  ownerIdPreview: string;
  isFavorite: boolean;
  reasonCode: string;
  productionReady: false;
  createdAt?: string;
}

export interface ArticleFavoritesDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  articleId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ArticleFavoritesDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  articleId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ArticleFavoritesDbActionResult =
  | ArticleFavoritesDbActionSuccess
  | ArticleFavoritesDbActionBlocked
  | ArticleFavoritesDbActionError;

const DANGEROUS_FIELD_PATTERNS: RegExp[] = [
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

function validateFavoriteInput(input: ArticleFavoritesDbActionInput): string | null {
  if (typeof input.articleId !== "string" || input.articleId.trim().length === 0) {
    return "articleId 必须为非空字符串。";
  }
  if (typeof input.articleTitle !== "string" || input.articleTitle.trim().length === 0) {
    return "articleTitle 必须为非空字符串。";
  }
  if (typeof input.sourcePlatform !== "string" || input.sourcePlatform.trim().length === 0) {
    return "sourcePlatform 必须为非空字符串。";
  }
  if (typeof input.sourceName !== "string" || input.sourceName.trim().length === 0) {
    return "sourceName 必须为非空字符串。";
  }
  if (typeof input.originalUrl !== "string" || input.originalUrl.trim().length === 0) {
    return "originalUrl 必须为非空字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

export async function doAddFavoriteArticle(
  input: ArticleFavoritesDbActionInput,
  guard: ArticleLibraryDbGuardResult,
): Promise<ArticleFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(input.articleId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false,
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateFavoriteInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(input.articleId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false,
      reasonCode: "invalid-article-favorite-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    const record = await repository.addFavoriteArticle({
      userId: input.ownerId.trim(),
      articleId: input.articleId.trim(),
      articleTitle: input.articleTitle.trim(),
      sourcePlatform: input.sourcePlatform.trim(),
      sourceName: input.sourceName.trim(),
      originalUrl: input.originalUrl.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      articleId: record.articleId,
      ownerIdPreview: record.userId,
      isFavorite: true,
      reasonCode: "favorite-added-db",
      productionReady: false,
      createdAt: record.createdAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(input.articleId), normalizeField(input.ownerId));
  }
}

export async function doRemoveFavoriteArticle(
  articleId: string,
  ownerId: string,
  guard: ArticleLibraryDbGuardResult,
): Promise<ArticleFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(articleId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof articleId !== "string" || articleId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: null,
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "invalid-article-favorite-payload",
      blockedReasons: ["articleId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(articleId),
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    await repository.removeFavoriteArticle({
      userId: ownerId.trim(),
      articleId: articleId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      articleId: articleId.trim(),
      ownerIdPreview: ownerId.trim(),
      isFavorite: false,
      reasonCode: "favorite-removed-db",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(articleId), normalizeField(ownerId));
  }
}

export async function doIsFavoriteArticle(
  articleId: string,
  ownerId: string,
  guard: ArticleLibraryDbGuardResult,
): Promise<ArticleFavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(articleId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof articleId !== "string" || articleId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: null,
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "invalid-article-id",
      blockedReasons: ["articleId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(articleId),
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    const isFavorite = await repository.isFavoriteArticle({
      userId: ownerId.trim(),
      articleId: articleId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: false,
      callsRepository: true,
      articleId: articleId.trim(),
      ownerIdPreview: ownerId.trim(),
      isFavorite,
      reasonCode: isFavorite ? "favorite-exists-db" : "favorite-not-found-db",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(articleId), normalizeField(ownerId));
  }
}

function mapActionError(
  error: unknown,
  guard: ArticleLibraryDbGuardResult,
  articleId: string | null,
  ownerId: string | null,
): ArticleFavoritesDbActionError {
  const message = error instanceof Error ? error.message : "Unknown DB error";
  return {
    success: false,
    devOnly: true,
    writesDatabase: true,
    callsRepository: true,
    articleId,
    ownerIdPreview: ownerId,
    isFavorite: false,
    reasonCode: "db-action-failed",
    message: guard.blockedReasons.length > 0 ? guard.blockedReasons[0] : message,
    productionReady: false,
  };
}

function normalizeField(value: string): string {
  return typeof value === "string" ? value.trim() : "";
}
