import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReaderSyncDbWritePreview,
  executeReaderSyncDbWrite,
} from "./reader-sync-db-write-adapter.ts";

function makeRecord(overrides) {
  const base = overrides || {};
  return {
    id: base.id ?? "reading-progress-1",
    userId: base.userId ?? "dev-user-1",
    bookId: base.bookId ?? "book-1",
    chapterId: base.chapterId ?? "chapter-1",
    lastChunkId: base.lastChunkId ?? null,
    progressRatio: base.progressRatio ?? 0.55,
    completedAt: base.completedAt ?? null,
    createdAt: base.createdAt ?? new Date("2026-06-15T00:00:00.000Z"),
    updatedAt: base.updatedAt ?? new Date("2026-06-15T00:00:00.000Z"),
  };
}

function makeRepo(calls, overrides) {
  const recorder = calls || [];
  const options = overrides || {};

  return {
    async getReadingProgress(input) {
      recorder.push(["read", input]);
      return options.existingRecord ?? null;
    },
    async upsertReadingProgress(input) {
      recorder.push(["upsert", input]);
      if (options.throwOnUpsert) {
        throw new Error(options.throwOnUpsert);
      }
      return makeRecord({
        userId: input.userId,
        bookId: input.bookId,
        chapterId: input.chapterId,
        progressRatio: input.progressRatio,
      });
    },
  };
}

function makeBaseInput(overrides) {
  const o = overrides || {};
  function pick(key, fallback) {
    return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : fallback;
  }

  return {
    envReaderSyncDbDevEnabled: pick("envReaderSyncDbDevEnabled", "true"),
    envAllowRealDbIntegration: pick("envAllowRealDbIntegration", "true"),
    trustedServerUserId: pick("trustedServerUserId", "dev-user-1"),
    permissionAllowed: pick("permissionAllowed", true),
    idempotencyAllowed: pick("idempotencyAllowed", true),
    conflictBlocked: pick("conflictBlocked", false),
    bookId: pick("bookId", "book-1"),
    chapterId: pick("chapterId", "chapter-1"),
    progressPercent: pick("progressPercent", 55),
    position: pick("position", "chapter:chapter-1:progress:55"),
    clientUpdatedAt: pick("clientUpdatedAt", "2026-06-15T00:00:00.000Z"),
    idempotencyKey: pick(
      "idempotencyKey",
      "reader-sync-db-v1:book-1:chapter-1:55:chapter:chapter-1:progress:55",
    ),
    repository: pick("repository", null),
  };
}

function assertBlocked(result, reasonFragment) {
  assert.equal(result.status, "blocked");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.repositoryOperation, "none");
  assert.equal(result.productionReady, false);
  assert.equal(result.secretSafe, true);
  assert.equal(result.rawRequestStored, false);
  assert.ok(result.blockedReasons.some((reason) => reason.includes(reasonFragment)));
}

function assertNoSecrets(result) {
  const serialized = JSON.stringify(result);
  for (const needle of [
    "DATABASE_URL",
    "password",
    "apiKey",
    "apikey",
    "accessToken",
    "refreshToken",
    '"stack"',
    "openai",
    "anthropic",
    "Agent",
  ]) {
    assert.equal(serialized.includes(needle), false, `must not leak ${needle}`);
  }
}

test("preview builder blocks by default without calling repository", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = buildReaderSyncDbWritePreview(
    makeBaseInput({
      envReaderSyncDbDevEnabled: undefined,
      repository: repo,
    }),
  );

  assertBlocked(result, "LAP_READER_SYNC_DB_DEV_ENABLED");
  assert.equal(calls.length, 0);
  assertNoSecrets(result);
});

test("execute blocks when dev env is missing without calling repository", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      envReaderSyncDbDevEnabled: undefined,
      repository: repo,
    }),
  );

  assertBlocked(result, "LAP_READER_SYNC_DB_DEV_ENABLED");
  assert.equal(calls.length, 0);
  assertNoSecrets(result);
});

test("execute blocks when real DB integration env is missing without calling repository", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      envAllowRealDbIntegration: undefined,
      repository: repo,
    }),
  );

  assertBlocked(result, "LAP_ALLOW_REAL_DB_INTEGRATION");
  assert.equal(calls.length, 0);
});

test("execute blocks when trusted dev session user is missing", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      trustedServerUserId: null,
      repository: repo,
    }),
  );

  assertBlocked(result, "TRUSTED_SERVER_USER_ID_REQUIRED");
  assert.equal(calls.length, 0);
});

test("execute blocks when permission gate is closed", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      permissionAllowed: false,
      repository: repo,
    }),
  );

  assertBlocked(result, "PERMISSION_NOT_ALLOWED");
  assert.equal(calls.length, 0);
});

test("execute blocks when idempotency preflight is closed", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      idempotencyAllowed: false,
      repository: repo,
    }),
  );

  assertBlocked(result, "IDEMPOTENCY_NOT_ALLOWED");
  assert.equal(calls.length, 0);
});

test("execute blocks when conflict preflight is blocked", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      conflictBlocked: true,
      repository: repo,
    }),
  );

  assertBlocked(result, "CONFLICT_BLOCKED");
  assert.equal(calls.length, 0);
});

test("execute writes to the injected repository when all guards pass", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      repository: repo,
    }),
  );

  assert.equal(result.status, "saved-dev-db");
  assert.equal(result.writesDatabase, true);
  assert.equal(result.callsRepository, true);
  assert.equal(result.repositoryOperation, "upsert");
  assert.equal(result.savedRecordPreview?.source, "saved-dev-db");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "upsert");
  assertNoSecrets(result);
});

test("execute returns safe fallback when repository throws", async function () {
  const calls = [];
  const repo = makeRepo(calls, { throwOnUpsert: "DB_URL=postgres://secret@example.com" });
  const result = await executeReaderSyncDbWrite(
    makeBaseInput({
      repository: repo,
    }),
  );

  assert.equal(result.status, "fallback");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, true);
  assert.equal(calls.length, 1);
  assert.equal(result.blockedReasons.some((reason) => reason.includes("REPOSITORY_ERROR")), true);
  assertNoSecrets(result);
});

test("blocked and preview results never call repository", async function () {
  const calls = [];
  const repo = makeRepo(calls);
  const blocked = buildReaderSyncDbWritePreview(
    makeBaseInput({
      envReaderSyncDbDevEnabled: undefined,
      repository: repo,
    }),
  );
  const preview = buildReaderSyncDbWritePreview(
    makeBaseInput({
      repository: repo,
    }),
  );

  assert.equal(blocked.callsRepository, false);
  assert.equal(preview.status, "ready_preview");
  assert.equal(preview.callsRepository, false);
  assert.equal(calls.length, 0);
});
