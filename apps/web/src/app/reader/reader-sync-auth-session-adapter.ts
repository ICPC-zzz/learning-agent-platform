"use strict";

export type ReaderSyncAuthSessionAdapterSource =
  | "blocked-by-default"
  | "test-only-mock";

export type ReaderSyncAuthSessionAdapterStatus = "blocked" | "preview";

export interface ReaderSyncAuthSessionSnapshotInput {
  previewOnly?: true;
  source?: ReaderSyncAuthSessionAdapterSource;
  hasAuthenticatedUser?: boolean;
  authSessionVerified?: boolean;
  serverUserId?: string | null;
  canAccessBook?: boolean;
  canAccessChapter?: boolean;
  canWriteProgress?: boolean;
  explicitUserAuthorization?: boolean;
  sessionIdPreview?: string | null;
  testOnly?: boolean;
  mockOnly?: boolean;
  [key: string]: unknown;
}

export interface ReaderSyncAuthSessionAdapterCapabilities {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  authConnected: false;
  readsCookies: false;
  readsHeaders: false;
  readsSession: false;
  trustsClientUserId: false;
  hasAuthenticatedUser: boolean;
  authSessionVerified: boolean;
  serverUserIdAvailable: boolean;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  explicitUserAuthorization: boolean;
  testOnly: boolean;
  mockOnly: boolean;
}

export interface ReaderSyncAuthSessionSnapshot {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: ReaderSyncAuthSessionAdapterSource;
  status: ReaderSyncAuthSessionAdapterStatus;
  authConnected: false;
  readsCookies: false;
  readsHeaders: false;
  readsSession: false;
  trustsClientUserId: false;
  hasAuthenticatedUser: boolean;
  authSessionVerified: boolean;
  serverUserId: string | null;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  explicitUserAuthorization: boolean;
  sessionIdPreview: string | null;
  testOnly: boolean;
  mockOnly: boolean;
}

export interface ReaderSyncAuthSessionAdapterPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: ReaderSyncAuthSessionAdapterSource;
  status: ReaderSyncAuthSessionAdapterStatus;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
  capabilities: ReaderSyncAuthSessionAdapterCapabilities;
  snapshot: ReaderSyncAuthSessionSnapshot;
}

export interface ReaderSyncAuthSessionAdapter {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: ReaderSyncAuthSessionAdapterSource;
  preview: ReaderSyncAuthSessionAdapterPreview;
  getPreview(): ReaderSyncAuthSessionAdapterPreview;
  getSnapshot(): ReaderSyncAuthSessionSnapshot;
}

const ALLOWED_INPUT_KEYS = [
  "previewOnly",
  "source",
  "hasAuthenticatedUser",
  "authSessionVerified",
  "serverUserId",
  "canAccessBook",
  "canAccessChapter",
  "canWriteProgress",
  "explicitUserAuthorization",
  "sessionIdPreview",
  "testOnly",
  "mockOnly",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "userId",
  "role",
  "auditId",
  "authToken",
  "token",
  "cookie",
  "cookies",
  "headers",
  "rawHeaders",
  "session",
  "rawSession",
  "metadata",
  "rawLocalStorage",
  "DATABASE_URL",
  "db",
  "prisma",
  "fetch",
  "process",
  "env",
  "__proto__",
  "constructor",
  "prototype",
] as const;

