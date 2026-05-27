"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  manualSyncReaderPreviewToDbAction,
  type ReaderPreviewManualSyncResult,
  type ReaderPreviewSkippedField,
} from "./actions";
import {
  buildReaderBookmarkStorageKey,
  buildReaderNoteStorageKey,
  buildReaderTimerStorageKey,
  formatReaderDuration,
  formatReaderLocalTimestamp,
  getReaderLocalScope,
  getReaderSyncSwitchStorageKey,
  getReaderTimerCurrentTotalSeconds,
  isReaderLocalStorageAvailable,
  readReaderLocalBookmark,
  readReaderLocalNote,
  readReaderLocalTimer,
  readReaderSyncSwitch,
  subscribeReaderLocalStorageChanges,
  type ReaderLocalBookmarkRecord,
  type ReaderLocalNoteRecord,
  type ReaderLocalTimerRecord,
  writeReaderSyncSwitch,
} from "./reader-local-storage";

export interface ReaderSyncPreviewPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
}

type SyncPreviewStatus = "pending" | "loading" | "completed" | "empty";

interface SyncPreviewSummary {
  generatedAt: string;
  bookmarkExists: boolean;
  noteExists: boolean;
  noteCharCount: number;
  totalSeconds: number;
  latestUpdatedAt: string | null;
}

type ManualSyncViewStatus = "idle" | "loading";

function formatManualSyncStatus(status: ReaderPreviewManualSyncResult["status"]): string {
  switch (status) {
    case "synced":
      return "已同步";
    case "partial":
      return "部分同步";
    case "disabled":
      return "未启用";
    case "invalid":
      return "参数无效";
    case "fallback":
      return "同步失败（已回退）";
    case "noop":
      return "无需同步";
    default:
      return status;
  }
}

