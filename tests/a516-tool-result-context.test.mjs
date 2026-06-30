import assert from "node:assert/strict";
import test from "node:test";

import {
  createReliableAgentContextState,
  prepareMessagesForProvider,
  prepareToolResultForModel,
} from "../packages/ai-core/src/agent-runtime/tool-result-context.ts";
import { LlmChatRole } from "../packages/ai-core/src/llm/llm-provider-contract.ts";
import {
  createToolExecutionResult,
  ToolExecutionStatus,
} from "../packages/ai-core/src/tools/index.ts";

test("A516 tool result budget injects small results directly and stores large results as artifacts", async () => {
  const state = createReliableAgentContextState();
  const small = await prepareToolResultForModel({
    result: createResult({
      output: { items: [{ id: "small-1", title: "Small result" }] },
    }),
    state,
    config: { maxSingleResultChars: 2000 },
  });

  assert.equal(small.artifact, null);
  assert.equal(small.budgetApplied, false);
  assert.match(small.modelContent, /Small result/);

  const saved = [];
  const large = await prepareToolResultForModel({
    result: createResult({
      toolCallId: "large-call",
      output: {
        rawPromptStored: false,
        rawResponseStored: false,
        items: Array.from({ length: 120 }, (_, index) => ({
          id: `item-${index}`,
          title: `Large item ${index}`,
          note: "safe public contest/problem metadata",
        })),
      },
    }),
    state,
    config: {
      maxSingleResultChars: 500,
      maxPreviewChars: 180,
      maxArtifacts: 2,
    },
    artifactRepository: {
      async saveToolResultArtifact(input) {
        saved.push(input);
        return {
          artifactId: "artifact-large-1",
          ownerUserId: input.ownerUserId,
          conversationId: input.conversationId,
          runId: input.runId,
          toolCallId: input.toolCallId,
          toolName: input.toolName,
          contentType: input.contentType,
          safePreview: input.safePreview,
          sourceRefs: input.sourceRefs,
          size: input.size,
          createdAt: input.createdAt ?? new Date().toISOString(),
          expiresAt: input.expiresAt ?? null,
        };
      },
    },
    ownerUserId: "user-a",
    conversationId: "conversation-a",
    runId: "run-a",
  });

  assert.equal(saved.length, 1);
  assert.equal(large.budgetApplied, true);
  assert.equal(large.artifact?.artifactId, "artifact-large-1");
  assert.match(large.modelContent, /artifact-large-1/);
  assert.ok(large.modelContent.length <= 500);
  assert.doesNotMatch(large.modelContent, /Large item 119/);
});

test("A516 sensitive tool results are redacted and not persisted", async () => {
  const saved = [];
  const prepared = await prepareToolResultForModel({
    result: createResult({
      output: {
        safe: "visible",
        token: "secret-token",
        nested: {
          Authorization: "Bearer abc123",
          databaseUrl: "postgres://user:pass@localhost/db",
        },
      },
    }),
    state: createReliableAgentContextState(),
    config: { maxSingleResultChars: 4000 },
    artifactRepository: {
      async saveToolResultArtifact(input) {
        saved.push(input);
        throw new Error("sensitive result should not be persisted");
      },
    },
    ownerUserId: "user-a",
    conversationId: "conversation-a",
    runId: "run-a",
  });

  assert.equal(saved.length, 0);
  assert.equal(prepared.sensitiveResultNotPersisted, true);
  assert.equal(prepared.artifact, null);
  assert.match(prepared.modelContent, /sensitiveResultNotPersisted/);
  assert.doesNotMatch(prepared.modelContent, /secret-token|abc123|postgres:\/\/user/i);
});

