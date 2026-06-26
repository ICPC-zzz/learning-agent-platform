import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryAgentRunEventStore } from "./events/in-memory-event-store.ts";
import { SequenceConflictError } from "./events/event-store.ts";
import { resetEventSequence, createRunStartedEvent, createRunCompletedEvent } from "./core/agent-events.ts";
import { AgentExecutionStatus } from "./core/agent-types.ts";
import { InMemoryPromptSectionRegistry, PromptComposer, createPlaceholderPromptSections } from "./prompts/prompt-section.ts";
import { InMemoryAgentUsageTracker, InMemoryPricingTable, UsageAggregator, calculateCost } from "./usage/agent-usage.ts";
import { FakeOrchestrator, AGENT_DESCRIPTORS, getAgentDescriptor, getEnabledAgents, getAgentsByRole, FUTURE_TOOL_MAPPINGS } from "./orchestration/orchestrator-types.ts";

describe("InMemoryAgentRunEventStore", () => {
  it("appends and lists events in sequence order", async () => {
    resetEventSequence();
    const store = new InMemoryAgentRunEventStore();
    const e1 = createRunStartedEvent("run_1", { status: AgentExecutionStatus.Running });
    const e2 = createRunCompletedEvent("run_1", { status: AgentExecutionStatus.Completed });
    await store.append(e1);
    await store.append(e2);
    const events = await store.list("run_1");
    assert.equal(events.length, 2);
    assert.ok(events[0].sequence < events[1].sequence);
  });

  it("rejects duplicate sequence for same run", async () => {
    resetEventSequence();
    const store = new InMemoryAgentRunEventStore();
    const e = createRunStartedEvent("run_1", { status: AgentExecutionStatus.Running });
    await store.append(e);
    await assert.rejects(function() { return store.append(e); }, SequenceConflictError);
  });

  it("returns empty for unknown run", async () => {
    const store = new InMemoryAgentRunEventStore();
    assert.deepEqual(await store.list("nonexistent"), []);
  });

  it("counts events per run", async () => {
    resetEventSequence();
    const store = new InMemoryAgentRunEventStore();
    await store.append(createRunStartedEvent("run_1", { status: AgentExecutionStatus.Running }));
    await store.append(createRunStartedEvent("run_2", { status: AgentExecutionStatus.Running }));
    await store.append(createRunCompletedEvent("run_2", { status: AgentExecutionStatus.Completed }));
    assert.equal(await store.count("run_1"), 1);
    assert.equal(await store.count("run_2"), 2);
  });

  it("supports replay", async () => {
    resetEventSequence();
    const store = new InMemoryAgentRunEventStore();
    const events = [createRunStartedEvent("run_1", { status: AgentExecutionStatus.Running }), createRunCompletedEvent("run_1", { status: AgentExecutionStatus.Completed })];
    for (const e of events) { await store.append(e); }
    const replayed = await store.list("run_1");
    assert.equal(replayed.length, 2);
    assert.equal(replayed[0].eventId, events[0].eventId);
  });
});

describe("PromptSection System", () => {
  it("sorts sections by priority, safety first", function() {
    const registry = new InMemoryPromptSectionRegistry();
    var sections = createPlaceholderPromptSections();
    for (var i = 0; i < sections.length; i++) { registry.register(sections[i]); }
    const composer = new PromptComposer(registry);
    const result = composer.compose();
    assert.ok(result.systemPrompt.startsWith("## Core Safety Rules"));
    assert.equal(result.sectionNames[0], "core-safety");
  });

  it("filters sections by agent role", function() {
    const registry = new InMemoryPromptSectionRegistry();
    var sections = createPlaceholderPromptSections();
    for (var i = 0; i < sections.length; i++) { registry.register(sections[i]); }
    const forDebugger = registry.listForAgent("debugger_1", "debugger");
    assert.ok(forDebugger.some(function(s) { return s.name === "core-safety"; }));
    assert.ok(forDebugger.some(function(s) { return s.name === "debug-policy"; }));
    assert.ok(!forDebugger.some(function(s) { return s.name === "cf-analysis-policy"; }));
  });

  it("deduplicates sections", function() {
    const registry = new InMemoryPromptSectionRegistry();
    registry.register({ name: "safety", label: "Safety", priority: 0, applicableRoles: [], enabled: true, content: "safe", maxLength: 0 });
    registry.register({ name: "tools", label: "Tools", priority: 20, applicableRoles: [], enabled: true, content: "tools", maxLength: 0 });
    // Duplicate by name should not be allowed by registry
    assert.throws(function() {
      registry.register({ name: "safety", label: "Dup", priority: 0, applicableRoles: [], enabled: true, content: "dup", maxLength: 0 });
    }, /already registered/);
  });

  it("respects max total length", function() {
    const registry = new InMemoryPromptSectionRegistry();
    registry.register({ name: "big", label: "Big", priority: 50, applicableRoles: [], enabled: true, content: "X".repeat(5000), maxLength: 0 });
    const composer = new PromptComposer(registry);
    const result = composer.compose({ maxTotalLength: 100 });
    assert.ok(result.totalLength <= 100);
  });
});

