import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { BookImportSaveStatus } = await tsImport(
  "./components/BookImportSaveStatus.tsx",
  import.meta.url,
);

test("BookImportSaveStatus renders success links for saved books", () => {
  const markup = renderToStaticMarkup(
    createElement(BookImportSaveStatus, {
      isSaving: false,
      state: {
        ok: true,
        status: "database_saved",
        bookId: "book-123",
        bookTitle: "TypeScript in Practice",
        chapterCount: 4,
        chunkCount: 8,
        savedAt: "2026-06-15T10:00:00.000Z",
        detailHref: "/books/book-123",
        readerHref: "/reader?bookId=book-123",
        libraryHref: "/books",
        message: "Imported draft saved to the dev database.",
      },
    }),
  );

  assert.equal(markup.includes("查看书库"), true);
  assert.equal(markup.includes("打开阅读"), true);
  assert.equal(markup.includes("查看详情"), true);
  assert.equal(markup.includes('href="/books"'), true);
  assert.equal(markup.includes('href="/reader?bookId=book-123"'), true);
  assert.equal(markup.includes('href="/books/book-123"'), true);
});
