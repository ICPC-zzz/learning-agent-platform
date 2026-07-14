import assert from "node:assert/strict";
import test from "node:test";

import { resolveCodeAnalysisRuntimeLimits } from "../packages/ai-core/src/code-analysis/code-analysis-runtime.ts";
import { runPersonalizedCodeAnalysis } from "../packages/ai-core/src/code-analysis/personalized-orchestrator.ts";
import { generateStructured } from "../packages/ai-core/src/model-gateway/structured-generation.ts";

test("代码分析允许环境模型使用 4096 token 输出完整报告", () => {
  assert.deepEqual(resolveCodeAnalysisRuntimeLimits(60_000, 4_096), {
    timeoutMs: 120_000,
    maxOutputTokens: 4_096,
  });
});

test("模型明确因长度截断时不再进行无效的 JSON 修复调用", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      choices: [{
        message: { content: '{"taskOverview":' },
        finish_reason: "length",
      }],
      usage: { prompt_tokens: 100, completion_tokens: 4_096, total_tokens: 4_196 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await generateStructured(
      {
        baseUrl: "https://spark-api-open.xf-yun.com/v1",
        authMode: "none",
        modelId: "test-model",
        timeoutMs: 120_000,
        maxOutputTokens: 4_096,
        supportsJsonSchema: true,
      },
      {
        messages: [{ role: "user", content: "Return JSON." }],
        jsonSchema: { type: "object" },
        maxOutputChars: 8_192,
      },
    );

    assert.equal(callCount, 1);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, "OUTPUT_TRUNCATED");
    assert.equal(result.hadFormatRepair, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("个性化报告保留代码分析的真实失败原因", async () => {
  const result = await runPersonalizedCodeAnalysis(
    {
      problemStatement: "Find a path.",
      sourceCode: "int main() { return 0; }",
      selectedLanguage: "cpp",
      enableCfProfile: false,
      refreshCfData: false,
      recommendFollowUp: false,
      userId: "user-1",
    },
    {
      userId: "user-1",
      profileProblem: async () => ({
        rating: { value: 1200, range: null, source: "rule_estimated", confidence: 0.5, reasoning: [] },
        tags: [],
        problemType: [],
        requiredKnowledge: [],
        keyConstraints: [],
        uncertaintyWarnings: [],
      }),
      runCodeAnalysis: async () => ({
        success: false,
        report: null,
        timeline: { events: [], totalDurationMs: 73_000, modelCallCount: 2, hadFormatRepair: true },
        error: { code: "INVALID_JSON", safeMessage: "无法解析模型返回的 JSON", retryable: false },
        modelInfo: null,
      }),
    } as never,
  );

  assert.deepEqual(result.report?.baseReportError, {
    code: "INVALID_JSON",
    safeMessage: "无法解析模型返回的 JSON",
    retryable: false,
  });
});
