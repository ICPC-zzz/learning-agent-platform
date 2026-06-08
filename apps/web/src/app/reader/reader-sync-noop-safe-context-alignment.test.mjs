import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
import {
  createPreviewReaderSyncSafeServerContext,
  toReaderProgressSyncDecisionServerContext,
  validateReaderSyncSafeServerContext,
} from "./reader-sync-safe-server-context.ts";
import { validateNoopInput } from "./reader-sync-noop-server-action-core.ts";

function makeNoopInput(overrides) {
  var o = overrides || {};
  return {
    bookId: o.bookId !== undefined ? o.bookId : "book-align-001",
    chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-align-001",
    progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.53,
    idempotencyKeyPreview:
      o.idempotencyKeyPreview !== undefined
        ? o.idempotencyKeyPreview
        : "reader-sync-preview:book-align-001:chapter-align-001:0.530000",
    clientPreviewOnly: o.clientPreviewOnly !== undefined ? o.clientPreviewOnly : true,
  };
}

function makeSafeContextInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      authSource: "preview",
      hasAuthenticatedUser: true,
      serverUserId: "user-align-001",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o,
  );
}

function makeDangerousNoopInput() {
  var input = makeNoopInput();
  input.userId = "client-user-id";
  input.role = "admin";
  input.auditId = "client-audit-id";
  input.token = "client-token";
  input.cookie = "client-cookie";
  input.headers = { authorization: "Bearer client" };
  input.session = { id: "client-session" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{client-local-storage}";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "client-constructor",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "client-prototype",
    enumerable: true,
    configurable: true,
  });
  return input;
}

function makeDangerousSafeContextInput() {
  var input = makeSafeContextInput({
    serverUserId: undefined,
    hasAuthenticatedUser: false,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
  });
  input.userId = "client-user-id";
  input.role = "admin";
  input.auditId = "client-audit-id";
  input.token = "client-token";
  input.cookie = "client-cookie";
  input.headers = { authorization: "Bearer client" };
  input.session = { id: "client-session" };
  input.metadata = { injected: true };
  input.rawLocalStorage = "{client-local-storage}";
  Object.defineProperty(input, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: "client-constructor",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: "client-prototype",
    enumerable: true,
    configurable: true,
  });
  return input;
}

function makeDecisionPayloadFromNoopInput(noopInput) {
  return {
    bookId: noopInput.bookId,
    chapterId: noopInput.chapterId,
    progressRatio: noopInput.progressRatio,
    idempotencyKeyPreview: noopInput.idempotencyKeyPreview,
  };
}

function pickDecisionSemantics(result) {
  return {
    previewOnly: result.previewOnly,
    implemented: result.implemented,
    executesWrite: result.executesWrite,
    status: result.status,
    operationPreview: result.operationPreview,
    hasServerUserContext: result.hasServerUserContext,
    permissionSummary: result.permissionSummary,
    blockers: result.blockers,
  };
}

function pickServiceSemantics(result) {
  return {
    previewOnly: result.previewOnly,
    implemented: result.implemented,
    executed: result.executed,
    writesDatabase: result.writesDatabase,
    callsRepository: result.callsRepository,
    status: result.status,
    success: result.success,
    errorCode: result.errorCode,
    decisionStatus: result.decisionStatus,
    safeToExposeToClient: result.safeToExposeToClient,
  };
}

function assertNoDangerousOwnProps(target, label, unsafeKeys) {
  var keys =
    unsafeKeys || [
      "userId",
      "role",
      "auditId",
      "token",
      "cookie",
      "headers",
      "session",
      "metadata",
      "rawLocalStorage",
      "__proto__",
      "constructor",
      "prototype",
    ];

  keys.forEach(function (key) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(target, key),
      false,
      label + " must not expose " + key,
    );
  });
}

