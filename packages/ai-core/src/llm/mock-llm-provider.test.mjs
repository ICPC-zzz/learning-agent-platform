/**
 * mock-llm-provider.test.mjs
 *
 * Tests for MockLlmProvider — no network access, stable Chinese responses,
 * providerMode=mock, realProviderCalled=false, and input validation.
 *
 * Run: node packages/ai-core/src/llm/mock-llm-provider.test.mjs
 */

import { LlmChatRole } from "./llm-provider-contract.ts";
import { MockLlmProvider } from "./mock-llm-provider.ts";

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

const provider = new MockLlmProvider();

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

console.log("\n--- Provider identity ---");

assertEqual(provider.mode, "mock", "mode is mock");
assert(provider.label.includes("Mock"), "label includes 'Mock'");
assert(provider.label.includes("开发预览"), "label includes '开发预览'");

// ---------------------------------------------------------------------------
// Basic generation
// ---------------------------------------------------------------------------

console.log("\n--- Basic generation ---");

const result1 = await provider.generate({
  messages: [
    { role: LlmChatRole.System, content: "你是一个编程助手。" },
    { role: LlmChatRole.User, content: "请解释什么是递归？" },
  ],
  purposeSummary: "测试 mock provider",
});

assert(result1.ok === true, "basic generation → ok=true");
assertEqual(result1.providerMode, "mock", "providerMode is mock");
assert(result1.realProviderCalled === false, "realProviderCalled is false");
assert(result1.networkAccessed === false, "networkAccessed is false");
assert(result1.secretSafe === true, "secretSafe is true");
assert(result1.rawPromptStored === false, "rawPromptStored is false");
assert(result1.rawResponseStored === false, "rawResponseStored is false");
assert(result1.devOnly === true, "devOnly is true");
assert(result1.productionReady === false, "productionReady is false");
assertContains(result1.answerSummary, "Mock Provider", "answer mentions Mock Provider");
assertContains(result1.answerSummary, "mock", "answer mentions mock");

// ---------------------------------------------------------------------------
// Code question → code topic answer
// ---------------------------------------------------------------------------

console.log("\n--- Code question ---");

const result2 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "这段代码有什么错误？" },
  ],
  purposeSummary: "测试代码问题",
});

assert(result2.ok === true, "code question → ok=true");
assertContains(result2.answerSummary, "代码", "answer mentions 代码");

// ---------------------------------------------------------------------------
// Concept question → concept topic answer
// ---------------------------------------------------------------------------

console.log("\n--- Concept question ---");

const result3 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "什么是面向对象编程的原理？" },
  ],
  purposeSummary: "测试概念问题",
});

assert(result3.ok === true, "concept question → ok=true");
assertContains(result3.answerSummary, "概念", "answer mentions 概念");

// ---------------------------------------------------------------------------
// Empty messages → validation error
// ---------------------------------------------------------------------------

console.log("\n--- Empty messages ---");

const result4 = await provider.generate({
  messages: [],
  purposeSummary: "测试空消息",
});

assert(result4.ok === false, "empty messages → ok=false");
assert(result4.error !== undefined, "empty messages → error present");
assertEqual(result4.error.kind, "invalid_request", "error kind is invalid_request");

// ---------------------------------------------------------------------------
// No user message → validation error
// ---------------------------------------------------------------------------

console.log("\n--- No user message ---");

const result5 = await provider.generate({
  messages: [
    { role: LlmChatRole.System, content: "System prompt only." },
  ],
  purposeSummary: "测试无用户消息",
});

assert(result5.ok === false, "no user message → ok=false");

// ---------------------------------------------------------------------------
// Empty question → validation error
// ---------------------------------------------------------------------------

console.log("\n--- Empty question ---");

const result6 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "   " },
  ],
  purposeSummary: "测试空问题",
});

assert(result6.ok === false, "empty question → ok=false");

// ---------------------------------------------------------------------------
// Sensitive content in message → blocked
// ---------------------------------------------------------------------------

console.log("\n--- Sensitive content detection ---");

const result7 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "My API key is sk-12345 and token is abc" },
  ],
  purposeSummary: "测试敏感字段",
});

assert(result7.ok === false, "sensitive content → ok=false");

const result8 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: "DATABASE_URL is postgres://..." },
  ],
  purposeSummary: "测试 DATABASE_URL",
});

assert(result8.ok === false, "DATABASE_URL content → ok=false");

// ---------------------------------------------------------------------------
// Max input chars exceeded → blocked
// ---------------------------------------------------------------------------

console.log("\n--- Max input chars ---");

const longMsg = "a".repeat(5000);
const result9 = await provider.generate({
  messages: [
    { role: LlmChatRole.User, content: longMsg },
  ],
  maxInputChars: 100,
  purposeSummary: "测试超长输入",
});

assert(result9.ok === false, "max input chars exceeded → ok=false");

// ---------------------------------------------------------------------------
// Multiple messages
// ---------------------------------------------------------------------------

console.log("\n--- Multiple messages ---");

const result10 = await provider.generate({
  messages: [
    { role: LlmChatRole.System, content: "系统提示" },
    { role: LlmChatRole.User, content: "第一个问题" },
    { role: LlmChatRole.Assistant, content: "第一个回答" },
    { role: LlmChatRole.User, content: "第二个问题：关于函数式编程" },
  ],
  purposeSummary: "测试多轮消息",
});

assert(result10.ok === true, "multiple messages → ok=true");

// ---------------------------------------------------------------------------
// Network not accessed
// ---------------------------------------------------------------------------

console.log("\n--- No network access ---");

// All results from mock should have networkAccessed=false
const results = [result1, result2, result3, result10];
for (let i = 0; i < results.length; i++) {
  assert(results[i].networkAccessed === false, `result ${i + 1} → networkAccessed=false`);
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
