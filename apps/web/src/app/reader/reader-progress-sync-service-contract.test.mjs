import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createBlockedReaderProgressSyncServiceContractPreview,
  createReaderProgressSyncServiceContractPreview,
  validateReaderProgressSyncServiceContractPreview,
} from "./reader-progress-sync-service-contract.ts";

function makeReadyInput(overrides) {
  return Object.assign(
    {
      previewOnly: true,
      authReady: true,
      serverTrusted: true,
      permissionGateReady: true,
      idempotencyKeyReady: true,
      idempotencyConflictClear: true,
      auditReady: true,
      writePreflightReady: true,
      repositoryWriteAllowed: false,
      productionWriteReady: false,
    },
    overrides || {},
  );
}

test("default contract preview stays blocked and preview-only", function () {
  const result = createBlockedReaderProgressSyncServiceContractPreview();

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.authReady, false);
  assert.equal(result.serverTrusted, false);
  assert.equal(result.permissionGateReady, false);
  assert.equal(result.idempotencyKeyReady, false);
  assert.equal(result.idempotencyConflictClear, false);
  assert.equal(result.auditReady, false);
  assert.equal(result.writePreflightReady, false);
  assert.equal(result.repositoryWriteAllowed, false);
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.ok(result.blockedReasons.length > 0);
});

test("missing auth, permission, idempotency, audit, or preflight readiness keeps the contract blocked", function () {
  const cases = [
    ["authReady", { authReady: false }, "AUTH_READY_REQUIRED"],
    ["serverTrusted", { serverTrusted: false }, "SERVER_TRUSTED_REQUIRED"],
    ["permissionGateReady", { permissionGateReady: false }, "PERMISSION_GATE_READY_REQUIRED"],
    ["idempotencyKeyReady", { idempotencyKeyReady: false }, "IDEMPOTENCY_KEY_READY_REQUIRED"],
    ["idempotencyConflictClear", { idempotencyConflictClear: false }, "IDEMPOTENCY_CONFLICT_CLEAR_REQUIRED"],
    ["auditReady", { auditReady: false }, "AUDIT_READY_REQUIRED"],
    ["writePreflightReady", { writePreflightReady: false }, "WRITE_PREFLIGHT_READY_REQUIRED"],
  ];

  cases.forEach(function (entry) {
    const result = validateReaderProgressSyncServiceContractPreview(
      makeReadyInput(entry[1]),
    );

    assert.equal(result.status, "blocked", entry[0] + " should block the contract");
    assert.equal(result.writesDatabase, false);
    assert.equal(result.callsRepository, false);
    assert.equal(result.repositoryWriteAllowed, false);
    assert.equal(result.productionWriteReady, false);
    assert.ok(
      result.blockedReasons.some(function (reason) {
        return reason.indexOf(entry[2]) !== -1;
      }),
      entry[0] + " should surface " + entry[2],
    );
  });
});

test("ready preview still keeps repository writes and production writes disabled", function () {
  const result = createReaderProgressSyncServiceContractPreview(makeReadyInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.status, "ready_preview");
  assert.equal(result.authReady, true);
  assert.equal(result.serverTrusted, true);
  assert.equal(result.permissionGateReady, true);
  assert.equal(result.idempotencyKeyReady, true);
  assert.equal(result.idempotencyConflictClear, true);
  assert.equal(result.auditReady, true);
  assert.equal(result.writePreflightReady, true);
  assert.equal(result.repositoryWriteAllowed, false);
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.blockedReasons.length, 0);
});

test("dangerous fields are rejected and never appear in the result", function () {
  const input = Object.create(null);
  Object.assign(input, makeReadyInput());
  input.userId = "client-user-id";
  input.token = "client-token";
  input.cookie = "client-cookie";
  input.session = { id: "client-session" };
  input.rawDbRecord = { secret: "client-db-secret" };
  input.DATABASE_URL = "postgres://client-secret@example.invalid/db";
  input.secret = "client-secret";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });

  const result = validateReaderProgressSyncServiceContractPreview(input);
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(serialized.indexOf("client-user-id"), -1);
  assert.equal(serialized.indexOf("client-token"), -1);
  assert.equal(serialized.indexOf("client-cookie"), -1);
  assert.equal(serialized.indexOf("client-session"), -1);
  assert.equal(serialized.indexOf("client-db-secret"), -1);
  assert.equal(serialized.indexOf("postgres://client-secret@example.invalid/db"), -1);
  assert.equal(serialized.indexOf("client-secret"), -1);
  assert.equal(Object.prototype.polluted, undefined);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_FIELD_REJECTED") !== -1;
    }),
  );
});

test("production write stays disabled-by-default even when the input tries to enable it", function () {
  const result = validateReaderProgressSyncServiceContractPreview(
    makeReadyInput({
      repositoryWriteAllowed: true,
      productionWriteReady: true,
    }),
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.repositoryWriteAllowed, false);
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("REPOSITORY_WRITE_NOT_ALLOWED") !== -1;
    }),
  );
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("PRODUCTION_WRITE_NOT_ALLOWED") !== -1;
    }),
  );
});

test("contract module file does not import repository, Prisma, or fetch", function () {
  const dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  const filePath = path.join(dirname, "reader-progress-sync-service-contract.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.equal(/from\s+["'].*@prisma\/client["']/.test(content), false);
  assert.equal(/from\s+["'].*packages\/db/i.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
});
