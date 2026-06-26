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

const VM_URL = new URL("./user-review-recommendations-view-model.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { buildReviewRecommendationsView, reviewRecommendationsViewIsSafe } = vm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrongBook(overrides) {
  return Object.assign({
    wrongBookId: "wb-1",
    problemId: "p-1",
    title: "Array Problem",
    difficulty: "入门",
    tags: ["arrays"],
    wrongCount: 2,
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
    createdAt: "2026-06-01T00:00:00.000Z",
  }, overrides || {});
}

function makeNote(overrides) {
  return Object.assign({
    noteId: "note-1",
    bookId: "book-1",
    chapterId: "ch-3",
    bookTitle: "Test Book",
    chapterTitle: "Chapter Three",
    noteTextPreview: "Test note",
    createdAt: "2026-06-01T00:00:00.000Z",
  }, overrides || {});
}

function makeAiHistory(overrides) {
  return Object.assign({
    historyId: "ai-1",
    bookId: "book-1",
    chapterId: "ch-4",
    bookTitle: "Test Book",
    chapterTitle: "Chapter Four",
    questionPreview: "What is a closure?",
    createdAt: "2026-06-01T00:00:00.000Z",
  }, overrides || {});
}

function makeFavProblem(overrides) {
  return Object.assign({
    problemId: "fav-1",
    title: "Favorite Problem",
    difficulty: "基础",
    tags: ["strings"],
    favoritedAt: "2026-06-01T00:00:00.000Z",
  }, overrides || {});
}

function baseInput(overrides) {
  return Object.assign({
    hasSession: true,
    wrongBookEntries: [],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Empty data tests
// ---------------------------------------------------------------------------

test("review: empty data returns empty recommendations", function () {
  var view = buildReviewRecommendationsView(baseInput());
  strictEqual(view.totalCount, 0);
  strictEqual(view.recommendations.length, 0);
  ok(view.message.indexOf("暂无足够数据") >= 0, "Should say not enough data");
});

test("review: not logged in shows login message", function () {
  var view = buildReviewRecommendationsView(baseInput({ hasSession: false }));
  ok(view.message.indexOf("请先登录") >= 0 || view.message.indexOf("暂无足够数据") >= 0);
});

// ---------------------------------------------------------------------------
// Priority tests
// ---------------------------------------------------------------------------

test("review: prioritizes needs-review wrong problems (priority 1)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [
      makeWrongBook(),
      makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2", reviewStatus: "reviewed", wrongCount: 4 }),
    ],
  }));
  ok(view.totalCount >= 1);
  var p1Recs = view.recommendations.filter(function (r) { return r.priority === 1; });
  ok(p1Recs.length > 0, "Should have priority 1 recommendations");
  strictEqual(p1Recs[0].sourceType, "wrong-book");
});

test("review: recommends high wrong count problems (priority 2)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [
      makeWrongBook({ reviewStatus: "reviewed", wrongCount: 5 }),
    ],
  }));
  var p2Recs = view.recommendations.filter(function (r) { return r.priority === 2; });
  ok(p2Recs.length > 0, "Should have priority 2 for high wrong count");
});

test("review: recommends needs-review practice (priority 3)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    recentPractice: [makePractice({ status: "needs-review" })],
  }));
  var p3Recs = view.recommendations.filter(function (r) { return r.priority === 3; });
  ok(p3Recs.length > 0, "Should have priority 3 for needs-review practice");
});

test("review: recommends incomplete reading (priority 4)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    recentReading: [makeReading({ progressRatio: 0.3 })],
  }));
  var p4Recs = view.recommendations.filter(function (r) { return r.priority === 4; });
  ok(p4Recs.length > 0, "Should have priority 4 for incomplete reading");
});

test("review: recommends annotated but unvisited chapters (priority 5)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    bookmarks: [makeBookmark()],
    notes: [makeNote()],
    recentReading: [], // no recent reading => annotated chapters show as unvisited
  }));
  var p5Recs = view.recommendations.filter(function (r) { return r.priority === 5; });
  ok(p5Recs.length > 0, "Should have priority 5 for annotated chapters, got " + p5Recs.length);
});

