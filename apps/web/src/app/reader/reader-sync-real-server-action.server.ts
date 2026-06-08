"use server";

// @ts-expect-error TS5097: direct .ts import is intentional in this repo.
import { createPreviewReaderSyncRealServerActionResponse, type ReaderSyncRealServerActionExecutionResult, type ReaderSyncRealServerActionResponse, executeReaderSyncRealServerActionForTest } from "./reader-sync-real-server-action.ts";
// @ts-expect-error TS5097: direct .ts import is intentional in this repo.
import { createBlockedReaderSyncAuthSessionAdapter, createMockReaderSyncAuthSessionAdapterForTest } from "./reader-sync-auth-session-adapter.ts";
// @ts-expect-error TS5097: direct .ts import is intentional in this repo.
import { createReaderSyncPersistentRepositoryAdapter } from "./reader-sync-persistent-repository-adapter.ts";

// @ts-expect-error TS5097: direct .ts import is intentional in this repo.
import { evaluateReadingProgressDbIntegrationGuard } from "../../../../../packages/db/src/reading-progress-db-integration-guard.ts";
import { execFileSync } from "node:child_process";

type DevDbActionName = "ensure-user" | "find" | "upsert" | "audit" | "idempotency";

const DB_PACKAGE_DIST_URL = new URL(
  "../../../../../packages/db/dist/index.js",
  import.meta.url,
).href;

const DB_READING_PROGRESS_ADAPTER_SOURCE_URL = new URL(
  "../../../../../packages/db/src/reading-progress-prisma-adapter.ts",
  import.meta.url,
).href;

interface DevDbChildResult<T> {
  ok: true;
  result: T;
}

interface DevDbChildFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

interface DevDbBootstrapUserPreview {
  id: string;
  email: string | null;
  name: string | null;
}

