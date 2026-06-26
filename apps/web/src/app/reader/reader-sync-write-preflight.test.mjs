import assert from "node:assert/strict";
import test from "node:test";

import {
  createBlockedReaderSyncWritePreflightPreview,
  createReaderSyncWritePreflightPreview,
} from "./reader-sync-write-preflight.ts";
import { buildReaderSyncRealServerActionCoreResult } from "./reader-sync-real-server-action-core.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";

function makeBaseInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      safeToExposeToClient: true,
      authReady: false,
      serverTrusted: false,
      permissionGateReady: false,
      idempotencyReady: false,
      auditReady: false,
      databaseWriteOptIn: false,
      publicRouteExposed: false,
    },
    o,
  );
}

function makeReadyInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      safeToExposeToClient: true,
      authReady: true,
      serverTrusted: true,
      permissionGateReady: true,
      idempotencyReady: true,
      auditReady: true,
      databaseWriteOptIn: true,
      publicRouteExposed: true,
    },
    o,
  );
}

function makeFakeRepositoryAdapter() {
  return createReaderSyncPersistentRepositoryAdapter(
    {
      findProgressByUserBookChapter: function () {
        throw new Error("unexpected repository read");
      },
      upsertProgress: function () {
        throw new Error("unexpected repository write");
      },
      recordAuditLog: function () {
        throw new Error("unexpected repository audit");
      },
      claimIdempotencyKey: function () {
        throw new Error("unexpected repository idempotency");
      },
    },
    {
      previewOnly: true,
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    },
  );
}

function makeTrustedServerContext() {
  return {
    serverUserId: "write-preflight-test-user",
    hasAuthenticatedUser: true,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
    authSessionStub: {
      verified: true,
      sessionSource: "trusted-server-stub",
      sessionIdPreview: "write-preflight-test-session",
    },
  };
}

function makeLocalProgress() {
  return {
    bookId: "write-preflight-book",
    chapterId: "write-preflight-chapter",
    progressRatio: 0.81,
    source: "server-preview",
  };
}

test("default preflight stays blocked and production write remains not ready", function () {
  var result = createReaderSyncWritePreflightPreview(makeBaseInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authReady, false);
  assert.equal(result.serverTrusted, false);
  assert.equal(result.permissionGateReady, false);
  assert.equal(result.idempotencyReady, false);
  assert.equal(result.auditReady, false);
  assert.equal(result.databaseWriteOptIn, false);
  assert.equal(result.publicRouteExposed, false);
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_READY_REQUIRED") !== -1;
    }),
    true,
  );
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("DATABASE_WRITE_OPT_IN_REQUIRED") !== -1;
    }),
    true,
  );
});

test("missing auth readiness blocks the preflight even when later checks are green", function () {
  var result = createReaderSyncWritePreflightPreview(
    makeReadyInput({
      authReady: false,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.productionWriteReady, false);
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_READY_REQUIRED") !== -1;
    }),
    true,
  );
});

test("permission, idempotency, and audit readiness each block the preflight when missing", function () {
  var scenarios = [
    ["permissionGateReady", "PERMISSION_GATE_READY_REQUIRED"],
    ["idempotencyReady", "IDEMPOTENCY_READY_REQUIRED"],
    ["auditReady", "AUDIT_READY_REQUIRED"],
  ];

  scenarios.forEach(function (scenario) {
    var key = scenario[0];
    var expectedReason = scenario[1];
    var input = makeReadyInput();
    input[key] = false;

    var result = createReaderSyncWritePreflightPreview(input);
    assert.equal(result.status, "blocked");
    assert.equal(result.productionWriteReady, false);
    assert.equal(
      result.blockedReasons.some(function (reason) {
        return reason.indexOf(expectedReason) !== -1;
      }),
      true,
      expectedReason + " must be reported",
    );
  });
});

test("explicit opt-in can make the preflight theoretically ready without any repository or DB write", function () {
  var result = createReaderSyncWritePreflightPreview(makeReadyInput());

  assert.equal(result.status, "ready_preview");
  assert.equal(result.productionWriteReady, true);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.databaseWriteOptIn, true);
  assert.equal(result.publicRouteExposed, true);
  assert.equal(result.serverTrusted, true);
});

test("dangerous fields are rejected and never leak into the preflight result", function () {
  var input = Object.create(null);
  Object.assign(input, makeBaseInput());
  input.userId = "user-secret";
  input.token = "token-secret";
  input.session = { id: "session-secret" };
  input.cookie = "cookie-secret";
  input.DATABASE_URL = "postgres://secret@example.invalid/db";
  input.rawDbRecord = { secret: "raw-db-secret" };
  input.secret = "secret-secret";
  input.headers = { authorization: "Bearer secret" };
  input.rawRequest = { body: "raw-request-secret" };
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });

  var result = createReaderSyncWritePreflightPreview(input);
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(Object.prototype.polluted, undefined);

  [
    "user-secret",
    "token-secret",
    "session-secret",
    "cookie-secret",
    "postgres://secret@example.invalid/db",
    "raw-db-secret",
    "secret-secret",
    "Bearer secret",
    "raw-request-secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "preflight result must not leak " + needle);
  });
});

test("blocked preview helper stays preview-only and default safe", function () {
  var result = createBlockedReaderSyncWritePreflightPreview();
  assert.equal(result.previewOnly, true);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
});

test("core result includes a safe write preflight preview", function () {
  var coreResult = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeTrustedServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    databaseWriteOptIn: true,
    publicRouteExposed: true,
    repositoryAdapter: makeFakeRepositoryAdapter(),
  });

  assert.equal(coreResult.previewOnly, true);
  assert.equal(coreResult.safeToExposeToClient, true);
  assert.equal(coreResult.writePreflightPreview.previewOnly, true);
  assert.equal(coreResult.writePreflightPreview.safeToExposeToClient, true);
  assert.equal(coreResult.writePreflightPreview.writesDatabase, false);
  assert.equal(coreResult.writePreflightPreview.callsRepository, false);
  assert.equal(coreResult.writePreflightPreview.databaseWriteOptIn, true);
  assert.equal(coreResult.writePreflightPreview.publicRouteExposed, true);
  assert.equal(coreResult.writePreflightPreview.serverTrusted, true);
  assert.equal(coreResult.writePreflightPreview.productionWriteReady, true);
  assert.equal(coreResult.writePreflightPreview.status, "ready_preview");
  assert.equal(coreResult.writesDatabase, false);
  assert.equal(coreResult.callsRepository, false);
});
