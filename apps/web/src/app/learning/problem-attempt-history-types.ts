import type { LearningProblemAttemptDisplayStatus } from "./problem-attempt-status-display";
import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

export type LearningRecentProblemAttemptHistoryStatus =
  LearningProblemAttemptSignalStatus;

export interface LearningRecentProblemAttemptHistoryItem {
  attemptId: string;
  problemLabel: string;
  problemKey?: string;
  problemId?: string;
  externalProblemId?: string;
  status: LearningProblemAttemptDisplayStatus;
  statusLabel: string;
  attemptedAt: string;
  createdAt?: string;
  source: string;
  difficulty?: string;
  rating?: number;
}

export interface LearningRecentProblemAttemptHistoryPanelViewModel {
  status: LearningRecentProblemAttemptHistoryStatus;
  message: string;
  recentAttemptCount: number;
  limit: number;
  items: readonly LearningRecentProblemAttemptHistoryItem[];
}
