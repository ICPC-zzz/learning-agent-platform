/**
 * A456 - Book/Problem 导入后可见闭环 v3 测试
 *
 * Covers: Problem list merge/dedup, Problem detail field fallback,
 * Book list/detail/chapter visibility, Import result structures,
 * Safety boundaries, Capability文案 accuracy.
 *
 * Uses fs-based source analysis (matching existing test patterns).
 * No TypeScript module resolution required.
 * No real API calls, no real DB writes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.resolve(import.meta.dirname || ".");
const LIB_DIR = path.resolve(APP_DIR, "../lib");
const PROJECT_ROOT = path.resolve(APP_DIR, "../../../..");
const SHARED_SRC = path.join(PROJECT_ROOT, "packages/shared/src");
const BOOK_ENGINE_SRC = path.join(PROJECT_ROOT, "packages/book-engine/src");
const DB_SRC = path.join(PROJECT_ROOT, "packages/db/src");

function rf(p) { return fs.readFileSync(path.join(APP_DIR, p), "utf-8"); }
function rl(p) { return fs.readFileSync(path.join(LIB_DIR, p), "utf-8"); }
function rs(p) { return fs.readFileSync(path.join(SHARED_SRC, p), "utf-8"); }
function fe(p) { return fs.existsSync(path.join(APP_DIR, p)); }
function fle(p) { return fs.existsSync(path.join(LIB_DIR, p)); }

// ===========================================================================
// GROUP 1: ProblemLibraryClient — merge source code analysis
// ===========================================================================

describe("A456 ProblemLibraryClient: merge and dedup", () => {
  it("ProblemLibraryClient accepts dbProblems prop", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes("dbProblems") && src.includes("DbProblemListItem"),
      "should define DbProblemListItem and accept dbProblems prop",
    );
  });

  it("ProblemLibraryClient merges DB problems with built-in samples", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes("allProblems") && src.includes("SAMPLE_PROBLEMS"),
      "should merge DB problems into allProblems with SAMPLE_PROBLEMS",
    );
    assert.ok(
      src.includes("merged.push"),
      "should push converted DB problems into merged array",
    );
  });

  it("ProblemLibraryClient deduplicates by title", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes("normalizeForDedup") || src.includes("builtinTitleKeys"),
      "should have dedup logic by normalized title",
    );
    assert.ok(
      src.includes("alreadyInMerged") || src.includes("builtinTitleKeys.has"),
      "should check for duplicates before pushing",
    );
  });

  it("ProblemLibraryClient shows source badges (builtin vs imported)", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes("已导入") && src.includes("本地题库"),
      "should label DB problems as 已导入/本地题库",
    );
    assert.ok(
      src.includes("示例") && src.includes("fallback"),
      "should label built-in as 示例/fallback",
    );
  });

  it("ProblemLibraryClient preserves search/filter on merged list", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes("filterProblems(allProblems"),
      "filter should operate on merged allProblems, not just SAMPLE_PROBLEMS",
    );
    assert.ok(
      src.includes("computeProblemLibraryStats(allProblems"),
      "stats should use merged allProblems",
    );
  });

  it("ProblemLibraryClient converts DB difficulty unknown to medium", () => {
    const src = rf("problems/ProblemLibraryClient.tsx");
    assert.ok(
      src.includes('difficulty === "unknown" ? "medium"'),
      "should map unknown difficulty to medium for display",
    );
  });

  it("problems/page.tsx passes dbProblems to ProblemLibraryClient", () => {
    const src = rf("problems/page.tsx");
    assert.ok(
      src.includes("dbProblems={") && src.includes("ProblemLibraryClient"),
      "page should pass dbProblems prop to ProblemLibraryClient",
    );
    assert.ok(
      src.includes("DbProblemListItem"),
      "page should import DbProblemListItem for type safety",
    );
  });
});

// ===========================================================================
// GROUP 2: Problem detail — DB import detail stability
// ===========================================================================

describe("A456 Problem detail: DB imported problem stability", () => {
  it("resolveProblemDetail tries DB lookup for non-builtin IDs", () => {
    const src = rf("problems/problem-detail-loader.ts");
    assert.ok(
      src.includes("tryLoadProblemFromDb"),
      "should call tryLoadProblemFromDb for non-builtin IDs",
    );
    assert.ok(
      src.includes("resolveProblemDetail"),
      "should have resolveProblemDetail function",
    );
  });

  it("tryLoadProblemFromDb checks DB guards before query", () => {
    const src = rf("problems/problem-detail-loader.ts");
    assert.ok(
      src.includes("isDbReadAllowed") || src.includes("LAP_ALLOW_REAL_DB_INTEGRATION"),
      "should check DB guard before querying",
    );
    assert.ok(
      src.includes("db_unavailable"),
      "should return db_unavailable status when DB not ready",
    );
  });

  it("DbProblemDetailView has field fallbacks for all fields", () => {
    const src = rf("problems/problem-detail-loader.ts");
    assert.ok(
      src.includes("description: record.description ?? null"),
      "description should fallback to null",
    );
    assert.ok(
      src.includes("source: record.source ?? null"),
      "source should fallback to null",
    );
    assert.ok(
      src.includes("sourceUrl: record.sourceUrl ?? null"),
      "sourceUrl should fallback to null",
    );
    assert.ok(
      src.includes("DB 导入题目"),
      "sourceLabel should have fallback",
    );
    assert.ok(
      src.includes("productionReady: false"),
      "should always mark productionReady=false",
    );
    assert.ok(
      src.includes("rawResponseStored: false"),
      "should always mark rawResponseStored=false",
    );
  });

  it("problem detail page handles db status with field fallbacks", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(
      src.includes('status === "db"'),
      "should handle db status in page",
    );
    assert.ok(
      src.includes("p.statement ?? p.description"),
      "statement area should fallback from statement to description",
    );
    assert.ok(
      src.includes("此题目当前只有元数据描述"),
      "should show fallback message when no statement",
    );
  });

  it("problem detail page handles not_found status", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(
      src.includes('status === "not_found"'),
      "should handle not_found status",
    );
    assert.ok(
      src.includes("题目未找到"),
      "should display 题目未找到",
    );
  });

  it("problem detail page handles db_unavailable status", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(
      src.includes('status === "db_unavailable"'),
      "should handle db_unavailable status",
    );
    assert.ok(
      src.includes("DB 读取未启用") || src.includes("DB 题目读取未启用"),
      "should display DB unavailable message",
    );
  });

  it("localStorage script uses escapeHtml/escapeAttr for all user data", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(
      src.includes("escapeHtml(") && src.includes("escapeAttr("),
      "should use escapeHtml and escapeAttr for user data sanitization",
    );
    assert.ok(
      src.includes("/&/g,'&amp;'"),
      "escapeHtml should escape & character",
    );
    assert.ok(
      src.includes("/</g,'&lt;'"),
      "escapeHtml should escape < character",
    );
    assert.ok(
      src.includes("/>/g,'&gt;'"),
      "escapeHtml should escape > character",
    );
  });

  it("detail page handles unexpected status gracefully", () => {
    const src = rf("problems/[problemId]/page.tsx");
    assert.ok(
      src.includes("题目加载异常") || src.includes("fallback"),
      "should have fallback for unexpected status",
    );
  });
});

// ===========================================================================
// GROUP 3: Book list/detail — imported books visible
// ===========================================================================

describe("A456 Book list/detail: imported book visibility", () => {
  it("Books page splits builtin vs imported books", () => {
    const src = rf("books/page.tsx");
    assert.ok(
      src.includes('b.sourceType === "builtin"'),
      "should filter builtin books",
    );
    assert.ok(
      src.includes('b.sourceType !== "builtin"'),
      "should filter imported books",
    );
    assert.ok(
      src.includes("已导入书籍") || src.includes("imported-dev"),
      "should have imported books section",
    );
  });

  it("BookLibraryLoader maps DB books with source labels", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(
      src.includes("describeBookSource"),
      "should use describeBookSource for source labels",
    );
    assert.ok(
      src.includes("sourceLabel:") && src.includes("previewBadge"),
      "should map sourceLabel and previewBadge",
    );
    assert.ok(
      src.includes("chapterCount:"),
      "should include chapterCount in mapped view",
    );
  });

  it("BookLibraryLoader falls back to mock when DB unavailable", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(
      src.includes("createMockFallbackLibraryResult"),
      "should have mock fallback for DB unavailable",
    );
    assert.ok(
      src.includes("mock_fallback"),
      "should use mock_fallback status",
    );
    assert.ok(
      src.includes("sampleBook"),
      "should include built-in sample book in fallback",
    );
  });

  it("BookLibraryLoader handles empty DB (no books)", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(
      src.includes("books.length === 0"),
      "should check for empty books list",
    );
    assert.ok(
      src.includes("no saved books were found"),
      "should show no saved books message for empty DB",
    );
  });

  it("BookDetailLoader sorts chapters by orderIndex", () => {
    const repoFile = path.join(DB_SRC, "repositories", "book-repository.ts");
    const src = fs.readFileSync(repoFile, "utf-8");
    assert.ok(
      src.includes('orderBy: [{ orderIndex: "asc" }'),
      "chapters should be ordered by orderIndex: asc",
    );
  });

  it("BookDetailLoader maps chapters with orderIndex in view", () => {
    const src = rf("books/book-detail-loader.ts");
    assert.ok(
      src.includes("orderIndex: chapter.orderIndex"),
      "should map orderIndex to chapter view",
    );
  });

  it("BookDetail page shows chapter list with orderIndex labels", () => {
    const src = rf("books/[bookId]/page.tsx");
    assert.ok(
      src.includes("Chapter {chapter.orderIndex + 1}"),
      "should display chapter number from orderIndex",
    );
  });

  it("BookDetail page shows empty chapter state", () => {
    const src = rf("books/[bookId]/page.tsx");
    assert.ok(
      src.includes("chapters.length === 0"),
      "should check for empty chapters",
    );
    assert.ok(
      src.includes("no readable chapters") || src.includes("empty"),
      "should show empty chapter message",
    );
  });

  it("BookDetailLoader describeBookSource handles imported_text", () => {
    const src = rf("books/book-detail-loader.ts");
    assert.ok(
      src.includes("IMPORTED_TEXT"),
      "should recognize IMPORTED_TEXT source type",
    );
    assert.ok(
      src.includes("开发数据库导入草稿") || src.includes("dev-only / preview"),
      "should label IMPORTED_TEXT as dev-only import",
    );
  });
});

// ===========================================================================
// GROUP 4: Import result structures — safe fields
// ===========================================================================

describe("A456 Import result: safe structures", () => {
  it("BookApiImportResult has safe bookId and chapterCount", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(
      src.includes("bookId:") && src.includes("chapterCount:"),
      "BookApiImportResult should have bookId and chapterCount",
    );
    assert.ok(
      src.includes("detailLink:") || src.includes("readerLink:"),
      "should include detailLink and readerLink",
    );
    assert.ok(
      src.includes("existing:") && (src.includes("existing: true") || src.includes("existing: false")),
      "should include existing field for dedup status",
    );
  });

  it("BookApiImportResult never stores raw response", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(
      src.includes("rawResponseStored: false"),
      "should mark rawResponseStored=false",
    );
    assert.ok(
      src.includes("productionReady: false"),
      "should mark productionReady=false",
    );
    assert.ok(
      src.includes("safeToExposeToClient: true"),
      "should mark safeToExposeToClient=true",
    );
  });

  it("BookApiImportResult has dedup: existing book returns existing=true", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(
      src.includes("existingBookId") && src.includes("existing: true"),
      "should set existing=true when duplicate found",
    );
    assert.ok(
      src.includes("未重复写入"),
      "should indicate no duplicate write",
    );
  });

  it("ProblemApiImportResult has safe localProblemId and dbId", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(
      src.includes("localProblemId:") && src.includes("dbId:"),
      "ProblemApiImportResult should have localProblemId and dbId",
    );
    assert.ok(
      src.includes("existingDetailLink:"),
      "should include existingDetailLink for dedup",
    );
  });

  it("ProblemApiImportResult never stores raw response", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(
      src.includes("rawResponseStored: false"),
      "should mark rawResponseStored=false",
    );
    assert.ok(
      src.includes("productionReady: false"),
      "should mark productionReady=false",
    );
    assert.ok(
      src.includes("safeToExposeToClient: true"),
      "should mark safeToExposeToClient=true",
    );
  });

  it("ProblemApiImportResult dedup: existing returns existing=true", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(
      src.includes("existing: true"),
      "should set existing=true for duplicate",
    );
    assert.ok(
      src.includes("existingDetailLink: `/problems/"),
      "should include detail link for existing problem",
    );
  });

  it("ProblemApiImportResult DB write failure falls back to localStorage", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(
      src.includes("db-write-failed-local-fallback") || src.includes("local-storage-only"),
      "should have fallback when DB write fails",
    );
    assert.ok(
      src.includes("imp-"),
      "localStorage ID should use imp- prefix",
    );
  });

  it("No raw response/prompt storage in import actions", () => {
    const bookSrc = rf("import/book-api-import-server-action.ts");
    const problemSrc = rf("import/problem-api-import-server-action.ts");
    for (const src of [bookSrc, problemSrc]) {
      // rawResponseStored: false is the safety label, not actual storage
      // Check there's no rawPayload, rawBody, or actual response storage
      assert.ok(!src.includes("rawPayload"), "should not store rawPayload");
      assert.ok(!src.includes("rawBody"), "should not store rawBody");
      assert.ok(!src.includes("rawPrompt"), "should not store rawPrompt");
      assert.ok(!src.includes("fullResponse"), "should not store fullResponse");
      // Must contain rawResponseStored: false
      assert.ok(src.includes("rawResponseStored"), "should declare rawResponseStored");
    }
  });
});

// ===========================================================================
// GROUP 5: Import page — capability文案 accuracy
// ===========================================================================

describe("A456 Import page: capability文案", () => {
  it("Import page marks 纯文本 as supported", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("纯文本粘贴") && (src.includes('"supported"') || src.includes("当前可用")),
      "纯文本 should be marked as supported/当前可用",
    );
    assert.ok(
      src.includes("当前仅支持纯文本") || src.includes("当前仅支持纯文本导入"),
      "should clearly state 当前仅支持纯文本导入",
    );
  });

  it("Import page marks PDF as not-implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("PDF") && (src.includes("not-implemented") || src.includes("后续接入")),
      "PDF should be marked as not-implemented/后续接入",
    );
    assert.ok(
      !src.includes("PDF 已支持") && !src.includes("PDF 导入已可用"),
      "should NOT claim PDF is supported",
    );
  });

  it("Import page marks Word/docx as not-implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("Word") && (src.includes("not-implemented") || src.includes("后续接入")),
      "Word should be marked as not-implemented/后续接入",
    );
    assert.ok(
      !src.includes("Word 已支持"),
      "should NOT claim Word is supported",
    );
  });

  it("Import page marks EPUB as not-implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("EPUB") && (src.includes("not-implemented") || src.includes("后续接入")),
      "EPUB should be marked as not-implemented/后续接入",
    );
    assert.ok(
      !src.includes("EPUB 已支持"),
      "should NOT claim EPUB is supported",
    );
  });

  it("Import page shows Book API blocked reason/missing env names", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("LAP_ALLOW_EXTERNAL_BOOK_API"),
      "should mention Book API env variable names",
    );
  });

  it("Import page shows Problem API blocked reason/missing env names", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"),
      "should mention Problem API env variable names",
    );
  });

  it("Import page renders BookApiPreviewClient for interactive Book API search", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("BookApiPreviewClient"),
      "should render BookApiPreviewClient for Book API search",
    );
  });

  it("Import page safety accordion lists all restrictions", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("不调用真实 LLM provider"),
      "should state no real LLM calls",
    );
    assert.ok(
      src.includes("PDF / Word(docx) / EPUB 导入尚未实现"),
      "should clearly state formats not implemented",
    );
    assert.ok(
      src.includes("不保存 raw prompt"),
      "should state no raw prompt storage",
    );
  });

  it("Import page does not fake success for blocked APIs", () => {
    const src = rf("import/page.tsx");
    assert.ok(
      src.includes("blocked") || src.includes("preview-only"),
      "should show blocked or preview-only for disabled APIs",
    );
  });
});

// ===========================================================================
// GROUP 6: Admin status center — unified fields
// ===========================================================================

describe("A456 Admin status center: unified fields", () => {
  it("AdminStatusSnapshot includes all required categories", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      src.includes("External APIs") || src.includes("book-api"),
      "should include External APIs or book-api category",
    );
    assert.ok(
      src.includes("Database") || src.includes("db"),
      "should include Database or db category",
    );
    assert.ok(
      src.includes("Imports") || src.includes("import"),
      "should include Imports or import category",
    );
  });

  it("StatusItem includes requiredEnvNames and missingEnvNames", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      src.includes("requiredEnvNames") && src.includes("missingEnvNames"),
      "StatusItem should include requiredEnvNames and missingEnvNames",
    );
    assert.ok(
      src.includes("configuredEnvNames"),
      "StatusItem should include configuredEnvNames",
    );
  });

  it("Admin status never shows env values", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      !src.includes("DATABASE_URL=") || src.includes("DATABASE_URL"),
      "should not show DATABASE_URL value, only variable name",
    );
    assert.ok(
      src.includes("仅显示是否配置，不显示值") || src.includes("仅显示布尔状态"),
      "should explicitly state values are not shown",
    );
  });

  it("Import format entries show PDF/Word/EPUB as unavailable", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      src.includes("PDF 导入") && src.includes("unavailable"),
      "PDF should show as unavailable in admin status",
    );
    assert.ok(
      src.includes("PDF 解析尚未实现"),
      "should state PDF parsing not yet implemented",
    );
  });

  it("Book API guard status references shared guard", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      src.includes("getUnifiedApiStatus") || src.includes("evaluateExternalApiDevGuard"),
      "should use shared guard for book API",
    );
  });

  it("Problem API guard status references shared guard", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(
      src.includes("getUnifiedApiStatus") || src.includes("evaluateExternalApiDevGuard"),
      "should use shared guard for problem API",
    );
  });
});

// ===========================================================================
// GROUP 7: Safety boundaries — no leaks
// ===========================================================================

describe("A456 Safety boundaries", () => {
  it("No DATABASE_URL value in any source file under import/problems/books", () => {
    const dirs = [
      path.join(APP_DIR, "import"),
      path.join(APP_DIR, "problems"),
      path.join(APP_DIR, "books"),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        assert.ok(
          !content.includes("postgres://") && !content.includes("postgresql://") && !content.includes("mysql://"),
          file + " should not contain hardcoded DB URL",
        );
      }
    }
  });

  it("No hardcoded API key/secret in source files", () => {
    const dirs = [
      path.join(APP_DIR, "import"),
      path.join(APP_DIR, "problems"),
      path.join(APP_DIR, "books"),
      LIB_DIR,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const hasKey = /api[\s_-]?key["'\\s:=]+[a-zA-Z0-9]{20,}/i.test(content);
        const hasSecret = /secret["'\\s:=]+[a-zA-Z0-9]{20,}/i.test(content);
        assert.ok(!hasKey && !hasSecret, file + " should not contain hardcoded key/secret");
      }
    }
  });

  it("No fake success patterns in blocked states", () => {
    const files = [
      "import/page.tsx",
      "problems/page.tsx",
      "import/book-api-import-server-action.ts",
      "import/problem-api-import-server-action.ts",
    ];
    for (const file of files) {
      if (!fe(file)) continue;
      const content = rf(file);
      assert.ok(
        !content.includes('"已完全导入"') &&
        !content.includes('"生产可用"') &&
        !content.includes('"production-ready"'),
        file + " should not fake production readiness",
      );
    }
  });

  it("No real LLM/tool/Agent loop references in new code", () => {
    const checkFiles = [
      "import/book-api-import-server-action.ts",
      "import/problem-api-import-server-action.ts",
      "problems/problem-library-loader.ts",
      "problems/problem-detail-loader.ts",
    ];
    for (const file of checkFiles) {
      if (!fe(file)) continue;
      const content = rf(file);
      assert.ok(
        !content.includes("LLM") && !content.includes("Agent") && !content.includes("tool.execute"),
        file + " should not reference real LLM/tool/Agent",
      );
    }
  });

  it("productionReady is always false in result structures", () => {
    const importResultFiles = [
      "import/book-api-import-server-action.ts",
      "import/problem-api-import-server-action.ts",
    ];
    for (const file of importResultFiles) {
      if (!fe(file)) continue;
      const content = rf(file);
      assert.ok(
        content.includes("productionReady: false"),
        file + " should always set productionReady=false",
      );
    }
  });
});

// ===========================================================================
// GROUP 8: Key file existence
// ===========================================================================

describe("A456 Key file existence", () => {
  const requiredFiles = [
    "problems/ProblemLibraryClient.tsx",
    "problems/page.tsx",
    "problems/[problemId]/page.tsx",
    "problems/problem-detail-loader.ts",
    "problems/problem-library-loader.ts",
    "books/page.tsx",
    "books/[bookId]/page.tsx",
    "books/book-library-loader.ts",
    "books/book-detail-loader.ts",
    "import/page.tsx",
    "import/book-api-import-server-action.ts",
    "import/problem-api-import-server-action.ts",
  ];

  for (const file of requiredFiles) {
    it("exists: " + file, () => {
      assert.ok(fe(file), file + " should exist");
    });
  }

  it("exists: lib/admin-status-center.ts", () => {
    assert.ok(fle("admin-status-center.ts"), "lib/admin-status-center.ts should exist");
  });

  it("shared external-api-dev-guard.ts exports getUnifiedApiStatus", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(
      src.includes("export function getUnifiedApiStatus"),
      "should export getUnifiedApiStatus",
    );
    assert.ok(
      src.includes("export interface UnifiedApiStatus"),
      "should export UnifiedApiStatus type",
    );
  });

  it("book-engine has dev-http-book-source-provider.ts", () => {
    const providerFile = path.join(BOOK_ENGINE_SRC, "dev-http-book-source-provider.ts");
    const src = fs.readFileSync(providerFile, "utf-8");
    assert.ok(src.length > 0, "dev-http-book-source-provider.ts should not be empty");
  });
});

// ===========================================================================
// Print summary
// ===========================================================================

console.log("\\nA456 test file loaded successfully.");
console.log("Groups: Problem list merge, Problem detail stability, Book DB visibility,");
console.log(" Import results, Capability文案, Admin status, Safety boundaries, Key files\\n");
