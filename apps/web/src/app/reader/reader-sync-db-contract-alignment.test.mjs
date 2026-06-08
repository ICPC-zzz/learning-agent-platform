import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createDisabledReadingProgressRepositoryContract,
  validateReadingProgressIdentity,
  validateReadingProgressUpsertInput,
} from "../../../../../packages/db/src/reading-progress-repository-contract.ts";
import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";

var CORE_IDENTITY_FIELDS = ["serverUserId", "bookId", "chapterId"];
var CORE_UPSERT_FIELDS = ["serverUserId", "bookId", "chapterId", "progressRatio"];
var FORBIDDEN_FIELD_VALUES = {
  role: "admin",
  auditId: "audit-secret",
  token: "token-secret",
  cookie: "cookie-secret",
  session: "session-secret",
  rawDbRecord: "raw-db-secret",
  rawLocalStorage: "raw-local-storage-secret",
  metadata: "metadata-secret",
  constructor: "constructor-secret",
  prototype: "prototype-secret",
};
var SYNTHETIC_SERVER_USER_ID = "reader-progress-sync-service-preview-server-user";

function makeValidIdentity(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: o.serverUserId !== undefined ? o.serverUserId : "server-user-123",
      bookId: o.bookId !== undefined ? o.bookId : "book-123",
      chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-456",
    },
    o,
  );
}

function makeValidUpsertInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      serverUserId: o.serverUserId !== undefined ? o.serverUserId : "server-user-123",
      bookId: o.bookId !== undefined ? o.bookId : "book-123",
      chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-456",
      progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.72,
      lastChunkId: o.lastChunkId !== undefined ? o.lastChunkId : "chunk-9",
      updatedAt:
        o.updatedAt !== undefined ? o.updatedAt : "2026-06-06T12:00:00.000Z",
      idempotencyKeyPreview:
        o.idempotencyKeyPreview !== undefined
          ? o.idempotencyKeyPreview
          : "reader-sync-preview:book-123:chapter-456:0.720000",
    },
    o,
  );
}

