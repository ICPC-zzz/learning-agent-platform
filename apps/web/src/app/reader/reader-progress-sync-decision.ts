export type ReaderProgressSyncDecisionStatus =
  | "ready_preview"
  | "blocked"
  | "conflict"
  | "noop"
  | "invalid";

export type ReaderProgressSyncOperationPreview =
  | "upsert-reading-progress-preview"
  | "none";

export interface ReaderProgressSyncDecisionServerContext {
  hasAuthenticatedUser: boolean;
  serverUserId?: string;
  canAccessBook?: boolean;
  canAccessChapter?: boolean;
  canWriteProgress?: boolean;
}

export interface ReaderProgressSyncDecisionPayload {
  bookId?: string;
  chapterId?: string;
  progressRatio?: number;
  idempotencyKeyPreview?: string;
  userId?: unknown;
  role?: unknown;
  auditId?: unknown;
  serverProgressRatio?: unknown;
  rawLocalStorage?: unknown;
  metadata?: unknown;
  __proto__?: unknown;
  constructor?: unknown;
  prototype?: unknown;
  [key: string]: unknown;
}

export interface ReaderProgressSyncDecisionExistingProgress {
  progressRatio?: number;
  updatedAt?: string;
}

export interface ReaderProgressSyncDecisionOptions {
  previewOnly?: true;
}

export interface ReaderProgressSyncDecisionInput {
  serverContext: ReaderProgressSyncDecisionServerContext;
  payload: ReaderProgressSyncDecisionPayload;
  existingProgress?: ReaderProgressSyncDecisionExistingProgress;
  options?: ReaderProgressSyncDecisionOptions;
}

export interface ReaderProgressSyncDecisionBlocker {
  code: string;
  message: string;
}

export interface ReaderProgressSyncDecisionConflict {
  existingProgressRatio: number;
  incomingProgressRatio: number;
  policy: "progressRatio-monotonic-no-direct-regression";
}

export interface ReaderProgressSyncDecisionPermissionSummary {
  hasAuthenticatedUser: boolean;
  hasServerUserId: boolean;
  canAccessBook: boolean | null;
  canAccessChapter: boolean | null;
  canWriteProgress: boolean | null;
  missingPermissionContext: string[];
}

export interface ReaderProgressSyncDecisionNormalizedPayload {
  bookId: string;
  chapterId: string;
  progressRatio: number;
  idempotencyKeyPreview?: string;
}

export interface ReaderProgressSyncDecisionResult {
  previewOnly: true;
  implemented: false;
  executesWrite: false;
  status: ReaderProgressSyncDecisionStatus;
  operationPreview: ReaderProgressSyncOperationPreview;
  normalizedPayload?: ReaderProgressSyncDecisionNormalizedPayload;
  hasServerUserContext: boolean;
  permissionSummary: ReaderProgressSyncDecisionPermissionSummary;
  blockers: ReaderProgressSyncDecisionBlocker[];
  warnings: string[];
  conflict?: ReaderProgressSyncDecisionConflict;
  nextSafeSteps: string[];
}

const ALLOWED_PAYLOAD_KEYS = [
  "bookId",
  "chapterId",
  "progressRatio",
  "idempotencyKeyPreview",
] as const;

