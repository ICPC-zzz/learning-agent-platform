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
      console.log("PASS: " + t.name);
    } catch (err) {
      failed++;
      console.error("FAIL: " + t.name + " - " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

const VM_URL = new URL("./user-dashboard-stats-view-model.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { buildDashboardStatsView, dashboardStatsViewIsSafe, problemSystemIsPlaceholder } = vm;

function baseInput(overrides) {
  return Object.assign({
    hasSession: true,
    dbFavorites: null,
    dbFavoritesEnabled: false,
    localFavorites: [],
    dbProgressItems: null,
    dbProgressEnabled: false,
    localRecentReadings: [],
    // problem fields
    dbProblemFavorites: null,
    dbProblemFavoritesEnabled: false,
    localProblemFavorites: [],
    dbPracticeItems: null,
    dbPracticeEnabled: false,
    localPracticeEntries: [],
    // reader fields
    dbReaderBookmarks: null,
    dbReaderBookmarksEnabled: false,
    localReaderBookmarks: [],
    dbReaderNotes: null,
    dbReaderNotesEnabled: false,
    localReaderNotes: [],
    // wrong book fields
    dbWrongBookItems: null,
    dbWrongBookEnabled: false,
    localWrongBookEntries: [],
    dbWrongBookNeedsReviewCount: 0,
    dbWrongBookTotalCount: 0,
    dbWrongBookMostRecentAt: null,
    importedBooksCount: 0,
    canManageImports: false,
  }, overrides || {});
}

function makeDbFav(overrides) {
  return Object.assign({ bookId: "book-1", bookTitle: "Test Book", sourceType: "builtin", firstChapterId: null, createdAt: "2026-06-10T00:00:00.000Z", updatedAt: "2026-06-10T00:00:00.000Z", source: "db-favorite", ownerLabel: "dev1", notice: "dev-only" }, overrides || {});
}
function makeLocalFav(overrides) {
  return Object.assign({ bookId: "book-local", title: "Local Book", sourceType: "builtin", firstChapterId: "ch-1", updatedAt: "2026-06-09T00:00:00.000Z" }, overrides || {});
}
function makeDbProgress(overrides) {
  return Object.assign({ bookId: "book-1", chapterId: "chapter-1", bookTitle: "Test Book", chapterTitle: "Chapter One", progressRatio: 0.5, progressPercent: 50, updatedAt: "2026-06-10T00:00:00.000Z", source: "db-progress", ownerLabel: "dev1" }, overrides || {});
}
function makeLocalEntry(overrides) {
  return Object.assign({ bookId: "book-local", chapterId: "ch-local", bookTitle: "Local Book", chapterTitle: "Local Chapter", sourceType: "builtin", lastReadAt: "2026-06-09T00:00:00.000Z" }, overrides || {});
}

test("favorite count from DB when enabled", function () {
  var view = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav(), makeDbFav({ bookId: "b2" })], dbFavoritesEnabled: true }));
  strictEqual(view.favoriteBooksCount, 2);
  strictEqual(view.favoriteBooksSource, "db");
});

test("favorite count from localStorage when DB disabled", function () {
  var view = buildDashboardStatsView(baseInput({ localFavorites: [makeLocalFav(), makeLocalFav({ bookId: "b3" })] }));
  strictEqual(view.favoriteBooksCount, 2);
  strictEqual(view.favoriteBooksSource, "local");
});

test("recent reading count from DB when enabled", function () {
  var view = buildDashboardStatsView(baseInput({ dbProgressItems: [makeDbProgress(), makeDbProgress({ bookId: "b2" }), makeDbProgress({ bookId: "b3" })], dbProgressEnabled: true }));
  strictEqual(view.recentReadingCount, 3);
  strictEqual(view.recentReadingSource, "db");
});

test("recent reading count from localStorage when DB disabled", function () {
  var view = buildDashboardStatsView(baseInput({ localRecentReadings: [makeLocalEntry()] }));
  strictEqual(view.recentReadingCount, 1);
  strictEqual(view.recentReadingSource, "local");
});

test("imported books count passed through", function () {
  var view = buildDashboardStatsView(baseInput({ importedBooksCount: 5, canManageImports: true }));
  strictEqual(view.importedBooksCount, 5);
  strictEqual(view.canManageImports, true);
});

test("wrong book count from DB when enabled", function () {
  var view = buildDashboardStatsView(baseInput({ dbWrongBookItems: [{}, {}], dbWrongBookEnabled: true, dbWrongBookTotalCount: 2, dbWrongBookNeedsReviewCount: 1 }));
  strictEqual(view.wrongBookTotalCount, 2);
  strictEqual(view.wrongBookNeedsReviewCount, 1);
  strictEqual(view.wrongBookSource, "db");
});

test("wrong book count from local when DB disabled", function () {
  var view = buildDashboardStatsView(baseInput({ localWrongBookEntries: [{}, {}, {}] }));
  strictEqual(view.wrongBookTotalCount, 3);
  strictEqual(view.wrongBookSource, "local");
});

test("wrong book count none when empty", function () {
  var view = buildDashboardStatsView(baseInput({}));
  strictEqual(view.wrongBookTotalCount, 0);
  strictEqual(view.wrongBookSource, "none");
});

test("problem system is always placeholder", function () {
  var view = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav()], dbFavoritesEnabled: true, dbProgressItems: [makeDbProgress()], dbProgressEnabled: true, importedBooksCount: 3, canManageImports: true }));
  strictEqual(view.problemSystemConnected, false);
  ok(view.problemSystemMessage.includes("未接入"));
  ok(problemSystemIsPlaceholder(view));
});

test("dataSourceNotice varies by state", function () {
  var allLocal = buildDashboardStatsView(baseInput({ hasSession: false }));
  ok(allLocal.dataSourceNotice.includes("localStorage") || allLocal.dataSourceNotice.includes("本地存储"));
  var dbView = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav()], dbFavoritesEnabled: true }));
  ok(dbView.dataSourceNotice.includes("DB"));
});

test("dashboard stats view is safe", function () {
  var view = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav()], dbFavoritesEnabled: true, dbProgressItems: [makeDbProgress()], dbProgressEnabled: true, importedBooksCount: 2, canManageImports: true }));
  var result = dashboardStatsViewIsSafe(view);
  ok(result.safe, "Stats safe, violations: " + JSON.stringify(result.violations));
});

test("stats JSON contains no sensitive keywords", function () {
  var view = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav()], dbFavoritesEnabled: true }));
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password", "api_key"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("no misleading production labels", function () {
  var view = buildDashboardStatsView(baseInput({ dbFavorites: [makeDbFav()], dbFavoritesEnabled: true }));
  var json = JSON.stringify(view);
  ok(json.indexOf("生产可用") === -1);
  ok(json.indexOf("真实数据") === -1);
  ok(json.indexOf("云端同步") === -1);
});

test("source is none when no data", function () {
  var view = buildDashboardStatsView(baseInput({ hasSession: false }));
  strictEqual(view.favoriteBooksSource, "none");
  strictEqual(view.recentReadingSource, "none");
});

test("hasSession is passed through correctly", function () {
  var viewTrue = buildDashboardStatsView(baseInput({ hasSession: true }));
  var viewFalse = buildDashboardStatsView(baseInput({ hasSession: false }));
  strictEqual(viewTrue.hasSession, true);
  strictEqual(viewFalse.hasSession, false);
});

run();