function makeDangerousObject(base) {
  var input = Object.create(null);
  Object.assign(input, base);
  input.userId = "client-user-999";
  input.role = FORBIDDEN_FIELD_VALUES.role;
  input.auditId = FORBIDDEN_FIELD_VALUES.auditId;
  input.token = FORBIDDEN_FIELD_VALUES.token;
  input.cookie = FORBIDDEN_FIELD_VALUES.cookie;
  input.session = FORBIDDEN_FIELD_VALUES.session;
  input.rawDbRecord = FORBIDDEN_FIELD_VALUES.rawDbRecord;
  input.rawLocalStorage = FORBIDDEN_FIELD_VALUES.rawLocalStorage;
  input.metadata = FORBIDDEN_FIELD_VALUES.metadata;
  Object.defineProperty(input, "__proto__", {
    value: { dangerous: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "constructor", {
    value: FORBIDDEN_FIELD_VALUES.constructor,
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(input, "prototype", {
    value: FORBIDDEN_FIELD_VALUES.prototype,
    enumerable: true,
    configurable: true,
  });
  return input;
}

function makeAllowedAdapterOptions() {
  return {
    previewOnly: true,
    allowDatabaseWrite: true,
    allowRepositoryCall: true,
    explicitUserAuthorization: true,
    readinessGatePassed: true,
    auditReady: true,
    idempotencyReady: true,
    conflictResolutionReady: true,
    disabled: false,
  };
}

function makeFakePersistentDependencies(existingProgress, calls) {
  var recorder = calls || [];
  return {
    findProgressByUserBookChapter: function (input) {
      recorder.push(["read", input]);
      return existingProgress;
    },
    upsertProgress: function (input) {
      recorder.push(["upsert", input]);
      return {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "upserted",
        bookId: input.bookId,
        chapterId: input.chapterId,
        progressRatio: input.progressRatio,
        lastChunkId: input.lastChunkId ?? null,
        completedAt: input.progressRatio >= 1 ? "2026-06-06T12:00:00.000Z" : null,
        updatedAt: "2026-06-06T12:00:01.000Z",
        secret: "should-not-leak",
        token: "should-not-leak",
        session: { id: "should-not-leak" },
        rawDbRecord: { should: "not-leak" },
      };
    },
    recordAuditLog: function (input) {
      recorder.push(["audit", input]);
      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: "preview",
        persisted: false,
        auditId: "audit-" + input.bookId + "-" + input.chapterId,
        action: "reader.progress.sync.repository.audit-log",
        source: "preview",
        message: "audit preview from fake repository",
        blockers: [],
        warnings: ["fake audit preview"],
        secret: "should-not-leak",
        token: "should-not-leak",
      };
    },
    claimIdempotencyKey: function (input) {
      recorder.push(["idempotency", input]);
      return {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        status: "preview",
        persisted: false,
        previewKey:
          input.idempotencyKeyPreview ||
          "reader-sync-idempotency-preview:" + input.bookId + ":" + input.chapterId,
        action: "reader.progress.sync.repository.idempotency-claim",
        source: "preview",
        message: "idempotency preview from fake repository",
        blockers: [],
        warnings: ["fake idempotency preview"],
        secret: "should-not-leak",
        cookie: "should-not-leak",
      };
    },
  };
}

function makeDecision(overrides) {
  var o = overrides || {};
  var baseDecision = buildReaderProgressSyncDecision({
    serverContext: Object.assign(
      {
        hasAuthenticatedUser: true,
        serverUserId: "server-user-123",
        canAccessBook: true,
        canAccessChapter: true,
        canWriteProgress: true,
      },
      o.serverContext || {},
    ),
    payload: Object.assign(
      {
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.72,
        idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.720000",
      },
      o.payload || {},
    ),
    existingProgress: o.existingProgress,
    options: o.options,
  });

  return Object.assign(baseDecision, o.decision || {});
}

function makeServiceInput(overrides) {
  var o = overrides || {};
  return {
    decision: o.decision,
    requestPreview: o.requestPreview,
    options: Object.assign(
      { previewOnly: true },
      o.options || {},
    ),
  };
}

function assertHasCoreFields(target, fields) {
  fields.forEach(function (field) {
    assert.equal(Object.prototype.hasOwnProperty.call(target, field), true, field + " must exist");
  });
}

function assertNoForbiddenStrings(serialized) {
  Object.keys(FORBIDDEN_FIELD_VALUES).forEach(function (key) {
    assert.equal(
      serialized.indexOf(FORBIDDEN_FIELD_VALUES[key]) === -1,
      true,
      key + " must not leak",
    );
  });
  assert.equal(serialized.indexOf("client-user-999") === -1, true, "userId must not leak");
}

test("db contract and web reader preview chain stay on the same preview-only field set", function () {
  var contract = createDisabledReadingProgressRepositoryContract();
  var identity = validateReadingProgressIdentity(makeValidIdentity());
  var upsert = validateReadingProgressUpsertInput(makeValidUpsertInput());
  var adapterCalls = [];
  var adapterWriteInput = makeValidUpsertInput();
  delete adapterWriteInput.updatedAt;
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(
      {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "existing",
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.6,
        lastChunkId: "chunk-1",
        completedAt: null,
        updatedAt: "2026-06-06T11:59:59.000Z",
      },
      adapterCalls,
    ),
    makeAllowedAdapterOptions(),
  );
  var adapterResult = adapter.previewWriteProgress(adapterWriteInput);
  var serviceAdapterCalls = [];
  var servicePersistentAdapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(
      {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "existing",
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.6,
        lastChunkId: "chunk-1",
        completedAt: null,
        updatedAt: "2026-06-06T11:59:59.000Z",
      },
      serviceAdapterCalls,
    ),
    makeAllowedAdapterOptions(),
  );
  var serviceResult = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: makeDecision(),
      requestPreview: {
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.72,
        idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.720000",
        userId: "client-user-999",
      },
      options: { previewOnly: true, persistentAdapter: servicePersistentAdapter },
    }),
  );

  assert.equal(contract.previewOnly, true);
  assert.equal(contract.implemented, false);
  assert.equal(contract.disabled, true);
  assert.equal(contract.safetyStatus.previewOnly, true);
  assert.equal(contract.capabilities.previewOnly, true);
  assert.equal(contract.capabilities.implemented, false);
  assert.equal(contract.capabilities.disabled, true);
  assert.equal(contract.capabilities.writesDatabase, false);
  assert.equal(contract.capabilities.callsPrisma, false);
  assert.equal(identity.status, "preview");
  assertHasCoreFields(identity.identity, CORE_IDENTITY_FIELDS);
  assert.equal(identity.identity.serverUserId, "server-user-123");
  assert.equal(identity.identity.bookId, "book-123");
  assert.equal(identity.identity.chapterId, "chapter-456");
  assert.equal(upsert.status, "preview");
  assertHasCoreFields(upsert.input, CORE_UPSERT_FIELDS);
  assert.equal(upsert.input.serverUserId, "server-user-123");
  assert.equal(upsert.input.bookId, "book-123");
  assert.equal(upsert.input.chapterId, "chapter-456");
  assert.equal(upsert.input.progressRatio, 0.72);
  assert.equal(adapter.capabilities.previewOnly, true);
  assert.equal(adapter.capabilities.implemented, false);
  assert.equal(adapter.capabilities.disabled, false);
  assert.equal(adapter.capabilities.writesDatabase, false);
  assert.equal(adapter.capabilities.callsRepository, false);
  assert.equal(adapterResult.previewOnly, true);
  assert.equal(adapterResult.implemented, false);
  assert.equal(adapterResult.executed, true);
  assert.equal(adapterResult.writesDatabase, false);
  assert.equal(adapterResult.callsRepository, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(adapterResult.inputPreview, "updatedAt"),
    false,
    "web adapter preview input currently omits updatedAt; keep this round aligned on the shared core fields only.",
  );
  assertHasCoreFields(adapterCalls[0][1], CORE_IDENTITY_FIELDS);
  assertHasCoreFields(adapterCalls[1][1], ["bookId", "chapterId", "progressRatio"]);
  assertHasCoreFields(adapterCalls[2][1], ["bookId", "chapterId", "progressRatio"]);
  assertHasCoreFields(adapterCalls[3][1], CORE_UPSERT_FIELDS);
  assert.equal(serviceResult.previewOnly, true);
  assert.equal(serviceResult.implemented, false);
  assert.equal(serviceResult.executed, false);
  assert.equal(serviceResult.writesDatabase, false);
  assert.equal(serviceResult.callsRepository, false);
  assert.equal(serviceResult.callsRepositoryPortPreview, true);
  assert.equal(serviceResult.persistentAdapterPreview.previewOnly, true);
  assert.equal(serviceResult.persistentAdapterPreview.implemented, false);
  assert.equal(serviceResult.persistentAdapterPreview.writesDatabase, false);
  assert.equal(serviceResult.persistentAdapterPreview.callsRepository, true);
  assertHasCoreFields(serviceAdapterCalls[0][1], CORE_IDENTITY_FIELDS);
  assert.equal(serviceAdapterCalls[0][1].serverUserId, SYNTHETIC_SERVER_USER_ID);
  assert.equal(serviceAdapterCalls[0][1].serverUserId, "reader-progress-sync-service-preview-server-user");
  assert.equal(serviceResult.normalizedPayload.bookId, "book-123");
  assert.equal(serviceResult.normalizedPayload.chapterId, "chapter-456");
  assert.equal(serviceResult.normalizedPayload.progressRatio, 0.72);
  assert.equal(Object.prototype.hasOwnProperty.call(serviceResult.normalizedPayload, "userId"), false);
});

