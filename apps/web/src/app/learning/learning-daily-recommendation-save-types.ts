import type { LearningProblemAttemptSignalStatus } from "./problem-attempt-signal-types";

export type LearningDailyRecommendationSaveStatus =
  | "saved"
  | "database_unavailable"
  | "demo_user_missing"
  | "missing_ability_profile"
  | "missing_candidate_problems"
  | "insufficient_data"
  | "recommendation_failed"
  | "save_failed"
  | "unavailable_for_mock_fallback"
  | "validation_error";

export type LearningDailyRecommendationAbilityProfileSource =
  | "database_saved"
  | "engine_preview"
  | "mock_fallback"
  | "unavailable";

export type LearningDailyRecommendationFallbackReason =
  | "database_unavailable"
  | "demo_user_missing"
  | "mock_dashboard_fallback"
  | "no_saved_ability_profile"
  | "invalid_saved_ability_profile"
  | "no_preview_learning_events"
  | "preview_calculation_failed";

export interface LearningDailyRecommendationSaveResult {
  status: LearningDailyRecommendationSaveStatus;
  message: string;
  recommendationId?: string;
  recommendationIds?: readonly string[];
  recommendationCount: number;
  recommendedProblemCount: number;
  savedRecommendationCount: number;
  candidateProblemCount: number;
  abilityProfileSource: LearningDailyRecommendationAbilityProfileSource;
  savedProfileAvailable: boolean;
  abilityProfileId?: string;
  abilityProfileUpdatedAt?: string;
  fallbackUsed: boolean;
  fallbackReason?: LearningDailyRecommendationFallbackReason;
  savedAt?: string;
  usedQaFeedbackSignals: boolean;
  qaFeedbackSignalCount: number;
  problemAttemptHistoryStatus: LearningProblemAttemptSignalStatus;
  recentProblemAttemptCount: number;
  recentProblemAttemptUsedForRecommendation: boolean;
  solvedProblemCount: number;
}
