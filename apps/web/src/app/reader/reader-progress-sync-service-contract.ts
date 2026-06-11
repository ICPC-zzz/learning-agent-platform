export type ReaderProgressSyncServiceContractStatus = "blocked" | "ready_preview";

export interface ReaderProgressSyncServiceContractInput {
  previewOnly?: true;
  implemented?: false;
  safeToExposeToClient?: true;
  authReady?: boolean;
  serverTrusted?: boolean;
  permissionGateReady?: boolean;
  idempotencyKeyReady?: boolean;
  idempotencyConflictClear?: boolean;
  auditReady?: boolean;
  writePreflightReady?: boolean;
  repositoryWriteAllowed?: boolean;
  productionWriteReady?: boolean;
  [key: string]: unknown;
}

export interface ReaderProgressSyncServiceContractPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderProgressSyncServiceContractStatus;
  authReady: boolean;
  serverTrusted: boolean;
  permissionGateReady: boolean;
  idempotencyKeyReady: boolean;
  idempotencyConflictClear: boolean;
  auditReady: boolean;
  writePreflightReady: boolean;
  repositoryWriteAllowed: false;
  productionWriteReady: false;
  writesDatabase: false;
  callsRepository: false;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "implemented",
  "safeToExposeToClient",
  "authReady",
  "serverTrusted",
  "permissionGateReady",
  "idempotencyKeyReady",
  "idempotencyConflictClear",
  "auditReady",
  "writePreflightReady",
  "repositoryWriteAllowed",
  "productionWriteReady",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "serverUserId",
  "token",
  "authToken",
  "authorization",
  "authHeader",
  "cookie",
  "cookies",
  "session",
  "rawSession",
  "headers",
  "rawHeaders",
  "request",
  "rawRequest",
  "body",
  "rawBody",
  "rawDbRecord",
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
  "Reader progress sync service contract preview is preview-only and disabled-by-default.",
  "No repository call, database write, auth token, cookie, session, raw request, raw DB record, or secret material is accepted here.",
  "The contract only records safe readiness booleans for a future write path.",
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function appendInputSafetyIssues(
  input: Record<string, unknown>,
  blockedReasons: string[],
  warnings: string[],
): void {
  if (hasUnsafePrototype(input)) {
    pushUnique(
      blockedReasons,
      "UNSAFE_PROTOTYPE_REJECTED: unsafe object prototype was rejected before validation.",
    );
    pushUnique(
      warnings,
      "Unsafe prototype pollution was rejected before the contract preview could be built.",
    );
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `FORBIDDEN_FIELD_REJECTED: unsafe field was rejected before validation (${key}).`,
      );
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `UNKNOWN_FIELD_REJECTED: unexpected field was rejected before validation (${key}).`,
      );
    }
  }
}

function normalizeBooleanFlag(
  input: Record<string, unknown>,
  key: keyof Pick<
    ReaderProgressSyncServiceContractInput,
    | "authReady"
    | "serverTrusted"
    | "permissionGateReady"
    | "idempotencyKeyReady"
    | "idempotencyConflictClear"
    | "auditReady"
    | "writePreflightReady"
    | "repositoryWriteAllowed"
    | "productionWriteReady"
  >,
  blockedReasons: string[],
): boolean {
  const value = input[key];

  if (value === undefined) {
    return false;
  }

  if (isBoolean(value)) {
    return value;
  }

  pushUnique(
    blockedReasons,
    `INVALID_${String(key).toUpperCase()}: ${String(key)} must be a boolean when provided.`,
  );
  return false;
}

function buildBlockedPreview(reason?: string | null): ReaderProgressSyncServiceContractPreview {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : "Reader progress sync service contract preview is blocked until trusted readiness signals are present.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    authReady: false,
    serverTrusted: false,
    permissionGateReady: false,
    idempotencyKeyReady: false,
    idempotencyConflictClear: false,
    auditReady: false,
    writePreflightReady: false,
    repositoryWriteAllowed: false,
    productionWriteReady: false,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: [safeReason],
    warnings: [...BASE_WARNINGS, safeReason],
    summary: safeReason,
  };
}

