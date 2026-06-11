/**
 * Tests for UserDashboardUnifiedStatsHydration — verifies the merge logic
 * and safety properties of the unified hydration pipeline.
 *
 * These tests cover the pure-function pipeline used by the hydration
 * component (buildUnifiedStatsView + safety checks). The component itself
 * is "use client" and requires browser localStorage — that's tested via
 * the pure function paths here instead.
 *
 * Run: node apps/web/src/app/user/user-dashboard-unified-stats-hydration.test.mjs
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
      console.log("PASS: " + t.name);
    } catch (err) {
      failed++;
      console.error("FAIL: " + t.name + " - " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

var VM_URL = new URL("./user-dashboard-unified-stats-view-model.ts", import.meta.url).href;
var vm = await import(VM_URL);
var {
  buildUnifiedStatsView,
  createEmptyLocalStats,
  unifiedStatsViewIsSafe,
  unifiedStatsValuesAreSafe,
} = vm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockServerStats(overrides) {
  return Object.assign({
    favoriteBooksCount: 0, favoriteBooksSource: "none",
    recentReadingCount: 0, recentReadingSource: "none",
    importedBooksCount: 0, canManageImports: false,
    recentProblemsCount: 0, favoriteProblemsCount: 0,
    problemSystemConnected: false, problemSystemMessage: "题目系统未接入",
    dataSourceNotice: "all local", hasSession: false, anyDbActive: false,
    recentProblemsSource: "none", favoriteProblemsSource: "none",
    readerBookmarksCount: 0, readerBookmarksSource: "none",
    readerNotesCount: 0, readerNotesSource: "none",
    wrongBookTotalCount: 0, wrongBookNeedsReviewCount: 0,
    wrongBookMostRecentAt: null, wrongBookSource: "none",
  }, overrides || {});
}

function mockServerLearningStats(overrides) {
  return Object.assign({
    todayActivityCount: 0, totalActivityCount: 0,
    totalReadingMinutes: 0, totalReadingSessions: 0,
    todayReadingMinutes: 0, latestActivityTitle: null,
    latestActivityTime: null, dataSource: "none",
    dataSourceNotice: "暂无学习统计数据（开发预览）", anyDbActive: false,
  }, overrides || {});
}

function mockLocalStats(overrides) {
  return Object.assign({
    favoriteBookCount: 0, recentReadingCount: 0,
    favoriteProblemCount: 0, recentPracticeCount: 0,
    wrongBookTotalCount: 0, wrongBookNeedsReviewCount: 0,
    bookmarkCount: 0, noteCount: 0,
    aiHistoryCount: 0,
    learningActivityCount: 0, todayActivityCount: 0,
    totalReadingMinutes: 0, todayReadingMinutes: 0,
    reviewRecommendationCount: 0, todayPlanTaskCount: 0,
  }, overrides || {});
}

function findStat(view, statId) {
  for (var i = 0; i < view.stats.length; i++) {
    if (view.stats[i].statId === statId) return view.stats[i];
  }
  throw new Error("Stat not found: " + statId);
}

// ---------------------------------------------------------------------------
// Hydration: server-only initial render
// ---------------------------------------------------------------------------

test("server-only view (no local data) produces correct counts", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 3, favoriteBooksSource: "db", anyDbActive: true,
      readerBookmarksCount: 1, readerBookmarksSource: "db",
      readerNotesCount: 2, readerNotesSource: "db",
      wrongBookTotalCount: 4, wrongBookSource: "db", wrongBookNeedsReviewCount: 1,
    }),
    serverLearningStats: mockServerLearningStats({
      totalActivityCount: 8, totalReadingMinutes: 90,
      dataSource: "db", anyDbActive: true,
    }),
    localStats: null,
    hasSession: true,
  });

  strictEqual(findStat(view, "fav-books").source, "server-dev-db");
  strictEqual(findStat(view, "bookmarks").source, "server-dev-db");
  strictEqual(findStat(view, "notes").source, "server-dev-db");
  strictEqual(findStat(view, "wrong-book").source, "server-dev-db");
  strictEqual(findStat(view, "learning-activities").source, "server-dev-db");
  strictEqual(findStat(view, "reading-duration").source, "server-dev-db");

  // Local-only stats should be placeholder
  strictEqual(findStat(view, "ai-history").source, "placeholder-not-connected");
  strictEqual(findStat(view, "review-recs").source, "placeholder-not-connected");
  strictEqual(findStat(view, "today-plan").source, "placeholder-not-connected");
});

// ---------------------------------------------------------------------------
// Hydration: server + local merge
// ---------------------------------------------------------------------------

test("hydration merge does not overwrite server stats values", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true,
    }),
    serverLearningStats: null,
    localStats: mockLocalStats({ favoriteBookCount: 20 }), // local has 20, server has 5
    hasSession: true,
  });
  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.value, "5", "server value should take precedence");
  strictEqual(favBooks.source, "mixed", "source should be mixed");
});

test("hydration uses local value when server source is none", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksSource: "none" }),
    serverLearningStats: mockServerLearningStats({ dataSource: "none" }),
    localStats: mockLocalStats({ favoriteBookCount: 7, recentReadingCount: 4 }),
    hasSession: true,
  });
  strictEqual(findStat(view, "fav-books").value, "7");
  strictEqual(findStat(view, "fav-books").source, "local-storage-fallback");
  strictEqual(findStat(view, "recent-reading").value, "4");
  strictEqual(findStat(view, "recent-reading").source, "local-storage-fallback");
});

test("hydration preserves all 12 stat IDs", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 1, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalActivityCount: 1, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({
      bookmarkCount: 2, noteCount: 3, aiHistoryCount: 1,
      favoriteProblemCount: 2, recentPracticeCount: 1,
      reviewRecommendationCount: 2, todayPlanTaskCount: 4,
    }),
    hasSession: true,
  });

  var expectedIds = [
    "fav-books", "recent-reading", "bookmarks", "notes",
    "fav-problems", "recent-practice", "wrong-book",
    "review-recs", "ai-history",
    "learning-activities", "reading-duration", "today-plan",
  ];
  for (var i = 0; i < expectedIds.length; i++) {
    findStat(view, expectedIds[i]); // throws if missing
  }
  ok(true, "all 12 stat IDs present");
});

// ---------------------------------------------------------------------------
// Malformed data fallback
// ---------------------------------------------------------------------------

test("null serverStats produces safe fallback for all stats", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: null,
    hasSession: false,
  });
  strictEqual(view.stats.length, 12);
  for (var i = 0; i < view.stats.length; i++) {
    ok(view.stats[i].source === "placeholder-not-connected",
      "all should be placeholder, got " + view.stats[i].source + " for " + view.stats[i].statId);
  }
  strictEqual(view.hasAnyData, false);
});

test("zero values with server-source-none produce placeholder source", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksSource: "none", anyDbActive: false }),
    serverLearningStats: mockServerLearningStats({ dataSource: "none", anyDbActive: false }),
    localStats: createEmptyLocalStats(),
    hasSession: false,
  });
  strictEqual(findStat(view, "fav-books").source, "placeholder-not-connected");
  strictEqual(findStat(view, "learning-activities").source, "placeholder-not-connected");
  strictEqual(findStat(view, "reading-duration").source, "placeholder-not-connected");
});

// ---------------------------------------------------------------------------
// Sensitive fields filtered
// ---------------------------------------------------------------------------

test("merged view JSON contains no sensitive keywords", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 10, favoriteBooksSource: "db", anyDbActive: true,
      wrongBookTotalCount: 5, wrongBookSource: "db", wrongBookNeedsReviewCount: 2,
    }),
    serverLearningStats: mockServerLearningStats({
      totalActivityCount: 25, totalReadingMinutes: 200,
      dataSource: "db", anyDbActive: true,
    }),
    localStats: mockLocalStats({
      aiHistoryCount: 3, bookmarkCount: 5, noteCount: 7,
    }),
    hasSession: true,
  });
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password",
    "api_key", "raw_prompt", "raw_response", "rawtext", "fullchaptercontent", "submittedcode"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("merged view safety check passes", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true,
      readerBookmarksCount: 2, readerBookmarksSource: "db",
      readerNotesCount: 3, readerNotesSource: "db",
    }),
    serverLearningStats: mockServerLearningStats({
      totalActivityCount: 12, totalReadingMinutes: 180,
      dataSource: "db", anyDbActive: true,
    }),
    localStats: mockLocalStats({
      aiHistoryCount: 2, favoriteProblemCount: 3,
      reviewRecommendationCount: 1, todayPlanTaskCount: 2,
    }),
    hasSession: true,
  });
  var result = unifiedStatsViewIsSafe(view);
  ok(result.safe, "violations: " + JSON.stringify(result.violations));
  var valueResult = unifiedStatsValuesAreSafe(view);
  ok(valueResult.safe, "value violations: " + JSON.stringify(valueResult.violations));
});

// ---------------------------------------------------------------------------
// No misleading production labels
// ---------------------------------------------------------------------------

test("merged view has no misleading production labels", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalActivityCount: 10, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({ aiHistoryCount: 3 }),
    hasSession: true,
  });
  var json = JSON.stringify(view);
  var forbidden = [
    "AI 自动分析", "生产学习报告", "真实云端同步",
    "真实用户画像", "Agent 已运行", "LLM 生成",
  ];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "should not contain: " + forbidden[i]);
  }
});

// ---------------------------------------------------------------------------
// No "AI 自动分析" in any field
// ---------------------------------------------------------------------------

test("no AI auto-analysis label in any stat field", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalActivityCount: 10, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({ aiHistoryCount: 3, reviewRecommendationCount: 2 }),
    hasSession: true,
  });
  var json = JSON.stringify(view);
  ok(json.indexOf("AI 自动分析") === -1, "should not contain AI 自动分析");

  for (var i = 0; i < view.stats.length; i++) {
    var s = view.stats[i];
    ok(s.description.indexOf("AI 自动分析") === -1, s.statId + " description should not mention AI 自动分析");
    ok(s.safetyLabel.indexOf("AI 自动分析") === -1, s.statId + " safetyLabel should not mention AI 自动分析");
  }
});

// ---------------------------------------------------------------------------
// Overall dataSourceNotice correctness
// ---------------------------------------------------------------------------

test("overallNotice includes safety disclaimers", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 3, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalReadingMinutes: 60, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({ recentReadingCount: 2 }),
    hasSession: true,
  });
  ok(view.overallNotice.indexOf("未调用 LLM") !== -1, "should include 未调用 LLM");
  ok(view.overallNotice.indexOf("规则型统计") !== -1, "should include 规则型统计");
  ok(view.overallNotice.indexOf("未接生产账号") !== -1, "should include 未接生产账号");
});

run();
