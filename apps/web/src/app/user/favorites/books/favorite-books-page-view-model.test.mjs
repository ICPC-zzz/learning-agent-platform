/**
 * Favorite Books Page View Model tests - A386.
 * Run: node apps/web/src/app/user/favorites/books/favorite-books-page-view-model.test.mjs
 */

import { ok, strictEqual } from "node:assert";

var tests = [];
var passed = 0;
var failed = 0;

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function run() {
  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log("  PASS: " + t.name);
    } catch (err) {
      failed++;
      console.error("  FAIL: " + t.name);
      console.error("    " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

var VM_URL = new URL("./favorite-books-page-view-model.ts", import.meta.url).href;
var vm = await import(VM_URL);
var build = vm.buildFavoriteBooksPageView;
var isSafe = vm.favoriteBooksPageViewIsSafe;
var noMisleading = vm.noMisleadingProductionLabels;

function makeDbFav(o) {
  return Object.assign({
    bookId: "book-1",
    bookTitle: "Test Book",
    sourceType: "builtin",
    firstChapterId: "ch-1",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    source: "db-favorite",
    ownerLabel: "dev-user-001",
    notice: "dev-only notice",
  }, o || {});
}

function makeLocalFav(o) {
  return Object.assign({
    bookId: "book-local",
    title: "Local Book",
    sourceType: "builtin",
    firstChapterId: "ch-2",
    updatedAt: "2026-06-09T00:00:00.000Z",
  }, o || {});
}

test("DB favorites take priority when enabled and has data", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "1 record",
    localFavorites: [makeLocalFav()],
    ownerLabel: "dev1",
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].bookId, "book-1");
  strictEqual(view.items[0].badge, "db-favorite");
  strictEqual(view.items[0].badgeText, "开发 DB 收藏");
  strictEqual(view.isEmpty, false);
});

test("localStorage fallback when DB guard is disabled", function () {
  var view = build({
    hasSession: true,
    dbFavorites: null,
    dbFavoritesEnabled: false,
    dbFavoritesMessage: "DB disabled",
    localFavorites: [makeLocalFav()],
    ownerLabel: null,
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].bookId, "book-local");
  strictEqual(view.items[0].badge, "local-fallback");
});

test("localStorage fallback when DB enabled but empty", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "empty",
    localFavorites: [makeLocalFav()],
    ownerLabel: "dev1",
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].badge, "local-fallback");
});

test("no session shows login entry and empty state", function () {
  var view = build({
    hasSession: false,
    dbFavorites: null,
    dbFavoritesEnabled: false,
    dbFavoritesMessage: null,
    localFavorites: [],
    ownerLabel: null,
  });
  strictEqual(view.hasSession, false);
  strictEqual(view.isEmpty, true);
  ok(view.emptyMessage.includes("暂无收藏书籍"));
  ok(view.emptySubMessage.includes("未登录"));
  strictEqual(view.loginUrl, "/login?redirect=/user/favorites/books");
});

test("empty state with dev session but no data", function () {
  var view = build({
    hasSession: true,
    dbFavorites: null,
    dbFavoritesEnabled: false,
    dbFavoritesMessage: null,
    localFavorites: [],
    ownerLabel: null,
  });
  strictEqual(view.isEmpty, true);
  ok(view.emptyMessage.includes("暂无收藏书籍"));
  ok(view.emptySubMessage.includes("开发预览"));
});

test("unfavorite labels do not mislead", function () {
  var dbView = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  var localView = build({
    hasSession: true,
    dbFavorites: null,
    dbFavoritesEnabled: false,
    dbFavoritesMessage: null,
    localFavorites: [makeLocalFav()],
    ownerLabel: null,
  });
  strictEqual(dbView.items[0].unfavoriteLabel, "取消收藏（开发 DB）");
  strictEqual(localView.items[0].unfavoriteLabel, "取消收藏（本地）");
  ok(noMisleading([dbView.items[0].unfavoriteLabel, localView.items[0].unfavoriteLabel]));
});

test("page view contains no sensitive fields", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  var result = isSafe(view);
  ok(result.safe, "safe: " + JSON.stringify(result.violations));
});

test("page view JSON has no sensitive keywords", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password", "api_key", "rawtext", "authorization"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("no misleading production-ready labels", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  var json = JSON.stringify(view);
  ok(json.indexOf("云端收藏成功") === -1);
  ok(json.indexOf("生产收藏已保存") === -1);
  ok(json.indexOf("真实用户收藏系统已完成") === -1);
  ok(json.indexOf("云端同步成功") === -1);
  ok(json.indexOf("生产可用") === -1);
});

test("item URLs are well-formed", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav({ bookId: "book-abc", firstChapterId: "ch-xyz" })],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  strictEqual(view.items[0].detailUrl, "/books/book-abc");
  strictEqual(view.items[0].readUrl, "/reader?bookId=book-abc&chapterId=ch-xyz");
});

test("readUrl is null when no firstChapterId", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav({ firstChapterId: null })],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  strictEqual(view.items[0].readUrl, null);
});

test("noMisleadingProductionLabels catches violations", function () {
  ok(noMisleading(["dev DB", "local fallback"]));
  ok(!noMisleading(["云端收藏成功"]));
  ok(!noMisleading(["生产收藏已保存"]));
  ok(noMisleading(["取消收藏（开发 DB）", "取消收藏（本地）"]));
});

test("dataSourceNotice has no misleading text", function () {
  var view1 = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "开发 DB 收藏 - 绑定 dev session 用户 - 未接生产同步",
    localFavorites: [],
    ownerLabel: "dev1",
  });
  ok(view1.dataSourceNotice.includes("未接生产同步"));
  ok(!view1.dataSourceNotice.includes("生产可用"));
});

test("ownerLabel is preserved in view", function () {
  var view = build({
    hasSession: true,
    dbFavorites: [makeDbFav()],
    dbFavoritesEnabled: true,
    dbFavoritesMessage: "msg",
    localFavorites: [],
    ownerLabel: "dev user alpha",
  });
  strictEqual(view.ownerLabel, "dev user alpha");
});

run();
