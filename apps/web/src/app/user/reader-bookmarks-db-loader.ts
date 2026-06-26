/**
 * Reader Bookmarks DB Loader — loads dev-only DB bookmarks for the /user page.
 *
 * Reads the dev session cookie, evaluates the guard, and loads
 * bookmarks from the DB when all guards pass.
 *
 * Falls back to empty result when guard is disabled or no session.
 *
 * @module reader-bookmarks-db-loader
 * @previewOnly — dev-only; never production user system
 */

import {
  deserializeDevSession,
} from "../../lib/web-auth-dev-session";
import {
  evaluateReaderBookmarksDbGuard,
} from "./reader-bookmarks-db-guard";
import {
  doListReaderBookmarksByOwner,
} from "./reader-bookmarks-db-actions";
import type { ReaderBookmarkRecord } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbReaderBookmarkView {
  id: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
  ownerLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbReaderBookmarksLoadResult {
  guardEnabled: boolean;
  useDbBookmarks: boolean;
  hasSession: boolean;
  message: string;
  items: DbReaderBookmarkView[];
  notice: string;
}

// ---------------------------------------------------------------------------
// View builder
// ---------------------------------------------------------------------------

function toDbReaderBookmarkView(
  record: ReaderBookmarkRecord,
  ownerLabel: string,
): DbReaderBookmarkView {
  return {
    id: record.id,
    bookId: record.bookId,
    chapterId: record.chapterId,
    bookTitle: record.bookTitle,
    chapterTitle: record.chapterTitle,
    progressRatio: record.progressRatio,
    sourceType: record.sourceType,
    ownerLabel,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function buildDbReaderBookmarksLoadResult(
  records: ReaderBookmarkRecord[],
  ownerLabel: string,
): DbReaderBookmarksLoadResult {
  const items = records.map((r) => toDbReaderBookmarkView(r, ownerLabel));
  return {
    guardEnabled: true,
    useDbBookmarks: true,
    hasSession: true,
    message: `已从开发 DB 加载 ${items.length} 条书签。`,
    items,
    notice: "dev-only · 绑定 dev session · 未接生产同步",
  };
}

export function createEmptyDbReaderBookmarksLoadResult(
  guardEnabled: boolean,
  message: string,
): DbReaderBookmarksLoadResult {
  return {
    guardEnabled,
    useDbBookmarks: false,
    hasSession: false,
    message,
    items: [],
    notice: guardEnabled
      ? "dev-only · guard 已启用但无数据"
      : "DB guard 未启用 · 使用本地 fallback",
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load DB reader bookmarks for the current dev session.
 */
export async function loadDbReaderBookmarks(
  cookieValue: string | undefined,
): Promise<DbReaderBookmarksLoadResult> {
  const guard = evaluateReaderBookmarksDbGuard(cookieValue);

  if (!guard.enabled) {
    return createEmptyDbReaderBookmarksLoadResult(
      false,
      guard.blockedReasons.length > 0
        ? `书签 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "书签 DB 持久化默认关闭。使用本地书签 fallback。",
    );
  }

  if (guard.sessionPayload === null) {
    return createEmptyDbReaderBookmarksLoadResult(
      true,
      "DB 书签已启用但当前无开发会话。使用本地书签 fallback。",
    );
  }

  const ownerId = guard.sessionPayload.userIdPreview;
  const ownerLabel = guard.sessionPayload.displayName;

  try {
    const records = await doListReaderBookmarksByOwner(ownerId, guard);
    return buildDbReaderBookmarksLoadResult(records, ownerLabel);
  } catch {
    return createEmptyDbReaderBookmarksLoadResult(
      true,
      "DB 书签查询失败。本地书签不受影响。",
    );
  }
}

/**
 * Check if the reader bookmarks DB guard is enabled for the current request.
 */
export function getReaderBookmarksDbGuardEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateReaderBookmarksDbGuard(cookieValue).enabled;
}
