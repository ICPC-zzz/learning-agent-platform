import { DEFAULT_ABILITY_SCORING_CONFIG } from "./config.js";
import {
  calculateDimensionScore,
  calculateEventRecencyWeight,
  calculateOverallScore,
  clampScore,
  getDifficultyWeight,
  normalizeRatio,
  safeDivide,
  weightedAverage,
} from "./score-utils.js";
import {
  filterChapterQuestionEvents,
  filterProblemAttemptEvents,
  filterReadingEvents,
  getEventOccurredAt,
  normalizeLearningEvents,
} from "./event-normalizer.js";
import type {
  AbilityDimensionBreakdownMap,
  AbilityProfile,
  AbilityScoringConfig,
  AbilityScoringInput,
  AbilityScoringResult,
  ChapterQuestionEvent,
  LearningEvent,
  ProblemAttemptEvent,
  ReadingEvent,
} from "./types.js";

interface DimensionCalculation {
  score: number;
  eventCount: number;
  confidence: number;
  reasons: readonly string[];
}

interface ProblemAttemptScores {
  algorithm: DimensionCalculation;
  debugging: DimensionCalculation;
  systemDesign: DimensionCalculation;
}

interface ScoringSummaries {
  algorithm: DimensionCalculation;
  debugging: DimensionCalculation;
  systemDesign: DimensionCalculation;
  reading: DimensionCalculation;
}

const FIXED_FALLBACK_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const DEBUGGING_TAGS = new Set(["debug", "debugging", "bug", "bugfix"]);
const SYSTEM_DESIGN_TAGS = new Set([
  "architecture",
  "design",
  "system-design",
  "system_design",
  "system design",
]);

function resolveConfig(
  config?: Partial<AbilityScoringConfig>,
): AbilityScoringConfig {
  return {
    ...DEFAULT_ABILITY_SCORING_CONFIG,
    ...config,
    dimensionWeights: {
      ...DEFAULT_ABILITY_SCORING_CONFIG.dimensionWeights,
      ...config?.dimensionWeights,
    },
    difficultyWeights: {
      ...DEFAULT_ABILITY_SCORING_CONFIG.difficultyWeights,
      ...config?.difficultyWeights,
    },
  };
}

function roundScore(score: number, config: AbilityScoringConfig): number {
  return Number(
    clampScore(score, config.minScore, config.maxScore).toFixed(2),
  );
}

function roundConfidence(confidence: number): number {
  return Number(normalizeRatio(confidence).toFixed(2));
}

function getLatestEventDate(events: readonly LearningEvent[]): Date | undefined {
  return events.reduce<Date | undefined>((latestDate, event) => {
    const occurredAt = getEventOccurredAt(event);

    if (occurredAt === undefined) {
      return latestDate;
    }

    if (
      latestDate === undefined ||
      occurredAt.getTime() > latestDate.getTime()
    ) {
      return occurredAt;
    }

    return latestDate;
  }, undefined);
}

function resolveUpdatedAt(
  latestEventDate: Date | undefined,
  previousProfile: AbilityProfile | undefined,
): string {
  if (latestEventDate !== undefined) {
    return latestEventDate.toISOString();
  }

  return previousProfile?.updatedAt ?? FIXED_FALLBACK_UPDATED_AT;
}

function hasAnyTag(
  event: ProblemAttemptEvent,
  candidateTags: ReadonlySet<string>,
): boolean {
  return (
    event.tags?.some((tag) => candidateTags.has(tag.trim().toLowerCase())) ??
    false
  );
}

