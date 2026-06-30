import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyCodeforcesAssistantIntent,
} from "../apps/web/src/lib/assistant/providers/codeforces-personalized-provider.ts";
import { runAssistantOrchestrator } from "../apps/web/src/lib/assistant/assistant-orchestrator.ts";

const cfGuardEnv = {
  LAP_ALLOW_EXTERNAL_PROBLEM_API: "1",
  LAP_PROBLEM_API_PROVIDER: "codeforces",
  LAP_PROBLEM_API_BASE_URL: "https://codeforces.com/api",
};

describe("A517 Codeforces intent routing", () => {
  it("routes Chinese contest recommendation to contest intent, not problem recommendation", () => {
    assert.equal(
      classifyCodeforcesAssistantIntent("我让你推荐一场适合我的 Codeforces 比赛"),
      "contest_recommendation",
    );
    assert.equal(
      classifyCodeforcesAssistantIntent("推荐几道 1600 左右的题"),
      "problem_recommendation",
    );
  });

  it("contest recommendation uses upcoming contests and does not call candidate problem tool", async () => {
    const customFetch = async (url) => {
      assert.equal(String(url), "https://codeforces.com/api/contest.list?gym=false");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "OK",
          result: [{
            id: 1977,
            name: "Codeforces Round 1977 (Div. 3)",
            type: "CF",
            phase: "BEFORE",
            frozen: false,
            durationSeconds: 7200,
            startTimeSeconds: Math.floor((Date.now() + 3600_000) / 1000),
            relativeTimeSeconds: -3600,
          }],
        }),
      };
    };

    const response = await runAssistantOrchestrator({
      userId: null,
      question: "现在为我推荐一场最适合我的比赛",
      pageContext: { route: "/ai", pageType: "ai" },
    }, {
      guardEnv: cfGuardEnv,
      customFetch,
    });

    assert.equal(response.state, "ok");
    assert.ok(response.usedTools.includes("getUpcomingCodeforcesContests"));
    assert.ok(response.usedTools.includes("resolveLearnerTrainingProfile"));
    assert.equal(response.usedTools.includes("getPersonalizedCodeforcesCandidates"), false);
    assert.match(response.message, /最推荐/);
    assert.doesNotMatch(response.message, /推荐题目|候选题/);
  });
});