const BASE_WARNINGS = [
  "Reader sync auth/session adapter is preview-only and never connects a real provider.",
  "No cookies, headers, session storage, or client userId are trusted here.",
  "The adapter only exposes a blocked preview or a test-only mock preview.",
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

function isAllowedSource(value: unknown): value is ReaderSyncAuthSessionAdapterSource {
  return value === "blocked-by-default" || value === "test-only-mock";
}

function buildCapabilities(
  snapshot: ReaderSyncAuthSessionSnapshot,
): ReaderSyncAuthSessionAdapterCapabilities {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    authConnected: false,
    readsCookies: false,
    readsHeaders: false,
    readsSession: false,
    trustsClientUserId: false,
    hasAuthenticatedUser: snapshot.hasAuthenticatedUser,
    authSessionVerified: snapshot.authSessionVerified,
    serverUserIdAvailable: snapshot.serverUserId !== null,
    canAccessBook: snapshot.canAccessBook,
    canAccessChapter: snapshot.canAccessChapter,
    canWriteProgress: snapshot.canWriteProgress,
    explicitUserAuthorization: snapshot.explicitUserAuthorization,
    testOnly: snapshot.testOnly,
    mockOnly: snapshot.mockOnly,
  };
}

function buildPreview(
  snapshot: ReaderSyncAuthSessionSnapshot,
  blockedReasons: string[],
  warnings: string[],
  summary: string,
): ReaderSyncAuthSessionAdapterPreview {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: snapshot.source,
    status: snapshot.status,
    blockedReasons,
    warnings,
    summary,
    capabilities: buildCapabilities(snapshot),
    snapshot,
  };
}

function buildAdapter(preview: ReaderSyncAuthSessionAdapterPreview): ReaderSyncAuthSessionAdapter {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: preview.source,
    preview,
    getPreview(): ReaderSyncAuthSessionAdapterPreview {
      return preview;
    },
    getSnapshot(): ReaderSyncAuthSessionSnapshot {
      return preview.snapshot;
    },
  };
}

function appendForbiddenKeyWarnings(
  input: Record<string, unknown>,
  blockedReasons: string[],
  label: string,
): void {
  if (hasUnsafePrototype(input)) {
    pushUnique(
      blockedReasons,
      `UNSAFE_PROTOTYPE_REJECTED: ${label} rejected an unsafe prototype before validation.`,
    );
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `FORBIDDEN_FIELD: ${label} contains forbidden field: ${key}.`,
      );
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      pushUnique(
        blockedReasons,
        `UNKNOWN_FIELD: ${label} contains unknown field: ${key}.`,
      );
    }
  }
}

