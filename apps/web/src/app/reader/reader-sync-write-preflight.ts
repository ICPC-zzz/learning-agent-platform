export type ReaderSyncWritePreflightStatus = "blocked" | "ready_preview";

export interface ReaderSyncWritePreflightInput {
  previewOnly?: true;
  implemented?: false;
  safeToExposeToClient?: true;
  authReady?: boolean;
  serverTrusted?: boolean;
  permissionGateReady?: boolean;
  idempotencyReady?: boolean;
  auditReady?: boolean;
  databaseWriteOptIn?: boolean;
  publicRouteExposed?: boolean;
  [key: string]: unknown;
}

export interface ReaderSyncWritePreflightPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: ReaderSyncWritePreflightStatus;
  authReady: boolean;
  serverTrusted: boolean;
  permissionGateReady: boolean;
  idempotencyReady: boolean;
  auditReady: boolean;
  databaseWriteOptIn: boolean;
  publicRouteExposed: boolean;
  productionWriteReady: boolean;
  writesDatabase: false;
  callsRepository: false;
  blockedReasons: string[];
  warnings: string[];
  nextSafeSteps: string[];
  summary: string;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "implemented",
  "safeToExposeToClient",
  "authReady",
  "serverTrusted",
  "permissionGateReady",
  "idempotencyReady",
  "auditReady",
  "databaseWriteOptIn",
  "publicRouteExposed",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "token",
  "authToken",
  "session",
  "rawSession",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "request",
  "rawRequest",
  "body",
  "rawBody",
  "DATABASE_URL",
  "rawDbRecord",
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
  "Reader sync write preflight is preview-only and disabled-by-default.",
  "This module only reports readiness for a future production-write path; it never writes the database or calls a repository.",
  "Only safe boolean readiness flags and opt-in markers are accepted here.",
] as const;

const NEXT_SAFE_STEPS = [
  "Keep the real write path disabled until a separate, explicitly approved production route exists.",
  "Preserve preview-only auth, permission, idempotency, and audit checks before any future write-capable slice.",
  "Keep repository calls and DB writes behind a separate opt-in boundary.",
  "Do not connect a real auth provider, real DB writer, or public production route in this round.",
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
      "Unsafe prototype pollution was rejected before the write preflight could be evaluated.",
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
    ReaderSyncWritePreflightInput,
    | "authReady"
    | "serverTrusted"
    | "permissionGateReady"
    | "idempotencyReady"
    | "auditReady"
    | "databaseWriteOptIn"
    | "publicRouteExposed"
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

function buildBlockedPreview(
  reason?: string | null,
): ReaderSyncWritePreflightPreview {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : "Reader sync write preflight is blocked until trusted readiness signals are present.";

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    authReady: false,
    serverTrusted: false,
    permissionGateReady: false,
    idempotencyReady: false,
    auditReady: false,
    databaseWriteOptIn: false,
    publicRouteExposed: false,
    productionWriteReady: false,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: [safeReason],
    warnings: [...BASE_WARNINGS, safeReason],
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    summary: safeReason,
  };
}

