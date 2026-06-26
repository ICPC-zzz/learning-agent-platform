import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createDisabledReadingProgressRepositoryContract,
  createReadingProgressRepositoryContractPreview,
  validateReadingProgressIdentity,
  validateReadingProgressUpsertInput,
} from "./reading-progress-repository-contract.ts";

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

test("contract preview stays disabled and preview-only by default", function () {
  var contract = createDisabledReadingProgressRepositoryContract();

  assert.equal(contract.previewOnly, true);
  assert.equal(contract.implemented, false);
  assert.equal(contract.disabled, true);
  assert.equal(contract.version, 1);
  assert.equal(contract.targetModel, "ReadingProgress");
  assert.equal(contract.safetyStatus.previewOnly, true);
  assert.equal(contract.safetyStatus.disabled, true);
  assert.equal(contract.safetyStatus.readsDatabase, false);
  assert.equal(contract.safetyStatus.writesDatabase, false);
  assert.equal(contract.safetyStatus.callsPrisma, false);
  assert.equal(contract.safetyStatus.safeToExposeToClient, true);
  assert.equal(contract.capabilities.previewOnly, true);
  assert.equal(contract.capabilities.implemented, false);
  assert.equal(contract.capabilities.disabled, true);
  assert.equal(contract.capabilities.readsDatabase, false);
  assert.equal(contract.capabilities.writesDatabase, false);
  assert.equal(contract.capabilities.callsPrisma, false);
  assert.equal(contract.capabilities.safeToExposeToClient, true);
  assert.equal(contract.capabilities.mode, "disabled");
});

test("createReadingProgressRepositoryContractPreview returns the same disabled preview posture", function () {
  var contract = createReadingProgressRepositoryContractPreview();

  assert.equal(contract.previewOnly, true);
  assert.equal(contract.implemented, false);
  assert.equal(contract.disabled, true);
  assert.equal(contract.capabilities.mode, "disabled");
  assert.equal(contract.safetyStatus.label, "preview-only");
});

test("valid identity normalizes to a safe preview and never touches a database", function () {
  var result = validateReadingProgressIdentity(makeIdentity());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.disabled, true);
  assert.equal(result.readsDatabase, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsPrisma, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "preview");
  assert.equal(result.identity.serverUserId, "server-user-123");
  assert.equal(result.identity.bookId, "book-123");
  assert.equal(result.identity.chapterId, "chapter-456");
  assert.equal(result.identity.source, "server-context");
  assert.equal(result.blockers.length, 0);
  assert.ok(
    result.warnings.some(function (warning) {
      return warning.indexOf("preview-only") !== -1;
    }),
  );

  var contract = createDisabledReadingProgressRepositoryContract();
  var lookup = contract.findByUserBookChapter(makeIdentity());

  assert.equal(lookup.status, "preview");
  assert.equal(lookup.recordSnapshot.previewOnly, true);
  assert.equal(lookup.recordSnapshot.safeToExposeToClient, true);
  assert.equal(lookup.recordSnapshot.serverUserId, "server-user-123");
  assert.equal(lookup.recordSnapshot.bookId, "book-123");
  assert.equal(lookup.recordSnapshot.chapterId, "chapter-456");
  assert.equal(lookup.recordSnapshot.progressRatio, 0);
  assert.equal(lookup.recordSnapshot.lastChunkId, null);
  assert.equal(lookup.recordSnapshot.completedAt, null);
  assert.equal(lookup.recordSnapshot.updatedAt, null);
});

test("missing serverUserId, bookId, or chapterId blocks validation", function () {
  [
    { serverUserId: "" },
    { bookId: "" },
    { chapterId: "" },
  ].forEach(function (overrides) {
    var identity = makeIdentity(overrides);
    var result = validateReadingProgressIdentity(identity);

    assert.equal(result.status, "blocked");
    assert.equal(result.identity, null);
    assert.ok(result.blockers.length > 0);
  });
});

