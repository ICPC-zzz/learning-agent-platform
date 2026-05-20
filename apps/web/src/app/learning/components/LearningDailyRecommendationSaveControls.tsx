"use client";

import { useState, useTransition } from "react";

import type {
  LearningDashboardDataSource,
  LearningDashboardFallbackReason,
} from "../../../lib/learning-types";
import { saveCurrentDailyRecommendationAction } from "../actions";
import type {
  LearningDailyRecommendationAbilityProfileSource,
  LearningDailyRecommendationSaveResult,
} from "../learning-daily-recommendation-save-types";
import type { LearningProblemAttemptSignalStatus } from "../problem-attempt-signal-types";

interface LearningDailyRecommendationSaveControlsProps {
  source: LearningDashboardDataSource;
  fallbackReason?: LearningDashboardFallbackReason;
  hasAbilityProfile: boolean;
  initialAbilityProfileSource: LearningDailyRecommendationAbilityProfileSource;
  candidateProblemCount: number;
  qaFeedbackSignalCount: number;
  problemAttemptHistoryStatus: LearningProblemAttemptSignalStatus;
  recentProblemAttemptCount: number;
  solvedProblemCount: number;
}

export function LearningDailyRecommendationSaveControls({
  source,
  fallbackReason,
  hasAbilityProfile,
  initialAbilityProfileSource,
  candidateProblemCount,
  qaFeedbackSignalCount,
  problemAttemptHistoryStatus,
  recentProblemAttemptCount,
  solvedProblemCount,
}: LearningDailyRecommendationSaveControlsProps) {
  const blockingResult = createBlockingResult({
    source,
    fallbackReason,
    hasAbilityProfile,
    initialAbilityProfileSource,
    candidateProblemCount,
    qaFeedbackSignalCount,
    problemAttemptHistoryStatus,
    recentProblemAttemptCount,
    solvedProblemCount,
  });
  const [result, setResult] =
    useState<LearningDailyRecommendationSaveResult | null>(blockingResult);
  const [isPending, startTransition] = useTransition();
  const displayedResult = result ?? blockingResult;
  const isBlocked = blockingResult !== null;
  const displayCandidateProblemCount =
    displayedResult?.candidateProblemCount ?? candidateProblemCount;
  const displayRecommendationCount =
    displayedResult?.recommendationCount ??
    displayedResult?.recommendedProblemCount ??
    0;
  const displaySavedRecommendationCount =
    displayedResult?.savedRecommendationCount ?? 0;
  const displayAbilityProfileSource =
    displayedResult?.abilityProfileSource ?? initialAbilityProfileSource;
  const displaySavedProfileAvailable =
    displayedResult?.savedProfileAvailable ??
    (initialAbilityProfileSource === "database_saved");
  const displayQaFeedbackSignalCount =
    displayedResult?.qaFeedbackSignalCount ?? qaFeedbackSignalCount;
  const displayProblemAttemptHistoryStatus =
    displayedResult?.problemAttemptHistoryStatus ?? problemAttemptHistoryStatus;
  const displayRecentProblemAttemptCount =
    displayedResult?.recentProblemAttemptCount ?? recentProblemAttemptCount;
  const displayProblemAttemptHistoryUsed =
    displayedResult?.recentProblemAttemptUsedForRecommendation ?? false;
  const displaySolvedProblemCount =
    displayedResult?.solvedProblemCount ?? solvedProblemCount;
  const displayFallbackUsed =
    displayedResult?.fallbackUsed ??
    (initialAbilityProfileSource === "engine_preview" ||
      initialAbilityProfileSource === "mock_fallback");

  function handleSave() {
    startTransition(async () => {
      const nextResult = await saveCurrentDailyRecommendationAction();

      setResult(nextResult);
    });
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="daily-recommendation-save-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">显式保存</p>
          <h2 id="daily-recommendation-save-title">
            每日推荐快照
          </h2>
        </div>
        <span className="difficultyBadge">
          {isPending ? "保存中" : formatDailySaveStatus(displayedResult?.status)}
        </span>
      </div>

      <div className="recommendationSourceRow" aria-live="polite">
        <span>{isPending ? "保存中" : formatDailySaveStatus(displayedResult?.status)}</span>
        <p>
          {isPending
            ? "正在根据当前能力画像、候选题目和最近 ProblemAttempt 历史生成今日推荐。"
            : displayedResult?.message ??
              "已准备好生成并保存今日 DailyRecommendation 记录。"}
        </p>
        {displayedResult?.recommendationId !== undefined ? (
          <p>已保存推荐 ID：{displayedResult.recommendationId}</p>
        ) : null}
        {displayedResult?.savedAt !== undefined ? (
          <p>保存时间：{displayedResult.savedAt}</p>
        ) : null}
        {displayedResult?.abilityProfileId !== undefined ? (
          <p>能力画像 ID：{displayedResult.abilityProfileId}</p>
        ) : null}
        {displayedResult?.abilityProfileUpdatedAt !== undefined ? (
          <p>
            能力画像更新时间：{displayedResult.abilityProfileUpdatedAt}
          </p>
        ) : null}
        {displayedResult?.fallbackReason !== undefined ? (
          <p>回退原因：{formatDailyFallbackReason(displayedResult.fallbackReason)}</p>
        ) : null}
      </div>

      <dl className="eventStats">
        <div>
          <dt>已生成</dt>
          <dd>{displayRecommendationCount}</dd>
        </div>
        <div>
          <dt>已保存</dt>
          <dd>{displaySavedRecommendationCount}</dd>
        </div>
        <div>
          <dt>候选题目</dt>
          <dd>{displayCandidateProblemCount}</dd>
        </div>
        <div>
          <dt>画像来源</dt>
          <dd>{formatAbilityProfileSource(displayAbilityProfileSource)}</dd>
        </div>
        <div>
          <dt>已保存画像</dt>
          <dd>{displaySavedProfileAvailable ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>使用回退</dt>
          <dd>{displayFallbackUsed ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>问答信号</dt>
          <dd>{displayQaFeedbackSignalCount}</dd>
        </div>
        <div>
          <dt>尝试历史状态</dt>
          <dd>{displayProblemAttemptHistoryStatus}</dd>
        </div>
        <div>
          <dt>最近尝试</dt>
          <dd>{displayRecentProblemAttemptCount}</dd>
        </div>
        <div>
          <dt>使用尝试历史</dt>
          <dd>{displayProblemAttemptHistoryUsed ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>已解决尝试</dt>
          <dd>{displaySolvedProblemCount}</dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>保存边界</h3>
        <ul>
          <li>通过 server action 保存 DailyRecommendation 记录。</li>
          <li>优先使用最新已保存的 AbilityProfile 和数据库候选题目。</li>
          <li>读取最近 ProblemAttempt 历史，并传入推荐生成过程。</li>
          <li>仅在没有已保存 AbilityProfile 时使用 engine_preview。</li>
          <li>不会保存 AbilityProfile、ProblemAttempt、问答反馈或 ReadingProgress。</li>
        </ul>
      </div>

      {displayedResult?.usedQaFeedbackSignals ? (
        <p className="panelNote">
          本次保存在引擎预览能力画像中使用了问答反馈信号。
        </p>
      ) : null}

      <button
        className="primaryLink"
        type="button"
        onClick={handleSave}
        disabled={isPending || isBlocked}
      >
        {isPending
          ? "正在保存每日推荐..."
          : "生成并保存今日推荐"}
      </button>
    </section>
  );
}

function createBlockingResult({
  source,
  fallbackReason,
  hasAbilityProfile,
  initialAbilityProfileSource,
  candidateProblemCount,
  qaFeedbackSignalCount,
  problemAttemptHistoryStatus,
  recentProblemAttemptCount,
  solvedProblemCount,
}: LearningDailyRecommendationSaveControlsProps): LearningDailyRecommendationSaveResult | null {
  const historyDefaults = {
    problemAttemptHistoryStatus,
    recentProblemAttemptCount,
    solvedProblemCount,
  };

  if (source === "mock_fallback") {
    if (fallbackReason === "missing_database_url") {
      return createResult({
        ...historyDefaults,
        status: "database_unavailable",
        message:
          "每日推荐保存不可用，因为 DATABASE_URL 未配置。",
        candidateProblemCount,
        qaFeedbackSignalCount,
        fallbackReason: "database_unavailable",
      });
    }

    if (fallbackReason === "no_demo_user_found") {
      return createResult({
        ...historyDefaults,
        status: "demo_user_missing",
        message:
          "每日推荐保存不可用，因为未找到演示用户。",
        candidateProblemCount,
        qaFeedbackSignalCount,
        fallbackReason: "demo_user_missing",
      });
    }

    return createResult({
      ...historyDefaults,
      status: "unavailable_for_mock_fallback",
      message:
        "仪表盘正在显示模拟回退数据，每日推荐保存不可用。",
      candidateProblemCount,
      abilityProfileSource: "mock_fallback",
      fallbackUsed: true,
      fallbackReason: "mock_dashboard_fallback",
      qaFeedbackSignalCount,
    });
  }

  if (!hasAbilityProfile) {
    return createResult({
      ...historyDefaults,
      status: "missing_ability_profile",
      message:
        "在存在已保存或预览能力画像前，每日推荐保存不可用。",
      candidateProblemCount,
      abilityProfileSource: initialAbilityProfileSource,
      fallbackReason: "no_preview_learning_events",
      qaFeedbackSignalCount,
    });
  }

  if (candidateProblemCount <= 0) {
    return createResult({
      ...historyDefaults,
      status: "missing_candidate_problems",
      message:
        "在数据库候选题目存在前，每日推荐保存不可用。",
      candidateProblemCount,
      abilityProfileSource: initialAbilityProfileSource,
      savedProfileAvailable: initialAbilityProfileSource === "database_saved",
      fallbackUsed: initialAbilityProfileSource === "engine_preview",
      fallbackReason:
        initialAbilityProfileSource === "engine_preview"
          ? "no_saved_ability_profile"
          : undefined,
      qaFeedbackSignalCount,
    });
  }

  return null;
}

function formatDailySaveStatus(
  status: LearningDailyRecommendationSaveResult["status"] | undefined,
): string {
  if (status === undefined) {
    return "就绪";
  }

  const labels: Record<LearningDailyRecommendationSaveResult["status"], string> = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    insufficient_data: "数据不足",
    missing_ability_profile: "缺少能力画像",
    missing_candidate_problems: "缺少候选题目",
    recommendation_failed: "推荐生成失败",
    save_failed: "保存失败",
    saved: "已保存",
    unavailable_for_mock_fallback: "模拟回退不可保存",
    validation_error: "校验失败",
  };

  return labels[status];
}

function formatDailyFallbackReason(
  reason: LearningDailyRecommendationSaveResult["fallbackReason"],
): string {
  if (reason === undefined) {
    return "无";
  }

  const labels: Record<
    NonNullable<LearningDailyRecommendationSaveResult["fallbackReason"]>,
    string
  > = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    invalid_saved_ability_profile: "已保存能力画像无效",
    mock_dashboard_fallback: "仪表盘模拟回退",
    no_preview_learning_events: "无预览学习事件",
    no_saved_ability_profile: "无已保存能力画像",
    preview_calculation_failed: "预览计算失败",
  };

  return labels[reason];
}

function createResult(
  input: Pick<
    LearningDailyRecommendationSaveResult,
    | "status"
    | "message"
    | "candidateProblemCount"
    | "qaFeedbackSignalCount"
    | "problemAttemptHistoryStatus"
    | "recentProblemAttemptCount"
    | "solvedProblemCount"
  > &
    Partial<
      Pick<
        LearningDailyRecommendationSaveResult,
        | "abilityProfileSource"
        | "savedProfileAvailable"
        | "fallbackUsed"
        | "fallbackReason"
        | "usedQaFeedbackSignals"
        | "recentProblemAttemptUsedForRecommendation"
      >
    >,
): LearningDailyRecommendationSaveResult {
  return {
    ...input,
    recommendationCount: 0,
    recommendedProblemCount: 0,
    savedRecommendationCount: 0,
    abilityProfileSource: input.abilityProfileSource ?? "unavailable",
    savedProfileAvailable: input.savedProfileAvailable ?? false,
    fallbackUsed: input.fallbackUsed ?? false,
    usedQaFeedbackSignals: input.usedQaFeedbackSignals ?? false,
    recentProblemAttemptUsedForRecommendation:
      input.recentProblemAttemptUsedForRecommendation ?? false,
  };
}

function formatAbilityProfileSource(
  source: LearningDailyRecommendationAbilityProfileSource,
): string {
  switch (source) {
    case "database_saved":
      return "数据库已保存";
    case "engine_preview":
      return "引擎预览";
    case "mock_fallback":
      return "模拟回退";
    case "unavailable":
      return "不可用";
  }
}
