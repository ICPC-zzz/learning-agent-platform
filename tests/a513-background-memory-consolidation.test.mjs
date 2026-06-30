import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FileAssistantConversationRepository,
} from "../apps/web/src/lib/assistant/assistant-conversation-repository.ts";
import {
  markAssistantMemoryConsolidationSkippedForExplicitWrite,
  queueAssistantMemoryConsolidationAfterTurn,
  runAssistantMemoryConsolidationNow,
} from "../apps/web/src/lib/assistant/memory-service.ts";
import { PrismaMemoryRepository } from "../packages/db/src/repositories/memory-repository.ts";

describe("A513 background memory consolidation", () => {
  it("uses the real file conversation cursor and creates model candidates after the threshold", async () => {
    const conversationRepository = await createConversationRepository();
    const memoryRepository = new InMemoryMemoryRepository();
    const { conversationId } = await createConversationWithTurns(conversationRepository, "user-a", [
      ["user", "I prefer short TypeScript practice plans."],
      ["assistant", "Noted."],
      ["user", "Please keep future drills focused and concise."],
      ["assistant", "I can do that."],
    ]);
    let providerCalls = 0;
    const provider = {
      kind: "stub-structured-provider",
      extractCandidates: async ({ messages }) => {
        providerCalls += 1;
        return {
          candidates: [{
            kind: "user_profile",
            content: "User prefers short, focused TypeScript practice plans.",
            confidence: 0.91,
            sourceMessageIds: [messages[0].id],
            reasonSummary: "Stable learning preference stated across turns.",
          }],
        };
      },
    };

    const result = await runAssistantMemoryConsolidationNow({
      userId: "user-a",
      conversationId,
      conversationRepository,
      memoryRepository,
      provider,
      env: testEnv(),
    });
    const cursor = await conversationRepository.getMemoryConsolidationState({
      userId: "user-a",
      conversationId,
    });
    const memories = await memoryRepository.listMemoriesByOwner({
      userId: "user-a",
      includeDisabled: true,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.memoriesCreated, 1);
    assert.equal(providerCalls, 1);
    assert.equal(cursor.status, "succeeded");
    assert.equal(cursor.lastConsolidatedMessageId, result.attemptedMessageId);
    assert.equal(memories.length, 1);
    assert.equal(memories[0].metadata.memoryKind, "background_consolidation");
  });

  it("skips explicit memory write turns by advancing the cursor", async () => {
    const conversationRepository = await createConversationRepository();
    const { conversationId, latestUserMessageId } = await createConversationWithTurns(conversationRepository, "user-a", [
      ["user", "Remember that I use pnpm for this project."],
      ["assistant", "Saved."],
    ]);

    await markAssistantMemoryConsolidationSkippedForExplicitWrite({
      userId: "user-a",
      conversationId,
      sourceMessageId: latestUserMessageId,
      conversationRepository,
    });
    const cursor = await conversationRepository.getMemoryConsolidationState({
      userId: "user-a",
      conversationId,
    });

    assert.equal(cursor.status, "skipped_explicit_write");
    assert.ok(cursor.lastConsolidatedMessageId);
    assert.deepEqual(cursor.explicitWriteMessageIds, [latestUserMessageId]);
  });

  it("queues one trailing consolidation run while a conversation is already running", async () => {
    const previousMode = process.env.LAP_MEMORY_CONSOLIDATION_TEST_MODE;
    process.env.LAP_MEMORY_CONSOLIDATION_TEST_MODE = "1";
    const conversationRepository = await createConversationRepository();
    const memoryRepository = new InMemoryMemoryRepository();
    const created = await createConversationWithTurns(conversationRepository, "user-a", [
      ["user", "I want graph practice first."],
      ["assistant", "OK."],
      ["user", "Keep graph practice concise."],
      ["assistant", "OK."],
    ]);
    let providerCalls = 0;
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const provider = {
      kind: "stub-delayed-provider",
      extractCandidates: async () => {
        providerCalls += 1;
        if (providerCalls === 1) {
          await firstGate;
        }
        return {
          candidates: [{
            kind: "project_context",
            content: `Queued consolidation memory ${providerCalls}`,
            confidence: 0.9,
          }],
        };
      },
    };

    try {
      const first = await queueAssistantMemoryConsolidationAfterTurn({
        userId: "user-a",
        conversation: snapshot(created.conversationId),
        conversationRepository,
        memoryRepository,
        provider,
      });
      await waitFor(() => providerCalls === 1);
      await appendTurn(conversationRepository, "user-a", created.conversationId, [
        ["user", "Also include trees after graphs."],
        ["assistant", "OK."],
      ]);
      const second = await queueAssistantMemoryConsolidationAfterTurn({
        userId: "user-a",
        conversation: snapshot(created.conversationId),
        conversationRepository,
        memoryRepository,
        provider,
      });
      releaseFirst();
      await waitFor(async () => {
        const cursor = await conversationRepository.getMemoryConsolidationState({
          userId: "user-a",
          conversationId: created.conversationId,
        });
        return providerCalls === 2 && cursor.trailingRunCount === 1;
      });

      assert.equal(first.queued, true);
      assert.equal(second.trailing, true);
      assert.equal(providerCalls, 2);
    } finally {
      releaseFirst();
      if (previousMode === undefined) {
        delete process.env.LAP_MEMORY_CONSOLIDATION_TEST_MODE;
      } else {
        process.env.LAP_MEMORY_CONSOLIDATION_TEST_MODE = previousMode;
      }
    }
  });

  it("dedupes active memories, blocks deleted tombstone resurrection, and isolates users", async () => {
    const conversationRepository = await createConversationRepository();
    const memoryRepository = new InMemoryMemoryRepository();
    await memoryRepository.addMemory({
      userId: "other-user",
      content: "User prefers Rust examples.",
      category: "preference",
      source: "assistant_suggested",
      metadata: { lifecycleStatus: "active", contentFingerprint: fingerprint("User prefers Rust examples.") },
    });
    await memoryRepository.addRawMemory({
      userId: "user-a",
      content: "Deleted long-term memory. Safe tombstone retained.",
      category: "preference",
      source: "assistant_suggested",
      enabled: false,
      metadata: {
        lifecycleStatus: "deleted",
        tombstone: { contentFingerprint: fingerprint("User prefers deleted examples.") },
      },
    });
    const { conversationId } = await createConversationWithTurns(conversationRepository, "user-a", [
      ["user", "I prefer Rust examples."],
      ["assistant", "Understood."],
      ["user", "Please do not restore deleted examples."],
      ["assistant", "Understood."],
    ]);

    const result = await runAssistantMemoryConsolidationNow({
      userId: "user-a",
      conversationId,
      conversationRepository,
      memoryRepository,
      provider: {
        kind: "stub-structured-provider",
        extractCandidates: async () => ({
          candidates: [
            { kind: "user_profile", content: "User prefers Rust examples.", confidence: 0.9 },
            { kind: "user_profile", content: "User prefers deleted examples.", confidence: 0.9 },
          ],
        }),
      },
      env: testEnv(),
    });
    const ownMemories = await memoryRepository.listMemoriesByOwner({
      userId: "user-a",
      includeDisabled: true,
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.memoriesCreated, 1);
    assert.equal(ownMemories.filter((memory) => memory.content === "User prefers Rust examples.").length, 1);
    assert.equal(ownMemories.some((memory) => memory.content === "User prefers deleted examples."), false);
  });

  it("marks targeted memories as superseded before writing the replacement", async () => {
    const conversationRepository = await createConversationRepository();
    const memoryRepository = new InMemoryMemoryRepository();
    const old = await memoryRepository.addMemory({
      userId: "user-a",
      content: "User uses Jest for tests.",
      category: "project",
      source: "assistant_suggested",
      metadata: { lifecycleStatus: "active", contentFingerprint: fingerprint("User uses Jest for tests.") },
    });
    const { conversationId } = await createConversationWithTurns(conversationRepository, "user-a", [
      ["user", "This repo has moved from Jest to node:test."],
      ["assistant", "Got it."],
      ["user", "Please use node:test for future tests."],
      ["assistant", "Understood."],
    ]);

    const result = await runAssistantMemoryConsolidationNow({
      userId: "user-a",
      conversationId,
      conversationRepository,
      memoryRepository,
      provider: {
        kind: "stub-structured-provider",
        extractCandidates: async () => ({
          candidates: [{
            kind: "project_context",
            content: "User uses node:test for this repository's tests.",
            confidence: 0.95,
            action: "supersede",
            targetMemoryId: old.id,
          }],
        }),
      },
      env: testEnv(),
    });
    const memories = await memoryRepository.listMemoriesByOwner({
      userId: "user-a",
      includeDisabled: true,
    });
    const superseded = memories.find((memory) => memory.id === old.id);

    assert.equal(result.memoriesCreated, 1);
    assert.equal(result.memoriesSuperseded, 1);
    assert.equal(superseded.metadata.lifecycleStatus, "superseded");
    assert.equal(superseded.enabled, false);
  });

  it("tombstones Prisma memory deletes instead of physically deleting long-term records", async () => {
    const prisma = createDeleteFakePrisma();
    const repo = new PrismaMemoryRepository(prisma);

    const deleted = await repo.deleteMemory({ userId: "user-a", memoryId: "mem-a" });

    assert.equal(deleted, true);
    assert.equal(prisma.deletedIds.length, 0);
    assert.equal(prisma.updated[0].where.id, "mem-a");
    assert.equal(prisma.updated[0].data.content, "Deleted long-term memory. Safe tombstone retained.");
    assert.equal(prisma.updated[0].data.metadata.lifecycleStatus, "deleted");
    assert.equal(prisma.updated[0].data.metadata.enabled, false);
    assert.equal(prisma.updated[0].data.metadata.tombstone.contentFingerprint, fingerprint("Sensitive preference to delete"));
  });
});

async function createConversationRepository() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "lap-a513-memory-"));
  return new FileAssistantConversationRepository({ rootDir });
}

