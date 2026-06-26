/**
 * reader-ai-qa-view-model.test.mjs
 *
 * Tests for Reader AI QA view model — UI state computation, label safety
 * checks, forbidden label detection, and safe result validation.
 *
 * Run: node apps/web/src/app/reader/reader-ai-qa-view-model.test.mjs
 */

import * as vm from "./reader-ai-qa-view-model.ts";

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
// Initial state (no result yet)
// ---------------------------------------------------------------------------

console.log("\n--- Initial state ---");

const vm1 = vm.buildReaderAiQaPanelViewModel({
  result: null,
  submitError: null,
  isSubmitting: false,
  question: "",
});

assertEqual(vm1.modeCssClass, "mock", "initial → mock mode");
assert(vm1.modeLabel.includes("mock"), "initial → mock label");
assert(vm1.modeDescription.includes("开发预览"), "initial → mentions 开发预览");
assert(vm1.modeDescription.includes("不调用真实 AI"), "initial → mentions 不调用真实 AI");
assert(vm1.inputDisabled === false, "initial → input enabled");
assert(vm1.submitDisabled === false, "initial → submit enabled");
assert(vm1.eyebrowLabel.includes("开发预览"), "eyebrow includes 开发预览");
assert(vm1.labelsSafe === true, "initial labels safe");

// ---------------------------------------------------------------------------
// Blocked result
// ---------------------------------------------------------------------------

console.log("\n--- Blocked result ---");

const blockedResult = {
  success: false,
  answerPreview: "[blocked] reader_ai_qa_dev_disabled",
  providerMode: "blocked",
  realProviderCalled: false,
  devOnly: true,
  productionReady: false,
  blockedReasons: ["reader_ai_qa_dev_disabled"],
  safeToExposeToClient: {
    guardMode: "blocked",
    guardNotice: "未启用。",
    guardSourceLabel: "blocked",
    contextUsed: false,
    contextTruncated: false,
    sensitiveFieldsDetected: false,
    charCounts: null,
  },
  warnings: ["阻止原因: reader_ai_qa_dev_disabled"],
};

const vm2 = vm.buildReaderAiQaPanelViewModel({
  result: blockedResult,
  submitError: null,
  isSubmitting: false,
  question: "test",
});

assertEqual(vm2.modeCssClass, "blocked", "blocked → blocked css");
assert(vm2.modeLabel.includes("blocked"), "blocked → blocked label");
assert(vm2.inputDisabled === true, "blocked → input disabled");
assert(vm2.submitDisabled === true, "blocked → submit disabled");
assert(vm2.labelsSafe === true, "blocked labels safe");

// ---------------------------------------------------------------------------
// Mock result
// ---------------------------------------------------------------------------

console.log("\n--- Mock result ---");

const mockResult = {
  success: true,
  answerPreview: "【Mock Provider 回答 · 开发预览】\n\n这是模拟回答。",
  providerMode: "mock",
  realProviderCalled: false,
  devOnly: true,
  productionReady: false,
  blockedReasons: [],
  safeToExposeToClient: {
    guardMode: "mock_only",
    guardNotice: "mock-only",
    guardSourceLabel: "mock-only",
    contextUsed: true,
    contextTruncated: false,
    sensitiveFieldsDetected: false,
    charCounts: { chapterOriginal: 100, chapterTruncated: 100, questionOriginal: 10, questionTruncated: 10, totalInput: 200 },
  },
  warnings: ["Mock provider only."],
};

const vm3 = vm.buildReaderAiQaPanelViewModel({
  result: mockResult,
  submitError: null,
  isSubmitting: false,
  question: "test",
});

assertEqual(vm3.modeCssClass, "mock", "mock result → mock css");
assert(vm3.modeLabel.includes("mock"), "mock result → mock label");
assert(vm3.labelsSafe === true, "mock result labels safe");

// ---------------------------------------------------------------------------
// External-dev result
// ---------------------------------------------------------------------------

console.log("\n--- External-dev result ---");

const extResult = {
  success: true,
  answerPreview: "这是来自 AI 的真实回答。",
  providerMode: "external-dev-only",
  realProviderCalled: true,
  devOnly: true,
  productionReady: false,
  blockedReasons: [],
  safeToExposeToClient: {
    guardMode: "external_dev",
    guardNotice: "external dev available",
    guardSourceLabel: "external-dev",
    contextUsed: true,
    contextTruncated: false,
    sensitiveFieldsDetected: false,
    charCounts: { chapterOriginal: 100, chapterTruncated: 100, questionOriginal: 10, questionTruncated: 10, totalInput: 200 },
  },
  warnings: ["External provider."],
};

