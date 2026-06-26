import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderSyncDraft } from "./reader-sync-draft.ts";

test("buildReaderSyncDraft returns empty when local status is missing", () => {
  const draft = buildReaderSyncDraft(null);

  assert.equal(draft.previewOnly, true);
  assert.equal(draft.status, "empty");
  assert.equal(draft.draftPayload, null);
});

test("buildReaderSyncDraft returns invalid for non-object summary", () => {
  const draft = buildReaderSyncDraft("bad-structure");

  assert.equal(draft.status, "invalid");
  assert.equal(draft.draftPayload, null);
  assert.equal(
    draft.warnings.some((warning) => warning.includes("localStatus 字段格式无效")),
    true,
  );
});

test("buildReaderSyncDraft returns ready with legal progressRatio", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-1",
    chapterId: "chapter-1",
    progressRatio: 0.42,
    updatedAt: "2026-05-28T12:00:00.000Z",
  });

  assert.equal(draft.status, "ready");
  assert.deepEqual(draft.draftPayload, {
    bookId: "book-1",
    chapterId: "chapter-1",
    progressRatio: 0.42,
    updatedAt: "2026-05-28T12:00:00.000Z",
  });
});

test("buildReaderSyncDraft converts progressPercent into progressRatio when ratio is absent", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-2",
    chapterId: "chapter-2",
    progressPercent: 80,
    updatedAt: "2026-05-28T12:10:00.000Z",
  });

  assert.equal(draft.status, "ready");
  assert.equal(draft.draftPayload?.progressRatio, 0.8);
  assert.equal(
    draft.warnings.some((warning) => warning.includes("progressPercent")),
    true,
  );
});

test("buildReaderSyncDraft returns partial with warnings when required fields are missing", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-3",
    progressRatio: 0.5,
  });

  assert.equal(draft.status, "partial");
  assert.equal(draft.draftPayload?.bookId, "book-3");
  assert.equal(draft.draftPayload?.chapterId, undefined);
  assert.equal(
    draft.warnings.some((warning) => warning.includes("chapterId")),
    true,
  );
});

test("buildReaderSyncDraft excludes local-only fields from payload", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-4",
    chapterId: "chapter-4",
    progressRatio: 0.3,
    noteCount: 2,
    bookmarkCount: 1,
    readingSeconds: 100,
    sessionSeconds: 50,
  });

  assert.equal(draft.status, "ready");
  assert.deepEqual(Object.keys(draft.draftPayload ?? {}).includes("noteCount"), false);
  assert.deepEqual(Object.keys(draft.draftPayload ?? {}).includes("bookmarkCount"), false);
  assert.deepEqual(Object.keys(draft.draftPayload ?? {}).includes("readingSeconds"), false);
  assert.deepEqual(Object.keys(draft.draftPayload ?? {}).includes("sessionSeconds"), false);
  assert.equal(
    draft.excludedLocalOnlyFields.some((item) => item.includes("noteCount")),
    true,
  );
  assert.equal(
    draft.excludedLocalOnlyFields.some((item) => item.includes("sessionSeconds")),
    true,
  );
});

test("buildReaderSyncDraft warns and drops invalid updatedAt", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-5",
    chapterId: "chapter-5",
    progressRatio: 0.6,
    updatedAt: "bad-date",
  });

  assert.equal(draft.status, "ready");
  assert.equal(draft.draftPayload?.updatedAt, undefined);
  assert.equal(
    draft.warnings.some((warning) => warning.includes("updatedAt 无法解析")),
    true,
  );
});

test("buildReaderSyncDraft keeps out-of-range progress as partial with warnings", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-6",
    chapterId: "chapter-6",
    progressRatio: 1.5,
  });

  assert.equal(draft.status, "partial");
  assert.equal(draft.draftPayload?.progressRatio, undefined);
  assert.equal(
    draft.warnings.some((warning) => warning.includes("progressRatio 字段格式无效")),
    true,
  );
});
