/**
 * Tests for the local imported book draft store.
 */

import assert from "node:assert/strict";
import test from "node:test";

const STORE_URL = new URL("./local-imported-book-draft-store.ts", import.meta.url).href;
const store = await import(STORE_URL);

const {
  IMPORTED_BOOK_DRAFTS_CHANGED_EVENT,
  createImportedBookDraftLinks,
  deleteDraft,
  deleteImportedBookDraft,
  MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH,
  getImportedBookDraft,
  findImportedBookDraftById,
  findImportedBookDraftByProviderKey,
  loadImportedBookDraft,
  loadImportedBookDraftByProviderKey,
  loadImportedBookDrafts,
  listImportedBookDrafts,
  removeImportedBookDraft,
  renameDraft,
  saveImportedBookDraft,
  updateDraftManualContent,
  upsertImportedBookDraft,
} = store;

const baseDraft = {
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
};

function installMockWindow(initialStore = {}) {
  const backingStore = { ...initialStore };
  const dispatchedEvents = [];
  const localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(backingStore, key)
        ? backingStore[key]
        : null;
    },
    setItem(key, value) {
      backingStore[key] = String(value);
    },
    removeItem(key) {
      delete backingStore[key];
    },
  };

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init && typeof init === "object" ? init.detail : undefined;
    }
  };

  globalThis.window = {
    localStorage,
    dispatchEvent(event) {
      dispatchedEvents.push(event.type);
      return true;
    },
  };

  return { backingStore, dispatchedEvents };
}

function uninstallMockWindow() {
  delete globalThis.window;
  delete globalThis.CustomEvent;
}

test("createImportedBookDraftLinks builds reader-friendly URLs", () => {
  const links = createImportedBookDraftLinks("draft-123");

  assert.equal(links.detailHref, "/books/draft-123");
  assert.equal(links.readerHref, "/reader?bookId=draft-123");
  assert.equal(links.libraryHref, "/books");
});

test("upsertImportedBookDraft preserves draftId for duplicate provider keys", () => {
  const first = upsertImportedBookDraft([], baseDraft);
  const second = upsertImportedBookDraft(first, {
    ...baseDraft,
    title: "Updated Title",
    updatedAt: "2026-06-15T11:00:00.000Z",
  });

  assert.equal(second.length, 1);
  assert.equal(second[0].draftId, "draft-1");
  assert.equal(second[0].createdAt, "2026-06-15T10:00:00.000Z");
  assert.equal(second[0].title, "Updated Title");
});

test("findImportedBookDraft helpers match by id and provider key", () => {
  const drafts = [baseDraft];

  assert.equal(findImportedBookDraftById(drafts, "draft-1")?.title, "TypeScript in Practice");
  assert.equal(
    findImportedBookDraftByProviderKey(drafts, "open-library-dev", "OL123W")?.draftId,
    "draft-1",
  );
  assert.equal(findImportedBookDraftByProviderKey(drafts, "other", "OL123W"), null);
});

test("removeImportedBookDraft deletes by draftId", () => {
  const drafts = removeImportedBookDraft([baseDraft], "draft-1");
  assert.equal(drafts.length, 0);
});

test("saveImportedBookDraft persists to localStorage and can be loaded back", () => {
  const env = installMockWindow();

  const saved = saveImportedBookDraft(baseDraft);
  assert.equal(saved?.draftId, "draft-1");
  assert.equal(env.dispatchedEvents.includes(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT), true);

  const drafts = loadImportedBookDrafts();
  assert.equal(drafts.length, 1);
  assert.equal(listImportedBookDrafts().length, 1);
  assert.equal(loadImportedBookDraft("draft-1")?.title, "TypeScript in Practice");
  assert.equal(getImportedBookDraft("draft-1")?.title, "TypeScript in Practice");
  assert.equal(
    loadImportedBookDraftByProviderKey("open-library-dev", "OL123W")?.draftId,
    "draft-1",
  );

  uninstallMockWindow();
});