test("db contract, adapter, and service all reject client userId and dangerous fields", function () {
  var dirtyIdentity = makeDangerousObject(makeValidIdentity());
  var dirtyUpsert = makeDangerousObject(makeValidUpsertInput());
  var contractIdentity = validateReadingProgressIdentity(dirtyIdentity);
  var contractUpsert = validateReadingProgressUpsertInput(dirtyUpsert);
  var adapterCalls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(null, adapterCalls),
    makeAllowedAdapterOptions(),
  );
  var adapterResult = adapter.previewWriteProgress(dirtyUpsert);
  var serviceCalls = [];
  var serviceAdapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(null, serviceCalls),
    makeAllowedAdapterOptions(),
  );
  var serviceResult = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: makeDecision({
        options: { previewOnly: true },
      }),
      requestPreview: makeDangerousObject({
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: 0.72,
        idempotencyKeyPreview: "reader-sync-preview:book-123:chapter-456:0.720000",
      }),
      options: { previewOnly: true, persistentAdapter: serviceAdapter },
    }),
  );

  assert.equal(contractIdentity.status, "blocked");
  assert.equal(contractIdentity.identity, null);
  assert.equal(contractUpsert.status, "blocked");
  assert.equal(contractUpsert.input, null);
  assert.equal(adapterResult.status, "blocked");
  assert.equal(adapterCalls.length, 0);
  assert.equal(serviceResult.status, "ready_preview");
  assert.equal(serviceResult.executed, false);
  assert.equal(serviceCalls.length > 0, true);
  assertNoForbiddenStrings(JSON.stringify(contractIdentity));
  assertNoForbiddenStrings(JSON.stringify(contractUpsert));
  assertNoForbiddenStrings(JSON.stringify(adapterResult));
  assertNoForbiddenStrings(JSON.stringify(serviceResult));
  assert.equal(
    Object.prototype.hasOwnProperty.call(serviceResult.normalizedPayload, "userId"),
    false,
  );
  assert.equal(
    serviceCalls[0][1].serverUserId,
    SYNTHETIC_SERVER_USER_ID,
  );
});

