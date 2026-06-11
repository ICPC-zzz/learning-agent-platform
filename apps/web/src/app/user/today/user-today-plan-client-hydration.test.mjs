/**
 * Tests for UserTodayPlanClientHydration — view model integration tests.
 *
 * Run: node apps/web/src/app/user/today/user-today-plan-client-hydration.test.mjs
 */

import { buildTodayPlanView, todayPlanViewIsSafe } from "./user-today-plan-view-model.ts";

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
// Tests
// ---------------------------------------------------------------------------

test("today hydration: no session produces empty plan", function () {
  var view = buildTodayPlanView({
    hasSession: false,
    wrongBookEntries: [],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assertEqual(view.totalTasks, 0);
  assertEqual(view.tasks.length, 0);
  assert(view.message.includes("请先登录"), "should mention login");
});

test("today hydration: with session and no data produces basic suggestion", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  // With session and no data, generates 1 basic task (开始阅读 15 分钟)
  assert(view.totalTasks >= 1, "should have at least 1 basic suggestion");
  assert(view.tasks[0].title.includes("阅读"), "first task should be reading suggestion");
  assert(view.message.includes("建议") || view.message.includes("规则型"), "should mention rule-based");
});

test("today hydration: wrong book needs-review generates review task", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 3, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.totalTasks > 0);
  assertEqual(view.tasks[0].status, "todo");
  assert(view.tasks[0].title.includes("复习"), "first task should be review");
});

test("today hydration: recent reading generates continue reading task", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [],
    recentReading: [
      { bookId: "b1", chapterId: "c1", bookTitle: "Test Book", chapterTitle: "Chapter 1", progressRatio: 0.5, lastReadAt: new Date().toISOString(), sourceType: "local" },
    ],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 5, todayDurationMinutes: 5 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.totalTasks > 0);
  var readingTask = view.tasks.find(function (t) { return t.title.includes("阅读"); });
  assert(readingTask !== undefined, "should have reading task");
  assertEqual(readingTask.estimatedMinutes, 15);
});

test("today hydration: generates 3-5 tasks with notes and data", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 2, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentReading: [
      { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "Ch1", progressRatio: 0.3, lastReadAt: new Date().toISOString(), sourceType: "local" },
    ],
    readingSessionSummary: { totalSessions: 1, totalDurationMinutes: 10, todayDurationMinutes: 10 },
    recentPractice: [],
    notes: [
      { noteId: "n1", bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "Ch1", noteTextPreview: "Important point", createdAt: new Date().toISOString() },
    ],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.totalTasks >= 3, "should have at least 3 tasks, got " + view.totalTasks);
  assert(view.totalTasks <= 5, "should have at most 5 tasks");
});

test("today hydration: each task has devOnlyLabel", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  for (var i = 0; i < view.tasks.length; i++) {
    assert(view.tasks[i].devOnlyLabel.length > 0, "task " + i + " missing devOnlyLabel");
    assert(view.tasks[i].devOnlyLabel.includes("开发预览"), "task " + i + " should mention 开发预览");
  }
});

test("today hydration: safety check passes", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var safetyCheck = todayPlanViewIsSafe(view);
  assert(safetyCheck.safe, "view should be safe");
  assertEqual(safetyCheck.violations.length, 0);
});

test("today hydration: data source notice is present", function () {
  var view = buildTodayPlanView({
    hasSession: true,
    wrongBookEntries: [],
    recentReading: [],
    readingSessionSummary: { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.dataSourceNotice.includes("规则型"));
  assert(view.dataSourceNotice.includes("未调用 LLM"));
  assert(view.dataSourceNotice.includes("不保存任务到 DB"));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("--- user-today-plan-client-hydration.test.mjs ---");
console.log("pass: " + pass);
console.log("fail: " + fail);
if (fail > 0) process.exitCode = 1;
