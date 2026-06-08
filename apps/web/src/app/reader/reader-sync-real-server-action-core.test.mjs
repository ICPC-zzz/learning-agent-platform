import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
import { buildReaderSyncRealServerActionCoreResult } from "./reader-sync-real-server-action-core.ts";

function makeAuthSessionStub(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      verified: true,
      sessionSource: "trusted-server-stub",
      sessionIdPreview: "session-preview-001",
    },
    o,
  );
}

function makeServerContext(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: "server-user-001",
      hasAuthenticatedUser: true,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
      authSessionStub: makeAuthSessionStub(),
    },
    o,
  );
}

function makeLocalProgress(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      bookId: "book-real-core-001",
      chapterId: "chapter-real-core-001",
      progressRatio: 0.72,
      currentOffset: 128,
      currentCfi: "epubcfi(/6/2[chapter-real-core-001])",
      source: "server-preview",
    },
    o,
  );
}

function makeExpectedIdempotencyKey(overrides) {
  var progress = makeLocalProgress(overrides);
  return createReaderSyncIdempotencyKeyPreview({
    previewOnly: true,
    serverUserId: "server-user-001",
    bookId: progress.bookId,
    chapterId: progress.chapterId,
    progressRatio: progress.progressRatio,
    source: progress.source,
  }).idempotencyKeyPreview;
}

function makeDangerousLocalProgress() {
  var input = Object.create(null);
  Object.assign(input, makeLocalProgress());
  input.userId = "local-user-secret";
  input.role = "local-role-secret";
  input.auditId = "local-audit-secret";
  input.serverProgressRatio = 0.91;
  input.rawLocalStorage = "{local-storage-secret}";
  input.rawDbRecord = { secret: "local-db-secret" };
  input.metadata = { secret: "local-metadata-secret" };
  input.token = "local-token-secret";
  input.cookie = "local-cookie-secret";
  input.headers = { authorization: "Bearer local-secret" };
  input.rawHeaders = ["authorization", "Bearer local-secret"];
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  input.constructor = "local-constructor-secret";
  input.prototype = "local-prototype-secret";
  return input;
}

