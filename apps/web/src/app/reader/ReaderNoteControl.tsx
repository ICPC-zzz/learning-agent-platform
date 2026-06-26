"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addReaderNote,
  generateAnnotationId,
  getReaderNotesByChapter,
  loadReaderNotes,
  persistReaderNotes,
  removeReaderNote,
  type ReaderLocalNote,
} from "../../lib/local-reader-annotation-store";

import { addReaderNoteDbAction, removeReaderNoteDbAction } from "../user/reader-notes-db-server-action";

import {
  buildNoteControlState,
  validateAndNormalizeNoteInput,
  type NoteControlState,
} from "./reader-annotation-view-model";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReaderNoteControlProps {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  sourceType?: string;
  progressRatio?: number;
  /** Whether DB note guard is enabled for this session. */
  dbNoteEnabled?: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReaderNoteControl({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
  sourceType = "unknown",
  progressRatio = 0,
  dbNoteEnabled = false,
  devSessionOwnerId = null,
}: ReaderNoteControlProps) {
  const [mounted, setMounted] = useState(false);
  const [localNotes, setLocalNotes] = useState<ReaderLocalNote[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftExcerpt, setDraftExcerpt] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load initial state from localStorage on mount
  useEffect(() => {
    const allNotes = loadReaderNotes();
    const chapterNotes = getReaderNotesByChapter(allNotes, bookId, chapterId);
    setLocalNotes(chapterNotes);
    setMounted(true);
  }, [bookId, chapterId]);

  // Build view model
  const hasDevSession = devSessionOwnerId !== null && devSessionOwnerId !== undefined;
  const controlState: NoteControlState = buildNoteControlState({
    localNotes,
    dbNoteEnabled,
    hasDevSession,
  });

  const handleAddNote = useCallback(() => {
    // Validate
    const validation = validateAndNormalizeNoteInput({
      text: draftText,
      excerpt: draftExcerpt || null,
    });

    if (!validation.valid) {
      setValidationError(validation.reason ?? "输入无效");
      return;
    }

    setValidationError(null);

    // Create local note entry
    const entry: ReaderLocalNote = {
      noteId: generateAnnotationId("n"),
      bookId,
      chapterId,
      bookTitle,
      chapterTitle,
      progressRatio,
      noteText: validation.normalizedText,
      excerptPreview: validation.normalizedExcerpt,
      sourceType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Always save to localStorage first (optimistic)
    const allNotes = loadReaderNotes();
    const updated = addReaderNote(allNotes, entry);
    persistReaderNotes(updated);
    const chapterNotes = getReaderNotesByChapter(updated, bookId, chapterId);
    setLocalNotes(chapterNotes);

    // Clear draft
    setDraftText("");
    setDraftExcerpt("");
    setSaveMessage("笔记已保存到本地存储（开发预览）。");

    // Also call DB action if guard is enabled
    if (dbNoteEnabled && devSessionOwnerId) {
      addReaderNoteDbAction({
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        progressRatio,
        noteText: validation.normalizedText,
        excerptPreview: validation.normalizedExcerpt,
        sourceType,
      })
        .then((result) => {
          setSaveMessage(result.uiMessage);
        })
        .catch(() => {
          setSaveMessage("笔记已保存到本地存储。DB 操作失败，本地笔记不受影响。");
        });
    }

    // Clear message after a few seconds
    setTimeout(() => setSaveMessage(null), 6000);
  }, [
    bookId,
    chapterId,
    bookTitle,
    chapterTitle,
    progressRatio,
    sourceType,
    draftText,
    draftExcerpt,
    dbNoteEnabled,
    devSessionOwnerId,
  ]);

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      // Always remove from localStorage first
      const allNotes = loadReaderNotes();
      const updated = removeReaderNote(allNotes, noteId);
      persistReaderNotes(updated);
      const chapterNotes = getReaderNotesByChapter(updated, bookId, chapterId);
      setLocalNotes(chapterNotes);

      setSaveMessage("笔记已从本地存储删除（开发预览）。");

      // Also call DB action if guard is enabled
      if (dbNoteEnabled && devSessionOwnerId) {
        removeReaderNoteDbAction(noteId)
          .then((result) => {
            setSaveMessage(result.uiMessage);
          })
          .catch(() => {
            setSaveMessage("笔记已从本地存储删除。DB 操作失败，本地笔记不受影响。");
          });
      }

      setTimeout(() => setSaveMessage(null), 5000);
    },
    [bookId, chapterId, dbNoteEnabled, devSessionOwnerId],
  );

  if (!mounted) {
    return null;
  }

  const noteCount = controlState.localNotes.length;
  const dataLabel = dbNoteEnabled && hasDevSession
    ? "阅读笔记（开发 DB 预览）"
    : "阅读笔记（开发预览）";
  const fallbackLabel = dbNoteEnabled && hasDevSession
    ? "开发 DB · 未接生产账号 · 不保存完整章节正文"
    : "本地保存 fallback · 未同步生产账号 · 不会保存完整章节正文";

  return (
    <section aria-label={dataLabel} style={{ marginTop: "16px" }}>
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#1e293b",
          margin: "0 0 4px 0",
        }}
      >
        {dataLabel}
        {noteCount > 0 ? ` (${noteCount})` : ""}
      </h3>
      <p
        style={{
          color: "#92400e",
          fontSize: "10px",
          fontStyle: "italic",
          margin: "0 0 8px 0",
        }}
      >
        {fallbackLabel}
      </p>

      {/* Note input area */}
      <textarea
        style={{
          background: "#fff",
          border: validationError ? "1px solid #ef4444" : "1px solid #cbd5e1",
          borderRadius: "6px",
          color: "#334155",
          font: "inherit",
          fontSize: "13px",
          lineHeight: "1.5",
          padding: "8px",
          resize: "vertical",
          width: "100%",
          boxSizing: "border-box",
        }}
        onChange={(event) => {
          setDraftText(event.target.value);
          setValidationError(null);
        }}
        placeholder="记录你对本章的理解、疑问或待复习点……（最多 1000 字）"
        rows={4}
        value={draftText}
        maxLength={1000}
        aria-label="笔记内容"
      />

      {/* Excerpt input (optional) */}
      <input
        type="text"
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          color: "#64748b",
          font: "inherit",
          fontSize: "12px",
          marginTop: "6px",
          padding: "6px 8px",
          width: "100%",
          boxSizing: "border-box",
        }}
        onChange={(event) => setDraftExcerpt(event.target.value)}
        placeholder="摘录（可选，最多 160 字）"
        value={draftExcerpt}
        maxLength={160}
        aria-label="笔记摘录"
      />

      {validationError ? (
        <p
          style={{
            color: "#dc2626",
            fontSize: "11px",
            margin: "4px 0 0 0",
          }}
          aria-live="assertive"
        >
          {validationError}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button
          onClick={handleAddNote}
          disabled={draftText.trim().length === 0}
          style={{
            alignItems: "center",
            background: draftText.trim().length === 0 ? "#f1f5f9" : "#e0f2fe",
            border: draftText.trim().length === 0 ? "1px solid #e2e8f0" : "1px solid #0ea5e9",
            borderRadius: "6px",
            color: draftText.trim().length === 0 ? "#94a3b8" : "#0369a1",
            cursor: draftText.trim().length === 0 ? "not-allowed" : "pointer",
            display: "inline-flex",
            font: "inherit",
            fontSize: "12px",
            fontWeight: 600,
            gap: "4px",
            padding: "5px 12px",
          }}
          type="button"
          aria-label="保存笔记"
        >
          ✏️ 保存笔记
        </button>
        <span
          style={{
            color: "#64748b",
            fontSize: "10px",
            lineHeight: "28px",
          }}
        >
          {draftText.length}/1000
        </span>
      </div>

      {saveMessage ? (
        <p
          style={{
            color: "#16a34a",
            fontSize: "11px",
            margin: "6px 0 0 0",
          }}
          aria-live="polite"
        >
          {saveMessage}
        </p>
      ) : null}

      {/* Existing notes list */}
      {controlState.localNotes.length > 0 ? (
        <div style={{ marginTop: "12px" }}>
          {controlState.localNotes.map((note) => (
            <div
              key={note.noteId}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                marginBottom: "6px",
                padding: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {note.excerptPreview ? (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        fontStyle: "italic",
                        margin: "0 0 4px 0",
                        borderLeft: "2px solid #e2e8f0",
                        paddingLeft: "6px",
                      }}
                    >
                      {note.excerptPreview.length > 80
                        ? note.excerptPreview.slice(0, 80) + "..."
                        : note.excerptPreview}
                    </p>
                  ) : null}
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#334155",
                      margin: "0 0 4px 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {note.noteText.length > 120
                      ? note.noteText.slice(0, 120) + "..."
                      : note.noteText}
                  </p>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "#94a3b8",
                      margin: 0,
                    }}
                  >
                    进度 {Math.round(note.progressRatio * 100)}% · {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.noteId)}
                  style={{
                    background: "transparent",
                    border: "1px solid #fecaca",
                    borderRadius: "4px",
                    color: "#dc2626",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    flexShrink: 0,
                  }}
                  type="button"
                  aria-label={`删除笔记 ${note.noteId}`}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p
          style={{
            color: "#94a3b8",
            fontSize: "11px",
            marginTop: "8px",
          }}
        >
          暂无笔记。在上方输入框中添加笔记即可保存。
        </p>
      )}

      <p
        style={{
          color: "#92400e",
          fontSize: "9px",
          fontStyle: "italic",
          marginTop: "8px",
        }}
      >
        阅读笔记（开发预览）· 本地保存 fallback · 未同步生产账号 · 不会保存完整章节正文 · noteText 限制 1000 字
      </p>
    </section>
  );
}
