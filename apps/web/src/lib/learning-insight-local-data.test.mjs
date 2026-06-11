/**
 * Tests for learning-insight-local-data.ts — unified local data module.
 *
 * Run: node apps/web/src/lib/learning-insight-local-data.test.mjs
 */

import {
  createEmptyUnifiedInput,
  buildReadingSessionSummary,
  buildDashboardLocalInsightStats,
  unifiedInputIsSafe,
  sanitizeUnifiedInput,
  safeTruncate,
} from "./learning-insight-local-data.ts";

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
function assertDeepEqual(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error((msg || "assertDeepEqual failed") + ": expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
  }
}

// ---------------------------------------------------------------------------
// createEmptyUnifiedInput
// ---------------------------------------------------------------------------

test("createEmptyUnifiedInput returns all empty arrays", function () {
  const input = createEmptyUnifiedInput(true);
  assert(input.hasSession === true, "hasSession should be true");
  assert(Array.isArray(input.readingSessions), "readingSessions should be array");
  assertEqual(input.readingSessions.length, 0, "readingSessions should be empty");
  assertEqual(input.learningActivities.length, 0);
  assertEqual(input.wrongBookEntries.length, 0);
  assertEqual(input.recentReading.length, 0);
  assertEqual(input.recentPractice.length, 0);
  assertEqual(input.favoriteProblems.length, 0);
  assertEqual(input.bookmarks.length, 0);
  assertEqual(input.notes.length, 0);
  assertEqual(input.aiHistory.length, 0);
});

test("createEmptyUnifiedInput with no session", function () {
  const input = createEmptyUnifiedInput(false);
  assert(input.hasSession === false);
});

// ---------------------------------------------------------------------------
// buildReadingSessionSummary
// ---------------------------------------------------------------------------

test("buildReadingSessionSummary with empty data returns zeros", function () {
  const input = createEmptyUnifiedInput(true);
  const summary = buildReadingSessionSummary(input);
  assertEqual(summary.totalSessions, 0);
  assertEqual(summary.totalDurationMinutes, 0);
  assertEqual(summary.todayDurationMinutes, 0);
});

test("buildReadingSessionSummary with multiple sessions computes correctly", function () {
  const input = createEmptyUnifiedInput(true);
  input.readingSessions = [
    { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", durationSeconds: 120, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 0.5 },
    { bookId: "b2", chapterId: "c2", bookTitle: "B2", chapterTitle: "C2", durationSeconds: 180, startedAt: "2020-01-01T00:00:00.000Z", endedAt: null, progressRatio: 1.0 },
  ];
  const summary = buildReadingSessionSummary(input);
  assertEqual(summary.totalSessions, 2);
  assertEqual(summary.totalDurationMinutes, 5); // 120+180=300sec = 5min
  assertEqual(summary.todayDurationMinutes, 2); // only the first one is today
});

test("buildReadingSessionSummary handles negative duration gracefully", function () {
  const input = createEmptyUnifiedInput(true);
  input.readingSessions = [
    { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", durationSeconds: -50, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 0.5 },
  ];
  const summary = buildReadingSessionSummary(input);
  assertEqual(summary.totalDurationMinutes, 0);
});

// ---------------------------------------------------------------------------
// buildDashboardLocalInsightStats
// ---------------------------------------------------------------------------

test("buildDashboardLocalInsightStats with empty data returns zeros", function () {
  const input = createEmptyUnifiedInput(true);
  const stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.todayTaskCount, 0);
  assertEqual(stats.reviewRecommendationCount, 0);
  assertEqual(stats.localActivityCount, 0);
  assertEqual(stats.localReadingMinutes, 0);
  assertEqual(stats.wrongBookNeedsReviewCount, 0);
});

test("buildDashboardLocalInsightStats counts today activities", function () {
  const input = createEmptyUnifiedInput(true);
  input.learningActivities = [
    { activityId: "a1", activityType: "read-book", title: "Reading", targetType: "chapter", targetId: "c1", bookId: null, chapterId: null, problemId: null, occurredAt: new Date().toISOString(), durationSeconds: null },
    { activityId: "a2", activityType: "practice-problem", title: "Practice", targetType: "problem", targetId: "p1", bookId: null, chapterId: null, problemId: null, occurredAt: "2020-01-01T00:00:00.000Z", durationSeconds: null },
  ];
  const stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.todayTaskCount, 1);
  assertEqual(stats.localActivityCount, 2);
});

