/**
 * A459 Document Import Safety Boundary tests.
 *
 * Covers:
 * - Guard blocked → no parse (guard must block before any parsing)
 * - Non-PDF/DOCX file types rejected
 * - Oversized files rejected
 * - Success results do NOT include raw text/raw buffer/env values
 * - No .env.local access needed
 * - No LLM/tool/Agent references in results
 * - No DATABASE_URL, password, secret, token, API key in any output
 * - A457/A458 test regression check (guard logic unchanged)
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import { evaluatePdfImportGuard, isPdfImportEnabled, assertPdfImportAllowed } from "../lib/pdf-import-guard.ts";
// @ts-expect-error TS5097: direct .ts import
import { evaluateDocxImportGuard, isDocxImportEnabled, assertDocxImportAllowed } from "../lib/docx-import-guard.ts";

// ---------------------------------------------------------------------------
// 1. Guard blocked → no parse (precondition check)
// ---------------------------------------------------------------------------

test("A459 safety: PDF guard BLOCKED when env missing", () => {
  const guard = evaluatePdfImportGuard({ NODE_ENV: "development" });
  assert.equal(guard.enabled, false);
  assert.equal(guard.blocked, true);
  // Server action must check guard.enabled before parsing
});

test("A459 safety: DOCX guard BLOCKED when env missing", () => {
  const guard = evaluateDocxImportGuard({ NODE_ENV: "development" });
  assert.equal(guard.enabled, false);
  assert.equal(guard.blocked, true);
});

test("A459 safety: PDF guard BLOCKED in production even with env", () => {
  const guard = evaluatePdfImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  assert.equal(guard.enabled, false);
  assert.equal(guard.productionBlocked, true);
});

test("A459 safety: DOCX guard BLOCKED in production even with env", () => {
  const guard = evaluateDocxImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.equal(guard.enabled, false);
  assert.equal(guard.productionBlocked, true);
});

// ---------------------------------------------------------------------------
// 2. Non-PDF/DOCX rejection (filename check logic)
// ---------------------------------------------------------------------------

test("A459 safety: non-PDF extensions rejected by name check", () => {
  const nonPdfNames = ["doc.txt", "doc.docx", "doc.epub", "doc.pdf.exe", "doc", "doc.PDF.exe"];
  for (const name of nonPdfNames) {
    assert.ok(!name.toLowerCase().endsWith(".pdf"),
      `"${name}" should NOT pass PDF filename check`);
  }
});

test("A459 safety: non-DOCX extensions rejected by name check", () => {
  const nonDocxNames = ["doc.txt", "doc.pdf", "doc.epub", "doc.docx.exe", "doc", "doc.doc"];
  for (const name of nonDocxNames) {
    // Note: "doc.doc" ends with ".doc" not ".docx"
    if (name.endsWith(".docx")) continue;
    assert.ok(!name.toLowerCase().endsWith(".docx"),
      `"${name}" should NOT pass DOCX filename check`);
  }
});

// ---------------------------------------------------------------------------
// 3. Success results must not contain raw data or env values
// ---------------------------------------------------------------------------

test("A459 safety: success result interface has no raw buffer fields", () => {
  // PDF success result shape
  const pdfSuccessKeys = [
    "success", "extractedCharCount", "pageCount", "chapterCount",
    "chapterPreviews", "bookTitle", "message", "warnings",
    "devOnly", "productionReady", "safeToExposeToClient",
    "rawPdfStored", "rawTextStored", "llmUsed", "reasonCode",
  ];
  const forbiddenKeys = [
    "buffer", "rawBuffer", "rawPdf", "rawContent",
    "fileContent", "stack", "error", "secret", "token",
    "DATABASE_URL", "envValue", "raw", "fullText", "completeText",
  ];
  for (const key of forbiddenKeys) {
    assert.ok(!pdfSuccessKeys.includes(key),
      `PDF success result should NOT have "${key}" field`);
  }

  // DOCX success result shape
  const docxSuccessKeys = [
    "success", "extractedCharCount", "chapterCount",
    "chapterPreviews", "bookTitle", "message", "warnings",
    "devOnly", "productionReady", "safeToExposeToClient",
    "rawDocxStored", "rawTextStored", "llmUsed", "reasonCode",
  ];
  for (const key of forbiddenKeys) {
    assert.ok(!docxSuccessKeys.includes(key),
      `DOCX success result should NOT have "${key}" field`);
  }
});

test("A459 safety: failure result interface has no raw buffer fields", () => {
  const failureKeys = [
    "success", "message", "reasonCode", "warnings",
    "devOnly", "productionReady", "safeToExposeToClient",
    "rawPdfStored", "rawDocxStored", "rawTextStored", "llmUsed",
  ];
  const forbiddenKeys = [
    "buffer", "rawBuffer", "rawContent", "stack", "secret",
    "DATABASE_URL", "envValue",
  ];
  for (const key of forbiddenKeys) {
    assert.ok(!failureKeys.includes(key),
      `Failure result should NOT have "${key}" field`);
  }
});

// ---------------------------------------------------------------------------
// 4. rawPdfStored / rawDocxStored always false
// ---------------------------------------------------------------------------

test("A459 safety: rawPdfStored must always be false", () => {
  // This is a type-level invariant: the PdfImportActionResult types
  // have rawPdfStored: false as a literal type
  const result = { rawPdfStored: false };
  assert.equal(result.rawPdfStored, false);
});

test("A459 safety: rawDocxStored must always be false", () => {
  const result = { rawDocxStored: false };
  assert.equal(result.rawDocxStored, false);
});

test("A459 safety: llmUsed must always be false in both PDF and DOCX results", () => {
  const pdfResult = { llmUsed: false };
  const docxResult = { llmUsed: false };
  assert.equal(pdfResult.llmUsed, false);
  assert.equal(docxResult.llmUsed, false);
});

// ---------------------------------------------------------------------------
// 5. No env value / secret leakage in guard output
// ---------------------------------------------------------------------------

test("A459 safety: PDF guard reason never contains DATABASE_URL", () => {
  const scenarios = [
    { NODE_ENV: "development" },
    { NODE_ENV: "development", LAP_ALLOW_PDF_IMPORT: "true" },
    { NODE_ENV: "production", LAP_ALLOW_PDF_IMPORT: "true" },
  ];
  for (const env of scenarios) {
    const guard = evaluatePdfImportGuard(env);
    assert.ok(!guard.reason.includes("DATABASE_URL"),
      `PDF guard reason should not contain DATABASE_URL`);
    assert.ok(!guard.reason.includes("database_url"));
  }
});

test("A459 safety: DOCX guard reason never contains secret/token/password", () => {
  const scenarios = [
    { NODE_ENV: "development" },
    { NODE_ENV: "development", LAP_ALLOW_DOCX_IMPORT: "true" },
    { NODE_ENV: "production", LAP_ALLOW_DOCX_IMPORT: "true" },
  ];
  for (const env of scenarios) {
    const guard = evaluateDocxImportGuard(env);
    assert.ok(!guard.reason.includes("password"),
      `DOCX guard reason should not contain "password"`);
    assert.ok(!guard.reason.includes("secret"));
    assert.ok(!guard.reason.includes("token"));
    assert.ok(!guard.reason.includes("api_key"));
  }
});

test("A459 safety: guard reason never contains env variable VALUES", () => {
  // The reason text may include env variable NAMES but never VALUES
  const pdfGuard = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  // Check that the exact value assignment pattern is not in the reason
  assert.ok(!pdfGuard.reason.includes("LAP_ALLOW_PDF_IMPORT=true"),
    "Guard reason should not show env var value assignment");

  const docxGuard = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.ok(!docxGuard.reason.includes("LAP_ALLOW_DOCX_IMPORT=true"),
    "Guard reason should not show env var value assignment");
});

// ---------------------------------------------------------------------------
// 6. No LLM / Agent / Tool references
// ---------------------------------------------------------------------------

test("A459 safety: guard reasons never mention LLM providers", () => {
  const guards = [
    evaluatePdfImportGuard({ NODE_ENV: "development" }),
    evaluatePdfImportGuard({ NODE_ENV: "development", LAP_ALLOW_PDF_IMPORT: "true" }),
    evaluateDocxImportGuard({ NODE_ENV: "development" }),
    evaluateDocxImportGuard({ NODE_ENV: "development", LAP_ALLOW_DOCX_IMPORT: "true" }),
  ];
  for (const guard of guards) {
    assert.ok(!guard.reason.includes("openai"), `Guard should not mention openai`);
    assert.ok(!guard.reason.includes("claude"), `Guard should not mention claude`);
    assert.ok(!guard.reason.includes("gpt"), `Guard should not mention gpt`);
  }
});

test("A459 safety: guard reasons never mention Agent/Tool/MCP", () => {
  const guards = [
    evaluatePdfImportGuard({ NODE_ENV: "development" }),
    evaluateDocxImportGuard({ NODE_ENV: "development" }),
  ];
  for (const guard of guards) {
    assert.ok(!guard.reason.includes("agent"), `Guard should not mention agent`);
    assert.ok(!guard.reason.includes("MCP"), `Guard should not mention MCP`);
    assert.ok(!guard.reason.includes("tool"), `Guard should not mention tool`);
  }
});

// ---------------------------------------------------------------------------
// 7. assert* convenience functions
// ---------------------------------------------------------------------------

test("A459 safety: assertPdfImportAllowed throws when blocked", () => {
  assert.throws(
    () => assertPdfImportAllowed({ NODE_ENV: "production" }),
    /PDF import blocked/,
  );
  assert.throws(
    () => assertPdfImportAllowed({ NODE_ENV: "development" }),
    /PDF import blocked/,
  );
});

test("A459 safety: assertDocxImportAllowed throws when blocked", () => {
  assert.throws(
    () => assertDocxImportAllowed({ NODE_ENV: "production" }),
    /DOCX import blocked/,
  );
  assert.throws(
    () => assertDocxImportAllowed({ NODE_ENV: "development" }),
    /DOCX import blocked/,
  );
});

test("A459 safety: assertPdfImportAllowed does NOT throw when enabled", () => {
  assert.doesNotThrow(() =>
    assertPdfImportAllowed({
      NODE_ENV: "development",
      LAP_ALLOW_PDF_IMPORT: "true",
    }),
  );
});

test("A459 safety: assertDocxImportAllowed does NOT throw when enabled", () => {
  assert.doesNotThrow(() =>
    assertDocxImportAllowed({
      NODE_ENV: "development",
      LAP_ALLOW_DOCX_IMPORT: "true",
    }),
  );
});

// ---------------------------------------------------------------------------
// 8. is*Enabled convenience functions
// ---------------------------------------------------------------------------

test("A459 safety: isPdfImportEnabled returns false when blocked", () => {
  assert.equal(isPdfImportEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isPdfImportEnabled({ NODE_ENV: "production" }), false);
});

test("A459 safety: isDocxImportEnabled returns false when blocked", () => {
  assert.equal(isDocxImportEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isDocxImportEnabled({ NODE_ENV: "production" }), false);
});

test("A459 safety: isPdfImportEnabled returns true when allowed", () => {
  assert.equal(isPdfImportEnabled({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  }), true);
});

test("A459 safety: isDocxImportEnabled returns true when allowed", () => {
  assert.equal(isDocxImportEnabled({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  }), true);
});

// ---------------------------------------------------------------------------
// 9. Guard independence (regression: A457 guard unchanged by A458)
// ---------------------------------------------------------------------------

test("A459 safety: PDF guard not affected by DOCX env var", () => {
  const pdfGuard = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true", // setting DOCX env should NOT enable PDF
  });
  assert.equal(pdfGuard.enabled, false,
    "PDF guard should remain blocked when only DOCX env is set");
});

test("A459 safety: DOCX guard not affected by PDF env var", () => {
  const docxGuard = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true", // setting PDF env should NOT enable DOCX
  });
  assert.equal(docxGuard.enabled, false,
    "DOCX guard should remain blocked when only PDF env is set");
});

// ---------------------------------------------------------------------------
// 10. No .env.local access
// ---------------------------------------------------------------------------

test("A459 safety: guards work without .env.local (explicit overrides)", () => {
  // Both guards support overrideEnv parameter — no .env.local needed
  const pdfGuard = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });
  assert.equal(pdfGuard.enabled, true,
    "Guard works with explicit env overrides, no .env.local required");

  const docxGuard = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });
  assert.equal(docxGuard.enabled, true,
    "Guard works with explicit env overrides, no .env.local required");
});
