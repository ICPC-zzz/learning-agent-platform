// Helper-only module for the disabled-by-default Reader sync preview path.
// The actual Next 15 server action wrapper lives in reader-sync-real-server-action.server.ts.

// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncRealServerActionCoreInput, ReaderSyncRealServerActionCoreResult } from "./reader-sync-real-server-action-core.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { buildReaderSyncRealServerActionCoreResult } from "./reader-sync-real-server-action-core.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncRealServerActionRepositoryAdapterPreview } from "./reader-sync-real-server-action-core.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncAuthSessionAdapterPreview } from "./reader-sync-auth-session-adapter.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncAuthSessionAdapter } from "./reader-sync-auth-session-adapter.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import { createBlockedReaderSyncAuthSessionAdapter } from "./reader-sync-auth-session-adapter.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";
// @ts-expect-error TS5097: test-time direct .ts import is intentional in this repo.
import type { ReadingProgressDbIntegrationGuardPreview } from "../../../../../packages/db/src/reading-progress-db-integration-guard.ts";

export interface ReaderSyncRealServerActionAuthSessionStubPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "trusted-server-stub";
  verified: boolean;
  sessionIdPreview: string | null;
}

export interface ReaderSyncServerActionContextStub {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "blocked-by-default" | "trusted-server-context";
  authSessionVerified: boolean;
  explicitUserAuthorization: boolean;
  realSyncEnabled: boolean;
  hasAuthenticatedUser: boolean;
  serverUserId: string | null;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  authSessionStub: ReaderSyncRealServerActionAuthSessionStubPreview;
}

export interface ReaderSyncRealServerActionDependencyPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "default-core" | "test-only-fake-core";
  accepted: boolean;
  testOnly: boolean;
  warnings: string[];
}

export interface ReaderSyncRealServerActionResponse {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  success: false;
  enabled: false;
  disabledByDefault: true;
  realSyncEnabled: false;
  explicitUserAuthorization: false;
  requiresAuthSession: true;
  requiresExplicitUserAuthorization: true;
  writesDatabase: false;
  callsRepository: false;
  status: "blocked";
  source: "blocked-by-default" | "test-only-fake" | "test-dev-only";
  message: string;
  blockedReasons: string[];
  warnings: string[];
  serverContextStub: ReaderSyncServerActionContextStub;
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview;
  authBlockedReasons: string[];
  dependencyPreview: ReaderSyncRealServerActionDependencyPreview;
  corePreview: ReaderSyncRealServerActionCoreResult;
  testOnly?: boolean;
  devOnly?: boolean;
  realDbIntegrationTest?: boolean;
  executionAttempted?: boolean;
  executionSucceeded?: boolean;
  executionAllowed?: boolean;
  executionMode?: "blocked" | "test-dev-only-real-db";
  executionGuardPreview?: ReaderSyncRealServerActionExecutionGuardPreview;
  dbIntegrationGuardPreview?: ReaderSyncRealServerActionDbIntegrationGuardPreview | null;
  trustedServerContextPreview?: ReaderSyncRealServerActionTrustedServerContextPreview;
}

export interface ReaderSyncRealServerActionTestOnlyDependencies {
  buildCoreResult?: (
    input: ReaderSyncRealServerActionCoreInput,
  ) => ReaderSyncRealServerActionCoreResult;
}

export interface ReaderSyncRealServerActionTrustedServerContextInput {
  hasAuthenticatedUser: boolean;
  serverUserId: string;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
}

export interface ReaderSyncRealServerActionTrustedServerContextPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "trusted-server-context" | "blocked";
  accepted: boolean;
  hasAuthenticatedUser: boolean;
  serverUserId: string | null;
  canAccessBook: boolean;
  canAccessChapter: boolean;
  canWriteProgress: boolean;
  authSessionVerified: boolean;
  blockedReasons: string[];
  warnings: string[];
}

export type ReaderSyncRealServerActionDbIntegrationGuardPreview =
  ReadingProgressDbIntegrationGuardPreview;

