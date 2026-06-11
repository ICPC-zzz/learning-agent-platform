/**
 * local-learning-activity-store tests — localStorage learning activity & reading session store.
 *
 * Run: node apps/web/src/lib/local-learning-activity-store.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";

const STORE_URL = new URL("./local-learning-activity-store.ts", import.meta.url).href;
const mod = await import(STORE_URL);
const {
  isValidLocalLearningActivity,
  isValidLocalReadingSession,
  loadLearningActivities,
  persistLearningActivities,
  addLearningActivity,
  getRecentLearningActivities,
  countTodayLearningActivities,
  countTotalLearningActivities,
  loadReadingSessions,
  persistReadingSessions,
  addReadingSession,
  endReadingSession,
  summarizeReadingSessions,
  todayReadingDurationSeconds,
  generateLearningActivityId,
  generateReadingSessionId,
  hasSensitiveFields,
  hasForbiddenLabels,
} = mod;

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
    removeItem: (key) => { storage.delete(key); },
  },
};

function resetStorage() {
  storage.clear();
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const validActivity = {
  activityId: "act-test-001",
  activityType: "read-book",
  title: "Test Book Reading",
  targetType: "chapter",
  targetId: "chapter-1",
  bookId: "book-1",
  chapterId: "chapter-1",
  problemId: null,
  sourceType: "builtin",
  occurredAt: new Date().toISOString(),
  durationSeconds: 300,
  metadataPreview: "Read chapter 1",
};

const validSession = {
  sessionId: "rs-test-001",
  bookId: "book-1",
  chapterId: "chapter-1",
  bookTitle: "Test Book",
  chapterTitle: "Chapter 1",
  startedAt: new Date().toISOString(),
  endedAt: null,
  durationSeconds: 600,
  progressRatio: 0.5,
  sourceType: "builtin",
};

// ---------------------------------------------------------------------------
// Tests: Validation
// ---------------------------------------------------------------------------

test("valid learning activity passes validation", () => {
  assert.ok(isValidLocalLearningActivity(validActivity));
});

test("valid reading session passes validation", () => {
  assert.ok(isValidLocalReadingSession(validSession));
});

test("invalid activityType rejected", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, activityType: "invalid-type" }));
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, activityType: "" }));
});

test("invalid targetType rejected", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, targetType: "invalid" }));
});

test("empty required fields rejected", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, activityId: "" }));
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, sourceType: "" }));
  assert.ok(!isValidLocalReadingSession({ ...validSession, bookId: "" }));
});

test("duration bounds for learning activities", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, durationSeconds: -1 }));
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, durationSeconds: 28801 }));
  assert.ok(isValidLocalLearningActivity({ ...validActivity, durationSeconds: null }));
  assert.ok(isValidLocalLearningActivity({ ...validActivity, durationSeconds: 28800 }));
});

test("duration bounds for reading sessions", () => {
  assert.ok(!isValidLocalReadingSession({ ...validSession, durationSeconds: -1 }));
  assert.ok(!isValidLocalReadingSession({ ...validSession, durationSeconds: 28801 }));
  assert.ok(isValidLocalReadingSession({ ...validSession, durationSeconds: 0 }));
});

test("progressRatio bounds", () => {
  assert.ok(isValidLocalReadingSession({ ...validSession, progressRatio: 0 }));
  assert.ok(isValidLocalReadingSession({ ...validSession, progressRatio: 1 }));
  assert.ok(!isValidLocalReadingSession({ ...validSession, progressRatio: -0.1 }));
  assert.ok(!isValidLocalReadingSession({ ...validSession, progressRatio: 1.1 }));
});

test("over-long title rejected", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, title: "x".repeat(301) }));
});

test("sensitive fields rejected in activity", () => {
  assert.ok(!isValidLocalLearningActivity({ ...validActivity, metadataPreview: "token=abc" }));
});

test("sensitive fields rejected in session", () => {
  assert.ok(!isValidLocalReadingSession({ ...validSession, bookTitle: "DATABASE_URL=postgres" }));
});

// ---------------------------------------------------------------------------
// Tests: Activities localStorage CRUD
// ---------------------------------------------------------------------------

test("load activities on empty storage returns empty array", () => {
  resetStorage();
  const activities = loadLearningActivities();
  assert.deepStrictEqual(activities, []);
});

test("persist and load activities", () => {
  resetStorage();
  persistLearningActivities([validActivity]);
  const activities = loadLearningActivities();
  assert.strictEqual(activities.length, 1);
  assert.strictEqual(activities[0].activityId, "act-test-001");
});

test("add activity increases count and prepends", () => {
  resetStorage();
  persistLearningActivities([validActivity]);
  let activities = loadLearningActivities();
  activities = addLearningActivity(activities, { ...validActivity, activityId: "act-test-002", activityType: "practice-problem" });
  assert.strictEqual(activities.length, 2);
  assert.strictEqual(activities[0].activityId, "act-test-002");
});

test("filter by activityType", () => {
  resetStorage();
  const a1 = { ...validActivity };
  const a2 = { ...validActivity, activityId: "act-test-002", activityType: "practice-problem" };
  persistLearningActivities([a1, a2]);
  let activities = loadLearningActivities();
  const filtered = getRecentLearningActivities(activities, 10, "practice-problem");
  assert.strictEqual(filtered.length, 1);
});

test("total count function", () => {
  resetStorage();
  persistLearningActivities([validActivity, { ...validActivity, activityId: "a2" }]);
  const activities = loadLearningActivities();
  assert.strictEqual(countTotalLearningActivities(activities), 2);
});

test("today count is non-negative", () => {
  resetStorage();
  persistLearningActivities([validActivity]);
  const activities = loadLearningActivities();
  assert.ok(countTodayLearningActivities(activities) >= 0);
});

// ---------------------------------------------------------------------------
// Tests: JSON corruption safe fallback
// ---------------------------------------------------------------------------

test("corrupted JSON returns empty array for activities", () => {
  resetStorage();
  storage.set("lap.web.user.learningActivities", "not valid json");
  const activities = loadLearningActivities();
  assert.deepStrictEqual(activities, []);
});

test("non-array value returns empty array for activities", () => {
  resetStorage();
  storage.set("lap.web.user.learningActivities", '{"not": "array"}');
  const activities = loadLearningActivities();
  assert.deepStrictEqual(activities, []);
});

test("invalid entries filtered out from mixed array", () => {
  resetStorage();
  storage.set("lap.web.user.learningActivities", JSON.stringify([{ invalid: true }, validActivity]));
  const activities = loadLearningActivities();
  assert.strictEqual(activities.length, 1);
  assert.strictEqual(activities[0].activityId, "act-test-001");
});

// ---------------------------------------------------------------------------
// Tests: Reading Sessions localStorage CRUD
// ---------------------------------------------------------------------------

test("load sessions on empty storage returns empty array", () => {
  resetStorage();
  const sessions = loadReadingSessions();
  assert.deepStrictEqual(sessions, []);
});

test("persist and load sessions", () => {
  resetStorage();
  persistReadingSessions([validSession]);
  const sessions = loadReadingSessions();
  assert.strictEqual(sessions.length, 1);
});

test("add session increases count and prepends", () => {
  resetStorage();
  persistReadingSessions([validSession]);
  let sessions = loadReadingSessions();
  sessions = addReadingSession(sessions, { ...validSession, sessionId: "rs-test-002" });
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].sessionId, "rs-test-002");
});

test("end session sets endedAt and updates duration", () => {
  resetStorage();
  persistReadingSessions([validSession]);
  let sessions = loadReadingSessions();
  sessions = endReadingSession(sessions, "rs-test-001", new Date().toISOString(), 900);
  const ended = sessions.find((s) => s.sessionId === "rs-test-001");
  assert.ok(ended !== undefined);
  assert.ok(ended.endedAt !== null);
  assert.strictEqual(ended.durationSeconds, 900);
});

test("end session auto-computes duration from start time", () => {
  resetStorage();
  const pastTime = new Date(Date.now() - 600000).toISOString();
  persistReadingSessions([{ ...validSession, sessionId: "rs-test-003", startedAt: pastTime, durationSeconds: 0 }]);
  let sessions = loadReadingSessions();
  sessions = endReadingSession(sessions, "rs-test-003", new Date().toISOString());
  const autoEnded = sessions.find((s) => s.sessionId === "rs-test-003");
  assert.ok(autoEnded.durationSeconds > 0);
});

test("summarize sessions returns totals", () => {
  resetStorage();
  persistReadingSessions([
    { ...validSession, durationSeconds: 300 },
    { ...validSession, sessionId: "rs-2", durationSeconds: 600 },
  ]);
  const sessions = loadReadingSessions();
  const summary = summarizeReadingSessions(sessions);
  assert.ok(summary.totalSessions > 0);
  assert.ok(summary.totalDurationSeconds >= 900);
});

test("today reading duration is non-negative", () => {
  resetStorage();
  persistReadingSessions([validSession]);
  const sessions = loadReadingSessions();
  assert.ok(todayReadingDurationSeconds(sessions) >= 0);
});

test("corrupted JSON returns empty for sessions", () => {
  resetStorage();
  storage.set("lap.web.user.readingSessions", "corrupted{{{");
  const sessions = loadReadingSessions();
  assert.deepStrictEqual(sessions, []);
});

// ---------------------------------------------------------------------------
// Tests: ID generation
// ---------------------------------------------------------------------------

test("activity IDs are unique", () => {
  const id1 = generateLearningActivityId();
  const id2 = generateLearningActivityId();
  assert.ok(typeof id1 === "string" && id1.length > 0);
  assert.ok(id1 !== id2);
});

test("session IDs are unique", () => {
  const id1 = generateReadingSessionId();
  const id2 = generateReadingSessionId();
  assert.ok(id1 !== id2);
});

// ---------------------------------------------------------------------------
// Tests: Sensitive fields
// ---------------------------------------------------------------------------

test("hasSensitiveFields detects token", () => {
  assert.ok(hasSensitiveFields({ token: "abc" }));
});

test("hasSensitiveFields detects DATABASE_URL", () => {
  assert.ok(hasSensitiveFields({ DATABASE_URL: "postgres" }));
});

test("hasSensitiveFields detects apiKey", () => {
  assert.ok(hasSensitiveFields({ apiKey: "key" }));
});

test("hasSensitiveFields ignores safe data", () => {
  assert.ok(!hasSensitiveFields({ title: "nice book" }));
});

test("hasSensitiveFields handles null", () => {
  assert.ok(!hasSensitiveFields(null));
});

// ---------------------------------------------------------------------------
// Tests: Forbidden labels
// ---------------------------------------------------------------------------

test("hasForbiddenLabels detects prohibited labels", () => {
  assert.ok(hasForbiddenLabels("云端同步成功"));
  assert.ok(hasForbiddenLabels("生产学习记录已保存"));
  assert.ok(hasForbiddenLabels("真实学习系统已完成"));
  assert.ok(hasForbiddenLabels("真实判题已接入"));
});

test("hasForbiddenLabels ignores safe text", () => {
  assert.ok(!hasForbiddenLabels("开发预览"));
});

// ---------------------------------------------------------------------------
// Tests: No fullChapterContent/rawText saved
// ---------------------------------------------------------------------------

test("fullChapterContent rejected as sensitive", () => {
  assert.ok(hasSensitiveFields({ fullChapterContent: "text" }));
});

test("rawText rejected as sensitive", () => {
  assert.ok(hasSensitiveFields({ rawText: "text" }));
});
