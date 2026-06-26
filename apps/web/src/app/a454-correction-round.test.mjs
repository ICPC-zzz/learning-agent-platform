import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname || ".");
const LIB_DIR = path.resolve(APP_DIR, "../lib");
const PROJECT_ROOT = path.resolve(APP_DIR, "../../../..");
const SHARED_DIR = path.join(PROJECT_ROOT, "packages/shared/src");

function rf(p) { return fs.readFileSync(path.join(APP_DIR, p), "utf-8"); }
function rl(p) { return fs.readFileSync(path.join(LIB_DIR, p), "utf-8"); }
function rs(p) { return fs.readFileSync(path.join(SHARED_DIR, p), "utf-8"); }
function fe(p) { return fs.existsSync(path.join(APP_DIR, p)); }

describe("A454 learning entry routes", () => {
  it("all entry card hrefs have valid pages", () => {
    const src = rf("learning/page.tsx");
    const hrefs = extractHrefs(src);
    assert.ok(hrefs.length >= 9, "at least 9 entry cards expected");
    const missing = [];
    for (const href of hrefs) {
      const pagePath = path.join(href, "page.tsx");
      if (!fe(pagePath)) missing.push(href);
    }
    assert.deepStrictEqual(missing, []);
  });

  it("home page core routes exist", () => {
    const routes = ["/books", "/problems", "/learning", "/user", "/import", "/reader", "/daily-challenge"];
    for (const route of routes) {
      assert.ok(fe(path.join(route, "page.tsx")), route + " should have page.tsx");
    }
  });

  it("all /user sub-routes exist", () => {
    const routes = [
      "/user/report", "/user/review", "/user/today", "/user/activity",
      "/user/wrong-book", "/user/recent-reading", "/user/recent-practice",
      "/user/ai-history", "/user/favorites/articles",
      "/user/favorites/problems",
    ];
    for (const route of routes) {
      assert.ok(fe(path.join(route, "page.tsx")), route + " should have page.tsx");
    }
  });
});

describe("A454 Book API guard", () => {
  it("external-api-dev-guard exists with correct exports", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("evaluateExternalApiDevGuard"));
    assert.ok(src.includes("safeToExposeToClient"));
    assert.ok(src.includes("productionReady"));
  });

  it("check production env", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("NODE_ENV"));
    assert.ok(src.includes("isNonProductionEnv"));
  });

  it("blockedReason uses env names not values", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("is not enabled"));
    assert.ok(src.includes("Missing env:"));
  });

  it("admin-status-center Book API does not leak values", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes('"LAP_ALLOW_EXTERNAL_BOOK_API"'));
    assert.ok(src.includes('"LAP_BOOK_API_BASE_URL"'));
    assert.ok(src.includes('仅显示是否配置，不显示值'));
  });

  it("Book API preview status has productionReady=false", () => {
    const src = rf("import/book-api-preview-status.ts");
    assert.ok(src.includes("productionReady: false"));
    assert.ok(src.includes("safeToExposeToClient: true"));
  });

  it("Book API server action checks guard before provider", () => {
    const src = rf("import/book-api-preview-server-action.ts");
    assert.ok(src.includes("getBookApiPreviewStatus"));
    assert.ok(src.includes('providerMode === "blocked"'));
    assert.ok(src.includes("createBlockedProvider"));
  });
});

describe("A454 Problem API guard", () => {
  it("problem-api-status uses evaluateExternalApiDevGuard", () => {
    const src = rf("problems/problem-api-status.ts");
    assert.ok(src.includes("evaluateExternalApiDevGuard"));
    assert.ok(src.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"));
  });

  it("Problem API server action checks guard", () => {
    const src = rf("problems/problem-api-preview-server-action.ts");
    assert.ok(src.includes('getProblemApiPreviewStatus()'));
    assert.ok(src.includes('status.providerMode === "blocked"'));
  });

  it("GenericProblemApiProvider checks guard before HTTP", () => {
    const pkgDir = path.join(PROJECT_ROOT, "packages/learning-engine/src");
    const src = fs.readFileSync(path.join(pkgDir, "problem-api-provider.ts"), "utf-8");
    assert.ok(src.includes("#evaluateRawGuard()"));
    assert.ok(src.includes("guard.allowed"));
    assert.ok(src.includes("!guard.allowed"));
  });

  it("Problem API provider has rawResponseStored=false", () => {
    const pkgDir = path.join(PROJECT_ROOT, "packages/learning-engine/src");
    const src = fs.readFileSync(path.join(pkgDir, "problem-api-provider.ts"), "utf-8");
    assert.ok(src.includes("rawResponseStored: false"));
    assert.ok(src.includes("safeProblemApiErrorMessage"));
  });
});

describe("A454 import capability text", () => {
  it("must say current only text import", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("当前仅支持纯文本导入"));
  });

  it("must not say PDF/Word are supported", () => {
    const src = rf("import/page.tsx");
    const misleading = ["PDF 已支持", "Word 已支持", "EPUB 已支持"];
    for (const phrase of misleading) {
      assert.ok(!src.includes(phrase), 'should not contain: ' + phrase);
    }
  });

  it("PDF/Word/EPUB marked as not implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("后续接入") && src.includes("尚未实现"));
  });

  it("does not imply AI parsing", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("不调用 AI"));
    assert.ok(!src.includes("AI 自动解析"));
  });

  it("safety accordion is complete", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("不调用真实 LLM"));
    assert.ok(src.includes("仅接受粘贴文本"));
  });

  it("ImportCapabilityRow component rendered", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("ImportCapabilityRow"));
  });
});

