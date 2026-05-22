"use client";

import { useState } from "react";

import { saveReaderQaFeedbackAction } from "../reader-qa-feedback-actions";
import type {
  ReaderQaFeedbackRating,
  ReaderQaFeedbackSaveResult,
} from "../reader-qa-feedback-types";

interface ReaderQaFeedbackControlsProps {
  historyRecordId: string;
}

const feedbackOptions: readonly {
  rating: ReaderQaFeedbackRating;
  label: string;
}[] = [
  { rating: "helpful", label: "有帮助" },
  { rating: "unhelpful", label: "无帮助" },
  { rating: "neutral", label: "中性" },
];

export function ReaderQaFeedbackControls({
  historyRecordId,
}: ReaderQaFeedbackControlsProps) {
  const [result, setResult] = useState<ReaderQaFeedbackSaveResult | null>(null);
  const [savedRating, setSavedRating] =
    useState<ReaderQaFeedbackRating | null>(null);
  const [pendingRating, setPendingRating] =
    useState<ReaderQaFeedbackRating | null>(null);
  const isSaving = pendingRating !== null;

  async function handleSave(rating: ReaderQaFeedbackRating) {
    if (isSaving) {
      return;
    }

    setPendingRating(rating);

    try {
      const saveResult = await saveReaderQaFeedbackAction({
        historyRecordId,
        rating,
      });

      setResult(saveResult);

      if (saveResult.status === "saved") {
        setSavedRating(saveResult.rating);
      }
    } catch {
      setResult({
        status: "save_failed",
        message:
          "问答反馈未保存：预览保存接口未返回结构化结果。",
        historyRecordId,
        rating,
      });
    } finally {
      setPendingRating(null);
    }
  }

  return (
    <div aria-label="问答反馈控件">
      <div aria-label="反馈评分选项" className="askAiForm">
        {feedbackOptions.map((option) => {
          const isSelected = savedRating === option.rating;
          const isPendingOption = pendingRating === option.rating;

          return (
            <button
              aria-pressed={isSelected}
              disabled={isSaving}
              key={option.rating}
              onClick={() => {
                void handleSave(option.rating);
              }}
              type="button"
            >
              {isPendingOption ? "保存中..." : option.label}
            </button>
          );
        })}
      </div>
      <ReaderQaFeedbackStatus
        result={result}
        savedRating={savedRating}
      />
    </div>
  );
}

function ReaderQaFeedbackStatus({
  result,
  savedRating,
}: {
  result: ReaderQaFeedbackSaveResult | null;
  savedRating: ReaderQaFeedbackRating | null;
}) {
  if (result === null) {
    return (
      <p aria-live="polite" className="askAiLimit">
        反馈保存状态：空闲
      </p>
    );
  }

  return (
    <dl
      aria-label="问答反馈保存状态"
      aria-live="polite"
      className="aiProviderNotice"
    >
      <div>
        <dt>反馈保存状态</dt>
        <dd>{formatFeedbackSaveStatus(result.status)}</dd>
      </div>
      <div>
        <dt>反馈保存消息</dt>
        <dd>{result.message}</dd>
      </div>
      <div>
        <dt>反馈评分</dt>
        <dd>{formatFeedbackRating(savedRating ?? result.rating)}</dd>
      </div>
      {result.status === "saved" ? (
        <div>
          <dt>反馈保存时间</dt>
          <dd>{result.savedAt}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function formatFeedbackSaveStatus(
  status: ReaderQaFeedbackSaveResult["status"],
): string {
  const labels: Record<ReaderQaFeedbackSaveResult["status"], string> = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    invalid_history_record: "历史记录无效",
    save_failed: "保存失败",
    saved: "已保存",
    validation_error: "校验失败",
  };

  return labels[status];
}

function formatFeedbackRating(rating: ReaderQaFeedbackRating | undefined): string {
  if (rating === undefined) {
    return "无";
  }

  const labels: Record<ReaderQaFeedbackRating, string> = {
    helpful: "有帮助",
    neutral: "中性",
    unhelpful: "无帮助",
  };

  return labels[rating];
}
