"use client";

import { useActionState } from "react";

import type {
  ReaderDataSource,
  ReaderFallbackReason,
} from "../../../lib/reader-types";
import type { ReaderProgressView } from "../../../lib/reader-progress";
import {
  saveReaderProgressAction,
  type SaveReaderProgressActionState,
} from "../actions";

interface ReadingProgressSaveFormProps {
  source: ReaderDataSource;
  fallbackReason?: ReaderFallbackReason;
  bookId: string;
  chapterId: string;
  lastChunkId?: string | null;
  currentChapterIndex: number;
  totalChapters: number;
  progressRatio: number;
  savedProgress: ReaderProgressView;
}

const disabledMessageByFallbackReason: Record<ReaderFallbackReason, string> = {
  database_read_failed: "进度保存不可用：数据库读取失败。",
  demo_fallback_requested:
    "进度保存不可用：当前是只读演示 fallback 数据。",
  missing_database_url:
    "进度保存不可用：DATABASE_URL 未配置。",
  no_database_book_found:
    "进度保存不可用：未找到可读的数据库书籍。",
};

export function ReadingProgressSaveForm({
  source,
  fallbackReason,
  bookId,
  chapterId,
  lastChunkId,
  currentChapterIndex,
  totalChapters,
  progressRatio,
  savedProgress,
}: ReadingProgressSaveFormProps) {
  const canSave = source === "database";
  const chapterPositionPercent = Math.round(
    ((currentChapterIndex + 1) / Math.max(totalChapters, 1)) * 100,
  );
  const initialState: SaveReaderProgressActionState = {
    status: "idle",
    message: canSave ? savedProgress.message : getDisabledMessage(fallbackReason),
  };
  const [state, formAction, isPending] = useActionState(
    saveReaderProgressAction,
    initialState,
  );
  const displayProgressPercent =
    state.status === "success"
      ? Math.round(state.progressRatio * 100)
      : savedProgress.progressPercent;
  const displayStatusLabel =
    state.status === "success" ? "已完成" : savedProgress.statusLabel;
  const displaySavedAt =
    state.status === "success" ? state.savedAt : savedProgress.lastReadAt;

  return (
    <section className="progressPanel" aria-labelledby="progress-title">
      <p className="eyebrow">演示进度</p>
      <h2 id="progress-title">阅读进度预览</h2>
      <div className="progressTrack" aria-hidden="true">
        <div
          className="progressFill"
          style={{ width: `${displayProgressPercent}%` }}
        />
      </div>
      <dl className="scoreMeta" style={{ marginTop: "12px" }}>
        <div>
          <dt>章节状态</dt>
          <dd>{displayStatusLabel}</dd>
        </div>
        <div>
          <dt>已保存进度</dt>
          <dd>{displayProgressPercent}%</dd>
        </div>
        <div>
          <dt>章节位置</dt>
          <dd>
            第 {currentChapterIndex + 1} 章 / 共 {totalChapters} 章（约{" "}
            {chapterPositionPercent}%）
          </dd>
        </div>
        <div>
          <dt>用户边界</dt>
          <dd>{savedProgress.userLabel}</dd>
        </div>
        <div>
          <dt>数据边界</dt>
          <dd>
            {savedProgress.isFallback
              ? "演示 fallback，只读"
              : savedProgress.isDemoUser
                ? "演示用户进度，不是正式登录系统"
                : "未启用正式用户系统"}
          </dd>
        </div>
        {displaySavedAt === undefined ? null : (
          <div>
            <dt>最近保存</dt>
            <dd>{displaySavedAt}</dd>
          </div>
        )}
      </dl>

      {canSave ? (
        <form action={formAction}>
          <input name="source" type="hidden" value={source} />
          <input name="bookId" type="hidden" value={bookId} />
          <input name="chapterId" type="hidden" value={chapterId} />
          <input name="lastChunkId" type="hidden" value={lastChunkId ?? ""} />
          <input
            name="progressRatio"
            type="hidden"
            value={String(progressRatio)}
          />
          <button disabled={isPending} type="submit">
            {isPending ? "正在保存演示进度..." : "标记本章已读（演示）"}
          </button>
        </form>
      ) : (
        <button disabled type="button">
          演示进度保存未启用
        </button>
      )}

      <p aria-live="polite" className="askAiLimit">
        {state.message}
      </p>
    </section>
  );
}

function getDisabledMessage(fallbackReason?: ReaderFallbackReason): string {
  if (fallbackReason === undefined) {
    return "只读演示模式下进度保存不可用。";
  }

  return disabledMessageByFallbackReason[fallbackReason];
}
