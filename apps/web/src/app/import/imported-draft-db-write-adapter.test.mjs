/**
 * Tests for the imported draft DB write adapter.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import in node:test
import {
  writeImportedDraftToDevDatabase,
} from "./imported-draft-db-write-adapter.ts";
// @ts-expect-error TS5097: direct .ts import in node:test
import {
  createImportedDraftDbWriteGuardResult,
} from "./imported-draft-db-write-guard.ts";

function createImportedDraft(overrides = {}) {
  return {
    draftId: "draft-db-1",
    source: "book-api-preview",
    providerId: "open-library-dev",
    externalBookId: "OL123W",
    title: "TypeScript in Practice",
    authors: ["Ada Lovelace"],
    description: "A safe normalized preview description.",
    language: "en",
    sourceUrl: "https://openlibrary.org/works/OL123W",
    licenseHint: "unknown",
    coverImageUrl: "https://covers.openlibrary.org/b/id/1-M.jpg",
    createdAt: "2026-06-15T10:00:00.000Z",
    updatedAt: "2026-06-15T10:00:00.000Z",
    chapters: [
      {
        id: "draft-db-1-chapter-0",
        title: "External Source Preview",
        orderIndex: 0,
        level: 1,
        plainText: "Manual body text for chapter 1.",
      },
      {
        id: "draft-db-1-chapter-1",
        title: "Second Chapter",
        orderIndex: 1,
        level: 2,
        plainText: "Manual body text for chapter 2.",
      },
    ],
    bodyAvailable: true,
    productionReady: false,
    externalApiUsed: false,
    writesDatabase: false,
    llmUsed: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    rawResponse: "hidden-provider-response",
    rawPrompt: "hidden-provider-prompt",
    token: "hidden-token",
    secret: "hidden-secret",
    ...overrides,
  };
}

test("adapter is blocked when guard is disabled and never calls repository", async () => {
  let repoCalls = 0;
  const fakeRepo = {
    async createBookWithContent() {
      repoCalls += 1;
      throw new Error("should not be called");
    },
  };

  const result = await writeImportedDraftToDevDatabase({
    draft: createImportedDraft(),
    guard: createImportedDraftDbWriteGuardResult({
      importedDraftDbDevEnabled: false,
      allowRealDbIntegration: true,
      databaseUrlConfigured: true,
    }),
    repository: fakeRepo,
  });

  assert.equal(repoCalls, 0);
  assert.equal(result.status, "blocked");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.rawProviderResponseStored, false);
  assert.equal(result.llmUsed, false);
  assert.equal(result.bookIdPreview?.startsWith("preview-book:"), true);
  assert.equal(result.chapterIdPreview, "draft-db-1-chapter-0");
});

test("adapter blocks when draft title is missing", async () => {
  let repoCalls = 0;
  const fakeRepo = {
    async createBookWithContent() {
      repoCalls += 1;
      return {
        bookId: "book-1",
        chapterCount: 0,
        chunkCount: 0,
      };
    },
  };

  const result = await writeImportedDraftToDevDatabase({
    draft: createImportedDraft({ title: "   " }),
    guard: createImportedDraftDbWriteGuardResult({
      importedDraftDbDevEnabled: true,
      allowRealDbIntegration: true,
      databaseUrlConfigured: true,
    }),
    repository: fakeRepo,
  });

  assert.equal(repoCalls, 0);
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "draft-invalid");
  assert.equal(result.writesDatabase, false);
  assert.equal(result.callsRepository, false);
});

test("adapter writes successfully with a fake repository", async () => {
  let capturedInput = null;
  const fakeRepo = {
    async createBookWithContent(input) {
      capturedInput = input;
      return {
        bookId: "book-123",
        chapterCount: input.chapters.length,
        chunkCount: input.chunks.length,
        chapterIds: input.chapters.map((chapter) => chapter.id ?? "missing"),
      };
    },
  };

  const result = await writeImportedDraftToDevDatabase({
    draft: createImportedDraft(),
    guard: createImportedDraftDbWriteGuardResult({
      importedDraftDbDevEnabled: true,
      allowRealDbIntegration: true,
      databaseUrlConfigured: true,
    }),
    repository: fakeRepo,
    ownerMode: "trusted-dev-session",
    ownerLabel: "Dev Alpha",
  });

  assert.equal(result.status, "written-dev-preview");
  assert.equal(result.bookId, "book-123");
  assert.equal(result.chapterId, "draft-db-1-chapter-0");
  assert.equal(result.writesDatabase, true);
  assert.equal(result.callsRepository, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.rawProviderResponseStored, false);
  assert.equal(result.llmUsed, false);
  assert.equal(result.ownerMode, "trusted-dev-session");
  assert.equal(result.ownerLabel, "Dev Alpha");
  assert.equal(result.chapterIds.length, 2);
  assert.equal(result.chapterIds[0], "draft-db-1-chapter-0");
  assert.equal(result.bookIdPreview?.startsWith("preview-book:"), true);
  assert.equal(result.chapterIdPreview, "draft-db-1-chapter-0");
  assert.equal(result.detailHref, "/books/book-123");
  assert.equal(result.readerHref, "/reader?bookId=book-123&chapterId=draft-db-1-chapter-0");
  assert.equal(result.libraryHref, "/books");

  assert.notEqual(capturedInput, null);
  assert.equal(capturedInput.title, "TypeScript in Practice");
  assert.equal(capturedInput.author, "Ada Lovelace");
  assert.equal(capturedInput.sourceType, "IMPORTED_URL");
  assert.equal(capturedInput.sourceMetadata.draftId, "draft-db-1");
  assert.equal(capturedInput.sourceMetadata.ownerMode, "trusted-dev-session");
  assert.equal(
    JSON.stringify(capturedInput).includes("hidden-provider-response"),
    false,
  );
  assert.equal(JSON.stringify(capturedInput).includes("hidden-token"), false);
  assert.equal(JSON.stringify(capturedInput).includes("hidden-secret"), false);
  assert.equal(capturedInput.chapters[0].id, "draft-db-1-chapter-0");
  assert.equal(capturedInput.chunks[0].id, "draft-db-1-chapter-0-chunk-0");
  assert.equal(capturedInput.chunks[0].plainText.includes("Manual body text"), true);
});

test("adapter redacts sensitive strings when repository fails", async () => {
  const fakeRepo = {
    async createBookWithContent() {
      throw new Error(
        "DATABASE_URL=postgresql://user:secret@db.example/test password=abc token=def",
      );
    },
  };

  const result = await writeImportedDraftToDevDatabase({
    draft: createImportedDraft(),
    guard: createImportedDraftDbWriteGuardResult({
      importedDraftDbDevEnabled: true,
      allowRealDbIntegration: true,
      databaseUrlConfigured: true,
    }),
    repository: fakeRepo,
  });

  const json = JSON.stringify(result);
  assert.equal(result.status, "error");
  assert.equal(result.callsRepository, true);
  assert.equal(result.writesDatabase, false);
  assert.equal(result.detailHref, "/books/preview-book%3Adraft-db-1");
  assert.equal(result.readerHref, "/reader?bookId=preview-book%3Adraft-db-1&chapterId=draft-db-1-chapter-0");
  assert.equal(result.libraryHref, "/books");
  assert.equal(json.includes("DATABASE_URL"), false);
  assert.equal(json.includes("postgresql://"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("password"), false);
});
