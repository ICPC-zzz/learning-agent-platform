import {
  calculateAbilityProfile,
  recommendDailyProblems,
} from "@learning-agent-platform/learning-engine";

import type {
  LearningDashboardFallbackReason,
  LearningDashboardPageData,
} from "./learning-types";
import { createLearningQaFeedbackSignalPreviewForFallbackReason } from "./learning-qa-feedback-signal-loader";
import {
  createDimensionScores,
  summarizeLearningEvents,
  toLearningDashboardProblemView,
  toLearningRecommendedProblemView,
} from "./learning-view-model";
import {
  mockCandidateProblems,
  mockLearningEvents,
  mockRecentAttempts,
  mockTargetDate,
} from "./mock-learning-data";

export function getLearningDashboardDataFromMock(
  reason: LearningDashboardFallbackReason = "missing_database_url",
): LearningDashboardPageData {
  const scoringResult = calculateAbilityProfile({
    events: mockLearningEvents,
  });
  const recommendationResult = recommendDailyProblems({
    abilityProfile: scoringResult.profile,
    candidateProblems: mockCandidateProblems,
    recentAttempts: mockRecentAttempts,
    targetDate: mockTargetDate,
    config: {
      dailyProblemCount: 4,
      weakDimensionTagMap: {
        algorithm: ["algorithm", "data-structures", "recursion", "tree"],
        debugging: ["debugging", "bug", "testing", "async"],
        system_design: ["system-design", "architecture", "api-design", "security"],
        reading: ["fundamentals", "reading", "concept", "data-modeling"],
      },
    },
  });

  return {
    source: "mock_fallback",
    fallbackReason: reason,
    abilityProfile: scoringResult.profile,
    dimensionScores: createDimensionScores(
      scoringResult.profile,
      scoringResult.dimensionBreakdown,
    ),
    scoringWarnings: scoringResult.warnings,
    recommendedProblems: recommendationResult.recommendedProblems.map(
      toLearningRecommendedProblemView,
    ),
    recommendationSource: "mock_fallback",
    recommendationSourceDetail:
      "推荐预览由确定性的模拟事件和模拟候选题目生成，不使用真实账户数据。",
    recommendationWarnings: recommendationResult.warnings,
    candidateProblems: mockCandidateProblems.map(toLearningDashboardProblemView),
    targetDifficulty: recommendationResult.targetDifficulty,
    weakDimensions: recommendationResult.weakDimensions,
    recentEventsSummary: summarizeLearningEvents(mockLearningEvents),
    qaFeedbackSignalPreview:
      createLearningQaFeedbackSignalPreviewForFallbackReason(reason),
    emptyStateMessages: [],
  };
}
