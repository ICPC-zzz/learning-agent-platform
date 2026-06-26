"use server";

/**
 * Article Favorites DB Server Action — dev-only toggle/check helpers.
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  evaluateArticleLibraryDbGuard,
} from "./article-library-db-guard";
import {
  doAddFavoriteArticle,
  doRemoveFavoriteArticle,
  doIsFavoriteArticle,
  type ArticleFavoritesDbActionResult,
} from "./article-favorites-db-actions";

export type ToggleArticleFavoriteResult = ArticleFavoritesDbActionResult & {
  uiMessage: string;
};

export async function toggleArticleFavoriteDbAction(
  articleId: string,
  articleTitle: string,
  sourcePlatform: string,
  sourceName: string,
  originalUrl: string,
  currentIsFavorite?: boolean,
): Promise<ToggleArticleFavoriteResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateArticleLibraryDbGuard(cookieValue);
  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...buildBlockedResult(guard, articleId),
      uiMessage: buildBlockedUiMessage(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const result = currentIsFavorite
    ? await doRemoveFavoriteArticle(articleId, ownerId, guard)
    : await doAddFavoriteArticle({
        articleId,
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
        ownerId,
      }, guard);

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/articles");
      revalidatePath("/user/favorites/articles");
      revalidatePath("/user/recent-reading");
    } catch {
      // best effort
    }

    return {
      ...result,
      uiMessage: result.isFavorite
        ? "已加入文章收藏（dev-only / 已写入数据库）"
        : "已从文章收藏中移除（dev-only / 已写入数据库）",
    };
  }

  return {
    ...result,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "文章收藏操作未完成，已保留本地状态。",
  };
}

export async function checkArticleFavoriteDbAction(
  articleId: string,
): Promise<ArticleFavoritesDbActionResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateArticleLibraryDbGuard(cookieValue);
  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: articleId || null,
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  return doIsFavoriteArticle(articleId, guard.sessionPayload.userIdPreview, guard);
}

function buildBlockedResult(
  guard: ReturnType<typeof evaluateArticleLibraryDbGuard>,
  articleId: string,
): ArticleFavoritesDbActionResult {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: false,
    articleId: articleId || null,
    ownerIdPreview: null,
    isFavorite: false,
    reasonCode: "article-library-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
  };
}

function buildBlockedUiMessage(guard: ReturnType<typeof evaluateArticleLibraryDbGuard>): string {
  if (guard.blockedReasons.length === 0) {
    return "文章 DB 持久化未启用。使用本地 fallback。";
  }
  return guard.blockedReasons[0];
}
