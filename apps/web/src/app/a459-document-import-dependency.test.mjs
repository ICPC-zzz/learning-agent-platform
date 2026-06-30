/**
 * A459 Document Import Dependency & Adapter tests.
 *
 * Covers:
 * - PDF adapter does not fake success when dependency missing (mock parser)
 * - DOCX adapter does not fake success when dependency missing (mock parser)
 * - lazy-load paths exist for both parsers
 * - isRealPdfParserAvailable / isRealDocxParserAvailable exist and return boolean
 * - getPdfParser / getDocxParser return valid adapter even when deps missing
 * - mock parser returns success:false, not success:true
 * - mock parser reason mentions install command
 */
import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import {
  getPdfParser,
  parsePdfBuffer,
  isRealPdfParserAvailable,
} from "../lib/pdf-import-parser.ts";

// @ts-expect-error TS5097: direct .ts import
import {
  getDocxParser,
  parseDocxBuffer,
  isRealDocxParserAvailable,
} from "../lib/docx-import-parser.ts";

// ---------------------------------------------------------------------------
// 1. Mock parser does not fake success
// ---------------------------------------------------------------------------

test("A459 dep: PDF mock parser returns success=false (no fake success)", async () => {
  // Even when dependency is not installed, getPdfParser() returns a parser
  const parser = getPdfParser();
  assert.ok(parser, "Parser adapter should exist");
  assert.equal(typeof parser.parsePdfBuffer, "function");

  const result = await parser.parsePdfBuffer(Buffer.from("test"));
  // Mock parser MUST return success: false — never fake a real extraction
  // If real parser is available, skip the mock-only assertion
  if (!isRealPdfParserAvailable()) {
    assert.equal(result.success, false,
      "Mock parser must not fake success");
    assert.ok(
      result.reason.includes("pdf-parse") || result.reason.includes("依赖"),
      "Mock parser reason should mention dependency/install"
    );
  }
});

test("A459 dep: DOCX mock parser returns success=false (no fake success)", async () => {
  const parser = getDocxParser();
  assert.ok(parser, "Parser adapter should exist");
  assert.equal(typeof parser.parseDocxBuffer, "function");

  const result = await parser.parseDocxBuffer(Buffer.from("test"));
  if (!isRealDocxParserAvailable()) {
    assert.equal(result.success, false,
      "Mock parser must not fake success");
    assert.ok(
      result.reason.includes("mammoth") || result.reason.includes("依赖"),
      "Mock parser reason should mention dependency/install"
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Lazy-load paths exist
// ---------------------------------------------------------------------------

test("A459 dep: PDF lazy-load path — getPdfParser never throws", () => {
  assert.doesNotThrow(() => getPdfParser());
});

test("A459 dep: DOCX lazy-load path — getDocxParser never throws", () => {
  assert.doesNotThrow(() => getDocxParser());
});

test("A459 dep: PDF lazy-load path — parsePdfBuffer never throws", async () => {
  let threw = false;
  try {
    await parsePdfBuffer(Buffer.from("test"));
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "parsePdfBuffer should never throw, return error result instead");
});

test("A459 dep: DOCX lazy-load path — parseDocxBuffer never throws", async () => {
  let threw = false;
  try {
    await parseDocxBuffer(Buffer.from("test"));
  } catch {
    threw = true;
  }
  assert.equal(threw, false, "parseDocxBuffer should never throw, return error result instead");
});

// ---------------------------------------------------------------------------
// 3. isReal*ParserAvailable returns boolean
// ---------------------------------------------------------------------------

test("A459 dep: isRealPdfParserAvailable returns boolean", () => {
  const result = isRealPdfParserAvailable();
  assert.equal(typeof result, "boolean");
});

test("A459 dep: isRealDocxParserAvailable returns boolean", () => {
  const result = isRealDocxParserAvailable();
  assert.equal(typeof result, "boolean");
});

// ---------------------------------------------------------------------------
// 4. Both parsers provide expected error structure
// ---------------------------------------------------------------------------

test("A459 dep: PDF parser failure result has reason and warnings", async () => {
  const result = await parsePdfBuffer(Buffer.from("test"));
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
    assert.ok(Array.isArray(result.warnings));
  }
});

test("A459 dep: DOCX parser failure result has reason and warnings", async () => {
  const result = await parseDocxBuffer(Buffer.from("test"));
  if (!result.success) {
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
    assert.ok(Array.isArray(result.warnings));
  }
});

// ---------------------------------------------------------------------------
// 5. Mock parser reason messages are clear and actionable
// ---------------------------------------------------------------------------

test("A459 dep: PDF mock parser reason mentions install command", async () => {
  if (isRealPdfParserAvailable()) return; // skip if real parser installed
  const result = await parsePdfBuffer(Buffer.from("test"));
  assert.ok(
    result.reason.includes("pnpm") || result.reason.includes("install") || result.reason.includes("安装"),
    "Mock parser should tell user how to install the dependency"
  );
});

test("A459 dep: DOCX mock parser reason mentions install command", async () => {
  if (isRealDocxParserAvailable()) return;
  const result = await parseDocxBuffer(Buffer.from("test"));
  assert.ok(
    result.reason.includes("pnpm") || result.reason.includes("install") || result.reason.includes("安装"),
    "Mock parser should tell user how to install the dependency"
  );
});

// ---------------------------------------------------------------------------
// 6. Constants are reasonable
// ---------------------------------------------------------------------------

test("A459 dep: PDF and DOCX size limits are consistent (10MB each)", async () => {
  // @ts-expect-error TS5097: direct .ts import
  const { PDF_MAX_FILE_SIZE } = await import("../lib/pdf-import-parser.ts");
  // @ts-expect-error TS5097: direct .ts import
  const { DOCX_MAX_FILE_SIZE } = await import("../lib/docx-import-parser.ts");

  assert.equal(PDF_MAX_FILE_SIZE, 10 * 1024 * 1024);
  assert.equal(DOCX_MAX_FILE_SIZE, 10 * 1024 * 1024);
});

// ---------------------------------------------------------------------------
// 7. Parser results never contain raw buffers
// ---------------------------------------------------------------------------

test("A459 dep: PDF parser result JSON contains no buffer/raw fields", async () => {
  const result = await parsePdfBuffer(Buffer.from("test"));
  const keys = Object.keys(result);
  assert.ok(!keys.includes("buffer"));
  assert.ok(!keys.includes("rawBuffer"));
  assert.ok(!keys.includes("raw"));
  assert.ok(!keys.includes("fileContent"));
});

test("A459 dep: DOCX parser result JSON contains no buffer/raw fields", async () => {
  const result = await parseDocxBuffer(Buffer.from("test"));
  const keys = Object.keys(result);
  assert.ok(!keys.includes("buffer"));
  assert.ok(!keys.includes("rawBuffer"));
  assert.ok(!keys.includes("raw"));
  assert.ok(!keys.includes("fileContent"));
});