function calculateWeightedCorrectnessRate(
  events: readonly ProblemAttemptEvent[],
  config: AbilityScoringConfig,
  referenceDate: Date | undefined,
): number {
  const totals = events.reduce(
    (accumulator, event) => {
      const occurredAt = getEventOccurredAt(event);
      const recencyWeight = calculateEventRecencyWeight(
        occurredAt,
        referenceDate,
        config.recencyHalfLifeDays,
        config.recencyMinWeight,
      );
      const weight =
        getDifficultyWeight(event.difficulty, config.difficultyWeights) *
        recencyWeight;

      return {
        correctWeight: accumulator.correctWeight + (event.isCorrect ? weight : 0),
        totalWeight: accumulator.totalWeight + weight,
      };
    },
    { correctWeight: 0, totalWeight: 0 },
  );

  return safeDivide(totals.correctWeight, totals.totalWeight, 0.5);
}

function buildProblemDimensionScore(
  events: readonly ProblemAttemptEvent[],
  config: AbilityScoringConfig,
  referenceDate: Date | undefined,
  emptyReason: string,
  activeReason: string,
): DimensionCalculation {
  if (events.length === 0) {
    return {
      score: config.baseScore,
      eventCount: 0,
      confidence: 0,
      reasons: [emptyReason],
    };
  }

  const correctnessRate = calculateWeightedCorrectnessRate(
    events,
    config,
    referenceDate,
  );

  return {
    score: calculateDimensionScore({
      baseScore: config.baseScore,
      positiveSignal: correctnessRate,
      negativeSignal: 1 - correctnessRate,
      influence: 20,
      minScore: config.minScore,
      maxScore: config.maxScore,
    }),
    eventCount: events.length,
    confidence: normalizeRatio(events.length / config.maxConfidenceEventCount),
    reasons: [activeReason],
  };
}

export function calculateProblemAttemptScores(
  events: readonly ProblemAttemptEvent[],
  config: AbilityScoringConfig,
  referenceDate?: Date,
): ProblemAttemptScores {
  const debuggingEvents = events.filter((event) =>
    hasAnyTag(event, DEBUGGING_TAGS),
  );
  const systemDesignEvents = events.filter((event) =>
    hasAnyTag(event, SYSTEM_DESIGN_TAGS),
  );

  return {
    algorithm: buildProblemDimensionScore(
      events,
      config,
      referenceDate,
      "no_problem_attempt_events",
      "problem_correctness_rate",
    ),
    debugging: buildProblemDimensionScore(
      debuggingEvents,
      config,
      referenceDate,
      "no_debugging_problem_attempt_events",
      "debugging_tagged_problem_correctness_rate",
    ),
    systemDesign: buildProblemDimensionScore(
      systemDesignEvents,
      config,
      referenceDate,
      "no_system_design_problem_attempt_events",
      "system_design_tagged_problem_correctness_rate",
    ),
  };
}

function getTimedReadingWeight(event: ReadingEvent): number {
  const timeSpentWeight =
    event.timeSpentSeconds === undefined
      ? 0
      : Math.min(event.timeSpentSeconds, 1800) / 1800;

  return 1 + timeSpentWeight * 0.25;
}

export function calculateReadingScore(
  events: readonly ReadingEvent[],
  config: AbilityScoringConfig,
  referenceDate?: Date,
): DimensionCalculation {
  if (events.length === 0) {
    return {
      score: config.baseScore,
      eventCount: 0,
      confidence: 0,
      reasons: ["no_reading_progress_events"],
    };
  }

  const weightedProgress = weightedAverage(
    events.map((event) => {
      const recencyWeight = calculateEventRecencyWeight(
        getEventOccurredAt(event),
        referenceDate,
        config.recencyHalfLifeDays,
        config.recencyMinWeight,
      );

      return {
        value: normalizeRatio(event.progressRatio),
        weight: recencyWeight * getTimedReadingWeight(event),
      };
    }),
    0,
  );

  return {
    score: clampScore(
      config.baseScore - 10 + weightedProgress * 45,
      config.minScore,
      config.maxScore,
    ),
    eventCount: events.length,
    confidence: normalizeRatio(events.length / config.maxConfidenceEventCount),
    reasons: ["reading_progress_completion"],
  };
}

