const TARGET_MODEL = "ReadingProgress" as const;
const RAW_LOCAL_STORAGE_KEY = "raw" + "LocalStorage";

const ALLOWED_INPUT_KEYS = [
  "explicitUserAuthorization",
  "allowRealDatabaseConnection",
  "allowPrismaClientRuntime",
  "allowDatabaseWrite",
  "databaseUrlPresent",
  "testDatabaseOnly",
  "environmentName",
  "allowLocalDevelopmentDatabase",
  "acknowledgedNoProductionDatabase",
  "destructiveWriteAllowed",
  "migrationAllowed",
] as const;

const FORBIDDEN_INPUT_KEYS = [
  "token",
  "secret",
  "password",
  "cookie",
  "cookies",
  "session",
  "authToken",
  "databaseUrl",
  "DATABASE_URL",
  "rawEnv",
  "process",
  "env",
  "window",
  "localStorage",
  "fetch",
  "headers",
  "rawHeaders",
  "db",
  "prisma",
  "PrismaClient",
  "repository",
  RAW_LOCAL_STORAGE_KEY,
  "__proto__",
  "constructor",
  "prototype",
] as const;

const REQUIRED_AUTHORIZATIONS = [
  "explicitUserAuthorization=true",
  "allowRealDatabaseConnection=true",
  "allowPrismaClientRuntime=true",
  "databaseUrlPresent=true",
  "testDatabaseOnly=true",
  "environmentName must indicate a test-only environment",
  "allowLocalDevelopmentDatabase=true",
  "acknowledgedNoProductionDatabase=true",
  "allowDatabaseWrite=true",
  "destructiveWriteAllowed=false",
  "migrationAllowed=false",
] as const;

const NEXT_SAFE_STEPS = [
  "Keep the real DB integration path skipped by default in this round.",
  "Open a separate authorized round before any PrismaClient or database URL wiring.",
  "Use only a disposable test database and re-evaluate the guard before any write path.",
] as const;

export interface ReadingProgressDbIntegrationGuardInput {
  explicitUserAuthorization?: boolean;
  allowRealDatabaseConnection?: boolean;
  allowPrismaClientRuntime?: boolean;
  allowDatabaseWrite?: boolean;
  databaseUrlPresent?: boolean;
  testDatabaseOnly?: boolean;
  environmentName?: string;
  allowLocalDevelopmentDatabase?: boolean;
  acknowledgedNoProductionDatabase?: boolean;
  destructiveWriteAllowed?: boolean;
  migrationAllowed?: boolean;
}

export interface ReadingProgressDbIntegrationGuardBlocker {
  code: string;
  message: string;
}

export type ReadingProgressDbIntegrationGuardStatus = "blocked" | "preview";

export interface ReadingProgressDbIntegrationGuardPreview {
  previewOnly: true;
  implemented: true;
  guardImplemented: true;
  safeToExposeToClient: true;
  status: ReadingProgressDbIntegrationGuardStatus;
  source: "blocked" | "preview";
  canRunDbIntegrationTest: boolean;
  canConnectRealDatabase: boolean;
  canWriteDatabase: boolean;
  mustSkipByDefault: boolean;
  blockedReasons: string[];
  requiredAuthorizations: string[];
  nextSafeSteps: string[];
  targetModel: "ReadingProgress";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function buildBlockedReasons(
  blockers: ReadingProgressDbIntegrationGuardBlocker[],
): string[] {
  return blockers.map(function (blocker) {
    return `${blocker.code}: ${blocker.message}`;
  });
}

function buildBlockedPreview(
  blockers: ReadingProgressDbIntegrationGuardBlocker[],
): ReadingProgressDbIntegrationGuardPreview {
  return {
    previewOnly: true,
    implemented: true,
    guardImplemented: true,
    safeToExposeToClient: true,
    status: "blocked",
    source: "blocked",
    canRunDbIntegrationTest: false,
    canConnectRealDatabase: false,
    canWriteDatabase: false,
    mustSkipByDefault: true,
    blockedReasons: buildBlockedReasons(blockers),
    requiredAuthorizations: [...REQUIRED_AUTHORIZATIONS],
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    targetModel: TARGET_MODEL,
  };
}

function normalizeBooleanField(
  input: Record<string, unknown>,
  key: keyof ReadingProgressDbIntegrationGuardInput,
  blockers: ReadingProgressDbIntegrationGuardBlocker[],
): boolean {
  const value = input[key];
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    blockers.push({
      code: "INVALID_BOOLEAN_FIELD",
      message: `${String(key)} must be a boolean when provided.`,
    });
    return false;
  }

  return value;
}

