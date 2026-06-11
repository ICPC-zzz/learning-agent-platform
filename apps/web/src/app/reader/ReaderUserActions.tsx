"use client";

import { useCallback, useEffect, useState } from "react";
import { FavoriteBookButton } from "../../components/books/FavoriteBookButton";
import {
  addRecentReading,
  loadRecentReadings,
  persistRecentReadings,
  type RecentReadingEntry,
} from "../../lib/local-user-library-store";

interface ReaderUserActionsProps {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  sourceType?: string;
  /** Whether DB favorites guard is enabled for this session. */
  dbFavoritesEnabled?: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId?: string | null;
}

export function ReaderUserActions({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
  sourceType,
  dbFavoritesEnabled = false,
  devSessionOwnerId = null,
}: ReaderUserActionsProps) {
  const [mounted, setMounted] = useState(false);
  const [markedRecent, setMarkedRecent] = useState(false);

  // Check if already marked as recent
  useEffect(() => {
    const entries = loadRecentReadings();
    const already = entries.some(
      (e) => e.bookId === bookId && e.chapterId === chapterId,
    );
    setMarkedRecent(already);
    setMounted(true);
  }, [bookId, chapterId]);

  const handleMarkRecent = useCallback(() => {
    const entry: RecentReadingEntry = {
      bookId,
      chapterId,
      bookTitle,
      chapterTitle,
      sourceType: sourceType ?? "未知来源",
      lastReadAt: new Date().toISOString(),
    };
    const entries = loadRecentReadings();
    const updated = addRecentReading(entries, entry);
    persistRecentReadings(updated);
    setMarkedRecent(true);
  }, [bookId, chapterId, bookTitle, chapterTitle, sourceType]);

  if (!mounted) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
      <FavoriteBookButton
        bookId={bookId}
        title={bookTitle}
        sourceType={sourceType}
        firstChapterId={chapterId}
        dbFavoritesEnabled={dbFavoritesEnabled}
        devSessionOwnerId={devSessionOwnerId}
      />
      <button
        onClick={handleMarkRecent}
        disabled={markedRecent}
        style={{
          alignItems: "center",
          background: markedRecent ? "#dcfce7" : "#f8fafc",
          border: markedRecent ? "1px solid #22c55e" : "1px solid #cbd5e1",
          borderRadius: "8px",
          color: markedRecent ? "#166534" : "#475569",
          cursor: markedRecent ? "default" : "pointer",
          display: "inline-flex",
          font: "inherit",
          fontSize: "13px",
          fontWeight: 600,
          gap: "4px",
          opacity: markedRecent ? 0.8 : 1,
          padding: "6px 14px",
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }}
        aria-label={markedRecent ? "已记录最近阅读" : "记录为最近阅读"}
        title="本地开发记录"
      >
        <span aria-hidden="true">{markedRecent ? "✓" : "📖"}</span>
        {markedRecent ? "已记录" : "记录最近阅读"}
      </button>
      <span
        style={{
          color: "#92400e",
          fontSize: "11px",
          fontStyle: "italic",
          lineHeight: "32px",
        }}
      >
        本地开发记录 · 未同步数据库
      </span>
    </div>
  );
}
