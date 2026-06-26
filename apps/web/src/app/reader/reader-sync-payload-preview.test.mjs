import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderSyncDraft } from "./reader-sync-draft.ts";
import { buildReaderSyncPayloadPreview } from "./reader-sync-payload-preview.ts";

test("buildReaderSyncPayloadPreview returns empty when draft is empty", () => {
  const draft = buildReaderSyncDraft(null);
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.previewOnly, true);
  assert.equal(preview.targetModel, "ReadingProgress");
  assert.equal(preview.status, "empty");
  assert.equal(preview.payloadPreview, null);
});

test("buildReaderSyncPayloadPreview returns invalid when draft is invalid", () => {
  const draft = buildReaderSyncDraft("broken-json");
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.status, "invalid");
  assert.equal(preview.payloadPreview, null);
});

test("buildReaderSyncPayloadPreview returns partial and warnings when draft is partial", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-partial",
    progressRatio: 0.35,
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.status, "partial");
  assert.equal(preview.payloadPreview?.bookId, "book-partial");
  assert.equal(preview.payloadPreview?.chapterId, undefined);
  assert.equal(preview.warnings.some((warning) => warning.includes("chapterId")), true);
});

test("buildReaderSyncPayloadPreview maps ready draft into ReadingProgress payload preview", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-ready",
    chapterId: "chapter-ready",
    progressRatio: 0.66,
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.status, "ready");
  assert.deepEqual(preview.payloadPreview, {
    bookId: "book-ready",
    chapterId: "chapter-ready",
    progressRatio: 0.66,
  });
  assert.equal(preview.matchedFields.length >= 3, true);
});

test("buildReaderSyncPayloadPreview only maps minimal ReadingProgress payload fields", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-minimal-map",
    chapterId: "chapter-minimal-map",
    progressRatio: 0.5,
    id: "local-id-should-not-map",
    completedAt: "2026-05-28T00:00:00.000Z",
    lastChunkId: "chunk-local-1",
    createdAt: "2026-05-27T23:59:00.000Z",
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.deepEqual(Object.keys(preview.payloadPreview ?? {}).sort(), [
    "bookId",
    "chapterId",
    "progressRatio",
  ]);
  assert.deepEqual(
    preview.matchedFields.map((item) => item.modelField).sort(),
    [
      "ReadingProgress.bookId",
      "ReadingProgress.chapterId",
      "ReadingProgress.progressRatio",
    ],
  );
  assert.equal(preview.blockedFields.some((item) => item.field === "id"), true);
  assert.equal(preview.blockedFields.some((item) => item.field === "completedAt"), true);
  assert.equal(preview.blockedFields.some((item) => item.field === "lastChunkId"), true);
});

test("buildReaderSyncPayloadPreview keeps local-only fields in blockedFields and out of payload", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-local-only",
    chapterId: "chapter-local-only",
    progressRatio: 0.25,
    noteCount: 3,
    bookmarkCount: 1,
    readingSeconds: 90,
    sessionSeconds: 45,
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(Object.keys(preview.payloadPreview ?? {}).includes("noteCount"), false);
  assert.equal(Object.keys(preview.payloadPreview ?? {}).includes("bookmarkCount"), false);
  assert.equal(Object.keys(preview.payloadPreview ?? {}).includes("readingSeconds"), false);
  assert.equal(Object.keys(preview.payloadPreview ?? {}).includes("sessionSeconds"), false);
  assert.equal(preview.blockedFields.some((item) => item.field === "noteCount"), true);
  assert.equal(preview.blockedFields.some((item) => item.field === "sessionSeconds"), true);
});

test("buildReaderSyncPayloadPreview does not trust local userId as payload field", () => {
  const draft = buildReaderSyncDraft({
    userId: "local-user-id",
    bookId: "book-user-context",
    chapterId: "chapter-user-context",
    progressRatio: 0.9,
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.payloadPreview?.userId, undefined);
  assert.equal(preview.blockedFields.some((item) => item.field === "userId"), true);
  assert.equal(
    preview.warnings.some((warning) => warning.includes("ReadingProgress.userId")),
    true,
  );
});

test("buildReaderSyncPayloadPreview blocks unconfirmed mapped fields", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-updated-at",
    chapterId: "chapter-updated-at",
    progressRatio: 0.8,
    updatedAt: "2026-05-28T12:30:00.000Z",
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.payloadPreview?.updatedAt, undefined);
  assert.equal(preview.blockedFields.some((item) => item.field === "updatedAt"), true);
  assert.equal(preview.warnings.some((warning) => warning.includes("updatedAt")), true);
});

test("buildReaderSyncPayloadPreview blocks lastReadAt because ReadingProgress has no such field", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-no-last-read-at",
    chapterId: "chapter-no-last-read-at",
    progressRatio: 0.12,
  });
  const preview = buildReaderSyncPayloadPreview(draft);

  assert.equal(preview.blockedFields.some((item) => item.field === "lastReadAt"), true);
});
