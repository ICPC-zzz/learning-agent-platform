import assert from "node:assert/strict";
import test from "node:test";

const devStoreMod = await import("./text-import-save-dev-store.ts");
const { saveDevBook, getDevBook, listDevBooks, getDevBookCount, generateDevBookId, generateDevChapterId, generateDevChunkId, resetDevStore } = devStoreMod;

test("dev store — empty after reset", () => {
  resetDevStore();
  assert.equal(getDevBookCount(), 0);
  assert.equal(listDevBooks().length, 0);
});

test("dev store — save and retrieve a book", () => {
  resetDevStore();
  const bookId = generateDevBookId();
  const chapterId = generateDevChapterId(bookId, 1);
  const chunkId = generateDevChunkId(chapterId, 0);
  const now = new Date().toISOString();
  saveDevBook({
    book: { id: bookId, title: "Test Book", author: "Test", sourceType: "dev-import", description: "desc", tags: ["test"], createdAt: now, updatedAt: now },
    chapters: [{ id: chapterId, bookId, title: "Ch 1", orderIndex: 0, level: 1, plainText: "Content" }],
    chunks: [{ id: chunkId, bookId, chapterId, orderIndex: 0, plainText: "Content" }],
  });
  assert.equal(getDevBookCount(), 1);
  const retrieved = getDevBook(bookId);
  assert.notEqual(retrieved, null);
  assert.equal(retrieved.book.title, "Test Book");
  assert.equal(retrieved.chapters.length, 1);
});

test("dev store — IDs are unique", () => {
  resetDevStore();
  const id1 = generateDevBookId();
  const id2 = generateDevBookId();
  assert.notEqual(id1, id2);
  assert.ok(id1.startsWith("dev-import-"));
});

// Writer tests
const previewMod = await import("./text-import-preview.ts");
const { buildTextImportPreview } = previewMod;
const saveRequestMod = await import("./text-import-save-request.ts");
const { createTextImportSaveRequestPreview } = saveRequestMod;
const editPreviewMod = await import("./text-import-edit-preview.ts");
const { buildTextImportEditedPreviewSummary, buildTextImportEditedPreviewConfirmationInput, createTextImportChapterEditDrafts } = editPreviewMod;
const confirmationMod = await import("./text-import-confirmation.ts");
const { createTextImportConfirmationPreview } = confirmationMod;
const writerMod = await import("./text-import-save-dev-writer.ts");
const { writeTextImportSaveToDevStore } = writerMod;

function createReadySaveRequest(title, rawText) {
  const preview = buildTextImportPreview({ title, rawText });
  const edits = createTextImportChapterEditDrafts(preview.chapters);
  const summary = buildTextImportEditedPreviewSummary({ chapters: preview.chapters, edits, warnings: preview.warnings });
  const confirmationInput = buildTextImportEditedPreviewConfirmationInput(preview, summary);
  const confirmation = createTextImportConfirmationPreview(confirmationInput);
  return createTextImportSaveRequestPreview({ preview: confirmationInput, confirmation, summary, userExplicitlyConfirmed: true });
}

test("writeTextImportSaveToDevStore — saves valid request", () => {
  resetDevStore();
  const saveRequest = createReadySaveRequest("Test Book", "# Ch1\nContent\n\n## Ch2\nMore content");
  const result = writeTextImportSaveToDevStore(saveRequest);
  assert.equal(result.success, true);
  assert.equal(result.reasonCode, "dev-store-saved");
  assert.notEqual(result.bookId, null);
  assert.equal(result.chapterIds.length, 2);
  const devBook = getDevBook(result.bookId);
  assert.notEqual(devBook, null);
  assert.equal(devBook.book.title, "Test Book");
  assert.equal(devBook.book.sourceType, "dev-import");
  assert.ok(devBook.book.tags.includes("dev-import"));
  assert.equal(devBook.chapters.length, 2);
});

test("writeTextImportSaveToDevStore — blocked when saveReady is false", () => {
  const saveRequest = createReadySaveRequest("Test", "# Ch1\nContent");
  const blocked = Object.assign({}, saveRequest, { saveReady: false });
  const result = writeTextImportSaveToDevStore(blocked);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, "save-not-ready");
});

test("writeTextImportSaveToDevStore — blocked when blockedReasons not empty", () => {
  const saveRequest = createReadySaveRequest("Test", "# Ch1\nContent");
  const blocked = Object.assign({}, saveRequest, { blockedReasons: ["test-block"] });
  const result = writeTextImportSaveToDevStore(blocked);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, "save-blocked");
});

test("writeTextImportSaveToDevStore — blocked when userExplicitlyConfirmed false", () => {
  const saveRequest = createReadySaveRequest("Test", "# Ch1\nContent");
  const blocked = Object.assign({}, saveRequest, { userExplicitlyConfirmed: false });
  const result = writeTextImportSaveToDevStore(blocked);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, "user-confirmation-required");
});

test("writeTextImportSaveToDevStore — blocked when effectiveChapterCount 0", () => {
  const saveRequest = createReadySaveRequest("Test", "# Ch1\nContent");
  const blocked = Object.assign({}, saveRequest, { effectiveChapterCount: 0, safeChapters: [] });
  const result = writeTextImportSaveToDevStore(blocked);
  assert.equal(result.success, false);
  assert.equal(result.reasonCode, "no-chapters");
});

test("writeTextImportSaveToDevStore — result has no dangerous fields", () => {
  resetDevStore();
  const saveRequest = createReadySaveRequest("Safe Test", "# Ch1\nSafe content");
  const result = writeTextImportSaveToDevStore(saveRequest);
  const json = JSON.stringify(result);
  assert.equal(json.includes("DATABASE_URL"), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("rawText"), false);
});

test("writeTextImportSaveToDevStore — saved book has no dangerous fields", () => {
  resetDevStore();
  const saveRequest = createReadySaveRequest("Safe Test", "# Ch1\nSafe content");
  const result = writeTextImportSaveToDevStore(saveRequest);
  assert.equal(result.success, true);
  const devBook = getDevBook(result.bookId);
  const json = JSON.stringify(devBook);
  assert.equal(json.includes("DATABASE_URL"), false);
  assert.equal(json.includes("token"), false);
});

test("writeTextImportSaveToDevStore — multiple saves produce separate books", () => {
  resetDevStore();
  const r1 = writeTextImportSaveToDevStore(createReadySaveRequest("Book A", "# Ch1\nA"));
  const r2 = writeTextImportSaveToDevStore(createReadySaveRequest("Book B", "# Ch1\nB"));
  assert.equal(r1.success, true);
  assert.equal(r2.success, true);
  assert.notEqual(r1.bookId, r2.bookId);
  assert.equal(getDevBookCount(), 2);
});

test.after(() => {
  resetDevStore();
});
