import type { Prisma as PrismaTypes } from "@prisma/client";

import type {
  CreateDailyRecommendationsInput,
  CreateProblemInput,
  ProblemDifficulty,
  RecommendationStatus,
  UpsertAbilityProfileInput,
} from "../types.js";

export type LearningMapperJsonPrimitive = string | number | boolean | null;

export type LearningMapperJsonValue =
  | LearningMapperJsonPrimitive
  | LearningMapperJsonObject
  | LearningMapperJsonValue[];

export interface LearningMapperJsonObject {
  [key: string]: LearningMapperJsonValue;
}

export interface AbilityProfileLike {
  overallScore: number;
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
  readingScore?: number;
  updatedAt?: string | Date;
  confidence?: number;
  metadata?: LearningMapperJsonObject;
}

export interface AbilityScoringResultLike {
  profile: AbilityProfileLike;
}

export interface CreateAbilityProfileInputFromScoringResultInput {
  userId: string;
  scoringResult: AbilityScoringResultLike;
}

export type LearningProblemDifficulty =
  | "easy"
  | "medium"
  | "hard"
  | "challenge"
  | ProblemDifficulty;

export interface RecommendationProblemLike {
  id: string;
  title: string;
  difficulty: LearningProblemDifficulty;
  tags: readonly string[];
  source?: string;
  sourceUrl?: string;
  estimatedMinutes?: number;
  metadata?: LearningMapperJsonObject;
}

export interface RecommendationReasonLike {
  code: string;
  message: string;
  weight?: number;
}

export interface RecommendedProblemLike {
  problem: RecommendationProblemLike;
  score: number;
  reasons: readonly RecommendationReasonLike[];
}

export interface RecommendationResultLike {
  recommendedProblems: readonly RecommendedProblemLike[];
  targetDifficulty?: LearningProblemDifficulty;
  weakDimensions?: readonly string[];
  warnings?: readonly string[];
  generatedAt?: Date;
}

export type LearningRecommendationStatus =
  | "pending"
  | "accepted"
  | "skipped"
  | "completed"
  | RecommendationStatus;

export interface CreateDailyRecommendationsInputFromRecommendationResultInput {
  userId: string;
  result: RecommendationResultLike;
  recommendationDate?: Date;
  status?: LearningRecommendationStatus;
}

export function createAbilityProfileInputFromScoringResult(
  input: CreateAbilityProfileInputFromScoringResultInput,
): UpsertAbilityProfileInput {
  const profile = input.scoringResult.profile;
  const result: UpsertAbilityProfileInput = {
    userId: input.userId,
    overallScore: profile.overallScore,
    algorithmScore: profile.algorithmScore,
    debuggingScore: profile.debuggingScore,
    systemDesignScore: profile.systemDesignScore,
    readingScore: profile.readingScore,
    languageFundamentalsScore: profile.readingScore,
    confidence: profile.confidence,
    lastEvaluatedAt: normalizeOptionalDate(profile.updatedAt),
  };

  if (profile.metadata !== undefined) {
    result.metadata = profile.metadata as PrismaTypes.InputJsonValue;
  }

  return result;
}

export function createProblemInputFromRecommendationProblem(
  problem: RecommendationProblemLike,
): CreateProblemInput {
  const input: CreateProblemInput = {
    id: problem.id,
    title: problem.title,
    difficulty: mapProblemDifficulty(problem.difficulty),
    tags: [...problem.tags],
    source: problem.source ?? null,
    sourceUrl: problem.sourceUrl ?? null,
  };
  const metadata = createProblemMetadata(problem);

  if (metadata !== undefined) {
    input.metadata = metadata;
  }

  return input;
}

export function createDailyRecommendationsInputFromRecommendationResult(
  input: CreateDailyRecommendationsInputFromRecommendationResultInput,
): CreateDailyRecommendationsInput {
  const status =
    input.status === undefined ? undefined : mapRecommendationStatus(input.status);

  return {
    userId: input.userId,
    recommendationDate:
      input.recommendationDate ?? input.result.generatedAt ?? new Date(),
    recommendations: input.result.recommendedProblems.map(
      (recommendedProblem) => ({
        problemId: normalizeRequiredText(
          recommendedProblem.problem.id,
          "Recommended problem id is required.",
        ),
        reason: createRecommendationReasonText(recommendedProblem.reasons),
        status,
        score: recommendedProblem.score,
        metadata: createRecommendationMetadata(
          recommendedProblem,
          input.result,
        ),
      }),
    ),
  };
}

function mapProblemDifficulty(
  difficulty: LearningProblemDifficulty,
): ProblemDifficulty {
  switch (difficulty) {
    case "easy":
    case "EASY":
      return "EASY";
    case "medium":
    case "MEDIUM":
      return "MEDIUM";
    case "hard":
    case "HARD":
      return "HARD";
    case "challenge":
    case "CHALLENGE":
      return "CHALLENGE";
  }
}

function mapRecommendationStatus(
  status: LearningRecommendationStatus,
): RecommendationStatus {
  switch (status) {
    case "pending":
    case "accepted":
    case "PENDING":
      return "PENDING";
    case "skipped":
    case "SKIPPED":
      return "SKIPPED";
    case "completed":
    case "COMPLETED":
      return "COMPLETED";
    case "DISMISSED":
      return "DISMISSED";
  }
}

function createProblemMetadata(
  problem: RecommendationProblemLike,
): PrismaTypes.InputJsonValue | undefined {
  const metadata: LearningMapperJsonObject =
    problem.metadata === undefined ? {} : { ...problem.metadata };

  if (problem.estimatedMinutes !== undefined) {
    metadata.estimatedMinutes = problem.estimatedMinutes;
  }

  if (Object.keys(metadata).length === 0) {
    return undefined;
  }

  return metadata as PrismaTypes.InputJsonValue;
}

function createRecommendationReasonText(
  reasons: readonly RecommendationReasonLike[],
): string | null {
  if (reasons.length === 0) {
    return null;
  }

  return reasons.map((reason) => reason.message).join(" ");
}

function createRecommendationMetadata(
  recommendedProblem: RecommendedProblemLike,
  result: RecommendationResultLike,
): PrismaTypes.InputJsonValue {
  const metadata: LearningMapperJsonObject = {
    score: recommendedProblem.score,
    reasonCodes: recommendedProblem.reasons.map((reason) => reason.code),
    weakDimensions: [...(result.weakDimensions ?? [])],
    warnings: [...(result.warnings ?? [])],
  };

  if (result.targetDifficulty !== undefined) {
    metadata.targetDifficulty = mapProblemDifficulty(result.targetDifficulty);
  }

  return metadata as PrismaTypes.InputJsonValue;
}

function normalizeOptionalDate(value: string | Date | undefined): Date | null {
  if (value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Ability profile updatedAt must be a valid date.");
  }

  return date;
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}
