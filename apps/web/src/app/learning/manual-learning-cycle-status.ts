import type { LearningDashboardPageData } from "../../lib/learning-types";
import type { LearningProblemAttemptSignalPreview } from "./problem-attempt-signal-types";
import type { LearningReadingProgressSignalPreview } from "./reading-progress-signal-types";

export type ManualLearningCycleStatus =
  | "ready"
  | "partial"
  | "unavailable"
  | "demo_user_missing"
  | "database_unavailable"
  | "read_failed";

export type ManualLearningCycleRecommendedNextAction =
  | "mark_problem_attempt"
  | "recompute_ability_profile"
  | "regenerate_daily_recommendation"
  | "continue_learning"
  | "unavailable";

export interface ManualLearningCycleStatusViewModel {
  status: ManualLearningCycleStatus;
  hasSavedAbilityProfile: boolean;
  hasSavedDailyRecommendation: boolean;
  hasRecentProblemAttempts: boolean;
  problemAttemptSignalCount: number;
  readingProgressSignalCount: number;
  qaFeedbackSignalCount: number;
  latestProblemAttemptAt?: string;
  abilityProfileUpdatedAt?: string;
  dailyRecommendationUpdatedAt?: string;
  recommendedNextAction: ManualLearningCycleRecommendedNextAction;
  recommendedNextActionReason: string;
}

export function createManualLearningCycleStatusViewModel({
  dashboardData,
  problemAttemptSignalPreview,
  readingProgressSignalPreview,
  dailyRecommendationUpdatedAt,
}: {
  dashboardData: LearningDashboardPageData;
  problemAttemptSignalPreview: LearningProblemAttemptSignalPreview;
  readingProgressSignalPreview: LearningReadingProgressSignalPreview;
  dailyRecommendationUpdatedAt?: string;
}): ManualLearningCycleStatusViewModel {
  const status = resolveCycleStatus({
    dashboardData,
    problemAttemptSignalPreview,
    readingProgressSignalPreview,
  });
  const hasSavedAbilityProfile = resolveHasSavedAbilityProfile(dashboardData);
  const hasSavedDailyRecommendation =
    dashboardData.recommendationSource === "database_saved";
  const hasRecentProblemAttempts =
    problemAttemptSignalPreview.status === "attempts_loaded" &&
    problemAttemptSignalPreview.recentAttemptCount > 0;
  const abilityProfileUpdatedAt =
    hasSavedAbilityProfile && dashboardData.abilityProfile !== null
      ? dashboardData.abilityProfile.updatedAt
      : undefined;
  const latestProblemAttemptAt = problemAttemptSignalPreview.latestAttemptAt;
  const nextAction = recommendNextAction({
    status,
    hasSavedAbilityProfile,
    hasSavedDailyRecommendation,
    hasRecentProblemAttempts,
    latestProblemAttemptAt,
    abilityProfileUpdatedAt,
    dailyRecommendationUpdatedAt,
  });

  return {
    status,
    hasSavedAbilityProfile,
    hasSavedDailyRecommendation,
    hasRecentProblemAttempts,
    problemAttemptSignalCount: problemAttemptSignalPreview.mappedSignalCount,
    readingProgressSignalCount: readingProgressSignalPreview.mappedSignalCount,
    qaFeedbackSignalCount: dashboardData.qaFeedbackSignalPreview.validSignalCount,
    latestProblemAttemptAt,
    abilityProfileUpdatedAt,
    dailyRecommendationUpdatedAt,
    recommendedNextAction: nextAction.action,
    recommendedNextActionReason: nextAction.reason,
  };
}

