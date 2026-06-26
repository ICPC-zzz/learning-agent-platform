/**
 * A469 — LLM Dev Provider Config tests
 * Run: node --experimental-strip-types apps/web/src/app/a469-llm-dev-config.test.mjs
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
    "LAP_ALLOW_DEV_LLM","LAP_ALLOW_WEB_AI","LAP_LLM_DEV_PROVIDER",
    "LAP_LLM_DEV_ENDPOINT","LAP_LLM_DEV_API_KEY","LAP_LLM_DEV_API_PASSWORD",
    "LAP_LLM_DEV_MODEL","LAP_LLM_DEV_TIMEOUT_MS",
    "LAP_WEB_LLM_QA_DEV_ENABLED","LAP_ALLOW_EXTERNAL_LLM_PROVIDER",
    "LAP_LLM_DEV_APIPassword","NODE_ENV",
  ]) delete process.env[k];
}

const mod = await import("../lib/llm-dev-provider-config.ts");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error(`FAIL: ${name} — ${e.message}`); }
}

test("LLM_DEV_ENV has canonical names", () => {
  assert.equal(mod.LLM_DEV_ENV.ALLOW_DEV_LLM, "LAP_ALLOW_DEV_LLM");
  assert.equal(mod.LLM_DEV_ENV.ALLOW_WEB_AI, "LAP_ALLOW_WEB_AI");
  assert.equal(mod.LLM_DEV_ENV.ENDPOINT, "LAP_LLM_DEV_ENDPOINT");
  assert.equal(mod.LLM_DEV_ENV.API_KEY, "LAP_LLM_DEV_API_KEY");
  assert.equal(mod.LLM_DEV_ENV.API_PASSWORD, "LAP_LLM_DEV_API_PASSWORD");
  assert.equal(mod.LLM_DEV_ENV.MODEL, "LAP_LLM_DEV_MODEL");
});

test("LLM_DEV_ENV_LEGACY has legacy names", () => {
  assert.equal(mod.LLM_DEV_ENV_LEGACY.ALLOW_DEV_LLM, "LAP_WEB_LLM_QA_DEV_ENABLED");
  assert.equal(mod.LLM_DEV_ENV_LEGACY.ALLOW_WEB_AI, "LAP_ALLOW_EXTERNAL_LLM_PROVIDER");
  assert.equal(mod.LLM_DEV_ENV_LEGACY.API_PASSWORD, "LAP_LLM_DEV_APIPassword");
});

test("no env -> not ready", () => {
  clearAllEnv();
  const c = mod.getLlmDevProviderConfig();
  assert.ok(c.ready !== true);
  assert.equal(c.devOnly, true);
  assert.equal(c.productionReady, false);
});

test("all canonical -> ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "sk-key",
    LAP_LLM_DEV_MODEL: "test-model",
  });
  const c = mod.getLlmDevProviderConfig();
  assert.equal(c.ready, true);
});

test("legacy env names -> ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "sk-key",
    LAP_LLM_DEV_MODEL: "test-model",
  });
  assert.equal(mod.getLlmDevProviderConfig().ready, true);
});

test("LAP_LLM_DEV_APIPassword alias works", () => {
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
  const c = mod.getLlmDevProviderConfig();
  const pw = c.envStatus.find((s) => s.name === "LAP_LLM_DEV_API_PASSWORD");
  assert.ok(pw.configured);
});

test("production blocked", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "production",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const c = mod.getLlmDevProviderConfig();
  assert.equal(c.productionBlocked, true);
  assert.equal(c.ready, false);
});

test("missing endpoint -> not ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(mod.getLlmDevProviderConfig().ready, false);
});

test("missing api_key -> not ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(mod.getLlmDevProviderConfig().ready, false);
});

test("no env value leak in config", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://secret.example.com/v1",
    LAP_LLM_DEV_API_KEY: "sk-secret-key-12345",
    LAP_LLM_DEV_MODEL: "secret-model",
  });
  const json = JSON.stringify(mod.getLlmDevProviderConfig());
  assert.ok(!json.includes("secret.example.com"));
  assert.ok(!json.includes("sk-secret"));
});

test("getLlmDevEnvSnapshot returns booleans", () => {
  clearAllEnv();
  setEnv({
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "false",
    LAP_LLM_DEV_ENDPOINT: "https://example.com",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  const snap = mod.getLlmDevEnvSnapshot();
  assert.equal(snap["LAP_ALLOW_DEV_LLM"], true);
  assert.equal(snap["LAP_ALLOW_WEB_AI"], false);
});

test("default timeout 30000", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(mod.getLlmDevProviderConfig().timeoutMs, 30000);
});

test("password optional for ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
    LAP_LLM_DEV_MODEL: "model",
  });
  assert.equal(mod.getLlmDevProviderConfig().ready, true);
});

test("missing model -> not ready", () => {
  clearAllEnv();
  setEnv({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_LLM: "true",
    LAP_ALLOW_WEB_AI: "true",
    LAP_LLM_DEV_ENDPOINT: "https://example.com/v1",
    LAP_LLM_DEV_API_KEY: "key",
  });
  assert.equal(mod.getLlmDevProviderConfig().ready, false);
});

process.env = originalEnv;
console.log(`A469 Config: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