describe("Usage and Cost", () => {
  it("aggregates token usage", function() {
    const agg = new UsageAggregator();
    agg.record({ provider: "test", model: "v1", inputTokens: 500, outputTokens: 200, cachedInputTokens: 0, reasoningTokens: 0, toolCalls: 1, estimatedCost: 0.003, currency: "USD", isEstimated: true });
    agg.record({ provider: "test", model: "v1", inputTokens: 300, outputTokens: 150, cachedInputTokens: 0, reasoningTokens: 0, toolCalls: 0, estimatedCost: 0.002, currency: "USD", isEstimated: true });
    assert.equal(agg.aggregate().totalInputTokens, 800);
  });

  it("returns null cost when unknown", function() {
    const agg = new UsageAggregator();
    agg.record({ provider: "x", model: "y", inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0, toolCalls: 0, estimatedCost: null, currency: "USD", isEstimated: false });
    assert.equal(agg.aggregate().totalEstimatedCost, null);
  });

  it("tracks per agent and run", function() {
    const tracker = new InMemoryAgentUsageTracker();
    tracker.setCurrentContext({ runId: "run_1", agentId: "agent_a" });
    tracker.recordCall({ provider: "t", model: "v1", inputTokens: 100, outputTokens: 50, cachedInputTokens: 0, reasoningTokens: 0, toolCalls: 0, estimatedCost: 0.001, currency: "USD", isEstimated: true });
    tracker.setCurrentContext({ agentId: "agent_b" });
    tracker.recordCall({ provider: "t", model: "v1", inputTokens: 200, outputTokens: 100, cachedInputTokens: 0, reasoningTokens: 0, toolCalls: 0, estimatedCost: 0.002, currency: "USD", isEstimated: true });
    assert.equal(tracker.getAgentUsage("agent_a").totalInputTokens, 100);
    assert.equal(tracker.getRunUsage("run_1").totalInputTokens, 300);
  });
});

describe("Agent Descriptors", () => {
  it("all disabled by default", function() {
    assert.equal(getEnabledAgents().length, 0);
  });

  it("looks up descriptor by ID", function() {
    var d = getAgentDescriptor("orchestrator");
    assert.equal(d.role, "orchestrator");
    assert.equal(d.enabled, false);
  });

  it("has all 11 roles defined", function() {
    const roles = ["orchestrator", "cf-data-collector", "cf-data-analyst", "cf-report-writer", "cf-problem-recommender", "problem-parser", "complexity-analyzer", "debugger", "code-optimizer", "content-collector", "content-summarizer"];
    for (var i = 0; i < roles.length; i++) {
      assert.ok(getAgentsByRole(roles[i]).length >= 1, "Missing: " + roles[i]);
    }
  });

  it("future tool mappings documented", function() {
    const keys = Object.keys(FUTURE_TOOL_MAPPINGS);
    assert.ok(keys.indexOf("cf.user.snapshot.read") >= 0);
    assert.ok(keys.indexOf("cf.problem.candidates.read") >= 0);
  });
});

describe("FakeOrchestrator", () => {
  it("produces deterministic plan", async function() {
    const orch = new FakeOrchestrator();
    const plan = await orch.plan({ requestId: "req_1", intent: "Test", input: {} });
    assert.ok(plan.planId.startsWith("plan_"));
    assert.equal(plan.steps.length, 2);
  });

  it("executes plan yielding events", async function() {
    const orch = new FakeOrchestrator();
    const plan = await orch.plan({ requestId: "req_1", intent: "Test", input: {} });
    const events = [];
    var it = orch.execute(plan);
    for await (const e of it) { events.push(e); }
    assert.equal(events.length, 2);
    assert.ok(events.every(function(e) { return e.type === "agent.progress"; }));
  });
});