interface DevOnlyRuntimeState {
  devTriggerEnabled: boolean;
  allowRealDbIntegration: boolean;
  readerProgressDbTest: boolean;
  acknowledgeTestDbOnly: boolean;
  productionEnv: boolean;
  devUserEmail: string;
  devUserName: string;
  devUserAuthProvider: string;
  devUserAuthProviderId: string;
  devSessionIdPreview: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isExplicitlyEnabled(value: unknown): boolean {
  return value === "true";
}

function normalizeNonEmptyText(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function readRuntimeState(env: NodeJS.ProcessEnv = process.env): DevOnlyRuntimeState {
  const productionEnv = env.NODE_ENV === "production";

  return {
    devTriggerEnabled:
      isExplicitlyEnabled(env.LAP_READER_SYNC_DEV_TRIGGER) && productionEnv !== true,
    allowRealDbIntegration: isExplicitlyEnabled(env.LAP_ALLOW_REAL_DB_INTEGRATION),
    readerProgressDbTest: isExplicitlyEnabled(env.LAP_READER_PROGRESS_DB_TEST),
    acknowledgeTestDbOnly: isExplicitlyEnabled(env.LAP_ACKNOWLEDGE_TEST_DB_ONLY),
    productionEnv,
    devUserEmail: normalizeNonEmptyText(
      env.LAP_READER_SYNC_DEV_USER_EMAIL,
      "lap.reader.sync.dev@example.test",
    ),
    devUserName: normalizeNonEmptyText(
      env.LAP_READER_SYNC_DEV_USER_NAME,
      "Reader Sync Dev User",
    ),
    devUserAuthProvider: normalizeNonEmptyText(
      env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER,
      "lap-reader-sync-dev",
    ),
    devUserAuthProviderId: normalizeNonEmptyText(
      env.LAP_READER_SYNC_DEV_USER_AUTH_PROVIDER_ID,
      "reader-sync-dev-user",
    ),
    devSessionIdPreview: normalizeNonEmptyText(
      env.LAP_READER_SYNC_DEV_SESSION_PREVIEW,
      "reader-sync-dev-session-preview",
    ),
  };
}

function buildBlockedDevOnlyResponse(
  input: unknown,
  blockedReasons: string[],
): Promise<ReaderSyncRealServerActionExecutionResult> {
  return executeReaderSyncRealServerActionForTest(input, {
    allowTestRealDbExecution: false,
    authSessionAdapter: createBlockedReaderSyncAuthSessionAdapter(),
    trustedServerContext: null,
    repositoryAdapter: null,
  }).then(function (result) {
    return {
      ...result,
      source: "test-dev-only",
      message: "本地开发同步入口已被安全拦截。",
      blockedReasons: [...result.blockedReasons, ...blockedReasons],
      warnings: [
        ...result.warnings,
        "The dev-only wrapper stayed blocked before any local/test DB call was attempted.",
      ],
      executionAttempted: false,
      executionSucceeded: false,
      executionAllowed: false,
      executionMode: "blocked",
      testOnly: true,
      devOnly: true,
      realDbIntegrationTest: true,
    };
  });
}

function runDevDbChildProcessAction<T>(
  action: DevDbActionName,
  input: unknown,
): T {
  const script = `
    import { readFileSync } from "node:fs";
    import {
      PrismaUserRepository,
      createPrismaClient,
      disconnectPrismaClient,
    } from "${DB_PACKAGE_DIST_URL}";
    import { createReadingProgressPrismaRepositoryAdapter } from "${DB_READING_PROGRESS_ADAPTER_SOURCE_URL}";

    const payload = JSON.parse(readFileSync(0, "utf8"));
    const prisma = createPrismaClient();

    try {
      await prisma.$connect();

      let result;
      switch (payload.action) {
        case "ensure-user": {
          const userRepository = new PrismaUserRepository(prisma);
          const user = await userRepository.findOrCreateUser(payload.input);
          result = {
            id: user.id,
            email: user.email ?? null,
            name: user.name ?? null,
          };
          break;
        }
        case "find":
        case "upsert":
        case "audit":
        case "idempotency": {
          const adapter = createReadingProgressPrismaRepositoryAdapter(prisma);
          if (payload.action === "find") {
            result = await adapter.findByUserBookChapter(payload.input);
          } else if (payload.action === "upsert") {
            result = await adapter.upsertProgress(payload.input);
          } else if (payload.action === "audit") {
            result = adapter.previewAudit(payload.input);
          } else {
            result = adapter.previewIdempotency(payload.input);
          }
          break;
        }
        default:
          throw new Error("Unsupported dev DB action.");
      }

      process.stdout.write(JSON.stringify({ ok: true, result }));
    } catch {
      process.stdout.write(
        JSON.stringify({
          ok: false,
          error: {
            code: "DEV_DB_CHILD_FAILED",
            message: "The dev-only real DB path failed safely.",
          },
        }),
      );
    } finally {
      try {
        await disconnectPrismaClient(prisma);
      } catch {
        // Ignore disconnect failures in the child process.
      }
    }
  `;

  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: process.cwd(),
      env: process.env,
      input: JSON.stringify({ action, input }),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const parsed = JSON.parse(output) as DevDbChildResult<T> | DevDbChildFailure;
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }

  return parsed.result;
}

function mapDbFindResultToWebPreview(
  result: unknown,
): {
  previewOnly: true;
  safeToExposeToClient: true;
  source: "existing";
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId: string | null;
  completedAt: string | null;
  updatedAt: string | null;
} | null {
  if (
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    (result as { status?: string }).status !== "found" ||
    !("recordPreview" in result) ||
    (result as { recordPreview?: unknown }).recordPreview === null
  ) {
    return null;
  }

  const preview = (result as { recordPreview: Record<string, unknown> }).recordPreview;
  if (
    typeof preview.bookId !== "string" ||
    typeof preview.chapterId !== "string" ||
    typeof preview.progressRatio !== "number"
  ) {
    return null;
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: "existing",
    bookId: preview.bookId,
    chapterId: preview.chapterId,
    progressRatio: preview.progressRatio,
    lastChunkId:
      typeof preview.lastChunkId === "string" ? preview.lastChunkId : null,
    completedAt:
      typeof preview.completedAt === "string" ? preview.completedAt : null,
    updatedAt:
      typeof preview.updatedAt === "string" ? preview.updatedAt : null,
  };
}

function mapDbUpsertResultToWebPreview(
  result: unknown,
): {
  previewOnly: true;
  safeToExposeToClient: true;
  source: "upserted";
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId: string | null;
  completedAt: string | null;
  updatedAt: string | null;
} {
  if (
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    (result as { status?: string }).status !== "upserted" ||
    !("recordPreview" in result) ||
    (result as { recordPreview?: unknown }).recordPreview === null
  ) {
    throw new Error(
      "Injected Prisma-compatible adapter did not complete the preview write path.",
    );
  }

  const preview = (result as { recordPreview: Record<string, unknown> }).recordPreview;
  if (
    typeof preview.bookId !== "string" ||
    typeof preview.chapterId !== "string" ||
    typeof preview.progressRatio !== "number"
  ) {
    throw new Error(
      "Injected Prisma-compatible adapter did not complete the preview write path.",
    );
  }

  return {
    previewOnly: true,
    safeToExposeToClient: true,
    source: "upserted",
    bookId: preview.bookId,
    chapterId: preview.chapterId,
    progressRatio: preview.progressRatio,
    lastChunkId:
      typeof preview.lastChunkId === "string" ? preview.lastChunkId : null,
    completedAt:
      typeof preview.completedAt === "string" ? preview.completedAt : null,
    updatedAt:
      typeof preview.updatedAt === "string" ? preview.updatedAt : null,
  };
}

function mapDbAuditPreviewToWebPreview(
  result: unknown,
): {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: "preview" | "blocked";
  persisted: false;
  auditId: string | null;
  action: "reader.progress.sync.repository.audit-log";
  source: "preview" | "blocked";
  message: string;
  blockers: Array<{ code: string; message: string }>;
  warnings: string[];
} {
  if (
    !result ||
    typeof result !== "object" ||
    !("status" in result)
  ) {
    throw new Error("Real DB adapter action failed safely.");
  }

  const preview = result as {
    status?: string;
    auditId?: string | null;
    source?: string;
    blockers?: unknown[];
    warnings?: unknown[];
  };

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: preview.status === "preview" ? "preview" : "blocked",
    persisted: false,
    auditId:
      typeof preview.auditId === "string" && preview.auditId.trim().length > 0
        ? preview.auditId
        : null,
    action: "reader.progress.sync.repository.audit-log",
    source: preview.source === "preview" ? "preview" : "blocked",
    message:
      preview.status === "preview"
        ? "Audit preview bridged from the real Prisma-compatible adapter."
        : "Audit preview blocked by the real Prisma-compatible adapter.",
    blockers: Array.isArray(preview.blockers)
      ? preview.blockers.filter(function (item): item is { code: string; message: string } {
          return (
            isRecord(item) &&
            typeof item.code === "string" &&
            typeof item.message === "string"
          );
        })
      : [],
    warnings: Array.isArray(preview.warnings)
      ? preview.warnings.filter(function (item): item is string {
          return typeof item === "string";
        })
      : [],
  };
}

