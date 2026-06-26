// ============================================================
// A489 v3 — Unified Codeforces Rating Estimation
// ============================================================
// Single source of truth for estimated CF rating.
// Used by: learning analysis, review plan, contest recommendation.
//
// Pure functions — no DB, no API, no LLM.
// @module cf-rating-estimator
// @serverOnly

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CfProblemStat {
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  attempts: number;
  accepted: boolean;
  /** ISO timestamp of first AC */
  firstAcceptedAt: string | null;
  /** ISO timestamp of last submission */
  lastSubmittedAt: string | null;
  lastVerdict: string | null;
}

export interface UserRatingInput {
  currentRating: number | null;
  maxRating: number | null;
  ratingHistory: Array<{
    contestId: number;
    contestName: string;
    newRating: number;
    oldRating: number;
    ratingUpdateAt: string;
  }>;
  problemStats: CfProblemStat[];
  lastOnlineAt: string | null;
}

// ---------------------------------------------------------------------------
// Output type (stable contract)
// ---------------------------------------------------------------------------

export interface RatingEstimate {
  estimatedRating: number;
  currentRating: number;
  maxRating: number;
  ratingDelta: number;
  confidence: number;      // [0, 1]
  modelType: "rated" | "unrated";
  historyAnchor: number | null;
  practiceSignal: number;
  trendBonus: number;
  inactivityDecay: number;
  ratedSolvedCount: number;
  recentRatedSolvedCount: number;
  evidence: {
    p65: number | null;
    p80: number | null;
    p95: number | null;
    hardSolveCount: number;
    tagBreadth: number;
    lastMeaningfulActivity: number | null;
  };
  explanationItems: string[];
}

// ===========================================================================
// Constants
// ===========================================================================

const DAY_MS = 86_400_000;
const RECENT_LIMIT = 200;   // max recent AC problems for practice signal
const TREND_RECENT = 50;    // recent N for trend calculation
const TREND_PREVIOUS = 100; // previous N for trend base

// ===========================================================================
// Helpers
// ===========================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
}

