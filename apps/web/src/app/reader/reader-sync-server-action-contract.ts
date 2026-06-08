// Reader Sync Server Action Contract Type Draft v1 (A281)
//
// Status: pure type draft / no-op / not implemented / preview-only

import type { ReaderSyncSubmitPlanResult } from "./reader-sync-submit-plan";

export var READER_SYNC_SERVER_ACTION_ERROR_CODES = [
  "AUTH_REQUIRED",
  "PERMISSION_DENIED",
  "INVALID_PAYLOAD",
  "CONFLICT_DETECTED",
  "IDEMPOTENCY_REQUIRED",
  "AUDIT_REQUIRED",
  "REPOSITORY_UNAVAILABLE",
  "SERVER_ACTION_NOT_IMPLEMENTED",
] as const;

export interface ReaderSyncServerActionPermissionGateDraft {
  requiresAuth: true;
  requiresBookAccess: true;
  requiresChapterAccess: true;
  requiresProgressValidation: true;
  requiresAudit: true;
}

export interface ReaderSyncServerActionAuditDraft {
  action: "reader.progress.sync.server-action";
  source: "localStorage-preview";
  targetModel: "ReadingProgress";
  previewOnly: true;
  userIdSource: "server-session-context-not-client";
}

export interface ReaderSyncServerActionRequestDraft {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  idempotencyKeyPreview: string;
  clientPreviewOnly: true;
  serverUserIdRequired: true;
  permissionGateRequirements: ReaderSyncServerActionPermissionGateDraft;
  auditDraft: ReaderSyncServerActionAuditDraft;
  previewRequestId: string;
}

export interface ReaderSyncServerActionResponseDraft {
  success: boolean;
  status: "blocked" | "not_implemented";
  previewOnly: true;
  implemented: false;
  syncedFields: string[];
  skippedFields: string[];
  auditId: null;
  serverProgressRatio: null;
  errorCode: string;
  message: string;
  warnings: string[];
  requestId: string | null;
  syncDecisionPreview?: unknown;
  syncServiceResultPreview?: unknown;
  [key: string]: unknown;
}

export interface ReaderSyncServerActionBlocker {
  code: string;
  message: string;
}

export interface ReaderSyncServerActionContractDraft {
  previewOnly: true;
  implemented: false;
  status: "blocked" | "draft_only";
  requestDraft: ReaderSyncServerActionRequestDraft | null;
  responseDraft: ReaderSyncServerActionResponseDraft;
  permissionGateDraft: ReaderSyncServerActionPermissionGateDraft;
  auditDraft: ReaderSyncServerActionAuditDraft;
  requiredContext: string[];
  blockers: ReaderSyncServerActionBlocker[];
}

export interface ReaderSyncServerActionReadinessChecklistItem {
  id: string;
  label: string;
  status: "not_implemented" | "blocked" | "satisfied";
  reason: string;
}

export interface ReaderSyncServerActionReadinessChecklist {
  previewOnly: true;
  implemented: false;
  overallStatus: "blocked" | "draft_only";
  items: ReaderSyncServerActionReadinessChecklistItem[];
  blockersSummary: string[];
  nextSafeSteps: string[];
}

const PERMISSION_GATE: ReaderSyncServerActionPermissionGateDraft = {
  requiresAuth: true,
  requiresBookAccess: true,
  requiresChapterAccess: true,
  requiresProgressValidation: true,
  requiresAudit: true,
};

const AUDIT_DRAFT: ReaderSyncServerActionAuditDraft = {
  action: "reader.progress.sync.server-action",
  source: "localStorage-preview",
  targetModel: "ReadingProgress",
  previewOnly: true,
  userIdSource: "server-session-context-not-client",
};

var REQUIRED_CONTEXT = [
  "userId must be injected from server auth/session context, client must not pass it",
  "server must validate bookId / chapterId / progressRatio legality",
  "server must verify userId has access to bookId and chapterId",
  "server must perform conflict detection (read-before-write, monotonic progressRatio)",
  "server must generate or verify idempotency key",
  "server must write audit log",
  "server action must pass through permission gate, validation, repository boundary",
];

