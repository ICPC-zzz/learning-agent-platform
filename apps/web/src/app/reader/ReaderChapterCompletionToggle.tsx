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

  // Read from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    setCompleted(readCompletedStatus(storageKey));
  }, [storageKey]);

  const handleToggle = useCallback(() => {
    if (!storageKey) return;

    setCompleted((prev: boolean) => {
      const next = !prev;
      if (next) {
        setCompletedStatus(storageKey);
      } else {
        removeCompletedStatus(storageKey);
      }
      return next;
    });
  }, [storageKey]);

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
        仅保存在当前浏览器，不会写入数据库。
      </span>
    </section>
  );
}
