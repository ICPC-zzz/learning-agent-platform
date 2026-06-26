import type {
  ReaderProgressSyncDecisionNormalizedPayload,
  ReaderProgressSyncDecisionResult,
  ReaderProgressSyncDecisionStatus,
  ReaderProgressSyncOperationPreview,
} from "./reader-progress-sync-decision";
import { createNoopReaderSyncRepositoryPort } from "./reader-sync-repository-port.ts";
import type { ReaderSyncRepositoryAuditPreview, ReaderSyncRepositoryCapabilities, ReaderSyncRepositoryIdempotencyPreview, ReaderSyncRepositoryPort, ReaderSyncRepositoryPortMode, ReaderSyncRepositoryReadResult, ReaderSyncRepositoryWritePreview } from "./reader-sync-repository-port.ts";
import type { ReaderSyncPersistentAdapterCapabilities, ReaderSyncPersistentAuditPreview, ReaderSyncPersistentIdempotencyPreview, ReaderSyncPersistentReadResult, ReaderSyncPersistentRepositoryAdapter, ReaderSyncPersistentWriteResult } from "./reader-sync-persistent-repository-adapter.ts";

export type ReaderProgressSyncServiceErrorCode =
  | "SYNC_BLOCKED"
  | "PROGRESS_CONFLICT"
  | "NO_CHANGE_PREVIEW"
  | "INVALID_SYNC_DECISION";

export interface ReaderProgressSyncServiceRequestPreview {
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
  idempotencyKeyPreview?: string;
}

export interface ReaderProgressSyncServiceOptions {
  previewOnly?: true;
  repositoryPort?: ReaderSyncRepositoryPort;
  persistentAdapter?: ReaderSyncPersistentRepositoryAdapter;
  persistentRepositoryAdapter?: ReaderSyncPersistentRepositoryAdapter;
}

interface ResolvedRepositoryPort {
  port: ReaderSyncRepositoryPort;
  warnings: string[];
  blockedReasons: string[];
}

interface ResolvedPersistentAdapter {
  adapter: ReaderSyncPersistentRepositoryAdapter | null;
  warnings: string[];
  blockedReasons: string[];
  source: "absent" | "preview" | "blocked";
}

export interface ReaderProgressSyncServicePersistentAdapterPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  mode: ReaderSyncPersistentAdapterCapabilities["mode"] | "blocked";
  source: "absent" | "decision-blocked" | "preview" | "blocked";
  status: ReaderSyncPersistentWriteResult["status"] | "absent";
  capabilities: ReaderSyncPersistentAdapterCapabilities | null;
  attempted: boolean;
  applied: boolean;
  executed: boolean;
  success: boolean;
  writesDatabase: false;
  callsRepository: boolean;
  readPreview: ReaderSyncPersistentReadResult | null;
  writePreview: ReaderSyncPersistentWriteResult | null;
  auditPreview: ReaderSyncPersistentAuditPreview | null;
  idempotencyPreview: ReaderSyncPersistentIdempotencyPreview | null;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

export interface ReaderProgressSyncServiceFakeExecutionPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: ReaderProgressSyncServicePersistentAdapterPreview["source"];
  attempted: boolean;
  applied: boolean;
  executed: boolean;
  success: boolean;
  status: "blocked" | "preview" | "conflict";
  writesDatabase: false;
  callsRepository: boolean;
  blockedReasons: string[];
  warnings: string[];
  message: string;
}

interface ReaderProgressSyncServicePersistentAdapterState {
  fakeWriteAttempted: boolean;
  fakeWriteApplied: boolean;
  persistentAdapterPreview: ReaderProgressSyncServicePersistentAdapterPreview;
  persistentAdapterWarnings: string[];
  persistentAdapterBlockedReasons: string[];
  fakeExecutionPreview: ReaderProgressSyncServiceFakeExecutionPreview;
}

export interface ReaderProgressSyncServiceRepositoryPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  mode: ReaderSyncRepositoryPortMode;
  capabilities: ReaderSyncRepositoryCapabilities;
  readPreview: ReaderSyncRepositoryReadResult;
  writePreview: ReaderSyncRepositoryWritePreview;
  auditPreview: ReaderSyncRepositoryAuditPreview;
  idempotencyPreview: ReaderSyncRepositoryIdempotencyPreview;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

export interface ReaderProgressSyncServiceInput {
  decision?: ReaderProgressSyncDecisionResult | null;
  requestPreview?: ReaderProgressSyncServiceRequestPreview | null;
  serverUserId?: string | null;
  options?: ReaderProgressSyncServiceOptions | null;
}

export interface ReaderProgressSyncServiceAuditPreview {
  previewOnly: true;
  auditId: null;
  action: "reader.progress.sync.service";
  targetModel: "ReadingProgress";
  source: "decision-preview" | "request-preview" | "missing";
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing";
}

