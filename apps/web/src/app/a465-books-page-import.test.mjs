/**
 * A465 - legacy book implementation preserved.
 *
 * The public /books entry now redirects to /articles, but the archived book
 * import and management code still needs to remain in the repository.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOKS_DIR = path.join(ROOT, "apps/web/src/app/books");
const PAGE_SOURCE = fs.readFileSync(path.join(BOOKS_DIR, "page.tsx"), "utf-8");
const IMPORT_ACTION = fs.readFileSync(path.join(BOOKS_DIR, "open-library-import-actions.ts"), "utf-8");
const MANAGE_PAGE = fs.readFileSync(path.join(BOOKS_DIR, "manage/page.tsx"), "utf-8");

assert.ok(PAGE_SOURCE.includes('redirect("/articles")'), "books page should redirect");
assert.ok(!PAGE_SOURCE.includes("BookLibraryClient"), "books page should not render legacy book library UI");
assert.ok(IMPORT_ACTION.includes("importOpenLibraryBookAction"), "legacy import action should remain available");
assert.ok(MANAGE_PAGE.includes("manage") || MANAGE_PAGE.includes("Book"), "legacy manage page should remain present");

console.log("A465 legacy book preservation tests completed");