export interface ReaderSyncRealServerActionExecutionGuardPreview {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  source: "blocked" | "allowed";
  allowed: boolean;
  blockedReasons: string[];
  warnings: string[];
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview;
  trustedServerContextPreview: ReaderSyncRealServerActionTrustedServerContextPreview;
  dbIntegrationGuardPreview: ReaderSyncRealServerActionDbIntegrationGuardPreview | null;
  repositoryAdapterPreview: ReaderSyncRealServerActionRepositoryAdapterPreview;
}

export interface ReaderSyncRealServerActionExecutionOptions {
  allowTestRealDbExecution?: boolean;
  authSessionAdapter?: ReaderSyncAuthSessionAdapter | null;
  trustedServerContext?: ReaderSyncRealServerActionTrustedServerContextInput | null;
  repositoryAdapter?: ReaderSyncPersistentRepositoryAdapter | null;
  persistentAdapter?: ReaderSyncPersistentRepositoryAdapter | null;
  dbIntegrationGuardPreview?: ReaderSyncRealServerActionDbIntegrationGuardPreview | null;
  buildCoreResult?: (
    input: ReaderSyncRealServerActionCoreInput,
  ) => ReaderSyncRealServerActionCoreResult;
}

export interface ReaderSyncRealServerActionExecutionResult
  extends ReaderSyncRealServerActionResponse {
  testOnly: true;
  devOnly: true;
  realDbIntegrationTest: true;
  executionAttempted: boolean;
  executionSucceeded: boolean;
  executionAllowed: boolean;
  executionMode: "blocked" | "test-dev-only-real-db";
  executionGuardPreview: ReaderSyncRealServerActionExecutionGuardPreview;
}

const WRAPPER_WARNINGS = [
  "Reader sync real server action wrapper is preview-only and disabled by default.",
  "Auth/session preview is attached in blocked mode and does not connect a real provider.",
  "No real auth/session provider, PrismaClient, database URL, repository call, or public route is connected here.",
  "Client input is never trusted to supply userId, token, cookie, session, rawDbRecord, metadata, or database connection secrets.",
] as const;

const WRAPPER_BLOCKED_REASONS = [
  "WRAPPER_DISABLED_BY_DEFAULT: the real Reader sync server action wrapper stays preview-only.",
  "AUTH_SESSION_PREVIEW_BLOCKED: the attached auth/session preview is blocked by default.",
  "AUTH_SESSION_PROVIDER_NOT_CONNECTED: no real auth/session provider is wired to this wrapper.",
  "EXPLICIT_USER_AUTHORIZATION_REQUIRED: future real sync must still require an explicit user authorization gate.",
  "REAL_SYNC_ENABLED_REQUIRED: real sync remains disabled in this draft.",
  "UI_NOT_CONNECTED: the Reader UI is not wired to this server action wrapper yet.",
  "DATABASE_WRITES_DISABLED: this wrapper does not write to the database.",
  "REPOSITORY_CALLS_DISABLED: this wrapper does not call a repository.",
] as const;

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createBlockedReaderSyncServerActionContext(
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
): ReaderSyncServerActionContextStub {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "blocked-by-default",
    authSessionVerified: false,
    explicitUserAuthorization: false,
    realSyncEnabled: false,
    hasAuthenticatedUser: false,
    serverUserId: null,
    canAccessBook: false,
    canAccessChapter: false,
    canWriteProgress: false,
    authSessionStub: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: "trusted-server-stub",
      verified: authSessionPreview.snapshot.authSessionVerified,
      sessionIdPreview: authSessionPreview.snapshot.sessionIdPreview,
    },
  };
}

