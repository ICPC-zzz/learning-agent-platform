import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { config as loadDotenvConfig } from "dotenv";
import { PrismaClient } from "@prisma/client";

import {
  evaluateReadingProgressDbIntegrationGuard,
} from "../../../../../packages/db/src/reading-progress-db-integration-guard.ts";
import {
  previewReaderSyncRealServerAction,
} from "./reader-sync-real-server-action.server.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

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

function buildTestPrefix() {
  return `lap_a333_reader_sync_ui_dev_test_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
}

function buildFixtureIds(prefix) {
  return {
    userId: `${prefix}_user`,
    bookId: `${prefix}_book`,
    chapterId: `${prefix}_chapter`,
    progressId: `${prefix}_progress`,
  };
}

function buildDevTriggerInput(ids) {
  return {
    localProgress: {
      bookId: ids.bookId,
      chapterId: ids.chapterId,
      progressRatio: 1,
      idempotencyKeyPreview: `reader-sync-dev-trigger-preview:${ids.bookId}:${ids.chapterId}:1.000000`,
    },
  };
}

function assertSafeSerializedOutput(result) {
  const serialized = JSON.stringify(result);
  const needles = [
    "token-secret",
    "cookie-secret",
    "session-secret",
    "raw-db-secret",
    "metadata-secret",
    "DATABASE_URL",
    "password",
    "accessToken",
    "refreshToken",
  ];

  for (const needle of needles) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      `serialized result must not leak ${needle}`,
    );
  }
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
      // Cleanup must not hide the original failure.
    }
  }
}

const databaseUrlState = readDatabaseUrlState();
const skipReason = databaseUrlState.safe === true ? false : databaseUrlState.reason;

test(
  "reader dev trigger wrapper reaches the local/test DB path when all opt-ins are present",
  {
    skip: skipReason ?? false,
  },
  async function () {
    const prisma = new PrismaClient();
    const prefix = buildTestPrefix();
    const ids = buildFixtureIds(prefix);
    const previousEnv = {
      LAP_READER_SYNC_DEV_TRIGGER: process.env.LAP_READER_SYNC_DEV_TRIGGER,
      LAP_ALLOW_REAL_DB_INTEGRATION: process.env.LAP_ALLOW_REAL_DB_INTEGRATION,
      LAP_READER_PROGRESS_DB_TEST: process.env.LAP_READER_PROGRESS_DB_TEST,
      LAP_ACKNOWLEDGE_TEST_DB_ONLY: process.env.LAP_ACKNOWLEDGE_TEST_DB_ONLY,
      LAP_READER_SYNC_DEV_USER_EMAIL: process.env.LAP_READER_SYNC_DEV_USER_EMAIL,
      LAP_READER_SYNC_DEV_USER_NAME: process.env.LAP_READER_SYNC_DEV_USER_NAME,
      LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER: process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER,
      LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID: process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID,
      NODE_ENV: process.env.NODE_ENV,
    };

    const userEmail = `${prefix}@example.test`;
    const userName = "A333 Reader Sync UI Dev Test User";
    const authProvider = "lap-a333-reader-sync-ui-dev-test";
    const authProviderId = `${prefix}-auth-provider-id`;
    const initialProgressRatio = 0.25;

    try {
      process.env.LAP_READER_SYNC_DEV_TRIGGER = "true";
      process.env.LAP_ALLOW_REAL_DB_INTEGRATION = "true";
      process.env.LAP_READER_PROGRESS_DB_TEST = "true";
      process.env.LAP_ACKNOWLEDGE_TEST_DB_ONLY = "true";
      process.env.LAP_READER_SYNC_DEV_USER_EMAIL = userEmail;
      process.env.LAP_READER_SYNC_DEV_USER_NAME = userName;
      process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER = authProvider;
      process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID = authProviderId;
      process.env.NODE_ENV = previousEnv.NODE_ENV ?? "development";

      const guardPreview = evaluateReadingProgressDbIntegrationGuard({
        explicitUserAuthorization: true,
        allowRealDatabaseConnection: true,
        allowPrismaClientRuntime: true,
        allowDatabaseWrite: true,
        databaseUrlPresent: true,
        testDatabaseOnly: true,
        environmentName: process.env.NODE_ENV,
        allowLocalDevelopmentDatabase: true,
        acknowledgedNoProductionDatabase: true,
        destructiveWriteAllowed: false,
        migrationAllowed: false,
      });

      assert.equal(guardPreview.canRunDbIntegrationTest, true);

      await prisma.$connect();

      await prisma.user.create({
        data: {
          id: ids.userId,
          email: userEmail,
          name: userName,
          authProvider,
          authProviderId,
        },
      });

      await prisma.book.create({
        data: {
          id: ids.bookId,
          sourceType: "IMPORTED_TEXT",
          title: "A333 Reader Sync UI Dev Test Book",
          ownerId: ids.userId,
        },
      });

      await prisma.bookChapter.create({
        data: {
          id: ids.chapterId,
          bookId: ids.bookId,
          title: "A333 Reader Sync UI Dev Test Chapter",
          level: 1,
          orderIndex: 1,
        },
      });

      await prisma.readingProgress.create({
        data: {
          id: ids.progressId,
          userId: ids.userId,
          bookId: ids.bookId,
          chapterId: ids.chapterId,
          progressRatio: initialProgressRatio,
        },
      });

      const result = await previewReaderSyncRealServerAction(buildDevTriggerInput(ids));

      assert.equal(result.previewOnly, true);
      assert.equal(result.implemented, false);
      assert.equal(result.safeToExposeToClient, true);
      assert.equal(result.success, false);
      assert.equal(result.enabled, false);
      assert.equal(result.disabledByDefault, true);
      assert.equal(result.realSyncEnabled, false);
      assert.equal(result.explicitUserAuthorization, false);
      assert.equal(result.requiresAuthSession, true);
      assert.equal(result.requiresExplicitUserAuthorization, true);
      assert.equal(result.writesDatabase, false);
      assert.equal(result.callsRepository, false);
      assert.equal(result.status, "blocked");
      assert.equal(result.source, "test-dev-only");
      assert.equal(result.testOnly, true);
      assert.equal(result.devOnly, true);
      assert.equal(result.realDbIntegrationTest, true);
      assert.equal(result.executionAttempted, true);
      assert.equal(result.executionAllowed, true);
      assert.equal(result.executionSucceeded, true);
      assert.equal(result.executionMode, "test-dev-only-real-db");
      assert.equal(result.message, "本地开发同步测试完成");
      assert.equal(result.corePreview.status, "test_only_fake_preview");
      assert.equal(result.corePreview.testOnlyExecutionPreview.attempted, true);
      assert.equal(result.corePreview.testOnlyExecutionPreview.executed, true);
      assert.equal(result.corePreview.testOnlyExecutionPreview.success, true);
      assert.equal(result.corePreview.serviceResultPreview.status, "ready_preview");
      assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.executed, true);
      assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.success, true);
      assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.callsRepository, true);
      assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.writePreview.status, "preview");
      assert.equal(
        result.corePreview.serviceResultPreview.persistentAdapterPreview.writePreview.persistedRecordPreview.progressRatio,
        1,
      );
      assert.equal(result.serverContextStub.source, "trusted-server-context");
      assert.equal(result.serverContextStub.serverUserId, ids.userId);
      assert.equal(result.authSessionPreview.source, "test-only-mock");
      assert.equal(result.authSessionPreview.snapshot.serverUserId, ids.userId);

      const updatedRecord = await prisma.readingProgress.findUnique({
        where: {
          userId_bookId_chapterId: {
            userId: ids.userId,
            bookId: ids.bookId,
            chapterId: ids.chapterId,
          },
        },
      });

      assert.equal(updatedRecord.progressRatio, 1);
      assert.equal(updatedRecord.userId, ids.userId);
      assert.equal(updatedRecord.bookId, ids.bookId);
      assert.equal(updatedRecord.chapterId, ids.chapterId);
      assertSafeSerializedOutput(result);
    } finally {
      process.env.LAP_READER_SYNC_DEV_TRIGGER = previousEnv.LAP_READER_SYNC_DEV_TRIGGER;
      process.env.LAP_ALLOW_REAL_DB_INTEGRATION = previousEnv.LAP_ALLOW_REAL_DB_INTEGRATION;
      process.env.LAP_READER_PROGRESS_DB_TEST = previousEnv.LAP_READER_PROGRESS_DB_TEST;
      process.env.LAP_ACKNOWLEDGE_TEST_DB_ONLY = previousEnv.LAP_ACKNOWLEDGE_TEST_DB_ONLY;
      process.env.LAP_READER_SYNC_DEV_USER_EMAIL = previousEnv.LAP_READER_SYNC_DEV_USER_EMAIL;
      process.env.LAP_READER_SYNC_DEV_USER_NAME = previousEnv.LAP_READER_SYNC_DEV_USER_NAME;
      process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER = previousEnv.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER;
      process.env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID = previousEnv.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID;
      process.env.NODE_ENV = previousEnv.NODE_ENV;

      await cleanupFixture(prisma, {
        userId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressId: ids.progressId,
      });

      await prisma.$disconnect();
    }
  },
);
