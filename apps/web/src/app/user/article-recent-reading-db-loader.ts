import { getPrismaClient, PrismaArticleRepository } from "@learning-agent-platform/db";

import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { evaluateArticleLibraryDbGuard } from "./article-library-db-guard";
import {
  buildDbArticleRecentReadingLoadResult,
  createEmptyDbArticleRecentReadingLoadResult,
  type DbArticleRecentReadingLoadResult,
} from "./article-recent-reading-db-view-model";

export async function loadDbArticleRecentReadings(
  cookieValue: string | undefined,
  limit: number = 15,
): Promise<DbArticleRecentReadingLoadResult> {
  const guard = evaluateArticleLibraryDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbArticleRecentReadingLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `最近阅读文章 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "最近阅读文章 DB 持久化默认关闭。使用本地 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbArticleRecentReadingLoadResult(
      true,
      "DB 最近阅读文章已启用但当前无开发会话。使用本地 fallback。",
    );
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaArticleRepository(prisma);
    const records = await repository.listArticleReadingsByOwner({
      userId: guard.sessionPayload.userIdPreview,
      limit: Math.min(Math.max(limit, 1), 50),
    });

    return buildDbArticleRecentReadingLoadResult(records, guard.sessionPayload.displayName);
  } catch {
    return createEmptyDbArticleRecentReadingLoadResult(
      true,
      "DB 最近阅读文章读取失败。页面将继续使用本地 fallback。",
    );
  }
}

export function getArticleRecentReadingDbGuardEnabled(cookieValue: string | undefined): boolean {
  return evaluateArticleLibraryDbGuard(cookieValue).enabled;
}

export function getArticleRecentReadingDevSessionOwnerId(cookieValue: string | undefined): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
