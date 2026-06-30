import assert from "node:assert/strict";
import test from "node:test";

const { loadBookDetail } = await import("./book-detail-loader.ts");

function createReaderData(overrides = {}) {
  return {
    book: {
      id: "book-1",
      sourceType: "IMPORTED_URL",
      title: "TypeScript in Practice",
      subtitle: "Draft subtitle",
      author: "Ada Lovelace",
      description: "Saved from the development import flow.",
      sourceUrl: "https://example.com/book-1",
      language: "en",
      tags: ["imported", "dev-only"],
      metadata: {
        chapterCount: 4,
        bodyChapterCount: 3,
        ownerMode: "trusted-dev-session",
        writesDatabase: true,
        safeToExposeToClient: true,
      },
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T11:00:00.000Z"),
      ...overrides.book,
    },
    chapters: [
      {
        id: "chapter-1",
        bookId: "book-1",
        parentId: null,
        title: "Chapter 1",
        orderIndex: 0,
        level: 1,
        summary: "",
      },
      {
        id: "chapter-2",
        bookId: "book-1",
        parentId: null,
        title: "Chapter 2",
        orderIndex: 1,
        level: 1,
        summary: "Chapter summary",
      },
      ...(overrides.chapters ?? []),
    ],
    chunks: [
      {
        id: "chunk-1",
        bookId: "book-1",
        chapterId: "chapter-1",
        orderIndex: 0,
        plainText: "Chapter body content.",
        metadata: { charCount: 21 },
        startOffset: 0,
        endOffset: 21,
      },
      ...(overrides.chunks ?? []),
    ],
  };
}

test("loadBookDetail maps imported db books into dev-only detail view models", async () => {
  let writeCalls = 0;
  const repository = {
    async getBookReaderData(bookId) {
      assert.equal(bookId, "book-1");
      return createReaderData();
    },
    async createBookWithContent() {
      writeCalls += 1;
      throw new Error("detail read path must not write");
    },
  };
  const readingProgressRepository = {
    async listReadingProgress() {
      return [];
    },
  };
  const userRepository = {
    async getUserByEmail() {
      return null;
    },
  };

  const result = await loadBookDetail({
    bookId: "book-1",
    repository,
    readingProgressRepository,
    userRepository,
  });

  assert.equal(writeCalls, 0);
  assert.equal(result.status, "loaded");
  assert.equal(result.book.title, "TypeScript in Practice");
  assert.equal(result.book.chapterCount, 2);
  assert.equal(result.book.sourceLabel, "开发数据库导入草稿");
  assert.equal(result.book.previewBadge, "dev-only / preview");
  assert.equal(result.book.readerHref, "/reader?bookId=book-1&chapterId=chapter-1");
  assert.equal(result.book.productionReady, false);
  assert.equal(result.book.safeToExposeToClient, true);
  assert.equal(result.book.writesDatabase, false);
  assert.equal(result.book.chapters[0].readerHref, "/reader?bookId=book-1&chapterId=chapter-1");
  assert.equal(result.book.chapters[1].readerHref, "/reader?bookId=book-1&chapterId=chapter-2");
});

test("loadBookDetail falls back safely when repository is empty", async () => {
  const result = await loadBookDetail({
    bookId: "missing-book",
    repository: {
      async getBookReaderData() {
        return null;
      },
    },
    readingProgressRepository: {
      async listReadingProgress() {
        return [];
      },
    },
    userRepository: {
      async getUserByEmail() {
        return null;
      },
    },
  });

  assert.equal(result.status, "book_not_found");
  assert.equal(result.book, null);
});
