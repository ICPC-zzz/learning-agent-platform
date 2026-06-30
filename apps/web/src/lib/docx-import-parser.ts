/**
 * DOCX Import Parser — extracts plain text from DOCX (Word) file buffers.
 *
 * Design:
 * - The parser adapter wraps a real DOCX text extraction library (mammoth).
 * - Since `mammoth` may not be installed in all environments,
 *   this module provides a lazy-loading adapter with clear error messages.
 * - No style preservation, no image extraction, no comment extraction, no LLM — pure text only.
 * - Does not save raw DOCX buffer or file to disk.
 * - Empty/corrupted DOCX files return a safe error, not a crash.
 *
 * To install the real parser dependency:
 *   pnpm add mammoth --filter web
 *
 * Without the dependency, the parser returns a clear "dependency not installed" error.
 *
 * @previewOnly — dev-only; never production
 * @module docx-import-parser
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocxTextExtractionResultSuccess {
  success: true;
  /** Extracted plain text (trimmed). */
  text: string;
  /** Non-blocking warnings (e.g., style information discarded). */
  warnings: string[];
  /** Optional metadata from document properties. */
  metadata?: {
    fileName?: string;
  };
}

export interface DocxTextExtractionResultFailure {
  success: false;
  /** Human-readable reason — safe to expose. */
  reason: string;
  /** Non-blocking warnings. */
  warnings: string[];
}

export type DocxTextExtractionResult =
  | DocxTextExtractionResultSuccess
  | DocxTextExtractionResultFailure;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters to extract from a DOCX (prevents oversized inputs). */
export const DOCX_MAX_TEXT_LENGTH = 500_000;

/** Maximum file size in bytes (10 MB, same as PDF). */
export const DOCX_MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Parser interface
// ---------------------------------------------------------------------------

export interface DocxParserAdapter {
  /** Parse a DOCX buffer and return extracted plain text. */
  parseDocxBuffer(buffer: Buffer): Promise<DocxTextExtractionResult>;
}

// ---------------------------------------------------------------------------
// Mock parser — used when real dependency is not available or in tests
// ---------------------------------------------------------------------------

/**
 * Mock DOCX parser that returns a safe empty-result.
 * Used when mammoth is not installed or in test environments.
 * Never fakes a real extraction success.
 */
function createMockParser(): DocxParserAdapter {
  return {
    async parseDocxBuffer(_buffer: Buffer): Promise<DocxTextExtractionResult> {
      return {
        success: false,
        reason: "DOCX 解析依赖未安装。请运行 `pnpm add mammoth --filter web` 安装 mammoth 库。当前为 mock parser，不执行真实解析。",
        warnings: ["依赖未安装：mammoth"],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Real parser (lazy-loaded)
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";

let cachedRealParser: DocxParserAdapter | null = null;

function tryCreateRealParser(): DocxParserAdapter | null {
  try {
    // Use createRequire for CJS compatibility in ESM context
    // mammoth is a CJS-only package
    const localRequire = createRequire(import.meta.url);
    const mammoth = localRequire("mammoth");

    return {
      async parseDocxBuffer(buffer: Buffer): Promise<DocxTextExtractionResult> {
        const warnings: string[] = [];

        try {
          const result = await mammoth.extractRawText({ buffer });

          const text = (result.value ?? "").trim();

          // Collect mammoth warnings
          if (result.messages && Array.isArray(result.messages)) {
            for (const msg of result.messages) {
              if (msg.type === "warning") {
                warnings.push(`DOCX 解析提示：${msg.message ?? "未知"}`);
              }
            }
          }

          // Check for empty result
          if (text.length === 0) {
            warnings.push("DOCX 文件未提取到文字内容。可能是空文档、图片型文档或加密文件。");
            return {
              success: false,
              reason: "DOCX 未提取到文字内容。可能是空文档、仅包含图片的文档或加密文件。不支持图片提取。",
              warnings,
            };
          }

          // Trim to max length
          const trimmedText =
            text.length > DOCX_MAX_TEXT_LENGTH
              ? text.slice(0, DOCX_MAX_TEXT_LENGTH)
              : text;

          if (text.length > DOCX_MAX_TEXT_LENGTH) {
            warnings.push(
              `提取文本超过 ${DOCX_MAX_TEXT_LENGTH} 字符上限，已截断。`,
            );
          }

          // Note: style information, images, and comments are discarded
          warnings.push("样式、图片和批注信息已丢弃（仅保留纯文本）。");

          return {
            success: true,
            text: trimmedText,
            warnings,
          };
        } catch (error) {
          const safeMsg =
            error instanceof Error
              ? `DOCX 解析失败：${redactSensitive(error.message)}`
              : "DOCX 解析失败：未知错误";
          return {
            success: false,
            reason: safeMsg,
            warnings,
          };
        }
      },
    };
  } catch {
    // mammoth not installed
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the DOCX parser adapter.
 *
 * Tries to use the real mammoth library first; falls back to mock if not installed.
 */
export function getDocxParser(): DocxParserAdapter {
  if (cachedRealParser === null) {
    cachedRealParser = tryCreateRealParser();
  }
  return cachedRealParser ?? createMockParser();
}

/**
 * Parse a DOCX buffer and return extracted plain text.
 * Convenience wrapper around getDocxParser().parseDocxBuffer().
 */
export async function parseDocxBuffer(
  buffer: Buffer,
): Promise<DocxTextExtractionResult> {
  return getDocxParser().parseDocxBuffer(buffer);
}

/**
 * Check whether the real DOCX parser is available.
 */
export function isRealDocxParserAvailable(): boolean {
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
