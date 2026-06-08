// Node --test imports this file directly, so keep the explicit .ts suffix here.
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderProgressSyncDecisionPayload, ReaderProgressSyncDecisionNormalizedPayload, ReaderProgressSyncDecisionResult, ReaderProgressSyncDecisionServerContext } from "./reader-progress-sync-decision.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { buildReaderProgressSyncDecision } from "./reader-progress-sync-decision.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { buildReaderProgressSyncServiceResult } from "./reader-progress-sync-service.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { createBlockedReaderSyncIdempotencyPreview, createReaderSyncIdempotencyKeyPreview } from "./reader-sync-idempotency-key.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncPersistentAdapterCapabilities, ReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncPermissionGateInput, ReaderSyncPermissionGatePreview } from "./reader-sync-permission-gate.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { validateReaderSyncPermissionGate } from "./reader-sync-permission-gate.ts";

export type ReaderSyncRealServerActionCoreStatus =
  | "blocked"
  | "test_only_fake_preview";

export interface ReaderSyncRealServerActionAuthSessionStubPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "trusted-server-stub";
  verified: boolean;
  sessionIdPreview: string | null;
}

export interface ReaderSyncRealServerActionSafeServerContextPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "trusted-server-stub";
  hasAuthenticatedUser: boolean;
  serverUserId: string;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  authSessionStub: ReaderSyncRealServerActionAuthSessionStubPreview;
  decisionServerContextPreview: ReaderProgressSyncDecisionServerContext;
}

export interface ReaderSyncRealServerActionLocalProgressPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "client-preview";
  actionDraft: true;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  idempotencyKeyPreview: string | null;
  requestedAt: string | null;
  currentOffset?: number | null;
  currentCfi?: string | null;
  progressSource?: string | null;
  explicitUserAuthorization: boolean;
}

export interface ReaderSyncRealServerActionGuardPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  enabled: false;
  disabledByDefault: true;
  canUseTestOnlyFakePath: boolean;
  explicitUserAuthorization: boolean;
  realSyncEnabled: boolean;
  dbIntegrationAllowed: boolean;
  authSessionVerified: boolean;
  requiresAuthSession: true;
  requiresExplicitUserAuthorization: true;
  permissionGateReady: boolean;
  permissionGateBlockedReasons: string[];
  repositoryAdapterReady: boolean;
  blockedReasons: string[];
  warnings: string[];
  nextSafeSteps: string[];
  summary: string;
}

export interface ReaderSyncRealServerActionRepositoryAdapterPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "injected-fake" | "blocked";
  accepted: boolean;
  mode: ReaderSyncPersistentAdapterCapabilities["mode"] | "blocked";
  capabilities: ReaderSyncPersistentAdapterCapabilities | null;
  blockedReasons: string[];
  warnings: string[];
  summary: string;
}

export interface ReaderSyncRealServerActionTestOnlyExecutionPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "blocked" | "test-only-fake";
  attempted: boolean;
  executed: boolean;
  success: boolean;
  writesDatabase: false;
  callsRepository: boolean;
  status:
    | "blocked"
    | "preview"
    | "conflict"
    | "invalid"
    | "noop"
    | "ready_preview"
    | "absent";
  message: string;
  decisionPreview: ReaderProgressSyncDecisionResult | null;
  serviceResultPreview: ReaderProgressSyncServiceResult | null;
  blockedReasons: string[];
  warnings: string[];
}

export interface ReaderSyncRealServerActionCoreInput {
  localProgress?: unknown;
  serverContext?: unknown;
  permissionGate?: ReaderSyncPermissionGateInput | null;
  explicitUserAuthorization?: boolean;
  realSyncEnabled?: boolean;
  dbIntegrationAllowed?: boolean;
  authSessionVerified?: boolean;
  repositoryAdapter?: ReaderSyncPersistentRepositoryAdapter | null;
}

export interface ReaderSyncRealServerActionCoreResult {
  previewOnly: true;
  implemented: false;
  actionDraft: true;
  enabled: false;
  disabledByDefault: true;
  success: false;
  safeToExposeToClient: true;
  status: ReaderSyncRealServerActionCoreStatus;
  source: "blocked" | "test-only-fake";
  message: string;
  requiresAuthSession: true;
  requiresExplicitUserAuthorization: true;
  writesDatabase: false;
  callsRepository: false;
  blockedReasons: string[];
  warnings: string[];
  nextSafeSteps: string[];
  guardPreview: ReaderSyncRealServerActionGuardPreview;
  localProgressPreview: ReaderSyncRealServerActionLocalProgressPreview | null;
  serverContextPreview: ReaderSyncRealServerActionSafeServerContextPreview | null;
  repositoryAdapterPreview: ReaderSyncRealServerActionRepositoryAdapterPreview;
  permissionGatePreview: ReaderSyncPermissionGatePreview;
  idempotencyPreview: ReaderSyncIdempotencyKeyPreview;
  decisionPreview: ReaderProgressSyncDecisionResult | null;
  serviceResultPreview: ReaderProgressSyncServiceResult | null;
  testOnlyExecutionPreview: ReaderSyncRealServerActionTestOnlyExecutionPreview;
}

