import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

export type LearningRecommendationProblemAttemptStatus =
  | "not_attempted"
  | "attempted"
  | "solved"
  | "failed"
  | "unavailable"
  | "read_failed"
  | "demo_user_missing"
  | "database_unavailable";

export type LearningRecommendationProblemAttemptStatusSource =
  | "problem_attempt_history"
  | "unavailable";

export type LearningRecommendationProblemAttemptMatchedBy =
  | "problemId"
  | "externalProblemId"
  | "problemKey"
  | "none";

export interface LearningRecommendationProblemAttemptStatusView {
  recommendationProblemId: string;
  status: LearningRecommendationProblemAttemptStatus;
  label: string;
  description: string;
  source: LearningRecommendationProblemAttemptStatusSource;
  matchedBy: LearningRecommendationProblemAttemptMatchedBy;
  latestAttemptAt?: string;
  attemptCount?: number;
}

export interface LearningRecommendationProblemAttemptStatusPreview {
  status: LearningProblemAttemptSignalStatus;
  message: string;
  recentAttemptCount: number;
  statuses: readonly LearningRecommendationProblemAttemptStatusView[];
}
