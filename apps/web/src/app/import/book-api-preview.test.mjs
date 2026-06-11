/**
 * Book API Preview Service tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import { previewBookApiSearch } from "./book-api-preview.ts";

function createMockProvider(overrides) {
  var guardBlocked = overrides.guardBlocked !== undefined ? overrides.guardBlocked : false;
  var blockedReasons = overrides.blockedReasons || [];
  var searchResult = overrides.searchResult || null;
  var searchError = overrides.searchError || null;

  return {
    providerId: "mock-provider",
    isRealApiEnabled: !guardBlocked,
    getGuardStatus: function () {
      return {
        providerId: "mock-provider",
        productionReady: false,
        externalApiUsed: false,
        llmUsed: false,
        writesDatabase: false,
        rawResponseStored: false,
        safeToExposeToClient: true,
        guardBlocked: guardBlocked,
        blockedReasons: blockedReasons,
        fallbackSource: guardBlocked ? "empty" : "none",
      };
    },
    searchBooks: async function (_params) {
      if (searchError) throw searchError;
      return searchResult;
    },
    getBookDetail: async function (_id) {
      return { book: null, chapterPreviews: [], safety: this.getGuardStatus() };
    },
  };
}

function createMockSearchResult(books) {
  return {
    books: books,
    totalResults: books.length,
    query: "test query",
    safety: {
      providerId: "mock",
      productionReady: false,
      externalApiUsed: true,
      llmUsed: false,
      writesDatabase: false,
      rawResponseStored: false,
      safeToExposeToClient: true,
      guardBlocked: false,
      blockedReasons: [],
      fallbackSource: "none",
    },
  };
}

var mockBook = {
  externalBookId: "ext-001",
  title: "Test Book",
  authors: ["Author One"],
  description: "A test book description",
  language: "en",
  licenseHint: "in_copyright",
  coverImageUrl: "https://example.com/cover.jpg",
};

test("returns blocked preview when guard is blocked", async () => {
  var provider = createMockProvider({
    guardBlocked: true,
    blockedReasons: ["API_NOT_ENABLED", "BASE_URL_MISSING"],
  });

  var result = await previewBookApiSearch(provider, { query: "python" });

  assert.equal(result.externalApiQueried, false);
  assert.equal(result.apiBlocked, true);
  assert.equal(result.blockedReasons.length, 2);
  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.ok(result.fallbackSuggestions.length >= 1);
});

test("returns search results when guard passes", async () => {
  var provider = createMockProvider({
    guardBlocked: false,
    searchResult: createMockSearchResult([mockBook]),
  });

  var result = await previewBookApiSearch(provider, { query: "python" });

  assert.equal(result.externalApiQueried, true);
  assert.equal(result.apiBlocked, false);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].externalBookId, "ext-001");
  assert.equal(result.books[0].title, "Test Book");
  assert.equal(result.books[0].importable, false);
});

test("returns fallback suggestions when search returns no books", async () => {
  var provider = createMockProvider({
    guardBlocked: false,
    searchResult: createMockSearchResult([]),
  });

  var result = await previewBookApiSearch(provider, { query: "noresults" });

  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.ok(result.fallbackSuggestions.length >= 1);
});

test("returns error preview when provider throws", async () => {
  var provider = createMockProvider({
    guardBlocked: false,
    searchError: new Error("Network timeout"),
  });

  var result = await previewBookApiSearch(provider, { query: "test" });

  assert.equal(result.externalApiQueried, false);
  assert.equal(result.apiBlocked, true);
  assert.equal(result.books.length, 0);
});

test("blocked preview has all safety metadata fields", async () => {
  var provider = createMockProvider({ guardBlocked: true, blockedReasons: ["TEST"] });
  var result = await previewBookApiSearch(provider, { query: "test" });
  assert.equal(result.productionReady, false);
  assert.equal(result.llmUsed, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.safeToExposeToClient, true);
});

test("success preview has all safety metadata fields", async () => {
  var provider = createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult([mockBook]) });
  var result = await previewBookApiSearch(provider, { query: "test" });
  assert.equal(result.productionReady, false);
  assert.equal(result.llmUsed, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.rawResponseStored, false);
});

test("error preview has all safety metadata fields", async () => {
  var provider = createMockProvider({ guardBlocked: false, searchError: new Error("fail") });
  var result = await previewBookApiSearch(provider, { query: "test" });
  assert.equal(result.productionReady, false);
  assert.equal(result.llmUsed, false);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.rawResponseStored, false);
});

test("no LLM is called in any path", async () => {
  var r1 = await previewBookApiSearch(createMockProvider({ guardBlocked: true }), { query: "t" });
  assert.equal(r1.llmUsed, false);
  var r2 = await previewBookApiSearch(createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult([mockBook]) }), { query: "t" });
  assert.equal(r2.llmUsed, false);
  var r3 = await previewBookApiSearch(createMockProvider({ guardBlocked: false, searchError: new Error("e") }), { query: "t" });
  assert.equal(r3.llmUsed, false);
});

test("no DB write in any path", async () => {
  var result = await previewBookApiSearch(
    createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult([mockBook]) }),
    { query: "test" },
  );
  assert.equal(result.writesDatabase, false);
});

test("book view model includes only safe fields", async () => {
  var provider = createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult([mockBook]) });
  var result = await previewBookApiSearch(provider, { query: "test" });
  var book = result.books[0];
  assert.equal(book.externalBookId, "ext-001");
  assert.equal(book.importable, false);
  var bookJson = JSON.stringify(book);
  assert.equal(bookJson.includes("_internal"), false);
  assert.equal(bookJson.includes("token"), false);
});

test("query is preserved in the view model", async () => {
  var capturedQuery = "";
  var provider = {
    providerId: "mock",
    isRealApiEnabled: true,
    getGuardStatus: function () {
      return { providerId: "mock", productionReady: false, externalApiUsed: false, llmUsed: false, writesDatabase: false, rawResponseStored: false, safeToExposeToClient: true, guardBlocked: false, blockedReasons: [], fallbackSource: "none" };
    },
    searchBooks: async function (params) {
      capturedQuery = params.query;
      return { books: [], totalResults: 0, query: params.query, safety: this.getGuardStatus() };
    },
    getBookDetail: async function () { return { book: null, chapterPreviews: [], safety: this.getGuardStatus() }; },
  };
  var result = await previewBookApiSearch(provider, { query: "machine learning" });
  assert.equal(result.query, "machine learning");
  assert.equal(capturedQuery, "machine learning");
});

test("fallback suggestions include text import hint", async () => {
  var provider = createMockProvider({ guardBlocked: true, blockedReasons: ["R1"] });
  var result = await previewBookApiSearch(provider, { query: "test" });
  var hasHint = false;
  for (var i = 0; i < result.fallbackSuggestions.length; i++) {
    if (result.fallbackSuggestions[i].indexOf("文本导入") !== -1) hasHint = true;
  }
  assert.equal(hasHint, true);
});

test("maps multiple books correctly", async () => {
  var books = [
    { externalBookId: "a", title: "Book A", authors: ["A"], description: "DA", language: "en", licenseHint: "unknown", coverImageUrl: "" },
    { externalBookId: "b", title: "Book B", authors: ["B"], description: "DB", language: "zh", licenseHint: "unknown", coverImageUrl: "" },
  ];
  var provider = createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult(books) });
  var result = await previewBookApiSearch(provider, { query: "test" });
  assert.equal(result.books.length, 2);
  assert.equal(result.totalResults, 2);
});

test("all books have importable=false", async () => {
  var provider = createMockProvider({ guardBlocked: false, searchResult: createMockSearchResult([mockBook, mockBook]) });
  var result = await previewBookApiSearch(provider, { query: "test" });
  for (var i = 0; i < result.books.length; i++) {
    assert.equal(result.books[i].importable, false);
  }
});
