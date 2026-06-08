import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { config as loadDotenvConfig } from "dotenv";
import { PrismaClient } from "@prisma/client";

import {
  evaluateReadingProgressDbIntegrationGuard,
} from "../../../../../packages/db/src/reading-progress-db-integration-guard.ts";
import {
  buildReaderSyncRealServerActionCoreResult,
} from "./reader-sync-real-server-action-core.ts";
import {
  createReaderSyncPersistentRepositoryAdapter,
} from "./reader-sync-persistent-repository-adapter.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const REAL_ADAPTER_MODULE_URL = new URL(
  "../../../../../packages/db/src/reading-progress-prisma-adapter.ts",
  import.meta.url,
).href;

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
  return `lap_a323_reader_sync_action_test_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
}

function buildFixtureIds(prefix) {
  return {
    userId: `${prefix}_user`,
    bookId: `${prefix}_book`,
    chapterId: `${prefix}_chapter`,
    progressId: `${prefix}_progress`,
  };
}

function makeTrustedAuthSessionStub(prefix) {
  return {
    verified: true,
    sessionSource: "trusted-server-stub",
    sessionIdPreview: `${prefix}_session_preview`,
  };
}

function makeTrustedServerContext(ids, prefix) {
  return {
    serverUserId: ids.userId,
    hasAuthenticatedUser: true,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
    authSessionStub: makeTrustedAuthSessionStub(prefix),
  };
}

function makeLocalProgress(overrides) {
  const o = overrides || {};
  return Object.assign(
    {
      bookId: "book-123",
      chapterId: "chapter-456",
      progressRatio: 0.72,
      idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.720000",
    },
    o,
  );
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

function assertSafeSerializedOutput(result) {
  const serialized = JSON.stringify(result);
  const needles = [
    "token-secret",
    "cookie-secret",
    "session-secret",
    "raw-db-secret",
    "metadata-secret",
    "constructor-secret",
    "prototype-secret",
    "DATABASE_URL",
  ];

  for (const needle of needles) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      `serialized result must not leak ${needle}`,
    );
  }
}

function createChildProcessActionRunner(action, input) {
  const script = `
    import { readFileSync } from "node:fs";
    import { PrismaClient } from "@prisma/client";
    import { createReadingProgressPrismaRepositoryAdapter } from ${JSON.stringify(
      REAL_ADAPTER_MODULE_URL,
    )};

    const payload = JSON.parse(readFileSync(0, "utf8"));
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();
      const adapter = createReadingProgressPrismaRepositoryAdapter(prisma);
      let result;

      switch (payload.action) {
        case "find":
          result = await adapter.findByUserBookChapter(payload.input);
          break;
        case "upsert":
          result = await adapter.upsertProgress(payload.input);
          break;
        case "audit":
          result = adapter.previewAudit(payload.input);
          break;
        case "idempotency":
          result = adapter.previewIdempotency(payload.input);
          break;
        default:
          throw new Error("Unsupported child process action.");
      }

      process.stdout.write(JSON.stringify({ ok: true, result }));
    } catch {
      process.stdout.write(
        JSON.stringify({
          ok: false,
          error: {
            code: "CHILD_DB_ACTION_FAILED",
            message: "Real DB adapter action failed safely.",
          },
        }),
      );
    } finally {
      try {
        await prisma.$disconnect();
      } catch {
        // Ignore disconnect errors in the child process.
      }
    }
  `;

  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: REPO_ROOT,
      env: process.env,
      input: JSON.stringify({ action, input }),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const parsed = JSON.parse(output);
  if (!parsed.ok) {
    throw new Error("Real DB adapter action failed safely.");
  }

  return parsed.result;
}

function mapDbFindResultToWebPreview(result) {
  if (result.status !== "found" || result.recordPreview === null) {
    return null;
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: "existing",
    bookId: result.recordPreview.bookId,
    chapterId: result.recordPreview.chapterId,
    progressRatio: result.recordPreview.progressRatio,
    lastChunkId: result.recordPreview.lastChunkId ?? null,
    completedAt: result.recordPreview.completedAt ?? null,
    updatedAt: result.recordPreview.updatedAt ?? null,
  };
}

function mapDbUpsertResultToWebPreview(result) {
  if (result.status !== "upserted" || result.recordPreview === null) {
    throw new Error(
      "Injected Prisma-compatible adapter did not complete the preview write path.",
    );
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: "upserted",
    bookId: result.recordPreview.bookId,
    chapterId: result.recordPreview.chapterId,
    progressRatio: result.recordPreview.progressRatio,
    lastChunkId: result.recordPreview.lastChunkId ?? null,
    completedAt: result.recordPreview.completedAt ?? null,
    updatedAt: result.recordPreview.updatedAt ?? null,
  };
}

function makeAllowedAdapterOptions() {
  return {
    previewOnly: true,
    allowDatabaseWrite: true,
    allowRepositoryCall: true,
    explicitUserAuthorization: true,
    readinessGatePassed: true,
    auditReady: true,
    idempotencyReady: true,
    conflictResolutionReady: true,
    disabled: false,
  };
}

function createRealDbBridge(ids, trace) {
  return {
    findProgressByUserBookChapter(input) {
      trace.push(["read", input]);
      return mapDbFindResultToWebPreview(
        createChildProcessActionRunner("find", {
          serverUserId: ids.userId,
          bookId: ids.bookId,
          chapterId: ids.chapterId,
        }),
      );
    },
    upsertProgress(input) {
      trace.push(["upsert", input]);
      return mapDbUpsertResultToWebPreview(
        createChildProcessActionRunner("upsert", {
          serverUserId: ids.userId,
          bookId: ids.bookId,
          chapterId: ids.chapterId,
          progressRatio: input.progressRatio,
          idempotencyKeyPreview: input.idempotencyKeyPreview ?? null,
          lastChunkId: input.lastChunkId ?? null,
        }),
      );
    },
    recordAuditLog(input) {
      trace.push(["audit", input]);
      const preview = createChildProcessActionRunner("audit", {
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressRatio: input.progressRatio,
        idempotencyKeyPreview: input.idempotencyKeyPreview ?? null,
      });

      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: preview.status,
        persisted: false,
        auditId: preview.auditId,
        action: "reader.progress.sync.repository.audit-log",
        source: preview.source,
        message:
          preview.status === "preview"
            ? "Audit preview bridged from the real Prisma-compatible adapter."
            : "Audit preview blocked by the real Prisma-compatible adapter.",
        blockers: preview.blockers.slice(),
        warnings: preview.warnings.slice(),
      };
    },
    claimIdempotencyKey(input) {
      trace.push(["idempotency", input]);
      const preview = createChildProcessActionRunner("idempotency", {
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
        progressRatio: input.progressRatio,
        idempotencyKeyPreview: input.idempotencyKeyPreview ?? null,
      });

      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: preview.status,
        persisted: false,
        previewKey: preview.previewKey,
        action: "reader.progress.sync.repository.idempotency-claim",
        source: preview.source,
        message:
          preview.status === "preview"
            ? "Idempotency preview bridged from the real Prisma-compatible adapter."
            : "Idempotency preview blocked by the real Prisma-compatible adapter.",
        blockers: preview.blockers.slice(),
        warnings: preview.warnings.slice(),
      };
    },
  };
}

function makeRealDbHarness(ids, trace) {
  const webAdapter = createReaderSyncPersistentRepositoryAdapter(
    createRealDbBridge(ids, trace),
    makeAllowedAdapterOptions(),
  );

  return {
    webAdapter,
  };
}

function makeCoreInput(ids, prefix, progressRatio, repositoryAdapter) {
  return {
    localProgress: makeLocalProgress({
      bookId: ids.bookId,
      chapterId: ids.chapterId,
      progressRatio,
      idempotencyKeyPreview:
        `reader-sync-preview:${ids.bookId}:${ids.chapterId}:${progressRatio.toFixed(6)}`,
    }),
    serverContext: makeTrustedServerContext(ids, prefix),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter,
  };
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
  "real ReaderSync server action core integration runs only on an explicit local/test DB opt-in",
  {
    skip: realDbIntegrationSkipReason ?? false,
  },
  async function () {
    const prisma = new PrismaClient();
    const prefix = buildTestPrefix();
    const ids = buildFixtureIds(prefix);
    const trace = [];
    const harness = makeRealDbHarness(ids, trace);
    const initialProgressRatio = 0.4;
    const incomingProgressRatio = 0.72;
    const regressionProgressRatio = 0.5;
    let createdProgressId = null;

    try {
      await prisma.$connect();

      await prisma.user.create({
        data: {
          id: ids.userId,
          email: `${prefix}@example.test`,
          name: "A323 Reader Sync Test User",
        },
      });

      await prisma.book.create({
        data: {
          id: ids.bookId,
          sourceType: "IMPORTED_TEXT",
          title: "A323 Reader Sync Test Book",
          ownerId: ids.userId,
        },
      });

      await prisma.bookChapter.create({
        data: {
          id: ids.chapterId,
          bookId: ids.bookId,
          title: "A323 Reader Sync Test Chapter",
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
          progressRatio: initialProgressRatio,
        },
      });
      createdProgressId = createdProgress.id;

      const firstResult = buildReaderSyncRealServerActionCoreResult(
        makeCoreInput(ids, prefix, incomingProgressRatio, harness.webAdapter),
      );

      assert.equal(firstResult.previewOnly, true);
      assert.equal(firstResult.implemented, false);
      assert.equal(firstResult.actionDraft, true);
      assert.equal(firstResult.enabled, false);
      assert.equal(firstResult.disabledByDefault, true);
      assert.equal(firstResult.success, false);
      assert.equal(firstResult.safeToExposeToClient, true);
      assert.equal(firstResult.status, "test_only_fake_preview");
      assert.equal(firstResult.source, "test-only-fake");
      assert.equal(firstResult.guardPreview.canUseTestOnlyFakePath, true);
      assert.equal(firstResult.guardPreview.disabledByDefault, true);
      assert.equal(firstResult.guardPreview.realSyncEnabled, true);
      assert.equal(firstResult.guardPreview.dbIntegrationAllowed, true);
      assert.equal(firstResult.guardPreview.authSessionVerified, true);
      assert.equal(firstResult.serverContextPreview.serverUserId, ids.userId);
      assert.equal(firstResult.serverContextPreview.authSessionStub.verified, true);
      assert.equal(firstResult.localProgressPreview.bookId, ids.bookId);
      assert.equal(firstResult.localProgressPreview.chapterId, ids.chapterId);
      assert.equal(firstResult.localProgressPreview.progressRatio, incomingProgressRatio);
      assert.equal(firstResult.repositoryAdapterPreview.accepted, true);
      assert.equal(firstResult.repositoryAdapterPreview.mode, "fake");
      assert.equal(firstResult.decisionPreview.status, "ready_preview");
      assert.equal(firstResult.serviceResultPreview.status, "ready_preview");
      assert.equal(firstResult.serviceResultPreview.fakeWriteAttempted, true);
      assert.equal(firstResult.serviceResultPreview.fakeWriteApplied, true);
      assert.equal(firstResult.serviceResultPreview.callsRepository, false);
      assert.equal(firstResult.serviceResultPreview.writesDatabase, false);
      assert.equal(firstResult.serviceResultPreview.persistentAdapterPreview.status, "preview");
      assert.equal(firstResult.serviceResultPreview.persistentAdapterPreview.executed, true);
      assert.equal(firstResult.serviceResultPreview.persistentAdapterPreview.success, true);
      assert.equal(firstResult.serviceResultPreview.persistentAdapterPreview.callsRepository, true);
      assert.equal(firstResult.serviceResultPreview.persistentAdapterPreview.writePreview.status, "preview");
      assert.equal(
        firstResult.serviceResultPreview.persistentAdapterPreview.writePreview.persistedRecordPreview.progressRatio,
        incomingProgressRatio,
      );
      assert.equal(
        firstResult.serviceResultPreview.persistentAdapterPreview.writePreview.persistedRecordPreview.safeToExposeToClient,
        true,
      );
      assert.equal(firstResult.testOnlyExecutionPreview.attempted, true);
      assert.equal(firstResult.testOnlyExecutionPreview.executed, true);
      assert.equal(firstResult.testOnlyExecutionPreview.success, true);
      assert.equal(firstResult.testOnlyExecutionPreview.callsRepository, true);
      assert.equal(firstResult.testOnlyExecutionPreview.writesDatabase, false);
      assert.equal(trace.length, 4);
      assert.equal(trace[0][0], "read");
      assert.equal(trace[1][0], "idempotency");
      assert.equal(trace[2][0], "audit");
      assert.equal(trace[3][0], "upsert");
      assertSafeSerializedOutput(firstResult);

      const updatedRecordAfterFirstRun = await prisma.readingProgress.findUnique({
        where: {
          userId_bookId_chapterId: {
            userId: ids.userId,
            bookId: ids.bookId,
            chapterId: ids.chapterId,
          },
        },
      });

      assert.equal(updatedRecordAfterFirstRun.progressRatio, incomingProgressRatio);
      assert.equal(updatedRecordAfterFirstRun.userId, ids.userId);
      assert.equal(updatedRecordAfterFirstRun.bookId, ids.bookId);
      assert.equal(updatedRecordAfterFirstRun.chapterId, ids.chapterId);

      const traceLengthBeforeRegression = trace.length;
      const regressionResult = buildReaderSyncRealServerActionCoreResult(
        makeCoreInput(ids, prefix, regressionProgressRatio, harness.webAdapter),
      );

      assert.equal(regressionResult.previewOnly, true);
      assert.equal(regressionResult.implemented, false);
      assert.equal(regressionResult.actionDraft, true);
      assert.equal(regressionResult.enabled, false);
      assert.equal(regressionResult.disabledByDefault, true);
      assert.equal(regressionResult.success, false);
      assert.equal(regressionResult.status, "test_only_fake_preview");
      assert.equal(regressionResult.source, "test-only-fake");
      assert.equal(regressionResult.decisionPreview.status, "ready_preview");
      assert.equal(regressionResult.serviceResultPreview.status, "ready_preview");
      assert.equal(regressionResult.serviceResultPreview.fakeWriteAttempted, true);
      assert.equal(regressionResult.serviceResultPreview.fakeWriteApplied, false);
      assert.equal(regressionResult.serviceResultPreview.persistentAdapterPreview.status, "conflict");
      assert.equal(regressionResult.serviceResultPreview.persistentAdapterPreview.executed, false);
      assert.equal(regressionResult.serviceResultPreview.persistentAdapterPreview.success, false);
      assert.equal(regressionResult.serviceResultPreview.persistentAdapterPreview.callsRepository, true);
      assert.equal(regressionResult.serviceResultPreview.persistentAdapterPreview.writePreview.status, "conflict");
      assert.equal(
        regressionResult.serviceResultPreview.persistentAdapterPreview.writePreview.persistedRecordPreview,
        null,
      );
      assert.equal(regressionResult.testOnlyExecutionPreview.attempted, true);
      assert.equal(regressionResult.testOnlyExecutionPreview.executed, false);
      assert.equal(regressionResult.testOnlyExecutionPreview.success, false);
      assert.equal(trace.length - traceLengthBeforeRegression, 1);
      assert.equal(trace[traceLengthBeforeRegression][0], "read");
      assertSafeSerializedOutput(regressionResult);

      const updatedRecordAfterRegression = await prisma.readingProgress.findUnique({
        where: {
          userId_bookId_chapterId: {
            userId: ids.userId,
            bookId: ids.bookId,
            chapterId: ids.chapterId,
          },
        },
      });

      assert.equal(updatedRecordAfterRegression.progressRatio, incomingProgressRatio);
      assert.equal(updatedRecordAfterRegression.userId, ids.userId);
      assert.equal(updatedRecordAfterRegression.bookId, ids.bookId);
      assert.equal(updatedRecordAfterRegression.chapterId, ids.chapterId);
      assertSafeSerializedOutput({
        firstResult,
        regressionResult,
        updatedRecordAfterFirstRun,
        updatedRecordAfterRegression,
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
