// ============================================================
// A488 v2 — Codeforces Learning Analysis (Deterministic, No LLM)
// ============================================================
// Rewritten with effective rating detection, rating gap warning,
// and meaningful three-tier difficulty planning.
//
// @module cf-learning-analysis
// @serverOnly

export interface CodeforcesUserAnalysisSnapshot {
  profile: {
    handle: string;
    currentRating: number | null;
    maxRating: number | null;
    lastSubmissionAt: string | null;
  };
  ratingHistory: ReadonlyArray<{
    oldRating: number;
    newRating: number;
  }>;
  ratingBucketStats: ReadonlyArray<{
    bucket: string;
    attempted: number;
    solved: number;
  }>;
  activitySeries: ReadonlyArray<{
    date: string;
    submissions: number;
    solved: number;
  }>;
  tagStats: ReadonlyArray<{
    tag: string;
    attempted: number;
    solved: number;
    attempts: number;
    completionRate: number | null;
  }>;
  dataQuality: {
    confidence: "high" | "medium" | "low";
    truncated: boolean;
    warnings: readonly string[];
  };
  problemStates: {
    solvedProblemKeys: readonly string[];
    attemptedProblemKeys: readonly string[];
    unfinishedProblemKeys: readonly string[];
  };
}

// ---------------------------------------------------------------------------
// Report type (stable output contract)
// ---------------------------------------------------------------------------

export interface CfLearningAgentReport {
  readonly generatedAt: string;
  readonly profileSummary: {
    readonly handle: string;
    readonly currentRating: number | null;
    readonly maxRating: number | null;
    readonly effectiveRating: number;
    readonly recentActivityStatus: string;
  };
  readonly activity: {
    readonly daysSinceLastSubmission: number | null;
    readonly submissionsLast7Days: number;
    readonly submissionsLast30Days: number;
    readonly solvedLast30Days: number;
    readonly reminderLevel: "none" | "light" | "strong" | "restart";
  };
  readonly progress: {
    readonly attemptedProblems: number;
    readonly solvedProblems: number;
    readonly unfinishedProblems: number;
    readonly ratingTrend: "up" | "stable" | "down" | "insufficient";
  };
  readonly weakTags: ReadonlyArray<{
    readonly tag: string;
    readonly attempted: number;
    readonly solved: number;
    readonly completionRate: number | null;
    readonly evidenceLevel: "high" | "medium" | "low";
    readonly reasonCodes: readonly string[];
  }>;
  readonly ratingPlan: {
    readonly warmup: [number, number] | null;
    readonly training: [number, number] | null;
    readonly challenge: [number, number] | null;
  };
  readonly recommendations: ReadonlyArray<{
    readonly problemKey: string;
    readonly name: string;
    readonly rating: number;
    readonly tags: readonly string[];
    readonly originalUrl: string;
    readonly recommendationType: "warmup" | "weak_tag" | "challenge" | "unfinished_review";
    readonly reasonCodes: readonly string[];
  }>;
  readonly dataQuality: {
    readonly confidence: "high" | "medium" | "low";
    readonly truncated: boolean;
    readonly warnings: readonly string[];
  };
  readonly ratingGap?: {
    readonly cfRating: number;
    readonly recentAvgRating: number;
    readonly gap: number;
    readonly suggestion: string;
  };
}

// ---------------------------------------------------------------------------
// Effective rating: the higher of CF rating and recent problem rating average
// ---------------------------------------------------------------------------

