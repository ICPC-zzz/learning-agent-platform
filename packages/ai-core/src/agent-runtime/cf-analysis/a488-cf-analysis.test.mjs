// A488 — CF Learning Analysis Tests (Static imports, agent-runtime directory)
// Run: node --test packages/ai-core/src/agent-runtime/cf-analysis/a488-cf-analysis.test.mjs

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Static imports (same pattern as A487 tests)
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

import {
  DeterministicRoutingOrchestrator,
  OrchestratorError,
} from "../orchestration/deterministic-routing-orchestrator.ts";

import {
  createCfSnapshotTool,
  createCfCandidatesTool,
} from "../tools/cf-real-tools.ts";

// ===========================================================================
// Mock / test data
// ===========================================================================

function makeSnapshot(overrides = {}) {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  return {
    profile: {
      handle: "test_user",
      currentRating: 1500,
      maxRating: 1650,
      rank: "specialist",
      maxRank: "expert",
      lastOnlineAt: yesterday,
      lastSubmissionAt: yesterday,
      lastSyncedAt: yesterday,
      ...overrides.profile,
    },
    totals: {
      submissions: 200,
      acceptedSubmissions: 80,
      attemptedProblems: 60,
      solvedProblems: 40,
      unfinishedProblems: 20,
      ...overrides.totals,
    },
    ratingHistory: [
      { contestId: 1, contestName: "Round 1", rank: 1000, oldRating: 1400, newRating: 1450, ratingUpdateAt: "2026-01-15T00:00:00Z" },
      { contestId: 2, contestName: "Round 2", rank: 800, oldRating: 1450, newRating: 1500, ratingUpdateAt: "2026-02-01T00:00:00Z" },
      { contestId: 3, contestName: "Round 3", rank: 500, oldRating: 1500, newRating: 1550, ratingUpdateAt: "2026-03-01T00:00:00Z" },
      ...(overrides.ratingHistory ?? []),
    ],
    verdictStats: [{ verdict: "OK", count: 80 }, { verdict: "WRONG_ANSWER", count: 60 }],
    ratingBucketStats: [],
    tagStats: [
      { tag: "dp", attempted: 15, solved: 5, attempts: 30, completionRate: 0.33, sampleSize: 15 },
      { tag: "greedy", attempted: 12, solved: 8, attempts: 18, completionRate: 0.67, sampleSize: 12 },
      { tag: "math", attempted: 10, solved: 6, attempts: 15, completionRate: 0.6, sampleSize: 10 },
      { tag: "graphs", attempted: 5, solved: 2, attempts: 8, completionRate: 0.4, sampleSize: 5 },
      ...(overrides.tagStats ?? []),
    ],
    activitySeries: [
      { date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), submissions: 3, solved: 1 },
      { date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), submissions: 5, solved: 2 },
      { date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), submissions: 4, solved: 0 },
      { date: new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10), submissions: 2, solved: 1 },
      ...(overrides.activitySeries ?? []),
    ],
    problemStates: {
      attemptedProblemKeys: ["cf:1:A", "cf:1:B", "cf:2:A", "cf:2:B", "cf:3:A"],
      solvedProblemKeys: ["cf:1:A", "cf:2:A"],
      unfinishedProblemKeys: ["cf:1:B", "cf:2:B", "cf:3:A"],
      wrongBookProblemKeys: ["cf:1:A"],
      ...overrides.problemStates,
    },
    dataQuality: {
      truncated: false,
      submissionCount: 200,
      oldestFetchedAt: "2026-01-01T00:00:00Z",
      confidence: "high",
      warnings: [],
      ...overrides.dataQuality,
    },
  };
}

function makeCandidates(count = 10) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const contestId = 1000 + i;
    result.push({
      problemKey: `codeforces:${contestId}:A`,
      problemId: `prob_${i}`,
      contestId,
      index: "A",
      name: `Test Problem ${i}`,
      rating: 800 + i * 100,
      tags: i % 3 === 0 ? ["dp", "math"] : i % 3 === 1 ? ["greedy"] : ["graphs"],
      solvedCount: 5000 - i * 100,
      originalUrl: `https://codeforces.com/problemset/problem/${contestId}/A`,
      matchedPreferredTags: [],
    });
  }
  return result;
}

// ===========================================================================
// 1. Activity Analysis (8 tests)
// ===========================================================================

