import type {
  AbilityDimensionWeights,
  DifficultyWeights,
  ProblemAttemptEvent,
  ProblemDifficulty,
} from "./types.js";

export interface WeightedAverageItem {
  value: number;
  weight: number;
}

export interface DimensionScoreInput {
  baseScore: number;
  positiveSignal: number;
  negativeSignal?: number;
  influence?: number;
  minScore?: number;
  maxScore?: number;
}

export interface OverallScoreInput {
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
  readingScore: number;
}

const DEFAULT_DIFFICULTY_WEIGHTS: DifficultyWeights = {
  easy: 0.8,
  medium: 1,
  hard: 1.25,
};

export function clampScore(score: number, min = 0, max = 100): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  if (!Number.isFinite(score)) {
    return lower;
  }

  return Math.min(upper, Math.max(lower, score));
}

export function safeDivide(
  numerator: number,
  denominator: number,
  fallback = 0,
): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return fallback;
  }

  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

export function normalizeRatio(value: number): number {
  return clampScore(value, 0, 1);
}

export function weightedAverage(
  items: readonly WeightedAverageItem[],
  fallback = 0,
): number {
  const totals = items.reduce(
    (accumulator, item) => {
      if (!Number.isFinite(item.value) || !Number.isFinite(item.weight)) {
        return accumulator;
      }

      const weight = Math.max(0, item.weight);
      return {
        weightedValue: accumulator.weightedValue + item.value * weight,
        weight: accumulator.weight + weight,
      };
    },
    { weightedValue: 0, weight: 0 },
  );

  return safeDivide(totals.weightedValue, totals.weight, fallback);
}

export function getDifficultyWeight(
  difficulty: ProblemDifficulty | number,
  weights: DifficultyWeights = DEFAULT_DIFFICULTY_WEIGHTS,
): number {
  if (typeof difficulty === "number") {
    if (!Number.isFinite(difficulty)) {
      return weights.medium;
    }

    if (difficulty <= 1) {
      return weights.easy;
    }

    if (difficulty <= 2) {
      return weights.medium;
    }

    return weights.hard;
  }

  return weights[difficulty] ?? weights.medium;
}

export function calculateCorrectnessRate(
  events: readonly ProblemAttemptEvent[],
): number {
  const totalWeight = events.reduce(
    (total, event) => total + getDifficultyWeight(event.difficulty),
    0,
  );
  const correctWeight = events.reduce(
    (total, event) =>
      total + (event.isCorrect ? getDifficultyWeight(event.difficulty) : 0),
    0,
  );

  return safeDivide(correctWeight, totalWeight, 0);
}

export function calculateEventRecencyWeight(
  occurredAt?: Date,
  referenceDate?: Date,
  halfLifeDays = 30,
  minWeight = 0.35,
): number {
  if (
    occurredAt === undefined ||
    referenceDate === undefined ||
    Number.isNaN(occurredAt.getTime()) ||
    Number.isNaN(referenceDate.getTime()) ||
    halfLifeDays <= 0
  ) {
    return 1;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const ageDays = Math.max(
    0,
    safeDivide(
      referenceDate.getTime() - occurredAt.getTime(),
      millisecondsPerDay,
      0,
    ),
  );
  const rawWeight = Math.pow(0.5, ageDays / halfLifeDays);

  return clampScore(rawWeight, minWeight, 1);
}

export function calculateDimensionScore(input: DimensionScoreInput): number {
  const positiveSignal = normalizeRatio(input.positiveSignal);
  const negativeSignal = normalizeRatio(input.negativeSignal ?? 0);
  const influence =
    input.influence !== undefined && Number.isFinite(input.influence)
      ? input.influence
      : 20;

  return clampScore(
    input.baseScore + (positiveSignal - negativeSignal) * influence,
    input.minScore,
    input.maxScore,
  );
}

export function calculateOverallScore(
  scores: OverallScoreInput,
  weights: AbilityDimensionWeights,
  minScore = 0,
  maxScore = 100,
): number {
  return clampScore(
    weightedAverage(
      [
        { value: scores.algorithmScore, weight: weights.algorithm },
        { value: scores.debuggingScore, weight: weights.debugging },
        { value: scores.systemDesignScore, weight: weights.systemDesign },
        { value: scores.readingScore, weight: weights.reading },
      ],
      0,
    ),
    minScore,
    maxScore,
  );
}
