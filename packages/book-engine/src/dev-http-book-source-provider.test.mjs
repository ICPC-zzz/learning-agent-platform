/**
 * Dev HTTP Book Source Provider tests.
 *
 * Tests the dev-only HTTP adapter with guard conditions, fake fetch,
 * error handling, and safety metadata verification.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import used in existing node:test coverage
import { createDevHttpBookSourceProvider } from "./dev-http-book-source-provider.ts";

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

function createFakeFetch(responseData, ok = true, status = 200) {
  return async (_url, _init) => {
    return {
      ok,
      status,
      json: async () => responseData,
    };
  };
}

function createFakeFetchThatThrows(error) {
  return async (_url, _init) => {
    throw error;
  };
}

function createFakeFetchThatAborts(_timeoutMs) {
  return async (_url, _init) => {
    const err = new DOMException("The operation was aborted", "AbortError");
    throw err;
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBookItem = {
  id: "book-001",
  title: "深入理解 Python 异步编程",
  authors: ["张三", "李四"],
  description: "一本关于 Python asyncio 的深入教程",
  language: "zh",
  sourceUrl: "https://books.example.com/book-001",
  license: "in_copyright",
  coverImageUrl: "https://books.example.com/covers/book-001.jpg",
};

const mockSearchResponse = {
  items: [mockBookItem],
  totalResults: 1,
};

const mockBookDetailResponse = {
  book: mockBookItem,
};

// ---------------------------------------------------------------------------
// Guard: default blocked (all env vars missing)
// ---------------------------------------------------------------------------

test("searchBooks returns blocked metadata when all guards are off (default)", async () => {
  const provider = createDevHttpBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.externalApiUsed, false);
  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.query, "python");
  assert.ok(result.safety.blockedReasons.length >= 3);
});

test("getBookDetail returns blocked metadata when all guards are off (default)", async () => {
  const provider = createDevHttpBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
    },
  });

  const result = await provider.getBookDetail("book-001");

  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.externalApiUsed, false);
  assert.equal(result.book, null);
  assert.equal(result.chapterPreviews.length, 0);
});

test("getGuardStatus returns blocked when all guards are off", () => {
  const provider = createDevHttpBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
    },
  });

  const status = provider.getGuardStatus();

  assert.equal(status.guardBlocked, true);
  assert.equal(status.externalApiUsed, false);
});

test("isRealApiEnabled returns false when all guards are off", () => {
  const provider = createDevHttpBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
    },
  });

  assert.equal(provider.isRealApiEnabled, false);
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_BOOK_API_DEV_ENABLED
// ---------------------------------------------------------------------------

test("searchBooks blocked when only LAP_BOOK_API_DEV_ENABLED is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createDevHttpBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://api.example.com",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.books.length, 0);
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_ALLOW_EXTERNAL_BOOK_API
// ---------------------------------------------------------------------------

test("searchBooks blocked when only LAP_ALLOW_EXTERNAL_BOOK_API is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createDevHttpBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: false,
      bookApiBaseUrl: "https://api.example.com",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_BOOK_API_BASE_URL
// ---------------------------------------------------------------------------

test("searchBooks blocked when only LAP_BOOK_API_BASE_URL is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createDevHttpBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: null,
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("BASE_URL")));
});

// ---------------------------------------------------------------------------
// Guard: all pass → fetch is called
// ---------------------------------------------------------------------------

test("searchBooks calls fetch when all guards pass", async () => {
  let fetchUrl = "";
  const provider = createDevHttpBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://api.example.com",
    },
  });

  const result = await provider.searchBooks({ query: "python programming" });

  assert.ok(fetchUrl.includes("https://api.example.com/search"));
  assert.ok(fetchUrl.includes("python%20programming"));
  assert.equal(result.safety.guardBlocked, false);
  assert.equal(result.safety.externalApiUsed, true);
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].title, "深入理解 Python 异步编程");
});

test("getBookDetail calls fetch when all guards pass", async () => {
  let fetchUrl = "";
  const provider = createDevHttpBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockBookDetailResponse }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://api.example.com",
    },
  });

  const result = await provider.getBookDetail("book-001");

  assert.ok(fetchUrl.includes("https://api.example.com/books/book-001"));
  assert.equal(result.safety.guardBlocked, false);
  assert.equal(result.safety.externalApiUsed, true);
  assert.equal(result.book?.title, "深入理解 Python 异步编程");
});

// ---------------------------------------------------------------------------
// Normalized book metadata
// ---------------------------------------------------------------------------

test("searchBooks returns normalized book metadata from provider response", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://api.example.com",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(result.books.length, 1);
  const book = result.books[0];

  // All required fields present
  assert.equal(book.providerId, "dev-http");
  assert.equal(book.externalBookId, "book-001");
  assert.equal(book.title, "深入理解 Python 异步编程");
  assert.deepEqual(book.authors, ["张三", "李四"]);
  assert.ok(book.description.length > 0);
  assert.equal(book.language, "zh");
  assert.equal(book.sourceUrl, "https://books.example.com/book-001");
  assert.equal(book.licenseHint, "in_copyright");
  assert.equal(book.coverImageUrl, "https://books.example.com/covers/book-001.jpg");
  assert.equal(book.chapterPreviewCount, 0);
  assert.equal(book.importable, false);
});

test("searchBooks normalizes alternate field names (items/books/results)", async () => {
  // Test "books" key instead of "items"
  const withBooks = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ books: [mockBookItem] }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });
  const r1 = await withBooks.searchBooks({ query: "test" });
  assert.equal(r1.books.length, 1);

  // Test "results" key
  const withResults = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ results: [mockBookItem] }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });
  const r2 = await withResults.searchBooks({ query: "test" });
  assert.equal(r2.books.length, 1);
});

test("searchBooks normalizes single author string to array", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ items: [{ ...mockBookItem, authors: "王五" }] }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.deepEqual(result.books[0].authors, ["王五"]);
});

test("searchBooks splits comma-separated author strings", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ items: [{ ...mockBookItem, authors: "张三, 李四, 王五" }] }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.deepEqual(result.books[0].authors, ["张三", "李四", "王五"]);
});

// ---------------------------------------------------------------------------
// Extra fields are NOT exposed
// ---------------------------------------------------------------------------

test("searchBooks does not expose extra/sensitive fields from provider response", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({
      items: [{
        ...mockBookItem,
        _internalToken: "secret-token-abc123",
        _rawResponse: "sensitive-data",
        apiKey: "key-should-not-leak",
        databaseUrl: "postgres://user:pass@host/db",
        secretField: "top-secret",
      }],
    }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });
  const book = result.books[0];

  // The book should NOT contain extra/sensitive fields
  const bookJson = JSON.stringify(book);
  assert.equal(bookJson.includes("secret-token-abc123"), false);
  assert.equal(bookJson.includes("sensitive-data"), false);
  assert.equal(bookJson.includes("key-should-not-leak"), false);
  assert.equal(bookJson.includes("postgres://"), false);
  assert.equal(bookJson.includes("top-secret"), false);

  // Only known fields should be present
  assert.equal(book.title, "深入理解 Python 异步编程");
});

// ---------------------------------------------------------------------------
// Raw response is NOT stored
// ---------------------------------------------------------------------------

test("raw provider response is never stored or exposed in result", async () => {
  const rawData = { items: [mockBookItem], _internal: "secret" };
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(rawData),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });
  const resultJson = JSON.stringify(result);

  // Raw response should never appear
  assert.equal(resultJson.includes("_internal"), false);
  assert.equal(resultJson.includes("secret"), false);
  // Safety metadata confirms
  assert.equal(result.safety.rawResponseStored, false);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test("searchBooks returns safe error when fetch throws", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("Network error: connection refused")),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.externalApiUsed, false);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("PROVIDER_ERROR")));
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("connection refused")));
});

test("getBookDetail returns safe error when fetch throws", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("DNS lookup failed")),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.getBookDetail("book-001");

  assert.equal(result.book, null);
  assert.equal(result.chapterPreviews.length, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("DNS lookup failed")));
});

test("searchBooks returns safe error for non-OK HTTP status", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ error: "not found" }, false, 404),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("HTTP 404")));
});

test("searchBooks returns safe error for null response body", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(null),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
  assert.equal(result.safety.guardBlocked, true);
});

// ---------------------------------------------------------------------------
// Timeout / abort
// ---------------------------------------------------------------------------

test("searchBooks returns safe error on abort/timeout", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetchThatAborts(100),
    timeoutMs: 10,
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(
    result.safety.blockedReasons.some((r) => r.includes("timed out") || r.includes("AbortError") || r.includes("aborted")),
  );
});

// ---------------------------------------------------------------------------
// Language parameter
// ---------------------------------------------------------------------------

test("searchBooks includes language parameter in URL when provided", async () => {
  let fetchUrl = "";
  const provider = createDevHttpBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  await provider.searchBooks({ query: "python", language: "zh" });

  assert.ok(fetchUrl.includes("lang=zh"));
});

test("searchBooks omits language parameter when not provided", async () => {
  let fetchUrl = "";
  const provider = createDevHttpBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  await provider.searchBooks({ query: "python" });

  assert.equal(fetchUrl.includes("lang="), false);
});

// ---------------------------------------------------------------------------
// Safety metadata on all results
// ---------------------------------------------------------------------------

test("all search results have safety metadata with llmUsed=false", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.safety.llmUsed, false);
  assert.equal(result.safety.writesDatabase, false);
  assert.equal(result.safety.rawResponseStored, false);
  assert.equal(result.safety.productionReady, false);
  assert.equal(result.safety.safeToExposeToClient, true);
});

test("all detail results have safety metadata with llmUsed=false", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockBookDetailResponse),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.getBookDetail("book-001");

  assert.equal(result.safety.llmUsed, false);
  assert.equal(result.safety.writesDatabase, false);
  assert.equal(result.safety.rawResponseStored, false);
  assert.equal(result.safety.productionReady, false);
});

// ---------------------------------------------------------------------------
// Empty/invalid response handling
// ---------------------------------------------------------------------------

test("searchBooks handles empty items array", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch({ items: [] }),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "noresults" });

  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.safety.guardBlocked, false);
});

test("searchBooks handles non-object response gracefully", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch("just a string"),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
});

// ---------------------------------------------------------------------------
// Error messages do not leak secrets
// ---------------------------------------------------------------------------

test("error messages do not leak tokens or URLs with secrets", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("Failed to fetch https://api.example.com?token=abc123&secret=xyz")),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.searchBooks({ query: "test" });
  const errorText = result.safety.blockedReasons.join(" ");

  // The error message should be truncated/cleaned — not contain the full URL with token
  assert.equal(errorText.includes("token=abc123"), false);
  assert.equal(errorText.includes("secret=xyz"), false);
});

// ---------------------------------------------------------------------------
// providerId is consistent
// ---------------------------------------------------------------------------

test("providerId is always 'dev-http'", () => {
  const provider = createDevHttpBookSourceProvider();
  assert.equal(provider.providerId, "dev-http");
});

// ---------------------------------------------------------------------------
// No LLM, no DB, no raw response in all paths
// ---------------------------------------------------------------------------

test("no LLM is called in any code path", async () => {
  // Blocked path
  const blocked = createDevHttpBookSourceProvider({
    env: { bookApiDevEnabled: false, allowExternalBookApi: false, bookApiBaseUrl: null },
  });
  const r1 = await blocked.searchBooks({ query: "test" });
  assert.equal(r1.safety.llmUsed, false);

  // Success path
  const success = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });
  const r2 = await success.searchBooks({ query: "test" });
  assert.equal(r2.safety.llmUsed, false);

  // Error path
  const error = createDevHttpBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("fail")),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });
  const r3 = await error.searchBooks({ query: "test" });
  assert.equal(r3.safety.llmUsed, false);
});

test("no DB write in any code path", async () => {
  // Success path
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });
  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.safety.writesDatabase, false);
});

// ---------------------------------------------------------------------------
// Chapter previews are empty (this round does not extract body content)
// ---------------------------------------------------------------------------

test("chapterPreviews is always empty array", async () => {
  const provider = createDevHttpBookSourceProvider({
    fetch: createFakeFetch(mockBookDetailResponse),
    env: { bookApiDevEnabled: true, allowExternalBookApi: true, bookApiBaseUrl: "https://api.example.com" },
  });

  const result = await provider.getBookDetail("book-001");

  assert.equal(result.chapterPreviews.length, 0);
});
