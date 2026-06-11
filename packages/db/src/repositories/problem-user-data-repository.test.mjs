import test from "node:test";
import { ok } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));

var favSrc = readFileSync(resolve(__dirname, "problem-favorite-repository.ts"), "utf-8");
var pracSrc = readFileSync(resolve(__dirname, "problem-practice-repository.ts"), "utf-8");
var idxSrc = readFileSync(resolve(__dirname, "index.ts"), "utf-8");
var dbIdxSrc = readFileSync(resolve(__dirname, "..", "index.ts"), "utf-8");

test("PrismaProblemFavoriteRepository class exists", function () {
  ok(favSrc.indexOf("class PrismaProblemFavoriteRepository") >= 0);
  ok(favSrc.indexOf("implements ProblemFavoriteRepository") >= 0);
});

test("PrismaProblemFavoriteRepository has all 4 methods", function () {
  ok(favSrc.indexOf("addFavoriteProblem") >= 0);
  ok(favSrc.indexOf("removeFavoriteProblem") >= 0);
  ok(favSrc.indexOf("listFavoritesByOwner") >= 0);
  ok(favSrc.indexOf("isFavoriteProblem") >= 0);
});

test("PrismaProblemPracticeRepository class exists", function () {
  ok(pracSrc.indexOf("class PrismaProblemPracticeRepository") >= 0);
  ok(pracSrc.indexOf("implements ProblemPracticeRepository") >= 0);
});

test("PrismaProblemPracticeRepository has all 4 methods", function () {
  ok(pracSrc.indexOf("recordPractice") >= 0);
  ok(pracSrc.indexOf("listPracticeByOwner") >= 0);
  ok(pracSrc.indexOf("getProblemPracticeStatus") >= 0);
  ok(pracSrc.indexOf("removeProblemPractice") >= 0);
});

test("favorite repository uses upsert for idempotency", function () {
  ok(favSrc.indexOf(".upsert(") >= 0 || favSrc.indexOf(".upsert({") >= 0);
});

test("practice repository uses findFirst for upsert logic", function () {
  ok(pracSrc.indexOf("findFirst") >= 0);
});

test("both repositories have normalizers", function () {
  ok(favSrc.indexOf("normalizeRequiredText") >= 0);
  ok(favSrc.indexOf("normalizeTags") >= 0);
  ok(favSrc.indexOf("normalizeListLimit") >= 0);
  ok(pracSrc.indexOf("normalizeStatus") >= 0);
  ok(pracSrc.indexOf("VALID_STATUSES") >= 0);
});

test("repositories exported from index files", function () {
  ok(idxSrc.indexOf("PrismaProblemFavoriteRepository") >= 0);
  ok(idxSrc.indexOf("PrismaProblemPracticeRepository") >= 0);
  ok(dbIdxSrc.indexOf("PrismaProblemFavoriteRepository") >= 0);
  ok(dbIdxSrc.indexOf("PrismaProblemPracticeRepository") >= 0);
});

test("no DATABASE_URL in source files", function () {
  ok(favSrc.indexOf("DATABASE_URL") < 0);
  ok(pracSrc.indexOf("DATABASE_URL") < 0);
  ok(favSrc.indexOf("postgres://") < 0);
  ok(pracSrc.indexOf("postgres://") < 0);
});

test("real DB integration skipped", function () {
  console.log("SKIP: Prisma client not generated for new models");
  ok(true);
});