test("progressRatio range and missing core fields stay blocked or invalid without any write", function () {
  var contractLow = validateReadingProgressUpsertInput(
    makeValidUpsertInput({ progressRatio: -0.01 }),
  );
  var contractHigh = validateReadingProgressUpsertInput(
    makeValidUpsertInput({ progressRatio: 1.01 }),
  );
  var contractMissingIdentity = validateReadingProgressIdentity(
    makeValidIdentity({ serverUserId: "" }),
  );
  var adapterCalls = [];
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(null, adapterCalls),
    makeAllowedAdapterOptions(),
  );
  var adapterLow = adapter.previewWriteProgress(
    makeValidUpsertInput({ progressRatio: -0.01 }),
  );
  var adapterMissing = adapter.previewWriteProgress(
    makeValidUpsertInput({ chapterId: "" }),
  );
  var serviceCalls = [];
  var serviceAdapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(null, serviceCalls),
    makeAllowedAdapterOptions(),
  );
  var serviceLow = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: makeDecision({
        payload: {
          progressRatio: -0.01,
        },
      }),
      requestPreview: {
        bookId: "book-123",
        chapterId: "chapter-456",
        progressRatio: -0.01,
      },
      options: { previewOnly: true, persistentAdapter: serviceAdapter },
    }),
  );
  var serviceMissing = buildReaderProgressSyncServiceResult(
    makeServiceInput({
      decision: null,
      requestPreview: {
        bookId: "",
        chapterId: "",
        progressRatio: 0.72,
      },
      options: { previewOnly: true, persistentAdapter: serviceAdapter },
    }),
  );

  assert.equal(contractLow.status, "blocked");
  assert.equal(contractHigh.status, "blocked");
  assert.equal(contractMissingIdentity.status, "blocked");
  assert.equal(adapterLow.status, "blocked");
  assert.equal(adapterMissing.status, "blocked");
  assert.equal(adapterCalls.length, 0);
  assert.equal(serviceLow.status, "invalid");
  assert.equal(serviceLow.errorCode, "INVALID_SYNC_DECISION");
  assert.equal(serviceLow.writesDatabase, false);
  assert.equal(serviceLow.callsRepository, false);
  assert.equal(serviceMissing.status, "invalid");
  assert.equal(serviceMissing.errorCode, "INVALID_SYNC_DECISION");
  assert.equal(serviceCalls.length, 0);
});

test("preview-only default posture remains disabled and backend-free", function () {
  var contract = createDisabledReadingProgressRepositoryContract();
  var adapter = createReaderSyncPersistentRepositoryAdapter(
    makeFakePersistentDependencies(null, []),
  );
  var service = buildReaderProgressSyncServiceResult({
    decision: null,
    requestPreview: null,
    options: { previewOnly: true },
  });
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-db-contract-alignment.test.mjs");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }
  var content = fs.readFileSync(filePath, "utf-8");

  assert.equal(contract.previewOnly, true);
  assert.equal(contract.implemented, false);
  assert.equal(contract.disabled, true);
  assert.equal(adapter.capabilities.previewOnly, true);
  assert.equal(adapter.capabilities.implemented, false);
  assert.equal(adapter.capabilities.disabled, true);
  assert.equal(adapter.capabilities.writesDatabase, false);
  assert.equal(adapter.capabilities.callsRepository, false);
  assert.equal(service.previewOnly, true);
  assert.equal(service.implemented, false);
  assert.equal(service.executed, false);
  assert.equal(service.writesDatabase, false);
  assert.equal(service.callsRepository, false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/window\./.test(content), false);
});