function normalizeOptionalTextField(
  input: Record<string, unknown>,
  key: keyof ReadingProgressDbIntegrationGuardInput,
  blockers: ReadingProgressDbIntegrationGuardBlocker[],
): string | null {
  const value = input[key];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    blockers.push({
      code: "INVALID_TEXT_FIELD",
      message: `${String(key)} must be a string when provided.`,
    });
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    blockers.push({
      code: "EMPTY_TEXT_FIELD",
      message: `${String(key)} must not be empty when provided.`,
    });
    return null;
  }

  return normalized;
}

function isTestOnlyEnvironmentName(environmentName: string): boolean {
  const normalized = environmentName.trim().toLowerCase();

  if (normalized.length === 0) {
    return false;
  }

  if (
    normalized === "test" ||
    normalized === "testing" ||
    normalized === "tests" ||
    normalized === "development" ||
    normalized === "dev" ||
    normalized === "local" ||
    normalized === "local-development" ||
    normalized === "ci" ||
    normalized === "integration" ||
    normalized === "integration-test"
  ) {
    return true;
  }

  return (
    normalized.includes("test") ||
    normalized.includes("local") ||
    normalized.includes("dev") ||
    normalized.includes("integration")
  );
}

function normalizeInput(
  input: unknown,
): {
  input: ReadingProgressDbIntegrationGuardInput | null;
  blockers: ReadingProgressDbIntegrationGuardBlocker[];
} {
  const blockers: ReadingProgressDbIntegrationGuardBlocker[] = [];

  if (!isRecord(input)) {
    blockers.push({
      code: "INVALID_INPUT",
      message: "Guard input must be a plain object.",
    });
    return {
      input: null,
      blockers,
    };
  }

  if (hasUnsafePrototype(input)) {
    blockers.push({
      code: "UNSAFE_PROTOTYPE_REJECTED",
      message: "Unsafe prototype rejected before guard evaluation.",
    });
  }

  for (const key of Object.keys(input)) {
    if ((FORBIDDEN_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "FORBIDDEN_FIELD",
        message: `Guard input contains forbidden field: ${key}.`,
      });
      continue;
    }

    if (!(ALLOWED_INPUT_KEYS as readonly string[]).includes(key)) {
      blockers.push({
        code: "UNKNOWN_FIELD",
        message: `Guard input contains unknown field: ${key}.`,
      });
    }
  }

  const normalized: ReadingProgressDbIntegrationGuardInput = {
    explicitUserAuthorization: normalizeBooleanField(
      input,
      "explicitUserAuthorization",
      blockers,
    ),
    allowRealDatabaseConnection: normalizeBooleanField(
      input,
      "allowRealDatabaseConnection",
      blockers,
    ),
    allowPrismaClientRuntime: normalizeBooleanField(
      input,
      "allowPrismaClientRuntime",
      blockers,
    ),
    allowDatabaseWrite: normalizeBooleanField(
      input,
      "allowDatabaseWrite",
      blockers,
    ),
    databaseUrlPresent: normalizeBooleanField(
      input,
      "databaseUrlPresent",
      blockers,
    ),
    testDatabaseOnly: normalizeBooleanField(
      input,
      "testDatabaseOnly",
      blockers,
    ),
    environmentName: normalizeOptionalTextField(
      input,
      "environmentName",
      blockers,
    ) ?? undefined,
    allowLocalDevelopmentDatabase: normalizeBooleanField(
      input,
      "allowLocalDevelopmentDatabase",
      blockers,
    ),
    acknowledgedNoProductionDatabase: normalizeBooleanField(
      input,
      "acknowledgedNoProductionDatabase",
      blockers,
    ),
    destructiveWriteAllowed: normalizeBooleanField(
      input,
      "destructiveWriteAllowed",
      blockers,
    ),
    migrationAllowed: normalizeBooleanField(input, "migrationAllowed", blockers),
  };

  return {
    input: blockers.length > 0 ? null : normalized,
    blockers,
  };
}