export function computeEffectiveRating(snapshot: CodeforcesUserAnalysisSnapshot): {
  effectiveRating: number;
  cfRating: number | null;
  recentAvgRating: number | null;
  ratingGap: number;
  recentProblemCount: number;
  solvedHighCount: number;
  solvedHighAvg: number | null;
} {
  const cfRating = snapshot.profile.currentRating;

  let recentAvgRating: number | null = null;
  let recentCount = 0;
  let solvedHighCount = 0;
  let solvedHighSum = 0;

  // Contest-based signal (recent rating history)
  const ratingHistory = snapshot.ratingHistory;
  if (ratingHistory.length > 0) {
    const recentContests = ratingHistory.slice(-5);
    const avgNewRating = recentContests.reduce((s, r) => s + r.newRating, 0) / recentContests.length;
    if (avgNewRating > 0) {
      recentAvgRating = Math.round(avgNewRating);
      recentCount = recentContests.length;
    }
  }

  // Problem-level signal: use SOLVED count as weight (not attempted)
  // Completed problems are a stronger signal of current ability
  const buckets = snapshot.ratingBucketStats;
  let bucketSolvedWeightedSum = 0;
  let bucketSolvedCount = 0;
  let bucketAttemptedWeightedSum = 0;
  let bucketAttemptedCount = 0;

  for (const b of buckets) {
    if (b.bucket === "未定级") continue;

    let midRating: number | null = null;
    if (b.bucket === "2000+") midRating = 2200;
    else {
      const parts = b.bucket.split("-");
      if (parts.length === 2) {
        midRating = (Number(parts[0]) + Number(parts[1])) / 2;
      }
    }
    if (midRating === null) continue;

    // Solved-weighted (stronger signal)
    if (b.solved > 0) {
      bucketSolvedWeightedSum += midRating * b.solved;
      bucketSolvedCount += b.solved;
    }

    // Attempted-weighted (fallback)
    if (b.attempted > 0) {
      bucketAttemptedWeightedSum += midRating * b.attempted;
      bucketAttemptedCount += b.attempted;
    }

    // Track "high rating" solves: problems rated cfRating + 200 or more above CF rating
    if (cfRating !== null && midRating > cfRating + 200 && b.solved > 0) {
      solvedHighCount += b.solved;
      solvedHighSum += midRating * b.solved;
    }
  }

  const solvedHighAvg = solvedHighCount > 0
    ? Math.round(solvedHighSum / solvedHighCount)
    : null;

  // Primary: solved-weighted average. Fallback: attempted-weighted.
  let avgFromBuckets: number | null = null;
  if (bucketSolvedCount >= 3) {
    avgFromBuckets = Math.round(bucketSolvedWeightedSum / bucketSolvedCount);
  } else if (bucketAttemptedCount > 0) {
    avgFromBuckets = Math.round(bucketAttemptedWeightedSum / bucketAttemptedCount);
  }

  // Blend
  if (avgFromBuckets !== null) {
    if (recentAvgRating === null) {
      recentAvgRating = avgFromBuckets;
      recentCount = bucketSolvedCount;
    } else {
      // 40% contest + 60% buckets (buckets are more representative of daily practice)
      recentAvgRating = Math.round(recentAvgRating * 0.4 + avgFromBuckets * 0.6);
    }
  }

  // Effective rating = max(CF rating, recent average)
  const effectiveRating = Math.max(
    cfRating ?? 800,
    recentAvgRating ?? cfRating ?? 800,
  );

  const ratingGap = (recentAvgRating !== null && cfRating !== null)
    ? recentAvgRating - cfRating
    : 0;

  return {
    effectiveRating: Math.max(800, effectiveRating),
    cfRating,
    recentAvgRating,
    ratingGap,
    recentProblemCount: recentCount,
    solvedHighCount,
    solvedHighAvg,
  };
}

// ---------------------------------------------------------------------------
// Activity analysis
// ---------------------------------------------------------------------------

export interface ActivityAnalysis {
  daysSinceLastSubmission: number | null;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  solvedLast30Days: number;
  reminderLevel: "none" | "light" | "strong" | "restart";
}

export function analyzeActivity(
  snapshot: CodeforcesUserAnalysisSnapshot,
): ActivityAnalysis {
  const now = Date.now();
  const lastSub = snapshot.profile.lastSubmissionAt
    ? new Date(snapshot.profile.lastSubmissionAt).getTime()
    : null;

  const daysSinceLastSubmission = lastSub !== null
    ? Math.floor((now - lastSub) / 86_400_000)
    : null;

  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);

  let submissionsLast7Days = 0;
  let submissionsLast30Days = 0;
  let solvedLast30Days = 0;

  for (const day of snapshot.activitySeries) {
    if (day.date >= thirtyDaysAgo) {
      submissionsLast30Days += day.submissions;
      solvedLast30Days += day.solved;
      if (day.date >= sevenDaysAgo) {
        submissionsLast7Days += day.submissions;
      }
    }
  }

  let reminderLevel: "none" | "light" | "strong" | "restart";
  if (daysSinceLastSubmission === null) {
    reminderLevel = "restart";
  } else if (daysSinceLastSubmission <= 6) {
    reminderLevel = "none";
  } else if (daysSinceLastSubmission <= 13) {
    reminderLevel = "light";
  } else if (daysSinceLastSubmission <= 29) {
    reminderLevel = "strong";
  } else {
    reminderLevel = "restart";
  }

  return { daysSinceLastSubmission, submissionsLast7Days, submissionsLast30Days, solvedLast30Days, reminderLevel };
}

// ---------------------------------------------------------------------------
// Rating trend analysis
// ---------------------------------------------------------------------------

export type RatingTrend = "up" | "stable" | "down" | "insufficient";

