import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createBlockedReaderSyncServerActionContext,
  createPreviewReaderSyncRealServerActionResponse,
  createReaderSyncRealServerActionExecutor,
  executeReaderSyncRealServerActionForTest,
  previewReaderSyncRealServerAction,
} from "./reader-sync-real-server-action.ts";
import { previewReaderSyncRealServerAction as previewReaderSyncRealServerActionServer } from "./reader-sync-real-server-action.server.ts";
import { createMockReaderSyncAuthSessionAdapterForTest } from "./reader-sync-auth-session-adapter.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
import { evaluateReadingProgressDbIntegrationGuard } from "../../../../../packages/db/src/reading-progress-db-integration-guard.ts";

function makeDangerousInput() {
  const input = {
    userId: "client-user-id",
    role: "admin",
    token: "client-token",
    cookie: "client-cookie",
    session: { id: "client-session" },
    rawDbRecord: { secret: "client-db-record" },
    metadata: { secret: "client-metadata" },
    DATABASE_URL: "postgres://client-secret@example.invalid/db",
    process: { env: { DATABASE_URL: "postgres://client-process-secret" } },
    env: { DATABASE_URL: "postgres://client-env-secret" },
    localProgress: {
      bookId: "client-book",
      chapterId: "client-chapter",
      progressRatio: 0.99,
      idempotencyKeyPreview: "client-idempotency",
    },
    serverContext: {
      userId: "client-server-user",
      token: "client-server-token",
      cookie: "client-server-cookie",
      session: { id: "client-server-session" },
      headers: { authorization: "Bearer client" },
    },
  };

  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "client-constructor",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "client-prototype",
    enumerable: true,
    configurable: true,
  });

  return input;
}

function makeLocalProgress(overrides) {
  const o = overrides || {};
  return Object.assign(
    {
      bookId: "reader-sync-wrapper-test-book",
      chapterId: "reader-sync-wrapper-test-chapter",
      progressRatio: 0.72,
      currentOffset: 256,
      currentCfi: "epubcfi(/6/2[reader-sync-wrapper-test-chapter])",
      source: "server-preview",
    },
    o,
  );
}

function makeExpectedIdempotencyKey() {
  const progress = makeLocalProgress();
  return createReaderSyncIdempotencyKeyPreview({
    previewOnly: true,
    serverUserId: "reader-sync-wrapper-test-user",
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    progressRatio: progress.progressRatio,
    source: progress.source,
  }).idempotencyKeyPreview;
}

