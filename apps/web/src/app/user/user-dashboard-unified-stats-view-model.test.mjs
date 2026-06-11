/**
 * Tests for user-dashboard-unified-stats-view-model.ts
 *
 * Run: node apps/web/src/app/user/user-dashboard-unified-stats-view-model.test.mjs
 */

import { ok, strictEqual, deepStrictEqual } from "node:assert";

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
// Helper: build a mock server stats view
// ---------------------------------------------------------------------------

function mockServerStats(overrides) {
  return Object.assign({
    favoriteBooksCount: 0,
    favoriteBooksSource: "none",
    recentReadingCount: 0,
    recentReadingSource: "none",
    importedBooksCount: 0,
    canManageImports: false,
    recentProblemsCount: 0,
    favoriteProblemsCount: 0,
    problemSystemConnected: false,
    problemSystemMessage: "题目系统未接入",
    dataSourceNotice: "all local",
    hasSession: false,
    anyDbActive: false,
    recentProblemsSource: "none",
    favoriteProblemsSource: "none",
    readerBookmarksCount: 0,
    readerBookmarksSource: "none",
    readerNotesCount: 0,
    readerNotesSource: "none",
    wrongBookTotalCount: 0,
    wrongBookNeedsReviewCount: 0,
    wrongBookMostRecentAt: null,
    wrongBookSource: "none",
  }, overrides || {});
}

function mockServerLearningStats(overrides) {
  return Object.assign({
    todayActivityCount: 0,
    totalActivityCount: 0,
    totalReadingMinutes: 0,
    totalReadingSessions: 0,
    todayReadingMinutes: 0,
    latestActivityTitle: null,
    latestActivityTime: null,
    dataSource: "none",
    dataSourceNotice: "暂无学习统计数据（开发预览）",
    anyDbActive: false,
  }, overrides || {});
}

function mockLocalStats(overrides) {
  return Object.assign({
    favoriteBookCount: 0,
    recentReadingCount: 0,
    favoriteProblemCount: 0,
    recentPracticeCount: 0,
    wrongBookTotalCount: 0,
    wrongBookNeedsReviewCount: 0,
    bookmarkCount: 0,
    noteCount: 0,
    aiHistoryCount: 0,
    learningActivityCount: 0,
    todayActivityCount: 0,
    totalReadingMinutes: 0,
    todayReadingMinutes: 0,
    reviewRecommendationCount: 0,
    todayPlanTaskCount: 0,
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Empty data
// ---------------------------------------------------------------------------

test("empty data returns 13 stats, all placeholder", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: null,
    hasSession: false,
  });
  strictEqual(view.stats.length, 13, "should have 13 stats");
  for (var i = 0; i < view.stats.length; i++) {
    strictEqual(view.stats[i].source, "placeholder-not-connected", "stat " + view.stats[i].statId + " should be placeholder");
    ok(view.stats[i].value === "0" || view.stats[i].value === "0 分钟" || view.stats[i].value === "—", "stat " + view.stats[i].statId + " value should be empty: " + view.stats[i].value);
  }
  strictEqual(view.hasAnyData, false);
  strictEqual(view.overallNotice.indexOf("暂无学习数据") !== -1, true, "should indicate no data");
});

test("empty data has all required categories", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: null,
    hasSession: false,
  });
  var groups = {};
  for (var i = 0; i < view.stats.length; i++) {
    groups[view.stats[i].group] = (groups[view.stats[i].group] || 0) + 1;
  }
  ok(groups["reading"] >= 4, "should have reading group stats");
  ok(groups["problems"] >= 3, "should have problems group stats");
  ok(groups["review"] >= 1, "should have review group");
  ok(groups["ai-assist"] >= 1, "should have ai-assist group");
  ok(groups["activity-plan"] >= 3, "should have activity-plan group stats");
});

// ---------------------------------------------------------------------------
// Server stats -> unified stats
// ---------------------------------------------------------------------------

