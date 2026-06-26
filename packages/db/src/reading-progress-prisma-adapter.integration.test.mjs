import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { config as loadDotenvConfig } from "dotenv";
import { PrismaClient } from "@prisma/client";

import {
  evaluateReadingProgressDbIntegrationGuard,
} from "./reading-progress-db-integration-guard.ts";
import {
  createReadingProgressPrismaRepositoryAdapter,
} from "./reading-progress-prisma-adapter.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const REAL_DB_INTEGRATION_ENV = {
  allowRealDbIntegration: process.env.LAP_ALLOW_REAL_DB_INTEGRATION === "true",
  readerProgressDbTest: process.env.LAP_READER_PROGRESS_DB_TEST === "true",
  acknowledgeTestDbOnly: process.env.LAP_ACKNOWLEDGE_TEST_DB_ONLY === "true",
};

function loadLocalTestEnvironment() {
  const packageRoot = path.join(REPO_ROOT, "packages", "db");
  const envPaths = [
    path.join(packageRoot, ".env.test"),
    path.join(packageRoot, ".env.local"),
    path.join(packageRoot, ".env"),
    path.join(REPO_ROOT, ".env.test"),
    path.join(REPO_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    loadDotenvConfig({
      path: envPath,
      override: false,
    });
  }
}

loadLocalTestEnvironment();

function readDatabaseUrlState() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    return {
      present: false,
      safe: false,
      reason: "DATABASE_URL is not configured.",
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    return {
      present: true,
      safe: false,
      reason: "DATABASE_URL is not a valid URL.",
    };
  }

  const normalizedHost = parsedUrl.hostname.trim().toLowerCase();
  const normalizedDatabaseUrl = databaseUrl.trim().toLowerCase();

  if (
    normalizedHost.includes("prod") ||
    normalizedHost.includes("production") ||
    normalizedHost.includes("live") ||
    normalizedHost.includes("primary") ||
    normalizedHost.includes("master") ||
    normalizedHost.includes("main") ||
    normalizedDatabaseUrl.includes("prod") ||
    normalizedDatabaseUrl.includes("production")
  ) {
    return {
      present: true,
      safe: false,
      reason: "DATABASE_URL looks production-like, so the real DB test was skipped.",
    };
  }

  const safeHostHints = [
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
  const looksLocal = safeHostHints.some(function (hint) {
    return normalizedHost.includes(hint) || normalizedDatabaseUrl.includes(hint);
  });

  if (!looksLocal) {
    return {
      present: true,
      safe: false,
      reason: "DATABASE_URL is not clearly local or test-only.",
    };
  }

  return {
    present: true,
    safe: true,
    reason: null,
  };
}

function buildGuardInput() {
  const environmentName = process.env.NODE_ENV?.trim() || "test";
  const databaseUrlState = readDatabaseUrlState();
  const allowRealDbIntegration = REAL_DB_INTEGRATION_ENV.allowRealDbIntegration === true;
  const readerProgressDbTest = REAL_DB_INTEGRATION_ENV.readerProgressDbTest === true;
  const acknowledgeTestDbOnly = REAL_DB_INTEGRATION_ENV.acknowledgeTestDbOnly === true;
  const allowLocalDevelopmentDatabase =
    databaseUrlState.safe === true &&
    environmentName.toLowerCase() !== "production";

  return {
    environmentName,
    databaseUrlState,
    guardInput: {
      explicitUserAuthorization: allowRealDbIntegration,
      allowRealDatabaseConnection: allowRealDbIntegration,
      allowPrismaClientRuntime: allowRealDbIntegration,
      allowDatabaseWrite: allowRealDbIntegration,
      databaseUrlPresent: databaseUrlState.present,
      testDatabaseOnly: readerProgressDbTest,
      environmentName,
      allowLocalDevelopmentDatabase,
      acknowledgedNoProductionDatabase: acknowledgeTestDbOnly,
      destructiveWriteAllowed: false,
      migrationAllowed: false,
    },
  };
}

function buildTestPrefix() {
  return `lap_a318_reader_sync_test_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
}

function buildFixtureIds(prefix) {
  return {
    userId: `${prefix}_user`,
    bookId: `${prefix}_book`,
    chapterId: `${prefix}_chapter`,
    progressId: `${prefix}_progress`,
  };
}

async function cleanupFixture(prisma, ids) {
  const attempts = [
    async function () {
      if (ids.progressId !== null) {
        await prisma.readingProgress.deleteMany({
          where: {
            id: ids.progressId,
          },
        });
      }
    },
    async function () {
      await prisma.bookChapter.deleteMany({
        where: {
          id: ids.chapterId,
        },
      });
    },
    async function () {
      await prisma.book.deleteMany({
        where: {
          id: ids.bookId,
        },
      });
    },
    async function () {
      await prisma.user.deleteMany({
        where: {
          id: ids.userId,
        },
      });
    },
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
    } catch {
      // Cleanup should not hide the original test failure.
    }
  }
}

function assertSafeSerializedOutput(result) {
  const serialized = JSON.stringify(result);

  assert.equal(serialized.indexOf('"token"'), -1);
  assert.equal(serialized.indexOf('"session"'), -1);
  assert.equal(serialized.indexOf('"secret"'), -1);
  assert.equal(serialized.indexOf('"rawDbRecord"'), -1);
}

const guardContext = buildGuardInput();
const guardPreview = evaluateReadingProgressDbIntegrationGuard(guardContext.guardInput);
const realDbIntegrationCanRun = guardPreview.canRunDbIntegrationTest === true;
const realDbIntegrationSkipReason = realDbIntegrationCanRun
  ? null
  : [
      "Real DB integration is opt-in only.",
      "Set LAP_ALLOW_REAL_DB_INTEGRATION=true, LAP_READER_PROGRESS_DB_TEST=true, and LAP_ACKNOWLEDGE_TEST_DB_ONLY=true.",
      "Use a local or test-only DATABASE_URL.",
      guardContext.databaseUrlState.reason,
      ...guardPreview.blockedReasons,
    ]
      .filter(Boolean)
      .join(" ");

test("guard stays blocked by default unless every opt-in condition is present", function () {
  if (realDbIntegrationCanRun) {
    assert.equal(guardPreview.status, "preview");
    assert.equal(guardPreview.mustSkipByDefault, false);
    assert.equal(guardPreview.canConnectRealDatabase, true);
    assert.equal(guardPreview.canWriteDatabase, true);
    return;
  }

  assert.equal(guardPreview.status, "blocked");
  assert.equal(guardPreview.mustSkipByDefault, true);
  assert.equal(guardPreview.canRunDbIntegrationTest, false);
  assert.equal(guardPreview.canConnectRealDatabase, false);
  assert.equal(guardPreview.canWriteDatabase, false);
  assert.ok(guardPreview.blockedReasons.length > 0);
});

test(
  "real ReadingProgress Prisma adapter integration runs only on an explicit local/test DB opt-in",
  {
    skip: realDbIntegrationSkipReason ?? false,
  },
  async function () {
    const prisma = new PrismaClient();
    const adapter = createReadingProgressPrismaRepositoryAdapter(prisma);
    const prefix = buildTestPrefix();
    const ids = buildFixtureIds(prefix);
    let createdProgressId = null;

    try {
      await prisma.$connect();

      await prisma.user.create({
        data: {
          id: ids.userId,
          email: `${prefix}@example.test`,
          name: "A318 Reader Sync Test User",
        },
      });

      await prisma.book.create({
        data: {
          id: ids.bookId,
          sourceType: "IMPORTED_TEXT",
          title: "A318 Reader Sync Test Book",
          ownerId: ids.userId,
        },
      });

      await prisma.bookChapter.create({
        data: {
          id: ids.chapterId,
          bookId: ids.bookId,
          title: "A318 Reader Sync Test Chapter",
          level: 1,
          orderIndex: 1,
        },
      });

      const createdProgress = await prisma.readingProgress.create({
        data: {
          id: ids.progressId,
          userId: ids.userId,
          bookId: ids.bookId,
          chapterId: ids.chapterId,
          progressRatio: 0.25,
        },
      });
      createdProgressId = createdProgress.id;

      const foundBefore = await adapter.findByUserBookChapter({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
      });

      assert.equal(foundBefore.status, "found");
      assert.equal(foundBefore.readsDatabase, true);
      assert.equal(foundBefore.writesDatabase, false);
      assert.equal(foundBefore.identity.serverUserId, ids.userId);
      assert.equal(foundBefore.recordPreview.serverUserId, ids.userId);
      assert.equal(foundBefore.recordPreview.bookId, ids.bookId);
      assert.equal(foundBefore.recordPreview.chapterId, ids.chapterId);
      assert.equal(foundBefore.recordPreview.progressRatio, 0.25);
      assert.equal(foundBefore.recordPreview.safeToExposeToClient, false);
      assert.equal(Object.getPrototypeOf(foundBefore.recordPreview), Object.prototype);

      const upserted = await adapter.upsertProgress({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressRatio: 0.85,
      });

      assert.equal(upserted.status, "upserted");
      assert.equal(upserted.readsDatabase, true);
      assert.equal(upserted.writesDatabase, true);
      assert.equal(upserted.recordPreview.serverUserId, ids.userId);
      assert.equal(upserted.recordPreview.bookId, ids.bookId);
      assert.equal(upserted.recordPreview.chapterId, ids.chapterId);
      assert.equal(upserted.recordPreview.progressRatio, 0.85);
      assert.equal(upserted.recordPreview.safeToExposeToClient, false);
      assert.equal(Object.getPrototypeOf(upserted.recordPreview), Object.prototype);

      const rereadAfterUpsert = await adapter.findByUserBookChapter({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
      });

      assert.equal(rereadAfterUpsert.status, "found");
      assert.equal(rereadAfterUpsert.recordPreview.progressRatio, 0.85);

      const regressionAttempt = await adapter.upsertProgress({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressRatio: 0.5,
      });

      assert.equal(regressionAttempt.status, "conflict");
      assert.equal(regressionAttempt.writesDatabase, false);
      assert.equal(regressionAttempt.recordPreview, null);
      assert.ok(
        regressionAttempt.blockers.some(function (blocker) {
          return blocker.code === "STALE_PROGRESS_REGRESSION";
        }),
      );

      const finalRead = await adapter.findByUserBookChapter({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
      });

      assert.equal(finalRead.status, "found");
      assert.equal(finalRead.recordPreview.progressRatio, 0.85);
      assertSafeSerializedOutput({
        foundBefore,
        upserted,
        regressionAttempt,
        finalRead,
      });
    } finally {
      await cleanupFixture(prisma, {
        userId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressId: createdProgressId,
      });

      await prisma.$disconnect();
    }
  },
);
