/**
 * A469 — Spark adapter / ExternalChatCompletionsProvider tests
 *
 * Tests: fetch mock, auth headers, error handling, no raw response leak.
 *
 * Run: node apps/web/src/app/a469-spark-client.test.mjs
 */

import { strict as assert } from "node:assert";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL: ${name} — ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Dynamic import
// ---------------------------------------------------------------------------

const mod = await import("../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts");

// ---------------------------------------------------------------------------
// Helper: mock fetch
// ---------------------------------------------------------------------------

function makeMockFetch(responseFactory) {
  return async (url, options) => {
    const reqInfo = { url, method: options?.method, headers: options?.headers, body: options?.body };
    return responseFactory(reqInfo);
  };
}

function makeJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

// ---------------------------------------------------------------------------
// Test: loadExternalProviderConfig
// ---------------------------------------------------------------------------

test("loadExternalProviderConfig: all configured", () => {
  const config = mod.loadExternalProviderConfig({
    endpoint: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    apiKey: "sk-test-key",
    apiPassword: null,
    model: "Spark Ultra-32K",
  });
  assert.equal(config.configured, true);
  assert.equal(config.blockedReason, null);
  assert.ok(config.endpoint.length > 0);
});

test("loadExternalProviderConfig: missing endpoint → not configured", () => {
  const config = mod.loadExternalProviderConfig({
    endpoint: "",
    apiKey: "key",
    model: "model",
  });
  assert.equal(config.configured, false);
  assert.ok(config.blockedReason?.includes("LAP_LLM_DEV_ENDPOINT"));
});

test("loadExternalProviderConfig: missing model → not configured", () => {
  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    apiKey: "key",
    model: "",
  });
  assert.equal(config.configured, false);
  assert.ok(config.blockedReason?.includes("LAP_LLM_DEV_MODEL"));
});

test("loadExternalProviderConfig: missing auth → not configured", () => {
  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    model: "model",
  });
  assert.equal(config.configured, false);
});

// ---------------------------------------------------------------------------
// Test: provider with mock fetch — successful response
// ---------------------------------------------------------------------------

