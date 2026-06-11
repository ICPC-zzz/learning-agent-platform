import type { TextImportConfirmationPreview } from "./text-import-confirmation";
import type { TextImportEditedPreviewSummary } from "./text-import-edit-preview";
import type { TextImportPreviewResult } from "./text-import-preview";

export interface TextImportSaveRequestSafeChapter {
  order: number;
  title: string;
  estimatedLineCount: number;
  previewText: string;
}

export interface TextImportSaveRequestPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  bookTitlePreview: string;
  confirmationStatus: TextImportConfirmationPreview["status"];
  effectiveChapterCount: number;
  excludedChapterCount: number;
  estimatedTotalLines: number;
  safeChapters: TextImportSaveRequestSafeChapter[];
  requiresExplicitUserConfirmation: true;
  userExplicitlyConfirmed: boolean;
  saveReady: boolean;
  blockedReasons: string[];
  writesDatabase: false;
  callsRepository: false;
}

export interface TextImportSaveRequestValidationResult {
  blockedReasons: string[];
  bookTitlePreview: string;
  confirmationStatus: TextImportConfirmationPreview["status"];
  effectiveChapterCount: number;
  excludedChapterCount: number;
  estimatedTotalLines: number;
  safeChapters: TextImportSaveRequestSafeChapter[];
  userExplicitlyConfirmed: boolean;
}

export interface TextImportSaveRequestInput {
  preview: TextImportPreviewResult;
  confirmation: TextImportConfirmationPreview;
  summary: TextImportEditedPreviewSummary;
  userExplicitlyConfirmed: boolean;
}

const FALLBACK_BOOK_TITLE = "未命名书籍";
const MAX_BOOK_TITLE_PREVIEW_CHARS = 80;
const MAX_CHAPTER_PREVIEW_CHARS = 160;
const REDACTION_REPLACEMENT = "[已隐藏]";
const MISSING_FIELDS_REASON = "保存请求缺少必要字段。";
const CONFIRMATION_BLOCKED_REASON = "保存前确认仍处于阻断状态。";
const NO_EFFECTIVE_CHAPTERS_REASON = "当前没有可保存的有效章节。";
const USER_CONFIRMATION_REASON = "用户尚未显式确认。";
const DANGEROUS_FIELDS_REASON = "检测到危险字段，保存请求已阻断。";

const SENSITIVE_FIELD_NAMES = [
  "rawText",
  "rawPrompt",
  "rawResponse",
  "token",
  "secret",
  "cookie",
  "session",
  "authorization",
  "apiKey",
  "databaseUrl",
  "DATABASE_URL",
];

const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bDATABASE_URL\b[^\n]*/i,
  /\bapi[\s_-]*key\b[^\n]*/i,
  /\bauthorization(?:\s*header)?\b[^\n]*/i,
  /\bcookie\b[^\n]*/i,
  /\bsession\b[^\n]*/i,
  /\bsecret\b[^\n]*/i,
  /\btoken\b[^\n]*/i,
];

export function createTextImportSaveRequestPreview(
  input: unknown,
): TextImportSaveRequestPreview {
  const validation = validateTextImportSaveRequestPreview(input);

  if (validation.blockedReasons.length > 0) {
    return createBlockedTextImportSaveRequestPreview(input, validation.blockedReasons);
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    bookTitlePreview: validation.bookTitlePreview,
    confirmationStatus: validation.confirmationStatus,
    effectiveChapterCount: validation.effectiveChapterCount,
    excludedChapterCount: validation.excludedChapterCount,
    estimatedTotalLines: validation.estimatedTotalLines,
    safeChapters: validation.safeChapters,
    requiresExplicitUserConfirmation: true,
    userExplicitlyConfirmed: validation.userExplicitlyConfirmed,
    saveReady: true,
    blockedReasons: [],
    writesDatabase: false,
    callsRepository: false,
  };
}

