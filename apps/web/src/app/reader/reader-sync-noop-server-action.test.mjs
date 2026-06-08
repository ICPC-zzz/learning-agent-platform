import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  validateNoopInput,
  buildNoopNotImplementedResponse,
  ALLOWED_INPUT_KEYS,
  BANNED_INPUT_KEYS,
} from "./reader-sync-noop-server-action-core.ts";
import { evaluateReaderSyncReadinessGate } from "./reader-sync-readiness-gate.ts";

function makeValidInput(overrides) {
  var o = overrides || {};
  return {
    bookId: o.bookId !== undefined ? o.bookId : "book-test-001",
    chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-test-001",
    progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.5,
    idempotencyKeyPreview: o.idempotencyKeyPreview !== undefined ? o.idempotencyKeyPreview : "reader-sync-preview:book-test-001:chapter-test-001:0.500000",
    clientPreviewOnly: o.clientPreviewOnly !== undefined ? o.clientPreviewOnly : true,
  };
}

test("valid input returns previewOnly=true implemented=false success=false", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.success, false);
  assert.equal(result.auditId, null);
  assert.equal(result.serverProgressRatio, null);
  assert.equal(result.syncedFields.length, 0);
});

test("valid input returns SERVER_ACTION_NOT_IMPLEMENTED not success", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(result.status, "not_implemented");
  assert.equal(result.success, false);
  assert.equal(result.implemented, false);
  assert.ok(result.message.indexOf("NOT executed") !== -1 || result.message.indexOf("no-op") !== -1 || result.message.indexOf("not implemented") !== -1);
  assert.ok(result.message.indexOf("DB") !== -1 || result.message.indexOf("No DB write") !== -1);
});

test("valid input includes readinessGatePreview that stays preview-only and blocked", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  var expectedReadinessGate = evaluateReaderSyncReadinessGate();

  assert.notEqual(result.readinessGatePreview, undefined);
  assert.deepEqual(result.readinessGatePreview, expectedReadinessGate);
  assert.equal(result.readinessGatePreview.previewOnly, true);
  assert.equal(result.readinessGatePreview.implemented, false);
  assert.equal(result.readinessGatePreview.safeToExposeToClient, true);
  assert.equal(result.readinessGatePreview.status, "blocked");
  assert.equal(result.readinessGatePreview.canEnableRealSync, false);
  assert.equal(result.readinessGatePreview.mustRemainPreviewOnly, true);
  assert.equal(result.readinessGatePreview.executed, false);
  assert.equal(result.readinessGatePreview.writesDatabase, false);
  assert.equal(result.readinessGatePreview.callsRepository, false);
  assert.equal(result.readinessGatePreview.success, false);
  assert.ok(result.readinessGatePreview.blockedReasons.length > 0);
  assert.ok(result.readinessGatePreview.nextSafeSteps.length > 0);
  assert.equal(
    result.readinessGatePreview.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_NOT_READY") !== -1;
    }),
    true,
  );
  assert.equal(
    result.readinessGatePreview.blockedReasons.some(function (reason) {
      return reason.indexOf("EXPLICIT_USER_AUTHORIZATION_REQUIRED") !== -1;
    }),
    true,
  );
});

test("valid input includes syncDecisionPreview that stays blocked and preview only", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.notEqual(result.syncDecisionPreview, undefined);
  assert.equal(result.syncDecisionPreview.previewOnly, true);
  assert.equal(result.syncDecisionPreview.implemented, false);
  assert.equal(result.syncDecisionPreview.executesWrite, false);
  assert.equal(result.syncDecisionPreview.status, "blocked");
});

test("valid input includes syncServiceResultPreview that stays preview only", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.notEqual(result.syncServiceResultPreview, undefined);
  assert.equal(result.syncServiceResultPreview.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.implemented, false);
  assert.equal(result.syncServiceResultPreview.executed, false);
  assert.equal(result.syncServiceResultPreview.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.success, false);
  assert.equal(result.syncServiceResultPreview.status, "blocked");
  assert.equal(result.syncServiceResultPreview.errorCode, "SYNC_BLOCKED");
});

test("syncServiceResultPreview mirrors the no-op server auth gap safely", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.equal(result.syncServiceResultPreview.decisionStatus, "blocked");
  assert.equal(result.syncServiceResultPreview.safeToExposeToClient, true);
  assert.equal(result.syncServiceResultPreview.auditPreview.auditId, null);
  assert.equal(result.syncServiceResultPreview.idempotencyPreview.persisted, false);
});

test("syncDecisionPreview reflects missing real server auth context", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.equal(result.syncDecisionPreview.hasServerUserContext, false);
  assert.equal(
    result.syncDecisionPreview.blockers.some(function (item) {
      return item.code === "AUTH_REQUIRED";
    }),
    true,
  );
  assert.equal(
    result.syncDecisionPreview.blockers.some(function (item) {
      return item.code === "SERVER_USER_CONTEXT_REQUIRED";
    }),
    true,
  );
});

test("input with userId is rejected with INVALID_PAYLOAD", function () {
  var input = makeValidInput();
  input.userId = "evil-user-123";
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.success, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.message.indexOf("userId") !== -1 || result.message.indexOf("banned") !== -1);
});

