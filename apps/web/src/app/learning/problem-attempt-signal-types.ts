import type { ProblemAttemptEvent } from "@learning-agent-platform/learning-engine";

export type LearningProblemAttemptSignalStatus =
  | "attempts_loaded"
  | "attempts_empty"
  | "demo_user_missing"
  | "database_unavailable"
  | "read_failed"
  | "unavailable";

export interface LearningProblemAttemptSignalPreview {
  status: LearningProblemAttemptSignalStatus;
  message: string;
  attemptCount: number;
  recentAttemptCount: number;
  solvedCount: number;
  failedCount: number;
  attemptedOnlyCount: number;
  mappedSignalCount: number;
  latestAttemptAt?: string;
  previewAppliedToAbility: boolean;
  learningEvents: readonly ProblemAttemptEvent[];
}
