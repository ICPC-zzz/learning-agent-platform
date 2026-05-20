import type { ProblemAttemptRecord } from "@learning-agent-platform/db";

import {
  formatProblemAttemptStatusLabel,
  mapProblemAttemptRecordStatusToDisplayStatus,
} from "./problem-attempt-status-display";
import type {
  LearningRecentProblemAttemptHistoryItem,
  LearningRecentProblemAttemptHistoryPanelViewModel,
  LearningRecentProblemAttemptHistoryStatus,
} from "./problem-attempt-history-types";

export function createRecentProblemAttemptHistoryViewModel({
  records,
  limit,
}: {
  records: readonly ProblemAttemptRecord[];
  limit: number;
}): LearningRecentProblemAttemptHistoryPanelViewModel {
  if (records.length === 0) {
    return createRecentProblemAttemptHistoryStatusViewModel({
      status: "attempts_empty",
      message: "暂无做题记录。",
      limit,
    });
  }

  return {
    status: "attempts_loaded",
    message: `已为演示用户加载 ${records.length} 条最近 ProblemAttempt 记录。`,
    recentAttemptCount: records.length,
    limit,
    items: records.map(mapProblemAttemptRecordToHistoryItem),
  };
}

export function createRecentProblemAttemptHistoryStatusViewModel({
  status,
  message,
  limit,
}: {
  status: LearningRecentProblemAttemptHistoryStatus;
  message: string;
  limit: number;
}): LearningRecentProblemAttemptHistoryPanelViewModel {
  return {
    status,
    message,
    recentAttemptCount: 0,
    limit,
    items: [],
  };
}

function mapProblemAttemptRecordToHistoryItem(
  record: ProblemAttemptRecord,
): LearningRecentProblemAttemptHistoryItem {
  const status = mapProblemAttemptRecordStatusToDisplayStatus(record);
  const problemId = normalizeOptionalText(record.problemId);
  const externalProblemId = normalizeOptionalText(record.externalProblemId);
  const problemKey = externalProblemId ?? problemId ?? undefined;
  const item: LearningRecentProblemAttemptHistoryItem = {
    attemptId: record.id,
    problemLabel: resolveProblemLabel(record),
    status,
    statusLabel: formatProblemAttemptStatusLabel(status),
    attemptedAt:
      toIsoString(record.attemptedAt) ??
      toIsoString(record.createdAt) ??
      "unknown",
    source: normalizeOptionalText(record.source) ?? "unknown",
  };
  const createdAt = toIsoString(record.createdAt);
  const difficulty = formatProblemDifficulty(
    record.difficulty ?? record.problem?.difficulty,
  );
  const rating =
    readNumericMetadata(record.metadata, "rating") ??
    readNumericMetadata(record.problem?.metadata, "rating");

  if (problemKey !== undefined) {
    item.problemKey = problemKey;
  }

  if (problemId !== null) {
    item.problemId = problemId;
  }

  if (externalProblemId !== null) {
    item.externalProblemId = externalProblemId;
  }

  if (createdAt !== undefined) {
    item.createdAt = createdAt;
  }

  if (difficulty !== undefined) {
    item.difficulty = difficulty;
  }

  if (rating !== undefined) {
    item.rating = rating;
  }

  return item;
}

function resolveProblemLabel(record: ProblemAttemptRecord): string {
  return (
    normalizeOptionalText(record.problem?.title) ??
    normalizeOptionalText(record.externalProblemId) ??
    normalizeOptionalText(record.problemId) ??
    "未知题目"
  );
}

function formatProblemDifficulty(
  value: string | null | undefined,
): string | undefined {
  const normalized = normalizeOptionalText(value);

  return normalized === null ? undefined : normalized.toLowerCase();
}

function readNumericMetadata(
  metadata: unknown,
  key: string,
): number | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }

  const value = metadata[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toIsoString(value: Date | null | undefined): string | undefined {
  if (value === undefined || value === null || Number.isNaN(value.getTime())) {
    return undefined;
  }

  return value.toISOString();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
