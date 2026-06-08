import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createNoopReaderSyncRepositoryPort,
  createReaderSyncRepositoryPortPreview,
} from "./reader-sync-repository-port.ts";

function makeValidWriteInput(overrides) {
  var o = overrides || {};
  return {
    bookId: o.bookId !== undefined ? o.bookId : "book-001",
    chapterId: o.chapterId !== undefined ? o.chapterId : "chapter-001",
    progressRatio: o.progressRatio !== undefined ? o.progressRatio : 0.6,
    idempotencyKeyPreview:
      o.idempotencyKeyPreview !== undefined
        ? o.idempotencyKeyPreview
        : "reader-sync-preview:book-001:chapter-001:0.600000",
  };
}

test("noop port capabilities are fully disabled and preview-only", function () {
  var port = createNoopReaderSyncRepositoryPort();

  assert.equal(port.capabilities.previewOnly, true);
  assert.equal(port.capabilities.implemented, false);
  assert.equal(port.capabilities.readsDatabase, false);
  assert.equal(port.capabilities.writesDatabase, false);
  assert.equal(port.capabilities.callsRepository, false);
  assert.equal(port.capabilities.persistsAudit, false);
  assert.equal(port.capabilities.persistsIdempotency, false);
  assert.equal(port.capabilities.safeToExposeToClient, true);
  assert.equal(port.capabilities.mode, "noop");
});

test("mock preview wrapper exposes safe preview-only port metadata", function () {
  var preview = createReaderSyncRepositoryPortPreview();

  assert.equal(preview.previewOnly, true);
  assert.equal(preview.implemented, false);
  assert.equal(preview.safeToExposeToClient, true);
  assert.equal(preview.mode, "mock");
  assert.equal(preview.capabilities.previewOnly, true);
  assert.equal(preview.capabilities.safeToExposeToClient, true);
  assert.equal(preview.capabilities.readsDatabase, false);
  assert.equal(preview.capabilities.writesDatabase, false);
});

test("noop readProgress does not read DB and returns not_implemented", function () {
  var port = createNoopReaderSyncRepositoryPort();
  var result = port.readProgress({
    bookId: "book-001",
    chapterId: "chapter-001",
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.targetModel, "ReadingProgress");
  assert.equal(result.mode, "noop");
  assert.equal(result.status, "not_implemented");
  assert.equal(result.snapshotPreview, null);
  assert.equal(result.blockers.length, 0);
  assert.ok(result.message.toLowerCase().indexOf("not implemented") !== -1);
});

test("mock readProgress returns unavailable without touching DB", function () {
  var preview = createReaderSyncRepositoryPortPreview();
  var result = preview.port.readProgress({
    bookId: "book-001",
    chapterId: "chapter-001",
  });

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.mode, "mock");
  assert.equal(result.status, "unavailable");
  assert.equal(result.snapshotPreview, null);
  assert.equal(result.blockers.length, 0);
  assert.ok(result.message.toLowerCase().indexOf("repository") !== -1);
});

test("mock previewWriteProgress returns preview data without persistence", function () {
  var preview = createReaderSyncRepositoryPortPreview();
  var result = preview.port.previewWriteProgress(makeValidWriteInput());

  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.mode, "mock");
  assert.equal(result.status, "preview");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.notEqual(result.snapshotPreview, null);
  assert.equal(result.snapshotPreview.bookId, "book-001");
  assert.equal(result.snapshotPreview.chapterId, "chapter-001");
  assert.equal(result.snapshotPreview.progressRatio, 0.6);
  assert.equal(result.auditPreview.previewOnly, true);
  assert.equal(result.auditPreview.persisted, false);
  assert.equal(result.auditPreview.status, "preview");
  assert.equal(result.idempotencyPreview.previewOnly, true);
  assert.equal(result.idempotencyPreview.persisted, false);
  assert.equal(result.idempotencyPreview.status, "preview");
});

test("audit and idempotency previews generate preview values but do not persist", function () {
  var preview = createReaderSyncRepositoryPortPreview();
  var input = makeValidWriteInput();

  var auditPreview = preview.port.previewAudit(input);
  var idempotencyPreview = preview.port.previewIdempotency(input);

  assert.equal(auditPreview.previewOnly, true);
  assert.equal(auditPreview.safeToExposeToClient, true);
  assert.equal(auditPreview.persisted, false);
  assert.equal(auditPreview.status, "preview");
  assert.equal(typeof auditPreview.auditId, "string");
  assert.ok(auditPreview.auditId.indexOf("reader-sync-audit-preview:") === 0);

  assert.equal(idempotencyPreview.previewOnly, true);
  assert.equal(idempotencyPreview.safeToExposeToClient, true);
  assert.equal(idempotencyPreview.persisted, false);
  assert.equal(idempotencyPreview.status, "preview");
  assert.equal(typeof idempotencyPreview.previewKey, "string");
  assert.ok(
    idempotencyPreview.previewKey.indexOf("reader-sync-idempotency-preview:") === 0,
  );
});

test("userId and other forbidden fields are rejected instead of being trusted", function () {
  var preview = createReaderSyncRepositoryPortPreview();
  var input = makeValidWriteInput({
    userId: "evil-user",
  });

  input.userId = "evil-user";
  var result = preview.port.previewWriteProgress(input);

  assert.equal(result.status, "blocked");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.snapshotPreview, null);
  assert.equal(result.auditPreview.status, "blocked");
  assert.equal(result.idempotencyPreview.status, "blocked");
  assert.ok(JSON.stringify(result).indexOf("evil-user") === -1);
});

test("port file does not import repository, prisma, fetch, or environment access", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reader-sync-repository-port.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");
  assert.equal(/import\s+.*repository/i.test(content), false);
  assert.equal(/from\s+["'].*repository/i.test(content), false);
  assert.equal(/import\s+.*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*prisma/i.test(content), false);
  assert.equal(/from\s+["'].*@prisma/i.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/process\.env/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage/.test(content), false);
});
