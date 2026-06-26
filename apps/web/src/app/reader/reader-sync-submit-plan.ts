import type {
  ReaderSyncPayloadPreview,
  ReaderSyncPayloadPreviewResult,
} from "./reader-sync-payload-preview";

export type ReaderSyncSubmitPlanStatus =
  | "ready"
  | "blocked"
  | "empty"
  | "invalid"
  | "partial";

export interface ReaderSyncSubmitPlanBlocker {
  code: string;
  message: string;
}

export interface ReaderSyncSubmitPlanAuditDraft {
  action: "reader.progress.sync.preview";
  source: "localStorage";
  targetModel: "ReadingProgress";
  previewOnly: true;
}

export interface ReaderSyncSubmitPlanResult {
  previewOnly: true;
  status: ReaderSyncSubmitPlanStatus;
  canSubmit: false;
  targetModel: "ReadingProgress";
  draftOperation: "upsert-reading-progress-preview";
  idempotencyKeyPreview: string | null;
  auditDraft: ReaderSyncSubmitPlanAuditDraft;
  requiredContext: string[];
  blockers: ReaderSyncSubmitPlanBlocker[];
  warnings: string[];
  rollbackNotes: string[];
  retryNotes: string[];
}

const TARGET_MODEL = "ReadingProgress" as const;
const DRAFT_OPERATION = "upsert-reading-progress-preview" as const;

const REQUIRED_CONTEXT: string[] = [
  "future userId from auth context",
  "server-side permission check",
  "server action endpoint for submit orchestration",
  "audit log sink",
  "idempotency strategy",
];

const ROLLBACK_NOTES: string[] = [
  "正式同步前需定义按 userId+bookId+chapterId 的回滚粒度，避免误回滚其他进度记录。",
  "若未来 upsert 失败，需保留失败前快照引用，确保可人工复核并执行安全回退。",
];

const RETRY_NOTES: string[] = [
  "未来重试需基于同一幂等键，防止重复写入 ReadingProgress。",
  "未来重试应采用受控退避与上限策略，并记录每次失败原因到审计日志。",
];

const BASE_BLOCKERS: ReaderSyncSubmitPlanBlocker[] = [
  {
    code: "AUTH_CONTEXT_REQUIRED",
    message: "缺少 userId/鉴权上下文，当前仅能生成本地提交计划预览。",
  },
  {
    code: "SERVER_ACTION_UNAVAILABLE",
    message: "当前未接入 server action 提交入口，禁止真实提交。",
  },
  {
    code: "DB_WRITE_NOT_AUTHORIZED",
    message: "当前无 DB 写入授权边界，禁止真实写入 ReadingProgress。",
  },
  {
    code: "PREVIEW_ONLY_GUARD",
    message: "当前能力为 preview-only/local-only，canSubmit 固定为 false。",
  },
];

function toStableProgressRatio(progressRatio: number): string {
  return progressRatio.toFixed(6);
}

function buildIdempotencyKeyPreview(payload: ReaderSyncPayloadPreview | null): string | null {
  if (
    payload?.bookId === undefined ||
    payload.chapterId === undefined ||
    payload.progressRatio === undefined
  ) {
    return null;
  }

  return [
    "reader-sync-preview",
    payload.bookId,
    payload.chapterId,
    toStableProgressRatio(payload.progressRatio),
  ].join(":");
}

function appendUniqueBlocker(
  blockers: ReaderSyncSubmitPlanBlocker[],
  blocker: ReaderSyncSubmitPlanBlocker,
): void {
  if (!blockers.some((item) => item.code === blocker.code && item.message === blocker.message)) {
    blockers.push(blocker);
  }
}

function appendUniqueWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function toAuditDraft(): ReaderSyncSubmitPlanAuditDraft {
  return {
    action: "reader.progress.sync.preview",
    source: "localStorage",
    targetModel: TARGET_MODEL,
    previewOnly: true,
  };
}

function toResult(
  status: ReaderSyncSubmitPlanStatus,
  payloadPreview: ReaderSyncPayloadPreview | null,
  blockers: ReaderSyncSubmitPlanBlocker[],
  warnings: string[],
): ReaderSyncSubmitPlanResult {
  return {
    previewOnly: true,
    status,
    canSubmit: false,
    targetModel: TARGET_MODEL,
    draftOperation: DRAFT_OPERATION,
    idempotencyKeyPreview: buildIdempotencyKeyPreview(payloadPreview),
    auditDraft: toAuditDraft(),
    requiredContext: [...REQUIRED_CONTEXT],
    blockers,
    warnings,
    rollbackNotes: [...ROLLBACK_NOTES],
    retryNotes: [...RETRY_NOTES],
  };
}

export function buildReaderSyncSubmitPlan(
  payloadPreviewResult: ReaderSyncPayloadPreviewResult,
): ReaderSyncSubmitPlanResult {
  if (
    payloadPreviewResult === null ||
    payloadPreviewResult === undefined ||
    !Array.isArray(payloadPreviewResult.warnings)
  ) {
    const fallbackWarnings = [
      "payload preview 输入异常，已安全降级为 invalid 提交计划预览。",
      "当前仅生成提交计划预览，不会触发真实 DB 提交、server action 或网络请求。",
    ];
    const fallbackBlockers = [
      ...BASE_BLOCKERS,
      {
        code: "PAYLOAD_INPUT_INVALID",
        message: "submit plan 输入结构异常，无法生成可用预览。",
      },
    ];
    return toResult("invalid", null, fallbackBlockers, fallbackWarnings);
  }

  const warnings: string[] = [...payloadPreviewResult.warnings];
  const blockers: ReaderSyncSubmitPlanBlocker[] = [...BASE_BLOCKERS];
  const payloadPreview = payloadPreviewResult.payloadPreview;

  appendUniqueWarning(
    warnings,
    "当前仅生成提交计划预览，不会触发真实 DB 提交、server action 或网络请求。",
  );

  if (payloadPreviewResult.status === "empty") {
    appendUniqueBlocker(blockers, {
      code: "PAYLOAD_EMPTY",
      message: "payload preview 为空，无法形成可提交输入。",
    });
    return toResult("empty", null, blockers, warnings);
  }

  if (payloadPreviewResult.status === "invalid") {
    appendUniqueBlocker(blockers, {
      code: "PAYLOAD_INVALID",
      message: "payload preview 无效，需先修复本地摘要结构与字段格式。",
    });
    return toResult("invalid", null, blockers, warnings);
  }

  if (payloadPreviewResult.status === "partial") {
    appendUniqueBlocker(blockers, {
      code: "PAYLOAD_PARTIAL",
      message: "payload preview 字段不完整，当前仅允许部分预览。",
    });
    return toResult("partial", payloadPreview, blockers, warnings);
  }

  const hasCoreFields =
    payloadPreview?.bookId !== undefined &&
    payloadPreview.chapterId !== undefined &&
    payloadPreview.progressRatio !== undefined;

  if (!hasCoreFields) {
    appendUniqueBlocker(blockers, {
      code: "PAYLOAD_CORE_FIELDS_MISSING",
      message: "payload preview 缺少 bookId/chapterId/progressRatio，无法形成稳定幂等输入。",
    });
    return toResult("blocked", payloadPreview, blockers, warnings);
  }

  return toResult("ready", payloadPreview, blockers, warnings);
}