export interface ReaderProgressSyncServiceIdempotencyPreview {
  previewOnly: true;
  persisted: false;
  previewKey: string | null;
  source: "decision-preview" | "request-preview" | "missing";
}

export interface ReaderProgressSyncServiceResult {
  previewOnly: true;
  implemented: false;
  executed: false;
  writesDatabase: false;
  callsRepository: false;
  callsRepositoryPortPreview: true;
  status: ReaderProgressSyncDecisionStatus;
  success: false;
  errorCode?: ReaderProgressSyncServiceErrorCode;
  message: string;
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing";
  operationPreview: ReaderProgressSyncOperationPreview;
  normalizedPayload?: ReaderProgressSyncDecisionNormalizedPayload;
  syncedFields: string[];
  skippedFields: string[];
  blockedReasons: string[];
  warnings: string[];
  safeToExposeToClient: true;
  auditPreview: ReaderProgressSyncServiceAuditPreview;
  idempotencyPreview: ReaderProgressSyncServiceIdempotencyPreview;
  nextSafeSteps: string[];
  repositoryPreview: ReaderProgressSyncServiceRepositoryPreview;
  repositoryCapabilities: ReaderSyncRepositoryCapabilities;
  repositoryReadPreview: ReaderSyncRepositoryReadResult;
  repositoryWritePreview: ReaderSyncRepositoryWritePreview;
  repositoryBlockedReasons: string[];
  repositoryWarnings: string[];
  fakeWriteAttempted: boolean;
  fakeWriteApplied: boolean;
  persistentAdapterPreview: ReaderProgressSyncServicePersistentAdapterPreview;
  persistentAdapterWarnings: string[];
  persistentAdapterBlockedReasons: string[];
  fakeExecutionPreview: ReaderProgressSyncServiceFakeExecutionPreview;
}

const ALLOWED_STATUSES: ReaderProgressSyncDecisionStatus[] = [
  "ready_preview",
  "blocked",
  "conflict",
  "noop",
  "invalid",
];

const SAFE_NEXT_STEPS = [
  "inject server auth/session user context before any future write path",
  "connect an audited server action after explicit authorization",
  "call repository only after explicit permission checks",
  "persist audit and idempotency records before any real DB write",
  "add integration tests for preview-to-write transitions",
] as const;

const BASE_WARNINGS = [
  "This service result is preview-only. implemented=false, executed=false, writesDatabase=false, and callsRepository=false.",
  "No DB write, repository call, network request, fetch, or Agent loop is performed.",
  "userId must come from server auth/session context, never from client input.",
] as const;

const NOOP_SKIPPED_FIELDS = ["bookId", "chapterId", "progressRatio"] as const;
const SYNTHETIC_PERSISTENT_SERVER_USER_ID =
  "reader-progress-sync-service-preview-server-user";
