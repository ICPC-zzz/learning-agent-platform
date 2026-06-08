import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { createReaderSyncRepositoryPortPreview } from "./reader-sync-repository-port.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";

function makeDecision(overrides) {
  var o = overrides || {};
  var baseDecision = buildReaderProgressSyncDecision({
    serverContext: Object.assign(
      {
        hasAuthenticatedUser: true,
        serverUserId: "user-123",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      o.serverContext || {},
    ),
    payload: Object.assign(
      {
        bookId: "book-1",
        chapterId: "chapter-1",
        progressRatio: 0.6,
        idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
      },
      o.payload || {},
    ),
    existingProgress: o.existingProgress,
    options: o.options,
  });

  return Object.assign(baseDecision, o.decision || {});
}

function makeInput(overrides) {
  var o = overrides || {};
  var options = Object.assign({ previewOnly: true }, o.options || {});
  if (o.repositoryPort !== undefined) {
    options.repositoryPort = o.repositoryPort;
  }
  if (o.persistentAdapter !== undefined) {
    options.persistentAdapter = o.persistentAdapter;
  }
  return {
    decision: o.decision,
    requestPreview: o.requestPreview,
    options: options,
  };
}

function makePersistentAdapterOptions(overrides) {
  return Object.assign(
    {
      previewOnly: true,
      allowDatabaseWrite: false,
      allowRepositoryCall: false,
      explicitUserAuthorization: false,
      readinessGatePassed: false,
      auditReady: false,
      idempotencyReady: false,
      conflictResolutionReady: false,
      disabled: true,
    },
    overrides || {},
  );
}

function makeFakePersistentAdapter(existingProgress, calls, options) {
  var recorder = calls || [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    {
      findProgressByUserBookChapter: function (input) {
        recorder.push(["read", input]);
        return existingProgress;
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
          completedAt: input.progressRatio >= 1 ? "2026-06-06T12:00:00.000Z" : null,
          updatedAt: "2026-06-06T12:00:01.000Z",
          secret: "should-not-leak",
          token: "should-not-leak",
          session: { id: "should-not-leak" },
          rawDbRecord: { should: "not-leak" },
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
          message: "audit preview from fake repository",
          blockers: [],
          warnings: ["fake audit preview"],
          secret: "should-not-leak",
          token: "should-not-leak",
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
          message: "idempotency preview from fake repository",
          blockers: [],
          warnings: ["fake idempotency preview"],
          secret: "should-not-leak",
          cookie: "should-not-leak",
        };
      },
    },
    options || makePersistentAdapterOptions(),
  );

  return {
    adapter: adapter,
    calls: recorder,
  };
}

test("ready_preview decision returns preview-only service result with no execution", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: decision,
      requestPreview: {
        bookId: "book-1",
        chapterId: "chapter-1",
        progressRatio: 0.6,
        idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
      },
      options: { previewOnly: true },
    }),
  );

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.executed, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.success, false);
  assert.equal(result.status, "ready_preview");
  assert.equal(result.decisionStatus, "ready_preview");
  assert.equal(result.errorCode, undefined);
  assert.equal(result.operationPreview, "upsert-reading-progress-preview");
  assert.equal(result.normalizedPayload.bookId, "book-1");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.callsRepositoryPortPreview, true);
  assert.equal(result.repositoryPreview.mode, "noop");
  assert.equal(result.repositoryCapabilities.mode, "noop");
  assert.equal(result.repositoryReadPreview.status, "not_implemented");
  assert.equal(result.repositoryWritePreview.status, "not_implemented");
  assert.ok(result.repositoryWarnings.length > 0);
  assert.equal(result.fakeWriteAttempted, false);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.persistentAdapterPreview.source, "absent");
  assert.equal(result.persistentAdapterPreview.status, "blocked");
  assert.equal(result.persistentAdapterPreview.attempted, false);
  assert.equal(result.persistentAdapterPreview.applied, false);
  assert.equal(result.persistentAdapterPreview.mode, "blocked");
});

test("injecting a mock repository port exposes repository preview data without changing status mapping", function () {
  var decision = makeDecision();
  var mockPortPreview = createReaderSyncRepositoryPortPreview();
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: decision,
      requestPreview: {
        bookId: "book-1",
        chapterId: "chapter-1",
        progressRatio: 0.6,
        idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
      },
      repositoryPort: mockPortPreview.port,
    }),
  );

  assert.equal(result.status, "ready_preview");
  assert.equal(result.callsRepository, false);
  assert.equal(result.callsRepositoryPortPreview, true);
  assert.equal(result.repositoryPreview.mode, "mock");
  assert.equal(result.repositoryReadPreview.status, "unavailable");
  assert.equal(result.repositoryWritePreview.status, "preview");
  assert.equal(result.repositoryWritePreview.snapshotPreview.bookId, "book-1");
  assert.equal(result.repositoryWritePreview.auditPreview.persisted, false);
  assert.equal(result.repositoryWritePreview.idempotencyPreview.persisted, false);
  assert.equal(result.repositoryWarnings.length > 0, true);
  assert.equal(result.repositoryBlockedReasons.length, 0);
});

