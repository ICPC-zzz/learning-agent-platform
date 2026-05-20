import { DEFAULT_RECOMMENDATION_CONFIG } from "./config.js";
import { getTargetDifficulty } from "./difficulty.js";
import {
  filterRecentlyAttemptedProblems,
  rankRecommendationProblems,
} from "./problem-ranker.js";
import {
  createRecommendationWarning,
  normalizeProblemTags,
  uniqueStrings,
} from "./utils.js";
import type {
  RecommendationConfig,
  RecommendationContext,
  RecommendationInput,
  RecommendationResult,
  RecommendationWeakDimension,
} from "./types.js";
import type { AbilityProfile } from "../scoring/types.js";

interface AbilityDimensionCandidate {
  dimension: RecommendationWeakDimension;
  score: number;
}

const WEAK_SCORE_THRESHOLD = 60;
const RELATIVE_WEAK_SCORE_GAP = 10;

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function normalizePositiveNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function getAbilityDimensionCandidates(
  abilityProfile: AbilityProfile,
): readonly AbilityDimensionCandidate[] {
  return [
    { dimension: "algorithm", score: abilityProfile.algorithmScore },
    { dimension: "debugging", score: abilityProfile.debuggingScore },
    { dimension: "system_design", score: abilityProfile.systemDesignScore },
    { dimension: "reading", score: abilityProfile.readingScore },
  ];
}

export function resolveRecommendationConfig(
  inputConfig?: Partial<RecommendationConfig>,
): RecommendationConfig {
  const mergedConfig: RecommendationConfig = {
    ...DEFAULT_RECOMMENDATION_CONFIG,
    ...inputConfig,
    difficultyWeights: {
      ...DEFAULT_RECOMMENDATION_CONFIG.difficultyWeights,
      ...inputConfig?.difficultyWeights,
    },
    weakDimensionTagMap: {
      ...DEFAULT_RECOMMENDATION_CONFIG.weakDimensionTagMap,
      ...inputConfig?.weakDimensionTagMap,
    },
  };

  return {
    ...mergedConfig,
    dailyProblemCount: normalizePositiveInteger(
      mergedConfig.dailyProblemCount,
      DEFAULT_RECOMMENDATION_CONFIG.dailyProblemCount,
    ),
    recentAttemptWindowDays: normalizePositiveInteger(
      mergedConfig.recentAttemptWindowDays,
      DEFAULT_RECOMMENDATION_CONFIG.recentAttemptWindowDays,
    ),
    difficultyWeights: {
      easy: normalizePositiveNumber(
        mergedConfig.difficultyWeights.easy,
        DEFAULT_RECOMMENDATION_CONFIG.difficultyWeights.easy,
      ),
      medium: normalizePositiveNumber(
        mergedConfig.difficultyWeights.medium,
        DEFAULT_RECOMMENDATION_CONFIG.difficultyWeights.medium,
      ),
      hard: normalizePositiveNumber(
        mergedConfig.difficultyWeights.hard,
        DEFAULT_RECOMMENDATION_CONFIG.difficultyWeights.hard,
      ),
    },
    tagMatchWeight: normalizePositiveNumber(
      mergedConfig.tagMatchWeight,
      DEFAULT_RECOMMENDATION_CONFIG.tagMatchWeight,
    ),
  };
}

export function getWeakAbilityDimensions(
  abilityProfile: AbilityProfile,
  config: RecommendationConfig,
): readonly RecommendationWeakDimension[] {
  const candidates = getAbilityDimensionCandidates(abilityProfile).filter(
    (candidate) => candidate.dimension in config.weakDimensionTagMap,
  );
  const explicitWeakDimensions = candidates
    .filter(
      (candidate) =>
        candidate.score < WEAK_SCORE_THRESHOLD ||
        candidate.score <= abilityProfile.overallScore - RELATIVE_WEAK_SCORE_GAP,
    )
    .map((candidate) => candidate.dimension);

  if (explicitWeakDimensions.length > 0) {
    return explicitWeakDimensions;
  }

  const [lowestCandidate] = [...candidates].sort(
    (a, b) => a.score - b.score,
  );

  return lowestCandidate === undefined ? [] : [lowestCandidate.dimension];
}

export function getTargetTagsForWeakDimensions(
  weakDimensions: readonly RecommendationWeakDimension[],
  config: RecommendationConfig,
): readonly string[] {
  return uniqueStrings(
    normalizeProblemTags(
      weakDimensions.flatMap(
        (dimension) => config.weakDimensionTagMap[dimension] ?? [],
      ),
    ),
  );
}

export function resolveRecommendationContext(
  input: RecommendationInput,
): RecommendationContext {
  const config = resolveRecommendationConfig(input.config);
  const targetDifficulty = getTargetDifficulty(input.abilityProfile, config);
  const weakDimensions = getWeakAbilityDimensions(input.abilityProfile, config);

  return {
    abilityProfile: input.abilityProfile,
    targetDifficulty,
    weakDimensions,
    targetTags: getTargetTagsForWeakDimensions(weakDimensions, config),
    recentAttempts: input.recentAttempts ?? [],
    targetDate: input.targetDate ?? new Date(),
    config,
  };
}

export function recommendDailyProblems(
  input: RecommendationInput,
): RecommendationResult {
  const context = resolveRecommendationContext(input);
  const warnings: string[] = [];

  if (!Number.isFinite(input.abilityProfile.overallScore)) {
    warnings.push(
      createRecommendationWarning(
        "invalid_ability_profile_score",
        `Using fallback difficulty ${context.targetDifficulty}.`,
      ),
    );
  }

  if (input.candidateProblems.length === 0) {
    warnings.push(
      createRecommendationWarning(
        "no_candidate_problems",
        "No candidate problems were provided.",
      ),
    );

    return {
      recommendedProblems: [],
      targetDifficulty: context.targetDifficulty,
      weakDimensions: context.weakDimensions,
      warnings,
      generatedAt: context.targetDate,
    };
  }

  const filteredProblems = filterRecentlyAttemptedProblems(
    input.candidateProblems,
    context.recentAttempts,
    context.config,
    context.targetDate,
  );
  const rankingPool =
    filteredProblems.length > 0 ? filteredProblems : input.candidateProblems;

  if (filteredProblems.length === 0 && context.config.avoidRecentlyAttempted) {
    warnings.push(
      createRecommendationWarning(
        "recent_attempt_filter_exhausted",
        "All candidates were recently attempted, so recent items were ranked as a fallback.",
      ),
    );
  }

  if (rankingPool.length < context.config.dailyProblemCount) {
    warnings.push(
      createRecommendationWarning(
        "insufficient_candidates",
        `Only ${rankingPool.length} candidate problems are available for ${context.config.dailyProblemCount} requested recommendations.`,
      ),
    );
  }

  const recommendedProblems = rankRecommendationProblems(
    rankingPool,
    context,
  ).slice(0, context.config.dailyProblemCount);

  return {
    recommendedProblems,
    targetDifficulty: context.targetDifficulty,
    weakDimensions: context.weakDimensions,
    warnings: uniqueStrings(warnings),
    generatedAt: context.targetDate,
  };
}
