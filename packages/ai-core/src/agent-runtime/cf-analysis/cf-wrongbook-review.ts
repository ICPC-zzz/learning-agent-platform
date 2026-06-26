// ============================================================
// A489 v3 — Review Plan Generator
// ============================================================
// 3 rating zones × 4 fishing categories.
// Uses unified estimateUserRating from cf-rating-estimator.ts.
// Zone widths per user spec (seven.md):
//   Rated:   保分区 [E-300, E-100)  核心区 [E-100, E+200]  瞭望区 (E+200, E+400]
//   Unrated: 保分区 [E-300, E-150)  核心区 [E-150, E+250]  瞭望区 (E+250, E+450]
// @module cf-wrongbook-review
// @serverOnly

import type { RatingEstimate, CfProblemStat } from "./cf-rating-estimator.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PriorityLevel = "urgent" | "high" | "medium" | "low";

export type ReviewRecommendationType =
  | "historical_failure"
  | "spaced_review"
  | "close_call"
  | "weak_tag_explore";

export interface ReviewZone {
  name: "保分区" | "核心区" | "瞭望区";
  minRating: number;
  maxRating: number;
}

export interface ReviewRecommendation {
  problemKey: string;
  problemId: string;
  name: string;
  rating: number | null;
  tags: string[];
  originalUrl: string;
  attempts: number;
  accepted: boolean;
  lastSubmittedAt: string | null;
  lastVerdict: string | null;
  priorityLevel: PriorityLevel;
  recommendationType: ReviewRecommendationType;
  zone: string;
  reasonCodes: string[];
}

export interface ReviewReport {
  generatedAt: string;
  estimatedRating: number;
  estimationMethod: "rated" | "unrated";
  ratingZones: ReviewZone[];
  summary: {
    totalAcProblems: number;
    totalWaProblems: number;
    weakTagCount: number;
    activeDays: number | null;
  };
  focusTags: Array<{
    tag: string;
    waRate: number;
    evidenceLevel: "high" | "medium" | "low";
  }>;
  recommendations: ReviewRecommendation[];
  reviewAdvice: {
    suggestedSessionMinutes: number;
    suggestedOrder: string[];
    reminderLevel: "none" | "light" | "strong";
  };
  dataQuality: {
    confidence: "high" | "medium" | "low";
    warnings: string[];
  };
}

// ---------------------------------------------------------------------------
// Rating zones
// ---------------------------------------------------------------------------

export function computeRatingZones(estimatedRating: number, isUnrated: boolean): ReviewZone[] {
  const E = estimatedRating;
  if (isUnrated) {
    return [
      { name: "保分区", minRating: Math.max(800, E - 300), maxRating: E - 150 },
      { name: "核心区", minRating: E - 150, maxRating: E + 250 },
      { name: "瞭望区", minRating: E + 250, maxRating: E + 450 },
    ];
  }
  return [
    { name: "保分区", minRating: Math.max(800, E - 300), maxRating: E - 100 },
    { name: "核心区", minRating: E - 100, maxRating: E + 200 },
    { name: "瞭望区", minRating: E + 200, maxRating: E + 400 },
  ];
}

// ---------------------------------------------------------------------------
// Weak tags (with proper evidence requirements)
// ---------------------------------------------------------------------------

export function computeWeakTags(
  allStats: CfProblemStat[],
): ReviewReport["focusTags"] {
  // Per-problem stats (not per-submission)
  const tagMap = new Map<string, { total: number; wa: number }>();
  for (const s of allStats) {
    for (const tag of s.tags) {
      const e = tagMap.get(tag) ?? { total: 0, wa: 0 };
      e.total++;
      if (!s.accepted) e.wa++;
      tagMap.set(tag, e);
    }
  }

  const entries = Array.from(tagMap.entries())
    .map(([tag, d]) => {
      const failureRate = (d.wa + 2) / (d.total + 4); // Laplace smoothing
      return { tag, total: d.total, wa: d.wa, failureRate };
    })
    .filter((e) => e.total >= 5 && e.failureRate > 0.25)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 5);

  return entries.map((e) => {
    let evidenceLevel: "high" | "medium" | "low";
    if (e.total >= 15 || (e.total >= 10 && e.failureRate >= 0.5)) evidenceLevel = "high";
    else if (e.total >= 8) evidenceLevel = "medium";
    else evidenceLevel = "low";
    return {
      tag: e.tag,
      waRate: Math.round(e.failureRate * 100) / 100,
      evidenceLevel,
    };
  });
}

// ---------------------------------------------------------------------------
// Generate review plan
// ---------------------------------------------------------------------------

