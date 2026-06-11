"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  loadReaderBookmarks,
  removeReaderBookmark,
  persistReaderBookmarks,
  type ReaderLocalBookmark,
} from "../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserBookmarksClientHydrationProps {
  /** Whether the DB guard is enabled and has results. */
  hasDbData: boolean;
  /** Human-readable note about data sources. */
  dataSourceNote: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserBookmarksClientHydration({
  hasDbData,
  dataSourceNote,
}: UserBookmarksClientHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [localBookmarks, setLocalBookmarks] = useState<ReaderLocalBookmark[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => {
    const bookmarks = loadReaderBookmarks();
    setLocalBookmarks(bookmarks);
    setMounted(true);
  }, []);

  const handleDeleteLocal = (bookmarkId: string) => {
    const all = loadReaderBookmarks();
    const updated = removeReaderBookmark(all, bookmarkId);
    persistReaderBookmarks(updated);
    setLocalBookmarks(updated);
    setDeleteMessage("本地书签已删除。");

    setTimeout(() => setDeleteMessage(null), 4000);
  };

  if (!mounted) {
    return null;
  }

  if (localBookmarks.length === 0) {
    return (
      <div style={{ marginTop: "16px" }}>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "12px",
            fontStyle: "italic",
          }}
        >
          本地 localStorage 中暂无书签。
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="local-bookmarks-title"
      style={{ marginTop: "24px" }}
    >
      <div className="panelHeader">
        <p className="eyebrow">Local Fallback</p>
        <h3 id="local-bookmarks-title" style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>
          📖 本地书签 (localStorage)
          {localBookmarks.length > 0 ? ` (${localBookmarks.length})` : ""}
        </h3>
        <p
          style={{
            color: "#92400e",
            fontSize: "11px",
            fontStyle: "italic",
            marginTop: "2px",
          }}
        >
          本地存储的书签（仅保存在当前浏览器，未同步数据库）
        </p>
      </div>

      {deleteMessage ? (
        <p
          style={{
            color: "#16a34a",
            fontSize: "11px",
            margin: "8px 0",
          }}
          aria-live="polite"
        >
          {deleteMessage}
        </p>
      ) : null}

      <div className="chunkList" style={{ marginTop: "10px" }}>
        {localBookmarks.map((b, index) => (
          <article className="chunkItem" key={b.bookmarkId + "-" + index}>
            <div className="panelHeaderRow">
              <div>
                <p className="eyebrow">
                  {Math.round(b.progressRatio * 100)}% · LOCAL · {b.sourceType}
                </p>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "2px 0" }}>{b.bookTitle}</h3>
                <p className="panelNote" style={{ fontSize: "12px", color: "#64748b" }}>{b.chapterTitle}</p>
                <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                  创建：{new Date(b.createdAt).toLocaleString()}
                  {b.updatedAt !== b.createdAt
                    ? ` · 更新：${new Date(b.updatedAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <Link
                  className="primaryLink"
                  href={`/reader?bookId=${encodeURIComponent(b.bookId)}&chapterId=${encodeURIComponent(b.chapterId)}`}
                  style={{ fontSize: "12px" }}
                >
                  Continue Reading
                </Link>
                <button
                  onClick={() => handleDeleteLocal(b.bookmarkId)}
                  style={{
                    background: "transparent",
                    border: "1px solid #fecaca",
                    borderRadius: "4px",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 8px",
                  }}
                  type="button"
                  aria-label={`删除本地书签 ${b.bookTitle}`}
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p
        style={{
          color: "#92400e",
          fontSize: "10px",
          fontStyle: "italic",
          marginTop: "10px",
        }}
      >
        dev-only · 本地存储 · 未接生产账号 · 不保存完整章节正文 · 可删除
      </p>
    </section>
  );
}
