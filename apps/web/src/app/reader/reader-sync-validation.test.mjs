import assert from "node:assert/strict";
import test from "node:test";

import { validateSyncableFields } from "./reader-sync-validation.ts";

test("validateSyncableFields returns empty for null and undefined", () => {
  const nullResult = validateSyncableFields(null);
  const undefinedResult = validateSyncableFields(undefined);

  assert.equal(nullResult.status, "empty");
  assert.equal(undefinedResult.status, "empty");
  assert.equal(nullResult.isValid, false);
  assert.equal(undefinedResult.isValid, false);
});

test("validateSyncableFields returns invalid for non-object", () => {
  const result = validateSyncableFields("not-object");

  assert.equal(result.status, "invalid");
  assert.equal(result.invalidFields.some((item) => item.field === "localStatus"), true);
});

test("validateSyncableFields returns partial with missing fields when bookId/chapterId are missing", () => {
  const result = validateSyncableFields({
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    progressRatio: 0.4,
  });

  assert.equal(result.status, "partial");
  assert.equal(result.missingFields.includes("bookId"), true);
  assert.equal(result.missingFields.includes("chapterId"), true);
  assert.equal(result.validFields.includes("progressRatio"), true);
});

test("validateSyncableFields marks progressRatio out of range as invalid", () => {
  const result = validateSyncableFields({
    bookId: "book-1",
    chapterId: "chapter-1",
    progressRatio: 1.2,
  });

  assert.equal(result.status, "partial");
  assert.equal(
    result.invalidFields.some((item) => item.field === "progressRatio"),
    true,
  );
});

test("validateSyncableFields marks progressPercent out of range as invalid", () => {
  const result = validateSyncableFields({
    bookId: "book-1",
    chapterId: "chapter-1",
    progressPercent: 150,
  });

  assert.equal(result.status, "partial");
  assert.equal(
    result.invalidFields.some((item) => item.field === "progressPercent"),
    true,
  );
});

test("validateSyncableFields returns valid for legal ids and progressRatio", () => {
  const result = validateSyncableFields({
    bookId: "book-2",
    chapterId: "chapter-2",
    progressRatio: 0.66,
    updatedAt: "2026-05-28T10:00:00.000Z",
  });

  assert.equal(result.status, "valid");
  assert.equal(result.isValid, true);
  assert.deepEqual(result.validFields, [
    "bookId",
    "chapterId",
    "progressRatio",
    "updatedAt",
  ]);
});

test("validateSyncableFields adds warning for conflicting ratio and percent", () => {
  const result = validateSyncableFields({
    bookId: "book-3",
    chapterId: "chapter-3",
    progressRatio: 0.2,
    progressPercent: 90,
  });

  assert.equal(result.status, "valid");
  assert.equal(
    result.warnings.some((warning) => warning.includes("冲突")),
    true,
  );
});

test("validateSyncableFields keeps local-only fields out of validFields", () => {
  const result = validateSyncableFields({
    bookId: "book-4",
    chapterId: "chapter-4",
    progressPercent: 45,
    noteCount: 2,
    bookmarkCount: 1,
    readingSeconds: 300,
  });

  assert.equal(result.status, "valid");
  assert.equal(result.validFields.includes("noteCount"), false);
  assert.equal(result.validFields.includes("bookmarkCount"), false);
  assert.equal(result.validFields.includes("readingSeconds"), false);
  assert.equal(
    result.warnings.some((warning) => warning.includes("local-only")),
    true,
  );
});
