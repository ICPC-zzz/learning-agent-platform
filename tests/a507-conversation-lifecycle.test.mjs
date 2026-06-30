import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  AssistantConversationRepositoryError,
  FileAssistantConversationRepository,
} from "../apps/web/src/lib/assistant/assistant-conversation-repository.ts";

async function withRepository(fn) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "lap-a507-repo-"));
  try {
    const repo = new FileAssistantConversationRepository({ rootDir });
    await fn(repo, rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function appendUserMessage(repo, userId, conversationId, content) {
  return repo.appendMessage({
    userId,
    conversationId,
    role: "user",
    visibleContent: content,
    contextWindowTokens: 2048,
  });
}

describe("A507 assistant conversation lifecycle", () => {
  it("creates a new chat without overwriting the previous conversation", async () => {
    await withRepository(async (repo, rootDir) => {
      const first = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      await appendUserMessage(repo, "dev-user-001", first.session.id, "first conversation message");

      const second = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      await appendUserMessage(repo, "dev-user-001", second.session.id, "second conversation message");

      assert.notEqual(first.session.id, second.session.id);

      const freshRepo = new FileAssistantConversationRepository({ rootDir });
      const restoredFirst = await freshRepo.getConversation({
        userId: "dev-user-001",
        conversationId: first.session.id,
        contextWindowTokens: 2048,
      });
      const restoredSecond = await freshRepo.getConversation({
        userId: "dev-user-001",
        conversationId: second.session.id,
        contextWindowTokens: 2048,
      });

      assert.equal(restoredFirst.messages.at(-1)?.visibleContent, "first conversation message");
      assert.equal(restoredSecond.messages.at(-1)?.visibleContent, "second conversation message");
    });
  });

  it("lists active conversations by latest update time", async () => {
    await withRepository(async (repo) => {
      const first = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      const second = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });

      await appendUserMessage(repo, "dev-user-001", first.session.id, "older");
      await appendUserMessage(repo, "dev-user-001", second.session.id, "newer");

      const list = await repo.listConversations({
        userId: "dev-user-001",
        status: "active",
      });

      assert.equal(list[0].id, second.session.id);
      assert.equal(list[1].id, first.session.id);
      assert.equal(list[0].recentMessagePreview, "newer");
    });
  });

  it("prevents another user from opening or mutating a conversation", async () => {
    await withRepository(async (repo) => {
      const first = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      await appendUserMessage(repo, "dev-user-001", first.session.id, "private");

      await assert.rejects(
        () => repo.getConversation({
          userId: "dev-user-002",
          conversationId: first.session.id,
          contextWindowTokens: 2048,
        }),
        (error) =>
          error instanceof AssistantConversationRepositoryError
          && error.code === "conversation_not_found",
      );

      assert.equal(
        await repo.deleteConversation({
          userId: "dev-user-002",
          conversationId: first.session.id,
        }),
        false,
      );
    });
  });

  it("archives, restores, and deletes conversations persistently", async () => {
    await withRepository(async (repo, rootDir) => {
      const created = await repo.createConversation({
        userId: "dev-user-001",
        contextWindowTokens: 2048,
      });
      await appendUserMessage(repo, "dev-user-001", created.session.id, "archive me");

      const archived = await repo.archiveConversation({
        userId: "dev-user-001",
        conversationId: created.session.id,
      });
      assert.equal(archived.status, "archived");
      assert.equal((await repo.listConversations({ userId: "dev-user-001", status: "active" })).length, 0);
      assert.equal((await repo.listConversations({ userId: "dev-user-001", status: "archived" }))[0].id, created.session.id);

      await assert.rejects(
        () => appendUserMessage(repo, "dev-user-001", created.session.id, "blocked"),
        (error) =>
          error instanceof AssistantConversationRepositoryError
          && error.code === "conversation_archived",
      );

      const restored = await repo.restoreConversation({
        userId: "dev-user-001",
        conversationId: created.session.id,
      });
      assert.equal(restored.status, "active");
      await appendUserMessage(repo, "dev-user-001", created.session.id, "restored");

      assert.equal(
        await repo.deleteConversation({
          userId: "dev-user-001",
          conversationId: created.session.id,
        }),
        true,
      );

      const freshRepo = new FileAssistantConversationRepository({ rootDir });
      await assert.rejects(
        () => freshRepo.getConversation({
          userId: "dev-user-001",
          conversationId: created.session.id,
          contextWindowTokens: 2048,
        }),
        (error) =>
          error instanceof AssistantConversationRepositoryError
          && error.code === "conversation_not_found",
      );
    });
  });
});
