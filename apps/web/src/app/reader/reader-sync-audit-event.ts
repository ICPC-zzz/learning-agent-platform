export type ReaderSyncAuditEventPreviewStatus =
  | "permission-blocked"
  | "idempotency-blocked"
  | "duplicate-safe"
  | "changed-preview"
  | "test-only-preview"
  | "error-preview";

export type ReaderSyncAuditEventPreviewPermissionGateStatus = "preview" | "blocked";

export type ReaderSyncAuditEventPreviewSource =
  | "blocked-by-default"
  | "trusted-server-context"
  | "test-only-fake";

export interface ReaderSyncAuditEventPreviewInput {
  previewOnly?: true;
  implemented?: false;
  safeToExposeToClient?: true;
  eventType?: "reader-sync-audit-event-v1";
  status?: ReaderSyncAuditEventPreviewStatus;
  reasonCode?: string;
  bookId?: string | null;
  chapterId?: string | null;
  progressRatio?: number | null;
  source?: ReaderSyncAuditEventPreviewSource;
  idempotencyKeyPreview?: string | null;
  permissionGateStatus?: ReaderSyncAuditEventPreviewPermissionGateStatus;
  writesDatabase?: false;
  callsRepository?: false;
  [key: string]: unknown;
}

export interface ReaderSyncAuditEventPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  eventType: "reader-sync-audit-event-v1";
  status: ReaderSyncAuditEventPreviewStatus;
  reasonCode: string;
  bookId: string | null;
  chapterId: string | null;
  progressRatio: number | null;
  source: ReaderSyncAuditEventPreviewSource;
  idempotencyKeyPreview: string | null;
  permissionGateStatus: ReaderSyncAuditEventPreviewPermissionGateStatus;
  writesDatabase: false;
  callsRepository: false;
}

const EVENT_TYPE = "reader-sync-audit-event-v1" as const;

const ALLOWED_STATUSES: readonly ReaderSyncAuditEventPreviewStatus[] = [
  "permission-blocked",
  "idempotency-blocked",
  "duplicate-safe",
  "changed-preview",
  "test-only-preview",
  "error-preview",
] as const;

const ALLOWED_SOURCES: readonly ReaderSyncAuditEventPreviewSource[] = [
  "blocked-by-default",
  "trusted-server-context",
  "test-only-fake",
] as const;

const ALLOWED_PERMISSION_GATES: readonly ReaderSyncAuditEventPreviewPermissionGateStatus[] = [
  "preview",
  "blocked",
] as const;

const ALLOWED_KEYS = [
  "previewOnly",
  "implemented",
  "safeToExposeToClient",
  "eventType",
  "status",
  "reasonCode",
  "bookId",
  "chapterId",
  "progressRatio",
  "source",
  "idempotencyKeyPreview",
  "permissionGateStatus",
  "writesDatabase",
  "callsRepository",
] as const;

