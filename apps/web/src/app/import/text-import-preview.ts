import { BOOK_IMPORT_MAX_CONTENT_CHARS, BOOK_IMPORT_MIN_CONTENT_CHARS } from "./book-import-save-types.ts";

export interface TextImportPreviewChapter {
  title: string;
  order: number;
  estimatedLineCount: number;
  previewText: string;
}

export interface TextImportPreviewChapterEditDraft {
  title: string;
  excluded: boolean;
}

export interface TextImportPreviewResult {
  previewOnly: true;
  implemented: true;
  safeToExposeToClient: true;
  bookTitlePreview: string;
  chapterCount: number;
  chapters: TextImportPreviewChapter[];
  warnings: string[];
}

export interface TextImportPreviewValidationResult {
  errors: string[];
  warnings: string[];
  normalizedTextLength: number;
}

export interface TextImportPreviewInputStats {
  titleCharCount: number;
  rawTextCharCount: number;
  estimatedLineCount: number;
  hasMeaningfulTitle: boolean;
  hasMeaningfulRawText: boolean;
  hasDangerousFields: boolean;
  errors: string[];
  warnings: string[];
}

export interface TextImportChapterDisplayState {
  visibleChapters: TextImportPreviewChapter[];
  hiddenChapterCount: number;
  visibleLimit: number;
  expanded: boolean;
}

export type TextImportPreviewFieldName = "title" | "rawText";

export interface TextImportPreviewFieldErrorState {
  titleError: string | null;
  rawTextError: string | null;
  firstErrorField: TextImportPreviewFieldName | null;
}

export interface TextImportPreviewToggleKeyEventLike {
  key: string;
  preventDefault?: () => void;
}

interface DetectedHeading {
  title: string;
  index: number;
}

interface SectionDraft {
  title: string;
  lines: string[];
}

interface RedactionResult {
  text: string;
  redacted: boolean;
}

export const DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT = 4;
export interface TextImportPreviewExampleContent {
  title: string;
  rawText: string;
  note: string;
  previewOnly: true;
}

export interface TextImportPreviewStatusSummary {
  previewOnly: true;
  writesDatabase: false;
  saved: false;
  confirmationStatus: "ready" | "blocked";
  chapterCount: number;
  estimatedTotalLines: number;
  hasDangerousFields: boolean;
}

export interface TextImportPreviewInteractionState {
  title: string;
  rawText: string;
  preview: TextImportPreviewResult | null;
  chapterEdits: TextImportPreviewChapterEditDraft[];
  validationErrors: string[];
  validationWarnings: string[];
  previewError: string | null;
  showAllChapters: boolean;
}

const TEXT_IMPORT_PREVIEW_EXAMPLE_CONTENT: TextImportPreviewExampleContent = {
  title: "本地示例：Markdown 与中文章节",
  rawText: `# 预览示例
这是一段仅本地示例，不会保存的内容。

第1章 本地切分
这一段用于测试中文章节标题识别和章节摘要展示。

## Markdown 第二节
这一段用于测试 Markdown 标题识别和预览切分。

第2章 继续示例
这是第二个中文章节标题，便于预览多章结果。`,
  note: "仅本地示例，不会保存",
  previewOnly: true,
};

const MAX_BOOK_TITLE_PREVIEW_CHARS = 80;
const MAX_CHAPTER_PREVIEW_CHARS = 160;
const DEFAULT_SINGLE_CHAPTER_TITLE = "第 1 章";
const FALLBACK_BOOK_TITLE = "未命名书籍";
const MISSING_TITLE_WARNING = "未填写书名，已使用默认标题并按单章预览处理。";
const REDACTION_REPLACEMENT = "[已隐藏]";
const SENSITIVE_REDACTION_WARNING =
  "检测到危险字段，已阻断或脱敏，预览中不会显示原值。";

