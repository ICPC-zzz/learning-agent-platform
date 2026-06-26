// Barrel for cf-analysis module
export {
  analyzeCodeforcesLearningProfile,
  analyzeActivity,
  analyzeRatingTrend,
  selectWeakTags,
  computeRatingPlan,
  computeEffectiveRating,
  detectRatingGap,
  buildProfileSummary,
  buildDataQuality,
} from "./cf-learning-analysis.ts";
export type {
  CfLearningAgentReport,
  ActivityAnalysis,
  RatingTrend,
  WeakTagResult,
  RatingPlan,
  RatingGapInfo,
} from "./cf-learning-analysis.ts";
export {
  generateTrainingPlan,
  assertNoSolvedProblems,
} from "./cf-training-plan.ts";
export type {
  RecommendationType,
  TrainingCandidate,
  RecommendationEntry,
  TrainingPlanInput,
} from "./cf-training-plan.ts";

// ---- A489 v3: Unified rating estimation ----
export {
  estimateUserRating,
  buildRatingInput,
  computePracticeSignal,
  computeConfidence,
  computeWeights,
  weightedPercentile,
} from "./cf-rating-estimator.ts";
export type {
  RatingEstimate,
  UserRatingInput,
  CfProblemStat as RatingEstimatorProblemStat,
} from "./cf-rating-estimator.ts";

// ---- Wrong book review (zone-based plan) ----
export {
  computeRatingZones,
  computeWeakTags,
  generateReviewPlan,
  buildReviewReport,
} from "./cf-wrongbook-review.ts";
export type {
  PriorityLevel,
  ReviewRecommendationType,
  ReviewRecommendation,
  ReviewReport,
  ReviewZone,
  GenerateReviewPlanInput,
  BuildReportInput,
} from "./cf-wrongbook-review.ts";
