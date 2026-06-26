import assert from "node:assert/strict";
import test from "node:test";

const MOD_URL = new URL("./problem-library-filter.ts", import.meta.url).href;
const mod = await import(MOD_URL);
const { filterProblems, computeProblemLibraryStats, filterCriteriaIsSafe } = mod;

// Import sample problems for testing
const SAMPLE_URL = new URL("./sample-programming-problems.ts", import.meta.url).href;
const { SAMPLE_PROBLEMS } = await import(SAMPLE_URL);

// ---- Search query ----

test("filter by query matches title", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { query: "Pair Sum" });
  assert.ok(result.length >= 1);
  const titles = result.map((p) => p.title);
  assert.ok(titles.some((t) => t.includes("Pair Sum")));
});

test("filter by query matches difficulty", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { query: "hard" });
  assert.ok(result.length >= 1);
  for (const p of result) {
    assert.ok(
      p.title.toLowerCase().includes("hard") ||
        p.difficulty === "hard" ||
        p.tags.some((t) => t.toLowerCase().includes("hard")),
    );
  }
});

test("filter by query matches tag", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { query: "stack" });
  assert.ok(result.length >= 1);
  for (const p of result) {
    const match =
      p.title.toLowerCase().includes("stack") ||
      p.tags.some((t) => t.toLowerCase().includes("stack"));
    assert.ok(match);
  }
});

test("filter by query case-insensitive", () => {
  const lower = filterProblems(SAMPLE_PROBLEMS, { query: "array" });
  const upper = filterProblems(SAMPLE_PROBLEMS, { query: "ARRAY" });
  assert.equal(lower.length, upper.length);
});

test("filter by empty query returns all", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { query: "" });
  assert.equal(result.length, SAMPLE_PROBLEMS.length);
});

test("filter by query with no match returns empty", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { query: "zzzz_nonexistent_zzzz" });
  assert.equal(result.length, 0);
});

// ---- Difficulty filter ----

test("filter by difficulty easy", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { difficulty: "easy" });
  assert.ok(result.length >= 1);
  for (const p of result) {
    assert.equal(p.difficulty, "easy");
  }
});

test("filter by difficulty medium", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { difficulty: "medium" });
  assert.ok(result.length >= 1);
  for (const p of result) {
    assert.equal(p.difficulty, "medium");
  }
});

test("filter by invalid difficulty returns empty", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { difficulty: "nonexistent" });
  assert.equal(result.length, 0);
});

// ---- Tag filter ----

test("filter by single tag", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { tags: ["array"] });
  assert.ok(result.length >= 1);
  for (const p of result) {
    assert.ok(p.tags.includes("array"));
  }
});

test("filter by multiple tags (AND logic)", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { tags: ["array", "hash-table"] });
  for (const p of result) {
    assert.ok(p.tags.includes("array"));
    assert.ok(p.tags.includes("hash-table"));
  }
});

test("filter by non-existent tag returns empty", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, { tags: ["nonexistent"] });
  assert.equal(result.length, 0);
});

// ---- Combined filter ----

test("combined query + difficulty + tag filter", () => {
  const result = filterProblems(SAMPLE_PROBLEMS, {
    query: "sum",
    difficulty: "easy",
    tags: ["array"],
  });
  for (const p of result) {
    assert.equal(p.difficulty, "easy");
    assert.ok(p.tags.includes("array"));
    const match =
      p.title.toLowerCase().includes("sum") ||
      p.tags.some((t) => t.toLowerCase().includes("sum"));
    assert.ok(match);
  }
});

// ---- Stats ----

test("compute stats returns correct counts", () => {
  const stats = computeProblemLibraryStats(SAMPLE_PROBLEMS);
  assert.equal(stats.totalCount, SAMPLE_PROBLEMS.length);
  assert.equal(stats.filteredCount, SAMPLE_PROBLEMS.length);
  assert.ok(stats.totalCount > 0);
});

test("compute stats with filtered list", () => {
  const filtered = filterProblems(SAMPLE_PROBLEMS, { difficulty: "easy" });
  const stats = computeProblemLibraryStats(SAMPLE_PROBLEMS, filtered);
  assert.equal(stats.totalCount, SAMPLE_PROBLEMS.length);
  assert.equal(stats.filteredCount, filtered.length);
});

// ---- Safety ----

test("filter criteria is safe", () => {
  assert.ok(filterCriteriaIsSafe({ query: "test" }));
  assert.ok(filterCriteriaIsSafe({ difficulty: "easy" }));
  assert.ok(filterCriteriaIsSafe({ tags: ["array"] }));
  assert.ok(filterCriteriaIsSafe({}));
});

test("filter criteria rejects dangerous fields", () => {
  // @ts-expect-error testing safety
  assert.ok(!filterCriteriaIsSafe({ token: "secret123" }));
  // @ts-expect-error testing safety
  assert.ok(!filterCriteriaIsSafe({ api_key: "abc" }));
});
