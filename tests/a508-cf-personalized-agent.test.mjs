import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  buildUpcomingContestItems,
  classifyCodeforcesAssistantIntent,
  expireUpcomingCodeforcesContestCacheForTests,
  getUpcomingCodeforcesContests,
  resetUpcomingCodeforcesContestCacheForTests,
  resolveLearnerTrainingProfileFromSources,
} from "../apps/web/src/lib/assistant/providers/codeforces-personalized-provider.ts";
import {
  createUpcomingCodeforcesContestsDefinition,
  createResolveLearnerTrainingProfileDefinition,
} from "../apps/web/src/lib/assistant/tools/codeforces-tools.ts";
import { executeAssistantTool } from "../apps/web/src/lib/assistant/tools/tool-executor.ts";
import { createEmptyAssistantLearningContext } from "../apps/web/src/lib/assistant/user-learning-context.ts";
import {
  isReadonlyLearningArtifactMemory,
  isUserManagedLongTermMemory,
} from "../apps/web/src/lib/assistant/learning-artifact-classification.ts";

const originalFetch = globalThis.fetch;
const cfGuardEnv = {
  LAP_ALLOW_EXTERNAL_PROBLEM_API: "1",
  LAP_PROBLEM_API_PROVIDER: "codeforces",
  LAP_PROBLEM_API_BASE_URL: "https://codeforces.com/api",
};

afterEach(() => {
  resetUpcomingCodeforcesContestCacheForTests();
  globalThis.fetch = originalFetch;
});

function okJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function failedResponse(status = 503) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  };
}

function contest(id, offsetMs, phase = "BEFORE") {
  const nowMs = 1_700_000_000_000;
  return {
    id,
    name: `Codeforces Round ${id}`,
    type: "CF",
    phase,
    frozen: false,
    durationSeconds: 7_200,
    startTimeSeconds: Math.floor((nowMs + offsetMs) / 1000),
    relativeTimeSeconds: -Math.floor(offsetMs / 1000),
  };
}

