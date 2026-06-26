/**
 * llm-dev-smoke-runner.test.mjs
 *
 * Tests for the LLM dev smoke test runner — default dry-run, blocked on
 * missing env, blocked on missing guard, fake fetch success, fake fetch error,
 * sanitization, and safety field verification.
 *
 * NO real network calls are made — all live-mode tests use fake fetch.
 *
 * Run: node packages/ai-core/src/llm/llm-dev-smoke-runner.test.mjs
 */

import {
  runLlmDevSmokeTest,
  checkAllGuards,
  formatSmokeTestResult,
  ALLOWED_DEV_PROVIDER_IDS,
} from "./llm-dev-smoke-runner.ts";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label}`;
    failures.push(msg);
    console.log(`${RED}  ${msg}${RESET}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.log(`${RED}  ${msg}${RESET}`);
  }
}

function assertContains(text, needle, label) {
  if (text.includes(needle)) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label} — text does not contain "${needle}"`;
    failures.push(msg);
    console.log(`${RED}  ${msg}${RESET}`);
  }
}

function assertNotContains(text, needle, label) {
  if (!text.includes(needle)) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label} — text contains "${needle}" when it should not`;
    failures.push(msg);
    console.log(`${RED}  ${msg}${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Empty env
// ---------------------------------------------------------------------------
var emptyEnv = {};

// ---------------------------------------------------------------------------
// Full-guard env (simulates all env vars set correctly)
// ---------------------------------------------------------------------------
var fullGuardEnv = {
  LAP_LLM_DEV_SMOKE_TEST_ENABLED: "1",
  LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED: "1",
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "1",
  LAP_LLM_PROVIDER: "spark-ultra-32k-dev",
  LAP_LLM_DEV_ENDPOINT: "https://spark-api-open.xf-yun.com/v1",
  LAP_LLM_DEV_API_KEY: "test-api-key-placeholder",
  LAP_LLM_DEV_APIPassword: "test-api-password-placeholder",
  LAP_LLM_DEV_MODEL: "Spark Ultra-32K",
  LAP_LLM_DEV_TIMEOUT_MS: "5000",
};

// ===========================================================================
// 1. Default dry-run — no network
// ===========================================================================

console.log("\n=== 1. Default dry-run — no network ===");

{
  const result = await runLlmDevSmokeTest(emptyEnv);
  assertEqual(result.mode, "dry-run", "empty env → dry-run mode");
  assertEqual(result.networkAttempted, false, "empty env → no network attempted");
  assertEqual(result.externalProviderUsed, false, "empty env → no external provider");
  assertEqual(result.llmUsed, false, "empty env → no LLM used");
  assertEqual(result.ok, false, "empty env → not ok");
}

{
  const result = await runLlmDevSmokeTest(emptyEnv, { dryRun: true });
  assertEqual(result.mode, "dry-run", "explicit dry-run → dry-run mode");
  assertEqual(result.networkAttempted, false, "explicit dry-run → no network");
}

{
  const result = await runLlmDevSmokeTest(fullGuardEnv);
  assertEqual(result.mode, "dry-run", "full guard env but default → dry-run mode");
  assertEqual(result.networkAttempted, false, "full guard env default → no network");
  assertEqual(result.guardStatus.allPassed, false, "full guard env default → allPassed is false (network not allowed)");
}

// ===========================================================================
// 2. guardStatus — individual fields
// ===========================================================================

console.log("\n=== 2. guardStatus fields ===");

{
  const gs = checkAllGuards(emptyEnv, false);
  assertEqual(gs.smokeTestEnabled, false, "empty env → smokeTestEnabled false");
  assertEqual(gs.readerQaExternalEnabled, false, "empty env → readerQaExternalEnabled false");
  assertEqual(gs.allowExternalProvider, false, "empty env → allowExternalProvider false");
  assertEqual(gs.providerAllowed, false, "empty env → providerAllowed false");
  assertEqual(gs.endpointConfigured, false, "empty env → endpointConfigured false");
  assertEqual(gs.apiKeyConfigured, false, "empty env → apiKeyConfigured false");
  assertEqual(gs.apiPasswordConfigured, false, "empty env → apiPasswordConfigured false");
  assertEqual(gs.networkAllowed, false, "empty env → networkAllowed false");
  assertEqual(gs.allPassed, false, "empty env → allPassed false");
  assert(gs.blockedReasons.length >= 8, "empty env → at least 8 blocked reasons");
}

{
  const gs = checkAllGuards(fullGuardEnv, true);
  assertEqual(gs.smokeTestEnabled, true, "full guard + network → smokeTestEnabled true");
  assertEqual(gs.readerQaExternalEnabled, true, "full guard + network → readerQaExternalEnabled true");
  assertEqual(gs.allowExternalProvider, true, "full guard + network → allowExternalProvider true");
  assertEqual(gs.providerAllowed, true, "full guard + network → providerAllowed true");
  assertEqual(gs.endpointConfigured, true, "full guard + network → endpointConfigured true");
  assertEqual(gs.apiKeyConfigured, true, "full guard + network → apiKeyConfigured true");
  assertEqual(gs.apiPasswordConfigured, true, "full guard + network → apiPasswordConfigured true");
  assertEqual(gs.networkAllowed, true, "full guard + network → networkAllowed true");
  assertEqual(gs.allPassed, true, "full guard + network → allPassed true");
  assertEqual(gs.blockedReasons.length, 0, "full guard + network → no blocked reasons");
}

// ===========================================================================
// 3. Missing env — dryRun=false — blocked
// ===========================================================================

console.log("\n=== 3. Missing env + dryRun=false → blocked ===");

{
  const result = await runLlmDevSmokeTest(emptyEnv, { dryRun: false, allowNetwork: true });
  assertEqual(result.mode, "blocked", "empty env + dryRun=false → blocked mode");
  assertEqual(result.networkAttempted, false, "empty env + dryRun=false → no network");
  assertEqual(result.ok, false, "empty env + dryRun=false → not ok");
  assert(result.guardStatus.blockedReasons.length > 0, "empty env + dryRun=false → has blocked reasons");
}

// ===========================================================================
// 4. Partial guard — blocked one by one
// ===========================================================================

console.log("\n=== 4. Partial guard — each missing → blocked ===");

function envWithout(key) {
  var copy = Object.assign({}, fullGuardEnv);
  delete copy[key];
  return copy;
}

var criticalKeys = [
  "LAP_LLM_DEV_SMOKE_TEST_ENABLED",
  "LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED",
  "LAP_ALLOW_EXTERNAL_LLM_PROVIDER",
  "LAP_LLM_PROVIDER",
  "LAP_LLM_DEV_ENDPOINT",
  "LAP_LLM_DEV_API_KEY",
  "LAP_LLM_DEV_APIPassword",
];

for (var i = 0; i < criticalKeys.length; i++) {
  var key = criticalKeys[i];
  var partialEnv = envWithout(key);
  var result = await runLlmDevSmokeTest(partialEnv, { dryRun: false, allowNetwork: true });
  assertEqual(result.mode, "blocked", "missing " + key + " → blocked");
  assertEqual(result.networkAttempted, false, "missing " + key + " → no network");
}

// ===========================================================================
// 5. --live without networkAllowed → blocked
// ===========================================================================

console.log("\n=== 5. --live (dryRun=false) without allowNetwork → blocked ===");

{
  const result = await runLlmDevSmokeTest(fullGuardEnv, { dryRun: false, allowNetwork: false });
  assertEqual(result.mode, "blocked", "dryRun=false + allowNetwork=false → blocked");
  assertEqual(result.networkAttempted, false, "dryRun=false + allowNetwork=false → no network");
  assert(result.guardStatus.blockedReasons.some(function(r) { return r.includes("allowNetwork"); }), "block reason mentions allowNetwork");
}

// ===========================================================================
// 6. Wrong provider ID → blocked
// ===========================================================================

console.log("\n=== 6. Wrong provider ID → blocked ===");

{
  var wrongProviderEnv = Object.assign({}, fullGuardEnv, { LAP_LLM_PROVIDER: "openai-gpt4" });
  const result = await runLlmDevSmokeTest(wrongProviderEnv, { dryRun: false, allowNetwork: true });
  assertEqual(result.mode, "blocked", "wrong provider → blocked");
  assertEqual(result.guardStatus.providerAllowed, false, "wrong provider → providerAllowed false");
  assert(result.guardStatus.blockedReasons.some(function(r) { return r.includes("LAP_LLM_PROVIDER"); }), "wrong provider → reason mentions LAP_LLM_PROVIDER");
}

// ===========================================================================
// 7. Fake fetch success — all guards pass
// ===========================================================================

console.log("\n=== 7. Fake fetch success — external-dev-smoke ===");

function createFakeSuccessFetch(responseText) {
  return async function(_url, _init) {
    return {
      ok: true,
      status: 200,
      text: async function() { return responseText; },
    };
  };
}

{
  var fakeSuccessFetch = createFakeSuccessFetch(JSON.stringify({
    choices: [{ message: { content: "OK" } }],
  }));

  const result = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: fakeSuccessFetch,
  });

  assertEqual(result.mode, "external-dev-smoke", "fake fetch success → external-dev-smoke mode");
  assertEqual(result.networkAttempted, true, "fake fetch success → network attempted");
  assertEqual(result.externalProviderUsed, true, "fake fetch success → external provider used");
  assertEqual(result.llmUsed, true, "fake fetch success → LLM used");
  assertEqual(result.ok, true, "fake fetch success → ok true");
  assertEqual(result.responseReceived, true, "fake fetch success → responseReceived true");
  assert(result.responseDurationMs !== undefined && result.responseDurationMs >= 0, "fake fetch success → responseDurationMs present");
  assertEqual(result.providerId, "spark-ultra-32k-dev", "fake fetch success → correct providerId");
  assertEqual(result.model, "Spark Ultra-32K", "fake fetch success → correct model");
  assertEqual(result.endpointConfigured, true, "fake fetch success → endpointConfigured true");
  assertEqual(result.apiKeyConfigured, true, "fake fetch success → apiKeyConfigured true");
  assertEqual(result.apiPasswordConfigured, true, "fake fetch success → apiPasswordConfigured true");
}

// ===========================================================================
// 8. Fake fetch HTTP error — sanitized
// ===========================================================================

console.log("\n=== 8. Fake fetch HTTP error → sanitized ===");

function createFakeErrorFetch(status) {
  return async function(_url, _init) {
    return {
      ok: false,
      status: status,
      text: async function() { return JSON.stringify({ error: "some error" }); },
    };
  };
}

{
  var fake401Fetch = createFakeErrorFetch(401);
  const result = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: fake401Fetch,
  });

  assertEqual(result.mode, "external-dev-smoke", "HTTP 401 → external-dev-smoke mode");
  assertEqual(result.networkAttempted, true, "HTTP 401 → network attempted");
  assertEqual(result.externalProviderUsed, true, "HTTP 401 → external provider used");
  assertEqual(result.ok, false, "HTTP 401 → not ok");
  assertEqual(result.responseReceived, false, "HTTP 401 → responseReceived false");
  assert(result.redactedError !== undefined && result.redactedError.length > 0, "HTTP 401 → redactedError present");
  assertNotContains(result.redactedError, "test-api-key-placeholder", "HTTP 401 → redactedError does not contain api key");
}

{
  var fake500Fetch = createFakeErrorFetch(500);
  const result = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: fake500Fetch,
  });

  assertEqual(result.mode, "external-dev-smoke", "HTTP 500 → external-dev-smoke mode");
  assertEqual(result.ok, false, "HTTP 500 → not ok");
  assert(result.redactedError !== undefined, "HTTP 500 → redactedError present");
}

// ===========================================================================
// 9. Fake fetch network exception → safe error
// ===========================================================================

console.log("\n=== 9. Fake fetch network exception → safe error ===");

{
  var explodingFetch = async function(_url, _init) {
    throw new Error("Connection refused");
  };

  const result = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: explodingFetch,
  });

  assertEqual(result.mode, "error", "network exception → error mode");
  assertEqual(result.networkAttempted, true, "network exception → networkAttempted true");
  assertEqual(result.ok, false, "network exception → not ok");
  assert(result.redactedError !== undefined, "network exception → redactedError present");
  // Error message should not contain any key from env
  assertNotContains(result.redactedError, "test-api-key-placeholder", "network exception → no key in error");
}

// ===========================================================================
// 10. Fake fetch empty response → handled
// ===========================================================================

console.log("\n=== 10. Fake fetch empty response → handled ===");

{
  var emptyFetch = createFakeSuccessFetch(JSON.stringify({ choices: [] }));
  const result = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: emptyFetch,
  });

  assertEqual(result.mode, "external-dev-smoke", "empty choices → external-dev-smoke mode");
  assertEqual(result.ok, false, "empty choices → not ok");
  assertEqual(result.responseReceived, false, "empty choices → responseReceived false");
}

// ===========================================================================
// 11. Safety assertions — all result fields
// ===========================================================================

console.log("\n=== 11. Safety assertions — all result fields ===");

function verifySafetyFields(result, label) {
  assertEqual(result.writesDatabase, false, label + " → writesDatabase false");
  assertEqual(result.toolsUsed, false, label + " → toolsUsed false");
  assertEqual(result.agentLoopUsed, false, label + " → agentLoopUsed false");
  assertEqual(result.rawPromptStored, false, label + " → rawPromptStored false");
  assertEqual(result.rawResponseStored, false, label + " → rawResponseStored false");
  assertEqual(result.rawResponsePrinted, false, label + " → rawResponsePrinted false");
  assertEqual(result.secretSafe, true, label + " → secretSafe true");
  assertEqual(result.productionReady, false, label + " → productionReady false");
  assertEqual(result.safeToExposeToClient, true, label + " → safeToExposeToClient true");
}

{
  var dryResult = await runLlmDevSmokeTest(emptyEnv);
  verifySafetyFields(dryResult, "dry-run result");
}

{
  var blockedResult = await runLlmDevSmokeTest(emptyEnv, { dryRun: false, allowNetwork: true });
  verifySafetyFields(blockedResult, "blocked result");
}

{
  var successFetch = createFakeSuccessFetch(JSON.stringify({
    choices: [{ message: { content: "OK" } }],
  }));
  var smokeResult = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: successFetch,
  });
  verifySafetyFields(smokeResult, "external-dev-smoke result");
}

{
  var errorFetch = createFakeErrorFetch(500);
  var errorResult = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: errorFetch,
  });
  verifySafetyFields(errorResult, "error result");
}

// ===========================================================================
// 12. No sensitive data in formatted output
// ===========================================================================

console.log("\n=== 12. No sensitive data in formatted output ===");

{
  var successFetch2 = createFakeSuccessFetch(JSON.stringify({
    choices: [{ message: { content: "OK" } }],
  }));
  var result2 = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: successFetch2,
  });
  var formatted = formatSmokeTestResult(result2);

  assertNotContains(formatted, "test-api-key-placeholder", "formatted output → no api key");
  assertNotContains(formatted, "test-api-password-placeholder", "formatted output → no api password");
  assertNotContains(formatted, "Bearer", "formatted output → no Bearer token");
  assertNotContains(formatted, "DATABASE_URL", "formatted output → no DATABASE_URL");
  assertContains(formatted, "apiKeyConfigured", "formatted output → has apiKeyConfigured (safe metadata)");
  assertContains(formatted, "apiPasswordConfigured", "formatted output → has apiPasswordConfigured (safe metadata)");
}

// ===========================================================================
// 13. Formatted output does not contain raw prompt/response
// ===========================================================================

console.log("\n=== 13. Formatted output does not contain raw prompt/response ===");

{
  var dryFormatted = formatSmokeTestResult(await runLlmDevSmokeTest(emptyEnv));
  assertNotContains(dryFormatted, "health check", "dry-run formatted → no prompt content");
  assertNotContains(dryFormatted, "You are a health check responder", "dry-run formatted → no system prompt");
}

{
  var successFetch3 = createFakeSuccessFetch(JSON.stringify({
    choices: [{ message: { content: "Some model response text" } }],
  }));
  var result3 = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: successFetch3,
  });
  var formatted3 = formatSmokeTestResult(result3);

  assertNotContains(formatted3, "Some model response text", "formatted output → no model response content");
  assertNotContains(formatted3, "health check", "formatted output → no prompt content");
}

// ===========================================================================
// 14. Sensitive fields in fake response not exposed
// ===========================================================================

console.log("\n=== 14. Sensitive fields in fake response not exposed ===");

{
  var sensitiveFetch = createFakeSuccessFetch(JSON.stringify({
    choices: [{
      message: {
        content: "OK",
        api_key: "should-not-appear",
        bearer_token: "should-not-appear",
      },
    }],
    api_key: "top-level-secret",
    DATABASE_URL: "postgresql://secret",
  }));

  var result4 = await runLlmDevSmokeTest(fullGuardEnv, {
    dryRun: false,
    allowNetwork: true,
    fetchImpl: sensitiveFetch,
  });
  var formatted4 = formatSmokeTestResult(result4);

  assertNotContains(formatted4, "should-not-appear", "sensitive response → no api_key value");
  assertNotContains(formatted4, "top-level-secret", "sensitive response → no top-level api_key");
  assertNotContains(formatted4, "postgresql://secret", "sensitive response → no DATABASE_URL");
  assertNotContains(formatted4, "bearer_token", "sensitive response → no bearer token key");
}

// ===========================================================================
// 15. ALLOWED_DEV_PROVIDER_IDS contains expected values
// ===========================================================================

console.log("\n=== 15. ALLOWED_DEV_PROVIDER_IDS ===");

assert(ALLOWED_DEV_PROVIDER_IDS.has("spark-ultra-32k-dev"), "allowed providers includes spark-ultra-32k-dev");
assert(ALLOWED_DEV_PROVIDER_IDS.has("spark-ultra-32k"), "allowed providers includes spark-ultra-32k");
assert(!ALLOWED_DEV_PROVIDER_IDS.has("openai"), "allowed providers does NOT include openai");
assert(!ALLOWED_DEV_PROVIDER_IDS.has(""), "allowed providers does NOT include empty string");

// ===========================================================================
// 16. Truthy env value variants
// ===========================================================================

console.log("\n=== 16. Truthy env value variants ===");

{
  var truthyEnv = Object.assign({}, fullGuardEnv, {
    LAP_LLM_DEV_SMOKE_TEST_ENABLED: "true",
    LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
  });
  var gs = checkAllGuards(truthyEnv, true);
  assertEqual(gs.smokeTestEnabled, true, "\"true\" → smokeTestEnabled true");
  assertEqual(gs.readerQaExternalEnabled, true, "\"true\" → readerQaExternalEnabled true");
  assertEqual(gs.allowExternalProvider, true, "\"true\" → allowExternalProvider true");
  assertEqual(gs.allPassed, true, "\"true\" values → allPassed true");
}

{
  var falsyEnv = Object.assign({}, fullGuardEnv, {
    LAP_LLM_DEV_SMOKE_TEST_ENABLED: "0",
    LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED: "false",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "no",
  });
  var gs = checkAllGuards(falsyEnv, true);
  assertEqual(gs.smokeTestEnabled, false, "\"0\" → smokeTestEnabled false");
  assertEqual(gs.readerQaExternalEnabled, false, "\"false\" → readerQaExternalEnabled false");
  assertEqual(gs.allowExternalProvider, false, "\"no\" → allowExternalProvider false");
}

{
  var whitespaceEnv = Object.assign({}, fullGuardEnv, {
    LAP_LLM_DEV_SMOKE_TEST_ENABLED: " 1 ",
    LAP_LLM_DEV_API_KEY: "  non-empty  ",
    LAP_LLM_DEV_APIPassword: "  non-empty  ",
  });
  var gs = checkAllGuards(whitespaceEnv, true);
  assertEqual(gs.smokeTestEnabled, true, "\" 1 \" trimmed → smokeTestEnabled true");
  assertEqual(gs.apiKeyConfigured, true, "whitespace-only key → configured false?");
  // Key with whitespace is technically non-empty after trimming
  // but the actual api key would need to be valid; for smoke test
  // we just check it's non-empty after trim
}

// ===========================================================================
// 17. Result createdAt is ISO timestamp
// ===========================================================================

console.log("\n=== 17. Result createdAt is ISO timestamp ===");

{
  var result17 = await runLlmDevSmokeTest(emptyEnv);
  assert(typeof result17.createdAt === "string", "createdAt is string");
  assert(result17.createdAt.includes("T"), "createdAt is ISO format");
  assert(!isNaN(Date.parse(result17.createdAt)), "createdAt is parseable date");
}

// ===========================================================================
// 18. guardStatus blockedReasons are non-empty for blocked cases
// ===========================================================================

console.log("\n=== 18. Blocked reasons are descriptive ===");

{
  var gs = checkAllGuards(emptyEnv, false);
  assert(gs.blockedReasons.length > 0, "empty env → has reasons");
  // Each reason should be a non-empty string
  for (var j = 0; j < gs.blockedReasons.length; j++) {
    assert(gs.blockedReasons[j].length > 0, "reason " + j + " is non-empty");
  }
}

// ===========================================================================
// Summary
// ===========================================================================

console.log("\n========================================");
console.log("Test summary: " + passed + " pass / " + failed + " fail");
console.log("========================================");

if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach(function(f) { console.log("  " + f); });
  process.exitCode = 1;
}