const PERSISTENT_ADAPTER_BASE_WARNINGS = [
  "Persistent adapter integration is preview-only and never writes to a real DB.",
  "Fake persistent adapter calls are only allowed from tests or explicit preview injection.",
  "No real auth/session credential material is accepted or exposed here.",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDecisionStatus(value: unknown): value is ReaderProgressSyncDecisionStatus {
  return typeof value === "string" && ALLOWED_STATUSES.includes(value as ReaderProgressSyncDecisionStatus);
}

function isOperationPreview(value: unknown): value is ReaderProgressSyncOperationPreview {
  return value === "upsert-reading-progress-preview" || value === "none";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function buildRepositoryPortFallbackDetails(reason: string): {
  warnings: string[];
  blockedReasons: string[];
} {
  return {
    warnings: [
      `Repository port injection ${reason}. Falling back to the safe noop repository preview.`,
      "Repository preview remains preview-only and does not persist data.",
    ],
    blockedReasons: [],
  };
}

function isRepositoryPort(value: unknown): value is ReaderSyncRepositoryPort {
  return (
    isRecord(value) &&
    isRecord(value.capabilities) &&
    value.capabilities.previewOnly === true &&
    value.capabilities.safeToExposeToClient === true &&
    typeof value.readProgress === "function" &&
    typeof value.previewWriteProgress === "function" &&
    typeof value.previewAudit === "function" &&
    typeof value.previewIdempotency === "function"
  );
}

function resolveRepositoryPort(
  options: ReaderProgressSyncServiceOptions | null | undefined,
): ResolvedRepositoryPort {
  const fallbackPort = createNoopReaderSyncRepositoryPort();

  if (!isRecord(options)) {
    return {
      port: fallbackPort,
      ...buildRepositoryPortFallbackDetails("was missing or not a plain object"),
    };
  }

  try {
    if (options.repositoryPort === undefined) {
      return {
        port: fallbackPort,
        ...buildRepositoryPortFallbackDetails("was undefined"),
      };
    }

    if (options.repositoryPort === null) {
      return {
        port: fallbackPort,
        ...buildRepositoryPortFallbackDetails("was null"),
      };
    }

    if (isRepositoryPort(options.repositoryPort)) {
      return {
        port: options.repositoryPort,
        warnings: [],
        blockedReasons: [],
      };
    }
  } catch {
    return {
      port: fallbackPort,
      ...buildRepositoryPortFallbackDetails("threw while being validated"),
    };
  }

  return {
    port: fallbackPort,
    ...buildRepositoryPortFallbackDetails(
      "did not satisfy the preview repository contract",
    ),
  };
}

function normalizeRequestPreview(
  requestPreview: unknown,
): ReaderProgressSyncDecisionNormalizedPayload | undefined {
  if (!isRecord(requestPreview)) {
    return undefined;
  }

  if (
    !isNonEmptyString(requestPreview.bookId) ||
    !isNonEmptyString(requestPreview.chapterId) ||
    !isFiniteRatio(requestPreview.progressRatio)
  ) {
    return undefined;
  }

  const normalized: ReaderProgressSyncDecisionNormalizedPayload = {
    bookId: requestPreview.bookId.trim(),
    chapterId: requestPreview.chapterId.trim(),
    progressRatio: requestPreview.progressRatio,
  };

  if (typeof requestPreview.idempotencyKeyPreview === "string") {
    normalized.idempotencyKeyPreview = requestPreview.idempotencyKeyPreview;
  }

  return normalized;
}

function normalizeDecisionPayload(
  decision: ReaderProgressSyncDecisionResult | null | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
): ReaderProgressSyncDecisionNormalizedPayload | undefined {
  if (decision?.normalizedPayload !== undefined) {
    return decision.normalizedPayload;
  }

  return normalizeRequestPreview(requestPreview);
}

function buildRepositoryPreviewInput(
  normalizedPayload: ReaderProgressSyncDecisionNormalizedPayload | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
): Record<string, unknown> {
  if (normalizedPayload !== undefined) {
    return {
      bookId: normalizedPayload.bookId,
      chapterId: normalizedPayload.chapterId,
      progressRatio: normalizedPayload.progressRatio,
      idempotencyKeyPreview: normalizedPayload.idempotencyKeyPreview,
    };
  }

  const requestPreviewNormalized = normalizeRequestPreview(requestPreview);
  if (requestPreviewNormalized !== undefined) {
    return {
      bookId: requestPreviewNormalized.bookId,
      chapterId: requestPreviewNormalized.chapterId,
      progressRatio: requestPreviewNormalized.progressRatio,
      idempotencyKeyPreview: requestPreviewNormalized.idempotencyKeyPreview,
    };
  }

  return {};
}

function formatRepositoryBlockers(
  label: "read" | "write" | "audit" | "idempotency",
  blockers: Array<{ code: string; message: string }>,
): string[] {
  const reasons: string[] = [];
  for (const blocker of blockers) {
    if (isNonEmptyString(blocker.code) && isNonEmptyString(blocker.message)) {
      pushUnique(reasons, `${label}:${blocker.code}: ${blocker.message}`);
    }
  }
  return reasons;
}

function buildRepositoryPreview(
  repositoryPort: ReaderSyncRepositoryPort,
  normalizedPayload: ReaderProgressSyncDecisionNormalizedPayload | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
  resolutionWarnings: string[] = [],
  resolutionBlockedReasons: string[] = [],
): ReaderProgressSyncServiceRepositoryPreview {
  try {
    return buildRepositoryPreviewFromPort(
      repositoryPort,
      normalizedPayload,
      requestPreview,
      resolutionWarnings,
      resolutionBlockedReasons,
    );
  } catch {
    const fallbackPort = createNoopReaderSyncRepositoryPort();
    const fallbackDetails = buildRepositoryPortFallbackDetails(
      "threw while building repository previews",
    );

    return buildRepositoryPreviewFromPort(
      fallbackPort,
      normalizedPayload,
      requestPreview,
      [...resolutionWarnings, ...fallbackDetails.warnings],
      [...resolutionBlockedReasons, ...fallbackDetails.blockedReasons],
    );
  }
}

function buildRepositoryPreviewFromPort(
  repositoryPort: ReaderSyncRepositoryPort,
  normalizedPayload: ReaderProgressSyncDecisionNormalizedPayload | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
  resolutionWarnings: string[] = [],
  resolutionBlockedReasons: string[] = [],
): ReaderProgressSyncServiceRepositoryPreview {
  const repositoryInput = buildRepositoryPreviewInput(normalizedPayload, requestPreview);
  const readPreview = repositoryPort.readProgress(repositoryInput);
  const writePreview = repositoryPort.previewWriteProgress(repositoryInput);
  const auditPreview = repositoryPort.previewAudit(repositoryInput);
  const idempotencyPreview = repositoryPort.previewIdempotency(repositoryInput);

  const blockedReasons: string[] = [...resolutionBlockedReasons];
  for (const reason of formatRepositoryBlockers("read", readPreview.blockers)) {
    pushUnique(blockedReasons, reason);
  }
  for (const reason of formatRepositoryBlockers("write", writePreview.blockers)) {
    pushUnique(blockedReasons, reason);
  }
  for (const reason of formatRepositoryBlockers("audit", auditPreview.blockers)) {
    pushUnique(blockedReasons, reason);
  }
  for (const reason of formatRepositoryBlockers("idempotency", idempotencyPreview.blockers)) {
    pushUnique(blockedReasons, reason);
  }

  const warnings = [
    ...readPreview.warnings,
    ...writePreview.warnings,
    ...auditPreview.warnings,
    ...idempotencyPreview.warnings,
    ...resolutionWarnings,
  ];

  pushUnique(
    warnings,
    `Repository port preview mode ${repositoryPort.capabilities.mode} stays preview-only and does not persist data.`,
  );

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    mode: repositoryPort.capabilities.mode,
    capabilities: repositoryPort.capabilities,
    readPreview,
    writePreview,
    auditPreview,
    idempotencyPreview,
    blockedReasons,
    warnings,
    summary:
      repositoryPort.capabilities.mode === "mock"
        ? "Mock repository port preview ready for injection tests."
        : "No-op repository port preview ready for injection tests.",
  };
}

function buildRepositoryPreviewFields(
  repositoryPreview: ReaderProgressSyncServiceRepositoryPreview,
): Pick<
  ReaderProgressSyncServiceResult,
  | "repositoryPreview"
  | "repositoryCapabilities"
  | "repositoryReadPreview"
  | "repositoryWritePreview"
  | "repositoryBlockedReasons"
  | "repositoryWarnings"
> {
  return {
    repositoryPreview,
    repositoryCapabilities: repositoryPreview.capabilities,
    repositoryReadPreview: repositoryPreview.readPreview,
    repositoryWritePreview: repositoryPreview.writePreview,
    repositoryBlockedReasons: repositoryPreview.blockedReasons,
    repositoryWarnings: repositoryPreview.warnings,
  };
}

function buildSkippedFields(normalizedPayload?: ReaderProgressSyncDecisionNormalizedPayload): string[] {
  if (normalizedPayload === undefined) {
    return [];
  }

  return [...NOOP_SKIPPED_FIELDS];
}

function buildWarnings(
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing",
  decisionWarnings: string[],
): string[] {
  const warnings = [...BASE_WARNINGS, ...decisionWarnings];

  if (decisionStatus === "ready_preview") {
    pushUnique(
      warnings,
      "Decision is ready_preview only; no write is executed in this service result.",
    );
  } else if (decisionStatus === "blocked") {
    pushUnique(
      warnings,
      "Decision is blocked in preview-only mode; downstream write path remains disabled.",
    );
  } else if (decisionStatus === "conflict") {
    pushUnique(
      warnings,
      "Decision is a monotonic progress conflict preview; no write is executed.",
    );
  } else if (decisionStatus === "noop") {
    pushUnique(
      warnings,
      "Decision resolves to no change preview; nothing is persisted.",
    );
  } else {
    pushUnique(
      warnings,
      "Decision input is missing or malformed; service result is safely degraded to invalid preview.",
    );
  }

  return warnings;
}

function buildErrorCode(status: ReaderProgressSyncDecisionStatus): ReaderProgressSyncServiceErrorCode | undefined {
  if (status === "blocked") {
    return "SYNC_BLOCKED";
  }
  if (status === "conflict") {
    return "PROGRESS_CONFLICT";
  }
  if (status === "noop") {
    return "NO_CHANGE_PREVIEW";
  }
  if (status === "invalid") {
    return "INVALID_SYNC_DECISION";
  }
  return undefined;
}

function buildBlockedReasons(
  decision: ReaderProgressSyncDecisionResult | null | undefined,
  status: ReaderProgressSyncDecisionStatus | "missing",
): string[] {
  const reasons: string[] = [];

  if (decision !== undefined && decision !== null && Array.isArray(decision.blockers)) {
    for (const blocker of decision.blockers) {
      if (isRecord(blocker) && isNonEmptyString(blocker.code) && isNonEmptyString(blocker.message)) {
        pushUnique(reasons, `${blocker.code}: ${blocker.message}`);
      }
    }
  }

  if (status === "conflict" && decision?.conflict !== undefined) {
    pushUnique(
      reasons,
      `PROGRESS_CONFLICT: incoming=${decision.conflict.incomingProgressRatio} existing=${decision.conflict.existingProgressRatio} policy=${decision.conflict.policy}`,
    );
  }

  if (status === "noop") {
    pushUnique(reasons, "NO_CHANGE_PREVIEW: incoming progress matches existing server progress.");
  }

  if (status === "invalid" || status === "missing") {
    if (reasons.length === 0) {
      pushUnique(reasons, "INVALID_SYNC_DECISION: decision input is missing or malformed.");
    }
  }

  return reasons;
}

function buildAuditPreview(
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing",
): ReaderProgressSyncServiceAuditPreview {
  return {
    previewOnly: true,
    auditId: null,
    action: "reader.progress.sync.service",
    targetModel: "ReadingProgress",
    source: decisionStatus === "missing" ? "missing" : "decision-preview",
    decisionStatus,
  };
}

function buildIdempotencyPreview(
  decision: ReaderProgressSyncDecisionResult | null | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
): ReaderProgressSyncServiceIdempotencyPreview {
  if (requestPreview?.idempotencyKeyPreview !== undefined) {
    return {
      previewOnly: true,
      persisted: false,
      previewKey: requestPreview.idempotencyKeyPreview,
      source: "request-preview",
    };
  }

  if (typeof decision?.normalizedPayload?.idempotencyKeyPreview === "string") {
    return {
      previewOnly: true,
      persisted: false,
      previewKey: decision.normalizedPayload.idempotencyKeyPreview,
      source: "decision-preview",
    };
  }

  return {
    previewOnly: true,
    persisted: false,
    previewKey: null,
    source: "missing",
  };
}

function buildMessage(status: ReaderProgressSyncDecisionStatus): string {
  if (status === "ready_preview") {
    return "Reader progress sync is ready in preview-only mode. No DB write, repository call, or network request is executed.";
  }

  if (status === "blocked") {
    return "Reader progress sync is blocked in preview-only mode. No DB write is executed.";
  }

  if (status === "conflict") {
    return "Reader progress sync has a monotonic conflict in preview-only mode. No write is executed.";
  }

  if (status === "noop") {
    return "Reader progress sync resolves to no change in preview-only mode. Nothing is persisted.";
  }

  return "Reader progress sync decision is invalid or missing. Preview-only degradation prevents any write.";
}

function buildInvalidResult(
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing",
  decision: ReaderProgressSyncDecisionResult | null | undefined,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
  decisionWarnings: string[],
  repositoryPreview: ReaderProgressSyncServiceRepositoryPreview,
  persistentAdapterState: ReaderProgressSyncServicePersistentAdapterState,
): ReaderProgressSyncServiceResult {
  const normalizedPayload = normalizeDecisionPayload(decision, requestPreview);
  const normalizedDecisionWarnings =
    decision != null && Array.isArray(decision.warnings) ? [...decision.warnings] : [];
  const warnings = buildWarnings(decisionStatus, normalizedDecisionWarnings);
  const operationPreview: ReaderProgressSyncOperationPreview =
    decision != null && isOperationPreview(decision.operationPreview)
      ? decision.operationPreview
      : "none";
  const blockedReasons = buildBlockedReasons(decision, decisionStatus);
  if (blockedReasons.length === 0) {
    pushUnique(blockedReasons, "INVALID_SYNC_DECISION: decision input is missing or malformed.");
  }
  pushUnique(
    warnings,
    "Decision input failed service-shape validation; result is degraded to invalid preview.",
  );

  return {
    previewOnly: true,
    implemented: false,
    executed: false,
    writesDatabase: false,
    callsRepository: false,
    callsRepositoryPortPreview: true,
    status: "invalid",
    success: false,
    errorCode: "INVALID_SYNC_DECISION",
    message: buildMessage("invalid"),
    decisionStatus,
    operationPreview,
    normalizedPayload,
    syncedFields: [],
    skippedFields: buildSkippedFields(normalizedPayload),
    blockedReasons,
    warnings,
    safeToExposeToClient: true,
    auditPreview: buildAuditPreview(decisionStatus),
    idempotencyPreview: buildIdempotencyPreview(decision, requestPreview),
    nextSafeSteps: [...SAFE_NEXT_STEPS],
    ...buildRepositoryPreviewFields(repositoryPreview),
    ...persistentAdapterState,
  };
}

function buildReadyResult(
  decision: ReaderProgressSyncDecisionResult,
  requestPreview: ReaderProgressSyncServiceRequestPreview | null | undefined,
  repositoryPreview: ReaderProgressSyncServiceRepositoryPreview,
  persistentAdapterState: ReaderProgressSyncServicePersistentAdapterState,
): ReaderProgressSyncServiceResult {
  const normalizedPayload = normalizeDecisionPayload(decision, requestPreview);
  const decisionWarnings = Array.isArray(decision.warnings) ? [...decision.warnings] : [];
  const warnings = buildWarnings("ready_preview", decisionWarnings);

  return {
    previewOnly: true,
    implemented: false,
    executed: false,
    writesDatabase: false,
    callsRepository: false,
    callsRepositoryPortPreview: true,
    status: "ready_preview",
    success: false,
    message: buildMessage("ready_preview"),
    decisionStatus: decision.status,
    operationPreview: isOperationPreview(decision.operationPreview)
      ? decision.operationPreview
      : "upsert-reading-progress-preview",
    normalizedPayload,
    syncedFields: [],
    skippedFields: buildSkippedFields(normalizedPayload),
    blockedReasons: buildBlockedReasons(decision, decision.status),
    warnings,
    safeToExposeToClient: true,
    auditPreview: buildAuditPreview(decision.status),
    idempotencyPreview: buildIdempotencyPreview(decision, requestPreview),
    nextSafeSteps: [...SAFE_NEXT_STEPS],
    ...buildRepositoryPreviewFields(repositoryPreview),
    ...persistentAdapterState,
  };
}

function normalizeDecisionInput(
  input: ReaderProgressSyncServiceInput | null | undefined,
): {
  decision: ReaderProgressSyncDecisionResult | null;
  requestPreview: ReaderProgressSyncServiceRequestPreview | null;
  decisionStatus: ReaderProgressSyncDecisionStatus | "missing";
  validShape: boolean;
  decisionWarnings: string[];
} {
  if (!isRecord(input)) {
    return {
      decision: null,
      requestPreview: null,
      decisionStatus: "missing",
      validShape: false,
      decisionWarnings: [],
    };
  }

  if (input.options !== undefined && input.options !== null) {
    if (!isRecord(input.options) || input.options.previewOnly !== true) {
      return {
        decision: null,
        requestPreview: isRecord(input.requestPreview)
          ? (input.requestPreview as ReaderProgressSyncServiceRequestPreview)
          : null,
        decisionStatus: "missing",
        validShape: false,
        decisionWarnings: ["options.previewOnly must be true when provided."],
      };
    }
  }

  const requestPreview = isRecord(input.requestPreview)
    ? (input.requestPreview as ReaderProgressSyncServiceRequestPreview)
    : null;

  const decision = isRecord(input.decision)
    ? (input.decision as unknown as ReaderProgressSyncDecisionResult)
    : null;
  const decisionStatus =
    decision != null && isDecisionStatus(decision.status)
      ? decision.status
      : decision == null
        ? "missing"
        : "invalid";

  const validShape =
    decision != null &&
    isRecord(decision) &&
    decision.previewOnly === true &&
    decision.implemented === false &&
    decision.executesWrite === false &&
    isDecisionStatus(decision.status) &&
    typeof decision.hasServerUserContext === "boolean" &&
    isRecord(decision.normalizedPayload) &&
    isNonEmptyString(decision.normalizedPayload.bookId) &&
    isNonEmptyString(decision.normalizedPayload.chapterId) &&
    isFiniteRatio(decision.normalizedPayload.progressRatio) &&
    Array.isArray(decision.blockers) &&
    Array.isArray(decision.warnings) &&
    Array.isArray(decision.nextSafeSteps);

  return {
    decision,
    requestPreview,
    decisionStatus,
    validShape,
    decisionWarnings:
      isRecord(decision) && Array.isArray(decision.warnings)
        ? [...(decision.warnings as string[])]
        : [],
  };
}

function isPersistentAdapter(value: unknown): value is ReaderSyncPersistentRepositoryAdapter {
  return (
    isRecord(value) &&
    isRecord(value.capabilities) &&
    value.capabilities.previewOnly === true &&
    value.capabilities.safeToExposeToClient === true &&
    typeof value.readProgress === "function" &&
    typeof value.previewWriteProgress === "function" &&
    typeof value.previewAudit === "function" &&
    typeof value.previewIdempotency === "function"
  );
}

function resolvePersistentAdapter(
  options: ReaderProgressSyncServiceOptions | null | undefined,
): ResolvedPersistentAdapter {
  const candidate =
    options?.persistentAdapter ?? options?.persistentRepositoryAdapter ?? null;

  if (candidate === null || candidate === undefined) {
    return {
      adapter: null,
      warnings: [...PERSISTENT_ADAPTER_BASE_WARNINGS],
      blockedReasons: [],
      source: "absent",
    };
  }

  try {
    if (isPersistentAdapter(candidate)) {
      return {
        adapter: candidate,
        warnings: [...PERSISTENT_ADAPTER_BASE_WARNINGS],
        blockedReasons: [],
        source: "preview",
      };
    }
  } catch {
    return {
      adapter: null,
      warnings: [
        ...PERSISTENT_ADAPTER_BASE_WARNINGS,
        "Persistent adapter validation threw and the service stayed preview-only.",
      ],
      blockedReasons: [
        "PERSISTENT_ADAPTER_VALIDATION_THROWN: Persistent adapter validation threw before any fake execution.",
      ],
      source: "blocked",
    };
  }

  return {
    adapter: null,
    warnings: [
      ...PERSISTENT_ADAPTER_BASE_WARNINGS,
      "Persistent adapter input did not satisfy the preview repository contract.",
    ],
    blockedReasons: [
      "PERSISTENT_ADAPTER_INVALID: Persistent adapter input did not satisfy the preview repository contract.",
    ],
    source: "blocked",
  };
}

function formatPersistentBlockers(
  label: "read" | "write" | "audit" | "idempotency",
  blockers: Array<{ code: string; message: string }> | null | undefined,
): string[] {
  const reasons: string[] = [];

  if (!Array.isArray(blockers)) {
    return reasons;
  }

  for (const blocker of blockers) {
    if (isRecord(blocker) && isNonEmptyString(blocker.code) && isNonEmptyString(blocker.message)) {
      pushUnique(reasons, `${label}:${blocker.code}: ${blocker.message}`);
    }
  }

  return reasons;
}

function callSafely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function buildPersistentAdapterPreviewBlocked(
  resolved: ResolvedPersistentAdapter,
  reason: string,
  attempted: boolean = false,
): ReaderProgressSyncServicePersistentAdapterState {
  const blockedReasons = [
    ...resolved.blockedReasons,
    `PERSISTENT_ADAPTER_BLOCKED: ${reason}`,
  ];
  const warnings = [...resolved.warnings];
  pushUnique(
    warnings,
    attempted
      ? "Persistent adapter execution was attempted but did not complete."
      : "Persistent adapter remained blocked, so no fake write was attempted.",
  );

  const persistentAdapterPreview: ReaderProgressSyncServicePersistentAdapterPreview = {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    mode: resolved.adapter?.capabilities.mode ?? "blocked",
    source: resolved.source === "absent" ? "absent" : "blocked",
    status: "blocked",
    capabilities: resolved.adapter?.capabilities ?? null,
    attempted: attempted,
    applied: false,
    executed: false,
    success: false,
    writesDatabase: false,
    callsRepository: false,
    readPreview: null,
    writePreview: null,
    auditPreview: null,
    idempotencyPreview: null,
    blockedReasons,
    warnings,
    summary:
      resolved.source === "absent"
        ? "No persistent adapter was injected, so the service stayed preview-only."
        : attempted
          ? "Persistent adapter execution was attempted, but the service stayed blocked and did not complete fake persistence."
          : "Persistent adapter injection was present, but the service stayed blocked and did not execute fake persistence.",
  };

  return {
    fakeWriteAttempted: attempted,
    fakeWriteApplied: false,
    persistentAdapterPreview,
    persistentAdapterWarnings: warnings,
    persistentAdapterBlockedReasons: blockedReasons,
    fakeExecutionPreview: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: persistentAdapterPreview.source,
      attempted: attempted,
      applied: false,
      executed: false,
      success: false,
      status: "blocked",
      writesDatabase: false,
      callsRepository: false,
      blockedReasons,
      warnings,
      message: persistentAdapterPreview.summary,
    },
  };
}

