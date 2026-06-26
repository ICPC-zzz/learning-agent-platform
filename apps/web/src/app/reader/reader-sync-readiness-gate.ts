export type ReaderSyncReadinessGateStatus = "blocked" | "ready";

export type ReaderSyncReadinessChecklistItemStatus = "blocked" | "satisfied";

export type ReaderSyncReadinessCheckId =
  | "auth"
  | "repository"
  | "db_write"
  | "audit"
  | "idempotency"
  | "conflict_resolution"
  | "server_action"
  | "explicit_authorization";

export interface ReaderSyncReadinessGateInput {
  previewOnly?: true;
  authReady?: boolean;
  repositoryReady?: boolean;
  dbWriteReady?: boolean;
  auditReady?: boolean;
  idempotencyReady?: boolean;
  conflictResolutionReady?: boolean;
  serverActionReady?: boolean;
  explicitUserAuthorization?: boolean;
}

export interface ReaderSyncReadinessChecklistItem {
  id: ReaderSyncReadinessCheckId;
  label: string;
  status: ReaderSyncReadinessChecklistItemStatus;
  ready: boolean;
  reason: string;
}

export interface ReaderSyncReadinessGateResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncReadinessGateStatus;
  mustRemainPreviewOnly: boolean;
  canEnableRealSync: boolean;
  executed: false;
  writesDatabase: false;
  callsRepository: false;
  success: false;
  blocked: boolean;
  blockedReasons: string[];
  warnings: string[];
  nextSafeSteps: string[];
  readinessChecklist: ReaderSyncReadinessChecklistItem[];
  summary: string;
}

interface ReaderSyncReadinessGateNormalizedInput {
  previewOnly: true;
  authReady: boolean;
  repositoryReady: boolean;
  dbWriteReady: boolean;
  auditReady: boolean;
  idempotencyReady: boolean;
  conflictResolutionReady: boolean;
  serverActionReady: boolean;
  explicitUserAuthorization: boolean;
  blockedReasons: string[];
  warnings: string[];
}

interface ReaderSyncReadinessChecklistDefinition {
  id: ReaderSyncReadinessCheckId;
  inputKey: keyof Pick<
    ReaderSyncReadinessGateInput,
    | "authReady"
    | "repositoryReady"
    | "dbWriteReady"
    | "auditReady"
    | "idempotencyReady"
    | "conflictResolutionReady"
    | "serverActionReady"
    | "explicitUserAuthorization"
  >;
  label: string;
  blockedReasonCode: keyof typeof READINESS_BLOCKED_REASON_CODES;
  reasonWhenBlocked: string;
  nextSafeStep: string;
}

export const READINESS_REQUIREMENT_KEYS = [
  "previewOnly",
  "authReady",
  "repositoryReady",
  "dbWriteReady",
  "auditReady",
  "idempotencyReady",
  "conflictResolutionReady",
  "serverActionReady",
  "explicitUserAuthorization",
] as const;

export const READINESS_BLOCKED_REASON_CODES = {
  invalidInput: "INVALID_INPUT",
  invalidPreviewOnly: "INVALID_PREVIEW_ONLY_FLAG",
  unsafePrototype: "UNSAFE_PROTOTYPE_REJECTED",
  authNotReady: "AUTH_NOT_READY",
  repositoryNotReady: "REPOSITORY_NOT_READY",
  dbWriteNotReady: "DB_WRITE_NOT_READY",
  auditNotReady: "AUDIT_NOT_READY",
  idempotencyNotReady: "IDEMPOTENCY_NOT_READY",
  conflictResolutionNotReady: "CONFLICT_RESOLUTION_NOT_READY",
  serverActionNotReady: "SERVER_ACTION_NOT_READY",
  explicitAuthorizationRequired: "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
} as const;

export const READINESS_NEXT_SAFE_STEPS = [
  "keep the reader sync path preview-only until every prerequisite is green",
  "wire real server auth/session context before any write-capable handler is introduced",
  "add a real repository boundary and DB write path only after authorization is explicit",
  "persist audit and idempotency records before considering any future write execution",
  "prove monotonic conflict handling in tests before enabling a real sync path",
] as const;

const BASE_WARNINGS = [
  "Reader sync readiness gate is preview-only, implemented=false, and never performs DB writes or repository calls.",
  "This module only evaluates readiness signals for a future real-sync path; it does not enable one.",
  "Dangerous client fields are rejected or ignored and are never trusted as readiness signals.",
] as const;

