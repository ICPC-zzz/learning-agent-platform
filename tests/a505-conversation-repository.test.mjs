import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { CompressionReason } from "../packages/ai-core/src/memory/index.ts";
import {
  AssistantConversationRepositoryError,
  FileAssistantConversationRepository,
} from "../apps/web/src/lib/assistant/assistant-conversation-repository.ts";

async function withRepository(fn) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "lap-a505-repo-"));
  try {
    const repo = new FileAssistantConversationRepository({ rootDir });
    await fn(repo, rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function appendTurn(repo, userId, conversationId, index) {
  await repo.appendMessage({
    userId,
    conversationId,
    role: "user",
    visibleContent: `goal ${index}: complete the A505 context compression closure with a repeatable browser flow. must keep file apps/web/src/app/ai/page.tsx and avoid real LLM calls.`,
    contextWindowTokens: 2048,
  });
  return repo.appendMessage({
    userId,
    conversationId,
    role: "assistant",
    visibleContent: `confirmed fact ${index}: conversation ${conversationId} is persisted in the file Repository with archived messages and retained recent messages.`,
    contextWindowTokens: 2048,
  });
}

describe("A505 file conversation repository", () => {
  it("persists compression summaries and archived message state", async () => {
    await withRepository(async (repo, rootDir) => {
      const created = await repo.getOrCreateConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      const conversationId = created.session.id;

      await appendTurn(repo, "dev-user-001", conversationId, 1);
      await appendTurn(repo, "dev-user-001", conversationId, 2);
      await appendTurn(repo, "dev-user-001", conversationId, 3);

      const compressed = await repo.compressConversation({
        userId: "dev-user-001",
        conversationId,
        reason: CompressionReason.UserRequested,
        trigger: "manual_button",
        contextWindowTokens: 2048,
      });

      assert.equal(compressed.session.compressionCount, 1);
      assert.equal(compressed.compressions.length, 1);
      assert.equal(compressed.compressions[0].reason, CompressionReason.UserRequested);
      assert.ok(compressed.compressions[0].archivedMessageCount >= 2);
      assert.ok(compressed.messages.some((message) => message.archivedAt));
      assert.ok(compressed.activeContext.excludedArchivedMessageIds.length >= 2);

      const freshRepo = new FileAssistantConversationRepository({ rootDir });
      const restored = await freshRepo.getConversation({
        userId: "dev-user-001",
        conversationId,
        contextWindowTokens: 2048,
      });

      assert.equal(restored.session.compressionCount, 1);
      assert.equal(restored.compressions[0].summaryText, compressed.compressions[0].summaryText);
      assert.deepEqual(
        restored.activeContext.excludedArchivedMessageIds,
        compressed.activeContext.excludedArchivedMessageIds,
      );
      assert.match(restored.activeContext.contextText, /最近有效压缩摘要/);
    });
  });

  it("does not compress the same archived range twice", async () => {
    await withRepository(async (repo) => {
      const created = await repo.getOrCreateConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      const conversationId = created.session.id;
      for (let index = 1; index <= 8; index += 1) {
        await appendTurn(repo, "dev-user-001", conversationId, index);
      }

      const first = await repo.compressConversation({
        userId: "dev-user-001",
        conversationId,
        reason: CompressionReason.ContextBudget,
        trigger: "auto_budget",
        contextWindowTokens: 2048,
      });

      await assert.rejects(
        () => repo.compressConversation({
          userId: "dev-user-001",
          conversationId,
          reason: CompressionReason.ContextBudget,
          trigger: "auto_budget",
          contextWindowTokens: 2048,
        }),
        (error) =>
          error instanceof AssistantConversationRepositoryError
          && error.code === "not_enough_messages",
      );

      const after = await repo.getConversation({
        userId: "dev-user-001",
        conversationId,
        contextWindowTokens: 2048,
      });
      assert.equal(after.session.compressionCount, first.session.compressionCount);
    });
  });

  it("isolates conversations by trusted server user id", async () => {
    await withRepository(async (repo) => {
      const userA = await repo.getOrCreateConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      const conversationId = userA.session.id;
      await appendTurn(repo, "dev-user-001", conversationId, 1);

      await assert.rejects(
        () => repo.getConversation({
          userId: "dev-user-002",
          conversationId,
          contextWindowTokens: 2048,
        }),
        (error) =>
          error instanceof AssistantConversationRepositoryError
          && error.code === "conversation_not_found",
      );
    });
  });

  it("builds the next active context from summary plus retained messages", async () => {
    await withRepository(async (repo) => {
      const created = await repo.getOrCreateConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      const conversationId = created.session.id;
      for (let index = 1; index <= 8; index += 1) {
        await appendTurn(repo, "dev-user-001", conversationId, index);
      }

      const before = await repo.getConversation({
        userId: "dev-user-001",
        conversationId,
        contextWindowTokens: 2048,
      });
      const compressed = await repo.compressConversation({
        userId: "dev-user-001",
        conversationId,
        reason: CompressionReason.UserRequested,
        trigger: "conversation_command",
        contextWindowTokens: 2048,
      });

      assert.ok(compressed.activeContext.latestCompression);
      assert.ok(compressed.activeContext.includedMessageIds.length > 0);
      assert.ok(compressed.activeContext.excludedArchivedMessageIds.length > 0);
      assert.ok(compressed.activeContext.estimatedTokens < before.activeContext.estimatedTokens);
    });
  });
});
