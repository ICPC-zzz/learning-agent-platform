import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FileAssistantTaskRepository,
  toAssistantTaskView,
} from "../apps/web/src/lib/assistant/assistant-task-repository.ts";

test("A516 assistant task artifact repository isolates owner reads and exposes only safe metadata", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "lap-a516-artifacts-"));
  const repository = new FileAssistantTaskRepository({ rootDir });
  const userId = "a516-user-a";
  const { task } = await repository.createOrReuseTask({
    userId,
    conversationId: "a516-conversation",
    requestId: "a516-request",
    userVisibleRequest: "生成包含大工具结果的计划",
  });

  const artifact = await repository.saveToolResultArtifact({
    ownerUserId: userId,
    conversationId: task.conversationId,
    runId: task.id,
    toolCallId: "call-large",
    toolName: "assistant.large_tool",
    contentType: "application/json",
    safePreview: "大型工具结果已摘要。",
    sourceRefs: [{
      title: "A516 source",
      source: "unit-test",
      recordId: "a516-source",
      safeSummary: "safe source",
    }],
    content: {
      rows: [{ id: "row-1", title: "Safe persisted row" }],
    },
    size: 128,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const reloaded = await repository.getTask({ userId, taskId: task.id });
  const view = toAssistantTaskView(reloaded);

  assert.equal(view.toolResultArtifacts.length, 1);
  assert.equal(view.toolResultArtifacts[0].artifactId, artifact.artifactId);
  assert.equal(view.toolResultArtifacts[0].safePreview, "大型工具结果已摘要。");
  assert.doesNotMatch(JSON.stringify(view.toolResultArtifacts[0]), /tool-result-artifacts|lap-a516-artifacts|Safe persisted row/);

  const content = await repository.readToolResultArtifact({
    ownerUserId: userId,
    artifactId: artifact.artifactId,
  });
  assert.deepEqual(content, {
    rows: [{ id: "row-1", title: "Safe persisted row" }],
  });

  const crossUserRead = await repository.readToolResultArtifact({
    ownerUserId: "a516-user-b",
    artifactId: artifact.artifactId,
  });
  assert.equal(crossUserRead, null);
});

test("A516 assistant task artifact cleanup skips final-answer referenced artifacts", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "lap-a516-artifact-cleanup-"));
  const repository = new FileAssistantTaskRepository({ rootDir });
  const userId = "a516-cleanup-user";
  const { task } = await repository.createOrReuseTask({
    userId,
    conversationId: "a516-cleanup-conversation",
    requestId: "a516-cleanup-request",
    userVisibleRequest: "清理过期 Artifact",
  });

  const expired = await repository.saveToolResultArtifact({
    ownerUserId: userId,
    conversationId: task.conversationId,
    runId: task.id,
    toolCallId: "call-expired",
    toolName: "assistant.large_tool",
    contentType: "application/json",
    safePreview: "过期且未被引用。",
    sourceRefs: [],
    content: { ok: true },
    size: 20,
    expiresAt: "2026-01-01T00:00:00.000Z",
  });
  const referenced = await repository.saveToolResultArtifact({
    ownerUserId: userId,
    conversationId: task.conversationId,
    runId: task.id,
    toolCallId: "call-referenced",
    toolName: "assistant.large_tool",
    contentType: "application/json",
    safePreview: "过期但被最终回答引用。",
    sourceRefs: [],
    content: { ok: true },
    size: 20,
    expiresAt: "2026-01-01T00:00:00.000Z",
  });

  await repository.mutateTask({ userId, taskId: task.id }, (record) => {
    record.finalAnswer = `最终回答引用 ${referenced.artifactId}`;
    return record;
  });

  const removed = await repository.cleanupExpiredToolResultArtifacts({
    ownerUserId: userId,
    now: "2026-06-28T00:00:00.000Z",
  });

  assert.equal(removed, 1);
  assert.equal(await repository.readToolResultArtifact({ ownerUserId: userId, artifactId: expired.artifactId }), null);
  assert.ok(await repository.readToolResultArtifact({ ownerUserId: userId, artifactId: referenced.artifactId }));
});
