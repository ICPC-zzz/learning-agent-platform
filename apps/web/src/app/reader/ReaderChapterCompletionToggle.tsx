"use client";

import { useCallback, useEffect, useState } from "react";

export interface ReaderChapterCompletionToggleProps {
  bookId?: string | null;
  chapterId?: string | null;
}

const STORAGE_KEY_PREFIX = "learning-agent-platform:reader-completed";

function buildStorageKey(
  bookId?: string | null,
  chapterId?: string | null,
): string | null {
  if (!bookId || !chapterId) return null;
  return `${STORAGE_KEY_PREFIX}:${bookId}:${chapterId}`;
}

function readCompletedStatus(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setCompletedStatus(key: string): void {
  try {
    localStorage.setItem(key, "true");
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function removeCompletedStatus(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // silently ignore.
  }
}

export function ReaderChapterCompletionToggle({
  bookId,
  chapterId,
}: ReaderChapterCompletionToggleProps) {
  const storageKey = buildStorageKey(bookId, chapterId);
  const [completed, setCompleted] = useState(false);
  const [dbSyncMessage, setDbSyncMessage] = useState<string | null>(null);

  // Read from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    setCompleted(readCompletedStatus(storageKey));
  }, [storageKey]);

  const handleToggle = useCallback(() => {
    if (!storageKey) return;
    if (!bookId || !chapterId) return;

    // Compute next state outside of setState updater to keep the
    // Server Action call out of React's render phase.
    const next = !completed;

    // Update localStorage immediately (optimistic, also serves as fallback)
    if (next) {
      setCompletedStatus(storageKey);
    } else {
      removeCompletedStatus(storageKey);
    }

    setCompleted(next);
    setDbSyncMessage(
      "已更新本地已读标记。开发预览数据库同步需在同步面板手动触发。",
    );
  }, [storageKey, bookId, chapterId, completed]);

  // Clear sync message when book/chapter changes
  useEffect(() => {
    setDbSyncMessage(null);
  }, [bookId, chapterId]);

  // Don't render if no chapter is loaded (empty state)
  if (!chapterId) {
    return null;
  }

  // Missing identifiers — show disabled state
  if (!storageKey) {
    return (
      <section
        aria-label="本地已读标记"
        className="readerChapterCompletion readerChapterCompletionDisabled"
      >
        <span className="readerChapterCompletionLabel">本章已读</span>
        <span className="readerChapterCompletionHint">
          缺少章节标识，无法保存本地已读标记。
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label="本地已读标记"
      className="readerChapterCompletion"
    >
      <button
        className="readerChapterCompletionToggle"
        onClick={handleToggle}
        type="button"
      >
        {completed ? "取消本地已读标记" : "标记本章已读"}
      </button>
      <span className="readerChapterCompletionNote">
        数据库同步为开发预览能力。保存失败时继续使用当前浏览器本地存储。
      </span>
      {dbSyncMessage !== null ? (
        <span aria-live="polite" className="readerChapterCompletionNote">
          {dbSyncMessage}
        </span>
      ) : null}
    </section>
  );
}