const FORBIDDEN_KEYS = [
  "userId",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "session",
  "rawSession",
  "rawDbRecord",
  "rawRequest",
  "request",
  "body",
  "rawBody",
  "headers",
  "rawHeaders",
  "header",
  "DATABASE_URL",
  "secret",
  "password",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "db",
  "prisma",
  "fetch",
  "process",
  "env",
  "window",
  "localStorage",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const BASE_WARNINGS = [
  "Reader sync audit event preview is preview-only and disabled-by-default.",
  "No DB write, repository call, real log sink, or raw request/body/header field is accepted here.",
  "Only safe event preview fields are allowed into the audit contract.",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function extractReasonCode(reasonCode: unknown, fallback: string): string {
  if (!isNonEmptyString(reasonCode)) {
    return fallback;
  }

  const normalized = reasonCode.trim();
  const code = normalized.split(":")[0]?.trim();
  return isNonEmptyString(code) ? code : fallback;
}

function buildSource(
  status: ReaderSyncAuditEventPreviewStatus,
  permissionGateStatus: ReaderSyncAuditEventPreviewPermissionGateStatus,
  source?: ReaderSyncAuditEventPreviewSource | null,
): ReaderSyncAuditEventPreviewSource {
  if (isNonEmptyString(source)) {
    return source as ReaderSyncAuditEventPreviewSource;
  }

  if (status === "test-only-preview") {
    return "test-only-fake";
  }

  if (status === "permission-blocked" || permissionGateStatus === "blocked") {
    return "blocked-by-default";
  }

  return "trusted-server-context";
}

function buildPreview(
  input: {
    status: ReaderSyncAuditEventPreviewStatus;
    reasonCode: string;
    bookId: string | null;
    chapterId: string | null;
    progressRatio: number | null;
    source?: ReaderSyncAuditEventPreviewSource | null;
    idempotencyKeyPreview: string | null;
    permissionGateStatus: ReaderSyncAuditEventPreviewPermissionGateStatus;
  },
): ReaderSyncAuditEventPreview {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    eventType: EVENT_TYPE,
    status: input.status,
    reasonCode: input.reasonCode,
    bookId: input.bookId,
    chapterId: input.chapterId,
    progressRatio: input.progressRatio,
    source: buildSource(input.status, input.permissionGateStatus, input.source),
    idempotencyKeyPreview: input.idempotencyKeyPreview,
    permissionGateStatus: input.permissionGateStatus,
    writesDatabase: false,
    callsRepository: false,
  };
}

function buildBlockedPreview(
  reasonCode?: string | null,
  input?: ReaderSyncAuditEventPreviewInput | null,
): ReaderSyncAuditEventPreview {
  const bookId = input?.bookId;
  const chapterId = input?.chapterId;
  const progressRatio = input?.progressRatio;
  const idempotencyKeyPreview = input?.idempotencyKeyPreview;

  return buildPreview({
    status: "error-preview",
    reasonCode: extractReasonCode(reasonCode, "INVALID_AUDIT_EVENT_PREVIEW"),
    bookId: isNonEmptyString(bookId) ? bookId.trim() : null,
    chapterId: isNonEmptyString(chapterId) ? chapterId.trim() : null,
    progressRatio: isFiniteRatio(progressRatio) ? progressRatio : null,
    source: input?.source,
    idempotencyKeyPreview: isNonEmptyString(idempotencyKeyPreview)
      ? idempotencyKeyPreview.trim()
      : null,
    permissionGateStatus:
      input?.permissionGateStatus === "preview" || input?.permissionGateStatus === "blocked"
        ? input.permissionGateStatus
        : "blocked",
  });
}

export function createBlockedReaderSyncAuditEventPreview(
  reasonCode?: string | null,
  input?: ReaderSyncAuditEventPreviewInput | null,
): ReaderSyncAuditEventPreview {
  return buildBlockedPreview(reasonCode, input);
}

export function validateReaderSyncAuditEventPreview(
  input: ReaderSyncAuditEventPreviewInput | null | undefined,
): ReaderSyncAuditEventPreview {
  if (!isRecord(input)) {
    return buildBlockedPreview("INVALID_AUDIT_EVENT_INPUT");
  }

  const blockers: string[] = [];
  const warnings = [...BASE_WARNINGS];

  if (hasUnsafePrototype(input)) {
    blockers.push("UNSAFE_PROTOTYPE_REJECTED");
    pushUnique(warnings, "Unsafe prototype was rejected before the audit event could be previewed.");
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      blockers.push(`FORBIDDEN_FIELD_REJECTED:${key}`);
      continue;
    }

    if (!(ALLOWED_KEYS as readonly string[]).includes(key)) {
      blockers.push(`UNKNOWN_FIELD_REJECTED:${key}`);
    }
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    blockers.push("INVALID_PREVIEW_ONLY_FLAG");
  }

  if (input.implemented !== undefined && input.implemented !== false) {
    blockers.push("INVALID_IMPLEMENTED_FLAG");
  }

  if (input.safeToExposeToClient !== undefined && input.safeToExposeToClient !== true) {
    blockers.push("INVALID_SAFE_TO_EXPOSE_FLAG");
  }

  if (input.eventType !== undefined && input.eventType !== EVENT_TYPE) {
    blockers.push("INVALID_EVENT_TYPE");
  }

  if (
    input.status === undefined ||
    !(ALLOWED_STATUSES as readonly string[]).includes(input.status)
  ) {
    blockers.push("INVALID_STATUS");
  }

  if (!isNonEmptyString(input.reasonCode)) {
    blockers.push("INVALID_REASON_CODE");
  }

  if (input.bookId !== undefined && input.bookId !== null && !isNonEmptyString(input.bookId)) {
    blockers.push("INVALID_BOOK_ID");
  }

  if (input.chapterId !== undefined && input.chapterId !== null && !isNonEmptyString(input.chapterId)) {
    blockers.push("INVALID_CHAPTER_ID");
  }

  if (
    input.progressRatio !== undefined &&
    input.progressRatio !== null &&
    !isFiniteRatio(input.progressRatio)
  ) {
    blockers.push("INVALID_PROGRESS_RATIO");
  }

  if (input.source !== undefined && !(ALLOWED_SOURCES as readonly string[]).includes(input.source)) {
    blockers.push("INVALID_SOURCE");
  }

  if (
    input.idempotencyKeyPreview !== undefined &&
    input.idempotencyKeyPreview !== null &&
    !isNonEmptyString(input.idempotencyKeyPreview)
  ) {
    blockers.push("INVALID_IDEMPOTENCY_KEY_PREVIEW");
  }

  if (
    input.permissionGateStatus !== undefined &&
    !(ALLOWED_PERMISSION_GATES as readonly string[]).includes(input.permissionGateStatus)
  ) {
    blockers.push("INVALID_PERMISSION_GATE_STATUS");
  }

  if (input.writesDatabase !== undefined && input.writesDatabase !== false) {
    blockers.push("INVALID_WRITES_DATABASE_FLAG");
  }

  if (input.callsRepository !== undefined && input.callsRepository !== false) {
    blockers.push("INVALID_CALLS_REPOSITORY_FLAG");
  }

  if (blockers.length > 0) {
    pushUnique(warnings, "Audit event preview was rejected before any safe event object could be built.");
    return buildBlockedPreview(blockers[0], input);
  }

  const status = input.status as ReaderSyncAuditEventPreviewStatus;
  const permissionGateStatus =
    input.permissionGateStatus === "preview" || input.permissionGateStatus === "blocked"
      ? input.permissionGateStatus
      : status === "permission-blocked"
        ? "blocked"
        : "preview";

  return buildPreview({
    status,
    reasonCode: extractReasonCode(input.reasonCode, "INVALID_AUDIT_EVENT_PREVIEW"),
    bookId: input.bookId === undefined ? null : input.bookId === null ? null : input.bookId.trim(),
    chapterId:
      input.chapterId === undefined ? null : input.chapterId === null ? null : input.chapterId.trim(),
    progressRatio:
      input.progressRatio === undefined || input.progressRatio === null
        ? null
        : input.progressRatio,
    source: input.source,
    idempotencyKeyPreview:
      input.idempotencyKeyPreview === undefined || input.idempotencyKeyPreview === null
        ? null
        : input.idempotencyKeyPreview.trim(),
    permissionGateStatus,
  });
}

export function createReaderSyncAuditEventPreview(
  input?: ReaderSyncAuditEventPreviewInput | null,
): ReaderSyncAuditEventPreview {
  return validateReaderSyncAuditEventPreview(input);
}
