"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ReaderScrollProgressIndicatorProps {
  /** Optional label override for the progress display. */
  label?: string;
}

/**
 * Calculates the current page scroll position as a percentage (0–100)
 * based on window.scrollY relative to the total scrollable height.
 *
 * This component reads browser scroll information only — it DOES NOT
 * write to localStorage, sessionStorage, IndexedDB, cookies, or any database.
 * The percentage represents the current browser page scroll position,
 * NOT a server-synced or database-tracked reading progress.
 */
export function ReaderScrollProgressIndicator({
  label = "当前本地阅读位置",
}: ReaderScrollProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const calculateProgress = useCallback(() => {
    const doc = document.documentElement;
    const scrollTop = window.scrollY;
    const maxScroll = doc.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
      return 100;
    }

    const raw = Math.round((scrollTop / maxScroll) * 100);
    return Math.min(100, Math.max(0, raw));
  }, []);

  const updateProgress = useCallback(() => {
    pendingRef.current = false;
    setProgress(calculateProgress());
  }, [calculateProgress]);

  const scheduleUpdate = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    rafRef.current = requestAnimationFrame(updateProgress);
  }, [updateProgress]);

  useEffect(() => {
    // Calculate initial value
    setProgress(calculateProgress());

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [calculateProgress, scheduleUpdate]);

  return (
    <section
      aria-label="当前章节本地滚动阅读进度"
      className="readerScrollProgress"
    >
      <span className="readerScrollProgressLabel">{label}：</span>
      <span className="readerScrollProgressValue">{progress}%</span>
      <progress
        aria-label={`页面滚动进度 ${progress}%`}
        className="readerScrollProgressBar"
        max={100}
        value={progress}
      />
      <span className="readerScrollProgressNote">
        基于当前页面滚动位置计算，不写入数据库，不代表完整学习进度。
      </span>
    </section>
  );
}
