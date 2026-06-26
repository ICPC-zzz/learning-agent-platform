import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";

const SYNTHETIC_SERVER_USER_ID = "reader-progress-sync-service-preview-server-user";

function makeDecision(overrides) {
  var o = overrides || {};
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
  var o = overrides || {};
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

function makePollutedRecord(overrides) {
  var o = overrides || {};
  var record = Object.create(null);

  record.id = o.id !== undefined ? o.id : "progress-123";
  record.userId =
    o.userId !== undefined ? o.userId : SYNTHETIC_SERVER_USER_ID;
  record.bookId = o.bookId !== undefined ? o.bookId : "book-123";
  record.chapterId = o.chapterId !== undefined ? o.chapterId : "chapter-456";
  record.lastChunkId = o.lastChunkId !== undefined ? o.lastChunkId : "chunk-99";
  record.progressRatio = o.progressRatio !== undefined ? o.progressRatio : 0.72;
  record.completedAt =
    o.completedAt !== undefined ? o.completedAt : new Date("2026-06-06T12:00:00.000Z");
  record.createdAt =
    o.createdAt !== undefined ? o.createdAt : new Date("2026-06-06T11:59:00.000Z");
  record.updatedAt =
    o.updatedAt !== undefined ? o.updatedAt : new Date("2026-06-06T12:01:00.000Z");
  record.token = "token-secret";
  record.cookie = "cookie-secret";
  record.session = { id: "session-secret" };
  record.rawDbRecord = { secret: "raw-db-secret" };
  record.metadata = { secret: "metadata-secret" };
  record.secret = "top-secret";
  Object.defineProperty(record, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(record, "constructor", {
    value: "constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(record, "prototype", {
    value: "prototype-secret",
    enumerable: true,
    configurable: true,
  });

  return record;
}

function makeFakePrismaClient(options) {
  var o = options || {};
  var calls = [];
  var findResult = o.findResult !== undefined ? o.findResult : null;
  var upsertResult = o.upsertResult !== undefined ? o.upsertResult : makePollutedRecord();
  var findError = o.findError || null;
  var upsertError = o.upsertError || null;
  var delegate = {
    findUnique: function (args) {
      calls.push({ kind: "findUnique", args: args });
      if (findError !== null) {
        throw findError;
      }
      return findResult;
    },
    findFirst: function (args) {
      calls.push({ kind: "findFirst", args: args });
      if (findError !== null) {
        throw findError;
      }
      return findResult;
    },
    upsert: function (args) {
      calls.push({ kind: "upsert", args: args });
      if (upsertError !== null) {
        throw upsertError;
      }
      return upsertResult;
    },
    create: function (args) {
      calls.push({ kind: "create", args: args });
      if (upsertError !== null) {
        throw upsertError;
      }
      return upsertResult;
    },
    update: function (args) {
      calls.push({ kind: "update", args: args });
      if (upsertError !== null) {
        throw upsertError;
      }
      return upsertResult;
    },
  };

  return {
    calls: calls,
    client: {
      readingProgress: delegate,
    },
  };
}

function mapDbRecordPreview(recordPreview, source) {
  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: source,
    bookId: recordPreview.bookId,
    chapterId: recordPreview.chapterId,
    progressRatio: recordPreview.progressRatio,
    lastChunkId: recordPreview.lastChunkId ?? null,
    completedAt: recordPreview.completedAt ?? null,
    updatedAt: recordPreview.updatedAt ?? null,
  };
}

function createWebBridge(fakeClient) {
  var delegate = fakeClient.readingProgress;

  return {
    findProgressByUserBookChapter: function (input) {
      var result = null;

      if (typeof delegate.findUnique === "function") {
        result = delegate.findUnique({
          where: {
            userId_bookId_chapterId: {
              userId: input.serverUserId,
              bookId: input.bookId,
              chapterId: input.chapterId,
            },
          },
        });
      } else if (typeof delegate.findFirst === "function") {
        result = delegate.findFirst({
          where: {
            userId: input.serverUserId,
            bookId: input.bookId,
            chapterId: input.chapterId,
          },
        });
      }

      if (result === null) {
        return null;
      }

      return mapDbRecordPreview(result, "existing");
    },
    upsertProgress: function (input) {
      var record = null;

      if (typeof delegate.upsert === "function") {
        record = delegate.upsert({
          where: {
            userId_bookId_chapterId: {
              userId: input.serverUserId,
              bookId: input.bookId,
              chapterId: input.chapterId,
            },
          },
          create: {
            user: { connect: { id: input.serverUserId } },
            book: { connect: { id: input.bookId } },
            chapter: { connect: { id: input.chapterId } },
            progressRatio: input.progressRatio,
            completedAt: input.progressRatio >= 1 ? new Date() : null,
          },
          update: {
            progressRatio: input.progressRatio,
            completedAt: input.progressRatio >= 1 ? new Date() : null,
          },
        });
      } else if (typeof delegate.create === "function" && typeof delegate.update === "function") {
        record = delegate.create({
          data: {
            user: { connect: { id: input.serverUserId } },
            book: { connect: { id: input.bookId } },
            chapter: { connect: { id: input.chapterId } },
            progressRatio: input.progressRatio,
            completedAt: input.progressRatio >= 1 ? new Date() : null,
          },
        });
      }

      if (record === null) {
        throw new Error(
          "Injected Prisma-compatible adapter did not complete the preview write path.",
        );
      }

      return mapDbRecordPreview(record, "upserted");
    },
    recordAuditLog: function (input) {
      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: "preview",
        persisted: false,
        auditId:
          "reader-sync-audit-preview:" +
          input.serverUserId +
          ":" +
          input.bookId +
          ":" +
          input.chapterId +
          ":" +
          input.progressRatio.toFixed(6),
        action: "reader.progress.sync.repository.audit-log",
        source: "preview",
        message: "Audit preview bridged from the injected fake Prisma-compatible client.",
        blockers: [],
        warnings: ["fake audit preview"],
      };
    },
    claimIdempotencyKey: function (input) {
      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: "preview",
        persisted: false,
        previewKey:
          input.idempotencyKeyPreview ||
          "reader-sync-idempotency-preview:" +
            input.serverUserId +
            ":" +
            input.bookId +
            ":" +
            input.chapterId +
            ":" +
            input.progressRatio.toFixed(6),
        action: "reader.progress.sync.repository.idempotency-claim",
        source: "preview",
        message:
          "Idempotency preview bridged from the injected fake Prisma-compatible client.",
        blockers: [],
        warnings: ["fake idempotency preview"],
      };
    },
  };
}