test("server stats with DB data are reflected correctly", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 5,
      favoriteBooksSource: "db",
      recentReadingCount: 3,
      recentReadingSource: "db",
      readerBookmarksCount: 2,
      readerBookmarksSource: "db",
      readerNotesCount: 4,
      readerNotesSource: "db",
      wrongBookTotalCount: 7,
      wrongBookNeedsReviewCount: 2,
      wrongBookSource: "db",
      anyDbActive: true,
    }),
    serverLearningStats: mockServerLearningStats({
      totalActivityCount: 10,
      totalReadingMinutes: 120,
      dataSource: "db",
      anyDbActive: true,
    }),
    localStats: null,
    hasSession: true,
  });

  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.value, "5");
  strictEqual(favBooks.source, "server-dev-db");
  strictEqual(favBooks.href, "/user/favorites/books");

  var recentReading = findStat(view, "recent-reading");
  strictEqual(recentReading.value, "3");
  strictEqual(recentReading.source, "server-dev-db");

  var bookmarks = findStat(view, "bookmarks");
  strictEqual(bookmarks.value, "2");
  strictEqual(bookmarks.source, "server-dev-db");

  var notes = findStat(view, "notes");
  strictEqual(notes.value, "4");
  strictEqual(notes.source, "server-dev-db");

  var wrongBook = findStat(view, "wrong-book");
  strictEqual(wrongBook.value, "7");
  strictEqual(wrongBook.source, "server-dev-db");

  var activities = findStat(view, "learning-activities");
  strictEqual(activities.value, "10");
  strictEqual(activities.source, "server-dev-db");

  var readingDuration = findStat(view, "reading-duration");
  strictEqual(readingDuration.value, "120 分钟");
  strictEqual(readingDuration.source, "server-dev-db");
});

test("server stats with DB data show mixed when local also has data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 3,
      favoriteBooksSource: "db",
      anyDbActive: true,
    }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ favoriteBookCount: 5 }),
    hasSession: true,
  });
  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.value, "3", "server value takes precedence for display");
  strictEqual(favBooks.source, "mixed", "should be mixed when both have data");
});

test("server source none falls back to local", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksSource: "none" }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ favoriteBookCount: 8 }),
    hasSession: true,
  });
  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.value, "8");
  strictEqual(favBooks.source, "local-storage-fallback");
});

// ---------------------------------------------------------------------------
// Local stats -> unified stats
// ---------------------------------------------------------------------------

test("local-only stats are reflected with correct source", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: mockLocalStats({
      bookmarkCount: 3,
      noteCount: 2,
      aiHistoryCount: 5,
      reviewRecommendationCount: 4,
      todayPlanTaskCount: 3,
    }),
    hasSession: true,
  });

  var bookmarks = findStat(view, "bookmarks");
  strictEqual(bookmarks.value, "3");
  strictEqual(bookmarks.source, "local-storage-fallback");

  var notes = findStat(view, "notes");
  strictEqual(notes.value, "2");
  strictEqual(notes.source, "local-storage-fallback");

  var aiHistory = findStat(view, "ai-history");
  strictEqual(aiHistory.value, "5");
  strictEqual(aiHistory.source, "local-storage-fallback");
  strictEqual(aiHistory.href, "/user/ai-history");

  var reviewRecs = findStat(view, "review-recs");
  strictEqual(reviewRecs.value, "4");
  strictEqual(reviewRecs.source, "local-storage-fallback");

  var todayPlan = findStat(view, "today-plan");
  strictEqual(todayPlan.value, "3");
  strictEqual(todayPlan.source, "local-storage-fallback");
});

// ---------------------------------------------------------------------------
// Mixed source
// ---------------------------------------------------------------------------

test("mixed source appears when server is db and local has data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      recentReadingCount: 2,
      recentReadingSource: "db",
      anyDbActive: true,
    }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ recentReadingCount: 3 }),
    hasSession: true,
  });
  var stat = findStat(view, "recent-reading");
  strictEqual(stat.source, "mixed");
});

test("stat value from server when mixed", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      wrongBookTotalCount: 10,
      wrongBookSource: "db",
      wrongBookNeedsReviewCount: 3,
      anyDbActive: true,
    }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ wrongBookTotalCount: 5 }),
    hasSession: true,
  });
  var stat = findStat(view, "wrong-book");
  strictEqual(stat.value, "10", "server value should be displayed");
  strictEqual(stat.source, "mixed");
});

// ---------------------------------------------------------------------------
// Placeholder / not connected
// ---------------------------------------------------------------------------

test("placeholder-not-connected when no data at all", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksSource: "none" }),
    serverLearningStats: mockServerLearningStats({ dataSource: "none" }),
    localStats: mockLocalStats({ favoriteBookCount: 0 }),
    hasSession: false,
  });
  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.source, "placeholder-not-connected");
  strictEqual(favBooks.value, "0");
});