function mapDbIdempotencyPreviewToWebPreview(
  result: unknown,
): {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  status: "preview" | "blocked";
  persisted: false;
  previewKey: string | null;
  action: "reader.progress.sync.repository.idempotency-claim";
  source: "preview" | "blocked";
  message: string;
  blockers: Array<{ code: string; message: string }>;
  warnings: string[];
} {
  if (
    !result ||
    typeof result !== "object" ||
    !("status" in result)
  ) {
    throw new Error("Real DB adapter action failed safely.");
  }

  const preview = result as {
    status?: string;
    previewKey?: string | null;
    source?: string;
    blockers?: unknown[];
    warnings?: unknown[];
  };

  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: preview.status === "preview" ? "preview" : "blocked",
    persisted: false,
    previewKey:
      typeof preview.previewKey === "string" && preview.previewKey.trim().length > 0
        ? preview.previewKey
        : null,
    action: "reader.progress.sync.repository.idempotency-claim",
    source: preview.source === "preview" ? "preview" : "blocked",
    message:
      preview.status === "preview"
        ? "Idempotency preview bridged from the real Prisma-compatible adapter."
        : "Idempotency preview blocked by the real Prisma-compatible adapter.",
    blockers: Array.isArray(preview.blockers)
      ? preview.blockers.filter(function (item): item is { code: string; message: string } {
          return (
            isRecord(item) &&
            typeof item.code === "string" &&
            typeof item.message === "string"
          );
        })
      : [],
    warnings: Array.isArray(preview.warnings)
      ? preview.warnings.filter(function (item): item is string {
          return typeof item === "string";
        })
      : [],
  };
}

