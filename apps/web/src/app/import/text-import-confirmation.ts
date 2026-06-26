import type { TextImportPreviewResult } from "./text-import-preview.ts";

export type TextImportConfirmationStatus = "ready" | "blocked";

export interface TextImportConfirmationPreview {
  status: TextImportConfirmationStatus;
  previewOnly: true;
  implemented: true;
  safeToExposeToClient: true;
  readyForFutureSave: boolean;
  blockedReasons: string[];
  bookTitlePreview: string;
  chapterCount: number;
  estimatedTotalLines: number;
  warnings: string[];
  requiresExplicitUserConfirmation: true;
  writesDatabase: false;
  callsRepository: false;
}

export interface TextImportConfirmationChecklistItem {
  label: string;
  value: string;
  tone: "ready" | "blocked" | "neutral";
}

export interface TextImportConfirmationValidationResult {
  blockedReasons: string[];
  warnings: string[];
}

const FALLBACK_BOOK_TITLE = "未命名书籍";
const SENSITIVE_FIELD_NAMES = [
  "rawText",
  "rawPrompt",
  "rawResponse",
  "token",
  "secret",
  "cookie",
  "authorization",
  "apiKey",
  "databaseUrl",
  "DATABASE_URL",
];

const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bDATABASE_URL\b/i,
  /\bapi[\s_-]*key\b/i,
  /\bauthorization(?:\s*header)?\b/i,
  /\bcookie\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
];

export function createTextImportConfirmationPreview(
  previewResult: TextImportPreviewResult,
): TextImportConfirmationPreview {
  const validation = validateTextImportConfirmationPreview(previewResult);

  if (validation.blockedReasons.length > 0) {
    return createBlockedTextImportConfirmationPreview(
      previewResult,
      validation.blockedReasons,
      validation.warnings,
    );
  }

  return {
    status: "ready",
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    readyForFutureSave: true,
    blockedReasons: [],
    bookTitlePreview: normalizeBookTitlePreview(previewResult.bookTitlePreview),
    chapterCount: previewResult.chapterCount,
    estimatedTotalLines: estimateTotalLines(previewResult.chapters),
    warnings: normalizeStringArray(previewResult.warnings),
    requiresExplicitUserConfirmation: true,
    writesDatabase: false,
    callsRepository: false,
  };
}

export function createBlockedTextImportConfirmationPreview(
  previewResult: unknown,
  blockedReasons: readonly string[],
  warnings: readonly string[] = [],
): TextImportConfirmationPreview {
  return {
    status: "blocked",
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    readyForFutureSave: false,
    blockedReasons: dedupeStrings(normalizeStringArray(blockedReasons)),
    bookTitlePreview: selectSafeBookTitlePreview(previewResult),
    chapterCount: selectSafeChapterCount(previewResult),
    estimatedTotalLines: estimateTotalLinesFromUnknown(previewResult),
    warnings: dedupeStrings(normalizeStringArray(warnings)),
    requiresExplicitUserConfirmation: true,
    writesDatabase: false,
    callsRepository: false,
  };
}

export function buildTextImportConfirmationChecklist(
  confirmation: TextImportConfirmationPreview,
): TextImportConfirmationChecklistItem[] {
  const dangerousFieldValue = hasDangerousFieldWarning(confirmation.warnings)
    ? "已检测到并脱敏"
    : "未检测到危险字段";

  return [
    {
      label: "章节有效",
      value: confirmation.status === "ready" ? "已通过" : "需要复核",
      tone: confirmation.status,
    },
    {
      label: "危险字段检测",
      value: dangerousFieldValue,
      tone: dangerousFieldValue === "已检测到并脱敏" ? "blocked" : "neutral",
    },
    {
      label: "未写入数据库",
      value: "是",
      tone: "neutral",
    },
    {
      label: "保存功能未连接",
      value: "是",
      tone: "neutral",
    },
    {
      label: "未来需要显式确认",
      value: "是",
      tone: "neutral",
    },
  ];
}

