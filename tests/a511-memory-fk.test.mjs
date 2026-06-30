import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PrismaMemoryRepository } from "../packages/db/src/repositories/memory-repository.ts";

function createFakePrisma({ existingSessionIds = [], existingMessageIds = [] } = {}) {
  const created = [];
  const existingSessions = new Set(existingSessionIds);
  const existingMessages = new Set(existingMessageIds);

  return {
    created,
    memoryItem: {
      count: async () => 0,
      create: async ({ data }) => {
        created.push(data);
        return {
          id: "mem_a511",
          userId: data.userId,
          sessionId: data.sessionId ?? null,
          sourceMessageId: data.sourceMessageId ?? null,
          memoryType: data.memoryType,
          content: data.content,
          importance: data.importance,
          metadata: data.metadata,
          createdAt: new Date("2026-06-28T00:00:00.000Z"),
          updatedAt: new Date("2026-06-28T00:00:00.000Z"),
        };
      },
    },
    agentSession: {
      findUnique: async ({ where }) =>
        existingSessions.has(where.id) ? { id: where.id } : null,
    },
    agentMessage: {
      findUnique: async ({ where }) =>
        existingMessages.has(where.id) ? { id: where.id } : null,
    },
  };
}

describe("A511 MemoryItem FK safety", () => {
  it("stores file conversation/message ids as metadata when Prisma FK rows do not exist", async () => {
    const prisma = createFakePrisma();
    const repo = new PrismaMemoryRepository(prisma);

    const record = await repo.addMemory({
      userId: "db-user-1",
      content: "以后回答保持简短中文",
      category: "learning",
      source: "user_created",
      sessionId: "assistant-conv-file-1",
      sourceMessageId: "assistant-user-file-1",
      metadata: {
        memoryType: "RETRIEVABLE",
        sourceConversationId: "assistant-conv-file-1",
      },
    });

    assert.equal(prisma.created.length, 1);
    assert.equal(prisma.created[0].userId, "db-user-1");
    assert.equal(prisma.created[0].sessionId, null);
    assert.equal(prisma.created[0].sourceMessageId, null);
    assert.equal(prisma.created[0].metadata.sourceConversationId, "assistant-conv-file-1");
    assert.equal(prisma.created[0].metadata.externalSessionId, "assistant-conv-file-1");
    assert.equal(prisma.created[0].metadata.sessionReferenceKind, "external");
    assert.equal(prisma.created[0].metadata.sourceMessageId, "assistant-user-file-1");
    assert.equal(prisma.created[0].metadata.externalSourceMessageId, "assistant-user-file-1");
    assert.equal(prisma.created[0].metadata.sourceMessageReferenceKind, "external");
    assert.equal(record.sessionId, null);
    assert.equal(record.sourceMessageId, null);
  });

  it("keeps real Prisma AgentSession/AgentMessage ids as foreign keys", async () => {
    const prisma = createFakePrisma({
      existingSessionIds: ["agent-session-1"],
      existingMessageIds: ["agent-message-1"],
    });
    const repo = new PrismaMemoryRepository(prisma);

    await repo.addMemory({
      userId: "db-user-1",
      content: "优先给出可执行步骤",
      category: "learning",
      source: "user_created",
      sessionId: "agent-session-1",
      sourceMessageId: "agent-message-1",
      metadata: { memoryType: "RETRIEVABLE" },
    });

    assert.equal(prisma.created[0].sessionId, "agent-session-1");
    assert.equal(prisma.created[0].sourceMessageId, "agent-message-1");
    assert.equal(prisma.created[0].metadata.sourceConversationId, "agent-session-1");
    assert.equal(prisma.created[0].metadata.sessionReferenceKind, "prisma");
    assert.equal(prisma.created[0].metadata.sourceMessageId, "agent-message-1");
    assert.equal(prisma.created[0].metadata.sourceMessageReferenceKind, "prisma");
    assert.equal(prisma.created[0].metadata.externalSessionId, undefined);
    assert.equal(prisma.created[0].metadata.externalSourceMessageId, undefined);
  });

  it("maps browser preview users to database User owners before memory writes", () => {
    const source = readFileSync(
      "apps/web/src/lib/assistant/memory-service.ts",
      "utf8",
    );

    assert.match(source, /PrismaUserRepository/);
    assert.match(source, /authProviderId:\s*externalUserId/);
    assert.match(source, /ownerUserId:\s*owner\.id/);
    assert.match(source, /userId:\s*context\.ownerUserId/);
    assert.match(source, /ownerIds:\s*uniqueOwnerIds\(\[owner\.id,\s*externalUserId\]\)/);
  });
});