const ALLOWED_LOCAL_PROGRESS_KEYS = [
  "bookId",
  "chapterId",
  "progressRatio",
  "idempotencyKeyPreview",
  "requestedAt",
  "currentOffset",
  "currentCfi",
  "source",
] as const;

const ALLOWED_SERVER_CONTEXT_KEYS = [
  "serverUserId",
  "hasAuthenticatedUser",
  "canAccessBook",
  "canAccessChapter",
  "canWriteProgress",
  "authSessionStub",
] as const;

const ALLOWED_AUTH_SESSION_STUB_KEYS = [
  "verified",
  "sessionSource",
  "sessionIdPreview",
] as const;

const FORBIDDEN_SHARED_KEYS = [
  "userId",
  "role",
  "auditId",
  "serverProgressRatio",
  "rawLocalStorage",
  "rawDbRecord",
  "metadata",
  "token",
  "authToken",
  "cookie",
  "cookies",
  "session",
  "rawSession",
  "headers",
  "rawHeaders",
  "secret",
  "password",
  "apiKey",
  "apikey",
  "accessToken",
  "refreshToken",
  "db",
  "prisma",
  "PrismaClient",
  "repository",
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
  "Real reader sync server action core is preview-only and disabled by default.",
  "No real auth/session, PrismaClient import, database URL access, network request, or DB write is performed here.",
  "Any repository adapter must be injected and fake/test-only to be exercised in this draft.",
] as const;

const NEXT_SAFE_STEPS = [
  "Keep the core disabled-by-default until a separate authorized server action wrapper exists.",
  "Keep auth/session as a trusted server stub and do not wire any real cookie/header/session reader here.",
  "Inject fake repository adapters only in tests or other explicit test-only harnesses.",
  "Add a separate authorization review before any future runtime route or UI wiring is considered.",
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function hasUnsafePrototype(value: Record<string, unknown>): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function appendForbiddenKeyWarnings(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
  blockers: Array<{ code: string; message: string }>,
  label: string,
): void {
  if (hasUnsafePrototype(input)) {
    blockers.push({
      code: "UNSAFE_PROTOTYPE_REJECTED",
      message: `${label} rejected an unsafe prototype before validation.`,
    });
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_SHARED_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `${label} contains forbidden field: ${key}.`,
      });
      continue;
    }

    if (!(allowedKeys as readonly string[]).includes(key)) {
      blockers.push({
        code: "UNKNOWN_FIELD",
        message: `${label} contains unknown field: ${key}.`,
      });
    }
  }
}

