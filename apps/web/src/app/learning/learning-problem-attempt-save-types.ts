import type { ProblemDifficulty } from "@learning-agent-platform/learning-engine";

export type LearningProblemAttemptFeedbackResult =
  | "attempted"
  | "solved"
  | "failed";

export type LearningProblemAttemptRecommendationSource =
  | "database_saved"
  | "engine_preview"
  | "mock_fallback"
  | "unavailable";

export type LearningProblemAttemptSaveStatus =
  | "saved"
  | "database_unavailable"
  | "demo_user_missing"
  | "recommendation_unavailable"
  | "problem_unavailable"
  | "validation_error"
  | "save_failed";

export interface LearningProblemAttemptSaveInput {
  problemId?: string;
  externalProblemId?: string;
  problemTitle: string;
  difficulty?: ProblemDifficulty;
  topicTags: readonly string[];
  recommendationSource: LearningProblemAttemptRecommendationSource;
  result: LearningProblemAttemptFeedbackResult;
}

export interface LearningProblemAttemptSaveResult {
  status: LearningProblemAttemptSaveStatus;
  message: string;
  saved: boolean;
  attemptId?: string;
  problemId?: string;
  externalProblemId?: string;
  problemTitle?: string;
  result?: LearningProblemAttemptFeedbackResult;
  correctness?: "unknown" | "correct" | "incorrect";
  source: "daily_recommendation";
  savedAt?: string;
}
