import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = process.cwd();

describe("A462 User page learning center", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/user/page.tsx", "utf-8");
  it("has learning center section", function () { assert.ok(source.includes("学习中心")); });
  it("has daily challenge link", function () { assert.ok(source.includes("/daily-challenge")); });
  it("has learning detail link", function () { assert.ok(source.includes("/learning")); });
  it("preview/mock labeled", function () { assert.ok(source.includes("开发预览") || source.includes("dev-only")); });
  it("localStorage fallback labeled", function () { assert.ok(source.includes("localStorage")); });
  it("rule-based no LLM labeled", function () { assert.ok(source.includes("未调用 LLM") || source.includes("规则")); });
  it("no passwordHash leak", function () { assert.ok(!source.includes("passwordHash")); });
  it("no DATABASE_URL leak", function () { assert.ok(!source.includes("DATABASE_URL")); });
  it("has activity stats", function () { assert.ok(source.includes("学习活动") || source.includes("totalActivities")); });
  it("has reading sessions", function () { assert.ok(source.includes("阅读会话") || source.includes("totalReadingSessions")); });
  it("has wrong book stats", function () { assert.ok(source.includes("错题记录") || source.includes("wrongBook")); });
  it("has data status disclaimer", function () { assert.ok(source.includes("数据状态")); });
  it("links to report", function () { assert.ok(source.includes("/user/report")); });
  it("links to today plan", function () { assert.ok(source.includes("/user/today")); });
  it("links to wrong book", function () { assert.ok(source.includes("/user/wrong-book")); });
  it("title is 个人", function () { assert.ok(source.includes('"个人"')); });
  it("links nav: articles", function () { assert.ok(source.includes("/articles")); });
  it("links nav: problems", function () { assert.ok(source.includes("/problems")); });
  it("links nav: ai", function () { assert.ok(source.includes("/ai")); });
  it("no old /login links", function () { assert.equal((source.match(/href=["']\/login["']/g) || []).length, 0); });
});

describe("A462 old pages preserved", function () {
  it("/learning exists", function () { assert.ok(existsSync(ROOT + "/apps/web/src/app/learning/page.tsx")); });
  it("/daily-challenge exists", function () { assert.ok(existsSync(ROOT + "/apps/web/src/app/daily-challenge/page.tsx")); });
  it("/books exists", function () { assert.ok(existsSync(ROOT + "/apps/web/src/app/books/page.tsx")); });
  it("/problems exists", function () { assert.ok(existsSync(ROOT + "/apps/web/src/app/problems/page.tsx")); });
});
