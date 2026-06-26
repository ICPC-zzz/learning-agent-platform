/**
 * Tests for UserLearningReportClientHydration — pure function / view model tests.
 *
 * The hydration component relies on browser APIs (localStorage), so this test
 * focuses on the view model integration and data mapping logic.
 *
 * Run: node apps/web/src/app/user/report/user-learning-report-client-hydration.test.mjs
 */

import { buildLearningReportView, learningReportViewIsSafe, LEARNING_STATUS_LABELS } from "./user-learning-report-view-model.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    console.error("FAIL: " + name + " — " + e.message);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || "assertEqual failed") + ": expected " + b + ", got " + a);
}

// ---------------------------------------------------------------------------
// Helper: create sample data (simulates mapped localStorage data)
// ---------------------------------------------------------------------------

function createSampleActivity() {
  return {
    activityId: "act-1",
    activityType: "read-book",
    title: "Sample Reading Activity",
    targetType: "chapter",
    targetId: "c1",
    bookId: "b1",
    chapterId: "c1",
    problemId: null,
    occurredAt: new Date().toISOString(),
    durationSeconds: 600,
  };
}

function createSampleWrongBookEntry() {
  return {
    wrongBookId: "wb-1",
    problemId: "p1",
    title: "Two Sum",
    difficulty: "easy",
    tags: ["array"],
    wrongCount: 3,
    lastWrongAt: new Date().toISOString(),
    reviewStatus: "needs-review",
    notePreview: "Forgot edge case",
    sourceType: "local-fallback",
  };
}

function createSampleAiHistory() {
  return {
    historyId: "ai-1",
    bookId: "b1",
    chapterId: "c1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter 1",
    questionPreview: "What is a closure?",
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("report hydration: empty data produces hasData=false", function () {
  const view = buildLearningReportView({
    activities: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view.hasData, false);
  assertEqual(view.statusTag, "no-data");
  assertEqual(view.statusLabel, LEARNING_STATUS_LABELS["no-data"]);
});

test("report hydration: populated data produces hasData=true", function () {
  const view = buildLearningReportView({
    activities: [createSampleActivity()],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 10, todayDurationMinutes: 10 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [createSampleWrongBookEntry()],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view.hasData, true);
});

test("report hydration: reading session summary is reflected", function () {
  const view = buildLearningReportView({
    activities: [createSampleActivity()],
    readingSessionSummary: { totalSessions: 5, totalDurationMinutes: 120, todayDurationMinutes: 30 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view.reading.totalReadingSessions, 5);
  assertEqual(view.reading.totalReadingMinutes, 120);
  assertEqual(view.today.readingMinutes, 30);
});

test("report hydration: wrong book stats are computed", function () {
  var entries = [
    { wrongBookId: "w1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 3, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    { wrongBookId: "w2", problemId: "p2", title: "Q2", difficulty: "hard", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "reviewed", notePreview: null, sourceType: "local" },
    { wrongBookId: "w3", problemId: "p3", title: "Q3", difficulty: "medium", tags: [], wrongCount: 2, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
  ];
  var view = buildLearningReportView({
    activities: [createSampleActivity()],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 10, todayDurationMinutes: 10 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: entries,
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view.problems.wrongBookTotalCount, 3);
  assertEqual(view.problems.wrongBookNeedsReviewCount, 2);
});

test("report hydration: bookmarks, notes, AI history counted", function () {
  var view = buildLearningReportView({
    activities: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [
      { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", createdAt: new Date().toISOString() },
      { bookId: "b2", chapterId: "c2", bookTitle: "B2", chapterTitle: "C2", createdAt: new Date().toISOString() },
    ],
    notes: [
      { noteId: "n1", bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", noteTextPreview: "test", createdAt: new Date().toISOString() },
    ],
    aiHistory: [
      { historyId: "ai1", bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", questionPreview: "Q?", createdAt: new Date().toISOString() },
      { historyId: "ai2", bookId: "b2", chapterId: "c2", bookTitle: "B2", chapterTitle: "C2", questionPreview: "Q2?", createdAt: new Date().toISOString() },
      { historyId: "ai3", bookId: "b3", chapterId: "c3", bookTitle: "B3", chapterTitle: "C3", questionPreview: "Q3?", createdAt: new Date().toISOString() },
    ],
  });
  assertEqual(view.annotations.bookmarkCount, 2);
  assertEqual(view.annotations.noteCount, 1);
  assertEqual(view.annotations.aiHistoryCount, 3);
});

test("report hydration: safe — no forbidden labels", function () {
  var view = buildLearningReportView({
    activities: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  var safetyCheck = learningReportViewIsSafe(view);
  assert(safetyCheck.safe, "empty view should be safe");
  assertEqual(safetyCheck.violations.length, 0);
});

test("report hydration: status tags are deterministic", function () {
  // Reading active
  var view1 = buildLearningReportView({
    activities: [{ activityId: "a1", activityType: "read-book", title: "Read", targetType: "chapter", targetId: "c1", bookId: "b1", chapterId: "c1", problemId: null, occurredAt: new Date().toISOString(), durationSeconds: 1800 }],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 30, todayDurationMinutes: 30 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view1.statusTag, "reading-active");

  // Wrong book needs review
  var view2 = buildLearningReportView({
    activities: [{ activityId: "a1", activityType: "read-book", title: "Read", targetType: "chapter", targetId: "c1", bookId: "b1", chapterId: "c1", problemId: null, occurredAt: new Date().toISOString(), durationSeconds: 60 }],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 1, todayDurationMinutes: 1 },
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    wrongBookEntries: [{ wrongBookId: "w1", problemId: "p1", title: "Q", difficulty: "easy", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" }],
    bookmarks: [],
    notes: [],
    aiHistory: [],
  });
  assertEqual(view2.statusTag, "wrong-book-needs-review");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("--- user-learning-report-client-hydration.test.mjs ---");
console.log("pass: " + pass);
console.log("fail: " + fail);
if (fail > 0) process.exitCode = 1;