test("saveImportedBookDraft strips raw payload fields and keeps safe flags", () => {
  const env = installMockWindow();

  const saved = saveImportedBookDraft({
    ...baseDraft,
    rawResponse: "hidden",
    rawBody: "hidden",
    rawPayload: "hidden",
    providerResponse: "hidden",
    token: "hidden",
    cookie: "hidden",
    secret: "hidden",
    databaseUrl: "hidden",
  });

  assert.equal(saved?.rawResponseStored, false);
  assert.equal(saved?.writesDatabase, false);
  assert.equal(saved?.llmUsed, false);
  assert.equal(saved?.externalApiUsed, false);

  const rawStore = JSON.parse(env.backingStore["lap.web.importedBookDrafts.v1"]);
  const storedDraft = rawStore.drafts[0];

  assert.equal(Object.hasOwn(storedDraft, "rawResponse"), false);
  assert.equal(Object.hasOwn(storedDraft, "rawBody"), false);
  assert.equal(Object.hasOwn(storedDraft, "rawPayload"), false);
  assert.equal(Object.hasOwn(storedDraft, "providerResponse"), false);
  assert.equal(Object.hasOwn(storedDraft, "token"), false);
  assert.equal(Object.hasOwn(storedDraft, "cookie"), false);
  assert.equal(Object.hasOwn(storedDraft, "secret"), false);
  assert.equal(Object.hasOwn(storedDraft, "databaseUrl"), false);

  uninstallMockWindow();
});

test("deleteDraft removes saved drafts and no-ops when the draft is missing", () => {
  const env = installMockWindow();

  saveImportedBookDraft(baseDraft);
  assert.equal(deleteDraft("draft-1"), true);
  assert.equal(loadImportedBookDrafts().length, 0);
  assert.equal(env.dispatchedEvents.includes(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT), true);
  assert.equal(deleteDraft("missing-draft"), false);

  uninstallMockWindow();
});

test("renameDraft trims titles, falls back on empty titles, and truncates long titles", () => {
  const env = installMockWindow();

  saveImportedBookDraft(baseDraft);

  assert.equal(renameDraft("draft-1", "  Renamed Draft  "), true);
  assert.equal(loadImportedBookDrafts()[0].title, "Renamed Draft");

  const eventCountAfterRename = env.dispatchedEvents.length;
  assert.equal(renameDraft("draft-1", "   "), false);
  assert.equal(loadImportedBookDrafts()[0].title, "Renamed Draft");
  assert.equal(env.dispatchedEvents.length, eventCountAfterRename);

  assert.equal(renameDraft("draft-1", "A".repeat(400)), true);
  const renamedDraft = loadImportedBookDrafts()[0];
  assert.equal(renamedDraft.title.length <= 160, true);
  assert.equal(renamedDraft.title.endsWith("..."), true);

  uninstallMockWindow();
});

test("updateDraftManualContent saves manual chapter title and body locally", () => {
  const env = installMockWindow();

  saveImportedBookDraft(baseDraft);

  assert.equal(
    updateDraftManualContent("draft-1", {
      chapterTitle: "  Local chapter title  ",
      body: "Line one\nLine two",
    }),
    true,
  );

  const drafts = loadImportedBookDrafts();
  assert.equal(drafts[0].bodyAvailable, true);
  assert.equal(drafts[0].chapters[0].title, "Local chapter title");
  assert.equal(drafts[0].chapters[0].plainText, "Line one\nLine two");
  assert.equal(env.dispatchedEvents.includes(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT), true);

  uninstallMockWindow();
});

test("updateDraftManualContent rejects empty or oversized bodies", () => {
  installMockWindow();

  saveImportedBookDraft(baseDraft);

  assert.equal(
    updateDraftManualContent("draft-1", {
      chapterTitle: "Local chapter title",
      body: "   ",
    }),
    false,
  );
  assert.equal(
    updateDraftManualContent("draft-1", {
      chapterTitle: "Local chapter title",
      body: "a".repeat(MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH + 1),
    }),
    false,
  );
  assert.equal(loadImportedBookDrafts()[0].bodyAvailable, false);

  uninstallMockWindow();
});

test("corrupted JSON falls back to empty store", () => {
  const removedKeys = [];
  globalThis.window = {
    localStorage: {
      getItem() {
        return "not valid json{";
      },
      setItem() {},
      removeItem(key) {
        removedKeys.push(key);
      },
    },
  };

  const drafts = loadImportedBookDrafts();
  assert.equal(drafts.length, 0);
  assert.equal(removedKeys.includes("lap.web.importedBookDrafts.v1"), true);

  uninstallMockWindow();
});

test("saveImportedBookDraft ignores invalid drafts", () => {
  installMockWindow();

  const saved = saveImportedBookDraft({
    ...baseDraft,
    source: "not-book-api-preview",
  });

  assert.equal(saved, null);
  assert.equal(loadImportedBookDrafts().length, 0);

  uninstallMockWindow();
});
