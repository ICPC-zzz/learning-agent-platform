import { getDifficultyDistance } from "./difficulty.js";
import {
  clampRecommendationScore,
  isProblemRecentlyAttempted,
  normalizeProblemTags,
} from "./utils.js";
import type {
  RecentProblemAttempt,
  RecommendationConfig,
  RecommendationContext,
  RecommendationProblem,
  RecommendationReason,
  RecommendedProblem,
} from "./types.js";

interface ScoredProblem {
  problem: RecommendationProblem;
  score: number;
  reasons: readonly RecommendationReason[];
  originalIndex: number;
}

function getEstimatedDurationScore(estimatedMinutes: number | undefined): number {
  if (estimatedMinutes === undefined || !Number.isFinite(estimatedMinutes)) {
    return 0;
  }

  if (estimatedMinutes >= 10 && estimatedMinutes <= 45) {
    return 8;
  }

  if (estimatedMinutes >= 5 && estimatedMinutes <= 60) {
    return 4;
  }

  return 0;
}

function compareStrings(a: string, b: string): number {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();

  if (normalizedA < normalizedB) {
    return -1;
  }

  if (normalizedA > normalizedB) {
    return 1;
  }

  return 0;
}

function getMatchedTargetTags(
  problemTags: readonly string[],
  targetTags: readonly string[],
): readonly string[] {
  const normalizedProblemTags = new Set(normalizeProblemTags(problemTags));

  return normalizeProblemTags(targetTags).filter((tag) =>
    normalizedProblemTags.has(tag),
  );
}

export function getProblemTagMatchScore(
  problemTags: readonly string[],
  targetTags: readonly string[],
): number {
  const normalizedTargetTags = normalizeProblemTags(targetTags);

  if (normalizedTargetTags.length === 0) {
    return 0;
  }

  const matchCount = getMatchedTargetTags(problemTags, normalizedTargetTags).length;
  const meaningfulMatchTarget = Math.min(normalizedTargetTags.length, 3);

  return Math.min(1, matchCount / meaningfulMatchTarget);
}

export function createRecommendationReason(
  code: string,
  message: string,
  weight?: number,
): RecommendationReason {
  if (weight === undefined) {
    return { code, message };
  }

  return { code, message, weight };
}

export function createRecommendationReasons(
  problem: RecommendationProblem,
  context: RecommendationContext,
): readonly RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const difficultyDistance = getDifficultyDistance(
    problem.difficulty,
    context.targetDifficulty,
  );
  const matchedTags = getMatchedTargetTags(problem.tags, context.targetTags);
  const durationScore = getEstimatedDurationScore(problem.estimatedMinutes);
  const wasRecentlyAttempted = isProblemRecentlyAttempted(
    problem.id,
    context.recentAttempts,
    context.config.recentAttemptWindowDays,
    context.targetDate,
  );

  if (difficultyDistance === 0) {
    reasons.push(
      createRecommendationReason(
        "target_difficulty_match",
        `Matches the target ${context.targetDifficulty} difficulty.`,
        context.config.difficultyWeights[context.targetDifficulty],
      ),
    );
  } else if (difficultyDistance === 1) {
    reasons.push(
      createRecommendationReason(
        "target_difficulty_near",
        `Near the target ${context.targetDifficulty} difficulty.`,
        context.config.difficultyWeights[context.targetDifficulty] / 2,
      ),
    );
  }

  if (matchedTags.length > 0) {
    reasons.push(
      createRecommendationReason(
        "weak_dimension_tag_match",
        `Matches weak-area tags: ${matchedTags.slice(0, 3).join(", ")}.`,
        getProblemTagMatchScore(problem.tags, context.targetTags) *
          context.config.tagMatchWeight,
      ),
    );
  }

  if (durationScore > 0) {
    reasons.push(
      createRecommendationReason(
        "reasonable_estimated_time",
        "Fits a daily practice session.",
        durationScore,
      ),
    );
  }

  if (wasRecentlyAttempted) {
    reasons.push(
      createRecommendationReason(
        "recently_attempted",
        "Recently attempted, so it is deprioritized.",
        -20,
      ),
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      createRecommendationReason(
        "fallback_candidate",
        "Included as a stable fallback candidate.",
        0,
      ),
    );
  }

  return reasons;
}

export function scoreProblemForUser(
  problem: RecommendationProblem,
  context: RecommendationContext,
): number {
  const difficultyDistance = getDifficultyDistance(
    problem.difficulty,
    context.targetDifficulty,
  );
  const maxDifficultyScore =
    context.config.difficultyWeights[context.targetDifficulty];
  const difficultyScore = Math.max(
    0,
    maxDifficultyScore - difficultyDistance * (maxDifficultyScore / 2),
  );
  const tagScore =
    getProblemTagMatchScore(problem.tags, context.targetTags) *
    context.config.tagMatchWeight;
  const durationScore = getEstimatedDurationScore(problem.estimatedMinutes);
  const recentlyAttemptedPenalty = isProblemRecentlyAttempted(
    problem.id,
    context.recentAttempts,
    context.config.recentAttemptWindowDays,
    context.targetDate,
  )
    ? 20
    : 0;

  return clampRecommendationScore(
    20 + difficultyScore + tagScore + durationScore - recentlyAttemptedPenalty,
  );
}

export function rankRecommendationProblems(
  problems: readonly RecommendationProblem[],
  context: RecommendationContext,
): readonly RecommendedProblem[] {
  return problems
    .map<ScoredProblem>((problem, originalIndex) => ({
      problem,
      originalIndex,
      score: scoreProblemForUser(problem, context),
      reasons: createRecommendationReasons(problem, context),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      const difficultyDistanceDelta =
        getDifficultyDistance(a.problem.difficulty, context.targetDifficulty) -
        getDifficultyDistance(b.problem.difficulty, context.targetDifficulty);

      if (difficultyDistanceDelta !== 0) {
        return difficultyDistanceDelta;
      }

      const titleCompare = compareStrings(a.problem.title, b.problem.title);

      if (titleCompare !== 0) {
        return titleCompare;
      }

      const idCompare = compareStrings(a.problem.id, b.problem.id);

      if (idCompare !== 0) {
        return idCompare;
      }

      return a.originalIndex - b.originalIndex;
    })
    .map(({ problem, score, reasons }) => ({
      problem,
      score,
      reasons,
    }));
}

export function filterRecentlyAttemptedProblems(
  problems: readonly RecommendationProblem[],
  recentAttempts: readonly RecentProblemAttempt[],
  config: RecommendationConfig,
  targetDate: Date = new Date(),
): readonly RecommendationProblem[] {
  if (!config.avoidRecentlyAttempted) {
    return [...problems];
  }

  return problems.filter(
    (problem) =>
      !isProblemRecentlyAttempted(
        problem.id,
        recentAttempts,
        config.recentAttemptWindowDays,
        targetDate,
      ),
  );
}
