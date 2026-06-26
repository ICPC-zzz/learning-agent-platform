import type { ProblemAttemptRecord } from "@learning-agent-platform/db";

import type { LearningRecommendedProblemView } from "../../lib/learning-types";
import type {
  LearningRecommendationProblemAttemptMatchedBy,
  LearningRecommendationProblemAttemptStatus,
  LearningRecommendationProblemAttemptStatusPreview,
  LearningRecommendationProblemAttemptStatusView,
} from "./recommendation-problem-attempt-status-types";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";
import {
  formatProblemAttemptStatusLabel,
  mapProblemAttemptRecordStatusToDisplayStatus,
} from "./problem-attempt-status-display";

export function createRecommendationProblemAttemptStatusPreview(input: {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  records: readonly ProblemAttemptRecord[];
}): LearningRecommendationProblemAttemptStatusPreview {
  if (input.records.length === 0) {
    return createRecommendationProblemAttemptStatusPreviewForReadStatus({
      recommendedProblems: input.recommendedProblems,
      status: "attempts_empty",
      message:
        "演示用户没有最近 ProblemAttempt 记录。推荐题目卡片会显示为未尝试预览状态。",
    });
  }

  return {
    status: "attempts_loaded",
    message: `已为演示用户读取 ${input.records.length} 条最近 ProblemAttempt 记录，用于只读匹配推荐卡片状态预览。`,
    recentAttemptCount: input.records.length,
    statuses: input.recommendedProblems.map((problem) =>
      createStatusForRecommendedProblem(problem, input.records),
    ),
  };
}

export function createRecommendationProblemAttemptStatusPreviewForReadStatus({
  recommendedProblems,
  status,
  message,
}: {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  status: LearningProblemAttemptSignalStatus;
  message: string;
}): LearningRecommendationProblemAttemptStatusPreview {
  return {
    status,
    message,
    recentAttemptCount: 0,
    statuses: recommendedProblems.map((problem) =>
      createStatusForReadStatus(problem, status),
    ),
  };
}

function createStatusForRecommendedProblem(
  recommendedProblem: LearningRecommendedProblemView,
  records: readonly ProblemAttemptRecord[],
): LearningRecommendationProblemAttemptStatusView {
  const recommendationProblemId = getRecommendationProblemId(recommendedProblem);

  if (recommendationProblemId === null) {
    return createBaseStatus({
      recommendedProblem,
      status: "unavailable",
      description:
        "尝试状态预览不可用，因为此推荐没有稳定题目标识符。",
      matchedBy: "none",
      source: "unavailable",
    });
  }

  const problemIdMatches = getMatchingRecords(records, {
    key: recommendationProblemId,
    matchedBy: "problemId",
  });

  if (problemIdMatches.length > 0) {
    return createMatchedStatus({
      recommendedProblem,
      records: problemIdMatches,
      matchedBy: "problemId",
    });
  }

  const externalProblemIdMatches = getMatchingRecords(records, {
    key: recommendationProblemId,
    matchedBy: "externalProblemId",
  });

  if (externalProblemIdMatches.length > 0) {
    return createMatchedStatus({
      recommendedProblem,
      records: externalProblemIdMatches,
      matchedBy: "externalProblemId",
    });
  }

  return createBaseStatus({
    recommendedProblem,
    status: "not_attempted",
    description:
      "最近 ProblemAttempt 中没有按 problemId 或 externalProblemId 匹配到此推荐；显示为未尝试预览状态。",
    matchedBy: "none",
    source: "problem_attempt_history",
    attemptCount: 0,
  });
}

function createMatchedStatus({
  recommendedProblem,
  records,
  matchedBy,
}: {
  recommendedProblem: LearningRecommendedProblemView;
  records: readonly ProblemAttemptRecord[];
  matchedBy: Exclude<
    LearningRecommendationProblemAttemptMatchedBy,
    "problemKey" | "none"
  >;
}): LearningRecommendationProblemAttemptStatusView {
  const sortedRecords = [...records].sort(compareProblemAttemptsByNewestFirst);
  const [latestRecord] = sortedRecords;

  if (latestRecord === undefined) {
    return createBaseStatus({
      recommendedProblem,
      status: "not_attempted",
      description: "最近 ProblemAttempt 中没有匹配到此推荐；显示为未尝试预览状态。",
      matchedBy: "none",
      source: "problem_attempt_history",
      attemptCount: 0,
    });
  }

  const status = mapProblemAttemptRecordStatusToDisplayStatus(latestRecord);

  return createBaseStatus({
    recommendedProblem,
    status,
    description: createMatchedDescription(status, matchedBy),
    matchedBy,
    source: "problem_attempt_history",
    latestAttemptAt: toIsoString(latestRecord.attemptedAt),
    attemptCount: sortedRecords.length,
  });
}