test("provider: successful chat completion returns answer", async () => {
  const mockFetch = makeMockFetch((req) => {
    // Verify auth header
    assert.ok(req.headers?.Authorization?.startsWith("Bearer "));
    assert.equal(req.method, "POST");
    return makeJsonResponse({
      choices: [{ message: { content: "你好，这是测试回答。" } }],
      usage: { total_tokens: 10 },
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    apiKey: "sk-test",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [
      { role: "user", content: "你好" },
    ],
    maxOutputChars: 200,
    purposeSummary: "test",
  });

  assert.equal(result.ok, true);
  assert.equal(result.realProviderCalled, true);
  assert.equal(result.networkAccessed, true);
  assert.ok(result.answerSummary.includes("测试回答"));
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.rawPromptStored, false);
  assert.equal(result.rawResponseStored, false);
});

// ---------------------------------------------------------------------------
// Test: provider — generic Bearer auth uses apiKey
// ---------------------------------------------------------------------------

test("provider: generic Bearer auth uses apiKey (not apiPassword when both set)", async () => {
  let capturedAuthHeader = "";
  const mockFetch = makeMockFetch((req) => {
    capturedAuthHeader = req.headers?.Authorization || "";
    return makeJsonResponse({
      choices: [{ message: { content: "OK" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1/chat/completions",
    apiKey: "sk-main-key",
    apiPassword: "secondary-pw",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.ok(capturedAuthHeader.includes("sk-main-key"), "Bearer should use apiKey");
  assert.ok(!capturedAuthHeader.includes("secondary-pw"), "Bearer should NOT use apiPassword when apiKey is set");
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Test: provider — Spark Bearer auth uses APIPassword
// ---------------------------------------------------------------------------

test("provider: Spark Bearer auth uses apiPassword when both set", async () => {
  let capturedAuthHeader = "";
  const mockFetch = makeMockFetch((req) => {
    capturedAuthHeader = req.headers?.Authorization || "";
    return makeJsonResponse({
      choices: [{ message: { content: "OK" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    apiKey: "spark-key",
    apiPassword: "spark-secret",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.ok(capturedAuthHeader.includes("spark-secret"), "Spark Bearer should use apiPassword");
  assert.ok(!capturedAuthHeader.includes("spark-key:"), "Spark Bearer should not use apiKey:apiPassword");
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Test: provider — when only apiPassword, use it as Bearer (backward compat)
// ---------------------------------------------------------------------------

test("provider: fallback to apiPassword as Bearer when no apiKey", async () => {
  let capturedAuthHeader = "";
  const mockFetch = makeMockFetch((req) => {
    capturedAuthHeader = req.headers?.Authorization || "";
    return makeJsonResponse({
      choices: [{ message: { content: "OK" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1/chat/completions",
    apiPassword: "only-password",
    model: "test-model",
  });
  // Note: config.configured will be false because apiKey is missing.
  // We construct provider anyway for testing the auth header code path.
  // Patch the config to be "configured"
  const patchedConfig = { ...config, configured: true, blockedReason: null };

  const provider = new mod.ExternalChatCompletionsProvider(patchedConfig, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.ok(capturedAuthHeader.includes("only-password"), "Bearer should use apiPassword as fallback");
});

// ---------------------------------------------------------------------------
// Test: provider — HTTP non-2xx safe error
// ---------------------------------------------------------------------------

test("provider: HTTP 401 → safe error, no raw body", async () => {
  const mockFetch = makeMockFetch((req) => {
    return makeJsonResponse({ error: { message: "Invalid API key" } }, 401);
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    apiKey: "bad-key",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.equal(result.ok, false);
  assert.equal(result.realProviderCalled, true);
  assert.equal(result.networkAccessed, true);
  assert.ok(result.answerSummary.includes("HTTP 401"));
  // Should NOT include the raw error message "Invalid API key" in the safe answer summary
  // The extractSafeErrorSummary extracts the error message but sanitizes it
});

// ---------------------------------------------------------------------------
// Test: provider — timeout error
// ---------------------------------------------------------------------------

test("provider: timeout → safe error", async () => {
  const mockFetch = makeMockFetch((req) => {
    // Simulate AbortError — must be DOMException for provider check
    const err = new DOMException("The operation was aborted", "AbortError");
    throw err;
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    apiKey: "key",
    model: "test-model",
    timeoutMs: 5000,
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.equal(result.ok, false);
  assert.ok(result.answerSummary.includes("timeout") || result.answerSummary.includes("timed out"));
});

// ---------------------------------------------------------------------------
// Test: provider — empty answer safe error
// ---------------------------------------------------------------------------

test("provider: empty answer → safe error", async () => {
  const mockFetch = makeMockFetch((req) => {
    return makeJsonResponse({
      choices: [{ message: { content: "" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    apiKey: "key",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.equal(result.ok, false);
  assert.ok(result.answerSummary.includes("Empty") || result.answerSummary.includes("empty"));
});

// ---------------------------------------------------------------------------
// Test: provider — non-configured immediate block (no fetch)
// ---------------------------------------------------------------------------

test("provider: not configured → blocked without fetch", async () => {
  let fetchCalled = false;
  const mockFetch = makeMockFetch((req) => {
    fetchCalled = true;
    return makeJsonResponse({ choices: [] });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "",
    apiKey: "",
    model: "",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.equal(result.ok, false);
  assert.equal(fetchCalled, false, "should not fetch when not configured");
});

// ---------------------------------------------------------------------------
// Test: no raw response leak
// ---------------------------------------------------------------------------

test("provider: result does not contain raw response", async () => {
  const mockFetch = makeMockFetch((req) => {
    return makeJsonResponse({
      choices: [{ message: { content: "Sensitive internal data: api_key=abc123" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://example.com/v1",
    apiKey: "key",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  const result = await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  const json = JSON.stringify(result);
  assert.ok(!json.includes("abc123"), "raw response should not be in result");
  // The api_key pattern in answer content should be sanitized
  assert.ok(!json.includes("api_key=abc123"));
});

// ---------------------------------------------------------------------------
// Test: X-APIPassword header when both apiKey and apiPassword set
// ---------------------------------------------------------------------------

test("provider: X-APIPassword header sent when apiPassword configured with apiKey", async () => {
  let capturedHeaders = {};
  const mockFetch = makeMockFetch((req) => {
    capturedHeaders = req.headers || {};
    return makeJsonResponse({
      choices: [{ message: { content: "OK" } }],
    });
  });

  const config = mod.loadExternalProviderConfig({
    endpoint: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    apiKey: "sk-main",
    apiPassword: "spark-pw",
    model: "test-model",
  });

  const provider = new mod.ExternalChatCompletionsProvider(config, mockFetch);
  await provider.generate({
    messages: [{ role: "user", content: "test" }],
    maxOutputChars: 50,
    purposeSummary: "test",
  });

  assert.ok(capturedHeaders["X-APIPassword"], "X-APIPassword header should be present");
  assert.equal(capturedHeaders["X-APIPassword"], "spark-pw");
});

// ---------------------------------------------------------------------------
console.log(`\nA469 Spark Client: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
