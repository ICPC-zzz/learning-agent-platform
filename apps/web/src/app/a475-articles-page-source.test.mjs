import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const PAGE = path.join(ROOT, "apps/web/src/app/articles/page.tsx");
const CLIENT = path.join(ROOT, "apps/web/src/app/articles/components/ArticleLibraryClient.tsx");
const DATA = path.join(ROOT, "apps/web/src/data/articles.generated.json");

test("articles page is a read-only list view", function () {
  const source = fs.readFileSync(PAGE, "utf-8");
  assert.ok(source.includes("技术文章"));
  assert.ok(source.includes("ArticleLibraryClient"));
  assert.ok(source.includes("PageHero"));
  assert.ok(source.includes("PageSection"));
  assert.ok(source.includes('dynamic = "force-dynamic"'));
  assert.ok(source.includes("generatedAt"));
  assert.ok(source.includes("formatSyncTime"));
  assert.ok(source.includes("暂无文章数据") || source.includes("ArticleLibraryClient"));
  assert.ok(!source.includes("preview/blocked/disabled"));
  assert.ok(!source.includes("向 AI 提问"));
});

test("article cards expose external original links only", function () {
  const source = fs.readFileSync(CLIENT, "utf-8");
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('rel="noopener noreferrer nofollow"'));
  assert.ok(source.includes("阅读原文"));
  assert.ok(source.includes("搜索标题、摘要、作者、来源或分类"));
  assert.ok(source.includes("useDeferredValue"));
  assert.ok(source.includes("PAGE_SIZE"));
  assert.ok(source.includes("PaginationBar"));
  assert.ok(source.includes("pageArticles"));
});

test("generated article data file exists and uses plain array JSON", function () {
  const raw = fs.readFileSync(DATA, "utf-8");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.length >= 1000);
});
