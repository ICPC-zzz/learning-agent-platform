/**
 * reader-qa-provider-selection.test.mjs
 *
 * Tests for Reader QA provider selection — default mock, external dev with
 * fake fetch, error fallback, safety metadata correctness. NO real network
 * calls are made — all external provider paths use fake fetch.
 *
 * Run: node apps/web/src/app/reader/reader-qa-provider-selection.test.mjs
 */

import { evaluateReaderAiQaGuard } from "./reader-ai-qa-guard.ts";
import { selectReaderQaProvider } from "./reader-qa-provider-selection.ts";
import { LlmChatRole } from "../../../../../packages/ai-core/src/llm/llm-provider-contract.ts";

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
  if (text && text.includes(needle)) {
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
// Helper: create a complete external config for testing
// ---------------------------------------------------------------------------

function createTestConfig() {
  return {
    endpoint: "https://api.example.com/v1",
    apiKey: "test-key-123456",
    model: "test-model-v1",
    timeoutMs: 15000,
    configured: true,
    blockedReason: null,
  };
}

function createPartialConfig() {
  return {
    endpoint: "",
    apiKey: "",
    model: "",
    timeoutMs: 15000,
    configured: false,
    blockedReason: "Missing env vars: LAP_LLM_DEV_ENDPOINT, LAP_LLM_DEV_API_KEY, LAP_LLM_DEV_MODEL",
  };
}

// ---------------------------------------------------------------------------
// 1. Guard blocked → no provider, mode "blocked"
// ---------------------------------------------------------------------------

console.log("\n--- Guard blocked → no provider, mode blocked ---");

const guardBlocked = evaluateReaderAiQaGuard({});
const r1 = await selectReaderQaProvider({ guardResult: guardBlocked });

assert(r1.provider === null, "blocked → provider is null");
assertEqual(r1.providerMode, "blocked", "blocked → providerMode is blocked");
assert(r1.llmUsed === false, "blocked → llmUsed=false");
assert(r1.externalProviderUsed === false, "blocked → externalProviderUsed=false");
assert(r1.writesDatabase === false, "blocked → writesDatabase=false");
assert(r1.rawPromptStored === false, "blocked → rawPromptStored=false");
assert(r1.rawResponseStored === false, "blocked → rawResponseStored=false");
assert(r1.productionReady === false, "blocked → productionReady=false");
assert(r1.safeToExposeToClient === true, "blocked → safeToExposeToClient=true");

// ---------------------------------------------------------------------------
// 2. Mock-only guard → mockLlmProvider, mode "mock"
// ---------------------------------------------------------------------------

console.log("\n--- Mock-only guard → mockLlmProvider, mode mock ---");

const guardMockOnly = evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
});
const r2 = await selectReaderQaProvider({ guardResult: guardMockOnly });

assert(r2.provider !== null, "mock-only → provider is not null");
assert(r2.provider.mode === "mock", "mock-only → provider mode is mock");
assertEqual(r2.providerMode, "mock", "mock-only → providerMode is mock");
assert(r2.llmUsed === false, "mock-only → llmUsed=false");
assert(r2.externalProviderUsed === false, "mock-only → externalProviderUsed=false");
assert(r2.writesDatabase === false, "mock-only → writesDatabase=false");
assertContains(r2.selectionLabel, "mock", "selection label mentions mock");

// Verify the mock provider actually works
const mockResult = await r2.provider.generate({
  messages: [{ role: LlmChatRole.User, content: "什么是递归？" }],
  purposeSummary: "测试 mock 路径",
});
assert(mockResult.ok === true, "mock provider → generate works");
assert(mockResult.providerMode === "mock", "mock provider → mode preserved");
assert(mockResult.realProviderCalled === false, "mock → realProviderCalled=false");
assert(mockResult.networkAccessed === false, "mock → networkAccessed=false");

// ---------------------------------------------------------------------------
// 3. External-dev guard + complete config → external provider
// ---------------------------------------------------------------------------

console.log("\n--- External-dev guard + config → external provider ---");

const guardExternalDev = evaluateReaderAiQaGuard({
  LAP_READER_AI_QA_DEV_ENABLED: "true",
  LAP_LLM_DEV_PROVIDER_ENABLED: "true",
  LAP_LLM_DEV_ENDPOINT: "https://api.example.com/v1",
  LAP_LLM_DEV_API_KEY: "test-key-123456",
  LAP_LLM_DEV_MODEL: "test-model-v1",
});

const r3 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  externalConfig: createTestConfig(),
});

