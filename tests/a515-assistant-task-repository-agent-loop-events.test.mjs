import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FileAssistantTaskRepository,
  createAuditEvent,
  toAssistantTaskView,
} from "../apps/web/src/lib/assistant/assistant-task-repository.ts";

test("A515 assistant task repository preserves reliable Agent Loop events and tool fault mode", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "lap-a515-agent-task-"));
  const repository = new FileAssistantTaskRepository({ rootDir });
  const userId = "a515-agent-loop-user";
  const { task } = await repository.createOrReuseTask({
    userId,
    conversationId: "a515-conversation",
    requestId: "a515-request",
    userVisibleRequest: "生成 Codeforces 训练计划",
    stabilityInjectionMode: "tool_timeout_once",
  });

  await repository.mutateTask({ userId, taskId: task.id }, (record) => {
    record.auditEvents.push(createAuditEvent({
      taskId: record.id,
      eventType: "agent_loop_started",
      status: "running",
      safeMessage: "Reliable Agent Loop started.",
    }));
    record.auditEvents.push(createAuditEvent({
      taskId: record.id,
      eventType: "model_tool_calls_received",
      status: "running",
      safeMessage: "Model requested read-only tools.",
    }));
    return record;
  });

  const reloaded = await repository.getTask({ userId, taskId: task.id });
  const view = toAssistantTaskView(reloaded);

  assert.equal(reloaded.stabilityInjectionMode, "tool_timeout_once");
  assert.equal(view.stabilityInjectionMode, "tool_timeout_once");
  assert.ok(view.auditEvents.some((event) => event.eventType === "agent_loop_started"));
  assert.ok(view.auditEvents.some((event) => event.eventType === "model_tool_calls_received"));
});
