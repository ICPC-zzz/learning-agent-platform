import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractExplicitLongTermMemory,
  isCodeforcesRefreshReminderMemory,
} from "../apps/web/src/lib/assistant/assistant-intent-resolver.ts";

describe("A517 report freshness memory semantics", () => {
  it("supersedes the old manual-refresh reminder with automatic freshness checks", () => {
    const text = "请记住：推荐题目和制定学习计划时，提醒我刷新学习分析报告和复习计划";
    assert.equal(isCodeforcesRefreshReminderMemory(text), true);

    const memory = extractExplicitLongTermMemory(text);

    assert.ok(memory);
    assert.match(memory.normalizedMemory, /先检查.*新鲜度/);
    assert.match(memory.normalizedMemory, /自动刷新/);
    assert.doesNotMatch(memory.normalizedMemory, /先提醒用户刷新/);
  });
});