function normalizeLocalProgress(
  input: unknown,
  explicitUserAuthorization: boolean,
): {
  preview: ReaderSyncRealServerActionLocalProgressPreview | null;
  payload: ReaderProgressSyncDecisionNormalizedPayload | null;
  blockers: string[];
  warnings: string[];
} {
  const blockers: Array<{ code: string; message: string }> = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "localProgress must be a plain object.",
    });
    return {
      preview: null,
      payload: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  appendForbiddenKeyWarnings(
    input,
    ALLOWED_LOCAL_PROGRESS_KEYS,
    blockers,
    "localProgress",
  );

  const bookId = isNonEmptyString(input.bookId) ? input.bookId.trim() : null;
  const chapterId = isNonEmptyString(input.chapterId) ? input.chapterId.trim() : null;
  const progressRatio = isFiniteRatio(input.progressRatio) ? input.progressRatio : null;
  const currentOffset =
    input.currentOffset === undefined || input.currentOffset === null
      ? null
      : typeof input.currentOffset === "number" &&
          Number.isFinite(input.currentOffset) &&
          input.currentOffset >= 0
        ? input.currentOffset
        : undefined;
  const currentCfi =
    input.currentCfi === undefined || input.currentCfi === null
      ? null
      : typeof input.currentCfi === "string" && input.currentCfi.trim().length > 0
        ? input.currentCfi.trim()
        : undefined;
  const progressSource =
    input.source === undefined || input.source === null
      ? null
      : typeof input.source === "string" && input.source.trim().length > 0
        ? input.source.trim()
        : undefined;
  const requestedAt =
    input.requestedAt === undefined || input.requestedAt === null
      ? null
      : typeof input.requestedAt === "string" && input.requestedAt.trim().length > 0
        ? input.requestedAt.trim()
        : undefined;

  if (bookId === null) {
    blockers.push({
      code: "INVALID_BOOK_ID",
      message: "bookId must be a non-empty string.",
    });
  }

  if (chapterId === null) {
    blockers.push({
      code: "INVALID_CHAPTER_ID",
      message: "chapterId must be a non-empty string.",
    });
  }

  if (progressRatio === null) {
    blockers.push({
      code: "INVALID_PROGRESS_RATIO",
      message: "progressRatio must be a finite number in range [0, 1].",
    });
  }

  if (currentOffset === undefined) {
    blockers.push({
      code: "INVALID_CURRENT_OFFSET",
      message: "currentOffset must be a finite non-negative number when provided.",
    });
  }

  if (currentCfi === undefined) {
    blockers.push({
      code: "INVALID_CURRENT_CFI",
      message: "currentCfi must be a non-empty string when provided.",
    });
  }

  if (progressSource === undefined) {
    blockers.push({
      code: "INVALID_PROGRESS_SOURCE",
      message: "source must be a non-empty string when provided.",
    });
  }

  if (requestedAt === undefined) {
    blockers.push({
      code: "INVALID_REQUESTED_AT",
      message: "requestedAt must be a non-empty string when provided.",
    });
  }

  if (blockers.length > 0 || bookId === null || chapterId === null || progressRatio === null) {
    pushUnique(
      warnings,
      "localProgress normalization is blocked before any decision or service preview can run.",
    );
    return {
      preview: null,
      payload: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  if (
    input.idempotencyKeyPreview !== undefined &&
    input.idempotencyKeyPreview !== null &&
    typeof input.idempotencyKeyPreview !== "string"
  ) {
    blockers.push({
      code: "INVALID_IDEMPOTENCY_KEY_PREVIEW",
      message: "idempotencyKeyPreview must be a string when provided.",
    });
  }

  if (blockers.length > 0) {
    pushUnique(
      warnings,
      "localProgress normalization rejected an unsafe idempotencyKeyPreview value.",
    );
    return {
      preview: null,
      payload: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  if (typeof input.idempotencyKeyPreview === "string") {
    pushUnique(
      warnings,
      "localProgress.idempotencyKeyPreview is preview metadata only and will be replaced by the server-generated v1 idempotency key.",
    );
  }

  return {
    preview: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: "client-preview",
      actionDraft: true,
      bookId,
      chapterId,
      progressRatio,
      idempotencyKeyPreview: null,
      requestedAt: requestedAt ?? null,
      currentOffset,
      currentCfi,
      progressSource,
      explicitUserAuthorization: explicitUserAuthorization === true,
    },
    payload: {
      bookId,
      chapterId,
      progressRatio,
    },
    blockers: [],
    warnings,
  };
}

function normalizeAuthSessionStub(
  input: unknown,
): {
  preview: ReaderSyncRealServerActionAuthSessionStubPreview | null;
  blockers: string[];
  warnings: string[];
} {
  const blockers: Array<{ code: string; message: string }> = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_AUTH_SESSION_STUB",
      message: "authSessionStub must be a plain object.",
    });
    return {
      preview: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  appendForbiddenKeyWarnings(
    input,
    ALLOWED_AUTH_SESSION_STUB_KEYS,
    blockers,
    "authSessionStub",
  );

  if (input.previewOnly !== undefined && input.previewOnly !== true) {
    blockers.push({
      code: "INVALID_PREVIEW_ONLY_FLAG",
      message: "authSessionStub.previewOnly must be true when provided.",
    });
  }

  if (input.safeToExposeToClient !== undefined && input.safeToExposeToClient !== true) {
    blockers.push({
      code: "INVALID_SAFE_TO_EXPOSE_FLAG",
      message: "authSessionStub.safeToExposeToClient must be true when provided.",
    });
  }

  if (input.sessionSource !== undefined && input.sessionSource !== "trusted-server-stub") {
    blockers.push({
      code: "INVALID_SESSION_SOURCE",
      message: "authSessionStub.sessionSource must be trusted-server-stub when provided.",
    });
  }

  if (input.verified !== undefined && !isBoolean(input.verified)) {
    blockers.push({
      code: "INVALID_VERIFIED_FLAG",
      message: "authSessionStub.verified must be a boolean when provided.",
    });
  }

  if (
    input.sessionIdPreview !== undefined &&
    input.sessionIdPreview !== null &&
    typeof input.sessionIdPreview !== "string"
  ) {
    blockers.push({
      code: "INVALID_SESSION_ID_PREVIEW",
      message: "authSessionStub.sessionIdPreview must be a string when provided.",
    });
  }

  if (blockers.length > 0) {
    pushUnique(
      warnings,
      "authSessionStub normalization is blocked before any decision or service preview can run.",
    );
    return {
      preview: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  return {
    preview: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: "trusted-server-stub",
      verified: input.verified === true,
      sessionIdPreview:
        typeof input.sessionIdPreview === "string" ? input.sessionIdPreview.trim() : null,
    },
    blockers: [],
    warnings,
  };
}

function normalizeServerContext(
  input: unknown,
  authSessionVerified: boolean,
): {
  preview: ReaderSyncRealServerActionSafeServerContextPreview | null;
  decisionServerContext: ReaderProgressSyncDecisionServerContext | null;
  blockers: string[];
  warnings: string[];
} {
  const blockers: Array<{ code: string; message: string }> = [];
  const warnings = [...BASE_WARNINGS];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_SERVER_CONTEXT",
      message: "serverContext must be a plain object.",
    });
    return {
      preview: null,
      decisionServerContext: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  appendForbiddenKeyWarnings(
    input,
    ALLOWED_SERVER_CONTEXT_KEYS,
    blockers,
    "serverContext",
  );

  const serverUserId = isNonEmptyString(input.serverUserId) ? input.serverUserId.trim() : null;
  const hasAuthenticatedUser = isBoolean(input.hasAuthenticatedUser) ? input.hasAuthenticatedUser : null;
  const canAccessBook = isBoolean(input.canAccessBook) ? input.canAccessBook : null;
  const canAccessChapter = isBoolean(input.canAccessChapter) ? input.canAccessChapter : null;
  const canWriteProgress = isBoolean(input.canWriteProgress) ? input.canWriteProgress : null;

  if (serverUserId === null) {
    blockers.push({
      code: "SERVER_USER_ID_REQUIRED",
      message: "serverUserId must be a non-empty string from trusted server context.",
    });
  }

  if (hasAuthenticatedUser === null) {
    blockers.push({
      code: "HAS_AUTHENTICATED_USER_REQUIRED",
      message: "hasAuthenticatedUser must be a boolean when provided.",
    });
  }

  if (canAccessBook === null) {
    blockers.push({
      code: "CAN_ACCESS_BOOK_REQUIRED",
      message: "canAccessBook must be a boolean when provided.",
    });
  }

  if (canAccessChapter === null) {
    blockers.push({
      code: "CAN_ACCESS_CHAPTER_REQUIRED",
      message: "canAccessChapter must be a boolean when provided.",
    });
  }

  if (canWriteProgress === null) {
    blockers.push({
      code: "CAN_WRITE_PROGRESS_REQUIRED",
      message: "canWriteProgress must be a boolean when provided.",
    });
  }

  if (!isRecord(input.authSessionStub)) {
    blockers.push({
      code: "AUTH_SESSION_STUB_REQUIRED",
      message: "serverContext.authSessionStub must be a plain object.",
    });
  }

  const authSessionStubResult = normalizeAuthSessionStub(input.authSessionStub);
  if (authSessionStubResult.preview === null) {
    for (const reason of authSessionStubResult.blockers) {
      blockers.push({
        code: "AUTH_SESSION_STUB_INVALID",
        message: reason,
      });
    }
  }

  if (authSessionVerified !== true) {
    blockers.push({
      code: "AUTH_SESSION_VERIFIED_REQUIRED",
      message: "authSessionVerified must be true before any real-sync entry is considered.",
    });
  }

  if (authSessionStubResult.preview !== null && authSessionStubResult.preview.verified !== true) {
    blockers.push({
      code: "AUTH_SESSION_STUB_UNVERIFIED",
      message: "authSessionStub.verified must be true in the trusted server stub.",
    });
  }

  if (
    blockers.length > 0 ||
    serverUserId === null ||
    hasAuthenticatedUser === null ||
    canAccessBook === null ||
    canAccessChapter === null ||
    canWriteProgress === null ||
    authSessionStubResult.preview === null
  ) {
    pushUnique(
      warnings,
      "serverContext normalization is blocked before any decision or service preview can run.",
    );
    return {
      preview: null,
      decisionServerContext: null,
      blockers: blockers.map(function (blocker) {
        return `${blocker.code}: ${blocker.message}`;
      }),
      warnings,
    };
  }

  const decisionServerContext: ReaderProgressSyncDecisionServerContext = {
    hasAuthenticatedUser,
    serverUserId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
  };

  return {
    preview: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: "trusted-server-stub",
      hasAuthenticatedUser,
      serverUserId,
      canAccessBook,
      canAccessChapter,
      canWriteProgress,
      authSessionStub: authSessionStubResult.preview,
      decisionServerContextPreview: decisionServerContext,
    },
    decisionServerContext,
    blockers: [],
    warnings,
  };
}

function buildIdempotencyKeyPreview(
  localProgressPreview: ReaderSyncRealServerActionLocalProgressPreview | null,
  serverContextPreview: ReaderSyncRealServerActionSafeServerContextPreview | null,
): ReaderSyncIdempotencyKeyPreview {
  if (localProgressPreview === null || serverContextPreview === null) {
    return createBlockedReaderSyncIdempotencyPreview(
      "IDEMPOTENCY_CONTEXT_REQUIRED: trusted local progress and server context are required before idempotency can be derived.",
    );
  }

  return createReaderSyncIdempotencyKeyPreview({
    previewOnly: true,
    serverUserId: serverContextPreview.serverUserId,
    bookId: localProgressPreview.bookId,
    chapterId: localProgressPreview.chapterId,
    progressRatio: localProgressPreview.progressRatio,
    source: localProgressPreview.progressSource ?? undefined,
    requestedAt: localProgressPreview.requestedAt ?? undefined,
  });
}

function normalizeRepositoryAdapter(
  input: unknown,
): {
  preview: ReaderSyncRealServerActionRepositoryAdapterPreview;
  adapter: ReaderSyncPersistentRepositoryAdapter | null;
  blockers: string[];
  warnings: string[];
} {
  const warnings = [...BASE_WARNINGS];
  const blockers: string[] = [];

  function buildCapabilitiesPreview(
    capabilities: ReaderSyncPersistentAdapterCapabilities,
  ): ReaderSyncPersistentAdapterCapabilities {
    return {
      previewOnly: true,
      implemented: false,
      disabled: capabilities.disabled === true,
      allowDatabaseWrite: capabilities.allowDatabaseWrite === true,
      allowRepositoryCall: capabilities.allowRepositoryCall === true,
      writesDatabase: false,
      callsRepository: false,
      safeToExposeToClient: true,
      mode: capabilities.mode,
    };
  }

  if (!isRecord(input) || !isRecord(input.capabilities)) {
    blockers.push("REPOSITORY_ADAPTER_REQUIRED: repositoryAdapter must be a preview-only injected adapter.");
    return {
      preview: {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        source: "blocked",
        accepted: false,
        mode: "blocked",
        capabilities: null,
        blockedReasons: [...blockers],
        warnings,
        summary: "No repository adapter was injected, so the real sync core stays disabled.",
      },
      adapter: null,
      blockers,
      warnings,
    };
  }

  const capabilities = input.capabilities;
  const methodsPresent =
    typeof input.readProgress === "function" &&
    typeof input.previewWriteProgress === "function" &&
    typeof input.previewAudit === "function" &&
    typeof input.previewIdempotency === "function";

  if (capabilities.previewOnly !== true) {
    blockers.push("REPOSITORY_ADAPTER_PREVIEW_ONLY_REQUIRED: repositoryAdapter.capabilities.previewOnly must be true.");
  }
  if (capabilities.implemented !== false) {
    blockers.push("REPOSITORY_ADAPTER_IMPLEMENTED_FLAG_INVALID: repositoryAdapter.capabilities.implemented must be false in this draft.");
  }
  if (capabilities.safeToExposeToClient !== true) {
    blockers.push("REPOSITORY_ADAPTER_SAFE_TO_EXPOSE_REQUIRED: repositoryAdapter.capabilities.safeToExposeToClient must be true.");
  }
  if (capabilities.mode !== "fake") {
    blockers.push("REPOSITORY_ADAPTER_FAKE_MODE_REQUIRED: repositoryAdapter.capabilities.mode must be fake for test-only execution.");
  }
  if (capabilities.writesDatabase !== false) {
    blockers.push("REPOSITORY_ADAPTER_WRITES_DATABASE_INVALID: repositoryAdapter.capabilities.writesDatabase must be false.");
  }
  if (capabilities.callsRepository !== false) {
    blockers.push("REPOSITORY_ADAPTER_CALLS_REPOSITORY_INVALID: repositoryAdapter.capabilities.callsRepository must be false.");
  }
  if (!methodsPresent) {
    blockers.push("REPOSITORY_ADAPTER_METHODS_REQUIRED: repositoryAdapter is missing preview/read methods.");
  }

  if (blockers.length > 0) {
    pushUnique(
      warnings,
      "repositoryAdapter validation blocked the test-only fake path before any preview execution could run.",
    );
    return {
      preview: {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        source: "blocked",
        accepted: false,
        mode: "blocked",
        capabilities: null,
        blockedReasons: [...blockers],
        warnings,
        summary: "Injected repository adapter was rejected by the disabled-by-default real sync core.",
      },
      adapter: null,
      blockers,
      warnings,
    };
  }

  return {
      preview: {
        previewOnly: true,
        implemented: false,
        safeToExposeToClient: true,
        source: "injected-fake",
        accepted: true,
        mode: "fake",
      capabilities: buildCapabilitiesPreview(
        capabilities as unknown as ReaderSyncPersistentAdapterCapabilities,
      ),
        blockedReasons: [],
        warnings,
        summary: "Injected fake repository adapter is available for test-only preview execution.",
      },
    adapter: input as unknown as ReaderSyncPersistentRepositoryAdapter,
    blockers: [],
    warnings,
  };
}

function buildPermissionGatePreview(
  localProgressPreview: ReaderSyncRealServerActionLocalProgressPreview | null,
  serverContextPreview: ReaderSyncRealServerActionSafeServerContextPreview | null,
  explicitUserAuthorization: boolean,
): ReaderSyncPermissionGatePreview {
  return validateReaderSyncPermissionGate({
    previewOnly: true,
    serverUserId: serverContextPreview?.serverUserId ?? undefined,
    bookId: localProgressPreview?.bookId ?? undefined,
    chapterId: localProgressPreview?.chapterId ?? undefined,
    canAccessBook: serverContextPreview?.canAccessBook === true,
    canAccessChapter: serverContextPreview?.canAccessChapter === true,
    canWriteProgress: serverContextPreview?.canWriteProgress === true,
    explicitUserAuthorization: explicitUserAuthorization === true,
  });
}

function buildGuardPreview(
  explicitUserAuthorization: boolean,
  realSyncEnabled: boolean,
  dbIntegrationAllowed: boolean,
  authSessionVerified: boolean,
  serverContextPreview: ReaderSyncRealServerActionSafeServerContextPreview | null,
  repositoryAdapterPreview: ReaderSyncRealServerActionRepositoryAdapterPreview,
  localProgressPreview: ReaderSyncRealServerActionLocalProgressPreview | null,
  permissionGatePreview: ReaderSyncPermissionGatePreview,
): ReaderSyncRealServerActionGuardPreview {
  const blockedReasons: string[] = [];

  if (!explicitUserAuthorization) {
    pushUnique(
      blockedReasons,
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: explicitUserAuthorization must be true.",
    );
  }

  if (!realSyncEnabled) {
    pushUnique(blockedReasons, "REAL_SYNC_ENABLED_REQUIRED: realSyncEnabled must be true.");
  }

  if (!dbIntegrationAllowed) {
    pushUnique(
      blockedReasons,
      "DB_INTEGRATION_ALLOWED_REQUIRED: dbIntegrationAllowed must be true.",
    );
  }

  if (!authSessionVerified) {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_VERIFIED_REQUIRED: authSessionVerified must be true.",
    );
  }

  if (serverContextPreview === null) {
    pushUnique(
      blockedReasons,
      "SERVER_CONTEXT_REQUIRED: trusted serverContext must be valid before the core can proceed.",
    );
  }

  if (repositoryAdapterPreview.accepted !== true) {
    pushUnique(
      blockedReasons,
      "REPOSITORY_ADAPTER_REQUIRED: an injected fake repository adapter must be present.",
    );
  }

  if (localProgressPreview === null) {
    pushUnique(
      blockedReasons,
      "LOCAL_PROGRESS_REQUIRED: localProgress must be valid before the core can proceed.",
    );
  }

  if (permissionGatePreview.allowed !== true) {
    pushUnique(
      blockedReasons,
      "PERMISSION_GATE_REQUIRED: trusted serverUserId, bookId, chapterId, access checks, and explicit authorization must all be satisfied.",
    );
  }

  const canUseTestOnlyFakePath =
    blockedReasons.length === 0 && permissionGatePreview.allowed === true;
  const warnings = [...BASE_WARNINGS];

  if (canUseTestOnlyFakePath) {
    pushUnique(
      warnings,
      "All guard conditions are satisfied, so the draft may exercise a test-only fake adapter once.",
    );
    pushUnique(
      warnings,
      "Permission gate is satisfied, so the preview-only test/dev path may continue.",
    );
  } else {
    pushUnique(
      warnings,
      "One or more guard conditions are blocked, so the core remains disabled-by-default.",
    );
    if (permissionGatePreview.allowed !== true) {
      pushUnique(
        warnings,
        "Permission gate is blocked, so the test-only fake path must not proceed.",
      );
    }
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    enabled: false,
    disabledByDefault: true,
    canUseTestOnlyFakePath,
    explicitUserAuthorization,
    realSyncEnabled,
    dbIntegrationAllowed,
    authSessionVerified,
    requiresAuthSession: true,
    requiresExplicitUserAuthorization: true,
    permissionGateReady: permissionGatePreview.allowed,
    permissionGateBlockedReasons: permissionGatePreview.blockedReasons.slice(),
    repositoryAdapterReady: repositoryAdapterPreview.accepted,
    blockedReasons,
    warnings,
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    summary: canUseTestOnlyFakePath
      ? "Guard preview is satisfied, but the real sync core still stays disabled-by-default and only a fake adapter may be exercised."
      : "Guard preview is blocked, so the real sync core stays disabled-by-default.",
  };
}

