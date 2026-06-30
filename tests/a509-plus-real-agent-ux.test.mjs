import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCodeforcesRefreshReminderMemory,
  resolveAssistantIntent,
} from "../apps/web/src/lib/assistant/assistant-intent-resolver.ts";
import { runAssistantOrchestrator } from "../apps/web/src/lib/assistant/assistant-orchestrator.ts";
import {
  selectPersonalizedCodeforcesCandidatesFromRecords,
} from "../apps/web/src/lib/assistant/providers/codeforces-personalized-provider.ts";

const fixedMemoryInput = "更新一下记忆，以后我每次让你推荐cf题目或者询问后续刷题建议的时候，记得先提醒我先刷新学习分析报告和复习报告再向你提问";
const canonicalMemory = "当用户请求推荐 Codeforces 题目或询问后续刷题建议时，先提醒用户刷新学习分析报告和复习报告，再继续提供建议。";

describe("A509+ real Chinese Agent UX repair", () => {
  it("routes the fixed regression input as MEMORY_WRITE before Codeforces", () => {
    const intent = resolveAssistantIntent(fixedMemoryInput);

    assert.equal(intent.type, "MEMORY_WRITE");
    assert.equal(intent.normalizedMemory, canonicalMemory);
    assert.match(intent.confirmationText, /已更新长期记忆/);
    assert.equal(isCodeforcesRefreshReminderMemory(fixedMemoryInput), true);
    assert.equal(isCodeforcesRefreshReminderMemory(canonicalMemory), true);
  });

  it("does not call Codeforces tools for direct MEMORY_WRITE orchestrator calls", async () => {
    const response = await runAssistantOrchestrator({
      question: fixedMemoryInput,
      pageContext: { route: "/ai", pageType: "ai" },
      userId: "user-a",
    });

    assert.equal(response.state, "ok");
    assert.match(response.message, /已更新长期记忆/);
    assert.equal(response.usedTools.length, 0);
    assert.equal(
      response.toolTimeline?.some((item) =>
        item.toolName === "resolveLearnerTrainingProfile"
        || item.toolName === "getPersonalizedCodeforcesCandidates"
      ),
      false,
    );
  });

  it("progressively falls back from weak tags to nearest rating for a 1575 profile", async () => {
    const result = await selectPersonalizedCodeforcesCandidatesFromRecords({
      userId: "user-a",
      profile: {
        officialRating: 1260,
        estimatedRealRating: 1575,
        effectiveTrainingRating: 1575,
        recommendedMinRating: 1475,
        recommendedMaxRating: 1725,
        weakTags: ["dp", "graphs"],
        confidence: 0.82,
        source: "learning_report",
        generatedAt: "2026-06-27T00:00:00.000Z",
        handle: "learner",
        evidenceSummary: "测试画像",
        rejectedReportReason: null,
      },
      records: [
        makeRecord("target-any", 1001, "A", 1500, ["math"]),
        makeRecord("expanded", 1002, "B", 1800, ["strings"]),
        makeRecord("nearest", 1003, "C", 1900, ["greedy"]),
      ],
      accountRepo: emptyAccountRepo,
      limit: 3,
    });

    assert.equal(result.candidates.length, 3);
    assert.deepEqual(
      result.candidates.map((candidate) => candidate.candidateLevel),
      ["target_range_any_tag", "expanded_range", "nearest_rating"],
    );
    assert.equal(result.candidates[0].rating >= 1475 && result.candidates[0].rating <= 1725, true);
    assert.equal(result.candidates[1].rating, 1800);
    assert.equal(result.candidates[2].rating, 1900);
    assert.equal(result.warnings.some((warning) => warning.includes("薄弱标签")), true);
    assert.equal(result.warnings.some((warning) => warning.includes("放宽 100")), true);
    assert.equal(result.warnings.some((warning) => warning.includes("最接近目标 Rating")), true);
  });
});

const emptyAccountRepo = {
  async getAccountByUserId() {
    return null;
  },
  async getProblemStatsByAccount() {
    return [];
  },
};

function makeRecord(id, contestId, index, rating, tags) {
  return {
    id,
    title: `Problem ${id}`,
    source: "codeforces",
    sourceUrl: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    metadata: {
      contestId,
      index,
      rating,
      solvedCount: 1000,
      type: "PROGRAMMING",
    },
    difficulty: "medium",
    tags,
  };
}
