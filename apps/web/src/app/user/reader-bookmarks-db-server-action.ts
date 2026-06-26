"use server";

/**
 * Reader Bookmarks DB Server Action — dev-only server actions for reader
 * bookmarks DB persistence.
 *
 * These are "use server" functions callable from client components.
 * Each reads the dev session cookie, evaluates the guard, and performs
 * the requested operation.
 *
 * @module reader-bookmarks-db-server-action
 * @previewOnly — dev-only; never production sync
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { evaluateReaderBookmarksDbGuard } from "./reader-bookmarks-db-guard";
import {
  doAddReaderBookmark,
  doRemoveReaderBookmark,
  type ReaderBookmarksDbActionResult,
} from "./reader-bookmarks-db-actions";

// ---------------------------------------------------------------------------
// Action: Toggle bookmark (add if not bookmarked, remove if bookmarked)
// ---------------------------------------------------------------------------

export interface ToggleBookmarkResult {
  success: boolean;
  devOnly: true;
  writesDatabase: boolean;
  isBookmarked: boolean;
  bookmarkId: string | null;
  bookId: string | null;
  chapterId: string | null;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
  uiMessage: string;
}

export interface ToggleBookmarkInput {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
}

/**
 * Toggle a reader bookmark: add if not bookmarked, remove if bookmarked.
 */
export async function toggleReaderBookmarkDbAction(
  input: ToggleBookmarkInput,
  currentIsBookmarked: boolean,
): Promise<ToggleBookmarkResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateReaderBookmarksDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      ...buildBlockedResult(guard, input.bookId, input.chapterId),
      uiMessage: buildBlockedUiMessage(guard),
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  let result: ReaderBookmarksDbActionResult;

  if (currentIsBookmarked) {
    result = await doRemoveReaderBookmark(
      input.bookId,
      input.chapterId,
      ownerId,
      guard,
    );
  } else {
    result = await doAddReaderBookmark(
      {
        bookId: input.bookId,
        chapterId: input.chapterId,
        bookTitle: input.bookTitle,
        chapterTitle: input.chapterTitle,
        progressRatio: input.progressRatio,
        sourceType: input.sourceType,
        ownerId,
      },
      guard,
    );
  }

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/user/bookmarks");
      revalidatePath("/reader");
    } catch {
      // best-effort
    }

    return {
      success: true,
      devOnly: true,
      writesDatabase: result.writesDatabase,
      isBookmarked: result.isBookmarked,
      bookmarkId: result.bookmarkId,
      bookId: result.bookId,
      chapterId: result.chapterId,
      reasonCode: result.reasonCode,
      blockedReasons: [],
      productionReady: false,
      uiMessage: result.isBookmarked
        ? "已添加到开发 DB 书签（dev-only · 未接生产同步）"
        : "已从开发 DB 书签中移除（dev-only · 未接生产同步）",
    };
  }

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    isBookmarked: false,
    bookmarkId: result.bookmarkId,
    bookId: result.bookId,
    chapterId: result.chapterId,
    reasonCode: result.reasonCode,
    blockedReasons: "blockedReasons" in result ? result.blockedReasons : [],
    productionReady: false,
    uiMessage: "reasonCode" in result && result.reasonCode === "db-action-failed"
      ? (result as { message: string }).message
      : "书签操作未完成。本地书签不受影响。",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBlockedResult(
  guard: ReturnType<typeof evaluateReaderBookmarksDbGuard>,
  bookId: string,
  chapterId: string,
): ToggleBookmarkResult {
  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    isBookmarked: false,
    bookmarkId: null,
    bookId: bookId || null,
    chapterId: chapterId || null,
    reasonCode: "reader-bookmarks-db-disabled-by-default",
    blockedReasons: [...guard.blockedReasons],
    productionReady: false,
    uiMessage: "",
  };
}

function buildBlockedUiMessage(
  guard: ReturnType<typeof evaluateReaderBookmarksDbGuard>,
): string {
  if (guard.blockedReasons.length === 0) {
    return "阅读器书签 DB 持久化未启用。使用本地书签 fallback。";
  }
  return guard.blockedReasons[0];
}
