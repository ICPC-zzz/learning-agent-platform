import type {
  AbilityProfile,
  ProblemDifficulty,
  RecommendationReason,
  RecommendedProblem,
  RecommendationWeakDimension,
} from "@learning-agent-platform/learning-engine";
import type { LearningQaFeedbackSignalPreview } from "./learning-qa-feedback-signal-types";

export type LearningDashboardDataSource =
  | "database"
  | "database_partial"
  | "mock_fallback";

export type LearningRecommendationDisplaySource =
  | "database_saved"
  | "engine_preview"
  | "mock_fallback"
  | "unavailable";

export type LearningDashboardFallbackReason =
  | "missing_database_url"
  | "no_demo_user_found"
  | "no_ability_profile_found"
  | "no_daily_recommendations_found"
  | "database_read_failed";

export type LearningDashboardPartialReason =
  | "no_stored_ability_profile"
  | "ability_profile_calculated_from_reading_progress"
  | "ability_profile_calculated_from_qa_feedback_signals"
  | "no_recent_learning_events"
  | "no_saved_daily_recommendations"
  | "no_candidate_problems"
  | "recommendations_unavailable";

export interface LearningAbilityProfileView {
  overallScore: number;
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
  readingScore: number;
  confidence: number;
  updatedAt: string;
  metadata?: AbilityProfile["metadata"];
}

export interface LearningDashboardDimensionScoreView {
  dimension: "overall" | RecommendationWeakDimension;
  label: string;
  score: number;
  confidence: number;
  eventCount: number;
  reasons: readonly string[];
}

export interface LearningDashboardProblemView {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  tags: readonly string[];
  source?: string;
  estimatedMinutes?: number;
}

export interface LearningRecommendedProblemView extends RecommendedProblem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  tags: readonly string[];
  score: number;
  reasons: readonly RecommendationReason[];
}

export interface LearningEventSummaryView {
  problemAttemptCount: number;
  readingProgressCount: number;
  chapterQuestionCount: number;
  totalEventCount: number;
  totalEvents: number;
  problemAttempts: number;
  readingProgress: number;
  chapterQuestions: number;
  latestEventAt?: string;
}

export type RecentEventsSummary = LearningEventSummaryView;

interface LearningDashboardPageDataBase {
  abilityProfile: LearningAbilityProfileView | null;
  dimensionScores: readonly LearningDashboardDimensionScoreView[];
  scoringWarnings: readonly string[];
  recommendedProblems: readonly LearningRecommendedProblemView[];
  recommendationSource: LearningRecommendationDisplaySource;
  recommendationSourceDetail: string;
  recommendationWarnings: readonly string[];
  candidateProblems: readonly LearningDashboardProblemView[];
  targetDifficulty?: ProblemDifficulty;
  weakDimensions: readonly RecommendationWeakDimension[];
  recentEventsSummary: LearningEventSummaryView;
  qaFeedbackSignalPreview: LearningQaFeedbackSignalPreview;
  emptyStateMessages: readonly string[];
}

export type LearningDashboardPageData =
  | (LearningDashboardPageDataBase & {
      source: "database";
      fallbackReason?: never;
      partialReasons?: readonly [];
    })
  | (LearningDashboardPageDataBase & {
      source: "database_partial";
      fallbackReason?: never;
      partialReasons: readonly LearningDashboardPartialReason[];
    })
  | (LearningDashboardPageDataBase & {
      source: "mock_fallback";
      fallbackReason: LearningDashboardFallbackReason;
      partialReasons?: never;
    });

export type LearningDashboardData = LearningDashboardPageData;
