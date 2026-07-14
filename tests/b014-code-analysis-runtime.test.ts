import assert from "node:assert/strict";
import test from "node:test";

import { resolveCodeAnalysisRuntimeLimits } from "../packages/ai-core/src/code-analysis/code-analysis-runtime";
import { generateStructured } from "../packages/ai-core/src/model-gateway/structured-generation";

test("code analysis gets enough time but keeps production latency bounded", () => {
  assert.deepEqual(resolveCodeAnalysisRuntimeLimits(30_000, 4_096), {
    timeoutMs: 120_000,
    maxOutputTokens: 4_096,
  });
  assert.deepEqual(resolveCodeAnalysisRuntimeLimits(140_000, 1_024), {
    timeoutMs: 140_000,
    maxOutputTokens: 1_024,
  });
  assert.deepEqual(resolveCodeAnalysisRuntimeLimits(300_000, 8_192), {
    timeoutMs: 150_000,
    maxOutputTokens: 4_096,
  });
});

test("structured generation never exceeds the configured output token budget", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await generateStructured(
      {
        baseUrl: "https://spark-api-open.xf-yun.com/v1",
        authMode: "none",
        modelId: "test-model",
        timeoutMs: 120_000,
        maxOutputTokens: 2_048,
      },
      {
        messages: [{ role: "user", content: "Return JSON." }],
        maxOutputChars: 8_192,
      },
    );

    assert.equal(result.success, true);
    assert.equal(requestBody?.max_tokens, 2_048);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