function makeTrustedServerContext(overrides) {
  const o = overrides || {};
  return Object.assign(
    {
      hasAuthenticatedUser: true,
      serverUserId: "reader-sync-wrapper-test-user",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o,
  );
}

function makeTrustedAuthSessionInput(overrides) {
  const trusted = makeTrustedServerContext(overrides);
  return Object.assign(
    {
      previewOnly: true,
      source: "test-only-mock",
      hasAuthenticatedUser: true,
      authSessionVerified: true,
      serverUserId: trusted.serverUserId,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
      explicitUserAuthorization: true,
      sessionIdPreview: "reader-sync-wrapper-test-session",
      testOnly: true,
      mockOnly: true,
    },
    trusted,
  );
}

function makeAllowedDbIntegrationGuardPreview() {
  return evaluateReadingProgressDbIntegrationGuard({
    explicitUserAuthorization: true,
    allowRealDatabaseConnection: true,
    allowPrismaClientRuntime: true,
    allowDatabaseWrite: true,
    databaseUrlPresent: true,
    testDatabaseOnly: true,
    environmentName: "test",
    allowLocalDevelopmentDatabase: true,
    acknowledgedNoProductionDatabase: true,
    destructiveWriteAllowed: false,
    migrationAllowed: false,
  });
}

function makeFakeRepositoryAdapter(calls) {
  const recorder = calls || [];

  return createReaderSyncPersistentRepositoryAdapter(
    {
      findProgressByUserBookChapter(input) {
        recorder.push(["read", input]);
        return null;
      },
      upsertProgress(input) {
        recorder.push(["upsert", input]);
        return {
          previewOnly: true,
          safeToExposeToClient: true,
          source: "upserted",
          bookId: input.bookId,
          chapterId: input.chapterId,
          progressRatio: input.progressRatio,
          lastChunkId: input.lastChunkId ?? null,
          completedAt: input.progressRatio >= 1 ? "2026-06-07T00:00:00.000Z" : null,
          updatedAt: "2026-06-07T00:00:01.000Z",
        };
      },
      recordAuditLog(input) {
        recorder.push(["audit", input]);
        return {
          previewOnly: true,
          implemented: false,
          safeToExposeToClient: true,
          status: "preview",
          persisted: false,
          auditId: "audit-" + input.bookId + "-" + input.chapterId,
          action: "reader.progress.sync.repository.audit-log",
          source: "preview",
          message: "audit preview from fake adapter",
          blockers: [],
          warnings: ["fake audit preview"],
        };
      },
      claimIdempotencyKey(input) {
        recorder.push(["idempotency", input]);
        return {
          previewOnly: true,
          implemented: false,
          safeToExposeToClient: true,
          status: "preview",
          persisted: false,
          previewKey:
            input.idempotencyKeyPreview ||
            "reader-sync-idempotency-preview:" + input.bookId + ":" + input.chapterId,
          action: "reader.progress.sync.repository.idempotency-claim",
          source: "preview",
          message: "idempotency preview from fake adapter",
          blockers: [],
          warnings: ["fake idempotency preview"],
        };
      },
    },
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
  );
}

test("default wrapper response stays disabled-by-default and preview-only", function () {
  const result = createPreviewReaderSyncRealServerActionResponse();
  const stub = createBlockedReaderSyncServerActionContext(result.authSessionPreview);

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
  assert.equal(result.source, "blocked-by-default");
  assert.deepEqual(result.serverContextStub, stub);
  assert.equal(result.authSessionPreview.previewOnly, true);
  assert.equal(result.authSessionPreview.implemented, false);
  assert.equal(result.authSessionPreview.safeToExposeToClient, true);
  assert.equal(result.authSessionPreview.source, "blocked-by-default");
  assert.equal(result.authSessionPreview.status, "blocked");
  assert.equal(result.authSessionPreview.snapshot.serverUserId, null);
  assert.equal(result.authSessionPreview.snapshot.authSessionVerified, false);
  assert.equal(result.authSessionPreview.snapshot.canWriteProgress, false);
  assert.equal(result.authSessionPreview.capabilities.authConnected, false);
  assert.equal(result.authSessionPreview.capabilities.readsCookies, false);
  assert.equal(result.authSessionPreview.capabilities.readsHeaders, false);
  assert.equal(result.authSessionPreview.capabilities.readsSession, false);
  assert.equal(result.authSessionPreview.capabilities.trustsClientUserId, false);
  assert.equal(result.authBlockedReasons.length > 0, true);
  assert.equal(
    result.authBlockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_ID_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.authBlockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_SESSION_VERIFIED_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(result.dependencyPreview.source, "default-core");
  assert.equal(result.dependencyPreview.testOnly, false);
  assert.equal(result.dependencyPreview.accepted, true);
  assert.equal(result.message.indexOf("auth/session") !== -1, true);
  assert.equal(result.message.indexOf("Reader UI") !== -1, true);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("WRAPPER_DISABLED_BY_DEFAULT") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_SESSION_PROVIDER_NOT_CONNECTED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("UI_NOT_CONNECTED") !== -1;
    }),
    true,
  );
});

