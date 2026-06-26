"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildReaderBookmarkStorageKey,
  buildReaderNoteStorageKey,
  buildReaderTimerStorageKey,
  formatReaderDuration,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  getReaderLocalStatusStorageKey,
  getReaderTimerCurrentTotalSeconds,
  isReaderLocalStorageAvailable,
  readReaderLocalBookmark,
  readReaderLocalNote,
  readReaderLocalStatusSummary,
  readReaderLocalTimer,
  subscribeReaderLocalStorageChanges,
  writeReaderLocalStatusSummary,
  type ReaderLocalBookmarkRecord,
  type ReaderLocalNoteRecord,
  type ReaderLocalStatusSummaryV1,
  type ReaderLocalTimerRecord,
} from "./reader-local-storage";

export interface ReaderLocalLearningStatusCardProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

function latestTimestamp(timestamps: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestEpoch = 0;

  for (const value of timestamps) {
    if (!value) {
      continue;
    }

    const epoch = Date.parse(value);
    if (Number.isNaN(epoch)) {
      continue;
    }

    if (epoch > latestEpoch) {
      latestEpoch = epoch;
      latest = value;
    }
  }

  return latest;
}

function toProgressRatio(bookmark: ReaderLocalBookmarkRecord | null): number | null {
  const percent = bookmark?.scrollPercent;
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return null;
  }

  return Math.min(Math.max(percent, 0), 100) / 100;
}

function toProgressText(summary: ReaderLocalStatusSummaryV1): string {
  if (typeof summary.progressPercent === "number" && Number.isFinite(summary.progressPercent)) {
    const bounded = Math.min(Math.max(summary.progressPercent, 0), 100);
    return `${Math.round(bounded)}%`;
  }

  if (typeof summary.progressRatio === "number" && Number.isFinite(summary.progressRatio)) {
    const bounded = Math.min(Math.max(summary.progressRatio, 0), 1);
    return `${Math.round(bounded * 100)}%`;
  }

  return "-";
}

function buildSummaryV1(params: {
  scopeBookId: string;
  scopeChapterId: string;
  bookTitle?: string | null;
  chapterTitle?: string | null;
  bookmark: ReaderLocalBookmarkRecord | null;
  note: ReaderLocalNoteRecord | null;
  timer: ReaderLocalTimerRecord | null;
}): ReaderLocalStatusSummaryV1 {
  const { bookmark, note, timer } = params;
  const noteCount = (note?.content.trim().length ?? 0) > 0 ? 1 : 0;
  const bookmarkCount = bookmark === null ? 0 : 1;
  const progressRatio = toProgressRatio(bookmark);
  const readingSeconds =
    timer === null ? 0 : getReaderTimerCurrentTotalSeconds(timer, Date.now());
  const sourceUpdatedAt = latestTimestamp([
    bookmark?.updatedAt,
    note?.updatedAt,
    timer?.updatedAt,
  ]);

  return {
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    bookId: params.scopeBookId,
    chapterId: params.scopeChapterId,
    bookTitle: params.bookTitle ?? null,
    chapterTitle: params.chapterTitle ?? null,
    progressRatio,
    progressPercent:
      progressRatio === null ? null : Math.round(Math.min(Math.max(progressRatio, 0), 1) * 100),
    noteCount,
    bookmarkCount,
    readingSeconds,
    updatedAt: sourceUpdatedAt ?? new Date().toISOString(),
  };
}

export function ReaderLocalLearningStatusCard({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
}: ReaderLocalLearningStatusCardProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const bookmarkKey = buildReaderBookmarkStorageKey(bookId, chapterId);
  const noteKey = buildReaderNoteStorageKey(bookId, chapterId);
  const timerKey = buildReaderTimerStorageKey(bookId, chapterId);
  const summaryKey = getReaderLocalStatusStorageKey();

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [summary, setSummary] = useState<ReaderLocalStatusSummaryV1 | null>(null);

  const loadAndPersistSummary = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available) {
      setSummary(null);
      return;
    }

    const storedSummary = readReaderLocalStatusSummary();

    if (!scope.hasIdentifiers || !scope.bookId || !scope.chapterId) {
      setSummary(storedSummary);
      return;
    }

    const bookmark = readReaderLocalBookmark(scope.bookId, scope.chapterId);
    const note = readReaderLocalNote(scope.bookId, scope.chapterId);
    const timer = readReaderLocalTimer(scope.bookId, scope.chapterId);
    const nextSummary = buildSummaryV1({
      scopeBookId: scope.bookId,
      scopeChapterId: scope.chapterId,
      bookTitle,
      chapterTitle,
      bookmark,
      note,
      timer,
    });

    if (JSON.stringify(storedSummary) !== JSON.stringify(nextSummary)) {
      const saved = writeReaderLocalStatusSummary(nextSummary);
      if (!saved) {
        setStorageAvailable(false);
        setSummary(storedSummary);
        return;
      }
    }

    setSummary(nextSummary);
  }, [bookTitle, chapterTitle, scope.bookId, scope.chapterId, scope.hasIdentifiers]);

  useEffect(() => {
    loadAndPersistSummary();
  }, [loadAndPersistSummary]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (
        changedKey === null ||
        changedKey === bookmarkKey ||
        changedKey === noteKey ||
        changedKey === timerKey
      ) {
        loadAndPersistSummary();
      }
    });

    return unsubscribe;
  }, [bookmarkKey, loadAndPersistSummary, noteKey, timerKey]);

  const hasSummary = useMemo(() => {
    if (summary === null) {
      return false;
    }

    return summary.schemaVersion === 1 && summary.source === "reader";
  }, [summary]);

  if (!chapterId) {
    return null;
  }

  return (
    <section aria-label="本地学习状态（开发预览）" className="readerReadingStats">
      <h3 className="readerReadingStatsTitle">本地学习状态（开发预览）</h3>
      <p className="readerReadingStatsDisclaimer">
        仅保存到当前浏览器 localStorage；不会同步数据库；不会调用真实 AI；不会执行工具；后续才会接入正式同步。
      </p>
      <p className="readerReadingStatsTimestamp">摘要 key：{summaryKey}</p>

      {!storageAvailable && (
        <p className="readerReadingStatsEmpty">本地状态不可用：当前浏览器无法访问 localStorage。</p>
      )}

      {storageAvailable && !hasSummary && (
        <p className="readerReadingStatsEmpty">暂无本地学习状态摘要。</p>
      )}

      {storageAvailable && hasSummary && summary !== null && (
        <>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">当前书籍</p>
            <p className="readerReadingStatsValue">{summary.bookTitle ?? summary.bookId ?? "-"}</p>
            <p className="readerReadingStatsTimestamp">bookId：{summary.bookId ?? "-"}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">当前章节</p>
            <p className="readerReadingStatsValue">{summary.chapterTitle ?? summary.chapterId ?? "-"}</p>
            <p className="readerReadingStatsTimestamp">chapterId：{summary.chapterId ?? "-"}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">阅读进度</p>
            <p className="readerReadingStatsValue">{toProgressText(summary)}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地笔记数量</p>
            <p className="readerReadingStatsValue">{summary.noteCount ?? 0}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地书签数量</p>
            <p className="readerReadingStatsValue">{summary.bookmarkCount ?? 0}</p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地阅读计时</p>
            <p className="readerReadingStatsValue">
              {formatReaderDuration(summary.readingSeconds ?? 0)}
            </p>
          </div>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">最近更新时间</p>
            <p className="readerReadingStatsTimestamp">
              {formatReaderLocalTimestamp(summary.updatedAt)}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
