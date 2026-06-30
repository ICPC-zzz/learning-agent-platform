import assert from "node:assert/strict";
import test from "node:test";

const { getReaderDataFromDatabase, getReaderDataFromDatabaseResult } = await import("../../lib/reader-db.ts");

function createReaderData(overrides = {}) {
  return {
    book: {
      id: "book-1",
      sourceType: "IMPORTED_URL",
      title: "TypeScript in Practice",
      author: "Ada Lovelace",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
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
      ...(overrides.chapters ?? []),
    ],
    chunks: [
      ...(overrides.chunks ?? []),
    ],
  };
}

test("getReaderDataFromDatabase builds a safe placeholder when chapter body is missing", async () => {
  let writeCalls = 0;
  const repository = {
    async getBookReaderData(bookId) {
      assert.equal(bookId, "book-1");
      return createReaderData();
    },
    async listBooks() {
      return [];
    },
    async createBookWithContent() {
      writeCalls += 1;
      throw new Error("read path must not write");
    },
  };

  const data = await getReaderDataFromDatabase({
    bookId: "book-1",
    repository,
  });

  assert.equal(writeCalls, 0);
  assert.notEqual(data, null);
  assert.equal(data.book.id, "book-1");
  assert.equal(data.currentChapter.id, "chapter-1");
  assert.equal(
    data.currentChapter.plainText,
    "No readable chapter body is available for this preview. The saved book metadata is still accessible.",
  );
  assert.equal(data.productionReady, false);
  assert.equal(data.safeToExposeToClient, true);
  assert.equal(data.writesDatabase, false);
});

test("getReaderDataFromDatabaseResult returns a safe miss for empty repository", async () => {
  const result = await getReaderDataFromDatabaseResult({
    repository: {
      async getBookReaderData() {
        return null;
      },
      async listBooks() {
        return [];
      },
    },
  });

  assert.equal(result.data, null);
  assert.equal(result.fallbackReason, "no_database_book_found");
});