export function validateTextImportConfirmationPreview(
  previewResult: unknown,
): TextImportConfirmationValidationResult {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(previewResult)) {
    blockedReasons.push("预览结果缺失或格式不正确。");
    return { blockedReasons, warnings };
  }

  if (previewResult.previewOnly !== true) {
    blockedReasons.push("previewOnly 必须为 true。");
  }

  if (previewResult.implemented !== true) {
    blockedReasons.push("implemented 必须为 true。");
  }

  if (previewResult.safeToExposeToClient !== true) {
    blockedReasons.push("safeToExposeToClient 必须为 true。");
  }

  const bookTitlePreview = previewResult.bookTitlePreview;
  if (typeof bookTitlePreview !== "string" || bookTitlePreview.trim().length === 0) {
    blockedReasons.push("bookTitlePreview 缺失。");
  }

  const chapterCount = previewResult.chapterCount;
  if (!isIntegerValue(chapterCount) || chapterCount <= 0) {
    blockedReasons.push("chapterCount 必须大于 0。");
  }

  const chapters = previewResult.chapters;
  if (!Array.isArray(chapters)) {
    blockedReasons.push("chapters 必须是数组。");
  } else if (isIntegerValue(chapterCount) && chapterCount !== chapters.length) {
    blockedReasons.push("chapterCount 必须与章节列表长度一致。");
  } else {
    for (const chapter of chapters) {
      if (!isRecord(chapter)) {
        blockedReasons.push("chapters 必须包含完整的章节预览。");
        break;
      }

      const chapterTitle = chapter.title;
      const chapterOrder = chapter.order;
      const estimatedLineCount = chapter.estimatedLineCount;
      const previewText = chapter.previewText;

      if (
        typeof chapterTitle !== "string" ||
        !isIntegerValue(chapterOrder) ||
        chapterOrder <= 0 ||
        !isIntegerValue(estimatedLineCount) ||
        estimatedLineCount < 0 ||
        typeof previewText !== "string"
      ) {
        blockedReasons.push("chapters 必须包含完整的章节预览。");
        break;
      }
    }
  }

  const previewWarnings = previewResult.warnings;
  if (!Array.isArray(previewWarnings)) {
    blockedReasons.push("warnings 必须是字符串数组。");
  } else {
    for (const warning of previewWarnings) {
      if (typeof warning !== "string") {
        blockedReasons.push("warnings 必须是字符串数组。");
        break;
      }
    }
    warnings.push(...normalizeStringArray(previewWarnings));
  }

  if (containsSensitiveFieldNames(previewResult)) {
    blockedReasons.push("预览结果包含不安全的字段名。");
  }

  if (containsSensitiveStringValues(previewResult)) {
    blockedReasons.push("预览结果包含敏感标记。");
  }

  return {
    blockedReasons: dedupeStrings(blockedReasons),
    warnings: dedupeStrings(warnings),
  };
}

function hasDangerousFieldWarning(warnings: readonly string[]): boolean {
  return warnings.some((warning) => warning.includes("脱敏") || warning.includes("危险"));
}

function selectSafeBookTitlePreview(previewResult: unknown): string {
  if (!isRecord(previewResult) || typeof previewResult.bookTitlePreview !== "string") {
    return FALLBACK_BOOK_TITLE;
  }

  const title = normalizeBookTitlePreview(previewResult.bookTitlePreview);
  if (title.length === 0) {
    return FALLBACK_BOOK_TITLE;
  }

  if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(title))) {
    return FALLBACK_BOOK_TITLE;
  }

  return title;
}

function selectSafeChapterCount(previewResult: unknown): number {
  if (!isRecord(previewResult)) {
    return 0;
  }

  const chapterCount = previewResult.chapterCount;
  if (!isIntegerValue(chapterCount) || chapterCount < 0) {
    return 0;
  }

  return chapterCount;
}

function estimateTotalLinesFromUnknown(previewResult: unknown): number {
  if (!isRecord(previewResult) || !Array.isArray(previewResult.chapters)) {
    return 0;
  }

  return estimateTotalLines(previewResult.chapters);
}

function estimateTotalLines(chapters: unknown[]): number {
  let total = 0;

  for (const chapter of chapters) {
    if (!isRecord(chapter)) {
      continue;
    }

    const estimatedLineCount = chapter.estimatedLineCount;
    if (isIntegerValue(estimatedLineCount) && estimatedLineCount > 0) {
      total += estimatedLineCount;
    }
  }

  return total;
}

function normalizeBookTitlePreview(value: string): string {
  return truncatePreviewText(normalizeSingleLinePreview(value), 80) || FALLBACK_BOOK_TITLE;
}

function normalizeSingleLinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncatePreviewText(text: string, maxLength: number): string {
  const compactText = normalizeSingleLinePreview(text);

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function containsSensitiveFieldNames(value: unknown): boolean {
  return walkRecordKeys(value, (key) => SENSITIVE_FIELD_NAMES.includes(key));
}

function containsSensitiveStringValues(value: unknown): boolean {
  return walkRecordValues(value, (item) =>
    typeof item === "string" && SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(item)),
  );
}

function walkRecordKeys(
  value: unknown,
  predicate: (key: string) => boolean,
  seen = new Set<object>(),
): boolean {
  if (!isRecord(value) || seen.has(value)) {
    return false;
  }

  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    if (predicate(key)) {
      return true;
    }

    if (walkRecordKeys(nestedValue, predicate, seen)) {
      return true;
    }
  }

  return false;
}

function walkRecordValues(
  value: unknown,
  predicate: (item: unknown) => boolean,
  seen = new Set<object>(),
): boolean {
  if (predicate(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (walkRecordValues(item, predicate, seen)) {
        return true;
      }
    }

    return false;
  }

  if (!isRecord(value) || seen.has(value)) {
    return false;
  }

  seen.add(value);

  for (const nestedValue of Object.values(value)) {
    if (walkRecordValues(nestedValue, predicate, seen)) {
      return true;
    }
  }

  return false;
}