// ---------------------------------------------------------------------------
// Link correctness
// ---------------------------------------------------------------------------

test("reading stats links are correct", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksSource: "db", favoriteBooksCount: 1, anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ recentReadingCount: 1 }),
    hasSession: true,
  });

  strictEqual(findStat(view, "fav-books").href, "/user/favorites/books");
  strictEqual(findStat(view, "recent-reading").href, "/user/recent-reading");
  strictEqual(findStat(view, "bookmarks").href, "/user/bookmarks");
  strictEqual(findStat(view, "notes").href, "/user/notes");
});

test("problem stats links are correct", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteProblemsSource: "db", favoriteProblemsCount: 1, anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ recentPracticeCount: 1 }),
    hasSession: true,
  });

  strictEqual(findStat(view, "fav-problems").href, "/user/favorites/problems");
  strictEqual(findStat(view, "recent-practice").href, "/user/recent-practice");
  strictEqual(findStat(view, "wrong-book").href, "/user/wrong-book");
});

test("review and plan stats links are correct", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: mockLocalStats({ reviewRecommendationCount: 2, todayPlanTaskCount: 1 }),
    hasSession: true,
  });

  strictEqual(findStat(view, "review-recs").href, "/user/review");
  strictEqual(findStat(view, "today-plan").href, "/user/today");
  strictEqual(findStat(view, "learning-activities").href, "/user/activity");
});

// ---------------------------------------------------------------------------
// AI history does not contain sensitive data
// ---------------------------------------------------------------------------

test("ai-history stat has no raw prompt/response in description", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: mockLocalStats({ aiHistoryCount: 3 }),
    hasSession: true,
  });

  var aiStat = findStat(view, "ai-history");
  ok(aiStat.description.indexOf("raw_prompt") === -1, "should not contain raw_prompt");
  ok(aiStat.description.indexOf("raw response") === -1, "should not contain raw response");
  ok(aiStat.description.indexOf("安全摘要") !== -1, "should mention 安全摘要");
  ok(aiStat.safetyLabel.indexOf("未调用 LLM") !== -1, "safety label should mention 未调用 LLM");
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

test("unified stats view is safe with server data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({
      favoriteBooksCount: 5,
      favoriteBooksSource: "db",
      anyDbActive: true,
    }),
    serverLearningStats: mockServerLearningStats({
      totalActivityCount: 10,
      dataSource: "db",
      anyDbActive: true,
    }),
    localStats: null,
    hasSession: true,
  });
  var result = unifiedStatsViewIsSafe(view);
  ok(result.safe, "violations: " + JSON.stringify(result.violations));
});

test("unified stats view is safe with local data", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: mockLocalStats({
      favoriteBookCount: 3,
      recentReadingCount: 2,
      aiHistoryCount: 1,
    }),
    hasSession: true,
  });
  var result = unifiedStatsViewIsSafe(view);
  ok(result.safe, "violations: " + JSON.stringify(result.violations));
});

test("unified stats values are safe (no sensitive patterns)", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalReadingMinutes: 120, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({ aiHistoryCount: 3 }),
    hasSession: true,
  });
  var result = unifiedStatsValuesAreSafe(view);
  ok(result.safe, "violations: " + JSON.stringify(result.violations));
});

// ---------------------------------------------------------------------------
// Sensitive fields filtered
// ---------------------------------------------------------------------------

test("stats JSON contains no sensitive keywords", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 10, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: mockServerLearningStats({ totalActivityCount: 20, dataSource: "db", anyDbActive: true }),
    localStats: mockLocalStats({ aiHistoryCount: 2, wrongBookTotalCount: 3 }),
    hasSession: true,
  });
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password", "api_key", "raw_prompt", "raw_response"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

// ---------------------------------------------------------------------------
// No misleading production labels
// ---------------------------------------------------------------------------

test("no forbidden production labels in stats", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 5, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: null,
    localStats: null,
    hasSession: true,
  });
  var json = JSON.stringify(view);
  ok(json.indexOf("AI 自动分析") === -1, "should not contain AI 自动分析");
  ok(json.indexOf("生产学习报告") === -1, "should not contain 生产学习报告");
  ok(json.indexOf("真实云端同步") === -1, "should not contain 真实云端同步");
  ok(json.indexOf("Agent 已运行") === -1, "should not contain Agent 已运行");
  ok(json.indexOf("真实用户画像") === -1, "should not contain 真实用户画像");
});

