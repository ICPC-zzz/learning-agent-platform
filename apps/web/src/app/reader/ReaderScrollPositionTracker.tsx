"use client";

import { useCallback, useEffect, useRef } from "react";

import { syncScrollProgressAction } from "./actions";

export interface ReaderScrollPositionTrackerProps {
  bookId?: string | null;
  chapterId?: string | null;
  enabled?: boolean;
  dbSyncEnabled?: boolean;
}

const STORAGE_KEY_PREFIX = "learning-agent-platform:reader-scroll";
const LOCAL_THROTTLE_MS = 250;
const DB_DEBOUNCE_MS = 5000;

function buildStorageKey(bookId?: string | null, chapterId?: string | null): string {
  const book = bookId ?? "unknown-book";
  const chapter = chapterId ?? "unknown-chapter";
  return `${STORAGE_KEY_PREFIX}:${book}:${chapter}`;
}

function readSavedScrollY(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const value = parseInt(raw, 10);
    if (Number.isNaN(value) || value < 0) return null;
    return value;
  } catch {
    return null;
  }
}

function saveScrollY(key: string, top: number): void {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.round(top))));
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function computeProgressRatio(): number {
  const scrollHeight = document.body.scrollHeight;
  const clientHeight = window.innerHeight;
  const maxScroll = Math.max(scrollHeight - clientHeight, 1);
  const ratio = window.scrollY / maxScroll;
  return Math.min(Math.max(ratio, 0), 1);
}

export function ReaderScrollPositionTracker({
  bookId,
  chapterId,
  enabled = true,
  dbSyncEnabled = true,
}: ReaderScrollPositionTrackerProps) {
  const keyRef = useRef<string>(buildStorageKey(bookId, chapterId));
  const localThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const bookIdRef = useRef(bookId);
  const chapterIdRef = useRef(chapterId);

  // Keep refs in sync with props
  useEffect(() => {
    bookIdRef.current = bookId;
    chapterIdRef.current = chapterId;
  }, [bookId, chapterId]);

  // Update key when bookId or chapterId change
  useEffect(() => {
    keyRef.current = buildStorageKey(bookId, chapterId);
    restoredRef.current = false;
  }, [bookId, chapterId]);

  // Restore scroll position on mount / key change (localStorage only)
  useEffect(() => {
    if (!enabled || restoredRef.current) return;

    const saved = readSavedScrollY(keyRef.current);
    if (saved !== null && saved > 0) {
      restoredRef.current = true;
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "auto" });
      });
    }
  }, [enabled, bookId, chapterId]);

  // Persist scroll progress to DB (long debounce)
  const persistToDb = useCallback(() => {
    if (!dbSyncEnabled) return;
    const currentBookId = bookIdRef.current;
    const currentChapterId = chapterIdRef.current;
    if (!currentBookId || !currentChapterId) return;

    const progressRatio = computeProgressRatio();

    syncScrollProgressAction(
      currentBookId,
      currentChapterId,
      progressRatio,
    ).catch(() => {
      // DB sync failures are silently ignored — localStorage remains the fallback.
    });
  }, [dbSyncEnabled]);

  // Throttled scroll listener
  const handleScroll = useCallback(() => {
    if (!enabled) return;

    // LocalStorage: 250ms throttle
    if (localThrottleRef.current !== null) {
      clearTimeout(localThrottleRef.current);
    }

    localThrottleRef.current = setTimeout(() => {
      localThrottleRef.current = null;
      saveScrollY(keyRef.current, window.scrollY);
    }, LOCAL_THROTTLE_MS);

    // DB: 5000ms debounce (resets on every scroll)
    if (dbSyncEnabled) {
      if (dbDebounceRef.current !== null) {
        clearTimeout(dbDebounceRef.current);
      }

      dbDebounceRef.current = setTimeout(() => {
        dbDebounceRef.current = null;
        persistToDb();
      }, DB_DEBOUNCE_MS);
    }
  }, [enabled, dbSyncEnabled, persistToDb]);

  // Save on beforeunload (both localStorage and DB)
  const handleBeforeUnload = useCallback(() => {
    if (!enabled) return;
    saveScrollY(keyRef.current, window.scrollY);
    if (dbSyncEnabled) {
      persistToDb();
    }
  }, [enabled, dbSyncEnabled, persistToDb]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (localThrottleRef.current !== null) {
        clearTimeout(localThrottleRef.current);
        localThrottleRef.current = null;
      }
      if (dbDebounceRef.current !== null) {
        clearTimeout(dbDebounceRef.current);
        dbDebounceRef.current = null;
      }
    };
  }, [enabled, handleScroll, handleBeforeUnload]);

  // This component renders nothing — it only manages scroll position.
  return null;
}