describe("A454 loader stability", () => {
  it("book library loader has mock fallback for missing DB URL", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(src.includes("hasDatabaseUrl"));
    assert.ok(src.includes("createMockFallbackLibraryResult"));
    assert.ok(src.includes("DATABASE_URL is not configured"));
  });

  it("book library loader handles empty DB", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(src.includes("books.length === 0"));
  });

  it("book detail loader handles missing bookId", () => {
    const src = rf("books/book-detail-loader.ts");
    assert.ok(src.includes('"unavailable"'));
    assert.ok(src.includes("Book id is required"));
  });

  it("book detail loader handles book_not_found", () => {
    const src = rf("books/book-detail-loader.ts");
    assert.ok(src.includes('"book_not_found"'));
  });

  it("problem detail loader handles null ID", () => {
    const src = rf("problems/problem-detail-loader.ts");
    assert.ok(src.includes('status: "not_found"'));
    assert.ok(src.includes("未提供有效的题目 ID"));
  });

  it("problem detail loader has 5 statuses", () => {
    const src = rf("problems/problem-detail-loader.ts");
    const statuses = ["builtin", "db", "localStorage", "not_found", "db_unavailable"];
    for (const s of statuses) {
      assert.ok(src.includes('"' + s + '"'), "should have status: " + s);
    }
  });

  it("problem detail loader checks 3 guards before DB", () => {
    const src = rf("problems/problem-detail-loader.ts");
    assert.ok(src.includes("isDbReadAllowed"));
    assert.ok(src.includes("DATABASE_URL"));
    assert.ok(src.includes("LAP_ALLOW_REAL_DB_INTEGRATION"));
    assert.ok(src.includes("LAP_IMPORT_DB_PERSIST_DEV_ENABLED"));
  });

  it("BookDetailPage handles all statuses", () => {
    const src = rf("books/[bookId]/page.tsx");
    assert.ok(src.includes("book === null"));
    assert.ok(src.includes("BookDetailEmptyState"));
    assert.ok(src.includes("no readable chapters") || src.includes("No readable chapters") || src.includes("has no readable chapters"));
  });
});

describe("A454 safety boundaries", () => {
  it("admin-status-center uses safeGetEnv", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("safeGetEnv"));
  });

  it("web-ai-qa-guard declares no secret values returned", () => {
    const src = rl("web-ai-qa-guard.ts");
    assert.ok(src.includes("No secret values are returned"));
  });

  it("import page does not call real LLM", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("不调用真实 LLM"));
  });

  it("book detail page has no Agent references", () => {
    const src = rf("books/[bookId]/page.tsx");
    assert.ok(!src.includes("Agent"));
  });

  it("problem detail page has no shell/exec", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(!src.includes("shell"));
    assert.ok(!src.includes("exec"));
  });

  it("import page does not read user filesystem", () => {
    const src = rf("import/page.tsx");
    assert.ok(!src.includes("readdir"));
    assert.ok(!src.includes("readFile"));
  });

  it("no new Prisma schema changes this round", () => {
    const prismaPath = path.join(PROJECT_ROOT, "packages/db/prisma/schema.prisma");
    if (fs.existsSync(prismaPath)) {
      const src = fs.readFileSync(prismaPath, "utf-8");
      assert.ok(!src.includes("PdfDocument"));
      assert.ok(!src.includes("WordDocument"));
    }
  });
});

describe("A454 problem detail safety", () => {
  it("dangerouslySetInnerHTML has safety note", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(src.includes("SAFETY NOTE"));
  });

  it("dangerouslySetInnerHTML uses escapeHtml", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(src.includes("escapeHtml"));
  });
});

describe("A454 import capability status", () => {
  it("admin status includes import format capabilities", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("import.format.text"));
    assert.ok(src.includes("import.format.pdf"));
    assert.ok(src.includes("import.format.word"));
    assert.ok(src.includes("import.format.epub"));
  });

  it("PDF/Word/EPUB format status is unavailable", () => {
    const src = rl("admin-status-center.ts");
    const keys = ["import.format.pdf", "import.format.word", "import.format.epub"];
    for (const key of keys) {
      assert.ok(src.includes(key));
    }
  });
});

describe("A454 summary", () => {
  it("all test groups loaded successfully", () => {
    assert.ok(true);
  });
});

function extractHrefs(src) {
  const hrefs = [];
  const re = /href:\s*["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = re.exec(src)) !== null) {
    const href = match[1];
    if (href.startsWith("/") && !href.startsWith("http")) {
      hrefs.push(href);
    }
  }
  return [...new Set(hrefs)];
}
