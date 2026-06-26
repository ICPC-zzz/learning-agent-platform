import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateNoopInput } from "./reader-sync-noop-server-action-core.ts";
import { evaluateReaderSyncReadinessGate } from "./reader-sync-readiness-gate.ts";

function makeValidInput(overrides) {
  var o = overrides || {};
  return {
    bookId: o.bookId !== undefined ? o.bookId : "book-integration-001",
    chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-integration-001",
    progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.64,
    idempotencyKeyPreview:
      o.idempotencyKeyPreview !== undefined
        ? o.idempotencyKeyPreview
        : "reader-sync-preview:book-integration-001:chapter-integration-001:0.640000",
    clientPreviewOnly: o.clientPreviewOnly !== undefined ? o.clientPreviewOnly : true,
  };
}

function makeDangerousInput() {
  var input = makeValidInput();
  input.userId = "trusted-from-client";
  input.role = "admin";
  input.auditId = "audit-from-client";
  input.serverProgressRatio = 0.99;
  input.rawLocalStorage = "{malicious}";
  input.metadata = { injected: true };
  input.unknownField = "should-not-survive";
  return input;
}

function readFileContent(relativePath) {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, relativePath);
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  return fs.readFileSync(filePath, "utf-8");
}

test("reader sync no-op integration stays preview-only across decision, service, repository preview, and server action core", function () {
  var result = validateNoopInput(makeValidInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.success, false);
  assert.equal(result.status, "not_implemented");
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(result.auditId, null);
  assert.equal(result.serverProgressRatio, null);
  assert.equal(result.syncedFields.length, 0);
  assert.equal(typeof result.userId, "undefined");
  assert.equal(typeof result.role, "undefined");
  assert.equal(typeof result.rawLocalStorage, "undefined");
  assert.equal(typeof result.metadata, "undefined");

  assert.notEqual(result.syncDecisionPreview, undefined);
  assert.equal(result.syncDecisionPreview.previewOnly, true);
  assert.equal(result.syncDecisionPreview.implemented, false);
  assert.equal(result.syncDecisionPreview.executesWrite, false);
  assert.equal(result.syncDecisionPreview.status, "blocked");
  assert.equal(result.syncDecisionPreview.hasServerUserContext, false);
  assert.equal(result.syncDecisionPreview.blockers.some(function (item) {
    return item.code === "AUTH_REQUIRED";
  }), true);
  assert.equal(result.syncDecisionPreview.blockers.some(function (item) {
    return item.code === "SERVER_USER_CONTEXT_REQUIRED";
  }), true);

  assert.notEqual(result.syncServiceResultPreview, undefined);
  assert.equal(result.syncServiceResultPreview.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.implemented, false);
  assert.equal(result.syncServiceResultPreview.executed, false);
  assert.equal(result.syncServiceResultPreview.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.callsRepositoryPortPreview, true);
  assert.equal(result.syncServiceResultPreview.success, false);
  assert.equal(result.syncServiceResultPreview.status, "blocked");
  assert.equal(result.syncServiceResultPreview.safeToExposeToClient, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.implemented, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.safeToExposeToClient, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.implemented, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.readsDatabase, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.persistsAudit, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.capabilities.persistsIdempotency, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.readPreview.status, "not_implemented");
  assert.equal(result.syncServiceResultPreview.repositoryPreview.writePreview.status, "not_implemented");
  assert.equal(result.syncServiceResultPreview.repositoryPreview.writePreview.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.writePreview.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.auditPreview.persisted, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.idempotencyPreview.persisted, false);
  assert.equal(result.syncServiceResultPreview.repositoryBlockedReasons.length, 0);
  assert.ok(result.syncServiceResultPreview.repositoryWarnings.length > 0);
});

test("reader sync no-op integration rejects dangerous client fields before previews can be trusted", function () {
  var originalFetch = globalThis.fetch;
  var called = false;
  try {
    globalThis.fetch = function () {
      called = true;
      return originalFetch.apply(this, arguments);
    };

    var result = validateNoopInput(makeDangerousInput());

    assert.equal(called, false);
    assert.equal(result.previewOnly, true);
    assert.equal(result.implemented, false);
    assert.equal(result.success, false);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INVALID_PAYLOAD");
    assert.equal(result.auditId, null);
    assert.equal(result.serverProgressRatio, null);
    assert.notEqual(result.readinessGatePreview, undefined);
    assert.deepEqual(result.readinessGatePreview, evaluateReaderSyncReadinessGate());
    assert.equal(result.readinessGatePreview.previewOnly, true);
    assert.equal(result.readinessGatePreview.implemented, false);
    assert.equal(result.readinessGatePreview.safeToExposeToClient, true);
    assert.equal(result.readinessGatePreview.canEnableRealSync, false);
    assert.equal(result.readinessGatePreview.mustRemainPreviewOnly, true);
    assert.equal(result.readinessGatePreview.status, "blocked");
    assert.equal(result.syncDecisionPreview, undefined);
    assert.equal(result.syncServiceResultPreview, undefined);
    assert.equal(result.warnings.some(function (warning) {
      return warning.indexOf("preview") !== -1 || warning.indexOf("no-op") !== -1;
    }), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reader sync no-op integration guard source files avoid real runtime dependencies", function () {
  var coreContent = readFileContent("reader-sync-noop-server-action-core.ts");
  var serviceContent = readFileContent("reader-progress-sync-service.ts");
  var portContent = readFileContent("reader-sync-repository-port.ts");

  [
    coreContent,
    serviceContent,
    portContent,
  ].forEach(function (content) {
    assert.equal(/from\s+["'].*packages\/db/i.test(content), false);
    assert.equal(/import\s+.*prisma/i.test(content), false);
    assert.equal(/from\s+["'].*prisma/i.test(content), false);
    assert.equal(/from\s+["'].*@prisma/i.test(content), false);
    assert.equal(/fetch\s*\(/.test(content), false);
    assert.equal(/process\.env/.test(content), false);
    assert.equal(/window\./.test(content), false);
    assert.equal(/localStorage/.test(content), false);
    assert.equal(/sessionStorage/.test(content), false);
  });

  assert.equal(coreContent.indexOf("syncDecisionPreview remains preview-only") !== -1, true);
  assert.equal(coreContent.indexOf("syncServiceResultPreview remains preview-only") !== -1, true);
  assert.equal(coreContent.indexOf("readinessGatePreview") !== -1, true);
  assert.equal(serviceContent.indexOf("callsRepository: false") !== -1, true);
  assert.equal(portContent.indexOf("writesDatabase: false") !== -1, true);
});
