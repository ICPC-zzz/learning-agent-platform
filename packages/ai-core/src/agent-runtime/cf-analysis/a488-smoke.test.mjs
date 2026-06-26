// A488 — Quick smoke test for analysis functions
// Tests pure analysis functions only (no orchestrator, no tools)
// These functions are deterministic and don't need any Runtime imports.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import only the analysis module (no agent-events dependency)
import {
  analyzeActivity,
  analyzeRatingTrend,
  selectWeakTags,
  computeRatingPlan,
  analyzeCodeforcesLearningProfile,
} from "./cf-learning-analysis.ts";

import {
  generateTrainingPlan,
  assertNoSolvedProblems,
} from "./cf-training-plan.ts";

// ===========================================================================
// Test data
// ===========================================================================

function makeSnapshot(overrides = {}) {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  return {
    profile: {
      handle: "test_user", currentRating: 1500, maxRating: 1650,
      rank: "specialist", maxRank: "expert",
      lastOnlineAt: yesterday, lastSubmissionAt: yesterday, lastSyncedAt: yesterday,
      ...overrides.profile,
    },
    totals: {
      submissions: 200, acceptedSubmissions: 80,
      attemptedProblems: 60, solvedProblems: 40, unfinishedProblems: 20,
      ...overrides.totals,
    },
    ratingHistory: [
      { contestId: 1, contestName: "R1", rank: 1000, oldRating: 1400, newRating: 1450, ratingUpdateAt: "2026-01-15T00:00:00Z" },
      { contestId: 2, contestName: "R2", rank: 800, oldRating: 1450, newRating: 1500, ratingUpdateAt: "2026-02-01T00:00:00Z" },
      { contestId: 3, contestName: "R3", rank: 500, oldRating: 1500, newRating: 1550, ratingUpdateAt: "2026-03-01T00:00:00Z" },
      ...(overrides.ratingHistory ?? []),
    ],
    verdictStats: [],
    ratingBucketStats: [],
    tagStats: [
      { tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 },
      ...(overrides.tagStats ?? []),
    ],
    activitySeries: [
      { date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), submissions: 3, solved: 1 },
      { date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), submissions: 5, solved: 2 },
      ...(overrides.activitySeries ?? []),
    ],
    problemStates: {
      attemptedProblemKeys: ["cf:1:A", "cf:2:A"],
      solvedProblemKeys: ["cf:1:A"],
      unfinishedProblemKeys: ["cf:2:A"],
      wrongBookProblemKeys: [],
      ...overrides.problemStates,
    },
    dataQuality: {
      truncated: false, submissionCount: 200, oldestFetchedAt: "2026-01-01T00:00:00Z",
      confidence: "high", warnings: [],
      ...overrides.dataQuality,
    },
  };
}

function makeCandidates(count = 10) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({
      problemKey: `codeforces:${1000 + i}:A`, problemId: `prob_${i}`,
      contestId: 1000 + i, index: "A", name: `Problem ${i}`,
      rating: 800 + i * 100,
      tags: i % 3 === 0 ? ["dp", "math"] : i % 3 === 1 ? ["greedy"] : ["graphs"],
      solvedCount: 5000 - i * 100,
      originalUrl: `https://codeforces.com/problemset/problem/${1000 + i}/A`,
      matchedPreferredTags: [],
    });
  }
  return result;
}

// ===========================================================================
// Tests
// ===========================================================================

describe("Activity Analysis", () => {
  it("detects normal (0-6 days)", () => {
    const r = analyzeActivity(makeSnapshot());
    assert.equal(r.reminderLevel, "none");
  });
  it("detects light reminder (7-13 days)", () => {
    const d = new Date(Date.now() - 10 * 86400000).toISOString();
    assert.equal(analyzeActivity(makeSnapshot({ profile: { lastSubmissionAt: d } })).reminderLevel, "light");
  });
  it("detects strong reminder (14-29 days)", () => {
    const d = new Date(Date.now() - 20 * 86400000).toISOString();
    assert.equal(analyzeActivity(makeSnapshot({ profile: { lastSubmissionAt: d } })).reminderLevel, "strong");
  });
  it("detects restart (30+ days)", () => {
    const d = new Date(Date.now() - 40 * 86400000).toISOString();
    assert.equal(analyzeActivity(makeSnapshot({ profile: { lastSubmissionAt: d } })).reminderLevel, "restart");
  });
  it("handles null lastSubmissionAt", () => {
    assert.equal(analyzeActivity(makeSnapshot({ profile: { lastSubmissionAt: null } })).reminderLevel, "restart");
  });
});

describe("Rating Trend", () => {
  it("detects up", () => {
    const r = analyzeRatingTrend(makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1400, newRating: 1480, ratingUpdateAt: "2026-01-01T00:00:00Z" },
        { contestId: 2, contestName: "R2", rank: 400, oldRating: 1480, newRating: 1560, ratingUpdateAt: "2026-02-01T00:00:00Z" },
        { contestId: 3, contestName: "R3", rank: 300, oldRating: 1560, newRating: 1650, ratingUpdateAt: "2026-03-01T00:00:00Z" },
      ],
    }));
    assert.equal(r, "up");
  });
  it("detects stable", () => {
    const r = analyzeRatingTrend(makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1500, newRating: 1510, ratingUpdateAt: "2026-01-01T00:00:00Z" },
        { contestId: 2, contestName: "R2", rank: 500, oldRating: 1510, newRating: 1495, ratingUpdateAt: "2026-02-01T00:00:00Z" },
      ],
    }));
    assert.equal(r, "stable");
  });
  it("returns insufficient for <2 points", () => {
    const r = analyzeRatingTrend(makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1400, newRating: 1500, ratingUpdateAt: "2026-01-01T00:00:00Z" },
      ],
    }));
    assert.equal(r, "insufficient");
  });
});

