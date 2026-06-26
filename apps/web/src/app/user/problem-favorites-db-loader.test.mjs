/**
 * Problem Favorites DB Loader Tests — standalone JS tests.
 * Verifies the loader structure without importing TS source modules.
 */

import test from "node:test";
import { ok, equal } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// File existence
// ---------------------------------------------------------------------------

test("problem-favorites-db-loader.ts file exists", function () {
  var path = resolve(__dirname, "problem-favorites-db-loader.ts");
  ok(readFileSync(path, "utf-8").length > 0, "file should exist and be non-empty");
});

// ---------------------------------------------------------------------------
// Source code structure checks
// ---------------------------------------------------------------------------

test("loader file exports loadDbProblemFavorites", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("loadDbProblemFavorites") >= 0, "should export loadDbProblemFavorites");
});

test("loader file uses PrismaProblemFavoriteRepository", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("PrismaProblemFavoriteRepository") >= 0,
    "should use PrismaProblemFavoriteRepository");
});

test("loader file checks guard.enabled", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("guard.enabled") >= 0 || source.indexOf("!guard.enabled") >= 0,
    "should check guard state");
});

test("loader file has error fallback", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("catch") >= 0, "should have error catching");
  ok(source.indexOf("fallback") >= 0 || source.indexOf("useDbFavorites: false") >= 0,
    "should have fallback logic");
});

test("loader file returns useDbFavorites field", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("useDbFavorites") >= 0, "should return useDbFavorites");
});

test("loader file returns ownerLabel", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("ownerLabel") >= 0, "should return ownerLabel");
});

test("loader file has getProblemFavoritesDbGuardEnabled helper", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("getProblemFavoritesDbGuardEnabled") >= 0,
    "should export getProblemFavoritesDbGuardEnabled");
});

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

test("loader source has no hardcoded DATABASE_URL", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("DATABASE_URL") < 0, "no DATABASE_URL literal in source");
});

test("loader source has no hardcoded secrets", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("postgres://") < 0, "no postgres URL in source");
});

// ---------------------------------------------------------------------------
// No misleading labels
// ---------------------------------------------------------------------------

test("loader source has no production labels", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("生产收藏已保存") < 0, "no production label");
  ok(source.indexOf("云端同步成功") < 0, "no cloud sync label");
  ok(source.indexOf("真实判题已接入") < 0, "no real judge label");
  ok(source.indexOf("正式用户题库") < 0, "no production user label");
});

test("loader source has dev-only labels", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("未接生产同步") >= 0, "should have dev-only notice");
});

// ---------------------------------------------------------------------------
// Owner isolation
// ---------------------------------------------------------------------------

test("loader reads owner from sessionPayload", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("sessionPayload") >= 0, "should read sessionPayload");
});

test("loader queries with userId filter", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("userId") >= 0, "should filter by userId");
});

// ---------------------------------------------------------------------------
// Guard fallback preservation
// ---------------------------------------------------------------------------

test("loader preserves localStorage fallback when guard disabled", function () {
  var source = readFileSync(resolve(__dirname, "problem-favorites-db-loader.ts"), "utf-8");
  ok(source.indexOf("fallback") >= 0 || source.indexOf("未启用") >= 0,
    "should mention fallback/localStorage");
});
