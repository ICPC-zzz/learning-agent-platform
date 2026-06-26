import assert from "node:assert/strict";
import test from "node:test";

const FILTER_URL = new URL("./book-library-filter.ts", import.meta.url).href;
const mod = await import(FILTER_URL);
const { filterBooks, collectTags, collectDifficulties, computeBookStats, getEmptyFilterMessage } = mod;

const SAMPLE_URL = new URL("./sample-programming-books.ts", import.meta.url).href;
const { getSampleBook } = await import(SAMPLE_URL);

const ITEMS = [
  {
    id: "sample-python-basics", title: "Python 基础入门示例", author: "Learning Agent Platform",
    sourceType: "内置示例书", summary: "从零开始学习 Python 编程。", chapterCount: 2, chunkCount: 4,
    tags: ["Python", "编程基础", "入门"], difficulty: "入门", detailHref: "/books/sample-python-basics",
  },
  {
    id: "sample-js-async", title: "JavaScript 异步编程示例", author: "Learning Agent Platform",
    sourceType: "内置示例书", summary: "深入理解 JavaScript 异步编程。", chapterCount: 3, chunkCount: 6,
    tags: ["JavaScript", "异步编程", "Promise", "async/await"], difficulty: "中级", detailHref: "/books/sample-js-async",
  },
  {
    id: "sample-algorithms-intro", title: "算法与数据结构入门", author: "Learning Agent Platform",
    sourceType: "内置示例书", summary: "理解时间复杂度和数据结构。", chapterCount: 2, chunkCount: 4,
    tags: ["算法", "数据结构", "Python", "复杂度分析"], difficulty: "进阶", detailHref: "/books/sample-algorithms-intro",
  },
];

const SENS = [ /\bDATABASE_URL\b/i, /\bapi[\s_-]*key\b/i, /\btoken\b/i, /\bsecret\b/i, /\bpassword\b/i, /\bcookie\b/i ];

// ---- Search ----

test("search by title match Python", () => {
  const r = filterBooks(ITEMS, { searchQuery: "Python" });
  assert.ok(r.hasActiveFilters);
  assert.equal(r.books.length, 2);
});

test("search by tag word match async", () => {
  const r = filterBooks(ITEMS, { searchQuery: "async" });
  assert.equal(r.books.length, 1);
});

test("search no result", () => {
  const r = filterBooks(ITEMS, { searchQuery: "ZZZNonexistent" });
  assert.equal(r.books.length, 0);
});

test("search empty returns all", () => {
  const r = filterBooks(ITEMS, { searchQuery: "" });
  assert.equal(r.hasActiveFilters, false);
  assert.equal(r.books.length, ITEMS.length);
});

// ---- Tag filter ----

test("tag filter match Python", () => {
  const r = filterBooks(ITEMS, { tagFilter: "Python" });
  assert.equal(r.books.length, 2);
});

test("tag filter match JavaScript", () => {
  const r = filterBooks(ITEMS, { tagFilter: "JavaScript" });
  assert.equal(r.books.length, 1);
});

test("tag filter match algorithm tag", () => {
  const r = filterBooks(ITEMS, { tagFilter: "算法" });
  assert.equal(r.books.length, 1);
});

test("tag filter no match", () => {
  const r = filterBooks(ITEMS, { tagFilter: "Rust" });
  assert.equal(r.books.length, 0);
});

// ---- Difficulty filter ----

test("difficulty filter match beginner", () => {
  const r = filterBooks(ITEMS, { difficultyFilter: "入门" });
  assert.equal(r.books.length, 1);
});

test("difficulty filter match intermediate", () => {
  const r = filterBooks(ITEMS, { difficultyFilter: "中级" });
  assert.equal(r.books.length, 1);
});

test("difficulty filter match advanced", () => {
  const r = filterBooks(ITEMS, { difficultyFilter: "进阶" });
  assert.equal(r.books.length, 1);
});

test("difficulty filter no match", () => {
  const r = filterBooks(ITEMS, { difficultyFilter: "专家" });
  assert.equal(r.books.length, 0);
});

// ---- Combined ----

test("combined search plus tag", () => {
  const r = filterBooks(ITEMS, { searchQuery: "Python", tagFilter: "入门" });
  assert.equal(r.books.length, 1);
  assert.equal(r.books[0].id, "sample-python-basics");
});

test("combined tag plus difficulty", () => {
  const r = filterBooks(ITEMS, { tagFilter: "Python", difficultyFilter: "进阶" });
  assert.equal(r.books.length, 1);
});

