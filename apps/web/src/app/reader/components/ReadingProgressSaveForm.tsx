"use client";

import { useActionState } from "react";

import type {
  ReaderDataSource,
  ReaderFallbackReason,
} from "../../../lib/reader-types";
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
}

const disabledMessageByFallbackReason: Record<ReaderFallbackReason, string> = {
  database_read_failed: "进度保存不可用：数据库读取失败。",
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
}: ReadingProgressSaveFormProps) {
  const canSave = source === "database";
  const progressPercent = Math.round(
    ((currentChapterIndex + 1) / Math.max(totalChapters, 1)) * 100,
  );
  const initialState: SaveReaderProgressActionState = {
    status: "idle",
    message: canSave
      ? "保存只会写入演示用户的 ReadingProgress 记录。"
      : getDisabledMessage(fallbackReason),
  };
  const [state, formAction, isPending] = useActionState(
    saveReaderProgressAction,
    initialState,
  );

  return (
    <section className="progressPanel" aria-labelledby="progress-title">
      <p className="eyebrow">阅读进度</p>
      <h2 id="progress-title">阅读进度</h2>
      <div className="progressTrack" aria-hidden="true">
        <div className="progressFill" style={{ width: `${progressPercent}%` }} />
      </div>
      <p>
        当前章节估算进度：{progressPercent}%，按章节位置计算。
      </p>

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
            {isPending ? "正在保存进度..." : "保存当前章节进度"}
          </button>
        </form>
      ) : (
        <button disabled type="button">
          保存当前章节进度
        </button>
      )}

      <p aria-live="polite" className="askAiLimit">
        {state.message}
      </p>
      {state.status === "success" ? (
        <p className="askAiLimit">最近保存时间：{state.savedAt}。</p>
      ) : null}
    </section>
  );
}

function getDisabledMessage(fallbackReason?: ReaderFallbackReason): string {
  if (fallbackReason === undefined) {
    return "模拟回退模式下进度保存不可用。";
  }

  return disabledMessageByFallbackReason[fallbackReason];
}