function normalizeHelpfulnessRating(rating: number): number {
  if (rating > 1) {
    return normalizeRatio((rating - 1) / 4);
  }

  return normalizeRatio(rating);
}

export function calculateQuestionEngagementScore(
  events: readonly ChapterQuestionEvent[],
  config: AbilityScoringConfig,
  referenceDate?: Date,
): DimensionCalculation {
  if (events.length === 0) {
    return {
      score: config.baseScore,
      eventCount: 0,
      confidence: 0,
      reasons: ["no_chapter_question_events"],
    };
  }

  const engagementSignal = weightedAverage(
    events.map((event) => {
      const recencyWeight = calculateEventRecencyWeight(
        getEventOccurredAt(event),
        referenceDate,
        config.recencyHalfLifeDays,
        config.recencyMinWeight,
      );

      return {
        value: normalizeRatio(event.questionLength / config.questionLengthTarget),
        weight: recencyWeight,
      };
    }),
    0,
  );
  const helpfulnessEvents = events.filter(
    (event) => event.answerHelpfulnessRating !== undefined,
  );
  const helpfulnessSignal = weightedAverage(
    helpfulnessEvents.map((event) => ({
      value: normalizeHelpfulnessRating(event.answerHelpfulnessRating ?? 0),
      weight: 1,
    })),
    0.5,
  );

  return {
    score: clampScore(
      config.baseScore + engagementSignal * 8 + helpfulnessSignal * 4,
      config.minScore,
      config.maxScore,
    ),
    eventCount: events.length,
    confidence: normalizeRatio(events.length / config.maxConfidenceEventCount),
    reasons: ["chapter_question_engagement"],
  };
}

function calculateReadingDimensionScore(
  readingScore: DimensionCalculation,
  questionScore: DimensionCalculation,
): DimensionCalculation {
  if (readingScore.eventCount === 0 && questionScore.eventCount === 0) {
    return {
      score: readingScore.score,
      eventCount: 0,
      confidence: 0,
      reasons: ["no_reading_or_question_events"],
    };
  }

  if (readingScore.eventCount === 0) {
    return questionScore;
  }

  if (questionScore.eventCount === 0) {
    return readingScore;
  }

  return {
    score: weightedAverage(
      [
        { value: readingScore.score, weight: 0.8 },
        { value: questionScore.score, weight: 0.2 },
      ],
      readingScore.score,
    ),
    eventCount: readingScore.eventCount + questionScore.eventCount,
    confidence: normalizeRatio(
      (readingScore.confidence + questionScore.confidence) / 2,
    ),
    reasons: [...readingScore.reasons, ...questionScore.reasons],
  };
}

function calculateHelpfulnessOverallAdjustment(
  events: readonly ChapterQuestionEvent[],
): number {
  const ratedEvents = events.filter(
    (event) => event.answerHelpfulnessRating !== undefined,
  );

  if (ratedEvents.length === 0) {
    return 0;
  }

  const averageHelpfulness = weightedAverage(
    ratedEvents.map((event) => ({
      value: normalizeHelpfulnessRating(event.answerHelpfulnessRating ?? 0),
      weight: 1,
    })),
    0.5,
  );

  return (averageHelpfulness - 0.5) * 4;
}

function buildBaseProfile(
  config: AbilityScoringConfig,
  updatedAt: string,
  confidence: number,
): AbilityProfile {
  const baseScore = roundScore(config.baseScore, config);

  return {
    overallScore: baseScore,
    algorithmScore: baseScore,
    debuggingScore: baseScore,
    systemDesignScore: baseScore,
    readingScore: baseScore,
    updatedAt,
    confidence: roundConfidence(confidence),
  };
}