export function analyzeRatingTrend(
  snapshot: CodeforcesUserAnalysisSnapshot,
): RatingTrend {
  const history = snapshot.ratingHistory;
  if (history.length < 2) return "insufficient";

  const recent = history.slice(-Math.min(5, history.length));
  let increases = 0;
  let decreases = 0;
  let totalChange = 0;

  for (const entry of recent) {
    const delta = entry.newRating - entry.oldRating;
    totalChange += delta;
    if (delta > 0) increases++;
    else if (delta < 0) decreases++;
  }

  if (increases === 0 && decreases === 0) return "stable";
  if (totalChange > 50 && increases >= decreases) return "up";
  if (totalChange < -50 && decreases >= increases) return "down";
  if (Math.abs(totalChange) <= 50) return "stable";
  if (totalChange > 0) return "up";
  return "down";
}

// ---------------------------------------------------------------------------
// Weak tag analysis
// ---------------------------------------------------------------------------

export interface WeakTagResult {
  tag: string;
  attempted: number;
  solved: number;
  completionRate: number | null;
  attempts: number;
  evidenceLevel: "high" | "medium" | "low";
  reasonCodes: string[];
  avgRating?: number;
}

export function selectWeakTags(
  snapshot: CodeforcesUserAnalysisSnapshot,
  maxTags: number = 3,
): WeakTagResult[] {
  const { tagStats } = snapshot;

  // Compute average rating per tag
  const tagRatingMap = new Map<string, number[]>();
  // We approximate from tagStats since we don't have per-problem rating in tagStats
  // Use the overall rating distribution to estimate

  const candidates = tagStats
    .filter((t) => t.attempted > 0)
    .map((t) => {
      const reasonCodes: string[] = [];
      if (t.completionRate !== null && t.completionRate < 0.5) {
        reasonCodes.push("low_completion_rate");
      }
      if (t.attempted >= 5 && t.solved <= 2) {
        reasonCodes.push("high_attempts_low_solves");
      }
      if (t.attempts > t.attempted * 2) {
        reasonCodes.push("multiple_attempts_per_problem");
      }

      let evidenceLevel: "high" | "medium" | "low";
      if (t.attempted >= 10) {
        evidenceLevel = "high";
      } else if (t.attempted >= 5) {
        evidenceLevel = "medium";
      } else {
        evidenceLevel = "low";
      }

      return {
        tag: t.tag,
        attempted: t.attempted,
        solved: t.solved,
        completionRate: t.completionRate,
        attempts: t.attempts,
        evidenceLevel,
        reasonCodes,
      };
    })
    // Score: lower completion rate = more urgent, weighted by evidence
    .sort((a, b) => {
      const scoreA = (a.completionRate ?? 1) *
        (a.evidenceLevel === "high" ? 1.2 : a.evidenceLevel === "medium" ? 1.0 : 0.6);
      const scoreB = (b.completionRate ?? 1) *
        (b.evidenceLevel === "high" ? 1.2 : b.evidenceLevel === "medium" ? 1.0 : 0.6);
      return scoreA - scoreB;
    })
    .slice(0, maxTags);

  if (candidates.length === 0) {
    return tagStats
      .filter((t) => t.attempted > 0)
      .sort((a, b) => (a.completionRate ?? 1) - (b.completionRate ?? 1))
      .slice(0, maxTags)
      .map((t) => ({
        tag: t.tag, attempted: t.attempted, solved: t.solved,
        completionRate: t.completionRate, attempts: t.attempts,
        evidenceLevel: "low" as const,
        reasonCodes: ["low_completion_rate"],
      }));
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Rating plan — rewritten with effective rating
// ---------------------------------------------------------------------------

export interface RatingPlan {
  warmup: [number, number] | null;
  training: [number, number] | null;
  challenge: [number, number] | null;
}

const MIN_POOL_RATING = 800;
const MAX_POOL_RATING = 3500;

export function computeRatingPlan(
  snapshot: CodeforcesUserAnalysisSnapshot,
  weakTags: WeakTagResult[],
  targetRating?: number | null,
): RatingPlan {
  const { effectiveRating, ratingGap } = computeEffectiveRating(snapshot);

  // Base: use the higher of effective rating and user's target
  const baseRating = Math.max(effectiveRating, targetRating ?? 0);

  // Warmup: 100-250 below base, but not below 800
  // For users with large rating gap, warmup should be closer to CF rating
  const warmupCenter = ratingGap > 200
    ? Math.max(800, (snapshot.profile.currentRating ?? baseRating) - 50)
    : Math.max(800, baseRating - 200);
  const warmup: [number, number] = [
    clampToPool(warmupCenter - 100),
    clampToPool(warmupCenter + 50),
  ];

  // Training: centered at base rating, wider range
  const training: [number, number] = [
    clampToPool(baseRating - 100),
    clampToPool(baseRating + 100),
  ];

  // Challenge: 100-300 above base
  const challenge: [number, number] = [
    clampToPool(baseRating + 100),
    clampToPool(Math.min(MAX_POOL_RATING, baseRating + 300)),
  ];

  // Ensure non-overlapping: warmup < training < challenge
  // Actually they CAN overlap slightly, that's fine

  return { warmup, training, challenge };
}

function clampToPool(value: number): number {
  return Math.max(MIN_POOL_RATING, Math.min(MAX_POOL_RATING, value));
}

// ---------------------------------------------------------------------------
// Rating gap detection
// ---------------------------------------------------------------------------

export interface RatingGapInfo {
  cfRating: number;
  recentAvgRating: number;
  gap: number;
  suggestion: string;
}

export function detectRatingGap(
  snapshot: CodeforcesUserAnalysisSnapshot,
): RatingGapInfo | null {
  const { cfRating, recentAvgRating, ratingGap, solvedHighCount, solvedHighAvg } = computeEffectiveRating(snapshot);

  if (cfRating === null || recentAvgRating === null) return null;

  // Detect gap: either ratingGap >= 80 OR user has solved 3+ problems 200+ above CF rating
  const hasHighSolves = solvedHighCount >= 3 && solvedHighAvg !== null && solvedHighAvg > cfRating + 150;
  const hasMeaningfulGap = ratingGap >= 80 || hasHighSolves;

  if (!hasMeaningfulGap) return null;

  const displayGap = Math.max(ratingGap, hasHighSolves ? solvedHighAvg! - cfRating : 0);

  if (displayGap >= 300) {
    return {
      cfRating,
      recentAvgRating: Math.max(recentAvgRating, solvedHighAvg ?? 0),
      gap: displayGap,
      suggestion: `你最近练习的题目难度（平均 ${Math.max(recentAvgRating, solvedHighAvg ?? 0)}）远高于当前 CF Rating（${cfRating}），差距 ${displayGap}。强烈建议参加最近的 Codeforces 比赛更新 Rating，以便获得更精准的题目推荐。`,
    };
  }

  return {
    cfRating,
    recentAvgRating: Math.max(recentAvgRating, solvedHighAvg ?? 0),
    gap: displayGap,
    suggestion: `你的练习水平（约 ${Math.max(recentAvgRating, solvedHighAvg ?? 0)}）已经明显高于当前 CF Rating（${cfRating}）。参加一场 Codeforces 比赛同步真实水平，系统会给你更精准的题单。`,
  };
}

// ---------------------------------------------------------------------------
// Profile summary
// ---------------------------------------------------------------------------

export function buildProfileSummary(snapshot: CodeforcesUserAnalysisSnapshot) {
  const { effectiveRating } = computeEffectiveRating(snapshot);
  return {
    handle: snapshot.profile.handle,
    currentRating: snapshot.profile.currentRating,
    maxRating: snapshot.profile.maxRating,
    effectiveRating,
    recentActivityStatus: snapshot.profile.lastSubmissionAt ? "active" : "no_recent_activity",
  };
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export function buildDataQuality(snapshot: CodeforcesUserAnalysisSnapshot) {
  return {
    confidence: snapshot.dataQuality.confidence,
    truncated: snapshot.dataQuality.truncated,
    warnings: snapshot.dataQuality.warnings,
  };
}

// ---------------------------------------------------------------------------
// Full analysis pipeline
// ---------------------------------------------------------------------------

export function analyzeCodeforcesLearningProfile(
  snapshot: CodeforcesUserAnalysisSnapshot,
  targetRating?: number | null,
): {
  activity: ActivityAnalysis;
  ratingTrend: RatingTrend;
  weakTags: WeakTagResult[];
  ratingPlan: RatingPlan;
  profileSummary: ReturnType<typeof buildProfileSummary>;
  dataQuality: ReturnType<typeof buildDataQuality>;
  solvedProblemKeys: readonly string[];
  attemptedProblemKeys: readonly string[];
  unfinishedProblemKeys: readonly string[];
  ratingGap: RatingGapInfo | null;
  effectiveRating: number;
} {
  const activity = analyzeActivity(snapshot);
  const ratingTrend = analyzeRatingTrend(snapshot);
  const weakTags = selectWeakTags(snapshot);
  const ratingPlan = computeRatingPlan(snapshot, weakTags, targetRating);
  const profileSummary = buildProfileSummary(snapshot);
  const dataQuality = buildDataQuality(snapshot);
  const ratingGap = detectRatingGap(snapshot);
  const { effectiveRating } = computeEffectiveRating(snapshot);

  return {
    activity, ratingTrend, weakTags, ratingPlan,
    profileSummary, dataQuality, ratingGap, effectiveRating,
    solvedProblemKeys: snapshot.problemStates.solvedProblemKeys,
    attemptedProblemKeys: snapshot.problemStates.attemptedProblemKeys,
    unfinishedProblemKeys: snapshot.problemStates.unfinishedProblemKeys,
  };
}
