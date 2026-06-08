import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";

function makeInput(overrides) {
  var o = overrides || {};
  var serverContext = Object.assign(
    {
      hasAuthenticatedUser: true,
      serverUserId: "user-123",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o.serverContext || {},
  );
  var payload = Object.assign(
    {
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.6,
      idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
    },
    o.payload || {},
  );

  return {
    serverContext: serverContext,
    payload: payload,
    existingProgress: o.existingProgress,
    options: o.options,
  };
}

test("valid payload and full server context without existing progress returns ready_preview", function () {
  var result = buildReaderProgressSyncDecision(makeInput());
  assert.equal(result.status, "ready_preview");
  assert.equal(result.operationPreview, "upsert-reading-progress-preview");
  assert.equal(result.executesWrite, false);
  assert.equal(result.normalizedPayload.bookId, "book-1");
});

test("ready_preview still stays preview only and not implemented", function () {
  var result = buildReaderProgressSyncDecision(makeInput());
  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.executesWrite, false);
  assert.equal(result.blockers.length, 0);
});

test("missing authenticated user returns blocked", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ serverContext: { hasAuthenticatedUser: false } }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some(function (item) { return item.code === "AUTH_REQUIRED"; }), true);
});

test("missing serverUserId returns blocked", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ serverContext: { serverUserId: "" } }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.blockers.some(function (item) {
      return item.code === "SERVER_USER_CONTEXT_REQUIRED";
    }),
    true,
  );
});

test("canAccessBook=false returns blocked", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ serverContext: { canAccessBook: false } }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some(function (item) { return item.code === "BOOK_ACCESS_DENIED"; }), true);
});

test("canAccessChapter=false returns blocked", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ serverContext: { canAccessChapter: false } }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some(function (item) { return item.code === "CHAPTER_ACCESS_DENIED"; }), true);
});

test("canWriteProgress=false returns blocked", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ serverContext: { canWriteProgress: false } }),
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some(function (item) { return item.code === "WRITE_PROGRESS_DENIED"; }), true);
});

test("client payload userId is rejected as invalid", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ payload: { userId: "evil-user" } }),
  );
  assert.equal(result.status, "invalid");
  assert.equal(
    result.blockers.some(function (item) {
      return item.code === "FORBIDDEN_PAYLOAD_FIELD";
    }),
    true,
  );
});

test("prototype pollution keys are rejected as invalid", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ payload: { constructor: {} } }),
  );
  assert.equal(result.status, "invalid");
  assert.equal(result.blockers[0].code, "FORBIDDEN_PAYLOAD_FIELD");
});

test("progressRatio out of range is rejected", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ payload: { progressRatio: 1.5 } }),
  );
  assert.equal(result.status, "invalid");
  assert.equal(result.blockers[0].code, "INVALID_PROGRESS_RATIO");
});

test("incoming progress greater than existing progress returns ready_preview", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ existingProgress: { progressRatio: 0.4 } }),
  );
  assert.equal(result.status, "ready_preview");
  assert.equal(result.operationPreview, "upsert-reading-progress-preview");
});

test("incoming progress equal to existing progress returns noop", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ existingProgress: { progressRatio: 0.6 } }),
  );
  assert.equal(result.status, "noop");
  assert.equal(result.operationPreview, "none");
});

test("incoming progress lower than existing progress returns conflict with monotonic policy", function () {
  var result = buildReaderProgressSyncDecision(
    makeInput({ existingProgress: { progressRatio: 0.9 } }),
  );
  assert.equal(result.status, "conflict");
  assert.equal(result.conflict.policy, "progressRatio-monotonic-no-direct-regression");
  assert.equal(result.conflict.existingProgressRatio, 0.9);
  assert.equal(result.conflict.incomingProgressRatio, 0.6);
});

test("nextSafeSteps contain only safe prerequisites", function () {
  var result = buildReaderProgressSyncDecision(makeInput());
  var joined = result.nextSafeSteps.join(" ").toLowerCase();
  assert.equal(joined.indexOf("write db") === -1, true);
  assert.equal(joined.indexOf("real sync") === -1, true);
  assert.equal(joined.indexOf("bypass permission") === -1, true);
});

test("decision function does not call fetch", function () {
  var originalFetch = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () {
      called = true;
      return originalFetch.apply(this, arguments);
    };
    var result = buildReaderProgressSyncDecision(makeInput());
    assert.equal(called, false);
    assert.equal(result.previewOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("decision file does not import repository or prisma and does not call fetch", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-progress-sync-decision.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/import\s+.*repository/i.test(content), false);
  assert.equal(/from\s+["'].*repository/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*@prisma/i.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
});