const RESPONSE_NOT_IMPLEMENTED: ReaderSyncServerActionResponseDraft = {
  success: false,
  status: "not_implemented",
  previewOnly: true,
  implemented: false,
  syncedFields: [],
  skippedFields: ["bookId", "chapterId", "progressRatio"],
  auditId: null,
  serverProgressRatio: null,
  errorCode: "SERVER_ACTION_NOT_IMPLEMENTED",
  message: "Server action is type draft only (v1). Not implemented yet.",
  warnings: [],
  requestId: null,
};

function buildPreviewRequestId() {
  var rand = Math.random().toString(36).slice(2, 10);
  return "req-draft-" + rand;
}

function buildRequestDraft(
  submitPlan: ReaderSyncSubmitPlanResult,
): ReaderSyncServerActionRequestDraft | null {
  var idempotencyKeyPreview = submitPlan.idempotencyKeyPreview;
  if (idempotencyKeyPreview === null) {
    return null;
  }
  var parts = idempotencyKeyPreview.split(":");
  if (parts.length < 4) {
    return null;
  }
  var bookId = parts[1] || "unknown-book";
  var chapterId = parts[2] || "unknown-chapter";
  var progressRatioRaw = parts[3] || "0";
  var progressRatio = parseFloat(progressRatioRaw);
  return {
    bookId: bookId,
    chapterId: chapterId,
    progressRatio: isFinite(progressRatio) ? progressRatio : 0,
    idempotencyKeyPreview: idempotencyKeyPreview,
    clientPreviewOnly: true,
    serverUserIdRequired: true,
    permissionGateRequirements: { ...PERMISSION_GATE },
    auditDraft: { ...AUDIT_DRAFT },
    previewRequestId: buildPreviewRequestId(),
  };
}

function buildBlockedResponse(
  errorCode: string,
  message: string,
  warnings: string[],
  requestId: string | null,
): ReaderSyncServerActionResponseDraft {
  const base = Object.assign({}, RESPONSE_NOT_IMPLEMENTED);
  base.errorCode = errorCode;
  base.message = message;
  base.warnings = warnings;
  base.requestId = requestId;
  return base;
}