function createBlockedCoreInput(
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
): ReaderSyncRealServerActionCoreInput {
  return {
    localProgress: {
      bookId: "reader-sync-wrapper-preview-book",
      chapterId: "reader-sync-wrapper-preview-chapter",
      progressRatio: 0,
      idempotencyKeyPreview: null,
    },
    serverContext: {
      serverUserId: authSessionPreview.snapshot.serverUserId ?? undefined,
      hasAuthenticatedUser: authSessionPreview.snapshot.hasAuthenticatedUser,
      canAccessBook: authSessionPreview.snapshot.canAccessBook,
      canAccessChapter: authSessionPreview.snapshot.canAccessChapter,
      canWriteProgress: authSessionPreview.snapshot.canWriteProgress,
      authSessionStub: {
        verified: authSessionPreview.snapshot.authSessionVerified,
        sessionSource: "trusted-server-stub",
        sessionIdPreview: authSessionPreview.snapshot.sessionIdPreview,
      },
    },
    explicitUserAuthorization: false,
    realSyncEnabled: false,
    dbIntegrationAllowed: false,
    authSessionVerified: false,
    repositoryAdapter: null,
  } as ReaderSyncRealServerActionCoreInput;
}

export function createPreviewReaderSyncRealServerActionResponse(
  dependencies?: ReaderSyncRealServerActionTestOnlyDependencies | null,
): ReaderSyncRealServerActionResponse {
  const authSessionAdapter = createBlockedReaderSyncAuthSessionAdapter();
  const authSessionPreview = authSessionAdapter.getPreview();
  const serverContextStub = createBlockedReaderSyncServerActionContext(authSessionPreview);
  const coreInput = createBlockedCoreInput(authSessionPreview);
  const buildCoreResult =
    dependencies?.buildCoreResult ?? buildReaderSyncRealServerActionCoreResult;
  const dependencyPreview: ReaderSyncRealServerActionDependencyPreview = {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: dependencies?.buildCoreResult === undefined ? "default-core" : "test-only-fake-core",
    accepted: true,
    testOnly: dependencies?.buildCoreResult !== undefined,
    warnings: [...WRAPPER_WARNINGS],
  };

  if (dependencyPreview.testOnly) {
    pushUnique(
      dependencyPreview.warnings,
      "A test-only fake core dependency was injected, but the wrapper remains disabled-by-default.",
    );
  }

  const corePreview = buildCoreResult(coreInput);

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    success: false,
    enabled: false,
    disabledByDefault: true,
    realSyncEnabled: false,
    explicitUserAuthorization: false,
    requiresAuthSession: true,
    requiresExplicitUserAuthorization: true,
    writesDatabase: false,
    callsRepository: false,
    status: "blocked",
    source: "blocked-by-default",
    message:
      "Reader sync real server action wrapper is disabled by default. auth/session stays in blocked preview, and Reader UI, DB writes, and real provider wiring are not connected yet.",
    blockedReasons: [...WRAPPER_BLOCKED_REASONS],
    warnings: dependencyPreview.warnings.slice(),
    serverContextStub,
    authSessionPreview,
    authBlockedReasons: authSessionPreview.blockedReasons.slice(),
    dependencyPreview,
    corePreview,
  };
}

export async function previewReaderSyncRealServerAction(
  input: unknown,
): Promise<ReaderSyncRealServerActionResponse> {
  void input;
  return Promise.resolve(createPreviewReaderSyncRealServerActionResponse());
}

function buildUniqueStrings(...lists: string[][]): string[] {
  const result: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      pushUnique(result, item);
    }
  }
  return result;
}

