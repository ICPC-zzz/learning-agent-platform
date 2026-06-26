import assert from "node:assert/strict";
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("problem library client uses safe local imports and client-only storage init", function () {
  const filePath = resolve(dirname(fileURLToPath(import.meta.url)), "ProblemLibraryClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes('from "../../lib/local-user-problem-store"'), true);
  assert.equal(source.includes('from "../lib/local-user-problem-store"'), false);
  assert.equal(source.includes('from "./problem-library-page-data"'), true);
  assert.equal(source.includes('useState<FavoriteProblemEntry[]>([])'), true);
  assert.equal(source.includes('useState<RecentPracticeEntry[]>([])'), true);
  assert.equal(source.includes('setLocalFavs(loadFavorites())'), true);
  assert.equal(source.includes('setLocalPractice(loadRecentPractice())'), true);
  assert.equal(source.includes('practiced'), true);
  assert.equal(source.includes('completed'), true);
  assert.equal(source.includes('SAMPLE_PROBLEMS'), false);
  assert.equal(source.includes('filterProblems'), false);
  assert.equal(source.includes('name="source"'), false);
  assert.equal(source.includes('name="minRating"'), true);
  assert.equal(source.includes('name="maxRating"'), true);
  assert.equal(source.includes('name="difficulty"'), false);
});
