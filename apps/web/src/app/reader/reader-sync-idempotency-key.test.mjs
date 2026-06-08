import assert from "node:assert/strict";
import test from "node:test";

import {
  createBlockedReaderSyncIdempotencyPreview,
  createReaderSyncIdempotencyKeyPreview,
  validateReaderSyncIdempotencyKey,
} from "./reader-sync-idempotency-key.ts";

function makeInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: "server-user-001",
      bookId: "book-001",
      chapterId: "chapter-001",
      progressRatio: 0.72,
      source: "server-preview",
    },
    o,
  );
}

test("same safe input produces the same v1 idempotency key", function () {
  var input = makeInput();
  var resultA = createReaderSyncIdempotencyKeyPreview(input);
  var resultB = validateReaderSyncIdempotencyKey(input);

  assert.equal(resultA.previewOnly, true);
  assert.equal(resultA.status, "preview");
  assert.equal(resultA.allowed, true);
  assert.equal(resultA.idempotencyKeyPreview, resultB.idempotencyKeyPreview);
  assert.equal(resultA.idempotencyKeyPreview.indexOf("reader-sync-idempotency-v1:"), 0);
  assert.equal(resultA.materialPreview.serverUserId, "server-user-001");
  assert.equal(resultA.materialPreview.bookId, "book-001");
  assert.equal(resultA.materialPreview.chapterId, "chapter-001");
  assert.equal(resultA.materialPreview.progressRatio, 0.72);
  assert.equal(resultA.materialPreview.source, "server-preview");
});

test("changing chapterId progressRatio or source changes the v1 key", function () {
  var base = createReaderSyncIdempotencyKeyPreview(makeInput());
  var chapterChanged = createReaderSyncIdempotencyKeyPreview(
    makeInput({ chapterId: "chapter-002" }),
  );
  var progressChanged = createReaderSyncIdempotencyKeyPreview(
    makeInput({ progressRatio: 0.73 }),
  );
  var sourceChanged = createReaderSyncIdempotencyKeyPreview(
    makeInput({ source: "client-scroll" }),
  );

  assert.notEqual(base.idempotencyKeyPreview, chapterChanged.idempotencyKeyPreview);
  assert.notEqual(base.idempotencyKeyPreview, progressChanged.idempotencyKeyPreview);
  assert.notEqual(base.idempotencyKeyPreview, sourceChanged.idempotencyKeyPreview);
});

test("missing required fields are blocked", function () {
  var cases = [
    { label: "serverUserId", input: makeInput({ serverUserId: "" }) },
    { label: "bookId", input: makeInput({ bookId: "   " }) },
    { label: "chapterId", input: makeInput({ chapterId: null }) },
  ];

  cases.forEach(function (scenario) {
    var result = createReaderSyncIdempotencyKeyPreview(scenario.input);
    assert.equal(result.status, "blocked", scenario.label + " must be blocked");
    assert.equal(result.allowed, false, scenario.label + " must not be allowed");
    assert.equal(result.idempotencyKeyPreview, null, scenario.label + " must not emit a key");
    assert.equal(result.blockedReasons.length > 0, true, scenario.label + " must report blockers");
  });
});

test("progressRatio outside the safe range is blocked", function () {
  var resultLow = createReaderSyncIdempotencyKeyPreview(
    makeInput({ progressRatio: -0.01 }),
  );
  var resultHigh = createReaderSyncIdempotencyKeyPreview(
    makeInput({ progressRatio: 1.01 }),
  );

  assert.equal(resultLow.status, "blocked");
  assert.equal(resultLow.allowed, false);
  assert.equal(resultHigh.status, "blocked");
  assert.equal(resultHigh.allowed, false);
  assert.equal(
    resultLow.blockedReasons.some(function (reason) {
      return reason.indexOf("PROGRESS_RATIO_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(
    resultHigh.blockedReasons.some(function (reason) {
      return reason.indexOf("PROGRESS_RATIO_REQUIRED") !== -1;
    }),
    true,
  );
});

test("dangerous fields are rejected and never leak into the preview", function () {
  var input = Object.assign(Object.create(null), makeInput());
  input.token = "token-secret";
  input.cookie = "cookie-secret";
  input.session = { id: "session-secret" };
  input.rawDbRecord = { secret: "db-secret" };
  input.DATABASE_URL = "postgres://secret@example.invalid/db";
  input.secret = "secret-secret";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });

  var result = createReaderSyncIdempotencyKeyPreview(input);
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(result.allowed, false);
  assert.equal(Object.prototype.polluted, undefined);

  [
    "token-secret",
    "cookie-secret",
    "session-secret",
    "db-secret",
    "postgres://secret@example.invalid/db",
    "secret-secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "preview must not leak " + needle);
  });
});

test("blocked preview helper stays preview-only", function () {
  var result = createBlockedReaderSyncIdempotencyPreview("blocked for test");

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.idempotencyKeyPreview, null);
  assert.equal(result.summary, "blocked for test");
});