export function weightedPercentile(values: number[], weights: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  // Sort by values, keeping weights aligned
  const pairs = values.map((v, i) => ({ v, w: weights[i] }));
  pairs.sort((a, b) => a.v - b.v);

  const totalWeight = pairs.reduce((s, x) => s + x.w, 0);
  if (totalWeight === 0) return percentile(values, p);

  const target = (p / 100) * totalWeight;
  let cum = 0;
  for (let i = 0; i < pairs.length; i++) {
    cum += pairs[i].w;
    if (cum >= target) {
      if (cum === target || i === pairs.length - 1) return pairs[i].v;
      // Linear interpolation between i and i+1
      const prevCum = cum - pairs[i].w;
      const frac = (target - prevCum) / pairs[i].w;
      return pairs[i].v * (1 - frac) + pairs[i + 1].v * frac;
    }
  }
  return pairs[pairs.length - 1].v;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Round to nearest 25 for rating stability */
function roundRating(r: number): number {
  return Math.round(r / 25) * 25;
}

// ===========================================================================
// Data preparation
// ===========================================================================

/** Compute recency weight and attempt weight for each AC problem */
export function computeWeights(stats: CfProblemStat[]): Map<string, { rating: number; weight: number }> {
  const now = Date.now();
  const result = new Map<string, { rating: number; weight: number }>();

  for (const s of stats) {
    if (!s.accepted || s.rating == null || s.rating <= 0) continue;
    if (!s.firstAcceptedAt) continue;

    const daysSince = Math.max(0, (now - new Date(s.firstAcceptedAt).getTime()) / DAY_MS);
    const recencyWeight = 0.35 + 0.65 * Math.exp(-daysSince / 180);

    let attemptWeight = 1.0;
    const wa = Math.max(0, s.attempts - 1); // attempts minus the AC itself
    if (wa === 0) attemptWeight = 1.0;
    else if (wa === 1) attemptWeight = 0.95;
    else if (wa <= 3) attemptWeight = 0.85;
    else attemptWeight = 0.72;

    result.set(s.problemKey, { rating: s.rating, weight: recencyWeight * attemptWeight });
  }
  return result;
}

/** Build sorted list of unique AC problem ratings */
function getAcRatings(problemStats: CfProblemStat[]): number[] {
  return problemStats
    .filter((s) => s.accepted && s.rating != null && s.rating > 0)
    .map((s) => s.rating as number)
    .sort((a, b) => a - b);
}

/** Get last contest time from rating history */
function getLastContestTime(
  ratingHistory: UserRatingInput["ratingHistory"],
): number | null {
  if (ratingHistory.length === 0) return null;
  const last = ratingHistory[ratingHistory.length - 1];
  return new Date(last.ratingUpdateAt).getTime();
}

/** Get last meaningful AC time */
function getLastAcTime(problemStats: CfProblemStat[]): number | null {
  let latest = 0;
  for (const s of problemStats) {
    if (!s.accepted || !s.firstAcceptedAt) continue;
    const ts = new Date(s.firstAcceptedAt).getTime();
    if (ts > latest) latest = ts;
  }
  return latest > 0 ? latest : null;
}

/** Compute last meaningful activity as max(last contest, last AC) */
function getLastMeaningfulActivity(
  ratingHistory: UserRatingInput["ratingHistory"],
  problemStats: CfProblemStat[],
): number | null {
  const contest = getLastContestTime(ratingHistory);
  const ac = getLastAcTime(problemStats);
  if (!contest && !ac) return null;
  return Math.max(contest ?? 0, ac ?? 0);
}

// ===========================================================================
// Practice signal — weighted percentile model
// ===========================================================================

export function computePracticeSignal(
  problemStats: CfProblemStat[],
  recentLimit: number,
): { signal: number; count: number; p65: number | null; p80: number | null; p95: number | null } {
  const weights = computeWeights(problemStats);

  // Take most recent N (by firstAcceptedAt)
  const entries = Array.from(weights.entries())
    .map(([key, data]) => ({ key, ...data }));

  // Sort by weight (proxy for recency — higher weight = more recent)
  entries.sort((a, b) => b.weight - a.weight);

  const recent = entries.slice(0, recentLimit);
  const ratings = recent.map((e) => e.rating).sort((a, b) => a - b);
  const w = recent.map((e) => e.weight);

  const n = ratings.length;
  if (n === 0) return { signal: 800, count: 0, p65: null, p80: null, p95: null };

  const p65 = weightedPercentile(ratings, w, 65);
  const p80 = weightedPercentile(ratings, w, 80);
  const p95 = n >= 10 ? weightedPercentile(ratings, w, 95) : null;

  // Practice signal formula
  let signal: number;
  if (n >= 20) {
    signal = Math.max(p65 + 100, p80 + 25, (p95 ?? p80 + 150) - 125);
  } else if (n >= 10) {
    // No P95, use Max-200
    const maxR = ratings[ratings.length - 1];
    signal = Math.max(p65 + 100, p80 + 25, maxR - 200);
  } else {
    // Very few data points
    signal = Math.max(p65 + 100, p80 + 25);
  }

  return { signal: Math.round(signal), count: n, p65, p80, p95 };
}

// ===========================================================================
// Confidence calculation
// ===========================================================================

export function computeConfidence(
  recentRatedSolvedCount: number,
  practiceSignal: number,
  problemStats: CfProblemStat[],
  acRatings: number[],
  lastMeaningfulActivity: number | null,
): number {
  const now = Date.now();

  // Volume score
  const volumeScore = Math.min(1, recentRatedSolvedCount / 80);

  // Consistency: hard solves near or above practice signal
  const hardThreshold = practiceSignal - 100;
  const hardSolveCount = acRatings.filter((r) => r >= hardThreshold).length;
  const consistencyScore = Math.min(1, hardSolveCount / 15);

  // Recency score
  let recentnessScore = 0.5;
  if (lastMeaningfulActivity) {
    const days = (now - lastMeaningfulActivity) / DAY_MS;
    if (days <= 7) recentnessScore = 1.0;
    else if (days <= 30) recentnessScore = 0.8;
    else if (days <= 90) recentnessScore = 0.5;
    else recentnessScore = 0.2;
  }

  // Tag breadth
  const tagSet = new Set<string>();
  for (const s of problemStats) {
    if (!s.accepted || s.attempts < 3) continue;
    for (const t of s.tags) tagSet.add(t);
  }
  const breadthScore = Math.min(1, tagSet.size / 8);

  return clamp(
    0.15 + 0.35 * volumeScore + 0.25 * consistencyScore + 0.15 * recentnessScore + 0.10 * breadthScore,
    0.15, 0.95,
  );
}

// ===========================================================================
// Trend bonus
// ===========================================================================

function computeTrendBonus(
  problemStats: CfProblemStat[],
): number {
  // Compare recent 50 vs previous 100
  const weights = computeWeights(problemStats);
  const entries = Array.from(weights.entries())
    .map(([key, data]) => ({ key, ...data }));

  // Sort by recency (higher weight first)
  entries.sort((a, b) => b.weight - a.weight);

  const recent50 = entries.slice(0, TREND_RECENT);
  const previous100 = entries.slice(TREND_RECENT, TREND_RECENT + TREND_PREVIOUS);

  if (recent50.length < 20) return 0; // not enough recent data

  const recentRatings = recent50.map((e) => e.rating).sort((a, b) => a - b);
  const recentW = recent50.map((e) => e.weight);
  const recentSignal = recentRatings.length > 0
    ? weightedPercentile(recentRatings, recentW, 80)
    : 0;

  const prevRatings = previous100.map((e) => e.rating).sort((a, b) => a - b);
  const prevW = previous100.map((e) => e.weight);
  const prevSignal = prevRatings.length > 0
    ? weightedPercentile(prevRatings, prevW, 80)
    : 0;

  const gap = recentSignal - prevSignal;
  if (gap <= 50) return 0;
  return Math.min(75, Math.round((gap - 50) * 0.3));
}

// ===========================================================================
// History anchor adjustment
// ===========================================================================

function computeHistoryAnchor(
  currentRating: number,
  maxRating: number,
  ratingHistory: UserRatingInput["ratingHistory"],
): number {
  if (ratingHistory.length === 0) return Math.max(currentRating, maxRating);

  const lastContest = ratingHistory[ratingHistory.length - 1];
  const maxContest = ratingHistory.reduce((max, r) => Math.max(max, r.newRating), 0);

  // Find when max was achieved
  let peakIdx = -1;
  for (let i = ratingHistory.length - 1; i >= 0; i--) {
    if (ratingHistory[i].newRating === maxContest) {
      peakIdx = i; break;
    }
  }

  if (peakIdx < 0) return Math.max(currentRating, maxRating);

  const peakDate = new Date(ratingHistory[peakIdx].ratingUpdateAt).getTime();
  const yearsSincePeak = (Date.now() - peakDate) / (365 * DAY_MS);

  // Only adjust if peak is > 2 years old and user has 8+ contests since peak
  const contestsAfterPeak = ratingHistory.length - peakIdx - 1;

  if (yearsSincePeak > 2 && contestsAfterPeak >= 8) {
    // Calculate average rating in last 8 contests
    const recent8 = ratingHistory.slice(-8);
    const avgRecent = recent8.reduce((s, r) => s + r.newRating, 0) / recent8.length;

    // If max is significantly above recent average, apply adjustment
    const excess = maxRating - avgRecent;
    if (excess > 100) {
      const adjustment = Math.min(100, Math.round(excess * 0.5));
      return Math.max(currentRating, maxRating - adjustment);
    }
  }

  return Math.max(currentRating, maxRating);
}

// ===========================================================================
// Case 1: Rated — user has contest history
// ===========================================================================

function estimateRated(input: UserRatingInput): RatingEstimate {
  const { currentRating: cr, maxRating: mr, ratingHistory, problemStats } = input;
  const currentRating = cr ?? 0;
  const maxRating = mr ?? currentRating;
  const acRatings = getAcRatings(problemStats);
  const lastMeaningfulActivity = getLastMeaningfulActivity(ratingHistory, problemStats);

  // History anchor
  const historyAnchor = computeHistoryAnchor(currentRating, maxRating, ratingHistory);

  // Practice signal from recent 200 AC problems
  const practice = computePracticeSignal(problemStats, RECENT_LIMIT);

  // Confidence
  const confidence = computeConfidence(
    practice.count, practice.signal, problemStats, acRatings, lastMeaningfulActivity,
  );

  // Trend bonus
  const trendBonus = computeTrendBonus(problemStats);

  // Final estimate
  let estimated: number;
  const growth = practice.signal - historyAnchor;
  if (growth > 0) {
    estimated = historyAnchor + growth * (0.55 + 0.45 * confidence) + trendBonus;
  } else {
    estimated = historyAnchor + trendBonus;
  }

  // Inactivity decay — only if no meaningful activity recently
  let decay = 0;
  if (lastMeaningfulActivity) {
    const idleDays = (Date.now() - lastMeaningfulActivity) / DAY_MS;
    if (idleDays > 90) {
      decay = Math.min(120, Math.floor(10 * Math.log2(idleDays / 90)));
    }
  }
  estimated -= decay;
  estimated = Math.max(estimated, currentRating - 100);

  const finalRating = roundRating(Math.round(estimated));

  // Evidence
  const hardThreshold = practice.signal - 100;
  const hardSolveCount = acRatings.filter((r) => r >= hardThreshold).length;
  const tagSet = new Set<string>();
  for (const s of problemStats) {
    if (!s.accepted || s.attempts < 3) continue;
    for (const t of s.tags) tagSet.add(t);
  }

  const explanationItems: string[] = [];
  explanationItems.push(`基于 ${acRatings.length} 道已完成题目的数据分析`);
  if (growth > 0) {
    explanationItems.push(`做题能力信号 (${practice.signal}) 高于官方 Rating (${currentRating})，差值 +${growth}`);
  }
  if (trendBonus > 0) {
    explanationItems.push(`近期难度呈上升趋势，额外奖励 +${trendBonus}`);
  }
  if (decay > 0) {
    explanationItems.push(`长期缺乏有效活动，轻度衰减 -${decay}`);
  }
  if (practice.p80 != null) {
    explanationItems.push(`加权 P80 难度约 ${Math.round(practice.p80)}`);
  }
  if (practice.p95 != null) {
    explanationItems.push(`加权 P95 难度约 ${Math.round(practice.p95)}`);
  }

  return {
    estimatedRating: finalRating,
    currentRating,
    maxRating,
    ratingDelta: finalRating - currentRating,
    confidence: Math.round(confidence * 100) / 100,
    modelType: "rated",
    historyAnchor,
    practiceSignal: practice.signal,
    trendBonus,
    inactivityDecay: decay,
    ratedSolvedCount: acRatings.length,
    recentRatedSolvedCount: practice.count,
    evidence: {
      p65: practice.p65 != null ? Math.round(practice.p65) : null,
      p80: practice.p80 != null ? Math.round(practice.p80) : null,
      p95: practice.p95 != null ? Math.round(practice.p95) : null,
      hardSolveCount,
      tagBreadth: tagSet.size,
      lastMeaningfulActivity: lastMeaningfulActivity
        ? Math.round(lastMeaningfulActivity / 1000) : null,
    },
    explanationItems,
  };
}

// ===========================================================================
// Case 2: Unrated — never competed
// ===========================================================================

function estimateUnrated(input: UserRatingInput): RatingEstimate {
  const { problemStats } = input;
  const acRatings = getAcRatings(problemStats);
  const n = acRatings.length;
  const lastMeaningfulActivity = getLastMeaningfulActivity([], problemStats);

  if (n === 0) {
    return {
      estimatedRating: 800,
      currentRating: 0,
      maxRating: 0,
      ratingDelta: 0,
      confidence: 0.15,
      modelType: "unrated",
      historyAnchor: null,
      practiceSignal: 0,
      trendBonus: 0,
      inactivityDecay: 0,
      ratedSolvedCount: 0,
      recentRatedSolvedCount: 0,
      evidence: { p65: null, p80: null, p95: null, hardSolveCount: 0, tagBreadth: 0, lastMeaningfulActivity: null },
      explanationItems: ["无有效 Rating AC 题目，默认入门分 800"],
    };
  }

  // Weighted percentiles
  const weights = computeWeights(problemStats);
  const entries = Array.from(weights.entries())
    .map(([key, data]) => ({ key, ...data }));
  entries.sort((a, b) => b.weight - a.weight);

  const recent200 = entries.slice(0, RECENT_LIMIT);
  const ratings = recent200.map((e) => e.rating).sort((a, b) => a - b);
  const w = recent200.map((e) => e.weight);

  const p60 = weightedPercentile(ratings, w, 60);
  const p75 = weightedPercentile(ratings, w, 75);
  const p85 = weightedPercentile(ratings, w, 85);
  const p95 = n >= 10 ? weightedPercentile(ratings, w, 95) : null;
  const maxR = ratings[ratings.length - 1];

  let practiceSignal: number;
  if (n >= 20) {
    practiceSignal = Math.max(p60 + 150, p75 + 75, p85, (p95 ?? p85 + 100) - 150, maxR - 250);
  } else if (n >= 10) {
    practiceSignal = Math.max(p60 + 150, p75 + 75, p85, maxR - 250);
  } else {
    practiceSignal = Math.max(p60 + 150, p75 + 75, p85);
  }

  // Segmented penalty
  let penalty: number;
  if (n < 5) penalty = 250;
  else if (n < 10) penalty = 180;
  else if (n < 20) penalty = 120;
  else if (n < 40) penalty = 70;
  else if (n < 70) penalty = 30;
  else penalty = 0;

  let estimated = practiceSignal - penalty;

  // Dynamic cap
  let cap: number;
  if (n < 5) cap = 1200;
  else if (n < 10) cap = 1400;
  else if (n < 20) cap = 1600;
  else if (n < 40) cap = 1800;
  else if (n < 70) cap = 2050;
  else cap = 2300;

  estimated = clamp(estimated, 800, cap);

  const confidence = computeConfidence(
    n, Math.round(practiceSignal), problemStats, acRatings, lastMeaningfulActivity,
  );

  const tagSet = new Set<string>();
  for (const s of problemStats) {
    if (!s.accepted || s.attempts < 3) continue;
    for (const t of s.tags) tagSet.add(t);
  }

  const hardThreshold = Math.round(practiceSignal) - 100;
  const hardSolveCount = acRatings.filter((r) => r >= hardThreshold).length;

  const explanationItems: string[] = [];
  explanationItems.push(`沙盒评估：基于 ${n} 道已完成题目，无正式比赛记录`);
  if (n < 40) explanationItems.push(`数据量有限（${n} 题），预估可能偏低`);
  explanationItems.push(`加权 P60 难度约 ${Math.round(p60)}，P75 约 ${Math.round(p75)}`);
  if (p95 != null) explanationItems.push(`加权 P95 难度约 ${Math.round(p95)}`);

  return {
    estimatedRating: roundRating(Math.round(estimated)),
    currentRating: 0,
    maxRating: 0,
    ratingDelta: 0,
    confidence: Math.round(confidence * 100) / 100,
    modelType: "unrated",
    historyAnchor: null,
    practiceSignal: Math.round(practiceSignal),
    trendBonus: 0,
    inactivityDecay: penalty,
    ratedSolvedCount: n,
    recentRatedSolvedCount: n,
    evidence: {
      p65: Math.round(weightedPercentile(ratings, w, 65)),
      p80: Math.round(weightedPercentile(ratings, w, 80)),
      p95: p95 != null ? Math.round(p95) : null,
      hardSolveCount,
      tagBreadth: tagSet.size,
      lastMeaningfulActivity: lastMeaningfulActivity ? Math.round(lastMeaningfulActivity / 1000) : null,
    },
    explanationItems,
  };
}

// ===========================================================================
// Main entry point
// ===========================================================================

export function estimateUserRating(input: UserRatingInput): RatingEstimate {
  const hasRating =
    (input.currentRating ?? 0) > 0 ||
    (input.maxRating ?? 0) > 0 ||
    input.ratingHistory.length > 0;

  if (hasRating) {
    // If currentRating is 0 but user has contest history, use max from history
    if ((input.currentRating ?? 0) === 0 && input.ratingHistory.length > 0) {
      const last = input.ratingHistory[input.ratingHistory.length - 1];
      return estimateRated({
        ...input,
        currentRating: last.newRating,
        maxRating: Math.max(input.maxRating ?? 0, last.newRating),
      });
    }
    return estimateRated(input);
  }
  return estimateUnrated(input);
}

// ===========================================================================
// Helper: build UserRatingInput from existing data
// ===========================================================================

export function buildRatingInput(params: {
  currentRating: number | null;
  maxRating: number | null;
  ratingHistory: Array<{ contestId: number; contestName: string; newRating: number; oldRating: number; ratingUpdateAt: string }>;
  problemStats: CfProblemStat[];
  lastOnlineAt: string | null;
}): UserRatingInput {
  return {
    currentRating: params.currentRating,
    maxRating: params.maxRating,
    ratingHistory: params.ratingHistory,
    problemStats: params.problemStats,
    lastOnlineAt: params.lastOnlineAt,
  };
}