function makeDangerousServerContext() {
  var input = Object.create(null);
  Object.assign(input, makeServerContext());
  input.userId = "server-user-secret";
  input.role = "server-role-secret";
  input.auditId = "server-audit-secret";
  input.token = "server-token-secret";
  input.cookie = "server-cookie-secret";
  input.session = { id: "server-session-secret" };
  input.rawSession = { id: "server-raw-session-secret" };
  input.rawDbRecord = { secret: "server-db-secret" };
  input.metadata = { secret: "server-metadata-secret" };
  input.headers = { authorization: "Bearer server-secret" };
  input.rawHeaders = ["authorization", "Bearer server-secret"];
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  input.constructor = "server-constructor-secret";
  input.prototype = "server-prototype-secret";
  input.authSessionStub = Object.assign(Object.create(null), makeAuthSessionStub());
  input.authSessionStub.token = "nested-token-secret";
  input.authSessionStub.cookie = "nested-cookie-secret";
  input.authSessionStub.session = { id: "nested-session-secret" };
  input.authSessionStub.rawDbRecord = { secret: "nested-db-secret" };
  input.authSessionStub.metadata = { secret: "nested-metadata-secret" };
  Object.defineProperty(input.authSessionStub, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  input.authSessionStub.constructor = "nested-constructor-secret";
  input.authSessionStub.prototype = "nested-prototype-secret";
  return input;
}

function makeFakeRepositoryAdapter(calls) {
  var recorder = calls || [];

  return createReaderSyncPersistentRepositoryAdapter(
    {
      findProgressByUserBookChapter: function (input) {
        recorder.push(["read", input]);
        return null;
      },
      upsertProgress: function (input) {
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
          token: "adapter-token-secret",
          cookie: "adapter-cookie-secret",
          session: { id: "adapter-session-secret" },
          rawDbRecord: { secret: "adapter-db-secret" },
        };
      },
      recordAuditLog: function (input) {
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
      claimIdempotencyKey: function (input) {
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

function assertBlockedCore(result, label, expectedReason) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.actionDraft, true, label + " must stay action-draft");
  assert.equal(result.enabled, false, label + " must stay disabled");
  assert.equal(result.disabledByDefault, true, label + " must stay disabled-by-default");
  assert.equal(result.success, false, label + " must never report success");
  assert.equal(result.safeToExposeToClient, true, label + " must stay safe to expose");
  assert.equal(result.writesDatabase, false, label + " must not write to DB");
  assert.equal(result.callsRepository, false, label + " must not call the real repository");
  assert.equal(result.status, "blocked", label + " must be blocked");
  assert.equal(result.source, "blocked", label + " must stay blocked");
  assert.equal(result.guardPreview.canUseTestOnlyFakePath, false, label + " guard must stay blocked");
  assert.equal(result.guardPreview.enabled, false, label + " guard must stay disabled");
  assert.equal(result.guardPreview.disabledByDefault, true, label + " guard must stay disabled-by-default");
  assert.equal(result.guardPreview.requiresAuthSession, true, label + " guard must require auth");
  assert.equal(result.guardPreview.requiresExplicitUserAuthorization, true, label + " guard must require explicit authorization");
  assert.equal(result.idempotencyPreview.previewOnly, true, label + " idempotency preview must stay preview-only");
  assert.equal(result.idempotencyPreview.safeToExposeToClient, true, label + " idempotency preview must stay safe to expose");
  assert.equal(result.permissionGatePreview.previewOnly, true, label + " permission gate must stay preview-only");
  assert.equal(result.permissionGatePreview.safeToExposeToClient, true, label + " permission gate must stay safe to expose");
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf(expectedReason) !== -1;
    }),
    true,
    label + " must surface " + expectedReason,
  );
}

test("default core result stays disabled-by-default and blocked", function () {
  var result = buildReaderSyncRealServerActionCoreResult(null);

  assertBlockedCore(
    result,
    "default core result",
    "INVALID_INPUT",
  );
  assert.equal(result.repositoryAdapterPreview.accepted, false);
  assert.equal(result.decisionPreview, null);
  assert.equal(result.serviceResultPreview, null);
  assert.equal(result.testOnlyExecutionPreview.attempted, false);
  assert.equal(result.testOnlyExecutionPreview.executed, false);
  assert.equal(result.testOnlyExecutionPreview.success, false);
  assert.equal(result.idempotencyPreview.allowed, false);
  assert.equal(result.idempotencyPreview.status, "blocked");
});

