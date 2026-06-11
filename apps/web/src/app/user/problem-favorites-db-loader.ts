/**
 * Problem Favorites DB Loader — loads dev-only DB problem favorites
 * for /user and /user/favorites/problems pages.
 *
 * When the guard passes, queries the ProblemFavorite repository.
 * Falls back to empty when guard is blocked or DB is unavailable.
 *
 * @module problem-favorites-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  getPrismaClient,
  PrismaProblemFavoriteRepository,
} from "@learning-agent-platform/db";

import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { evaluateProblemFavoritesDbGuard } from "./problem-favorites-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbProblemFavoriteView {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  tags: string[];
  createdAt: string;
  source: "db-problem-favorite";
  ownerLabel: string | null;
  notice: string;
}

export interface DbProblemFavoritesLoadResult {
  guardEnabled: boolean;
  useDbFavorites: boolean;
  items: DbProblemFavoriteView[];
  message: string;
  ownerLabel: string | null;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load DB problem favorites for the current dev session.
 * Queries the ProblemFavorite repository when guard passes.
 * Falls back to empty results when guard is blocked.
 */
export async function loadDbProblemFavorites(
  cookieValue: string | undefined,
): Promise<DbProblemFavoritesLoadResult> {
  const guard = evaluateProblemFavoritesDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbProblemFavoritesLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `题目收藏 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "题目收藏 DB 持久化默认关闭。使用本地收藏 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbProblemFavoritesLoadResult(
      true,
      "DB 题目收藏已启用但当前无开发会话。使用本地收藏 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaProblemFavoriteRepository(prisma);

    const records = await repository.listFavoritesByOwner({
      userId: ownerId,
      limit: 200,
    });

    const items: DbProblemFavoriteView[] = records.map((r) => ({
      problemId: r.problemId,
      problemTitle: r.problemTitle,
      difficulty: r.difficulty,
      tags: r.tags,
      createdAt: r.createdAt.toISOString(),
      source: "db-problem-favorite",
      ownerLabel,
      notice: "开发 DB 收藏 · 绑定 dev session · 未接生产同步",
    }));

    return {
      guardEnabled: true,
      useDbFavorites: true,
      items,
      message: `加载了 ${items.length} 条 DB 题目收藏（dev-only）。`,
      ownerLabel,
    };
  } catch (error: unknown) {
    const brief =
      error instanceof Error ? error.constructor.name : "db-load-error";
    return createEmptyDbProblemFavoritesLoadResult(
      true,
      `DB 题目收藏查询失败（${brief}）。使用本地收藏 fallback。`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyDbProblemFavoritesLoadResult(
  guardEnabled: boolean,
  message: string,
): DbProblemFavoritesLoadResult {
  return {
    guardEnabled,
    useDbFavorites: false,
    items: [],
    message,
    ownerLabel: null,
  };
}

export function getProblemFavoritesDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateProblemFavoritesDbGuard(cookieValue).enabled;
}

export function getProblemFavoritesDevSessionOwnerId(
  cookieValue: string | undefined,
): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