async function ensureDevUserRecord(
  runtime: DevOnlyRuntimeState,
): Promise<DevDbBootstrapUserPreview> {
  return runDevDbChildProcessAction<DevDbBootstrapUserPreview>("ensure-user", {
    email: runtime.devUserEmail,
    name: runtime.devUserName,
    authProvider: runtime.devUserAuthProvider,
    authProviderId: runtime.devUserAuthProviderId,
  });
}

function buildAllowedExecutionResponse(
  runtime: DevOnlyRuntimeState,
  devUser: DevDbBootstrapUserPreview,
  input: unknown,
): Promise<ReaderSyncRealServerActionExecutionResult> {
  const authSessionAdapter = createMockReaderSyncAuthSessionAdapterForTest({
    previewOnly: true,
    source: "test-only-mock",
    hasAuthenticatedUser: true,
    authSessionVerified: true,
    serverUserId: devUser.id,
    canAccessBook: true,
    canAccessChapter: true,
    canWriteProgress: true,
    explicitUserAuthorization: true,
    sessionIdPreview: runtime.devSessionIdPreview,
    testOnly: true,
    mockOnly: true,
  });

  const repositoryAdapter = createReaderSyncPersistentRepositoryAdapter(
    {
      findProgressByUserBookChapter(request) {
        return mapDbFindResultToWebPreview(
          runDevDbChildProcessAction("find", request),
        );
      },
      upsertProgress(request) {
        return mapDbUpsertResultToWebPreview(
          runDevDbChildProcessAction("upsert", request),
        );
      },
      recordAuditLog(request) {
        return mapDbAuditPreviewToWebPreview(
          runDevDbChildProcessAction("audit", request),
        );
      },
      claimIdempotencyKey(request) {
        return mapDbIdempotencyPreviewToWebPreview(
          runDevDbChildProcessAction("idempotency", request),
        );
      },
    },
    {
      previewOnly: true,
      allowDatabaseWrite: true,
      allowRepositoryCall: true,
      explicitUserAuthorization: true,
      readinessGatePassed: true,
      auditReady: true,
      idempotencyReady: true,
      conflictResolutionReady: true,
      disabled: false,
    },
  );

  const dbIntegrationGuardPreview = evaluateReadingProgressDbIntegrationGuard({
    explicitUserAuthorization: true,
    allowRealDatabaseConnection: true,
    allowPrismaClientRuntime: true,
    allowDatabaseWrite: true,
    databaseUrlPresent: true,
    testDatabaseOnly: true,
    environmentName: runtime.productionEnv === true ? "production" : "development",
    allowLocalDevelopmentDatabase: true,
    acknowledgedNoProductionDatabase: true,
    destructiveWriteAllowed: false,
    migrationAllowed: false,
  });

  return executeReaderSyncRealServerActionForTest(input, {
    allowTestRealDbExecution: true,
    authSessionAdapter,
    trustedServerContext: {
      hasAuthenticatedUser: true,
      serverUserId: devUser.id,
      canAccessBook: true,
      canAccessChapter: true,
      canWriteProgress: true,
    },
    repositoryAdapter,
    dbIntegrationGuardPreview,
    }).then(function (result) {
    if (result.executionSucceeded === true) {
      return {
        ...result,
        message: "本地开发同步测试完成",
      };
    }

    return result;
  });
}

export async function previewReaderSyncRealServerAction(
  input?: unknown,
): Promise<ReaderSyncRealServerActionResponse> {
  const runtime = readRuntimeState();

  if (runtime.devTriggerEnabled !== true) {
    return createPreviewReaderSyncRealServerActionResponse();
  }

  if (
    runtime.allowRealDbIntegration !== true ||
    runtime.readerProgressDbTest !== true ||
    runtime.acknowledgeTestDbOnly !== true ||
    runtime.productionEnv === true
  ) {
    return buildBlockedDevOnlyResponse(input, [
      "DEV_DB_OPT_IN_REQUIRED: set the explicit dev/test DB opt-in flags before the wrapper can run.",
    ]);
  }

  try {
    const devUser = await ensureDevUserRecord(runtime);
    return await buildAllowedExecutionResponse(runtime, devUser, input);
  } catch {
    return buildBlockedDevOnlyResponse(input, [
      "DEV_DB_BOOTSTRAP_FAILED: the dev-only real DB bootstrap failed safely before execution completed.",
    ]);
  }
}


