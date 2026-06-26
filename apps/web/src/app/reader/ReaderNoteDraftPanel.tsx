"use client";

import { useCallback, useEffect, useState } from "react";

import {
  buildReaderNoteStorageKey,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  isReaderLocalStorageAvailable,
  readReaderLocalNote,
  removeReaderLocalNote,
  subscribeReaderLocalStorageChanges,
  type ReaderLocalNoteRecord,
  writeReaderLocalNote,
} from "./reader-local-storage";

export interface ReaderNoteDraftPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
}

export function ReaderNoteDraftPanel({ bookId, chapterId }: ReaderNoteDraftPanelProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const noteKey = buildReaderNoteStorageKey(bookId, chapterId);

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "cleared" | "editing">("idle");

  const loadDraft = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available || !scope.hasIdentifiers) {
      setDraft("");
      setSavedAt(null);
      setSaveState("idle");
      return;
    }

    const stored = readReaderLocalNote(scope.bookId, scope.chapterId);
    if (stored === null) {
      setDraft("");
      setSavedAt(null);
      setSaveState("idle");
      return;
    }

    setDraft(stored.content);
    setSavedAt(stored.updatedAt);
    setSaveState("idle");
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (changedKey === null || changedKey === noteKey) {
        loadDraft();
      }
    });

    return unsubscribe;
  }, [loadDraft, noteKey]);

  const handleSave = useCallback(() => {
    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      return;
    }

    const nextContent = draft.trim();
    if (nextContent.length === 0) {
      const removed = removeReaderLocalNote(scope.bookId, scope.chapterId);
      if (!removed) {
        setStorageAvailable(false);
        return;
      }

      setDraft("");
      setSavedAt(null);
      setSaveState("cleared");
      return;
    }

    const now = new Date().toISOString();
    const record: ReaderLocalNoteRecord = {
      bookId: scope.bookId,
      chapterId: scope.chapterId,
      content: draft,
      updatedAt: now,
    };

    const saved = writeReaderLocalNote(scope.bookId, scope.chapterId, record);
    if (!saved) {
      setStorageAvailable(false);
      return;
    }

    setSavedAt(now);
    setSaveState("saved");
  }, [draft, scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  const handleClear = useCallback(() => {
    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      return;
    }

    const removed = removeReaderLocalNote(scope.bookId, scope.chapterId);
    if (!removed) {
      setStorageAvailable(false);
      return;
    }

    setDraft("");
    setSavedAt(null);
    setSaveState("cleared");
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  if (!chapterId) {
    return null;
  }

  return (
    <section aria-label="本章笔记草稿" className="readerNoteDraft">
      <h3 className="readerNoteDraftTitle">本章笔记草稿</h3>
      <p className="readerNoteDraftDisclaimer">
        开发预览 - 本地浏览器记录（仅保存在当前浏览器，不写入数据库，不发送给 AI）。
      </p>

      {!storageAvailable && <p className="readerNoteDraftHint">本地记录不可用：当前浏览器无法访问 localStorage。</p>}

      {storageAvailable && !scope.hasIdentifiers && (
        <p className="readerNoteDraftHint">缺少 bookId 或 chapterId，当前章节无法保存本地笔记草稿。</p>
      )}

      {storageAvailable && scope.hasIdentifiers && (
        <>
          <textarea
            className="readerNoteDraftTextarea"
            onChange={(event) => {
              setDraft(event.target.value);
              setSaveState("editing");
            }}
            placeholder="记录你对本章的理解、疑问或待复习点……"
            rows={6}
            value={draft}
          />

          <div className="readerNoteDraftFooter">
            <button className="readerBookmarksBtn readerBookmarksBtnAdd" onClick={handleSave} type="button">
              保存草稿
            </button>
            <button
              className="readerNoteDraftClearBtn"
              disabled={draft.length === 0 && savedAt === null}
              onClick={handleClear}
              type="button"
            >
              清空草稿
            </button>
          </div>

          <div aria-live="polite" className="readerNoteDraftStatus">
            {saveState === "saved" && `已保存到当前浏览器（${formatReaderLocalTimestamp(savedAt)}）`}
            {saveState === "editing" && "草稿已修改，尚未保存"}
            {saveState === "cleared" && "当前章节草稿已清空"}
            {saveState === "idle" && savedAt !== null && `最近保存：${formatReaderLocalTimestamp(savedAt)}`}
            {saveState === "idle" && savedAt === null && "当前章节暂无本地草稿"}
          </div>
        </>
      )}
    </section>
  );
}
