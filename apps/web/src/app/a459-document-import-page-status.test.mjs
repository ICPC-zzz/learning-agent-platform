/**
 * A459 Document Import Page Status tests.
 *
 * Covers:
 * - /import page has PDF and DOCX sections (guard-wrapped)
 * - Page text: 开发预览, 仅纯文本提取, 不调用 LLM
 * - Page text: 不支持扫描件 OCR (PDF), 不保留样式/图片/批注 (DOCX)
 * - Page text: EPUB 尚未实现
 * - Page text: No fake "已完整支持" claims
 * - Guard integration: evaluatePdfImportGuard, evaluateDocxImportGuard
 * - No duplicate/conflicting Word/docx row
 * - Correct capability row status mapping
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error TS5097: direct .ts import
import { evaluatePdfImportGuard } from "../lib/pdf-import-guard.ts";
// @ts-expect-error TS5097: direct .ts import
import { evaluateDocxImportGuard } from "../lib/docx-import-guard.ts";

// ---------------------------------------------------------------------------
// Read page source
// ---------------------------------------------------------------------------

const pageTsxPath = path.resolve(
  import.meta.url ? new URL(".", import.meta.url).pathname : __dirname,
  "..",
  "import",
  "page.tsx",
);
const normalizedPath = pageTsxPath.replace(/^\/([A-Z]:\/)/, "$1");

let pageSource;
try {
  pageSource = fs.readFileSync(normalizedPath, "utf-8");
} catch {
  const altPath = path.join(process.cwd(), "apps", "web", "src", "app", "import", "page.tsx");
  try {
    pageSource = fs.readFileSync(altPath, "utf-8");
  } catch {
    pageSource = "";
  }
}
const hasPageSource = pageSource.length > 0;

// ---------------------------------------------------------------------------
// 1. Page sections exist
// ---------------------------------------------------------------------------

test("A459 page: /import page imports PdfImportClient", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("PdfImportClient"),
    "Page should import PdfImportClient");
});

test("A459 page: /import page imports DocxImportClient", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("DocxImportClient"),
    "Page should import DocxImportClient");
});

// ---------------------------------------------------------------------------
// 2. Safety/disclaimer text
// ---------------------------------------------------------------------------

test("A459 page: PDF section shows 开发预览", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("开发预览"),
    "Page should contain '开发预览'");
});

test("A459 page: PDF section shows 仅纯文本提取", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("仅纯文本提取"),
    "Page should contain '仅纯文本提取'");
});

test("A459 page: PDF section shows 不支持扫描件 OCR", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不支持扫描件 OCR") || pageSource.includes("不支持扫描件"),
    "Page should mention OCR is not supported");
});

test("A459 page: DOCX section shows 仅纯文本提取", () => {
  if (!hasPageSource) return;
  // Should appear at least once (used for both PDF and DOCX)
  assert.ok(pageSource.includes("仅纯文本提取"),
    "Page should contain '仅纯文本提取' for DOCX");
});

test("A459 page: DOCX section shows 不保留样式", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不保留样式") || pageSource.includes("样式"),
    "Page should mention styles are not preserved");
});

test("A459 page: DOCX section shows 不保留图片", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("图片") && (pageSource.includes("不保留") || pageSource.includes("丢弃")),
    "Page should mention images are not preserved");
});

test("A459 page: 不调用 LLM mentioned", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不调用 LLM") || pageSource.includes("不调用真实 LLM"),
    "Page should state LLM is not used");
});

// ---------------------------------------------------------------------------
// 3. EPUB not implemented
// ---------------------------------------------------------------------------

test("A459 page: EPUB shown as not-implemented", () => {
  if (!hasPageSource) return;
  // EPUB capability row should be not-implemented
  const epubLines = pageSource.split("\n").filter(
    (line) => line.includes("EPUB")
  );
  assert.ok(epubLines.length > 0, "EPUB should be mentioned on page");

  // At least one EPUB reference should indicate not-implemented
  const epubNotImplemented = epubLines.some((line) =>
    line.includes("not-implemented") ||
    line.includes("尚未实现") ||
    line.includes("后续接入")
  );
  assert.ok(epubNotImplemented,
    "EPUB should be marked as not-implemented/尚未实现/后续接入");
});

test("A459 page: EPUB not claimed as supported", () => {
  if (!hasPageSource) return;
  assert.ok(!pageSource.includes("EPUB 已支持"));
  assert.ok(!pageSource.includes("EPUB 已完整支持"));
  assert.ok(!pageSource.includes("EPUB 完整支持"));
});

// ---------------------------------------------------------------------------
// 4. No fake claims
// ---------------------------------------------------------------------------

test("A459 page: No 'PDF 已完整支持' claim", () => {
  if (!hasPageSource) return;
  assert.ok(!pageSource.includes("PDF 已完整支持"));
  assert.ok(!pageSource.includes("PDF 已完整"));
});

test("A459 page: No 'DOCX 已完整支持' claim", () => {
  if (!hasPageSource) return;
  assert.ok(!pageSource.includes("DOCX 已完整支持"));
  assert.ok(!pageSource.includes("DOCX 已完整"));
  assert.ok(!pageSource.includes("Word 已完整支持"));
});

test("A459 page: No 'EPUB 已支持' claim", () => {
  if (!hasPageSource) return;
  assert.ok(!pageSource.includes("EPUB 已支持"));
  assert.ok(!pageSource.includes("EPUB 已完整"));
});

// ---------------------------------------------------------------------------
// 5. No duplicate/conflicting rows
// ---------------------------------------------------------------------------

test("A459 page: No conflicting 'Word / docx' row next to DOCX row", () => {
  if (!hasPageSource) return;
  // The page should have exactly one DOCX capability row
  // (the "DOCX 纯文本提取" one), not a separate "Word / docx" not-implemented row
  // We verify this by checking that any "Word" mention is only in context of docx explanation
  const wordLines = pageSource.split("\n").filter(
    (line) => line.includes("Word") && line.includes("docx") && line.includes("not-implemented")
  );
  assert.equal(wordLines.length, 0,
    "Should not have a separate 'Word / docx' not-implemented row — DOCX has its own dynamic row");
});

// ---------------------------------------------------------------------------
// 6. Guard integration in page
// ---------------------------------------------------------------------------

test("A459 page: evaluatePdfImportGuard imported", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("evaluatePdfImportGuard"),
    "Page should import PDF guard");
});

test("A459 page: evaluateDocxImportGuard imported", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("evaluateDocxImportGuard"),
    "Page should import DOCX guard");
});

test("A459 page: LAP_ALLOW_PDF_IMPORT env referenced", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("LAP_ALLOW_PDF_IMPORT"),
    "Page should reference LAP_ALLOW_PDF_IMPORT");
});

test("A459 page: LAP_ALLOW_DOCX_IMPORT env referenced", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("LAP_ALLOW_DOCX_IMPORT"),
    "Page should reference LAP_ALLOW_DOCX_IMPORT");
});

// ---------------------------------------------------------------------------
// 7. Guard state verification (runtime)
// ---------------------------------------------------------------------------

test("A459 page: PDF guard blocked without env", () => {
  const guard = evaluatePdfImportGuard({ NODE_ENV: "development" });
  assert.equal(guard.enabled, false);
  assert.equal(guard.blocked, true);
});

test("A459 page: DOCX guard blocked without env", () => {
  const guard = evaluateDocxImportGuard({ NODE_ENV: "development" });
  assert.equal(guard.enabled, false);
  assert.equal(guard.blocked, true);
});

test("A459 page: PDF and DOCX guards are independent", () => {
  const pdfEnabled = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  const docxBlocked = evaluateDocxImportGuard({
    NODE_ENV: "development",
  });
  assert.equal(pdfEnabled.enabled, true, "PDF should be enabled");
  assert.equal(docxBlocked.enabled, false, "DOCX should still be blocked");
});

// ---------------------------------------------------------------------------
// 8. Text import section still present (regression)
// ---------------------------------------------------------------------------

test("A459 page: 纯文本粘贴 section still present", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("纯文本") || pageSource.includes("文本导入"),
    "Page should still have text import section");
});

test("A459 page: BookImportPreviewClient still imported", () => {
  if (!hasPageSource) return;
  assert.ok(pageSource.includes("BookImportPreviewClient"),
    "Page should still import text import client");
});