async function createConversationWithTurns(repository, userId, turns) {
  let state = await repository.createConversation({ userId });
  let latestUserMessageId = null;
  for (const [role, content] of turns) {
    state = await repository.appendMessage({
      userId,
      conversationId: state.session.id,
      role,
      visibleContent: content,
    });
    if (role === "user") {
      latestUserMessageId = state.messages.at(-1).id;
    }
  }
  return { conversationId: state.session.id, latestUserMessageId };
}

async function appendTurn(repository, userId, conversationId, turns) {
  let state = await repository.getConversation({ userId, conversationId });
  for (const [role, content] of turns) {
    state = await repository.appendMessage({
      userId,
      conversationId,
      role,
      visibleContent: content,
    });
  }
  return state;
}

function snapshot(conversationId) {
  return {
    conversationId,
    messages: [],
  };
}

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await sleep(20);
  }
  assert.fail("Timed out waiting for condition");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function testEnv() {
  return {
    NODE_ENV: "test",
    LAP_MEMORY_CONSOLIDATION_TEST_MODE: "1",
  };
}

function fingerprint(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 180);
}

class InMemoryMemoryRepository {
  constructor() {
    this.records = [];
    this.nextId = 1;
  }

  async listMemoriesByOwner({ userId, includeDisabled = false, limit = 100 }) {
    return this.records
      .filter((record) => record.userId === userId)
      .filter((record) => includeDisabled || record.enabled)
      .slice(0, limit)
      .map(cloneRecord);
  }

