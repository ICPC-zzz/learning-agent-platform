"use client";

import { useCallback, useEffect, useState } from "react";

import { syncChapterCompletionAction } from "./actions";

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

    setCompleted((prev: boolean) => {
      const next = !prev;

      // Update localStorage immediately (optimistic, also serves as fallback)
      if (next) {
        setCompletedStatus(storageKey);
      } else {
        removeCompletedStatus(storageKey);
      }

      // Attempt DB sync in background
      syncChapterCompletionAction(bookId, chapterId, next)
        .then((result) => {
          if (result.status === "saved") {
            setDbSyncMessage(
              next
                ? "已读状态已同步到数据库（开发预览）。"
                : "已读状态已从数据库清除（开发预览）。",
            );
          } else if (result.status === "skipped") {
            setDbSyncMessage(
              "数据库不可用，已读状态仅保存在当前浏览器。",
            );
          } else {
            setDbSyncMessage(
              result.message ??
                "数据库同步失败，已读状态仅保存在当前浏览器。",
            );
          }
        })
        .catch(() => {
          setDbSyncMessage(
            "数据库同步失败，已读状态仅保存在当前浏览器。",
          );
        });

      return next;
    });
  }, [storageKey, bookId, chapterId]);

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
