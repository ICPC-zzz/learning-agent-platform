import assert from "node:assert/strict";
import test from "node:test";

import {
  runReliableAgentLoop,
  ReliableAgentLoopEventType,
  ReliableAgentLoopStatus,
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

test("A515 reliable agent loop appends one tool result and continues to final answer", async () => {
  const runtime = createRuntimeWithTools();
  const requests = [];
  const provider = createScriptedProvider([
    (request) => {
      requests.push(request);
      const profileTool = request.tools.find((tool) =>
        tool.runtimeName === "assistant.resolve_learner_training_profile"
      );
      return assistantToolTurn(profileTool.function.name, "call_profile_1", {});
    },
    (request) => {
      requests.push(request);
      return assistantFinalTurn("已根据工具结果生成训练建议。");
    },
  ]);

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a515 test",
    messages: [{ role: LlmChatRole.User, content: "给我一份训练建议" }],
    toolRuntime: runtime,
    memoryContextSummary: "Loaded 1 relevant long-term memory item.",
  });

  assert.equal(result.status, ReliableAgentLoopStatus.Succeeded);
  assert.equal(result.toolResults.length, 1);
  assert.equal(result.toolResults[0].status, ToolExecutionStatus.Succeeded);
  assert.ok(requests[1].messages.some((message) =>
    message.role === LlmChatRole.Tool && message.toolCallId === "call_profile_1"
  ));
  assert.ok(result.events.some((event) =>
    event.eventType === ReliableAgentLoopEventType.ToolResultAppended
  ));
});

test("A515 reliable agent loop returns structured tool results for invalid model calls", async () => {
  const runtime = createRuntimeWithTools();
  const provider = createScriptedProvider([
    (request) => {
      const profileTool = request.tools.find((tool) =>
        tool.runtimeName === "assistant.resolve_learner_training_profile"
      );
      return assistantToolTurnMany([
        {
          id: "call_bad_json",
          type: "function",
          name: profileTool.function.name,
          arguments: {},
          argumentsParseError: "not json",
        },
        {
          id: "call_unknown",
          type: "function",
          name: "unknown_tool",
          arguments: {},
        },
      ]);
    },
    () => assistantFinalTurn("只能生成部分建议。"),
  ]);

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a515 invalid calls",
    messages: [{ role: LlmChatRole.User, content: "测试非法工具调用" }],
    toolRuntime: runtime,
  });

  assert.equal(result.status, ReliableAgentLoopStatus.PartiallySucceeded);
  assert.equal(result.toolResults.length, 2);
  assert.deepEqual(
    result.toolResults.map((item) => item.status),
    [ToolExecutionStatus.InvalidInput, ToolExecutionStatus.InvalidInput],
  );
  assert.equal(
    result.events.filter((event) =>
      event.eventType === ReliableAgentLoopEventType.ToolCallValidationFailed
    ).length,
    2,
  );
});

test("A515 reliable agent loop blocks duplicate tool calls with normalized arguments", async () => {
  const runtime = createRuntimeWithTools();
  const provider = createScriptedProvider([
    (request) => {
      const profileTool = request.tools.find((tool) =>
        tool.runtimeName === "assistant.resolve_learner_training_profile"
      );
      return assistantToolTurnMany([
        {
          id: "call_profile_1",
          type: "function",
          name: profileTool.function.name,
          arguments: { handle: "tourist" },
        },
        {
          id: "call_profile_2",
          type: "function",
          name: profileTool.function.name,
          arguments: { handle: "tourist" },
        },
      ]);
    },
    () => assistantFinalTurn("重复调用已被阻止。"),
  ]);

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a515 duplicate calls",
    messages: [{ role: LlmChatRole.User, content: "重复调用测试" }],
    toolRuntime: runtime,
  });

  assert.equal(result.status, ReliableAgentLoopStatus.PartiallySucceeded);
  assert.equal(result.toolResults.length, 2);
  assert.equal(result.toolResults[0].status, ToolExecutionStatus.Succeeded);
  assert.equal(result.toolResults[1].errorCode, "duplicate_tool");
});

