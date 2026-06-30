import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryToolRuntime,
  ToolAuditEventType,
  ToolCallErrorCode,
  ToolCallStatus,
  ToolExecutionStatus,
  ToolRiskCategory,
  ToolRiskLevel,
} from "../packages/ai-core/src/tools/index.ts";

function createRegistration(overrides = {}) {
  return {
    definition: {
      name: overrides.name ?? "a512.echo",
      displayName: overrides.displayName ?? "A512 Echo",
      description: "A512 runtime test tool.",
      riskLevel: ToolRiskLevel.Low,
      riskCategory: overrides.riskCategory ?? ToolRiskCategory.ReadOnly,
      requiresConfirmation: overrides.requiresConfirmation ?? false,
      disabledByDefault: overrides.disabledByDefault ?? false,
      enabled: overrides.enabled ?? true,
      readOnly: overrides.readOnly ?? true,
      sideEffect: overrides.sideEffect ?? false,
      timeoutMs: overrides.timeoutMs ?? 500,
      requiredPermissions: overrides.requiredPermissions,
      allowedAgents: overrides.allowedAgents,
      inputSchema: overrides.inputSchema ?? {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
        },
      },
    },
    validateInput: overrides.validateInput,
    handler: overrides.handler ?? ((request) => ({
      toolName: request.toolName,
      status: ToolCallStatus.Success,
      output: {
        message: request.input.message,
        trustedUserId: request.context?.trustedUserId,
        clientUserId: request.context?.userId,
        topLevelUserId: request.userId,
        signalForwarded: request.context?.signal instanceof AbortSignal,
      },
      metadata: {
        safeSummary: "查询完成。",
      },
    })),
  };
}

