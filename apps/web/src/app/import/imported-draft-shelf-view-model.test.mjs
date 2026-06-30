/**
 * Tests for the imported draft shelf view model.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import in node:test
import {
  buildImportedDraftShelfViewModel,
  IMPORTED_DRAFT_SHELF_EMPTY_MESSAGE,
  IMPORTED_DRAFT_SHELF_LOADED_MESSAGE,
  IMPORTED_DRAFT_SHELF_SAFE_LABELS,
} from "./imported-draft-shelf-view-model.ts";

function createDraft(overrides = {}) {
  return {
    draftId: "draft-1",
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
        id: "draft-1-chapter-0",
        title: "External Source Preview",
        orderIndex: 0,
        level: 1,
        plainText: "This is a placeholder chapter.",
      },
    ],
    bodyAvailable: false,
    productionReady: false,
    externalApiUsed: false,
    writesDatabase: false,
    llmUsed: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    ...overrides,
  };
}

test("buildImportedDraftShelfViewModel returns empty state for no drafts", () => {
  const viewModel = buildImportedDraftShelfViewModel([]);

  assert.equal(viewModel.status, "empty");
  assert.equal(viewModel.totalCount, 0);
  assert.equal(viewModel.drafts.length, 0);
  assert.equal(viewModel.devDbSaveStatus.enabled, false);
  assert.equal(viewModel.safeToExposeToClient, true);
  assert.equal(viewModel.message, IMPORTED_DRAFT_SHELF_EMPTY_MESSAGE);
  assert.equal(viewModel.message.includes("preview-only"), true);
  assert.equal(viewModel.message.includes("local-only"), true);
  assert.equal(viewModel.safetyMetadata.previewOnly, true);
  assert.equal(viewModel.safetyMetadata.localOnly, true);
});

test("buildImportedDraftShelfViewModel maps multiple drafts with reader links", () => {
  const viewModel = buildImportedDraftShelfViewModel([
    createDraft({ draftId: "draft-1", externalBookId: "OL123W", title: "First Draft" }),
    createDraft({
      draftId: "draft-2",
      externalBookId: "OL456W",
      title: "Second Draft",
      authors: [],
      chapters: [
        {
          id: "draft-2-chapter-0",
          title: "External Source Preview",
          orderIndex: 0,
          level: 1,
          plainText: "Another placeholder chapter.",
        },
        {
          id: "draft-2-chapter-1",
          title: "Second Placeholder",
          orderIndex: 1,
          level: 2,
          plainText: "A second placeholder chapter.",
        },
      ],
    }),
  ]);

  assert.equal(viewModel.status, "loaded");
  assert.equal(viewModel.totalCount, 2);
  assert.equal(viewModel.drafts[0].draftId, "draft-1");
  assert.equal(viewModel.drafts[0].readerUrl, "/reader?bookId=draft-1");
  assert.equal(viewModel.drafts[0].chapterCount, 1);
  assert.equal(viewModel.drafts[0].bodyAvailable, false);
  assert.equal(viewModel.drafts[0].productionReady, false);
  assert.equal(viewModel.drafts[0].writesDatabase, false);
  assert.equal(viewModel.drafts[0].llmUsed, false);
  assert.equal(viewModel.drafts[0].rawResponseStored, false);
  assert.equal(viewModel.drafts[0].safetyMetadata.previewOnly, true);
  assert.equal(viewModel.devDbSaveStatus.enabled, false);
  assert.equal(
    viewModel.drafts[0].safeLabels.includes(IMPORTED_DRAFT_SHELF_SAFE_LABELS[0]),
    true,
  );
  assert.equal(viewModel.drafts[1].draftId, "draft-2");
  assert.equal(viewModel.drafts[1].readerUrl, "/reader?bookId=draft-2");
  assert.equal(viewModel.drafts[1].chapterCount, 2);
  assert.equal(viewModel.drafts[1].authors.length, 0);
  assert.equal(viewModel.drafts[1].safeLabels.includes("local-only"), true);
  assert.equal(viewModel.message, IMPORTED_DRAFT_SHELF_LOADED_MESSAGE(2));
  assert.equal(viewModel.safetyMetadata.rawResponseStored, false);
});

test("view model does not expose raw response or secret fields", () => {
  const viewModel = buildImportedDraftShelfViewModel([
    createDraft({
      rawResponse: "hidden",
      token: "hidden",
      cookie: "hidden",
      secret: "hidden",
    }),
  ]);

  const json = JSON.stringify(viewModel);
  assert.equal(json.includes('"rawResponse"'), false);
  assert.equal(json.includes('"rawBody"'), false);
  assert.equal(json.includes('"rawPayload"'), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("cookie"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("devDbSaveStatus"), true);
});

test("buildImportedDraftShelfViewModel exposes manual body availability", () => {
  const viewModel = buildImportedDraftShelfViewModel([
    createDraft({
      draftId: "draft-manual",
      bodyAvailable: true,
      chapters: [
        {
          id: "draft-manual-chapter-0",
          title: "Local Chapter",
          orderIndex: 0,
          level: 1,
          plainText: "Saved manual body.",
        },
      ],
    }),
  ]);

  assert.equal(viewModel.drafts[0].bodyAvailable, true);
});

test("buildImportedDraftShelfViewModel accepts dev DB save status override", () => {
  const viewModel = buildImportedDraftShelfViewModel(
    [
      createDraft({
        draftId: "draft-dev-save",
        title: "Dev Save Draft",
      }),
    ],
    {
      enabled: true,
      mode: "dev-only",
      writesDatabaseAllowed: true,
      productionReady: false,
      safeToExposeToClient: true,
      blockedReasons: [],
      statusText: "dev-only DB save enabled",
    },
  );

  assert.equal(viewModel.devDbSaveStatus.enabled, true);
  assert.equal(viewModel.devDbSaveStatus.statusText, "dev-only DB save enabled");
});
