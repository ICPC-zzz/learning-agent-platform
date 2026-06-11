"use server";

/**
 * Favorites DB Server Action — dev-only server actions for book favorites.
 *
 * These are "use server" functions callable from client components.
 * Each reads the dev session cookie, evaluates the guard, and performs
 * the requested operation.
 *
 * @module favorites-db-server-action
 * @previewOnly — dev-only; never production sync
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { evaluateFavoritesDbGuard } from "./favorites-db-guard";
import {
  doAddFavoriteBook,
  doRemoveFavoriteBook,
  doIsFavoriteBook,
  type FavoritesDbActionResult,
} from "./favorites-db-actions";

// ---------------------------------------------------------------------------
// Action: Toggle favorite (add or remove)
// ---------------------------------------------------------------------------

export interface ToggleFavoriteResult extends FavoritesDbActionResult {
  uiMessage: string;
}

/**
 * Toggle a book favorite: add if not favorited, remove if favorited.
 */
export async function toggleFavoriteDbAction(
  bookId: string,
  bookTitle: string,
  sourceType: string,
  firstChapterId?: string | null,
  currentIsFavorite?: boolean,
): Promise<ToggleFavoriteResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateFavoritesDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...buildBlockedResult(guard, bookId),
      uiMessage: buildBlockedUiMessage(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  let result: FavoritesDbActionResult;

  if (currentIsFavorite) {
    result = await doRemoveFavoriteBook(bookId, ownerId, guard);
  } else {
    result = await doAddFavoriteBook(
      {
        bookId,
        bookTitle,
        sourceType,
        firstChapterId: firstChapterId ?? null,
        ownerId,
      },
      guard,
    );
  }

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/books");
      revalidatePath(`/books/${bookId}`);
      revalidatePath("/reader");
    } catch {
      // best-effort
    }

    return {
      ...result,
      uiMessage: result.isFavorite
        ? "已添加到开发 DB 收藏（dev-only · 未接生产同步）"
        : "已从开发 DB 收藏中移除（dev-only · 未接生产同步）",
    };
  }

  return {
    ...result,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "收藏操作未完成。本地收藏不受影响。",
  };
}

/**
 * Check if a book is favorited in the DB.
 */
export async function checkFavoriteDbAction(
  bookId: string,
): Promise<FavoritesDbActionResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateFavoritesDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: bookId || null,
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  return doIsFavoriteBook(bookId, guard.sessionPayload.userIdPreview, guard);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBlockedResult(
  guard: ReturnType<typeof evaluateFavoritesDbGuard>,
  bookId: string,
): FavoritesDbActionResult {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: false,
    bookId: bookId || null,
    ownerIdPreview: null,
    isFavorite: false,
    reasonCode: "favorites-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
  };
}

function buildBlockedUiMessage(
  guard: ReturnType<typeof evaluateFavoritesDbGuard>,
): string {
  if (guard.blockedReasons.length === 0) {
    return "收藏 DB 持久化未启用。使用本地收藏 fallback。";
  }
  return guard.blockedReasons[0];
}