test("buildDashboardLocalInsightStats counts wrong book needs-review", function () {
  const input = createEmptyUnifiedInput(true);
  input.wrongBookEntries = [
    { wrongBookId: "w1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 3, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    { wrongBookId: "w2", problemId: "p2", title: "Q2", difficulty: "hard", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "reviewed", notePreview: null, sourceType: "local" },
    { wrongBookId: "w3", problemId: "p3", title: "Q3", difficulty: "medium", tags: [], wrongCount: 2, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
  ];
  const stats = buildDashboardLocalInsightStats(input);
  assertEqual(stats.wrongBookNeedsReviewCount, 2);
  assert(stats.reviewRecommendationCount >= 2, "should include needs-review in recommendation count");
});

// ---------------------------------------------------------------------------
// unifiedInputIsSafe
// ---------------------------------------------------------------------------

test("unifiedInputIsSafe with empty input is safe", function () {
  const input = createEmptyUnifiedInput(true);
  const result = unifiedInputIsSafe(input);
  assert(result.safe, "empty input should be safe");
  assertEqual(result.violations.length, 0);
});

test("unifiedInputIsSafe detects sensitive fields", function () {
  const input = createEmptyUnifiedInput(true);
  // Add a field that would contain raw prompt — simulate via readingSessions
  input.readingSessions = [
    { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", durationSeconds: 60, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 0.5, raw_prompt: "secret" },
  ];
  const result = unifiedInputIsSafe(input);
  assert(!result.safe, "should detect sensitive field raw_prompt");
  assert(result.violations.length > 0);
});

test("unifiedInputIsSafe detects forbidden labels", function () {
  const input = createEmptyUnifiedInput(true);
  // inject a forbidden label into a safe string field
  input.learningActivities = [
    { activityId: "a1", activityType: "read-book", title: "AI 已自动规划 report", targetType: "chapter", targetId: "c1", bookId: null, chapterId: null, problemId: null, occurredAt: new Date().toISOString(), durationSeconds: null },
  ];
  const result = unifiedInputIsSafe(input);
  assert(!result.safe, "should detect forbidden label");
});

// ---------------------------------------------------------------------------
// sanitizeUnifiedInput
// ---------------------------------------------------------------------------

test("sanitizeUnifiedInput with null returns empty input", function () {
  const result = sanitizeUnifiedInput(null);
  assertEqual(result.hasSession, false);
  assertEqual(result.readingSessions.length, 0);
});

test("sanitizeUnifiedInput with non-object returns empty input", function () {
  const result = sanitizeUnifiedInput("not an object");
  assertEqual(result.hasSession, false);
});

test("sanitizeUnifiedInput with valid data preserves arrays", function () {
  const raw = {
    readingSessions: [
      { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", durationSeconds: 60, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 0.5 },
    ],
    learningActivities: [
      { activityId: "a1", activityType: "read-book", title: "Safe", targetType: "chapter", targetId: "c1", bookId: null, chapterId: null, problemId: null, occurredAt: new Date().toISOString(), durationSeconds: null },
    ],
    wrongBookEntries: [],
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    hasSession: true,
  };
  const result = sanitizeUnifiedInput(raw);
  assertEqual(result.hasSession, true);
  assertEqual(result.readingSessions.length, 1);
  assertEqual(result.learningActivities.length, 1);
});

test("sanitizeUnifiedInput filters non-array fields", function () {
  const raw = {
    readingSessions: "not an array",
    learningActivities: null,
    wrongBookEntries: undefined,
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    hasSession: true,
  };
  const result = sanitizeUnifiedInput(raw);
  assertEqual(result.readingSessions.length, 0, "non-array should be emptied");
  assertEqual(result.learningActivities.length, 0);
});

test("sanitizeUnifiedInput filters sensitive data in arrays", function () {
  const raw = {
    readingSessions: [{ DATABASE_URL: "secret", bookId: "b1" }],
    learningActivities: [],
    wrongBookEntries: [],
    recentReading: [],
    recentPractice: [],
    favoriteProblems: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    hasSession: false,
  };
  const result = sanitizeUnifiedInput(raw);
  assertEqual(result.readingSessions.length, 0, "array with sensitive data should be emptied");
});

// ---------------------------------------------------------------------------
// safeTruncate
// ---------------------------------------------------------------------------

test("safeTruncate returns empty for non-string", function () {
  assertEqual(safeTruncate(null, 10), "");
  assertEqual(safeTruncate(123, 10), "");
  assertEqual(safeTruncate(undefined, 10), "");
});

test("safeTruncate truncates correctly", function () {
  assertEqual(safeTruncate("hello world", 5), "hello");
  assertEqual(safeTruncate("hi", 10), "hi");
  assertEqual(safeTruncate("  trimmed  ", 8), "trimmed");
});

// ---------------------------------------------------------------------------
// Integration: full pipeline
// ---------------------------------------------------------------------------

test("full pipeline: empty input produces safe stats", function () {
  const input = createEmptyUnifiedInput(true);
  const stats = buildDashboardLocalInsightStats(input);
  const safetyCheck = unifiedInputIsSafe(input);
  assert(safetyCheck.safe);
  assertEqual(stats.localActivityCount, 0);
  assertEqual(stats.localReadingMinutes, 0);
  assertEqual(stats.wrongBookNeedsReviewCount, 0);
});

test("full pipeline: populated input produces correct stats and is safe", function () {
  const input = createEmptyUnifiedInput(true);
  input.readingSessions = [
    { bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "Ch1", durationSeconds: 900, startedAt: new Date().toISOString(), endedAt: null, progressRatio: 0.8 },
  ];
  input.wrongBookEntries = [
    { wrongBookId: "w1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 5, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
  ];
  const stats = buildDashboardLocalInsightStats(input);
  const safetyCheck = unifiedInputIsSafe(input);
  assert(safetyCheck.safe, "safe input should pass safety check");
  assertEqual(stats.localReadingMinutes, 15, "900sec = 15min");
  assertEqual(stats.wrongBookNeedsReviewCount, 1);
  assert(stats.reviewRecommendationCount >= 1);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("--- learning-insight-local-data.test.mjs ---");
console.log("pass: " + pass);
console.log("fail: " + fail);
if (fail > 0) process.exitCode = 1;