function buildPersistentAdapterPreviewFromExecution(
  adapter: ReaderSyncPersistentRepositoryAdapter,
  writePreview: ReaderSyncPersistentWriteResult,
  warnings: string[],
  blockedReasons: string[],
): ReaderProgressSyncServicePersistentAdapterState {
  const readPreview = writePreview.readPreview;
  const auditPreview = writePreview.auditPreview;
  const idempotencyPreview = writePreview.idempotencyPreview;
  const executionWarnings = [...warnings, ...writePreview.warnings];
  const executionBlockedReasons = [
    ...blockedReasons,
    ...formatPersistentBlockers("read", readPreview.blockers),
    ...writePreview.blockedReasons,
    ...formatPersistentBlockers("audit", auditPreview.blockers),
    ...formatPersistentBlockers("idempotency", idempotencyPreview.blockers),
  ];

  pushUnique(
    executionWarnings,
    writePreview.status === "preview"
      ? "Injected fake persistent adapter executed in preview-only mode and did not touch a real DB."
      : "Injected fake persistent adapter stayed blocked or conflicted and did not reach a real DB write.",
  );

  const fakeWriteAttempted = true;
  const fakeWriteApplied = writePreview.status === "preview" && writePreview.executed === true && writePreview.success === true;

  const persistentAdapterPreview: ReaderProgressSyncServicePersistentAdapterPreview = {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    mode: adapter.capabilities.mode,
    source: writePreview.status === "preview" ? "preview" : "blocked",
    status: writePreview.status,
    capabilities: adapter.capabilities,
    attempted: true,
    applied: fakeWriteApplied,
    executed: writePreview.executed === true,
    success: writePreview.success === true,
    writesDatabase: false,
    callsRepository: writePreview.callsRepository === true,
    readPreview,
    writePreview,
    auditPreview,
    idempotencyPreview,
    blockedReasons: executionBlockedReasons,
    warnings: executionWarnings,
    summary:
      writePreview.status === "preview"
        ? "Fake persistent adapter executed successfully in preview-only mode without a real DB write."
        : "Fake persistent adapter was injected, but its preview-only execution stayed blocked or conflicted.",
  };

  return {
    fakeWriteAttempted,
    fakeWriteApplied,
    persistentAdapterPreview,
    persistentAdapterWarnings: executionWarnings,
    persistentAdapterBlockedReasons: executionBlockedReasons,
    fakeExecutionPreview: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: persistentAdapterPreview.source,
      attempted: true,
      applied: fakeWriteApplied,
      executed: writePreview.executed === true,
      success: writePreview.success === true,
      status: writePreview.status,
      writesDatabase: false,
      callsRepository: writePreview.callsRepository === true,
      blockedReasons: executionBlockedReasons,
      warnings: executionWarnings,
      message: writePreview.message,
    },
  };
}

