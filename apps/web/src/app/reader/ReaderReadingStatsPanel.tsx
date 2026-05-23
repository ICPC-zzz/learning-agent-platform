"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────

export interface ReaderReadingStatsRecord {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  totalSeconds: number;
  lastReadAt: string;
  updatedAt: string;
}

export interface ReaderReadingStatsPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────

const STORAGE_KEY = "learning-agent-platform:reader-reading-stats.v1";
/** Save to localStorage at most every N ms */
const SAVE_INTERVAL_MS = 5_000;
/** Tick the in-memory accumulator every N ms */
const TICK_INTERVAL_MS = 1_000;
const MAX_DISPLAY_RECORDS = 5;

// ── Time formatting ─────────────────────────────────────────────────────

/** Format seconds into a Chinese-friendly display string. */
function formatReadingTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) {
    return `${s} 秒`;
  }
  const minutes = Math.floor(s / 60);
  const remainderSeconds = s % 60;
  if (s < 3600) {
    if (remainderSeconds === 0) return `${minutes} 分`;
    return `${minutes} 分 ${remainderSeconds} 秒`;
  }
  const hours = Math.floor(s / 3600);
  const remainderMinutes = Math.floor((s % 3600) / 60);
  if (remainderMinutes === 0) return `${hours} 小时`;
  return `${hours} 小时 ${remainderMinutes} 分`;
}

/** Format an ISO 8601 timestamp into a local display string. */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return "—";
  }
}

// ── localStorage helpers ────────────────────────────────────────────────