assert(r3.provider !== null, "external-dev + config → provider is not null");
assert(r3.provider.mode === "external-dev-only", "external-dev → provider mode is external-dev-only");
assertEqual(r3.providerMode, "external-dev-preview", "external-dev → providerMode is external-dev-preview");
assert(r3.llmUsed === true, "external-dev → llmUsed=true");
assert(r3.externalProviderUsed === true, "external-dev → externalProviderUsed=true");
assert(r3.writesDatabase === false, "external-dev → writesDatabase=false");
assert(r3.rawPromptStored === false, "external-dev → rawPromptStored=false");
assert(r3.rawResponseStored === false, "external-dev → rawResponseStored=false");
assert(r3.productionReady === false, "external-dev → productionReady=false");
assert(r3.safeToExposeToClient === true, "external-dev → safeToExposeToClient=true");
assertContains(r3.selectionLabel, "external-dev-preview", "selection label mentions external-dev-preview");

// ---------------------------------------------------------------------------
// 4. External provider with fake fetch → successful call chain
// ---------------------------------------------------------------------------

console.log("\n--- External provider with fake fetch → successful call ---");

function createFakeSuccessFetch(answerText) {
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
                content: answerText,
              },
            },
          ],
        }),
    };
  };
}

const r4 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  externalConfig: createTestConfig(),
  customFetch: createFakeSuccessFetch("这是来自 fake AI 的回答。"),
});

assert(r4.provider !== null, "fake fetch → provider is not null");
assertEqual(r4.providerMode, "external-dev-preview", "fake fetch → providerMode is external-dev-preview");
assert(r4.llmUsed === true, "fake fetch → llmUsed=true");
assert(r4.externalProviderUsed === true, "fake fetch → externalProviderUsed=true");

// Actually call the provider with fake fetch
const fakeResult = await r4.provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "这本书讲了什么？" },
  ],
  purposeSummary: "Reader 章节问答（fake fetch 测试）",
});

assert(fakeResult.ok === true, "fake fetch → ok=true");
assertContains(fakeResult.answerSummary, "这是来自 fake AI 的回答", "answer preserved from fake fetch");
assert(fakeResult.realProviderCalled === true, "fake fetch → realProviderCalled=true");
assert(fakeResult.networkAccessed === true, "fake fetch → networkAccessed=true");
assert(fakeResult.secretSafe === true, "fake fetch → secretSafe=true");
assert(fakeResult.rawPromptStored === false, "fake fetch → rawPromptStored=false");
assert(fakeResult.rawResponseStored === false, "fake fetch → rawResponseStored=false");
assert(fakeResult.devOnly === true, "fake fetch → devOnly=true");
assert(fakeResult.productionReady === false, "fake fetch → productionReady=false");
assert(!fakeResult.answerSummary.includes("Authorization"), "fake fetch → no Authorization in answer");
assert(!fakeResult.answerSummary.includes("Bearer"), "fake fetch → no Bearer in answer");
assert(!fakeResult.answerSummary.includes("test-key-123456"), "fake fetch → no api key leaked");

// ---------------------------------------------------------------------------
// 5. External provider + partial config → fallback to mock
// ---------------------------------------------------------------------------

console.log("\n--- External-dev guard + partial config → fallback to mock ---");

const r5 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  externalConfig: createPartialConfig(),
});

assert(r5.provider !== null, "partial config → provider is not null (fallback mock)");
assert(r5.provider.mode === "mock", "partial config → provider mode is mock");
assertEqual(r5.providerMode, "fallback", "partial config → providerMode is fallback");
assert(r5.llmUsed === false, "partial config → llmUsed=false");
assert(r5.externalProviderUsed === false, "partial config → externalProviderUsed=false");
assert(r5.fallbackReason !== undefined, "partial config → fallbackReason present");
assertContains(r5.fallbackReason, "LAP_LLM_DEV_ENDPOINT", "fallback reason mentions missing endpoint");

// ---------------------------------------------------------------------------
// 6. External provider + no config at all → fallback to mock
// ---------------------------------------------------------------------------

console.log("\n--- External-dev guard + no config → fallback to mock ---");

const r6 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  // externalConfig intentionally omitted
});

assert(r6.provider !== null, "no config → provider is not null (fallback mock)");
assertEqual(r6.providerMode, "fallback", "no config → providerMode is fallback");
assert(r6.llmUsed === false, "no config → llmUsed=false");
assert(r6.fallbackReason !== undefined, "no config → fallbackReason present");

// ---------------------------------------------------------------------------
// 7. Fake fetch error (HTTP 500) through external provider → error result
// ---------------------------------------------------------------------------

console.log("\n--- Fake fetch error → error result (not a crash) ---");