test("userId is not treated as serverUserId", function () {
  var result = validateReadingProgressIdentity({
    userId: "client-user",
    bookId: "book-123",
    chapterId: "chapter-456",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.identity, null);
  assert.ok(
    result.blockers.some(function (blocker) {
      return blocker.code === "FORBIDDEN_FIELD";
    }),
  );
  assert.ok(
    result.blockers.some(function (blocker) {
      return blocker.code === "INVALID_SERVER_USER_ID";
    }),
  );
});

test("progressRatio outside the allowed range is blocked", function () {
  [-0.01, 1.01].forEach(function (ratio) {
    var result = validateReadingProgressUpsertInput(makeUpsertInput({ progressRatio: ratio }));

    assert.equal(result.status, "blocked");
    assert.equal(result.input, null);
    assert.ok(
      result.blockers.some(function (blocker) {
        return blocker.code === "INVALID_PROGRESS_RATIO";
      }),
    );
  });
});

test("updatedAt is normalized to a safe ISO string", function () {
  var updatedAt = new Date("2026-06-06T12:34:56.000Z");
  var result = validateReadingProgressUpsertInput(
    makeUpsertInput({ updatedAt: updatedAt }),
  );

  assert.equal(result.status, "preview");
  assert.equal(result.normalizedUpdatedAt, "2026-06-06T12:34:56.000Z");
  assert.equal(result.input.updatedAt, "2026-06-06T12:34:56.000Z");
  assert.equal(Object.prototype.toString.call(result.input.updatedAt), "[object String]");

  var contract = createDisabledReadingProgressRepositoryContract();
  var upsert = contract.upsertProgress(
    makeUpsertInput({ updatedAt: updatedAt, progressRatio: 1 }),
  );

  assert.equal(upsert.status, "preview");
  assert.notEqual(upsert.recordSnapshot, null);
  assert.equal(upsert.recordSnapshot.updatedAt, "2026-06-06T12:34:56.000Z");
  assert.equal(upsert.recordSnapshot.completedAt, "2026-06-06T12:34:56.000Z");
});

test("dangerous fields are rejected and never leak into preview output", function () {
  var dirtyInput = Object.create(null);
  Object.assign(dirtyInput, makeUpsertInput());
  dirtyInput.userId = "evil-user";
  dirtyInput.role = "admin";
  dirtyInput.auditId = "audit-secret";
  dirtyInput.token = "token-secret";
  dirtyInput.cookie = "cookie-secret";
  dirtyInput.session = { id: "session-secret" };
  dirtyInput.rawDbRecord = { should: "not-leak" };
  dirtyInput.rawLocalStorage = "{secret}";
  dirtyInput.metadata = { should: "not-leak" };
  Object.defineProperty(dirtyInput, "__proto__", {
    value: { dangerous: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(dirtyInput, "constructor", {
    value: "constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(dirtyInput, "prototype", {
    value: "prototype-secret",
    enumerable: true,
    configurable: true,
  });

  var result = validateReadingProgressUpsertInput(dirtyInput);
  var contract = createDisabledReadingProgressRepositoryContract();
  var upsert = contract.upsertProgress(dirtyInput);
  var serialized = JSON.stringify(result) + JSON.stringify(upsert);

  assert.equal(result.status, "blocked");
  assert.equal(upsert.status, "blocked");
  assert.equal(serialized.indexOf("evil-user"), -1);
  assert.equal(serialized.indexOf("token-secret"), -1);
  assert.equal(serialized.indexOf("cookie-secret"), -1);
  assert.equal(serialized.indexOf("session-secret"), -1);
  assert.equal(serialized.indexOf("not-leak"), -1);
  assert.equal(serialized.indexOf("constructor-secret"), -1);
  assert.equal(serialized.indexOf("prototype-secret"), -1);
  assert.ok(
    result.blockers.some(function (blocker) {
      return blocker.code === "FORBIDDEN_FIELD";
    }),
  );
});

test("preview audit and idempotency responses stay safe and deterministic", function () {
  var contract = createDisabledReadingProgressRepositoryContract();
  var input = makeUpsertInput();

  var auditPreview = contract.previewAudit(input);
  var idempotencyPreview = contract.previewIdempotency(input);

  assert.equal(auditPreview.previewOnly, true);
  assert.equal(auditPreview.safeToExposeToClient, true);
  assert.equal(auditPreview.persisted, false);
  assert.equal(auditPreview.status, "preview");
  assert.ok(auditPreview.auditId.indexOf("reading-progress-audit-preview:") === 0);

  assert.equal(idempotencyPreview.previewOnly, true);
  assert.equal(idempotencyPreview.safeToExposeToClient, true);
  assert.equal(idempotencyPreview.persisted, false);
  assert.equal(idempotencyPreview.status, "preview");
  assert.ok(
    idempotencyPreview.previewKey.indexOf("reading-progress-idempotency-preview:") === 0,
  );
});

test("contract source stays backend-free and does not read environment state", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reading-progress-repository-contract.ts");
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
  assert.equal(/@prisma/i.test(content), false);
});
