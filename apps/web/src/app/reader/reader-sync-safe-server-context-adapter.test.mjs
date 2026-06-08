import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
import {
  createPreviewReaderSyncSafeServerContext,
  toReaderProgressSyncDecisionServerContext,
  validateReaderSyncSafeServerContext,
} from "./reader-sync-safe-server-context.ts";

function makePayload() {
  return {
    bookId: "book-adapter-001",
    chapterId: "chapter-adapter-001",
    progressRatio: 0.72,
    idempotencyKeyPreview: "reader-sync-preview:book-adapter-001:chapter-adapter-001:0.720000",
  };
}

function makeAuthenticatedPreviewInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      previewOnly: true,
      authSource: "mock",
      hasAuthenticatedUser: true,
      serverUserId: "user-adapter-001",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    o,
  );
}

function buildDecisionAndService(contextPreview) {
  var serverContext = toReaderProgressSyncDecisionServerContext(contextPreview);
  var payload = makePayload();
  var decision = buildReaderProgressSyncDecision({
    serverContext: serverContext,
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
    serverContext: serverContext,
    decision: decision,
    service: service,
  };
}

function assertNoDangerousOwnProps(target, label) {
  [
    "userId",
    "role",
    "auditId",
    "authToken",
    "token",
    "cookie",
    "headers",
    "rawHeaders",
    "session",
    "rawSession",
    "metadata",
    "rawLocalStorage",
    "__proto__",
    "constructor",
    "prototype",
  ].forEach(function (key) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(target, key),
      false,
      label + " must not expose " + key,
    );
  });
}

test("default preview context stays blocked through decision and service", function () {
  var contextPreview = createPreviewReaderSyncSafeServerContext();
  var chain = buildDecisionAndService(contextPreview);

  assert.equal(contextPreview.previewOnly, true);
  assert.equal(contextPreview.implemented, false);
  assert.equal(contextPreview.safeToExposeToClient, true);
  assert.equal(contextPreview.status, "blocked");
  assert.equal(contextPreview.hasAuthenticatedUser, false);
  assert.equal(contextPreview.permissionSummary.hasAuthenticatedUser, false);
  assert.equal(contextPreview.permissionSummary.hasServerUserId, false);
  assert.equal(contextPreview.decisionServerContextPreview.serverUserId, undefined);

  assert.equal(chain.serverContext.hasAuthenticatedUser, false);
  assert.equal(chain.serverContext.serverUserId, undefined);
  assert.equal(chain.decision.previewOnly, true);
  assert.equal(chain.decision.implemented, false);
  assert.equal(chain.decision.executesWrite, false);
  assert.equal(chain.decision.status, "blocked");
  assert.equal(chain.decision.hasServerUserContext, false);
  assert.equal(chain.decision.blockers.some(function (blocker) {
    return blocker.code === "AUTH_REQUIRED";
  }), true);
  assert.equal(chain.decision.blockers.some(function (blocker) {
    return blocker.code === "SERVER_USER_CONTEXT_REQUIRED";
  }), true);

  assert.equal(chain.service.previewOnly, true);
  assert.equal(chain.service.implemented, false);
  assert.equal(chain.service.executed, false);
  assert.equal(chain.service.writesDatabase, false);
  assert.equal(chain.service.callsRepository, false);
  assert.equal(chain.service.success, false);
  assert.equal(chain.service.status, "blocked");
  assert.equal(chain.service.errorCode, "SYNC_BLOCKED");
  assert.equal(chain.service.decisionStatus, "blocked");
  assert.equal(chain.service.safeToExposeToClient, true);
});

