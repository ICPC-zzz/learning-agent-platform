"use client";

import { useState, useTransition } from "react";

import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
} from "../../../lib/learning-types";
import { saveCurrentLearningAbilityProfileAction } from "../actions";
import type { LearningAbilityProfileSaveResult } from "../learning-ability-profile-save-types";
import type { LearningProblemAttemptSignalStatus } from "../problem-attempt-signal-types";
import type { LearningReadingProgressSignalStatus } from "../reading-progress-signal-types";

interface LearningAbilityProfileSaveControlsProps {
  source: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  inputEventCount: number;
  qaFeedbackSignalCount: number;
  readingProgressSignalCount: number;
  readingProgressStatus: LearningReadingProgressSignalStatus;
  problemAttemptSignalCount: number;
  problemAttemptStatus: LearningProblemAttemptSignalStatus;
}

export function LearningAbilityProfileSaveControls({
  source,
  fallbackReason,
  inputEventCount,
  qaFeedbackSignalCount,
  readingProgressSignalCount,
  readingProgressStatus,
  problemAttemptSignalCount,
  problemAttemptStatus,
}: LearningAbilityProfileSaveControlsProps) {
  const blockingResult = createBlockingResult({
    source,
    fallbackReason,
    inputEventCount,
    qaFeedbackSignalCount,
    readingProgressSignalCount,
    readingProgressStatus,
    problemAttemptSignalCount,
    problemAttemptStatus,
  });
  const [result, setResult] = useState<LearningAbilityProfileSaveResult | null>(
    blockingResult,
  );
  const [isPending, startTransition] = useTransition();
  const displayedResult = result ?? blockingResult;
  const isBlocked = blockingResult !== null;
  const displayInputEventCount =
    displayedResult?.inputEventCount ?? inputEventCount;
  const displayQaFeedbackSignalCount =
    displayedResult?.qaFeedbackSignalCount ?? qaFeedbackSignalCount;
  const displayReadingProgressSignalCount =
    displayedResult?.readingProgressSignalCount ?? readingProgressSignalCount;
  const displayReadingProgressStatus =
    displayedResult?.readingProgressStatus ?? readingProgressStatus;
  const displayReadingProgressApplied =
    displayedResult?.readingProgressAppliedToSavedProfile ?? false;
  const displayProblemAttemptSignalCount =
    displayedResult?.problemAttemptSignalCount ?? problemAttemptSignalCount;
  const displayProblemAttemptStatus =
    displayedResult?.problemAttemptStatus ?? problemAttemptStatus;
  const displayProblemAttemptApplied =
    displayedResult?.problemAttemptAppliedToSavedProfile ?? false;

  function handleSave() {
    startTransition(async () => {
      const nextResult = await saveCurrentLearningAbilityProfileAction();

      setResult(nextResult);
    });
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="ability-profile-save-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发演示保存</p>
          <h2 id="ability-profile-save-title">能力画像演示快照</h2>
        </div>
        <span className="difficultyBadge">
          {isPending ? "保存中" : formatAbilitySaveStatus(displayedResult?.status)}
        </span>
      </div>

      <div className="recommendationSourceRow" aria-live="polite">
        <span>{isPending ? "保存中" : formatAbilitySaveStatus(displayedResult?.status)}</span>
        <p>
          {isPending
            ? "正在根据演示用户的当前学习事件、问答反馈信号、ReadingProgress 信号和 ProblemAttempt 信号重新计算演示能力画像；不会调用真实 AI。"
            : displayedResult?.message ??
              "已准备好手动重新计算并保存当前 AbilityProfile 预览快照。"}
        </p>
        {displayedResult?.profileId !== undefined ? (
          <p>演示快照画像 ID：{displayedResult.profileId}</p>
        ) : null}
        {displayedResult?.savedAt !== undefined ? (
          <p>保存时间：{displayedResult.savedAt}</p>
        ) : null}
      </div>

      <dl className="eventStats">
        <div>
          <dt>输入事件</dt>
          <dd>{displayInputEventCount}</dd>
        </div>
        <div>
          <dt>问答信号</dt>
          <dd>{displayQaFeedbackSignalCount}</dd>
        </div>
        <div>
          <dt>ReadingProgress 信号</dt>
          <dd>{displayReadingProgressSignalCount}</dd>
        </div>
        <div>
          <dt>ReadingProgress 状态</dt>
          <dd>{displayReadingProgressStatus}</dd>
        </div>
        <div>
          <dt>ReadingProgress 已应用</dt>
          <dd>{displayReadingProgressApplied ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>ProblemAttempt 信号</dt>
          <dd>{displayProblemAttemptSignalCount}</dd>
        </div>
        <div>
          <dt>ProblemAttempt 状态</dt>
          <dd>{displayProblemAttemptStatus}</dd>
        </div>
        <div>
          <dt>ProblemAttempt 已应用</dt>
          <dd>{displayProblemAttemptApplied ? "是" : "否"}</dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>保存边界</h3>
        <ul>
          <li>通过 server action 为演示用户保存一条开发环境 AbilityProfile 快照。</li>
          <li>只使用当前可读的演示数据和已映射预览信号，不调用真实 AI 或外部 provider。</li>
          <li>不会保存推荐记录，也不会刷新每日题目列表或启动自动学习闭环。</li>
          <li>不会写入 ProblemAttempt 或 ReadingProgress 记录。</li>
        </ul>
      </div>

      <button
        className="primaryLink"
        type="button"
        onClick={handleSave}
        disabled={isPending || isBlocked}
      >
        {isPending ? "正在保存演示能力画像..." : "手动保存 AbilityProfile 预览快照"}
      </button>
    </section>
  );
}

function createBlockingResult({
  source,
  fallbackReason,
  inputEventCount,
  qaFeedbackSignalCount,
  readingProgressSignalCount,
  readingProgressStatus,
  problemAttemptSignalCount,
  problemAttemptStatus,
}: LearningAbilityProfileSaveControlsProps): LearningAbilityProfileSaveResult | null {
  if (source === "mock_fallback") {
    if (fallbackReason === "missing_database_url") {
      return createResult({
        status: "database_unavailable",
        message:
        "能力画像演示保存不可用，因为 DATABASE_URL 未配置。",
        inputEventCount,
        qaFeedbackSignalCount,
        readingProgressSignalCount,
        readingProgressStatus: "database_unavailable",
        problemAttemptSignalCount,
        problemAttemptStatus: "database_unavailable",
      });
    }

    if (fallbackReason === "no_demo_user_found") {
      return createResult({
        status: "demo_user_missing",
        message:
          "能力画像演示保存不可用，因为未找到演示用户。",
        inputEventCount,
        qaFeedbackSignalCount,
        readingProgressSignalCount,
        readingProgressStatus: "demo_user_missing",
        problemAttemptSignalCount,
        problemAttemptStatus: "demo_user_missing",
      });
    }

    return createResult({
      status: "unavailable_for_mock_fallback",
      message:
        "仪表盘正在显示模拟回退数据，能力画像演示保存不可用。",
      inputEventCount,
      qaFeedbackSignalCount,
      readingProgressSignalCount,
      readingProgressStatus,
      problemAttemptSignalCount,
      problemAttemptStatus,
    });
  }

  if (
    inputEventCount <= 0 &&
    qaFeedbackSignalCount <= 0 &&
    readingProgressSignalCount <= 0 &&
    problemAttemptSignalCount <= 0
  ) {
    return createResult({
      status: "insufficient_data",
      message:
        "在演示数据库学习事件、问答反馈信号、ReadingProgress 信号或 ProblemAttempt 信号存在前，能力画像演示保存不可用。",
      inputEventCount,
      qaFeedbackSignalCount,
      readingProgressSignalCount,
      readingProgressStatus,
      problemAttemptSignalCount,
      problemAttemptStatus,
    });
  }

  return null;
}

function formatAbilitySaveStatus(
  status: LearningAbilityProfileSaveResult["status"] | undefined,
): string {
  if (status === undefined) {
    return "就绪";
  }

  const labels: Record<LearningAbilityProfileSaveResult["status"], string> = {
    calculation_failed: "计算失败",
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    insufficient_data: "数据不足",
    save_failed: "保存失败",
    saved: "演示已保存",
    unavailable_for_mock_fallback: "模拟回退不可保存",
    validation_error: "校验失败",
  };

  return labels[status];
}

function createResult(
  input: Omit<
    LearningAbilityProfileSaveResult,
    | "previewIncludedQaFeedbackSignals"
    | "readingProgressAppliedToSavedProfile"
    | "problemAttemptAppliedToSavedProfile"
  >,
): LearningAbilityProfileSaveResult {
  return {
    ...input,
    previewIncludedQaFeedbackSignals: input.qaFeedbackSignalCount !== undefined
      ? input.qaFeedbackSignalCount > 0
      : false,
    readingProgressAppliedToSavedProfile: false,
    problemAttemptAppliedToSavedProfile: false,
  };
}