function normalizeSnapshotInput(
  input: ReaderSyncAuthSessionSnapshotInput | null | undefined,
): {
  snapshot: ReaderSyncAuthSessionSnapshot;
  blockedReasons: string[];
  warnings: string[];
  status: ReaderSyncAuthSessionAdapterStatus;
} {
  const warnings = [...BASE_WARNINGS];
  const blockedReasons: string[] = [];

  const blockedSnapshot: ReaderSyncAuthSessionSnapshot = {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "blocked-by-default",
    status: "blocked",
    authConnected: false,
    readsCookies: false,
    readsHeaders: false,
    readsSession: false,
    trustsClientUserId: false,
    hasAuthenticatedUser: false,
    authSessionVerified: false,
    serverUserId: null,
    canAccessBook: false,
    canAccessChapter: false,
    canWriteProgress: false,
    explicitUserAuthorization: false,
    sessionIdPreview: null,
    testOnly: false,
    mockOnly: false,
  };

  if (!isRecord(input)) {
    pushUnique(blockedReasons, "INVALID_INPUT: auth session snapshot input must be a plain object.");
    pushUnique(
      warnings,
      "The adapter stayed blocked because no plain auth/session snapshot input was provided.",
    );
    return {
      snapshot: blockedSnapshot,
      blockedReasons,
      warnings,
      status: "blocked",
    };
  }

  appendForbiddenKeyWarnings(input, blockedReasons, "authSessionSnapshot");

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(blockedReasons, "INVALID_PREVIEW_ONLY_FLAG: previewOnly must be true when provided.");
  }

  if (input.source !== undefined && !isAllowedSource(input.source)) {
    pushUnique(blockedReasons, "INVALID_SOURCE: source must be blocked-by-default or test-only-mock.");
  }

  if (input.hasAuthenticatedUser !== undefined && !isBoolean(input.hasAuthenticatedUser)) {
    pushUnique(
      blockedReasons,
      "INVALID_HAS_AUTHENTICATED_USER: hasAuthenticatedUser must be boolean when provided.",
    );
  }

  if (input.authSessionVerified !== undefined && !isBoolean(input.authSessionVerified)) {
    pushUnique(
      blockedReasons,
      "INVALID_AUTH_SESSION_VERIFIED: authSessionVerified must be boolean when provided.",
    );
  }

  if (
    input.serverUserId !== undefined &&
    input.serverUserId !== null &&
    !isNonEmptyString(input.serverUserId)
  ) {
    pushUnique(
      blockedReasons,
      "INVALID_SERVER_USER_ID: serverUserId must be a non-empty string when provided.",
    );
  }

  if (input.canAccessBook !== undefined && !isBoolean(input.canAccessBook)) {
    pushUnique(blockedReasons, "INVALID_CAN_ACCESS_BOOK: canAccessBook must be boolean when provided.");
  }

  if (input.canAccessChapter !== undefined && !isBoolean(input.canAccessChapter)) {
    pushUnique(
      blockedReasons,
      "INVALID_CAN_ACCESS_CHAPTER: canAccessChapter must be boolean when provided.",
    );
  }

  if (input.canWriteProgress !== undefined && !isBoolean(input.canWriteProgress)) {
    pushUnique(
      blockedReasons,
      "INVALID_CAN_WRITE_PROGRESS: canWriteProgress must be boolean when provided.",
    );
  }

  if (
    input.explicitUserAuthorization !== undefined &&
    !isBoolean(input.explicitUserAuthorization)
  ) {
    pushUnique(
      blockedReasons,
      "INVALID_EXPLICIT_USER_AUTHORIZATION: explicitUserAuthorization must be boolean when provided.",
    );
  }

  if (
    input.sessionIdPreview !== undefined &&
    input.sessionIdPreview !== null &&
    !isNonEmptyString(input.sessionIdPreview)
  ) {
    pushUnique(
      blockedReasons,
      "INVALID_SESSION_ID_PREVIEW: sessionIdPreview must be a non-empty string when provided.",
    );
  }

  if (input.testOnly !== undefined && !isBoolean(input.testOnly)) {
    pushUnique(blockedReasons, "INVALID_TEST_ONLY: testOnly must be boolean when provided.");
  }

  if (input.mockOnly !== undefined && !isBoolean(input.mockOnly)) {
    pushUnique(blockedReasons, "INVALID_MOCK_ONLY: mockOnly must be boolean when provided.");
  }

  const hasAuthenticatedUser = input.hasAuthenticatedUser === true;
  const authSessionVerified = input.authSessionVerified === true;
  const serverUserId = isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : null;
  const canAccessBook = input.canAccessBook === true;
  const canAccessChapter = input.canAccessChapter === true;
  const canWriteProgress = input.canWriteProgress === true;
  const explicitUserAuthorization = input.explicitUserAuthorization === true;
  const testOnly = input.testOnly === true;
  const mockOnly = input.mockOnly === true;
  const source: ReaderSyncAuthSessionAdapterSource =
    isAllowedSource(input.source)
      ? input.source
      : testOnly || mockOnly
        ? "test-only-mock"
        : "blocked-by-default";
  const sessionIdPreview = isNonEmptyString(input.sessionIdPreview)
    ? input.sessionIdPreview.trim()
    : null;

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    pushUnique(warnings, "previewOnly must stay true in the auth/session preview contract.");
  }

  if (serverUserId === null) {
    pushUnique(blockedReasons, "SERVER_USER_ID_REQUIRED: serverUserId must come from trusted server context.");
  }

  if (hasAuthenticatedUser !== true) {
    pushUnique(blockedReasons, "HAS_AUTHENTICATED_USER_REQUIRED: hasAuthenticatedUser must be true.");
  }

  if (authSessionVerified !== true) {
    pushUnique(blockedReasons, "AUTH_SESSION_VERIFIED_REQUIRED: authSessionVerified must be true.");
  }

  if (canAccessBook !== true) {
    pushUnique(blockedReasons, "CAN_ACCESS_BOOK_REQUIRED: canAccessBook must be true.");
  }

  if (canAccessChapter !== true) {
    pushUnique(blockedReasons, "CAN_ACCESS_CHAPTER_REQUIRED: canAccessChapter must be true.");
  }

  if (canWriteProgress !== true) {
    pushUnique(blockedReasons, "CAN_WRITE_PROGRESS_REQUIRED: canWriteProgress must be true.");
  }

  if (explicitUserAuthorization !== true) {
    pushUnique(
      blockedReasons,
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: explicitUserAuthorization must be true.",
    );
  }

  if (testOnly !== true) {
    pushUnique(blockedReasons, "TEST_ONLY_REQUIRED: testOnly must be true for the mock adapter preview.");
  }

  if (mockOnly !== true) {
    pushUnique(blockedReasons, "MOCK_ONLY_REQUIRED: mockOnly must be true for the mock adapter preview.");
  }

  const canExposePreview =
    blockedReasons.length === 0 &&
    source === "test-only-mock" &&
    testOnly === true &&
    mockOnly === true;

  if (canExposePreview) {
    pushUnique(
      warnings,
      "A test-only mock auth/session snapshot is available, but it still does not connect a real provider.",
    );
  } else {
    pushUnique(
      warnings,
      "Auth/session snapshot remains blocked until the trusted server-side identity fields are supplied.",
    );
  }

  const snapshot: ReaderSyncAuthSessionSnapshot = {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source,
    status: canExposePreview ? "preview" : "blocked",
    authConnected: false,
    readsCookies: false,
    readsHeaders: false,
    readsSession: false,
    trustsClientUserId: false,
    hasAuthenticatedUser,
    authSessionVerified,
    serverUserId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    explicitUserAuthorization,
    sessionIdPreview,
    testOnly,
    mockOnly,
  };

  return {
    snapshot,
    blockedReasons,
    warnings,
    status: snapshot.status,
  };
}