const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bDATABASE_URL\b[^\n]*/i,
  /\bapi[\s_-]*key\b[^\n]*/i,
  /\bauthorization(?:\s*header)?\b[^\n]*/i,
  /\bcookie\b[^\n]*/i,
  /\bsecret\b[^\n]*/i,
  /\btoken\b[^\n]*/i,
];

export function validateTextImportPreviewInput(input: {
  title: string;
  rawText: string;
}): TextImportPreviewValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input.title !== "string") {
    errors.push("标题必须是字符串。");
  }

  if (typeof input.rawText !== "string") {
    errors.push("正文必须是字符串。");
  }

  const normalizedTitle =
    typeof input.title === "string" ? normalizeSingleLinePreview(input.title) : "";
  const normalizedText =
    typeof input.rawText === "string" ? normalizePlainText(input.rawText) : "";

  if (normalizedTitle.length === 0 && normalizedText.length === 0) {
    errors.push("标题不能为空，请先填写书名。");
  }

  if (normalizedText.length === 0) {
    errors.push("正文不能为空，请先粘贴纯文本内容。");
  } else if (normalizedText.length < BOOK_IMPORT_MIN_CONTENT_CHARS) {
    warnings.push(
      `正文少于 ${BOOK_IMPORT_MIN_CONTENT_CHARS} 个字符，可能无法稳定切分章节。`,
    );
  } else if (normalizedText.length > BOOK_IMPORT_MAX_CONTENT_CHARS) {
    warnings.push(
      `正文超过 ${BOOK_IMPORT_MAX_CONTENT_CHARS} 个字符，预览可能较慢，但这里只会生成预览，不会保存原文。`,
    );
  }

  if (containsSensitiveMarkers(input.title) || containsSensitiveMarkers(input.rawText)) {
    warnings.push(SENSITIVE_REDACTION_WARNING);
  }

  return {
    errors: dedupeStrings(errors),
    warnings: dedupeStrings(warnings),
    normalizedTextLength: normalizedText.length,
  };
}

export function buildTextImportPreviewInputStats(input: {
  title: string;
  rawText: string;
}): TextImportPreviewInputStats {
  const validation = validateTextImportPreviewInput(input);
  const normalizedTitle =
    typeof input.title === "string" ? normalizeSingleLinePreview(input.title) : "";
  const normalizedText =
    typeof input.rawText === "string" ? normalizePlainText(input.rawText) : "";
  const warnings = [...validation.warnings];

  if (normalizedTitle.length === 0 && normalizedText.length > 0) {
    warnings.push(MISSING_TITLE_WARNING);
  }

  return {
    titleCharCount: normalizedTitle.length,
    rawTextCharCount: normalizedText.length,
    estimatedLineCount: estimateLineCount(normalizedText.split("\n")),
    hasMeaningfulTitle: normalizedTitle.length > 0,
    hasMeaningfulRawText: normalizedText.length > 0,
    hasDangerousFields: validation.warnings.some((warning) =>
      warning.includes("危险") || warning.includes("脱敏"),
    ),
    errors: validation.errors,
    warnings: dedupeStrings(warnings),
  };
}

export function buildTextImportPreview(input: {
  title: string;
  rawText: string;
}): TextImportPreviewResult {
  if (typeof input.title !== "string" || typeof input.rawText !== "string") {
    throw new Error("标题和正文必须是字符串。");
  }

  const validation = validateTextImportPreviewInput(input);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(" "));
  }

  const normalizedText = normalizePlainText(input.rawText);
  if (normalizedText.length === 0) {
    throw new Error("正文在规范化后为空，无法生成预览。");
  }

  const warnings: string[] = [...validation.warnings];
  const bookTitlePreview = buildBookTitlePreview(input.title, warnings);
  const normalizedTitle = normalizeSingleLinePreview(input.title);
  const sections =
    normalizedTitle.length === 0
      ? [
          {
            title: DEFAULT_SINGLE_CHAPTER_TITLE,
            lines: normalizedText.split("\n"),
          },
        ]
      : splitIntoSections(normalizedText);

  if (normalizedTitle.length > 0 && sections.length === 1 && sections[0].title === DEFAULT_SINGLE_CHAPTER_TITLE) {
    warnings.push("未识别到支持的章节标题，已生成单章节预览。");
  }

  const chapters = sections.map((section, index) =>
    buildChapterPreview({
      section,
      order: index + 1,
      warnings,
    }),
  );

  return {
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    bookTitlePreview,
    chapterCount: chapters.length,
    chapters,
    warnings: dedupeStrings(warnings),
  };
}

