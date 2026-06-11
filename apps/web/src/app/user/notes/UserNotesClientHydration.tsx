"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  loadReaderNotes,
  removeReaderNote,
  persistReaderNotes,
  type ReaderLocalNote,
} from "../../lib/local-reader-annotation-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserNotesClientHydrationProps {
  hasDbData: boolean;
  dataSourceNote: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserNotesClientHydration({
  hasDbData,
  dataSourceNote,
}: UserNotesClientHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [localNotes, setLocalNotes] = useState<ReaderLocalNote[]>([]);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => {
    const notes = loadReaderNotes();
    setLocalNotes(notes);
    setMounted(true);
  }, []);

  const handleDeleteLocal = (noteId: string) => {
    const all = loadReaderNotes();
    const updated = removeReaderNote(all, noteId);
    persistReaderNotes(updated);
    setLocalNotes(updated);
    setDeleteMessage("本地笔记已删除。");
    setTimeout(() => setDeleteMessage(null), 4000);
  };

  if (!mounted) {
    return null;
  }

  if (localNotes.length === 0) {
    return (
      <div style={{ marginTop: "16px" }}>
        <p style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>
          本地 localStorage 中暂无笔记。
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="local-notes-title" style={{ marginTop: "24px" }}>
      <div className="panelHeader">
        <p className="eyebrow">Local Fallback</p>
        <h3 id="local-notes-title" style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>
          📝 本地笔记 (localStorage)
          {localNotes.length > 0 ? ` (${localNotes.length})` : ""}
        </h3>
        <p style={{ color: "#92400e", fontSize: "11px", fontStyle: "italic", marginTop: "2px" }}>
          本地存储的笔记（仅保存在当前浏览器，未同步数据库）
        </p>
      </div>

      {deleteMessage ? (
        <p style={{ color: "#16a34a", fontSize: "11px", margin: "8px 0" }} aria-live="polite">
          {deleteMessage}
        </p>
      ) : null}

      <div className="chunkList" style={{ marginTop: "10px" }}>
        {localNotes.map((n, index) => (
          <article className="chunkItem" key={n.noteId + "-" + index}>
            <div className="panelHeaderRow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="eyebrow">
                  {Math.round(n.progressRatio * 100)}% · LOCAL · {n.sourceType}
                </p>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "2px 0" }}>{n.bookTitle}</h3>
                <p className="panelNote" style={{ fontSize: "12px", color: "#64748b" }}>{n.chapterTitle}</p>
                {n.excerptPreview ? (
                  <p style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic", margin: "4px 0", borderLeft: "2px solid #e2e8f0", paddingLeft: "6px" }}>
                    {n.excerptPreview.length > 80 ? n.excerptPreview.slice(0, 80) + "..." : n.excerptPreview}
                  </p>
                ) : null}
                <p style={{ fontSize: "12px", color: "#334155", margin: "4px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {n.noteText.length > 100 ? n.noteText.slice(0, 100) + "..." : n.noteText}
                </p>
                <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                  创建：{new Date(n.createdAt).toLocaleString()}
                  {n.updatedAt !== n.createdAt ? ` · 更新：${new Date(n.updatedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                <Link className="primaryLink" href={`/reader?bookId=${encodeURIComponent(n.bookId)}&chapterId=${encodeURIComponent(n.chapterId)}`} style={{ fontSize: "12px" }}>
                  Continue Reading
                </Link>
                <button
                  onClick={() => handleDeleteLocal(n.noteId)}
                  style={{ background: "transparent", border: "1px solid #fecaca", borderRadius: "4px", color: "#dc2626", cursor: "pointer", fontSize: "10px", fontWeight: 600, padding: "2px 8px" }}
                  type="button"
                  aria-label={`删除本地笔记 ${n.bookTitle}`}
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p style={{ color: "#92400e", fontSize: "10px", fontStyle: "italic", marginTop: "10px" }}>
        dev-only · 本地存储 · 未接生产账号 · 不保存完整章节正文 · noteText 限制 1000 字 · 可删除
      </p>
    </section>
  );
}
