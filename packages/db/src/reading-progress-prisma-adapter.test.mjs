import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createReadingProgressPrismaRepositoryAdapter,
} from "./reading-progress-prisma-adapter.ts";

function makeIdentity(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: o.serverUserId !== undefined ? o.serverUserId : "server-user-123",
      bookId: o.bookId !== undefined ? o.bookId : "book-123",
      chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-456",
    },
    o,
  );
}

function makeUpsertInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: o.serverUserId !== undefined ? o.serverUserId : "server-user-123",
      bookId: o.bookId !== undefined ? o.bookId : "book-123",
      chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-456",
      progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.72,
      lastChunkId: o.lastChunkId !== undefined ? o.lastChunkId : "chunk-9",
      updatedAt:
        o.updatedAt !== undefined ? o.updatedAt : "2026-06-06T12:00:00.000Z",
      idempotencyKeyPreview:
        o.idempotencyKeyPreview !== undefined
          ? o.idempotencyKeyPreview
          : "reading-progress-idempotency-preview:book-123:chapter-456:0.720000",
    },
    o,
  );
}

function makeRawRecord(overrides) {
  var o = overrides || {};
  var record = Object.create(null);

  record.id = o.id !== undefined ? o.id : "progress-123";
  record.userId = o.userId !== undefined ? o.userId : "server-user-123";
  record.bookId = o.bookId !== undefined ? o.bookId : "book-123";
  record.chapterId = o.chapterId !== undefined ? o.chapterId : "chapter-456";
  record.lastChunkId = o.lastChunkId !== undefined ? o.lastChunkId : "chunk-9";
  record.progressRatio = o.progressRatio !== undefined ? o.progressRatio : 0.72;
  record.completedAt =
    o.completedAt !== undefined ? o.completedAt : new Date("2026-06-06T12:00:00.000Z");
  record.createdAt =
    o.createdAt !== undefined ? o.createdAt : new Date("2026-06-06T11:59:00.000Z");
  record.updatedAt =
    o.updatedAt !== undefined ? o.updatedAt : new Date("2026-06-06T12:01:00.000Z");
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

function makeFakeClient(options) {
  var o = options || {};
  var calls = [];
  var findResult = o.findResult !== undefined ? o.findResult : null;
  var upsertResult = o.upsertResult !== undefined ? o.upsertResult : makeRawRecord();
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

test("adapter capabilities advertise injected-client posture", function () {
  var adapter = createReadingProgressPrismaRepositoryAdapter(
    makeFakeClient().client,
  );

  assert.equal(adapter.safetyStatus.previewOnly, false);
  assert.equal(adapter.safetyStatus.implemented, true);
  assert.equal(adapter.safetyStatus.runtimeConnected, false);
  assert.equal(adapter.safetyStatus.usesInjectedClient, true);
  assert.equal(adapter.safetyStatus.safeToExposeToClient, false);
  assert.equal(adapter.safetyStatus.label, "injected-client");
  assert.equal(adapter.capabilities.adapterImplemented, true);
  assert.equal(adapter.capabilities.mode, "injected-client");
  assert.equal(adapter.capabilities.targetModel, "ReadingProgress");
});

test("findByUserBookChapter maps schema userId to serverUserId and sanitizes output", async function () {
  var fake = makeFakeClient({
    findResult: makeRawRecord({
      userId: "server-user-999",
      progressRatio: 0.55,
    }),
  });
  var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var result = await adapter.findByUserBookChapter(makeIdentity());

  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].kind, "findUnique");
  assert.equal(
    fake.calls[0].args.where.userId_bookId_chapterId.userId,
    "server-user-123",
  );
  assert.equal(result.status, "found");
  assert.equal(result.readsDatabase, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.identity.serverUserId, "server-user-123");
  assert.equal(result.recordPreview.serverUserId, "server-user-999");
  assert.equal(result.recordPreview.progressRatio, 0.55);
  assert.equal(result.recordPreview.lastChunkId, "chunk-9");
  assert.equal(result.recordPreview.completedAt, "2026-06-06T12:00:00.000Z");
  assert.equal(result.recordPreview.createdAt, "2026-06-06T11:59:00.000Z");
  assert.equal(result.recordPreview.updatedAt, "2026-06-06T12:01:00.000Z");
  assert.equal(result.recordPreview.safeToExposeToClient, false);
  assert.equal(Object.getPrototypeOf(result.recordPreview), Object.prototype);

  var serialized = JSON.stringify(result);
  assert.equal(serialized.indexOf("token-secret"), -1);
  assert.equal(serialized.indexOf("session-secret"), -1);
  assert.equal(serialized.indexOf("raw-db-secret"), -1);
  assert.equal(serialized.indexOf("top-secret"), -1);
  assert.equal(serialized.indexOf("constructor-secret"), -1);
  assert.equal(serialized.indexOf("prototype-secret"), -1);
});