test("authenticated preview context maps safe fields and still resolves to a preview-only service result", function () {
  var contextPreview = createPreviewReaderSyncSafeServerContext(
    makeAuthenticatedPreviewInput(),
  );
  var chain = buildDecisionAndService(contextPreview);

  assert.equal(contextPreview.previewOnly, true);
  assert.equal(contextPreview.implemented, false);
  assert.equal(contextPreview.safeToExposeToClient, true);
  assert.equal(contextPreview.status, "preview");
  assert.equal(contextPreview.hasAuthenticatedUser, true);
  assert.equal(contextPreview.serverUserId, "user-adapter-001");
  assert.equal(contextPreview.canAccessBook, true);
  assert.equal(contextPreview.canAccessChapter, true);
  assert.equal(contextPreview.canWriteProgress, true);
  assert.equal(contextPreview.blockedReasons.length, 0);
  assert.deepEqual(contextPreview.decisionServerContextPreview, {
    hasAuthenticatedUser: true,
    serverUserId: "user-adapter-001",
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
  });

  assert.deepEqual(chain.serverContext, {
    hasAuthenticatedUser: true,
    serverUserId: "user-adapter-001",
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(chain.serverContext, "previewOnly"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(chain.serverContext, "authSource"), false);

  assert.equal(chain.decision.previewOnly, true);
  assert.equal(chain.decision.implemented, false);
  assert.equal(chain.decision.executesWrite, false);
  assert.equal(chain.decision.status, "ready_preview");
  assert.equal(chain.decision.hasServerUserContext, true);
  assert.equal(chain.decision.blockers.length, 0);
  assert.equal(chain.decision.operationPreview, "upsert-reading-progress-preview");

  assert.equal(chain.service.previewOnly, true);
  assert.equal(chain.service.implemented, false);
  assert.equal(chain.service.executed, false);
  assert.equal(chain.service.writesDatabase, false);
  assert.equal(chain.service.callsRepository, false);
  assert.equal(chain.service.callsRepositoryPortPreview, true);
  assert.equal(chain.service.success, false);
  assert.equal(chain.service.status, "ready_preview");
  assert.equal(chain.service.decisionStatus, "ready_preview");
  assert.equal(chain.service.errorCode, undefined);
  assert.equal(chain.service.safeToExposeToClient, true);
});

test("permission gaps and missing serverUserId stay blocked or safe-unwritable through the adapter chain", function () {
  var cases = [
    {
      label: "canAccessBook=false",
      overrides: { canAccessBook: false },
      blockedCode: "BOOK_ACCESS_DENIED",
      expectServerUserId: "user-adapter-001",
    },
    {
      label: "canAccessChapter=false",
      overrides: { canAccessChapter: false },
      blockedCode: "CHAPTER_ACCESS_DENIED",
      expectServerUserId: "user-adapter-001",
    },
    {
      label: "canWriteProgress=false",
      overrides: { canWriteProgress: false },
      blockedCode: "WRITE_PROGRESS_DENIED",
      expectServerUserId: "user-adapter-001",
    },
    {
      label: "missing serverUserId",
      overrides: { serverUserId: undefined },
      blockedCode: "SERVER_USER_CONTEXT_REQUIRED",
      expectServerUserId: undefined,
    },
  ];

  cases.forEach(function (scenario) {
    var contextPreview = createPreviewReaderSyncSafeServerContext(
      makeAuthenticatedPreviewInput(scenario.overrides),
    );
    var chain = buildDecisionAndService(contextPreview);

    assert.equal(contextPreview.previewOnly, true, scenario.label + " must stay preview-only");
    assert.equal(contextPreview.implemented, false, scenario.label + " must stay not implemented");
    assert.equal(contextPreview.safeToExposeToClient, true, scenario.label + " must stay safe to expose");
    assert.equal(contextPreview.status, "blocked", scenario.label + " must be blocked");
    assert.equal(contextPreview.serverUserId, scenario.expectServerUserId);
    assert.equal(
      contextPreview.permissionSummary.hasServerUserId,
      scenario.expectServerUserId !== undefined,
      scenario.label + " permission summary server user flag mismatch",
    );

    assert.equal(chain.decision.status, "blocked", scenario.label + " decision must be blocked");
    assert.equal(chain.decision.previewOnly, true, scenario.label + " decision must stay preview-only");
    assert.equal(chain.decision.implemented, false, scenario.label + " decision must stay not implemented");
    assert.equal(chain.decision.executesWrite, false, scenario.label + " decision must not execute");
    assert.equal(chain.decision.hasServerUserContext, false, scenario.label + " server user context must stay blocked");
    assert.equal(
      chain.decision.blockers.some(function (blocker) {
        return blocker.code === scenario.blockedCode;
      }),
      true,
      scenario.label + " must surface the expected blocked code",
    );

    assert.equal(chain.service.previewOnly, true, scenario.label + " service must stay preview-only");
    assert.equal(chain.service.implemented, false, scenario.label + " service must stay not implemented");
    assert.equal(chain.service.executed, false, scenario.label + " service must not execute");
    assert.equal(chain.service.writesDatabase, false, scenario.label + " service must not write DB");
    assert.equal(chain.service.callsRepository, false, scenario.label + " service must not call repository");
    assert.equal(chain.service.success, false, scenario.label + " service must never report success");
    assert.equal(chain.service.status, "blocked", scenario.label + " service must stay blocked");
    assert.equal(chain.service.errorCode, "SYNC_BLOCKED", scenario.label + " service must map to SYNC_BLOCKED");
  });
});

test("dangerous fields never enter safe output and do not pollute the adapter chain", function () {
  var dangerousInput = Object.create(null);
  Object.assign(dangerousInput, makeAuthenticatedPreviewInput());
  dangerousInput.userId = "danger-user-id";
  dangerousInput.role = "danger-role";
  dangerousInput.auditId = "danger-audit-id";
  dangerousInput.authToken = "danger-auth-token";
  dangerousInput.token = "danger-token";
  dangerousInput.cookie = "danger-cookie";
  dangerousInput.headers = "danger-headers";
  dangerousInput.rawHeaders = "danger-raw-headers";
  dangerousInput.session = "danger-session";
  dangerousInput.rawSession = "danger-raw-session";
  dangerousInput.metadata = "danger-metadata";
  dangerousInput.rawLocalStorage = "danger-raw-local-storage";
  Object.defineProperty(dangerousInput, "__proto__", {
    value: "danger-proto",
    enumerable: true,
    configurable: true,
    writable: true,
  });
  dangerousInput.constructor = "danger-constructor";
  dangerousInput.prototype = "danger-prototype";

  var validated = validateReaderSyncSafeServerContext(dangerousInput);
  var chain = buildDecisionAndService(validated.context);
  var bundle = {
    validated: validated,
    decision: chain.decision,
    service: chain.service,
  };
  var serialized = JSON.stringify(bundle);

  assert.equal(validated.previewOnly, true);
  assert.equal(validated.implemented, false);
  assert.equal(validated.safeToExposeToClient, true);
  assert.equal(validated.status, "blocked");
  assert.equal(Object.getPrototypeOf(validated.context) === Object.prototype, true);
  assert.equal(Object.prototype.polluted, undefined);
  assertNoDangerousOwnProps(validated.context, "safe context preview");
  assertNoDangerousOwnProps(validated.decisionServerContextPreview, "decision context preview");
  assertNoDangerousOwnProps(chain.decision, "decision result");
  assertNoDangerousOwnProps(chain.service, "service result");

  [
    "danger-user-id",
    "danger-role",
    "danger-audit-id",
    "danger-auth-token",
    "danger-token",
    "danger-cookie",
    "danger-headers",
    "danger-raw-headers",
    "danger-session",
    "danger-raw-session",
    "danger-metadata",
    "danger-raw-local-storage",
    "danger-proto",
    "danger-constructor",
    "danger-prototype",
  ].forEach(function (needle) {
    assert.equal(serialized.indexOf(needle), -1, "serialized adapter output must not leak " + needle);
  });
});
