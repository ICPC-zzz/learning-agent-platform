import assert from "node:assert/strict";
import test from "node:test";

import { tsImport } from "tsx/esm/api";

const {
  createBlockedReaderSyncPermissionGatePreview,
  validateReaderSyncPermissionGate,
} = await tsImport("./reader-sync-permission-gate.ts", import.meta.url);

function makeAllowedInput(overrides) {
  const o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      serverUserId: "server-user-001",
      bookId: "book-001",
      chapterId: "chapter-001",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
      explicitUserAuthorization: true,
    },
    o,
  );
}

function makeDangerousInput() {
  const input = Object.create(null);
  Object.assign(input, makeAllowedInput());
  input.userId = "client-user-id";
  input.role = "admin";
  input.token = "client-token";
  input.authToken = "client-auth-token";
  input.cookie = "client-cookie";
  input.cookies = ["client-cookie"];
  input.headers = { authorization: "Bearer client" };
  input.rawHeaders = ["authorization", "Bearer client"];
  input.session = { id: "client-session" };
  input.rawSession = { id: "client-raw-session" };
  input.rawDbRecord = { secret: "client-db-record" };
  input.DATABASE_URL = "postgres://client-secret@example.invalid/db";
  input.secret = "client-secret";
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

function assertBlocked(result, label, reasonPrefix) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.safeToExposeToClient, true, label + " must stay safe to expose");
  assert.equal(result.status, "blocked", label + " must be blocked");
  assert.equal(result.allowed, false, label + " must not be allowed");
  assert.equal(result.summary.length > 0, true, label + " must provide a summary");
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf(reasonPrefix) !== -1;
    }),
    true,
    label + " must surface " + reasonPrefix,
  );
}

test("blocked helper returns the default blocked preview", function () {
  const result = createBlockedReaderSyncPermissionGatePreview();

  assertBlocked(result, "default blocked helper", "Reader sync permission gate is blocked");
  assert.equal(result.source, "blocked-by-default");
  assert.equal(result.serverUserId, null);
  assert.equal(result.bookId, null);
  assert.equal(result.chapterId, null);
  assert.equal(result.canAccessBook, false);
  assert.equal(result.canAccessChapter, false);
  assert.equal(result.canWriteProgress, false);
  assert.equal(result.explicitUserAuthorization, false);
  assert.equal(result.permissionSummary.missingPermissionContext.length > 0, true);
});

test("permission gate blocks each missing or false requirement", function () {
  const scenarios = [
    {
      label: "missing serverUserId",
      overrides: { serverUserId: undefined },
      reason: "SERVER_USER_ID_REQUIRED",
    },
    {
      label: "missing bookId",
      overrides: { bookId: undefined },
      reason: "BOOK_ID_REQUIRED",
    },
    {
      label: "missing chapterId",
      overrides: { chapterId: undefined },
      reason: "CHAPTER_ID_REQUIRED",
    },
    {
      label: "canAccessBook=false",
      overrides: { canAccessBook: false },
      reason: "CAN_ACCESS_BOOK_REQUIRED",
    },
    {
      label: "canAccessChapter=false",
      overrides: { canAccessChapter: false },
      reason: "CAN_ACCESS_CHAPTER_REQUIRED",
    },
    {
      label: "canWriteProgress=false",
      overrides: { canWriteProgress: false },
      reason: "CAN_WRITE_PROGRESS_REQUIRED",
    },
    {
      label: "explicitUserAuthorization=false",
      overrides: { explicitUserAuthorization: false },
      reason: "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
    },
  ];

  for (const scenario of scenarios) {
    const result = validateReaderSyncPermissionGate(
      makeAllowedInput(scenario.overrides),
    );

    assertBlocked(result, scenario.label, scenario.reason);
    assert.equal(result.source, "trusted-server-context");
    assert.equal(result.permissionSummary.missingPermissionContext.length > 0, true);
  }
});

test("permission gate allows the full trusted server-side permission set", function () {
  const result = validateReaderSyncPermissionGate(makeAllowedInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "preview");
  assert.equal(result.allowed, true);
  assert.equal(result.source, "trusted-server-context");
  assert.equal(result.serverUserId, "server-user-001");
  assert.equal(result.bookId, "book-001");
  assert.equal(result.chapterId, "chapter-001");
  assert.equal(result.canAccessBook, true);
  assert.equal(result.canAccessChapter, true);
  assert.equal(result.canWriteProgress, true);
  assert.equal(result.explicitUserAuthorization, true);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.permissionSummary.missingPermissionContext.length, 0);
});

test("dangerous fields never leak through the permission gate output", function () {
  const result = validateReaderSyncPermissionGate(makeDangerousInput());
  const serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(Object.prototype.polluted, undefined);

  [
    "client-user-id",
    "client-token",
    "client-auth-token",
    "client-cookie",
    "client-session",
    "client-raw-session",
    "client-db-record",
    "postgres://client-secret@example.invalid/db",
    "client-secret",
    "client-constructor",
    "client-prototype",
    "DATABASE_URL",
    "rawDbRecord",
    "cookie",
    "headers",
    "secret",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "permission gate output must not leak " + needle,
    );
  });

  assert.equal(
    result.blockedReasons.some(function (reason) {
      return (
        reason.indexOf("FORBIDDEN_INPUT_FIELD_REJECTED") !== -1 ||
        reason.indexOf("UNSAFE_PROTOTYPE_REJECTED") !== -1
      );
    }),
    true,
  );
});

