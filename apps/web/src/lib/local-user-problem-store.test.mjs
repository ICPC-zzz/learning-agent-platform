import assert from "node:assert/strict";
import test from "node:test";

const MOD_URL = new URL("./local-user-problem-store.ts", import.meta.url).href;
const mod = await import(MOD_URL);
const {
  isFavoriteProblem,
  addFavoriteProblem,
  removeFavoriteProblem,
  addRecentPractice,
  updateRecentPracticeStatus,
  getRecentPractice,
  isValidFavoriteProblemEntry,
  isValidRecentPracticeEntry,
  isValidPracticeStatus,
  hasSensitiveFields,
} = mod;

function makeFavEntry(overrides = {}) {
  return {
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "easy",
    tags: ["array"],
    favoritedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePracticeEntry(overrides = {}) {
  return {
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "medium",
    status: "practiced",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- isFavoriteProblem ----

test("empty favorites has isFavoriteProblem=false", () => {
  assert.equal(isFavoriteProblem([], "any"), false);
});

test("isFavoriteProblem matches problemId", () => {
  assert.equal(isFavoriteProblem([makeFavEntry({ problemId: "p1" })], "p1"), true);
  assert.equal(isFavoriteProblem([makeFavEntry({ problemId: "p1" })], "p2"), false);
});

// ---- addFavoriteProblem ----

test("addFavoriteProblem adds new entry", () => {
  const updated = addFavoriteProblem([], makeFavEntry({ problemId: "p1" }));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].problemId, "p1");
});

test("addFavoriteProblem is idempotent", () => {
  const first = addFavoriteProblem([], makeFavEntry({ problemId: "p1" }));
  const second = addFavoriteProblem(first, makeFavEntry({ problemId: "p1", title: "Changed" }));
  assert.equal(second.length, 1);
  assert.equal(second[0].title, "Test Problem"); // unchanged
});

test("addFavoriteProblem prepends to list", () => {
  const first = addFavoriteProblem([], makeFavEntry({ problemId: "p1" }));
  const second = addFavoriteProblem(first, makeFavEntry({ problemId: "p2" }));
  assert.equal(second.length, 2);
  assert.equal(second[0].problemId, "p2");
  assert.equal(second[1].problemId, "p1");
});

// ---- removeFavoriteProblem ----

test("removeFavoriteProblem removes existing entry", () => {
  const withEntry = [makeFavEntry({ problemId: "p1" })];
  assert.equal(removeFavoriteProblem(withEntry, "p1").length, 0);
});

test("removeFavoriteProblem is idempotent for missing entry", () => {
  assert.equal(removeFavoriteProblem([], "p1").length, 0);
});

// ---- addRecentPractice ----

test("addRecentPractice adds new entry", () => {
  const updated = addRecentPractice([], makePracticeEntry({ problemId: "p1" }));
  assert.equal(updated.length, 1);
  assert.equal(updated[0].problemId, "p1");
});

test("addRecentPractice replaces existing entry for same problemId", () => {
  const first = addRecentPractice([], makePracticeEntry({ problemId: "p1", status: "practiced" }));
  const second = addRecentPractice(first, makePracticeEntry({ problemId: "p1", status: "completed" }));
  assert.equal(second.length, 1);
  assert.equal(second[0].status, "completed");
});

test("addRecentPractice moves updated entry to front", () => {
  let list = addRecentPractice([], makePracticeEntry({ problemId: "p1" }));
  list = addRecentPractice(list, makePracticeEntry({ problemId: "p2" }));
  list = addRecentPractice(list, makePracticeEntry({ problemId: "p1", status: "completed" }));
  assert.equal(list.length, 2);
  assert.equal(list[0].problemId, "p1");
  assert.equal(list[0].status, "completed");
});

// ---- updateRecentPracticeStatus ----

test("updateRecentPracticeStatus changes status", () => {
  const list = [makePracticeEntry({ problemId: "p1", status: "practiced" })];
  const updated = updateRecentPracticeStatus(list, "p1", "completed");
  assert.equal(updated[0].status, "completed");
});

test("updateRecentPracticeStatus does nothing for missing problemId", () => {
  const list = [makePracticeEntry({ problemId: "p1" })];
  const updated = updateRecentPracticeStatus(list, "p2", "completed");
  assert.equal(updated.length, 1);
  assert.equal(updated[0].status, "practiced");
});

// ---- getRecentPractice ----

test("getRecentPractice respects limit", () => {
  const entries = [makePracticeEntry({ problemId: "p1" }), makePracticeEntry({ problemId: "p2" }), makePracticeEntry({ problemId: "p3" })];
  assert.equal(getRecentPractice(entries, 2).length, 2);
});

test("getRecentPractice default limit is 20", () => {
  const entries = Array.from({ length: 30 }, (_, i) => makePracticeEntry({ problemId: `p-${i}` }));
  assert.equal(getRecentPractice(entries).length, 20);
});

// ---- isValidPracticeStatus ----

test("isValidPracticeStatus validates status values", () => {
  assert.ok(isValidPracticeStatus("not-started"));
  assert.ok(isValidPracticeStatus("practiced"));
  assert.ok(isValidPracticeStatus("completed"));
  assert.ok(isValidPracticeStatus("needs-review"));
  assert.ok(!isValidPracticeStatus("invalid"));
  assert.ok(!isValidPracticeStatus(""));
  assert.ok(!isValidPracticeStatus(null));
});

// ---- isValidFavoriteProblemEntry ----

test("isValidFavoriteProblemEntry validates correct entry", () => {
  const entry = makeFavEntry();
  assert.ok(isValidFavoriteProblemEntry(entry));
});

test("isValidFavoriteProblemEntry rejects missing fields", () => {
  assert.ok(!isValidFavoriteProblemEntry(null));
  assert.ok(!isValidFavoriteProblemEntry({}));
  assert.ok(!isValidFavoriteProblemEntry({ problemId: "p1" }));
  assert.ok(!isValidFavoriteProblemEntry({ problemId: "p1", title: "T" }));
  assert.ok(!isValidFavoriteProblemEntry({ problemId: "p1", title: "T", difficulty: "easy" }));
  assert.ok(!isValidFavoriteProblemEntry({ problemId: "p1", title: "T", difficulty: "easy", tags: [] }));
  // missing favoritedAt
  assert.ok(!isValidFavoriteProblemEntry({ problemId: "p1", title: "T", difficulty: "easy", tags: ["a"] }));
});

// ---- isValidRecentPracticeEntry ----

test("isValidRecentPracticeEntry validates correct entry", () => {
  const entry = makePracticeEntry();
  assert.ok(isValidRecentPracticeEntry(entry));
});

test("isValidRecentPracticeEntry rejects invalid status", () => {
  assert.ok(!isValidRecentPracticeEntry(makePracticeEntry({ status: "invalid" })));
  assert.ok(!isValidRecentPracticeEntry(makePracticeEntry({ status: "" })));
});

test("isValidRecentPracticeEntry rejects missing fields", () => {
  assert.ok(!isValidRecentPracticeEntry(null));
  assert.ok(!isValidRecentPracticeEntry({}));
});

// ---- hasSensitiveFields ----

test("hasSensitiveFields detects dangerous patterns", () => {
  assert.ok(hasSensitiveFields({ token: "abc" }));
  assert.ok(hasSensitiveFields({ api_key: "abc" }));
  assert.ok(hasSensitiveFields({ DATABASE_URL: "postgres://..." }));
  assert.ok(hasSensitiveFields({ secret: "abc" }));
  assert.ok(hasSensitiveFields({ rawText: "something" }));
});

test("hasSensitiveFields returns false for safe data", () => {
  assert.ok(!hasSensitiveFields(makeFavEntry()));
  assert.ok(!hasSensitiveFields(makePracticeEntry()));
  assert.ok(!hasSensitiveFields(null));
  assert.ok(!hasSensitiveFields(undefined));
});

test("isValidFavoriteProblemEntry rejects sensitive fields", () => {
  const entry = {
    problemId: "p-1",
    title: "T",
    difficulty: "easy",
    tags: ["a"],
    favoritedAt: new Date().toISOString(),
    token: "secret123",
  };
  assert.ok(!isValidFavoriteProblemEntry(entry));
});

test("isValidRecentPracticeEntry rejects sensitive fields", () => {
  const entry = {
    problemId: "p-1",
    title: "T",
    difficulty: "easy",
    status: "practiced",
    updatedAt: new Date().toISOString(),
    password: "12345",
  };
  assert.ok(!isValidRecentPracticeEntry(entry));
});