export function validateTextImportSaveRequestPreview(
  input: unknown,
): TextImportSaveRequestValidationResult {
  const normalizedInput = normalizeTextImportSaveRequestInput(input);
  const blockedReasons: string[] = [];

  if (
    normalizedInput.preview === null ||
    normalizedInput.confirmation === null ||
    normalizedInput.summary === null
  ) {
    blockedReasons.push(MISSING_FIELDS_REASON);
  }

  if (
    normalizedInput.preview !== null &&
    (normalizedInput.preview.previewOnly !== true ||
      normalizedInput.preview.implemented !== true ||
      normalizedInput.preview.safeToExposeToClient !== true ||
      typeof normalizedInput.preview.bookTitlePreview !== "string" ||
      normalizedInput.preview.bookTitlePreview.trim().length === 0 ||
      !Array.isArray(normalizedInput.preview.chapters))
  ) {
    blockedReasons.push(MISSING_FIELDS_REASON);
  }

  if (
    normalizedInput.confirmation !== null &&
    (normalizedInput.confirmation.previewOnly !== true ||
      normalizedInput.confirmation.implemented !== true ||
      normalizedInput.confirmation.safeToExposeToClient !== true ||
      normalizedInput.confirmation.requiresExplicitUserConfirmation !== true ||
      typeof normalizedInput.confirmation.bookTitlePreview !== "string" ||
      normalizedInput.confirmation.bookTitlePreview.trim().length === 0)
  ) {
    blockedReasons.push(MISSING_FIELDS_REASON);
  }

  if (
    normalizedInput.summary !== null &&
    (normalizedInput.summary.previewOnly !== true ||
      normalizedInput.summary.implemented !== true ||
      normalizedInput.summary.safeToExposeToClient !== true ||
      typeof normalizedInput.summary.confirmationStatus !== "string" ||
      !Number.isInteger(normalizedInput.summary.effectiveChapterCount) ||
      !Number.isInteger(normalizedInput.summary.excludedChapterCount) ||
      !Number.isInteger(normalizedInput.summary.estimatedTotalLines))
  ) {
    blockedReasons.push(MISSING_FIELDS_REASON);
  }

  if (
    normalizedInput.summary !== null &&
    (!Array.isArray(normalizedInput.summary.chapters) ||
      !isValidSummaryChapters(normalizedInput.summary.chapters))
  ) {
    blockedReasons.push(MISSING_FIELDS_REASON);
  }

  const confirmationStatus = selectConfirmationStatus(normalizedInput.confirmation);
  const summaryChapters = selectRecordArray(normalizedInput.summary?.chapters);

  if (confirmationStatus === "blocked") {
    blockedReasons.push(CONFIRMATION_BLOCKED_REASON);
  }

  if (normalizedInput.summary !== null && normalizedInput.summary.confirmationStatus === "blocked") {
    blockedReasons.push(CONFIRMATION_BLOCKED_REASON);
  }

  const effectiveChapterCount = selectIntegerValue(
    normalizedInput.summary?.effectiveChapterCount,
    0,
  );
  const excludedChapterCount = selectIntegerValue(
    normalizedInput.summary?.excludedChapterCount,
    0,
  );
  const estimatedTotalLines = selectIntegerValue(
    normalizedInput.summary?.estimatedTotalLines,
    0,
  );
  const bookTitlePreview = selectSafeBookTitlePreview(
    selectStringValue(normalizedInput.preview?.bookTitlePreview) ??
      selectStringValue(normalizedInput.confirmation?.bookTitlePreview) ??
      selectStringValue(summaryChapters?.[0]?.title) ??
      FALLBACK_BOOK_TITLE,
  );
  const safeChapters = buildSafeChapters(summaryChapters ?? normalizedInput.summary?.chapters);

  if (effectiveChapterCount <= 0 || safeChapters.length <= 0) {
    blockedReasons.push(NO_EFFECTIVE_CHAPTERS_REASON);
  }

  if (normalizedInput.userExplicitlyConfirmed !== true) {
    blockedReasons.push(USER_CONFIRMATION_REASON);
  }

  if (
    hasDangerousFieldWarning(normalizedInput.preview?.warnings) ||
    hasDangerousFieldWarning(normalizedInput.confirmation?.warnings) ||
    hasDangerousFieldWarning(normalizedInput.summary?.warnings)
  ) {
    blockedReasons.push(DANGEROUS_FIELDS_REASON);
  }

  if (containsSensitiveFieldNames(input) || containsSensitiveStringValues(input)) {
    blockedReasons.push(DANGEROUS_FIELDS_REASON);
  }

  return {
    blockedReasons: dedupeStrings(blockedReasons),
    bookTitlePreview,
    confirmationStatus,
    effectiveChapterCount: safeChapters.length,
    excludedChapterCount: Math.max(0, excludedChapterCount),
    estimatedTotalLines: sumEstimatedLineCount(safeChapters),
    safeChapters,
    userExplicitlyConfirmed: normalizedInput.userExplicitlyConfirmed,
  };
}