test("review: recommends AI history chapter (priority 6)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    aiHistory: [makeAiHistory()],
  }));
  var p6Recs = view.recommendations.filter(function (r) { return r.priority === 6; });
  ok(p6Recs.length > 0, "Should have priority 6 for AI history");
});

test("review: recommends favorite but not practiced problems (priority 7)", function () {
  var view = buildReviewRecommendationsView(baseInput({
    favoriteProblems: [makeFavProblem()],
    recentPractice: [], // not practiced
  }));
  var p7Recs = view.recommendations.filter(function (r) { return r.priority === 7; });
  ok(p7Recs.length > 0, "Should have priority 7 for favorited not practiced, got " + p7Recs.length);
});

// ---------------------------------------------------------------------------
// Safety label tests
// ---------------------------------------------------------------------------

test("review: every recommendation has safety label", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading({ progressRatio: 0.3 })],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  }));
  for (var i = 0; i < view.recommendations.length; i++) {
    var r = view.recommendations[i];
    ok(r.safetyLabel.indexOf("规则型推荐") >= 0, "Rec " + i + " has safety label");
    ok(r.safetyLabel.indexOf("未调用 LLM") >= 0, "Rec " + i + " mentions no LLM");
  }
});

test("review: dataSourceNotice mentions no LLM", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook()],
  }));
  ok(view.dataSourceNotice.indexOf("未调用 LLM") >= 0);
  ok(view.dataSourceNotice.indexOf("规则型推荐") >= 0);
});

// ---------------------------------------------------------------------------
// Deduplication tests
// ---------------------------------------------------------------------------

test("review: deduplicates same problem from wrong-book + practice", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook({ problemId: "p-1", reviewStatus: "needs-review" })],
    recentPractice: [makePractice({ problemId: "p-1", status: "needs-review" })],
  }));
  var p1Recs = view.recommendations.filter(function (r) { return r.targetId === "p-1"; });
  ok(p1Recs.length <= 1, "Should deduplicate, got " + p1Recs.length);
});

// ---------------------------------------------------------------------------
// Safety tests
// ---------------------------------------------------------------------------

test("review: view is safe", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    aiHistory: [makeAiHistory()],
  }));
  var result = reviewRecommendationsViewIsSafe(view);
  ok(result.safe, "Safe, violations: " + JSON.stringify(result.violations));
});

test("review: no sensitive fields in output", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    aiHistory: [makeAiHistory()],
  }));
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["database_url", "token", "secret", "password", "cookie", "api_key"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("review: no forbidden production labels", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook()],
  }));
  var json = JSON.stringify(view);
  ok(json.indexOf("AI 推荐") === -1);
  ok(json.indexOf("LLM 生成") === -1);
  ok(json.indexOf("生产推荐") === -1);
  ok(json.indexOf("真实推荐系统") === -1);
});

// ---------------------------------------------------------------------------
// Target link tests
// ---------------------------------------------------------------------------

test("review: target links are well-formed", function () {
  var view = buildReviewRecommendationsView(baseInput({
    wrongBookEntries: [makeWrongBook({ problemId: "p-test" })],
    recentReading: [makeReading({ bookId: "b-test", chapterId: "ch-test" })],
    favoriteProblems: [makeFavProblem({ problemId: "fav-test" })],
  }));
  for (var i = 0; i < view.recommendations.length; i++) {
    var r = view.recommendations[i];
    ok(r.targetLink.length > 0, "Rec " + i + " has target link");
    if (r.targetType === "problem") {
      ok(r.targetLink.indexOf("/problems/") >= 0, "Problem rec links to /problems/");
    }
    if (r.targetType === "chapter") {
      ok(r.targetLink.indexOf("/reader?bookId=") >= 0, "Chapter rec links to /reader");
    }
  }
});

run();