function makeServiceHarness(overrides) {
  var o = overrides || {};
  var fake = makeFakePrismaClient(o.fakeClient || {});
  var webAdapter = createReaderSyncPersistentRepositoryAdapter(
    createWebBridge(fake.client),
    makeAllowedAdapterOptions(o.adapterOptions),
  );

  return {
    fake: fake,
    webAdapter: webAdapter,
  };
}

test("service flows through the web adapter and fake client without leaking secrets", function () {
  var pollutedRequestPreview = Object.create(null);
  Object.assign(pollutedRequestPreview, {
    bookId: "book-123",
    chapterId: "chapter-456",
    progressRatio: 0.72,
    idempotencyKeyPreview:
      "reader-sync-preview:book-123:chapter-456:0.720000",
  });
  pollutedRequestPreview.userId = "client-user-secret";
  pollutedRequestPreview.role = "admin";
  pollutedRequestPreview.auditId = "audit-secret";
  pollutedRequestPreview.token = "token-secret";
  pollutedRequestPreview.cookie = "cookie-secret";
  pollutedRequestPreview.session = { id: "session-secret" };
  pollutedRequestPreview.rawDbRecord = { secret: "raw-db-secret" };
  pollutedRequestPreview.rawLocalStorage = "{local-storage-secret}";
  pollutedRequestPreview.metadata = { secret: "metadata-secret" };
  Object.defineProperty(pollutedRequestPreview, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(pollutedRequestPreview, "constructor", {
    value: "constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(pollutedRequestPreview, "prototype", {
    value: "prototype-secret",
    enumerable: true,
    configurable: true,
  });

  var harness = makeServiceHarness({
    fakeClient: {
      findResult: makePollutedRecord({
        progressRatio: 0.4,
      }),
      upsertResult: makePollutedRecord({
        progressRatio: 0.72,
      }),
    },
  });
  var decision = makeDecision({
    existingProgress: {
      progressRatio: 0.4,
    },
  });
  var result = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: decision,
      requestPreview: pollutedRequestPreview,
      options: {
        previewOnly: true,
        persistentAdapter: harness.webAdapter,
      },
    }),
  );
  var serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.status, "ready_preview");
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, true);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.persistentAdapterPreview.status, "preview");
  assert.equal(result.persistentAdapterPreview.source, "preview");
  assert.equal(result.persistentAdapterPreview.executed, true);
  assert.equal(result.persistentAdapterPreview.success, true);
  assert.equal(result.persistentAdapterPreview.callsRepository, true);
  assert.equal(result.persistentAdapterPreview.writePreview.status, "preview");
  assert.equal(result.persistentAdapterPreview.writePreview.executed, true);
  assert.equal(result.persistentAdapterPreview.writePreview.success, true);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.bookId, "book-123");
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.chapterId, "chapter-456");
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.progressRatio, 0.72);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.safeToExposeToClient, true);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.secret, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.token, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.cookie, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.session, undefined);
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview.rawDbRecord, undefined);
  assert.equal(
    Object.getPrototypeOf(result.persistentAdapterPreview.writePreview.persistedRecordPreview),
    Object.prototype,
  );
  assert.equal(harness.fake.calls.length, 2);
  assert.equal(harness.fake.calls[0].kind, "findUnique");
  assert.equal(harness.fake.calls[1].kind, "upsert");
  assert.equal(
    harness.fake.calls[1].args.where.userId_bookId_chapterId.userId,
    SYNTHETIC_SERVER_USER_ID,
  );
  assert.equal(
    harness.fake.calls[1].args.where.userId_bookId_chapterId.bookId,
    "book-123",
  );
  assert.equal(
    harness.fake.calls[1].args.where.userId_bookId_chapterId.chapterId,
    "chapter-456",
  );
  assert.equal(harness.fake.calls[1].args.create.progressRatio, 0.72);
  assert.equal(harness.fake.calls[1].args.update.progressRatio, 0.72);
  assert.equal(harness.fake.calls[1].args.create.user.connect.id, SYNTHETIC_SERVER_USER_ID);
  assert.equal(harness.fake.calls[1].args.create.book.connect.id, "book-123");
  assert.equal(harness.fake.calls[1].args.create.chapter.connect.id, "chapter-456");
  assert.equal(serialized.indexOf("token-secret"), -1);
  assert.equal(serialized.indexOf("cookie-secret"), -1);
  assert.equal(serialized.indexOf("session-secret"), -1);
  assert.equal(serialized.indexOf("raw-db-secret"), -1);
  assert.equal(serialized.indexOf("metadata-secret"), -1);
  assert.equal(serialized.indexOf("constructor-secret"), -1);
  assert.equal(serialized.indexOf("prototype-secret"), -1);
  assert.equal(result.normalizedPayload.bookId, "book-123");
  assert.equal(result.normalizedPayload.chapterId, "chapter-456");
  assert.equal(result.normalizedPayload.progressRatio, 0.72);
});

