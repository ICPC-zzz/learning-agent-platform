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

const VM_URL = new URL("./user-learning-report-view-model.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { buildLearningReportView, learningReportViewIsSafe, LEARNING_STATUS_LABELS } = vm;

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

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

function makeSessionSummary(overrides) {
  return Object.assign({
    totalSessions: 5,
    totalDurationMinutes: 120,
    todayDurationMinutes: 30,
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

function makeWrongBook(overrides) {
  return Object.assign({
    wrongBookId: "wb-1",
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "入门",
    tags: ["arrays"],
    wrongCount: 2,
    lastWrongAt: "2026-06-10T00:00:00.000Z",
    reviewStatus: "needs-review",
    notePreview: null,
    sourceType: "local-fallback",
  }, overrides || {});
}

function makeBookmark(overrides) {
  return Object.assign({
    bookId: "book-1",
    chapterId: "ch-1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter One",
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
    noteTextPreview: "Test note",
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

function makeActivity(overrides) {
  return Object.assign({
    activityId: "act-1",
    activityType: "read-book",
    title: "Read Chapter One",
    targetType: "chapter",
    targetId: "ch-1",
    bookId: "book-1",
    chapterId: "ch-1",
    problemId: null,
    occurredAt: "2026-06-10T00:00:00.000Z",
    durationSeconds: 600,
  }, overrides || {});
}

function baseInput(overrides) {
  return Object.assign({
    hasSession: true,
    recentReading: [],
    readingSessionSummary: makeSessionSummary(),
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    activities: [],
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Empty data tests
// ---------------------------------------------------------------------------

test("report: empty data shows zero counts", function () {
  var view = buildLearningReportView(baseInput());
  strictEqual(view.today.activityCount, 0);
  strictEqual(view.today.readingMinutes, 30); // from session summary
  strictEqual(view.today.practiceCount, 0);
  strictEqual(view.reading.recentReadingCount, 0);
  strictEqual(view.problems.wrongBookTotalCount, 0);
  strictEqual(view.annotations.bookmarkCount, 0);
  strictEqual(view.annotations.noteCount, 0);
  strictEqual(view.annotations.aiHistoryCount, 0);
});

test("report: statusTag is no-data when empty", function () {
  var view = buildLearningReportView(baseInput({
    readingSessionSummary: makeSessionSummary({ totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 }),
  }));
  strictEqual(view.statusTag, "no-data");
  strictEqual(view.statusLabel, LEARNING_STATUS_LABELS["no-data"]);
});

test("report: hasData is false when empty", function () {
  var view = buildLearningReportView(baseInput({
    readingSessionSummary: makeSessionSummary({ totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 }),
  }));
  strictEqual(view.hasData, false);
});

// ---------------------------------------------------------------------------
// Aggregation tests
// ---------------------------------------------------------------------------

test("report: aggregates reading session total minutes", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
  }));
  strictEqual(view.reading.totalReadingMinutes, 120);
  strictEqual(view.reading.totalReadingSessions, 5);
});

test("report: aggregates wrong book count", function () {
  var view = buildLearningReportView(baseInput({
    wrongBookEntries: [
      makeWrongBook(),
      makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2", reviewStatus: "reviewed" }),
      makeWrongBook({ wrongBookId: "wb-3", problemId: "p-3", reviewStatus: "needs-review" }),
    ],
  }));
  strictEqual(view.problems.wrongBookTotalCount, 3);
  strictEqual(view.problems.wrongBookNeedsReviewCount, 2);
});

test("report: aggregates AI history count but no raw content", function () {
  var view = buildLearningReportView(baseInput({
    aiHistory: [
      makeAiHistory(),
      makeAiHistory({ historyId: "ai-2", chapterId: "ch-2" }),
    ],
  }));
  strictEqual(view.annotations.aiHistoryCount, 2);
  // Verify no raw prompt/response in view
  var json = JSON.stringify(view).toLowerCase();
  ok(json.indexOf("rawprompt") === -1, "No raw prompt");
  ok(json.indexOf("rawresponse") === -1, "No raw response");
  ok(json.indexOf("fullchaptercontent") === -1, "No full chapter content");
});

test("report: aggregates note and bookmark counts", function () {
  var view = buildLearningReportView(baseInput({
    bookmarks: [makeBookmark(), makeBookmark({ bookId: "book-2", chapterId: "ch-2" })],
    notes: [makeNote(), makeNote({ noteId: "note-2", chapterId: "ch-2" }), makeNote({ noteId: "note-3" })],
  }));
  strictEqual(view.annotations.bookmarkCount, 2);
  strictEqual(view.annotations.noteCount, 3);
});

// ---------------------------------------------------------------------------
// Status tag tests
// ---------------------------------------------------------------------------

test("report: reading-active when reading >= 30 min", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
  }));
  strictEqual(view.statusTag, "reading-active");
});

test("report: wrong-book-needs-review when wrong book pending", function () {
  var view = buildLearningReportView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    readingSessionSummary: makeSessionSummary({ totalSessions: 1, totalDurationMinutes: 10, todayDurationMinutes: 0 }),
  }));
  strictEqual(view.statusTag, "wrong-book-needs-review");
});