const READINESS_CHECKLIST_DEFINITIONS: ReaderSyncReadinessChecklistDefinition[] = [
  {
    id: "auth",
    inputKey: "authReady",
    label: "Real auth/session readiness",
    blockedReasonCode: "authNotReady",
    reasonWhenBlocked:
      "Real auth/session context is not ready, so the system must remain preview-only/no-op.",
    nextSafeStep:
      "connect real server auth/session context before any future write-capable path is considered",
  },
  {
    id: "repository",
    inputKey: "repositoryReady",
    label: "Repository readiness",
    blockedReasonCode: "repositoryNotReady",
    reasonWhenBlocked:
      "Repository boundaries are not ready, so real sync must not be attempted.",
    nextSafeStep:
      "keep repository calls behind a preview-only port until the real repository boundary exists",
  },
  {
    id: "db_write",
    inputKey: "dbWriteReady",
    label: "DB write readiness",
    blockedReasonCode: "dbWriteNotReady",
    reasonWhenBlocked:
      "DB write capability is not ready, so the system must stay preview-only/no-op.",
    nextSafeStep:
      "add a real DB write boundary only after server auth and repository authorization are in place",
  },
  {
    id: "audit",
    inputKey: "auditReady",
    label: "Audit readiness",
    blockedReasonCode: "auditNotReady",
    reasonWhenBlocked:
      "Audit logging is not ready, so no real sync execution is allowed.",
    nextSafeStep:
      "persist audit records before any future real sync path is enabled",
  },
  {
    id: "idempotency",
    inputKey: "idempotencyReady",
    label: "Idempotency readiness",
    blockedReasonCode: "idempotencyNotReady",
    reasonWhenBlocked:
      "Idempotency persistence is not ready, so real writes must stay disabled.",
    nextSafeStep:
      "implement server-side idempotency before any write-capable flow is opened",
  },
  {
    id: "conflict_resolution",
    inputKey: "conflictResolutionReady",
    label: "Conflict handling readiness",
    blockedReasonCode: "conflictResolutionNotReady",
    reasonWhenBlocked:
      "Conflict handling is not ready, so the system must not enter a real sync path.",
    nextSafeStep:
      "prove monotonic conflict handling and recovery behavior in tests first",
  },
  {
    id: "server_action",
    inputKey: "serverActionReady",
    label: "Server action readiness",
    blockedReasonCode: "serverActionNotReady",
    reasonWhenBlocked:
      "The real server action itself is not ready, so preview-only/no-op must remain the default.",
    nextSafeStep:
      "keep the current no-op server action in place until a real, authorized path exists",
  },
  {
    id: "explicit_authorization",
    inputKey: "explicitUserAuthorization",
    label: "Explicit user authorization",
    blockedReasonCode: "explicitAuthorizationRequired",
    reasonWhenBlocked:
      "Explicit user authorization is missing, so even fully faked readiness must not open a real sync path.",
    nextSafeStep:
      "require an explicit user authorization step before any future real sync execution",
  },
];

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "session",
  "rawSession",
  "metadata",
  "rawLocalStorage",
  "db",
  "repository",
  "prisma",
  "fetch",
  "process",
  "env",
  "__proto__",
  "constructor",
  "prototype",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function appendReadinessIssue(
  blockedReasons: string[],
  code: keyof typeof READINESS_BLOCKED_REASON_CODES,
  detail: string,
): void {
  pushUnique(blockedReasons, `${READINESS_BLOCKED_REASON_CODES[code]}: ${detail}`);
}

function readBooleanFlag(
  input: Record<string, unknown>,
  key: keyof ReaderSyncReadinessGateNormalizedInput,
  blockedReasons: string[],
): boolean {
  const value = input[key];
  if (value === undefined) {
    return false;
  }
  if (isBoolean(value)) {
    return value;
  }
  appendReadinessIssue(
    blockedReasons,
    "invalidInput",
    `${String(key)} must be a boolean when provided.`,
  );
  return false;
}