test("A516 microcompact preserves protected recent tool results and compacts older consumed results", () => {
  const state = createReliableAgentContextState();
  const oldToolContent = JSON.stringify({
    status: "succeeded",
    toolName: "old.tool",
    toolCallId: "old-call",
    safeSummary: "old result",
    sourceRefs: [{ title: "old source", source: "unit" }],
    output: { rows: Array.from({ length: 80 }, (_, index) => ({ index, text: "large" })) },
  });
  const protectedToolContent = JSON.stringify({
    status: "succeeded",
    toolName: "new.tool",
    toolCallId: "new-call",
    safeSummary: "new result",
    output: { rows: Array.from({ length: 80 }, (_, index) => ({ index, text: "large" })) },
  });

  const prepared = prepareMessagesForProvider({
    messages: [
      { role: LlmChatRole.System, content: "system" },
      {
        role: LlmChatRole.Assistant,
        content: "",
        toolCalls: [{ id: "old-call", type: "function", name: "old.tool", arguments: {} }],
      },
      { role: LlmChatRole.Tool, toolCallId: "old-call", content: oldToolContent },
      {
        role: LlmChatRole.Assistant,
        content: "",
        toolCalls: [{ id: "new-call", type: "function", name: "new.tool", arguments: {} }],
      },
      { role: LlmChatRole.Tool, toolCallId: "new-call", content: protectedToolContent },
    ],
    state,
    protectToolCallIds: new Set(["new-call"]),
    compression: {
      contextWindowTokens: 8000,
      microcompactToolResultChars: 260,
      preserveRecentToolResultCount: 1,
    },
  });

  assert.ok(prepared.events.some((event) => event.type === "tool_result_microcompacted"));
  assert.match(prepared.messages[2].content, /microcompacted/);
  assert.equal(prepared.messages[4].content, protectedToolContent);
});

test("A516 context compression records deterministic summaries and opens circuit after repeated failures", () => {
  const state = createReliableAgentContextState();
  const messages = [
    { role: LlmChatRole.System, content: "system" },
    ...Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? LlmChatRole.User : LlmChatRole.Assistant,
      content: `第 ${index} 条长消息：目标是完成 A516 上下文压缩闭环，并保留最近对话和关键 Evidence。`.repeat(10),
    })),
  ];

  const compressed = prepareMessagesForProvider({
    messages,
    state,
    compression: {
      contextWindowTokens: 700,
      preserveRecentMessageCount: 4,
      summaryModelAvailable: false,
    },
  });

  assert.equal(compressed.blocked, false);
  assert.ok(compressed.events.some((event) => event.type === "context_compressed"));
  assert.match(compressed.messages.map((message) => message.content).join("\n"), /结构化会话摘要/);
  assert.match(compressed.messages.at(-1)?.content ?? "", /A516 上下文压缩闭环/);

  const failureState = createReliableAgentContextState();
  for (let index = 0; index < 3; index += 1) {
    prepareMessagesForProvider({
      messages,
      state: failureState,
      compression: {
        contextWindowTokens: 700,
        forceCompressionFailure: true,
        maxConsecutiveCompressionFailures: 3,
        circuitCooldownMs: 60_000,
      },
    });
  }
  const paused = prepareMessagesForProvider({
    messages,
    state: failureState,
    compression: {
      contextWindowTokens: 700,
      maxConsecutiveCompressionFailures: 3,
      circuitCooldownMs: 60_000,
    },
  });

  assert.ok(paused.events.some((event) => event.type === "context_compression_paused"));
  assert.equal(paused.blocked, true);
});

function createResult(overrides = {}) {
  return createToolExecutionResult({
    toolCallId: overrides.toolCallId ?? "tool-call-1",
    toolName: overrides.toolName ?? "assistant.test_tool",
    status: overrides.status ?? ToolExecutionStatus.Succeeded,
    startedAt: new Date().toISOString(),
    output: overrides.output ?? { ok: true },
    safeSummary: overrides.safeSummary ?? "test tool succeeded",
    sourceRefs: [{
      title: "A516 source",
      source: "unit-test",
      recordId: "a516",
      safeSummary: "safe source",
    }],
  });
}
