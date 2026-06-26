"use client";

import { useEffect, useState } from "react";

import {
  loadReaderBookmarks,
  loadReaderNotes,
} from "../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserDashboardLocalStatsHydrationProps {
  /** DB reader bookmarks count (from server render, may be 0 when guard off). */
  dbBookmarksCount: number;
  /** Source of DB bookmarks data. */
  dbBookmarksSource: "db" | "local" | "none";
  /** DB reader notes count. */
  dbNotesCount: number;
  /** Source of DB notes data. */
  dbNotesSource: "db" | "local" | "none";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserDashboardLocalStatsHydration({
  dbBookmarksCount,
  dbBookmarksSource,
  dbNotesCount,
  dbNotesSource,
}: UserDashboardLocalStatsHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [localBookmarkCount, setLocalBookmarkCount] = useState(0);
  const [localNoteCount, setLocalNoteCount] = useState(0);

  useEffect(() => {
    const bookmarks = loadReaderBookmarks();
    const notes = loadReaderNotes();
    setLocalBookmarkCount(bookmarks.length);
    setLocalNoteCount(notes.length);
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Only show local fallback when DB is not the primary source
  const showLocalBookmarks = dbBookmarksSource !== "db" && localBookmarkCount > 0;
  const showLocalNotes = dbNotesSource !== "db" && localNoteCount > 0;

  if (!showLocalBookmarks && !showLocalNotes) {
    return null;
  }

  return (
    <div style={{ marginTop: "8px", fontSize: "11px", color: "#92400e" }}>
      {showLocalBookmarks ? (
        <p style={{ margin: "2px 0", fontStyle: "italic" }}>
          本地书签 fallback 补充：{localBookmarkCount} 条（未连接数据库 · 本地存储）
        </p>
      ) : null}
      {showLocalNotes ? (
        <p style={{ margin: "2px 0", fontStyle: "italic" }}>
          本地笔记 fallback 补充：{localNoteCount} 条（未连接数据库 · 本地存储）
        </p>
      ) : null}
    </div>
  );
}
