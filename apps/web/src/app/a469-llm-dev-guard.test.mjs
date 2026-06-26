/**
 * A469 — LLM Dev Provider Guard tests
 *
 * Tests: production blocked, allow missing, env missing, configured enabled, no value leak.
 *
 * Run: node apps/web/src/app/a469-llm-dev-guard.test.mjs
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

let mod;
async function loadMod() {
  mod = await import("../lib/llm-dev-provider-guard.ts");
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL: ${name} — ${e.message}`); }
}

await loadMod();

// ── Test: production blocked ──
test("production → blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "production",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("production_blocked"));
  assert.equal(g.mode, "blocked");
});

// ── Test: allow_dev_llm missing → blocked ──
test("allow_dev_llm missing → blocked", () => {
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("allow_dev_llm_missing"));
});

// ── Test: allow_web_ai missing → blocked ──
test("allow_web_ai missing → blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("allow_web_ai_missing"));
});

// ── Test: endpoint missing → blocked ──
test("endpoint missing → blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("endpoint_missing"));
});

// ── Test: api_key missing → blocked ──
test("api_key missing → blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("api_key_missing"));
});

// ── Test: model missing → blocked ──
test("model missing → blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.blockedReasons.includes("model_missing"));
});

// ── Test: all configured → ready ──
test("all configured → allowed=true, mode=ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, true);
  assert.equal(g.mode, "ready");
  assert.equal(g.blockedReasons.length, 0);
  assert.equal(g.devOnly, true);
  assert.equal(g.productionReady, false);
});

// ── Test: legacy env names work ──
test("legacy env names → allowed=true", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, true);
});

// ── Test: APIPassword alias ──
test("LAP_LLM_DEV_APIPassword alias → password detected", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_APIPassword: "legacy-pw",
    LAP_LLM_DEV_MODEL: "model",
  });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, true);
});

// ── Test: no env value leak in guard result ──
test("guard result does not leak env values", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://secret-spark.example.com/v1/chat?key=abc",
    LAP_LLM_DEV_API_KEY: "sk-secret-key-99999",
    LAP_LLM_DEV_API_PASSWORD: "secret-pw-88888",
    LAP_LLM_DEV_MODEL: "Spark Ultra-32K",
  });
  const g = mod.evaluateLlmDevGuard();
  const json = JSON.stringify(g);
  assert.ok(!json.includes("secret-spark"), "endpoint not in JSON");
  assert.ok(!json.includes("sk-secret"), "api key not in JSON");
  assert.ok(!json.includes("secret-pw"), "password not in JSON");
  // Model name is safe to expose
  assert.ok(json.includes("Spark Ultra-32K"), "model name IS exposed (safe)");
});

// ── Test: canCallLlmDevProvider ──
test("canCallLlmDevProvider returns false when blocked", () => {
  clearAllEnv();
  assert.equal(mod.canCallLlmDevProvider(), false);
});

test("canCallLlmDevProvider returns true when ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(mod.canCallLlmDevProvider(), true);
});

// ── Test: neither env set → blocked ──
test("neither canonical nor legacy allow env set → blocked", () => {
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });
  const g = mod.evaluateLlmDevGuard();
  assert.equal(g.allowed, false);
  assert.ok(g.missingEnvNames.length > 0);
});

// ---------------------------------------------------------------------------
process.env = originalEnv;
console.log(`\nA469 LLM Dev Guard: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
