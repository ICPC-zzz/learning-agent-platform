import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CompressionReason,
  ContextBudgetStatus,
  authorizeMemoryWrite,
  buildActiveConversationContext,
  createA505ContextBudget,
  createStructuredCompressionSummary,
  estimateTextTokens,
  formatStructuredCompressionSummary,
  isExplicitCompressionCommand,
  sanitizeCompressionText,
  selectMessagesForCompression,
  shouldAutoCompress,
  MemoryRecordStatus,
  MemorySource,
  MemoryTier,
} from "../packages/ai-core/src/memory/index.ts";

function makeMessage(id, role, visibleContent, createdAt = `2026-06-27T00:00:0${id}.000Z`) {
  return {
    id: `m${id}`,
    conversationId: "conv-a",
    role,
    visibleContent,
    createdAt,
  };
}

describe("A505 context compression pure logic", () => {
  it("estimates tokens deterministically", () => {
    assert.equal(estimateTextTokens(""), 0);
    assert.equal(estimateTextTokens("abcd"), 1);
    assert.equal(estimateTextTokens("abcdefgh"), 2);
    assert.equal(estimateTextTokens("压缩上下文"), 4);
    assert.equal(estimateTextTokens("压缩上下文"), estimateTextTokens("压缩上下文"));
  });

  it("uses centralized budget thresholds", () => {
    const budget = createA505ContextBudget(1000);
    assert.equal(budget.contextWindowTokens, 1000);
    assert.equal(budget.reservedOutputTokens, 128);

    const warningThreshold = 611;
    const compressionThreshold = 741;
    const blockingThreshold = 828;

    const warning = shouldAutoCompress({
      status: ContextBudgetStatus.Warning,
      currentInputTokens: warningThreshold,
      effectiveInputLimit: 872,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed: 70,
      needsCompression: false,
      canContinueWithoutCompression: true,
    });
    assert.equal(warning, false);

    const needsCompression = shouldAutoCompress({
      status: ContextBudgetStatus.NeedsCompression,
      currentInputTokens: compressionThreshold,
      effectiveInputLimit: 872,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed: 85,
      needsCompression: true,
      canContinueWithoutCompression: true,
    });
    assert.equal(needsCompression, true);

    const blocking = shouldAutoCompress({
      status: ContextBudgetStatus.Blocking,
      currentInputTokens: blockingThreshold,
      effectiveInputLimit: 872,
      warningThreshold,
      compressionThreshold,
      blockingThreshold,
      percentUsed: 95,
      needsCompression: true,
      canContinueWithoutCompression: false,
    });
    assert.equal(blocking, true);
  });

  it("matches only explicit compression commands", () => {
    assert.equal(isExplicitCompressionCommand("压缩当前上下文"), true);
    assert.equal(isExplicitCompressionCommand("请整理并压缩这段对话"), true);
    assert.equal(isExplicitCompressionCommand("帮我压缩当前会话"), true);
    assert.equal(isExplicitCompressionCommand("总结当前对话并释放上下文"), true);

    assert.equal(isExplicitCompressionCommand("什么是上下文压缩"), false);
    assert.equal(isExplicitCompressionCommand("解释一下会话压缩的原理"), false);
    assert.equal(isExplicitCompressionCommand("这段代码怎么优化"), false);
  });

  it("creates structured summaries only from existing messages and redacts secrets", () => {
    const messages = [
      makeMessage(1, "user", "目标：在 /ai 实现上下文压缩闭环。不要调用真实 LLM。api_key=sk-secretsecret"),
      makeMessage(2, "assistant", "已经确认 apps/web/src/app/ai/page.tsx 存在对话入口。"),
      makeMessage(3, "user", "尚未解决的问题：刷新后摘要是否恢复？"),
    ];

    const summary = createStructuredCompressionSummary(messages);
    const text = formatStructuredCompressionSummary(summary);

    assert.match(text, /上下文压缩闭环/);
    assert.match(text, /apps\/web\/src\/app\/ai\/page\.tsx/);
    assert.match(text, /刷新后摘要是否恢复/);
    assert.doesNotMatch(text, /sk-secretsecret/);
    assert.match(sanitizeCompressionText("token=abc123"), /\[REDACTED\]/);
  });

  it("retains recent messages and excludes archived messages from active context", () => {
    const messages = [
      makeMessage(1, "user", "目标：完成 A505"),
      makeMessage(2, "assistant", "已记录目标"),
      makeMessage(3, "user", "约束：不调用真实 LLM"),
      makeMessage(4, "assistant", "已确认约束"),
      makeMessage(5, "user", "继续发送消息"),
    ];
    const selected = selectMessagesForCompression(messages, 2);
    assert.deepEqual(selected.sourceMessages.map((message) => message.id), ["m1", "m2", "m3"]);
    assert.deepEqual(selected.retainedMessages.map((message) => message.id), ["m4", "m5"]);

    const compression = {
      id: "c1",
      conversationId: "conv-a",
      reason: CompressionReason.UserRequested,
      trigger: "manual_button",
      summary: createStructuredCompressionSummary(selected.sourceMessages),
      summaryText: "用户当前目标\n- 用户：目标：完成 A505",
      beforeEstimatedTokens: 100,
      afterEstimatedTokens: 50,
      archivedMessageCount: 3,
      retainedMessageCount: 2,
      compressedThroughMessageId: "m3",
      createdAt: "2026-06-27T00:01:00.000Z",
      compressorKind: "local_structured_v1",
    };
    const archived = messages.map((message) =>
      ["m1", "m2", "m3"].includes(message.id)
        ? { ...message, archivedAt: "2026-06-27T00:01:00.000Z", compressionId: "c1" }
        : message,
    );
    const context = buildActiveConversationContext({
      session: {
        id: "conv-a",
        userId: "dev-user-001",
        title: "AI 助手会话",
        createdAt: "2026-06-27T00:00:00.000Z",
        updatedAt: "2026-06-27T00:01:00.000Z",
        lastCompressedAt: "2026-06-27T00:01:00.000Z",
        compressionCount: 1,
      },
      messages: archived,
      compressions: [compression],
      contextWindowTokens: 2048,
    });

    assert.equal(context.latestCompression?.id, "c1");
    assert.deepEqual(context.includedMessageIds, ["m4", "m5"]);
    assert.deepEqual(context.excludedArchivedMessageIds, ["m1", "m2", "m3"]);
    assert.match(context.contextText, /用户当前目标/);
    assert.doesNotMatch(context.activeMessages.map((message) => message.id).join(","), /m1|m2|m3/);
  });

  it("continues to reject unauthorized long-term memory writes", () => {
    const result = authorizeMemoryWrite({
      tier: MemoryTier.LongTerm,
      source: MemorySource.Conversation,
      status: MemoryRecordStatus.Candidate,
      permissionGranted: false,
    });

    assert.equal(result.allowed, false);
  });
});
