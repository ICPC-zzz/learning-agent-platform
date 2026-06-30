"use server";

/**
 * DOCX Import Server Action — accepts DOCX file upload, extracts plain text,
 * and routes through the existing text import preview pipeline.
 *
 * Guards:
 * - LAP_ALLOW_DOCX_IMPORT must be explicitly true
 * - NODE_ENV !== production (always blocked in production)
 * - File type must be DOCX
 * - File size ≤ 10 MB
 *
 * This action:
 * - Extracts plain text from the uploaded DOCX (no style, no images, no LLM)
 * - Routes extracted text to the existing text import preview pipeline
 * - Does NOT save raw DOCX buffer to disk or DB
 * - Does NOT write to DB directly
 * - Returns a safe preview result for user confirmation
 *
 * @previewOnly — dev-only; never production
 * @module docx-import-server-action
 */

import { evaluateDocxImportGuard } from "./docx-import-guard";
import {
  parseDocxBuffer,
  DOCX_MAX_FILE_SIZE,
  DOCX_MAX_TEXT_LENGTH,
} from "./docx-import-parser";
import type { DocxTextExtractionResult } from "./docx-import-parser";
import {
  importPlainTextBook,
  type TextImportResult,
} from "@learning-agent-platform/book-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocxImportChapterPreview {
  title: string;
  order: number;
  estimatedLineCount: number;
  previewText: string;
}

export interface DocxImportActionResultSuccess {
  success: true;
  /** Extracted character count. */
  extractedCharCount: number;
  /** Number of chapters detected. */
  chapterCount: number;
  /** Chapter previews (limited to first N). */
  chapterPreviews: DocxImportChapterPreview[];
  /** Derived book title (from filename). */
  bookTitle: string;
  /** Human-readable message. */
  message: string;
  /** Non-blocking warnings. */
  warnings: string[];
  /** Always true — dev-only. */
  devOnly: true;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Always true — safe to expose. */
  safeToExposeToClient: true;
  /** Raw DOCX never stored. */
  rawDocxStored: false;
  /** Raw text never stored in full. */
  rawTextStored: false;
  /** LLM was not used. */
  llmUsed: false;
  /** Reason code. */
  reasonCode: "docx-parsed";
}

export interface DocxImportActionResultFailure {
  success: false;
  /** Human-readable message — safe to expose, no secrets. */
  message: string;
  /** Reason code. */
  reasonCode: string;
  /** Non-blocking warnings. */
  warnings: string[];
  /** Always true — dev-only. */
  devOnly: true;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Always true — safe to expose. */
  safeToExposeToClient: true;
  /** Raw DOCX never stored. */
  rawDocxStored: false;
  /** Raw text never stored in full. */
  rawTextStored: false;
  /** LLM was not used. */
  llmUsed: false;
}

export type DocxImportActionResult =
  | DocxImportActionResultSuccess
  | DocxImportActionResultFailure;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHAPTER_PREVIEWS = 4;