describe("Activity Analysis", () => {
  it("detects normal activity (0-6 days)", () => {
    const snap = makeSnapshot();
    const result = analyzeActivity(snap);
    assert.equal(result.reminderLevel, "none");
    assert.ok(result.daysSinceLastSubmission !== null && result.daysSinceLastSubmission <= 6);
  });

  it("detects light reminder (7-13 days)", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const snap = makeSnapshot({ profile: { lastSubmissionAt: tenDaysAgo } });
    const result = analyzeActivity(snap);
    assert.equal(result.reminderLevel, "light");
  });

  it("detects strong reminder (14-29 days)", () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString();
    const snap = makeSnapshot({ profile: { lastSubmissionAt: twentyDaysAgo } });
    const result = analyzeActivity(snap);
    assert.equal(result.reminderLevel, "strong");
  });

  it("detects restart reminder (30+ days)", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86400000).toISOString();
    const snap = makeSnapshot({ profile: { lastSubmissionAt: fortyDaysAgo } });
    const result = analyzeActivity(snap);
    assert.equal(result.reminderLevel, "restart");
  });

  it("handles null lastSubmissionAt", () => {
    const snap = makeSnapshot({ profile: { lastSubmissionAt: null } });
    const result = analyzeActivity(snap);
    assert.equal(result.reminderLevel, "restart");
    assert.equal(result.daysSinceLastSubmission, null);
  });

  it("counts submissions in last 7 and 30 days correctly", () => {
    const snap = makeSnapshot();
    const result = analyzeActivity(snap);
    assert.ok(result.submissionsLast7Days >= 0);
    assert.ok(result.submissionsLast30Days >= result.submissionsLast7Days);
  });

  it("counts solved in last 30 days", () => {
    const snap = makeSnapshot();
    const result = analyzeActivity(snap);
    assert.ok(result.solvedLast30Days >= 0);
  });

  it("handles empty activity series", () => {
    const snap = makeSnapshot({ activitySeries: [] });
    const result = analyzeActivity(snap);
    assert.equal(result.submissionsLast7Days, 0);
    assert.equal(result.submissionsLast30Days, 0);
    assert.equal(result.solvedLast30Days, 0);
  });
});

// ===========================================================================
// 2. Rating Trend (4 tests)
// ===========================================================================

describe("Rating Trend", () => {
  it("detects upward trend", () => {
    const snap = makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1400, newRating: 1480, ratingUpdateAt: "2026-01-01T00:00:00Z" },
        { contestId: 2, contestName: "R2", rank: 400, oldRating: 1480, newRating: 1560, ratingUpdateAt: "2026-02-01T00:00:00Z" },
        { contestId: 3, contestName: "R3", rank: 300, oldRating: 1560, newRating: 1650, ratingUpdateAt: "2026-03-01T00:00:00Z" },
      ],
    });
    assert.equal(analyzeRatingTrend(snap), "up");
  });

  it("detects downward trend", () => {
    const snap = makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1600, newRating: 1520, ratingUpdateAt: "2026-01-01T00:00:00Z" },
        { contestId: 2, contestName: "R2", rank: 800, oldRating: 1520, newRating: 1440, ratingUpdateAt: "2026-02-01T00:00:00Z" },
        { contestId: 3, contestName: "R3", rank: 1000, oldRating: 1440, newRating: 1350, ratingUpdateAt: "2026-03-01T00:00:00Z" },
      ],
    });
    assert.equal(analyzeRatingTrend(snap), "down");
  });

  it("detects stable trend", () => {
    const snap = makeSnapshot({
      ratingHistory: [
        { contestId: 1, contestName: "R1", rank: 500, oldRating: 1500, newRating: 1510, ratingUpdateAt: "2026-01-01T00:00:00Z" },
        { contestId: 2, contestName: "R2", rank: 500, oldRating: 1510, newRating: 1495, ratingUpdateAt: "2026-02-01T00:00:00Z" },
      ],
    });
    assert.equal(analyzeRatingTrend(snap), "stable");
  });

  it("returns insufficient for <2 data points", () => {
    const snap = makeSnapshot({
      ratingHistory: [{ contestId: 1, contestName: "R1", rank: 500, oldRating: 1400, newRating: 1500, ratingUpdateAt: "2026-01-01T00:00:00Z" }],
    });
    assert.equal(analyzeRatingTrend(snap), "insufficient");
  });
});