  async addMemory(input) {
    const now = new Date("2026-06-28T00:00:00.000Z");
    const metadata = { ...(input.metadata ?? {}) };
    const record = {
      id: `mem-${this.nextId++}`,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      memoryType: metadata.memoryType ?? "RETRIEVABLE",
      content: input.content,
      category: input.category ?? metadata.category ?? "other",
      source: input.source ?? metadata.source ?? "user_created",
      enabled: input.enabled !== false,
      importance: input.importance ?? 0,
      metadata: {
        category: input.category ?? metadata.category ?? "other",
        source: input.source ?? metadata.source ?? "user_created",
        enabled: input.enabled !== false,
        ...metadata,
      },
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return cloneRecord(record);
  }

  async addRawMemory(input) {
    return this.addMemory(input);
  }

  async toggleMemoryEnabled({ userId, memoryId, enabled }) {
    const record = this.records.find((item) => item.userId === userId && item.id === memoryId);
    if (!record) return null;
    record.enabled = enabled;
    record.metadata = { ...(record.metadata ?? {}), enabled };
    return cloneRecord(record);
  }

  async updateMemoryMetadata({ userId, memoryId, enabled, metadata }) {
    const record = this.records.find((item) => item.userId === userId && item.id === memoryId);
    if (!record) return null;
    if (typeof enabled === "boolean") {
      record.enabled = enabled;
    }
    record.metadata = {
      ...(record.metadata ?? {}),
      ...(metadata ?? {}),
      ...(typeof enabled === "boolean" ? { enabled } : {}),
    };
    return cloneRecord(record);
  }

  async deleteMemory({ userId, memoryId }) {
    const record = this.records.find((item) => item.userId === userId && item.id === memoryId);
    if (!record) return false;
    record.enabled = false;
    record.metadata = {
      ...(record.metadata ?? {}),
      enabled: false,
      lifecycleStatus: "deleted",
      tombstone: { contentFingerprint: fingerprint(record.content) },
    };
    record.content = "Deleted long-term memory. Safe tombstone retained.";
    return true;
  }
}

function cloneRecord(record) {
  return {
    ...record,
    metadata: record.metadata ? JSON.parse(JSON.stringify(record.metadata)) : null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function createDeleteFakePrisma() {
  const existing = {
    id: "mem-a",
    userId: "user-a",
    sessionId: null,
    sourceMessageId: null,
    memoryType: "RETRIEVABLE",
    content: "Sensitive preference to delete",
    importance: 0.8,
    metadata: {
      category: "preference",
      source: "assistant_suggested",
      enabled: true,
      lifecycleStatus: "active",
    },
    createdAt: new Date("2026-06-28T00:00:00.000Z"),
    updatedAt: new Date("2026-06-28T00:00:00.000Z"),
  };
  const fake = {
    deletedIds: [],
    updated: [],
    memoryItem: {
      findFirst: async () => existing,
      delete: async ({ where }) => {
        fake.deletedIds.push(where.id);
      },
      update: async (input) => {
        const updated = { ...existing, ...input.data, updatedAt: new Date("2026-06-28T00:00:01.000Z") };
        Object.assign(existing, updated);
        fake.updated.push(input);
        return updated;
      },
    },
  };
  return fake;
}