test("input with role is rejected", function () {
  var input = makeValidInput();
  input.role = "admin";
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("input with auditId is rejected", function () {
  var input = makeValidInput();
  input.auditId = "audit-001";
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("input with serverProgressRatio is rejected", function () {
  var input = makeValidInput();
  input.serverProgressRatio = 0.8;
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("input with rawLocalStorage is rejected", function () {
  var input = makeValidInput();
  input.rawLocalStorage = "{ huge blob }";
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("input with metadata is rejected", function () {
  var input = makeValidInput();
  input.metadata = { injected: true };
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("progressRatio above 1 is rejected", function () {
  var input = makeValidInput({ progressRatio: 1.5 });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
  assert.ok(result.message.indexOf("progressRatio") !== -1);
});

test("progressRatio below 0 is rejected", function () {
  var input = makeValidInput({ progressRatio: -0.1 });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("progressRatio Infinity or NaN is rejected", function () {
  var input1 = makeValidInput({ progressRatio: Infinity });
  var result1 = validateNoopInput(input1);
  assert.equal(result1.errorCode, "INVALID_PAYLOAD");
  var input2 = makeValidInput({ progressRatio: NaN });
  var result2 = validateNoopInput(input2);
  assert.equal(result2.errorCode, "INVALID_PAYLOAD");
});

test("bookId empty string is rejected", function () {
  var input = makeValidInput({ bookId: "" });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.ok(result.message.indexOf("bookId") !== -1);
});

test("bookId non-string is rejected", function () {
  var input = makeValidInput({ bookId: 12345 });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("chapterId empty string is rejected", function () {
  var input = makeValidInput({ chapterId: "   " });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("chapterId non-string is rejected", function () {
  var input = makeValidInput({ chapterId: null });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("clientPreviewOnly not true is rejected", function () {
  var tests = [
    makeValidInput({ clientPreviewOnly: false }),
    makeValidInput({ clientPreviewOnly: "true" }),
    makeValidInput({ clientPreviewOnly: 1 }),
    makeValidInput({ clientPreviewOnly: null }),
  ];
  tests.forEach(function (input) {
    var result = validateNoopInput(input);
    var msg = "cpv=" + JSON.stringify(input.clientPreviewOnly) + " should be rejected";
    assert.equal(result.errorCode, "INVALID_PAYLOAD", msg);
    assert.equal(result.status, "blocked");
  });
  var inputMissing = {
    bookId: "book-test",
    chapterId: "chapter-test",
    progressRatio: 0.5,
    idempotencyKeyPreview: null,
  };
  var resultMissing = validateNoopInput(inputMissing);
  assert.equal(resultMissing.errorCode, "INVALID_PAYLOAD", "cpv=undefined should be rejected");
  assert.equal(resultMissing.status, "blocked");
});

test("noop validation does not call fetch", function () {
  var orig = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () { called = true; return orig.apply(this, arguments); };
    var input = makeValidInput();
    var result = validateNoopInput(input);
    assert.equal(called, false);
    assert.equal(result.previewOnly, true);
    assert.equal(result.implemented, false);
    assert.equal(result.success, false);
  } finally {
    globalThis.fetch = orig;
  }
});

test("noop server action file does not import repository or prisma", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var serverActionPath = path.join(dirname, "reader-sync-noop-server-action.ts");
  if (serverActionPath.match(/^\/[A-Z]:\//)) {
    serverActionPath = serverActionPath.slice(1);
  }
  var content = fs.readFileSync(serverActionPath, "utf-8");
  assert.equal(/import\s+.*repository/.test(content), false, "must not import repository");
  assert.equal(/require\s*\(.*repository/.test(content), false, "must not require repository");
  assert.equal(/import\s+.*prisma/i.test(content), false, "must not import prisma");
  assert.equal(/require\s*\(.*prisma/i.test(content), false, "must not require prisma");
  assert.equal(/from\s+["'].*prisma/i.test(content), false, "must not import from prisma path");
  assert.equal(/from\s+["'].*@prisma/i.test(content), false, "must not import from @prisma");
  assert.equal(/fetch\s*\(/.test(content), false, "must not call fetch");
});

test("noop core file does not import repository or prisma", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var corePath = path.join(dirname, "reader-sync-noop-server-action-core.ts");
  if (corePath.match(/^\/[A-Z]:\//)) {
    corePath = corePath.slice(1);
  }
  var content = fs.readFileSync(corePath, "utf-8");
  assert.equal(/import\s+.*repository/.test(content), false, "must not import repository");
  assert.equal(/require\s*\(.*repository/.test(content), false, "must not require repository");
  assert.equal(/import\s+.*prisma/i.test(content), false, "must not import prisma");
  assert.equal(/require\s*\(.*prisma/i.test(content), false, "must not require prisma");
  assert.equal(/from\s+["'].*prisma/i.test(content), false, "must not import from prisma path");
  assert.equal(/from\s+["'].*@prisma/i.test(content), false, "must not import from @prisma");
  assert.equal(/fetch\s*\(/.test(content), false, "must not call fetch");
});

test("response never contains real auditId or serverProgressRatio", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.equal(result.auditId, null, "auditId must always be null");
  assert.equal(result.serverProgressRatio, null, "serverProgressRatio must always be null");
  var badResult = validateNoopInput(null);
  assert.equal(badResult.auditId, null);
  assert.equal(badResult.serverProgressRatio, null);
});

test("response does not contain error stack or sensitive debug info", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  var resultStr = JSON.stringify(result);
  assert.equal(resultStr.indexOf("Error(") === -1, true, "must not contain Error()");
  assert.equal(resultStr.indexOf("stack") === -1, true, "must not contain stack trace");
  assert.equal(resultStr.indexOf("DATABASE_URL") === -1, true, "must not contain DATABASE_URL");
  assert.equal(resultStr.indexOf("password") === -1, true, "must not contain password");
  assert.equal(resultStr.indexOf("secret") === -1, true, "must not contain secret");
  assert.equal(resultStr.indexOf("token") === -1, true, "must not contain token");
});

test("prototype pollution via __proto__ is rejected", function () {
  var pollutedInput = Object.create(makeValidInput());
  Object.defineProperty(pollutedInput, "__proto__", {
    value: { malicious: true },
    enumerable: true,
    configurable: true,
  });
  var result = validateNoopInput(pollutedInput);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("prototype pollution via constructor is rejected", function () {
  var input = makeValidInput();
  input.constructor = function () {};
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("prototype pollution via prototype is rejected", function () {
  var input = makeValidInput();
  input.prototype = {};
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("null input returns blocked INVALID_PAYLOAD", function () {
  var result = validateNoopInput(null);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
  assert.equal(result.success, false);
  assert.equal(result.auditId, null);
  assert.equal(result.serverProgressRatio, null);
});

test("undefined input returns blocked INVALID_PAYLOAD", function () {
  var result = validateNoopInput(undefined);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
  assert.equal(result.status, "blocked");
});

test("array input is blocked", function () {
  var result = validateNoopInput([1, 2, 3]);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("string input is blocked", function () {
  var result = validateNoopInput("hello");
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("number input is blocked", function () {
  var result = validateNoopInput(42);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("input with unknown field is rejected", function () {
  var input = makeValidInput();
  input.someUnknownField = "should be blocked";
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("idempotencyKeyPreview non-string non-null is rejected", function () {
  var input = makeValidInput({ idempotencyKeyPreview: 123 });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("idempotencyKeyPreview null is accepted", function () {
  var input = makeValidInput({ idempotencyKeyPreview: null });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(result.status, "not_implemented");
  assert.equal(result.success, false);
});

test("valid input generates a draft requestId", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.notEqual(result.requestId, null);
  assert.equal(typeof result.requestId, "string");
  assert.ok(result.requestId.indexOf("req-draft-") === 0);
});

test("buildNoopNotImplementedResponse returns correct shape", function () {
  var result = buildNoopNotImplementedResponse();
  assert.equal(result.success, false);
  assert.equal(result.implemented, false);
  assert.equal(result.previewOnly, true);
  assert.equal(result.readinessGatePreview.previewOnly, true);
  assert.equal(result.readinessGatePreview.implemented, false);
  assert.equal(result.readinessGatePreview.safeToExposeToClient, true);
  assert.equal(result.readinessGatePreview.status, "blocked");
  assert.equal(result.readinessGatePreview.canEnableRealSync, false);
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(result.status, "not_implemented");
  assert.equal(result.auditId, null);
  assert.equal(result.serverProgressRatio, null);
  assert.equal(result.syncedFields.length, 0);
  assert.ok(Array.isArray(result.warnings));
});

test("responses always include no-op disclaimer warnings", function () {
  var validInput = makeValidInput();
  var validResult = validateNoopInput(validInput);
  assert.ok(validResult.warnings.length > 0);
  var allWarnings = validResult.warnings.join(" ");
  assert.ok(allWarnings.indexOf("no-op") !== -1 || allWarnings.indexOf("preview only") !== -1);
  var invalidResult = validateNoopInput(null);
  assert.ok(invalidResult.warnings.length > 0);
});

test("whitelist and blacklist do not overlap", function () {
  ALLOWED_INPUT_KEYS.forEach(function (key) {
    var banned = BANNED_INPUT_KEYS.indexOf(key) !== -1;
    assert.equal(banned, false, "key in both lists: " + key);
  });
});

test("bookId whitespace-only string is rejected", function () {
  var input = makeValidInput({ bookId: "   " });
  var result = validateNoopInput(input);
  assert.equal(result.errorCode, "INVALID_PAYLOAD");
});

test("response skippedFields includes bookId chapterId progressRatio", function () {
  var input = makeValidInput();
  var result = validateNoopInput(input);
  assert.ok(result.skippedFields.indexOf("bookId") !== -1);
  assert.ok(result.skippedFields.indexOf("chapterId") !== -1);
  assert.ok(result.skippedFields.indexOf("progressRatio") !== -1);
  assert.ok(result.skippedFields.length >= 3);
});