export function validateReaderSyncAuthSessionSnapshot(
  input: ReaderSyncAuthSessionSnapshotInput | null | undefined,
): ReaderSyncAuthSessionAdapterPreview {
  const normalized = normalizeSnapshotInput(input);
  const summary =
    normalized.status === "preview"
      ? "Mock auth/session snapshot is ready for test-only preview use, but it still does not connect a real provider."
      : "Auth/session snapshot is blocked and stays disconnected from any real provider.";

  return buildPreview(normalized.snapshot, normalized.blockedReasons, normalized.warnings, summary);
}

export function createBlockedReaderSyncAuthSessionAdapter(): ReaderSyncAuthSessionAdapter {
  return buildAdapter(
    validateReaderSyncAuthSessionSnapshot({
      previewOnly: true,
      source: "blocked-by-default",
      hasAuthenticatedUser: false,
      authSessionVerified: false,
      serverUserId: null,
      canAccessBook: false,
      canAccessChapter: false,
      canWriteProgress: false,
      explicitUserAuthorization: false,
      sessionIdPreview: null,
      testOnly: false,
      mockOnly: false,
    }),
  );
}

export function createMockReaderSyncAuthSessionAdapterForTest(
  input?: ReaderSyncAuthSessionSnapshotInput | null,
): ReaderSyncAuthSessionAdapter {
  const preview = validateReaderSyncAuthSessionSnapshot(
    input ?? {
      previewOnly: true,
      source: "test-only-mock",
      hasAuthenticatedUser: true,
      authSessionVerified: true,
      serverUserId: "reader-auth-session-test-user",
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
      explicitUserAuthorization: true,
      sessionIdPreview: "test-only-mock-session-preview",
      testOnly: true,
      mockOnly: true,
    },
  );

  return buildAdapter(preview);
}