const MAX_CHAPTER_PREVIEW_CHARS = 160;
const MAX_BOOK_TITLE_CHARS = 200;

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function docxImportServerAction(
  formData: FormData,
): Promise<DocxImportActionResult> {
  // Guard 1: DOCX import must be enabled
  const guard = evaluateDocxImportGuard();
  if (!guard.enabled) {
    return createFailureResult(
      `DOCX 导入已阻止。${guard.reason}`,
      "docx-import-blocked",
    );
  }

  // Guard 2: validate file presence
  const file = formData.get("docxFile");
  if (!file || !(file instanceof File)) {
    return createFailureResult(
      "未收到 DOCX 文件。请选择一个 .docx 文件上传。",
      "no-file",
    );
  }

  // Guard 3: validate file type
  const fileName = file.name ?? "unknown";
  const fileType = file.type ?? "";
  const isDocxByType =
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDocxByName = fileName.toLowerCase().endsWith(".docx");
  if (!isDocxByType && !isDocxByName) {
    return createFailureResult(
      `文件类型不被接受：${redactFileName(fileName)}。仅支持 DOCX 格式（.docx）。`,
      "invalid-file-type",
    );
  }

  // Guard 4: validate file size
  if (file.size > DOCX_MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return createFailureResult(
      `文件过大（${sizeMB} MB）。DOCX 文件大小上限为 ${DOCX_MAX_FILE_SIZE / (1024 * 1024)} MB。`,
      "file-too-large",
    );
  }

  if (file.size === 0) {
    return createFailureResult(
      "DOCX 文件为空。请上传包含文字内容的 DOCX 文件。",
      "empty-file",
    );
  }

  // Read file into buffer and parse
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return createFailureResult(
      "无法读取 DOCX 文件内容。",
      "read-error",
    );
  }

  const buffer = Buffer.from(arrayBuffer);
  let parseResult: DocxTextExtractionResult;
  try {
    parseResult = await parseDocxBuffer(buffer);
  } catch (error) {
    const safeMsg = error instanceof Error
      ? `DOCX 解析异常：${redactError(error.message)}`
      : "DOCX 解析异常：未知错误";
    return createFailureResult(safeMsg, "parse-error");
  }

  if (!parseResult.success) {
    return createFailureResult(
      `DOCX 文本提取失败：${parseResult.reason}`,
      "extraction-failed",
      parseResult.warnings,
    );
  }

  const extractedText = parseResult.text;
  const extractedCharCount = extractedText.length;

  if (extractedCharCount === 0) {
    return createFailureResult(
      "DOCX 未提取到文字内容。可能是空文档、仅包含图片的文档或加密文件。仅支持纯文本提取，不支持图片 OCR。",
      "no-text",
      parseResult.warnings,
    );
  }

  // Derive book title from filename (strip extension)
  const derivedTitle = fileName.replace(/\.docx$/i, "").trim()
    || "未命名 DOCX 导入";

  const safeTitle = sanitizeBookTitle(derivedTitle);

  // Route through existing text import pipeline
  let importResult: TextImportResult;
  try {
    importResult = importPlainTextBook({
      title: safeTitle,
      sourceText: extractedText,
      sourceType: "imported_text",
    });
  } catch (error) {
    const safeMsg = error instanceof Error
      ? `书籍导入流程失败：${redactError(error.message)}`
      : "书籍导入流程失败：未知错误";
    return createFailureResult(safeMsg, "import-pipeline-error", parseResult.warnings);
  }

  // Build chapter previews (safe, truncated)
  const chapterPreviews: DocxImportChapterPreview[] = importResult.chapters
    .slice(0, MAX_CHAPTER_PREVIEWS)
    .map((chapter) => ({
      title: truncateText(chapter.title, MAX_BOOK_TITLE_CHARS),
      order: chapter.orderIndex + 1,
      estimatedLineCount: estimateLineCount(chapter.plainText),
      previewText: truncateText(chapter.plainText, MAX_CHAPTER_PREVIEW_CHARS),
    }));

  const warnings = [
    ...parseResult.warnings,
    ...importResult.warnings.map((w) => w.message),
  ];

  if (extractedText.length >= DOCX_MAX_TEXT_LENGTH) {
    warnings.push(
      `DOCX 文本超过 ${DOCX_MAX_TEXT_LENGTH} 字符上限，已截断至 ${DOCX_MAX_TEXT_LENGTH} 字符。`,
    );
  }

  return {
    success: true,
    extractedCharCount: Math.min(extractedCharCount, DOCX_MAX_TEXT_LENGTH),
    chapterCount: importResult.chapters.length,
    chapterPreviews,
    bookTitle: safeTitle,
    message: `DOCX 文本提取成功：${extractedCharCount} 字符，${importResult.chapters.length} 个章节。仅纯文本提取，样式、图片、批注已丢弃。`,
    warnings,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawDocxStored: false,
    rawTextStored: false,
    llmUsed: false,
    reasonCode: "docx-parsed",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFailureResult(
  message: string,
  reasonCode: string,
  additionalWarnings?: string[],
): DocxImportActionResultFailure {
  return {
    success: false,
    message,
    reasonCode,
    warnings: additionalWarnings ?? [],
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawDocxStored: false,
    rawTextStored: false,
    llmUsed: false,
  };
}

function sanitizeBookTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "未命名 DOCX 导入";
  return truncateText(trimmed, MAX_BOOK_TITLE_CHARS);
}

function truncateText(text: string, maxLength: number): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, maxLength - 3) + "...";
}

function estimateLineCount(text: string): number {
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

function redactFileName(name: string): string {
  // Only show extension — don't expose full filename with potential sensitive paths
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
  return ext ? `*.${ext}` : "unknown";
}

const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /postgres(ql)?:\/\/\S*/gi,
  /DATABASE_URL[=:]\s*\S*/gi,
  /password[=:]\s*\S*/gi,
  /secret[=:]\s*\S*/gi,
  /token[=:]\s*\S*/gi,
  /api[_-]?key[=:]\s*\S*/gi,
];

function redactError(message: string): string {
  let result = message;
  for (const p of SENSITIVE_PATTERNS) {
    result = result.replace(p, "[hidden]");
  }
  return result;
}
