/* global URL, process */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { config as loadDotenvConfig } from "dotenv";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DELETED_MEMORY_CONTENT_PLACEHOLDER =
  "Deleted long-term memory. Safe tombstone retained.";

loadLocalTestEnvironment();

test("A514 real Prisma memory integration gate covers owner aliases, tombstones, and consolidation dedupe", async (t) => {
  const guard = evaluateRealPrismaMemoryGate();
  if (!guard.allowed) {
    t.skip(`真实 Prisma 记忆集成测试已跳过：${guard.reasons.join("；")}`);
    return;
  }

  const prefix = buildTestPrefix();
  const externalUserId = `${prefix}_external_user`;
  const legacyAliasUserId = externalUserId;
  const legacyContent = "A514 legacy preview-owner memory remains readable.";
  const explicitContent = "A514 user prefers node:test integration gates.";
  const supersededContent = "A514 user uses Jest for legacy tests.";
  const replacementContent = "A514 user uses node:test for integration gates.";
  const conversationRoot = await mkdtemp(path.join(tmpdir(), "lap-a514-memory-"));

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaMemoryRepository } = await import(
    "../packages/db/src/repositories/memory-repository.ts"
  );
  const {
    FileAssistantConversationRepository,
  } = await import(
    "../apps/web/src/lib/assistant/assistant-conversation-repository.ts"
  );
  const {
    deleteAssistantMemory,
    listAssistantMemories,
    runAssistantMemoryConsolidationNow,
    upsertExplicitAssistantLongTermMemory,
  } = await import("../apps/web/src/lib/assistant/memory-service.ts");

  const prisma = new PrismaClient();
  const directRepo = new PrismaMemoryRepository(prisma);

  try {
    await cleanupPrismaTestData(prisma, prefix);

    await prisma.user.create({
      data: {
        id: legacyAliasUserId,
        authProvider: "a514-test-legacy",
        authProviderId: `${legacyAliasUserId}_legacy`,
        name: "A514 legacy alias user",
      },
    });
    await directRepo.addMemory({
      userId: legacyAliasUserId,
      content: legacyContent,
      category: "project",
      source: "assistant_suggested",
      enabled: true,
      importance: 0.7,
      metadata: {
        lifecycleStatus: "active",
        memoryKind: "background_consolidation",
        contentFingerprint: fingerprint(legacyContent),
      },
    });

    const explicit = await upsertExplicitAssistantLongTermMemory({
      userId: externalUserId,
      content: explicitContent,
      sourceConversationId: `${prefix}_conversation_explicit`,
      sourceMessageId: null,
      sourceExcerpt: explicitContent,
    });
    const owner = await prisma.user.findUnique({
      where: {
        authProvider_authProviderId: {
          authProvider: "dev-session",
          authProviderId: externalUserId,
        },
      },
    });
    assert.ok(owner, "service should create or reuse a real Prisma owner");
    assert.notEqual(
      owner.id,
      legacyAliasUserId,
      "mapped owner should stay distinct from legacy preview alias",
    );

    const aliasVisible = await listAssistantMemories(externalUserId, {
      includeInternal: true,
    });
    assert.ok(
      aliasVisible.some((memory) => memory.content === legacyContent),
      "service-level owner alias should read legacy preview-owner memories",
    );
    assert.ok(
      aliasVisible.some((memory) => memory.id === explicit.id),
      "service-level owner alias should read current mapped-owner memories",
    );

    assert.equal(
      await deleteAssistantMemory(externalUserId, explicit.id),
      true,
      "service delete should find mapped-owner memories through owner aliases",
    );
    const afterDelete = await directRepo.listMemoriesByOwner({
      userId: owner.id,
      includeDisabled: true,
      limit: 100,
    });
    const tombstone = afterDelete.find((memory) => memory.id === explicit.id);
    assert.ok(tombstone, "deleted long-term memory should remain as a tombstone");
    assert.equal(tombstone.content, DELETED_MEMORY_CONTENT_PLACEHOLDER);
    assert.equal(tombstone.enabled, false);
    assert.equal(tombstone.metadata.lifecycleStatus, "deleted");
    assert.equal(
      tombstone.metadata.tombstone.contentFingerprint,
      fingerprint(explicitContent),
    );

    const restartedRepo = new PrismaMemoryRepository(prisma);
    const afterRepoRestart = await restartedRepo.listMemoriesByOwner({
      userId: owner.id,
      includeDisabled: true,
      limit: 100,
    });
    assert.ok(
      afterRepoRestart.some((memory) => memory.id === explicit.id),
      "tombstone should remain visible through a new repository instance",
    );

    const conversationRepository = new FileAssistantConversationRepository({
      rootDir: conversationRoot,
    });
    const tombstoneConversationId = await createConversationWithTurns({
      repository: conversationRepository,
      userId: externalUserId,
      turns: [
        ["user", "Please remember that I prefer node:test integration gates."],
        ["assistant", "Noted."],
      ],
    });
    const tombstoneConsolidation = await runAssistantMemoryConsolidationNow({
      userId: externalUserId,
      conversationId: tombstoneConversationId,
      conversationRepository,
      provider: {
        kind: "a514-real-prisma-stub-provider",
        extractCandidates: async () => ({
          candidates: [{
            kind: "project_context",
            content: explicitContent,
            confidence: 0.95,
            reasonSummary: "Duplicate of a deleted tombstone.",
          }],
        }),
      },
      force: true,
      env: testEnv(),
    });
    assert.equal(tombstoneConsolidation.status, "succeeded");
    assert.equal(
      tombstoneConsolidation.memoriesCreated,
      0,
      "background consolidation should not resurrect deleted tombstones",
    );

    const active = await directRepo.addMemory({
      userId: owner.id,
      content: supersededContent,
      category: "project",
      source: "assistant_suggested",
      enabled: true,
      importance: 0.7,
      metadata: {
        lifecycleStatus: "active",
        memoryKind: "background_consolidation",
        contentFingerprint: fingerprint(supersededContent),
      },
    });
    const supersedeConversationId = await createConversationWithTurns({
      repository: conversationRepository,
      userId: externalUserId,
      turns: [
        ["user", "This repository moved from Jest to node:test."],
        ["assistant", "Understood."],
      ],
    });
    const supersedeConsolidation = await runAssistantMemoryConsolidationNow({
      userId: externalUserId,
      conversationId: supersedeConversationId,
      conversationRepository,
      provider: {
        kind: "a514-real-prisma-stub-provider",
        extractCandidates: async () => ({
          candidates: [{
            kind: "project_context",
            content: replacementContent,
            confidence: 0.96,
            action: "supersede",
            targetMemoryId: active.id,
            reasonSummary: "User confirmed the testing framework changed.",
          }],
        }),
      },
      force: true,
      env: testEnv(),
    });
    assert.equal(supersedeConsolidation.status, "succeeded");
    assert.equal(supersedeConsolidation.memoriesCreated, 1);
    assert.equal(supersedeConsolidation.memoriesSuperseded, 1);

    const afterSupersede = await directRepo.listMemoriesByOwner({
      userId: owner.id,
      includeDisabled: true,
      limit: 100,
    });
    const superseded = afterSupersede.find((memory) => memory.id === active.id);
    assert.equal(superseded?.enabled, false);
    assert.equal(superseded?.metadata.lifecycleStatus, "superseded");
    assert.ok(
      afterSupersede.some((memory) => memory.content === replacementContent),
      "supersede should write a replacement memory through real Prisma",
    );
  } finally {
    await cleanupPrismaTestData(prisma, prefix);
    await prisma.$disconnect();
    const dbPackage = await import("@learning-agent-platform/db").catch(() => null);
    if (dbPackage?.disconnectPrismaClient) {
      await dbPackage.disconnectPrismaClient().catch(() => undefined);
    }
  }
});

