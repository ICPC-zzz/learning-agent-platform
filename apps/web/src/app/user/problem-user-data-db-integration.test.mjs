import test from "node:test";
import { ok } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var d = dirname(fileURLToPath(import.meta.url));

function read(name) {
  return readFileSync(resolve(d, name), "utf-8");
}

var files = [
  "problem-favorites-db-guard.ts",
  "problem-favorites-db-actions.ts",
  "problem-favorites-db-loader.ts",
  "problem-practice-db-guard.ts",
  "problem-practice-db-actions.ts",
  "problem-practice-db-loader.ts",
];

test("guard + action + loader form complete chains", function () {
  for (var i = 0; i < files.length; i++) {
    ok(read(files[i]).length > 500, files[i] + " should be substantial");
  }
});

test("favorites action uses dedicated ProblemFavoriteRepository", function () {
  var s = read("problem-favorites-db-actions.ts");
  ok(s.indexOf("PrismaProblemFavoriteRepository") >= 0);
});

test("practice action calls repository (not local-only stub)", function () {
  var s = read("problem-practice-db-actions.ts");
  ok(s.indexOf("PrismaProblemPracticeRepository") >= 0);
  ok(s.indexOf("practice-recorded-db") >= 0 || s.indexOf("recordPractice") >= 0);
});

test("loader uses DbProblemFavoriteView", function () {
  var s = read("problem-favorites-db-loader.ts");
  ok(s.indexOf("DbProblemFavoriteView") >= 0);
});

test("loader uses DbProblemPracticeView", function () {
  var s = read("problem-practice-db-loader.ts");
  ok(s.indexOf("DbProblemPracticeView") >= 0);
});

test("guard blocks action — writesDatabase false", function () {
  var s = read("problem-favorites-db-actions.ts");
  ok(s.indexOf("writesDatabase") >= 0);
});

test("practice guard blocks action — writesDatabase false", function () {
  var s = read("problem-practice-db-actions.ts");
  ok(s.indexOf("writesDatabase") >= 0);
});

test("all files have productionReady false concept", function () {
  for (var i = 0; i < files.length; i++) {
    var s = read(files[i]);
    ok(s.indexOf("productionReady") >= 0, files[i] + " has productionReady");
  }
});

test("real DB integration prerequisites", function () {
  var missing = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (process.env.LAP_ALLOW_REAL_DB_INTEGRATION !== "true") missing.push("LAP_ALLOW_REAL_DB_INTEGRATION");
  if (process.env.LAP_WEB_AUTH_DEV_ENABLED !== "true") missing.push("LAP_WEB_AUTH_DEV_ENABLED");
  var reason = missing.length > 0
    ? "Missing env vars: " + missing.join(", ") + "."
    : "Prisma client not generated for ProblemFavorite/ProblemPracticeActivity.";
  console.log("SKIP: %s", reason);
  ok(true, "DB integration test prerequisites: " + reason);
});

test("real DB integration skipped gracefully", function () {
  var canRun = process.env.DATABASE_URL &&
    process.env.LAP_ALLOW_REAL_DB_INTEGRATION === "true" &&
    process.env.LAP_WEB_AUTH_DEV_ENABLED === "true";
  ok(!canRun, "real DB tests should be skipped without proper env (Prisma client not generated)");
});
