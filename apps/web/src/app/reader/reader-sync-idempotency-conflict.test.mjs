import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyReaderSyncIdempotencyConflictPreview,
  createReaderSyncIdempotencyConflictTrackerForTest,
  rememberReaderSyncIdempotencyConflictPreview,
} from "./reader-sync-idempotency-conflict.ts";

function makeInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: "server-user-001",
      bookId: "book-001",
      chapterId: "chapter-001",
      progressRatio: 0.72,
      source: "server-preview",
      requestedAt: "2026-06-08T10:00:00.000Z",
    },
    o,
  );
}

function scopeKeyFromPreview(preview) {
  return [preview.serverUserId, preview.bookId, preview.chapterId].join("|");
}

test("duplicate-safe replay is preview-only and does not expose write-path access", function () {
  var tracker = createReaderSyncIdempotencyConflictTrackerForTest();
  var first = classifyReaderSyncIdempotencyConflictPreview(makeInput());

  assert.equal(first.status, "preview");
  assert.equal(first.allowed, true);
  assert.equal(first.success, false);
  assert.equal(first.writesDatabase, false);
  assert.equal(first.callsRepository, false);
  assert.equal(first.idempotencyKeyPreview.indexOf("reader-sync-idempotency-v1:"), 0);

  rememberReaderSyncIdempotencyConflictPreview(tracker, first);

  var duplicate = classifyReaderSyncIdempotencyConflictPreview(
    makeInput(),
    tracker.lookup(scopeKeyFromPreview(first)),
  );

  assert.equal(duplicate.status, "duplicate-safe");
  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.duplicateSafe, true);
  assert.equal(duplicate.conflictDetected, false);
  assert.equal(duplicate.changedPreview, false);
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.writesDatabase, false);
  assert.equal(duplicate.callsRepository, false);
  assert.equal(duplicate.previousIdempotencyKeyPreview, first.idempotencyKeyPreview);
  assert.equal(
    duplicate.blockedReasons.some(function (reason) {
      return reason.indexOf("DUPLICATE_SAFE_PREVIEW") !== -1;
    }),
    true,
  );
});

test("changed progress or source is classified as a changed-preview conflict", function () {
  var tracker = createReaderSyncIdempotencyConflictTrackerForTest();
  var first = classifyReaderSyncIdempotencyConflictPreview(makeInput());
  rememberReaderSyncIdempotencyConflictPreview(tracker, first);

  var changed = classifyReaderSyncIdempotencyConflictPreview(
    makeInput({
      progressRatio: 0.81,
      source: "client-scroll",
    }),
    tracker.lookup(scopeKeyFromPreview(first)),
  );

  assert.equal(changed.status, "changed-preview");
  assert.equal(changed.allowed, false);
  assert.equal(changed.duplicateSafe, false);
  assert.equal(changed.conflictDetected, true);
  assert.equal(changed.changedPreview, true);
  assert.equal(changed.success, false);
  assert.equal(changed.writesDatabase, false);
  assert.equal(changed.callsRepository, false);
  assert.equal(changed.previousIdempotencyKeyPreview, first.idempotencyKeyPreview);
  assert.equal(
    changed.blockedReasons.some(function (reason) {
      return reason.indexOf("CHANGED_PREVIEW_CONFLICT") !== -1;
    }),
    true,
  );
});

test("blocked or dangerous input stays blocked and never leaks unsafe fields", function () {
  var input = Object.assign(Object.create(null), makeInput({ bookId: "" }));
  input.token = "token-secret";
  input.cookie = "cookie-secret";
  input.session = { id: "session-secret" };
  input.rawDbRecord = { secret: "db-secret" };
  input.secret = "secret-secret";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });

  var result = classifyReaderSyncIdempotencyConflictPreview(input);
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(result.allowed, false);
  assert.equal(result.success, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(Object.prototype.polluted, undefined);

  [
    "token-secret",
    "cookie-secret",
    "session-secret",
    "db-secret",
    "secret-secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "blocked preview must not leak " + needle);
  });
});
