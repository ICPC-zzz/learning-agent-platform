export type ReaderSyncAuthContextPreviewStatus = "blocked" | "preview";

export type ReaderSyncAuthContextPreviewSource =
  | "blocked-by-default"
  | "trusted-server-context";

export interface ReaderSyncAuthContextPreviewInput {
  previewOnly?: true;
  source?: ReaderSyncAuthContextPreviewSource;
  authenticated?: boolean;
  serverTrusted?: boolean;
  serverUserIdPreview?: string | null;
  testOnly?: boolean;
  mockOnly?: boolean;
  [key: string]: unknown;
}

export interface ReaderSyncAuthContextPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: ReaderSyncAuthContextPreviewSource;
  status: ReaderSyncAuthContextPreviewStatus;
  authenticated: boolean;
  authReady: boolean;
  serverTrusted: boolean;
  serverUserIdPreview: string | null;
  testOnly: boolean;
  mockOnly: boolean;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "source",
  "authenticated",
  "serverTrusted",
  "serverUserIdPreview",
  "testOnly",
  "mockOnly",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
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
  "DATABASE_URL",
  "rawDbRecord",
  "metadata",
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
  "Reader sync auth context is preview-only and disabled-by-default.",
  "No real auth provider, token, cookie, session, request, or database secret is accepted here.",
  "The resolver only exposes a safe server-trusted preview summary.",
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function maskServerUserIdPreview(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 4) {
    return "***";
  }

  return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
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
      "Unsafe prototype pollution was rejected before the auth context preview could be built.",
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

function buildBlockedPreview(
  reason?: string | null,
  blockedReasons?: string[],
  warnings?: string[],
): ReaderSyncAuthContextPreview {
  const safeReason = isNonEmptyString(reason)
    ? reason.trim()
    : "Reader sync auth context preview is blocked until trusted server-side auth data is supplied.";
  const nextBlockedReasons =
    blockedReasons !== undefined && blockedReasons.length > 0
      ? blockedReasons
      : [safeReason];
  const nextWarnings =
    warnings !== undefined && warnings.length > 0
      ? warnings
      : [...BASE_WARNINGS, safeReason];

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "blocked-by-default",
    status: "blocked",
    authenticated: false,
    authReady: false,
    serverTrusted: false,
    serverUserIdPreview: null,
    testOnly: false,
    mockOnly: false,
    blockedReasons: nextBlockedReasons,
    warnings: nextWarnings,
    summary: safeReason,
  };
}