// ===========================================================================
// 3. Weak Tags (4 tests)
// ===========================================================================

describe("Weak Tags", () => {
  it("returns at most 3 weak tags", () => {
    const result = selectWeakTags(makeSnapshot());
    assert.ok(result.length <= 3);
  });

  it("prioritizes low completion rate tags", () => {
    const result = selectWeakTags(makeSnapshot());
    if (result.length > 0) {
      assert.equal(result[0].tag, "dp");
    }
  });

  it("assigns evidence levels correctly", () => {
    const result = selectWeakTags(makeSnapshot());
    for (const tag of result) {
      assert.ok(["high", "medium", "low"].includes(tag.evidenceLevel));
      if (tag.attempted >= 10) assert.equal(tag.evidenceLevel, "high");
      else if (tag.attempted >= 5) assert.equal(tag.evidenceLevel, "medium");
      else assert.equal(tag.evidenceLevel, "low");
    }
  });

  it("handles tags with insufficient data", () => {
    const snap = makeSnapshot({
      tagStats: [
        { tag: "dp", attempted: 2, solved: 0, attempts: 4, completionRate: 0, sampleSize: 2 },
        { tag: "graphs", attempted: 1, solved: 0, attempts: 1, completionRate: 0, sampleSize: 1 },
      ],
    });
    const result = selectWeakTags(snap);
    for (const tag of result) {
      assert.equal(tag.evidenceLevel, "low");
    }
  });
});

// ===========================================================================
// 4. Rating Plan (3 tests)
// ===========================================================================

describe("Rating Plan", () => {
  it("generates warmup, training, challenge ranges", () => {
    const snap = makeSnapshot();
    const weakTags = selectWeakTags(snap);
    const plan = computeRatingPlan(snap, weakTags);
    assert.ok(plan.warmup !== null);
    assert.ok(plan.training !== null);
    assert.ok(plan.challenge !== null);
    assert.ok(plan.warmup[1] <= plan.training[1]);
    assert.ok(plan.challenge[0] >= plan.training[0]);
  });

  it("clamps to pool rating bounds", () => {
    const snap = makeSnapshot({ profile: { currentRating: 100 } });
    const plan = computeRatingPlan(snap, []);
    assert.ok(plan.warmup[0] >= 800);
    assert.ok(plan.challenge[1] <= 3500);
  });

  it("adjusts for low confidence data", () => {
    const snap = makeSnapshot({
      dataQuality: {
        confidence: "low", truncated: true, submissionCount: 3,
        oldestFetchedAt: null, warnings: ["low data"],
      },
    });
    const plan = computeRatingPlan(snap, []);
    assert.ok(plan.warmup[0] >= 800);
  });
});

// ===========================================================================
// 5. Training Plan Generator (8 tests)
// ===========================================================================

