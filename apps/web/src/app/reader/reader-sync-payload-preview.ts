import type { ReaderSyncDraftResult } from "./reader-sync-draft";

export type ReaderSyncPayloadPreviewStatus = "ready" | "empty" | "invalid" | "partial";

export interface ReaderSyncPayloadPreview {
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
}

export interface ReaderSyncPayloadMatchedField {
  draftField: string;
  modelField: string;
  valuePreview: string;
  note?: string;
}

export interface ReaderSyncPayloadBlockedField {
  field: string;
  reason: string;
}

export interface ReaderSyncPayloadPreviewResult {
  previewOnly: true;
  status: ReaderSyncPayloadPreviewStatus;
  targetModel: "ReadingProgress";
  payloadPreview: ReaderSyncPayloadPreview | null;
  matchedFields: ReaderSyncPayloadMatchedField[];
  blockedFields: ReaderSyncPayloadBlockedField[];
  warnings: string[];
}

const TARGET_MODEL = "ReadingProgress" as const;
const CORE_SYNC_FIELDS = ["bookId", "chapterId", "progressRatio"] as const;
const LOCAL_ONLY_FIELDS = new Map<string, string>([
  ["noteCount", "noteCount 为 local-only 字段，禁止进入 DB payload 预览。"],
  ["bookmarkCount", "bookmarkCount 为 local-only 字段，禁止进入 DB payload 预览。"],
  ["readingSeconds", "readingSeconds 为 local-only 字段，禁止进入 DB payload 预览。"],
  ["sessionSeconds", "sessionSeconds 为 local-only 字段，禁止进入 DB payload 预览。"],
]);

function pushUniqueWarning(target: string[], warning: string): void {
  if (!target.includes(warning)) {
    target.push(warning);
  }
}

function pushUniqueBlocked(
  target: ReaderSyncPayloadBlockedField[],
  field: string,
  reason: string,
): void {
  if (!target.some((item) => item.field === field && item.reason === reason)) {
    target.push({ field, reason });
  }
}

function toSourceField(raw: string): string {
  const normalized = raw.trim();
  const separatorIndex = normalized.search(/[（(]/);
  if (separatorIndex < 0) {
    return normalized;
  }
  return normalized.slice(0, separatorIndex).trim();
}

function buildBaseBlockedFields(
  excludedLocalOnlyFields: string[],
): ReaderSyncPayloadBlockedField[] {
  const blocked: ReaderSyncPayloadBlockedField[] = [];

  for (const [field, reason] of LOCAL_ONLY_FIELDS.entries()) {
    pushUniqueBlocked(blocked, field, reason);
  }

  for (const item of excludedLocalOnlyFields) {
    const sourceField = toSourceField(item);
    if (sourceField.length === 0) {
      continue;
    }
    pushUniqueBlocked(
      blocked,
      sourceField,
      `${sourceField} 当前不属于最小同步映射范围，暂不进入 DB payload 预览。`,
    );
  }

  return blocked;
}

function toResult(
  status: ReaderSyncPayloadPreviewStatus,
  payloadPreview: ReaderSyncPayloadPreview | null,
  matchedFields: ReaderSyncPayloadMatchedField[],
  blockedFields: ReaderSyncPayloadBlockedField[],
  warnings: string[],
): ReaderSyncPayloadPreviewResult {
  return {
    previewOnly: true,
    status,
    targetModel: TARGET_MODEL,
    payloadPreview,
    matchedFields,
    blockedFields,
    warnings,
  };
}

export function buildReaderSyncPayloadPreview(
  draft: ReaderSyncDraftResult,
): ReaderSyncPayloadPreviewResult {
  const warnings: string[] = [...draft.warnings];
  const blockedFields = buildBaseBlockedFields(draft.excludedLocalOnlyFields);
  const matchedFields: ReaderSyncPayloadMatchedField[] = [];
  const payloadPreview: ReaderSyncPayloadPreview = {};

  pushUniqueWarning(
    warnings,
    "ReadingProgress.userId 由鉴权上下文提供，当前草稿不包含该字段；本能力仅做本地映射预览。",
  );

  if (draft.status === "empty") {
    return toResult("empty", null, matchedFields, blockedFields, warnings);
  }

  if (draft.status === "invalid") {
    return toResult("invalid", null, matchedFields, blockedFields, warnings);
  }

  if (draft.draftPayload?.bookId !== undefined) {
    payloadPreview.bookId = draft.draftPayload.bookId;
    matchedFields.push({
      draftField: "bookId",
      modelField: "ReadingProgress.bookId",
      valuePreview: draft.draftPayload.bookId,
    });
  }

  if (draft.draftPayload?.chapterId !== undefined) {
    payloadPreview.chapterId = draft.draftPayload.chapterId;
    matchedFields.push({
      draftField: "chapterId",
      modelField: "ReadingProgress.chapterId",
      valuePreview: draft.draftPayload.chapterId,
    });
  }

  if (draft.draftPayload?.progressRatio !== undefined) {
    payloadPreview.progressRatio = draft.draftPayload.progressRatio;
    matchedFields.push({
      draftField: "progressRatio",
      modelField: "ReadingProgress.progressRatio",
      valuePreview: String(draft.draftPayload.progressRatio),
    });
  }

  if (draft.draftPayload?.updatedAt !== undefined) {
    pushUniqueBlocked(
      blockedFields,
      "updatedAt",
      "ReadingProgress.updatedAt 为 @updatedAt 自动维护字段；当前仅做来源时间展示，不进入 payloadPreview。",
    );
    pushUniqueWarning(
      warnings,
      "updatedAt 目前仅用于本地预览提示；未确认写入入口前不纳入 DB payload。",
    );
  }

  pushUniqueBlocked(
    blockedFields,
    "lastReadAt",
    "ReadingProgress 当前模型未定义 lastReadAt 字段，无法进入 payloadPreview。",
  );

  for (const field of CORE_SYNC_FIELDS) {
    if (!(field in payloadPreview)) {
      pushUniqueBlocked(
        blockedFields,
        field,
        `${field} 在当前草稿中缺失或无效，暂不能映射到 ReadingProgress payload。`,
      );
    }
  }

  const hasPayload = Object.keys(payloadPreview).length > 0;
  if (!hasPayload) {
    return toResult("partial", null, matchedFields, blockedFields, warnings);
  }

  const hasCoreMapped =
    payloadPreview.bookId !== undefined &&
    payloadPreview.chapterId !== undefined &&
    payloadPreview.progressRatio !== undefined;

  const status: ReaderSyncPayloadPreviewStatus =
    draft.status === "ready" && hasCoreMapped ? "ready" : "partial";

  return toResult(status, payloadPreview, matchedFields, blockedFields, warnings);
}
