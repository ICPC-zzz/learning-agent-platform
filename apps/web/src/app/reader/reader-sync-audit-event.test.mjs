import assert from "node:assert/strict";
import test from "node:test";

import { tsImport } from "tsx/esm/api";

const {
  createBlockedReaderSyncAuditEventPreview,
  createReaderSyncAuditEventPreview,
  validateReaderSyncAuditEventPreview,
} = await tsImport("./reader-sync-audit-event.ts", import.meta.url);

function makeAllowedInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      eventType: "reader-sync-audit-event-v1",
      status: "test-only-preview",
      reasonCode: "TEST_ONLY_FAKE_EXECUTION",
      bookId: "book-audit-001",
      chapterId: "chapter-audit-001",
      progressRatio: 0.72,
      source: "test-only-fake",
      idempotencyKeyPreview: "reader-sync-idempotency-v1:test-only-preview",
      permissionGateStatus: "preview",
      writesDatabase: false,
      callsRepository: false,
    },
    o,
  );
}

function makeDangerousInput() {
  var input = Object.create(null);
  Object.assign(input, makeAllowedInput({ status: "permission-blocked", reasonCode: "PERMISSION_GATE_REQUIRED", source: "blocked-by-default", permissionGateStatus: "blocked", idempotencyKeyPreview: null, bookId: null, chapterId: null, progressRatio: null }));
  input.userId = "user-secret";
  input.token = "token-secret";
  input.cookie = "cookie-secret";
  input.session = { id: "session-secret" };
  input.rawRequest = { body: "request-secret" };
  input.rawBody = "raw-body-secret";
  input.headers = { authorization: "Bearer secret" };
  input.rawHeaders = ["authorization", "Bearer secret"];
  input.rawDbRecord = { secret: "db-secret" };
  input.DATABASE_URL = "postgres://secret@example.invalid/db";
  input.secret = "super-secret";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  input.constructor = "constructor-secret";
  input.prototype = "prototype-secret";
  return input;
}

function assertSafePreview(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.safeToExposeToClient, true, label + " must stay safe to expose");
  assert.equal(result.eventType, "reader-sync-audit-event-v1", label + " event type mismatch");
  assert.equal(result.writesDatabase, false, label + " must not write to DB");
  assert.equal(result.callsRepository, false, label + " must not call repository");
}

test("audit event preview contract covers all required statuses", function () {
  var cases = [
    {
      label: "permission-blocked",
      input: makeAllowedInput({
        status: "permission-blocked",
        reasonCode: "PERMISSION_GATE_REQUIRED",
        source: "blocked-by-default",
        permissionGateStatus: "blocked",
        idempotencyKeyPreview: null,
      }),
      expected: {
        status: "permission-blocked",
        reasonCode: "PERMISSION_GATE_REQUIRED",
        source: "blocked-by-default",
        permissionGateStatus: "blocked",
      },
    },
    {
      label: "idempotency-blocked",
      input: makeAllowedInput({
        status: "idempotency-blocked",
        reasonCode: "IDEMPOTENCY_BLOCKED",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
        idempotencyKeyPreview: "reader-sync-idempotency-v1:idempotency-blocked",
      }),
      expected: {
        status: "idempotency-blocked",
        reasonCode: "IDEMPOTENCY_BLOCKED",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
      },
    },
    {
      label: "duplicate-safe",
      input: makeAllowedInput({
        status: "duplicate-safe",
        reasonCode: "DUPLICATE_SAFE_PREVIEW",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
      }),
      expected: {
        status: "duplicate-safe",
        reasonCode: "DUPLICATE_SAFE_PREVIEW",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
      },
    },
    {
      label: "changed-preview",
      input: makeAllowedInput({
        status: "changed-preview",
        reasonCode: "CHANGED_PREVIEW_CONFLICT",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
      }),
      expected: {
        status: "changed-preview",
        reasonCode: "CHANGED_PREVIEW_CONFLICT",
        source: "trusted-server-context",
        permissionGateStatus: "preview",
      },
    },
    {
      label: "test-only-preview",
      input: makeAllowedInput({
        status: "test-only-preview",
        reasonCode: "TEST_ONLY_FAKE_EXECUTION",
        source: "test-only-fake",
        permissionGateStatus: "preview",
      }),
      expected: {
        status: "test-only-preview",
        reasonCode: "TEST_ONLY_FAKE_EXECUTION",
        source: "test-only-fake",
        permissionGateStatus: "preview",
      },
    },
    {
      label: "error-preview",
      input: makeAllowedInput({
        status: "error-preview",
        reasonCode: "INVALID_AUDIT_EVENT_INPUT",
        source: "blocked-by-default",
        permissionGateStatus: "blocked",
        idempotencyKeyPreview: null,
      }),
      expected: {
        status: "error-preview",
        reasonCode: "INVALID_AUDIT_EVENT_INPUT",
        source: "blocked-by-default",
        permissionGateStatus: "blocked",
      },
    },
  ];

  for (var i = 0; i < cases.length; i += 1) {
    var scenario = cases[i];
    var result = createReaderSyncAuditEventPreview(scenario.input);

    assertSafePreview(result, scenario.label);
    assert.equal(result.status, scenario.expected.status, scenario.label + " status mismatch");
    assert.equal(result.reasonCode, scenario.expected.reasonCode, scenario.label + " reasonCode mismatch");
    assert.equal(result.source, scenario.expected.source, scenario.label + " source mismatch");
    assert.equal(result.permissionGateStatus, scenario.expected.permissionGateStatus, scenario.label + " permissionGateStatus mismatch");
  }
});

test("validation rejects dangerous fields and keeps them out of the audit event preview", function () {
  var result = validateReaderSyncAuditEventPreview(makeDangerousInput());
  var serialized = JSON.stringify(result);

  assertSafePreview(result, "dangerous input");
  assert.equal(result.status, "error-preview");
  assert.equal(Object.prototype.polluted, undefined);

  [
    "user-secret",
    "token-secret",
    "cookie-secret",
    "session-secret",
    "request-secret",
    "raw-body-secret",
    "Bearer secret",
    "db-secret",
    "postgres://secret@example.invalid/db",
    "super-secret",
    "constructor-secret",
    "prototype-secret",
    "DATABASE_URL",
    "rawRequest",
    "rawBody",
    "rawDbRecord",
    "headers",
    "rawHeaders",
    "secret",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "audit event preview must not leak " + needle);
  });
});

test("blocked helper returns a safe error-preview fallback", function () {
  var result = createBlockedReaderSyncAuditEventPreview("CORE_ERROR", {
    bookId: "book-blocked-001",
    chapterId: "chapter-blocked-001",
    progressRatio: 0.11,
    source: "blocked-by-default",
    idempotencyKeyPreview: null,
    permissionGateStatus: "blocked",
  });

  assertSafePreview(result, "blocked helper");
  assert.equal(result.status, "error-preview");
  assert.equal(result.reasonCode, "CORE_ERROR");
  assert.equal(result.bookId, "book-blocked-001");
  assert.equal(result.chapterId, "chapter-blocked-001");
  assert.equal(result.progressRatio, 0.11);
  assert.equal(result.source, "blocked-by-default");
  assert.equal(result.idempotencyKeyPreview, null);
  assert.equal(result.permissionGateStatus, "blocked");
});