test("combined conflicting returns empty", () => {
  const r = filterBooks(ITEMS, { searchQuery: "Python", difficultyFilter: "中级" });
  assert.equal(r.books.length, 0);
});

// ---- collectTags ----

test("collectTags returns sorted unique tags", () => {
  const tags = collectTags(ITEMS);
  assert.ok(tags.length >= 7);
  assert.ok(tags.includes("Python"));
  assert.ok(tags.includes("JavaScript"));
});

test("collectTags empty returns empty", () => {
  assert.equal(collectTags([]).length, 0);
});

// ---- collectDifficulties ----

test("collectDifficulties returns 3 items", () => {
  const d = collectDifficulties(ITEMS);
  assert.equal(d.length, 3);
  assert.ok(d.includes("入门"));
  assert.ok(d.includes("中级"));
  assert.ok(d.includes("进阶"));
});

test("collectDifficulties empty returns empty", () => {
  assert.equal(collectDifficulties([]).length, 0);
});

// ---- computeBookStats ----

test("computeBookStats correct counts", () => {
  const s = computeBookStats(ITEMS);
  assert.equal(s.bookCount, 3);
  assert.equal(s.chapterCount, 7);
});

test("computeBookStats empty returns zeros", () => {
  const s = computeBookStats([]);
  assert.equal(s.bookCount, 0);
  assert.equal(s.chapterCount, 0);
});

// ---- getFirstChapterInfo (inline) ----

function getFirstChapterInfo(bookId) {
  const book = getSampleBook(bookId);
  if (!book || book.chapters.length === 0) return null;
  const ch = book.chapters[0];
  return {
    chapterId: ch.id,
    title: ch.title,
    orderIndex: ch.orderIndex,
    estimatedReadingMinutes: Math.max(1, Math.ceil(ch.plainText.length / 300)),
    readerHref: "/reader?bookId=" + encodeURIComponent(bookId) + "&chapterId=" + encodeURIComponent(ch.id),
  };
}

test("first chapter info for python basics", () => {
  const info = getFirstChapterInfo("sample-python-basics");
  assert.ok(info !== null);
  assert.equal(info.chapterId, "sample-python-ch01");
  assert.ok(info.estimatedReadingMinutes >= 1);
  assert.ok(info.readerHref.includes("bookId=sample-python-basics"));
  assert.ok(info.readerHref.includes("chapterId=sample-python-ch01"));
});

test("first chapter info for js async", () => {
  const info = getFirstChapterInfo("sample-js-async");
  assert.ok(info !== null);
  assert.equal(info.chapterId, "sample-js-async-ch01");
});

test("first chapter info for algorithms", () => {
  const info = getFirstChapterInfo("sample-algorithms-intro");
  assert.ok(info !== null);
  assert.equal(info.chapterId, "sample-algorithms-ch01");
});

test("first chapter info null for unknown", () => {
  assert.equal(getFirstChapterInfo("non-existent"), null);
  assert.equal(getFirstChapterInfo(""), null);
});

// ---- getEmptyFilterMessage ----

test("empty message with active filters", () => {
  const msg = getEmptyFilterMessage(true);
  assert.ok(msg.includes("No matching"));
});

test("empty message without filters", () => {
  const msg = getEmptyFilterMessage(false);
  assert.ok(msg.includes("No books"));
});

// ---- Edge cases ----

test("filterBooks empty list returns empty", () => {
  assert.equal(filterBooks([], { searchQuery: "test" }).books.length, 0);
});

test("filterBooks empty list no filters", () => {
  const r = filterBooks([], {});
  assert.equal(r.hasActiveFilters, false);
});

// ---- Safety ----

test("filter output no sensitive fields", () => {
  const json = JSON.stringify(filterBooks(ITEMS, { searchQuery: "Python" }));
  for (const p of SENS) assert.equal(p.test(json), false);
});

test("stats no sensitive fields", () => {
  const json = JSON.stringify(computeBookStats(ITEMS));
  for (const p of SENS) assert.equal(p.test(json), false);
});

test("chapter info no sensitive fields", () => {
  const json = JSON.stringify(getFirstChapterInfo("sample-python-basics"));
  for (const p of SENS) assert.equal(p.test(json), false);
});

test("empty message no sensitive fields", () => {
  for (const p of SENS) assert.equal(p.test(getEmptyFilterMessage(true)), false);
});

console.log("\nOK: All book-library-filter tests passed\n");

