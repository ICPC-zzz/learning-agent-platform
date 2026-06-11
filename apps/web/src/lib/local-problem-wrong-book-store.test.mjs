import assert from "node:assert/strict";
import test from "node:test";

const MOD_URL = new URL("./local-problem-wrong-book-store.ts", import.meta.url).href;
const mod = await import(MOD_URL);
const {
  isValidWrongBookEntry, isValidReviewStatus, normalizeNotePreview, hasDangerousFields,
  isProblemInWrongBook, findWrongBookEntryByProblemId, addProblemToWrongBook,
  recordProblemWrong, removeProblemFromWrongBook, updateWrongBookReviewStatus,
  updateWrongBookNote, getNeedsReviewCount, getWrongBookCount,
  getMostRecentWrongAt, getWrongBookEntries,
} = mod;

function makeEntry(overrides = {}) {
  return {
    wrongBookId: "wb-001", problemId: "p-001", title: "Two Sum", difficulty: "easy",
    tags: ["array", "hash"], wrongCount: 3, lastWrongAt: "2025-06-01T00:00:00.000Z",
    reviewStatus: "needs-review", notePreview: "forgot edge case", sourceType: "local-fallback",
    createdAt: "2025-06-01T00:00:00.000Z", updatedAt: "2025-06-01T00:00:00.000Z",
    ...overrides,
  };
}

test("entry validation", () => {
  const valid = makeEntry();
  assert.ok(isValidWrongBookEntry(valid));
  assert.ok(!isValidWrongBookEntry(null));
  assert.ok(!isValidWrongBookEntry({}));
  assert.ok(!isValidWrongBookEntry({ ...valid, wrongBookId: "" }));
  assert.ok(!isValidWrongBookEntry({ ...valid, wrongCount: -1 }));
  assert.ok(!isValidWrongBookEntry({ ...valid, reviewStatus: "invalid" }));
  assert.ok(!isValidWrongBookEntry({ ...valid, notePreview: "x".repeat(301) }));
  assert.ok(isValidWrongBookEntry({ ...valid, notePreview: null }));
  assert.ok(!isValidWrongBookEntry({ ...valid, token: "abc" }));
});

test("reviewStatus validation", () => {
  assert.ok(isValidReviewStatus("needs-review"));
  assert.ok(isValidReviewStatus("reviewed"));
  assert.ok(isValidReviewStatus("mastered"));
  assert.ok(!isValidReviewStatus(""));
  assert.ok(!isValidReviewStatus(null));
});

test("notePreview normalization", () => {
  assert.equal(normalizeNotePreview(null), null);
  assert.equal(normalizeNotePreview(""), null);
  assert.equal(normalizeNotePreview("simple"), "simple");
  assert.equal(normalizeNotePreview("x".repeat(500)), "x".repeat(300));
});

test("dangerous field detection", () => {
  assert.ok(!hasDangerousFields(null));
  assert.ok(hasDangerousFields({ token: "abc" }));
  assert.ok(hasDangerousFields({ secret: "key" }));
  assert.ok(hasDangerousFields({ userSubmittedCode: "code" }));
});

test("isProblemInWrongBook", () => {
  const entries = [makeEntry({ problemId: "p1" })];
  assert.ok(isProblemInWrongBook(entries, "p1"));
  assert.ok(!isProblemInWrongBook(entries, "p2"));
  assert.ok(!isProblemInWrongBook([], "p1"));
});

test("addProblemToWrongBook idempotent", () => {
  const e1 = makeEntry({ problemId: "p1" });
  const after = addProblemToWrongBook([], e1);
  assert.equal(after.length, 1);
  const after2 = addProblemToWrongBook(after, e1);
  assert.equal(after2.length, 1);
});

test("recordProblemWrong", async () => {
  const r1 = recordProblemWrong([], "p1", "Two Sum", "easy", ["array"]);
  assert.equal(r1.entries.length, 1);
  assert.equal(r1.entry.wrongCount, 1);
  assert.equal(r1.entry.reviewStatus, "needs-review");
  await new Promise((resolve) => setTimeout(resolve, 2));
  const r2 = recordProblemWrong(r1.entries, "p1", "Two Sum", "easy", ["array"]);
  assert.equal(r2.entry.wrongCount, 2);
  assert.ok(r2.entry.lastWrongAt > r1.entry.lastWrongAt);
});

test("remove missing safe", () => {
  const e1 = makeEntry({ problemId: "p1" });
  assert.equal(removeProblemFromWrongBook([e1], "p-nonexistent").length, 1);
  assert.equal(removeProblemFromWrongBook([], "p1").length, 0);
});

test("update review status", () => {
  const e1 = makeEntry({ reviewStatus: "needs-review" });
  assert.equal(updateWrongBookReviewStatus([e1], "p-001", "reviewed")[0].reviewStatus, "reviewed");
  assert.equal(updateWrongBookReviewStatus([e1], "p-001", "mastered")[0].reviewStatus, "mastered");
});

test("update wrong book note", () => {
  const e1 = makeEntry({ notePreview: null });
  assert.equal(updateWrongBookNote([e1], "p-001", "edge case")[0].notePreview, "edge case");
  assert.equal(updateWrongBookNote([e1], "p-001", "x".repeat(500))[0].notePreview.length, 300);
  assert.equal(updateWrongBookNote([e1], "p-001", null)[0].notePreview, null);
});

test("count functions", () => {
  assert.equal(getWrongBookCount([]), 0);
  const entries = [
    makeEntry({ problemId: "p1", reviewStatus: "needs-review" }),
    makeEntry({ problemId: "p2", reviewStatus: "reviewed", wrongBookId: "2" }),
  ];
  assert.equal(getWrongBookCount(entries), 2);
  assert.equal(getNeedsReviewCount(entries), 1);
});

test("getMostRecentWrongAt", () => {
  assert.equal(getMostRecentWrongAt([]), null);
  const entries = [
    makeEntry({ problemId: "p1", lastWrongAt: "2025-01-01T00:00:00Z" }),
    makeEntry({ problemId: "p2", lastWrongAt: "2025-06-01T00:00:00Z", wrongBookId: "2" }),
  ];
  assert.equal(getMostRecentWrongAt(entries), "2025-06-01T00:00:00Z");
});

test("findWrongBookEntryByProblemId", () => {
  const entries = [makeEntry({ problemId: "p1" })];
  assert.ok(findWrongBookEntryByProblemId(entries, "p1") !== null);
  assert.equal(findWrongBookEntryByProblemId([], "p1"), null);
});

test("JSON parse safety", () => {
  assert.ok(!isValidWrongBookEntry(undefined));
  assert.ok(!isValidWrongBookEntry("string"));
  assert.ok(!isValidWrongBookEntry(123));
});

test("no user submitted code", () => {
  assert.ok(!isValidWrongBookEntry({ ...makeEntry(), userSubmittedCode: "code" }));
  assert.ok(!isValidWrongBookEntry({ ...makeEntry(), submittedCode: "code" }));
});
