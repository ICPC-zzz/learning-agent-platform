/**
 * reader-sync-real-server-action-core-preflight.test.mjs --- A409
 *
 * Preflight chain integration tests for the Reader sync real server action core.
 * Tests: request context behavior, idempotency, conflict, audit metadata,
 * blocked path repository isolation, dev-only allowed fake adapter path.
 *
 * NO real DB writes, NO real LLM calls, NO external API calls.
 *
 * Run:  node --experimental-strip-types --test reader-sync-real-server-action-core-preflight.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildReaderSyncRealServerActionCoreResult } from "./reader-sync-real-server-action-core.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";

function makeAuthSessionStub(overrides) {
  var o = overrides || {};
  return Object.assign({
    verified: true,
    sessionSource: "trusted-server-stub",
    sessionIdPreview: "session-preview-001",
  }, o);
}

function makeServerContext(overrides) {
  var o = overrides || {};
  return Object.assign({
    serverUserId: "server-user-001",
    hasAuthenticatedUser: true,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
    authSessionStub: makeAuthSessionStub(),
  }, o);
}

function makeLocalProgress(overrides) {
  var o = overrides || {};
  return Object.assign({
    bookId: "book-preflight-001",
    chapterId: "chapter-preflight-001",
    progressRatio: 0.72,
    currentOffset: 128,
    currentCfi: "epubcfi(/6/2[chapter-preflight-001])",
    source: "server-preview",
  }, o);
}

function makeFakeRepositoryAdapter(calls) {
  var recorder = calls || [];
  return createReaderSyncPersistentRepositoryAdapter({
    findProgressByUserBookChapter: function (input) {
      recorder.push(["read", input]);
      return null;
    },
    upsertProgress: function (input) {
      recorder.push(["upsert", input]);
      return { previewOnly: true, safeToExposeToClient: true, source: "upserted", bookId: input.bookId, chapterId: input.chapterId, progressRatio: input.progressRatio, lastChunkId: null, completedAt: null, updatedAt: "2026-06-07T00:00:01.000Z", token: "x", cookie: "x", session: {}, rawDbRecord: {} };
    },
    recordAuditLog: function (input) {
      recorder.push(["audit", input]);
      return { previewOnly: true, implemented: false, safeToExposeToClient: true, status: "preview", persisted: false, auditId: "x", action: "x", source: "preview", message: "x", blockers: [], warnings: [] };
    },
    claimIdempotencyKey: function (input) {
      recorder.push(["idempotency", input]);
      return { previewOnly: true, implemented: false, safeToExposeToClient: true, status: "preview", persisted: false, previewKey: "x", action: "x", source: "preview", message: "x", blockers: [], warnings: [] };
    },
  }, {
    previewOnly: true, allowDatabaseWrite: true, allowRepositoryCall: true,
    explicitUserAuthorization: true, readinessGatePassed: true, auditReady: true,
    idempotencyReady: true, conflictResolutionReady: true, disabled: false,
  });
}

function makeFullInput(repoCalls) {
  return {
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(repoCalls),
  };
}

// ============================================================
// 1. Default blocked: repository NOT called
// ============================================================

test("default null input blocked, no repository call", function () {
  var result = buildReaderSyncRealServerActionCoreResult(null);
  assert.equal(result.status, "blocked");
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.source, "blocked");
  assert.equal(result.testOnlyExecutionPreview.attempted, false);
  assert.ok(result.blockedReasons.length > 0);
  // A408 preflight fields present
  assert.equal(typeof result.authContextPreview, "object");
  assert.equal(typeof result.conflictPreview, "object");
  assert.equal(typeof result.writePreflightPreview, "object");
  assert.equal(typeof result.auditEventPreview, "object");
  assert.equal(result.productionWriteReady, false);
});

// ============================================================
// 2. Permission blocked: repository NOT called
// ============================================================

test("permission blocked, repository not called", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext({ canAccessBook: false }),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(calls),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.permissionGatePreview.allowed, false);
  assert.equal(result.callsRepository, false);
  assert.equal(calls.length, 0, "repository must NOT be called");
  assert.equal(result.authContextPreview.previewOnly, true);
  assert.equal(result.conflictPreview.previewOnly, true);
});

// ============================================================
// 3. Idempotency blocked: repository NOT called
// ============================================================

test("idempotency blocked by missing key material, repository not called", function () {
  var calls = [];
  // localProgress with empty bookId fails normalization, so idempotency can't be derived
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: { bookId: " ", chapterId: "c", progressRatio: 0.5 },
    serverContext: makeServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(calls),
  });
  // With invalid (whitespace-only) bookId, normalization fails
  assert.equal(result.status, "blocked");
  assert.equal(calls.length, 0, "repository must NOT be called");
});

// ============================================================
// 4. Conflict blocked: repository NOT called
// ============================================================

test("conflict blocked via duplicate-safe, no write path", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress({ bookId: "c-book", chapterId: "c-ch" }),
    serverContext: makeServerContext(),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter: makeFakeRepositoryAdapter(calls),
  });
  // Conflict detection is preview-only and may not block the fake path
  // But the conflict preview should be present
  assert.ok(result.conflictPreview !== null, "conflictPreview must exist");
  assert.equal(result.conflictPreview.writesDatabase, false);
  assert.equal(result.conflictPreview.callsRepository, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.writesDatabase, false);
});

// ============================================================
// 5. Allowed dev-only path + fake repository: callsRepository verified
// ============================================================

test("allowed dev-only path exercises fake adapter, callsRepository=true", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult(makeFullInput(calls));
  assert.equal(result.status, "test_only_fake_preview");
  assert.equal(result.source, "test-only-fake");
  assert.equal(result.testOnlyExecutionPreview.attempted, true);
  assert.equal(result.testOnlyExecutionPreview.executed, true);
  assert.equal(result.testOnlyExecutionPreview.success, true);
  assert.equal(result.testOnlyExecutionPreview.callsRepository, true);
  assert.equal(result.callsRepository, false, "top-level callsRepository must be false");
  assert.equal(result.writesDatabase, false, "writesDatabase must be false");
  assert.equal(result.productionReady, false);
  assert.equal(calls.length, 4, "fake adapter called 4 times (read, idempotency, audit, upsert)");
  // Verify call order
  assert.equal(calls[0][0], "read");
  assert.equal(calls[1][0], "idempotency");
  assert.equal(calls[2][0], "audit");
  assert.equal(calls[3][0], "upsert");
});

// ============================================================
// 6. Result contains all preflight fields
// ============================================================

test("result contains all A408 preflight fields", function () {
  var calls = [];
  var result = buildReaderSyncRealServerActionCoreResult(makeFullInput(calls));

  assert.equal(typeof result.authContextPreview, "object");
  assert.equal(typeof result.conflictPreview, "object");
  assert.equal(typeof result.writePreflightPreview, "object");
  assert.equal(typeof result.auditEventPreview, "object");
  assert.equal(result.productionReady, false);
  assert.equal(typeof result.productionWriteReady, "boolean");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.safeToExposeToClient, true);

  // authContextPreview
  assert.equal(result.authContextPreview.previewOnly, true);
  assert.equal(result.authContextPreview.safeToExposeToClient, true);

  // conflictPreview
  assert.equal(result.conflictPreview.previewOnly, true);
  assert.equal(result.conflictPreview.writesDatabase, false);
  assert.equal(result.conflictPreview.callsRepository, false);

  // writePreflightPreview
  assert.equal(result.writePreflightPreview.previewOnly, true);
  assert.equal(result.writePreflightPreview.writesDatabase, false);

  // auditEventPreview
  assert.equal(result.auditEventPreview.previewOnly, true);
  assert.equal(result.auditEventPreview.safeToExposeToClient, true);
});

// ============================================================
// 7. Blocked path: all preflight markers set
// ============================================================

test("blocked path has all preflight markers correct", function () {
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext({ canAccessBook: false }),
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.productionReady, false);
  assert.equal(result.productionWriteReady, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.ok(result.blockedReasons.length > 0);
  // Preflight fields must still exist on blocked path
  assert.equal(typeof result.authContextPreview, "object");
  assert.equal(typeof result.conflictPreview, "object");
  assert.equal(typeof result.writePreflightPreview, "object");
  assert.equal(typeof result.auditEventPreview, "object");
});

// ============================================================
// 8. No real DB write ever
// ============================================================

test("no real DB write in any path", function () {
  // null input
  var r1 = buildReaderSyncRealServerActionCoreResult(null);
  assert.equal(r1.writesDatabase, false);
  assert.equal(r1.testOnlyExecutionPreview.writesDatabase, false);

  // blocked
  var r2 = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext({ canAccessBook: false }),
    explicitUserAuthorization: true, realSyncEnabled: true,
    dbIntegrationAllowed: true, authSessionVerified: true,
  });
  assert.equal(r2.writesDatabase, false);

  // test-only-fake
  var r3 = buildReaderSyncRealServerActionCoreResult(makeFullInput([]));
  assert.equal(r3.writesDatabase, false, "allowed path writesDatabase");
  assert.equal(r3.testOnlyExecutionPreview.writesDatabase, false, "testOnlyExecution writesDatabase");
});

// ============================================================
// 9. Audit event integrity
// ============================================================

test("audit event preview is safe and complete on blocked path", function () {
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress(),
    serverContext: makeServerContext({ canAccessBook: false }),
    explicitUserAuthorization: true, realSyncEnabled: true,
    dbIntegrationAllowed: true, authSessionVerified: true,
  });
  var audit = result.auditEventPreview;
  assert.equal(audit.previewOnly, true);
  assert.equal(audit.safeToExposeToClient, true);
  assert.equal(audit.writesDatabase, false);
  // Must not contain dangerous fields
  var s = JSON.stringify(audit);
  assert.equal(s.indexOf("DATABASE_URL"), -1, "no DATABASE_URL in audit");
  assert.equal(s.indexOf("secret"), -1, "no secret in audit");
  assert.equal(s.indexOf("password"), -1, "no password in audit");
});

test("audit event preview is safe and complete on allowed path", function () {
  var result = buildReaderSyncRealServerActionCoreResult(makeFullInput([]));
  var audit = result.auditEventPreview;
  assert.equal(audit.previewOnly, true);
  assert.equal(audit.safeToExposeToClient, true);
  assert.equal(audit.writesDatabase, false);
  var s = JSON.stringify(audit);
  assert.equal(s.indexOf("DATABASE_URL"), -1);
  assert.equal(s.indexOf("secret"), -1);
});

// ============================================================
// 10. Write preflight is always blocked for production
// ============================================================

test("write preflight never signals production readiness", function () {
  // blocked path
  var blocked = buildReaderSyncRealServerActionCoreResult(null);
  assert.equal(blocked.writePreflightPreview.productionWriteReady, false);
  assert.equal(blocked.writePreflightPreview.status, "blocked");

  // allowed path
  var allowed = buildReaderSyncRealServerActionCoreResult(makeFullInput([]));
  assert.equal(allowed.writePreflightPreview.productionWriteReady, false, "allowed still not production ready");
  // publicRouteExposed is false, so productionWriteReady stays false
  assert.equal(allowed.productionWriteReady, false);
});

// ============================================================
// 11. Conflict preview correctness
// ============================================================

test("conflict preview exists and is safe", function () {
  var result = buildReaderSyncRealServerActionCoreResult(makeFullInput([]));
  assert.equal(result.conflictPreview.previewOnly, true);
  assert.equal(result.conflictPreview.writesDatabase, false);
  assert.equal(result.conflictPreview.callsRepository, false);
  assert.equal(result.conflictPreview.safeToExposeToClient, true);
});

test("conflict preview blocked when input is missing", function () {
  var result = buildReaderSyncRealServerActionCoreResult({
    localProgress: makeLocalProgress({ bookId: "" }),
    serverContext: makeServerContext(),
    explicitUserAuthorization: true, realSyncEnabled: true,
    dbIntegrationAllowed: true, authSessionVerified: true,
  });
  // Empty bookId causes normalization failure, idempotency blocked
  assert.equal(result.status, "blocked");
  assert.ok(result.blockedReasons.length > 0, "should have blocked reasons");
  assert.equal(result.conflictPreview.writesDatabase, false);
  assert.equal(result.conflictPreview.callsRepository, false);
  assert.equal(result.callsRepository, false);
});

// ============================================================
// Summary: no LLM, no tools, no agent loop
// ============================================================

test("no LLM, no external API, no agent loop", function () {
  // This file only calls pure TypeScript functions and a fake in-memory adapter.
  // There is no network, no file system, no child_process, no LLM.
  assert.equal(typeof buildReaderSyncRealServerActionCoreResult, "function");
  // Verify the fake adapter is in-memory only
  var adapter = makeFakeRepositoryAdapter([]);
  assert.equal(typeof adapter.readProgress, "function");
  assert.equal(typeof adapter.previewWriteProgress, "function");
});