function createStatusForReadStatus(
  recommendedProblem: LearningRecommendedProblemView,
  status: LearningProblemAttemptSignalStatus,
): LearningRecommendationProblemAttemptStatusView {
  switch (status) {
    case "attempts_empty":
      return createBaseStatus({
        recommendedProblem,
        status: "not_attempted",
        description:
          "没有可用于匹配的最近 ProblemAttempt 记录；显示为未尝试预览状态。",
        matchedBy: "none",
        source: "problem_attempt_history",
        attemptCount: 0,
      });
    case "database_unavailable":
      return createBaseStatus({
        recommendedProblem,
        status: "database_unavailable",
        description:
          "尝试状态预览不可用，因为 DATABASE_URL 未配置。",
        matchedBy: "none",
        source: "unavailable",
      });
    case "demo_user_missing":
      return createBaseStatus({
        recommendedProblem,
        status: "demo_user_missing",
        description:
          "尝试状态预览不可用，因为未找到演示用户 demo@example.com。",
        matchedBy: "none",
        source: "unavailable",
      });
    case "read_failed":
      return createBaseStatus({
        recommendedProblem,
        status: "read_failed",
        description:
          "无法读取尝试状态预览，但推荐预览仍可渲染。",
        matchedBy: "none",
        source: "unavailable",
      });
    case "unavailable":
      return createBaseStatus({
        recommendedProblem,
        status: "unavailable",
        description:
          "当前推荐数据源的尝试状态预览不可用。",
        matchedBy: "none",
        source: "unavailable",
      });
    case "attempts_loaded":
      return createBaseStatus({
        recommendedProblem,
        status: "not_attempted",
        description:
          "最近 ProblemAttempt 中没有按稳定标识符匹配到此推荐；显示为未尝试预览状态。",
        matchedBy: "none",
        source: "problem_attempt_history",
        attemptCount: 0,
      });
  }
}

function createBaseStatus({
  recommendedProblem,
  status,
  description,
  matchedBy,
  source,
  latestAttemptAt,
  attemptCount,
}: {
  recommendedProblem: LearningRecommendedProblemView;
  status: LearningRecommendationProblemAttemptStatus;
  description: string;
  matchedBy: LearningRecommendationProblemAttemptMatchedBy;
  source: LearningRecommendationProblemAttemptStatusView["source"];
  latestAttemptAt?: string;
  attemptCount?: number;
}): LearningRecommendationProblemAttemptStatusView {
  const view: LearningRecommendationProblemAttemptStatusView = {
    recommendationProblemId:
      getRecommendationProblemId(recommendedProblem) ?? recommendedProblem.id,
    status,
    label: formatProblemAttemptStatusLabel(status),
    description,
    source,
    matchedBy,
  };

  if (latestAttemptAt !== undefined) {
    view.latestAttemptAt = latestAttemptAt;
  }

  if (attemptCount !== undefined) {
    view.attemptCount = attemptCount;
  }

  return view;
}

function getMatchingRecords(
  records: readonly ProblemAttemptRecord[],
  input: {
    key: string;
    matchedBy: Exclude<
      LearningRecommendationProblemAttemptMatchedBy,
      "problemKey" | "none"
    >;
  },
): readonly ProblemAttemptRecord[] {
  return records.filter((record) => {
    if (input.matchedBy === "problemId") {
      return normalizeOptionalText(record.problemId) === input.key;
    }

    return normalizeOptionalText(record.externalProblemId) === input.key;
  });
}

function getRecommendationProblemId(
  recommendedProblem: LearningRecommendedProblemView,
): string | null {
  return (
    normalizeOptionalText(recommendedProblem.problem.id) ??
    normalizeOptionalText(recommendedProblem.id)
  );
}

function createMatchedDescription(
  status: LearningRecommendationProblemAttemptStatus,
  matchedBy: Exclude<
    LearningRecommendationProblemAttemptMatchedBy,
    "problemKey" | "none"
  >,
): string {
  switch (status) {
    case "solved":
      return `最新匹配的演示 ProblemAttempt 记录为已解决，匹配方式：${matchedBy}。`;
    case "failed":
      return `最新匹配的演示 ProblemAttempt 记录为失败，匹配方式：${matchedBy}。`;
    case "attempted":
      return `最新匹配的演示 ProblemAttempt 记录为已尝试，尚无已解决/失败结果，匹配方式：${matchedBy}。`;
    case "not_attempted":
    case "unavailable":
    case "read_failed":
    case "demo_user_missing":
    case "database_unavailable":
      return `尝试状态预览为 ${formatProblemAttemptStatusLabel(status)}。`;
  }
}

function compareProblemAttemptsByNewestFirst(
  first: ProblemAttemptRecord,
  second: ProblemAttemptRecord,
): number {
  const attemptedAtDelta =
    getDateTime(second.attemptedAt) - getDateTime(first.attemptedAt);

  if (attemptedAtDelta !== 0) {
    return attemptedAtDelta;
  }

  const createdAtDelta =
    getDateTime(second.createdAt) - getDateTime(first.createdAt);

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return first.id.localeCompare(second.id);
}

function getDateTime(value: Date): number {
  const timestamp = value.getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toIsoString(value: Date): string | undefined {
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}