function buildBlockedExecutionPreview(
  decisionPreview: ReaderProgressSyncDecisionResult | null,
  serviceResultPreview: ReaderProgressSyncServiceResult | null,
  warnings: string[],
  blockedReasons: string[],
): ReaderSyncRealServerActionTestOnlyExecutionPreview {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "blocked",
    attempted: false,
    executed: false,
    success: false,
    writesDatabase: false,
    callsRepository: false,
    status: decisionPreview?.status ?? "blocked",
    message:
      "Real sync entry remains disabled-by-default, so no test-only fake execution was attempted.",
    decisionPreview,
    serviceResultPreview,
    blockedReasons,
    warnings,
  };
}

function buildTestOnlyExecutionPreview(
  decisionPreview: ReaderProgressSyncDecisionResult,
  serviceResultPreview: ReaderProgressSyncServiceResult,
  warnings: string[],
  blockedReasons: string[],
): ReaderSyncRealServerActionTestOnlyExecutionPreview {
  const persistentAdapterPreview = serviceResultPreview.persistentAdapterPreview;
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "test-only-fake",
    attempted: true,
    executed: persistentAdapterPreview.executed === true,
    success: persistentAdapterPreview.success === true,
    writesDatabase: false,
    callsRepository: persistentAdapterPreview.callsRepository === true,
    status: persistentAdapterPreview.status,
    message:
      persistentAdapterPreview.status === "preview"
        ? "Test-only fake adapter executed once and returned a preview-only result without touching a real DB."
        : "Test-only fake adapter was injected, but its preview execution remained blocked or conflicted.",
    decisionPreview,
    serviceResultPreview,
    blockedReasons,
    warnings,
  };
}

