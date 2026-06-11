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

const VM_URL = new URL("./learning-insight-rules.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { computeLearningStatusTag, generateReviewRecommendations, generateTodayPlan, recommendationsAreSafe, todayPlanTasksAreSafe } = vm;

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeWrongBook(overrides) {
  return Object.assign({
    wrongBookId: "wb-1",
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "入门",
    tags: ["arrays"],
    wrongCount: 1,
    lastWrongAt: "2026-06-10T00:00:00.000Z",
    reviewStatus: "needs-review",
    notePreview: null,
    sourceType: "local-fallback",
  }, overrides || {});
}

function makePractice(overrides) {
  return Object.assign({
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "入门",
    status: "practiced",
    updatedAt: "2026-06-10T00:00:00.000Z",
  }, overrides || {});
}

function makeReading(overrides) {
  return Object.assign({
    bookId: "book-1",
    bookTitle: "Test Book",
    chapterId: "ch-1",
    chapterTitle: "Chapter One",
    progressRatio: 0.5,
    lastReadAt: "2026-06-10T00:00:00.000Z",
    sourceType: "local",
  }, overrides || {});
}

function makeBookmark(overrides) {
  return Object.assign({
    bookId: "book-1",
    chapterId: "ch-2",
    bookTitle: "Test Book",
    chapterTitle: "Chapter Two",
    createdAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function makeNote(overrides) {
  return Object.assign({
    noteId: "note-1",
    bookId: "book-1",
    chapterId: "ch-1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter One",
    noteTextPreview: "Test note text",
    createdAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function makeAiHistory(overrides) {
  return Object.assign({
    historyId: "ai-1",
    bookId: "book-1",
    chapterId: "ch-1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter One",
    questionPreview: "What is a variable?",
    createdAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function makeFavProblem(overrides) {
  return Object.assign({
    problemId: "fav-1",
    title: "Favorite Problem",
    difficulty: "基础",
    tags: ["strings"],
    favoritedAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// computeLearningStatusTag tests
// ---------------------------------------------------------------------------

test("computeLearningStatusTag: no-data when all zero", function () {
  var tag = computeLearningStatusTag({
    readingMinutes: 0,
    recentPracticeCount: 0,
    wrongBookNeedsReviewCount: 0,
    totalEntries: 0,
  });
  strictEqual(tag, "no-data");
});

test("computeLearningStatusTag: reading-active when reading >= 30 min", function () {
  var tag = computeLearningStatusTag({
    readingMinutes: 60,
    recentPracticeCount: 0,
    wrongBookNeedsReviewCount: 0,
    totalEntries: 5,
  });
  strictEqual(tag, "reading-active");
});

test("computeLearningStatusTag: wrong-book-needs-review when needs review > 0", function () {
  var tag = computeLearningStatusTag({
    readingMinutes: 10,
    recentPracticeCount: 0,
    wrongBookNeedsReviewCount: 3,
    totalEntries: 4,
  });
  strictEqual(tag, "wrong-book-needs-review");
});

test("computeLearningStatusTag: practice-needs-improvement when low practice", function () {
  var tag = computeLearningStatusTag({
    readingMinutes: 10,
    recentPracticeCount: 1,
    wrongBookNeedsReviewCount: 0,
    totalEntries: 3,
  });
  strictEqual(tag, "practice-needs-improvement");
});

// ---------------------------------------------------------------------------
// generateReviewRecommendations tests
// ---------------------------------------------------------------------------

test("generateReviewRecommendations: prioritizes needs-review wrong problems", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [makeWrongBook(), makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2" })],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  ok(recs.length > 0, "Should have recommendations");
  ok(recs.every(function (r) { return r.priority === 1; }), "All should be priority 1 for needs-review");
  ok(recs[0].safetyLabel.indexOf("规则型推荐") >= 0, "Has safety label");
  ok(recs[0].safetyLabel.indexOf("未调用 LLM") >= 0, "Mentions no LLM");
});

test("generateReviewRecommendations: recommends favorite but not practiced problems", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [],
    recentPractice: [makePractice({ problemId: "p-1" })],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [makeFavProblem(), makeFavProblem({ problemId: "fav-2", title: "Another Fav" })],
  });
  var favRecs = recs.filter(function (r) { return r.sourceType === "favorite-problems"; });
  ok(favRecs.length > 0, "Should have favorite-problem recommendations");
  strictEqual(favRecs[0].priority, 7, "Favorite problems should be priority 7");
});

test("generateReviewRecommendations: recommends incomplete reading", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [],
    recentPractice: [],
    recentReading: [makeReading({ progressRatio: 0.3 })],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var readingRecs = recs.filter(function (r) { return r.sourceType === "recent-reading"; });
  ok(readingRecs.length > 0, "Should have reading recommendations");
  strictEqual(readingRecs[0].priority, 4, "Incomplete reading should be priority 4");
  ok(readingRecs[0].reason.indexOf("未完成") >= 0, "Reason should mention incomplete");
});

test("generateReviewRecommendations: empty data returns empty", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  strictEqual(recs.length, 0, "Empty data should return no recommendations");
});

test("generateReviewRecommendations: deduplicates by targetType+targetId", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [
      makeWrongBook({ problemId: "p-1", reviewStatus: "needs-review" }),
      makeWrongBook({ wrongBookId: "wb-2", problemId: "p-1", reviewStatus: "reviewed", wrongCount: 3 }),
    ],
    recentPractice: [makePractice({ problemId: "p-1", status: "needs-review" })],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  // Should deduplicate p-1 across multiple sources
  var p1Recs = recs.filter(function (r) { return r.targetId === "p-1"; });
  ok(p1Recs.length <= 1, "Should deduplicate same targetId");
});

test("generateReviewRecommendations: max 10 recs", function () {
  var wrongBooks = [];
  for (var i = 0; i < 20; i++) {
    wrongBooks.push(makeWrongBook({
      wrongBookId: "wb-" + i,
      problemId: "p-" + i,
      reviewStatus: "needs-review",
    }));
  }
  var recs = generateReviewRecommendations({
    wrongBookEntries: wrongBooks,
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  ok(recs.length <= 10, "Should cap at 10 recommendations");
});

// ---------------------------------------------------------------------------
// recommendationsAreSafe tests
// ---------------------------------------------------------------------------

test("recommendationsAreSafe: validates safety labels", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [makeWrongBook()],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var result = recommendationsAreSafe(recs);
  ok(result.safe, "Safe, violations: " + JSON.stringify(result.violations));
});

test("recommendationsAreSafe: rejects token in rec", function () {
  var result = recommendationsAreSafe([{
    recommendationId: "rec-1",
    title: "Test",
    reason: "token: abc123",
    targetType: "problem",
    targetId: "p-1",
    targetLink: "/problems/p-1",
    priority: 1,
    sourceType: "wrong-book",
    safetyLabel: "ok",
  }]);
  ok(!result.safe, "Should reject token");
});

// ---------------------------------------------------------------------------
// generateTodayPlan tests
// ---------------------------------------------------------------------------

test("generateTodayPlan: generates 3-5 tasks", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading({ progressRatio: 0.5 })],
    readingSessionSummary: { totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [makeNote()],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  });
  ok(tasks.length >= 3 && tasks.length <= 5, "Should have 3-5 tasks, got " + tasks.length);
});

test("generateTodayPlan: estimatedMinutes are reasonable", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook(), makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2" })],
    recentReading: [makeReading()],
    readingSessionSummary: { totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [makeNote()],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  });
  for (var i = 0; i < tasks.length; i++) {
    ok(tasks[i].estimatedMinutes > 0, "Task " + i + " has positive estimate");
    ok(tasks[i].estimatedMinutes <= 120, "Task " + i + " has reasonable estimate (<= 120): " + tasks[i].estimatedMinutes);
  }
});

test("generateTodayPlan: each task has dev-only label", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: { totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  for (var i = 0; i < tasks.length; i++) {
    ok(tasks[i].devOnlyLabel.indexOf("开发预览") >= 0, "Task " + i + " has dev label");
    ok(tasks[i].devOnlyLabel.indexOf("未调用 LLM") >= 0, "Task " + i + " mentions no LLM");
  }
});

test("generateTodayPlan: empty data still generates reading suggestion", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  // Should at least suggest "start reading"
  var readingTasks = tasks.filter(function (t) { return t.title.indexOf("阅读") >= 0; });
  ok(readingTasks.length > 0, "Should suggest reading even with empty data");
});

test("generateTodayPlan: todo tasks are for needs-review", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook(), makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2" })],
    recentReading: [makeReading()],
    readingSessionSummary: { totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var todoTasks = tasks.filter(function (t) { return t.status === "todo"; });
  ok(todoTasks.length > 0, "Should have at least one todo task");
  ok(todoTasks[0].title.indexOf("复习") >= 0, "Todo task should be review");
});

// ---------------------------------------------------------------------------
// todayPlanTasksAreSafe tests
// ---------------------------------------------------------------------------

test("todayPlanTasksAreSafe: validates dev-only labels", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var result = todayPlanTasksAreSafe(tasks);
  ok(result.safe, "Safe, violations: " + JSON.stringify(result.violations));
});

test("todayPlanTasksAreSafe: rejects forbidden label AI 已自动规划", function () {
  var result = todayPlanTasksAreSafe([{
    taskId: "task-1",
    title: "AI 已自动规划任务",
    description: "test",
    estimatedMinutes: 10,
    targetType: "problem",
    targetId: "p-1",
    targetLink: "/problems/p-1",
    status: "todo",
    reason: "test",
    devOnlyLabel: "开发预览",
  }]);
  ok(!result.safe, "Should reject forbidden label");
});

// ---------------------------------------------------------------------------
// Sensitive field tests
// ---------------------------------------------------------------------------

test("generateReviewRecommendations: no DATABASE_URL in output", function () {
  var recs = generateReviewRecommendations({
    wrongBookEntries: [makeWrongBook()],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var json = JSON.stringify(recs).toLowerCase();
  ok(json.indexOf("database_url") === -1, "No DATABASE_URL");
  ok(json.indexOf("token") === -1, "No token");
  ok(json.indexOf("secret") === -1, "No secret");
});

test("generateTodayPlan: no sensitive fields in output", function () {
  var tasks = generateTodayPlan({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: { totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var json = JSON.stringify(tasks).toLowerCase();
  ok(json.indexOf("database_url") === -1, "No DATABASE_URL");
  ok(json.indexOf("rawprompt") === -1, "No raw prompt");
  ok(json.indexOf("rawresponse") === -1, "No raw response");
});

run();
