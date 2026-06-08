import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
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

function clone(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizePreviewAuditIds(value) {
  var normalized = clone(value);

  function walk(node) {
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        walk(node[i]);
      }
      return;
    }

    if (typeof node === "object") {
      if (typeof node.auditId === "string") {
        node.auditId = "[preview-audit-id]";
      }

      var keys = Object.keys(node);
      for (var j = 0; j < keys.length; j++) {
        walk(node[keys[j]]);
      }
    }
  }

  walk(normalized);
  return normalized;
}

function makeServiceRequest(decision, input) {
  return {
    decision: decision,
    requestPreview: {
      bookId: input.bookId,
      chapterId: input.chapterId,
      progressRatio: input.progressRatio,
      idempotencyKeyPreview: input.idempotencyKeyPreview,
    },
    options: {
      previewOnly: true,
    },
  };
}

function makeDecision(overrides) {
  var o = overrides || {};
  return buildReaderProgressSyncDecision({
    serverContext: Object.assign(
      {
        hasAuthenticatedUser: true,
        serverUserId: "user-123",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      o.serverContext || {},
    ),
    payload: Object.assign(
      {
        bookId: "book-1",
        chapterId: "chapter-1",
        progressRatio: 0.64,
        idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.640000",
      },
      o.payload || {},
    ),
    existingProgress: o.existingProgress,
    options: o.options,
  });
}

function assertNoTrustedClientFields(value, label) {
  [
    "userId",
    "role",
    "rawLocalStorage",
    "metadata",
    "__proto__",
    "constructor",
    "prototype",
  ].forEach(function (field) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(value, field),
      false,
      label + " must not expose " + field,
    );
  });
}

function assertNoPreviewOnlyLeakFields(value, label) {
  assertNoTrustedClientFields(value, label);
  [
    "auditId",
    "serverProgressRatio",
  ].forEach(function (field) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(value, field),
      false,
      label + " must not expose " + field,
    );
  });
}

test("no-op server action syncServiceResultPreview stays aligned with the service result shape", function () {
  var input = makeValidInput();
  var actionResult = validateNoopInput(input);
  var directResult = buildReaderProgressSyncServiceResult(
    makeServiceRequest(actionResult.syncDecisionPreview, input),
  );

  assert.equal(actionResult.previewOnly, true);
  assert.equal(actionResult.implemented, false);
  assert.equal(actionResult.success, false);
  assert.equal(actionResult.status, "not_implemented");
  assert.equal(actionResult.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(actionResult.auditId, null);
  assert.equal(actionResult.serverProgressRatio, null);
  assert.equal(actionResult.syncServiceResultPreview.previewOnly, true);
  assert.equal(actionResult.syncServiceResultPreview.implemented, false);
  assert.equal(actionResult.syncServiceResultPreview.executed, false);
  assert.equal(actionResult.syncServiceResultPreview.writesDatabase, false);
  assert.equal(actionResult.syncServiceResultPreview.callsRepository, false);
  assert.equal(actionResult.syncServiceResultPreview.callsRepositoryPortPreview, true);
  assert.equal(actionResult.syncServiceResultPreview.success, false);
  assert.equal(actionResult.syncServiceResultPreview.status, "blocked");
  assert.equal(actionResult.syncServiceResultPreview.errorCode, "SYNC_BLOCKED");
  assert.equal(actionResult.syncServiceResultPreview.safeToExposeToClient, true);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.previewOnly, true);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.safeToExposeToClient, true);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.previewOnly, true);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.implemented, false);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.readsDatabase, false);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.writesDatabase, false);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.callsRepository, false);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.capabilities.safeToExposeToClient, true);
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.readPreview.status, "not_implemented");
  assert.equal(actionResult.syncServiceResultPreview.repositoryPreview.writePreview.status, "not_implemented");
  assert.equal(actionResult.syncServiceResultPreview.repositoryBlockedReasons.length, 0);
  assert.ok(actionResult.syncServiceResultPreview.repositoryWarnings.length > 0);

  assertNoTrustedClientFields(actionResult, "server action response");
  assertNoPreviewOnlyLeakFields(actionResult.syncServiceResultPreview, "syncServiceResultPreview");
  assertNoPreviewOnlyLeakFields(directResult, "direct service result");

  assert.deepEqual(
    normalizePreviewAuditIds(actionResult.syncServiceResultPreview),
    normalizePreviewAuditIds(directResult),
  );
});

