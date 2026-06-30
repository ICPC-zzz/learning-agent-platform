"use server";

/**
 * Article Favorites DB Server Action — dev-only toggle/check helpers.
 */

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
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";

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
  const session = await getCurrentAuthSession();
  const guard = evaluateArticleLibraryDbGuard(undefined);
  if (!session.hasSession) {
    return {
      ...buildBlockedResult(guard, articleId),
      uiMessage: "请先登录后再收藏文章。",
    };
  }

  const productionGuard = { ...guard, enabled: true, callsRepository: true, sessionPayload: null };
  const result = currentIsFavorite
    ? await doRemoveFavoriteArticle(articleId, session.userId, productionGuard)
    : await doAddFavoriteArticle({
        articleId,
        articleTitle,
        sourcePlatform,
        sourceName,
        originalUrl,
        ownerId: session.userId,
      }, productionGuard);

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
        ? "已加入文章收藏。"
        : "已从文章收藏中移除。",
    };
  }

  return {
    ...result,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "文章收藏操作未完成，请先登录或稍后重试。",
  };
}

export async function checkArticleFavoriteDbAction(
  articleId: string,
): Promise<ArticleFavoritesDbActionResult> {
  const session = await getCurrentAuthSession();
  const guard = evaluateArticleLibraryDbGuard(undefined);
  if (!session.hasSession) {
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

  return doIsFavoriteArticle(articleId, session.userId, { ...guard, enabled: true, callsRepository: true, sessionPayload: null });
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