function normalizeProfileScores(
  profile: AbilityProfile,
  config: AbilityScoringConfig,
  updatedAt: string,
): AbilityProfile {
  return {
    overallScore: roundScore(profile.overallScore, config),
    algorithmScore: roundScore(profile.algorithmScore, config),
    debuggingScore: roundScore(profile.debuggingScore, config),
    systemDesignScore: roundScore(profile.systemDesignScore, config),
    readingScore: roundScore(profile.readingScore, config),
    updatedAt,
    confidence: roundConfidence(profile.confidence),
  };
}

export function mergeWithPreviousProfile(
  eventProfile: AbilityProfile,
  previousProfile: AbilityProfile | undefined,
  config: AbilityScoringConfig,
  updatedAt: string,
): AbilityProfile {
  if (previousProfile === undefined) {
    return normalizeProfileScores(eventProfile, config, updatedAt);
  }

  const previousWeight = Math.max(0, config.previousProfileWeight);
  const eventWeight = Math.max(0, config.eventScoreWeight);

  return {
    overallScore: roundScore(
      weightedAverage(
        [
          { value: previousProfile.overallScore, weight: previousWeight },
          { value: eventProfile.overallScore, weight: eventWeight },
        ],
        eventProfile.overallScore,
      ),
      config,
    ),
    algorithmScore: roundScore(
      weightedAverage(
        [
          { value: previousProfile.algorithmScore, weight: previousWeight },
          { value: eventProfile.algorithmScore, weight: eventWeight },
        ],
        eventProfile.algorithmScore,
      ),
      config,
    ),
    debuggingScore: roundScore(
      weightedAverage(
        [
          { value: previousProfile.debuggingScore, weight: previousWeight },
          { value: eventProfile.debuggingScore, weight: eventWeight },
        ],
        eventProfile.debuggingScore,
      ),
      config,
    ),
    systemDesignScore: roundScore(
      weightedAverage(
        [
          { value: previousProfile.systemDesignScore, weight: previousWeight },
          { value: eventProfile.systemDesignScore, weight: eventWeight },
        ],
        eventProfile.systemDesignScore,
      ),
      config,
    ),
    readingScore: roundScore(
      weightedAverage(
        [
          { value: previousProfile.readingScore, weight: previousWeight },
          { value: eventProfile.readingScore, weight: eventWeight },
        ],
        eventProfile.readingScore,
      ),
      config,
    ),
    updatedAt,
    confidence: roundConfidence(
      weightedAverage(
        [
          { value: previousProfile.confidence, weight: previousWeight },
          { value: eventProfile.confidence, weight: eventWeight },
        ],
        eventProfile.confidence,
      ),
    ),
  };
}

export function calculateDimensionBreakdown(
  profile: AbilityProfile,
  summaries: ScoringSummaries,
  config: AbilityScoringConfig,
): AbilityDimensionBreakdownMap {
  const totalEventCount =
    summaries.algorithm.eventCount +
    summaries.reading.eventCount;

  return {
    overall: {
      dimension: "overall",
      score: profile.overallScore,
      weight: 1,
      eventCount: totalEventCount,
      confidence: profile.confidence,
      reasons: ["weighted_dimension_average"],
    },
    algorithm: {
      dimension: "algorithm",
      score: profile.algorithmScore,
      weight: config.dimensionWeights.algorithm,
      eventCount: summaries.algorithm.eventCount,
      confidence: summaries.algorithm.confidence,
      reasons: summaries.algorithm.reasons,
    },
    debugging: {
      dimension: "debugging",
      score: profile.debuggingScore,
      weight: config.dimensionWeights.debugging,
      eventCount: summaries.debugging.eventCount,
      confidence: summaries.debugging.confidence,
      reasons: summaries.debugging.reasons,
    },
    system_design: {
      dimension: "system_design",
      score: profile.systemDesignScore,
      weight: config.dimensionWeights.systemDesign,
      eventCount: summaries.systemDesign.eventCount,
      confidence: summaries.systemDesign.confidence,
      reasons: summaries.systemDesign.reasons,
    },
    reading: {
      dimension: "reading",
      score: profile.readingScore,
      weight: config.dimensionWeights.reading,
      eventCount: summaries.reading.eventCount,
      confidence: summaries.reading.confidence,
      reasons: summaries.reading.reasons,
    },
  };
}

