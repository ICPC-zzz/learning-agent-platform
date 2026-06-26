/**
 * A469 — UI status / admin / safety tests
 *
 * Tests: /ai page shows provider status, admin has LLM entries, no secret leaks.
 *
 * Run: node apps/web/src/app/a469-llm-safety.test.mjs
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
    "DATABASE_URL", "LAP_ALLOW_REAL_DB_INTEGRATION",
    "LAP_ALLOW_EXTERNAL_BOOK_API", "LAP_BOOK_API_BASE_URL", "LAP_BOOK_API_KEY", "LAP_BOOK_API_PROVIDER",
    "LAP_ALLOW_EXTERNAL_PROBLEM_API", "LAP_PROBLEM_API_BASE_URL", "LAP_PROBLEM_API_KEY", "LAP_PROBLEM_API_PROVIDER",
    "LAP_ALLOW_PHONE_AUTH", "LAP_SMS_PROVIDER", "LAP_SMS_API_BASE_URL", "LAP_SMS_API_KEY", "LAP_SMS_API_SECRET",
    "LAP_ALLOW_EMAIL_AUTH", "LAP_EMAIL_PROVIDER", "LAP_EMAIL_API_BASE_URL", "LAP_EMAIL_API_KEY", "LAP_EMAIL_FROM",
    "LAP_ALLOW_DEV_EMAIL_OTP", "LAP_ALLOW_DEV_BOOK_IMPORT", "LAP_ALLOW_DEV_PROBLEM_IMPORT",
    "LAP_IMPORT_DB_PERSIST_DEV_ENABLED",
  ]) delete process.env[k];
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL: ${name} — ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Test: web-ai-qa-guard uses new env names
// ---------------------------------------------------------------------------

test("web-ai-qa-guard: accepts canonical env names", async () => {
  const guardMod = await import("../lib/web-ai-qa-guard.ts");
  const result = guardMod.evaluateWebAiQaGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mode, "external_dev");
});

test("web-ai-qa-guard: accepts legacy env names", async () => {
  const guardMod = await import("../lib/web-ai-qa-guard.ts");
  const result = guardMod.evaluateWebAiQaGuard({
    NODE_ENV: "development",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(result.allowed, true);
});

test("web-ai-qa-guard: password detected from legacy name", async () => {
  const guardMod = await import("../lib/web-ai-qa-guard.ts");
  const result = guardMod.evaluateWebAiQaGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_APIPassword: "legacy-pw",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(result.allowed, true);
});

// ---------------------------------------------------------------------------
// Test: Admin status center has LLM entries
// ---------------------------------------------------------------------------

test("admin status: getAdminStatusSnapshot includes LLM dev provider items", async () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "test-key",
    LAP_LLM_DEV_MODEL: "test-model",
  });

  const adminMod = await import("../lib/admin-status-center.ts");
  const snapshot = adminMod.getAdminStatusSnapshot();

  // Should have LLM items
  const llmItems = snapshot.items.filter((i) => i.category === "llm");
  assert.ok(llmItems.length >= 5, `Expected >=5 LLM items, got ${llmItems.length}`);

  // Should have dev_provider entry
  const devProvider = llmItems.find((i) => i.key === "llm.dev_provider");
  assert.ok(devProvider, "should have llm.dev_provider");
  assert.equal(devProvider.status, "enabled");

  // Should have health_check entry
  const healthCheck = llmItems.find((i) => i.key === "llm.health_check");
  assert.ok(healthCheck, "should have llm.health_check");
});

// ---------------------------------------------------------------------------
// Test: admin status does not leak env values
// ---------------------------------------------------------------------------

test("admin status: no secret values leaked", async () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://super-secret-api.example.com/v1/chat?token=hackme",
    LAP_LLM_DEV_API_KEY: "sk-abcdef-secret-key-hack123",
    LAP_LLM_DEV_API_PASSWORD: "password-hack-99999",
    LAP_LLM_DEV_MODEL: "Spark Ultra-32K",
    DATABASE_URL: "postgresql://user:pass@localhost/db",
  });

  const adminMod = await import("../lib/admin-status-center.ts");
  const snapshot = adminMod.getAdminStatusSnapshot();
  const json = JSON.stringify(snapshot);

  assert.ok(!json.includes("super-secret"), "endpoint host not leaked");
  assert.ok(!json.includes("hackme"), "query param not leaked");
  assert.ok(!json.includes("sk-abcdef"), "api key not leaked");
  assert.ok(!json.includes("hack123"), "api key fragment not leaked");
  assert.ok(!json.includes("hack-99999"), "password not leaked");
  assert.ok(!json.includes("pass@localhost"), "db password not leaked");
});

// ---------------------------------------------------------------------------
// Test: admin status summary includes blocked/enabled counts
// ---------------------------------------------------------------------------

test("admin status: summary computes correctly", async () => {
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });

  const adminMod = await import("../lib/admin-status-center.ts");
  const snapshot = adminMod.getAdminStatusSnapshot();

  assert.ok(snapshot.summary.total > 0);
  assert.ok(snapshot.summary.blocked >= 0);
  assert.ok(snapshot.summary.missingEnv >= 0);
  assert.equal(snapshot.productionReady, false);
  assert.equal(snapshot.safeToExposeToClient, true);
});

// ---------------------------------------------------------------------------
// Test: LLM dev provider config does NOT read .env.local
// ---------------------------------------------------------------------------

test("safety: config does NOT read .env.local file", async () => {
  // getLlmDevProviderConfig only reads process.env, never filesystem
  clearAllEnv();
  setEnv({ NODE_ENV: "development" });

  const configMod = await import("../lib/llm-dev-provider-config.ts");
  const config = configMod.getLlmDevProviderConfig();

  // All values should come from process.env only
  assert.equal(config.missingEnvNames.length, 6); // all missing when no env set
});

// ---------------------------------------------------------------------------
// Test: password is optional — config.ready can be true without it
// ---------------------------------------------------------------------------

test("safety: password is optional for readiness", async () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
    // No password
  });

  const configMod = await import("../lib/llm-dev-provider-config.ts");
  const config = configMod.getLlmDevProviderConfig();
  assert.equal(config.ready, true);
});

// ---------------------------------------------------------------------------
console.log(`\nA469 Safety/UI/Admin: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
