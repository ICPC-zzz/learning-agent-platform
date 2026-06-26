/**
 * Open Library Book Source Provider tests.
 *
 * Tests the dev-only Open Library provider adapter with guard conditions,
 * fake fetch, response normalization, error handling, and safety metadata
 * verification. All tests use fake fetch — no real network calls.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import used in existing node:test coverage
import { createOpenLibraryBookSourceProvider } from "./open-library-book-source-provider.ts";

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

// ---------------------------------------------------------------------------
// Open Library fake response shapes
// ---------------------------------------------------------------------------

const mockSearchDoc = {
  key: "/works/OL123W",
  title: "Python 编程入门",
  author_name: ["张三", "李四"],
  first_publish_year: 2020,
  language: ["chi"],
  cover_i: 12345,
  first_sentence: "A comprehensive guide to Python programming",
};

const mockSearchResponse = {
  numFound: 42,
  docs: [mockSearchDoc],
};

const mockWorkDetailResponse = {
  key: "/works/OL123W",
  title: "Python 编程入门",
  authors: [
    { author: { key: "/authors/OL456A", name: "张三" } },
    { author: { key: "/authors/OL789A", name: "李四" } },
  ],
  description: "A comprehensive guide to Python programming for beginners and advanced users alike.",
  covers: [12345, 67890],
  subjects: ["Programming", "Python"],
};

// Mock work detail with string description (Open Library sometimes returns plain strings)
const mockWorkDetailStringDesc = {
  key: "/works/OL456W",
  title: "Learning JavaScript",
  description: "A modern introduction to JavaScript",
  covers: [99999],
};

// Mock work detail with object description (Open Library sometimes returns {type, value})
const mockWorkDetailObjectDesc = {
  key: "/works/OL789W",
  title: "Data Structures",
  description: { type: "/type/text", value: "An introduction to data structures and algorithms" },
};

// All-guards-passing env configuration
const ALL_GUARDS_PASS_ENV = {
  bookApiDevEnabled: true,
  allowExternalBookApi: true,
  bookApiBaseUrl: "https://openlibrary.org",
  bookApiProvider: "open-library",
};

// ---------------------------------------------------------------------------
// Guard: default blocked (all env vars missing)
// ---------------------------------------------------------------------------

test("searchBooks returns blocked metadata when all guards are off (default)", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
      bookApiProvider: null,
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.externalApiUsed, false);
  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.query, "python");
  assert.ok(result.safety.blockedReasons.length >= 4);
});

test("getBookDetail returns blocked metadata when all guards are off (default)", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
      bookApiProvider: null,
    },
  });

  const result = await provider.getBookDetail("OL123W");

  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.externalApiUsed, false);
  assert.equal(result.book, null);
  assert.equal(result.chapterPreviews.length, 0);
});

test("getGuardStatus returns blocked when all guards are off", () => {
  const provider = createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
      bookApiProvider: null,
    },
  });

  const status = provider.getGuardStatus();
  assert.equal(status.guardBlocked, true);
  assert.equal(status.externalApiUsed, false);
});

test("isRealApiEnabled returns false when all guards are off", () => {
  const provider = createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
      bookApiProvider: null,
    },
  });

  assert.equal(provider.isRealApiEnabled, false);
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_BOOK_API_DEV_ENABLED
// ---------------------------------------------------------------------------

test("searchBooks blocked when LAP_BOOK_API_DEV_ENABLED is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://openlibrary.org",
      bookApiProvider: "open-library",
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

test("searchBooks blocked when LAP_ALLOW_EXTERNAL_BOOK_API is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: false,
      bookApiBaseUrl: "https://openlibrary.org",
      bookApiProvider: "open-library",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_BOOK_API_BASE_URL
// ---------------------------------------------------------------------------

test("searchBooks blocked when LAP_BOOK_API_BASE_URL is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: null,
      bookApiProvider: "open-library",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("BASE_URL")));
});

// ---------------------------------------------------------------------------
// Guard: missing LAP_BOOK_API_PROVIDER
// ---------------------------------------------------------------------------

test("searchBooks blocked when LAP_BOOK_API_PROVIDER is missing", async () => {
  const fetchCalled = { called: false };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://openlibrary.org",
      bookApiProvider: null,
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("PROVIDER_NOT_SET") || r.includes("PROVIDER")));
});

test("searchBooks blocked when LAP_BOOK_API_PROVIDER does not include open-library", async () => {
  const fetchCalled = { called: false };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async () => { fetchCalled.called = true; return { ok: true, status: 200, json: async () => ({}) }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://openlibrary.org",
      bookApiProvider: "google-books",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(fetchCalled.called, false);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("MISMATCH")));
});

test("searchBooks passes when LAP_BOOK_API_PROVIDER includes open-library in comma list", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: {
      bookApiDevEnabled: true,
      allowExternalBookApi: true,
      bookApiBaseUrl: "https://openlibrary.org",
      bookApiProvider: "google-books, open-library, internal",
    },
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.ok(fetchUrl.includes("openlibrary.org/search.json"));
  assert.equal(result.safety.guardBlocked, false);
  assert.equal(result.safety.externalApiUsed, true);
});

// ---------------------------------------------------------------------------
// Guard: all pass → fetch is called with correct URL
// ---------------------------------------------------------------------------

test("searchBooks calls Open Library search API when all guards pass", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "python programming" });

  assert.ok(fetchUrl.includes("openlibrary.org/search.json"));
  assert.ok(fetchUrl.includes("python%20programming"));
  assert.ok(fetchUrl.includes("limit="));
  assert.equal(result.safety.guardBlocked, false);
  assert.equal(result.safety.externalApiUsed, true);
  assert.equal(result.books.length, 1);
});

test("getBookDetail calls Open Library work API when all guards pass", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockWorkDetailResponse }; },
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");

  assert.ok(fetchUrl.includes("openlibrary.org/works/OL123W.json"));
  assert.equal(result.safety.guardBlocked, false);
  assert.equal(result.safety.externalApiUsed, true);
  assert.equal(result.book?.title, "Python 编程入门");
});

test("getBookDetail strips /works/ prefix if present in externalBookId", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockWorkDetailResponse }; },
    env: ALL_GUARDS_PASS_ENV,
  });

  await provider.getBookDetail("/works/OL123W");

  // Should NOT have double /works/works/
  assert.equal(fetchUrl.includes("/works/works/"), false);
  assert.ok(fetchUrl.includes("/works/OL123W.json"));
});

// ---------------------------------------------------------------------------
// Normalized search results from Open Library response shape
// ---------------------------------------------------------------------------

test("searchBooks normalizes Open Library search doc correctly", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "python" });

  assert.equal(result.books.length, 1);
  const book = result.books[0];

  assert.equal(book.providerId, "open-library-dev");
  assert.equal(book.externalBookId, "OL123W"); // key stripped of /works/
  assert.equal(book.title, "Python 编程入门");
  assert.deepEqual(book.authors, ["张三", "李四"]);
  assert.equal(book.description, "A comprehensive guide to Python programming");
  assert.equal(book.language, "chi");
  assert.equal(book.sourceUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(book.licenseHint, "unknown");
  assert.equal(book.coverImageUrl, "https://covers.openlibrary.org/b/id/12345-M.jpg");
  assert.equal(book.chapterPreviewCount, 0);
  assert.equal(book.importable, false);
});

test("searchBooks reports totalResults from numFound", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.totalResults, 42);
});

test("searchBooks handles empty docs array", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({ numFound: 0, docs: [] }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "noresults" });

  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.safety.guardBlocked, false);
});

test("searchBooks handles single author_name string", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{ key: "/works/OL1W", title: "Test", author_name: "王五" }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.deepEqual(result.books[0].authors, ["王五"]);
});

test("searchBooks handles missing author_name gracefully", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{ key: "/works/OL2W", title: "No Author Book" }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.deepEqual(result.books[0].authors, []);
});

test("searchBooks handles language as array (takes first element)", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{ key: "/works/OL3W", title: "Multi Lang", language: ["eng", "fre", "spa"] }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.books[0].language, "eng");
});

test("searchBooks handles language as string", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{ key: "/works/OL4W", title: "Single Lang", language: "eng" }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.books[0].language, "eng");
});

test("searchBooks handles missing cover_i gracefully", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{ key: "/works/OL5W", title: "No Cover" }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.books[0].coverImageUrl, "");
});

// ---------------------------------------------------------------------------
// Normalized work detail results
// ---------------------------------------------------------------------------

test("getBookDetail normalizes Open Library work detail correctly", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockWorkDetailResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");

  assert.equal(result.book?.providerId, "open-library-dev");
  assert.equal(result.book?.externalBookId, "OL123W");
  assert.equal(result.book?.title, "Python 编程入门");
  assert.deepEqual(result.book?.authors, ["张三", "李四"]);
  assert.ok(result.book?.description.includes("comprehensive guide"));
  assert.equal(result.book?.sourceUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(result.book?.coverImageUrl, "https://covers.openlibrary.org/b/id/12345-M.jpg");
  assert.equal(result.book?.importable, false);
  assert.equal(result.chapterPreviews.length, 0);
});

test("getBookDetail normalizes string description", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockWorkDetailStringDesc),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL456W");

  assert.equal(result.book?.title, "Learning JavaScript");
  assert.equal(result.book?.description, "A modern introduction to JavaScript");
});

test("getBookDetail normalizes object description with value field", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockWorkDetailObjectDesc),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL789W");

  assert.equal(result.book?.title, "Data Structures");
  assert.ok(result.book?.description.includes("data structures"));
});

test("getBookDetail handles missing authors gracefully", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      key: "/works/OL999W",
      title: "No Authors",
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL999W");
  assert.deepEqual(result.book?.authors, []);
});

test("getBookDetail handles missing covers gracefully", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      key: "/works/OL888W",
      title: "No Covers",
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL888W");
  assert.equal(result.book?.coverImageUrl, "");
});

// ---------------------------------------------------------------------------
// Extra/sensitive fields are NOT exposed
// ---------------------------------------------------------------------------

test("searchBooks does not expose extra/sensitive fields from Open Library response", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 1,
      docs: [{
        ...mockSearchDoc,
        _internalToken: "secret-token-abc123",
        _rawResponse: "sensitive-data",
        apiKey: "key-should-not-leak",
        databaseUrl: "postgres://user:pass@host/db",
        secretField: "top-secret",
        ebook_count_i: 5,
        edition_count: 10,
        publisher: ["Some Publisher"],
        isbn: ["1234567890"],
      }],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  const book = result.books[0];
  const bookJson = JSON.stringify(book);

  // Known fields should be present
  assert.equal(book.title, "Python 编程入门");

  // Extra/sensitive fields should NOT be present
  assert.equal(bookJson.includes("secret-token-abc123"), false);
  assert.equal(bookJson.includes("sensitive-data"), false);
  assert.equal(bookJson.includes("key-should-not-leak"), false);
  assert.equal(bookJson.includes("postgres://"), false);
  assert.equal(bookJson.includes("top-secret"), false);

  // Open Library-specific extra fields (not in NormalizedBookMetadata) should not leak
  assert.equal(bookJson.includes("ebook_count_i"), false);
  assert.equal(bookJson.includes("publisher"), false);
  assert.equal(bookJson.includes("isbn"), false);
  assert.equal(bookJson.includes("1234567890"), false);
});

test("getBookDetail does not expose extra/sensitive fields", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      ...mockWorkDetailResponse,
      _secret: "should-not-appear",
      rawData: "dangerous",
      token: "xyz-token",
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");
  const resultJson = JSON.stringify(result);

  assert.equal(resultJson.includes("should-not-appear"), false);
  assert.equal(resultJson.includes("dangerous"), false);
  assert.equal(resultJson.includes("xyz-token"), false);
});

// ---------------------------------------------------------------------------
// Raw response is NOT stored
// ---------------------------------------------------------------------------

test("raw provider response is never stored or exposed in search result", async () => {
  const rawData = { numFound: 1, docs: [mockSearchDoc], _internal: "secret" };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(rawData),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  const resultJson = JSON.stringify(result);

  assert.equal(resultJson.includes("_internal"), false);
  assert.equal(resultJson.includes("secret"), false);
  assert.equal(result.safety.rawResponseStored, false);
});

test("raw provider response is never stored or exposed in detail result", async () => {
  const rawData = { ...mockWorkDetailResponse, _cache: "hit" };
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(rawData),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");
  const resultJson = JSON.stringify(result);

  assert.equal(resultJson.includes("_cache"), false);
  assert.equal(result.safety.rawResponseStored, false);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test("searchBooks returns safe error when fetch throws", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("Network error: connection refused")),
    env: ALL_GUARDS_PASS_ENV,
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
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("DNS lookup failed")),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");

  assert.equal(result.book, null);
  assert.equal(result.chapterPreviews.length, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("DNS lookup failed")));
});

test("searchBooks returns safe error for non-OK HTTP status", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({ error: "not found" }, false, 404),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
  assert.equal(result.safety.guardBlocked, true);
  assert.ok(result.safety.blockedReasons.some((r) => r.includes("HTTP 404")));
});

test("searchBooks returns safe error for null response body", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(null),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 0);
  assert.equal(result.safety.guardBlocked, true);
});

test("searchBooks returns safe error for non-object response", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch("just a string"),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.books.length, 0);
});

// ---------------------------------------------------------------------------
// Error messages do not leak secrets
// ---------------------------------------------------------------------------

test("error messages do not leak tokens or sensitive URL params", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("Failed to fetch https://openlibrary.org?token=abc123&secret=xyz")),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });
  const errorText = result.safety.blockedReasons.join(" ");

  assert.equal(errorText.includes("token=abc123"), false);
  assert.equal(errorText.includes("secret=xyz"), false);
});

// ---------------------------------------------------------------------------
// Safety metadata on all results
// ---------------------------------------------------------------------------

test("search success result has correct safety metadata", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.safety.llmUsed, false);
  assert.equal(result.safety.writesDatabase, false);
  assert.equal(result.safety.rawResponseStored, false);
  assert.equal(result.safety.productionReady, false);
  assert.equal(result.safety.safeToExposeToClient, true);
});

test("detail success result has correct safety metadata", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockWorkDetailResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");

  assert.equal(result.safety.llmUsed, false);
  assert.equal(result.safety.writesDatabase, false);
  assert.equal(result.safety.rawResponseStored, false);
  assert.equal(result.safety.productionReady, false);
});

test("blocked result has correct safety metadata", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    env: {
      bookApiDevEnabled: false,
      allowExternalBookApi: false,
      bookApiBaseUrl: null,
      bookApiProvider: null,
    },
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.safety.llmUsed, false);
  assert.equal(result.safety.writesDatabase, false);
  assert.equal(result.safety.rawResponseStored, false);
  assert.equal(result.safety.productionReady, false);
  assert.equal(result.safety.safeToExposeToClient, true);
  assert.equal(result.safety.externalApiUsed, false);
});

// ---------------------------------------------------------------------------
// No LLM, no DB in all paths
// ---------------------------------------------------------------------------

test("no LLM is called in any code path (search)", async () => {
  // Blocked path
  const blocked = createOpenLibraryBookSourceProvider({
    env: { bookApiDevEnabled: false, allowExternalBookApi: false, bookApiBaseUrl: null, bookApiProvider: null },
  });
  const r1 = await blocked.searchBooks({ query: "test" });
  assert.equal(r1.safety.llmUsed, false);

  // Success path
  const success = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: ALL_GUARDS_PASS_ENV,
  });
  const r2 = await success.searchBooks({ query: "test" });
  assert.equal(r2.safety.llmUsed, false);

  // Error path
  const errorProv = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetchThatThrows(new Error("fail")),
    env: ALL_GUARDS_PASS_ENV,
  });
  const r3 = await errorProv.searchBooks({ query: "test" });
  assert.equal(r3.safety.llmUsed, false);
});

test("no DB write in any code path", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockSearchResponse),
    env: ALL_GUARDS_PASS_ENV,
  });
  const result = await provider.searchBooks({ query: "test" });
  assert.equal(result.safety.writesDatabase, false);
});

// ---------------------------------------------------------------------------
// providerId is consistent
// ---------------------------------------------------------------------------

test("providerId is always 'open-library-dev'", () => {
  const provider = createOpenLibraryBookSourceProvider();
  assert.equal(provider.providerId, "open-library-dev");
});

// ---------------------------------------------------------------------------
// Chapter previews are empty (no body content extraction)
// ---------------------------------------------------------------------------

test("chapterPreviews is always empty array", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch(mockWorkDetailResponse),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.getBookDetail("OL123W");
  assert.equal(result.chapterPreviews.length, 0);
});

// ---------------------------------------------------------------------------
// Multiple results
// ---------------------------------------------------------------------------

test("searchBooks handles multiple docs correctly", async () => {
  const provider = createOpenLibraryBookSourceProvider({
    fetch: createFakeFetch({
      numFound: 3,
      docs: [
        { key: "/works/OL1W", title: "Book One", author_name: ["Author A"] },
        { key: "/works/OL2W", title: "Book Two", author_name: ["Author B"] },
        { key: "/works/OL3W", title: "Book Three", author_name: ["Author C"] },
      ],
    }),
    env: ALL_GUARDS_PASS_ENV,
  });

  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.books.length, 3);
  assert.equal(result.books[0].title, "Book One");
  assert.equal(result.books[1].title, "Book Two");
  assert.equal(result.books[2].title, "Book Three");
  assert.equal(result.totalResults, 3);
});

// ---------------------------------------------------------------------------
// Language parameter in URL
// ---------------------------------------------------------------------------

test("searchBooks includes language parameter in URL when provided", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: ALL_GUARDS_PASS_ENV,
  });

  await provider.searchBooks({ query: "python", language: "chi" });
  assert.ok(fetchUrl.includes("language=chi"));
});

test("searchBooks omits language parameter when not provided", async () => {
  let fetchUrl = "";
  const provider = createOpenLibraryBookSourceProvider({
    fetch: async (url) => { fetchUrl = String(url); return { ok: true, status: 200, json: async () => mockSearchResponse }; },
    env: ALL_GUARDS_PASS_ENV,
  });

  await provider.searchBooks({ query: "python" });
  assert.equal(fetchUrl.includes("language="), false);
});

// ---------------------------------------------------------------------------
// No real network calls
// ---------------------------------------------------------------------------

test("no fetch call is made when all guards are off (default constructor)", async () => {
  // This would throw if real fetch were called because there's no real network
  const provider = createOpenLibraryBookSourceProvider();
  const result = await provider.searchBooks({ query: "test" });

  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.books.length, 0);
});