function buildTrustedServerContextPreview(
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  trustedServerContext: ReaderSyncRealServerActionTrustedServerContextInput | null | undefined,
): ReaderSyncRealServerActionTrustedServerContextPreview {
  const warnings = [...WRAPPER_WARNINGS];
  const blockedReasons: string[] = [];
  const snapshot = authSessionPreview.snapshot;

  const serverUserId =
    trustedServerContext !== null &&
    trustedServerContext !== undefined &&
    typeof trustedServerContext.serverUserId === "string" &&
    trustedServerContext.serverUserId.trim().length > 0
      ? trustedServerContext.serverUserId.trim()
      : null;
  const hasAuthenticatedUser = trustedServerContext?.hasAuthenticatedUser === true;
  const canAccessBook = trustedServerContext?.canAccessBook === true;
  const canAccessChapter = trustedServerContext?.canAccessChapter === true;
  const canWriteProgress = trustedServerContext?.canWriteProgress === true;

  if (authSessionPreview.source !== "test-only-mock") {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_PREVIEW_REQUIRED: test/dev-only execution requires a test-only mock auth/session adapter.",
    );
  }

  if (snapshot.testOnly !== true) {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_TEST_ONLY_REQUIRED: auth/session adapter must stay test-only.",
    );
  }

  if (snapshot.mockOnly !== true) {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_MOCK_ONLY_REQUIRED: auth/session adapter must stay mock-only.",
    );
  }

  if (snapshot.authSessionVerified !== true) {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_VERIFIED_REQUIRED: auth/session adapter must be verified before real DB execution is allowed.",
    );
  }

  if (!snapshot.serverUserId || snapshot.serverUserId.trim().length === 0) {
    pushUnique(
      blockedReasons,
      "SERVER_USER_ID_REQUIRED: auth/session adapter must expose a trusted serverUserId.",
    );
  }

  if (serverUserId === null) {
    pushUnique(
      blockedReasons,
      "TRUSTED_SERVER_CONTEXT_REQUIRED: trusted serverContext with a serverUserId must be injected for test/dev-only execution.",
    );
  }

  if (snapshot.serverUserId && serverUserId !== null && snapshot.serverUserId !== serverUserId) {
    pushUnique(
      blockedReasons,
      "TRUSTED_SERVER_USER_ID_MISMATCH: trusted serverContext.serverUserId must match the trusted auth/session preview.",
    );
  }

  if (hasAuthenticatedUser !== true) {
    pushUnique(
      blockedReasons,
      "HAS_AUTHENTICATED_USER_REQUIRED: trusted serverContext.hasAuthenticatedUser must be true.",
    );
  }

  if (canAccessBook !== true) {
    pushUnique(
      blockedReasons,
      "CAN_ACCESS_BOOK_REQUIRED: trusted serverContext.canAccessBook must be true.",
    );
  }

  if (canAccessChapter !== true) {
    pushUnique(
      blockedReasons,
      "CAN_ACCESS_CHAPTER_REQUIRED: trusted serverContext.canAccessChapter must be true.",
    );
  }

  if (canWriteProgress !== true) {
    pushUnique(
      blockedReasons,
      "CAN_WRITE_PROGRESS_REQUIRED: trusted serverContext.canWriteProgress must be true.",
    );
  }

  if (authSessionPreview.snapshot.explicitUserAuthorization !== true) {
    pushUnique(
      blockedReasons,
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: auth/session preview must carry an explicit user authorization gate.",
    );
  }

  if (
    authSessionPreview.snapshot.canAccessBook !== true ||
    authSessionPreview.snapshot.canAccessChapter !== true ||
    authSessionPreview.snapshot.canWriteProgress !== true
  ) {
    pushUnique(
      blockedReasons,
      "TRUSTED_PERMISSION_PREVIEW_REQUIRED: auth/session preview must allow book, chapter, and progress writes.",
    );
  }

  if (blockedReasons.length === 0) {
    pushUnique(
      warnings,
      "Trusted server context is accepted for the test/dev-only real DB execution entrypoint.",
    );
  } else {
    pushUnique(
      warnings,
      "Trusted server context remains blocked, so the real DB execution entrypoint stays disabled.",
    );
  }

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: blockedReasons.length === 0 ? "trusted-server-context" : "blocked",
    accepted: blockedReasons.length === 0,
    hasAuthenticatedUser,
    serverUserId,
    canAccessBook,
    canAccessChapter,
    canWriteProgress,
    authSessionVerified: snapshot.authSessionVerified === true,
    blockedReasons,
    warnings,
  };
}

