/**
 * llm-provider-contract.test.mjs
 *
 * Tests for LLM provider contract types — safe result enforcement,
 * error sanitization, and type validations.
 *
 * Run: node packages/ai-core/src/llm/llm-provider-contract.test.mjs
 */

import * as contract from "./llm-provider-contract.ts";
import * as safeResult from "./llm-safe-result.ts";

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
// LlmProviderMode constants
// ---------------------------------------------------------------------------

console.log("\n--- LlmProviderMode constants ---");

assert(contract.LlmProviderMode.Mock === "mock", "LlmProviderMode.Mock is 'mock'");
assert(contract.LlmProviderMode.ExternalDevOnly === "external-dev-only", "LlmProviderMode.ExternalDevOnly is 'external-dev-only'");
assertEqual(Object.keys(contract.LlmProviderMode).length, 2, "LlmProviderMode has 2 values");

// ---------------------------------------------------------------------------
// LlmChatRole constants
// ---------------------------------------------------------------------------

console.log("\n--- LlmChatRole constants ---");

assert(contract.LlmChatRole.System === "system", "LlmChatRole.System is 'system'");
assert(contract.LlmChatRole.User === "user", "LlmChatRole.User is 'user'");
assert(contract.LlmChatRole.Assistant === "assistant", "LlmChatRole.Assistant is 'assistant'");

// ---------------------------------------------------------------------------
// createSafeResult
// ---------------------------------------------------------------------------

console.log("\n--- createSafeResult ---");

const result1 = safeResult.createSafeResult({
  answerSummary: "This is a safe answer.",
  providerMode: "mock",
  realProviderCalled: false,
  networkAccessed: false,
});

assert(result1.ok === true, "safe result without error → ok=true");
assert(result1.secretSafe === true, "secretSafe is always true");
assert(result1.rawPromptStored === false, "rawPromptStored is always false");
assert(result1.rawResponseStored === false, "rawResponseStored is always false");
assert(result1.devOnly === true, "devOnly is always true");
assert(result1.productionReady === false, "productionReady is always false");
assert(result1.realProviderCalled === false, "realProviderCalled is false");
assert(result1.networkAccessed === false, "networkAccessed is false");
assertEqual(result1.providerMode, "mock", "providerMode is mock");
assert(typeof result1.createdAt === "string", "createdAt is an ISO string");
assert(result1.warnings.length >= 0, "warnings is an array");

// ---------------------------------------------------------------------------
// createSafeResult with error
// ---------------------------------------------------------------------------

console.log("\n--- createSafeResult with error ---");

const safeErr = safeResult.createSafeError({
  kind: "blocked_by_guard",
  message: "Guard blocked.",
});

const result2 = safeResult.createSafeResult({
  answerSummary: "blocked",
  providerMode: "mock",
  realProviderCalled: false,
  networkAccessed: false,
  error: safeErr,
});

assert(result2.ok === false, "safe result with error → ok=false");
assert(result2.error !== undefined, "error is present");
assertEqual(result2.error.kind, "blocked_by_guard", "error kind preserved");
assert(result2.error.secretSafe === true, "error secretSafe is true");
assert(result2.error.rawProviderResponseStored === false, "error rawProviderResponseStored is false");

// ---------------------------------------------------------------------------
// createSafeError
// ---------------------------------------------------------------------------

console.log("\n--- createSafeError ---");

const err1 = safeResult.createSafeError({
  kind: "timeout",
  message: "Request timed out.",
});
assertEqual(err1.kind, "timeout", "error kind preserved");
assert(err1.secretSafe === true, "error secretSafe");
assert(err1.retryable === false, "default retryable is false");

const err2 = safeResult.createSafeError({
  kind: "network_error",
  message: "Network failed.",
  retryable: true,
});
assert(err2.retryable === true, "retryable can be set to true");

// ---------------------------------------------------------------------------
// createBlockedResult
// ---------------------------------------------------------------------------

console.log("\n--- createBlockedResult ---");

const blocked1 = safeResult.createBlockedResult(
  ["guard_disabled", "missing_endpoint"],
  "external-dev-only",
);
assert(blocked1.ok === false, "blocked result → ok=false");
assert(blocked1.providerMode === "external-dev-only", "blocked result preserves providerMode");
assert(blocked1.realProviderCalled === false, "blocked → realProviderCalled=false");
assert(blocked1.answerSummary.includes("blocked"), "blocked answer preview includes 'blocked'");
assert(blocked1.error !== undefined, "blocked result has error");
assertEqual(blocked1.error.kind, "blocked_by_guard", "blocked error kind is blocked_by_guard");

// ---------------------------------------------------------------------------
// createMockSuccessResult
// ---------------------------------------------------------------------------

console.log("\n--- createMockSuccessResult ---");

const mock1 = safeResult.createMockSuccessResult("Mock answer here.");
assert(mock1.ok === true, "mock success → ok=true");
assertEqual(mock1.providerMode, "mock", "mock mode 