test("injecting the fake persistent adapter keeps the service preview-only and records a fake write", function () {
  var calls = [];
  var fake = makeFakePersistentAdapter(
    {
      previewOnly: true,
      safeToExposeToClient: true,
      source: "existing",
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.4,
      lastChunkId: "chunk-1",
      completedAt: null,
      updatedAt: "2026-06-06T11:59:59.000Z",
    },
    calls,
    makePersistentAdapterOptions({
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: makeDecision(),
      persistentAdapter: fake.adapter,
    }),
  );

  assert.equal(result.status, "ready_preview");
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, true);
  assert.equal(result.persistentAdapterPreview.source, "preview");
  assert.equal(result.persistentAdapterPreview.status, "preview");
  assert.equal(result.persistentAdapterPreview.mode, "fake");
  assert.equal(result.persistentAdapterPreview.attempted, true);
  assert.equal(result.persistentAdapterPreview.applied, true);
  assert.equal(result.persistentAdapterPreview.executed, true);
  assert.equal(result.persistentAdapterPreview.success, true);
  assert.equal(result.persistentAdapterPreview.callsRepository, true);
  assert.equal(result.persistentAdapterPreview.writesDatabase, false);
  assert.equal(result.fakeExecutionPreview.status, "preview");
  assert.equal(result.fakeExecutionPreview.attempted, true);
  assert.equal(result.fakeExecutionPreview.applied, true);
  assert.equal(result.fakeExecutionPreview.executed, true);
  assert.equal(result.fakeExecutionPreview.success, true);
  assert.equal(calls.length, 4);
  assert.equal(calls[3][0], "upsert");
  assert.equal(result.persistentAdapterPreview.writePreview.secret, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.token, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.session, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.rawDbRecord, undefined);
  assert.equal(JSON.stringify(result).indexOf("should-not-leak"), -1);
  assert.equal(JSON.stringify(result).indexOf("rawDbRecord"), -1);
});

test("persistent adapter stays blocked when explicit authorization is missing", function () {
  var calls = [];
  var fake = makeFakePersistentAdapter(
    null,
    calls,
    makePersistentAdapterOptions({
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: makeDecision(),
      persistentAdapter: fake.adapter,
    }),
  );

  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.persistentAdapterPreview.status, "blocked");
  assert.equal(result.persistentAdapterPreview.executed, false);
  assert.equal(result.persistentAdapterPreview.success, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.persistentAdapterBlockedReasons.some(function (reason) {
      return reason.indexOf("EXPLICIT_USER_AUTHORIZATION_REQUIRED") !== -1;
    }),
  );
});

test("persistent adapter stays blocked when readiness gate is not passed", function () {
  var calls = [];
  var fake = makeFakePersistentAdapter(
    null,
    calls,
    makePersistentAdapterOptions({
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: makeDecision(),
      persistentAdapter: fake.adapter,
    }),
  );

  assert.equal(result.persistentAdapterPreview.status, "blocked");
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.persistentAdapterBlockedReasons.some(function (reason) {
      return reason.indexOf("READINESS_GATE_NOT_PASSED") !== -1;
    }),
  );
});

test("persistent adapter stays blocked when audit or idempotency readiness is missing", function () {
  var calls = [];
  var fake = makeFakePersistentAdapter(
    null,
    calls,
    makePersistentAdapterOptions({
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: makeDecision(),
      persistentAdapter: fake.adapter,
    }),
  );

  assert.equal(result.persistentAdapterPreview.status, "blocked");
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.persistentAdapterBlockedReasons.some(function (reason) {
      return reason.indexOf("AUDIT_NOT_READY") !== -1;
    }),
  );
  assert.ok(
    result.persistentAdapterBlockedReasons.some(function (reason) {
      return reason.indexOf("IDEMPOTENCY_NOT_READY") !== -1;
    }),
  );
});