export interface GenerateReviewPlanInput {
  estimatedRating: number;
  isUnrated: boolean;
  zones: ReviewZone[];
  allStats: CfProblemStat[];
  weakTags: ReviewReport["focusTags"];
  localPool: Array<{
    problemKey: string;
    problemId: string;
    name: string;
    rating: number | null;
    tags: string[];
    originalUrl: string;
  }>;
  /** Optional: upcoming contest start time (seconds since epoch) for time-based adjustments */
  nextContestStartsAt?: number | null;
}

export function generateReviewPlan(input: GenerateReviewPlanInput) {
  const { estimatedRating: E, isUnrated, zones, allStats, weakTags, localPool } = input;
  const warnings: string[] = [];
  const DAY_MS = 86400000;
  const now = Date.now();
  const MAX_SLOTS = 12;

  // Zone classification
  const zoneFor = (rating: number | null): string | null => {
    if (rating == null) return null;
    return zones.find((z) => rating >= z.minRating && rating <= z.maxRating)?.name ?? null;
  };

  // Maps
  const poolMap = new Map(localPool.map((p) => [p.problemKey, p]));
  const statMap = new Map(allStats.map((s) => [s.problemKey, s]));
  const weakTagSet = new Set(weakTags.map((t) => t.tag));

  const selected = new Map<string, ReviewRecommendation>();
  const typesUsed = new Map<ReviewRecommendationType, number>();

  function add(item: ReviewRecommendation, maxOfType: number): boolean {
    if (selected.size >= MAX_SLOTS) return false;
    if (selected.has(item.problemKey)) return false;
    const tc = typesUsed.get(item.recommendationType) ?? 0;
    if (tc >= maxOfType) return false;
    selected.set(item.problemKey, item);
    typesUsed.set(item.recommendationType, tc + 1);
    return true;
  }

  function makeRec(
    key: string, type: ReviewRecommendationType, reasonCodes: string[],
  ): ReviewRecommendation | null {
    const pool = poolMap.get(key);
    const stat = statMap.get(key);
    const r = stat?.rating ?? pool?.rating ?? null;
    const z = zoneFor(r);
    if (!z) return null;

    return {
      problemKey: key, problemId: pool?.problemId ?? "",
      name: pool?.name ?? stat?.name ?? key, rating: r,
      tags: pool?.tags ?? stat?.tags ?? [],
      originalUrl: pool?.originalUrl ?? "",
      attempts: stat?.attempts ?? 0, accepted: stat?.accepted ?? false,
      lastSubmittedAt: stat?.lastSubmittedAt ?? null,
      lastVerdict: stat?.lastVerdict ?? null,
      priorityLevel:
        type === "historical_failure" ? "urgent" :
        type === "close_call" ? "high" :
        type === "weak_tag_explore" ? "medium" : "low",
      recommendationType: type, zone: z, reasonCodes,
    };
  }

  function scoreFailure(s: CfProblemStat): number {
    let score = s.attempts * 10;
    if (s.lastSubmittedAt) score += Math.floor((now - new Date(s.lastSubmittedAt).getTime()) / DAY_MS) * 0.5;
    if (s.tags.some((t) => weakTagSet.has(t))) score += 30;
    if (s.rating != null) score += Math.abs(s.rating - E) * 0.2;
    return score;
  }

  // ── Cat 1: Historical failures (WA/TLE, core zone, >=2 fails) ──
  const failures = allStats
    .filter((s) => !s.accepted && s.attempts >= 2 && zoneFor(s.rating) === "核心区")
    .sort((a, b) => scoreFailure(b) - scoreFailure(a));

  for (const f of failures.slice(0, 5)) {
    const rec = makeRec(f.problemKey, "historical_failure",
      [`${f.attempts}次提交未通过`, f.lastVerdict === "WRONG_ANSWER" ? "曾WA" : ""].filter(Boolean));
    if (rec) add(rec, 5);
  }

  // ── Cat 2: Spaced review (Ebbinghaus: 1/3/7/15/30/60 days) ──
  const ebbingDays = [1, 3, 7, 15, 30, 60];
  const spaced = allStats
    .filter((s) => s.accepted && s.firstAcceptedAt)
    .map((s) => {
      const daysAgo = Math.floor((now - new Date(s.firstAcceptedAt!).getTime()) / DAY_MS);
      let bestDiff = Infinity;
      for (const d of ebbingDays) bestDiff = Math.min(bestDiff, Math.abs(daysAgo - d));
      return { key: s.problemKey, daysAgo, bestDiff, attempts: s.attempts };
    })
    .filter((c) => {
      const z = zoneFor(statMap.get(c.key)?.rating ?? null);
      return z === "保分区" || z === "核心区";
    })
    .sort((a, b) => a.bestDiff - b.bestDiff || b.attempts - a.attempts);

  for (const c of spaced) {
    const rec = makeRec(c.key, "spaced_review", [`${c.daysAgo}天前通过`, "遗忘临界"]);
    if (rec) add(rec, 4);
  }

  // ── Cat 3: Close calls (AC after ≥ 2 WA/TLE/MLE/RE) ──
  const closeCalls = allStats
    .filter((s) => s.accepted && s.attempts >= 3 && zoneFor(s.rating) === "核心区")
    .sort((a, b) => b.attempts - a.attempts);

  for (const c of closeCalls) {
    const rec = makeRec(c.problemKey, "close_call", [`${c.attempts}次后通过`, "曾卡题"]);
    if (rec) add(rec, 4);
  }

  // ── Cat 4: Weak tag exploration (new problems) ──
  const usedKeys = new Set(selected.keys());
  let lookoutSlots = 0;
  const lookoutMax = input.nextContestStartsAt && (input.nextContestStartsAt * 1000 - now) < 48 * 3600_000 ? 1 : 2;

  for (const p of localPool) {
    if (selected.size >= MAX_SLOTS) break;
    if (usedKeys.has(p.problemKey)) continue;
    if (statMap.has(p.problemKey)) continue;
    if (!p.tags.some((t) => weakTagSet.has(t))) continue;
    const z = zoneFor(p.rating);
    if (!z || z === "保分区") continue;
    if (z === "瞭望区" && lookoutSlots >= lookoutMax) continue;

    const rec: ReviewRecommendation = {
      problemKey: p.problemKey, problemId: p.problemId,
      name: p.name, rating: p.rating, tags: p.tags,
      originalUrl: p.originalUrl,
      attempts: 0, accepted: false,
      lastSubmittedAt: null, lastVerdict: null,
      priorityLevel: "medium", recommendationType: "weak_tag_explore",
      zone: z,
      reasonCodes: [z === "瞭望区" ? "挑战区新题" : "核心区新题", `弱点: ${weakTags.find((t) => p.tags.includes(t.tag))?.tag ?? "未知"}`],
    };
    if (z === "瞭望区") lookoutSlots++;
    add(rec, 5);
  }

  // Fill remaining with failures
  for (const f of failures) {
    if (!selected.has(f.problemKey)) {
      const rec = makeRec(f.problemKey, "historical_failure", ["补充", "历史未通过"]);
      if (rec) add(rec, 99);
    }
  }

  const recommendations = Array.from(selected.values());
  const urgent = recommendations.filter((r) => r.priorityLevel === "urgent").length;
  const unfinished = allStats.filter((s) => !s.accepted).length;
  let reminderLevel: "none" | "light" | "strong" = "none";
  if (unfinished >= 5 || urgent >= 2) reminderLevel = "strong";
  else if (unfinished >= 2) reminderLevel = "light";

  return {
    recommendations,
    reviewAdvice: {
      suggestedSessionMinutes: recommendations.length * 45,
      suggestedOrder: recommendations.map((r) => r.problemKey),
      reminderLevel,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------

export interface BuildReportInput {
  estimatedRating: number;
  estimationMethod: "rated" | "unrated";
  zones: ReviewZone[];
  allStats: CfProblemStat[];
  focusTags: ReviewReport["focusTags"];
  recommendations: ReviewRecommendation[];
  reviewAdvice: ReviewReport["reviewAdvice"];
  hasCfBinding: boolean;
  additionalWarnings: string[];
}

export function buildReviewReport(input: BuildReportInput): ReviewReport {
  const allWarnings = [...input.additionalWarnings];
  let confidence: "high" | "medium" | "low" = "high";
  if (!input.hasCfBinding || input.allStats.length < 5) confidence = "low";
  else if (input.allStats.length < 20) confidence = "medium";

  return {
    generatedAt: new Date().toISOString(),
    estimatedRating: input.estimatedRating,
    estimationMethod: input.estimationMethod,
    ratingZones: input.zones,
    summary: {
      totalAcProblems: input.allStats.filter((s) => s.accepted).length,
      totalWaProblems: input.allStats.filter((s) => !s.accepted && s.attempts > 0).length,
      weakTagCount: input.focusTags.length,
      activeDays: null,
    },
    focusTags: input.focusTags,
    recommendations: input.recommendations,
    reviewAdvice: input.reviewAdvice,
    dataQuality: { confidence, warnings: allWarnings },
  };
}
