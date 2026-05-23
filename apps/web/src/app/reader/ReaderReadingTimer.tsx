"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ReaderReadingTimerProps {
  bookId?: string | null;
  chapterId?: string | null;
}

/**
 * Format elapsed seconds into a display string.
 * - Under 1 hour: mm:ss
 * - 1 hour or more: hh:mm:ss
 */
function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

export function ReaderReadingTimer({
  bookId,
  chapterId,
}: ReaderReadingTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and restart timer when bookId or chapterId changes
  const resetTimer = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset elapsed time
    setElapsedSeconds(0);

    // Start a new interval
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedSeconds(elapsed);
    }, 1000);
  }, []);

  useEffect(() => {
    resetTimer();

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [resetTimer, bookId, chapterId]);

  // Don't render if no chapter is loaded (empty state)
  if (!chapterId) {
    return null;
  }

  return (
    <section
      aria-label="本地阅读时长统计"
      className="readerReadingTimer"
    >
      <span className="readerReadingTimerLabel">本次本地停留</span>
      <span className="readerReadingTimerValue">
        {formatElapsed(elapsedSeconds)}
      </span>
      <span className="readerReadingTimerNote">
        仅在当前页面内统计。阅读进度（滚动位置、已读标记）已支持数据库同步开发预览。
      </span>
    </section>
  );
}
