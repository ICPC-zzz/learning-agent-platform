/**
 * Book Source Provider contract tests.
 *
 * Tests the provider contract types, safety metadata helpers, and empty
 * result factories. Uses a mock provider implementation to verify the
 * contract behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import used in existing node:test coverage
import {
  createBlockedSafetyMetadata,
  createEmptyDetailResult,
  createEmptySearchResult,
  createErrorSafetyMetadata,
  createPassedSafetyMetadata,
} from "./book-source-provider.ts";

// ---------------------------------------------------------------------------
// Safety metadata helpers
// ---------------------------------------------------------------------------

test("createBlockedSafetyMetadata returns blocked guard with reasons", () => {
  const meta = createBlockedSafetyMetadata("test-provider", [
    "REASON_ONE: guard one blocked",
    "REASON_TWO: guard two blocked",
  ]);

  assert.equal(meta.providerId, "test-provider");
  assert.equal(meta.productionReady, false);
  assert.equal(meta.externalApiUsed, false);
  assert.equal(meta.llmUsed, false);
  assert.equal(meta.writesDatabase, false);
  assert.equal(meta.rawResponseStored, false);
  assert.equal(meta.safeToExposeToClient, true);
  assert.equal(meta.guardBlocked, true);
  assert.equal(meta.fallbackSource, "empty");
  assert.equal(meta.blockedReasons.length, 2);
  assert.equal(meta.blockedReasons[0], "REASON_ONE: guard one blocked");
});

test("createBlockedSafetyMetadata allows custom fallbackSource", () => {
  const builtin = createBlockedSafetyMetadata("p", ["r"], "builtin");
  assert.equal(builtin.fallbackSource, "builtin");

  const none = createBlockedSafetyMetadata("p", ["r"], "none");
  assert.equal(none.fallbackSource, "none");
});

test("createPassedSafetyMetadata returns unblocked guard with externalApiUsed=true", () => {
  const meta = createPassedSafetyMetadata("http-provider");

  assert.equal(meta.providerId, "http-provider");
  assert.equal(meta.productionReady, false);
  assert.equal(meta.externalApiUsed, true);
  assert.equal(meta.llmUsed, false);
  assert.equal(meta.writesDatabase, false);
  assert.equal(meta.rawResponseStored, false);
  assert.equal(meta.safeToExposeToClient, true);
  assert.equal(meta.guardBlocked, false);
  assert.equal(meta.blockedReasons.length, 0);
  assert.equal(meta.fallbackSource, "none");
});

test("createErrorSafetyMetadata always has guardBlocked=true with error reason", () => {
  const meta = createErrorSafetyMetadata("p", "Network timeout after 10s");

  assert.equal(meta.providerId, "p");
  assert.equal(meta.guardBlocked, true);
  assert.equal(meta.externalApiUsed, false);
  assert.equal(meta.fallbackSource, "empty");
  assert.equal(meta.blockedReasons.length, 1);
  assert.ok(meta.blockedReasons[0].includes("PROVIDER_ERROR"));
  assert.ok(meta.blockedReasons[0].includes("Network timeout"));
});

test("createErrorSafetyMetadata truncates very long error messages", () => {
  const longMessage = "x".repeat(500);
  const meta = createErrorSafetyMetadata("p", longMessage);

  assert.equal(meta.blockedReasons.length, 1);
  assert.ok(meta.blockedReasons[0].length <= 220); // "PROVIDER_ERROR: " + 200 chars + "..."
});

// ---------------------------------------------------------------------------
// Empty result factories
// ---------------------------------------------------------------------------

test("createEmptySearchResult returns zero books with blocked safety", () => {
  const safety = createBlockedSafetyMetadata("test", ["GUARD_BLOCKED"]);
  const result = createEmptySearchResult("test", "python", safety);

  assert.equal(result.books.length, 0);
  assert.equal(result.totalResults, 0);
  assert.equal(result.query, "python");
  assert.equal(result.safety.guardBlocked, true);
  assert.equal(result.safety.providerId, "test");
});

test("createEmptyDetailResult returns null book with blocked safety", () => {
  const safety = createBlockedSafetyMetadata("test", ["GUARD_BLOCKED"]);
  const result = createEmptyDetailResult(safety);

  assert.equal(result.book, null);
  assert.equal(result.chapterPreviews.length, 0);
  assert.equal(result.safety.guardBlocked, true);
});

// ---------------------------------------------------------------------------
// Contract: safety metadata always present
// ---------------------------------------------------------------------------

test("all safety metadata types never expose secrets", () => {
  const blocked = createBlockedSafetyMetadata("x", ["DB_URL_MISSING"]);
  const passed = createPassedSafetyMetadata("x");
  const error = createErrorSafetyMetadata("x", "fetch failed: https://secret.example.com?token=abc123");

  // None should contain "token" or "secret" or "password"
  for (const meta of [blocked, passed, error]) {
    const json = JSON.stringify(meta);
    assert.equal(json.includes("abc123"), false);
    assert.equal(json.includes("token"), false);
    // "safeToExposeToClient" is always true
    assert.equal(meta.safeToExposeToClient, true);
  }
});

test("all safety metadata types have productionReady=false", () => {
  const blocked = createBlockedSafetyMetadata("x", []);
  const passed = createPassedSafetyMetadata("x");
  const error = createErrorSafetyMetadata("x", "err");

  assert.equal(blocked.productionReady, false);
  assert.equal(passed.productionReady, false);
  assert.equal(error.productionReady, false);
});

test("all safety metadata types have llmUsed=false", () => {
  const blocked = createBlockedSafetyMetadata("x", []);
  const passed = createPassedSafetyMetadata("x");
  const error = createErrorSafetyMetadata("x", "err");

  assert.equal(blocked.llmUsed, false);
  assert.equal(passed.llmUsed, false);
  assert.equal(error.llmUsed, false);
});

test("all safety metadata types have writesDatabase=false", () => {
  const blocked = createBlockedSafetyMetadata("x", []);
  const passed = createPassedSafetyMetadata("x");
  const error = createErrorSafetyMetadata("x", "err");

  assert.equal(blocked.writesDatabase, false);
  assert.equal(passed.writesDatabase, false);
  assert.equal(error.writesDatabase, false);
});

test("all safety metadata types have rawResponseStored=false", () => {
  const blocked = createBlockedSafetyMetadata("x", []);
  const passed = createPassedSafetyMetadata("x");
  const error = createErrorSafetyMetadata("x", "err");

  assert.equal(blocked.rawResponseStored, false);
  assert.equal(passed.rawResponseStored, false);
  assert.equal(error.rawResponseStored, false);
});

// ---------------------------------------------------------------------------
// Contract: NormalizedBookMetadata shape
// ---------------------------------------------------------------------------

test("NormalizedBookMetadata shape includes all required fields", () => {
  const book = {
    providerId: "dev-http",
    externalBookId: "abc123",
    title: "Test Book",
    authors: ["Author One"],
    description: "A test book",
    language: "zh",
    sourceUrl: "https://example.com/books/abc123",
    licenseHint: "in_copyright",
    coverImageUrl: "https://example.com/covers/abc123.jpg",
    chapterPreviewCount: 0,
    importable: false,
    safety: createPassedSafetyMetadata("dev-http"),
  };

  // Verify all fields are present
  assert.equal(typeof book.providerId, "string");
  assert.equal(typeof book.externalBookId, "string");
  assert.equal(typeof book.title, "string");
  assert.ok(Array.isArray(book.authors));
  assert.equal(typeof book.description, "string");
  assert.equal(typeof book.language, "string");
  assert.equal(typeof book.sourceUrl, "string");
  assert.equal(typeof book.licenseHint, "string");
  assert.equal(typeof book.coverImageUrl, "string");
  assert.equal(typeof book.chapterPreviewCount, "number");
  assert.equal(book.importable, false);

  // Safety metadata is embedded
  assert.equal(book.safety.productionReady, false);
  assert.equal(book.safety.llmUsed, false);
});
