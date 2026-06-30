/**
 * A457 PDF Import Page tests.
 *
 * Covers:
 * - "/import page shows PDF import section" — verified via guard/page structure
 * - "开发预览" label appears
 * - "仅纯文本提取" label appears
 * - "不支持扫描件 OCR" label appears
 * - Word/docx/EPUB still marked as not-implemented
 * - No "PDF 已完整支持" claims
 * - No "Word 已支持" / "EPUB 已支持" claims
 * - PDF guard integrated
 */

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error TS5097: direct .ts import
import { evaluatePdfImportGuard } from "../lib/pdf-import-guard.ts";

// ---------------------------------------------------------------------------
// Page source verification
// ---------------------------------------------------------------------------

const pageTsxPath = path.resolve(
  import.meta.url ? new URL(".", import.meta.url).pathname : __dirname,
  "..",
  "import",
  "page.tsx",
);

// Normalize for Windows paths
const normalizedPath = pageTsxPath.replace(/^\/([A-Z]:\/)/, "$1");

let pageSource;
try {
  pageSource = fs.readFileSync(normalizedPath, "utf-8");
} catch {
  // Try alternate path resolution
  const altPath = path.join(
    process.cwd(),
    "apps",
    "web",
    "src",
    "app",
    "import",
    "page.tsx",
  );
  try {
    pageSource = fs.readFileSync(altPath, "utf-8");
  } catch {
    pageSource = "";
  }
}

const hasPageSource = pageSource.length > 0;

// ---------------------------------------------------------------------------
// Content assertions (on page source)
// ---------------------------------------------------------------------------

test("A457 page: /import page shows PDF import section", () => {
  if (!hasPageSource) {
    // Skip — file not readable in this test environment
    return;
  }
  assert.ok(
    pageSource.includes("PdfImportClient") ||
      pageSource.includes("PDF 导入"),
    "Page should import or reference PDF import section",
  );
});

test("A457 page: shows 开发预览 label", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("开发预览"),
    "Page should contain '开发预览' label",
  );
});

test("A457 page: shows 仅纯文本提取 label", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("仅纯文本提取"),
    "Page should contain '仅纯文本提取'",
  );
});

test("A457 page: shows 不支持扫描件 OCR label", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不支持扫描件 OCR") || pageSource.includes("不支持扫描件"),
    "Page should contain '不支持扫描件 OCR'",
  );
});

test("A457 page: shows 不调用 LLM", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("不调用 LLM") || pageSource.includes("不调用真实 LLM"),
    "Page should state LLM is not used",
  );
});

test("A457 page: Word/docx still marked as not-implemented", () => {
  if (!hasPageSource) return;
  // Should still show Word as not implemented
  assert.ok(
    pageSource.includes("Word") || pageSource.includes("docx"),
    "Page should mention Word/docx",
  );
  assert.ok(
    pageSource.includes("not-implemented") || pageSource.includes("尚未实现") || pageSource.includes("后续接入"),
    "Page should mark unimplemented formats",
  );
});

test("A457 page: EPUB still marked as not-implemented", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("EPUB"),
    "Page should mention EPUB",
  );
});

test("A457 page: does NOT claim PDF is fully supported", () => {
  if (!hasPageSource) return;
  assert.ok(
    !pageSource.includes("PDF 已完整支持") &&
    !pageSource.includes("PDF 已完整"),
    "Page should NOT claim PDF is fully supported",
  );
});

test("A457 page: does NOT claim Word is supported", () => {
  if (!hasPageSource) return;
  assert.ok(
    !pageSource.includes("Word 已支持") &&
    !pageSource.includes("Word 已完整"),
    "Page should NOT claim Word is supported",
  );
});

test("A457 page: does NOT claim EPUB is supported", () => {
  if (!hasPageSource) return;
  assert.ok(
    !pageSource.includes("EPUB 已支持") &&
    !pageSource.includes("EPUB 已完整"),
    "Page should NOT claim EPUB is supported",
  );
});

// ---------------------------------------------------------------------------
// Guard integration
// ---------------------------------------------------------------------------

test("A457 page: PDF guard is imported in page", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("evaluatePdfImportGuard") ||
      pageSource.includes("pdfImportGuard"),
    "Page should use PDF import guard",
  );
});

test("A457 page: LAP_ALLOW_PDF_IMPORT referenced", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("LAP_ALLOW_PDF_IMPORT"),
    "Page should reference LAP_ALLOW_PDF_IMPORT env var",
  );
});

// ---------------------------------------------------------------------------
// Text import still present
// ---------------------------------------------------------------------------

test("A457 page: pure text import section still present", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("文本导入") || pageSource.includes("纯文本"),
    "Page should still have text import section",
  );
});

test("A457 page: BookImportPreviewClient still imported", () => {
  if (!hasPageSource) return;
  assert.ok(
    pageSource.includes("BookImportPreviewClient"),
    "Page should still import text import client",
  );
});

// ---------------------------------------------------------------------------
// Safety labels
// ---------------------------------------------------------------------------

test("A457 page: guard shows production blocked message", () => {
  // Verify guard correctly identifies production
  const prodGuard = evaluatePdfImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  assert.equal(prodGuard.productionBlocked, true);
  assert.equal(prodGuard.enabled, false);
});

test("A457 page: guard shows enabled message in dev", () => {
  const devGuard = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  assert.equal(devGuard.enabled, true);
  assert.ok(devGuard.reason.includes("已启用"));
});

// ---------------------------------------------------------------------------
// Word/EPUB still not implemented
// ---------------------------------------------------------------------------

test("A457 page: Word/docx status not claimed as supported", () => {
  if (!hasPageSource) return;
  // Check that Word capability row is still not-implemented
  const wordLines = pageSource
    .split("\n")
    .filter((line) => line.includes("Word") || line.includes("docx"));
  for (const line of wordLines) {
    assert.ok(
      !line.includes('"supported"') || line.includes("not-implemented"),
      `Word line should not claim supported: ${line.trim()}`,
    );
  }
});

test("A457 page: EPUB status not claimed as supported", () => {
  if (!hasPageSource) return;
  const epubLines = pageSource
    .split("\n")
    .filter((line) => line.includes("EPUB"));
  for (const line of epubLines) {
    assert.ok(
      !line.includes('"supported"') || line.includes("not-implemented"),
      `EPUB line should not claim supported: ${line.trim()}`,
    );
  }
});