function normalizeReadinessInput(
  input: ReaderSyncReadinessGateInput | null | undefined,
): ReaderSyncReadinessGateNormalizedInput {
  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    appendReadinessIssue(
      blockedReasons,
      "invalidInput",
      "Readiness gate input must be a plain object.",
    );
    return {
      previewOnly: true,
      authReady: false,
      repositoryReady: false,
      dbWriteReady: false,
      auditReady: false,
      idempotencyReady: false,
      conflictResolutionReady: false,
      serverActionReady: false,
      explicitUserAuthorization: false,
      blockedReasons,
      warnings,
    };
  }

  if (hasUnsafePrototype(input)) {
    appendReadinessIssue(
      blockedReasons,
      "unsafePrototype",
      "Unsafe prototype rejected before readiness could be evaluated.",
    );
  }

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    appendReadinessIssue(
      blockedReasons,
      "invalidPreviewOnly",
      "previewOnly must be true when provided.",
    );
  }

  const keys = Object.keys(input);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `${READINESS_BLOCKED_REASON_CODES.invalidInput}: forbidden field rejected -> ${key}`,
      );
      continue;
    }

    if (!(READINESS_REQUIREMENT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `${READINESS_BLOCKED_REASON_CODES.invalidInput}: unknown field rejected -> ${key}`,
      );
    }
  }

  const authReady = readBooleanFlag(input, "authReady", blockedReasons);
  const repositoryReady = readBooleanFlag(input, "repositoryReady", blockedReasons);
  const dbWriteReady = readBooleanFlag(input, "dbWriteReady", blockedReasons);
  const auditReady = readBooleanFlag(input, "auditReady", blockedReasons);
  const idempotencyReady = readBooleanFlag(input, "idempotencyReady", blockedReasons);
  const conflictResolutionReady = readBooleanFlag(
    input,
    "conflictResolutionReady",
    blockedReasons,
  );
  const serverActionReady = readBooleanFlag(input, "serverActionReady", blockedReasons);
  let explicitUserAuthorization = false;
  if (input.explicitUserAuthorization === undefined) {
    explicitUserAuthorization = false;
  } else if (isBoolean(input.explicitUserAuthorization)) {
    explicitUserAuthorization = input.explicitUserAuthorization;
  } else {
    appendReadinessIssue(
      blockedReasons,
      "invalidInput",
      "explicitUserAuthorization must be a boolean when provided.",
    );
  }

  if (authReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "authNotReady",
      "Real auth/session readiness is not satisfied.",
    );
  }
  if (repositoryReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "repositoryNotReady",
      "Repository readiness is not satisfied.",
    );
  }
  if (dbWriteReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "dbWriteNotReady",
      "DB write readiness is not satisfied.",
    );
  }
  if (auditReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "auditNotReady",
      "Audit readiness is not satisfied.",
    );
  }
  if (idempotencyReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "idempotencyNotReady",
      "Idempotency readiness is not satisfied.",
    );
  }
  if (conflictResolutionReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "conflictResolutionNotReady",
      "Conflict resolution readiness is not satisfied.",
    );
  }
  if (serverActionReady !== true) {
    appendReadinessIssue(
      blockedReasons,
      "serverActionNotReady",
      "The real server action is not ready.",
    );
  }
  if (explicitUserAuthorization !== true) {
    appendReadinessIssue(
      blockedReasons,
      "explicitAuthorizationRequired",
      "Explicit user authorization is required before any real sync path can be enabled.",
    );
  }

  return {
    previewOnly: true,
    authReady,
    repositoryReady,
    dbWriteReady,
    auditReady,
    idempotencyReady,
    conflictResolutionReady,
    serverActionReady,
    explicitUserAuthorization,
    blockedReasons,
    warnings,
  };
}

function buildReadinessChecklist(
  normalizedInput: ReaderSyncReadinessGateNormalizedInput,
): ReaderSyncReadinessChecklistItem[] {
  return READINESS_CHECKLIST_DEFINITIONS.map(function (definition) {
    const ready = normalizedInput[definition.inputKey] === true;
    return {
      id: definition.id,
      label: definition.label,
      status: ready ? "satisfied" : "blocked",
      ready,
      reason: ready
        ? `${definition.label} is ready, but the gate stays preview-only in this code path.`
        : definition.reasonWhenBlocked,
    };
  });
}

function buildSummary(canEnableRealSync: boolean): string {
  if (canEnableRealSync) {
    return "All readiness checks are satisfied, but this module still returns a preview-only evaluation and does not execute a real sync.";
  }

  return "One or more readiness checks are blocked, so the system must remain preview-only/no-op.";
}

export function buildReaderSyncReadinessChecklist(
  input?: ReaderSyncReadinessGateInput | null,
): ReaderSyncReadinessChecklistItem[] {
  return buildReadinessChecklist(normalizeReadinessInput(input));
}

export function evaluateReaderSyncReadinessGate(
  input?: ReaderSyncReadinessGateInput | null,
): ReaderSyncReadinessGateResult {
  const normalizedInput = normalizeReadinessInput(input);
  const readinessChecklist = buildReadinessChecklist(normalizedInput);
  const canEnableRealSync =
    normalizedInput.blockedReasons.length === 0 &&
    readinessChecklist.every(function (item) {
      return item.ready;
    }) && normalizedInput.explicitUserAuthorization === true;
  const blocked = canEnableRealSync === false;
  const blockedReasons = [...normalizedInput.blockedReasons];
  const nextSafeSteps = [...READINESS_NEXT_SAFE_STEPS];

  for (let index = 0; index < readinessChecklist.length; index += 1) {
    const item = readinessChecklist[index];
    if (!item.ready) {
      const definition = READINESS_CHECKLIST_DEFINITIONS[index];
      pushUnique(
        blockedReasons,
        `${READINESS_BLOCKED_REASON_CODES[definition.blockedReasonCode]}: ${item.reason}`,
      );
      pushUnique(nextSafeSteps, item.reason);
    }
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: canEnableRealSync ? "ready" : "blocked",
    mustRemainPreviewOnly: !canEnableRealSync,
    canEnableRealSync,
    executed: false,
    writesDatabase: false,
    callsRepository: false,
    success: false,
    blocked,
    blockedReasons,
    warnings: normalizedInput.warnings,
    nextSafeSteps,
    readinessChecklist,
    summary: buildSummary(canEnableRealSync),
  };
}