export function buildReaderProgressSyncServiceResult(
  input: ReaderProgressSyncServiceInput | null | undefined,
): ReaderProgressSyncServiceResult {
  const repositoryPort = resolveRepositoryPort(input?.options);
  const normalized = normalizeDecisionInput(input);
  const resolvedPersistentAdapter = resolvePersistentAdapter(input?.options);
  let persistentAdapterState: ReaderProgressSyncServicePersistentAdapterState;
  const persistentAdapter = resolvedPersistentAdapter.adapter;
  if (persistentAdapter === null) {
    persistentAdapterState = buildPersistentAdapterPreviewBlocked(
      resolvedPersistentAdapter,
      "persistent adapter is absent or invalid",
    );
  } else if (
    normalized.decision === null ||
    normalized.decision.status !== "ready_preview" ||
    normalized.decision.normalizedPayload === undefined
  ) {
    persistentAdapterState = buildPersistentAdapterPreviewBlocked(
      resolvedPersistentAdapter,
      "service decision is not ready_preview, so fake execution is skipped",
    );
  } else {
    const previewInput = {
      serverUserId:
        typeof input?.serverUserId === "string" && input.serverUserId.trim().length > 0
          ? input.serverUserId.trim()
          : SYNTHETIC_PERSISTENT_SERVER_USER_ID,
      bookId: normalized.decision.normalizedPayload.bookId,
      chapterId: normalized.decision.normalizedPayload.chapterId,
      progressRatio: normalized.decision.normalizedPayload.progressRatio,
      idempotencyKeyPreview:
        normalized.decision.normalizedPayload.idempotencyKeyPreview ??
        normalized.requestPreview?.idempotencyKeyPreview ??
        null,
    };

    const writePreview = callSafely(
      function () {
        return persistentAdapter.previewWriteProgress(previewInput);
      },
      null,
    );

    if (writePreview === null) {
      persistentAdapterState = buildPersistentAdapterPreviewBlocked(
        resolvedPersistentAdapter,
        "fake persistent adapter previewWriteProgress threw before it could return a preview",
        true,
      );
    } else {
      persistentAdapterState = buildPersistentAdapterPreviewFromExecution(
        persistentAdapter,
        writePreview,
        resolvedPersistentAdapter.warnings,
        resolvedPersistentAdapter.blockedReasons,
      );
    }
  }
  const repositoryPreview = buildRepositoryPreview(
    repositoryPort.port,
    normalized.decision?.normalizedPayload,
    normalized.requestPreview,
    repositoryPort.warnings,
    repositoryPort.blockedReasons,
  );

  if (!normalized.validShape || normalized.decision === null) {
    return buildInvalidResult(
      normalized.decisionStatus,
      normalized.decision,
      normalized.requestPreview,
      normalized.decisionWarnings,
      repositoryPreview,
      persistentAdapterState,
    );
  }

  if (normalized.decision.status === "ready_preview") {
    return buildReadyResult(
      normalized.decision,
      normalized.requestPreview,
      repositoryPreview,
      persistentAdapterState,
    );
  }

  const status = normalized.decision.status;
  const normalizedPayload = normalizeDecisionPayload(normalized.decision, normalized.requestPreview);
  const warnings = buildWarnings(status, normalized.decisionWarnings);

  return {
    previewOnly: true,
    implemented: false,
    executed: false,
    writesDatabase: false,
    callsRepository: false,
    status,
    success: false,
    errorCode: buildErrorCode(status),
    message: buildMessage(status),
    decisionStatus: status,
    operationPreview: isOperationPreview(normalized.decision.operationPreview)
      ? normalized.decision.operationPreview
      : "none",
    normalizedPayload,
    syncedFields: [],
    skippedFields: buildSkippedFields(normalizedPayload),
    blockedReasons: buildBlockedReasons(normalized.decision, status),
    warnings,
    safeToExposeToClient: true,
    auditPreview: buildAuditPreview(status),
    idempotencyPreview: buildIdempotencyPreview(normalized.decision, normalized.requestPreview),
    nextSafeSteps: [...SAFE_NEXT_STEPS],
    callsRepositoryPortPreview: true,
    ...buildRepositoryPreviewFields(repositoryPreview),
    ...persistentAdapterState,
  };
}