test("wrapper ignores dangerous client fields and never leaks them into the response", async function () {
  const result = await previewReaderSyncRealServerAction(makeDangerousInput());
  const serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.success, false);
  assert.equal(result.enabled, false);
  assert.equal(result.disabledByDefault, true);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.authSessionPreview.status, "blocked");
  assert.equal(result.corePreview.localProgressPreview.bookId, "reader-sync-wrapper-preview-book");
  assert.equal(result.corePreview.localProgressPreview.chapterId, "reader-sync-wrapper-preview-chapter");
  assert.equal(result.corePreview.guardPreview.disabledByDefault, true);
  assert.equal(result.corePreview.guardPreview.canUseTestOnlyFakePath, false);
  assert.equal(Object.prototype.polluted, undefined);

  [
    "client-user-id",
    "client-token",
    "client-cookie",
    "client-session",
    "client-db-record",
    "client-metadata",
    "postgres://client-secret@example.invalid/db",
    "client-process-secret",
    "client-env-secret",
    "client-server-user",
    "client-server-token",
    "client-server-cookie",
    "client-server-session",
    "Bearer client",
    "client-constructor",
    "client-prototype",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "response must not leak " + needle,
    );
  });
});

test("next async-only server action wrapper stays blocked by default", async function () {
  const result = await previewReaderSyncRealServerActionServer(makeDangerousInput());
  const serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.success, false);
  assert.equal(result.enabled, false);
  assert.equal(result.disabledByDefault, true);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.realSyncEnabled, false);
  assert.equal(result.explicitUserAuthorization, false);
  assert.equal(result.requiresAuthSession, true);
  assert.equal(result.requiresExplicitUserAuthorization, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.source, "blocked-by-default");
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("WRAPPER_DISABLED_BY_DEFAULT") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("DATABASE_WRITES_DISABLED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("REPOSITORY_CALLS_DISABLED") !== -1;
    }),
    true,
  );

  [
    "client-user-id",
    "client-token",
    "client-cookie",
    "client-session",
    "client-db-record",
    "client-metadata",
    "postgres://client-secret@example.invalid/db",
    "client-process-secret",
    "client-env-secret",
    "client-server-user",
    "client-server-token",
    "client-server-cookie",
    "client-server-session",
    "Bearer client",
    "client-constructor",
    "client-prototype",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "server action wrapper response must not leak " + needle,
    );
  });
});

test("test-only injected core builder is marked as fake-only and still receives blocked input", function () {
  let capturedInput = null;

  const result = createPreviewReaderSyncRealServerActionResponse({
    buildCoreResult: function (input) {
      capturedInput = input;
      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        success: false,
        enabled: false,
        disabledByDefault: true,
        realSyncEnabled: false,
        explicitUserAuthorization: false,
        requiresAuthSession: true,
        requiresExplicitUserAuthorization: true,
        writesDatabase: false,
        callsRepository: false,
        status: "blocked",
        source: "blocked",
        message: "test-only fake core",
        blockedReasons: ["FAKE_CORE_BLOCKED"],
        warnings: ["fake core warning"],
        guardPreview: {
          disabledByDefault: true,
          canUseTestOnlyFakePath: false,
        },
        localProgressPreview: null,
        serverContextPreview: null,
        repositoryAdapterPreview: null,
        decisionPreview: null,
        serviceResultPreview: null,
        testOnlyExecutionPreview: null,
        actionDraft: true,
      };
    },
  });

  assert.equal(result.dependencyPreview.source, "test-only-fake-core");
  assert.equal(result.dependencyPreview.testOnly, true);
  assert.equal(result.dependencyPreview.accepted, true);
  assert.equal(
    result.dependencyPreview.warnings.some(function (warning) {
      return warning.indexOf("test-only fake core dependency") !== -1;
    }),
    true,
  );
  assert.notEqual(capturedInput, null);
  assert.equal(capturedInput.explicitUserAuthorization, false);
  assert.equal(capturedInput.realSyncEnabled, false);
  assert.equal(capturedInput.dbIntegrationAllowed, false);
  assert.equal(capturedInput.authSessionVerified, false);
  assert.equal(capturedInput.repositoryAdapter, null);
  assert.equal(capturedInput.serverContext.serverUserId, undefined);
  assert.equal(capturedInput.serverContext.hasAuthenticatedUser, false);
  assert.equal(capturedInput.serverContext.authSessionStub.verified, false);
  assert.equal(capturedInput.serverContext.authSessionStub.sessionIdPreview, null);
  assert.equal(capturedInput.localProgress.bookId, "reader-sync-wrapper-preview-book");
  assert.equal(capturedInput.localProgress.chapterId, "reader-sync-wrapper-preview-chapter");
  assert.equal(capturedInput.localProgress.progressRatio, 0);
  assert.equal(capturedInput.localProgress.idempotencyKeyPreview, null);
});