function buildDecisionAndServiceFromSafeContext(contextPreview, payload) {
  var decisionServerContext = toReaderProgressSyncDecisionServerContext(contextPreview);
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

test("no-op action defaults to blocked preview-only when no real SafeServerContext exists", function () {
  var result = validateNoopInput(makeNoopInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.success, false);
  assert.equal(result.status, "not_implemented");
  assert.equal(result.errorCode, "SERVER_ACTION_NOT_IMPLEMENTED");
  assert.equal(result.syncDecisionPreview.previewOnly, true);
  assert.equal(result.syncDecisionPreview.implemented, false);
  assert.equal(result.syncDecisionPreview.executesWrite, false);
  assert.equal(result.syncDecisionPreview.status, "blocked");
  assert.equal(result.syncDecisionPreview.hasServerUserContext, false);
  assert.equal(result.syncServiceResultPreview.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.implemented, false);
  assert.equal(result.syncServiceResultPreview.executed, false);
  assert.equal(result.syncServiceResultPreview.writesDatabase, false);
  assert.equal(result.syncServiceResultPreview.callsRepository, false);
  assert.equal(result.syncServiceResultPreview.success, false);
  assert.equal(result.syncServiceResultPreview.status, "blocked");
  assert.equal(result.syncServiceResultPreview.errorCode, "SYNC_BLOCKED");
  assert.equal(result.syncServiceResultPreview.safeToExposeToClient, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.previewOnly, true);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.implemented, false);
  assert.equal(result.syncServiceResultPreview.repositoryPreview.safeToExposeToClient, true);
});

