import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import test from "node:test";

const ROOT = cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf-8");

test("A518 admin navigation removes abandoned book and import entries", () => {
  const nav = read("apps/web/src/app/_components/AppNav.tsx");
  assert.equal(nav.includes('label: "书籍管理"'), false);
  assert.equal(nav.includes('label: "导入管理"'), false);
  assert.equal(nav.includes('href: "/admin/books"'), false);
  assert.equal(nav.includes('href: "/admin/imports"'), false);
  assert.match(nav, /label:\s*"管理概览"/);
  assert.match(nav, /label:\s*"题目资源"/);
  assert.match(nav, /label:\s*"内容同步"/);
  assert.match(nav, /label:\s*"AI 助手"/);
  assert.match(nav, /label:\s*"系统设置"/);
});

test("A518 abandoned admin routes no longer render active backend pages", () => {
  const books = read("apps/web/src/app/admin/books/page.tsx");
  const imports = read("apps/web/src/app/admin/imports/page.tsx");
  for (const source of [books, imports]) {
    assert.match(source, /notFound\(\)/);
    assert.equal(source.includes("getAdminStatusSnapshot"), false);
  }
});
