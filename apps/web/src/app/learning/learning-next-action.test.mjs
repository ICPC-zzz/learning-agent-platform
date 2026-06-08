import assert from "node:assert/strict";
import test from "node:test";

import { createLearningNextAction } from "./learning-next-action.ts";
import {
  parseLearningReaderLocalStatusSummary,
  parseLearningReaderLocalStatusSummaryRaw,
} from "./learning-reader-local-status.ts";

test("createLearningNextAction returns reader fallback when local summary is missing", () => {
  const action = createLearningNextAction(null);

  assert.equal(action.href, "/reader");
  assert.equal(action.previewOnly, true);
  assert.equal(action.actionLabel, "前往 Reader");
});

test("createLearningNextAction builds safe encoded reader href from local summary", () => {
  const summary = parseLearningReaderLocalStatusSummary({
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    bookId: "book a/1",
    chapterId: "chapter ?=2",
    progressPercent: 20,
    noteCount: 0,
    bookmarkCount: 1,
    readingSeconds: 300,
    updatedAt: "2026-05-27T12:00:00.000Z",
  });

  assert.notEqual(summary, null);
  const action = createLearningNextAction(summary);

  const hrefAsUrl = new URL(`https://local.test${action.href}`);
  assert.equal(hrefAsUrl.pathname, "/reader");
  assert.equal(hrefAsUrl.searchParams.get("bookId"), "book a/1");
  assert.equal(hrefAsUrl.searchParams.get("chapterId"), "chapter ?=2");
  assert.equal(action.title, "继续完成本章前 30% 阅读");
});

test("parser falls back to sessionSeconds and defaults missing note/bookmark count", () => {
  const summary = parseLearningReaderLocalStatusSummaryRaw(
    JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.42,
      sessionSeconds: 720,
      updatedAt: "2026-05-27T12:00:00.000Z",
    }),
  );

  assert.notEqual(summary, null);
  assert.equal(summary.progressPercent, 42);
  assert.equal(summary.readingSeconds, 720);
  assert.equal(summary.noteCount, 0);
  assert.equal(summary.bookmarkCount, 0);
});

test("parser degrades safely for invalid json or invalid shape", () => {
  const invalidJson = parseLearningReaderLocalStatusSummaryRaw("{bad json");
  assert.equal(invalidJson, null);

  const invalidShape = parseLearningReaderLocalStatusSummary({
    schemaVersion: 2,
    source: "reader",
    previewOnly: true,
  });
  assert.equal(invalidShape, null);
});