function buildReadyPreview(
  input: {
    authReady: boolean;
    serverTrusted: boolean;
    permissionGateReady: boolean;
    idempotencyReady: boolean;
    auditReady: boolean;
    databaseWriteOptIn: boolean;
    publicRouteExposed: boolean;
  },
  warnings: string[],
): ReaderSyncWritePreflightPreview {
  const productionWriteReady =
    input.authReady === true &&
    input.permissionGateReady === true &&
    input.idempotencyReady === true &&
    input.auditReady === true &&
    input.databaseWriteOptIn === true &&
    input.publicRouteExposed === true;

  if (productionWriteReady) {
    pushUnique(
      warnings,
      "All preview-only readiness checks are green, but this module still performs no repository calls or database writes.",
    );
  } else {
    pushUnique(
      warnings,
      "One or more preview-only readiness checks are still blocked, so the future production-write path must remain disabled.",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: productionWriteReady ? "ready_preview" : "blocked",
    authReady: input.authReady,
    serverTrusted: input.serverTrusted,
    permissionGateReady: input.permissionGateReady,
    idempotencyReady: input.idempotencyReady,
    auditReady: input.auditReady,
    databaseWriteOptIn: input.databaseWriteOptIn,
    publicRouteExposed: input.publicRouteExposed,
    productionWriteReady,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: productionWriteReady
      ? []
      : [
          ...(!input.authReady ? ["AUTH_READY_REQUIRED: auth readiness must be true."] : []),
          ...(!input.permissionGateReady
            ? ["PERMISSION_GATE_READY_REQUIRED: permission gate readiness must be true."]
            : []),
          ...(!input.idempotencyReady
            ? ["IDEMPOTENCY_READY_REQUIRED: idempotency readiness must be true."]
            : []),
          ...(!input.auditReady ? ["AUDIT_READY_REQUIRED: audit readiness must be true."] : []),
          ...(!input.databaseWriteOptIn
            ? ["DATABASE_WRITE_OPT_IN_REQUIRED: databaseWriteOptIn must be true."]
            : []),
          ...(!input.publicRouteExposed
            ? ["PUBLIC_ROUTE_EXPOSED_REQUIRED: publicRouteExposed must be true."]
            : []),
        ],
    warnings,
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    summary: productionWriteReady
      ? "All preview-only write preflight checks are green, so the future production-write path is theoretically ready, but this round still does not write the database or call a repository."
      : "Reader sync write preflight remains blocked and preview-only until auth, permission, idempotency, audit, opt-in, and public-route exposure are all green.",
  };
}

export function createBlockedReaderSyncWritePreflightPreview(
  reason?: string | null,
): ReaderSyncWritePreflightPreview {
  return buildBlockedPreview(reason);
}

export function validateReaderSyncWritePreflightPreview(
  input: ReaderSyncWritePreflightInput | null | undefined,
): ReaderSyncWritePreflightPreview {
  if (!isRecord(input)) {
    return buildBlockedPreview(
      "Reader sync write preflight input must be a plain object.",
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
  const idempotencyReady = normalizeBooleanFlag(input, "idempotencyReady", blockedReasons);
  const auditReady = normalizeBooleanFlag(input, "auditReady", blockedReasons);
  const databaseWriteOptIn = normalizeBooleanFlag(input, "databaseWriteOptIn", blockedReasons);
  const publicRouteExposed = normalizeBooleanFlag(input, "publicRouteExposed", blockedReasons);

  if (blockedReasons.length > 0) {
    pushUnique(
      warnings,
      "Write preflight validation blocked before a production-write-ready preview could be built.",
    );
    return {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      status: "blocked",
      authReady: false,
      serverTrusted: false,
      permissionGateReady: false,
      idempotencyReady: false,
      auditReady: false,
      databaseWriteOptIn: false,
      publicRouteExposed: false,
      productionWriteReady: false,
      writesDatabase: false,
      callsRepository: false,
      blockedReasons,
      warnings,
      nextSafeSteps: [...NEXT_SAFE_STEPS],
      summary:
        "Reader sync write preflight input was rejected before any theoretical production-write readiness could be computed.",
    };
  }

  const preview = buildReadyPreview(
    {
      authReady,
      serverTrusted,
      permissionGateReady,
      idempotencyReady,
      auditReady,
      databaseWriteOptIn,
      publicRouteExposed,
    },
    warnings,
  );

  if (preview.productionWriteReady !== true) {
    for (const reason of preview.blockedReasons) {
      pushUnique(blockedReasons, reason);
    }
  }

  return {
    ...preview,
    blockedReasons,
  };
}

export function createReaderSyncWritePreflightPreview(
  input?: ReaderSyncWritePreflightInput | null,
): ReaderSyncWritePreflightPreview {
  return validateReaderSyncWritePreflightPreview(input);
}