test("incoming progress below existing progress remains conflict and skips fake upsert", function () {
  var calls = [];
  var fake = makeFakePersistentAdapter(
    {
      previewOnly: true,
      safeToExposeToClient: true,
      source: "existing",
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.9,
      lastChunkId: "chunk-9",
      completedAt: null,
      updatedAt: "2026-06-06T11:59:59.000Z",
    },
    calls,
    makePersistentAdapterOptions({
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var decision = makeDecision({
    existingProgress: {
      progressRatio: 0.9,
    },
  });
  var result = buildReaderProgressSyncServiceResult(
    makeInput({
      decision: decision,
      persistentAdapter: fake.adapter,
    }),
  );

  assert.equal(result.status, "conflict");
  assert.equal(result.fakeWriteAttempted, false);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.persistentAdapterPreview.source, "blocked");
  assert.equal(calls.length, 0);
  assert.equal(result.persistentAdapterPreview.attempted, false);
  assert.equal(result.persistentAdapterPreview.applied, false);
});

test("blocked repository previews stay visible when the service result degrades to invalid", function () {
  var result = buildReaderProgressSyncServiceResult({
    decision: null,
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.callsRepositoryPortPreview, true);
  assert.equal(result.repositoryPreview.mode, "noop");
  assert.equal(result.repositoryReadPreview.status, "blocked");
  assert.equal(result.repositoryWritePreview.status, "blocked");
  assert.equal(result.repositoryBlockedReasons.length > 0, true);
});

test("blocked decision maps to SYNC_BLOCKED", function () {
  var decision = makeDecision({ serverContext: { hasAuthenticatedUser: false } });
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.equal(result.status, "blocked");
  assert.equal(result.decisionStatus, "blocked");
  assert.equal(result.errorCode, "SYNC_BLOCKED");
  assert.equal(result.success, false);
  assert.equal(result.blockedReasons.length > 0, true);
});

test("conflict decision maps to PROGRESS_CONFLICT", function () {
  var decision = makeDecision({ existingProgress: { progressRatio: 0.9 } });
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.equal(result.status, "conflict");
  assert.equal(result.errorCode, "PROGRESS_CONFLICT");
  assert.equal(result.decisionStatus, "conflict");
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("PROGRESS_CONFLICT") !== -1;
    }),
    true,
  );
});

test("noop decision maps to NO_CHANGE_PREVIEW", function () {
  var decision = makeDecision({ existingProgress: { progressRatio: 0.6 } });
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.equal(result.status, "noop");
  assert.equal(result.errorCode, "NO_CHANGE_PREVIEW");
  assert.equal(result.decisionStatus, "noop");
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("NO_CHANGE_PREVIEW") !== -1;
    }),
    true,
  );
});

test("invalid decision input returns INVALID_SYNC_DECISION safely", function () {
  var result = buildReaderProgressSyncServiceResult({
    decision: null,
    requestPreview: {
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.6,
      idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
    },
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.errorCode, "INVALID_SYNC_DECISION");
  assert.equal(result.success, false);
  assert.equal(result.executed, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.safeToExposeToClient, true);
});

test("syncedFields is always empty", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.deepEqual(result.syncedFields, []);
});

test("skippedFields include the identified but not written core fields", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.ok(result.skippedFields.indexOf("bookId") !== -1);
  assert.ok(result.skippedFields.indexOf("chapterId") !== -1);
  assert.ok(result.skippedFields.indexOf("progressRatio") !== -1);
});

test("auditPreview never contains a real auditId", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.equal(result.auditPreview.auditId, null);
  assert.equal(result.auditPreview.previewOnly, true);
});

test("idempotencyPreview keeps preview-only information", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));

  assert.equal(result.idempotencyPreview.persisted, false);
  assert.equal(result.idempotencyPreview.previewOnly, true);
  assert.equal(result.idempotencyPreview.previewKey, "reader-sync-preview:book-1:chapter-1:0.600000");
});

test("nextSafeSteps stay on the safe side", function () {
  var decision = makeDecision();
  var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));
  var joined = result.nextSafeSteps.join(" ").toLowerCase();

  assert.equal(joined.indexOf("bypass") === -1, true);
  assert.equal(joined.indexOf("direct db") === -1, true);
  assert.equal(joined.indexOf("real sync") === -1, true);
});

test("service result does not call fetch", function () {
  var originalFetch = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () {
      called = true;
      return originalFetch.apply(this, arguments);
    };

    var decision = makeDecision();
    var result = buildReaderProgressSyncServiceResult(makeInput({ decision: decision }));
    assert.equal(called, false);
    assert.equal(result.previewOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("service file does not import real repository or prisma", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-progress-sync-service.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/from\s+["']\.\/reader-sync-repository-port\.ts["']/.test(content), true);
  assert.equal(/from\s+["'].*packages\/db/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*@prisma/i.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage/.test(content), false);
});

test("malformed input degrades safely to invalid preview", function () {
  var result = buildReaderProgressSyncServiceResult({
    decision: {
      previewOnly: true,
      implemented: false,
      executesWrite: false,
      status: "ready_preview",
      operationPreview: "upsert-reading-progress-preview",
      hasServerUserContext: true,
      permissionSummary: {
        hasAuthenticatedUser: true,
        hasServerUserId: true,
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
        missingPermissionContext: [],
      },
      blockers: [],
      warnings: [],
      nextSafeSteps: [],
    },
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.errorCode, "INVALID_SYNC_DECISION");
  assert.equal(result.success, false);
});