test("every stat has safetyLabel with 未调用 LLM", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 1, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: null,
    localStats: mockLocalStats({ aiHistoryCount: 1 }),
    hasSession: true,
  });
  for (var i = 0; i < view.stats.length; i++) {
    ok(view.stats[i].safetyLabel.indexOf("未调用 LLM") !== -1,
      "stat " + view.stats[i].statId + " should mention 未调用 LLM in safetyLabel");
  }
});

// ---------------------------------------------------------------------------
// createEmptyLocalStats
// ---------------------------------------------------------------------------

test("createEmptyLocalStats returns all zeros", function () {
  var empty = createEmptyLocalStats();
  strictEqual(empty.favoriteBookCount, 0);
  strictEqual(empty.recentReadingCount, 0);
  strictEqual(empty.favoriteProblemCount, 0);
  strictEqual(empty.recentPracticeCount, 0);
  strictEqual(empty.wrongBookTotalCount, 0);
  strictEqual(empty.wrongBookNeedsReviewCount, 0);
  strictEqual(empty.bookmarkCount, 0);
  strictEqual(empty.noteCount, 0);
  strictEqual(empty.aiHistoryCount, 0);
  strictEqual(empty.learningActivityCount, 0);
  strictEqual(empty.totalReadingMinutes, 0);
});

// ---------------------------------------------------------------------------
// Malformed local data safe fallback
// ---------------------------------------------------------------------------

test("null server stats are handled gracefully", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: null,
    hasSession: false,
  });
  ok(view.stats.length > 0, "should still produce stats");
  strictEqual(view.hasAnyData, false);
});

test("null local stats are handled gracefully", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 3, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: null,
    localStats: null,
    hasSession: true,
  });
  var favBooks = findStat(view, "fav-books");
  strictEqual(favBooks.value, "3");
  strictEqual(favBooks.source, "server-dev-db");
});

// ---------------------------------------------------------------------------
// Overall notice variants
// ---------------------------------------------------------------------------

test("overall notice reflects server-only data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 1, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: null,
    localStats: null,
    hasSession: true,
  });
  ok(view.overallNotice.indexOf("开发 DB") !== -1, "should mention 开发 DB when only server data");
  ok(view.serverStatsActive, "serverStatsActive should be true");
  strictEqual(view.localStatsActive, false);
});

test("overall notice reflects local-only data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({}),
    serverLearningStats: mockServerLearningStats({}),
    localStats: mockLocalStats({ favoriteBookCount: 5, recentReadingCount: 3 }),
    hasSession: true,
  });
  ok(view.overallNotice.indexOf("localStorage") !== -1, "should mention localStorage");
  ok(view.overallNotice.indexOf("未调用 LLM") !== -1, "should mention 未调用 LLM");
  strictEqual(view.localStatsActive, true);
});

test("overall notice reflects mixed data", function () {
  var view = buildUnifiedStatsView({
    serverStats: mockServerStats({ favoriteBooksCount: 3, favoriteBooksSource: "db", anyDbActive: true }),
    serverLearningStats: null,
    localStats: mockLocalStats({ recentReadingCount: 2 }),
    hasSession: true,
  });
  ok(view.overallNotice.indexOf("部分") !== -1 || view.overallNotice.indexOf("mixed") !== -1,
    "should indicate mixed: " + view.overallNotice);
  strictEqual(view.serverStatsActive, true);
  strictEqual(view.localStatsActive, true);
});

// ---------------------------------------------------------------------------
// Group labels exist
// ---------------------------------------------------------------------------

test("group labels are present", function () {
  var view = buildUnifiedStatsView({
    serverStats: null,
    serverLearningStats: null,
    localStats: null,
    hasSession: false,
  });
  strictEqual(view.groupLabels["reading"], "阅读");
  strictEqual(view.groupLabels["problems"], "题目");
  strictEqual(view.groupLabels["review"], "复习");
  strictEqual(view.groupLabels["ai-assist"], "AI 辅助");
  strictEqual(view.groupLabels["activity-plan"], "活动与计划");
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function findStat(view, statId) {
  for (var i = 0; i < view.stats.length; i++) {
    if (view.stats[i].statId === statId) return view.stats[i];
  }
  throw new Error("Stat not found: " + statId);
}

run();