function resolveCycleStatus({
  dashboardData,
  problemAttemptSignalPreview,
  readingProgressSignalPreview,
}: {
  dashboardData: LearningDashboardPageData;
  problemAttemptSignalPreview: LearningProblemAttemptSignalPreview;
  readingProgressSignalPreview: LearningReadingProgressSignalPreview;
}): ManualLearningCycleStatus {
  if (dashboardData.source === "mock_fallback") {
    switch (dashboardData.fallbackReason) {
      case "missing_database_url":
        return "database_unavailable";
      case "no_demo_user_found":
        return "demo_user_missing";
      case "database_read_failed":
        return "read_failed";
      case "no_ability_profile_found":
      case "no_daily_recommendations_found":
        return "unavailable";
    }
  }

  if (
    problemAttemptSignalPreview.status === "database_unavailable" ||
    readingProgressSignalPreview.status === "database_unavailable" ||
    dashboardData.qaFeedbackSignalPreview.status === "database_unavailable"
  ) {
    return "database_unavailable";
  }

  if (
    problemAttemptSignalPreview.status === "demo_user_missing" ||
    readingProgressSignalPreview.status === "demo_user_missing" ||
    dashboardData.qaFeedbackSignalPreview.status === "demo_user_missing"
  ) {
    return "demo_user_missing";
  }

  if (
    problemAttemptSignalPreview.status === "read_failed" ||
    readingProgressSignalPreview.status === "read_failed" ||
    dashboardData.qaFeedbackSignalPreview.status === "read_failed"
  ) {
    return "read_failed";
  }

  if (
    problemAttemptSignalPreview.status === "unavailable" ||
    readingProgressSignalPreview.status === "unavailable"
  ) {
    return "unavailable";
  }

  return dashboardData.source === "database_partial" ? "partial" : "ready";
}

function resolveHasSavedAbilityProfile(
  dashboardData: LearningDashboardPageData,
): boolean {
  if (
    dashboardData.source === "mock_fallback" ||
    dashboardData.abilityProfile === null
  ) {
    return false;
  }

  return !(
    dashboardData.source === "database_partial" &&
    dashboardData.partialReasons.includes("no_stored_ability_profile")
  );
}

function recommendNextAction({
  status,
  hasSavedAbilityProfile,
  hasSavedDailyRecommendation,
  hasRecentProblemAttempts,
  latestProblemAttemptAt,
  abilityProfileUpdatedAt,
  dailyRecommendationUpdatedAt,
}: {
  status: ManualLearningCycleStatus;
  hasSavedAbilityProfile: boolean;
  hasSavedDailyRecommendation: boolean;
  hasRecentProblemAttempts: boolean;
  latestProblemAttemptAt?: string;
  abilityProfileUpdatedAt?: string;
  dailyRecommendationUpdatedAt?: string;
}): {
  action: ManualLearningCycleRecommendedNextAction;
  reason: string;
} {
  if (isUnavailableStatus(status)) {
    return {
      action: "unavailable",
      reason:
        "手动学习循环预览不可用，因为必需的演示用户数据库读取不可用。",
    };
  }

  if (!hasRecentProblemAttempts) {
    return {
      action: "mark_problem_attempt",
      reason:
        "未找到最近 ProblemAttempt 预览记录，因此下一步适合手动演示标记一个推荐题目。",
    };
  }

  if (!hasSavedAbilityProfile) {
    return {
      action: "recompute_ability_profile",
      reason:
        "已存在最近尝试预览，但还没有已保存的演示 AbilityProfile 快照。",
    };
  }

  if (isTimestampAfter(latestProblemAttemptAt, abilityProfileUpdatedAt)) {
    return {
      action: "recompute_ability_profile",
      reason:
        "最新 ProblemAttempt 预览记录看起来晚于已保存的演示 AbilityProfile 快照。",
    };
  }

  if (!hasSavedDailyRecommendation) {
    return {
      action: "regenerate_daily_recommendation",
      reason:
        "已有已保存演示 AbilityProfile，但当前未显示已保存 DailyRecommendation 快照。",
    };
  }

  if (
    isTimestampAfter(abilityProfileUpdatedAt, dailyRecommendationUpdatedAt) ||
    isTimestampAfter(latestProblemAttemptAt, dailyRecommendationUpdatedAt)
  ) {
    return {
      action: "regenerate_daily_recommendation",
      reason:
        "已保存 DailyRecommendation 快照看起来早于最新保存的演示 AbilityProfile 或 ProblemAttempt 预览记录。",
    };
  }

  return {
    action: "continue_learning",
    reason:
      "根据当前可用的只读预览状态数据，已保存演示学习快照看起来可继续使用。",
  };
}

function isUnavailableStatus(status: ManualLearningCycleStatus): boolean {
  switch (status) {
    case "database_unavailable":
    case "demo_user_missing":
    case "read_failed":
    case "unavailable":
      return true;
    case "partial":
    case "ready":
      return false;
  }
}

function isTimestampAfter(
  candidateTimestamp: string | undefined,
  referenceTimestamp: string | undefined,
): boolean {
  if (candidateTimestamp === undefined || referenceTimestamp === undefined) {
    return false;
  }

  const candidateTime = Date.parse(candidateTimestamp);
  const referenceTime = Date.parse(referenceTimestamp);

  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(referenceTime) &&
    candidateTime > referenceTime
  );
}