const vm4 = vm.buildReaderAiQaPanelViewModel({
  result: extResult,
  submitError: null,
  isSubmitting: false,
  question: "test",
});

assertEqual(vm4.modeCssClass, "external", "ext result → external css");
assert(vm4.modeLabel.includes("external"), "ext result → external label");
assert(vm4.modeLabel.includes("真实调用"), "ext result → mentions 真实调用");
assert(vm4.labelsSafe === true, "ext result labels safe");

// ---------------------------------------------------------------------------
// checkLabels — forbidden labels
// ---------------------------------------------------------------------------

console.log("\n--- checkLabels ---");

const cl1 = vm.checkLabels("开发预览 · mock 默认");
assert(cl1.safe === true, "safe text → safe");

const cl2 = vm.checkLabels("生产 AI 已接入，真实工具执行");
assert(cl2.safe === false, "forbidden labels → unsafe");
assert(cl2.violations.includes("生产 AI 已接入"), "'生产 AI 已接入' detected");
assert(cl2.violations.includes("真实工具执行"), "'真实工具执行' detected");

const cl3 = vm.checkLabels("Agent 已运行，已连接生产模型");
assert(cl3.safe === false, "Agent labels → unsafe");
assert(cl3.violations.length >= 2, "multiple violations");

// ---------------------------------------------------------------------------
// hasForbiddenAIClaims
// ---------------------------------------------------------------------------

console.log("\n--- hasForbiddenAIClaims ---");

assert(vm.hasForbiddenAIClaims("生产 AI 已接入") === true, "forbidden claim detected");
assert(vm.hasForbiddenAIClaims("真实工具执行完成") === true, "forbidden tool claim detected");
assert(vm.hasForbiddenAIClaims("Agent 已运行中") === true, "forbidden agent claim detected");
assert(vm.hasForbiddenAIClaims("这是一段普通的回答") === false, "normal text → no forbidden claims");
assert(vm.hasForbiddenAIClaims("开发预览 mock 默认") === false, "safe labels → no claims");

// ---------------------------------------------------------------------------
// checkRequiredSafeLabels
// ---------------------------------------------------------------------------

console.log("\n--- checkRequiredSafeLabels ---");

const safeLabels1 = vm.checkRequiredSafeLabels("开发预览 · dev-only · mock · 未接生产");
assertEqual(safeLabels1.length, 0, "all required safe labels present → no missing");

const safeLabels2 = vm.checkRequiredSafeLabels("普通文本");
assert(safeLabels2.length > 0, "missing safe labels → detected");
assert(safeLabels2.includes("开发预览"), "missing 开发预览");

// ---------------------------------------------------------------------------
// isServerActionResultSafe
// ---------------------------------------------------------------------------

console.log("\n--- isServerActionResultSafe ---");

const safeCheck1 = vm.isServerActionResultSafe(mockResult);
assert(safeCheck1.safe === true, "mock result → safe");

const unsafeResult = {
  ...mockResult,
  productionReady: true,
};
const safeCheck2 = vm.isServerActionResultSafe(unsafeResult);
assert(safeCheck2.safe === false, "productionReady=true → unsafe");
assert(safeCheck2.violations.some((v) => v.includes("productionReady")), "productionReady violation");

const unsafeResult2 = {
  ...mockResult,
  answerPreview: "生产 AI 已接入，请提问。",
};
const safeCheck3 = vm.isServerActionResultSafe(unsafeResult2);
assert(safeCheck3.safe === false, "forbidden label in answer → unsafe");

// ---------------------------------------------------------------------------
// View model: forbidden labels in UI text
// ---------------------------------------------------------------------------

console.log("\n--- View model: forbidden labels in UI ---");

const vm5 = vm.buildReaderAiQaPanelViewModel({
  result: {
    ...mockResult,
    answerPreview: "生产 AI 已接入你的问题", // This has a forbidden label
  },
  submitError: null,
  isSubmitting: false,
  question: "test",
});

assert(vm5.labelsSafe === true, "forbidden label in result → still safe in vm (vm checks its own labels)");

// ---------------------------------------------------------------------------
// Labels do not contain forbidden production AI claims
// ---------------------------------------------------------------------------

console.log("\n--- All view model labels avoid forbidden claims ---");

// All view model states should pass
const allVms = [vm1, vm2, vm3, vm4, vm5];
for (let i = 0; i < allVms.length; i++) {
  const v = allVms[i];
  const allText = [v.eyebrowLabel, v.modeLabel, v.modeDescription, v.submitLabel].join(" ");
  assert(vm.hasForbiddenAIClaims(allText) === false, `vm state ${i + 1} → no forbidden claims`);
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