describe("Weak Tags", () => {
  it("returns at most 3", () => {
    const r = selectWeakTags(makeSnapshot({
      tagStats: [
        { tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 },
        { tag: "greedy", attempted: 12, solved: 8, attempts: 18, completionRate: 0.67, sampleSize: 12 },
        { tag: "math", attempted: 10, solved: 6, attempts: 15, completionRate: 0.6, sampleSize: 10 },
        { tag: "graphs", attempted: 5, solved: 2, attempts: 8, completionRate: 0.4, sampleSize: 5 },
      ],
    }));
    assert.ok(r.length <= 3);
  });
  it("assigns evidence levels", () => {
    const r = selectWeakTags(makeSnapshot({
      tagStats: [
        { tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 },
        { tag: "graphs", attempted: 5, solved: 2, attempts: 8, completionRate: 0.4, sampleSize: 5 },
      ],
    }));
    for (const t of r) assert.ok(["high","medium","low"].includes(t.evidenceLevel));
  });
});

describe("Rating Plan", () => {
  it("generates three ranges", () => {
    const s = makeSnapshot({
      tagStats: [{ tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 }],
    });
    const p = computeRatingPlan(s, selectWeakTags(s));
    assert.ok(p.warmup !== null && p.training !== null && p.challenge !== null);
    assert.ok(p.warmup[1] <= p.training[1]);
    assert.ok(p.challenge[0] >= p.training[0]);
  });
  it("clamps to bounds", () => {
    const s = makeSnapshot({
      profile: { currentRating: 100 },
      tagStats: [{ tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 }],
    });
    const p = computeRatingPlan(s, selectWeakTags(s));
    assert.ok(p.warmup[0] >= 800 && p.challenge[1] <= 3500);
  });
});

describe("Training Plan", () => {
  it("generates 3-5 recs", () => {
    const c = makeCandidates(20);
    const r = generateTrainingPlan({
      warmupCandidates: c, weakTagCandidates: c, challengeCandidates: c,
      unfinishedCandidates: [], weakTags: [], solvedProblemKeys: new Set(),
    });
    assert.ok(r.recommendations.length >= 3 && r.recommendations.length <= 5);
  });
  it("excludes solved problems", () => {
    const c = makeCandidates(20);
    const r = generateTrainingPlan({
      warmupCandidates: c, weakTagCandidates: c, challengeCandidates: c,
      unfinishedCandidates: [], weakTags: [],
      solvedProblemKeys: new Set(["codeforces:1000:A"]),
    });
    for (const rec of r.recommendations) {
      assert.ok(rec.problemKey !== "codeforces:1000:A");
    }
  });
  it("assertNoSolvedProblems throws", () => {
    assert.throws(() => assertNoSolvedProblems(
      [{ problemKey: "x", name: "y", rating: 800, tags: [], originalUrl: "", recommendationType: "warmup", reasonCodes: [] }],
      new Set(["x"]),
    ), /SAFETY/);
  });
  it("includes warmup rec", () => {
    const c = makeCandidates(20);
    const r = generateTrainingPlan({
      warmupCandidates: c, weakTagCandidates: [], challengeCandidates: [],
      unfinishedCandidates: [], weakTags: [], solvedProblemKeys: new Set(),
    });
    assert.ok(r.recommendations.some(x => x.recommendationType === "warmup"));
  });
  it("grades insufficient", () => {
    const r = generateTrainingPlan({
      warmupCandidates: [], weakTagCandidates: [], challengeCandidates: [],
      unfinishedCandidates: [], weakTags: [], solvedProblemKeys: new Set(),
    });
    assert.ok(r.warnings.some(w => w.includes("no_") || w.includes("low_")));
  });
});

describe("Full Pipeline", () => {
  it("complete result", () => {
    const s = makeSnapshot({
      tagStats: [{ tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 }],
    });
    const r = analyzeCodeforcesLearningProfile(s);
    assert.ok(r.activity && r.ratingTrend && r.weakTags && r.ratingPlan && r.profileSummary);
  });
  it("minimum snapshot", () => {
    const s = makeSnapshot({
      profile: { handle: "min", currentRating: null, maxRating: null, rank: null, maxRank: null, lastOnlineAt: null, lastSubmissionAt: null },
      totals: { submissions: 0, acceptedSubmissions: 0, attemptedProblems: 0, solvedProblems: 0, unfinishedProblems: 0 },
      ratingHistory: [],
      tagStats: [],
      activitySeries: [],
      problemStates: { attemptedProblemKeys: [], solvedProblemKeys: [], unfinishedProblemKeys: [], wrongBookProblemKeys: [] },
      dataQuality: { truncated: false, submissionCount: 0, oldestFetchedAt: null, confidence: "low", warnings: ["no data"] },
    });
    const r = analyzeCodeforcesLearningProfile(s);
    assert.equal(r.ratingTrend, "insufficient");
    assert.equal(r.activity.reminderLevel, "restart");
  });
});

console.log("\n✅ A488 Smoke Tests Completed\n");