test("upsertProgress calls injected upsert once and never passes forbidden fields", async function () {
  var fake = makeFakeClient({
    findResult: makeRawRecord({
      progressRatio: 0.4,
      updatedAt: new Date("2026-06-06T11:00:00.000Z"),
    }),
    upsertResult: makeRawRecord({
      userId: "server-user-123",
      progressRatio: 0.9,
      completedAt: new Date("2026-06-06T13:00:00.000Z"),
      updatedAt: new Date("2026-06-06T13:01:00.000Z"),
    }),
  });
  var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var result = await adapter.upsertProgress(
    makeUpsertInput({
      progressRatio: 0.9,
      updatedAt: new Date("2026-06-06T12:34:56.000Z"),
      lastChunkId: "chunk-99",
    }),
  );

  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[0].kind, "findUnique");
  assert.equal(fake.calls[1].kind, "upsert");
  assert.equal(result.status, "upserted");
  assert.equal(result.readsDatabase, true);
  assert.equal(result.writesDatabase, true);
  assert.equal(result.input.updatedAt, "2026-06-06T12:34:56.000Z");
  assert.equal(result.recordPreview.serverUserId, "server-user-123");
  assert.equal(result.recordPreview.progressRatio, 0.9);
  assert.equal(result.recordPreview.completedAt, "2026-06-06T13:00:00.000Z");
  assert.equal(result.recordPreview.updatedAt, "2026-06-06T13:01:00.000Z");
  assert.equal(result.recordPreview.secret, undefined);
  assert.equal(result.recordPreview.session, undefined);
  assert.equal(result.recordPreview.rawDbRecord, undefined);
  assert.equal(result.recordPreview.safeToExposeToClient, false);
  assert.equal(Object.getPrototypeOf(result.recordPreview), Object.prototype);

  assert.equal(
    fake.calls[1].args.where.userId_bookId_chapterId.userId,
    "server-user-123",
  );
  assert.equal(fake.calls[1].args.create.user.connect.id, "server-user-123");
  assert.equal(fake.calls[1].args.create.book.connect.id, "book-123");
  assert.equal(fake.calls[1].args.create.chapter.connect.id, "chapter-456");
  assert.equal(fake.calls[1].args.create.progressRatio, 0.9);
  assert.equal(fake.calls[1].args.update.progressRatio, 0.9);
  assert.equal(
    Object.prototype.hasOwnProperty.call(fake.calls[1].args.create, "updatedAt"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(fake.calls[1].args.update, "updatedAt"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(fake.calls[1].args.create, "userId"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(fake.calls[1].args.update, "userId"),
    false,
  );

  var serialized = JSON.stringify(result);
  assert.equal(serialized.indexOf("token-secret"), -1);
  assert.equal(serialized.indexOf("session-secret"), -1);
  assert.equal(serialized.indexOf("raw-db-secret"), -1);
  assert.equal(serialized.indexOf("top-secret"), -1);
});

test("progressRatio regression blocks upsert before the fake write path", async function () {
  var fake = makeFakeClient({
    findResult: makeRawRecord({
      progressRatio: 0.9,
    }),
  });
  var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var result = await adapter.upsertProgress(
    makeUpsertInput({
      progressRatio: 0.4,
    }),
  );

  assert.equal(result.status, "conflict");
  assert.equal(result.readsDatabase, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].kind, "findUnique");
  assert.equal(result.existingRecordPreview.serverUserId, "server-user-123");
  assert.equal(result.recordPreview, null);
});

test("missing serverUserId, bookId, chapterId, or invalid ratio blocks before any client call", async function () {
  var cases = [
    { serverUserId: "" },
    { bookId: "" },
    { chapterId: "" },
    { progressRatio: -0.01 },
    { progressRatio: 1.01 },
  ];

  for (var index = 0; index < cases.length; index += 1) {
    var fake = makeFakeClient();
    var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
    var result = await adapter.upsertProgress(makeUpsertInput(cases[index]));

    assert.equal(result.status, "blocked", "case " + index + " must be blocked");
    assert.equal(fake.calls.length, 0, "case " + index + " must not call client");
    assert.equal(result.recordPreview, null);
  }
});

test("preview helpers stay deterministic and do not call the injected client", async function () {
  var fake = makeFakeClient();
  var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var audit = await adapter.previewAudit(makeUpsertInput());
  var idempotency = await adapter.previewIdempotency(makeUpsertInput());

  assert.equal(fake.calls.length, 0);
  assert.equal(audit.status, "preview");
  assert.equal(idempotency.status, "preview");
  assert.ok(audit.auditId.indexOf("reading-progress-audit-preview:") === 0);
  assert.ok(
    idempotency.previewKey.indexOf("reading-progress-idempotency-preview:") === 0,
  );
});

test("client errors are converted into safe internal errors without leaking secrets or stacks", async function () {
  var fake = makeFakeClient({
    findResult: makeRawRecord({
      progressRatio: 0.4,
    }),
    upsertError: new Error("database password=shh, stack should not leak"),
  });
  var adapter = createReadingProgressPrismaRepositoryAdapter(fake.client);
  var result = await adapter.upsertProgress(
    makeUpsertInput({
      progressRatio: 0.8,
    }),
  );

  assert.equal(result.status, "error");
  assert.equal(result.readsDatabase, true);
  assert.equal(result.writesDatabase, true);
  assert.equal(result.recordPreview, null);
  assert.equal(result.message.indexOf("shh"), -1);
  assert.equal(JSON.stringify(result).indexOf("database password=shh"), -1);
  assert.equal(JSON.stringify(result).indexOf("stack should not leak"), -1);
});

test("adapter source stays backend-free and does not import PrismaClient or env state", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reading-progress-prisma-adapter.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");

  assert.equal(/process\.env/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage/.test(content), false);
  assert.equal(/from\s+["'].*@prisma\/client/i.test(content), false);
  assert.equal(/import\s+.*PrismaClient/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
});
