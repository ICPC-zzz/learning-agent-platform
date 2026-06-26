"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addReaderBookmark,
  buildStableBookmarkId,
  isReaderBookmarked,
  loadReaderBookmarks,
  persistReaderBookmarks,
  removeReaderBookmarkByChapter,
  type ReaderLocalBookmark,
} from "../../lib/local-reader-annotation-store";

import { toggleReaderBookmarkDbAction } from "../user/reader-bookmarks-db-server-action";

import {
  buildBookmarkControlState,
  type BookmarkControlState,
} from "./reader-annotation-view-model";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReaderBookmarkControlProps {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  sourceType?: string;
  progressRatio?: number;
  /** Whether DB bookmark guard is enabled for this session. */
  dbBookmarkEnabled?: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReaderBookmarkControl({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
  sourceType = "unknown",
  progressRatio = 0,
  dbBookmarkEnabled = false,
  devSessionOwnerId = null,
}: ReaderBookmarkControlProps) {
  const [mounted, setMounted] = useState(false);
  const [isBookmarkedLocal, setIsBookmarkedLocal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dbResultMessage, setDbResultMessage] = useState<string | null>(null);

  // Load initial state from localStorage on mount
  useEffect(() => {
    const bookmarks = loadReaderBookmarks();
    setIsBookmarkedLocal(isReaderBookmarked(bookmarks, bookId, chapterId));
    setMounted(true);
  }, [bookId, chapterId]);

  // Build view model
  const hasDevSession = devSessionOwnerId !== null && devSessionOwnerId !== undefined;
  const controlState: BookmarkControlState = buildBookmarkControlState({
    isBookmarkedInLocal: isBookmarkedLocal,
    localBookmark: isBookmarkedLocal
      ? {
          bookmarkId: buildStableBookmarkId(bookId, chapterId),
          bookId,
          chapterId,
          bookTitle,
          chapterTitle,
          progressRatio,
          sourceType,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null,
    isBookmarkedInDb: false, // Updated after DB call
    dbBookmarkEnabled,
    hasDevSession,
  });

  const handleToggle = useCallback(() => {
    const bookmarks = loadReaderBookmarks();
    const currentlyBookmarked = isReaderBookmarked(bookmarks, bookId, chapterId);

    // Always update localStorage first (optimistic)
    if (currentlyBookmarked) {
      const updated = removeReaderBookmarkByChapter(bookmarks, bookId, chapterId);
      persistReaderBookmarks(updated);
      setIsBookmarkedLocal(false);
    } else {
      const entry: ReaderLocalBookmark = {
        bookmarkId: buildStableBookmarkId(bookId, chapterId),
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        progressRatio,
        sourceType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = addReaderBookmark(bookmarks, entry);
      persistReaderBookmarks(updated);
      setIsBookmarkedLocal(true);
    }

    // Also call DB action if guard is enabled
    if (dbBookmarkEnabled && devSessionOwnerId) {
      toggleReaderBookmarkDbAction(
        {
          bookId,
          chapterId,
          bookTitle,
          chapterTitle,
          progressRatio,
          sourceType,
        },
        currentlyBookmarked,
      )
        .then((result) => {
          setDbResultMessage(result.uiMessage);
        })
        .catch(() => {
          setDbResultMessage("DB 操作失败。本地书签不受影响。");
        });
    }

    // Clear DB message after a few seconds
    setTimeout(() => setDbResultMessage(null), 5000);
  }, [
    bookId,
    chapterId,
    bookTitle,
    chapterTitle,
    progressRatio,
    sourceType,
    dbBookmarkEnabled,
    devSessionOwnerId,
  ]);

  if (!mounted) {
    return null;
  }

  const tooltipText = dbBookmarkEnabled && hasDevSession
    ? "开发 DB 书签 · dev-only · 绑定 dev session"
    : "本地书签 fallback · 未接数据库 · 未接生产账号";

  const tooltipSub = dbBookmarkEnabled && hasDevSession
    ? "未同步生产账号 · 不保存完整章节正文"
    : "开发预览 · 不保存完整章节正文";

  const buttonLabel = controlState.isBookmarked ? "已书签" : "添加书签";
  const ariaLabel = controlState.isBookmarked
    ? `取消书签 ${chapterTitle}`
    : `添加书签 ${chapterTitle}`;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={handleToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          alignItems: "center",
          background: controlState.isBookmarked ? "#dbeafe" : "#f8fafc",
          border: controlState.isBookmarked ? "1px solid #3b82f6" : "1px solid #cbd5e1",
          borderRadius: "8px",
          color: controlState.isBookmarked ? "#1e40af" : "#475569",
          cursor: "pointer",
          display: "inline-flex",
          font: "inherit",
          fontSize: "13px",
          fontWeight: 600,
          gap: "4px",
          padding: "6px 14px",
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }}
        aria-label={ariaLabel}
        title="开发预览"
      >
        <span aria-hidden="true">{controlState.isBookmarked ? "🔖" : "🏷"}</span>
        {buttonLabel}
      </button>

      {showTooltip ? (
        <div
          style={{
            background: "#1e293b",
            borderRadius: "6px",
            color: "#f1f5f9",
            fontSize: "11px",
            left: "50%",
            lineHeight: "1.4",
            padding: "6px 10px",
            pointerEvents: "none",
            position: "absolute",
            top: "calc(100% + 6px)",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            zIndex: 100,
          }}
          role="tooltip"
        >
          {tooltipText}
          <br />
          {tooltipSub}
        </div>
      ) : null}

      {dbResultMessage ? (
        <span
          style={{
            color: "#92400e",
            fontSize: "10px",
            fontStyle: "italic",
            marginLeft: "8px",
            lineHeight: "32px",
          }}
          aria-live="polite"
        >
          {dbResultMessage}
        </span>
      ) : null}

      <span
        style={{
          color: "#92400e",
          fontSize: "10px",
          fontStyle: "italic",
          lineHeight: "32px",
          marginLeft: "8px",
        }}
      >
        {controlState.dataSourceNotice}
      </span>
    </div>
  );
}
