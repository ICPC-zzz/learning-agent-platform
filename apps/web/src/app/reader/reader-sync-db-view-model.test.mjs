import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderSyncDbViewModel } from "./reader-sync-db-view-model.ts";

const enabledGuard = {
  enabled: true,
  mode: "dev-only",
  productionReady: false,
  requiresExplicitOptIn: true,
  requiresDevSession: true,
  notice: "本地/开发预览：Reader dev-only DB sync 已启用。",
  blockedReasons: [],
};

const disabledGuard = {
  enabled: false,
  mode: "dev-only",
  productionReady: false,
  requiresExplicitOptIn: true,
  requiresDevSession: true,
  notice: "未启用同步：Reader dev-only DB sync 仍处于默认关闭状态。",
  blockedReasons: ["LAP_READER_SYNC_DB_DEV_ENABLED is not enabled."],
};

test("view model returns not-enabled state when guard is closed", function () {
  const vm = buildReaderSyncDbViewModel({ guard: disabledGuard });

  assert.equal(vm.state, "not-enabled");
  assert.equal(vm.label, "未启用同步");
  assert.equal(vm.canSave, false);
});

test("view model returns local preview state when guard is enabled", function () {
  const vm = buildReaderSyncDbViewModel({ guard: enabledGuard });

  assert.equal(vm.state, "local-dev-preview");
  assert.equal(vm.label, "本地/开发预览");
  assert.equal(vm.canSave, true);
});

test("view model returns saved state after successful write", function () {
  const vm = buildReaderSyncDbViewModel({
    guard: enabledGuard,
    lastResult: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "saved-dev-db",
      writesDatabase: true,
      callsRepository: true,
      repositoryOperation: "upsert",
      trustedServerUserIdPreview: "dev-user-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      progressPercent: 55,
      progressRatio: 0.55,
      position: "chapter:chapter-1:progress:55",
      clientUpdatedAt: "2026-06-15T00:00:00.000Z",
      idempotencyKeyPreview: "reader-sync-db-write-v1:abc",
      conflictStatus: "ok",
      auditEventCreated: true,
      productionReady: false,
      rawRequestStored: false,
      secretSafe: true,
      blockedReasons: [],
      warnings: [],
      message: "Reading progress was saved to the development database.",
      savedRecordPreview: {
        previewOnly: true,
        safeToExposeToClient: true,
        source: "saved-dev-db",
        userId: "dev-user-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        progressPercent: 55,
        progressRatio: 0.55,
        completedAt: null,
        updatedAt: "2026-06-15T00:00:00.000Z",
      },
    },
  });

  assert.equal(vm.state, "saved-dev-db");
  assert.equal(vm.label, "已保存到开发数据库");
  assert.equal(vm.canSave, false);
});

test("view model returns fallback state after safe error", function () {
  const vm = buildReaderSyncDbViewModel({
    guard: enabledGuard,
    lastResult: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "fallback",
      writesDatabase: false,
      callsRepository: true,
      repositoryOperation: "upsert",
      trustedServerUserIdPreview: "dev-user-1",
      bookId: "book-1",
      chapterId: "chapter-1",
      progressPercent: 55,
      progressRatio: 0.55,
      position: "chapter:chapter-1:progress:55",
      clientUpdatedAt: "2026-06-15T00:00:00.000Z",
      idempotencyKeyPreview: "reader-sync-db-write-v1:abc",
      conflictStatus: "ok",
      auditEventCreated: true,
      productionReady: false,
      rawRequestStored: false,
      secretSafe: true,
      blockedReasons: ["REPOSITORY_ERROR: sanitized"],
      warnings: [],
      message: "Repository call failed safely and returned a fallback preview.",
      savedRecordPreview: null,
    },
  });

  assert.equal(vm.state, "fallback");
  assert.equal(vm.label, "保存失败但安全 fallback");
  assert.equal(vm.canSave, true);
});
