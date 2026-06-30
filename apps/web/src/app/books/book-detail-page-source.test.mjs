import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("book detail page wires the resume adapter and panel", function () {
  const filePath = fileURLToPath(new URL("./[bookId]/page.tsx", import.meta.url));
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes("loadReaderProgressResumeData"), true);
  assert.equal(source.includes("buildReaderProgressResumeView"), true);
  assert.equal(source.includes("ReaderProgressResumePanel"), true);
});
