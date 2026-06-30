/**
 * Tests for the book API imported draft converter.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import in node:test
import { createImportedBookDraftFromNormalizedBookMetadata } from "./book-api-import-draft.ts";

const baseMetadata = {
  providerId: "open-library-dev",
  externalBookId: "OL123W",
  title: "TypeScript in Practice",
  authors: ["Ada Lovelace", "Ada Lovelace", "  "],
  description: "A safe normalized preview description.",
  language: "en",
  sourceUrl: "https://openlibrary.org/works/OL123W",
  licenseHint: "unknown",
  coverImageUrl: "https://covers.openlibrary.org/b/id/1-M.jpg",
  chapterPreviewCount: 0,
  importable: false,
  safety: {
    providerId: "open-library-dev",
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

test("creates a safe imported draft from normalized metadata", () => {
  const draft = createImportedBookDraftFromNormalizedBookMetadata(baseMetadata, {
    draftId: "draft-123",
    now: "2026-06-15T10:00:00.000Z",
  });

  assert.equal(draft.draftId, "draft-123");
  assert.equal(draft.source, "book-api-preview");
  assert.equal(draft.providerId, "open-library-dev");
  assert.equal(draft.externalBookId, "OL123W");
  assert.equal(draft.title, "TypeScript in Practice");
  assert.deepEqual(draft.authors, ["Ada Lovelace"]);
  assert.equal(draft.description, "A safe normalized preview description.");
  assert.equal(draft.language, "en");
  assert.equal(draft.sourceUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(draft.licenseHint, "unknown");
  assert.equal(draft.coverImageUrl, "https://covers.openlibrary.org/b/id/1-M.jpg");
  assert.equal(draft.createdAt, "2026-06-15T10:00:00.000Z");
  assert.equal(draft.updatedAt, "2026-06-15T10:00:00.000Z");
  assert.equal(draft.bodyAvailable, false);
  assert.equal(draft.productionReady, false);
  assert.equal(draft.externalApiUsed, false);
  assert.equal(draft.writesDatabase, false);
  assert.equal(draft.llmUsed, false);
  assert.equal(draft.rawResponseStored, false);
  assert.equal(draft.safeToExposeToClient, true);
  assert.equal(draft.chapters.length, 1);
  assert.equal(draft.chapters[0].title, "External Source Preview");
  assert.equal(draft.chapters[0].orderIndex, 0);
  assert.equal(draft.chapters[0].level, 1);
  assert.equal(draft.chapters[0].plainText.includes("preview-only"), true);
});

test("truncates long fields and deduplicates authors", () => {
  const draft = createImportedBookDraftFromNormalizedBookMetadata(
    {
      ...baseMetadata,
      title: "x".repeat(700),
      authors: ["  Alice  ", "Alice", "Bob"],
      description: "y".repeat(3000),
      sourceUrl: "z".repeat(3000),
      coverImageUrl: "c".repeat(3000),
    },
    {
      draftId: "draft-456",
      now: new Date("2026-06-15T11:00:00.000Z"),
    },
  );

  assert.equal(draft.title.length <= 500, true);
  assert.deepEqual(draft.authors, ["Alice", "Bob"]);
  assert.equal(draft.description.length <= 2000, true);
  assert.equal(draft.sourceUrl.length <= 2000, true);
  assert.equal(draft.coverImageUrl.length <= 2000, true);
});

test("never preserves raw provider response fields", () => {
  const draft = createImportedBookDraftFromNormalizedBookMetadata(baseMetadata, {
    draftId: "draft-789",
  });

  const forbiddenKeys = [
    "rawResponse",
    "rawBody",
    "rawPayload",
    "response",
    "headers",
    "cookies",
    "token",
    "DATABASE_URL",
  ];

  for (const key of forbiddenKeys) {
    assert.equal(Object.prototype.hasOwnProperty.call(draft, key), false);
  }
  assert.equal(draft.rawResponseStored, false);
});