export function buildTextImportChapterDisplayState(
  preview: TextImportPreviewResult,
  input?: {
    showAll?: boolean;
    visibleLimit?: number;
  },
): TextImportChapterDisplayState {
  const visibleLimit = input?.visibleLimit ?? DEFAULT_TEXT_IMPORT_CHAPTER_PREVIEW_LIMIT;
  const expanded = input?.showAll === true;
  const visibleCount = expanded
    ? preview.chapters.length
    : Math.min(visibleLimit, preview.chapters.length);

  return {
    visibleChapters: preview.chapters.slice(0, visibleCount),
    hiddenChapterCount: Math.max(0, preview.chapters.length - visibleCount),
    visibleLimit,
    expanded,
  };
}

export function buildTextImportPreviewFieldErrorState(
  errors: readonly string[],
): TextImportPreviewFieldErrorState {
  const titleError =
    errors.find((error) => error.includes("标题") || error.includes("书名")) ?? null;
  const rawTextError =
    errors.find((error) => error.includes("正文")) ?? null;

  return {
    titleError,
    rawTextError,
    firstErrorField: titleError !== null ? "title" : rawTextError !== null ? "rawText" : null,
  };
}

export function createTextImportPreviewExampleContent(): TextImportPreviewExampleContent {
  return TEXT_IMPORT_PREVIEW_EXAMPLE_CONTENT;
}

export function createTextImportPreviewResetState(): TextImportPreviewInteractionState {
  return {
    title: "",
    rawText: "",
    preview: null,
    chapterEdits: [],
    validationErrors: [],
    validationWarnings: [],
    previewError: null,
    showAllChapters: false,
  };
}

export function createTextImportPreviewExampleState(): TextImportPreviewInteractionState {
  const example = createTextImportPreviewExampleContent();

  return {
    title: example.title,
    rawText: example.rawText,
    preview: null,
    chapterEdits: [],
    validationErrors: [],
    validationWarnings: [],
    previewError: null,
    showAllChapters: false,
  };
}

export function buildTextImportPreviewStatusSummary(input: {
  preview: TextImportPreviewResult;
  confirmationStatus: TextImportPreviewStatusSummary["confirmationStatus"];
  hasDangerousFields: boolean;
}): TextImportPreviewStatusSummary {
  return {
    previewOnly: true,
    writesDatabase: false,
    saved: false,
    confirmationStatus: input.hasDangerousFields ? "blocked" : input.confirmationStatus,
    chapterCount: input.preview.chapterCount,
    estimatedTotalLines: input.preview.chapters.reduce(
      (total, chapter) => total + chapter.estimatedLineCount,
      0,
    ),
    hasDangerousFields: input.hasDangerousFields,
  };
}

export function shouldActivateTextImportChapterToggle(
  event: TextImportPreviewToggleKeyEventLike,
): boolean {
  return event.key === "Enter" || event.key === " " || event.key === "Spacebar";
}

function buildBookTitlePreview(title: string, warnings: string[]): string {
  const { text, redacted } = redactSensitiveText(title);
  const normalized = normalizeSingleLinePreview(text);
  const fallback = normalized.length > 0 ? normalized : FALLBACK_BOOK_TITLE;

  if (redacted) {
    warnings.push(SENSITIVE_REDACTION_WARNING);
  }

  if (normalized.length === 0) {
    warnings.push(MISSING_TITLE_WARNING);
  }

  return truncatePreviewText(fallback, MAX_BOOK_TITLE_PREVIEW_CHARS);
}

