import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("reader page wires the resume adapter and panel", function () {
  const filePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes("loadReaderProgressResumeData"), true);
  assert.equal(source.includes("buildReaderProgressResumeView"), true);
  assert.equal(source.includes("readerProgressResumeView={readerProgressResumeView}"), true);
  assert.equal(source.includes("primaryChapterId"), true);
});
