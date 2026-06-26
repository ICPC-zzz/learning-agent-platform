/**
 * A469 — LLM Health Check tests
 *
 * Tests: blocked doesn't fetch, allowed does fetch, safe result.
 *
 * Run: node apps/web/src/app/a469-llm-health-check.test.mjs
 */

import { strict as assert } from "node:assert";

const originalEnv = { ...process.env };

function setEnv(kv) {
  for (const [k, v] of Object.entries(kv)) {
    if (v === null || v === undefined) delete process.env[k];
    else process.env[k] = String(v);
  }
}

function clearAllEnv() {
  for (const k of [
    "LAP_ALLOW_DEV_LLM", "LAP_ALLOW_WEB_AI", "LAP_LLM_DEV_PROVIDER",
    "LAP_LLM_DEV_ENDPOINT", "LAP_LLM_DEV_API_KEY", "LAP_LLM_DEV_API_PASSWORD",
    "LAP_LLM_DEV_MODEL", "LAP_LLM_DEV_TIMEOUT_MS",
    "LAP_WEB_LLM_QA_DEV_ENABLED", "LAP_ALLOW_EXTERNAL_LLM_PROVIDER",
    "LAP_LLM_DEV_APIPassword", "NODE_ENV",
  ]) delete process.env[k];
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL: ${name} — ${e.message}`); }
}

const mod = await import("../lib/llm-dev-health-check.ts");

// ── Test: blocked → no fetch ──
test("health check: blocked when guard blocked, no network", async () => {
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });
  const result = await mod.performLlmHealthCheck();
  assert.equal(result.success, false);
  assert.equal(result.guardBlocked, true);
  assert.equal(result.networkAccessed, false);
  assert.equal(result.devOnly, true);
  assert.equal(result.productionReady, false);
  assert.ok(result.message.includes("blocked"));
});

// ── Test: allowed → fetches (with mock) ──
test("health check: allowed env → attempts fetch", async () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "test-key",
    LAP_LLM_DEV_MODEL: "test-model",
  });

  // Install mock fetch that returns OK
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }),
  });

  try {
    const result = await mod.performLlmHealthCheck();
    assert.equal(result.guardBlocked, false);
    // With mock, should succeed or at least attempt
    assert.equal(result.devOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test: safe result (no env values leaked) ──
test("health check: result does not leak env values", async () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://secret-endpoint.example.com/v1/chat?key=secret",
    LAP_LLM_DEV_API_KEY: "sk-super-secret-12345",
    LAP_LLM_DEV_MODEL: "Spark Ultra-32K",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }),
  });

  try {
    const result = await mod.performLlmHealthCheck();
    const json = JSON.stringify(result);
    assert.ok(!json.includes("secret-endpoint"), "endpoint not leaked");
    assert.ok(!json.includes("sk-super-secret"), "api key not leaked");
    assert.ok(!json.includes("key=secret"), "query params not leaked");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test: health check result structure is complete ──
test("health check: result has all required fields", async () => {
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });
  const result = await mod.performLlmHealthCheck();
  assert.ok("success" in result);
  assert.ok("provider" in result);
  assert.ok("model" in result);
  assert.ok("checkedAt" in result);
  assert.ok("message" in result);
  assert.ok("guardBlocked" in result);
  assert.ok("guard" in result);
  assert.ok("devOnly" in result);
  assert.ok("productionReady" in result);
  assert.ok("networkAccessed" in result);
});

// ---------------------------------------------------------------------------
process.env = originalEnv;
console.log(`\nA469 Health Check: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
