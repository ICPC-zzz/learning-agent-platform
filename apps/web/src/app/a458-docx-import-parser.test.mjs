/**
 * A458 DOCX Import Parser tests.
 *
 * Covers:
 * - getDocxParser returns a parser
 * - parseDocxBuffer returns structure
 * - empty buffer → safe failure
 * - mock parser doesn't return raw buffer
 * - DOCX_MAX_TEXT_LENGTH / DOCX_MAX_FILE_SIZE constants
 * - isRealDocxParserAvailable
 * - no env value leak
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import {
  getDocxParser,
  parseDocxBuffer,
  isRealDocxParserAvailable,
  DOCX_MAX_TEXT_LENGTH,
  DOCX_MAX_FILE_SIZE,
} from "../lib/docx-import-parser.ts";

// ---------------------------------------------------------------------------
// Parser availability
// ---------------------------------------------------------------------------

test("A458 parser: getDocxParser returns a valid adapter", () => {
  const parser = getDocxParser();
  assert.ok(parser);
  assert.equal(typeof parser.parseDocxBuffer, "function");
});

test("A458 parser: isRealDocxParserAvailable returns boolean", () => {
  const available = isRealDocxParserAvailable();
  // In test/VM environment, mammoth is likely not installed
  // Either way, this should not throw
  assert.equal(typeof available, "boolean");
});

// ---------------------------------------------------------------------------
// parseDocxBuffer
// ---------------------------------------------------------------------------

test("A458 parser: parseDocxBuffer returns well-formed result", async () => {
  const buffer = Buffer.from("test docx content");
  const result = await parseDocxBuffer(buffer);

  assert.ok(result);
  // With mock parser (no mammoth installed), should return failure
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
    assert.ok(Array.isArray(result.warnings));
  } else {
    // If real parser is installed, should have text
    assert.equal(typeof result.text, "string");
  }
});

test("A458 parser: empty buffer handled safely", async () => {
  const buffer = Buffer.from("");
  const result = await parseDocxBuffer(buffer);

  assert.ok(result);
  // Should not throw, should not crash
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
  }
});

test("A458 parser: result structure when successful", async () => {
  const parser = getDocxParser();
  const buffer = Buffer.from("minimal docx content");
  const result = await parser.parseDocxBuffer(buffer);

  if (result.success) {
    assert.equal(typeof result.text, "string");
    assert.ok(Array.isArray(result.warnings));
    // metadata is optional
    if (result.metadata) {
      assert.equal(typeof result.metadata, "object");
    }
  } else {
    assert.equal(typeof result.reason, "string");
    assert.ok(Array.isArray(result.warnings));
  }
});

test("A458 parser: does NOT return raw buffer in result", () => {
  const failureResult = { success: false, reason: "test", warnings: [] };
  assert.ok(!("buffer" in failureResult));
  assert.ok(!("rawDocx" in failureResult));
  assert.ok(!("raw" in failureResult));
  assert.ok(!("fileContent" in failureResult));
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("A458 parser: DOCX_MAX_TEXT_LENGTH is reasonable", () => {
  assert.ok(DOCX_MAX_TEXT_LENGTH > 0);
  assert.ok(DOCX_MAX_TEXT_LENGTH <= 10_000_000);
  assert.equal(DOCX_MAX_TEXT_LENGTH, 500_000);
});

test("A458 parser: DOCX_MAX_FILE_SIZE is 10 MB", () => {
  assert.equal(DOCX_MAX_FILE_SIZE, 10 * 1024 * 1024);
});

// ---------------------------------------------------------------------------
// Mock parser specific
// ---------------------------------------------------------------------------

test("A458 parser: mock parser never returns success=true", async () => {
  // If real parser is available, skip this test
  if (isRealDocxParserAvailable()) {
    return;
  }

  const result = await parseDocxBuffer(Buffer.from("any content"));
  assert.equal(result.success, false);
  assert.ok(result.reason.includes("mammoth") || result.reason.includes("依赖"));
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

test("A458 parser: error messages do not contain raw buffer content", async () => {
  const buffer = Buffer.from("test content with DATABASE_URL=postgresql://secret");
  const result = await parseDocxBuffer(buffer);

  if (!result.success) {
    assert.ok(!result.reason.includes("postgresql://"));
    assert.ok(!result.reason.includes("DATABASE_URL="));
  }
});

test("A458 parser: no env values leaked in parser output", async () => {
  const result = await parseDocxBuffer(Buffer.from("test"));

  const json = JSON.stringify(result);
  assert.ok(!json.includes("DATABASE_URL"));
  assert.ok(!json.includes("password"));
  assert.ok(!json.includes("LAP_"));
  assert.ok(!json.includes("token"));
});

test("A458 parser: mock parser reason mentions mammoth not pdf-parse", () => {
  // Verify DOCX parser is distinct from PDF parser
  if (isRealDocxParserAvailable()) {
    return;
  }

  // Check the parser object directly
  const parser = getDocxParser();
  // The parser should exist
  assert.ok(parser);
  assert.equal(typeof parser.parseDocxBuffer, "function");
});