test("test/dev-only real DB executor stays blocked until every guard is satisfied", async function () {
  const authSessionAdapter = createMockReaderSyncAuthSessionAdapterForTest(
    makeTrustedAuthSessionInput(),
  );
  const repositoryAdapter = makeFakeRepositoryAdapter([]);
  const guardPreview = makeAllowedDbIntegrationGuardPreview();

  const blockedBySwitch = await executeReaderSyncRealServerActionForTest(
    {
      explicitUserAuthorization: true,
      localProgress: makeLocalProgress(),
    },
    {
      allowTestRealDbExecution: false,
      authSessionAdapter,
      trustedServerContext: makeTrustedServerContext(),
      repositoryAdapter,
      dbIntegrationGuardPreview: guardPreview,
    },
  );

  assert.equal(blockedBySwitch.testOnly, true);
  assert.equal(blockedBySwitch.devOnly, true);
  assert.equal(blockedBySwitch.realDbIntegrationTest, true);
  assert.equal(blockedBySwitch.executionAttempted, false);
  assert.equal(blockedBySwitch.executionSucceeded, false);
  assert.equal(blockedBySwitch.executionAllowed, false);
  assert.equal(blockedBySwitch.executionMode, "blocked");
  assert.equal(blockedBySwitch.source, "test-dev-only");
  assert.equal(
    blockedBySwitch.blockedReasons.some(function (reason) {
      return reason.indexOf("ALLOW_TEST_REAL_DB_EXECUTION_REQUIRED") !== -1;
    }),
    true,
  );

  const blockedByGuard = await executeReaderSyncRealServerActionForTest(
    {
      explicitUserAuthorization: true,
      localProgress: makeLocalProgress(),
    },
    {
      allowTestRealDbExecution: true,
      authSessionAdapter,
      trustedServerContext: makeTrustedServerContext(),
      repositoryAdapter,
      dbIntegrationGuardPreview: {
        ...guardPreview,
        canRunDbIntegrationTest: false,
        blockedReasons: ["DB_INTEGRATION_DISABLED"],
      },
    },
  );

  assert.equal(blockedByGuard.executionAttempted, false);
  assert.equal(blockedByGuard.executionSucceeded, false);
  assert.equal(blockedByGuard.executionAllowed, false);
  assert.equal(blockedByGuard.executionMode, "blocked");
  assert.equal(
    blockedByGuard.blockedReasons.some(function (reason) {
      return reason.indexOf("DB_INTEGRATION_DISABLED") !== -1;
    }),
    true,
  );
});

