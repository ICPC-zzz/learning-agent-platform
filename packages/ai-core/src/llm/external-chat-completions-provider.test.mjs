/**
 * external-chat-completions-provider.test.mjs
 *
 * Tests for ExternalChatCompletionsProvider — config loading, blocked when env
 * missing, fake fetch success, fake fetch error sanitization, timeout handling.
 *
 * NO real network calls are made — all tests use fake fetch.
 *
 * Run: node packages/ai-core/src/llm/external-chat-completions-provider.test.mjs
 */

import { LlmChatRole } from "./llm-provider-contract.ts";
import {
  ExternalChatCompletionsProvider,
  loadExternalProviderConfig,
} from "./external-chat-completions-provider.ts";

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

// ---------------------------------------------------------------------------
// Config loading — missing env
// ---------------------------------------------------------------------------

console.log("\n--- Config loading: missing env ---");

const config1 = loadExternalProviderConfig({});
assertEqual(config1.configured, false, "empty env → not configured");
assert(config1.blockedReason !== null, "empty env → blocked reason present");
assertContains(config1.blockedReason, "LAP_LLM_DEV_ENDPOINT", "blocked reason mentions endpoint");
assertContains(config1.blockedReason, "LAP_LLM_DEV_API_KEY", "blocked reason mentions api key");
assertContains(config1.blockedReason, "LAP_LLM_DEV_MODEL", "blocked reason mentions model");

// ---------------------------------------------------------------------------
// Config loading — partial env
// ---------------------------------------------------------------------------

console.log("\n--- Config loading: partial env ---");

const config2 = loadExternalProviderConfig({
  endpoint: "https://api.example.com/v1",
});
assertEqual(config2.configured, false, "only endpoint → not configured");

const config3 = loadExternalProviderConfig({
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
});
assertEqual(config3.configured, false, "endpoint + key → not configured (missing model)");

// ---------------------------------------------------------------------------
// Config loading — complete env
// ---------------------------------------------------------------------------

console.log("\n--- Config loading: complete env ---");

const config4 = loadExternalProviderConfig({
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key-12345",
  model: "test-model",
});

assertEqual(config4.configured, true, "all vars → configured");
assertEqual(config4.blockedReason, null, "all vars → no blocked reason");
assertEqual(config4.timeoutMs, 15000, "default timeout is 15000");

// ---------------------------------------------------------------------------
// Config loading — custom timeout
// ---------------------------------------------------------------------------

console.log("\n--- Config loading: custom timeout ---");

const config5 = loadExternalProviderConfig({
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: 30000,
});

assertEqual(config5.timeoutMs, 30000, "custom timeout preserved");

const config6 = loadExternalProviderConfig({
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
  timeoutMs: "20000",
});

assertEqual(config6.timeoutMs, 20000, "string timeout parsed");

// ---------------------------------------------------------------------------
// Provider: blocked when not configured
// ---------------------------------------------------------------------------

console.log("\n--- Provider: blocked when not configured ---");

const blockedProvider = new ExternalChatCompletionsProvider(config1);
const result1 = await blockedProvider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  purposeSummary: "test",
});

assert(result1.ok === false, "blocked provider → ok=false");
assert(result1.realProviderCalled === false, "blocked → realProviderCalled=false");
assert(result1.networkAccessed === false, "blocked → networkAccessed=false");
assertEqual(result1.providerMode, "external-dev-only", "providerMode is external-dev-only");
assert(result1.error !== undefined, "blocked → error present");
assertEqual(result1.error.kind, "provider_disabled", "error kind is provider_disabled");

// ---------------------------------------------------------------------------
// Provider: fake fetch success
// ---------------------------------------------------------------------------

console.log("\n--- Provider: fake fetch success ---");

function createFakeSuccessFetch(responseContent) {
  return async (_url, _init) => {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: responseContent,
              },
            },
          ],
        }),
    };
  };
}

const successProvider = new ExternalChatCompletionsProvider(
  config4,
  createFakeSuccessFetch("这是来自 AI 的回答。"),
);

const result2 = await successProvider.generate({
  messages: [
    { role: LlmChatRole.User, content: "什么是微积分？" },
  ],
  purposeSummary: "test",
});

assert(result2.ok === true, "fake fetch success → ok=true");
assert(result2.realProviderCalled === true, "fake fetch → realProviderCalled=true");
assert(result2.networkAccessed === true, "fake fetch → networkAccessed=true");
assertContains(result2.answerSummary, "这是来自 AI 的回答", "answer preserved");
assert(result2.secretSafe === true, "secretSafe is true");
assert(result2.rawPromptStored === false, "rawPromptStored is false");
assert(result2.rawResponseStored === false, "rawResponseStored is false");

// ---------------------------------------------------------------------------
// Provider: fake fetch HTTP error (401)
// ---------------------------------------------------------------------------

console.log("\n--- Provider: fake fetch HTTP 401 ---");

