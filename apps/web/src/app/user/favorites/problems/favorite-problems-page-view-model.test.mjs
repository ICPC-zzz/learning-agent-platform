import assert from "node:assert/strict";
import test from "node:test";

var MOD_URL = new URL("./favorite-problems-page-view-model.ts", import.meta.url).href;
var mod = await import(MOD_URL);
var buildVM = mod.buildFavoriteProblemsPageViewModel;
var isSafe = mod.favoriteProblemsPageViewModelIsSafe;

function mkLocal() {
  return { problemId: "p-1", title: "test", difficulty: "easy", tags: ["a"], favoritedAt: new Date().toISOString() };
}

function mkDb() {
  return { problemId: "p-db-1", problemTitle: "db", difficulty: "medium", tags: ["a"], createdAt: new Date().toISOString(), source: "db-problem-favorite", ownerLabel: "dev", notice: "ok" };
}

test("db takes priority", function () {
  var vm = buildVM({ dbFavorites: [mkDb()], dbFavoritesEnabled: true, localFavorites: [mkLocal()], hasSession: true });
  assert.equal(vm.sourceType, "db");
});

test("db disabled local", function () {
  var vm = buildVM({ dbFavorites: [mkDb()], dbFavoritesEnabled: false, localFavorites: [mkLocal()], hasSession: true });
  assert.equal(vm.sourceType, "local");
});

test("empty fallback local", function () {
  var vm = buildVM({ dbFavorites: [], dbFavoritesEnabled: true, localFavorites: [mkLocal()], hasSession: true });
  assert.equal(vm.sourceType, "local");
});

test("empty no data", function () {
  var vm = buildVM({ dbFavorites: [], dbFavoritesEnabled: false, localFavorites: [], hasSession: false });
  assert.equal(vm.sourceType, "empty");
});

test("view model safe", function () {
  var vm = buildVM({ dbFavorites: [], dbFavoritesEnabled: false, localFavorites: [mkLocal()], hasSession: true });
  assert.ok(isSafe(vm));
});

test("no misleading labels", function () {
  var vm = buildVM({ dbFavorites: [mkDb()], dbFavoritesEnabled: true, localFavorites: [], hasSession: true });
  var s = JSON.stringify(vm);
  assert.ok(s.indexOf("真实判题") < 0);
});

test("count multiple items", function () {
  var vm = buildVM({ dbFavorites: [mkDb(), mkDb()], dbFavoritesEnabled: true, localFavorites: [], hasSession: true });
  assert.equal(vm.count, 2);
});
