import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const mod = await import("./articles/article-library-loader.ts");
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(TEST_DIR, "../..");

function makeArticle(title, fetchedAt) {
  return {
    id: `cnblogs-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    summary: "Summary",
    originalUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
    sourceName: "Demo CNBlogs",
    sourcePlatform: "cnblogs",
    author: "Author",
    publishedAt: fetchedAt,
    categories: ["Python"],
    feedId: "demo-feed",
    fetchedAt,
  };
}

test("loadArticleLibrary rereads the generated data file on each call", function () {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lap-article-loader-"));
  const dataPath = path.join(tempDir, "articles.generated.json");

  fs.writeFileSync(dataPath, JSON.stringify([makeArticle("First", "2024-06-18T10:00:00Z")], null, 2), "utf-8");
  const first = mod.loadArticleLibrary(dataPath);
  assert.equal(first.totalCount, 1);
  assert.equal(first.articles[0].title, "First");

  fs.writeFileSync(
    dataPath,
    JSON.stringify(
      [
        makeArticle("Second", "2024-06-19T10:00:00Z"),
        makeArticle("First", "2024-06-18T10:00:00Z"),
      ],
      null,
      2,
    ),
    "utf-8",
  );
  const second = mod.loadArticleLibrary(dataPath);
  assert.equal(second.totalCount, 2);
  assert.equal(second.articles[0].title, "Second");
  assert.equal(second.generatedAt, "2024-06-19T10:00:00.000Z");
});

test("loadArticleLibrary resolves the default generated data file from the web app root", function () {
  const previousCwd = process.cwd();
  process.chdir(WEB_ROOT);

  try {
    const result = mod.loadArticleLibrary();
    assert.equal(result.status, "loaded");
    assert.ok(result.totalCount > 0);
  } finally {
    process.chdir(previousCwd);
  }
});
