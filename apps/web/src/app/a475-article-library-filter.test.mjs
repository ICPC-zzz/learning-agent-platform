import assert from "node:assert/strict";
import test from "node:test";

const mod = await import("./articles/article-library-filter.ts");

const sample = [
  {
    id: "a",
    title: "JavaScript Async Patterns",
    summary: "A short note about async flows in modern JavaScript.",
    originalUrl: "https://example.com/a",
    sourceName: "Demo CNBlogs",
    sourcePlatform: "cnblogs",
    author: "Alice",
    publishedAt: "2024-06-18T10:00:00Z",
    categories: ["JavaScript", "前端"],
    feedId: "source-a",
    fetchedAt: "2024-06-18T12:00:00Z",
  },
  {
    id: "b",
    title: "Python Data Pipelines",
    summary: "Batch ingestion and cleanup for feed-based content.",
    originalUrl: "https://example.com/b",
    sourceName: "Demo CSDN",
    sourcePlatform: "csdn",
    author: "Bob",
    publishedAt: "2024-06-19T10:00:00Z",
    categories: ["Python", "后端"],
    feedId: "source-b",
    fetchedAt: "2024-06-19T12:00:00Z",
  },
  {
    id: "c",
    title: "Old Article",
    summary: "This one should be last because it has no publish date.",
    originalUrl: "https://example.com/c",
    sourceName: "Demo CSDN",
    sourcePlatform: "csdn",
    categories: ["其他"],
    feedId: "source-c",
    fetchedAt: "2024-06-19T12:00:00Z",
  },
];

test("filters by title, source, and category", function () {
  const byQuery = mod.filterAndSortArticles(sample, { query: "python", source: "all", category: "all" });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].id, "b");

  const bySource = mod.filterAndSortArticles(sample, { query: "", source: "cnblogs", category: "all" });
  assert.equal(bySource.length, 1);
  assert.equal(bySource[0].id, "a");

  const byCategory = mod.filterAndSortArticles(sample, { query: "", source: "all", category: "Python" });
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].id, "b");
});

test("sorts latest first and missing date last", function () {
  const sorted = mod.filterAndSortArticles(sample, { query: "", source: "all", category: "all" });
  assert.equal(sorted[0].id, "b");
  assert.equal(sorted[1].id, "a");
  assert.equal(sorted[2].id, "c");
});

test("constants keep the article filter vocabulary", function () {
  assert.equal(mod.ARTICLE_SOURCE_FILTERS.length, 3);
  assert.ok(mod.ARTICLE_CATEGORY_FILTERS.includes("Python"));
  assert.ok(mod.ARTICLE_CATEGORY_FILTERS.includes("AI"));
});
