"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDefaultReaderTimerRecord,
  buildReaderTimerStorageKey,
  formatReaderDuration,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  getReaderTimerCurrentTotalSeconds,
  isReaderLocalStorageAvailable,
  readReaderLocalTimer,
  removeReaderLocalTimer,
  subscribeReaderLocalStorageChanges,
  type ReaderLocalTimerRecord,
  writeReaderLocalTimer,
} from "./reader-local-storage";

export interface ReaderReadingTimerProps {
  bookId?: string | null;
  chapterId?: string | null;
}

export function ReaderReadingTimer({ bookId, chapterId }: ReaderReadingTimerProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const timerKey = buildReaderTimerStorageKey(bookId, chapterId);

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [record, setRecord] = useState<ReaderLocalTimerRecord | null>(null);
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

  const loadTimer = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available || !scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      setRecord(null);
      return;
    }

    const stored = readReaderLocalTimer(scope.bookId, scope.chapterId);
    if (stored !== null) {
      setRecord(stored);
      return;
    }

    setRecord(buildDefaultReaderTimerRecord(scope.bookId, scope.chapterId));
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    loadTimer();
  }, [loadTimer]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (changedKey === null || changedKey === timerKey) {
        loadTimer();
      }
    });

    return unsubscribe;
  }, [loadTimer, timerKey]);

  const persistRecord = useCallback(
    (next: ReaderLocalTimerRecord) => {
      if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
        return false;
      }

      return writeReaderLocalTimer(scope.bookId, scope.chapterId, next);
    },
    [scope.bookId, scope.chapterId, scope.hasIdentifiers],
  );

  const handleStart = useCallback(() => {
    if (record === null || record.isRunning) {
      return;
    }

    const now = new Date().toISOString();
    const next: ReaderLocalTimerRecord = {
      ...record,
      isRunning: true,
      lastStartedAt: now,
      updatedAt: now,
    };

    if (!persistRecord(next)) {
      setStorageAvailable(false);
      return;
    }

    setRecord(next);
    setNowEpochMs(Date.now());
  }, [persistRecord, record]);

  const handlePause = useCallback(() => {
    if (record === null || !record.isRunning) {
      return;
    }

    const currentTotal = getReaderTimerCurrentTotalSeconds(record, Date.now());
    const now = new Date().toISOString();
    const next: ReaderLocalTimerRecord = {
      ...record,
      totalSeconds: currentTotal,
      isRunning: false,
      lastStartedAt: null,
      updatedAt: now,
    };

    if (!persistRecord(next)) {
      setStorageAvailable(false);
      return;
    }

    setRecord(next);
    setNowEpochMs(Date.now());
  }, [persistRecord, record]);

  const handleReset = useCallback(() => {
    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      return;
    }

    const removed = removeReaderLocalTimer(scope.bookId, scope.chapterId);
    if (!removed) {
      setStorageAvailable(false);
      return;
    }

    const next = buildDefaultReaderTimerRecord(scope.bookId, scope.chapterId);
    setRecord(next);
    setNowEpochMs(Date.now());
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    if (record === null || !record.isRunning) {
      return;
    }

    const timer = setInterval(() => {
      setNowEpochMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [record]);

  useEffect(() => {
    if (record === null || !record.isRunning) {
      return;
    }

    const flushRunningState = () => {
      const current = readReaderLocalTimer(scope.bookId, scope.chapterId) ?? record;
      if (!current.isRunning) {
        return;
      }

      const nextTotal = getReaderTimerCurrentTotalSeconds(current, Date.now());
      const now = new Date().toISOString();
      const next: ReaderLocalTimerRecord = {
        ...current,
        totalSeconds: nextTotal,
        isRunning: false,
        lastStartedAt: null,
        updatedAt: now,
      };

      persistRecord(next);
    };

    window.addEventListener("beforeunload", flushRunningState);
    window.addEventListener("pagehide", flushRunningState);

    return () => {
      window.removeEventListener("beforeunload", flushRunningState);
      window.removeEventListener("pagehide", flushRunningState);
    };
  }, [persistRecord, record, scope.bookId, scope.chapterId]);

  const totalSeconds = useMemo(() => {
    if (record === null) {
      return 0;
    }

    return getReaderTimerCurrentTotalSeconds(record, nowEpochMs);
  }, [record, nowEpochMs]);

  if (!chapterId) {
    return null;
  }

  return (
    <section aria-label="阅读计时" className="readerReadingTimer">
      <span className="readerReadingTimerLabel">阅读计时</span>
      <span className="readerReadingTimerValue">{formatReaderDuration(totalSeconds)}</span>
      <span className="readerReadingTimerNote">开发预览 - 本地浏览器记录。仅保存在当前浏览器，不写入数据库。</span>

      {!storageAvailable && <span className="readerReadingTimerNote">本地记录不可用：当前浏览器无法访问 localStorage。</span>}

      {storageAvailable && !scope.hasIdentifiers && (
        <span className="readerReadingTimerNote">缺少 bookId 或 chapterId，当前章节无法保存计时记录。</span>
      )}

      {storageAvailable && scope.hasIdentifiers && record !== null && (
        <>
          <div className="readerBookmarksActions">
            <button
              className="readerBookmarksBtn readerBookmarksBtnAdd"
              disabled={record.isRunning}
              onClick={handleStart}
              type="button"
            >
              开始计时
            </button>
            <button
              className="readerBookmarksBtn readerBookmarksBtnClearChapter"
              disabled={!record.isRunning}
              onClick={handlePause}
              type="button"
            >
              暂停
            </button>
            <button className="readerBookmarksBtn readerBookmarksBtnClearAll" onClick={handleReset} type="button">
              重置
            </button>
          </div>
          <span className="readerReadingTimerNote">
            状态：{record.isRunning ? "计时中" : "已暂停"}；最近更新：{formatReaderLocalTimestamp(record.updatedAt)}
          </span>
        </>
      )}
    </section>
  );
}