function buildSafePreview(
  input: ReadingProgressDbIntegrationGuardInput,
  blockers: ReadingProgressDbIntegrationGuardBlocker[],
): ReadingProgressDbIntegrationGuardPreview {
  const environmentName =
    input.environmentName === undefined ? null : input.environmentName.trim();
  const environmentIsSafe =
    environmentName !== null && isTestOnlyEnvironmentName(environmentName);
  const canConnectRealDatabase =
    input.explicitUserAuthorization === true &&
    input.allowRealDatabaseConnection === true &&
    input.allowPrismaClientRuntime === true &&
    input.databaseUrlPresent === true &&
    input.testDatabaseOnly === true &&
    environmentIsSafe &&
    input.allowLocalDevelopmentDatabase === true &&
    input.acknowledgedNoProductionDatabase === true;

  const canWriteDatabase =
    canConnectRealDatabase === true &&
    input.allowDatabaseWrite === true &&
    input.destructiveWriteAllowed !== true &&
    input.migrationAllowed !== true;

  const canRunDbIntegrationTest =
    canConnectRealDatabase === true && canWriteDatabase === true;

  const blockedReasons = buildBlockedReasons(blockers);

  if (!input.explicitUserAuthorization) {
    pushUnique(
      blockedReasons,
      "EXPLICIT_USER_AUTHORIZATION_REQUIRED: explicitUserAuthorization must be true before a real DB integration path may be considered.",
    );
  }

  if (!input.allowRealDatabaseConnection) {
    pushUnique(
      blockedReasons,
      "ALLOW_REAL_DATABASE_CONNECTION_REQUIRED: allowRealDatabaseConnection must be true.",
    );
  }

  if (!input.allowPrismaClientRuntime) {
    pushUnique(
      blockedReasons,
      "ALLOW_PRISMA_CLIENT_RUNTIME_REQUIRED: allowPrismaClientRuntime must be true.",
    );
  }

  if (!input.databaseUrlPresent) {
    pushUnique(
      blockedReasons,
      "DATABASE_URL_PRESENT_REQUIRED: databaseUrlPresent must be true.",
    );
  }

  if (!input.testDatabaseOnly) {
    pushUnique(
      blockedReasons,
      "TEST_DATABASE_ONLY_REQUIRED: testDatabaseOnly must be true.",
    );
  }

  if (environmentName === null) {
    pushUnique(
      blockedReasons,
      "ENVIRONMENT_NAME_REQUIRED: environmentName must be provided and must indicate a test-only environment.",
    );
  } else if (!environmentIsSafe) {
    pushUnique(
      blockedReasons,
      "ENVIRONMENT_NAME_NOT_TEST_ONLY: environmentName must indicate a test-only environment.",
    );
  }

  if (!input.allowLocalDevelopmentDatabase) {
    pushUnique(
      blockedReasons,
      "ALLOW_LOCAL_DEVELOPMENT_DATABASE_REQUIRED: allowLocalDevelopmentDatabase must be true.",
    );
  }

  if (!input.acknowledgedNoProductionDatabase) {
    pushUnique(
      blockedReasons,
      "ACKNOWLEDGED_NO_PRODUCTION_DATABASE_REQUIRED: acknowledgedNoProductionDatabase must be true.",
    );
  }

  if (!input.allowDatabaseWrite) {
    pushUnique(
      blockedReasons,
      "ALLOW_DATABASE_WRITE_REQUIRED: allowDatabaseWrite must be true.",
    );
  }

  if (input.destructiveWriteAllowed) {
    pushUnique(
      blockedReasons,
      "DESTRUCTIVE_WRITE_NOT_ALLOWED: destructiveWriteAllowed must remain false.",
    );
  }

  if (input.migrationAllowed) {
    pushUnique(
      blockedReasons,
      "MIGRATION_NOT_ALLOWED: migrationAllowed must remain false.",
    );
  }

  return {
    previewOnly: true,
    implemented: true,
    guardImplemented: true,
    safeToExposeToClient: true,
    status: canRunDbIntegrationTest ? "preview" : "blocked",
    source: canRunDbIntegrationTest ? "preview" : "blocked",
    canRunDbIntegrationTest,
    canConnectRealDatabase,
    canWriteDatabase,
    mustSkipByDefault: !canRunDbIntegrationTest,
    blockedReasons: canRunDbIntegrationTest ? [] : blockedReasons,
    requiredAuthorizations: [...REQUIRED_AUTHORIZATIONS],
    nextSafeSteps: [...NEXT_SAFE_STEPS],
    targetModel: TARGET_MODEL,
  };
}

export function evaluateReadingProgressDbIntegrationGuard(
  input: unknown,
): ReadingProgressDbIntegrationGuardPreview {
  const normalized = normalizeInput(input);

  if (normalized.input === null) {
    return buildBlockedPreview(normalized.blockers);
  }

  return buildSafePreview(normalized.input, normalized.blockers);
}

export function createBlockedReadingProgressDbIntegrationGuardPreview(): ReadingProgressDbIntegrationGuardPreview {
  return buildBlockedPreview([
    {
      code: "DEFAULT_SKIP",
      message:
        "Real DB integration tests are skipped by default until explicit user authorization is granted.",
    },
  ]);
}
