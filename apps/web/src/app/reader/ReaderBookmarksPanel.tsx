"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildReaderBookmarkStorageKey,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  isReaderLocalStorageAvailable,
  readReaderLocalBookmark,
  removeReaderLocalBookmark,
  subscribeReaderLocalStorageChanges,
  type ReaderLocalBookmarkRecord,
  writeReaderLocalBookmark,
} from "./reader-local-storage";

export interface ReaderBookmarksPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

function getScrollPercent(): number | null {
  try {
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) {
      return null;
    }

    const raw = Math.round((window.scrollY / maxScroll) * 100);
    return Math.max(0, Math.min(100, raw));
  } catch {
    return null;
  }
}

export function ReaderBookmarksPanel({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
}: ReaderBookmarksPanelProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const bookmarkKey = buildReaderBookmarkStorageKey(bookId, chapterId);

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [bookmark, setBookmark] = useState<ReaderLocalBookmarkRecord | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "cleared">("idle");

  const loadBookmark = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available || !scope.hasIdentifiers) {
      setBookmark(null);
      setSaveState("idle");
      return;
    }

    const stored = readReaderLocalBookmark(scope.bookId, scope.chapterId);
    setBookmark(stored);
    setSaveState("idle");
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    loadBookmark();
  }, [loadBookmark]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (changedKey === null || changedKey === bookmarkKey) {
        loadBookmark();
      }
    });

    return unsubscribe;
  }, [bookmarkKey, loadBookmark]);

  const handleSaveBookmark = useCallback(() => {
    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      return;
    }

    const now = new Date().toISOString();
    const record: ReaderLocalBookmarkRecord = {
      bookId: scope.bookId,
      chapterId: scope.chapterId,
      bookTitle: bookTitle ?? null,
      chapterTitle: chapterTitle ?? null,
      scrollPercent: getScrollPercent(),
      updatedAt: now,
    };

    const saved = writeReaderLocalBookmark(scope.bookId, scope.chapterId, record);
    if (!saved) {
      setStorageAvailable(false);
      return;
    }

    setBookmark(record);
    setSaveState("saved");
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers, bookTitle, chapterTitle]);

  const handleClearBookmark = useCallback(() => {
    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      return;
    }

    const removed = removeReaderLocalBookmark(scope.bookId, scope.chapterId);
    if (!removed) {
      setStorageAvailable(false);
      return;
    }

    setBookmark(null);
    setSaveState("cleared");
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  if (!chapterId) {
    return null;
  }

  return (
    <section aria-label="本地书签" className="readerBookmarks">
      <h3 className="readerBookmarksTitle">本地书签</h3>
      <p className="readerBookmarksDisclaimer">
        开发预览 - 本地浏览器记录（仅保存在当前浏览器，不写入数据库）。
      </p>

      {!storageAvailable && (
        <p className="readerBookmarksEmpty">本地记录不可用：当前浏览器无法访问 localStorage。</p>
      )}

      {storageAvailable && !scope.hasIdentifiers && (
        <p className="readerBookmarksEmpty">缺少 bookId 或 chapterId，当前章节无法保存本地书签。</p>
      )}

      {storageAvailable && scope.hasIdentifiers && (
        <>
          <div className="readerBookmarksActions">
            <button className="readerBookmarksBtn readerBookmarksBtnAdd" onClick={handleSaveBookmark} type="button">
              {bookmark ? "更新当前章节书签" : "保存当前章节书签"}
            </button>
            <button
              className="readerBookmarksBtn readerBookmarksBtnClearChapter"
              disabled={bookmark === null}
              onClick={handleClearBookmark}
              type="button"
            >
              清除本地书签
            </button>
          </div>

          {bookmark ? (
            <div className="readerReadingStatsGroup">
              <p className="readerReadingStatsLabel">书签状态</p>
              <p className="readerReadingStatsValue">
                已记录
                {bookmark.scrollPercent !== null ? `（阅读位置约 ${bookmark.scrollPercent}%）` : "（未捕获滚动位置）"}
              </p>
              <p className="readerReadingStatsTimestamp">
                最近更新：{formatReaderLocalTimestamp(bookmark.updatedAt)}
              </p>
            </div>
          ) : (
            <p className="readerBookmarksEmpty">当前章节暂无本地书签，可点击上方按钮立即保存。</p>
          )}

          {saveState === "saved" && (
            <p className="readerNoteDraftStatus" aria-live="polite">
              书签已保存到当前浏览器。
            </p>
          )}
          {saveState === "cleared" && (
            <p className="readerNoteDraftStatus" aria-live="polite">
              当前章节本地书签已清除。
            </p>
          )}
        </>
      )}
    </section>
  );
}
