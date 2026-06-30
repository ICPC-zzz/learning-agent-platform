/**
 * A464 - /books redirect coverage.
 *
 * The old user-facing book library has been replaced with /articles.
 * This test verifies the redirect remains in place and the legacy book
 * implementation files are still present for internal/archived use.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOKS_PAGE_PATH = path.join(ROOT, "apps/web/src/app/books/page.tsx");
const LEGACY_BOOK_FILES = [
  "apps/web/src/app/books/book-library-loader.ts",
  "apps/web/src/app/books/book-library-filter.ts",
  "apps/web/src/app/books/components/BookLibraryClient.tsx",
  "apps/web/src/app/books/open-library-import-actions.ts",
];

function readPage() {
  assert.ok(fs.existsSync(BOOKS_PAGE_PATH), "books/page.tsx should exist");
  return fs.readFileSync(BOOKS_PAGE_PATH, "utf-8");
}

for (const rel of LEGACY_BOOK_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, rel)), rel + " should still exist");
}

assert.ok(readPage().includes('redirect("/articles")'), "books route should redirect to /articles");
assert.ok(readPage().includes('next/navigation'), "books route should use Next redirect");
assert.ok(!readPage().includes("OpenLibrarySearchClient"), "redirect page should not render legacy Open Library UI");

console.log("A464 books redirect tests completed");