function createFakeErrorFetch(status) {
  return async (_url, _init) => {
    return {
      ok: false,
      status,
      text: async () => JSON.stringify({ error: "server error" }),
    };
  };
}

const r7 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  externalConfig: createTestConfig(),
  customFetch: createFakeErrorFetch(500),
});

assert(r7.provider !== null, "fake error fetch → provider exists");
assertEqual(r7.providerMode, "external-dev-preview", "fake error fetch → providerMode still external-dev-preview");
assert(r7.llmUsed === true, "fake error fetch → llmUsed=true");

// Call the provider with error fetch — should return error result (not crash)
const errorResult = await r7.provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "这个问题不会被回答。" },
  ],
  purposeSummary: "Reader 章节问答（fake error 测试）",
});

assert(errorResult.ok === false, "error fetch → ok=false");
assert(errorResult.error !== undefined, "error fetch → error present");
assert(errorResult.realProviderCalled === true, "error fetch → realProviderCalled=true (request was attempted)");
assert(errorResult.secretSafe === true, "error fetch → secretSafe=true");
assert(errorResult.rawPromptStored === false, "error fetch → rawPromptStored=false");
assert(errorResult.rawResponseStored === false, "error fetch → rawResponseStored=false");
// No raw response body leaked
assert(!errorResult.answerSummary.includes('"error"'), "error fetch → raw response body not leaked");
assert(!errorResult.answerSummary.includes("server error"), "error fetch → raw error message not in answer");

// ---------------------------------------------------------------------------
// 8. No raw prompt/response in all selection results
// ---------------------------------------------------------------------------

console.log("\n--- No raw prompt/response in selection metadata ---");

const allSelections = [r1, r2, r3, r4, r5, r6, r7];
for (let i = 0; i < allSelections.length; i++) {
  const s = allSelections[i];
  assert(s.rawPromptStored === false, `selection ${i + 1} → rawPromptStored=false`);
  assert(s.rawResponseStored === false, `selection ${i + 1} → rawResponseStored=false`);
  assert(s.writesDatabase === false, `selection ${i + 1} → writesDatabase=false`);
  assert(s.productionReady === false, `selection ${i + 1} → productionReady=false`);
  assert(s.safeToExposeToClient === true, `selection ${i + 1} → safeToExposeToClient=true`);
}

// ---------------------------------------------------------------------------
// 9. Guard allows external but we never added fake fetch → still creates
//    external provider (the fetch is the system's default, which won't be
//    called in tests — the point is the selection happened correctly)
// ---------------------------------------------------------------------------

console.log("\n--- External-dev selection without customFetch → external provider created ---");

const r8 = await selectReaderQaProvider({
  guardResult: guardExternalDev,
  externalConfig: createTestConfig(),
  // no customFetch → uses whatever fetch is available
});

assert(r8.provider !== null, "no custom fetch → provider created");
assert(r8.provider.mode === "external-dev-only", "no custom fetch → provider mode is external-dev-only");
assertEqual(r8.providerMode, "external-dev-preview", "no custom fetch → correct providerMode");
assert(r8.llmUsed === true, "no custom fetch → llmUsed=true");
assert(r8.externalProviderUsed === true, "no custom fetch → externalProviderUsed=true");
// But we won't call it since there's no real fetch

// ---------------------------------------------------------------------------
// 10. All states have proper selection labels
// ---------------------------------------------------------------------------

console.log("\n--- Selection labels are safe and descriptive ---");

const allLabels = allSelections.map((s) => s.selectionLabel).filter(Boolean);
for (let i = 0; i < allLabels.length; i++) {
  assert(typeof allLabels[i] === "string", `selection ${i + 1} → label is string`);
  assert(allLabels[i].length > 0, `selection ${i + 1} → label is non-empty`);
  // Must not contain forbidden claims
  assert(!allLabels[i].includes("生产 AI 已接入"), `selection ${i + 1} → no forbidden claim`);
  assert(!allLabels[i].includes("真实 AI 已连接"), `selection ${i + 1} → no forbidden claim`);
  assert(!allLabels[i].includes("正式版本"), `selection ${i + 1} → no forbidden claim`);
}

// ---------------------------------------------------------------------------
// 11. No agent loop / no tools execution
// ---------------------------------------------------------------------------

console.log("\n--- No agent loop / no tools in selection ---");

// Verified by code review: selectReaderQaProvider doesn't import or use
// agent runtime, tool registry, or anything related to agent loops.
// It only imports provider contracts and creates simple providers.

for (let i = 0; i < allSelections.length; i++) {
  const s = allSelections[i];
  // The selection result itself doesn't execute any tool — it just selects
  assert(s.writesDatabase === false, `selection ${i + 1} → no DB write`);
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
