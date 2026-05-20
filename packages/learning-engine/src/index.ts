export const learningEnginePackage = "learning-engine";

export type {
  AbilityDimension,
  AbilityDimensionBreakdown,
  AbilityDimensionBreakdownMap,
  AbilityDimensionWeights,
  AbilityProfile,
  AbilityScore,
  AbilityScoringConfig,
  AbilityScoringInput,
  AbilityScoringResult,
  ChapterQuestionEvent,
  DifficultyWeights,
  JsonObject,
  JsonValue,
  LearningEvent,
  LearningEventBase,
  ProblemAttemptEvent,
  ProblemDifficulty,
  ReadingEvent,
  UnknownRecord,
} from "./scoring/types.js";
export { DEFAULT_ABILITY_SCORING_CONFIG } from "./scoring/config.js";
export { calculateAbilityProfile } from "./scoring/ability-scorer.js";
export {
  mapChapterQaFeedbackRecordsToLearningEvents,
  mapChapterQaFeedbackToLearningEvent,
  mapChapterQaFeedbackToLearningSignal,
} from "./scoring/chapter-qa-feedback-signal.js";
export type {
  ChapterQaFeedbackDifficultyHint,
  ChapterQaFeedbackLearningEvent,
  ChapterQaFeedbackLearningSignal,
  ChapterQaFeedbackLearningSignalSource,
  ChapterQaFeedbackQualitySignal,
  ChapterQaFeedbackRating,
  ChapterQaFeedbackSignalMetadata,
  ChapterQaFeedbackUnderstandingHint,
  ChapterQaLearningSignalAnswerSource,
  ChapterQaLearningSignalContextChunkRange,
  ChapterQaLearningSignalContextChunkRangeMetadata,
  ChapterQaLearningSignalFallbackReason,
  ChapterQaLearningSignalInput,
  ChapterQaLearningSignalProviderErrorCategory,
} from "./scoring/chapter-qa-feedback-signal-types.js";
export {
  calculateCorrectnessRate,
  calculateDimensionScore,
  calculateEventRecencyWeight,
  calculateOverallScore,
  clampScore,
  getDifficultyWeight,
  normalizeRatio,
  safeDivide,
  weightedAverage,
} from "./scoring/score-utils.js";

export type {
  RecentProblemAttempt,
  RecommendationConfig,
  RecommendationContext,
  RecommendationInput,
  RecommendationProblem,
  RecommendationReason,
  RecommendationResult,
  RecommendationStatus,
  RecommendationWeakDimension,
  RecommendedProblem,
} from "./recommendation/types.js";
export { DEFAULT_RECOMMENDATION_CONFIG } from "./recommendation/config.js";
export {
  compareDifficulty,
  getDifficultyDistance,
  getDifficultyRank,
  getTargetDifficulty,
  isDifficultyWithinRange,
} from "./recommendation/difficulty.js";
export {
  createRecommendationReason,
  createRecommendationReasons,
  filterRecentlyAttemptedProblems,
  getProblemTagMatchScore,
  rankRecommendationProblems,
  scoreProblemForUser,
} from "./recommendation/problem-ranker.js";
export {
  getTargetTagsForWeakDimensions,
  getWeakAbilityDimensions,
  recommendDailyProblems,
  resolveRecommendationConfig,
} from "./recommendation/recommender.js";