const FORBIDDEN_PAYLOAD_KEYS = [
  "userId",
  "role",
  "auditId",
  "serverProgressRatio",
  "rawLocalStorage",
  "metadata",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const SAFE_NEXT_STEPS = [
  "inject server auth/session user context",
  "resolve book, chapter, and write permission gates on the server",
  "connect an audited server action shell after explicit authorization",
  "call repository only after explicit authorization",
  "add integration tests for preview-to-server sync boundaries",
] as const;

const BASE_WARNINGS = [
  "Decision result is preview-only. implemented=false and executesWrite=false.",
  "This function does not call repository, DB, fetch, tools, or Agent loops.",
  "userId must come from server auth/session context, never from client payload.",
] as const;

const CONFLICT_POLICY = "progressRatio-monotonic-no-direct-regression" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function detectDangerousKey(payload: Record<string, unknown>): string | null {
  const keys = Object.keys(payload);
  for (const key of keys) {
    if ((FORBIDDEN_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      return key;
    }
  }
  return null;
}

function toPermissionSummary(
  serverContext: unknown,
): ReaderProgressSyncDecisionPermissionSummary {
  if (!isRecord(serverContext)) {
    return {
      hasAuthenticatedUser: false,
      hasServerUserId: false,
      canAccessBook: null,
      canAccessChapter: null,
      canWriteProgress: null,
      missingPermissionContext: [
        "hasAuthenticatedUser",
        "serverUserId",
        "canAccessBook",
        "canAccessChapter",
        "canWriteProgress",
      ],
    };
  }

  const missingPermissionContext: string[] = [];
  const canAccessBook =
    typeof serverContext.canAccessBook === "boolean"
      ? serverContext.canAccessBook
      : null;
  const canAccessChapter =
    typeof serverContext.canAccessChapter === "boolean"
      ? serverContext.canAccessChapter
      : null;
  const canWriteProgress =
    typeof serverContext.canWriteProgress === "boolean"
      ? serverContext.canWriteProgress
      : null;

  if (typeof serverContext.hasAuthenticatedUser !== "boolean") {
    missingPermissionContext.push("hasAuthenticatedUser");
  }
  if (!isNonEmptyString(serverContext.serverUserId)) {
    missingPermissionContext.push("serverUserId");
  }
  if (canAccessBook === null) {
    missingPermissionContext.push("canAccessBook");
  }
  if (canAccessChapter === null) {
    missingPermissionContext.push("canAccessChapter");
  }
  if (canWriteProgress === null) {
    missingPermissionContext.push("canWriteProgress");
  }

  return {
    hasAuthenticatedUser: serverContext.hasAuthenticatedUser === true,
    hasServerUserId: isNonEmptyString(serverContext.serverUserId),
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    missingPermissionContext,
  };
}

function buildResult(
  status: ReaderProgressSyncDecisionStatus,
  permissionSummary: ReaderProgressSyncDecisionPermissionSummary,
  warnings: string[],
  blockers: ReaderProgressSyncDecisionBlocker[],
  normalizedPayload?: ReaderProgressSyncDecisionNormalizedPayload,
  conflict?: ReaderProgressSyncDecisionConflict,
): ReaderProgressSyncDecisionResult {
  return {
    previewOnly: true,
    implemented: false,
    executesWrite: false,
    status,
    operationPreview: status === "ready_preview" ? "upsert-reading-progress-preview" : "none",
    normalizedPayload,
    hasServerUserContext:
      permissionSummary.hasAuthenticatedUser && permissionSummary.hasServerUserId,
    permissionSummary,
    blockers,
    warnings,
    conflict,
    nextSafeSteps: [...SAFE_NEXT_STEPS],
  };
}

function buildInvalidResult(
  blocker: ReaderProgressSyncDecisionBlocker,
  permissionSummary?: ReaderProgressSyncDecisionPermissionSummary,
  warnings?: string[],
): ReaderProgressSyncDecisionResult {
  return buildResult(
    "invalid",
    permissionSummary || {
      hasAuthenticatedUser: false,
      hasServerUserId: false,
      canAccessBook: null,
      canAccessChapter: null,
      canWriteProgress: null,
      missingPermissionContext: [],
    },
    warnings ? [...warnings] : [...BASE_WARNINGS],
    [blocker],
  );
}

function normalizePayload(
  payload: unknown,
  warnings: string[],
): {
  normalized?: ReaderProgressSyncDecisionNormalizedPayload;
  blocker?: ReaderProgressSyncDecisionBlocker;
} {
  if (!isRecord(payload)) {
    return {
      blocker: {
        code: "INVALID_PAYLOAD",
        message: "payload must be a plain object.",
      },
    };
  }

  const dangerousKey = detectDangerousKey(payload);
  if (dangerousKey !== null) {
    return {
      blocker: {
        code: "FORBIDDEN_PAYLOAD_FIELD",
        message:
          "payload contains forbidden client field: " + dangerousKey + ".",
      },
    };
  }

  for (const key of Object.keys(payload)) {
    if (!(ALLOWED_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      return {
        blocker: {
          code: "UNKNOWN_PAYLOAD_FIELD",
          message: "payload contains unknown field: " + key + ".",
        },
      };
    }
  }

  if (!isNonEmptyString(payload.bookId)) {
    return {
      blocker: {
        code: "INVALID_BOOK_ID",
        message: "bookId must be a non-empty string.",
      },
    };
  }

  if (!isNonEmptyString(payload.chapterId)) {
    return {
      blocker: {
        code: "INVALID_CHAPTER_ID",
        message: "chapterId must be a non-empty string.",
      },
    };
  }

  if (!isFiniteRatio(payload.progressRatio)) {
    return {
      blocker: {
        code: "INVALID_PROGRESS_RATIO",
        message: "progressRatio must be a finite number in range [0, 1].",
      },
    };
  }

  if (
    payload.idempotencyKeyPreview !== undefined &&
    payload.idempotencyKeyPreview !== null &&
    typeof payload.idempotencyKeyPreview !== "string"
  ) {
    return {
      blocker: {
        code: "INVALID_IDEMPOTENCY_KEY_PREVIEW",
        message: "idempotencyKeyPreview must be a string when provided.",
      },
    };
  }

  if (typeof payload.idempotencyKeyPreview === "string") {
    pushUnique(
      warnings,
      "idempotencyKeyPreview is preview metadata only, not trusted server idempotency.",
    );
  }

  const normalized: ReaderProgressSyncDecisionNormalizedPayload = {
    bookId: payload.bookId.trim(),
    chapterId: payload.chapterId.trim(),
    progressRatio: payload.progressRatio,
  };

  if (typeof payload.idempotencyKeyPreview === "string") {
    normalized.idempotencyKeyPreview = payload.idempotencyKeyPreview;
  }

  return { normalized };
}

function normalizeExistingProgress(
  existingProgress: unknown,
): {
  progressRatio?: number;
  blocker?: ReaderProgressSyncDecisionBlocker;
} {
  if (existingProgress === undefined || existingProgress === null) {
    return {};
  }

  if (!isRecord(existingProgress)) {
    return {
      blocker: {
        code: "INVALID_EXISTING_PROGRESS",
        message: "existingProgress must be an object when provided.",
      },
    };
  }

  if (
    existingProgress.progressRatio !== undefined &&
    existingProgress.progressRatio !== null &&
    !isFiniteRatio(existingProgress.progressRatio)
  ) {
    return {
      blocker: {
        code: "INVALID_EXISTING_PROGRESS_RATIO",
        message:
          "existingProgress.progressRatio must be a finite number in range [0, 1].",
      },
    };
  }

  return {
    progressRatio:
      typeof existingProgress.progressRatio === "number"
        ? existingProgress.progressRatio
        : undefined,
  };
}

function buildPermissionBlockers(
  permissionSummary: ReaderProgressSyncDecisionPermissionSummary,
): ReaderProgressSyncDecisionBlocker[] {
  const blockers: ReaderProgressSyncDecisionBlocker[] = [];

  if (!permissionSummary.hasAuthenticatedUser) {
    blockers.push({
      code: "AUTH_REQUIRED",
      message: "Missing authenticated server user context.",
    });
  }

  if (!permissionSummary.hasServerUserId) {
    blockers.push({
      code: "SERVER_USER_CONTEXT_REQUIRED",
      message: "serverUserId must come from server auth/session context.",
    });
  }

  if (permissionSummary.canAccessBook === null) {
    blockers.push({
      code: "BOOK_ACCESS_CONTEXT_MISSING",
      message: "canAccessBook permission context is missing.",
    });
  } else if (permissionSummary.canAccessBook === false) {
    blockers.push({
      code: "BOOK_ACCESS_DENIED",
      message: "Server context denies access to the requested book.",
    });
  }

  if (permissionSummary.canAccessChapter === null) {
    blockers.push({
      code: "CHAPTER_ACCESS_CONTEXT_MISSING",
      message: "canAccessChapter permission context is missing.",
    });
  } else if (permissionSummary.canAccessChapter === false) {
    blockers.push({
      code: "CHAPTER_ACCESS_DENIED",
      message: "Server context denies access to the requested chapter.",
    });
  }

  if (permissionSummary.canWriteProgress === null) {
    blockers.push({
      code: "WRITE_PROGRESS_CONTEXT_MISSING",
      message: "canWriteProgress permission context is missing.",
    });
  } else if (permissionSummary.canWriteProgress === false) {
    blockers.push({
      code: "WRITE_PROGRESS_DENIED",
      message: "Server context denies progress writes.",
    });
  }

  return blockers;
}

export function buildReaderProgressSyncDecision(
  input: ReaderProgressSyncDecisionInput | null | undefined,
): ReaderProgressSyncDecisionResult {
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    return buildInvalidResult(
      {
        code: "INVALID_INPUT",
        message: "decision input must be a plain object.",
      },
      undefined,
      warnings,
    );
  }

  if (
    input.options !== undefined &&
    input.options !== null &&
    (!isRecord(input.options) || input.options.previewOnly !== undefined)
  ) {
    if (!isRecord(input.options) || input.options.previewOnly !== true) {
      return buildInvalidResult(
        {
          code: "INVALID_PREVIEW_OPTION",
          message: "options.previewOnly must be true when provided.",
        },
        toPermissionSummary(input.serverContext),
        warnings,
      );
    }
  }

  const permissionSummary = toPermissionSummary(input.serverContext);
  const payloadResult = normalizePayload(input.payload, warnings);
  if (payloadResult.blocker) {
    return buildInvalidResult(payloadResult.blocker, permissionSummary, warnings);
  }

  if (!payloadResult.normalized) {
    return buildInvalidResult(
      {
        code: "NORMALIZED_PAYLOAD_MISSING",
        message: "payload normalization did not produce a usable payload.",
      },
      permissionSummary,
      warnings,
    );
  }

  const normalizedPayload = payloadResult.normalized;
  const existingProgressResult = normalizeExistingProgress(input.existingProgress);
  if (existingProgressResult.blocker) {
    return buildInvalidResult(
      existingProgressResult.blocker,
      permissionSummary,
      warnings,
    );
  }

  const permissionBlockers = buildPermissionBlockers(permissionSummary);
  if (permissionBlockers.length > 0) {
    pushUnique(
      warnings,
      "Permission and auth context must be resolved before any future write path.",
    );
    return buildResult(
      "blocked",
      permissionSummary,
      warnings,
      permissionBlockers,
      normalizedPayload,
    );
  }

  if (existingProgressResult.progressRatio === undefined) {
    return buildResult(
      "ready_preview",
      permissionSummary,
      warnings,
      [],
      normalizedPayload,
    );
  }

  if (normalizedPayload.progressRatio > existingProgressResult.progressRatio) {
    return buildResult(
      "ready_preview",
      permissionSummary,
      warnings,
      [],
      normalizedPayload,
    );
  }

  if (normalizedPayload.progressRatio === existingProgressResult.progressRatio) {
    pushUnique(
      warnings,
      "Incoming progress matches existing server progress. Preview resolves to noop.",
    );
    return buildResult(
      "noop",
      permissionSummary,
      warnings,
      [],
      normalizedPayload,
    );
  }

  const conflict: ReaderProgressSyncDecisionConflict = {
    existingProgressRatio: existingProgressResult.progressRatio,
    incomingProgressRatio: normalizedPayload.progressRatio,
    policy: CONFLICT_POLICY,
  };

  return buildResult(
    "conflict",
    permissionSummary,
    warnings,
    [
      {
        code: "PROGRESS_REGRESSION_CONFLICT",
        message:
          "Incoming progressRatio is lower than existing server progress under the monotonic policy.",
      },
    ],
    normalizedPayload,
    conflict,
  );
}
