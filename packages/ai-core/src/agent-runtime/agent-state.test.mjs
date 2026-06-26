import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentExecutionStatus,
  AgentTaskStatus,
  createInitialAgentExecutionState,
  transitionToRunning,
  transitionToCompleted,
  transitionToFailed,
  transitionToCancelled,
  addTask,
  startTask,
  completeTask,
  failTask,
  incrementTurn,
  setActiveAgent,
  updateSharedContext,
  updatePrivateAgentContext,
  accumulateUsage,
  recordToolCall,
} from "./core/agent-types.ts";

const makeTask = (taskId, runId = "run_1") => ({
  taskId,
  runId,
  agentId: "test-agent",
  intent: "Test task",
  input: { intent: "Test" },
  status: AgentTaskStatus.Pending,
  priority: 2,
  createdAt: new Date().toISOString(),
  dependencies: [],
});

describe("AgentExecutionState", () => {
  it("creates initial state with correct defaults", () => {
    const state = createInitialAgentExecutionState({
      runId: "run_1",
      conversationId: "conv_1",
      userId: "user_1",
    });
    assert.equal(state.runId, "run_1");
    assert.equal(state.status, AgentExecutionStatus.Idle);
    assert.equal(state.turnCount, 0);
    assert.equal(state.pendingTasks.length, 0);
    assert.equal(state.cancellation.cancelled, false);
  });

  it("transitions from Idle to Running", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = transitionToRunning(state, "agent_1");
    assert.equal(state.status, AgentExecutionStatus.Running);
    assert.equal(state.activeAgentId, "agent_1");
  });

  it("rejects transition to Running from non-Idle state", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = transitionToRunning(state);
    assert.throws(() => transitionToRunning(state), /Cannot transition to running/);
  });

  it("transitions to Completed when no running tasks", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = transitionToRunning(state);
    state = transitionToCompleted(state);
    assert.equal(state.status, AgentExecutionStatus.Completed);
  });

  it("rejects transition to Completed while tasks are running", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = transitionToRunning(state);
    state = addTask(state, makeTask("task_1"));
    state = startTask(state, "task_1");
    assert.equal(state.runningTasks.length, 1);
    assert.throws(() => transitionToCompleted(state), /tasks are still running/);
  });

  it("transitions from Running to Failed", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = transitionToRunning(state);
    state = transitionToFailed(state);
    assert.equal(state.status, AgentExecutionStatus.Failed);
  });

  it("rejects transition to Failed from non-Running", () => {
    const state = createInitialAgentExecutionState({ runId: "run_1" });
    assert.throws(() => transitionToFailed(state), /Must be running/);
  });

  it("transitions to Cancelled from Idle, Running, or Failed", () => {
    let idle = createInitialAgentExecutionState({ runId: "run_1" });
    idle = transitionToCancelled(idle, "User requested");
    assert.equal(idle.status, AgentExecutionStatus.Cancelled);
    assert.equal(idle.cancellation.reason, "User requested");
    let running = createInitialAgentExecutionState({ runId: "run_2" });
    running = transitionToRunning(running);
    running = transitionToCancelled(running);
    assert.equal(running.status, AgentExecutionStatus.Cancelled);
  });

  it("immutably updates", () => {
    const original = createInitialAgentExecutionState({ runId: "run_1" });
    const updated = addTask(original, makeTask("task_1"));
    assert.notEqual(original, updated);
    assert.equal(original.pendingTasks.length, 0);
    assert.equal(updated.pendingTasks.length, 1);
  });

  it("adds task to pending queue", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    assert.equal(state.pendingTasks.length, 1);
    assert.equal(state.pendingTasks[0].taskId, "task_1");
  });

  it("rejects duplicate task ID", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    assert.throws(() => addTask(state, makeTask("task_1")), /already exists/);
  });

  it("starts a task", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    state = startTask(state, "task_1");
    assert.equal(state.pendingTasks.length, 0);
    assert.equal(state.runningTasks.length, 1);
    assert.equal(state.runningTasks[0].status, AgentTaskStatus.Running);
  });

  it("rejects starting a non-existent task", () => {
    const state = createInitialAgentExecutionState({ runId: "run_1" });
    assert.throws(() => startTask(state, "nonexistent"), /not found/);
  });

  it("completes a running task", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    state = startTask(state, "task_1");
    state = completeTask(state, "task_1");
    assert.equal(state.runningTasks.length, 0);
    assert.equal(state.completedTasks.length, 1);
    assert.equal(state.completedTasks[0].status, AgentTaskStatus.Completed);
  });

  it("fails a running task", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    state = startTask(state, "task_1");
    state = failTask(state, "task_1", { code: "ERR", message: "x", retryable: true });
    assert.equal(state.runningTasks.length, 0);
    assert.equal(state.failedTasks.length, 1);
  });

  it("fails a pending task", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = addTask(state, makeTask("task_1"));
    state = failTask(state, "task_1", { code: "ERR", message: "x", retryable: false });
    assert.equal(state.pendingTasks.length, 0);
    assert.equal(state.failedTasks.length, 1);
  });

  it("increments turn count", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    for (let i = 0; i < 5; i++) state = incrementTurn(state);
    assert.equal(state.turnCount, 5);
  });

  it("sets active agent", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = setActiveAgent(state, "cf-data-analyst");
    assert.equal(state.activeAgentId, "cf-data-analyst");
  });

  it("updates shared context", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = updateSharedContext(state, { key1: "val1" });
    state = updateSharedContext(state, { key2: "val2" });
    assert.deepEqual(state.sharedContext.entries, { key1: "val1", key2: "val2" });
  });

  it("updates private agent context", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = updatePrivateAgentContext(state, "agent_a", { score: 100 });
    state = updatePrivateAgentContext(state, "agent_b", { score: 200 });
    assert.deepEqual(state.privateAgentContexts["agent_a"]?.entries, { score: 100 });
  });

  it("accumulates token usage", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = accumulateUsage(state, { inputTokens: 500, outputTokens: 200 });
    state = accumulateUsage(state, { inputTokens: 300, outputTokens: 150, estimatedCost: 0.002 });
    assert.equal(state.usage.inputTokens, 800);
    assert.equal(state.usage.outputTokens, 350);
    assert.equal(state.usage.estimatedCost, 0.002);
  });

  it("records tool call", () => {
    let state = createInitialAgentExecutionState({ runId: "run_1" });
    state = recordToolCall(state, {
      toolCallId: "tcall_1",
      toolName: "test.echo",
      agentId: "agent_1",
      status: "success",
      startedAt: new Date().toISOString(),
    });
    assert.equal(state.usage.toolCalls, 1);
    assert.equal(state.toolCalls.length, 1);
    assert.equal(state.toolCalls[0].toolName, "test.echo");
  });
});
