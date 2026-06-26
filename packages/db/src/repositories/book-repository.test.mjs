/**
 * Structure tests for the Book repository.
 */

import assert from "node:assert/strict";
import test from "node:test";

const fs = await import("node:fs/promises");

test("book repository source keeps chapter id passthrough and chapterIds result", async () => {
  const source = await fs.readFile(
    new URL("./book-repository.ts", import.meta.url),
    "utf8",
  );

  assert.equal(source.includes("class PrismaBookRepository"), true);
  assert.equal(source.includes("createBookWithContent"), true);
  assert.equal(source.includes("chapterIds"), true);
  assert.equal(source.includes("normalizeOptionalText(chapter.id)"), true);
  assert.equal(source.includes("normalizeOptionalText(chunk.id)"), true);
  assert.equal(source.includes("contentChunk.create"), true);
  assert.equal(source.includes("bookChapter.create"), true);
  assert.equal(source.includes("metadata: true"), true);
});

test("book repository types expose chapterIds and chunkIds on create result", async () => {
  const typesSource = await fs.readFile(
    new URL("../types.ts", import.meta.url),
    "utf8",
  );

  assert.equal(typesSource.includes("chapterIds?: string[];"), true);
  assert.equal(typesSource.includes("chunkIds?: string[];"), true);
});