function buildChapterPreview(input: {
  section: SectionDraft;
  order: number;
  warnings: string[];
}): TextImportPreviewChapter {
  const sectionText = normalizePlainText(input.section.lines.join("\n"));
  const titleResult = redactSensitiveText(input.section.title);
  const bodyResult = redactSensitiveText(sectionText);
  const titlePreview = redactAndNormalizeTitle(titleResult.text);
  const previewText = truncatePreviewText(bodyResult.text, MAX_CHAPTER_PREVIEW_CHARS);

  if (sectionText.length === 0) {
    input.warnings.push(`第 ${input.order} 章在分隔后没有正文。`);
  }

  if (titleResult.redacted || bodyResult.redacted) {
    input.warnings.push(SENSITIVE_REDACTION_WARNING);
  }

  return {
    title: titlePreview,
    order: input.order,
    estimatedLineCount: estimateLineCount(input.section.lines),
    previewText,
  };
}

function splitIntoSections(text: string): SectionDraft[] {
  const lines = text.split("\n");
  const headings = lines
    .map((line, index) => detectHeading(line, index))
    .filter((heading): heading is DetectedHeading => heading !== undefined);

  if (headings.length === 0) {
    return [
      {
        title: DEFAULT_SINGLE_CHAPTER_TITLE,
        lines,
      },
    ];
  }

  const sections: SectionDraft[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const bodyStart = heading.index + 1;
    const bodyEnd = nextHeading?.index ?? lines.length;
    const bodyLines = lines.slice(bodyStart, bodyEnd);

    sections.push({
      title: heading.title,
      lines: index === 0 ? [...lines.slice(0, heading.index), ...bodyLines] : bodyLines,
    });
  }

  return sections;
}

function detectHeading(line: string, index: number): DetectedHeading | undefined {
  const trimmedLine = line.trim();

  if (trimmedLine.length === 0) {
    return undefined;
  }

  const markdownMatch = trimmedLine.match(/^#{1,2}\s+(.+?)\s*$/u);
  if (markdownMatch !== null) {
    return {
      title: markdownMatch[1],
      index,
    };
  }

  if (isChineseChapterHeading(trimmedLine) || isEnglishChapterHeading(trimmedLine)) {
    return {
      title: trimmedLine,
      index,
    };
  }

  return undefined;
}

function isChineseChapterHeading(line: string): boolean {
  return /^第\s*(?:\d+|[一二三四五六七八九十百千零〇两]+)\s*[章节回篇](?:\s*[:：.．。]?\s*.+)?$/u.test(
    line,
  );
}

function isEnglishChapterHeading(line: string): boolean {
  return /^chapter\s+\d+[a-z]?(?:\s*[:：\-–—]\s*.+)?$/i.test(line);
}

function redactAndNormalizeTitle(title: string): string {
  const { text } = redactSensitiveText(title);
  const normalized = normalizeSingleLinePreview(text);

  return truncatePreviewText(
    normalized.length > 0 ? normalized : DEFAULT_SINGLE_CHAPTER_TITLE,
    MAX_BOOK_TITLE_PREVIEW_CHARS,
  );
}

function normalizeSingleLinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function redactSensitiveText(text: string): RedactionResult {
  let redacted = false;
  let output = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    const before = output;
    output = output.replace(pattern, REDACTION_REPLACEMENT);
    if (output !== before) {
      redacted = true;
    }
  }

  return {
    text: output,
    redacted,
  };
}

function containsSensitiveMarkers(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function truncatePreviewText(text: string, maxLength: number): string {
  const compactText = normalizeSingleLinePreview(text);

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function estimateLineCount(lines: string[]): number {
  return lines.filter((line) => line.trim().length > 0).length;
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function normalizePlainText(text: string): string {
  return trimExcessWhitespace(normalizeLineEndings(text));
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimExcessWhitespace(text: string): string {
  const normalized = normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();

  return normalized.replace(/\n{3,}/g, "\n\n");
}
