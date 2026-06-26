import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";

function makeWriteInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: "user-123",
      bookId: "book-123",
      chapterId: "chapter-456",
      progressRatio: 0.72,
      idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.720000",
      lastChunkId: "chunk-9",
    },
    o,
  );
}

function makeFakeDependencies(existingProgress, recorder) {
  var calls = recorder || [];
  return {
    calls: calls,
    findProgressByUserBookChapter: function (input) {
      calls.push(["read", input]);
      return existingProgress;
    },
    upsertProgress: function (input) {
      calls.push(["upsert", input]);
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
      calls.push(["audit", input]);
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
      calls.push(["idempotency", input]);
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
  };
}

function makeBlockedOptions(overrides) {
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

test("default options keep the adapter disabled and never call injected fake repository functions", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(null, calls),
  );
  var result = adapter.previewWriteProgress(makeWriteInput());

  assert.equal(adapter.capabilities.previewOnly, true);
  assert.equal(adapter.capabilities.implemented, false);
  assert.equal(adapter.capabilities.disabled, true);
  assert.equal(adapter.capabilities.allowDatabaseWrite, false);
  assert.equal(adapter.capabilities.allowRepositoryCall, false);
  assert.equal(adapter.capabilities.writesDatabase, false);
  assert.equal(adapter.capabilities.callsRepository, false);
  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.executable, false);
  assert.equal(result.executed, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.status, "blocked");
  assert.equal(calls.length, 0);
});

test("missing explicitUserAuthorization blocks the fake write path", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(null, calls),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = adapter.previewWriteProgress(makeWriteInput());

  assert.equal(result.status, "blocked");
  assert.equal(result.executed, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("EXPLICIT_USER_AUTHORIZATION_REQUIRED") !== -1;
    }),
  );
});

test("readiness gate failure blocks the fake write path", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(null, calls),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      explicitUserAuthorization: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = adapter.previewWriteProgress(makeWriteInput());

  assert.equal(result.status, "blocked");
  assert.equal(result.executed, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("READINESS_GATE_NOT_PASSED") !== -1;
    }),
  );
});

test("missing audit or idempotency readiness blocks before repository calls", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(null, calls),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = adapter.previewWriteProgress(makeWriteInput());

  assert.equal(result.status, "blocked");
  assert.equal(result.executed, false);
  assert.equal(calls.length, 0);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("AUDIT_NOT_READY") !== -1;
    }),
  );
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("IDEMPOTENCY_NOT_READY") !== -1;
    }),
  );
});

test("incoming progress below existing progress is blocked without upsert", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(
      {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "existing",
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.9,
        lastChunkId: "chunk-9",
        completedAt: null,
        updatedAt: "2026-06-06T11:59:59.000Z",
        secret: "should-not-leak",
      },
      calls,
    ),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = adapter.previewWriteProgress(
    makeWriteInput({
      progressRatio: 0.4,
    }),
  );

  assert.equal(result.status, "conflict");
  assert.equal(result.executed, false);
  assert.equal(result.callsRepository, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "read");
  assert.equal(JSON.stringify(result).indexOf("should-not-leak"), -1);
  assert.equal(result.persistedRecordPreview, null);
  assert.equal(result.writeCandidatePreview, null);
});

test("fake allowed options call the injected upsert exactly once and sanitize leaked fields", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(
      {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "existing",
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.5,
        lastChunkId: null,
        completedAt: null,
        updatedAt: "2026-06-06T11:59:59.000Z",
      },
      calls,
    ),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var result = adapter.previewWriteProgress(
    makeWriteInput({
      progressRatio: 0.8,
      idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.800000",
      lastChunkId: "chunk-99",
    }),
  );

  assert.equal(result.status, "preview");
  assert.equal(result.executed, true);
  assert.equal(result.success, true);
  assert.equal(result.callsRepository, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], "read");
  assert.equal(calls[1][0], "idempotency");
  assert.equal(calls[2][0], "audit");
  assert.equal(calls[3][0], "upsert");
  assert.equal(result.persistedRecordPreview.bookId, "book-123");
  assert.equal(result.persistedRecordPreview.chapterId, "chapter-456");
  assert.equal(result.persistedRecordPreview.progressRatio, 0.8);
  assert.equal(result.persistedRecordPreview.secret, undefined);
  assert.equal(result.persistedRecordPreview.token, undefined);
  assert.equal(result.persistedRecordPreview.session, undefined);
  assert.equal(result.persistedRecordPreview.rawDbRecord, undefined);
  assert.equal(result.auditPreview.secret, undefined);
  assert.equal(result.auditPreview.token, undefined);
  assert.equal(result.idempotencyPreview.secret, undefined);
  assert.equal(result.idempotencyPreview.cookie, undefined);
  assert.equal(JSON.stringify(result).indexOf("should-not-leak"), -1);
  assert.equal(JSON.stringify(result).indexOf("rawDbRecord"), -1);
});

test("dangerous input fields are rejected and never trusted or leaked", function () {
  var calls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakeDependencies(null, calls),
    makeBlockedOptions({
      allowRepositoryCall: true,
      allowDatabaseWrite: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    }),
  );
  var pollutedInput = Object.create(null);
  Object.assign(pollutedInput, makeWriteInput());
  pollutedInput.userId = "evil-user";
  pollutedInput.role = "admin";
  pollutedInput.auditId = "audit-secret";
  pollutedInput.token = "token-secret";
  pollutedInput.cookie = "cookie-secret";
  pollutedInput.session = { id: "session-secret" };
  pollutedInput.rawLocalStorage = "{secret}";
  Object.defineProperty(pollutedInput, "__proto__", {
    value: { dangerous: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(pollutedInput, "constructor", {
    value: "constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(pollutedInput, "prototype", {
    value: "prototype-secret",
    enumerable: true,
    configurable: true,
  });

  var result = adapter.previewWriteProgress(pollutedInput);
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(calls.length, 0);
  [
    "evil-user",
    "admin",
    "audit-secret",
    "token-secret",
    "cookie-secret",
    "session-secret",
    "{secret}",
    "constructor-secret",
    "prototype-secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "result must not leak " + needle);
  });
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_FIELD") !== -1;
    }),
  );
});

test("adapter source stays self-contained and backend-free", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-persistent-repository-adapter.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  var content = fs.readFileSync(filePath, "utf-8");

  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage/.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
});