function buildPreview(
  input: {
    authReady: boolean;
    serverTrusted: boolean;
    permissionGateReady: boolean;
    idempotencyKeyReady: boolean;
    idempotencyConflictClear: boolean;
    auditReady: boolean;
    writePreflightReady: boolean;
    repositoryWriteAllowed: boolean;
    productionWriteReady: boolean;
  },
  warnings: string[],
): ReaderProgressSyncServiceContractPreview {
  const contractReadyPreview =
    input.authReady === true &&
    input.serverTrusted === true &&
    input.permissionGateReady === true &&
    input.idempotencyKeyReady === true &&
    input.idempotencyConflictClear === true &&
    input.auditReady === true &&
    input.writePreflightReady === true;

  if (contractReadyPreview) {
    pushUnique(
      warnings,
      "All preview-only contract readiness signals are green, but repository writes and production writes remain disabled-by-default in this round.",
    );
  } else {
    pushUnique(
      warnings,
      "One or more preview-only contract readiness signals remain blocked, so the future write path stays disabled.",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: contractReadyPreview ? "ready_preview" : "blocked",
    authReady: input.authReady,
    serverTrusted: input.serverTrusted,
    permissionGateReady: input.permissionGateReady,
    idempotencyKeyReady: input.idempotencyKeyReady,
    idempotencyConflictClear: input.idempotencyConflictClear,
    auditReady: input.auditReady,
    writePreflightReady: input.writePreflightReady,
    repositoryWriteAllowed: false,
    productionWriteReady: false,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: contractReadyPreview
      ? []
      : [
          ...(!input.authReady ? ["AUTH_READY_REQUIRED: authReady must be true."] : []),
          ...(!input.serverTrusted ? ["SERVER_TRUSTED_REQUIRED: serverTrusted must be true."] : []),
          ...(!input.permissionGateReady
            ? ["PERMISSION_GATE_READY_REQUIRED: permissionGateReady must be true."]
            : []),
          ...(!input.idempotencyKeyReady
            ? ["IDEMPOTENCY_KEY_READY_REQUIRED: idempotencyKeyReady must be true."]
            : []),
          ...(!input.idempotencyConflictClear
            ? ["IDEMPOTENCY_CONFLICT_CLEAR_REQUIRED: idempotencyConflictClear must be true."]
            : []),
          ...(!input.auditReady ? ["AUDIT_READY_REQUIRED: auditReady must be true."] : []),
          ...(!input.writePreflightReady
            ? ["WRITE_PREFLIGHT_READY_REQUIRED: writePreflightReady must be true."]
            : []),
        ],
    warnings,
    summary: contractReadyPreview
      ? "Reader progress sync service contract is ready in preview-only mode. Repository writes and production writes remain disabled-by-default."
      : "Reader progress sync service contract is blocked until auth, permission, idempotency, conflict, audit, and write preflight checks are all green.",
  };
}

export function createBlockedReaderProgressSyncServiceContractPreview(
  reason?: string | null,
): ReaderProgressSyncServiceContractPreview {
  return buildBlockedPreview(
    isNonEmptyString(reason)
      ? reason.trim()
      : "Reader progress sync service contract preview is blocked until trusted server-side readiness is present.",
  );
}

export function validateReaderProgressSyncServiceContractPreview(
  input: ReaderProgressSyncServiceContractInput | null | undefined,
): ReaderProgressSyncServiceContractPreview {
  if (!isRecord(input)) {
    return createBlockedReaderProgressSyncServiceContractPreview(
      "Reader progress sync service contract input must be a plain object.",
    );
  }

  const blockedReasons: string[] = [];
  const warnings = [...BASE_WARNINGS];

  appendInputSafetyIssues(input, blockedReasons, warnings);

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_PREVIEW_ONLY_FLAG: previewOnly must be true when provided.",
    );
  }

  if (input.implemented !== undefined && input.implemented !== false) {
    pushUnique(
      blockedReasons,
      "INVALID_IMPLEMENTED_FLAG: implemented must be false when provided.",
    );
  }

  if (input.safeToExposeToClient !== undefined && input.safeToExposeToClient !== true) {
    pushUnique(
      blockedReasons,
      "INVALID_SAFE_TO_EXPOSE_FLAG: safeToExposeToClient must be true when provided.",
    );
  }

  const authReady = normalizeBooleanFlag(input, "authReady", blockedReasons);
  const serverTrusted = normalizeBooleanFlag(input, "serverTrusted", blockedReasons);
  const permissionGateReady = normalizeBooleanFlag(input, "permissionGateReady", blockedReasons);
  const idempotencyKeyReady = normalizeBooleanFlag(input, "idempotencyKeyReady", blockedReasons);
  const idempotencyConflictClear = normalizeBooleanFlag(input, "idempotencyConflictClear", blockedReasons);
  const auditReady = normalizeBooleanFlag(input, "auditReady", blockedReasons);
  const writePreflightReady = normalizeBooleanFlag(input, "writePreflightReady", blockedReasons);
  const repositoryWriteAllowed = normalizeBooleanFlag(input, "repositoryWriteAllowed", blockedReasons);
  const productionWriteReady = normalizeBooleanFlag(input, "productionWriteReady", blockedReasons);

  if (repositoryWriteAllowed === true) {
    pushUnique(
      blockedReasons,
      "REPOSITORY_WRITE_NOT_ALLOWED: repositoryWriteAllowed must remain false in v1.",
    );
  }

  if (productionWriteReady === true) {
    pushUnique(
      blockedReasons,
      "PRODUCTION_WRITE_NOT_ALLOWED: productionWriteReady must remain false in v1.",
    );
  }

  if (blockedReasons.length > 0) {
    pushUnique(
      warnings,
      "Contract preview validation blocked before any preview-ready service contract could be built.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      authReady: false,
      serverTrusted: false,
      permissionGateReady: false,
      idempotencyKeyReady: false,
      idempotencyConflictClear: false,
      auditReady: false,
      writePreflightReady: false,
      repositoryWriteAllowed: false,
      productionWriteReady: false,
      writesDatabase: false,
      callsRepository: false,
      blockedReasons,
      warnings,
      summary:
        "Reader progress sync service contract input was rejected before any ready-preview summary could be built.",
    };
  }

  const preview = buildPreview(
    {
      authReady,
      serverTrusted,
      permissionGateReady,
      idempotencyKeyReady,
      idempotencyConflictClear,
      auditReady,
      writePreflightReady,
      repositoryWriteAllowed,
      productionWriteReady,
    },
    warnings,
  );

  return preview;
}

export function createReaderProgressSyncServiceContractPreview(
  input?: ReaderProgressSyncServiceContractInput | null,
): ReaderProgressSyncServiceContractPreview {
  return validateReaderProgressSyncServiceContractPreview(input);
}