function loadLocalTestEnvironment() {
  const envPaths = [
    path.join(REPO_ROOT, "apps", "web", ".env.test"),
    path.join(REPO_ROOT, "apps", "web", ".env.local"),
    path.join(REPO_ROOT, "apps", "web", ".env"),
    path.join(REPO_ROOT, "packages", "db", ".env.test"),
    path.join(REPO_ROOT, "packages", "db", ".env.local"),
    path.join(REPO_ROOT, "packages", "db", ".env"),
    path.join(REPO_ROOT, ".env.test"),
    path.join(REPO_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      loadDotenvConfig({ path: envPath, override: false });
    }
  }
}

function evaluateRealPrismaMemoryGate() {
  const reasons = [];
  const databaseUrlState = readDatabaseUrlState();
  const allowRealDbTests =
    process.env.LAP_ALLOW_REAL_DB_TESTS === "1";
  const environmentName = process.env.NODE_ENV?.trim().toLowerCase() || "test";

  if (!allowRealDbTests) {
    reasons.push("未设置 LAP_ALLOW_REAL_DB_TESTS=1");
  }
  if (environmentName === "production") {
    reasons.push("NODE_ENV=production，禁止运行真实数据库测试");
  }
  if (!databaseUrlState.safe) {
    reasons.push(databaseUrlState.reason);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

function readDatabaseUrlState() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    return {
      safe: false,
      reason: "DATABASE_URL 未配置",
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return {
      safe: false,
      reason: "DATABASE_URL 格式无效",
    };
  }

  const normalizedHost = parsedUrl.hostname.trim().toLowerCase();
  const normalizedDatabaseUrl = databaseUrl.trim().toLowerCase();
  const productionHints = [
    "prod",
    "production",
    "live",
    "primary",
    "master",
  ];
  if (
    productionHints.some((hint) =>
      normalizedHost.includes(hint) || normalizedDatabaseUrl.includes(hint)
    )
  ) {
    return {
      safe: false,
      reason: "DATABASE_URL 看起来像生产库",
    };
  }

  const safeHints = [
    "localhost",
    "127.0.0.1",
    "::1",
    ".local",
    "local",
    "dev",
    "test",
    "ci",
    "docker",
    "postgres",
    "db",
  ];
  if (
    !safeHints.some((hint) =>
      normalizedHost.includes(hint) || normalizedDatabaseUrl.includes(hint)
    )
  ) {
    return {
      safe: false,
      reason: "DATABASE_URL 不能确认是本地或测试库",
    };
  }

  return {
    safe: true,
    reason: null,
  };
}

function buildTestPrefix() {
  return `lap_a514_memory_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
}

async function cleanupPrismaTestData(prisma, prefix) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { startsWith: prefix } },
        { authProviderId: { startsWith: prefix } },
      ],
    },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length === 0) {
    return;
  }

  await prisma.memoryItem.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
}

async function createConversationWithTurns(input) {
  let state = await input.repository.createConversation({
    userId: input.userId,
  });

  for (const [role, visibleContent] of input.turns) {
    state = await input.repository.appendMessage({
      userId: input.userId,
      conversationId: state.session.id,
      role,
      visibleContent,
    });
  }

  return state.session.id;
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
