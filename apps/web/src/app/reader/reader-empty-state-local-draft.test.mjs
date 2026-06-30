/**
 * Source inspection test for the Reader empty-state local draft fallback.
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("ReaderEmptyState includes local draft fallback logic", () => {
  const sourcePath = path.join(
    process.cwd(),
    "apps/web/src/app/reader/ReaderEmptyState.tsx",
  );
  const source = fs.readFileSync(sourcePath, "utf-8");

  assert.equal(source.includes("loadImportedBookDraft"), true);
  assert.equal(source.includes("Local draft preview"), true);
  assert.equal(source.includes("bodyAvailable={String(draft.bodyAvailable)}"), true);
  assert.equal(source.includes("Manual body saved locally"), true);
  assert.equal(source.includes("Reader needs a book"), true);
});