function formatSkippedField(item: ReaderPreviewSkippedField): string {
  return `${item.field}（${item.reason}）`;
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

export function ReaderSyncPreviewPanel({
  bookId,
  chapterId,
}: ReaderSyncPreviewPanelProps) {
  const scope = getReaderLocalScope(bookId, chapterId);
  const syncSwitchKey = getReaderSyncSwitchStorageKey();
  const bookmarkKey = buildReaderBookmarkStorageKey(bookId, chapterId);
  const noteKey = buildReaderNoteStorageKey(bookId, chapterId);
  const timerKey = buildReaderTimerStorageKey(bookId, chapterId);

  const [storageAvailable, setStorageAvailable] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [bookmark, setBookmark] = useState<ReaderLocalBookmarkRecord | null>(null);
  const [note, setNote] = useState<ReaderLocalNoteRecord | null>(null);
  const [timer, setTimer] = useState<ReaderLocalTimerRecord | null>(null);
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());
  const [previewStatus, setPreviewStatus] = useState<SyncPreviewStatus>("pending");
  const [previewSummary, setPreviewSummary] = useState<SyncPreviewSummary | null>(null);
  const [manualSyncViewStatus, setManualSyncViewStatus] =
    useState<ManualSyncViewStatus>("idle");
  const [manualSyncResult, setManualSyncResult] =
    useState<ReaderPreviewManualSyncResult | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadState = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);

    if (!available) {
      setSyncEnabled(false);
      setBookmark(null);
      setNote(null);
      setTimer(null);
      return;
    }

    setSyncEnabled(readReaderSyncSwitch());

    if (!scope.hasIdentifiers) {
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
    loadState();
  }, [loadState]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (
        changedKey === null ||
        changedKey === syncSwitchKey ||
        changedKey === bookmarkKey ||
        changedKey === noteKey ||
        changedKey === timerKey
      ) {
        loadState();
      }
    });

    return unsubscribe;
  }, [bookmarkKey, loadState, noteKey, syncSwitchKey, timerKey]);

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

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current !== null) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleSync = useCallback(() => {
    const available = isReaderLocalStorageAvailable();
    setStorageAvailable(available);
    if (!available) {
      return;
    }

    const next = !syncEnabled;
    const saved = writeReaderSyncSwitch(next);
    if (!saved) {
      setStorageAvailable(false);
      return;
    }

    setSyncEnabled(next);
  }, [syncEnabled]);

  const clearPreviewTimeout = useCallback(() => {
    if (previewTimeoutRef.current !== null) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (syncEnabled && scope.hasIdentifiers) {
      return;
    }

    clearPreviewTimeout();
    setPreviewStatus("pending");
    setPreviewSummary(null);
    setManualSyncViewStatus("idle");
    setManualSyncResult(null);
  }, [clearPreviewTimeout, scope.bookId, scope.chapterId, scope.hasIdentifiers, syncEnabled]);

  const totalSeconds = useMemo(() => {
    if (timer === null) {
      return 0;
    }

    return getReaderTimerCurrentTotalSeconds(timer, nowEpochMs);
  }, [timer, nowEpochMs]);

  const bookmarkExists = bookmark !== null;
  const noteCharCount = note?.content.trim().length ?? 0;
  const noteExists = noteCharCount > 0;
  const latestUpdatedAt = latestTimestamp([
    bookmark?.updatedAt,
    note?.updatedAt,
    timer?.updatedAt,
  ]);
  const hasAnyLocalRecord =
    bookmarkExists || noteExists || totalSeconds > 0 || latestUpdatedAt !== null;

  const handleGeneratePreview = useCallback(() => {
    if (!storageAvailable || !syncEnabled || !scope.hasIdentifiers) {
      return;
    }

    clearPreviewTimeout();
    setPreviewStatus("loading");

    previewTimeoutRef.current = setTimeout(() => {
      const generatedAt = new Date().toISOString();
      const summary: SyncPreviewSummary = {
        generatedAt,
        bookmarkExists,
        noteExists,
        noteCharCount,
        totalSeconds,
        latestUpdatedAt,
      };

      setPreviewSummary(summary);
      setPreviewStatus(hasAnyLocalRecord ? "completed" : "empty");
      previewTimeoutRef.current = null;
    }, 700);
  }, [
    bookmarkExists,
    clearPreviewTimeout,
    hasAnyLocalRecord,
    latestUpdatedAt,
    noteCharCount,
    noteExists,
    scope.hasIdentifiers,
    storageAvailable,
    syncEnabled,
    totalSeconds,
  ]);

  const handleManualSyncToDb = useCallback(() => {
    if (!storageAvailable || !syncEnabled || !scope.hasIdentifiers || !hasAnyLocalRecord) {
      return;
    }

    setManualSyncViewStatus("loading");
    setManualSyncResult(null);

    manualSyncReaderPreviewToDbAction({
      syncEnabled,
      bookId: scope.bookId,
      chapterId: scope.chapterId,
      bookmark: {
        exists: bookmarkExists,
        scrollPercent: bookmark?.scrollPercent ?? null,
        updatedAt: bookmark?.updatedAt ?? null,
      },
      note: {
        exists: noteExists,
        charCount: noteCharCount,
        updatedAt: note?.updatedAt ?? null,
      },
      timer: {
        totalSeconds,
        updatedAt: timer?.updatedAt ?? null,
      },
      latestLocalUpdatedAt: latestUpdatedAt,
    })
      .then((result) => {
        setManualSyncResult(result);
      })
      .catch(() => {
        setManualSyncResult({
          ok: false,
          status: "fallback",
          message: "同步失败：数据库异常或不可用，本地记录未受影响。",
          syncedFields: [],
          skippedFields: [],
        });
      })
      .finally(() => {
        setManualSyncViewStatus("idle");
      });
  }, [
    bookmark,
    bookmarkExists,
    hasAnyLocalRecord,
    latestUpdatedAt,
    note,
    noteCharCount,
    noteExists,
    scope.bookId,
    scope.chapterId,
    scope.hasIdentifiers,
    storageAvailable,
    syncEnabled,
    timer,
    totalSeconds,
  ]);

  return (
    <section aria-label="同步入口与本地记录状态确认" className="readerReadingStats">
      <h3 className="readerReadingStatsTitle">同步到云端（开发预览）</h3>
      <p className="readerReadingStatsDisclaimer">
        开发预览：同步预演仅做本地 mock 汇总；数据库写入仅允许手动触发，不是生产级云同步。
      </p>

      {!storageAvailable && (
        <p className="readerReadingStatsEmpty">
          本地记录不可用：当前浏览器无法访问 localStorage。
        </p>
      )}

      {storageAvailable && (
        <>
          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">同步开关</p>
            <label className="readerReadingStatsValue">
              <input checked={syncEnabled} onChange={handleToggleSync} type="checkbox" /> 启用同步入口（开发预览）
            </label>
            <p className="readerReadingStatsTimestamp">
              {syncEnabled
                ? "开发预览：已开启同步入口，需手动点击按钮才会尝试写入可支持的数据库字段。"
                : "开发预览：当前仅使用本地浏览器记录。"}
            </p>
          </div>

          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">本地记录状态确认（当前章节）</p>
            {!scope.hasIdentifiers && (
              <p className="readerReadingStatsTimestamp">
                开发预览：缺少 bookId 或 chapterId，当前无法汇总章节本地记录。
              </p>
            )}
            {scope.hasIdentifiers && (
              <>
                <p className="readerReadingStatsValue">本地书签：{bookmarkExists ? "有" : "无"}</p>
                <p className="readerReadingStatsValue">笔记草稿：{noteExists ? "有" : "无"}</p>
                <p className="readerReadingStatsValue">阅读计时：累计 {formatReaderDuration(totalSeconds)}</p>
                <p className="readerReadingStatsTimestamp">
                  最近本地更新时间：
                  {latestUpdatedAt === null ? "暂无记录" : formatReaderLocalTimestamp(latestUpdatedAt)}
                </p>
                <p className="readerReadingStatsTimestamp">
                  开发预览：本地浏览器记录仅当前浏览器可见，不代表云端已同步。
                </p>
              </>
            )}
          </div>

          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">同步预演（开发预览 / mock）</p>
            <div className="readerBookmarksActions">
              <button
                className="readerBookmarksBtn readerBookmarksBtnAdd"
                disabled={!syncEnabled || !scope.hasIdentifiers || previewStatus === "loading"}
                onClick={handleGeneratePreview}
                type="button"
              >
                {previewStatus === "loading" ? "正在生成同步预览..." : "生成同步预演"}
              </button>
            </div>

            {!syncEnabled && (
              <p className="readerReadingStatsTimestamp">
                请先开启同步到云端（开发预览）开关。本功能不会执行真实同步。
              </p>
            )}
            {syncEnabled && !scope.hasIdentifiers && (
              <p className="readerReadingStatsTimestamp">
                开发预览：缺少 bookId 或 chapterId，当前无法生成同步预演。
              </p>
            )}
            {syncEnabled && scope.hasIdentifiers && previewStatus === "pending" && (
              <p className="readerReadingStatsTimestamp">
                状态：待预演。点击按钮后将生成 mock 同步摘要，不会执行真实同步。
              </p>
            )}
            {previewStatus === "loading" && (
              <p className="readerReadingStatsTimestamp">状态：正在生成同步预览...</p>
            )}
            {previewStatus === "completed" && previewSummary && (
              <>
                <p className="readerReadingStatsTimestamp">
                  状态：预演完成（未执行真实同步），生成时间：
                  {formatReaderLocalTimestamp(previewSummary.generatedAt)}
                </p>
                <p className="readerReadingStatsValue">本次预演将同步的数据：</p>
                <p className="readerReadingStatsValue">
                  本地书签：
                  {previewSummary.bookmarkExists ? "将纳入同步预演" : "无本地书签"}
                </p>
                <p className="readerReadingStatsValue">
                  笔记草稿：
                  {previewSummary.noteExists
                    ? `将纳入同步预演（约 ${previewSummary.noteCharCount} 字）`
                    : "无本地笔记草稿"}
                </p>
                <p className="readerReadingStatsValue">
                  阅读计时：
                  {previewSummary.totalSeconds > 0
                    ? formatReaderDuration(previewSummary.totalSeconds)
                    : "暂无本地计时"}
                </p>
                <p className="readerReadingStatsTimestamp">
                  最近本地更新时间：
                  {previewSummary.latestUpdatedAt
                    ? formatReaderLocalTimestamp(previewSummary.latestUpdatedAt)
                    : "暂无记录"}
                </p>
                <p className="readerReadingStatsTimestamp">
                  本次仅生成同步预演，未发送网络请求，未写入数据库。
                </p>
              </>
            )}
            {previewStatus === "empty" && (
              <>
                <p className="readerReadingStatsTimestamp">状态：无本地记录可同步。</p>
                <p className="readerReadingStatsTimestamp">
                  本次仅生成同步预演，未发送网络请求，未写入数据库。
                </p>
              </>
            )}
          </div>

          <div className="readerReadingStatsGroup">
            <p className="readerReadingStatsLabel">手动同步到数据库（开发预览）</p>
            <p className="readerReadingStatsTimestamp">
              当前不是生产级云同步；需要手动触发。失败不会影响本地浏览器记录。
            </p>
            <div className="readerBookmarksActions">
              <button
                className="readerBookmarksBtn readerBookmarksBtnAdd"
                disabled={
                  !storageAvailable ||
                  !syncEnabled ||
                  !scope.hasIdentifiers ||
                  !hasAnyLocalRecord ||
                  manualSyncViewStatus === "loading"
                }
                onClick={handleManualSyncToDb}
                type="button"
              >
                {manualSyncViewStatus === "loading"
                  ? "正在手动同步到数据库..."
                  : "手动同步到数据库（开发预览）"}
              </button>
            </div>

            {!syncEnabled && (
              <p className="readerReadingStatsTimestamp">
                请先开启同步到云端（开发预览）开关，再手动触发同步。
              </p>
            )}
            {syncEnabled && scope.hasIdentifiers && !hasAnyLocalRecord && (
              <p className="readerReadingStatsTimestamp">无本地记录可同步。</p>
            )}
            {manualSyncViewStatus === "loading" && (
              <p className="readerReadingStatsTimestamp">状态：正在执行手动同步...</p>
            )}
            {manualSyncResult !== null && (
              <>
                <p className="readerReadingStatsTimestamp">
                  状态：{formatManualSyncStatus(manualSyncResult.status)}。{manualSyncResult.message}
                </p>
                {manualSyncResult.syncedFields.length > 0 && (
                  <p className="readerReadingStatsTimestamp">
                    已同步字段：{manualSyncResult.syncedFields.join("、")}
                  </p>
                )}
                {manualSyncResult.skippedFields.length > 0 && (
                  <>
                    <p className="readerReadingStatsTimestamp">暂未同步字段：</p>
                    {manualSyncResult.skippedFields.map((item) => (
                      <p
                        className="readerReadingStatsTimestamp"
                        key={`${item.field}-${item.reason}`}
                      >
                        - {formatSkippedField(item)}
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
