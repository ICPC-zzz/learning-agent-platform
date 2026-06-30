/**
 * Open Library Import Adapter
 *
 * Maps Open Library search preview and detail data into a safe local import
 * draft suitable for DB writing. Never retains raw upstream response data.
 *
 * Key design rules:
 * - title missing → "未命名书籍"
 * - No full text → creates a safe "说明性章节" with metadata summary only
 * - warnings MUST include "没有完整正文" when no real chapters
 * - sourceUrl is Open Library page URL — no secrets
 * - authorNames/description/subjects all fall through to "未命名"/empty
 * - chapter content is limited to safe metadata (title, authors, description,
 *   sourceUrl, subjects) — NEVER fabricated body text
 * - No LLM calls, no full-text scraping, no raw response retention
 *
 * @module open-library-import-adapter
 * @previewOnly — dev-only import adapter, not for production use
 */

import type {
  OpenLibraryBookPreview,
  OpenLibraryDetailPreview,
} from "./open-library-adapter";

// ---------------------------------------------------------------------------
// Import draft type
// ---------------------------------------------------------------------------

export interface OpenLibraryImportDraft {
  /** Provider identifier — always "open-library" */
  provider: "open-library";
  /** External ID from Open Library */
  externalId: string;
  /** Book title (safe, truncated) */
  title: string;
  /** Author names array */
  authorNames: string[];
  /** Source URL (Open Library page, no secrets) */
  sourceUrl: string;
  /** Cover image URL (empty if none) */
  coverUrl: string;
  /** Description text (truncated) */
  description: string;
  /** Subject tags */
  subjects: string[];
  /** First publish year */
  firstPublishYear?: number;
  /** ISBN identifiers */
  isbn: string[];
  /** Chapters for import (always has at least 1 safety chapter) */
  chapters: OpenLibraryImportChapter[];
  /** Safety warnings */
  warnings: string[];
  /** Always false — dev-only */
  productionReady: false;
  /** Always true — safe to expose */
  safeToExposeToClient: true;
  /** Never stored */
  rawResponseStored: false;
}

export interface OpenLibraryImportChapter {
  /** Chapter title */
  title: string;
  /** Chapter content text */
  content: string;
  /** Order index (0-based) */
  orderIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_FALLBACK = "未命名书籍";
const NO_FULL_TEXT_WARNING =
  "Open Library 当前只提供元数据预览，未导入完整正文。本书仅为元数据说明章节，不含完整书籍内容。";
const CHAPTER_TITLE_DEFAULT = "外部书籍信息";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an import draft from Open Library search preview and optional detail.
 *
 * @param preview — A464 search result preview (required)
 * @param detail  — A464 detail preview (optional, enriches description/cover)
 * @returns       — Safe import draft suitable for DB writing
 */
export function createOpenLibraryImportDraft(
  preview: OpenLibraryBookPreview,
  detail?: OpenLibraryDetailPreview | null,
): OpenLibraryImportDraft {
  const warnings: string[] = [];

  // Build safe fields from preview, enriched by detail if available
  const title = safeTrim(preview.title) || TITLE_FALLBACK;
  const authorNames = (preview.authorNames ?? []).map((a) => safeTrim(a)).filter(isNonEmpty);
  const sourceUrl = safeTrim(preview.sourceUrl) || "";
  const coverUrl = detail?.coverUrl
    ? safeTrim(detail.coverUrl)
    : safeTrim(preview.coverUrl) || "";
  const description = detail?.description
    ? safeTrim(detail.description)
    : "";
  const subjects = (preview.subjects ?? [])
    .map((s) => safeTrim(s))
    .filter(isNonEmpty)
    .slice(0, 10);
  const firstPublishYear = preview.firstPublishYear;
  const isbn = (preview.isbn ?? []).map((i) => safeTrim(i)).filter(isNonEmpty);

  // Always add the no-full-text warning
  warnings.push(NO_FULL_TEXT_WARNING);

  // Generate the safety chapter from metadata
  const chapters = buildSafetyChapters({
    title,
    authorNames,
    description,
    sourceUrl,
    subjects,
    firstPublishYear,
    isbn,
  });

  return {
    provider: "open-library",
    externalId: safeTrim(preview.externalId) || "",
    title: truncateSafe(title, 500),
    authorNames: authorNames.map((a) => truncateSafe(a, 200)),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    coverUrl: truncateSafe(coverUrl, 2000),
    description: truncateSafe(description, 5000),
    subjects: subjects.map((s) => truncateSafe(s, 200)),
    firstPublishYear,
    isbn: isbn.map((i) => truncateSafe(i, 20)),
    chapters,
    warnings,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
  };
}

// ---------------------------------------------------------------------------
// Safety chapter builder
// ---------------------------------------------------------------------------

interface SafetyChapterInput {
  title: string;
  authorNames: string[];
  description: string;
  sourceUrl: string;
  subjects: string[];
  firstPublishYear?: number;
  isbn: string[];
}

function buildSafetyChapters(input: SafetyChapterInput): OpenLibraryImportChapter[] {
  const lines: string[] = [];

  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push("## 说明");
  lines.push("");
  lines.push(
    "本章节为导入自 Open Library 的外部书籍元数据说明。Open Library 当前只提供书目元数据，" +
    "不含完整书籍正文。以下信息仅用于帮助您了解本书的基本信息。",
  );
  lines.push("");

  if (input.authorNames.length > 0) {
    lines.push("## 作者");
    lines.push("");
    lines.push(input.authorNames.join("、"));
    lines.push("");
  }

  if (input.description) {
    lines.push("## 简介");
    lines.push("");
    lines.push(input.description);
    lines.push("");
  }

  if (input.subjects.length > 0) {
    lines.push("## 主题标签");
    lines.push("");
    lines.push(input.subjects.join("、"));
    lines.push("");
  }

  if (input.firstPublishYear) {
    lines.push("## 首次出版年份");
    lines.push("");
    lines.push(String(input.firstPublishYear));
    lines.push("");
  }

  if (input.isbn.length > 0) {
    lines.push("## ISBN");
    lines.push("");
    lines.push(input.isbn.join(", "));
    lines.push("");
  }

  if (input.sourceUrl) {
    lines.push("## Open Library 来源");
    lines.push("");
    lines.push(input.sourceUrl);
    lines.push("");
  }

  lines.push("## 重要提示");
  lines.push("");
  lines.push(NO_FULL_TEXT_WARNING);

  const content = lines.join("\n");

  return [
    {
      title: CHAPTER_TITLE_DEFAULT,
      content,
      orderIndex: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeTrim(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  return value.trim();
}

function isNonEmpty(value: string): boolean {
  return value.length > 0;
}

function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
