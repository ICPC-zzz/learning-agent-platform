import assert from "node:assert/strict";
import test from "node:test";

const FILTER_URL = new URL("./book-library-filter.ts", import.meta.url).href;
const mod = await import(FILTER_URL);
const { filterBooks, collectTags, collectDifficulties, computeBookStats } = mod;

const SENS = [ /\bDATABASE_URL\b/i, /\bapi[\s_-]*key\b/i, /\btoken\b/i, /\bsecret\b/i, /\bpassword\b/i, /\bcookie\b/i ];

const ITEMS = [
  {
    id: "sample-python-basics", title: "Python Basics", author: "LAP",
    sourceType: "builtin", summary: "Learn Python.", chapterCount: 2, chunkCount: 4,
    tags: ["Python", "basics", "beginner"], difficulty: "Beginner", detailHref: "/books/sample-python-basics",
  },
  {
    id: "sample-js-async", title: "JS Async", author: "LAP",
    sourceType: "builtin", summary: "Learn JS async.", chapterCount: 3, chunkCount: 6,
    tags: ["JavaScript", "async", "Promise"], difficulty: "Intermediate", detailHref: "/books/sample-js-async",
  },
  {
    id: "sample-algorithms-intro", title: "Algorithms Intro", author: "LAP",
    sourceType: "builtin", summary: "Learn algorithms.", chapterCount: 2, chunkCount: 4,
    tags: ["algorithms", "data-structures", "Python"], difficulty: "Advanced", detailHref: "/books/sample-algorithms-intro",
  },
];

const DEV_ITEM = {
  id: "dev-import-1",
  title: "Dev Import Test Book",
  author: "Test Author",
  sourceType: "Dev Memory Store / Restart Lost",
  summary: "Dev import book test.",
  chapterCount: 3,
  chunkCount: 6,
  tags: ["test", "dev-import"],
  difficulty: "Beginner",
  detailHref: "/books/dev-import-1",
};

const DEV_NO_TAGS = {
  id: "dev-import-2",
  title: "No Tags Dev Book",
  author: "Test Author",
  sourceType: "Dev Memory Store / Restart Lost",
  summary: "Dev import book without tags.",
  chapterCount: 1,
  chunkCount: 2,
  tags: undefined,
  difficulty: undefined,
  detailHref: "/books/dev-import-2",
};

const ALL_WITH_DEV = [...ITEMS, DEV_ITEM, DEV_NO_TAGS];

test("filterBooks finds dev book by title", () => {
  const r = filterBooks(ALL_WITH_DEV, { searchQuery: "Dev Import" });
  assert.equal(r.books.length, 2);
});

test("filterBooks finds dev book by tag", () => {
  const r = filterBooks(ALL_WITH_DEV, { tagFilter: "dev-import" });
  assert.equal(r.books.length, 1);
  assert.equal(r.books[0].id, "dev-import-1");
});

test("filterBooks dev book without tags survives filter", () => {
  const r = filterBooks(ALL_WITH_DEV, { searchQuery: "No Tags" });
  assert.equal(r.books.length, 1);
  assert.equal(r.books[0].id, "dev-import-2");
});

test("filterBooks dev book without tags/difficulty does not crash on tag filter", () => {
  const r = filterBooks(ALL_WITH_DEV, { tagFilter: "Python" });
  assert.ok(r.books.every(function(b) { return (b.tags || []).some(function(t) { return t.toLowerCase() === "python"; }); }));
});

test("filterBooks dev book without difficulty does not crash on difficulty filter", () => {
  const r = filterBooks(ALL_WITH_DEV, { difficultyFilter: "Expert" });
  assert.equal(r.books.length, 0);
});

test("computeBookStats includes dev books", () => {
  const s = computeBookStats(ALL_WITH_DEV);
  assert.equal(s.bookCount, 5);
  assert.equal(s.chapterCount, 11);
});

test("collectTags includes dev book tags", () => {
  const tags = collectTags(ALL_WITH_DEV);
  assert.ok(tags.includes("dev-import"));
  assert.ok(tags.includes("test"));
});

test("collectDifficulties includes Beginner from dev book", () => {
  const d = collectDifficulties(ALL_WITH_DEV);
  assert.ok(d.includes("Beginner"));
});

test("dev item serialization has no sensitive fields", () => {
  const json = JSON.stringify(filterBooks(ALL_WITH_DEV, { searchQuery: "Dev" }));
  for (const p of SENS) assert.equal(p.test(json), false);
});

console.log("\nOK: All dev-book-filter tests passed\n");