export function createBlockedTextImportSaveRequestPreview(
  input: unknown,
  blockedReasons: readonly string[] = [],
): TextImportSaveRequestPreview {
  const normalizedInput = normalizeTextImportSaveRequestInput(input);
  const summaryChapters = selectRecordArray(normalizedInput.summary?.chapters);
  const safeChapters = buildSafeChapters(summaryChapters ?? normalizedInput.summary?.chapters);
  const fallbackBookTitle = selectSafeBookTitlePreview(
    selectStringValue(normalizedInput.preview?.bookTitlePreview) ??
      selectStringValue(normalizedInput.confirmation?.bookTitlePreview) ??
      selectStringValue(summaryChapters?.[0]?.title) ??
      FALLBACK_BOOK_TITLE,
  );
  const excludedChapterCount = selectIntegerValue(
    normalizedInput.summary?.excludedChapterCount,
    Math.max(0, (summaryChapters?.length ?? 0) - safeChapters.length),
  );
  const estimatedTotalLines = sumEstimatedLineCount(safeChapters);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    bookTitlePreview: fallbackBookTitle,
    confirmationStatus: selectConfirmationStatus(normalizedInput.confirmation),
    effectiveChapterCount: safeChapters.length,
    excludedChapterCount: Math.max(0, excludedChapterCount),
    estimatedTotalLines,
    safeChapters,
    requiresExplicitUserConfirmation: true,
    userExplicitlyConfirmed: normalizedInput.userExplicitlyConfirmed,
    saveReady: false,
    blockedReasons: dedupeStrings(
      blockedReasons.length > 0 ? [...blockedReasons] : [MISSING_FIELDS_REASON],
    ),
    writesDatabase: false,
    callsRepository: false,
  };
}

function normalizeTextImportSaveRequestInput(input: unknown): {
  preview: Record<string, unknown> | null;
  confirmation: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  userExplicitlyConfirmed: boolean;
} {
  if (!isRecord(input)) {
    return {
      preview: null,
      confirmation: null,
      summary: null,
      userExplicitlyConfirmed: false,
    };
  }

  return {
    preview: isRecord(input.preview) ? input.preview : null,
    confirmation: isRecord(input.confirmation) ? input.confirmation : null,
    summary: isRecord(input.summary) ? input.summary : null,
    userExplicitlyConfirmed: input.userExplicitlyConfirmed === true,
  };
}

function buildSafeChapters(chapters: unknown): TextImportSaveRequestSafeChapter[] {
  if (!Array.isArray(chapters)) {
    return [];
  }

  const safeChapters: TextImportSaveRequestSafeChapter[] = [];

  for (const chapter of chapters) {
    if (!isRecord(chapter)) {
      continue;
    }

    if (chapter.excluded === true) {
      continue;
    }

    const order = selectIntegerValue(chapter.order, 0);
    const estimatedLineCount = selectIntegerValue(chapter.estimatedLineCount, 0);
    const title = selectSafeChapterTitlePreview(String(chapter.title ?? ""), order);
    const previewText = selectSafeChapterPreviewText(String(chapter.previewText ?? ""));

    if (order <= 0 || estimatedLineCount < 0) {
      continue;
    }

    safeChapters.push({
      order,
      title,
      estimatedLineCount,
      previewText,
    });
  }

  return safeChapters;
}

function selectSafeBookTitlePreview(value: string): string {
  const { text } = redactSensitiveText(value);
  const normalized = normalizeSingleLinePreview(text);
  const fallback = normalized.length > 0 ? normalized : FALLBACK_BOOK_TITLE;

  return truncatePreviewText(fallback, MAX_BOOK_TITLE_PREVIEW_CHARS);
}

function selectSafeChapterTitlePreview(value: string, order: number): string {
  const { text } = redactSensitiveText(value);
  const normalized = normalizeSingleLinePreview(text);
  const fallback = normalized.length > 0 ? normalized : `未命名章节 ${order}`;

  return truncatePreviewText(fallback, MAX_BOOK_TITLE_PREVIEW_CHARS);
}

function selectSafeChapterPreviewText(value: string): string {
  const { text } = redactSensitiveText(value);

  return truncatePreviewText(text, MAX_CHAPTER_PREVIEW_CHARS);
}

function selectIntegerValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function selectStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function selectRecordArray(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(isRecord);
}

function selectConfirmationStatus(
  value: Record<string, unknown> | null,
): TextImportConfirmationPreview["status"] {
  return value?.status === "ready" || value?.status === "blocked" ? value.status : "blocked";
}

function sumEstimatedLineCount(chapters: readonly TextImportSaveRequestSafeChapter[]): number {
  return chapters.reduce((total, chapter) => total + chapter.estimatedLineCount, 0);
}

function normalizeSingleLinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function redactSensitiveText(text: string): { text: string; redacted: boolean } {
  let redacted = false;
  let output = text;

  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
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

function truncatePreviewText(text: string, maxLength: number): string {
  const compactText = normalizeSingleLinePreview(text);

  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDangerousFieldWarning(warnings: unknown): boolean {
  return (
    Array.isArray(warnings) &&
    warnings.some(
      (warning) =>
        typeof warning === "string" &&
        (warning.includes("危险") || warning.includes("脱敏")),
    )
  );
}

function isValidSummaryChapters(chapters: unknown[]): boolean {
  return chapters.every((chapter) => {
    if (!isRecord(chapter)) {
      return false;
    }

    return (
      selectIntegerValue(chapter.order, 0) > 0 &&
      selectIntegerValue(chapter.estimatedLineCount, -1) >= 0 &&
      typeof chapter.title === "string" &&
      typeof chapter.previewText === "string"
    );
  });
}

function dedupeStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
