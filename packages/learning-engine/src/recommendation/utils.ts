import type { RecentProblemAttempt } from "./types.js";

const MIN_RECOMMENDATION_SCORE = 0;
const MAX_RECOMMENDATION_SCORE = 100;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeProblemTags(tags: readonly string[]): readonly string[] {
  return uniqueStrings(
    tags
      .map((tag) => tag.trim().toLowerCase().replace(/[\s_]+/g, "-"))
      .filter((tag) => tag.length > 0),
  );
}

export function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function clampRecommendationScore(score: number): number {
  if (!Number.isFinite(score)) {
    return MIN_RECOMMENDATION_SCORE;
  }

  return Number(
    Math.min(
      MAX_RECOMMENDATION_SCORE,
      Math.max(MIN_RECOMMENDATION_SCORE, score),
    ).toFixed(2),
  );
}

export function createRecommendationWarning(
  code: string,
  message: string,
): string {
  return `${code}: ${message}`;
}

export function isProblemRecentlyAttempted(
  problemId: string,
  recentAttempts: readonly RecentProblemAttempt[],
  windowDays: number,
  targetDate: Date,
): boolean {
  if (windowDays < 0) {
    return false;
  }

  const targetTime = targetDate.getTime();
  const cutoffTime = targetTime - windowDays * MILLISECONDS_PER_DAY;

  return recentAttempts.some((attempt) => {
    if (attempt.problemId !== problemId) {
      return false;
    }

    if (attempt.attemptedAt === undefined) {
      return true;
    }

    const attemptedTime = attempt.attemptedAt.getTime();

    if (!Number.isFinite(attemptedTime) || !Number.isFinite(targetTime)) {
      return true;
    }

    return attemptedTime >= cutoffTime && attemptedTime <= targetTime;
  });
}