describe("A508 Codeforces personalized assistant closure", () => {
  it("prefers the latest valid learning report estimate over official rating", () => {
    const profile = resolveLearnerTrainingProfileFromSources({
      currentHandle: "tourist",
      officialRating: 1260,
      reportCandidates: [{
        content: "Codeforces learning report",
        generatedAt: "2024-06-27T08:00:00.000Z",
        updatedAt: "2024-06-27T08:00:00.000Z",
        handle: "tourist",
        officialRating: 1260,
        estimatedRealRating: 1575,
        recommendedMinRating: 1475,
        recommendedMaxRating: 1725,
        weakTags: ["dp", "graphs"],
        confidence: 0.82,
      }],
    });

    assert.equal(profile.source, "learning_report");
    assert.equal(profile.officialRating, 1260);
    assert.equal(profile.estimatedRealRating, 1575);
    assert.equal(profile.effectiveTrainingRating, 1575);
    assert.equal(profile.recommendedMinRating, 1475);
    assert.equal(profile.recommendedMaxRating, 1725);
    assert.match(profile.evidenceSummary, /1260/);
    assert.match(profile.evidenceSummary, /1575/);
  });

  it("falls back to report training range midpoint when estimate is absent", () => {
    const profile = resolveLearnerTrainingProfileFromSources({
      currentHandle: "learner",
      officialRating: 1260,
      reportCandidates: [{
        content: "Codeforces learning report",
        generatedAt: "2024-06-27T08:00:00.000Z",
        updatedAt: "2024-06-27T08:00:00.000Z",
        handle: "learner",
        officialRating: 1260,
        estimatedRealRating: null,
        recommendedMinRating: 1400,
        recommendedMaxRating: 1600,
        weakTags: ["implementation"],
        confidence: 0.6,
      }],
    });

    assert.equal(profile.source, "learning_report");
    assert.equal(profile.effectiveTrainingRating, 1500);
    assert.equal(profile.recommendedMinRating, 1400);
    assert.equal(profile.recommendedMaxRating, 1600);
  });

  it("rejects mismatched learning reports and falls back to official rating", () => {
    const profile = resolveLearnerTrainingProfileFromSources({
      currentHandle: "current-handle",
      officialRating: 1260,
      reportCandidates: [{
        content: "Codeforces learning report",
        generatedAt: "2024-06-27T08:00:00.000Z",
        updatedAt: "2024-06-27T08:00:00.000Z",
        handle: "another-handle",
        officialRating: 999,
        estimatedRealRating: 1800,
        recommendedMinRating: 1700,
        recommendedMaxRating: 1900,
        weakTags: [],
        confidence: 0.9,
      }],
    });

    assert.equal(profile.source, "official_rating");
    assert.equal(profile.effectiveTrainingRating, 1260);
    assert.equal(profile.rejectedReportReason, "learning_report_handle_mismatch");
  });

  it("routes Codeforces intents deterministically", () => {
    assert.equal(
      classifyCodeforcesAssistantIntent("最近有什么 Codeforces 比赛可以参加？"),
      "contest_recommendation",
    );
    assert.equal(
      classifyCodeforcesAssistantIntent("根据真实水平推荐 Codeforces 刷题，并看看近期有什么比赛"),
      "contest_recommendation",
    );
    assert.equal(
      classifyCodeforcesAssistantIntent("我最近参加过哪些 Codeforces 比赛？"),
      "historical_user_contests",
    );
  });

  it("keeps upcoming contest data future-only and sorted", () => {
    const nowMs = 1_700_000_000_000;
    const result = buildUpcomingContestItems([
      contest(3, -3_600_000, "FINISHED"),
      contest(2, 86_400_000),
      contest(1, 3_600_000),
      contest(4, 60_000, "CODING"),
    ], {
      nowMs,
      fetchedAt: "2026-06-27T08:00:00.000Z",
      source: "codeforces_api",
      limit: 5,
    });

    assert.deepEqual(result.map((item) => item.contestId), [1, 2]);
    assert.equal(result.every((item) => item.phase === "BEFORE"), true);
  });

  it("uses fresh and stale cache for official upcoming contest fetches", async () => {
    const nowMs = 1_700_000_000_000;
    let fetchCalls = 0;
    globalThis.fetch = async (url) => {
      fetchCalls += 1;
      assert.equal(String(url), "https://codeforces.com/api/contest.list?gym=false");
      return okJsonResponse({
        status: "OK",
        result: [contest(1, 3_600_000)],
      });
    };

    const first = await getUpcomingCodeforcesContests({ nowMs, env: cfGuardEnv });
    const second = await getUpcomingCodeforcesContests({ nowMs: nowMs + 1_000, env: cfGuardEnv });

    assert.equal(first.source, "codeforces_api");
    assert.equal(second.source, "fresh_cache");
    assert.equal(fetchCalls, 1);

    expireUpcomingCodeforcesContestCacheForTests(nowMs + 601_000);
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return failedResponse(503);
    };

    const stale = await getUpcomingCodeforcesContests({
      nowMs: nowMs + 601_000,
      env: cfGuardEnv,
    });

    assert.equal(stale.source, "stale_cache");
    assert.equal(stale.contests.length, 1);
    assert.equal(fetchCalls, 2);
  });

  it("rejects personalized profile tool calls without trusted user session", async () => {
    const result = await executeAssistantTool(
      createResolveLearnerTrainingProfileDefinition(),
      {},
      {
        userId: null,
        question: "推荐 Codeforces 训练",
        pageContext: { route: "/ai", pageType: "ai" },
        learningContext: createEmptyAssistantLearningContext(null, false),
      },
    );

    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "session_required");
  });

  it("classifies learning reports as readonly context instead of managed long-term memory", () => {
    const memory = {
      id: "m1",
      userId: "u1",
      memoryType: "RETRIEVABLE",
      content: "Codeforces learning report; handle tourist; official 1260; estimated 1575; training 1475-1725; weak tags dp, graphs",
      category: "learning",
      source: "assistant_suggested",
      enabled: true,
      importance: 0.8,
      metadata: {
        artifactKind: "cf_learning_report",
        readonlyContext: true,
        memoryKind: "readonly_context",
      },
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
    };

    assert.equal(isReadonlyLearningArtifactMemory(memory), true);
    assert.equal(isUserManagedLongTermMemory(memory), false);
  });

  it("returns grounded evidence for upcoming contest tool requests", async () => {
    const customFetch = async (url) => {
      assert.equal(String(url), "https://codeforces.com/api/contest.list?gym=false");
      return okJsonResponse({
        status: "OK",
        result: [{
          id: 10,
          name: "Codeforces Round 10",
          type: "CF",
          phase: "BEFORE",
          frozen: false,
          durationSeconds: 7_200,
          startTimeSeconds: Math.floor((Date.now() + 3_600_000) / 1000),
          relativeTimeSeconds: -3_600,
        }],
      });
    };

    const result = await executeAssistantTool(
      createUpcomingCodeforcesContestsDefinition(),
      { limit: 1 },
      {
        userId: null,
        question: "最近有什么 Codeforces 比赛可以参加？",
        pageContext: { route: "/ai", pageType: "ai" },
        learningContext: createEmptyAssistantLearningContext(null, false),
        guardEnv: cfGuardEnv,
        customFetch,
      },
    );

    assert.equal(result.ok, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.sources[0]?.source, "Codeforces 官方比赛列表");
    assert.match(result.summary, /Codeforces Round 10/);
  });
});
