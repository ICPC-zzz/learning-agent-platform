// Node --test 直接执行 .ts 单测时需要显式后缀；由 A269 保持最小改动接入。
// @ts-expect-error TS5097: 本文件在单测链路使用 .ts 后缀导入。
import { validateSyncableFields } from "./reader-sync-validation.ts";

export type ReaderSyncPreviewStatus = "ready" | "empty" | "invalid" | "partial";

export interface ReaderSyncPreviewResult {
  previewOnly: true;
  status: ReaderSyncPreviewStatus;
  syncableFields: string[];
  localOnlyFields: string[];
  warnings: string[];
  summaryText: string;
}

export interface BuildReaderSyncPreviewInput {
  storageAvailable: boolean;
  rawSummary: string | null;
}

const READER_LOCAL_STATUS_V1_KEY = "lap.reader.localStatus.v1";

const LOCAL_ONLY_FIELDS = [
  "noteCount",
  "bookmarkCount",
  "readingSeconds",
] as const;

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function pushUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function toMissingFieldWarning(field: string): string {
  if (field === "progressRatio" || field === "progressPercent") {
    return `缺少 ${field}：暂不能完整预演同步（请至少补齐一个进度字段）。`;
  }

  return `缺少 ${field}：暂不能完整预演同步。`;
}

function createEmptyResult(warnings: string[], summaryText: string): ReaderSyncPreviewResult {
  return {
    previewOnly: true,
    status: "empty",
    syncableFields: [],
    localOnlyFields: [...LOCAL_ONLY_FIELDS],
    warnings,
    summaryText,
  };
}

function createInvalidResult(warnings: string[], summaryText: string): ReaderSyncPreviewResult {
  return {
    previewOnly: true,
    status: "invalid",
    syncableFields: [],
    localOnlyFields: [...LOCAL_ONLY_FIELDS],
    warnings,
    summaryText,
  };
}

export function buildReaderSyncPreview(
  input: BuildReaderSyncPreviewInput,
): ReaderSyncPreviewResult {
  if (!input.storageAvailable) {
    return createEmptyResult(
      ["当前浏览器环境无法访问 localStorage，已安全降级为只读空态预演。"],
      "本地存储不可用：无法读取同步预演数据。",
    );
  }

  if (input.rawSummary === null) {
    return createEmptyResult(
      [
        `未找到本地摘要 key（${READER_LOCAL_STATUS_V1_KEY}），暂无可预演同步数据。`,
      ],
      "暂无可预演同步数据。",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawSummary) as unknown;
  } catch {
    return createInvalidResult(
      ["本地摘要 JSON 解析失败，已安全降级；请刷新或重新生成本地摘要。"],
      "本地摘要不可解析：同步预演已降级。",
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    return createInvalidResult(
      ["本地摘要结构无效（非对象），已安全降级。"],
      "本地摘要结构无效：同步预演已降级。",
    );
  }

  const summary = parsed as Record<string, unknown>;
  if (
    summary.schemaVersion !== 1 ||
    summary.source !== "reader" ||
    summary.previewOnly !== true
  ) {
    return createInvalidResult(
      ["本地摘要版本或来源不匹配（需要 schemaVersion=1/source=reader/previewOnly=true）。"],
      "本地摘要版本不兼容：同步预演已降级。",
    );
  }

  const warnings: string[] = [];
  const validation = validateSyncableFields(summary);
  const syncableFields: string[] = [...validation.validFields];
  const localOnlyFields: string[] = [...LOCAL_ONLY_FIELDS];

  if (summary.sessionSeconds !== undefined) {
    localOnlyFields.push("sessionSeconds(legacy)");
  }

  for (const field of validation.missingFields) {
    pushUniqueWarning(warnings, toMissingFieldWarning(field));
  }

  for (const invalidField of validation.invalidFields) {
    pushUniqueWarning(
      warnings,
      `${invalidField.field} 字段格式无效：${invalidField.reason}`,
    );
  }

  for (const validationWarning of validation.warnings) {
    pushUniqueWarning(warnings, validationWarning);
  }

  if (normalizeNullableString(summary.updatedAt) === null) {
    pushUniqueWarning(warnings, "缺少 updatedAt：预演中无法展示最近摘要更新时间。");
  }

  if (validation.status === "empty") {
    return {
      previewOnly: true,
      status: "empty",
      syncableFields,
      localOnlyFields,
      warnings,
      summaryText: "当前摘要没有可用于预演同步的字段。",
    };
  }

  if (validation.status === "invalid") {
    return {
      previewOnly: true,
      status: "invalid",
      syncableFields,
      localOnlyFields,
      warnings,
      summaryText: "同步字段校验未通过：同步预演已降级。",
    };
  }

  if (validation.status === "valid") {
    return {
      previewOnly: true,
      status: "ready",
      syncableFields,
      localOnlyFields,
      warnings,
      summaryText:
        "已生成同步预演：仅展示未来可能同步字段，不会执行真实同步。",
    };
  }

  return {
    previewOnly: true,
    status: "partial",
    syncableFields,
    localOnlyFields,
    warnings,
    summaryText:
      "已生成部分同步预演：摘要字段不完整，正式同步前需补齐关键字段。",
  };
}