test("missing auth or readiness blocks the chain before the fake client upsert path", function () {
  var scenarios = [
    {
      label: "missing explicit authorization",
      adapterOptions: {
        explicitUserAuthorization: false,
        readinessGatePassed: true,
        auditReady: true,
        idempotencyReady: true,
        conflictResolutionReady: true,
        disabled: false,
      },
      blockedReason: "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
    },
    {
      label: "missing readiness gate",
      adapterOptions: {
        explicitUserAuthorization: true,
        readinessGatePassed: false,
        auditReady: true,
        idempotencyReady: true,
        conflictResolutionReady: true,
        disabled: false,
      },
      blockedReason: "READINESS_GATE_NOT_PASSED",
    },
    {
      label: "missing audit and idempotency readiness",
      adapterOptions: {
        explicitUserAuthorization: true,
        readinessGatePassed: true,
        auditReady: false,
        idempotencyReady: false,
        conflictResolutionReady: true,
        disabled: false,
      },
      blockedReasons: ["AUDIT_NOT_READY", "IDEMPOTENCY_NOT_READY"],
    },
  ];

  for (var index = 0; index < scenarios.length; index += 1) {
    var scenario = scenarios[index];
    var harness = makeServiceHarness({
      adapterOptions: scenario.adapterOptions,
      fakeClient: {
        findResult: makePollutedRecord({
          progressRatio: 0.4,
        }),
        upsertResult: makePollutedRecord({
          progressRatio: 0.72,
        }),
      },
    });
    var result = buildReaderProgressSyncServiceResult(
      makeServiceInput({
        decision: makeDecision({
          existingProgress: {
            progressRatio: 0.4,
          },
        }),
        options: {
          previewOnly: true,
          persistentAdapter: harness.webAdapter,
        },
      }),
    );

    assert.equal(result.status, "ready_preview", scenario.label);
    assert.equal(result.fakeWriteAttempted, true, scenario.label);
    assert.equal(result.fakeWriteApplied, false, scenario.label);
    assert.equal(result.persistentAdapterPreview.status, "blocked", scenario.label);
    assert.equal(result.persistentAdapterPreview.executed, false, scenario.label);
    assert.equal(result.persistentAdapterPreview.success, false, scenario.label);
    assert.equal(result.persistentAdapterPreview.writePreview.status, "blocked", scenario.label);
    assert.equal(harness.fake.calls.length, 0, scenario.label);

    if (scenario.blockedReason !== undefined) {
      assert.ok(
        result.persistentAdapterPreview.blockedReasons.some(function (reason) {
          return reason.indexOf(scenario.blockedReason) !== -1;
        }),
        scenario.label,
      );
    }

    if (scenario.blockedReasons !== undefined) {
      for (var reasonIndex = 0; reasonIndex < scenario.blockedReasons.length; reasonIndex += 1) {
        var expectedReason = scenario.blockedReasons[reasonIndex];
        assert.ok(
          result.persistentAdapterPreview.blockedReasons.some(function (reason) {
            return reason.indexOf(expectedReason) !== -1;
          }),
          scenario.label + ": " + expectedReason,
        );
      }
    }
  }
});

