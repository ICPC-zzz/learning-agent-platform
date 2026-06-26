import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
import {
  toReaderProgressSyncDecisionServerContext,
  validateReaderSyncSafeServerContext,
} from "./reader-sync-safe-server-context.ts";
import { validateNoopInput } from "./reader-sync-noop-server-action-core.ts";

function makeNoopInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      bookId: "book-error-001",
      chapterId: "chapter-error-001",
      progressRatio: 0.61,
      idempotencyKeyPreview: "reader-sync-preview:book-error-001:chapter-error-001:0.610000",
      clientPreviewOnly: true,
    },
    o,
  );
}

function makeSafeContextInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      authSource: "mock",
      hasAuthenticatedUser: true,
      serverUserId: "user-error-001",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o,
  );
}

function makeDangerousSafeContextInput() {
  var input = Object.create(null);
  Object.assign(input, makeSafeContextInput());
  input.userId = "ctx-user-secret";
  input.role = "ctx-role-secret";
  input.auditId = "ctx-audit-secret";
  input.token = "ctx-token-secret";
  input.cookie = "ctx-cookie-secret";
  input.headers = { authorization: "Bearer ctx-secret" };
  input.rawHeaders = ["authorization", "Bearer ctx-secret"];
  input.session = { id: "ctx-session-secret" };
  input.rawSession = { id: "ctx-raw-session-secret" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{ctx-local-storage-secret}";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "ctx-constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "ctx-prototype-secret",
    enumerable: true,
    configurable: true,
  });
  return input;
}

function makeDangerousNoopInput() {
  var input = Object.create(null);
  Object.assign(input, makeNoopInput());
  input.userId = "noop-user-secret";
  input.role = "noop-role-secret";
  input.auditId = "noop-audit-secret";
  input.token = "noop-token-secret";
  input.cookie = "noop-cookie-secret";
  input.headers = { authorization: "Bearer noop-secret" };
  input.rawHeaders = ["authorization", "Bearer noop-secret"];
  input.session = { id: "noop-session-secret" };
  input.rawSession = { id: "noop-raw-session-secret" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{noop-local-storage-secret}";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "noop-constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "noop-prototype-secret",
    enumerable: true,
    configurable: true,
  });
  return input;
}

function makeDecisionPayload(overrides) {
  var o = overrides || {};
  return {
    bookId: o.bookId !== undefined ? o.bookId : "book-error-001",
    chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-error-001",
    progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.61,
    idempotencyKeyPreview:
      o.idempotencyKeyPreview !== undefined
        ? o.idempotencyKeyPreview
        : "reader-sync-preview:book-error-001:chapter-error-001:0.610000",
  };
}

function assertPreviewOnlyResult(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.success, false, label + " must never report success");
}

function assertSafeContextPreviewOnlyResult(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.safeToExposeToClient, true, label + " must stay safe to expose");
}

function assertDecisionPreviewOnlyResult(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.executesWrite, false, label + " must not execute writes");
}

function assertNoSensitiveLeak(serialized, values, label) {
  values.forEach(function (value) {
    assert.equal(
      serialized.indexOf(value),
      -1,
      label + " must not leak " + value,
    );
  });
}

function buildChainFromSafeContext(contextPreview) {
  var decisionServerContext = toReaderProgressSyncDecisionServerContext(contextPreview);
  var payload = makeDecisionPayload();
  var decision = buildReaderProgressSyncDecision({
    serverContext: decisionServerContext,
    payload: payload,
    options: {
      previewOnly: true,
    },
  });
  var service = buildReaderProgressSyncServiceResult({
    decision: decision,
    requestPreview: payload,
    options: {
      previewOnly: true,
    },
  });

  return {
    decisionServerContext: decisionServerContext,
    decision: decision,
    service: service,
  };
}

