import { getPrismaClient, PrismaArticleRepository } from "@learning-agent-platform/db";

import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { evaluateArticleLibraryDbGuard } from "./article-library-db-guard";
import {
  buildDbArticleFavoritesLoadResult,
  createEmptyDbArticleFavoritesLoadResult,
  type DbArticleFavoritesLoadResult,
} from "./article-favorites-db-view-model";

export type { DbArticleFavoritesLoadResult } from "./article-favorites-db-view-model";

export async function loadDbArticleFavorites(
  cookieValue: string | undefined,
): Promise<DbArticleFavoritesLoadResult> {
  const guard = evaluateArticleLibraryDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbArticleFavoritesLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `文章收藏 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "文章收藏 DB 持久化默认关闭。使用本地 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbArticleFavoritesLoadResult(
      true,
      "DB 文章收藏已启用但当前无开发会话。使用本地 fallback。",
    );
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    const records = await repository.listFavoriteArticlesByOwner({
      userId: guard.sessionPayload.userIdPreview,
      limit: 200,
    });

    return buildDbArticleFavoritesLoadResult(records, guard.sessionPayload.displayName);
  } catch {
    return createEmptyDbArticleFavoritesLoadResult(
      true,
      "DB 文章收藏读取失败。页面将继续使用本地 fallback。",
    );
  }
}

export function getArticleLibraryDbGuardEnabled(cookieValue: string | undefined): boolean {
  return evaluateArticleLibraryDbGuard(cookieValue).enabled;
}

export function getArticleLibraryDevSessionOwnerId(cookieValue: string | undefined): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
