import assert from "node:assert/strict";
import test from "node:test";

import { runPersonalizedCodeAnalysis } from "../packages/ai-core/src/code-analysis/personalized-orchestrator.ts";

test("starts code analysis before a slow problem profile finishes", async () => {
  let profileResolved = false;
  let codeAnalysisStarted = false;

  const result = await runPersonalizedCodeAnalysis(
    {
      problemStatement: "Find the shortest path.",
      sourceCode: "int main() { return 0; }",
      selectedLanguage: "cpp",
      enableCfProfile: false,
      refreshCfData: false,
      recommendFollowUp: false,
      userId: "user-1",
    },
    {
      userId: "user-1",
      profileProblem: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        profileResolved = true;
        return {
          rating: {
            value: 1700,
            range: [1600, 1800],
            source: "model_inferred",
            confidence: 0.93,
            reasoning: ["The constraints require graph shortest-path reasoning."],
          },
          tags: [{
            tag: "shortest paths",
            source: "model_inferred",
            confidence: 0.9,
            evidence: ["The statement asks for a shortest path."],
          }],
          problemType: ["graph"],
          requiredKnowledge: ["Dijkstra"],
          keyConstraints: ["n <= 2e5"],
          uncertaintyWarnings: [],
        };
      },
      runCodeAnalysis: async () => {
        codeAnalysisStarted = true;
        assert.equal(profileResolved, false);
        return {
          success: false,
          report: null,
          timeline: {
            events: [],
            totalDurationMs: 5,
            modelCallCount: 1,
            hadFormatRepair: false,
          },
          error: {
            code: "MODEL_TIMEOUT",
            safeMessage: "模型调用超时",
            retryable: true,
          },
          modelInfo: null,
        };
      },
    } as never,
  );

  assert.equal(codeAnalysisStarted, true);
  assert.equal(result.success, true);
  assert.equal(result.report?.problemProfile.rating.value, 1700);
  assert.equal(result.report?.problemProfile.rating.confidence, 0.93);
});
