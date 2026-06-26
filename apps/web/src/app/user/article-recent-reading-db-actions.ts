/**
 * Article Recent Reading DB Actions — dev-only server actions for article
 * reading history persistence.
 */

import {
  getPrismaClient,
  PrismaArticleRepository,
} from "@learning-agent-platform/db";

import {
  evaluateArticleLibraryDbGuard,
  type ArticleLibraryDbGuardResult,
} from "./article-library-db-guard";

export interface ArticleRecentReadingDbActionInput {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  ownerId: string;
  lastReadAt?: Date;
}

export interface ArticleRecentReadingDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  articleId: string;
  ownerIdPreview: string;
  reasonCode: string;
  productionReady: false;
  updatedAt?: string;
}

export interface ArticleRecentReadingDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  articleId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface ArticleRecentReadingDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  articleId: string | null;
  ownerIdPreview: string | null;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type ArticleRecentReadingDbActionResult =
  | ArticleRecentReadingDbActionSuccess
  | ArticleRecentReadingDbActionBlocked
  | ArticleRecentReadingDbActionError;

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

function validateInput(input: ArticleRecentReadingDbActionInput): string | null {
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

export async function doRecordArticleReading(
  input: ArticleRecentReadingDbActionInput,
  guard: ArticleLibraryDbGuardResult,
): Promise<ArticleRecentReadingDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(input.articleId),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const validationError = validateInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: normalizeField(input.articleId),
      ownerIdPreview: normalizeField(input.ownerId),
      reasonCode: "invalid-article-reading-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    const record = await repository.recordArticleReading({
      userId: input.ownerId.trim(),
      articleId: input.articleId.trim(),
      articleTitle: input.articleTitle.trim(),
      sourcePlatform: input.sourcePlatform.trim(),
      sourceName: input.sourceName.trim(),
      originalUrl: input.originalUrl.trim(),
      lastReadAt: input.lastReadAt ?? new Date(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      articleId: record.articleId,
      ownerIdPreview: record.userId,
      reasonCode: "article-reading-recorded-db",
      productionReady: false,
      updatedAt: record.updatedAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(input.articleId), normalizeField(input.ownerId));
  }
}

function mapActionError(
  error: unknown,
  guard: ArticleLibraryDbGuardResult,
  articleId: string | null,
  ownerId: string | null,
): ArticleRecentReadingDbActionError {
  const message = error instanceof Error ? error.message : "Unknown DB error";
  return {
    success: false,
    devOnly: true,
    writesDatabase: true,
    callsRepository: true,
    articleId,
    ownerIdPreview: ownerId,
    reasonCode: "db-action-failed",
    message: guard.blockedReasons.length > 0 ? guard.blockedReasons[0] : message,
    productionReady: false,
  };
}

function normalizeField(value: string): string {
  return typeof value === "string" ? value.trim() : "";
}