test("no-op server action readinessGatePreview stays aligned with the readiness gate preview", function () {
  var actionResult = validateNoopInput(makeValidInput());
  var expectedReadinessGate = evaluateReaderSyncReadinessGate();

  assert.notEqual(actionResult.readinessGatePreview, undefined);
  assert.deepEqual(actionResult.readinessGatePreview, expectedReadinessGate);
  assert.equal(actionResult.readinessGatePreview.previewOnly, true);
  assert.equal(actionResult.readinessGatePreview.implemented, false);
  assert.equal(actionResult.readinessGatePreview.safeToExposeToClient, true);
  assert.equal(actionResult.readinessGatePreview.status, "blocked");
  assert.equal(actionResult.readinessGatePreview.canEnableRealSync, false);
  assert.equal(actionResult.readinessGatePreview.mustRemainPreviewOnly, true);
  assert.equal(actionResult.syncDecisionPreview.previewOnly, true);
  assert.equal(actionResult.syncServiceResultPreview.previewOnly, true);
  assert.equal(actionResult.syncServiceResultPreview.callsRepository, false);
  assert.equal(actionResult.syncServiceResultPreview.writesDatabase, false);
});

test("service result status mappings stay consistent for ready_preview, blocked, conflict, noop, and invalid", function () {
  var input = makeValidInput();
  var scenarios = [
    {
      label: "ready_preview",
      decision: makeDecision(),
      expected: {
        status: "ready_preview",
        errorCode: undefined,
      },
    },
    {
      label: "blocked",
      decision: makeDecision({
        serverContext: {
          hasAuthenticatedUser: false,
        },
      }),
      expected: {
        status: "blocked",
        errorCode: "SYNC_BLOCKED",
      },
    },
    {
      label: "conflict",
      decision: makeDecision({
        existingProgress: {
          progressRatio: 0.9,
        },
      }),
      expected: {
        status: "conflict",
        errorCode: "PROGRESS_CONFLICT",
      },
    },
    {
      label: "noop",
      decision: makeDecision({
        existingProgress: {
          progressRatio: 0.64,
        },
      }),
      expected: {
        status: "noop",
        errorCode: "NO_CHANGE_PREVIEW",
      },
    },
    {
      label: "invalid",
      decision: null,
      expected: {
        status: "invalid",
        errorCode: "INVALID_SYNC_DECISION",
      },
    },
  ];

  scenarios.forEach(function (scenario) {
    var result = buildReaderProgressSyncServiceResult({
      decision: scenario.decision,
      requestPreview: {
        bookId: input.bookId,
        chapterId: input.chapterId,
        progressRatio: input.progressRatio,
        idempotencyKeyPreview: input.idempotencyKeyPreview,
      },
      options: {
        previewOnly: true,
      },
    });

    assert.equal(result.previewOnly, true, scenario.label + " must stay preview-only");
    assert.equal(result.implemented, false, scenario.label + " must stay not implemented");
    assert.equal(result.executed, false, scenario.label + " must not execute");
    assert.equal(result.writesDatabase, false, scenario.label + " must not write to DB");
    assert.equal(result.callsRepository, false, scenario.label + " must not call repository");
    assert.equal(result.callsRepositoryPortPreview, true, scenario.label + " must keep repository preview only");
    assert.equal(result.success, false, scenario.label + " must never report success");
    assert.equal(result.status, scenario.expected.status, scenario.label + " status mismatch");
    assert.equal(result.errorCode, scenario.expected.errorCode, scenario.label + " errorCode mismatch");
    assert.equal(result.safeToExposeToClient, true, scenario.label + " must stay safe to expose");
    assert.equal(result.repositoryPreview.previewOnly, true, scenario.label + " repository preview must stay preview-only");
    assert.equal(result.repositoryPreview.safeToExposeToClient, true, scenario.label + " repository preview must stay safe");
    assert.equal(result.repositoryCapabilities.previewOnly, true, scenario.label + " repository capabilities must stay preview-only");
    assert.equal(result.repositoryCapabilities.implemented, false, scenario.label + " repository capabilities must stay not implemented");
    assert.equal(result.repositoryCapabilities.readsDatabase, false, scenario.label + " repository capabilities must not read DB");
    assert.equal(result.repositoryCapabilities.writesDatabase, false, scenario.label + " repository capabilities must not write DB");
    assert.equal(result.repositoryCapabilities.callsRepository, false, scenario.label + " repository capabilities must not call repository");
    assert.equal(result.repositoryReadPreview.previewOnly, true, scenario.label + " repository read preview must stay preview-only");
    assert.equal(result.repositoryWritePreview.previewOnly, true, scenario.label + " repository write preview must stay preview-only");
    assert.equal(result.repositoryWritePreview.writesDatabase, false, scenario.label + " repository write preview must not write DB");
    assert.equal(result.repositoryWritePreview.callsRepository, false, scenario.label + " repository write preview must not call repository");
    assert.ok(result.nextSafeSteps.length > 0, scenario.label + " must keep nextSafeSteps populated");
    assert.ok(result.warnings.length > 0, scenario.label + " must keep warnings populated");
    assert.ok(result.repositoryWarnings.length > 0, scenario.label + " must keep repository warnings populated");
  });
});
