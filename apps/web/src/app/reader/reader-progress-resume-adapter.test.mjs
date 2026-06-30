import assert from "node:assert/strict";
import test from "node:test";

const {
  loadReaderProgressResumeData,
  createBlockedReaderProgressResumeData,
} = await import("./reader-progress-resume-adapter.ts");

function makeProgressRecord(overrides = {}) {
  return {
    id: overrides.id ?? "progress-1",
    userId: overrides.userId ?? "dev-user-001",
    bookId: overrides.bookId ?? "book-1",
    chapterId: overrides.chapterId ?? "chapter-1",
    lastChunkId: overrides.lastChunkId ?? null,
    progressRatio: overrides.progressRatio ?? 0.64,
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-15T09:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-06-15T10:00:00.000Z"),
  };
}

function makeProgressRepository(records) {
  return {
    calls: [],
    async listReadingProgress(input) {
      this.calls.push(input);
      return records;
    },
    async upsertReadingProgress() {
      throw new Error("read path must not write");
    },
  };
}

function makeBookRepository(bookTitle, chapterTitle) {
  return {
    calls: [],
    async getBookReaderData(bookId) {
      this.calls.push(bookId);
      return {
        book: {
          id: bookId,
          title: bookTitle,
        },
        chapters: [
          {
            id: "chapter-1",
            title: chapterTitle,
          },
        ],
      };
    },
  };
}

test("blocked empty state is safe when no trusted owner is provided", async function () {
  const result = await loadReaderProgressResumeData({
    ownerId: null,
    ownerLabel: null,
    limit: 1,
    readingProgressRepository: makeProgressRepository([makeProgressRecord()]),
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.items.length, 0);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
});

test("loaded resume data maps progress into continue-reading records", async function () {
  const progressRepository = makeProgressRepository([
    makeProgressRecord({
      bookId: "book-1",
      chapterId: "chapter-1",
      progressRatio: 0.81,
      updatedAt: new Date("2026-06-15T10:30:00.000Z"),
    }),
    makeProgressRecord({
      bookId: "book-1",
      chapterId: "chapter-2",
      progressRatio: 0.22,
      updatedAt: new Date("2026-06-15T09:30:00.000Z"),
    }),
  ]);
  const bookRepository = makeBookRepository("TypeScript in Practice", "Chapter One");

  const result = await loadReaderProgressResumeData({
    ownerId: "dev-user-001",
    ownerLabel: "Dev Alpha",
    bookId: "book-1",
    limit: 1,
    readingProgressRepository: progressRepository,
    bookRepository,
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].bookTitle, "TypeScript in Practice");
  assert.equal(result.items[0].chapterTitle, "Chapter One");
  assert.equal(result.items[0].progressRatio, 0.81);
  assert.equal(result.items[0].updatedAt, "2026-06-15T10:30:00.000Z");
  assert.equal(progressRepository.calls.length, 1);
  assert.equal(progressRepository.calls[0].userId, "dev-user-001");
  assert.equal(progressRepository.calls[0].bookId, "book-1");
  assert.equal(progressRepository.calls[0].limit, 1);
  assert.equal(bookRepository.calls.length, 1);
  assert.equal(bookRepository.calls[0], "book-1");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, true);
  assert.equal(JSON.stringify(result).includes("stack"), false);
});

test("missing book repository falls back to safe ids instead of breaking the read path", async function () {
  const result = await loadReaderProgressResumeData({
    ownerId: "dev-user-001",
    ownerLabel: "Dev Alpha",
    limit: 3,
    readingProgressRepository: makeProgressRepository([
      makeProgressRecord({
        bookId: "book-1",
        chapterId: "chapter-1",
      }),
    ]),
    bookRepository: null,
  });

  assert.equal(result.status, "loaded");
  assert.equal(result.items[0].bookTitle, "book-1");
  assert.equal(result.items[0].chapterTitle, "chapter-1");
});

test("explicit blocked helper returns safe empty state", function () {
  const result = createBlockedReaderProgressResumeData("Dev Alpha");

  assert.equal(result.status, "blocked");
  assert.equal(result.ownerLabel, "Dev Alpha");
  assert.equal(result.items.length, 0);
});
