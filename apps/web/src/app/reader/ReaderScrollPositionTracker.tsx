"use client";

import { useCallback, useEffect, useRef } from "react";

export interface ReaderScrollPositionTrackerProps {
  bookId?: string | null;
  chapterId?: string | null;
  enabled?: boolean;
}

const STORAGE_KEY_PREFIX = "learning-agent-platform:reader-scroll";
const THROTTLE_MS = 250;

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

export function ReaderScrollPositionTracker({
  bookId,
  chapterId,
  enabled = true,
}: ReaderScrollPositionTrackerProps) {
  const keyRef = useRef<string>(buildStorageKey(bookId, chapterId));
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // Update key when bookId or chapterId change
  useEffect(() => {
    keyRef.current = buildStorageKey(bookId, chapterId);
    restoredRef.current = false;
  }, [bookId, chapterId]);

  // Restore scroll position on mount / key change
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

  // Throttled scroll listener
  const handleScroll = useCallback(() => {
    if (!enabled) return;

    if (throttleRef.current !== null) {
      clearTimeout(throttleRef.current);
    }

    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      saveScrollY(keyRef.current, window.scrollY);
    }, THROTTLE_MS);
  }, [enabled]);

  // Save on beforeunload
  const handleBeforeUnload = useCallback(() => {
    if (!enabled) return;
    saveScrollY(keyRef.current, window.scrollY);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [enabled, handleScroll, handleBeforeUnload]);

  // This component renders nothing — it only manages scroll position.
  return null;
}
