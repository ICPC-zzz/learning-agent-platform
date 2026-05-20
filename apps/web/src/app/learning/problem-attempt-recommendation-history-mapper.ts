import type { ProblemAttemptRecord } from "@learning-agent-platform/db";
import type { RecentProblemAttempt } from "@learning-agent-platform/learning-engine";

import { summarizeProblemAttemptRecords } from "./problem-attempt-signal-mapper";

export interface ProblemAttemptRecommendationHistoryMapping {
  recentAttempts: readonly RecentProblemAttempt[];
  recentProblemAttemptCount: number;
  recentProblemAttemptUsedForRecommendation: boolean;
  solvedProblemCount: number;
}

export function mapProblemAttemptRecordsToRecommendationHistory(
  records: readonly ProblemAttemptRecord[],
): ProblemAttemptRecommendationHistoryMapping {
  const summary = summarizeProblemAttemptRecords(records);
  const recentAttempts = records
    .map((record) => mapProblemAttemptRecordToRecentProblemAttempt(record))
    .filter(
      (attempt): attempt is RecentProblemAttempt => attempt !== null,
    );

  return {
    recentAttempts,
    recentProblemAttemptCount: summary.recentAttemptCount,
    recentProblemAttemptUsedForRecommendation: recentAttempts.length > 0,
    solvedProblemCount: summary.solvedCount,
  };
}

export function mapProblemAttemptRecordToRecentProblemAttempt(
  record: ProblemAttemptRecord,
): RecentProblemAttempt | null {
  const problemId = record.problemId ?? record.externalProblemId;

  if (problemId === null || problemId.trim().length === 0) {
    return null;
  }

  const recentAttempt: RecentProblemAttempt = {
    problemId,
  };
  const isCorrect = resolveRecentAttemptCorrectness(record);

  if (isValidDate(record.attemptedAt)) {
    recentAttempt.attemptedAt = record.attemptedAt;
  }

  if (isCorrect !== undefined) {
    recentAttempt.isCorrect = isCorrect;
  }

  return recentAttempt;
}

function resolveRecentAttemptCorrectness(
  record: ProblemAttemptRecord,
): boolean | undefined {
  switch (record.correctness) {
    case "CORRECT":
      return true;
    case "INCORRECT":
    case "PARTIAL":
      return false;
    case "UNKNOWN":
      break;
  }

  switch (record.status) {
    case "SOLVED":
      return true;
    case "FAILED":
      return false;
    case "ATTEMPTED":
    case "SKIPPED":
      return undefined;
  }
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
