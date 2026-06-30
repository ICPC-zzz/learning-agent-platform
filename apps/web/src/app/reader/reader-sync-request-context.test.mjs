/**
 * reader-sync-request-context.test.mjs --- A409
 *
 * Tests for Reader sync request context: blocked/allowed paths,
 * audit metadata, dangerous field rejection, idempotency handling.
 * NO real DB writes, NO real LLM calls, NO external API calls.
 *
 * Run:  node --experimental-strip-types --test reader-sync-request-context.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildReaderSyncRequestContext, createBlockedReaderSyncRequestContext } from "./reader-sync-request-context.ts";

function makeTrustedInput(overrides) {
  var o = overrides || {};
  return Object.assign({
    previewOnly: true, safeToExposeToClient: true,
    trustedServerUserId: "request-context-test-user",
    bookId: "request-context-book", chapterId: "request-context-chapter",
    progressPercent: 72.5, position: "chapter-3-paragraph-12",
    clientUpdatedAt: "2026-06-11T10:00:00.000Z",
    idempotencyKey: "reader-sync-idempotency-v1:test-request-context-key",
    requestSource: "server-preview",
    explicitUserAuthorization: true, canAccessBook: true,
    canAccessChapter: true, canWriteProgress: true,
  }, o);
}

function makeDangerousInput() {
  var input = Object.create(null);
  Object.assign(input, makeTrustedInput());
  input.userId = "client-user-id-dangerous";
  input.token = "dangerous-token";
  input.cookie = "dangerous-cookie";
  input.session = { id: "dangerous-session" };
  input.headers = { authorization: "Bearer dangerous" };
  input.rawDbRecord = { secret: "dangerous-db-record" };
  input.DATABASE_URL = "postgres://dangerous@example.invalid/db";
  input.secret = "dangerous-secret";
  Object.defineProperty(input, "__proto__", { value: { polluted: true }, enumerable: true, configurable: true });
  input.constructor = "dangerous-constructor";
  input.prototype = "dangerous-prototype";
  return input;
}

function assertBaseSafe(result, label) {
  assert.equal(result.previewOnly, true, label + " previewOnly");
  assert.equal(result.implemented, false, label + " implemented");
  assert.equal(result.safeToExposeToClient, true, label + " safeToExpose");
  assert.equal(result.productionReady, false, label + " productionReady");
  assert.equal(result.resultMetadata.writesDatabase, false, label + " writesDatabase");
  assert.equal(result.resultMetadata.callsRepository, false, label + " callsRepository");
}

test("missing trusted server user id blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ trustedServerUserId: null }));
  assertBaseSafe(result, "no server user");
  assert.equal(result.allowed, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("TRUSTED_SERVER_USER_ID_REQUIRED") !== -1; }));
});

test("missing explicit authorization blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ explicitUserAuthorization: false }));
  assertBaseSafe(result, "no auth");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("EXPLICIT_USER_AUTHORIZATION_REQUIRED") !== -1; }));
});

test("canAccessBook false blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ canAccessBook: false }));
  assertBaseSafe(result, "no book");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("CAN_ACCESS_BOOK_REQUIRED") !== -1; }));
});

test("canAccessChapter false blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ canAccessChapter: false }));
  assertBaseSafe(result, "no chapter");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("CAN_ACCESS_CHAPTER_REQUIRED") !== -1; }));
});

test("canWriteProgress false blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ canWriteProgress: false }));
  assertBaseSafe(result, "no write");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("CAN_WRITE_PROGRESS_REQUIRED") !== -1; }));
});

test("missing idempotencyKey blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ idempotencyKey: null }));
  assertBaseSafe(result, "no idem key");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("IDEMPOTENCY_KEY_REQUIRED") !== -1; }));
});

test("missing bookId blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ bookId: null }));
  assertBaseSafe(result, "no bookId");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("BOOK_ID_REQUIRED") !== -1; }));
});

test("missing chapterId blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ chapterId: null }));
  assertBaseSafe(result, "no chapterId");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.some(function (r) { return r.indexOf("CHAPTER_ID_REQUIRED") !== -1; }));
});

test("all flags missing multiple blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({
    trustedServerUserId: null, bookId: null, chapterId: null,
    canAccessBook: false, canAccessChapter: false, canWriteProgress: false,
    explicitUserAuthorization: false, idempotencyKey: null,
  }));
  assertBaseSafe(result, "all missing");
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReasons.length >= 3);
});

test("null input blocked", function () {
  var result = buildReaderSyncRequestContext(null);
  assertBaseSafe(result, "null");
  assert.equal(result.allowed, false);
});

test("undefined input blocked", function () {
  var result = buildReaderSyncRequestContext(undefined);
  assertBaseSafe(result, "undefined");
  assert.equal(result.allowed, false);
});

test("blocked helper safe fallback", function () {
  var result = createBlockedReaderSyncRequestContext("TEST_BLOCK_REASON");
  assertBaseSafe(result, "blocked helper");
  assert.equal(result.allowed, false);
  assert.equal(result.blockedReasons[0], "TEST_BLOCK_REASON");
  assert.equal(result.auditMetadata.decision, "blocked");
});

test("all preflight satisfied allowed", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput());
  assertBaseSafe(result, "allowed");
  assert.equal(result.allowed, true);
  assert.equal(result.status, "preview");
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.auditMetadata.decision, "allowed");
  assert.equal(result.auditMetadata.bookId, "request-context-book");
  assert.equal(result.auditMetadata.chapterId, "request-context-chapter");
});

test("userIdHash is shortened not raw userId", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ trustedServerUserId: "my-private-user-id-12345" }));
  var auditJson = JSON.stringify(result.auditMetadata);
  assert.equal(result.allowed, true);
  assert.ok(result.auditMetadata.userIdHash.indexOf("..") !== -1, "shortened");
  assert.equal(result.auditMetadata.userIdHash.indexOf("dev:"), 0, "prefixed");
  assert.equal(result.auditMetadata.userIdHash.indexOf("my-private-user-id-12345"), -1, "no raw userId in hash");
  assert.equal(auditJson.indexOf("my-private-user-id-12345"), -1, "no raw userId in audit json");
});

test("short userId preserved", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ trustedServerUserId: "abc" }));
  assert.equal(result.allowed, true);
  assert.equal(result.auditMetadata.userIdHash, "dev:abc");
});

test("audit metadata no dangerous fields", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput());
  var auditJson = JSON.stringify(result.auditMetadata);
  ["secret", "password", "apiKey", "DATABASE_URL"].forEach(function (f) {
    assert.equal(auditJson.indexOf(f), -1, "no " + f);
  });
  assert.equal(result.auditMetadata.eventType, "reader_sync_progress_attempt");
  assert.equal(result.auditMetadata.writesDatabase, false);
  assert.equal(result.auditMetadata.productionReady, false);
});

test("blocked audit shows blocked", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ canAccessBook: false }));
  assert.equal(result.auditMetadata.decision, "blocked");
  assert.ok(result.auditMetadata.blockedReasons.length > 0);
});

test("dangerous fields rejected and not leaked", function () {
  var result = buildReaderSyncRequestContext(makeDangerousInput());
  var s = JSON.stringify(result);
  assertBaseSafe(result, "dangerous");
  assert.equal(result.allowed, false);
  ["client-user-id-dangerous", "dangerous-token", "dangerous-cookie",
   "dangerous-session", "Bearer dangerous", "dangerous-db-record",
   "postgres://dangerous@example.invalid/db", "dangerous-secret"].forEach(function (n) {
    assert.equal(s.indexOf(n), -1, "must not leak " + n);
  });
});

test("result metadata correct allowed path", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput());
  assert.equal(result.resultMetadata.writesDatabase, false);
  assert.equal(result.resultMetadata.productionReady, false);
});

test("result metadata correct blocked path", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({ canAccessBook: false }));
  assert.equal(result.resultMetadata.writesDatabase, false);
  assert.equal(result.resultMetadata.productionReady, false);
});

test("allowed path does not write DB", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput());
  assert.equal(result.resultMetadata.writesDatabase, false);
  assert.equal(result.auditMetadata.writesDatabase, false);
});

test("all paths productionReady false", function () {
  assert.equal(buildReaderSyncRequestContext(makeTrustedInput()).productionReady, false);
  assert.equal(buildReaderSyncRequestContext(makeTrustedInput({ canAccessBook: false })).productionReady, false);
  assert.equal(buildReaderSyncRequestContext(null).productionReady, false);
});

test("idempotency key digest safe", function () {
  var result = buildReaderSyncRequestContext(makeTrustedInput({
    idempotencyKey: "reader-sync-idempotency-v1:specific-test-key-abc123",
  }));
  assert.equal(result.allowed, true);
  assert.equal(typeof result.auditMetadata.idempotencyKeyDigest, "string", "digest is string");
  assert.ok(result.auditMetadata.idempotencyKeyDigest.length <= 24, "digest <= 24 chars");
  assert.equal(result.auditMetadata.idempotencyKeyDigest.indexOf("specific-test-key-abc123"), -1, "no raw key in digest");
});