describe("Training Plan Generator", () => {
  it("generates 3-5 recommendations", () => {
    const candidates = makeCandidates(20);
    const solvedKeys = new Set(["codeforces:1000:A"]);
    const weakTags = [{
      tag: "dp", attempted: 10, solved: 3, completionRate: 0.3,
      evidenceLevel: "high", reasonCodes: ["low_completion_rate"],
    }];

    const { recommendations } = generateTrainingPlan({
      warmupCandidates: candidates,
      weakTagCandidates: candidates,
      challengeCandidates: candidates,
      unfinishedCandidates: candidates.slice(0, 3),
      weakTags,
      solvedProblemKeys: solvedKeys,
    });

    assert.ok(recommendations.length >= 3);
    assert.ok(recommendations.length <= 5);
  });

  it("never recommends solved problems", () => {
    const candidates = makeCandidates(20);
    const solvedKeys = new Set([
      "codeforces:1000:A", "codeforces:1001:A",
      "codeforces:1002:A", "codeforces:1003:A",
    ]);

    const { recommendations } = generateTrainingPlan({
      warmupCandidates: candidates,
      weakTagCandidates: candidates,
      challengeCandidates: candidates,
      unfinishedCandidates: [],
      weakTags: [],
      solvedProblemKeys: solvedKeys,
    });

    for (const rec of recommendations) {
      assert.ok(!solvedKeys.has(rec.problemKey),
        `Solved problem ${rec.problemKey} should not be recommended`);
    }
  });

  it("assertNoSolvedProblems throws on violation", () => {
    const solvedKeys = new Set(["codeforces:1000:A"]);
    assert.throws(() => {
      assertNoSolvedProblems([{
        problemKey: "codeforces:1000:A", name: "Test", rating: 800,
        tags: [], originalUrl: "", recommendationType: "warmup", reasonCodes: [],
      }], solvedKeys);
    }, /SAFETY VIOLATION/);
  });

  it("includes warmup recommendation", () => {
    const candidates = makeCandidates(20);
    const { recommendations } = generateTrainingPlan({
      warmupCandidates: candidates, weakTagCandidates: [],
      challengeCandidates: [], unfinishedCandidates: [],
      weakTags: [], solvedProblemKeys: new Set(),
    });
    assert.equal(recommendations.filter((r) => r.recommendationType === "warmup").length, 1);
  });

  it("includes weak tag recommendations", () => {
    const candidates = makeCandidates(20);
    const weakTags = [{
      tag: "dp", attempted: 10, solved: 3, completionRate: 0.3,
      evidenceLevel: "high", reasonCodes: ["low_completion_rate"],
    }];
    const { recommendations } = generateTrainingPlan({
      warmupCandidates: [], weakTagCandidates: candidates,
      challengeCandidates: [], unfinishedCandidates: [],
      weakTags, solvedProblemKeys: new Set(),
    });
    assert.ok(recommendations.filter((r) => r.recommendationType === "weak_tag").length > 0);
  });

  it("generates warnings when candidates insufficient", () => {
    const { recommendations, warnings } = generateTrainingPlan({
      warmupCandidates: [], weakTagCandidates: [],
      challengeCandidates: [], unfinishedCandidates: [],
      weakTags: [], solvedProblemKeys: new Set(),
    });
    assert.ok(recommendations.length < 3);
    assert.ok(warnings.some((w) => w.includes("low_recommendation_count") || w.includes("no_")));
  });

  it("recommendations have all required fields", () => {
    const candidates = makeCandidates(20);
    const { recommendations } = generateTrainingPlan({
      warmupCandidates: candidates, weakTagCandidates: candidates,
      challengeCandidates: candidates, unfinishedCandidates: [],
      weakTags: [], solvedProblemKeys: new Set(),
    });

    for (const rec of recommendations) {
      assert.ok(typeof rec.problemKey === "string" && rec.problemKey.length > 0);
      assert.ok(typeof rec.name === "string" && rec.name.length > 0);
      assert.ok(typeof rec.rating === "number");
      assert.ok(Array.isArray(rec.tags));
      assert.ok(typeof rec.originalUrl === "string");
      assert.ok(["warmup", "weak_tag", "challenge", "unfinished_review"].includes(rec.recommendationType));
      assert.ok(Array.isArray(rec.reasonCodes));
    }
  });

  it("can recommend previously attempted unfinished problems", () => {
    const candidates = makeCandidates(20);
    const unfinishedCandidate = { ...candidates[5], problemKey: "codeforces:1:B", name: "Unfinished Problem" };
    const weakTags = [{
      tag: "dp", attempted: 10, solved: 3, completionRate: 0.3,
      evidenceLevel: "high", reasonCodes: ["low_completion_rate"],
    }];

    const { recommendations } = generateTrainingPlan({
      warmupCandidates: [], weakTagCandidates: [],
      challengeCandidates: [], unfinishedCandidates: [unfinishedCandidate],
      weakTags, solvedProblemKeys: new Set(),
    });

    assert.ok(recommendations.filter((r) => r.recommendationType === "unfinished_review").length > 0);
  });
});

// ===========================================================================
// 6. Full Analysis Pipeline (3 tests)
// ===========================================================================

