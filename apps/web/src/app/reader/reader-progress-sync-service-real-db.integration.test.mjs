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
  createReadingProgressPrismaRepositoryAdapter,
} from "../../../../../packages/db/src/reading-progress-prisma-adapter.ts";
import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";

const REAL_DB_INTEGRATION_ENV = {
  allowRealDbIntegration: process.env.LAP_ALLOW_REAL_DB_INTEGRATION === "true",
  readerProgressDbTest: process.env.LAP_READER_PROGRESS_DB_TEST === "true",
  acknowledgeTestDbOnly: process.env.LAP_ACKNOWLEDGE_TEST_DB_ONLY === "true",
};

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const REAL_ADAPTER_MODULE_URL = new URL(
  "../../../../../packages/db/src/reading-progress-prisma-adapter.ts",
  import.meta.url,
).href;

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
  return `lap_a320_reader_progress_service_test_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
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
      // Cleanup must not hide the original failure.
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

function makeDecision(overrides) {
  const o = overrides || {};
  return buildReaderProgressSyncDecision({
    serverContext: Object.assign(
      {
        hasAuthenticatedUser: true,
        serverUserId: "server-user-123",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      o.serverContext || {},
    ),
    payload: Object.assign(
      {
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.72,
        idempotencyKeyPreview:
          "reader-sync-preview:book-123:chapter-456:0.720000",
      },
      o.payload || {},
    ),
    existingProgress: o.existingProgress,
    options: o.options,
  });
}

function makeServiceInput(overrides) {
  const o = overrides || {};
  return {
    decision: o.decision,
    requestPreview: o.requestPreview,
    options: Object.assign(
      {
        previewOnly: true,
      },
      o.options || {},
    ),
  };
}

function makeAllowedAdapterOptions(overrides) {
  return Object.assign(
    {
      previewOnly: true,
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    },
    overrides || {},
  );
}

function makePollutedRequestPreview(overrides) {
  const o = overrides || {};
  const requestPreview = Object.create(null);

  requestPreview.bookId = o.bookId !== undefined ? o.bookId : "book-123";
  requestPreview.chapterId =
    o.chapterId !== undefined ? o.chapterId : "chapter-456";
  requestPreview.progressRatio =
    o.progressRatio !== undefined ? o.progressRatio : 0.72;
  requestPreview.idempotencyKeyPreview =
    o.idempotencyKeyPreview !== undefined
      ? o.idempotencyKeyPreview
      : "reader-sync-preview:book-123:chapter-456:0.720000";
  requestPreview.token = "token-secret";
  requestPreview.session = { id: "session-secret" };
  requestPreview.rawDbRecord = { secret: "raw-db-secret" };
  requestPreview.metadata = { secret: "metadata-secret" };
  Object.defineProperty(requestPreview, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });

  return requestPreview;
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

function createRealDbBridge(
  fixtureServerUserId,
  fixtureBookId,
  fixtureChapterId,
) {
  return {
    findProgressByUserBookChapter(input) {
      return mapDbFindResultToWebPreview(
        createChildProcessActionRunner("find", {
          serverUserId: fixtureServerUserId,
          bookId: fixtureBookId,
          chapterId: fixtureChapterId,
        }),
      );
    },
    upsertProgress(input) {
      return mapDbUpsertResultToWebPreview(
        createChildProcessActionRunner("upsert", {
          serverUserId: fixtureServerUserId,
          bookId: fixtureBookId,
          chapterId: fixtureChapterId,
          progressRatio: input.progressRatio,
          idempotencyKeyPreview: input.idempotencyKeyPreview ?? null,
          lastChunkId: input.lastChunkId ?? null,
        }),
      );
    },
    recordAuditLog(input) {
      const preview = createChildProcessActionRunner("audit", {
        serverUserId: fixtureServerUserId,
        bookId: fixtureBookId,
        chapterId: fixtureChapterId,
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
      const preview = createChildProcessActionRunner("idempotency", {
        serverUserId: fixtureServerUserId,
        bookId: fixtureBookId,
        chapterId: fixtureChapterId,
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

function makeRealDbHarness(prisma, ids) {
  return {
    prisma: prisma,
    dbAdapter: createReadingProgressPrismaRepositoryAdapter(prisma),
    webAdapter: createReaderSyncPersistentRepositoryAdapter(
      createRealDbBridge(ids.userId, ids.bookId, ids.chapterId),
      makeAllowedAdapterOptions(),
    ),
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
  "real ReaderProgress sync service integration runs only on an explicit local/test DB opt-in",
  {
    skip: realDbIntegrationSkipReason ?? false,
  },
  async function () {
    const prisma = new PrismaClient();
    const prefix = buildTestPrefix();
    const ids = buildFixtureIds(prefix);
    const harness = makeRealDbHarness(prisma, ids);
    const initialProgressRatio = 0.4;
    const incomingProgressRatio = 0.72;
    const regressionProgressRatio = 0.5;
    const safeRequestPreview = makePollutedRequestPreview({
      progressRatio: incomingProgressRatio,
      idempotencyKeyPreview:
        "reader-sync-preview:book-123:chapter-456:0.720000",
    });
    const regressionRequestPreview = makePollutedRequestPreview({
      progressRatio: regressionProgressRatio,
      idempotencyKeyPreview:
        "reader-sync-preview:book-123:chapter-456:0.500000",
    });
    let createdProgressId = null;

    try {
      await prisma.$connect();

      await prisma.user.create({
        data: {
          id: ids.userId,
          email: `${prefix}@example.test`,
          name: "A320 Reader Sync Test User",
        },
      });

      await prisma.book.create({
        data: {
          id: ids.bookId,
          sourceType: "IMPORTED_TEXT",
          title: "A320 Reader Sync Test Book",
          ownerId: ids.userId,
        },
      });

      await prisma.bookChapter.create({
        data: {
          id: ids.chapterId,
          bookId: ids.bookId,
          title: "A320 Reader Sync Test Chapter",
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

      const serviceResult = buildReaderProgressSyncServiceResult(
        makeServiceInput({
          decision: makeDecision({
            existingProgress: {
              progressRatio: initialProgressRatio,
            },
          }),
          requestPreview: safeRequestPreview,
          options: {
            previewOnly: true,
            persistentAdapter: harness.webAdapter,
          },
        }),
      );

      assert.equal(serviceResult.previewOnly, true);
      assert.equal(serviceResult.status, "ready_preview");
      assert.equal(serviceResult.fakeWriteAttempted, true);
      assert.equal(serviceResult.fakeWriteApplied, true);
      assert.equal(serviceResult.persistentAdapterPreview.status, "preview");
      assert.equal(serviceResult.persistentAdapterPreview.source, "preview");
      assert.equal(serviceResult.persistentAdapterPreview.executed, true);
      assert.equal(serviceResult.persistentAdapterPreview.success, true);
      assert.equal(serviceResult.persistentAdapterPreview.callsRepository, true);
      assert.equal(serviceResult.persistentAdapterPreview.readPreview.status, "found");
      assert.equal(
        serviceResult.persistentAdapterPreview.readPreview.recordPreview.progressRatio,
        initialProgressRatio,
      );
      assert.equal(serviceResult.persistentAdapterPreview.writePreview.status, "preview");
      assert.equal(
        serviceResult.persistentAdapterPreview.writePreview.persistedRecordPreview.progressRatio,
        incomingProgressRatio,
      );
      assert.equal(serviceResult.persistentAdapterPreview.writePreview.persistedRecordPreview.safeToExposeToClient, true);
      assert.equal(serviceResult.callsRepository, false);
      assert.equal(serviceResult.writesDatabase, false);
      assert.equal(serviceResult.safeToExposeToClient, true);
      assertSafeSerializedOutput(serviceResult);

      const rereadAfterService = await harness.dbAdapter.findByUserBookChapter({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
      });

      assert.equal(rereadAfterService.status, "found");
      assert.equal(rereadAfterService.recordPreview.progressRatio, incomingProgressRatio);
      assert.equal(rereadAfterService.recordPreview.safeToExposeToClient, false);

      const regressionResult = buildReaderProgressSyncServiceResult(
        makeServiceInput({
          decision: makeDecision({
            payload: {
              progressRatio: regressionProgressRatio,
              idempotencyKeyPreview:
                "reader-sync-preview:book-123:chapter-456:0.500000",
            },
            existingProgress: {
              progressRatio: initialProgressRatio,
            },
          }),
          requestPreview: regressionRequestPreview,
          options: {
            previewOnly: true,
            persistentAdapter: harness.webAdapter,
          },
        }),
      );

      assert.equal(regressionResult.previewOnly, true);
      assert.equal(regressionResult.status, "ready_preview");
      assert.equal(regressionResult.fakeWriteAttempted, true);
      assert.equal(regressionResult.fakeWriteApplied, false);
      assert.equal(regressionResult.persistentAdapterPreview.status, "conflict");
      assert.equal(regressionResult.persistentAdapterPreview.executed, false);
      assert.equal(regressionResult.persistentAdapterPreview.success, false);
      assert.equal(regressionResult.persistentAdapterPreview.writePreview.status, "conflict");
      assert.equal(
        regressionResult.persistentAdapterPreview.writePreview.persistedRecordPreview,
        null,
      );
      assert.ok(
        regressionResult.persistentAdapterPreview.blockedReasons.some(function (reason) {
          return reason.indexOf("STALE_PROGRESS_REGRESSION") !== -1;
        }),
      );

      const rereadAfterRegression = await harness.dbAdapter.findByUserBookChapter({
        serverUserId: ids.userId,
        bookId: ids.bookId,
        chapterId: ids.chapterId,
      });

      assert.equal(rereadAfterRegression.status, "found");
      assert.equal(
        rereadAfterRegression.recordPreview.progressRatio,
        incomingProgressRatio,
      );
      assertSafeSerializedOutput({
        serviceResult,
        regressionResult,
        rereadAfterService,
        rereadAfterRegression,
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
