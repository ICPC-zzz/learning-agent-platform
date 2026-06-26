import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createBlockedReaderSyncAuthSessionAdapter,
  createMockReaderSyncAuthSessionAdapterForTest,
  validateReaderSyncAuthSessionSnapshot,
} from "./reader-sync-auth-session-adapter.ts";

function makeMockInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      source: "test-only-mock",
      hasAuthenticatedUser: true,
      authSessionVerified: true,
      serverUserId: "server-user-001",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
      explicitUserAuthorization: true,
      sessionIdPreview: "session-preview-001",
      testOnly: true,
      mockOnly: true,
    },
    o,
  );
}

function makeDangerousInput() {
  var input = makeMockInput();
  input.userId = "client-user-id";
  input.role = "admin";
  input.authToken = "client-auth-token";
  input.token = "client-token";
  input.cookie = "client-cookie";
  input.cookies = ["client-cookie"];
  input.headers = { authorization: "Bearer client" };
  input.rawHeaders = ["authorization", "Bearer client"];
  input.session = { id: "client-session" };
  input.rawSession = { id: "client-raw-session" };
  input.metadata = { secret: "client-metadata" };
  input.rawLocalStorage = "{ client }";
  input.DATABASE_URL = "postgres://client-secret@example.invalid/db";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "client-constructor",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "client-prototype",
    enumerable: true,
    configurable: true,
  });
  return input;
}

test("default blocked auth/session adapter stays preview-only and disconnected", function () {
  var result = createBlockedReaderSyncAuthSessionAdapter().getPreview();

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.source, "blocked-by-default");
  assert.equal(result.status, "blocked");
  assert.equal(result.snapshot.authConnected, false);
  assert.equal(result.snapshot.readsCookies, false);
  assert.equal(result.snapshot.readsHeaders, false);
  assert.equal(result.snapshot.readsSession, false);
  assert.equal(result.snapshot.trustsClientUserId, false);
  assert.equal(result.snapshot.hasAuthenticatedUser, false);
  assert.equal(result.snapshot.authSessionVerified, false);
  assert.equal(result.snapshot.serverUserId, null);
  assert.equal(result.snapshot.canAccessBook, false);
  assert.equal(result.snapshot.canAccessChapter, false);
  assert.equal(result.snapshot.canWriteProgress, false);
  assert.equal(result.snapshot.explicitUserAuthorization, false);
  assert.equal(result.snapshot.testOnly, false);
  assert.equal(result.snapshot.mockOnly, false);
  assert.equal(result.capabilities.authConnected, false);
  assert.equal(result.capabilities.readsCookies, false);
  assert.equal(result.capabilities.readsHeaders, false);
  assert.equal(result.capabilities.readsSession, false);
  assert.equal(result.capabilities.trustsClientUserId, false);
  assert.equal(result.capabilities.serverUserIdAvailable, false);
  assert.equal(result.capabilities.canWriteProgress, false);
  assert.equal(result.blockedReasons.length > 0, true);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_SESSION_VERIFIED_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_ID_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("CAN_WRITE_PROGRESS_REQUIRED") !== -1;
    }),
    true,
  );
});

test("mock adapter can expose a trusted serverUserId while staying test-only and mock-only", function () {
  var result = createMockReaderSyncAuthSessionAdapterForTest(makeMockInput()).getPreview();

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.source, "test-only-mock");
  assert.equal(result.status, "preview");
  assert.equal(result.snapshot.hasAuthenticatedUser, true);
  assert.equal(result.snapshot.authSessionVerified, true);
  assert.equal(result.snapshot.serverUserId, "server-user-001");
  assert.equal(result.snapshot.canAccessBook, true);
  assert.equal(result.snapshot.canAccessChapter, true);
  assert.equal(result.snapshot.canWriteProgress, true);
  assert.equal(result.snapshot.explicitUserAuthorization, true);
  assert.equal(result.snapshot.sessionIdPreview, "session-preview-001");
  assert.equal(result.snapshot.testOnly, true);
  assert.equal(result.snapshot.mockOnly, true);
  assert.equal(result.capabilities.serverUserIdAvailable, true);
  assert.equal(result.capabilities.hasAuthenticatedUser, true);
  assert.equal(result.capabilities.authSessionVerified, true);
  assert.equal(result.capabilities.canAccessBook, true);
  assert.equal(result.capabilities.canAccessChapter, true);
  assert.equal(result.capabilities.canWriteProgress, true);
  assert.equal(result.capabilities.explicitUserAuthorization, true);
  assert.equal(result.capabilities.testOnly, true);
  assert.equal(result.capabilities.mockOnly, true);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(
    result.summary.indexOf("test-only preview") !== -1 || result.summary.indexOf("real provider") !== -1,
    true,
  );
});

test("missing serverUserId, authSessionVerified=false, and canWriteProgress=false stay blocked", function () {
  var scenarios = [
    {
      label: "missing serverUserId",
      overrides: { serverUserId: null },
      reason: "SERVER_USER_ID_REQUIRED",
    },
    {
      label: "authSessionVerified=false",
      overrides: { authSessionVerified: false },
      reason: "AUTH_SESSION_VERIFIED_REQUIRED",
    },
    {
      label: "canWriteProgress=false",
      overrides: { canWriteProgress: false },
      reason: "CAN_WRITE_PROGRESS_REQUIRED",
    },
  ];

  scenarios.forEach(function (scenario) {
    var result = validateReaderSyncAuthSessionSnapshot(makeMockInput(scenario.overrides));

    assert.equal(result.previewOnly, true, scenario.label + " must stay preview-only");
    assert.equal(result.implemented, false, scenario.label + " must stay not implemented");
    assert.equal(result.safeToExposeToClient, true, scenario.label + " must stay safe to expose");
    assert.equal(result.status, "blocked", scenario.label + " must be blocked");
    assert.equal(
      result.blockedReasons.some(function (reason) {
        return reason.indexOf(scenario.reason) !== -1;
      }),
      true,
      scenario.label + " must surface " + scenario.reason,
    );
  });
});

test("dangerous fields never leak and prototype pollution is rejected", function () {
  var result = validateReaderSyncAuthSessionSnapshot(makeDangerousInput());
  var serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(Object.prototype.polluted, undefined);
  [
    "client-user-id",
    "client-auth-token",
    "client-token",
    "client-cookie",
    "client-session",
    "client-raw-session",
    "client-metadata",
    "postgres://client-secret@example.invalid/db",
    "client-constructor",
    "client-prototype",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "serialized result must not leak " + needle,
    );
  });
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_FIELD") !== -1 || reason.indexOf("UNSAFE_PROTOTYPE_REJECTED") !== -1;
    }),
    true,
  );
  assert.equal(result.snapshot.authConnected, false);
  assert.equal(result.snapshot.readsCookies, false);
  assert.equal(result.snapshot.readsHeaders, false);
  assert.equal(result.snapshot.readsSession, false);
  assert.equal(result.snapshot.trustsClientUserId, false);
});

test("auth/session adapter file does not read real auth provider state", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-auth-session-adapter.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/PrismaClient/.test(content), false);
});
