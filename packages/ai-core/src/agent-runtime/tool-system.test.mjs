import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryAgentToolRegistry } from "./tools/tool-registry.ts";
import { AgentToolCategory, createDefaultToolMetadata, ToolPermissionDecision, ToolExecutionStatus } from "./tools/tool-types.ts";
import { DefaultAgentToolPermissionEvaluator } from "./tools/tool-permission.ts";
import { SkeletonAgentToolExecutor } from "./tools/tool-executor.ts";

function makeTestTool(opts) {
  const metadata = createDefaultToolMetadata({
    name: opts.name,
    description: "Test tool: " + opts.name,
    readOnly: opts.readOnly ?? false,
    disabledByDefault: opts.disabledByDefault ?? true,
    requiresConfirmation: opts.requiresConfirmation ?? true,
    category: opts.category ?? AgentToolCategory.Test,
    sensitivity: opts.sensitivity ?? "medium",
    allowedAgents: opts.allowedAgents ?? [],
  });
  return {
    metadata,
    inputSchema: {
      _brand: "ToolInputSchema",
      _inputType: undefined,
      schema: {},
      validate(input) { return input; },
    },
    async execute(_input, _context) {
      if (opts.executeResult !== undefined) return opts.executeResult;
      return {
        toolCallId: "tcall_1",
        status: "success",
        safeSummary: "Executed " + opts.name,
        retryable: false,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 1,
      };
    },
  };
}

describe("InMemoryAgentToolRegistry", () => {
  it("registers and retrieves by name", () => {
    const registry = new InMemoryAgentToolRegistry();
    const tool = makeTestTool({ name: "test.echo" });
    registry.register(tool);
    assert.equal(registry.get("test.echo"), tool);
    assert.equal(registry.has("test.echo"), true);
  });

  it("rejects duplicate tool names", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.echo" }));
    assert.throws(() => registry.register(makeTestTool({ name: "test.echo" })), /already registered/);
  });

  it("returns undefined for unknown tool", () => {
    const registry = new InMemoryAgentToolRegistry();
    assert.equal(registry.get("nonexistent"), undefined);
  });

  it("lists all registered tools", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.a" }));
    registry.register(makeTestTool({ name: "test.b" }));
    assert.equal(registry.list().length, 2);
  });

  it("filters tools by agent", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.shared" }));
    registry.register(makeTestTool({ name: "test.agent_only", allowedAgents: ["agent_x"] }));
    const all = registry.listByAgent("agent_x");
    assert.ok(all.some((t) => t.metadata.name === "test.shared"));
    assert.ok(all.some((t) => t.metadata.name === "test.agent_only"));
    const limited = registry.listByAgent("agent_y");
    assert.ok(!limited.some((t) => t.metadata.name === "test.agent_only"));
  });

  it("filters tools by category", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.r", category: "readonly" }));
    registry.register(makeTestTool({ name: "test.w", category: "code_generation" }));
    assert.equal(registry.listByCategory("readonly").length, 1);
    assert.equal(registry.listByCategory("system").length, 0);
  });

  it("freeze prevents new registrations", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.a" }));
    registry.freeze();
    assert.throws(() => registry.register(makeTestTool({ name: "test.b" })), /frozen/);
  });

  it("reset clears all state", () => {
    const registry = new InMemoryAgentToolRegistry();
    registry.register(makeTestTool({ name: "test.a" }));
    registry.freeze();
    registry.reset();
    assert.equal(registry.list().length, 0);
    assert.equal(registry.isFrozen, false);
  });
});

