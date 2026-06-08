import assert from "node:assert/strict";
import test from "node:test";

import { createReadingProgressPrismaRepositoryAdapter } from "../../../../../packages/db/src/reading-progress-prisma-adapter.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";

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

function makeWebWriteInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: o.serverUserId !== undefined ? o.serverUserId : "server-user-123",
      bookId: o.bookId !== undefined ? o.bookId : "book-123",
      chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-456",
      progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.8,
      idempotencyKeyPreview:
        o.idempotencyKeyPreview !== undefined
          ? o.idempotencyKeyPreview
          : "reader-sync-preview:book-123:chapter-456:0.800000",
      lastChunkId: o.lastChunkId !== undefined ? o.lastChunkId : "chunk-99",
    },
    o,
  );
}

function makeRawDbRecord(overrides) {
  var o = overrides || {};
  var record = Object.create(null);

  record.id = o.id !== undefined ? o.id : "progress-123";
  record.userId = o.userId !== undefined ? o.userId : "server-user-123";
  record.bookId = o.bookId !== undefined ? o.bookId : "book-123";
  record.chapterId = o.chapterId !== undefined ? o.chapterId : "chapter-456";
  record.lastChunkId = o.lastChunkId !== undefined ? o.lastChunkId : "chunk-99";
  record.progressRatio = o.progressRatio !== undefined ? o.progressRatio : 0.8;
  record.completedAt =
    o.completedAt !== undefined ? o.completedAt : new Date("2026-06-06T13:00:00.000Z");
  record.createdAt =
    o.createdAt !== undefined ? o.createdAt : new Date("2026-06-06T12:59:00.000Z");
  record.updatedAt =
    o.updatedAt !== undefined ? o.updatedAt : new Date("2026-06-06T13:01:00.000Z");
  record.token = "token-secret";
  record.session = { id: "session-secret" };
  record.rawDbRecord = { secret: "raw-db-secret" };
  record.secret = "top-secret";
  record.metadata = { should: "not-leak" };
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
  var upsertResult = o.upsertResult !== undefined ? o.upsertResult : makeRawDbRecord();
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

function createWebBridge(dbAdapter) {
  return {
    findProgressByUserBookChapter: function (input) {
      var result = dbAdapter.findByUserBookChapter(input);

      if (result.status !== "found" || result.recordPreview === null) {
        return null;
      }

      return mapDbRecordPreview(result.recordPreview, "existing");
    },
    upsertProgress: function (input) {
      var result = dbAdapter.upsertProgress(input);

      if (result.status !== "upserted" || result.recordPreview === null) {
        throw new Error(
          "Injected Prisma-compatible adapter did not complete the preview write path.",
        );
      }

      return mapDbRecordPreview(result.recordPreview, "upserted");
    },
    recordAuditLog: function (input) {
      var preview = dbAdapter.previewAudit({
        serverUserId: input.serverUserId,
        bookId: input.bookId,
        chapterId: input.chapterId,
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
        source: preview.source === "preview" ? "preview" : "blocked",
        message:
          preview.status === "preview"
            ? "Audit preview bridged from the injected Prisma-compatible adapter."
            : "Audit preview blocked by the injected Prisma-compatible adapter.",
        blockers: preview.blockers.slice(),
        warnings: preview.warnings.slice(),
      };
    },
    claimIdempotencyKey: function (input) {
      var preview = dbAdapter.previewIdempotency({
        serverUserId: input.serverUserId,
        bookId: input.bookId,
        chapterId: input.chapterId,
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
        source: preview.source === "preview" ? "preview" : "blocked",
        message:
          preview.status === "preview"
            ? "Idempotency preview bridged from the injected Prisma-compatible adapter."
            : "Idempotency preview blocked by the injected Prisma-compatible adapter.",
        blockers: preview.blockers.slice(),
        warnings: preview.warnings.slice(),
      };
    },
  };
}

function makeWebAdapter(options) {
  var o = options || {};
  var fake = makeFakePrismaClient(o.fakeClient || {});
  var dbAdapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var webAdapter = createReaderSyncPersistentRepositoryAdapter(
    createWebBridge(dbAdapter),
    makeAllowedAdapterOptions(),
  );

  return {
    fake: fake,
    dbAdapter: dbAdapter,
    webAdapter: webAdapter,
  };
}

test("web persistent adapter can flow through the db adapter and fake client without leaking secrets", function () {
  var harness = makeWebAdapter({
    fakeClient: {
      findResult: makeRawDbRecord({
        userId: "server-user-123",
        progressRatio: 0.4,
        updatedAt: new Date("2026-06-06T11:00:00.000Z"),
      }),
      upsertResult: makeRawDbRecord({
        userId: "server-user-123",
        progressRatio: 0.8,
        completedAt: new Date("2026-06-06T13:00:00.000Z"),
        updatedAt: new Date("2026-06-06T13:01:00.000Z"),
      }),
    },
  });

  var dbLookup = harness.dbAdapter.findByUserBookChapter({
    serverUserId: "server-user-123",
    bookId: "book-123",
    chapterId: "chapter-456",
  });
  assert.equal(typeof dbLookup.then, "undefined");

  var result = harness.webAdapter.previewWriteProgress(makeWebWriteInput());

  assert.equal(harness.fake.calls.length, 4);
  assert.equal(harness.fake.calls[0].kind, "findUnique");
  assert.equal(
    harness.fake.calls[0].args.where.userId_bookId_chapterId.userId,
    "server-user-123",
  );
  assert.equal(harness.fake.calls[1].kind, "findUnique");
  assert.equal(harness.fake.calls[2].kind, "findUnique");
  assert.equal(harness.fake.calls[3].kind, "upsert");
  assert.equal(
    harness.fake.calls[3].args.where.userId_bookId_chapterId.userId,
    "server-user-123",
  );
  assert.equal(result.status, "preview");
  assert.equal(result.executed, true);
  assert.equal(result.success, true);
  assert.equal(result.callsRepository, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.allowDatabaseWrite, true);
  assert.equal(result.allowRepositoryCall, true);
  assert.equal(result.readPreview.status, "found");
  assert.equal(result.auditPreview.status, "preview");
  assert.equal(result.idempotencyPreview.status, "preview");
  assert.equal(result.writeCandidatePreview.bookId, "book-123");
  assert.equal(result.writeCandidatePreview.chapterId, "chapter-456");
  assert.equal(result.writeCandidatePreview.progressRatio, 0.8);
  assert.equal(
    result.inputPreview.idempotencyKeyPreview,
    "reader-sync-preview:book-123:chapter-456:0.800000",
  );
  assert.equal(result.persistedRecordPreview.bookId, "book-123");
  assert.equal(result.persistedRecordPreview.chapterId, "chapter-456");
  assert.equal(result.persistedRecordPreview.progressRatio, 0.8);
  assert.equal(result.persistedRecordPreview.lastChunkId, "chunk-99");
  assert.equal(
    result.persistedRecordPreview.completedAt,
    "2026-06-06T13:00:00.000Z",
  );
  assert.equal(
    result.persistedRecordPreview.updatedAt,
    "2026-06-06T13:01:00.000Z",
  );
  assert.equal(result.persistedRecordPreview.safeToExposeToClient, true);
  assert.equal(result.persistedRecordPreview.secret, undefined);
  assert.equal(result.persistedRecordPreview.token, undefined);
  assert.equal(result.persistedRecordPreview.session, undefined);
  assert.equal(result.persistedRecordPreview.rawDbRecord, undefined);
  assert.equal(result.auditPreview.safeToExposeToClient, true);
  assert.equal(result.idempotencyPreview.safeToExposeToClient, true);
  assert.equal(JSON.stringify(result).indexOf("token-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("session-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("raw-db-secret"), -1);
  assert.equal(JSON.stringify(result).indexOf("top-secret"), -1);
});

test("web persistent adapter blocks a progress regression before the db adapter upsert path", function () {
  var harness = makeWebAdapter({
    fakeClient: {
      findResult: makeRawDbRecord({
        progressRatio: 0.9,
      }),
      upsertResult: makeRawDbRecord({
        progressRatio: 0.9,
      }),
    },
  });

  var result = harness.webAdapter.previewWriteProgress(
    makeWebWriteInput({
      progressRatio: 0.4,
      idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.400000",
    }),
  );

  assert.equal(result.status, "conflict");
  assert.equal(result.executed, false);
  assert.equal(result.success, false);
  assert.equal(result.callsRepository, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.allowDatabaseWrite, true);
  assert.equal(result.allowRepositoryCall, true);
  assert.equal(result.readPreview.status, "found");
  assert.equal(result.persistedRecordPreview, null);
  assert.equal(result.writeCandidatePreview, null);
  assert.equal(harness.fake.calls.length, 1);
  assert.equal(harness.fake.calls[0].kind, "findUnique");
  assert.equal(
    harness.fake.calls[0].args.where.userId_bookId_chapterId.userId,
    "server-user-123",
  );
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("STALE_PROGRESS_REGRESSION") !== -1;
    }),
  );
  assert.equal(JSON.stringify(result).indexOf("token-secret"), -1);
});

test("fake-client write failures are converted into a safe blocked web adapter result", function () {
  var harness = makeWebAdapter({
    fakeClient: {
      findResult: makeRawDbRecord({
        progressRatio: 0.4,
      }),
      upsertError: new Error("database password=shh, stack should not leak"),
    },
  });

  var result = harness.webAdapter.previewWriteProgress(
    makeWebWriteInput({
      progressRatio: 0.8,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.executed, false);
  assert.equal(result.success, false);
  assert.equal(result.callsRepository, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.allowDatabaseWrite, true);
  assert.equal(result.allowRepositoryCall, true);
  assert.equal(result.readPreview.status, "found");
  assert.equal(result.persistedRecordPreview, null);
  assert.equal(
    result.warnings.some(function (warning) {
      return warning.indexOf("did not return a sanitized progress record preview") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("INJECTED_CLIENT_THROWN") !== -1;
    }),
    true,
  );
  assert.equal(result.message.indexOf("shh"), -1);
  assert.equal(JSON.stringify(result).indexOf("database password=shh"), -1);
  assert.equal(JSON.stringify(result).indexOf("stack should not leak"), -1);
});