test("report: practice-needs-improvement when low practice", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary({ totalSessions: 0, totalDurationMinutes: 10, todayDurationMinutes: 0 }),
    recentPractice: [makePractice()],
  }));
  strictEqual(view.statusTag, "practice-needs-improvement");
});

// ---------------------------------------------------------------------------
// Safety tests
// ---------------------------------------------------------------------------

test("report: view is safe", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
    wrongBookEntries: [makeWrongBook()],
    aiHistory: [makeAiHistory()],
    notes: [makeNote()],
  }));
  var result = learningReportViewIsSafe(view);
  ok(result.safe, "Safe, violations: " + JSON.stringify(result.violations));
});

test("report: no sensitive fields in output", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
    aiHistory: [makeAiHistory()],
  }));
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["database_url", "token", "secret", "password", "cookie", "api_key", "rawprompt", "rawresponse"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("report: no forbidden production labels", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [makeReading()],
  }));
  var json = JSON.stringify(view);
  ok(json.indexOf("生产学习报告") === -1);
  ok(json.indexOf("真实云端同步") === -1);
  ok(json.indexOf("AI 生成报告") === -1);
  ok(json.indexOf("LLM 生成") === -1);
});

// ---------------------------------------------------------------------------
// Latest reading
// ---------------------------------------------------------------------------

test("report: shows latest reading chapter", function () {
  var view = buildLearningReportView(baseInput({
    recentReading: [
      makeReading(),
      makeReading({ bookId: "book-2", chapterId: "ch-2", chapterTitle: "Chapter Two", lastReadAt: "2026-06-09T00:00:00.000Z" }),
    ],
  }));
  strictEqual(view.reading.latestChapterTitle, "Chapter One");
  strictEqual(view.reading.latestBookTitle, "Test Book");
});

test("report: latestReading is null when empty", function () {
  var view = buildLearningReportView(baseInput());
  strictEqual(view.reading.latestChapterTitle, null);
  strictEqual(view.reading.latestBookTitle, null);
});

// ---------------------------------------------------------------------------
// Favorite problems count
// ---------------------------------------------------------------------------

test("report: aggregates favorite problems count", function () {
  var view = buildLearningReportView(baseInput({
    favoriteProblems: [
      { problemId: "fav-1", title: "Problem A", difficulty: "入门", tags: [], favoritedAt: "2026-06-10T00:00:00.000Z" },
      { problemId: "fav-2", title: "Problem B", difficulty: "基础", tags: [], favoritedAt: "2026-06-09T00:00:00.000Z" },
    ],
  }));
  strictEqual(view.problems.favoriteProblemsCount, 2);
});

// ---------------------------------------------------------------------------
// Today metrics
// ---------------------------------------------------------------------------

test("report: today activity count uses todayStart filter", function () {
  var today = new Date().toISOString();
  var view = buildLearningReportView(baseInput({
    activities: [
      makeActivity({ occurredAt: today }),
      makeActivity({ activityId: "act-2", occurredAt: "2020-01-01T00:00:00.000Z" }),
    ],
  }));
  strictEqual(view.today.activityCount, 1);
});

run();
