/**
 * Recent Reading Page View Model tests - A386.
 * Run: node apps/web/src/app/user/recent-reading/recent-reading-page-view-model.test.mjs
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

var VM_URL = new URL("./recent-reading-page-view-model.ts", import.meta.url).href;
var vm = await import(VM_URL);
var build = vm.buildRecentReadingPageView;
var isSafe = vm.recentReadingPageViewIsSafe;
var fmt = vm.formatProgressPercent;
var urlsOk = vm.continueReadingUrlsAreValid;

function makeDbProgress(o) {
  return Object.assign({
    bookId: "book-1",
    chapterId: "chapter-1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter One",
    progressRatio: 0.5,
    progressPercent: 50,
    updatedAt: "2026-06-10T00:00:00.000Z",
    source: "db-progress",
    ownerLabel: "dev-user-001",
  }, o || {});
}

function makeLocalEntry(o) {
  return Object.assign({
    bookId: "book-local",
    chapterId: "chapter-local",
    bookTitle: "Local Book",
    chapterTitle: "Local Chapter",
    sourceType: "builtin",
    lastReadAt: "2026-06-09T00:00:00.000Z",
  }, o || {});
}

test("DB progress takes priority when enabled and has data", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "1 record",
    localEntries: [makeLocalEntry()],
    ownerLabel: "dev1",
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].bookId, "book-1");
  strictEqual(view.items[0].badge, "db-progress");
  strictEqual(view.items[0].badgeText, "开发 DB 阅读进度");
  strictEqual(view.items[0].progressPercent, 50);
  strictEqual(view.items[0].progressDisplay, "50%");
  strictEqual(view.isEmpty, false);
});

test("localStorage fallback when DB progress guard is disabled", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: null,
    dbProgressEnabled: false,
    dbProgressMessage: "DB disabled",
    localEntries: [makeLocalEntry()],
    ownerLabel: null,
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].bookId, "book-local");
  strictEqual(view.items[0].badge, "local-fallback");
  strictEqual(view.items[0].badgeText, "本地最近阅读 fallback");
});

test("localStorage fallback when DB enabled but empty", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [],
    dbProgressEnabled: true,
    dbProgressMessage: "empty",
    localEntries: [makeLocalEntry()],
    ownerLabel: "dev1",
  });
  strictEqual(view.items.length, 1);
  strictEqual(view.items[0].badge, "local-fallback");
});

test("no session shows login entry and empty state", function () {
  var view = build({
    hasSession: false,
    dbProgressItems: null,
    dbProgressEnabled: false,
    dbProgressMessage: null,
    localEntries: [],
    ownerLabel: null,
  });
  strictEqual(view.hasSession, false);
  strictEqual(view.isEmpty, true);
  ok(view.emptyMessage.includes("暂无最近阅读"));
  ok(view.emptySubMessage.includes("未登录"));
  strictEqual(view.loginUrl, "/login?redirect=/user/recent-reading");
});

test("empty state with dev session but no reading data", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: null,
    dbProgressEnabled: false,
    dbProgressMessage: null,
    localEntries: [],
    ownerLabel: null,
  });
  strictEqual(view.isEmpty, true);
  ok(view.emptyMessage.includes("暂无最近阅读"));
});

test("formatProgressPercent formats correctly", function () {
  strictEqual(fmt(0), "0%");
  strictEqual(fmt(50), "50%");
  strictEqual(fmt(100), "100%");
  strictEqual(fmt(33.7), "34%");
  // 0.5 rounds to 1 via Math.round
  strictEqual(fmt(0.5), "1%");
  strictEqual(fmt(-5), "0%");
  strictEqual(fmt(150), "100%");
  strictEqual(fmt(NaN), "0%");
});

test("DB progress items have valid percent formatting", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [
      makeDbProgress({ progressPercent: 75 }),
      makeDbProgress({ bookId: "b2", progressPercent: 12 }),
    ],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  strictEqual(view.items[0].progressDisplay, "75%");
  strictEqual(view.items[1].progressDisplay, "12%");
});

test("continue reading URLs are well-formed", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress({ bookId: "book-abc", chapterId: "ch-xyz" })],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  var url = view.items[0].continueReadingUrl;
  ok(url.startsWith("/reader?bookId="), "URL starts with /reader");
  ok(url.includes("chapterId="), "URL includes chapterId");
  ok(url.includes("book-abc"), "URL includes bookId");
  ok(url.includes("ch-xyz"), "URL includes chapterId value");
  ok(urlsOk(view.items), "all continue URLs valid");
});

test("detail URL is well-formed", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  strictEqual(view.items[0].detailUrl, "/books/book-1");
});

test("page view contains no sensitive fields", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  var result = isSafe(view);
  ok(result.safe, "safe: " + JSON.stringify(result.violations));
});

test("page view JSON has no sensitive keywords", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
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
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  var json = JSON.stringify(view);
  ok(json.indexOf("云端同步完成") === -1);
  ok(json.indexOf("生产阅读进度已保存") === -1);
  ok(json.indexOf("真实用户进度系统已完成") === -1);
  ok(json.indexOf("云端同步成功") === -1);
  ok(json.indexOf("生产可用") === -1);
});

test("dataSourceNotice has no misleading text", function () {
  var view1 = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "开发 DB 阅读进度 - 绑定 dev session 用户 - 未接生产同步",
    localEntries: [],
    ownerLabel: "dev1",
  });
  ok(view1.dataSourceNotice.includes("未接生产同步"));
  ok(!view1.dataSourceNotice.includes("生产可用"));
});

test("ownerLabel is preserved in view", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [makeDbProgress()],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev user alpha",
  });
  strictEqual(view.ownerLabel, "dev user alpha");
});

test("multiple items preserve order", function () {
  var view = build({
    hasSession: true,
    dbProgressItems: [
      makeDbProgress({ bookId: "b1", chapterId: "c1" }),
      makeDbProgress({ bookId: "b2", chapterId: "c2", progressPercent: 75 }),
    ],
    dbProgressEnabled: true,
    dbProgressMessage: "test",
    localEntries: [],
    ownerLabel: "dev1",
  });
  strictEqual(view.items.length, 2);
  strictEqual(view.items[1].progressDisplay, "75%");
});

run();
