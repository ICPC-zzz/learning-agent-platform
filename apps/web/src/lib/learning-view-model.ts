import type {
  AbilityDimensionBreakdownMap,
  AbilityProfile,
  LearningEvent,
  RecommendationProblem,
  RecommendationWeakDimension,
  RecommendedProblem,
} from "@learning-agent-platform/learning-engine";

import type {
  LearningDashboardDimensionScoreView,
  LearningDashboardProblemView,
  LearningEventSummaryView,
  LearningRecommendedProblemView,
} from "./learning-types";

interface DimensionDescriptor {
  dimension: "overall" | RecommendationWeakDimension;
  label: string;
  getScore(profile: AbilityProfile): number;
}

const dimensionDescriptors: readonly DimensionDescriptor[] = [
  {
    dimension: "overall",
    label: "总体",
    getScore: (profile) => profile.overallScore,
  },
  {
    dimension: "algorithm",
    label: "算法",
    getScore: (profile) => profile.algorithmScore,
  },
  {
    dimension: "debugging",
    label: "调试",
    getScore: (profile) => profile.debuggingScore,
  },
  {
    dimension: "system_design",
    label: "系统设计",
    getScore: (profile) => profile.systemDesignScore,
  },
  {
    dimension: "reading",
    label: "阅读",
    getScore: (profile) => profile.readingScore,
  },
];

export function toIsoString(value: Date | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function summarizeLearningEvents(
  events: readonly LearningEvent[],
): LearningEventSummaryView {
  let problemAttemptCount = 0;
  let readingProgressCount = 0;
  let chapterQuestionCount = 0;
  let latestEventAt: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case "problem_attempt":
        problemAttemptCount += 1;
        break;
      case "reading_progress":
        readingProgressCount += 1;
        break;
      case "chapter_question":
        chapterQuestionCount += 1;
        break;
    }

    const eventOccurredAt = toIsoString(event.occurredAt);
    if (
      eventOccurredAt !== undefined &&
      (latestEventAt === undefined || eventOccurredAt > latestEventAt)
    ) {
      latestEventAt = eventOccurredAt;
    }
  }

  return {
    problemAttemptCount,
    readingProgressCount,
    chapterQuestionCount,
    totalEventCount: events.length,
    problemAttempts: problemAttemptCount,
    readingProgress: readingProgressCount,
    chapterQuestions: chapterQuestionCount,
    totalEvents: events.length,
    latestEventAt,
  };
}

export function createDimensionScores(
  profile: AbilityProfile,
  breakdown?: AbilityDimensionBreakdownMap,
): readonly LearningDashboardDimensionScoreView[] {
  return dimensionDescriptors.map((descriptor) => {
    const breakdownItem = breakdown?.[descriptor.dimension];

    return {
      dimension: descriptor.dimension,
      label: descriptor.label,
      score: normalizeScore(breakdownItem?.score ?? descriptor.getScore(profile)),
      confidence: normalizeConfidence(
        breakdownItem?.confidence ?? profile.confidence,
      ),
      eventCount: breakdownItem?.eventCount ?? 0,
      reasons: breakdownItem?.reasons ?? [],
    };
  });
}

export function toLearningRecommendedProblemView(
  item: RecommendedProblem,
): LearningRecommendedProblemView {
  return {
    ...item,
    id: item.problem.id,
    title: item.problem.title,
    difficulty: item.problem.difficulty,
    tags: item.problem.tags,
  };
}

export function toLearningDashboardProblemView(
  problem: RecommendationProblem,
): LearningDashboardProblemView {
  const view: LearningDashboardProblemView = {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    tags: problem.tags,
  };

  if (problem.source !== undefined) {
    view.source = problem.source;
  }

  if (problem.estimatedMinutes !== undefined) {
    view.estimatedMinutes = problem.estimatedMinutes;
  }

  return view;
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.min(Math.max(value, 0), 100).toFixed(2));
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(Math.min(Math.max(value, 0), 1).toFixed(2));
}
