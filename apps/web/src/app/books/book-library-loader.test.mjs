import assert from "node:assert/strict";
import test from "node:test";

const { loadBookLibrary } = await import("./book-library-loader.ts");

function createBook(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test("loadBookLibrary maps imported db books into dev-only preview items", async () => {
  let writeCalls = 0;
  const repository = {
    async listBooks() {
      return [createBook()];
    },
    async createBookWithContent() {
      writeCalls += 1;
      throw new Error("read path must not write");
    },
  };

  const result = await loadBookLibrary({ repository });

  assert.equal(writeCalls, 0);
  assert.equal(result.status, "loaded");
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].title, "TypeScript in Practice");
  assert.equal(result.books[0].chapterCount, 4);
  assert.equal(result.books[0].sourceLabel, "开发数据库导入草稿");
  assert.equal(result.books[0].previewBadge, "dev-only / preview");
  assert.equal(result.books[0].readerHref, "/reader?bookId=book-1");
  assert.equal(result.books[0].productionReady, false);
  assert.equal(result.books[0].safeToExposeToClient, true);
  assert.equal(result.books[0].writesDatabase, false);
});

test("loadBookLibrary falls back safely when repository is empty", async () => {
  const result = await loadBookLibrary({
    repository: {
      async listBooks() {
        return [];
      },
    },
  });

  assert.equal(result.status, "mock_fallback");
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].sourceLabel, "内置示例书");
  assert.equal(result.books[0].productionReady, false);
});

test("loadBookLibrary falls back safely when repository throws", async () => {
  const result = await loadBookLibrary({
    repository: {
      async listBooks() {
        throw new Error("repository unavailable");
      },
    },
  });

  assert.equal(result.status, "mock_fallback");
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].sourceLabel, "内置示例书");
  assert.equal(result.books[0].safeToExposeToClient, true);
});
