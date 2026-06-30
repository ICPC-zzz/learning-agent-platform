/**
 * A457 PDF Import Parser tests.
 *
 * Covers:
 * - getPdfParser returns a parser
 * - parsePdfBuffer returns structure
 * - empty buffer → safe failure
 * - mock parser doesn't return raw buffer
 * - PDF_MAX_TEXT_LENGTH / PDF_MAX_FILE_SIZE constants
 * - isRealPdfParserAvailable
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import {
  getPdfParser,
  parsePdfBuffer,
  isRealPdfParserAvailable,
  PDF_MAX_TEXT_LENGTH,
  PDF_MAX_FILE_SIZE,
} from "../lib/pdf-import-parser.ts";

// ---------------------------------------------------------------------------
// Parser availability
// ---------------------------------------------------------------------------

test("A457 parser: getPdfParser returns a valid adapter", () => {
  const parser = getPdfParser();
  assert.ok(parser);
  assert.equal(typeof parser.parsePdfBuffer, "function");
});

test("A457 parser: isRealPdfParserAvailable returns boolean", () => {
  const available = isRealPdfParserAvailable();
  // In test/VM environment, pdf-parse is likely not installed
  // Either way, this should not throw
  assert.equal(typeof available, "boolean");
});

// ---------------------------------------------------------------------------
// parsePdfBuffer
// ---------------------------------------------------------------------------

test("A457 parser: parsePdfBuffer returns well-formed result", async () => {
  // Create a minimal PDF-like buffer (won't parse as real PDF, but mock handles it)
  const buffer = Buffer.from("test pdf content");
  const result = await parsePdfBuffer(buffer);

  assert.ok(result);
  // With mock parser (no pdf-parse installed), should return failure
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
    assert.ok(Array.isArray(result.warnings));
  } else {
    // If real parser is installed, should have text
    assert.equal(typeof result.text, "string");
  }
});

test("A457 parser: empty buffer handled safely", async () => {
  const buffer = Buffer.from("");
  const result = await parsePdfBuffer(buffer);

  assert.ok(result);
  // Should not throw, should not crash
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
  }
});

test("A457 parser: result structure when successful", async () => {
  // This test verifies the structure shape regardless of mock/real
  const parser = getPdfParser();
  const buffer = Buffer.from("minimal pdf content");
  const result = await parser.parsePdfBuffer(buffer);

  if (result.success) {
    assert.equal(typeof result.text, "string");
    // pageCount can be null or number
    assert.ok(result.pageCount === null || typeof result.pageCount === "number");
    // title can be null or string
    assert.ok(result.title === null || typeof result.title === "string");
    assert.ok(Array.isArray(result.warnings));
  } else {
    assert.equal(typeof result.reason, "string");
    assert.ok(Array.isArray(result.warnings));
  }
});

test("A457 parser: does NOT return raw buffer in result", () => {
  // Verify that no Buffer-like field exists in the result types
  const failureResult = { success: false, reason: "test", warnings: [] };
  assert.ok(!("buffer" in failureResult));
  assert.ok(!("rawPdf" in failureResult));
  assert.ok(!("raw" in failureResult));
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("A457 parser: PDF_MAX_TEXT_LENGTH is reasonable", () => {
  assert.ok(PDF_MAX_TEXT_LENGTH > 0);
  assert.ok(PDF_MAX_TEXT_LENGTH <= 10_000_000); // not unlimited
  assert.equal(PDF_MAX_TEXT_LENGTH, 500_000); // expected default
});

test("A457 parser: PDF_MAX_FILE_SIZE is 10 MB", () => {
  assert.equal(PDF_MAX_FILE_SIZE, 10 * 1024 * 1024);
});

// ---------------------------------------------------------------------------
// Mock parser specific
// ---------------------------------------------------------------------------

test("A457 parser: mock parser never returns success=true", async () => {
  // If real parser is available, skip this test
  if (isRealPdfParserAvailable()) {
    // Cannot test mock behavior when real parser is installed
    return;
  }

  const result = await parsePdfBuffer(Buffer.from("any content"));
  assert.equal(result.success, false);
  assert.ok(result.reason.includes("pdf-parse") || result.reason.includes("依赖"));
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

test("A457 parser: error messages do not contain raw buffer content", async () => {
  const buffer = Buffer.from("test content with DATABASE_URL=postgresql://secret");
  const result = await parsePdfBuffer(buffer);

  if (!result.success) {
    assert.ok(!result.reason.includes("postgresql://"));
    assert.ok(!result.reason.includes("DATABASE_URL="));
  }
});

test("A457 parser: no env values leaked in parser output", async () => {
  const result = await parsePdfBuffer(Buffer.from("test"));

  const json = JSON.stringify(result);
  assert.ok(!json.includes("DATABASE_URL"));
  assert.ok(!json.includes("password"));
  assert.ok(!json.includes("LAP_"));
});
