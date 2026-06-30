import assert from "node:assert/strict";
import test from "node:test";

const { createBookImportSaveResultLinks } = await import("./book-import-save-links.ts");

test("createBookImportSaveResultLinks builds books and reader links", () => {
  const links = createBookImportSaveResultLinks("book with spaces/and symbols");

  assert.equal(links.detailHref, "/books/book%20with%20spaces%2Fand%20symbols");
  assert.equal(
    links.readerHref,
    "/reader?bookId=book%20with%20spaces%2Fand%20symbols",
  );
  assert.equal(links.libraryHref, "/books");
});
