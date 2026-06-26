import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";

function makeDecision() {
  return buildReaderProgressSyncDecision({
    serverContext: {
      hasAuthenticatedUser: true,
      serverUserId: "user-123",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    payload: {
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.6,
      idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
    },
  });
}

function makeRequestPreview() {
  return {
    bookId: "book-1",
    chapterId: "chapter-1",
    progressRatio: 0.6,
    idempotencyKeyPreview: "reader-sync-preview:book-1:chapter-1:0.600000",
  };
}

function makeValidServiceInput(repositoryPort, includeRepositoryPort) {
  var options = {
    previewOnly: true,
  };

  if (includeRepositoryPort) {
    options.repositoryPort = repositoryPort;
  }

  return {
    decision: makeDecision(),
    requestPreview: makeRequestPreview(),
    options: options,
  };
}

function makeThrowingRepositoryPortFromValidation() {
  return {
    get capabilities() {
      throw new Error("validation boom");
    },
    readProgress() {
      return null;
    },
    previewWriteProgress() {
      return null;
    },
    previewAudit() {
      return null;
    },
    previewIdempotency() {
      return null;
    },
  };
}

function makeThrowingRepositoryPortFromPreview() {
  return {
    capabilities: {
      previewOnly: true,
      implemented: false,
      readsDatabase: false,
      writesDatabase: false,
      callsRepository: false,
      persistsAudit: false,
      persistsIdempotency: false,
      safeToExposeToClient: true,
      mode: "mock",
    },
    readProgress() {
      throw new Error("readProgress boom");
    },
    previewWriteProgress() {
      throw new Error("previewWriteProgress boom");
    },
    previewAudit() {
      throw new Error("previewAudit boom");
    },
    previewIdempotency() {
      throw new Error("previewIdempotency boom");
    },
  };
}

function assertSafePreviewResult(result, label, warningFragment) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.executed, false, label + " must not execute");
  assert.equal(result.writesDatabase, false, label + " must not write DB");
  assert.equal(result.callsRepository, false, label + " must not call repository");
  assert.equal(result.success, false, label + " must never report success");
  assert.equal(result.safeToExposeToClient, true, label + " must remain safe to expose");
  assert.equal(result.status, "ready_preview", label + " must keep the decision status");
  assert.equal(result.decisionStatus, "ready_preview", label + " must keep the decision status");
  assert.equal(result.repositoryPreview.previewOnly, true, label + " repository preview must stay preview-only");
  assert.equal(result.repositoryPreview.safeToExposeToClient, true, label + " repository preview must stay safe");
  assert.equal(result.repositoryPreview.mode, "noop", label + " must fall back to noop repository preview");
  assert.equal(result.repositoryReadPreview.status, "not_implemented", label + " read preview must stay noop");
  assert.equal(result.repositoryWritePreview.status, "not_implemented", label + " write preview must stay noop");
  assert.equal(result.repositoryWritePreview.writesDatabase, false, label + " write preview must not write DB");
  assert.equal(result.repositoryWritePreview.callsRepository, false, label + " write preview must not call repository");
  assert.ok(result.repositoryWarnings.some(function (warning) {
    return warning.indexOf(warningFragment) !== -1;
  }), label + " must surface the fallback reason");
  assert.equal(Array.isArray(result.repositoryBlockedReasons), true, label + " must expose repositoryBlockedReasons as an array");
  assert.equal(result.repositoryBlockedReasons.length, 0, label + " fallback should not need blocked reasons");
}

test("repositoryPort omitted falls back to noop preview without crash", function () {
  var result = buildReaderProgressSyncServiceResult(
    makeValidServiceInput(undefined, false),
  );

  assertSafePreviewResult(result, "omitted repositoryPort", "was undefined");
});

test("repositoryPort undefined falls back to noop preview without crash", function () {
  var result = buildReaderProgressSyncServiceResult(
    makeValidServiceInput(undefined, true),
  );

  assertSafePreviewResult(result, "undefined repositoryPort", "was undefined");
});

test("repositoryPort null falls back to noop preview without crash", function () {
  var result = buildReaderProgressSyncServiceResult(
    makeValidServiceInput(null, true),
  );

  assertSafePreviewResult(result, "null repositoryPort", "was null");
});

test("repositoryPort with an invalid shape falls back to noop preview without crash", function () {
  var result = buildReaderProgressSyncServiceResult(
    makeValidServiceInput({}, true),
  );

  assertSafePreviewResult(
    result,
    "invalid repositoryPort shape",
    "did not satisfy the preview repository contract",
  );
});

test("repositoryPort missing readProgress falls back to noop preview without crash", function () {
  var result = buildReaderProgressSyncServiceResult(
    makeValidServiceInput(
      {
        capabilities: {
          previewOnly: true,
          implemented: false,
          readsDatabase: false,
          writesDatabase: false,
          callsRepository: false,
          persistsAudit: false,
          persistsIdempotency: false,
          safeToExposeToClient: true,
          mode: "mock",
        },
        previewWriteProgress() {
          return null;
        },
        previewAudit() {
          return null;
        },
        previewIdempotency() {
          return null;
        },
      },
      true,
    ),
  );

  assertSafePreviewResult(
    result,
    "repositoryPort missing readProgress",
    "did not satisfy the preview repository contract",
  );
});

test("throwing repositoryPort falls back to noop preview without leaking errors", function () {
  var originalFetch = globalThis.fetch;
  var called = false;

  try {
    globalThis.fetch = function () {
      called = true;
      return originalFetch.apply(this, arguments);
    };

    var validationThrowResult = buildReaderProgressSyncServiceResult(
      makeValidServiceInput(makeThrowingRepositoryPortFromValidation(), true),
    );

    assertSafePreviewResult(
      validationThrowResult,
      "validation-throwing repositoryPort",
      "threw while being validated",
    );

    var previewThrowResult = buildReaderProgressSyncServiceResult(
      makeValidServiceInput(makeThrowingRepositoryPortFromPreview(), true),
    );

    assertSafePreviewResult(
      previewThrowResult,
      "preview-throwing repositoryPort",
      "threw while building repository previews",
    );
    assert.equal(called, false, "repository boundary tests must not call fetch");
    assert.equal(
      JSON.stringify(previewThrowResult).indexOf("stack"),
      -1,
      "preview result must not leak a stack trace",
    );
    assert.equal(
      JSON.stringify(previewThrowResult).indexOf("validation boom"),
      -1,
      "preview result must not leak validation error text",
    );
    assert.equal(
      JSON.stringify(previewThrowResult).indexOf("readProgress boom"),
      -1,
      "preview result must not leak preview error text",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