function buildTrustedReaderSyncServerActionContext(
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  trustedServerContextPreview: ReaderSyncRealServerActionTrustedServerContextPreview,
): ReaderSyncServerActionContextStub {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: "trusted-server-context",
    authSessionVerified: trustedServerContextPreview.authSessionVerified,
    explicitUserAuthorization: true,
    realSyncEnabled: true,
    hasAuthenticatedUser: trustedServerContextPreview.hasAuthenticatedUser,
    serverUserId: trustedServerContextPreview.serverUserId,
    canAccessBook: trustedServerContextPreview.canAccessBook,
    canAccessChapter: trustedServerContextPreview.canAccessChapter,
    canWriteProgress: trustedServerContextPreview.canWriteProgress,
    authSessionStub: {
      previewOnly: true,
      implemented: false,
      safeToExposeToClient: true,
      source: "trusted-server-stub",
      verified: authSessionPreview.snapshot.authSessionVerified,
      sessionIdPreview: authSessionPreview.snapshot.sessionIdPreview,
    },
  };
}

function buildExecutionGuardPreview(
  allowTestRealDbExecution: boolean,
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  trustedServerContextPreview: ReaderSyncRealServerActionTrustedServerContextPreview,
  repositoryAdapter: ReaderSyncPersistentRepositoryAdapter | null,
  dbIntegrationGuardPreview: ReaderSyncRealServerActionDbIntegrationGuardPreview | null,
): ReaderSyncRealServerActionExecutionGuardPreview {
  const blockedReasons: string[] = [];
  const warnings = [...WRAPPER_WARNINGS];
  const repositoryCapabilities =
    repositoryAdapter !== null &&
    isRecord(repositoryAdapter) &&
    isRecord(repositoryAdapter.capabilities)
      ? (repositoryAdapter.capabilities as ReaderSyncPersistentRepositoryAdapter["capabilities"])
      : null;

  if (!allowTestRealDbExecution) {
    pushUnique(
      blockedReasons,
      "ALLOW_TEST_REAL_DB_EXECUTION_REQUIRED: a test/dev-only execution switch must be enabled explicitly.",
    );
  }

  if (authSessionPreview.status !== "preview") {
    pushUnique(
      blockedReasons,
      "AUTH_SESSION_PREVIEW_REQUIRED: the wrapper needs a test-only mock auth/session preview before real DB execution.",
    );
  }

  if (trustedServerContextPreview.accepted !== true) {
    for (const reason of trustedServerContextPreview.blockedReasons) {
      pushUnique(blockedReasons, reason);
    }
  }

  if (repositoryAdapter === null) {
    pushUnique(
      blockedReasons,
      "REPOSITORY_ADAPTER_REQUIRED: a repositoryAdapter or persistentAdapter must be injected for execution.",
    );
  }

  if (dbIntegrationGuardPreview === null) {
    pushUnique(
      blockedReasons,
      "DB_INTEGRATION_GUARD_REQUIRED: a real DB integration guard preview must be provided for execution.",
    );
  } else if (dbIntegrationGuardPreview.canRunDbIntegrationTest !== true) {
    for (const reason of dbIntegrationGuardPreview.blockedReasons) {
      pushUnique(blockedReasons, reason);
    }
  }

  if (blockedReasons.length === 0) {
    pushUnique(
      warnings,
      "All test/dev-only execution guards are satisfied, so the wrapper may call the core/service/DB chain once.",
    );
  } else {
    pushUnique(
      warnings,
      "One or more execution guards are blocked, so the wrapper stays preview-only.",
    );
  }

  const repositoryAdapterPreview: ReaderSyncRealServerActionRepositoryAdapterPreview =
    repositoryAdapter === null
      ? {
          previewOnly: true,
          implemented: false,
          safeToExposeToClient: true,
          source: "blocked",
          accepted: false,
          mode: "blocked",
          capabilities: null,
          blockedReasons: [
            "REPOSITORY_ADAPTER_REQUIRED: a repositoryAdapter or persistentAdapter must be injected for execution.",
          ],
          warnings: [...WRAPPER_WARNINGS],
          summary: "No repository adapter was injected for test/dev-only execution.",
        }
      : {
          previewOnly: true,
          implemented: false,
          safeToExposeToClient: true,
          source: "injected-fake",
          accepted: true,
          mode: repositoryCapabilities?.mode ?? "blocked",
          capabilities: repositoryCapabilities,
          blockedReasons: [],
          warnings: [...WRAPPER_WARNINGS],
          summary:
            "Injected repository adapter is available for test/dev-only execution and stays preview-only.",
        };

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    source: blockedReasons.length === 0 ? "allowed" : "blocked",
    allowed: blockedReasons.length === 0,
    blockedReasons,
    warnings,
    authSessionPreview,
    trustedServerContextPreview,
    dbIntegrationGuardPreview,
    repositoryAdapterPreview,
  };
}

