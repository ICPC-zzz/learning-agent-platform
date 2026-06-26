import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderPath = resolve(__dirname, "problems", "problem-library-page-data.ts");
const loaderSource = fs.readFileSync(loaderPath, "utf8");

test("A475 problems page caps DB preload to keep the list responsive", () => {
  assert.ok(loaderSource.includes("pageSize"));
  assert.ok(loaderSource.includes("slice(start, start + pageSize)"));
  assert.ok(loaderSource.includes("mapProblemRecordToCodeforcesMetadata"));
});
