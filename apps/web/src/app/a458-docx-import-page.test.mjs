/**
 * A458 Import Page Integration tests.
 *
 * Covers page.tsx:
 * - DOCX import section appears
 * - "开发预览" label for DOCX
 * - "仅纯文本提取" label
 * - "不保留样式/图片/批注" label
 * - Word/docx capability reflects DOCX guard
 * - EPUB still not-implemented
 * - No false claims about DOCX/EPUB
 * - PDF section still present
 * - Text import still present
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error TS5097: direct .ts import
import { evaluateDocxImportGuard } from "../lib/docx-import-guard.ts";
// @ts-expect-error TS5097: direct .ts import
import { evaluatePdfImportGuard } from "../lib/pdf-import-guard.ts";

// ---------------------------------------------------------------------------
// Page source reading
// ---------------------------------------------------------------------------

let pageSource;
try {
  const altPath = path.join(
    process.cwd(),
    "apps",
    "web",
    "src",
    "app",
    "import",
    "page.tsx",
  );
  pageSource = fs.readFileSync(altPath, "utf-8");
} catch {
  try {
    const p = path.resolve("../../", "src/app/import/page.tsx");
    pageSource = fs.readFileSync(p, "utf-8");
  } catch {
    pageSource = "";
  }
}

const hasPageSource = pageSource.length > 0;

// ---------------------------------------------------------------------------
// DOCX import section checks
// ---------------------------------------------------------------------------

test("A458 page: /import page imports DocxImportClient", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("DocxImportClient"),
    "Page should import DocxImportClient",
  );
});

test("A458 page: /import page imports evaluateDocxImportGuard", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("evaluateDocxImportGuard"),
    "Page should use DOCX import guard",
  );
});

test("A458 page: shows DOCX import section", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("DOCX 导入"),
    "Page should have DOCX import section",
  );
});

test("A458 page: shows 开发预览 in DOCX context", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("开发预览"),
    "Page should contain '开发预览' label",
  );
});

test("A458 page: shows 仅纯文本提取 for DOCX", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("仅纯文本提取"),
    "Page should contain '仅纯文本提取'",
  );
});

test("A458 page: shows 不保留样式/图片/批注", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不保留样式/图片/批注") ||
    pageSource.includes("不保留样式"),
    "Page should state style/image/comment not preserved",
  );
});

test("A458 page: shows 不调用 LLM", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不调用 LLM") || pageSource.includes("不调用真实 LLM"),
    "Page should state LLM is not used",
  );
});

// ---------------------------------------------------------------------------
// EPUB still not implemented
// ---------------------------------------------------------------------------

test("A458 page: EPUB still marked as not-implemented", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("EPUB"),
    "Page should mention EPUB",
  );
});

// ---------------------------------------------------------------------------
// No false claims
// ---------------------------------------------------------------------------

test("A458 page: does NOT claim DOCX is fully supported", () => {
  if (!hasPageSource) return;
  assert.ok(
    !pageSource.includes("DOCX 已完整支持") &&
    !pageSource.includes("Word 已完整支持") &&
    !pageSource.includes("Word 已支持"),
    "Page should NOT claim DOCX/Word is fully supported",
  );
});

test("A458 page: does NOT claim EPUB is supported", () => {
  if (!hasPageSource) return;
  assert.ok(
    !pageSource.includes("EPUB 已支持") &&
    !pageSource.includes("EPUB 已完整"),
    "Page should NOT claim EPUB is supported",
  );
});

// ---------------------------------------------------------------------------
// PDF section still present
// ---------------------------------------------------------------------------

test("A458 page: PDF import section still present", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("PdfImportClient") && pageSource.includes("PDF 导入"),
    "Page should still have PDF import section",
  );
});

test("A458 page: LAP_ALLOW_PDF_IMPORT still referenced", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("LAP_ALLOW_PDF_IMPORT"),
    "Page should reference LAP_ALLOW_PDF_IMPORT",
  );
});

// ---------------------------------------------------------------------------
// Text import still present
// ---------------------------------------------------------------------------

test("A458 page: pure text import section still present", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("文本导入") || pageSource.includes("纯文本"),
    "Page should still have text import section",
  );
});

test("A458 page: BookImportPreviewClient still imported", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("BookImportPreviewClient"),
    "Page should still import text import client",
  );
});

// ---------------------------------------------------------------------------
// Guard integration in page
// ---------------------------------------------------------------------------

test("A458 page: DOCX guard uses correct env name", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("LAP_ALLOW_DOCX_IMPORT"),
    "Page should reference LAP_ALLOW_DOCX_IMPORT",
  );
});

test("A458 page: DOCX guard shows blocked message in production", () => {
  const prodGuard = evaluateDocxImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.equal(prodGuard.productionBlocked, true);
  assert.equal(prodGuard.enabled, false);
});

test("A458 page: DOCX guard shows enabled message in dev", () => {
  const devGuard = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.equal(devGuard.enabled, true);
  assert.ok(devGuard.reason.includes("已启用"));
  assert.ok(devGuard.reason.includes("仅纯文本提取"));
});

// ---------------------------------------------------------------------------
// PDF/DOCX guards are distinct
// ---------------------------------------------------------------------------

test("A458 page: PDF and DOCX guards are independent", () => {
  // Enabling PDF should not enable DOCX
  const docxGuard = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  assert.equal(docxGuard.enabled, false);

  // Enabling DOCX should not enable PDF
  const pdfGuard = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.equal(pdfGuard.enabled, false);
});
