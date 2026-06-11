/**
 * User Notes Page View Model — computes note list data
 * for the /user/notes page.
 *
 * Prioritizes DB data when available, falls back to localStorage.
 *
 * @module user-notes-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbReaderNoteView } from "../reader-notes-db-loader";
import type { ReaderLocalNote } from "../../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotePageItemView {
  id: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  noteTextPreview: string;
  noteText: string;
  excerptPreview: string | null;
  sourceType: string;
  sourceLabel: "db" | "local";
  ownerLabel: string;
  createdAt: string;
  updatedAt: string;
  readerLink: string;
}

export interface NotesPageViewModel {
  items: NotePageItemView[];
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
  none: "暂无笔记数据",
} as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildNotesPageViewModel(input: {
  dbItems: DbReaderNoteView[] | null;
  dbEnabled: boolean;
  hasSession: boolean;
  dbMessage: string;
  localItems: ReaderLocalNote[];
}): NotesPageViewModel {
  const { dbItems, dbEnabled, hasSession, dbMessage, localItems } = input;

  const useDb = dbEnabled && dbItems !== null && dbItems.length > 0;

  let items: NotePageItemView[];
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
      noteTextPreview: r.noteTextPreview,
      noteText: r.noteText,
      excerptPreview: r.excerptPreview,
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
    items = localItems.map((n) => ({
      id: n.noteId,
      bookId: n.bookId,
      chapterId: n.chapterId,
      bookTitle: n.bookTitle,
      chapterTitle: n.chapterTitle,
      progressRatio: n.progressRatio,
      noteTextPreview: n.noteText.length > 80
        ? n.noteText.slice(0, 80) + "..."
        : n.noteText,
      noteText: n.noteText,
      excerptPreview: n.excerptPreview,
      sourceType: n.sourceType,
      sourceLabel: "local" as const,
      ownerLabel: "local user",
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      readerLink: `/reader?bookId=${encodeURIComponent(n.bookId)}&chapterId=${encodeURIComponent(n.chapterId)}`,
    }));
    dataSource = "local";
    message = `已从本地存储加载 ${localItems.length} 条笔记。`;
  } else {
    items = [];
    dataSource = "none";
    message = "暂无笔记。在 Reader 页面添加笔记后即可在此查看。";
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