function buildExecutionCoreInput(
  input: unknown,
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  trustedServerContextPreview: ReaderSyncRealServerActionTrustedServerContextPreview,
  repositoryAdapter: ReaderSyncPersistentRepositoryAdapter,
): ReaderSyncRealServerActionCoreInput {
  const localProgress =
    input !== null && input !== undefined && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>).localProgress ?? input
      : input;

  return {
    localProgress,
    serverContext: {
      serverUserId: trustedServerContextPreview.serverUserId ?? undefined,
      hasAuthenticatedUser: trustedServerContextPreview.hasAuthenticatedUser,
      canAccessBook: trustedServerContextPreview.canAccessBook,
      canAccessChapter: trustedServerContextPreview.canAccessChapter,
      canWriteProgress: trustedServerContextPreview.canWriteProgress,
      authSessionStub: {
        verified: authSessionPreview.snapshot.authSessionVerified,
        sessionSource: "trusted-server-stub",
        sessionIdPreview: authSessionPreview.snapshot.sessionIdPreview,
      },
    },
    explicitUserAuthorization:
      isRecord(input) && input.explicitUserAuthorization === true,
    realSyncEnabled: true,
    dbIntegrationAllowed: true,
    authSessionVerified: true,
    repositoryAdapter,
  };
}

function buildExecutionResultFromBlockedPreview(
  baseResponse: ReaderSyncRealServerActionResponse,
  executionGuardPreview: ReaderSyncRealServerActionExecutionGuardPreview,
  authSessionPreview: ReaderSyncAuthSessionAdapterPreview,
  trustedServerContextPreview: ReaderSyncRealServerActionTrustedServerContextPreview,
  dbIntegrationGuardPreview: ReaderSyncRealServerActionDbIntegrationGuardPreview | null,
): ReaderSyncRealServerActionExecutionResult {
  return {
    ...baseResponse,
    source: "test-dev-only",
    message:
      "Test/dev-only real DB execution entrypoint stayed blocked before any real DB call was made.",
    blockedReasons: buildUniqueStrings(
      baseResponse.blockedReasons.slice(),
      executionGuardPreview.blockedReasons.slice(),
      trustedServerContextPreview.blockedReasons?.slice() ?? [],
    ),
    warnings: buildUniqueStrings(
      baseResponse.warnings.slice(),
      executionGuardPreview.warnings.slice(),
      trustedServerContextPreview.warnings?.slice() ?? [],
    ),
    serverContextStub: createBlockedReaderSyncServerActionContext(authSessionPreview),
    authSessionPreview,
    authBlockedReasons: authSessionPreview.blockedReasons.slice(),
    executionAttempted: false,
    executionSucceeded: false,
    executionAllowed: false,
    executionMode: "blocked",
    executionGuardPreview,
    dbIntegrationGuardPreview,
    trustedServerContextPreview,
    testOnly: true,
    devOnly: true,
    realDbIntegrationTest: true,
  };
}

