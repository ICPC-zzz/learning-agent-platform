import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildReaderSyncReadinessChecklist,
  evaluateReaderSyncReadinessGate,
  READINESS_BLOCKED_REASON_CODES,
} from "./reader-sync-readiness-gate.ts";

function makeReadyInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      authReady: true,
      repositoryReady: true,
      dbWriteReady: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      serverActionReady: true,
      explicitUserAuthorization: true,
    },
    o,
  );
}

function makeBlockedInput(overrides) {
  return Object.assign(makeReadyInput(), overrides || {});
}

function makeDangerousInput() {
  var input = Object.create({ inheritedDanger: true });
  Object.assign(
    input,
    makeReadyInput({
      explicitUserAuthorization: false,
    }),
  );
  input.userId = "fake-user-id";
  input.role = "admin";
  input.auditId = "fake-audit-id";
  input.token = "fake-token";
  input.cookie = "fake-cookie";
  input.headers = { authorization: "Bearer fake-token" };
  input.session = { id: "fake-session" };
  input.rawSession = { id: "fake-raw-session" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{fake-local-storage}";
  input.repository = "fake-repository";
  input.db = "fake-db";
  input.prisma = "fake-prisma";
  input.fetch = "fake-fetch";
  input.process = { env: { DATABASE_URL: "fake" } };
  input.env = { DATABASE_URL: "fake" };
  input.elevatedPrivileges = true;
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "fake-constructor",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "fake-prototype",
    enumerable: true,
    configurable: true,
  });
  return input;
}

function assertPreviewOnlyGate(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.safeToExposeToClient, true, label + " must stay safe to expose");
  assert.equal(result.executed, false, label + " must never execute");
  assert.equal(result.writesDatabase, false, label + " must never write DB");
  assert.equal(result.callsRepository, false, label + " must never call repository");
  assert.equal(result.success, false, label + " must never report success");
}

function assertBlockedReasonContains(result, needle, label) {
  assert.equal(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf(needle) !== -1;
    }),
    true,
    label + " must include " + needle,
  );
}

test("default readiness gate is blocked and keeps preview-only/no-op", function () {
  var result = evaluateReaderSyncReadinessGate();
  var checklist = buildReaderSyncReadinessChecklist();

  assertPreviewOnlyGate(result, "default readiness gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.mustRemainPreviewOnly, true);
  assert.equal(result.canEnableRealSync, false);
  assert.equal(result.blocked, true);
  assert.ok(result.blockedReasons.length >= 8);
  assert.equal(result.readinessChecklist.length, 8);
  assert.deepEqual(
    checklist.map(function (item) {
      return item.status;
    }),
    ["blocked", "blocked", "blocked", "blocked", "blocked", "blocked", "blocked", "blocked"],
  );
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.authNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.repositoryNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.dbWriteNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.auditNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.idempotencyNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.conflictResolutionNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.serverActionNotReady, "default gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.explicitAuthorizationRequired, "default gate");
});

test("missing auth blocks even when all other readiness flags are green", function () {
  var result = evaluateReaderSyncReadinessGate(
    makeBlockedInput({
      authReady: false,
    }),
  );

  assertPreviewOnlyGate(result, "auth-blocked gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.mustRemainPreviewOnly, true);
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.authNotReady, "auth-blocked gate");
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "auth";
    }).status,
    "blocked",
  );
  assert.equal(
    result.readinessChecklist.every(function (item) {
      return item.id === "auth" ? item.ready === false : item.ready === true;
    }),
    true,
  );
});

test("missing repository blocks real sync readiness", function () {
  var result = evaluateReaderSyncReadinessGate(
    makeBlockedInput({
      repositoryReady: false,
    }),
  );

  assertPreviewOnlyGate(result, "repository-blocked gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.repositoryNotReady, "repository-blocked gate");
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "repository";
    }).ready,
    false,
  );
});

test("missing audit and idempotency readiness both block the gate", function () {
  var result = evaluateReaderSyncReadinessGate(
    makeBlockedInput({
      auditReady: false,
      idempotencyReady: false,
    }),
  );

  assertPreviewOnlyGate(result, "audit-idempotency-blocked gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.auditNotReady, "audit-idempotency-blocked gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.idempotencyNotReady, "audit-idempotency-blocked gate");
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "audit";
    }).ready,
    false,
  );
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "idempotency";
    }).ready,
    false,
  );
});

test("missing conflict handling blocks the gate", function () {
  var result = evaluateReaderSyncReadinessGate(
    makeBlockedInput({
      conflictResolutionReady: false,
    }),
  );

  assertPreviewOnlyGate(result, "conflict-blocked gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(
    result,
    READINESS_BLOCKED_REASON_CODES.conflictResolutionNotReady,
    "conflict-blocked gate",
  );
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "conflict_resolution";
    }).status,
    "blocked",
  );
});

test("explicit authorization missing still blocks even when all technical readiness flags are true", function () {
  var result = evaluateReaderSyncReadinessGate(
    makeBlockedInput({
      explicitUserAuthorization: false,
    }),
  );

  assertPreviewOnlyGate(result, "explicit-auth-blocked gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.mustRemainPreviewOnly, true);
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(
    result,
    READINESS_BLOCKED_REASON_CODES.explicitAuthorizationRequired,
    "explicit-auth-blocked gate",
  );
  assert.equal(
    result.readinessChecklist.find(function (item) {
      return item.id === "explicit_authorization";
    }).status,
    "blocked",
  );
});

test("dangerous fields are rejected and never leak into the output", function () {
  var originalPolluted = Object.prototype.polluted;
  var result = evaluateReaderSyncReadinessGate(makeDangerousInput());
  var serialized = JSON.stringify(result);

  assertPreviewOnlyGate(result, "dangerous gate");
  assert.equal(result.status, "blocked");
  assert.equal(result.mustRemainPreviewOnly, true);
  assert.equal(result.canEnableRealSync, false);
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.unsafePrototype, "dangerous gate");
  assertBlockedReasonContains(result, READINESS_BLOCKED_REASON_CODES.invalidInput, "dangerous gate");
  assert.equal(Object.prototype.polluted, originalPolluted);

  [
    "fake-user-id",
    "fake-audit-id",
    "fake-token",
    "fake-cookie",
    "fake-session",
    "fake-raw-session",
    "fake-local-storage",
    "fake-repository",
    "fake-db",
    "fake-prisma",
    "fake-fetch",
    "DATABASE_URL",
    "fake-constructor",
    "fake-prototype",
  ].forEach(function (needle) {
    assert.equal(
      serialized.indexOf(needle),
      -1,
      "dangerous gate output must not leak " + needle,
    );
  });
});

test("readiness gate source stays self-contained and backend-free", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-readiness-gate.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  var content = fs.readFileSync(filePath, "utf-8");

  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/packages\/db/i.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
  assert.equal(/repositoryReady/.test(content), true);
});