function createFakeErrorFetch(status) {
  return async (_url, _init) => {
    return {
      ok: false,
      status,
      text: async () => JSON.stringify({ error: "unauthorized" }),
    };
  };
}

const error401Provider = new ExternalChatCompletionsProvider(
  config4,
  createFakeErrorFetch(401),
);

const result3 = await error401Provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  purposeSummary: "test",
});

assert(result3.ok === false, "HTTP 401 → ok=false");
assert(result3.realProviderCalled === true, "HTTP 401 → realProviderCalled=true");
assert(result3.error !== undefined, "HTTP 401 → error present");
assertEqual(result3.error.kind, "provider_disabled", "401 → provider_disabled error");

// ---------------------------------------------------------------------------
// Provider: fake fetch HTTP 500
// ---------------------------------------------------------------------------

console.log("\n--- Provider: fake fetch HTTP 500 ---");

const error500Provider = new ExternalChatCompletionsProvider(
  config4,
  createFakeErrorFetch(500),
);

const result4 = await error500Provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  purposeSummary: "test",
});

assert(result4.ok === false, "HTTP 500 → ok=false");
assert(result4.error !== undefined, "HTTP 500 → error present");
assertEqual(result4.error.kind, "provider_error", "500 → provider_error");
assert(result4.error.retryable === true, "500 → retryable");

// ---------------------------------------------------------------------------
// Provider: fake fetch HTTP 429
// ---------------------------------------------------------------------------

console.log("\n--- Provider: fake fetch HTTP 429 ---");

const error429Provider = new ExternalChatCompletionsProvider(
  config4,
  createFakeErrorFetch(429),
);

const result5 = await error429Provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  purposeSummary: "test",
});

assert(result5.ok === false, "HTTP 429 → ok=false");
assertEqual(result5.error.retryable, true, "429 → retryable");

// ---------------------------------------------------------------------------
// Provider: fake fetch timeout (AbortController)
// ---------------------------------------------------------------------------

console.log("\n--- Provider: fake fetch timeout ---");

function createFakeTimeoutFetch() {
  return async (_url, init) => {
    // Simulate timeout by throwing AbortError
    const err = new DOMException("The operation was aborted.", "AbortError");
    throw err;
  };
}

const timeoutProvider = new ExternalChatCompletionsProvider(
  { ...config4, timeoutMs: 10 },
  createFakeTimeoutFetch(),
);

const result6 = await timeoutProvider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  timeoutMs: 10,
  purposeSummary: "test",
});

assert(result6.ok === false, "timeout → ok=false");
assert(result6.error !== undefined, "timeout → error present");
assertEqual(result6.error.kind, "timeout", "timeout → error kind is timeout");
assert(result6.error.retryable === true, "timeout → retryable");

// ---------------------------------------------------------------------------
// Provider: empty response body
// ---------------------------------------------------------------------------

console.log("\n--- Provider: empty response ---");

function createFakeEmptyFetch() {
  return async (_url, _init) => {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [] }),
    };
  };
}

const emptyProvider = new ExternalChatCompletionsProvider(
  config4,
  createFakeEmptyFetch(),
);

const result7 = await emptyProvider.generate({
  messages: [
    { role: LlmChatRole.User, content: "Hello" },
  ],
  purposeSummary: "test",
});

assert(result7.ok === false, "empty response → ok=false");
assert(result7.error !== undefined, "empty response → error present");
assertEqual(result7.error.kind, "empty_response", "empty → empty_response");

// ---------------------------------------------------------------------------
// Provider: no user message → blocked
// ---------------------------------------------------------------------------

console.log("\n--- Provider: no user message ---");

const result8 = await successProvider.generate({
  messages: [
    { role: LlmChatRole.System, content: "System only" },
  ],
  purposeSummary: "test",
});

assert(result8.ok === false, "no user message → ok=false");

// ---------------------------------------------------------------------------
// Provider: answer contains sensitive data → sanitized
// ---------------------------------------------------------------------------

console.log("\n--- Provider: answer sanitization ---");

const sensitiveFetch = createFakeSuccessFetch(
  "Here is your API key: sk-abc123 and bearer xyz789",
);
const sensitiveProvider = new ExternalChatCompletionsProvider(
  config4,
  sensitiveFetch,
);

const result9 = await sensitiveProvider.generate({
  messages: [
    { role: LlmChatRole.User, content: "What is my key?" },
  ],
  purposeSummary: "test",
});

assert(result9.ok === true, "sensitive response → ok=true (sanitized)");
assert(!result9.answerSummary.includes("sk-abc123"), "API key redacted");
assert(!result9.answerSummary.includes("xyz789"), "bearer token redacted");

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

console.log(`\n${passed} pass / ${failed} fail`);

if (failures.length > 0) {
  console.log(`\n${YELLOW}Failures:${RESET}`);
  failures.forEach((f) => console.log(`  ${RED}${f}${RESET}`));
}

process.exit(failed > 0 ? 1 : 0);