export function buildReaderSyncRealServerActionCoreResult(
  input: ReaderSyncRealServerActionCoreInput | null | undefined,
): ReaderSyncRealServerActionCoreResult {
  const inputWarnings = [...BASE_WARNINGS];
  const inputBlockedReasons: string[] = [];

  if (!isRecord(input)) {
    pushUnique(
      inputBlockedReasons,
      "INVALID_INPUT: core input must be a plain object.",
    );
  }

  const explicitUserAuthorization = input?.explicitUserAuthorization === true;
  const realSyncEnabled = input?.realSyncEnabled === true;
  const dbIntegrationAllowed = input?.dbIntegrationAllowed === true;
  const authSessionVerified = input?.authSessionVerified === true;

  if (input !== undefined && input !== null && typeof input !== "object") {
    pushUnique(
      inputBlockedReasons,
      "INVALID_INPUT: core input must be a plain object.",
    );
  }

  const localProgressResult = normalizeLocalProgress(
    input?.localProgress,
    explicitUserAuthorization,
  );
  const serverContextResult = normalizeServerContext(
    input?.serverContext,
    authSessionVerified,
  );
  const permissionGateResult = buildPermissionGatePreview(
    localProgressResult.preview,
    serverContextResult.preview,
    explicitUserAuthorization,
  );
  const repositoryAdapterResult = normalizeRepositoryAdapter(input?.repositoryAdapter);
  const guardPreview = buildGuardPreview(
    explicitUserAuthorization,
    realSyncEnabled,
    dbIntegrationAllowed,
    authSessionVerified,
    serverContextResult.preview,
    repositoryAdapterResult.preview,
    localProgressResult.preview,
    permissionGateResult,
  );

  const blockedReasons = Array.from(
    new Set<string>([
      ...inputBlockedReasons,
      ...localProgressResult.blockers,
      ...serverContextResult.blockers,
      ...repositoryAdapterResult.blockers,
      ...permissionGateResult.blockedReasons,
      ...guardPreview.blockedReasons,
    ]),
  );

  const warnings = Array.from(
    new Set<string>([
      ...inputWarnings,
      ...localProgressResult.warnings,
      ...serverContextResult.warnings,
      ...repositoryAdapterResult.warnings,
      ...permissionGateResult.warnings,
      ...guardPreview.warnings,
    ]),
  );

  const idempotencyPreview =
    permissionGateResult.allowed === true
      ? buildIdempotencyKeyPreview(
          localProgressResult.preview,
          serverContextResult.preview,
        )
      : createBlockedReaderSyncIdempotencyPreview(
          "IDEMPOTENCY_PREVIEW_SKIPPED: permission gate must pass before the idempotency key can be derived.",
        );

  for (const reason of idempotencyPreview.blockedReasons) {
    pushUnique(blockedReasons, reason);
  }
  for (const warning of idempotencyPreview.warnings) {
    pushUnique(warnings, warning);
  }

  const enrichedDecisionPayload =
    localProgressResult.payload !== null && idempotencyPreview.allowed === true
      ? {
          ...localProgressResult.payload,
          idempotencyKeyPreview: idempotencyPreview.idempotencyKeyPreview as string,
        }
      : localProgressResult.payload;

  const localProgressPreview =
    localProgressResult.preview === null
      ? null
      : {
          ...localProgressResult.preview,
          idempotencyKeyPreview:
            idempotencyPreview.allowed === true
              ? idempotencyPreview.idempotencyKeyPreview
              : null,
        };

  const decisionPreview =
    enrichedDecisionPayload !== null && serverContextResult.decisionServerContext !== null
      ? buildReaderProgressSyncDecision({
          serverContext: serverContextResult.decisionServerContext,
          payload: enrichedDecisionPayload as unknown as ReaderProgressSyncDecisionPayload,
          options: {
            previewOnly: true,
          },
        })
      : null;

  let serviceResultPreview: ReaderProgressSyncServiceResult | null = null;
  let testOnlyExecutionPreview: ReaderSyncRealServerActionTestOnlyExecutionPreview;

  const canAttemptTestOnlyExecution =
    guardPreview.canUseTestOnlyFakePath === true &&
    permissionGateResult.allowed === true &&
    idempotencyPreview.allowed === true &&
    decisionPreview !== null &&
    decisionPreview.status === "ready_preview" &&
    repositoryAdapterResult.adapter !== null;

  if (canAttemptTestOnlyExecution) {
    serviceResultPreview = buildReaderProgressSyncServiceResult({
      decision: decisionPreview,
      serverUserId: serverContextResult.decisionServerContext?.serverUserId ?? null,
      requestPreview: {
        bookId: localProgressResult.payload!.bookId,
        chapterId: localProgressResult.payload!.chapterId,
        progressRatio: localProgressResult.payload!.progressRatio,
        idempotencyKeyPreview: idempotencyPreview.idempotencyKeyPreview ?? undefined,
      },
      options: {
        previewOnly: true,
        persistentAdapter: repositoryAdapterResult.adapter ?? undefined,
      },
    });

    pushUnique(
      warnings,
      "A test-only fake adapter was exercised once; the top-level core still remains disabled-by-default.",
    );
    for (const warning of serviceResultPreview.warnings) {
      pushUnique(warnings, warning);
    }
    if (serviceResultPreview.persistentAdapterPreview !== null) {
      for (const warning of serviceResultPreview.persistentAdapterPreview.warnings) {
        pushUnique(warnings, warning);
      }
    }

    testOnlyExecutionPreview = buildTestOnlyExecutionPreview(
      decisionPreview,
      serviceResultPreview,
      warnings,
      blockedReasons,
    );
  } else {
    testOnlyExecutionPreview = buildBlockedExecutionPreview(
      decisionPreview,
      null,
      warnings,
      blockedReasons,
    );
  }

  const status: ReaderSyncRealServerActionCoreStatus = canAttemptTestOnlyExecution
    ? "test_only_fake_preview"
    : "blocked";

  const blockedBecauseIdempotency =
    permissionGateResult.allowed === true && idempotencyPreview.allowed !== true;

  const message =
    status === "test_only_fake_preview"
      ? "Disabled-by-default real sync core preview is ready for test-only fake adapter execution. No real DB write occurred."
      : blockedBecauseIdempotency
        ? "Disabled-by-default real sync core preview is blocked because the v1 idempotency key preview could not be derived safely. No real DB write occurred."
        : "Disabled-by-default real sync core preview is blocked. No real DB write occurred.";

  return {
    previewOnly: true,
    implemented: false,
    actionDraft: true,
    enabled: false,
    disabledByDefault: true,
    success: false,
    safeToExposeToClient: true,
    status,
    source: status === "test_only_fake_preview" ? "test-only-fake" : "blocked",
    message,
    requiresAuthSession: true,
    requiresExplicitUserAuthorization: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons,
    warnings,
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    guardPreview,
    localProgressPreview,
    serverContextPreview: serverContextResult.preview,
    repositoryAdapterPreview: repositoryAdapterResult.preview,
    permissionGatePreview: permissionGateResult,
    idempotencyPreview,
    decisionPreview,
    serviceResultPreview,
    testOnlyExecutionPreview,
  };
}