test("A515 reliable agent loop reports unsupported tool calling without invoking legacy generate", async () => {
  const provider = {
    mode: LlmProviderMode.Mock,
    label: "chat-only provider",
    capabilities: {
      supportsChat: true,
      supportsToolCalling: false,
      supportsParallelToolCalls: false,
    },
    generate: async () => {
      throw new Error("legacy generate should not be called");
    },
  };

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a515 unsupported",
    messages: [{ role: LlmChatRole.User, content: "请调用工具" }],
    toolRuntime: createRuntimeWithTools(),
  });

  assert.equal(result.status, ReliableAgentLoopStatus.UnsupportedToolCalling);
  assert.equal(result.toolResults.length, 0);
});

test("A516 reliable agent loop maps aborted provider failures to cancelled", async () => {
  const controller = new globalThis.AbortController();
  const provider = createScriptedProvider([
    () => {
      controller.abort(new Error("USER_CANCELLED"));
      return {
        ok: false,
        message: {
          role: LlmChatRole.Assistant,
          content: "Model call cancelled.",
        },
        finishReason: "error",
        providerMode: LlmProviderMode.ExternalDevOnly,
        realProviderCalled: true,
        networkAccessed: true,
        secretSafe: true,
        rawPromptStored: false,
        rawResponseStored: false,
        devOnly: true,
        productionReady: false,
        error: {
          kind: "timeout",
          message: "Model call cancelled.",
          retryable: true,
          secretSafe: true,
          rawProviderResponseStored: false,
        },
        warnings: ["Model call cancelled."],
        createdAt: new Date().toISOString(),
      };
    },
  ]);

  const result = await runReliableAgentLoop({
    provider,
    purposeSummary: "a516 cancel regression",
    messages: [{ role: LlmChatRole.User, content: "cancel test" }],
    toolRuntime: createRuntimeWithTools(),
    signal: controller.signal,
  });

  assert.equal(result.status, ReliableAgentLoopStatus.Cancelled);
  assert.ok(result.events.some((event) =>
    event.eventType === ReliableAgentLoopEventType.AgentLoopCancelled
  ));
});

function createRuntimeWithTools() {
  return new InMemoryToolRuntime([
    createTool("assistant.resolve_learner_training_profile", {
      profile: { rating: 1200 },
    }),
    createTool("assistant.get_personalized_codeforces_candidates", {
      candidates: [{ problemKey: "1A", rating: 1200 }],
    }),
  ]);
}

function createTool(name, output) {
  return {
    definition: {
      name,
      description: `Read-only test tool ${name}`,
      displayName: name,
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
      toolCallId: request.callId ?? "tool_call",
      toolName: name,
      status: ToolExecutionStatus.Succeeded,
      startedAt: new Date().toISOString(),
      output,
      safeSummary: `${name} succeeded`,
      sourceRefs: [{
        title: "A515 test source",
        source: "unit-test",
        recordId: name,
        safeSummary: "unit-test source",
      }],
    }),
  };
}

function createScriptedProvider(turns) {
  let index = 0;
  return {
    mode: LlmProviderMode.ExternalDevOnly,
    label: "scripted provider",
    capabilities: {
      supportsChat: true,
      supportsToolCalling: true,
      supportsParallelToolCalls: true,
      toolCallProtocol: "openai-chat-completions",
    },
    generate: async () => {
      throw new Error("legacy generate is not used by reliable loop");
    },
    generateAssistantTurn: async (request) => {
      const turn = turns[index++];
      assert.ok(turn, "scripted provider received too many turns");
      return turn(request);
    },
  };
}

function assistantToolTurn(name, id, args) {
  return assistantToolTurnMany([{
    id,
    type: "function",
    name,
    arguments: args,
  }]);
}

function assistantToolTurnMany(toolCalls) {
  return {
    ok: true,
    message: {
      role: LlmChatRole.Assistant,
      content: "",
      toolCalls,
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
