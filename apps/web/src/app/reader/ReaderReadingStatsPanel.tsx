"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildReaderBookmarkStorageKey,
  buildReaderNoteStorageKey,
  buildReaderTimerStorageKey,
  formatReaderDuration,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  getReaderTimerCurrentTotalSeconds,
  isReaderLocalStorageAvailable,
  readReaderLocalBookmark,
  readReaderLocalNote,
  readReaderLocalTimer,
  subscribeReaderLocalStorageChanges,
  type ReaderLocalBookmarkRecord,
  type ReaderLocalNoteRecord,
  type ReaderLocalTimerRecord,
} from "./reader-local-storage";

export interface ReaderReadingStatsPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

function latestTimestamp(timestamps: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestMs = 0;

  for (const value of timestamps) {
    if (!value) {
      continue;
    }

    const epoch = Date.parse(value);
    if (Number.isNaN(epoch)) {
      continue;
    }

    if (epoch > latestMs) {
      latestMs = epoch;
      latest = value;
    }
  }

  return latest;
}

export function ReaderReadingStatsPanel({
  bookId,
  chapterId,
}: ReaderReadingStatsPanelProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const bookmarkKey = buildReaderBookmarkStorageKey(bookId, chapterId);
  const noteKey = buildReaderNoteStorageKey(bookId, chapterId);
  const timerKey = buildReaderTimerStorageKey(bookId, chapterId);

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [bookmark, setBookmark] = useState<ReaderLocalBookmarkRecord | null>(null);
  const [note, setNote] = useState<ReaderLocalNoteRecord | null>(null);
  const [timer, setTimer] = useState<ReaderLocalTimerRecord | null>(null);
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

  const loadAll = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available || !scope.hasIdentifiers) {
      setBookmark(null);
      setNote(null);
      setTimer(null);
      return;
    }

    setBookmark(readReaderLocalBookmark(scope.bookId, scope.chapterId));
    setNote(readReaderLocalNote(scope.bookId, scope.chapterId));
    setTimer(readReaderLocalTimer(scope.bookId, scope.chapterId));
  }, [scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (
        changedKey === null ||
        changedKey === bookmarkKey ||
        changedKey === noteKey ||
        changedKey === timerKey
      ) {
        loadAll();
      }
    });

    return unsubscribe;
  }, [bookmarkKey, loadAll, noteKey, timerKey]);

  useEffect(() => {
    if (timer === null || !timer.isRunning) {
      return;
    }

    const ticker = setInterval(() => {
      setNowEpochMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(ticker);
    };
  }, [timer]);

  const totalSeconds = useMemo(() => {
    if (timer === null) {
      return 0;
    }

    return getReaderTimerCurrentTotalSeconds(timer, nowEpochMs);
  }, [timer, nowEpochMs]);

  const noteExists = (note?.content.trim().length ?? 0) > 0;
  const bookmarkExists = bookmark !== null;
  const hasAnyLocalRecord = bookmarkExists || noteExists || totalSeconds > 0 || timer !== null;

  const latestUpdatedAt = latestTimestamp([
    bookmark?.updatedAt,
    note?.updatedAt,
    timer?.updatedAt,
  ]);

  if (!chapterId) {
    return null;
  }

  return (
    <section aria-label="阅读统计" className="readerReadingStats">
      <h3 className="readerReadingStatsTitle">阅读统计</h3>
      <p className="readerReadingStatsDisclaimer">
        开发预览 - 本地浏览器记录（仅保存在当前浏览器，不代表数据库同步）。
      </p>

      {!storageAvailable && (
        <p className="readerReadingStatsEmpty">本地记录不可用：当前浏览器无法访问 localStorage。</p>
      )}

      {storageAvailable && !scope.hasIdentifiers && (
        <p className="readerReadingStatsEmpty">缺少 bookId 或 chapterId，当前章节无法显示本地统计。</p>
      )}

      {storageAvailable && scope.hasIdentifiers && !hasAnyLocalRecord && (
        <p className="readerReadingStatsEmpty">
          当前章节还没有本地统计数据。你可以先保存书签、保存草稿或开始阅读计时。
        </p>
      )}

      {storageAvailable && scope.hasIdentifiers && hasAnyLocalRecord && (
        <>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地累计阅读时长</p>
            <p className="readerReadingStatsValue">{formatReaderDuration(totalSeconds)}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地书签</p>
            <p className="readerReadingStatsValue">{bookmarkExists ? "已记录" : "未记录"}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地笔记草稿</p>
            <p className="readerReadingStatsValue">{noteExists ? "已保存" : "未保存"}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">最近本地更新时间</p>
            <p className="readerReadingStatsTimestamp">{formatReaderLocalTimestamp(latestUpdatedAt)}</p>
          </div>
        </>
      )}
    </section>
  );
}