describe("A512 canonical tool runtime", () => {
  it("executes once with sanitized user context and audit trail", async () => {
    let count = 0;
    const runtime = new InMemoryToolRuntime([
      createRegistration({
        handler: (request) => {
          count += 1;
          return {
            toolName: request.toolName,
            status: ToolCallStatus.Success,
            output: {
              trustedUserId: request.context?.trustedUserId,
              clientUserId: request.context?.userId,
              topLevelUserId: request.userId,
              signalForwarded: request.context?.signal instanceof AbortSignal,
            },
            metadata: { safeSummary: "查询完成。" },
          };
        },
      }),
    ]);

    const result = await runtime.executeTool({
      toolName: "a512.echo",
      input: { message: "hello" },
      context: {
        userId: "server-user",
        enabledTools: ["a512.echo"],
        metadata: { clientUserId: "client-spoof" },
      },
      userId: "top-level-spoof",
    });

    assert.equal(count, 1);
    assert.equal(result.status, ToolExecutionStatus.Succeeded);
    assert.deepEqual(result.output, {
      trustedUserId: "server-user",
      clientUserId: undefined,
      topLevelUserId: undefined,
      signalForwarded: true,
    });

    const events = runtime.listAuditEvents()
      .filter((event) => event.toolCallId === result.toolCallId)
      .map((event) => event.eventType);
    assert.ok(events.includes(ToolAuditEventType.ToolResolved));
    assert.ok(events.includes(ToolAuditEventType.ToolStarted));
    assert.ok(events.includes(ToolAuditEventType.ToolSucceeded));
    assert.ok(events.includes(ToolAuditEventType.ToolResultReturned));
  });

  it("distinguishes empty, invalid input, permission denied, timeout, and cancellation", async () => {
    const emptyRuntime = new InMemoryToolRuntime([
      createRegistration({
        name: "a512.empty",
        handler: () => ({
          toolName: "a512.empty",
          status: ToolCallStatus.Success,
          output: { items: [] },
        }),
      }),
    ]);
    const empty = await emptyRuntime.executeTool({
      toolName: "a512.empty",
      input: { message: "none" },
      context: { enabledTools: ["a512.empty"] },
    });
    assert.equal(empty.status, ToolExecutionStatus.Empty);
    assert.equal(empty.errorCode, ToolCallErrorCode.EmptyResult);

    const invalidRuntime = new InMemoryToolRuntime([createRegistration({ name: "a512.invalid" })]);
    const invalid = await invalidRuntime.executeTool({
      toolName: "a512.invalid",
      input: { message: 123 },
      context: { enabledTools: ["a512.invalid"] },
    });
    assert.equal(invalid.status, ToolExecutionStatus.InvalidInput);
    assert.equal(invalid.errorCode, ToolCallErrorCode.InvalidToolInput);

    const deniedRuntime = new InMemoryToolRuntime([
      createRegistration({
        name: "a512.secure",
        requiredPermissions: ["learning.read"],
      }),
    ]);
    const denied = await deniedRuntime.executeTool({
      toolName: "a512.secure",
      input: { message: "secret" },
      context: { enabledTools: ["a512.secure"] },
    });
    assert.equal(denied.status, ToolExecutionStatus.PermissionDenied);
    assert.equal(denied.errorCode, ToolCallErrorCode.PermissionDenied);

    let lateTimeoutCompleted = false;
    const timeoutRuntime = new InMemoryToolRuntime([
      createRegistration({
        name: "a512.timeout",
        timeoutMs: 20,
        handler: async () => {
          await sleep(80);
          lateTimeoutCompleted = true;
          return {
            toolName: "a512.timeout",
            status: ToolCallStatus.Success,
            output: { ok: true },
          };
        },
      }),
    ]);
    const timedOut = await timeoutRuntime.executeTool({
      toolName: "a512.timeout",
      input: { message: "slow" },
      context: { enabledTools: ["a512.timeout"] },
    });
    assert.equal(timedOut.status, ToolExecutionStatus.TimedOut);
    assert.equal(timedOut.retryable, true);
    await sleep(90);
    assert.equal(lateTimeoutCompleted, true);
    assert.equal(timedOut.status, ToolExecutionStatus.TimedOut);

    const controller = new AbortController();
    const cancelRuntime = new InMemoryToolRuntime([
      createRegistration({
        name: "a512.cancel",
        timeoutMs: 500,
        handler: async () => {
          await sleep(80);
          return {
            toolName: "a512.cancel",
            status: ToolCallStatus.Success,
            output: { ok: true },
          };
        },
      }),
    ]);
    setTimeout(() => controller.abort(new Error("USER_CANCEL")), 10);
    const cancelled = await cancelRuntime.executeTool({
      toolName: "a512.cancel",
      input: { message: "stop" },
      context: {
        enabledTools: ["a512.cancel"],
        signal: controller.signal,
      },
    });
    assert.equal(cancelled.status, ToolExecutionStatus.Cancelled);
    assert.equal(cancelled.errorCode, ToolCallErrorCode.Cancelled);
  });

  it("returns safe Chinese summaries instead of internal diagnostics", async () => {
    const runtime = new InMemoryToolRuntime([
      createRegistration({
        name: "a512.fail",
        handler: () => {
          throw new Error("Invalid Prisma invocation: foreign key constraint failed with api_key=secret stack trace");
        },
      }),
    ]);

    const canonical = await runtime.executeTool({
      toolName: "a512.fail",
      input: { message: "boom" },
      context: { enabledTools: ["a512.fail"] },
    });

    assert.equal(canonical.status, ToolExecutionStatus.Failed);
    assert.doesNotMatch(canonical.safeSummary, /prisma|foreign key|api_key|secret|stack/i);
    assert.match(canonical.safeSummary, /工具执行失败/);

    const legacy = await runtime.callTool({
      toolName: "a512.fail",
      input: { message: "boom" },
      context: { enabledTools: ["a512.fail"] },
    });
    assert.equal(legacy.status, ToolCallStatus.Failed);
    assert.doesNotMatch(legacy.errorMessage ?? "", /prisma|foreign key|api_key|secret|stack/i);
    assert.match(legacy.errorMessage ?? "", /工具执行失败/);
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
