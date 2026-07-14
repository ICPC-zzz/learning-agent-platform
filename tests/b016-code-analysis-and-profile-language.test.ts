import assert from "node:assert/strict";
import test from "node:test";

import { generateStructured } from "../packages/ai-core/src/model-gateway/structured-generation";
import {
  formatProblemProfileTag,
  formatProblemProfileText,
} from "../packages/ai-core/src/code-analysis/problem-profile-display";

test("structured generation shares one timeout budget with JSON repair", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (_input, init) => {
    callCount += 1;
    const signal = init?.signal;
    const delayMs = callCount === 1 ? 40 : 10_000;

    return await new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (callCount === 1) {
          resolve(new Response(JSON.stringify({
            choices: [{ message: { content: "not json" }, finish_reason: "stop" }],
          }), { status: 200 }));
        }
      }, delayMs);

      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    });
  };

  const startedAt = Date.now();
  try {
    const result = await generateStructured(
      {
        baseUrl: "https://spark-api-open.xf-yun.com/v1",
        authMode: "none",
        modelId: "test-model",
        timeoutMs: 80,
        supportsJsonSchema: true,
      },
      {
        messages: [{ role: "user", content: "Return JSON." }],
        jsonSchema: { type: "object" },
      },
    );

    assert.equal(callCount, 2);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, "TIMEOUT");
    assert.equal(result.hadFormatRepair, true);
    assert.ok(Date.now() - startedAt < 105, "repair must not receive a second full timeout");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("problem profile display text is Chinese while retaining canonical tag names", () => {
  assert.equal(formatProblemProfileTag("dp"), "动态规划（dp）");
  assert.equal(formatProblemProfileTag("greedy"), "贪心（greedy）");
  assert.equal(formatProblemProfileText("multiple test cases"), "多组测试数据");
  assert.equal(
    formatProblemProfileText("Rule estimate from constraints, tags, and common Codeforces difficulty distribution."),
    "根据约束、标签和常见 Codeforces 难度分布进行规则估算。",
  );
  assert.equal(
    formatProblemProfileText("This fallback is used when the model profiler is slow or unavailable."),
    "模型画像响应较慢或不可用时使用此备用估算。",
  );
  assert.equal(
    formatProblemProfileText("Problem rating is rule-estimated. It is suitable for recommendation bands; enter a rating manually for exact matching."),
    "题目 Rating 为规则估算值，适合用于推荐难度区间；如需精确匹配，请手动填写 Rating。",
  );
});
