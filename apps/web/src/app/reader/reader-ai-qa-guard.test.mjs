/**
 * reader-ai-qa-guard.test.mjs
 *
 * Tests for Reader AI QA guard — default blocked, mock-only when partially
 * enabled, external-dev when fully configured, and env var parsing.
 *
 * Run: node apps/web/src/app/reader/reader-ai-qa-guard.test.mjs
 */

import * as guard from "./reader-ai-qa-guard.ts";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
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

// ---------------------------------------------------------------------------
// Default: everything disabled → blocked
// ---------------------------------------------------------------------------

console.log("\n--- Default: blocked ---");

const r1 = guard.evaluateReaderAiQaGuard({});
assertEqual(r1.mode, "blocked", "default → blocked");
assert(r1.allowed === false, "default → not allowed");
assert(r1.allowMock === false, "default → mock not allowed");
assert(r1.allowExternalDev === false, "default → external not allowed");
assert(r1.devOnly === true, "devOnly is true");
assert(r1.productionReady === false, "productionReady is false");
assert(r1.blockedReasons.includes("reader_ai_qa_dev_disabled"), "reason: reader_ai_qa_dev_disabled");

// ---------------------------------------------------------------------------
// Reader QA enabled but provider disabled → mock_only
// ---------------------------------------------------------------------------

console.log("\n--- Reader QA enabled, provider disabled → mock_only ---");

const r2 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
});
assertEqual(r2.mode, "mock_only", "reader enabled + no provider → mock_only");
assert(r2.allowed === true, "mock_only → allowed");
assert(r2.allowMock === true, "mock_only → mock allowed");
assert(r2.allowExternalDev === false, "mock_only → external not allowed");
assert(r2.blockedReasons.includes("llm_dev_provider_disabled"), "reason: llm_dev_provider_disabled");
assert(r2.sourceLabel.includes("mock-only"), "source label mentions mock-only");

// ---------------------------------------------------------------------------
// Everything enabled but missing endpoint → mock_only
// ---------------------------------------------------------------------------

console.log("\n--- Missing endpoint → mock_only ---");

const r3 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_API_KEY: "test-key",
  LAP_LLM_DEV_MODEL: "test-model",
});
assertEqual(r3.mode, "mock_only", "missing endpoint → mock_only");
assert(r3.blockedReasons.includes("missing_endpoint"), "reason: missing_endpoint");

// ---------------------------------------------------------------------------
// Missing api_key → mock_only
// ---------------------------------------------------------------------------

console.log("\n--- Missing api_key → mock_only ---");

const r4 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
  LAP_LLM_DEV_MODEL: "test-model",
});
assertEqual(r4.mode, "mock_only", "missing api_key → mock_only");
assert(r4.blockedReasons.includes("missing_api_key"), "reason: missing_api_key");

// ---------------------------------------------------------------------------
// Missing model → mock_only
// ---------------------------------------------------------------------------

console.log("\n--- Missing model → mock_only ---");

const r5 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
  LAP_LLM_DEV_API_KEY: "test-key",
});
assertEqual(r5.mode, "mock_only", "missing model → mock_only");
assert(r5.blockedReasons.includes("missing_model"), "reason: missing_model");

// ---------------------------------------------------------------------------
// All env vars present → external_dev
// ---------------------------------------------------------------------------

console.log("\n--- All env vars → external_dev ---");

const r6 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
  LAP_LLM_DEV_API_KEY: "test-key-123456",
  LAP_LLM_DEV_MODEL: "test-model-v1",
});
assertEqual(r6.mode, "external_dev", "all vars → external_dev");
assert(r6.allowed === true, "external_dev → allowed");
assert(r6.allowMock === true, "external_dev → mock allowed");
assert(r6.allowExternalDev === true, "external_dev → external allowed");
assertEqual(r6.blockedReasons.length, 0, "no blocked reasons");

// ---------------------------------------------------------------------------
// Boolean parsing: various truthy/falsy values
// ---------------------------------------------------------------------------

console.log("\n--- Boolean parsing ---");

const r7 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "1",
});
assertEqual(r7.mode, "mock_only", "'1' is truthy");

const r8 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "yes",
});
assertEqual(r8.mode, "mock_only", "'yes' is truthy");

const r9 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "false",
});
assertEqual(r9.mode, "blocked", "'false' is falsy");

const r10 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "0",
});
assertEqual(r10.mode, "blocked", "'0' is falsy");

const r11 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "random_string",
});
assertEqual(r11.mode, "blocked", "unknown string → falsy");

// ---------------------------------------------------------------------------
// Whitespace handling in env vars
// ---------------------------------------------------------------------------

console.log("\n--- Whitespace handling ---");

const r12 = guard.evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_ENDPOINT: "  https://api.example.com/v1  ",
  LAP_LLM_DEV_API_KEY: "  test-key  ",
  LAP_LLM_DEV_MODEL: "  test-model  ",
});
assertEqual(r12.mode, "external_dev", "whitespace trimmed → external_dev");

// ---------------------------------------------------------------------------
// All results are devOnly + not productionReady
// ---------------------------------------------------------------------------

console.log("\n--- All results safe ---");

const allResults = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12];
for (const r of allResults) {
  assert(r.devOnly === true, `result mode=${r.mode} → devOnly=true`);
  assert(r.productionReady === false, `result mode=${r.mode} → productionReady=false`);
}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

console.log(`\n${passed} pass / ${failed} fail`);

if (failures.length > 0) {
  console.log(`\n${YELLOW}Failures:${RESET}`);
  failures.forEach((f) => console.log(`  ${RED}${f}${RESET}`));
}

process.exit(failed > 0 ? 1 : 0);
