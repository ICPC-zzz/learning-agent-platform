import assert from "node:assert/strict";
import test from "node:test";

const {
  buildReaderProgressResumeView,
  readerProgressResumeViewIsSafe,
} = await import("./reader-progress-resume-view-model.ts");

test("view model creates continue reading links and primary resume metadata", function () {
  const view = buildReaderProgressResumeView({
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: true,
    callsRepository: true,
    callsLLM: false,
    status: "loaded",
    ownerId: "dev-user-001",
    ownerLabel: "Dev Alpha",
    bookId: "book-1",
    message: "已读取 1 条 dev-only 阅读进度，未启用生产同步。",
    items: [
      {
        bookId: "book-1",
        bookTitle: "TypeScript in Practice",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        progressRatio: 0.81,
        completedAt: null,
        updatedAt: "2026-06-15T10:30:00.000Z",
      },
    ],
  });

  assert.equal(view.hasContinueReading, true);
  assert.equal(view.primaryBookId, "book-1");
  assert.equal(view.primaryChapterId, "chapter-1");
  assert.equal(view.primaryProgressPercent, 81);
  assert.equal(view.primaryContinueReadingHref, "/reader?bookId=book-1&chapterId=chapter-1");
  assert.equal(view.items[0].continueReadingHref, "/reader?bookId=book-1&chapterId=chapter-1");
  assert.equal(view.items[0].detailHref, "/books/book-1");
  assert.equal(view.items[0].updatedAtLabel.length > 0, true);
});

test("blocked empty view is safe and does not leak secrets", function () {
  const view = buildReaderProgressResumeView({
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: false,
    callsRepository: false,
    callsLLM: false,
    status: "blocked",
    ownerId: null,
    ownerLabel: null,
    bookId: null,
    message: "阅读进度恢复未启用，保持 dev-only 安全空态。",
    items: [],
  });

  const safety = readerProgressResumeViewIsSafe(view);

  assert.equal(view.hasContinueReading, false);
  assert.equal(view.primaryContinueReadingHref, null);
  assert.equal(safety.safe, true, safety.violations.join(", "));
  assert.equal(JSON.stringify(view).includes("DATABASE_URL"), false);
  assert.equal(JSON.stringify(view).includes("secret"), false);
});