describe("DefaultAgentToolPermissionEvaluator", () => {
  const evaluator = new DefaultAgentToolPermissionEvaluator();
  const baseCtx = { agentId: "agent_1", runId: "run_1", isAuthenticated: true, isUserAuthorized: true, runMode: "interactive" };

  it("denies disabled-by-default tool", () => {
    const tool = makeTestTool({ name: "test.blocked", disabledByDefault: true });
    const result = evaluator.evaluate(tool.metadata, baseCtx);
    assert.equal(result.decision, ToolPermissionDecision.Deny);
  });

  it("allows enabled read-only tool", () => {
    const tool = makeTestTool({ name: "test.ro", disabledByDefault: false, readOnly: true, requiresConfirmation: false, sensitivity: "low" });
    const result = evaluator.evaluate(tool.metadata, baseCtx);
    assert.equal(result.decision, ToolPermissionDecision.Allow);
  });

  it("requires confirmation for write tool", () => {
    const tool = makeTestTool({ name: "test.write", disabledByDefault: false, requiresConfirmation: true });
    const result = evaluator.evaluate(tool.metadata, { ...baseCtx, isUserAuthorized: false });
    assert.equal(result.decision, ToolPermissionDecision.RequireConfirmation);
  });

  it("denies unauthenticated user for non-readonly", () => {
    const tool = makeTestTool({ name: "test.auth", disabledByDefault: false, readOnly: false });
    const result = evaluator.evaluate(tool.metadata, { ...baseCtx, isAuthenticated: false });
    assert.equal(result.decision, ToolPermissionDecision.Deny);
  });

  it("allows unauthenticated for non-sensitive read-only tool", () => {
    const tool = makeTestTool({ name: "test.pub", disabledByDefault: false, readOnly: true, requiresAuthentication: false, sensitivity: "none", requiresConfirmation: false });
    const result = evaluator.evaluate(tool.metadata, { ...baseCtx, isAuthenticated: false });
    assert.equal(result.decision, ToolPermissionDecision.Allow);
  });

  it("denies agent not in allowedAgents", () => {
    const tool = makeTestTool({ name: "test.restricted", disabledByDefault: false, allowedAgents: ["special"] });
    const result = evaluator.evaluate(tool.metadata, baseCtx);
    assert.equal(result.decision, ToolPermissionDecision.Deny);
  });

  it("global deny for Docker Judge", () => {
    const tool = makeTestTool({ name: "docker.judge", disabledByDefault: false, readOnly: false, requiresConfirmation: false });
    const result = evaluator.evaluate(tool.metadata, baseCtx);
    assert.equal(result.decision, ToolPermissionDecision.Deny);
    assert.ok(result.reason.includes("Docker Judge"));
  });
});

describe("SkeletonAgentToolExecutor", () => {
  const execCtx = { agentId: "agent_1", runId: "run_1", isAuthenticated: true, isUserAuthorized: true };

  it("denies unregistered tool", async () => {
    const registry = new InMemoryAgentToolRegistry();
    const executor = new SkeletonAgentToolExecutor({ registry, config: { mode: "test" } });
    const { result } = await executor.execute("nonexistent", {}, execCtx);
    assert.equal(result.status, ToolExecutionStatus.Rejected);
  });

  it("executes an enabled read-only tool", async () => {
    const registry = new InMemoryAgentToolRegistry();
    const tool = makeTestTool({ name: "test.echo", readOnly: true, disabledByDefault: false, requiresConfirmation: false, sensitivity: "low" });
    registry.register(tool);
    const executor = new SkeletonAgentToolExecutor({ registry, config: { mode: "test" } });
    const { result, events } = await executor.execute("test.echo", {}, execCtx);
    assert.equal(result.status, ToolExecutionStatus.Success);
    assert.ok(events.some((e) => e.type === "tool.started"));
  });

  it("generates structured events", async () => {
    const registry = new InMemoryAgentToolRegistry();
    const tool = makeTestTool({ name: "test.evts", readOnly: true, disabledByDefault: false, requiresConfirmation: false, sensitivity: "low" });
    registry.register(tool);
    const executor = new SkeletonAgentToolExecutor({ registry, config: { mode: "test" } });
    const { events } = await executor.execute("test.evts", {}, execCtx);
    const types = events.map((e) => e.type);
    assert.ok(types.includes("tool.requested"));
    assert.ok(types.includes("tool.started"));
    assert.ok(types.includes("tool.completed"));
  });

  it("handles execution failure", async () => {
    const registry = new InMemoryAgentToolRegistry();
    const tool = makeTestTool({ name: "test.fail", readOnly: true, disabledByDefault: false, requiresConfirmation: false, sensitivity: "low" });
    tool.execute = async () => { throw new Error("Kaboom!"); };
    registry.register(tool);
    const executor = new SkeletonAgentToolExecutor({ registry, config: { mode: "test" } });
    const { result } = await executor.execute("test.fail", {}, execCtx);
    assert.equal(result.status, ToolExecutionStatus.Failed);
  });

  it("safe summary strips secrets", async () => {
    const registry = new InMemoryAgentToolRegistry();
    const tool = makeTestTool({
      name: "test.secret", readOnly: true, disabledByDefault: false, requiresConfirmation: false, sensitivity: "low",
      executeResult: { toolCallId: "x", status: "success", safeSummary: "Result has api_key: sk-12345", retryable: false, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationMs: 1 },
    });
    registry.register(tool);
    const executor = new SkeletonAgentToolExecutor({ registry, config: { mode: "test" } });
    const { result } = await executor.execute("test.secret", {}, execCtx);
    assert.ok(result.safeSummary.includes("redacted"));
  });
});
