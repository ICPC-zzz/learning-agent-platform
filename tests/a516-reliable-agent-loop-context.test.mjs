import assert from "node:assert/strict";
import test from "node:test";

import {
  ReliableAgentLoopEventType,
  ReliableAgentLoopStatus,
  runReliableAgentLoop,
} from "../packages/ai-core/src/agent-runtime/reliable-agent-loop.ts";
import {
  LlmChatRole,
  LlmProviderMode,
} from "../packages/ai-core/src/llm/llm-provider-contract.ts";
import {
  createToolExecutionResult,
  InMemoryToolRuntime,
  ToolExecutionStatus,
  ToolRiskCategory,
  ToolRiskLevel,
} from "../packages/ai-core/src/tools/index.ts";

test("A516 reliable agent loop stores large tool results and only feeds preview to the model", async () => {
  const artifactInputs = [];
  const providerRequests = [];
  const provider = createScriptedProvider([
    (request) => {
      providerRequests.push(request);
      return assistantToolTurn(request.tools[0].function.name, "large-call", {});
    },
    (request) => {
      providerRequests.push(request);
      const toolMessage = request.messages.find((message) =>
        message.role === LlmChatRole.Tool && message.toolCallId === "large-call"
      );
      assert.ok(toolMessage, "second model request should include the tool result");
      assert.match(toolMessage.content, /artifact-a516-1/);
      assert.match(toolMessage.content, /truncated/);
      assert.doesNotMatch(toolMessage.content, /Large row 119/);
      return assistantFinalTurn("已基于摘要和来源生成最终回答。");
    },
  ]);

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a516 reliable loop large result",
    messages: [{ role: LlmChatRole.User, content: "请读取大型结果" }],
    toolRuntime: new InMemoryToolRuntime([createLargeTool()]),
    toolResultBudget: {
      maxSingleResultChars: 650,
      maxPreviewChars: 180,
      maxArtifacts: 2,
    },
    toolResultArtifactRepository: {
      async saveToolResultArtifact(input) {
        artifactInputs.push(input);
        return {
          artifactId: "artifact-a516-1",
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
    context: {
      userId: "user-a",
      conversationId: "conversation-a",
      taskId: "task-a",
      agentRunId: "run-a",
      enabledTools: ["assistant.large_tool"],
    },
  });

  assert.equal(result.status, ReliableAgentLoopStatus.Succeeded);
  assert.equal(providerRequests.length, 2);
  assert.equal(artifactInputs.length, 1);
  assert.equal(result.toolResults.length, 1);
  assert.equal(result.toolResults[0].metadata?.artifactId, "artifact-a516-1");
  assert.ok(result.events.some((event) =>
    event.eventType === ReliableAgentLoopEventType.ToolResultBudgetApplied
  ));
  assert.ok(result.events.some((event) =>
    event.eventType === ReliableAgentLoopEventType.ToolResultArtifactStored
  ));
});

test("A516 reliable agent loop stops safely when context compression circuit is open at blocking threshold", async () => {
  const result = await runReliableAgentLoop({
    provider: createScriptedProvider([
      () => {
        throw new Error("provider should not be called while context is blocked");
      },
    ]),
    purposeSummary: "a516 compression blocked",
    messages: [
      { role: LlmChatRole.System, content: "system" },
      ...Array.from({ length: 30 }, (_, index) => ({
        role: index % 2 === 0 ? LlmChatRole.User : LlmChatRole.Assistant,
        content: `A516 blocking context message ${index} `.repeat(40),
      })),
    ],
    toolRuntime: new InMemoryToolRuntime([createLargeTool()]),
    contextCompression: {
      contextWindowTokens: 700,
      forceCompressionFailure: true,
      maxConsecutiveCompressionFailures: 1,
      circuitCooldownMs: 60_000,
    },
  });

  assert.equal(result.status, ReliableAgentLoopStatus.Failed);
  assert.match(result.finalAnswer, /上下文已接近上限/);
  assert.ok(result.events.some((event) =>
    event.eventType === ReliableAgentLoopEventType.ContextCompressionPaused
  ));
});

function createLargeTool() {
  return {
    definition: {
      name: "assistant.large_tool",
      description: "A516 large read-only test tool",
      displayName: "A516 Large Tool",
      riskLevel: ToolRiskLevel.Low,
      riskCategory: ToolRiskCategory.ReadOnly,
      requiresConfirmation: false,
      enabled: true,
      disabledByDefault: false,
      readOnly: true,
      sideEffect: false,
      concurrencySafe: true,
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: true,
      },
    },
    handler: (request) => createToolExecutionResult({
      toolCallId: request.callId ?? "large-call",
      toolName: "assistant.large_tool",
      status: ToolExecutionStatus.Succeeded,
      startedAt: new Date().toISOString(),
      output: {
        rows: Array.from({ length: 120 }, (_, index) => ({
          id: `row-${index}`,
          title: `Large row ${index}`,
          safeNote: "safe public result",
        })),
      },
      safeSummary: "large tool succeeded",
      sourceRefs: [{
        title: "A516 large source",
        source: "unit-test",
        recordId: "large",
        safeSummary: "safe source",
      }],
    }),
  };
}

function createScriptedProvider(turns) {
  let index = 0;
  return {
    mode: LlmProviderMode.ExternalDevOnly,
    label: "a516 scripted provider",
    capabilities: {
      supportsChat: true,
      supportsToolCalling: true,
      supportsParallelToolCalls: true,
      toolCallProtocol: "openai-chat-completions",
    },
    generate: async () => {
      throw new Error("legacy generate should not be used");
    },
    generateAssistantTurn: async (request) => {
      const turn = turns[index++];
      assert.ok(turn, "scripted provider received too many turns");
      return turn(request);
    },
  };
}

function assistantToolTurn(name, id, args) {
  return {
    ok: true,
    message: {
      role: LlmChatRole.Assistant,
      content: "",
      toolCalls: [{ id, type: "function", name, arguments: args }],
    },
    finishReason: "tool_calls",
    providerMode: LlmProviderMode.ExternalDevOnly,
    realProviderCalled: true,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    warnings: [],
    createdAt: new Date().toISOString(),
  };
}

function assistantFinalTurn(content) {
  return {
    ok: true,
    message: {
      role: LlmChatRole.Assistant,
      content,
    },
    finishReason: "stop",
    providerMode: LlmProviderMode.ExternalDevOnly,
    realProviderCalled: true,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    warnings: [],
    createdAt: new Date().toISOString(),
  };
}