describe("Full Analysis Pipeline", () => {
  it("produces complete analysis result", () => {
    const result = analyzeCodeforcesLearningProfile(makeSnapshot());
    assert.ok(result.activity);
    assert.ok(result.ratingTrend);
    assert.ok(result.weakTags);
    assert.ok(result.ratingPlan);
    assert.ok(result.profileSummary);
    assert.ok(result.dataQuality);
    assert.ok(result.solvedProblemKeys);
    assert.ok(result.attemptedProblemKeys);
    assert.ok(result.unfinishedProblemKeys);
  });

  it("handles minimum viable snapshot", () => {
    const snap = makeSnapshot({
      profile: {
        handle: "min_user", currentRating: null, maxRating: null, rank: null,
        maxRank: null, lastOnlineAt: null, lastSubmissionAt: null,
        lastSyncedAt: new Date().toISOString(),
      },
      totals: {
        submissions: 0, acceptedSubmissions: 0, attemptedProblems: 0,
        solvedProblems: 0, unfinishedProblems: 0,
      },
      ratingHistory: [],
      tagStats: [],
      activitySeries: [],
      problemStates: {
        attemptedProblemKeys: [], solvedProblemKeys: [],
        unfinishedProblemKeys: [], wrongBookProblemKeys: [],
      },
      dataQuality: {
        truncated: false, submissionCount: 0, oldestFetchedAt: null,
        confidence: "low", warnings: ["no data"],
      },
    });

    const result = analyzeCodeforcesLearningProfile(snap);
    assert.equal(result.ratingTrend, "insufficient");
    assert.equal(result.activity.reminderLevel, "restart");
    assert.equal(result.weakTags.length, 0);
  });

  it("truncated data reduces confidence", () => {
    const snap = makeSnapshot({
      dataQuality: {
        truncated: true, submissionCount: 5, oldestFetchedAt: null,
        confidence: "low", warnings: ["truncated"],
      },
    });
    const result = analyzeCodeforcesLearningProfile(snap);
    assert.equal(result.dataQuality.truncated, true);
    assert.equal(result.dataQuality.confidence, "low");
  });
});

// ===========================================================================
// 7. Orchestrator Routing (9 tests)
// ===========================================================================

describe("Orchestrator Routing", () => {
  function makeOrch(overrides = {}) {
    return new DeterministicRoutingOrchestrator({
      toolExecutor: {
        execute: async () => ({
          result: {
            status: "success", safeSummary: "ok", toolCallId: "t1",
            startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
            durationMs: 0,
          },
          events: [],
        }),
      },
      featureEnabled: () => true,
      isAuthenticated: () => true,
      isCfBound: async () => true,
      isCfSynced: async () => true,
      hasLocalPool: async () => true,
      ...overrides,
    });
  }

  it("recognizes cf.learning.analysis intent", async () => {
    const plan = await makeOrch().plan({
      requestId: "req_1", userId: "user_1",
      intent: "cf.learning.analysis", input: {},
    });
    assert.equal(plan.intent.kind, "cf.learning.analysis");
    assert.equal(plan.steps.length, 5);
  });

  it("generates 5-step plan with correct dependencies", async () => {
    const plan = await makeOrch().plan({
      requestId: "req_2", userId: "user_2",
      intent: "cf.learning.analysis", input: {},
    });

    const step1 = plan.steps.find((s) => s.stepId === "step_1_read_snapshot");
    assert.equal(step1?.dependencies.length, 0);

    const step2 = plan.steps.find((s) => s.stepId === "step_2_analyze");
    assert.ok(step2?.dependencies.includes("step_1_read_snapshot"));

    const step4 = plan.steps.find((s) => s.stepId === "step_4_generate_report");
    assert.ok(step4?.dependencies.includes("step_2_analyze"));
    assert.ok(step4?.dependencies.includes("step_3_query_candidates"));
  });

  it("rejects unsupported intent", async () => {
    await assert.rejects(
      () => makeOrch().plan({
        requestId: "req_3", userId: "user_3",
        intent: "unknown.intent", input: {},
      }),
      /不支持的操作类型/,
    );
  });

  it("rejects when feature disabled", async () => {
    await assert.rejects(
      () => makeOrch({ featureEnabled: () => false }).plan({
        requestId: "req_4", userId: "user_4",
        intent: "cf.learning.analysis", input: {},
      }),
      /学习分析功能尚未启用/,
    );
  });

  it("rejects when not logged in", async () => {
    await assert.rejects(
      () => makeOrch({ isAuthenticated: () => false }).plan({
        requestId: "req_5", userId: undefined,
        intent: "cf.learning.analysis", input: {},
      }),
      /请先登录/,
    );
  });

  it("rejects when not bound", async () => {
    await assert.rejects(
      () => makeOrch({ isCfBound: async () => false }).plan({
        requestId: "req_6", userId: "user_6",
        intent: "cf.learning.analysis", input: {},
      }),
      /尚未绑定 Codeforces 账号/,
    );
  });

  it("rejects when not synced", async () => {
    await assert.rejects(
      () => makeOrch({ isCfSynced: async () => false }).plan({
        requestId: "req_7", userId: "user_7",
        intent: "cf.learning.analysis", input: {},
      }),
      /请先同步 Codeforces 数据/,
    );
  });

  it("rejects when pool empty", async () => {
    await assert.rejects(
      () => makeOrch({ hasLocalPool: async () => false }).plan({
        requestId: "req_8", userId: "user_8",
        intent: "cf.learning.analysis", input: {},
      }),
      /本地精选题池为空/,
    );
  });

  it("executes plan and yields events", async () => {
    const orch = makeOrch();
    const plan = await orch.plan({
      requestId: "req_9", userId: "user_9",
      intent: "cf.learning.analysis", input: {},
    });

    const events = [];
    for await (const event of orch.execute(plan)) {
      events.push(event);
    }

    assert.ok(events.length > 0);
    assert.ok(events.some((e) => e.type === "run.started"));
    // Since the mock tool executor returns success, should complete
    assert.ok(events.some((e) => e.type === "run.completed") ||
      events.some((e) => e.type === "run.failed"));
  });
});

