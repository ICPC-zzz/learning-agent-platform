import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderSyncPreview } from "./reader-sync-preview.ts";

test("buildReaderSyncPreview returns empty when localStorage is unavailable", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: false,
    rawSummary: null,
  });

  assert.equal(preview.previewOnly, true);
  assert.equal(preview.status, "empty");
  assert.equal(preview.syncableFields.length, 0);
  assert.equal(preview.warnings.length > 0, true);
});

test("buildReaderSyncPreview returns invalid when summary json is broken", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: "{bad-json",
  });

  assert.equal(preview.status, "invalid");
  assert.equal(preview.syncableFields.length, 0);
  assert.equal(preview.warnings.some((warning) => warning.includes("JSON")), true);
});

test("buildReaderSyncPreview marks ready and exposes syncable fields with progress", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.42,
      updatedAt: "2026-05-28T08:00:00.000Z",
    }),
  });

  assert.equal(preview.status, "ready");
  assert.deepEqual(preview.syncableFields, [
    "bookId",
    "chapterId",
    "progressRatio",
    "updatedAt",
  ]);
});

test("buildReaderSyncPreview always keeps note/bookmark/reading fields local-only", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-2",
      chapterId: "chapter-2",
      progressPercent: 78,
      noteCount: 2,
      bookmarkCount: 3,
      readingSeconds: 900,
      sessionSeconds: 120,
      updatedAt: "2026-05-28T09:00:00.000Z",
    }),
  });

  assert.equal(preview.status, "ready");
  assert.equal(preview.localOnlyFields.includes("noteCount"), true);
  assert.equal(preview.localOnlyFields.includes("bookmarkCount"), true);
  assert.equal(preview.localOnlyFields.includes("readingSeconds"), true);
  assert.equal(preview.localOnlyFields.includes("sessionSeconds(legacy)"), true);
});

test("buildReaderSyncPreview returns partial with warnings when required fields are missing", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-3",
      progressPercent: 20,
    }),
  });

  assert.equal(preview.status, "partial");
  assert.equal(preview.syncableFields.includes("bookId"), true);
  assert.equal(preview.syncableFields.includes("progressPercent"), true);
  assert.equal(
    preview.warnings.some((warning) => warning.includes("chapterId")),
    true,
  );
  assert.equal(
    preview.warnings.some((warning) => warning.includes("updatedAt")),
    true,
  );
});

test("buildReaderSyncPreview includes missing bookId warning from validation aggregation", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      chapterId: "chapter-missing-book",
      progressRatio: 0.3,
      updatedAt: "2026-05-28T10:00:00.000Z",
    }),
  });

  assert.equal(preview.status, "partial");
  assert.equal(
    preview.warnings.some((warning) => warning.includes("缺少 bookId")),
    true,
  );
});

test("buildReaderSyncPreview includes invalid progress warning and does not mark ready", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-invalid-progress",
      chapterId: "chapter-invalid-progress",
      progressRatio: 1.4,
      updatedAt: "2026-05-28T10:10:00.000Z",
    }),
  });

  assert.equal(preview.status, "partial");
  assert.equal(
    preview.warnings.some((warning) => warning.includes("progressRatio 字段格式无效")),
    true,
  );
});

test("buildReaderSyncPreview includes unparsable updatedAt warning from validation", () => {
  const preview = buildReaderSyncPreview({
    storageAvailable: true,
    rawSummary: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-bad-date",
      chapterId: "chapter-bad-date",
      progressPercent: 55,
      updatedAt: "not-a-date",
    }),
  });

  assert.equal(preview.status, "ready");
  assert.equal(preview.syncableFields.includes("updatedAt"), false);
  assert.equal(
    preview.warnings.some((warning) => warning.includes("updatedAt 无法解析为有效日期")),
    true,
  );
});