test("test/dev-only real DB executor can run the core/service/adapter chain once when guards are satisfied", async function () {
  const calls = [];
  const authSessionAdapter = createMockReaderSyncAuthSessionAdapterForTest(
    makeTrustedAuthSessionInput(),
  );
  const repositoryAdapter = makeFakeRepositoryAdapter(calls);
  const guardPreview = makeAllowedDbIntegrationGuardPreview();
  const result = await createReaderSyncRealServerActionExecutor({
    allowTestRealDbExecution: true,
    authSessionAdapter,
    trustedServerContext: makeTrustedServerContext(),
    repositoryAdapter,
    dbIntegrationGuardPreview: guardPreview,
  })({
    explicitUserAuthorization: true,
    localProgress: makeLocalProgress(),
  });

  assert.equal(result.testOnly, true);
  assert.equal(result.devOnly, true);
  assert.equal(result.realDbIntegrationTest, true);
  assert.equal(result.executionAttempted, true);
  assert.equal(result.executionSucceeded, true);
  assert.equal(result.executionAllowed, true);
  assert.equal(result.executionMode, "test-dev-only-real-db");
  assert.equal(result.source, "test-dev-only");
  assert.equal(result.authSessionPreview.source, "test-only-mock");
  assert.equal(result.authSessionPreview.snapshot.serverUserId, "reader-sync-wrapper-test-user");
  assert.equal(result.serverContextStub.source, "trusted-server-context");
  assert.equal(result.serverContextStub.serverUserId, "reader-sync-wrapper-test-user");
  assert.equal(result.executionGuardPreview.allowed, true);
  assert.equal(result.executionGuardPreview.dbIntegrationGuardPreview.canRunDbIntegrationTest, true);
  assert.equal(result.corePreview.status, "test_only_fake_preview");
  assert.equal(result.corePreview.localProgressPreview.currentOffset, 256);
  assert.equal(result.corePreview.localProgressPreview.currentCfi, "epubcfi(/6/2[reader-sync-wrapper-test-chapter])");
  assert.equal(result.corePreview.localProgressPreview.progressSource, "server-preview");
  assert.equal(result.corePreview.localProgressPreview.explicitUserAuthorization, true);
  assert.equal(result.corePreview.testOnlyExecutionPreview.attempted, true);
  assert.equal(result.corePreview.testOnlyExecutionPreview.executed, true);
  assert.equal(result.corePreview.testOnlyExecutionPreview.success, true);
  assert.equal(result.corePreview.testOnlyExecutionPreview.callsRepository, true);
  assert.equal(result.corePreview.serviceResultPreview.status, "ready_preview");
  assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.executed, true);
  assert.equal(result.corePreview.serviceResultPreview.persistentAdapterPreview.success, true);
  assert.equal(result.corePreview.idempotencyPreview.allowed, true);
  assert.equal(result.corePreview.idempotencyPreview.status, "preview");
  assert.equal(result.corePreview.idempotencyPreview.idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(result.corePreview.permissionGatePreview.allowed, true);
  assert.equal(result.corePreview.permissionGatePreview.serverUserId, "reader-sync-wrapper-test-user");
  assert.equal(result.corePreview.permissionGatePreview.bookId, "reader-sync-wrapper-test-book");
  assert.equal(result.corePreview.permissionGatePreview.chapterId, "reader-sync-wrapper-test-chapter");
  assert.equal(result.corePreview.permissionGatePreview.canAccessBook, true);
  assert.equal(result.corePreview.permissionGatePreview.canAccessChapter, true);
  assert.equal(result.corePreview.permissionGatePreview.canWriteProgress, true);
  assert.equal(result.corePreview.permissionGatePreview.explicitUserAuthorization, true);
  assert.equal(result.corePreview.localProgressPreview.idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], "read");
  assert.equal(calls[1][0], "idempotency");
  assert.equal(calls[2][0], "audit");
  assert.equal(calls[3][0], "upsert");
  assert.equal(calls[1][1].idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(JSON.stringify(result).indexOf("token-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("cookie-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("session-secret"), -1);
});

test("wrapper file does not import PrismaClient or read DATABASE_URL", function () {
  const filePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "reader-sync-real-server-action.ts",
  );

  const content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/from\s+["'].*@prisma\/client["']/.test(content), false);
  assert.equal(/new\s+PrismaClient\s*\(/.test(content), false);
  assert.equal(/process\.env\.DATABASE_URL/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
});

test("server action wrapper file stays async-only and does not import PrismaClient or DATABASE_URL", function () {
  const filePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "reader-sync-real-server-action.server.ts",
  );

  const content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/export\s+(?!async\s+function)/.test(content), false);
  assert.equal(/export\s+async\s+function\s+previewReaderSyncRealServerAction/.test(content), true);
  assert.equal(/from\s+["'].*@prisma\/client["']/.test(content), false);
  assert.equal(/new\s+PrismaClient\s*\(/.test(content), false);
  assert.equal(/process\.env\.DATABASE_URL/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
});
