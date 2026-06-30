/**
 * PDF Import Parser — extracts plain text from PDF file buffers.
 *
 * Design:
 * - The parser adapter wraps a real PDF text extraction library.
 * - Since `pdf-parse` / `pdfjs-dist` may not be installed in all environments,
 *   this module provides a lazy-loading adapter with clear error messages.
 * - No OCR, no image extraction, no LLM — pure text extraction only.
 * - Does not save raw PDF buffer or file to disk.
 * - Empty/scanned PDFs return a safe error, not a crash.
 *
 * To install the real parser dependency:
 *   pnpm add pdf-parse --filter web
 *   or
 *   npm install pdf-parse
 *
 * Without the dependency, the parser returns a clear "dependency not installed" error.
 *
 * @previewOnly — dev-only; never production
 * @module pdf-import-parser
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfTextExtractionResultSuccess {
  success: true;
  /** Extracted plain text (trimmed). */
  text: string;
  /** Number of pages detected (if parser supports it). */
  pageCount: number | null;
  /** Suggested title derived from PDF metadata or filename. */
  title: string | null;
  /** Non-blocking warnings (e.g., scanned pages detected). */
  warnings: string[];
}

export interface PdfTextExtractionResultFailure {
  success: false;
  /** Human-readable reason — safe to expose. */
  reason: string;
  /** Non-blocking warnings. */
  warnings: string[];
}

export type PdfTextExtractionResult =
  | PdfTextExtractionResultSuccess
  | PdfTextExtractionResultFailure;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters to extract from a PDF (prevents oversized inputs). */
export const PDF_MAX_TEXT_LENGTH = 500_000;

/** Maximum file size in bytes (10 MB). */
export const PDF_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Parser interface
// ---------------------------------------------------------------------------

export interface PdfParserAdapter {
  /** Parse a PDF buffer and return extracted text. */
  parsePdfBuffer(buffer: Buffer): Promise<PdfTextExtractionResult>;
}

// ---------------------------------------------------------------------------
// Mock parser — used when real dependency is not available or in tests
// ---------------------------------------------------------------------------

/**
 * Mock PDF parser that returns a safe empty-result.
 * Used when pdf-parse is not installed or in test environments.
 * Never fakes a real extraction success.
 */
function createMockParser(): PdfParserAdapter {
  return {
    async parsePdfBuffer(_buffer: Buffer): Promise<PdfTextExtractionResult> {
      return {
        success: false,
        reason: "PDF 解析依赖未安装。请运行 `pnpm add pdf-parse --filter web` 安装 pdf-parse 库。当前为 mock parser，不执行真实解析。",
        warnings: ["依赖未安装：pdf-parse"],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Real parser (lazy-loaded)
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";

let cachedRealParser: PdfParserAdapter | null = null;

function tryCreateRealParser(): PdfParserAdapter | null {
  try {
    // Use createRequire for CJS compatibility in ESM context
    // pdf-parse provides a CJS entry point at dist/pdf-parse/cjs/index.cjs
    const localRequire = createRequire(import.meta.url);
    const pdfParse = localRequire("pdf-parse");

    return {
      async parsePdfBuffer(buffer: Buffer): Promise<PdfTextExtractionResult> {
        const warnings: string[] = [];

        try {
          const data = await pdfParse(buffer);

          const text = (data.text ?? "").trim();
          const pageCount =
            typeof data.numpages === "number" ? data.numpages : null;

          // Extract title from PDF metadata
          const title =
            data.info?.Title?.trim() ||
            null;

          // Check for likely scanned PDF (no or very little text)
          if (text.length === 0) {
            warnings.push("PDF 可能为扫描件，无法提取文字。不支持 OCR。");
            return {
              success: false,
              reason: "PDF 未提取到文字内容。可能是扫描件、图片型 PDF 或加密文件。不支持扫描件 OCR。",
              warnings,
            };
          }

          // Check for very low text density (likely scanned)
          if (pageCount && pageCount > 0 && text.length / pageCount < 50) {
            warnings.push("PDF 文本密度较低，部分页面可能为扫描图片。不支持 OCR。");
          }

          // Trim to max length
          const trimmedText =
            text.length > PDF_MAX_TEXT_LENGTH
              ? text.slice(0, PDF_MAX_TEXT_LENGTH)
              : text;

          if (text.length > PDF_MAX_TEXT_LENGTH) {
            warnings.push(
              `提取文本超过 ${PDF_MAX_TEXT_LENGTH} 字符上限，已截断。`,
            );
          }

          return {
            success: true,
            text: trimmedText,
            pageCount,
            title,
            warnings,
          };
        } catch (error) {
          const safeMsg =
            error instanceof Error
              ? `PDF 解析失败：${redactSensitive(error.message)}`
              : "PDF 解析失败：未知错误";
          return {
            success: false,
            reason: safeMsg,
            warnings,
          };
        }
      },
    };
  } catch {
    // pdf-parse not installed
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the PDF parser adapter.
 *
 * Tries to use the real pdf-parse library first; falls back to mock if not installed.
 */
export function getPdfParser(): PdfParserAdapter {
  if (cachedRealParser === null) {
    cachedRealParser = tryCreateRealParser();
  }
  return cachedRealParser ?? createMockParser();
}

/**
 * Parse a PDF buffer and return extracted plain text.
 * Convenience wrapper around getPdfParser().parsePdfBuffer().
 */
export async function parsePdfBuffer(
  buffer: Buffer,
): Promise<PdfTextExtractionResult> {
  return getPdfParser().parsePdfBuffer(buffer);
}

/**
 * Check whether the real PDF parser is available.
 */
export function isRealPdfParserAvailable(): boolean {
  return tryCreateRealParser() !== null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /postgres(ql)?:\/\/\S*/gi,
  /DATABASE_URL[=:]\s*\S*/gi,
  /password[=:]\s*\S*/gi,
  /secret[=:]\s*\S*/gi,
  /token[=:]\s*\S*/gi,
  /api[_-]?key[=:]\s*\S*/gi,
];

function redactSensitive(message: string): string {
  let result = message;
  for (const p of SENSITIVE_PATTERNS) {
    result = result.replace(p, "[hidden]");
  }
  return result;
}
