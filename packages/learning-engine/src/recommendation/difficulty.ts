import type {
  AbilityProfile,
  ProblemDifficulty,
} from "../scoring/types.js";
import type { RecommendationConfig } from "./types.js";

const DIFFICULTY_RANKS: Record<ProblemDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export function getTargetDifficulty(
  abilityProfile: AbilityProfile,
  config: RecommendationConfig,
): ProblemDifficulty {
  if (!Number.isFinite(abilityProfile.overallScore)) {
    return config.fallbackDifficulty;
  }

  if (abilityProfile.overallScore < 40) {
    return "easy";
  }

  if (abilityProfile.overallScore < 75) {
    return "medium";
  }

  return "hard";
}

export function getDifficultyRank(difficulty: ProblemDifficulty): number {
  return DIFFICULTY_RANKS[difficulty];
}

export function compareDifficulty(
  a: ProblemDifficulty,
  b: ProblemDifficulty,
): number {
  return getDifficultyRank(a) - getDifficultyRank(b);
}

export function getDifficultyDistance(
  a: ProblemDifficulty,
  b: ProblemDifficulty,
): number {
  return Math.abs(compareDifficulty(a, b));
}

export function isDifficultyWithinRange(
  problemDifficulty: ProblemDifficulty,
  targetDifficulty: ProblemDifficulty,
): boolean {
  return getDifficultyDistance(problemDifficulty, targetDifficulty) <= 1;
}