test("no-op action keeps preview-only error semantics and exposes clear blocked previews", function () {
  var result = validateNoopInput(makeNoopInput());

  assertPreviewOnlyResult(result, "no-op action result");
  assert.equal(result.status, "not_implemented");
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.ok(
    result.message.indexOf("no-op") !== -1 ||
      result.message.indexOf("not implemented") !== -1,
    "no-op action result must explain that it is not implemented",
  );
  assert.notEqual(result.syncDecisionPreview, undefined);
  assert.notEqual(result.syncServiceResultPreview, undefined);

  assertDecisionPreviewOnlyResult(result.syncDecisionPreview, "no-op sync decision preview");
  assert.equal(result.syncDecisionPreview.executesWrite, false);
  assert.equal(result.syncDecisionPreview.status, "blocked");
  assert.equal(result.syncDecisionPreview.hasServerUserContext, false);
  assert.equal(
    result.syncDecisionPreview.blockers.some(function (blocker) {
      return blocker.code === "AUTH_REQUIRED";
    }),
    true,
    "no-op sync decision preview must surface AUTH_REQUIRED",
  );
  assert.equal(
    result.syncDecisionPreview.blockers.some(function (blocker) {
      return blocker.code === "SERVER_USER_CONTEXT_REQUIRED";
    }),
    true,
    "no-op sync decision preview must surface SERVER_USER_CONTEXT_REQUIRED",
  );

  assertPreviewOnlyResult(result.syncServiceResultPreview, "no-op sync service preview");
  assert.equal(result.syncServiceResultPreview.executed, false);
  assert.equal(result.syncServiceResultPreview.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.status, "blocked");
  assert.equal(result.syncServiceResultPreview.errorCode, "SYNC_BLOCKED");
  assert.equal(result.syncServiceResultPreview.success, false);
  assert.equal(result.syncServiceResultPreview.safeToExposeToClient, true);
  assert.equal(
    result.syncServiceResultPreview.blockedReasons.some(function (reason) {
      return reason.indexOf("AUTH_REQUIRED") !== -1;
    }),
    true,
    "no-op sync service preview must expose an AUTH_REQUIRED block reason",
  );
  assert.equal(
    result.syncServiceResultPreview.blockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_CONTEXT_REQUIRED") !== -1;
    }),
    true,
    "no-op sync service preview must expose a server user block reason",
  );
  assert.ok(result.syncServiceResultPreview.nextSafeSteps.length > 0);
  assert.equal(
    result.syncServiceResultPreview.nextSafeSteps.some(function (step) {
      return step.indexOf("server auth/session user context") !== -1;
    }),
    true,
    "no-op sync service preview must explain the safe next step",
  );
});

test("missing serverUserId keeps the safe context blocked and the downstream chain preview-only", function () {
  var safeResult = validateReaderSyncSafeServerContext(
    makeSafeContextInput({
      serverUserId: undefined,
    }),
  );
  var chain = buildChainFromSafeContext(safeResult.context);

  assertSafeContextPreviewOnlyResult(safeResult, "safe context validation result");
  assert.equal(safeResult.status, "blocked");
  assert.equal(safeResult.context.hasAuthenticatedUser, false);
  assert.equal(safeResult.context.serverUserId, undefined);
  assert.equal(safeResult.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(safeResult.permissionSummary.hasServerUserId, false);
  assert.equal(
    safeResult.blockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_ID_REQUIRED") !== -1;
    }),
    true,
    "missing serverUserId must be reported as blocked",
  );
  assert.equal(safeResult.context.blockedReasons.length > 0, true);
  assert.equal(safeResult.context.permissionSummary.missingPermissionContext.indexOf("serverUserId") !== -1, true);

  assertDecisionPreviewOnlyResult(chain.decision, "downstream decision");
  assert.equal(chain.decision.executesWrite, false);
  assert.equal(chain.decision.status, "blocked");
  assert.equal(chain.decision.hasServerUserContext, false);
  assert.equal(
    chain.decision.blockers.some(function (blocker) {
      return blocker.code === "SERVER_USER_CONTEXT_REQUIRED";
    }),
    true,
    "decision must block on missing serverUserId",
  );

  assertPreviewOnlyResult(chain.service, "downstream service");
  assert.equal(chain.service.executed, false);
  assert.equal(chain.service.writesDatabase, false);
  assert.equal(chain.service.callsRepository, false);
  assert.equal(chain.service.status, "blocked");
  assert.equal(chain.service.errorCode, "SYNC_BLOCKED");
  assert.equal(chain.service.success, false);
  assert.equal(
    chain.service.blockedReasons.some(function (reason) {
      return reason.indexOf("SERVER_USER_CONTEXT_REQUIRED") !== -1;
    }),
    true,
    "service must surface the missing server user block reason",
  );
  assert.ok(chain.service.nextSafeSteps.length > 0);
});

test("hasAuthenticatedUser=false with a forged userId never trusts the client field", function () {
  var safeResult = validateReaderSyncSafeServerContext(
    makeSafeContextInput({
      hasAuthenticatedUser: false,
      serverUserId: undefined,
      userId: "forged-user-secret",
    }),
  );
  var noopResult = validateNoopInput(
    makeNoopInput({
      userId: "forged-user-secret",
    }),
  );
  var serialized = JSON.stringify({
    safeResult: safeResult,
    noopResult: noopResult,
  });

  assertSafeContextPreviewOnlyResult(safeResult, "safe context result");
  assert.equal(safeResult.status, "blocked");
  assert.equal(safeResult.context.hasAuthenticatedUser, false);
  assert.equal(safeResult.context.serverUserId, undefined);
  assert.equal(
    safeResult.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_INPUT_FIELD:userId") !== -1;
    }),
    true,
    "forged userId must be rejected as a forbidden field",
  );

  assertPreviewOnlyResult(noopResult, "no-op action result");
  assert.equal(noopResult.status, "blocked");
  assert.equal(noopResult.errorCode, "INVALID_PAYLOAD");
  assert.equal(
    noopResult.message.indexOf("userId") !== -1 || noopResult.message.indexOf("banned") !== -1,
    true,
    "no-op action must explain why the forged userId was rejected",
  );
  assert.equal(Object.prototype.polluted, undefined);

  assertNoSensitiveLeak(
    serialized,
    [
      "forged-user-secret",
    ],
    "forged userId output",
  );
});