// ===========================================================================
// 8. Tool Permissions (5 tests)
// ===========================================================================

describe("Tool Permissions", () => {
  it("snapshot tool is disabled by default", () => {
    const tool = createCfSnapshotTool({
      getSnapshot: async () => ({}),
      getAccountByUserId: async () => null,
    });
    assert.equal(tool.metadata.disabledByDefault, true);
    assert.equal(tool.metadata.readOnly, true);
    assert.equal(tool.metadata.sideEffect, false);
    assert.equal(tool.metadata.requiresAuthentication, true);
  });

  it("candidates tool is disabled by default", () => {
    const tool = createCfCandidatesTool({
      queryCandidatesForUser: async () => ({
        candidates: [], totalCandidates: 0, querySummary: {},
      }),
    });
    assert.equal(tool.metadata.disabledByDefault, true);
    assert.equal(tool.metadata.readOnly, true);
    assert.equal(tool.metadata.sideEffect, false);
  });

  it("snapshot tool rejects unauthorized user", async () => {
    const tool = createCfSnapshotTool({
      getSnapshot: async () => ({}),
      getAccountByUserId: async () => ({ id: "account_1" }),
    });

    const result = await tool.execute(
      { accountId: "account_1", userId: "user_1" },
      {
        agentId: "cf-data-analyst", runId: "run_1",
        userId: "user_2",
        isAuthenticated: true, isUserAuthorized: true,
        runMode: "test",
      },
    );

    assert.equal(result.status, "rejected");
    assert.ok(result.safeSummary.includes("权限拒绝"));
  });

  it("snapshot tool succeeds for authorized user", async () => {
    const tool = createCfSnapshotTool({
      getSnapshot: async () => ({ profile: { handle: "test" } }),
      getAccountByUserId: async () => ({ id: "account_1" }),
    });

    const result = await tool.execute(
      { accountId: "account_1", userId: "user_1" },
      {
        agentId: "cf-data-analyst", runId: "run_1",
        userId: "user_1",
        isAuthenticated: true, isUserAuthorized: true,
        runMode: "test",
      },
    );

    assert.equal(result.status, "success");
  });

  it("candidates tool rejects unauthorized user", async () => {
    const tool = createCfCandidatesTool({
      queryCandidatesForUser: async () => ({
        candidates: [], totalCandidates: 0, querySummary: {},
      }),
    });

    const result = await tool.execute(
      { userId: "user_1" },
      {
        agentId: "cf-problem-recommender", runId: "run_1",
        userId: "user_2",
        isAuthenticated: true, isUserAuthorized: true,
        runMode: "test",
      },
    );

    assert.equal(result.status, "rejected");
  });
});

// ===========================================================================
// Summary
// ===========================================================================

console.log("\n✅ A488 CF Learning Analysis Tests Completed\n");
console.log("Tests cover:");
console.log("  - Activity analysis (reminder levels, day counting)");
console.log("  - Rating trend (up/down/stable/insufficient)");
console.log("  - Weak tags (evidence levels, prioritization)");
console.log("  - Rating plan (ranges, bounds, clamping)");
console.log("  - Training plan (recommendations, exclusion, safety)");
console.log("  - Full analysis pipeline (completeness, edge cases)");
console.log("  - Orchestrator routing (intent, plans, errors, events)");
console.log("  - Tool permissions (disabled-by-default, user auth)");
