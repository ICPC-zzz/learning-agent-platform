/**
 * Favorites DB Loader — loads dev-only DB favorites for the /user page.
 *
 * Reads the dev session cookie, evaluates the guard, and loads
 * favorites from the DB when all guards pass.
 *
 * Falls back to empty result when guard is disabled or no session.
 *
 * @module favorites-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  deserializeDevSession,
} from "../../lib/web-auth-dev-session";
import {
  evaluateFavoritesDbGuard,
} from "./favorites-db-guard";
import {
  doListFavoritesByOwner,
} from "./favorites-db-actions";
import {
  buildDbFavoritesLoadResult,
  createEmptyDbFavoritesLoadResult,
  type DbFavoritesLoadResult,
} from "./favorites-db-view-model";

/**
 * Load DB favorites for the current dev session.
 *
 * @param cookieValue - Raw dev session cookie value (lap-web-dev-session)
 * @returns Safe load result — never exposes secrets or SQL errors.
 */
export async function loadDbFavorites(
  cookieValue: string | undefined,
): Promise<DbFavoritesLoadResult> {
  const guard = evaluateFavoritesDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbFavoritesLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `收藏 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "收藏 DB 持久化默认关闭。使用本地收藏 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbFavoritesLoadResult(
      true,
      "DB 收藏已启用但当前无开发会话。使用本地收藏 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const records = await doListFavoritesByOwner(ownerId, guard);
    return buildDbFavoritesLoadResult(records, ownerLabel);
  } catch {
    return createEmptyDbFavoritesLoadResult(
      true,
      "DB 收藏查询失败。本地收藏不受影响。",
    );
  }
}

/**
 * Check if the favorites DB guard is enabled for the current request.
 */
export function getFavoritesDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateFavoritesDbGuard(cookieValue).enabled;
}

/**
 * Get the owner ID from a dev session cookie.
 * Returns null if no valid session exists.
 */
export function getDevSessionOwnerId(
  cookieValue: string | undefined,
): string | null {
  const session = deserializeDevSession(cookieValue);
  if (session === null) return null;
  return session.userIdPreview;
}
