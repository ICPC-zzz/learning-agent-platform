import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createBlockedReaderSyncSafeServerContextPreview,
  createPreviewReaderSyncSafeServerContext,
  toReaderProgressSyncDecisionServerContext,
  validateReaderSyncSafeServerContext,
} from "./reader-sync-safe-server-context.ts";

function makeInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      authSource: "mock",
      hasAuthenticatedUser: true,
      serverUserId: "user-123",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o,
  );
}

function makeDangerousInput() {
  var input = makeInput();
  input.userId = "client-user-id";
  input.role = "admin";
  input.auditId = "audit-client";
  input.authToken = "token-client";
  input.token = "token-client-2";
  input.cookie = "cookie";
  input.cookies = ["cookie"];
  input.headers = { authorization: "Bearer fake" };
  input.rawHeaders = ["authorization", "Bearer fake"];
  input.session = { id: "session-client" };
  input.rawSession = { id: "raw-session-client" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{ preview }";
  input.serverProgressRatio = 0.91;
  Object.setPrototypeOf(input, { polluted: true });
  Object.defineProperty(input, "constructor", {
    value: function () {},
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: {},
    enumerable: true,
    configurable: true,
  });
  return input;
}

test("blocked preview helper returns preview-only blocked fallback", function () {
  var result = createBlockedReaderSyncSafeServerContextPreview("helper blocked reason");

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authSource, "not_connected");
  assert.equal(result.blockedReasons[0], "helper blocked reason");
  assert.equal(result.permissionSummary.hasAuthenticatedUser, false);
});

test("default preview context stays preview-only, implemented=false, and real-auth free", function () {
  var result = createPreviewReaderSyncSafeServerContext();

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authSource, "not_connected");
  assert.equal(result.hasAuthenticatedUser, false);
  assert.equal(result.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(result.permissionSummary.hasServerUserId, false);
  assert.equal(result.capabilities.previewOnly, true);
  assert.equal(result.capabilities.implemented, false);
  assert.equal(result.capabilities.authConnected, false);
  assert.equal(result.capabilities.usesRealSession, false);
  assert.equal(result.capabilities.readsCookies, false);
  assert.equal(result.capabilities.readsHeaders, false);
  assert.equal(result.capabilities.readsDatabase, false);
  assert.equal(result.capabilities.callsRepository, false);
  assert.equal(result.decisionServerContextPreview.hasAuthenticatedUser, false);
  assert.equal(result.decisionServerContextPreview.serverUserId, undefined);
});

test("mock preview input can generate a safe server context summary and remain implemented=false", function () {
  var result = createPreviewReaderSyncSafeServerContext(makeInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "preview");
  assert.equal(result.authSource, "mock");
  assert.equal(result.hasAuthenticatedUser, true);
  assert.equal(result.serverUserId, "user-123");
  assert.deepEqual(result.decisionServerContextPreview, {
    hasAuthenticatedUser: true,
    serverUserId: "user-123",
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
  });
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.permissionSummary.missingPermissionContext.length, 0);
});

test("missing serverUserId keeps hasAuthenticatedUser false and blocks preview", function () {
  var result = validateReaderSyncSafeServerContext(
    makeInput({
      serverUserId: undefined,
    }),
  );

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.context.hasAuthenticatedUser, false);
  assert.equal(result.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(result.permissionSummary.hasServerUserId, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_ID_REQUIRED") !== -1;
    }),
    true,
  );
});

test("canAccessBook=false blocks preview and keeps decision fields aligned", function () {
  var result = validateReaderSyncSafeServerContext(
    makeInput({
      canAccessBook: false,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.context.canAccessBook, false);
  assert.equal(result.decisionServerContextPreview.canAccessBook, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("BOOK_ACCESS_REQUIRED") !== -1;
    }),
    true,
  );
});

test("canAccessChapter=false blocks preview and keeps decision fields aligned", function () {
  var result = validateReaderSyncSafeServerContext(
    makeInput({
      canAccessChapter: false,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.context.canAccessChapter, false);
  assert.equal(result.decisionServerContextPreview.canAccessChapter, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("CHAPTER_ACCESS_REQUIRED") !== -1;
    }),
    true,
  );
});

test("canWriteProgress=false blocks preview and keeps decision fields aligned", function () {
  var result = validateReaderSyncSafeServerContext(
    makeInput({
      canWriteProgress: false,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.context.canWriteProgress, false);
  assert.equal(result.decisionServerContextPreview.canWriteProgress, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("WRITE_PROGRESS_REQUIRED") !== -1;
    }),
    true,
  );
});

test("dangerous auth/session-like fields are rejected and never leak into output", function () {
  var result = validateReaderSyncSafeServerContext(makeDangerousInput());
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(serialized.indexOf("client-user-id") === -1, true);
  assert.equal(serialized.indexOf("audit-client") === -1, true);
  assert.equal(serialized.indexOf("token-client") === -1, true);
  assert.equal(serialized.indexOf("session-client") === -1, true);
  assert.equal(serialized.indexOf("raw-session-client") === -1, true);
  assert.equal(serialized.indexOf("Bearer fake") === -1, true);
  assert.equal(result.blockedReasons.length > 0, true);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return (
        reason.indexOf("UNSAFE_PROTOTYPE") !== -1 ||
        reason.indexOf("FORBIDDEN_INPUT_FIELD") !== -1
      );
    }),
    true,
  );
});

test("preview context maps cleanly to decision engine serverContext fields", function () {
  var result = createPreviewReaderSyncSafeServerContext(makeInput());
  var mapped = toReaderProgressSyncDecisionServerContext(result);

  assert.deepEqual(mapped, result.decisionServerContextPreview);
  assert.equal(Object.prototype.hasOwnProperty.call(mapped, "authSource"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(mapped, "previewOnly"), false);
});

test("safe server context file does not read real auth/session/db/runtime state", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-safe-server-context.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage/.test(content), false);
  assert.equal(/sessionStorage/.test(content), false);
  assert.equal(/cookies\s*\(/.test(content), false);
  assert.equal(/headers\s*\(/.test(content), false);
  assert.equal(/auth\s*\(/.test(content), false);
});