function createEmptySummaries(config: AbilityScoringConfig): ScoringSummaries {
  const emptySummary: DimensionCalculation = {
    score: config.baseScore,
    eventCount: 0,
    confidence: 0,
    reasons: ["no_events"],
  };

  return {
    algorithm: emptySummary,
    debugging: emptySummary,
    systemDesign: emptySummary,
    reading: emptySummary,
  };
}

function uniqueWarnings(warnings: readonly string[]): readonly string[] {
  return [...new Set(warnings)];
}

export function calculateAbilityProfile(
  input: AbilityScoringInput,
): AbilityScoringResult {
  const config = resolveConfig(input.config);
  const normalized = normalizeLearningEvents(input.events);
  const warnings = [...normalized.warnings];
  const latestEventDate = getLatestEventDate(normalized.events);
  const updatedAt = resolveUpdatedAt(latestEventDate, input.previousProfile);

  if (normalized.events.length === 0) {
    warnings.push("no_events");

    const profile =
      input.previousProfile === undefined
        ? buildBaseProfile(config, updatedAt, 0.1)
        : normalizeProfileScores(input.previousProfile, config, updatedAt);
    const dimensionBreakdown = calculateDimensionBreakdown(
      profile,
      createEmptySummaries(config),
      config,
    );

    return {
      profile,
      eventCount: 0,
      dimensionBreakdown,
      warnings: uniqueWarnings(warnings),
    };
  }

  const problemAttemptEvents = filterProblemAttemptEvents(normalized.events);
  const readingEvents = filterReadingEvents(normalized.events);
  const questionEvents = filterChapterQuestionEvents(normalized.events);
  const problemScores = calculateProblemAttemptScores(
    problemAttemptEvents,
    config,
    latestEventDate,
  );
  const progressReadingScore = calculateReadingScore(
    readingEvents,
    config,
    latestEventDate,
  );
  const questionEngagementScore = calculateQuestionEngagementScore(
    questionEvents,
    config,
    latestEventDate,
  );
  const readingSummary = calculateReadingDimensionScore(
    progressReadingScore,
    questionEngagementScore,
  );
  const helpfulnessAdjustment =
    calculateHelpfulnessOverallAdjustment(questionEvents);
  const overallScore = calculateOverallScore(
    {
      algorithmScore: problemScores.algorithm.score,
      debuggingScore: problemScores.debugging.score,
      systemDesignScore: problemScores.systemDesign.score,
      readingScore: readingSummary.score,
    },
    config.dimensionWeights,
    config.minScore,
    config.maxScore,
  );
  const eventConfidence = normalizeRatio(
    normalized.events.length / config.maxConfidenceEventCount,
  );
  const eventProfile: AbilityProfile = {
    overallScore: clampScore(
      overallScore + helpfulnessAdjustment,
      config.minScore,
      config.maxScore,
    ),
    algorithmScore: problemScores.algorithm.score,
    debuggingScore: problemScores.debugging.score,
    systemDesignScore: problemScores.systemDesign.score,
    readingScore: readingSummary.score,
    updatedAt,
    confidence: eventConfidence,
  };
  const profile = mergeWithPreviousProfile(
    eventProfile,
    input.previousProfile,
    config,
    updatedAt,
  );
  const summaries: ScoringSummaries = {
    algorithm: problemScores.algorithm,
    debugging: problemScores.debugging,
    systemDesign: problemScores.systemDesign,
    reading: readingSummary,
  };

  return {
    profile,
    eventCount: normalized.events.length,
    dimensionBreakdown: calculateDimensionBreakdown(profile, summaries, config),
    warnings: uniqueWarnings(warnings),
  };
}
