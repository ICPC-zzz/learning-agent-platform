import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryToolRegistry,
  InMemoryToolRuntime,
  ToolCallErrorCode,
  ToolCallStatus,
  ToolRiskLevel,
} from "../packages/ai-core/src/tools/index.ts";

function createEchoRegistration(overrides = {}) {
  return {
    definition: {
      name: overrides.name ?? "preview.echo",
      description: "Preview echo tool.",
      riskLevel: overrides.riskLevel ?? ToolRiskLevel.Low,
      requiresConfirmation: overrides.requiresConfirmation ?? false,
      disabledByDefault: overrides.disabledByDefault,
      readOnly: overrides.readOnly ?? true,
      sideEffect: overrides.sideEffect ?? false,
      requiredPermissions: overrides.requiredPermissions,
      inputSchema: overrides.inputSchema ?? {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
        },
      },
    },
    handler: overrides.handler ?? ((request) => ({
      toolName: request.toolName,
      status: ToolCallStatus.Success,
      output: {
        message: request.input.message,
        trustedUserId: request.context?.trustedUserId,
        clientUserId: request.context?.userId,
        topLevelUserId: request.userId,
      },
    })),
  };
}

describe("A504 tools runtime safety base", () => {
  it("registers, lists, and rejects duplicate tools", () => {
    const registry = new InMemoryToolRegistry();
    registry.register(createEchoRegistration());

    assert.equal(registry.has("preview.echo"), true);
    assert.equal(registry.list().length, 1);
    assert.throws(
      () => registry.register(createEchoRegistration()),
      /already registered/,
    );
  });

  it("rejects unregistered tools", async () => {
    const runtime = new InMemoryToolRuntime();
    const result = await runtime.callTool({
      toolName: "missing.tool",
      input: {},
    });

    assert.equal(result.status, ToolCallStatus.Failed);
    assert.equal(result.errorCode, ToolCallErrorCode.ToolNotFound);
  });

  it("enforces disabled-by-default unless explicitly enabled", async () => {
    const runtime = new InMemoryToolRuntime([createEchoRegistration()]);
    const result = await runtime.callTool({
      toolName: "preview.echo",
      input: { message: "hello" },
    });

    assert.equal(result.status, ToolCallStatus.Denied);
    assert.equal(result.errorCode, ToolCallErrorCode.DisabledByDefault);
  });

  it("denies missing required permissions", async () => {
    const runtime = new InMemoryToolRuntime([
      createEchoRegistration({
        name: "preview.secure",
        requiredPermissions: ["learning.read"],
      }),
    ]);
    const result = await runtime.callTool({
      toolName: "preview.secure",
      input: { message: "hello" },
      context: { enabledTools: ["preview.secure"] },
    });

    assert.equal(result.status, ToolCallStatus.Denied);
    assert.equal(result.errorCode, ToolCallErrorCode.PermissionDenied);
  });

  it("rejects invalid schema input before executing handler", async () => {
    let executed = false;
    const runtime = new InMemoryToolRuntime([
      createEchoRegistration({
        handler: () => {
          executed = true;
          return {
            toolName: "preview.echo",
            status: ToolCallStatus.Success,
          };
        },
      }),
    ]);

    const result = await runtime.callTool({
      toolName: "preview.echo",
      input: { message: 123 },
      context: { enabledTools: ["preview.echo"] },
    });

    assert.equal(executed, false);
    assert.equal(result.status, ToolCallStatus.Failed);
    assert.equal(result.errorCode, ToolCallErrorCode.InvalidToolInput);
  });

  it("runs an enabled preview read-only tool with structured output", async () => {
    const runtime = new InMemoryToolRuntime([createEchoRegistration()]);
    const result = await runtime.callTool({
      toolName: "preview.echo",
      input: { message: "hello" },
      context: {
        enabledTools: ["preview.echo"],
        grantedPermissions: [],
        trustedUserId: "trusted-user",
        userId: "client-spoof",
      },
      userId: "top-level-spoof",
    });

    assert.equal(result.status, ToolCallStatus.Success);
    assert.deepEqual(result.output, {
      message: "hello",
      trustedUserId: "trusted-user",
      clientUserId: undefined,
      topLevelUserId: undefined,
    });
  });

  it("redacts sensitive execution errors", async () => {
    const runtime = new InMemoryToolRuntime([
      createEchoRegistration({
        handler: () => {
          throw new Error("provider token sk-test should never be exposed");
        },
      }),
    ]);

    const result = await runtime.callTool({
      toolName: "preview.echo",
      input: { message: "hello" },
      context: { enabledTools: ["preview.echo"] },
    });

    assert.equal(result.status, ToolCallStatus.Failed);
    assert.equal(result.errorCode, ToolCallErrorCode.ExecutionFailed);
    assert.equal(result.errorMessage, "工具执行失败，请稍后重试。");
    assert.doesNotMatch(result.errorMessage ?? "", /token|sk-test|secret/i);
  });

  it("exports runtime constructors through the tools barrel", () => {
    assert.equal(typeof InMemoryToolRegistry, "function");
    assert.equal(typeof InMemoryToolRuntime, "function");
    assert.doesNotThrow(() => new InMemoryToolRuntime());
  });
});
