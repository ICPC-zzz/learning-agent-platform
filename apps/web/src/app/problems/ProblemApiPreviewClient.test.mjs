import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "ProblemApiPreviewClient.tsx"), "utf-8");

test("ProblemApiPreviewClient keeps blocked state and search controls", () => {
  assert.ok(source.includes("External problem API is blocked"));
  assert.ok(source.includes("Keyword"));
  assert.ok(source.includes("Difficulty"));
  assert.ok(source.includes("Tags"));
  assert.ok(source.includes("Page size"));
  assert.ok(source.includes("Apply filters"));
  assert.ok(source.includes("Refresh current page"));
  assert.ok(source.includes("Next page"));
});

test("ProblemApiPreviewClient uses the new eligibility gate", () => {
  assert.ok(source.includes("evaluateProblemImportEligibility"));
  assert.ok(source.includes("导入到本地库"));
  assert.ok(source.includes("不可导入"));
  assert.ok(source.includes("BlockedNotice"));
  assert.ok(source.includes("ErrorNotice"));
});

test("ProblemPreviewResults only renders safe preview fields", () => {
  assert.ok(source.includes("ProblemPreviewResults"));
  assert.ok(source.includes("ProblemPreviewCard"));
  assert.ok(source.includes("renderSafeExternalUrl"));
  assert.ok(source.includes("rawResponseStored=false"));
  assert.ok(source.includes("productionReady=false"));
});

test("BlockedNotice keeps missing env names only", () => {
  assert.ok(source.includes("Missing env names are shown below"));
  assert.ok(source.includes("Values are never exposed"));
});
