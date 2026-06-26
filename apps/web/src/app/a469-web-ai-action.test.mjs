/**
 * A469 — Web AI Server Action / safety tests
 *
 * Tests: blocked returns blocked, prompt validation, no raw save, safety boundaries.
 *
 * Run: node apps/web/src/app/a469-web-ai-action.test.mjs
 */

import { strict as assert } from "node:assert";

const originalEnv = { ...process.env };

function setEnv(kv) {
  for (const [k, v] of Object.entries(kv)) {
    if (v === null || v === undefined) delete process.env[k];
    else process.env[k] = String(v);
  }
}

function clearAiEnv() {
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

// Dynamic import the server action
const action = await import("../lib/web-ai-server-action.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultPageContext() {
  return {
    currentPath: "/ai",
    pageTitle: "AI助手",
    pageType: "ask",
  };
}

function makeDefaultGuardEnv() {
  return {
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "sk-test",
    LAP_LLM_DEV_API_PASSWORD: undefined,
    LAP_LLM_DEV_MODEL: "test-model",
  };
}

// ---------------------------------------------------------------------------
// Tests: prompt validation
// ---------------------------------------------------------------------------

test("empty question → blocked", async () => {
  clearAiEnv();
  const result = await action.webAiServerAction({
    question: "",
    pageContext: makeDefaultPageContext(),
  }, makeDefaultGuardEnv());
  assert.equal(result.success, false);
  assert.ok(result.blockedReasons?.includes("question empty") || result.answerPreview.includes("blocked"));
});

test("question too long → blocked", async () => {
  clearAiEnv();
  const longQ = "x".repeat(2000); // Max is 1000
  const result = await action.webAiServerAction({
    question: longQ,
    pageContext: makeDefaultPageContext(),
  }, makeDefaultGuardEnv());
  assert.equal(result.success, false);
});

test("valid question → attempts guard check", async () => {
  clearAiEnv();
  setEnv({ NODE_ENV: "development" });
  // No env configured → guard blocks
  const result = await action.webAiServerAction({
    question: "什么是人工智能？",
    pageContext: makeDefaultPageContext(),
  });
  assert.equal(result.success, false);
  assert.ok(result.blockedReasons?.length > 0);
});

// ---------------------------------------------------------------------------
// Tests: blocked returns blocked status
// ---------------------------------------------------------------------------

test("blocked guard → returns blocked mode", async () => {
  clearAiEnv();
  setEnv({ NODE_ENV: "development" });
  const result = await action.webAiServerAction({
    question: "hello",
    pageContext: makeDefaultPageContext(),
  });
  assert.equal(result.success, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.devOnly, true);
  // safeToExposeToClient should have guard info
  assert.ok(result.safeToExposeToClient);
  assert.equal(result.safeToExposeToClient.guardMode, "blocked");
});

// ---------------------------------------------------------------------------
// Tests: no raw prompt/response saved
// ---------------------------------------------------------------------------

test("result does not contain raw prompt", async () => {
  clearAiEnv();
  setEnv({ NODE_ENV: "development" });
  const result = await action.webAiServerAction({
    question: "test question with sensitive data",
    pageContext: makeDefaultPageContext(),
  });
  // The result should not store the raw prompt
  const json = JSON.stringify(result);
  assert.ok(!json.includes("rawPrompt"), "no rawPrompt field");
  assert.ok(!json.includes("rawResponse"), "no rawResponse field");
});

// ---------------------------------------------------------------------------
// Tests: env compatibility
// ---------------------------------------------------------------------------

test("legacy env names work in server action", async () => {
  clearAiEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "legacy-key",
    LAP_LLM_DEV_MODEL: "legacy-model",
  });
  const guardResult = await action.webAiServerAction({
    question: "hello",
    pageContext: makeDefaultPageContext(),
  });
  // Should not crash — guard should evaluate
  assert.ok(guardResult.safeToExposeToClient || guardResult.blockedReasons);
});

// ---------------------------------------------------------------------------
// Tests: safety properties
// ---------------------------------------------------------------------------

test("result always has devOnly=true, productionReady=false", async () => {
  clearAiEnv();
  setEnv({ NODE_ENV: "development" });
  const result = await action.webAiServerAction({
    question: "test",
    pageContext: makeDefaultPageContext(),
  });
  assert.equal(result.devOnly, true);
  assert.equal(result.productionReady, false);
});

test("result does not expose env values anywhere", async () => {
  clearAiEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_LLM_DEV_ENDPOINT: "https://my-secret-endpoint.example.com/path",
    LAP_LLM_DEV_API_KEY: "sk-my-secret-key-999",
    LAP_LLM_DEV_APIPassword: "my-secret-password-888",
  });
  const result = await action.webAiServerAction({
    question: "test",
    pageContext: makeDefaultPageContext(),
  });
  const json = JSON.stringify(result);
  assert.ok(!json.includes("my-secret-endpoint"), "endpoint not leaked");
  assert.ok(!json.includes("sk-my-secret"), "api key not leaked");
  assert.ok(!json.includes("my-secret-password"), "password not leaked");
});

// ---------------------------------------------------------------------------
console.log(`\nA469 Web AI Action: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