export function createReaderSyncRealServerActionExecutor(
  options?: ReaderSyncRealServerActionExecutionOptions | null,
): (
  input: unknown,
) => Promise<ReaderSyncRealServerActionExecutionResult> {
  return async function executeReaderSyncRealServerAction(
    input: unknown,
  ): Promise<ReaderSyncRealServerActionExecutionResult> {
    const baseResponse = createPreviewReaderSyncRealServerActionResponse({
      buildCoreResult: options?.buildCoreResult,
    });
    const authSessionAdapter =
      options?.authSessionAdapter ?? createBlockedReaderSyncAuthSessionAdapter();
    const authSessionPreview = authSessionAdapter.getPreview();
    const repositoryAdapter =
      options?.repositoryAdapter ?? options?.persistentAdapter ?? null;
    const trustedServerContextPreview = buildTrustedServerContextPreview(
      authSessionPreview,
      options?.trustedServerContext,
    );
    const executionGuardPreview = buildExecutionGuardPreview(
      options?.allowTestRealDbExecution === true,
      authSessionPreview,
      trustedServerContextPreview,
      repositoryAdapter,
      options?.dbIntegrationGuardPreview ?? null,
    );

    if (executionGuardPreview.allowed !== true || repositoryAdapter === null) {
      return buildExecutionResultFromBlockedPreview(
        baseResponse,
        executionGuardPreview,
        authSessionPreview,
        trustedServerContextPreview,
        options?.dbIntegrationGuardPreview ?? null,
      );
    }

    const buildCoreResult =
      options?.buildCoreResult ?? buildReaderSyncRealServerActionCoreResult;
    const coreInput = buildExecutionCoreInput(
      input,
      authSessionPreview,
      trustedServerContextPreview,
      repositoryAdapter,
    );

    let corePreview: ReaderSyncRealServerActionCoreResult;
    try {
      corePreview = buildCoreResult(coreInput);
    } catch {
      const blockedPreview = buildExecutionResultFromBlockedPreview(
        baseResponse,
        {
          ...executionGuardPreview,
          allowed: false,
          source: "blocked",
          blockedReasons: buildUniqueStrings(
            executionGuardPreview.blockedReasons.slice(),
            ["CORE_BUILDER_THROWN: the real execution core threw before it could return a preview."],
          ),
          warnings: buildUniqueStrings(
            executionGuardPreview.warnings.slice(),
            [
              "The real execution core threw safely before any real DB interaction could be completed.",
            ],
          ),
        },
        authSessionPreview,
        trustedServerContextPreview,
        options?.dbIntegrationGuardPreview ?? null,
      );
      return blockedPreview;
    }

    const executionSucceeded =
      corePreview.testOnlyExecutionPreview.executed === true &&
      corePreview.testOnlyExecutionPreview.success === true;

    const executionAllowed =
      executionGuardPreview.allowed === true &&
      corePreview.status === "test_only_fake_preview" &&
      corePreview.testOnlyExecutionPreview.attempted === true;

    const blockedReasons = buildUniqueStrings(
      executionGuardPreview.blockedReasons.slice(),
      corePreview.blockedReasons.slice(),
    );

    const warnings = buildUniqueStrings(
      baseResponse.warnings.slice(),
      executionGuardPreview.warnings.slice(),
      corePreview.warnings.slice(),
    );

    return {
      ...baseResponse,
      source: "test-dev-only",
      message:
        executionSucceeded
          ? "Test/dev-only real DB execution completed through the wrapper and core preview chain."
          : "Test/dev-only real DB execution ran through the wrapper, but the core preview stayed blocked or conflicted.",
      blockedReasons,
      warnings,
      serverContextStub: buildTrustedReaderSyncServerActionContext(
        authSessionPreview,
        trustedServerContextPreview,
      ),
      authSessionPreview,
      authBlockedReasons: authSessionPreview.blockedReasons.slice(),
      corePreview,
      executionAttempted: true,
      executionSucceeded,
      executionAllowed,
      executionMode: "test-dev-only-real-db",
      executionGuardPreview,
      dbIntegrationGuardPreview: options?.dbIntegrationGuardPreview ?? null,
      trustedServerContextPreview,
      testOnly: true,
      devOnly: true,
      realDbIntegrationTest: true,
    };
  };
}

export async function executeReaderSyncRealServerActionForTest(
  input: unknown,
  options?: ReaderSyncRealServerActionExecutionOptions | null,
): Promise<ReaderSyncRealServerActionExecutionResult> {
  return createReaderSyncRealServerActionExecutor(options)(input);
}
