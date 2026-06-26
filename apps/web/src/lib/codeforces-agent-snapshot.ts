/**
 * Codeforces User Analysis Snapshot — Server-Only Read-Only Interface
 *
 * This module provides a structured, safe data snapshot for future AI Agents
 * to analyze a user's Codeforces profile without accessing the database directly.
 *
 * Security:
 * - Server-only — never registered as a real Agent Tool
 * - Read-only — no database writes
 * - Validates that the caller can only read their own data
 * - Never returns: source code, raw API responses, keys, tokens, passwords, emails
 *
 * @module codeforces-agent-snapshot
 * @serverOnly
 */

import type {
  CodeforcesAccountRepository,
  CodeforcesUserProblemStatRecord,
  CodeforcesRatingChangeRecord,
  CodeforcesAccountStats,
} from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Snapshot type
// ---------------------------------------------------------------------------

export type CodeforcesUserAnalysisSnapshot = {
  profile: {
    handle: string;
    currentRating: number | null;
    maxRating: number | null;
    rank: string | null;
    maxRank: string | null;
    lastOnlineAt: string | null;
    lastSubmissionAt: string | null;
    lastSyncedAt: string;
  };
  totals: {
    submissions: number;
    acceptedSubmissions: number;
    attemptedProblems: number;
    solvedProblems: number;
    unfinishedProblems: number;
  };
  ratingHistory: Array<{
    contestId: number;
    contestName: string;
    rank: number | null;
    oldRating: number;
    newRating: number;
    ratingUpdateAt: string;
  }>;
  verdictStats: Array<{
    verdict: string;
    count: number;
  }>;
  ratingBucketStats: Array<{
    bucket: string;
    attempted: number;
    solved: number;
  }>;
  tagStats: Array<{
    tag: string;
    attempted: number;
    solved: number;
    attempts: number;
    completionRate: number | null;
    sampleSize: number;
  }>;
  activitySeries: Array<{
    date: string;
    submissions: number;
    solved: number;
  }>;
  problemStates: {
    attemptedProblemKeys: string[];
    solvedProblemKeys: string[];
    unfinishedProblemKeys: string[];
    wrongBookProblemKeys: string[];
  };
  dataQuality: {
    truncated: boolean;
    submissionCount: number;
    oldestFetchedAt: string | null;
    confidence: "high" | "medium" | "low";
    warnings: string[];
  };
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Build a Codeforces user analysis snapshot for future AI Agent consumption.
 *
 * - Validates that requestorUserId matches the account owner
 * - Performs all computations server-side, read-only
 * - Returns structured, safe data without raw responses, source code, or secrets
 *
 * @param accountId - The CodeforcesAccount.id
 * @param requestorUserId - The userId of the caller (must match account owner)
 * @param repository - CodeforcesAccountRepository instance
 * @param wrongBookProblemKeys - Optional: pre-fetched problem keys from the user's wrong book
 */
export async function getCodeforcesUserAnalysisSnapshot(
  accountId: string,
  requestorUserId: string,
  repository: CodeforcesAccountRepository,
  wrongBookProblemKeys?: string[],
): Promise<CodeforcesUserAnalysisSnapshot | null> {
  // Validate ownership
  const account = await repository.getAccountByUserId(requestorUserId);
  if (!account || account.id !== accountId) {
    return null;
  }

  // Fetch all data in parallel
  const [stats, problemStats, ratingHistory, accountStats] = await Promise.all([
    // These are already fetched above — reuse where possible
    repository.getProblemStatsByAccount(accountId),
    repository.getProblemStatsByAccount(accountId),
    repository.getRatingHistory(accountId),
    repository.getAccountStats(accountId),
  ]);

  const problemStats_ = stats; // single source

  // Compute derived statistics
  const solvedKeys = problemStats_.filter((s) => s.accepted).map((s) => s.problemKey);
  const attemptedKeys = problemStats_.map((s) => s.problemKey);
  const unfinishedKeys = problemStats_.filter((s) => !s.accepted).map((s) => s.problemKey);

  const warnings: string[] = [];
  if (account.dataTruncated) {
    warnings.push("Submission data was truncated — stats may be incomplete");
  }
  if (accountStats.totalSubmissions < 5) {
    warnings.push("Very few submissions — statistics may not be reliable");
  }

  let confidence: "high" | "medium" | "low" = "high";
  if (account.dataTruncated || accountStats.totalSubmissions < 20) {
    confidence = "medium";
  }
  if (accountStats.totalSubmissions < 5) {
    confidence = "low";
  }

  return {
    profile: {
      handle: account.canonicalHandle,
      currentRating: account.currentRating,
      maxRating: account.maxRating,
      rank: account.rank,
      maxRank: account.maxRank,
      lastOnlineAt: account.lastOnlineAt?.toISOString() ?? null,
      lastSubmissionAt: accountStats.lastSubmissionAt?.toISOString() ?? null,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? new Date().toISOString(),
    },
    totals: {
      submissions: accountStats.totalSubmissions,
      acceptedSubmissions: accountStats.acceptedSubmissions,
      attemptedProblems: accountStats.attemptedProblems,
      solvedProblems: accountStats.solvedProblems,
      unfinishedProblems: accountStats.unfinishedProblems,
    },
    ratingHistory: ratingHistory.map((r) => ({
      contestId: r.contestId,
      contestName: r.contestName,
      rank: r.rank,
      oldRating: r.oldRating,
      newRating: r.newRating,
      ratingUpdateAt: r.ratingUpdateAt.toISOString(),
    })),
    verdictStats: Object.entries(accountStats.verdictCounts)
      .map(([verdict, count]) => ({ verdict, count }))
      .sort((a, b) => b.count - a.count),
    ratingBucketStats: computeRatingBuckets(problemStats_),
    tagStats: computeTagStats(problemStats_),
    activitySeries: computeActivitySeries(problemStats_),
    problemStates: {
      attemptedProblemKeys: attemptedKeys,
      solvedProblemKeys: solvedKeys,
      unfinishedProblemKeys: unfinishedKeys,
      wrongBookProblemKeys: wrongBookProblemKeys ?? [],
    },
    dataQuality: {
      truncated: account.dataTruncated,
      submissionCount: accountStats.totalSubmissions,
      oldestFetchedAt: account.lastSyncedAt?.toISOString() ?? null,
      confidence,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Statistical computations
// ---------------------------------------------------------------------------

const RATING_BUCKETS = [
  { label: "800-999", min: 800, max: 999 },
  { label: "1000-1199", min: 1000, max: 1199 },
  { label: "1200-1399", min: 1200, max: 1399 },
  { label: "1400-1599", min: 1400, max: 1599 },
  { label: "1600-1799", min: 1600, max: 1799 },
  { label: "1800-1999", min: 1800, max: 1999 },
  { label: "2000+", min: 2000, max: 9999 },
  { label: "未定级", min: -1, max: -1 },
];

function computeRatingBuckets(
  stats: CodeforcesUserProblemStatRecord[],
): Array<{ bucket: string; attempted: number; solved: number }> {
  return RATING_BUCKETS.map((bucket) => {
    const inBucket =
      bucket.label === "未定级"
        ? stats.filter((s) => s.rating === null || s.rating === 0)
        : stats.filter((s) => s.rating !== null && s.rating >= bucket.min && s.rating <= bucket.max);

    return {
      bucket: bucket.label,
      attempted: inBucket.length,
      solved: inBucket.filter((s) => s.accepted).length,
    };
  });
}

function computeTagStats(
  stats: CodeforcesUserProblemStatRecord[],
): Array<{
  tag: string;
  attempted: number;
  solved: number;
  attempts: number;
  completionRate: number | null;
  sampleSize: number;
}> {
  const tagMap = new Map<string, { attempted: number; solved: number; attempts: number }>();

  for (const stat of stats) {
    for (const tag of stat.tags) {
      const entry = tagMap.get(tag) ?? { attempted: 0, solved: 0, attempts: 0 };
      entry.attempted += 1;
      entry.attempts += stat.attempts;
      if (stat.accepted) {
        entry.solved += 1;
      }
      tagMap.set(tag, entry);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      attempted: data.attempted,
      solved: data.solved,
      attempts: data.attempts,
      completionRate: data.attempted > 0 ? data.solved / data.attempted : null,
      sampleSize: data.attempted,
    }))
    .sort((a, b) => b.attempted - a.attempted)
    .slice(0, 30); // Top 30 tags
}

function computeActivitySeries(
  stats: CodeforcesUserProblemStatRecord[],
): Array<{ date: string; submissions: number; solved: number }> {
  // Build daily activity from problem stats
  const dayMap = new Map<string, { submissions: number; solved: number }>();

  for (const stat of stats) {
    if (!stat.lastSubmittedAt) continue;
    const day = stat.lastSubmittedAt.toISOString().slice(0, 10);
    const entry = dayMap.get(day) ?? { submissions: 0, solved: 0 };
    entry.submissions += stat.attempts;
    if (stat.accepted) entry.solved += 1;
    dayMap.set(day, entry);
  }

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, submissions: data.submissions, solved: data.solved }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90); // Last 90 days
}

// ---------------------------------------------------------------------------
// Weak tag analysis (deterministic, no LLM)
// ---------------------------------------------------------------------------

export interface WeakTagCandidate {
  tag: string;
  completionRate: number | null;
  attempts: number;
  attempted: number;
  solved: number;
  avgRating: number;
  dataQuality: "sufficient" | "limited" | "insufficient";
}

export function computeWeakTagCandidates(
  stats: CodeforcesUserProblemStatRecord[],
  minSampleSize: number = 5,
): WeakTagCandidate[] {
  const tagStats = computeTagStats(stats);
  const tagRatingMap = new Map<string, number[]>();

  for (const stat of stats) {
    if (stat.rating === null || stat.rating === 0) continue;
    for (const tag of stat.tags) {
      const ratings = tagRatingMap.get(tag) ?? [];
      ratings.push(stat.rating);
      tagRatingMap.set(tag, ratings);
    }
  }

  return tagStats
    .filter((t) => t.attempted > 0)
    .map((t) => {
      const ratings = tagRatingMap.get(t.tag) ?? [];
      const avgRating = ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
        : 0;
      const dataQuality: WeakTagCandidate["dataQuality"] =
        t.attempted >= minSampleSize ? "sufficient" :
        t.attempted >= 3 ? "limited" :
        "insufficient";
      return {
        tag: t.tag,
        completionRate: t.completionRate,
        attempts: t.attempts,
        attempted: t.attempted,
        solved: t.solved,
        avgRating,
        dataQuality,
      };
    })
    .sort((a, b) => {
      // Sort by completion rate (ascending), but weight by sample size
      const aRate = a.completionRate ?? 1;
      const bRate = b.completionRate ?? 1;
      // Prefer tags with sufficient data and low completion rate
      const aScore = (aRate) * (a.dataQuality === "sufficient" ? 1 : a.dataQuality === "limited" ? 0.5 : 0.1);
      const bScore = (bRate) * (b.dataQuality === "sufficient" ? 1 : b.dataQuality === "limited" ? 0.5 : 0.1);
      return aScore - bScore;
    });
}
