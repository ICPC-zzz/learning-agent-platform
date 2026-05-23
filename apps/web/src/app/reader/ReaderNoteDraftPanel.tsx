"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ReaderNoteDraftPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
}

const STORAGE_KEY_PREFIX = "learning-agent-platform:reader-note-draft";
const DEBOUNCE_MS = 500;

function buildStorageKey(
  bookId?: string | null,
  chapterId?: string | null,
): string | null {
  if (!bookId || !chapterId) return null;
  return `${STORAGE_KEY_PREFIX}:${bookId}:${chapterId}`;
}

function readNoteDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveNoteDraft(key: string, text: string): void {
  try {
    if (text.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, text);
    }
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function removeNoteDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // silently ignore.
  }
}

export function ReaderNoteDraftPanel({
  bookId,
  chapterId,
}: ReaderNoteDraftPanelProps) {
  const storageKey = buildStorageKey(bookId, chapterId);
  const [draft, setDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saved" | "unsaved" | "empty"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKeyRef = useRef<string | null>(storageKey);

  // Keep storageKeyRef in sync with props
  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  // Load from localStorage on mount / key change
  useEffect(() => {
    if (!storageKey) {
      setDraft("");
      setSaveStatus("idle");
      return;
    }
    const saved = readNoteDraft(storageKey);
    setDraft(saved);
    setSaveStatus(saved.length > 0 ? "saved" : "empty");
  }, [storageKey]);

  // Cleanup debounce timer on unmount / key change
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [storageKey]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDraft(value);

      if (!storageKeyRef.current) return;

      // Debounce save to localStorage
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }

      if (value.length === 0) {
        setSaveStatus("empty");
        removeNoteDraft(storageKeyRef.current);
        debounceRef.current = null;
        return;
      }

      setSaveStatus("unsaved");
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (storageKeyRef.current) {
          saveNoteDraft(storageKeyRef.current, value);
          setSaveStatus("saved");
        }
      }, DEBOUNCE_MS);
    },
    [],
  );

  const handleClear = useCallback(() => {
    if (!storageKeyRef.current) return;
    removeNoteDraft(storageKeyRef.current);
    setDraft("");
    setSaveStatus("empty");
  }, []);

  // Don't render if no chapter is loaded (empty state)
  if (!chapterId) {
    return null;
  }

  // Missing identifiers — show disabled state
  if (!storageKey) {
    return (
      <section
        aria-label="本章笔记草稿"
        className="readerNoteDraft readerNoteDraftDisabled"
      >
        <h3 className="readerNoteDraftTitle">本章笔记草稿</h3>
        <p className="readerNoteDraftHint">
          开发预览 · 仅保存在当前浏览器，不会写入数据库，也不会发送给 AI。
        </p>
        <p className="readerNoteDraftHint">
          缺少章节标识，无法保存本地笔记草稿。
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="本章笔记草稿"
      className="readerNoteDraft"
    >
      <h3 className="readerNoteDraftTitle">本章笔记草稿</h3>
      <p className="readerNoteDraftDisclaimer">
        开发预览 · 仅保存在当前浏览器，不会写入数据库，也不会发送给 AI。
      </p>
      <textarea
        className="readerNoteDraftTextarea"
        onChange={handleChange}
        placeholder="记录你对本章的理解、疑问或待复习点……"
        rows={6}
        value={draft}
      />
      <div className="readerNoteDraftFooter">
        <button
          className="readerNoteDraftClearBtn"
          disabled={draft.length === 0}
          onClick={handleClear}
          type="button"
        >
          清空本章草稿
        </button>
        <span aria-live="polite" className="readerNoteDraftStatus">
          {saveStatus === "saved"
            ? "已自动保存到当前浏览器"
            : saveStatus === "unsaved"
              ? "尚未保存"
              : saveStatus === "empty"
                ? "本地草稿为空"
                : null}
        </span>
      </div>
    </section>
  );
}