test("permission denials keep the safe-context -> decision -> service chain blocked and explain why", function () {
  var cases = [
    {
      label: "canAccessBook=false",
      overrides: { canAccessBook: false },
      safeReason: "BOOK_ACCESS_REQUIRED",
      blockerCode: "BOOK_ACCESS_DENIED",
    },
    {
      label: "canAccessChapter=false",
      overrides: { canAccessChapter: false },
      safeReason: "CHAPTER_ACCESS_REQUIRED",
      blockerCode: "CHAPTER_ACCESS_DENIED",
    },
    {
      label: "canWriteProgress=false",
      overrides: { canWriteProgress: false },
      safeReason: "WRITE_PROGRESS_REQUIRED",
      blockerCode: "WRITE_PROGRESS_DENIED",
    },
  ];

  cases.forEach(function (scenario) {
    var safeResult = validateReaderSyncSafeServerContext(
      makeSafeContextInput(scenario.overrides),
    );
    var chain = buildChainFromSafeContext(safeResult.context);

    assertSafeContextPreviewOnlyResult(safeResult, scenario.label + " safe context");
    assert.equal(safeResult.status, "blocked", scenario.label + " safe context must stay blocked");
    assert.equal(
      safeResult.blockedReasons.some(function (reason) {
        return reason.indexOf(scenario.safeReason) !== -1;
      }),
      true,
      scenario.label + " must surface the expected safe-context blocked reason",
    );

  assertDecisionPreviewOnlyResult(chain.decision, scenario.label + " decision");
    assert.equal(chain.decision.status, "blocked", scenario.label + " decision must stay blocked");
    assert.equal(
      chain.decision.blockers.some(function (blocker) {
        return blocker.code === scenario.blockerCode;
      }),
      true,
      scenario.label + " decision must expose the expected blocker code",
    );

    assertPreviewOnlyResult(chain.service, scenario.label + " service");
    assert.equal(chain.service.status, "blocked", scenario.label + " service must stay blocked");
    assert.equal(chain.service.errorCode, "SYNC_BLOCKED", scenario.label + " service must map to SYNC_BLOCKED");
    assert.equal(
      chain.service.blockedReasons.some(function (reason) {
        return reason.indexOf(scenario.blockerCode) !== -1;
      }),
      true,
      scenario.label + " service must expose the expected block reason",
    );
    assert.ok(chain.service.nextSafeSteps.length > 0, scenario.label + " service must keep safe next steps");
  });
});

test("dangerous auth/session-like fields are rejected, not propagated, and do not pollute the safe output", function () {
  var safeResult = validateReaderSyncSafeServerContext(makeDangerousSafeContextInput());
  var noopResult = validateNoopInput(makeDangerousNoopInput());
  var serialized = JSON.stringify({
    safeResult: safeResult,
    noopResult: noopResult,
  });

  assertSafeContextPreviewOnlyResult(safeResult, "dangerous safe context result");
  assert.equal(safeResult.status, "blocked");
  assert.equal(
    safeResult.blockedReasons.length > 0,
    true,
    "dangerous safe context must include blocked reasons",
  );
  assert.equal(
    safeResult.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_INPUT_FIELD") !== -1 || reason.indexOf("UNSAFE_PROTOTYPE") !== -1;
    }),
    true,
    "dangerous safe context must identify forbidden or polluted input",
  );
  assert.equal(safeResult.context.previewOnly, true);
  assert.equal(safeResult.context.implemented, false);
  assert.equal(safeResult.context.serverUserId, undefined);
  assert.equal(safeResult.context.permissionSummary.hasServerUserId, false);
  assert.equal(safeResult.context.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(Object.prototype.polluted, undefined);

  assertPreviewOnlyResult(noopResult, "dangerous no-op result");
  assert.equal(noopResult.status, "blocked");
  assert.equal(noopResult.errorCode, "INVALID_PAYLOAD");
  assert.equal(
    noopResult.message.indexOf("forbidden") !== -1 ||
      noopResult.message.indexOf("banned") !== -1 ||
      noopResult.message.indexOf("unknown field") !== -1 ||
      noopResult.message.indexOf("prototype pollution") !== -1,
    true,
    "dangerous no-op input must explain why it was blocked",
  );

  assertNoSensitiveLeak(
    serialized,
    [
      "ctx-user-secret",
      "ctx-role-secret",
      "ctx-audit-secret",
      "ctx-token-secret",
      "ctx-cookie-secret",
      "Bearer ctx-secret",
      "ctx-session-secret",
      "ctx-raw-session-secret",
      "ctx-local-storage-secret",
      "noop-user-secret",
      "noop-role-secret",
      "noop-audit-secret",
      "noop-token-secret",
      "noop-cookie-secret",
      "Bearer noop-secret",
      "noop-session-secret",
      "noop-raw-session-secret",
      "noop-local-storage-secret",
      "ctx-constructor-secret",
      "ctx-prototype-secret",
      "noop-constructor-secret",
      "noop-prototype-secret",
    ],
    "dangerous preview output",
  );
});
