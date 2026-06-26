import assert from "node:assert/strict";
import test from "node:test";

const mod = await import("./assistant-orchestrator.ts");

function makeGuardEnv() {
  return {
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ASSISTANT_ENABLED: "true",
    LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED: "true",
    LAP_LLM_DEV_PROVIDER: "xunfei-spark",
    LAP_LLM_DEV_ENDPOINT: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    LAP_LLM_DEV_API_KEY: "test-key",
    LAP_LLM_DEV_MODEL: "Spark Ultra-32K",
  };
}

test("runAssistantOrchestrator uses provided learning context when no session is available", async () => {
  const response = await mod.runAssistantOrchestrator(
    {
      question: "查看一下我最近阅读的文章和刷题，给出建议",
      pageContext: {
        route: "/ai",
        pageType: "ai",
        title: "AI",
      },
      userId: null,
      learningContext: {
        userLabel: "Dev",
        hasSession: true,
        abilityBand: "intermediate",
        currentLevel: "intermediate",
        recentPracticeCount: 2,
        recentProblemIds: ["cf-1"],
        recentAttemptSummary: "DB recent practice summary",
        recentWrongBookSummary: "",
        recentReadingSummary: "DB recent reading summary",
        learningGoalSummary: "DB goal summary",
        recentRouteHint: "/problems/cf-1",
      },
    },
    {
      guardEnv: makeGuardEnv(),
      customFetch: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "unused" } }] }),
      }),
    },
  );

  assert.equal(response.state, "ok");
  assert.match(response.message, /DB recent reading summary/);
  assert.match(response.message, /DB recent practice summary|最近刷题/);
});