export function buildReaderSyncServerActionContractDraft(
  submitPlan: ReaderSyncSubmitPlanResult | null | undefined,
): ReaderSyncServerActionContractDraft {
  if (submitPlan === null || submitPlan === undefined) {
    return {
      previewOnly: true,
      implemented: false,
      status: "blocked",
      requestDraft: null,
      responseDraft: buildBlockedResponse(
        "SERVER_ACTION_NOT_IMPLEMENTED",
        "Server action not implemented, submit plan input is null/undefined.",
        ["submit plan input is null/undefined, contract draft safely degraded."],
        null,
      ),
      permissionGateDraft: { ...PERMISSION_GATE },
      auditDraft: { ...AUDIT_DRAFT },
      requiredContext: REQUIRED_CONTEXT.slice(),
      blockers: [
        { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action is type draft only, no real execution." },
        { code: "INVALID_INPUT", message: "submit plan input is null/undefined." },
      ],
    };
  }

  var warnings = [
    "Server action is type draft only (v1), no real sync.",
    "All request/response are preview-only.",
    "userId must be injected from server auth/session context, never trust client.",
  ];

  if (submitPlan.status === "empty") {
    return {
      previewOnly: true,
      implemented: false,
      status: "blocked",
      requestDraft: null,
      responseDraft: buildBlockedResponse(
        "INVALID_PAYLOAD",
        "submit plan status is empty, cannot generate request draft.",
        warnings.concat(["local summary is empty, no sync data available."]),
        null,
      ),
      permissionGateDraft: { ...PERMISSION_GATE },
      auditDraft: { ...AUDIT_DRAFT },
      requiredContext: REQUIRED_CONTEXT.slice(),
      blockers: [
        { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action not implemented." },
        { code: "PAYLOAD_EMPTY", message: "submit plan status is empty." },
      ],
    };
  }

  if (submitPlan.status === "invalid") {
    return {
      previewOnly: true,
      implemented: false,
      status: "blocked",
      requestDraft: null,
      responseDraft: buildBlockedResponse(
        "INVALID_PAYLOAD",
        "submit plan status is invalid.",
        warnings.concat(["local summary structure is invalid."]),
        null,
      ),
      permissionGateDraft: { ...PERMISSION_GATE },
      auditDraft: { ...AUDIT_DRAFT },
      requiredContext: REQUIRED_CONTEXT.slice(),
      blockers: [
        { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action not implemented." },
        { code: "PAYLOAD_INVALID", message: "submit plan status is invalid." },
      ],
    };
  }

  if (submitPlan.status === "partial" || submitPlan.status === "blocked") {
    return {
      previewOnly: true,
      implemented: false,
      status: "blocked",
      requestDraft: null,
      responseDraft: buildBlockedResponse(
        "INVALID_PAYLOAD",
        "submit plan status is " + submitPlan.status + ".",
        warnings.concat(["local summary fields incomplete (status=" + submitPlan.status + ")."]),
        null,
      ),
      permissionGateDraft: { ...PERMISSION_GATE },
      auditDraft: { ...AUDIT_DRAFT },
      requiredContext: REQUIRED_CONTEXT.slice(),
      blockers: [
        { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action not implemented." },
        { code: "PAYLOAD_INCOMPLETE", message: "submit plan status is " + submitPlan.status + "." },
      ],
    };
  }

  var requestDraft = buildRequestDraft(submitPlan);

  if (requestDraft === null) {
    warnings.push("idempotencyKeyPreview is empty or malformed.");
    return {
      previewOnly: true,
      implemented: false,
      status: "blocked",
      requestDraft: null,
      responseDraft: buildBlockedResponse(
        "INVALID_PAYLOAD",
        "submit plan ready but idempotencyKeyPreview unavailable.",
        warnings,
        null,
      ),
      permissionGateDraft: Object.assign({}, PERMISSION_GATE),
      auditDraft: Object.assign({}, AUDIT_DRAFT),
      requiredContext: REQUIRED_CONTEXT.slice(),
      blockers: [
        { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action not implemented." },
        { code: "IDEMPOTENCY_KEY_MISSING", message: "idempotencyKeyPreview is empty or malformed." },
      ],
    };
  }

  warnings.push("idempotencyKey \"" + requestDraft.idempotencyKeyPreview + "\" is client preview only, not real server idempotency.");

  return {
    previewOnly: true,
    implemented: false,
    status: "draft_only",
    requestDraft: requestDraft,
    responseDraft: Object.assign({}, RESPONSE_NOT_IMPLEMENTED, {
      message: "Server action is type draft only (v1). request draft generated but not executed.",
      warnings: warnings.concat(["request draft generated but cannot submit."]),
      requestId: requestDraft.previewRequestId,
    }),
    permissionGateDraft: { ...PERMISSION_GATE },
    auditDraft: { ...AUDIT_DRAFT },
    requiredContext: REQUIRED_CONTEXT.slice(),
    blockers: [
      { code: "SERVER_ACTION_NOT_IMPLEMENTED", message: "Server action not implemented." },
    ],
  };
}

// ---------------------------------------------------------------------------
// Server Action Readiness Checklist v1 (A284)
// ---------------------------------------------------------------------------

function isContractBlockedByPayload(contractDraft: ReaderSyncServerActionContractDraft) {
  const payloadBlockers = contractDraft.blockers.filter(function (b) {
    return b.code.indexOf("PAYLOAD_") === 0 || b.code === "INVALID_INPUT";
  });
  return payloadBlockers.length > 0;
}

var NEXT_SAFE_STEPS = [
  "review server action design document (docs/reader-sync-server-action-design.md)",
  "define auth/session source for userId injection (OAuth / JWT / session cookie)",
  "design audit sink schema and repository interface",
  "write no-op server action tests (no real DB, no real network)",
  "review ReadingProgressRepository interface alignment (packages/db/src/types.ts)",
  "validate contract draft fields against server-action-design document",
  "confirm idempotency strategy with server-side key generation (not client preview key)",
  "define rollback and retry policies before any real DB writes",
  "conduct security review of auth gate and permission checks",
];

export function buildReaderSyncServerActionReadinessChecklist(
  contractDraft: ReaderSyncServerActionContractDraft | null | undefined,
): ReaderSyncServerActionReadinessChecklist {
  if (contractDraft === null || contractDraft === undefined) {
    return {
      previewOnly: true,
      implemented: false,
      overallStatus: "blocked",
      items: [
        {
          id: "contract-input",
          label: "Contract draft input validity",
          status: "blocked",
          reason: "contractDraft input is null/undefined.",
        },
      ],
      blockersSummary: ["contractDraft input is null/undefined."],
      nextSafeSteps: NEXT_SAFE_STEPS.slice(),
    };
  }

  var hasPayloadBlockers = isContractBlockedByPayload(contractDraft);

  const items: ReaderSyncServerActionReadinessChecklistItem[] = [
    {
      id: "server-action-impl",
      label: "Server action implementation",
      status: "not_implemented",
      reason: "Server action is type draft only (v1), not implemented.",
    },
    {
      id: "auth-session-user-id",
      label: "Server auth/session userId injection",
      status: "not_implemented",
      reason: "userId must be injected from server auth/session context. Missing session/OAuth/JWT infrastructure.",
    },
    {
      id: "book-access-permission",
      label: "Book access permission check",
      status: "not_implemented",
      reason: "permissionGate requires verifying userId has access to bookId. Missing server-side resource permission logic.",
    },
    {
      id: "chapter-access-permission",
      label: "Chapter access permission check",
      status: "not_implemented",
      reason: "permissionGate requires chapterId belongs to bookId and userId has access.",
    },
    {
      id: "progress-payload-validation",
      label: "Progress payload validation",
      status: hasPayloadBlockers ? "blocked" : "not_implemented",
      reason: hasPayloadBlockers
        ? "Contract draft detected payload blockers. Fix local data format first."
        : "Payload validation rules defined in contract but not executed server-side.",
    },
    {
      id: "audit-sink",
      label: "Audit log sink",
      status: "not_implemented",
      reason: "auditDraft defines audit fields, but audit table schema, repository methods, and write logic are not implemented.",
    },
    {
      id: "idempotency-strategy",
      label: "Idempotency strategy",
      status: "not_implemented",
      reason: "Only client-side idempotencyKeyPreview exists (untrusted). Real idempotency keys need server-side generation.",
    },
    {
      id: "repository-write-auth",
      label: "Repository write authorization",
      status: "not_implemented",
      reason: "No DB write authorization boundary. Repository calls must go through server action layer.",
    },
    {
      id: "no-real-ai-tools-agent-loop",
      label: "No real AI / tools / Agent loop",
      status: "satisfied",
      reason: "All capabilities are preview-only / mock-only / disabled-by-default.",
    },
    {
      id: "no-client-trusted-user-id",
      label: "No client-trusted userId",
      status: "satisfied",
      reason: "requestDraft has no userId field. serverUserIdRequired=true. auditDraft.userIdSource=server-session-context-not-client.",
    },
  ];

  var blockersSummary = contractDraft.blockers.map(function (b) {
    return "[" + b.code + "] " + b.message;
  });

  if (blockersSummary.length === 0) {
    blockersSummary.push("[SERVER_ACTION_NOT_IMPLEMENTED] Server action not implemented.");
  }

  const overallStatus: "blocked" | "draft_only" =
    contractDraft.blockers.length > 0 ? "blocked" : "draft_only";

  return {
    previewOnly: true,
    implemented: false,
    overallStatus: overallStatus,
    items: items,
    blockersSummary: blockersSummary,
    nextSafeSteps: NEXT_SAFE_STEPS.slice(),
  };
}