test("SafeServerContext preview output can be aligned with the no-op action preview chain", function () {
  var noopInput = makeNoopInput();
  var noopResult = validateNoopInput(noopInput);
  var safeContextPreview = createPreviewReaderSyncSafeServerContext(
    makeSafeContextInput({
      hasAuthenticatedUser: false,
      serverUserId: undefined,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    }),
  );
  var alignedChain = buildDecisionAndServiceFromSafeContext(
    safeContextPreview,
    makeDecisionPayloadFromNoopInput(noopInput),
  );

  assert.deepEqual(
    safeContextPreview.decisionServerContextPreview,
    {
      hasAuthenticatedUser: false,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
  );
  assert.equal(safeContextPreview.serverUserId, undefined);
  assert.equal(safeContextPreview.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(safeContextPreview.permissionSummary.hasServerUserId, false);
  assert.equal(safeContextPreview.permissionSummary.canAccessBook, true);
  assert.equal(safeContextPreview.permissionSummary.canAccessChapter, true);
  assert.equal(safeContextPreview.permissionSummary.canWriteProgress, true);
  assert.equal(safeContextPreview.status, "blocked");

  assert.deepEqual(
    pickDecisionSemantics(alignedChain.decision),
    pickDecisionSemantics(noopResult.syncDecisionPreview),
  );
  assert.deepEqual(
    pickServiceSemantics(alignedChain.service),
    pickServiceSemantics(noopResult.syncServiceResultPreview),
  );
  assert.equal(alignedChain.decision.status, "blocked");
  assert.equal(alignedChain.decision.hasServerUserContext, false);
  assert.equal(alignedChain.service.success, false);
  assert.equal(alignedChain.service.executed, false);
  assert.equal(alignedChain.service.writesDatabase, false);
  assert.equal(alignedChain.service.callsRepository, false);
});

test("SafeServerContext preview maps hasAuthenticatedUser, serverUserId, and permission flags into decision/service semantics", function () {
  var cases = [
    {
      label: "ready preview",
      input: makeSafeContextInput(),
      expectedDecisionContext: {
        hasAuthenticatedUser: true,
        serverUserId: "user-align-001",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      expectedStatus: "ready_preview",
    },
    {
      label: "canAccessBook=false",
      input: makeSafeContextInput({ canAccessBook: false }),
      expectedDecisionContext: {
        hasAuthenticatedUser: false,
        serverUserId: "user-align-001",
        canAccessBook: false,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      expectedStatus: "blocked",
      expectedBlockerCode: "BOOK_ACCESS_DENIED",
    },
    {
      label: "canAccessChapter=false",
      input: makeSafeContextInput({ canAccessChapter: false }),
      expectedDecisionContext: {
        hasAuthenticatedUser: false,
        serverUserId: "user-align-001",
        canAccessBook: true,
        canAccessChapter: false,
        canWriteProgress: true,
      },
      expectedStatus: "blocked",
      expectedBlockerCode: "CHAPTER_ACCESS_DENIED",
    },
    {
      label: "canWriteProgress=false",
      input: makeSafeContextInput({ canWriteProgress: false }),
      expectedDecisionContext: {
        hasAuthenticatedUser: false,
        serverUserId: "user-align-001",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: false,
      },
      expectedStatus: "blocked",
      expectedBlockerCode: "WRITE_PROGRESS_DENIED",
    },
    {
      label: "missing serverUserId",
      input: makeSafeContextInput({ serverUserId: undefined }),
      expectedDecisionContext: {
        hasAuthenticatedUser: false,
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      expectedStatus: "blocked",
      expectedBlockerCode: "SERVER_USER_CONTEXT_REQUIRED",
    },
  ];

  cases.forEach(function (scenario) {
    var contextPreview = createPreviewReaderSyncSafeServerContext(scenario.input);
    var chain = buildDecisionAndServiceFromSafeContext(
      contextPreview,
      makeDecisionPayloadFromNoopInput(makeNoopInput()),
    );

    assert.deepEqual(contextPreview.decisionServerContextPreview, scenario.expectedDecisionContext, scenario.label + " decision-context preview mismatch");
    assert.equal(contextPreview.previewOnly, true, scenario.label + " must stay preview-only");
    assert.equal(contextPreview.implemented, false, scenario.label + " must stay not implemented");
    assert.equal(contextPreview.safeToExposeToClient, true, scenario.label + " must stay safe to expose");
    assert.equal(chain.decision.previewOnly, true, scenario.label + " decision must stay preview-only");
    assert.equal(chain.decision.implemented, false, scenario.label + " decision must stay not implemented");
    assert.equal(chain.decision.executesWrite, false, scenario.label + " decision must not execute");
    assert.equal(chain.decision.status, scenario.expectedStatus, scenario.label + " decision status mismatch");
    assert.equal(chain.service.previewOnly, true, scenario.label + " service must stay preview-only");
    assert.equal(chain.service.implemented, false, scenario.label + " service must stay not implemented");
    assert.equal(chain.service.executed, false, scenario.label + " service must not execute");
    assert.equal(chain.service.writesDatabase, false, scenario.label + " service must not write DB");
    assert.equal(chain.service.callsRepository, false, scenario.label + " service must not call repository");
    assert.equal(chain.service.success, false, scenario.label + " service must never report success");
    assert.equal(chain.service.safeToExposeToClient, true, scenario.label + " service must stay safe to expose");

    if (scenario.expectedStatus === "ready_preview") {
      assert.equal(chain.decision.hasServerUserContext, true, scenario.label + " ready preview must have server user context");
      assert.equal(chain.service.status, "ready_preview", scenario.label + " service status mismatch");
      assert.equal(chain.service.errorCode, undefined, scenario.label + " ready preview must not expose errorCode");
    } else {
      assert.equal(chain.decision.hasServerUserContext, false, scenario.label + " blocked preview must not have server user context");
      assert.equal(chain.service.status, "blocked", scenario.label + " service status mismatch");
      assert.equal(chain.service.errorCode, "SYNC_BLOCKED", scenario.label + " blocked preview must map to SYNC_BLOCKED");
      assert.equal(
        chain.decision.blockers.some(function (blocker) {
          return blocker.code === scenario.expectedBlockerCode;
        }),
        true,
        scenario.label + " must surface the expected blocker",
      );
    }
  });
});

test("dangerous fields never leak into no-op action or SafeServerContext preview output", function () {
  var noopResult = validateNoopInput(makeDangerousNoopInput());
  var safeResult = validateReaderSyncSafeServerContext(makeDangerousSafeContextInput());
  var serialized = JSON.stringify({
    noopResult: noopResult,
    safeResult: safeResult,
  });

  assert.equal(noopResult.previewOnly, true);
  assert.equal(noopResult.implemented, false);
  assert.equal(noopResult.success, false);
  assert.equal(noopResult.status, "blocked");
  assert.equal(safeResult.previewOnly, true);
  assert.equal(safeResult.implemented, false);
  assert.equal(safeResult.safeToExposeToClient, true);
  assert.equal(safeResult.status, "blocked");
  assert.equal(Object.prototype.polluted, undefined);

  assertNoDangerousOwnProps(noopResult, "no-op action result", [
    "userId",
    "role",
    "token",
    "cookie",
    "headers",
    "session",
    "metadata",
    "rawLocalStorage",
    "__proto__",
    "constructor",
    "prototype",
  ]);
  assertNoDangerousOwnProps(safeResult.context, "safe server context preview");
  assertNoDangerousOwnProps(safeResult.decisionServerContextPreview, "decision server context preview");

  [
    "client-user-id",
    "client-audit-id",
    "client-token",
    "client-cookie",
    "client-session",
    "client-local-storage",
    "client-constructor",
    "client-prototype",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "serialized preview output must not leak " + needle);
  });
});