function buildPreview(input: {
  source: ReaderSyncAuthContextPreviewSource;
  authenticated: boolean;
  serverTrusted: boolean;
  serverUserIdPreview: string | null;
  testOnly: boolean;
  mockOnly: boolean;
  blockedReasons: string[];
  warnings: string[];
}): ReaderSyncAuthContextPreview {
  const authReady =
    input.authenticated === true &&
    input.serverTrusted === true &&
    input.serverUserIdPreview !== null &&
    input.blockedReasons.length === 0;

  if (authReady) {
    pushUnique(
      input.warnings,
      "Server-only auth context preview is authenticated, but it remains preview-only and does not imply a real auth provider.",
    );
    if (input.testOnly === true || input.mockOnly === true) {
      pushUnique(
        input.warnings,
        "This authenticated preview came from a test-only mock server context.",
      );
    }
  } else {
    pushUnique(
      input.warnings,
      "Auth context preview remains blocked, so the server-trusted boundary stays disabled-by-default.",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: input.source,
    status: authReady ? "preview" : "blocked",
    authenticated: authReady,
    authReady,
    serverTrusted: authReady,
    serverUserIdPreview: authReady
      ? maskServerUserIdPreview(input.serverUserIdPreview as string)
      : null,
    testOnly: input.testOnly,
    mockOnly: input.mockOnly,
    blockedReasons: input.blockedReasons,
    warnings: input.warnings,
    summary: authReady
      ? "Server-only auth context preview is authenticated and safe to expose, but it remains preview-only."
      : "Server-only auth context preview is blocked until trusted authenticated server context is supplied.",
  };
}

export function createBlockedReaderSyncAuthContextPreview(
  reason?: string | null,
): ReaderSyncAuthContextPreview {
  return buildBlockedPreview(reason);
}

export function validateReaderSyncAuthContextPreview(
  input: ReaderSyncAuthContextPreviewInput | null | undefined,
): ReaderSyncAuthContextPreview {
  if (!isRecord(input)) {
    return buildBlockedPreview(
      "Reader sync auth context input must be a plain object.",
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

  if (input.source !== undefined) {
    if (
      input.source !== "blocked-by-default" &&
      input.source !== "trusted-server-context"
    ) {
      pushUnique(
        blockedReasons,
        "INVALID_SOURCE: source must be blocked-by-default or trusted-server-context when provided.",
      );
    }
  }

  if (input.authenticated !== undefined && !isBoolean(input.authenticated)) {
    pushUnique(
      blockedReasons,
      "INVALID_AUTHENTICATED_FLAG: authenticated must be a boolean when provided.",
    );
  }

  if (input.serverTrusted !== undefined && !isBoolean(input.serverTrusted)) {
    pushUnique(
      blockedReasons,
      "INVALID_SERVER_TRUSTED_FLAG: serverTrusted must be a boolean when provided.",
    );
  }

  if (
    input.serverUserIdPreview !== undefined &&
    input.serverUserIdPreview !== null &&
    !isNonEmptyString(input.serverUserIdPreview)
  ) {
    pushUnique(
      blockedReasons,
      "INVALID_SERVER_USER_ID_PREVIEW: serverUserIdPreview must be a non-empty string when provided.",
    );
  }

  if (input.testOnly !== undefined && !isBoolean(input.testOnly)) {
    pushUnique(
      blockedReasons,
      "INVALID_TEST_ONLY_FLAG: testOnly must be a boolean when provided.",
    );
  }

  if (input.mockOnly !== undefined && !isBoolean(input.mockOnly)) {
    pushUnique(
      blockedReasons,
      "INVALID_MOCK_ONLY_FLAG: mockOnly must be a boolean when provided.",
    );
  }

  const authenticated = input.authenticated === true;
  const serverTrusted = input.serverTrusted === true;
  const serverUserIdPreview = isNonEmptyString(input.serverUserIdPreview)
    ? input.serverUserIdPreview.trim()
    : null;
  const testOnly = input.testOnly === true;
  const mockOnly = input.mockOnly === true;

  if (authenticated !== true) {
    pushUnique(
      blockedReasons,
      "AUTHENTICATED_REQUIRED: authenticated must be true for an authenticated preview.",
    );
  }

  if (serverTrusted !== true) {
    pushUnique(
      blockedReasons,
      "SERVER_TRUSTED_REQUIRED: serverTrusted must be true for a trusted preview.",
    );
  }

  if (serverUserIdPreview === null) {
    pushUnique(
      blockedReasons,
      "SERVER_USER_ID_PREVIEW_REQUIRED: a serverUserIdPreview string is required for a trusted preview.",
    );
  }

  if (blockedReasons.length > 0) {
    pushUnique(
      warnings,
      "Auth context preview validation blocked before any authenticated preview could be built.",
    );
    return buildBlockedPreview(
      "Reader sync auth context preview was rejected before any trusted server summary could be built.",
      blockedReasons,
      warnings,
    );
  }

  return buildPreview({
    source: "trusted-server-context",
    authenticated,
    serverTrusted,
    serverUserIdPreview,
    testOnly,
    mockOnly,
    blockedReasons,
    warnings,
  });
}

export function createReaderSyncAuthContextPreview(
  input?: ReaderSyncAuthContextPreviewInput | null,
): ReaderSyncAuthContextPreview {
  return validateReaderSyncAuthContextPreview(input);
}
