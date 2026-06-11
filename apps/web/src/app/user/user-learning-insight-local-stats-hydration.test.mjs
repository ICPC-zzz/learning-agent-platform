/**
 * Tests for UserLearningInsightLocalStatsHydration — pure function tests.
 *
 * Tests the buildDashboardLocalInsightStats function and the unified input
 * data pipeline, without relying on browser APIs.
 *
 * Run: node apps/web/src/app/user/user-learning-insight-local-stats-hydration.test.mjs
 */

import { buildDashboardLocalInsightStats, createEmptyUnifiedInput, unifiedInputIsSafe, sanitizeUnifiedInput } from "../../lib/learning-insight-local-data.ts";

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

test("local stats hydration: empty input produces all zeros", function () {
  var input = createEmptyUnifiedInput(true);
  var stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.todayTaskCount, 0);
  assertEqual(stats.reviewRecommendationCount, 0);
  assertEqual(stats.localActivityCount, 0);
  assertEqual(stats.localReadingMinutes, 0);
  assertEqual(stats.wrongBookNeedsReviewCount, 0);
});

test("local stats hydration: today activities are counted correctly", function () {
  var input = createEmptyUnifiedInput(true);
  input.learningActivities = [
    { activityId: "a1", activityType: "read-book", title: "Read", targetType: "chapter", targetId: "c1", bookId: null, chapterId: null, problemId: null, occurredAt: new Date().toISOString(), durationSeconds: null },
    { activityId: "a2", activityType: "practice-problem", title: "Practice", targetType: "problem", targetId: "p1", bookId: null, chapterId: null, problemId: null, occurredAt: new Date().toISOString(), durationSeconds: null },
    { activityId: "a3", activityType: "read-book", title: "Old", targetType: "chapter", targetId: "c2", bookId: null, chapterId: null, problemId: null, occurredAt: "2020-01-01T00:00:00.000Z", durationSeconds: null },
  ];
  var stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.todayTaskCount, 2);
  assertEqual(stats.localActivityCount, 3);
});

test("local stats hydration: wrong book stats computed correctly", function () {
  var input = createEmptyUnifiedInput(true);
  input.wrongBookEntries = [
    { wrongBookId: "w1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 5, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    { wrongBookId: "w2", problemId: "p2", title: "Q2", difficulty: "hard", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "reviewed", notePreview: null, sourceType: "local" },
    { wrongBookId: "w3", problemId: "p3", title: "Q3", difficulty: "medium", tags: [], wrongCount: 2, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    { wrongBookId: "w4", problemId: "p4", title: "Q4", difficulty: "easy", tags: [], wrongCount: 0, lastWrongAt: new Date().toISOString(), reviewStatus: "mastered", notePreview: null, sourceType: "local" },
  ];
  var stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.wrongBookNeedsReviewCount, 2);
  assert(stats.reviewRecommendationCount >= 2);
});

test("local stats hydration: reading minutes computed correctly", function () {
  var input = createEmptyUnifiedInput(true);
  input.readingSessions = [
    { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", durationSeconds: 1800, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 1.0 },
    { bookId: "b2", chapterId: "c2", bookTitle: "B2", chapterTitle: "C2", durationSeconds: 300, startedAt: "2020-01-01T00:00:00.000Z", endedAt: null, progressRatio: 0.5 },
  ];
  var stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.localReadingMinutes, 35); // 1800+300=2100sec = 35min
});

test("local stats hydration: review count includes practice needs-review", function () {
  var input = createEmptyUnifiedInput(true);
  input.recentPractice = [
    { problemId: "p1", title: "Q1", difficulty: "easy", status: "needs-review", updatedAt: new Date().toISOString() },
    { problemId: "p2", title: "Q2", difficulty: "medium", status: "needs-review", updatedAt: new Date().toISOString() },
    { problemId: "p3", title: "Q3", difficulty: "hard", status: "completed", updatedAt: new Date().toISOString() },
  ];
  var stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.reviewRecommendationCount, 2);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("--- user-learning-insight-local-stats-hydration.test.mjs ---");
console.log("pass: " + pass);
console.log("fail: " + fail);
if (fail > 0) process.exitCode = 1;
