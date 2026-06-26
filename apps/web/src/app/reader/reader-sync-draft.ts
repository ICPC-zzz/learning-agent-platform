// Node --test 直接执行 .ts 单测时需要显式后缀；由 A271 保持最小改动接入。
import { validateSyncableFields, type ReaderSyncValidationResult } from "./reader-sync-validation.ts";

export type ReaderSyncDraftStatus = "ready" | "empty" | "invalid" | "partial";

export interface ReaderSyncDraftPayload {
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
  updatedAt?: string;
}

export interface ReaderSyncDraftResult {
  previewOnly: true;
  status: ReaderSyncDraftStatus;
  draftPayload: ReaderSyncDraftPayload | null;
  excludedLocalOnlyFields: string[];
  warnings: string[];
  validation: ReaderSyncValidationResult;
}

const CORE_DRAFT_FIELDS = new Set([
  "bookId",
  "chapterId",
  "progressRatio",
  "progressPercent",
  "updatedAt",
]);

const LOCAL_ONLY_FIELD_REASON: Record<string, string> = {
  noteCount: "noteCount（仅本地统计，不进入同步草稿）",
  bookmarkCount: "bookmarkCount（仅本地统计，不进入同步草稿）",
  readingSeconds: "readingSeconds（仅本地计时，不进入同步草稿）",
  sessionSeconds: "sessionSeconds（仅本地计时 legacy 字段，不进入同步草稿）",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function pushUnique(target: string[], warning: string): void {
  if (!target.includes(warning)) {
    target.push(warning);
  }
}

function toMissingFieldWarning(field: string): string {
  if (field === "progressRatio" || field === "progressPercent") {
    return `缺少 ${field}：当前仅能生成部分同步草稿（请至少补齐一个进度字段）。`;
  }
  return `缺少 ${field}：当前仅能生成部分同步草稿。`;
}

function buildExcludedLocalOnlyFields(localStatus: unknown): string[] {
  const excluded: string[] = Object.values(LOCAL_ONLY_FIELD_REASON);

  if (!isRecord(localStatus)) {
    return excluded;
  }

  const summary = localStatus;
  const additionalFields = Object.keys(summary).filter(
    (key) => !CORE_DRAFT_FIELDS.has(key) && !(key in LOCAL_ONLY_FIELD_REASON),
  );

  for (const field of additionalFields) {
    excluded.push(`${field}（非最小同步字段，当前不进入同步草稿）`);
  }

  return excluded;
}

function buildDraftPayload(
  validation: ReaderSyncValidationResult,
): {
  payload: ReaderSyncDraftPayload | null;
  hasCoreIds: boolean;
  hasProgress: boolean;
  derivedFromPercent: boolean;
} {
  const normalized = validation.normalized;
  if (!normalized) {
    return {
      payload: null,
      hasCoreIds: false,
      hasProgress: false,
      derivedFromPercent: false,
    };
  }

  const payload: ReaderSyncDraftPayload = {};

  if (normalized.bookId !== undefined) {
    payload.bookId = normalized.bookId;
  }
  if (normalized.chapterId !== undefined) {
    payload.chapterId = normalized.chapterId;
  }

  let derivedFromPercent = false;
  if (normalized.progressRatio !== undefined) {
    payload.progressRatio = normalized.progressRatio;
  } else if (normalized.progressPercent !== undefined) {
    payload.progressRatio = normalized.progressPercent / 100;
    derivedFromPercent = true;
  }

  if (normalized.updatedAt !== undefined) {
    payload.updatedAt = normalized.updatedAt;
  }

  const hasCoreIds = payload.bookId !== undefined && payload.chapterId !== undefined;
  const hasProgress = payload.progressRatio !== undefined;
  const hasAnyField = Object.keys(payload).length > 0;

  return {
    payload: hasAnyField ? payload : null,
    hasCoreIds,
    hasProgress,
    derivedFromPercent,
  };
}

function createResult(
  status: ReaderSyncDraftStatus,
  validation: ReaderSyncValidationResult,
  draftPayload: ReaderSyncDraftPayload | null,
  excludedLocalOnlyFields: string[],
  warnings: string[],
): ReaderSyncDraftResult {
  return {
    previewOnly: true,
    status,
    draftPayload,
    excludedLocalOnlyFields,
    warnings,
    validation,
  };
}

export function buildReaderSyncDraft(localStatus: unknown): ReaderSyncDraftResult {
  const validation = validateSyncableFields(localStatus);
  const excludedLocalOnlyFields = buildExcludedLocalOnlyFields(localStatus);
  const warnings: string[] = [];

  for (const field of validation.missingFields) {
    pushUnique(warnings, toMissingFieldWarning(field));
  }

  for (const invalidField of validation.invalidFields) {
    pushUnique(
      warnings,
      `${invalidField.field} 字段格式无效：${invalidField.reason}`,
    );
  }

  for (const validationWarning of validation.warnings) {
    pushUnique(warnings, validationWarning);
  }

  const payloadResult = buildDraftPayload(validation);
  if (payloadResult.derivedFromPercent) {
    pushUnique(
      warnings,
      "仅检测到 progressPercent：已按 /100 转换为 progressRatio 草稿值。",
    );
  }

  if (validation.status === "empty") {
    return createResult(
      "empty",
      validation,
      null,
      excludedLocalOnlyFields,
      warnings,
    );
  }

  if (!isRecord(localStatus) || validation.status === "invalid") {
    return createResult(
      "invalid",
      validation,
      null,
      excludedLocalOnlyFields,
      warnings,
    );
  }

  if (payloadResult.hasCoreIds && payloadResult.hasProgress) {
    return createResult(
      "ready",
      validation,
      payloadResult.payload,
      excludedLocalOnlyFields,
      warnings,
    );
  }

  return createResult(
    "partial",
    validation,
    payloadResult.payload,
    excludedLocalOnlyFields,
    warnings,
  );
}
