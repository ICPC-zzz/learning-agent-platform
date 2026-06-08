import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReaderSyncServerActionContractDraft,
  buildReaderSyncServerActionReadinessChecklist,
  READER_SYNC_SERVER_ACTION_ERROR_CODES,
} from "./reader-sync-server-action-contract.ts";

function makeSubmitPlan(overrides) {
  var o = overrides || {};
  return {
    previewOnly: true,
    status: o.status || "ready",
    canSubmit: false,
    targetModel: "ReadingProgress",
    draftOperation: "upsert-reading-progress-preview",
    idempotencyKeyPreview: o.idempotencyKeyPreview || "reader-sync-preview:book-test:chapter-test:0.500000",
    auditDraft: {
      action: "reader.progress.sync.preview",
      source: "localStorage",
      targetModel: "ReadingProgress",
      previewOnly: true,
    },
    requiredContext: ["future userId from auth context"],
    blockers: [],
    warnings: [],
    rollbackNotes: [],
    retryNotes: [],
  };
}

test("ready submit plan - request draft generated implemented false response not success", function () {
  var sp = makeSubmitPlan({ status: "ready", idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.750000" });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(c.previewOnly, true);
  assert.equal(c.implemented, false);
  assert.equal(c.status, "draft_only");
  assert.notEqual(c.requestDraft, null);
  assert.equal(c.requestDraft.clientPreviewOnly, true);
  assert.equal(c.requestDraft.serverUserIdRequired, true);
  assert.equal(c.requestDraft.bookId, "book-1");
  assert.equal(c.requestDraft.chapterId, "chapter-1");
  assert.equal(c.requestDraft.progressRatio, 0.75);
  assert.equal(c.requestDraft.idempotencyKeyPreview, "reader-sync-preview:book-1:chapter-1:0.750000");
  assert.equal(c.responseDraft.success, false);
  assert.equal(c.responseDraft.implemented, false);
  assert.equal(c.responseDraft.previewOnly, true);
  assert.equal(c.responseDraft.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(c.responseDraft.auditId, null);
  assert.equal(c.responseDraft.serverProgressRatio, null);
  assert.equal(c.responseDraft.syncedFields.length, 0);
  assert.equal(c.blockers.some(function (b) { return b.code === "SERVER_ACTION_NOT_IMPLEMENTED"; }), true);
});

test("empty submit plan returns blocked contract", function () {
  var sp = makeSubmitPlan({ status: "empty", idempotencyKeyPreview: null });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(c.status, "blocked");
  assert.equal(c.requestDraft, null);
  assert.equal(c.responseDraft.success, false);
  assert.equal(c.responseDraft.errorCode, "INVALID_PAYLOAD");
  assert.equal(c.responseDraft.message.indexOf("empty") !== -1, true);
  assert.equal(c.blockers.some(function (b) { return b.code === "PAYLOAD_EMPTY"; }), true);
});

test("invalid submit plan blocked with errorCode and blockers", function () {
  var sp = makeSubmitPlan({ status: "invalid", idempotencyKeyPreview: null });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(c.status, "blocked");
  assert.equal(c.requestDraft, null);
  assert.equal(c.responseDraft.errorCode, "INVALID_PAYLOAD");
  assert.equal(c.blockers.some(function (b) { return b.code === "PAYLOAD_INVALID"; }), true);
  assert.equal(c.blockers.some(function (b) { return b.code === "SERVER_ACTION_NOT_IMPLEMENTED"; }), true);
});

test("partial submit plan blocked with errorCode and blockers", function () {
  var sp = makeSubmitPlan({ status: "partial", idempotencyKeyPreview: null });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(c.status, "blocked");
  assert.equal(c.requestDraft, null);
  assert.equal(c.responseDraft.errorCode, "INVALID_PAYLOAD");
  assert.equal(c.blockers.some(function (b) { return b.code === "PAYLOAD_INCOMPLETE"; }), true);
});

test("request draft has no trusted userId field", function () {
  var sp = makeSubmitPlan({ status: "ready", idempotencyKeyPreview: "reader-sync-preview:book-no-user:ch-no-user:0.300000" });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.notEqual(c.requestDraft, null);
  var keys = Object.keys(c.requestDraft);
  assert.equal(keys.indexOf("userId") === -1, true);
  assert.equal(c.requestDraft.serverUserIdRequired, true);
  var ctx = c.requiredContext.join(" ");
  assert.equal(ctx.indexOf("userId") !== -1, true);
  assert.equal(c.permissionGateDraft.requiresAuth, true);
  assert.equal(c.auditDraft.userIdSource, "server-session-context-not-client");
});

test("permission gate requires all five checks", function () {
  var c = buildReaderSyncServerActionContractDraft(makeSubmitPlan({}));
  var g = c.permissionGateDraft;
  assert.equal(g.requiresAuth, true);
  assert.equal(g.requiresBookAccess, true);
  assert.equal(g.requiresChapterAccess, true);
  assert.equal(g.requiresProgressValidation, true);
  assert.equal(g.requiresAudit, true);
});

test("error code enum includes all required categories", function () {
  var codes = READER_SYNC_SERVER_ACTION_ERROR_CODES;
  assert.equal(codes.indexOf("SERVER_ACTION_NOT_IMPLEMENTED") !== -1, true);
  assert.equal(codes.indexOf("AUTH_REQUIRED") !== -1, true);
  assert.equal(codes.indexOf("PERMISSION_DENIED") !== -1, true);
  assert.equal(codes.indexOf("INVALID_PAYLOAD") !== -1, true);
  assert.equal(codes.indexOf("IDEMPOTENCY_REQUIRED") !== -1, true);
  assert.equal(codes.indexOf("AUDIT_REQUIRED") !== -1, true);
  assert.equal(codes.indexOf("CONFLICT_DETECTED") !== -1, true);
  assert.equal(codes.indexOf("REPOSITORY_UNAVAILABLE") !== -1, true);
  assert.equal(codes.length, 8);
});

test("no-op builder makes no network calls", function () {
  var orig = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () { called = true; return orig.apply(this, arguments); };
    var c = buildReaderSyncServerActionContractDraft(makeSubmitPlan({}));
    assert.equal(called, false);
    assert.equal(c.previewOnly, true);
    assert.equal(c.implemented, false);
    assert.equal(c.responseDraft.success, false);
    assert.equal(c.responseDraft.auditId, null);
    assert.equal(c.responseDraft.serverProgressRatio, null);
  } finally {
    globalThis.fetch = orig;
  }
});

test("idempotencyKeyPreview is preview-only not real server idempotency", function () {
  var sp = makeSubmitPlan({ status: "ready", idempotencyKeyPreview: "reader-sync-preview:book-idem:ch-idem:0.880000" });
  var c = buildReaderSyncServerActionContractDraft(sp);
  assert.notEqual(c.requestDraft, null);
  var keys = Object.keys(c.requestDraft);
  assert.equal(keys.indexOf("idempotencyKeyPreview") !== -1, true);
  assert.equal(keys.indexOf("idempotencyKey") === -1, true);
  assert.equal(c.requestDraft.idempotencyKeyPreview, "reader-sync-preview:book-idem:ch-idem:0.880000");
  var w = c.responseDraft.warnings.join(" ");
  assert.equal(w.indexOf("idempotencyKey") !== -1, true);
  var ctx = c.requiredContext.join(" ");
  assert.equal(ctx.indexOf("idempotency") !== -1, true);
  assert.equal(c.implemented, false);
  assert.equal(c.responseDraft.success, false);
});

test("null submit plan returns blocked", function () {
  var c = buildReaderSyncServerActionContractDraft(null);
  assert.equal(c.status, "blocked");
  assert.equal(c.requestDraft, null);
  assert.equal(c.responseDraft.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(c.blockers.some(function (b) { return b.code === "INVALID_INPUT"; }), true);
});

// A284 Readiness Checklist Tests

test("readiness checklist always previewOnly=true implemented=false", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  assert.equal(cl.previewOnly, true);
  assert.equal(cl.implemented, false);
});

test("readiness checklist null input returns blocked with single item", function () {
  var cl = buildReaderSyncServerActionReadinessChecklist(null);
  assert.equal(cl.overallStatus, "blocked");
  assert.equal(cl.previewOnly, true);
  assert.equal(cl.implemented, false);
  assert.equal(cl.items.length, 1);
  assert.equal(cl.items[0].id, "contract-input");
  assert.equal(cl.items[0].status, "blocked");
  assert.ok(cl.blockersSummary.length > 0);
});

test("ready contract draft still blocked overall because server action not implemented", function () {
  var sp = makeSubmitPlan({ status: "ready", idempotencyKeyPreview: "reader-sync-preview:book-x:chapter-x:0.600000" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(contract.status, "draft_only");
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  assert.equal(cl.overallStatus, "blocked");
  assert.equal(cl.previewOnly, true);
  assert.equal(cl.implemented, false);
});

test("checklist marks auth/session userId as not_implemented", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var auth = cl.items.find(function (i) { return i.id === "auth-session-user-id"; });
  assert.notEqual(auth, undefined);
  assert.equal(auth.status, "not_implemented");
  assert.ok(auth.reason.indexOf("userId") !== -1 || auth.reason.indexOf("session") !== -1);
});

test("checklist marks no-client-trusted-user-id as satisfied", function () {
  var sp = makeSubmitPlan({ status: "ready", idempotencyKeyPreview: "reader-sync-preview:book-u:ch-u:0.500000" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var noClientUserId = cl.items.find(function (i) { return i.id === "no-client-trusted-user-id"; });
  assert.notEqual(noClientUserId, undefined);
  assert.equal(noClientUserId.status, "satisfied");
  assert.ok(noClientUserId.reason.indexOf("userId") !== -1);
  assert.notEqual(contract.requestDraft, null);
  assert.equal(Object.keys(contract.requestDraft).indexOf("userId") === -1, true);
});

test("checklist marks no-real-ai-tools-agent-loop as satisfied", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var noAI = cl.items.find(function (i) { return i.id === "no-real-ai-tools-agent-loop"; });
  assert.notEqual(noAI, undefined);
  assert.equal(noAI.status, "satisfied");
  assert.ok(noAI.reason.indexOf("preview-only") !== -1 || noAI.reason.indexOf("mock-only") !== -1 || noAI.reason.indexOf("disabled-by-default") !== -1);
});

test("checklist nextSafeSteps does not contain dangerous suggestions", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var allSteps = cl.nextSafeSteps.join(" ");
  assert.equal(allSteps.indexOf("direct sync") === -1, true);
  assert.equal(allSteps.indexOf("write to DB") === -1, true);
  assert.equal(allSteps.indexOf("call server action") === -1, true);
  assert.ok(allSteps.indexOf("review") !== -1 || allSteps.indexOf("design") !== -1 || allSteps.indexOf("define") !== -1);
});

test("checklist overallStatus blocked when blockers present", function () {
  var sp = makeSubmitPlan({ status: "empty", idempotencyKeyPreview: null });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  assert.equal(contract.status, "blocked");
  assert.ok(contract.blockers.length > 0);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  assert.equal(cl.overallStatus, "blocked");
  assert.ok(cl.blockersSummary.length > 0);
});

test("checklist has all 10 core items", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var ids = cl.items.map(function (i) { return i.id; });
  var expected = [
    "server-action-impl",
    "auth-session-user-id",
    "book-access-permission",
    "chapter-access-permission",
    "progress-payload-validation",
    "audit-sink",
    "idempotency-strategy",
    "repository-write-auth",
    "no-real-ai-tools-agent-loop",
    "no-client-trusted-user-id",
  ];
  expected.forEach(function (id) {
    assert.equal(ids.indexOf(id) !== -1, true, "missing checklist item: " + id);
  });
  assert.equal(cl.items.length, 10);
});

test("checklist idempotency strategy is not_implemented", function () {
  var sp = makeSubmitPlan({ status: "ready" });
  var contract = buildReaderSyncServerActionContractDraft(sp);
  var cl = buildReaderSyncServerActionReadinessChecklist(contract);
  var idem = cl.items.find(function (i) { return i.id === "idempotency-strategy"; });
  assert.notEqual(idem, undefined);
  assert.equal(idem.status, "not_implemented");
  assert.ok(idem.reason.indexOf("idempotencyKeyPreview") !== -1 || idem.reason.indexOf("idempotency") !== -1);
});

test("checklist is pure function no side effects", function () {
  var orig = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () { called = true; return orig.apply(this, arguments); };
    var sp = makeSubmitPlan({ status: "ready" });
    var contract = buildReaderSyncServerActionContractDraft(sp);
    var cl = buildReaderSyncServerActionReadinessChecklist(contract);
    assert.equal(called, false);
    assert.equal(cl.previewOnly, true);
    assert.equal(cl.implemented, false);
  } finally {
    globalThis.fetch = orig;
  }
});