function readAllStats(): Record<string, ReaderReadingStatsRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, ReaderReadingStatsRecord> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidStatsRecord(val)) {
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function isValidStatsRecord(item: unknown): item is ReaderReadingStatsRecord {
  if (item === null || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    typeof record.totalSeconds === "number" &&
    Number.isFinite(record.totalSeconds) &&
    record.totalSeconds >= 0 &&
    typeof record.lastReadAt === "string" &&
    record.lastReadAt.length > 0 &&
    typeof record.updatedAt === "string" &&
    record.updatedAt.length > 0
  );
}

function writeAllStats(stats: Record<string, ReaderReadingStatsRecord>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function clearAllStats(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore.
  }
}

function makeRecordKey(bookId: string, chapterId: string): string {
  return `${bookId}::${chapterId}`;
}

// ── Component ───────────────────────────────────────────────────────────

export function ReaderReadingStatsPanel({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
}: ReaderReadingStatsPanelProps) {
  const [allStats, setAllStats] = useState<Record<string, ReaderReadingStatsRecord>>({});
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Refs to hold mutable state without re-render pressure
  const allStatsRef = useRef<Record<string, ReaderReadingStatsRecord>>({});
  const sessionSecondsRef = useRef(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  const confirmRef = useRef(false);

  // Per-render bookTitle/chapterTitle snapshots so the record has the titles
  // that were visible when the user started reading the chapter.
  const bookTitleSnapshotRef = useRef<string>(bookTitle ?? "未知书籍");
  const chapterTitleSnapshotRef = useRef<string>(chapterTitle ?? "未知章节");
  useEffect(() => {
    if (bookTitle) bookTitleSnapshotRef.current = bookTitle;
    if (chapterTitle) chapterTitleSnapshotRef.current = chapterTitle;
  }, [bookTitle, chapterTitle]);

  // ── Mount: load from localStorage ─────────────────────────────────────
  useEffect(() => {
    const stored = readAllStats();
    allStatsRef.current = stored;
    setAllStats(stored);
  }, []);

  // ── Visibility tracking ───────────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Tick timer (every second, only when page is visible and we have ids) ──
  useEffect(() => {
    if (!bookId || !chapterId) return;

    const start = () => {
      if (tickTimerRef.current !== null) return; // already running
      tickTimerRef.current = setInterval(() => {
        if (!isVisibleRef.current) return;
        sessionSecondsRef.current += 1;
        setSessionSeconds(sessionSecondsRef.current);
      }, TICK_INTERVAL_MS);
    };

    const stop = () => {
      if (tickTimerRef.current !== null) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };

    // Reset session counter on chapter change
    sessionSecondsRef.current = 0;
    setSessionSeconds(0);

    start();
    return () => stop();
  }, [bookId, chapterId]);

  // ── Periodic save to localStorage ─────────────────────────────────────
  const persistCurrentChapter = useCallback(() => {
    const bId = bookId;
    const cId = chapterId;
    if (!bId || !cId) return;

    const key = makeRecordKey(bId, cId);
    const now = new Date().toISOString();
    const sessionSec = sessionSecondsRef.current;

    if (sessionSec <= 0) return; // nothing to save

    const stats = { ...allStatsRef.current };

    const existing = stats[key];
    const prevTotal = existing?.totalSeconds ?? 0;
    const newTotal = prevTotal + sessionSec;

    stats[key] = {
      bookId: bId,
      chapterId: cId,
      bookTitle: bookTitleSnapshotRef.current,
      chapterTitle: chapterTitleSnapshotRef.current,
      totalSeconds: newTotal,
      lastReadAt: now,
      updatedAt: now,
    };

    allStatsRef.current = stats;
    writeAllStats(stats);
    setAllStats(stats);

    // Reset session counter after saving
    sessionSecondsRef.current = 0;
    setSessionSeconds(0);
  }, [bookId, chapterId]);

  useEffect(() => {
    if (!bookId || !chapterId) return;

    saveTimerRef.current = setInterval(() => {
      persistCurrentChapter();
    }, SAVE_INTERVAL_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Also flush on unmount (or key change)
      persistCurrentChapter();
    };
  }, [bookId, chapterId, persistCurrentChapter]);

  // ── Derived data ──────────────────────────────────────────────────────

  const currentKey =
    bookId && chapterId ? makeRecordKey(bookId, chapterId) : null;
  const currentRecord = currentKey ? allStats[currentKey] : undefined;
  const currentTotal = (currentRecord?.totalSeconds ?? 0) + sessionSecondsRef.current;

  /** Sum of all stats for the current book only */
  const bookTotalSeconds = currentKey
    ? Object.values(allStats)
        .filter((r) => r.bookId === bookId)
        .reduce((sum, r) => sum + r.totalSeconds, 0) + sessionSecondsRef.current
    : 0;

  // Sort records by updatedAt desc, take up to MAX_DISPLAY_RECORDS
  const sortedRecords = Object.values(allStats)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DISPLAY_RECORDS);

  // Determine last updated time from all stats
  const lastUpdatedRecord = Object.values(allStats).sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  )[0];

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleClearCurrentChapter = useCallback(() => {
    if (!bookId || !chapterId) return;
    const key = makeRecordKey(bookId, chapterId);
    const stats = { ...allStatsRef.current };
    delete stats[key];
    allStatsRef.current = stats;
    sessionSecondsRef.current = 0;
    setSessionSeconds(0);
    writeAllStats(stats);
    setAllStats(stats);
  }, [bookId, chapterId]);

  const handleClearAll = useCallback(() => {
    if (!confirmRef.current) {
      confirmRef.current = true;
      // Force re-render so the button text changes
      setAllStats({ ...allStatsRef.current });
      return;
    }
    confirmRef.current = false;
    allStatsRef.current = {};
    sessionSecondsRef.current = 0;
    setSessionSeconds(0);
    clearAllStats();
    setAllStats({});
  }, []);

  // Reset confirm state when stats or chapter change
  useEffect(() => {
    confirmRef.current = false;
  }, [bookId, chapterId]);

  // ── Empty state: don't render if no book/chapter context and no stats ──
  if (!bookId && !chapterId && Object.keys(allStats).length === 0) {
    return null;
  }

  const hasAnyStats = Object.keys(allStats).length > 0;

  return (
    <section aria-label="阅读时长统计" className="readerReadingStats">
      <h3 className="readerReadingStatsTitle">阅读时长统计</h3>
      <p className="readerReadingStatsDisclaimer">
        开发预览 · 仅保存在当前浏览器，不写入数据库。
      </p>

      {!hasAnyStats ? (
        <p className="readerReadingStatsEmpty">
          暂无阅读时长统计。开始阅读后会自动记录在当前浏览器。
        </p>
      ) : (
        <>
          {/* Current chapter */}
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">当前章节累计</p>
            <p className="readerReadingStatsValue">
              {formatReadingTime(currentTotal)}
            </p>
          </div>

          {/* Current book */}
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本书本地累计</p>
            <p className="readerReadingStatsValue">
              {formatReadingTime(bookTotalSeconds)}
            </p>
          </div>

          {/* Last update */}
          {lastUpdatedRecord && (
            <div className="readerReadingStatsGroup">
              <p className="readerReadingStatsLabel">最近更新</p>
              <p className="readerReadingStatsTimestamp">
                {formatTimestamp(lastUpdatedRecord.updatedAt)}
              </p>
            </div>
          )}

          {/* Recent records list */}
          {sortedRecords.length > 0 && (
            <div className="readerReadingStatsGroup">
              <p className="readerReadingStatsLabel">最近阅读章节</p>
              <ol className="readerReadingStatsList">
                {sortedRecords.map((record, index) => {
                  const isCurrent =
                    currentKey !== null &&
                    makeRecordKey(record.bookId, record.chapterId) === currentKey;
                  return (
                    <li
                      key={`${record.bookId}:${record.chapterId}:${index}`}
                      className={`readerReadingStatsItem${isCurrent ? " readerReadingStatsItemCurrent" : ""}`}
                    >
                      <span className="readerReadingStatsItemTitle">
                        {record.chapterTitle || `章节 ${record.chapterId}`}
                      </span>
                      <span className="readerReadingStatsItemTime">
                        {formatReadingTime(record.totalSeconds)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      {hasAnyStats && (
        <div className="readerReadingStatsActions">
          <button
            className="readerReadingStatsBtn readerReadingStatsBtnClear"
            onClick={handleClearCurrentChapter}
            type="button"
          >
            清空当前章节统计
          </button>
          <button
            className={`readerReadingStatsBtn readerReadingStatsBtnClearAll${confirmRef.current ? " readerReadingStatsBtnDanger" : ""}`}
            onClick={handleClearAll}
            type="button"
          >
            {confirmRef.current ? "确认清空全部本地统计？" : "清空全部本地统计"}
          </button>
        </div>
      )}
    </section>
  );
}