test("permission gate blocks the core before the fake execution path can run", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext({ canAccessBook: false }),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(calls),
  });

  assertBlockedCore(
    result,
    "permission gate blocked core",
    "PERMISSION_GATE_REQUIRED",
  );
  assert.equal(result.permissionGatePreview.allowed, false);
  assert.equal(result.permissionGatePreview.source, "trusted-server-context");
  assert.equal(
    result.permissionGatePreview.blockedReasons.some(function (reason) {
      return reason.indexOf("CAN_ACCESS_BOOK_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(result.guardPreview.permissionGateReady, false);
  assert.equal(
    result.guardPreview.permissionGateBlockedReasons.some(function (reason) {
      return reason.indexOf("CAN_ACCESS_BOOK_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(result.serviceResultPreview, null);
  assert.equal(result.testOnlyExecutionPreview.attempted, false);
  assert.equal(result.testOnlyExecutionPreview.executed, false);
  assert.equal(result.testOnlyExecutionPreview.success, false);
  assert.equal(calls.length, 0);
});

test("missing guard inputs block the core before any fake execution path can run", function () {
  var scenarios = [
    {
      label: "explicitUserAuthorization missing",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext(),
        realSyncEnabled: true,
        dbIntegrationAllowed: true,
        authSessionVerified: true,
        repositoryAdapter: makeFakeRepositoryAdapter(),
      },
      reason: "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
    },
    {
      label: "authSessionVerified missing",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext(),
        explicitUserAuthorization: true,
        realSyncEnabled: true,
        dbIntegrationAllowed: true,
        repositoryAdapter: makeFakeRepositoryAdapter(),
      },
      reason: "AUTH_SESSION_VERIFIED_REQUIRED",
    },
    {
      label: "serverUserId missing",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext({ serverUserId: undefined }),
        explicitUserAuthorization: true,
        realSyncEnabled: true,
        dbIntegrationAllowed: true,
        authSessionVerified: true,
        repositoryAdapter: makeFakeRepositoryAdapter(),
      },
      reason: "SERVER_USER_ID_REQUIRED",
    },
    {
      label: "realSyncEnabled false",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext(),
        explicitUserAuthorization: true,
        realSyncEnabled: false,
        dbIntegrationAllowed: true,
        authSessionVerified: true,
        repositoryAdapter: makeFakeRepositoryAdapter(),
      },
      reason: "REAL_SYNC_ENABLED_REQUIRED",
    },
    {
      label: "dbIntegrationAllowed false",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext(),
        explicitUserAuthorization: true,
        realSyncEnabled: true,
        dbIntegrationAllowed: false,
        authSessionVerified: true,
        repositoryAdapter: makeFakeRepositoryAdapter(),
      },
      reason: "DB_INTEGRATION_ALLOWED_REQUIRED",
    },
    {
      label: "repositoryAdapter missing",
      input: {
        localProgress: makeLocalProgress(),
        serverContext: makeServerContext(),
        explicitUserAuthorization: true,
        realSyncEnabled: true,
        dbIntegrationAllowed: true,
        authSessionVerified: true,
      },
      reason: "REPOSITORY_ADAPTER_REQUIRED",
    },
  ];

  scenarios.forEach(function (scenario) {
    var result = buildReaderSyncRealServerActionCoreResult(scenario.input);
    assertBlockedCore(result, scenario.label, scenario.reason);
    assert.equal(result.testOnlyExecutionPreview.attempted, false, scenario.label + " must not attempt test-only execution");
    assert.equal(result.serviceResultPreview, null, scenario.label + " must not produce a service preview");
  });
});

test("dangerous fields never transit through the core result", function () {
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeDangerousLocalProgress(),
    serverContext: makeDangerousServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(),
  });

  var serialized = JSON.stringify(result);
  assert.equal(result.status, "blocked");
  assert.equal(Object.prototype.polluted, undefined);

  [
    "local-user-secret",
    "local-role-secret",
    "local-audit-secret",
    "local-storage-secret",
    "local-db-secret",
    "local-metadata-secret",
    "local-token-secret",
    "local-cookie-secret",
    "Bearer local-secret",
    "server-user-secret",
    "server-role-secret",
    "server-audit-secret",
    "server-token-secret",
    "server-cookie-secret",
    "server-session-secret",
    "server-raw-session-secret",
    "server-db-secret",
    "server-metadata-secret",
    "Bearer server-secret",
    "nested-token-secret",
    "nested-cookie-secret",
    "nested-session-secret",
    "nested-db-secret",
    "nested-metadata-secret",
    "nested-constructor-secret",
    "nested-prototype-secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "serialized result must not leak " + needle);
  });
});

