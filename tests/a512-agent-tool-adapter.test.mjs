import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SkeletonAgentToolExecutor } from "../packages/ai-core/src/agent-runtime/tools/tool-executor.ts";
import { InMemoryAgentToolRegistry } from "../packages/ai-core/src/agent-runtime/tools/tool-registry.ts";
import {
  AgentToolCategory,
  ToolExecutionStatus,
  createDefaultToolMetadata,
} from "../packages/ai-core/src/agent-runtime/tools/tool-types.ts";

describe("A512 agent-runtime tool adapter", () => {
  it("delegates legacy agent executor calls through one canonical execution path", async () => {
    let executions = 0;
    const registry = new InMemoryAgentToolRegistry();
    registry.register(createAgentTestTool({
      name: "a512.agent.echo",
      execute: async (_input, context) => {
        executions += 1;
        return {
          toolCallId: "inner-call",
          status: ToolExecutionStatus.Success,
          data: {
            agentId: context.agentId,
            hasSignal: context.signal instanceof AbortSignal,
          },
          safeSummary: "agent tool completed",
          retryable: false,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 1,
        };
      },
    }));

    const executor = new SkeletonAgentToolExecutor({
      registry,
      config: { mode: "interactive" },
    });
    const { result, events } = await executor.execute("a512.agent.echo", {}, createAgentContext());

    assert.equal(executions, 1);
    assert.equal(result.status, ToolExecutionStatus.Success);
    assert.deepEqual(result.data, {
      agentId: "agent_1",
      hasSignal: true,
    });
    assert.deepEqual(
      events.map((event) => event.type),
      ["tool.requested", "tool.started", "tool.completed"],
    );
  });

  it("uses canonical timeout handling for legacy agent tools", async () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(createAgentTestTool({
      name: "a512.agent.timeout",
      timeoutMs: 20,
      execute: async () => {
        await sleep(80);
        return {
          toolCallId: "late",
          status: ToolExecutionStatus.Success,
          data: { late: true },
          safeSummary: "late",
          retryable: false,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 80,
        };
      },
    }));

    const executor = new SkeletonAgentToolExecutor({
      registry,
      config: { mode: "interactive" },
    });
    const { result, events } = await executor.execute("a512.agent.timeout", {}, createAgentContext());

    assert.equal(result.status, ToolExecutionStatus.Timeout);
    assert.equal(result.retryable, true);
    assert.ok(events.some((event) => event.type === "tool.failed"));
  });
});

function createAgentTestTool(overrides = {}) {
  return {
    metadata: createDefaultToolMetadata({
      name: overrides.name,
      description: overrides.name,
      version: "1.0.0",
      category: AgentToolCategory.Test,
      readOnly: true,
      sideEffect: false,
      parallelSafe: true,
      requiresConfirmation: false,
      requiresAuthentication: false,
      sensitivity: "low",
      disabledByDefault: false,
      timeoutMs: overrides.timeoutMs ?? 500,
      allowedAgents: [],
    }),
    inputSchema: {
      _brand: "ToolInputSchema",
      _inputType: undefined,
      schema: { type: "object", properties: {} },
      validate(input) {
        return input;
      },
    },
    execute: overrides.execute,
  };
}

function createAgentContext() {
  return {
    agentId: "agent_1",
    runId: "run_1",
    userId: "user-a",
    isAuthenticated: true,
    isUserAuthorized: true,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
