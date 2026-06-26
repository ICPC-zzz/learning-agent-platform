import {
  calculateAbilityProfile,
  type LearningEvent,
} from "@learning-agent-platform/learning-engine";

import {
  createDimensionScores,
  summarizeLearningEvents,
} from "../../lib/learning-view-model";
import type {
  LearningDashboardPageData,
  LearningDashboardPartialReason,
} from "../../lib/learning-types";
import type { LearningReadingProgressSignalPreview } from "./reading-progress-signal-types";
import {
  withLearningProblemAttemptSignalPreviewAbilityImpact,
} from "./problem-attempt-signal-loader";
import type { LearningProblemAttemptSignalPreview } from "./problem-attempt-signal-types";

export interface LearningProblemAttemptAbilityPreviewResult {
  dashboardData: LearningDashboardPageData;
  problemAttemptSignalPreview: LearningProblemAttemptSignalPreview;
}

export function applyProblemAttemptSignalsToAbilityPreview({
  dashboardData,
  readingProgressSignalPreview,
  problemAttemptSignalPreview,
}: {
  dashboardData: LearningDashboardPageData;
  readingProgressSignalPreview: LearningReadingProgressSignalPreview;
  problemAttemptSignalPreview: LearningProblemAttemptSignalPreview;
}): LearningProblemAttemptAbilityPreviewResult {
  if (
    dashboardData.source !== "database_partial" ||
    dashboardData.abilityProfile === null ||
    !dashboardData.partialReasons.includes("no_stored_ability_profile") ||
    problemAttemptSignalPreview.status !== "attempts_loaded" ||
    problemAttemptSignalPreview.learningEvents.length === 0
  ) {
    return {
      dashboardData,
      problemAttemptSignalPreview:
        withLearningProblemAttemptSignalPreviewAbilityImpact(
          problemAttemptSignalPreview,
          false,
        ),
    };
  }

  const inputEvents: readonly LearningEvent[] = [
    ...getReadingProgressLearningEvents(readingProgressSignalPreview),
    ...getQaFeedbackLearningEvents(dashboardData),
    ...problemAttemptSignalPreview.learningEvents,
  ];

  if (inputEvents.length === 0) {
    return {
      dashboardData,
      problemAttemptSignalPreview:
        withLearningProblemAttemptSignalPreviewAbilityImpact(
          problemAttemptSignalPreview,
          false,
        ),
    };
  }

  try {
    const scoringResult = calculateAbilityProfile({ events: inputEvents });

    if (scoringResult.eventCount === 0) {
      return {
        dashboardData,
        problemAttemptSignalPreview:
          withLearningProblemAttemptSignalPreviewAbilityImpact(
            problemAttemptSignalPreview,
            false,
          ),
      };
    }

    return {
      dashboardData: {
        ...dashboardData,
        source: "database_partial",
        abilityProfile: scoringResult.profile,
        dimensionScores: createDimensionScores(
          scoringResult.profile,
          scoringResult.dimensionBreakdown,
        ),
        scoringWarnings: [
          ...scoringResult.warnings,
          "能力画像是本次渲染根据现有预览事件和 ProblemAttempt 信号重新计算的内存态预览；它没有写入数据库。",
        ],
        recentEventsSummary: summarizeLearningEvents(inputEvents),
        partialReasons: removeNoRecentLearningEventsReason(
          dashboardData.partialReasons,
        ),
      },
      problemAttemptSignalPreview:
        withLearningProblemAttemptSignalPreviewAbilityImpact(
          problemAttemptSignalPreview,
          true,
        ),
    };
  } catch {
    return {
      dashboardData,
      problemAttemptSignalPreview:
        withLearningProblemAttemptSignalPreviewAbilityImpact(
          problemAttemptSignalPreview,
          false,
        ),
    };
  }
}

function getReadingProgressLearningEvents(
  preview: LearningReadingProgressSignalPreview,
): readonly LearningEvent[] {
  return preview.status === "progress_loaded" ? preview.learningEvents : [];
}

function getQaFeedbackLearningEvents(
  dashboardData: LearningDashboardPageData,
): readonly LearningEvent[] {
  const preview = dashboardData.qaFeedbackSignalPreview;

  return preview.status === "loaded" ? preview.learningEvents : [];
}

function removeNoRecentLearningEventsReason(
  reasons: readonly LearningDashboardPartialReason[],
): readonly LearningDashboardPartialReason[] {
  return reasons.filter((reason) => reason !== "no_recent_learning_events");
}
