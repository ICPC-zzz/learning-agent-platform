import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import {
  createAndStartAssistantMultiAgentTask,
  listAssistantTasksForConversation,
} from "../apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts";
import { FileAssistantTaskRepository } from "../apps/web/src/lib/assistant/assistant-task-repository.ts";
import { createEmptyAssistantLearningContext } from "../apps/web/src/lib/assistant/user-learning-context.ts";

test("A516 development Tool Calling stub drives the real Web agent task chain", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "lap-a516-web-stub-"));
  const repository = new FileAssistantTaskRepository({ rootDir });
  const userId = "a516-web-stub-user";
  const conversationId = "a516-web-stub-conversation";

  await createAndStartAssistantMultiAgentTask({
    userId,
    conversationId,
    requestId: "a516-web-stub-request",
    question: "根据我的水平推荐 Codeforces 题目，并告诉我最近一场比赛。",
    repository,
    learningContext: createEmptyAssistantLearningContext("A516", true),
    pageContext: { route: "/ai", pageType: "ai" },
    stabilityInjectionMode: "tool_unknown_once",
    guardEnv: { LAP_AGENT_STABILITY_TEST_MODE: "1" },
  });

  const task = await waitForTerminalTask({ repository, userId, conversationId });
  assert.equal(task.status, "partial_success");
  assert.equal(task.stabilityInjectionMode, "tool_unknown_once");
  assert.ok(task.auditEvents.filter((event) => event.eventType === "model_request_started").length >= 2);
  assert.ok(task.agentRuns.some((run) => run.agentName === "Orchestrator"));
  assert.ok(task.auditEvents.some((event) => event.eventType === "agent_loop_started"));
  assert.ok(task.auditEvents.some((event) => event.eventType === "model_tool_calls_received"));
  assert.ok(task.auditEvents.some((event) => event.eventType === "tool_call_validation_failed"));
  assert.ok(task.auditEvents.some((event) => event.eventType === "tool_result_appended"));
  assert.ok(task.finalAnswer.includes("开发验收模式"));
});

async function waitForTerminalTask(input) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const tasks = await listAssistantTasksForConversation({
      userId: input.userId,
      conversationId: input.conversationId,
      repository: input.repository,
    });
    const task = tasks[0];
    if (task && isTerminal(task.status)) {
      return task;
    }
    await sleep(50);
  }
  throw new Error("Timed out waiting for A516 web stub task to finish");
}

function isTerminal(status) {
  return status === "succeeded" ||
    status === "partial_success" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "timed_out";
}
