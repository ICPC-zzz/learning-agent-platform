import assert from "node:assert/strict";
import test from "node:test";

import { tsImport } from "tsx/esm/api";

const {
  createBlockedReaderSyncAuthContextPreview,
  createReaderSyncAuthContextPreview,
  validateReaderSyncAuthContextPreview,
} = await tsImport("./reader-sync-auth-context.ts", import.meta.url);

function makeTrustedInput(overrides) {
  const o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      source: "trusted-server-context",
      authenticated: true,
      serverTrusted: true,
      serverUserIdPreview: "reader-sync-auth-context-user-001",
      testOnly: true,
      mockOnly: true,
    },
    o,
  );
}

function makeDangerousInput() {
  const input = Object.create(null);
  Object.assign(input, makeTrustedInput());
  input.userId = "client-user-id";
  input.token = "client-token";
  input.authToken = "client-auth-token";
  input.cookie = "client-cookie";
  input.session = { id: "client-session" };
  input.headers = { authorization: "Bearer client" };
  input.rawHeaders = ["authorization", "Bearer client"];
  input.request = { body: "client-request" };
  input.rawRequest = { body: "client-raw-request" };
  input.body = { secret: "client-body" };
  input.rawBody = "client-raw-body";
  input.rawDbRecord = { secret: "client-db-record" };
  input.DATABASE_URL = "postgres://client-secret@example.invalid/db";
  input.secret = "client-secret";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  input.constructor = "client-constructor";
  input.prototype = "client-prototype";
  return input;
}

test("blocked helper stays disabled-by-default and unauthenticated", function () {
  const result = createBlockedReaderSyncAuthContextPreview();

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authenticated, false);
  assert.equal(result.authReady, false);
  assert.equal(result.serverTrusted, false);
  assert.equal(result.serverUserIdPreview, null);
  assert.equal(result.source, "blocked-by-default");
  assert.equal(result.summary.length > 0, true);
});

test("dangerous client payload fields are rejected before any auth preview can be built", function () {
  const result = validateReaderSyncAuthContextPreview(makeDangerousInput());
  const serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authenticated, false);
  assert.equal(result.authReady, false);
  assert.equal(result.serverTrusted, false);
  assert.equal(result.serverUserIdPreview, null);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_FIELD_REJECTED") !== -1;
    }),
    true,
  );

  [
    "client-user-id",
    "client-token",
    "client-auth-token",
    "client-cookie",
    "client-session",
    "Bearer client",
    "client-request",
    "client-raw-request",
    "client-body",
    "client-raw-body",
    "client-db-record",
    "postgres://client-secret@example.invalid/db",
    "client-secret",
    "client-constructor",
    "client-prototype",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "auth context preview must not leak " + needle,
    );
  });
});

test("server-trusted mock input can produce an authenticated preview without raw ids", function () {
  const result = createReaderSyncAuthContextPreview(makeTrustedInput());
  const serialized = JSON.stringify(result);

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "preview");
  assert.equal(result.authenticated, true);
  assert.equal(result.authReady, true);
  assert.equal(result.serverTrusted, true);
  assert.equal(result.serverUserIdPreview, "re***01");
  assert.equal(result.source, "trusted-server-context");
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.summary.indexOf("authenticated") !== -1, true);

  [
    "reader-sync-auth-context-user-001",
    "client-user-id",
    "client-request",
    "client-raw-request",
    "client-body",
    "client-raw-body",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "authenticated auth preview must not leak " + needle,
    );
  });
});

test("production remains disabled-by-default unless a trusted server context is explicitly supplied", function () {
  const result = validateReaderSyncAuthContextPreview({
    previewOnly: true,
    source: "blocked-by-default",
    authenticated: false,
    serverTrusted: false,
    serverUserIdPreview: null,
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authenticated, false);
  assert.equal(result.authReady, false);
  assert.equal(result.serverTrusted, false);
  assert.equal(result.serverUserIdPreview, null);
  assert.equal(result.blockedReasons.some(function (reason) {
    return reason.indexOf("AUTHENTICATED_REQUIRED") !== -1;
  }), true);
  assert.equal(result.blockedReasons.some(function (reason) {
    return reason.indexOf("SERVER_TRUSTED_REQUIRED") !== -1;
  }), true);
});