test("test-only fake adapter path runs once and stays fake-only", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(calls),
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.actionDraft, true);
  assert.equal(result.enabled, false);
  assert.equal(result.disabledByDefault, true);
  assert.equal(result.success, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "test_only_fake_preview");
  assert.equal(result.source, "test-only-fake");
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.guardPreview.canUseTestOnlyFakePath, true);
  assert.equal(result.guardPreview.repositoryAdapterReady, true);
  assert.equal(result.guardPreview.realSyncEnabled, true);
  assert.equal(result.guardPreview.dbIntegrationAllowed, true);
  assert.equal(result.guardPreview.authSessionVerified, true);
  assert.notEqual(result.localProgressPreview, null);
  assert.notEqual(result.serverContextPreview, null);
  assert.equal(result.repositoryAdapterPreview.accepted, true);
  assert.equal(result.repositoryAdapterPreview.mode, "fake");
  assert.equal(result.permissionGatePreview.allowed, true);
  assert.equal(result.permissionGatePreview.source, "trusted-server-context");
  assert.equal(result.permissionGatePreview.serverUserId, "server-user-001");
  assert.equal(result.permissionGatePreview.bookId, "book-real-core-001");
  assert.equal(result.permissionGatePreview.chapterId, "chapter-real-core-001");
  assert.equal(result.permissionGatePreview.canAccessBook, true);
  assert.equal(result.permissionGatePreview.canAccessChapter, true);
  assert.equal(result.permissionGatePreview.canWriteProgress, true);
  assert.equal(result.permissionGatePreview.explicitUserAuthorization, true);
  assert.equal(result.idempotencyPreview.allowed, true);
  assert.equal(result.idempotencyPreview.status, "preview");
  assert.equal(result.idempotencyPreview.source, "trusted-server-context");
  assert.equal(result.decisionPreview.status, "ready_preview");
  assert.equal(result.serviceResultPreview.status, "ready_preview");
  assert.equal(result.localProgressPreview.currentOffset, 128);
  assert.equal(result.localProgressPreview.currentCfi, "epubcfi(/6/2[chapter-real-core-001])");
  assert.equal(result.localProgressPreview.progressSource, "server-preview");
  assert.equal(result.localProgressPreview.explicitUserAuthorization, true);
  assert.equal(result.localProgressPreview.requestedAt, null);
  assert.equal(result.localProgressPreview.idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(result.idempotencyPreview.idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(result.serviceResultPreview.callsRepository, false);
  assert.equal(result.serviceResultPreview.writesDatabase, false);
  assert.equal(result.serviceResultPreview.persistentAdapterPreview.source, "preview");
  assert.equal(result.serviceResultPreview.persistentAdapterPreview.executed, true);
  assert.equal(result.serviceResultPreview.persistentAdapterPreview.success, true);
  assert.equal(result.serviceResultPreview.persistentAdapterPreview.callsRepository, true);
  assert.equal(result.serviceResultPreview.idempotencyPreview.previewKey, makeExpectedIdempotencyKey());
  assert.equal(result.testOnlyExecutionPreview.source, "test-only-fake");
  assert.equal(result.testOnlyExecutionPreview.attempted, true);
  assert.equal(result.testOnlyExecutionPreview.executed, true);
  assert.equal(result.testOnlyExecutionPreview.success, true);
  assert.equal(result.testOnlyExecutionPreview.callsRepository, true);
  assert.equal(result.testOnlyExecutionPreview.writesDatabase, false);
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], "read");
  assert.equal(calls[1][0], "idempotency");
  assert.equal(calls[2][0], "audit");
  assert.equal(calls[3][0], "upsert");
  assert.equal(calls[1][1].idempotencyKeyPreview, makeExpectedIdempotencyKey());
  assert.equal(JSON.stringify(result).indexOf("adapter-token-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("adapter-cookie-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("adapter-session-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("adapter-db-secret"), -1);
});

test("real sync core file does not import PrismaClient or DATABASE_URL", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-real-server-action-core.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/from\s+["'].*@prisma\/client["']/.test(content), false, "must not import PrismaClient from @prisma/client");
  assert.equal(/new\s+PrismaClient\s*\(/.test(content), false, "must not instantiate PrismaClient");
  assert.equal(/process\.env\.DATABASE_URL/.test(content), false, "must not read DATABASE_URL in runtime code");
  assert.equal(/DATABASE_URL/.test(content) && /process\.env/.test(content), false, "must not wire DATABASE_URL access");
});
