export type ReaderSyncValidationStatus = "valid" | "empty" | "invalid" | "partial";

export interface ReaderSyncInvalidField {
  field: string;
  reason: string;
}

export interface ReaderSyncValidationNormalized {
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
  progressPercent?: number;
  updatedAt?: string;
}

export interface ReaderSyncValidationResult {
  previewOnly: true;
  isValid: boolean;
  status: ReaderSyncValidationStatus;
  validFields: string[];
  invalidFields: ReaderSyncInvalidField[];
  missingFields: string[];
  warnings: string[];
  normalized?: ReaderSyncValidationNormalized;
}

const LOCAL_ONLY_CANDIDATE_FIELDS = [
  "noteCount",
  "bookmarkCount",
  "readingSeconds",
  "sessionSeconds",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOwnProperty(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function appendLocalOnlyWarnings(summary: Record<string, unknown>, warnings: string[]): void {
  for (const field of LOCAL_ONLY_CANDIDATE_FIELDS) {
    if (summary[field] !== undefined) {
      warnings.push(`${field} 当前仍为 local-only 字段，不属于本轮可同步字段。`);
    }
  }
}

function toResult(
  input: Omit<ReaderSyncValidationResult, "previewOnly">,
): ReaderSyncValidationResult {
  return {
    previewOnly: true,
    ...input,
  };
}

function normalizeDateString(value: unknown): { value?: string; warning?: string; invalid?: string } {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "string") {
    return { invalid: "updatedAt 必须是可解析日期字符串" };
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return { invalid: "updatedAt 不能为空字符串" };
  }

  const epochMs = Date.parse(normalized);
  if (Number.isNaN(epochMs)) {
    return { warning: "updatedAt 无法解析为有效日期，预演将忽略该时间字段。" };
  }

  return { value: new Date(epochMs).toISOString() };
}

export function validateSyncableFields(localStatus: unknown): ReaderSyncValidationResult {
  if (localStatus === null || localStatus === undefined) {
    return toResult({
      isValid: false,
      status: "empty",
      validFields: [],
      invalidFields: [],
      missingFields: ["bookId", "chapterId", "progressRatio/progressPercent"],
      warnings: ["本地摘要为空，暂无可校验同步字段。"],
    });
  }

  if (!isRecord(localStatus)) {
    return toResult({
      isValid: false,
      status: "invalid",
      validFields: [],
      invalidFields: [{ field: "localStatus", reason: "摘要必须是对象" }],
      missingFields: ["bookId", "chapterId", "progressRatio/progressPercent"],
      warnings: ["本地摘要结构无效（非对象）。"],
    });
  }

  const summary = localStatus;
  const warnings: string[] = [];
  const validFields: string[] = [];
  const invalidFields: ReaderSyncInvalidField[] = [];
  const missingFields: string[] = [];
  const normalized: ReaderSyncValidationNormalized = {};

  const bookId = normalizeNonEmptyString(summary.bookId);
  if (bookId !== null) {
    normalized.bookId = bookId;
    validFields.push("bookId");
  } else if (!hasOwnProperty(summary, "bookId") || summary.bookId === null) {
    missingFields.push("bookId");
  } else {
    invalidFields.push({ field: "bookId", reason: "bookId 必须是非空字符串" });
  }

  const chapterId = normalizeNonEmptyString(summary.chapterId);
  if (chapterId !== null) {
    normalized.chapterId = chapterId;
    validFields.push("chapterId");
  } else if (!hasOwnProperty(summary, "chapterId") || summary.chapterId === null) {
    missingFields.push("chapterId");
  } else {
    invalidFields.push({ field: "chapterId", reason: "chapterId 必须是非空字符串" });
  }

  let ratioValue: number | null = null;
  if (summary.progressRatio !== undefined && summary.progressRatio !== null) {
    if (!isFiniteNumber(summary.progressRatio) || summary.progressRatio < 0 || summary.progressRatio > 1) {
      invalidFields.push({
        field: "progressRatio",
        reason: "progressRatio 必须是 0 到 1 的数字",
      });
    } else {
      ratioValue = summary.progressRatio;
      normalized.progressRatio = summary.progressRatio;
      validFields.push("progressRatio");
    }
  }

  let percentValue: number | null = null;
  if (summary.progressPercent !== undefined && summary.progressPercent !== null) {
    if (!isFiniteNumber(summary.progressPercent) || summary.progressPercent < 0 || summary.progressPercent > 100) {
      invalidFields.push({
        field: "progressPercent",
        reason: "progressPercent 必须是 0 到 100 的数字",
      });
    } else {
      percentValue = summary.progressPercent;
      normalized.progressPercent = summary.progressPercent;
      validFields.push("progressPercent");
    }
  }

  if (ratioValue === null && percentValue === null) {
    missingFields.push("progressRatio");
    missingFields.push("progressPercent");
  }

  if (ratioValue !== null && percentValue !== null) {
    const derivedPercent = ratioValue * 100;
    if (Math.abs(derivedPercent - percentValue) > 1) {
      warnings.push(
        "progressRatio 与 progressPercent 数值存在冲突（容差 1%），请在正式同步前确认进度来源。",
      );
    }
  }

  const dateResult = normalizeDateString(summary.updatedAt);
  if (dateResult.value !== undefined) {
    normalized.updatedAt = dateResult.value;
    validFields.push("updatedAt");
  }
  if (dateResult.invalid !== undefined) {
    invalidFields.push({ field: "updatedAt", reason: dateResult.invalid });
  }
  if (dateResult.warning !== undefined) {
    warnings.push(dateResult.warning);
  }

  appendLocalOnlyWarnings(summary, warnings);

  const hasCoreIds = normalized.bookId !== undefined && normalized.chapterId !== undefined;
  const hasProgress = normalized.progressRatio !== undefined || normalized.progressPercent !== undefined;

  let status: ReaderSyncValidationStatus = "partial";
  if (validFields.length === 0 && invalidFields.length === 0) {
    status = "empty";
  } else if (!hasCoreIds && !hasProgress && validFields.length === 0 && invalidFields.length > 0) {
    status = "invalid";
  } else if (hasCoreIds && hasProgress && invalidFields.length === 0) {
    status = "valid";
  }

  if (missingFields.length === 0 && status !== "valid") {
    if (!hasCoreIds) {
      pushUnique(missingFields, "bookId");
      pushUnique(missingFields, "chapterId");
    }

    if (!hasProgress) {
      pushUnique(missingFields, "progressRatio");
      pushUnique(missingFields, "progressPercent");
    }
  }

  const isValid = status === "valid";
  const hasNormalizedData = Object.keys(normalized).length > 0;

  return toResult({
    isValid,
    status,
    validFields,
    invalidFields,
    missingFields,
    warnings,
    normalized: hasNormalizedData ? normalized : undefined,
  });
}