test("progress regression remains conflict and never reaches the fake upsert call", function () {
  var harness = makeServiceHarness({
    fakeClient: {
      findResult: makePollutedRecord({
        progressRatio: 0.9,
      }),
      upsertResult: makePollutedRecord({
        progressRatio: 0.9,
      }),
    },
  });
  var decision = makeDecision({
    existingProgress: {
      progressRatio: 0.4,
    },
  });
  var result = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: decision,
      options: {
        previewOnly: true,
        persistentAdapter: harness.webAdapter,
      },
    }),
  );

  assert.equal(result.status, "ready_preview");
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.persistentAdapterPreview.status, "conflict");
  assert.equal(result.persistentAdapterPreview.executed, false);
  assert.equal(result.persistentAdapterPreview.success, false);
  assert.equal(result.persistentAdapterPreview.writePreview.status, "conflict");
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview, null);
  assert.equal(harness.fake.calls.length, 1);
  assert.equal(harness.fake.calls[0].kind, "findUnique");
  assert.equal(
    result.persistentAdapterPreview.blockedReasons.some(function (reason) {
      return reason.indexOf("STALE_PROGRESS_REGRESSION") !== -1;
    }),
    true,
  );
});

test("fake client throws are converted into a safe blocked service result", function () {
  var harness = makeServiceHarness({
    fakeClient: {
      findResult: makePollutedRecord({
        progressRatio: 0.4,
      }),
      upsertError: new Error("database password=shh, stack should not leak"),
    },
  });
  var result = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: makeDecision({
        existingProgress: {
          progressRatio: 0.4,
        },
      }),
      options: {
        previewOnly: true,
        persistentAdapter: harness.webAdapter,
      },
    }),
  );
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "ready_preview");
  assert.equal(result.fakeWriteAttempted, true);
  assert.equal(result.fakeWriteApplied, false);
  assert.equal(result.persistentAdapterPreview.status, "blocked");
  assert.equal(result.persistentAdapterPreview.executed, false);
  assert.equal(result.persistentAdapterPreview.success, false);
  assert.equal(result.persistentAdapterPreview.writePreview.status, "blocked");
  assert.equal(result.persistentAdapterPreview.writePreview.persistedRecordPreview, null);
  assert.equal(harness.fake.calls.length, 2);
  assert.equal(harness.fake.calls[0].kind, "findUnique");
  assert.equal(harness.fake.calls[1].kind, "upsert");
  assert.equal(serialized.indexOf("shh"), -1);
  assert.equal(serialized.indexOf("stack should not leak"), -1);
  assert.ok(
    result.persistentAdapterPreview.blockedReasons.some(function (reason) {
      return reason.indexOf("INJECTED_CLIENT_THROWN") !== -1;
    }),
  );
  assert.ok(
    result.persistentAdapterPreview.warnings.some(function (warning) {
      return warning.indexOf("sanitized progress record preview") !== -1;
    }),
  );
});
