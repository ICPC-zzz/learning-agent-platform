/**
 * User Bookmarks Page View Model — computes bookmark list data
 * for the /user/bookmarks page.
 *
 * Prioritizes DB data when available, falls back to localStorage.
 *
 * @module user-bookmarks-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbReaderBookmarkView } from "../reader-bookmarks-db-loader";
import type { ReaderLocalBookmark } from "../../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookmarkPageItemView {
  id: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  sourceType: string;
  sourceLabel: "db" | "local";
  ownerLabel: string;
  createdAt: string;
  updatedAt: string;
  readerLink: string;
}

export interface BookmarksPageViewModel {
  items: BookmarkPageItemView[];
  totalCount: number;
  dataSource: "db" | "local" | "none";
  dataSourceNotice: string;
  guardEnabled: boolean;
  hasSession: boolean;
  message: string;
  isDevOnly: true;
  productionReady: false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_SOURCE_NOTICES = {
  db: "开发 DB 数据（dev-only）· 绑定 dev session · 未接生产同步",
  local: "数据来自 localStorage 本地存储 · 未连接数据库 · 未接生产账号",
  none: "暂无书签数据",
} as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildBookmarksPageViewModel(input: {
  dbItems: DbReaderBookmarkView[] | null;
  dbEnabled: boolean;
  hasSession: boolean;
  dbMessage: string;
  localItems: ReaderLocalBookmark[];
}): BookmarksPageViewModel {
  const { dbItems, dbEnabled, hasSession, dbMessage, localItems } = input;

  const useDb = dbEnabled && dbItems !== null && dbItems.length > 0;

  let items: BookmarkPageItemView[];
  let dataSource: "db" | "local" | "none";
  let message: string;

  if (useDb) {
    items = dbItems!.map((r) => ({
      id: r.id,
      bookId: r.bookId,
      chapterId: r.chapterId,
      bookTitle: r.bookTitle,
      chapterTitle: r.chapterTitle,
      progressRatio: r.progressRatio,
      sourceType: r.sourceType,
      sourceLabel: "db" as const,
      ownerLabel: r.ownerLabel,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      readerLink: `/reader?bookId=${encodeURIComponent(r.bookId)}&chapterId=${encodeURIComponent(r.chapterId)}`,
    }));
    dataSource = "db";
    message = dbMessage;
  } else if (localItems.length > 0) {
    items = localItems.map((b) => ({
      id: b.bookmarkId,
      bookId: b.bookId,
      chapterId: b.chapterId,
      bookTitle: b.bookTitle,
      chapterTitle: b.chapterTitle,
      progressRatio: b.progressRatio,
      sourceType: b.sourceType,
      sourceLabel: "local" as const,
      ownerLabel: "local user",
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      readerLink: `/reader?bookId=${encodeURIComponent(b.bookId)}&chapterId=${encodeURIComponent(b.chapterId)}`,
    }));
    dataSource = "local";
    message = `已从本地存储加载 ${localItems.length} 条书签。`;
  } else {
    items = [];
    dataSource = "none";
    message = "暂无书签。在 Reader 页面添加书签后即可在此查看。";
  }

  return {
    items,
    totalCount: items.length,
    dataSource,
    dataSourceNotice:
      dataSource === "db"
        ? DATA_SOURCE_NOTICES.db
        : dataSource === "local"
          ? DATA_SOURCE_NOTICES.local
          : DATA_SOURCE_NOTICES.none,
    guardEnabled: dbEnabled,
    hasSession,
    message,
    isDevOnly: true,
    productionReady: false,
  };
}
