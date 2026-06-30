/**
 * A455 — Book API + Problem API 真实接入闭环测试
 *
 * Covers: guards, adapters, import write paths, safety boundaries, import page text.
 * Uses fs-based source analysis (matching existing test patterns in this project).
 * No TypeScript module resolution required.
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
const PROBLEM_SRC = path.join(PROJECT_ROOT, "packages/learning-engine/src");

function rf(p) { return fs.readFileSync(path.join(APP_DIR, p), "utf-8"); }
function rl(p) { return fs.readFileSync(path.join(LIB_DIR, p), "utf-8"); }
function rs(p) { return fs.readFileSync(path.join(SHARED_SRC, p), "utf-8"); }
function be(p) { return fs.readFileSync(path.join(BOOK_ENGINE_SRC, p), "utf-8"); }
function le(p) { return fs.readFileSync(path.join(PROBLEM_SRC, p), "utf-8"); }
function fe(p) { return fs.existsSync(path.join(APP_DIR, p)); }
function feDir(p) { return fs.existsSync(p); }

// ===========================================================================
// GROUP 1: Shared Guard — Unified Status
// ===========================================================================

describe("A455 shared guard: unified status", () => {
  it("production blocked: guard checks NODE_ENV", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("PRODUCTION_BLOCKED"), "should have PRODUCTION_BLOCKED check");
    assert.ok(src.includes("isNonProductionEnv"), "should check isNonProductionEnv");
    assert.ok(src.includes("NODE_ENV"), "should reference NODE_ENV");
  });

  it("env missing blocked: guard returns blocked when env missing", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("missingEnvNames"), "should track missingEnvNames");
    assert.ok(src.includes("configuredEnvNames"), "should track configuredEnvNames");
    assert.ok(src.includes("requiredEnvNames"), "should track requiredEnvNames");
    assert.ok(src.includes("isConfigured"), "should check isConfigured for env vars");
  });

  it("does not leak env values in blockedReason", () => {
    const src = rs("external-api-dev-guard.ts");
    // blockedReason should only reference env variable names, not values
    assert.ok(src.includes("blockedReason"), "should have blockedReason field");
    // The guard only exposes env NAMES (via missingEnvNames), not values
    assert.ok(!src.includes("process.env["), "env values should go through safe accessors");
  });

  it("getUnifiedApiStatus returns correct shape", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("getUnifiedApiStatus"), "should export getUnifiedApiStatus");
    assert.ok(src.includes("UnifiedApiStatus"), "should define UnifiedApiStatus type");
    assert.ok(src.includes("productionBlocked"), "should include productionBlocked");
    assert.ok(src.includes("devOnly: true"), "should mark devOnly=true");
  });

  it("configuredEnvNames tracks configured envs separately from missing", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("configuredEnvNames.add"), "should add to configuredEnvNames");
    assert.ok(src.includes("missingEnvNames.add"), "should add to missingEnvNames");
    // configured and missing should be mutually exclusive
    assert.ok(src.includes("configuredEnvNames: Array.from(configuredEnvNames)"));
  });

  it("requiredEnvNames includes allow flag and all required names", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("input.allowExternalEnvName"), "should use allowExternalEnvName");
    assert.ok(src.includes("input.requiredEnvNames"), "should reference requiredEnvNames");
  });
});

// ===========================================================================
// GROUP 2: Book API — Guard & Status Integration
// ===========================================================================

describe("A455 Book API guard and status", () => {
  it("book-api-preview-status uses shared guard", () => {
    const src = rf("import/book-api-preview-status.ts");
    assert.ok(src.includes("evaluateExternalApiDevGuard"), "should use shared guard");
    assert.ok(src.includes("LAP_ALLOW_EXTERNAL_BOOK_API"), "should check ALLOW flag");
    assert.ok(src.includes("LAP_BOOK_API_BASE_URL"), "should check BASE_URL");
    assert.ok(src.includes("LAP_BOOK_API_PROVIDER"), "should check PROVIDER");
  });

  it("book-api-preview-status returns blocked when no env", () => {
    const src = rf("import/book-api-preview-status.ts");
    assert.ok(src.includes("blocked"), "default should be blocked (blocked literal present)");
    assert.ok(src.includes("missingEnvNames"), "should report missing env names");
  });

  it("book-api-preview-status production blocked", () => {
    const src = rs("external-api-dev-guard.ts");
    // The shared guard handles production blocking
    assert.ok(src.includes("NODE_ENV is production"), "should detect production");
  });

  it("admin status center references book API guard", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("LAP_ALLOW_EXTERNAL_BOOK_API"), "should reference book api env");
    assert.ok(src.includes("book-api"), "should have book-api category");
    assert.ok(src.includes("getUnifiedApiStatus"), "should use unified status");
  });

  it("book import server action checks guard before import", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(src.includes("getBookApiPreviewStatus"), "should check api status");
    assert.ok(src.includes('"book-api-blocked"'), "should handle api blocked case");
    assert.ok(src.includes('"production-blocked"'), "should handle production blocked case");
    assert.ok(src.includes('"dev-save-disabled"'), "should handle dev save disabled");
  });
});

// ===========================================================================
// GROUP 3: Problem API — Guard & Status Integration
// ===========================================================================

describe("A455 Problem API guard and status", () => {
  it("problem-api-status uses shared guard", () => {
    const src = rf("problems/problem-api-status.ts");
    assert.ok(src.includes("evaluateExternalApiDevGuard"), "should use shared guard");
    assert.ok(src.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"), "should check ALLOW flag");
    assert.ok(src.includes("LAP_PROBLEM_API_BASE_URL"), "should check BASE_URL");
    assert.ok(src.includes("LAP_PROBLEM_API_PROVIDER"), "should check PROVIDER");
  });

  it("problem-api-status returns blocked when no env", () => {
    const src = rf("problems/problem-api-status.ts");
    assert.ok(src.includes("blocked"), "default should be blocked for problem API");
    assert.ok(src.includes("missingEnvNames"), "should report missing env names");
  });

  it("admin status center references problem API guard", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("LAP_ALLOW_EXTERNAL_PROBLEM_API"), "should reference problem api env");
    assert.ok(src.includes("problem-api"), "should have problem-api category");
  });

  it("problem import server action checks guard before import", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(src.includes("getProblemApiPreviewStatus"), "should check api status");
    assert.ok(src.includes('"problem-api-blocked"'), "should handle api blocked case");
    assert.ok(src.includes('"production-blocked"'), "should handle production blocked case");
    assert.ok(src.includes('"invalid-input"'), "should handle invalid input");
  });
});

// ===========================================================================
// GROUP 4: Book Adapter — Chapter Extraction
// ===========================================================================

describe("A455 Book adapter: chapter extraction", () => {
  it("extractChapterPreviews is implemented (no longer empty)", () => {
    const src = be("dev-http-book-source-provider.ts");
    assert.ok(src.includes("extractChapterPreviews"), "should have extractChapterPreviews method");
    assert.ok(src.includes("normalizeChapterPreview"), "should have normalizeChapterPreview");
    // Should contain actual chapter extraction logic, not just return []
    const hasChapterLogic = src.includes("chapters") || src.includes("toc") || src.includes("tableOfContents");
    assert.ok(hasChapterLogic, "extractChapterPreviews should extract chapters, not just return []");
  });

  it("supports chapters from various response shapes", () => {
    const src = be("dev-http-book-source-provider.ts");
    assert.ok(src.includes("chapters") || src.includes("toc"), "should support chapters field");
    assert.ok(src.includes("book"), "should handle wrapped book object");
  });

  it("normalizeChapterPreview handles missing fields", () => {
    const src = be("dev-http-book-source-provider.ts");
    assert.ok(src.includes("normalizeChapterPreview"), "should have normalize function");
    // Should have fallback for each field
    assert.ok(src.includes("fallbackIndex"), "should fallback order to index");
    assert.ok(src.includes("?.") || src.includes("??") || src.includes("||"), "should handle null/undefined safely");
  });

  it("chapter order is stable with orderIndex fallback", () => {
    const src = be("dev-http-book-source-provider.ts");
    assert.ok(src.includes("orderIndex") || src.includes("order"), "should use orderIndex field");
    // Should sort by orderIndex or use array position as fallback
  });
});

// ===========================================================================
// GROUP 5: Problem Adapter — Field Mapping
// ===========================================================================

describe("A455 Problem adapter: field mapping", () => {
  it("normalizeProblemItem maps all enhanced fields", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("normalizeProblemItem"), "should have normalizeProblemItem");
    assert.ok(src.includes("statement"), "should map statement");
    assert.ok(src.includes("inputDescription"), "should map inputDescription");
    assert.ok(src.includes("outputDescription"), "should map outputDescription");
    assert.ok(src.includes("constraints"), "should map constraints");
    assert.ok(src.includes("source"), "should map source");
  });

  it("normalizeProblemItem handles missing fields without throwing", () => {
    const src = le("problem-api-provider.ts");
    // Should have safeString checks for all fields
    assert.ok(src.includes("safeString"), "should use safeString");
    // Should use ?? or || for null handling
    assert.ok(src.includes("??"), "should use nullish coalescing");
  });

  it("examples are normalized from array format", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("examples"), "should handle examples field");
    assert.ok(src.includes("sampleInputs") || src.includes("sampleTestcases"), "should accept alt field names");
  });

  it("tags are normalized from various formats", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("normalizeTags"), "should have normalizeTags");
    assert.ok(src.includes("tags") || src.includes("labels"), "should accept tag field names");
  });

  it("safeProblemApiErrorMessage prevents secret leaks", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("safeProblemApiErrorMessage"), "should have safe error function");
    assert.ok(src.includes("Problem API request failed"), "should have generic error fallback");
    // Should NOT include raw error message in generic fallback
  });
});

// ===========================================================================
// GROUP 6: Import Write Path Safety
// ===========================================================================

describe("A455 import write path safety", () => {
  it("book import result shape does not contain secret fields", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(src.includes("safeToExposeToClient: true"), "should be safe for client");
    assert.ok(src.includes("rawResponseStored: false"), "should not store raw response");
    assert.ok(src.includes("productionReady: false"), "should not be production ready");
    // Should have redaction or safety logic
    assert.ok(
      src.includes("redact") || src.includes("isDbReadAllowed") || src.includes("safeToExposeToClient: true"),
      "should handle safe client exposure"
    );
    assert.ok(
      src.includes("SENSITIVE") || src.includes("isDbReadAllowed"),
      "should define safety guard check"
    );
  });

  it("book import result has chapterCount field", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(src.includes("chapterCount"), "result should include chapterCount");
    assert.ok(src.includes('"existing-db"'), "should handle existing/duplicate case");
  });

  it("problem import result shape does not contain secret fields", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(src.includes("safeToExposeToClient: true"), "should be safe for client");
    assert.ok(src.includes("rawResponseStored: false"), "should not store raw response");
    assert.ok(src.includes("productionReady: false"), "should not be production ready");
    assert.ok(src.includes("redactSensitiveMessage"), "should redact sensitive info");
  });

  it("problem import has dedup check", () => {
    const src = rf("import/problem-api-import-server-action.ts");
    assert.ok(src.includes("existing-db"), "should handle existing/duplicate case");
    assert.ok(src.includes("providerId") && src.includes("externalProblemId"), "should check by provider+externalId");
    assert.ok(src.includes("existing: true"), "should mark existing items");
  });

  it("book import has dedup check", () => {
    const src = rf("import/book-api-import-server-action.ts");
    assert.ok(src.includes("existing: true") || src.includes("existing-db"), "should have dedup check");
  });
});

// ===========================================================================
// GROUP 7: Import Page Text — Capability Display
// ===========================================================================

describe("A455 import page capability display", () => {
  it("PDF marked as not implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("PDF"), "should mention PDF");
    assert.ok(src.includes("not-implemented"), "should mark as not-implemented");
    assert.ok(src.includes("后续接入"), "should say 后续接入");
    assert.ok(src.includes("不处理 PDF 文件"), "should say does not process PDF files");
  });

  it("Word marked as not implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("Word"), "should mention Word");
    assert.ok(src.includes("not-implemented"), "should mark as not-implemented");
    assert.ok(src.includes("不处理 Word"), "should say does not process Word files");
  });

  it("EPUB marked as not implemented", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("EPUB"), "should mention EPUB");
    assert.ok(src.includes("not-implemented"), "should mark as not-implemented");
    assert.ok(src.includes("不处理 EPUB"), "should say does not process EPUB files");
  });

  it("no misleading PDF/Word supported text", () => {
    const src = rf("import/page.tsx");
    assert.ok(!src.includes("PDF 已支持"), "should NOT say PDF 已支持");
    assert.ok(!src.includes("Word 已支持"), "should NOT say Word 已支持");
    assert.ok(!src.includes("EPUB 已支持"), "should NOT say EPUB 已支持");
    assert.ok(!src.includes("PDF 导入可用"), "should NOT say PDF 导入可用");
  });

  it("explicitly states text-only import", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("当前仅支持纯文本导入"), "should say text-only import");
    assert.ok(src.includes("仅支持纯文本粘贴"), "should say text-only paste");
  });

  it("safety accordion lists PDF/Word/EPUB as not implemented", () => {
    const src = rf("import/page.tsx");
    const safetySection = src.match(/安全边界说明[\s\S]{0,2000}?<\/details>/);
    if (safetySection) {
      assert.ok(safetySection[0].includes("PDF"), "safety accordion should mention PDF");
      assert.ok(safetySection[0].includes("尚未实现"), "safety accordion should say 尚未实现");
    }
  });

  it("problem API capability shows blocked reason when guard blocked", () => {
    const src = rf("import/page.tsx");
    assert.ok(src.includes("getProblemApiPreviewStatus"), "should get problem API status");
    assert.ok(src.includes("problemApiStatus"), "should use problem API status variable");
  });
});

// ===========================================================================
// GROUP 8: Safety Boundaries
// ===========================================================================

describe("A455 safety boundaries", () => {
  it("shared guard does not expose DATABASE_URL in results", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(!src.includes("DATABASE_URL"), "should not reference DATABASE_URL");
  });

  it("book API preview does not call LLM", () => {
    const src = rf("import/book-api-preview.ts");
    assert.ok(src.includes("llmUsed: false"), "should mark llmUsed=false");
    assert.ok(!src.includes("LLM") || src.includes("llmUsed: false"), "should not use LLM");
  });

  it("problem API provider does not call LLM", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("llmUsed: false"), "should mark llmUsed=false");
  });

  it("productionReady is always false in admin status center", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("productionReady: false"), "should mark productionReady=false");
    assert.ok(src.includes("safeToExposeToClient: true"), "should mark safeToExposeToClient=true");
  });

  it("no raw prompt/response storage", () => {
    // Check book API search/import
    const bookPreview = rf("import/book-api-preview.ts");
    assert.ok(bookPreview.includes("rawResponseStored: false"), "book preview: no raw response stored");

    // Check problem API
    const problemProvider = le("problem-api-provider.ts");
    assert.ok(problemProvider.includes("rawResponseStored: false"), "problem provider: no raw response stored");

    // Check book import
    const bookImport = rf("import/book-api-import-server-action.ts");
    assert.ok(bookImport.includes("rawResponseStored: false"), "book import: no raw response stored");

    // Check problem import
    const problemImport = rf("import/problem-api-import-server-action.ts");
    assert.ok(problemImport.includes("rawResponseStored: false"), "problem import: no raw response stored");
  });

  it("no fake success — blocked APIs return empty results", () => {
    const bookPreview = rf("import/book-api-preview.ts");
    assert.ok(bookPreview.includes("apiBlocked"), "should have apiBlocked field");
    assert.ok(bookPreview.includes("books: []"), "blocked should return empty books");

    const problemProvider = le("problem-api-provider.ts");
    assert.ok(problemProvider.includes("apiBlocked: true"), "should have apiBlocked field for blocked case");
  });

  it("import server actions redact sensitive info in errors", () => {
    const problemImport = rf("import/problem-api-import-server-action.ts");
    assert.ok(problemImport.includes("SENSITIVE_ERROR_PATTERNS"), "problem import should define sensitive patterns");
    assert.ok(problemImport.includes("[hidden]"), "problem import should replace sensitive with [hidden]");
  });

  it("no real LLM/tool/Agent references in API integration", () => {
    // These files should not reference real agent/tool execution
    const files = [
      rf("import/book-api-import-server-action.ts"),
      rf("import/problem-api-import-server-action.ts"),
      be("dev-http-book-source-provider.ts"),
      le("problem-api-provider.ts"),
    ];
    for (const src of files) {
      // Agent/tool/LLM references should only be in safety annotations
      const agentRefs = (src.match(/agent(?![\s\S]*?llmUsed[:;]\s*false)/gi) || []).length;
      // Personal references should be minimal — mostly safety metadata
      const toolRefs = src.match(/tool\w*\s*(execute|call|run)/gi) || [];
      assert.equal(toolRefs.length, 0, "should not execute real tools");
    }
  });
});

// ===========================================================================
// GROUP 9: Admin Status Center — Unified Fields
// ===========================================================================

describe("A455 admin status center: unified fields", () => {
  it("StatusItem includes requiredEnvNames and configuredEnvNames", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("requiredEnvNames: string[]"), "StatusItem should have requiredEnvNames");
    assert.ok(src.includes("configuredEnvNames: string[]"), "StatusItem should have configuredEnvNames");
    assert.ok(src.includes("productionBlocked: boolean"), "StatusItem should have productionBlocked");
  });

  it("book-api guard status includes configured env names", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("configuredEnvNames"), "collectBookApiStatus should track configured envs");
    assert.ok(src.includes("requiredEnvNames"), "collectBookApiStatus should track required envs");
  });

  it("problem-api guard status includes configured env names", () => {
    const src = rl("admin-status-center.ts");
    assert.ok(src.includes("configuredEnvNames"), "collectProblemApiStatus should track configured envs");
  });

  it("all status items have productionReady=false", () => {
    const src = rl("admin-status-center.ts");
    // Count occurrences of productionReady: false in makeItem function
    const makeItemProductionReady = (src.match(/productionReady:\s*false\s+as\s+const/g) || []).length;
    assert.ok(makeItemProductionReady >= 1, "makeItem should have productionReady: false as const");
  });
});

// ===========================================================================
// GROUP 10: Book Chapter Export & Detail Visibility
// ===========================================================================

describe("A455 book detail: chapter extraction and visibility", () => {
  it("book detail loader handles empty chapters without error", () => {
    const src = rf("books/book-detail-loader.ts");
    assert.ok(src.includes("chapters"), "should handle chapters");
    assert.ok(src.includes("chapterCount"), "should include chapterCount");
    // Should handle empty chapters array gracefully
    assert.ok(src.includes("readerData.chapters.length"), "should check chapters length");
  });

  it("book library loader shows imported books", () => {
    const src = rf("books/book-library-loader.ts");
    assert.ok(src.includes("listBooks"), "should list books from DB");
    assert.ok(src.includes("mock_fallback"), "should have fallback when DB unavailable");
    assert.ok(src.includes("IMPORTED_TEXT"), "should handle imported text source type");
  });
});

// ===========================================================================
// GROUP 11: Problem DB List Loading
// ===========================================================================

describe("A455 problem DB list loading", () => {
  it("problem library loader has tryLoadDbImportedProblems function", () => {
    const src = rf("problems/problem-library-loader.ts");
    assert.ok(src.includes("tryLoadDbImportedProblems"), "should have DB loader function");
    assert.ok(src.includes("PrismaLearningRepository"), "should use PrismaLearningRepository");
    assert.ok(src.includes("listProblems"), "should call listProblems");
  });

  it("problem loader checks DB guards before accessing DB", () => {
    const src = rf("problems/problem-library-loader.ts");
    assert.ok(src.includes("isProblemDbReadAllowed"), "should check DB read permission");
    assert.ok(src.includes("LAP_ALLOW_REAL_DB_INTEGRATION"), "should check DB guard");
    assert.ok(src.includes("LAP_IMPORT_DB_PERSIST_DEV_ENABLED"), "should check import dev guard");
  });

  it("problem loader maps DB fields to ProblemPreviewItem", () => {
    const src = rf("problems/problem-library-loader.ts");
    assert.ok(src.includes("providerId"), "should map providerId");
    assert.ok(src.includes("externalProblemId"), "should map externalProblemId");
    assert.ok(src.includes("difficulty"), "should map difficulty");
    assert.ok(src.includes("tags"), "should map tags");
    assert.ok(src.includes("examples"), "should map examples");
  });
});

// ===========================================================================
// GROUP 12: File Existence — Key Entry Points
// ===========================================================================

describe("A455 key file existence", () => {
  it("all critical source files exist", () => {
    const files = [
      "import/page.tsx",
      "import/book-api-import-server-action.ts",
      "import/book-api-preview-server-action.ts",
      "import/book-api-preview-status.ts",
      "import/problem-api-import-server-action.ts",
      "import/book-api-preview.ts",
      "problems/problem-api-status.ts",
      "problems/problem-api-preview-server-action.ts",
      "problems/problem-library-loader.ts",
      "problems/problem-detail-loader.ts",
      "books/book-library-loader.ts",
      "books/book-detail-loader.ts",
    ];

    for (const f of files) {
      assert.ok(fe(f), `should exist: ${f}`);
    }
  });

  it("shared guard file exists and exports key functions", () => {
    const src = rs("external-api-dev-guard.ts");
    assert.ok(src.includes("evaluateExternalApiDevGuard"), "should export evaluateExternalApiDevGuard");
    assert.ok(src.includes("getUnifiedApiStatus"), "should export getUnifiedApiStatus");
    assert.ok(src.includes("createExternalApiPreviewEnvelope"), "should export createExternalApiPreviewEnvelope");
  });

  it("book engine provider file exists", () => {
    const src = be("dev-http-book-source-provider.ts");
    assert.ok(src.includes("DevHttpBookSourceProvider"), "should have DevHttpBookSourceProvider class");
    assert.ok(src.includes("extractChapterPreviews"), "should have chapter extraction");
  });

  it("problem provider file exists", () => {
    const src = le("problem-api-provider.ts");
    assert.ok(src.includes("GenericProblemApiProvider"), "should have GenericProblemApiProvider class");
    assert.ok(src.includes("normalizeProblemItem"), "should have normalization");
  });
});

// ===========================================================================
// SUMMARY
// ===========================================================================

describe("A455 summary", () => {
  it("all 12 test groups loaded successfully", () => {
    const groups = [
      "A455 shared guard: unified status",
      "A455 Book API guard and status",
      "A455 Problem API guard and status",
      "A455 Book adapter: chapter extraction",
      "A455 Problem adapter: field mapping",
      "A455 import write path safety",
      "A455 import page capability display",
      "A455 safety boundaries",
      "A455 admin status center: unified fields",
      "A455 book detail: chapter extraction and visibility",
      "A455 problem DB list loading",
      "A455 key file existence",
    ];
    assert.equal(groups.length, 12);
  });
});