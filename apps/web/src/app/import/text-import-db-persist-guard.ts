/**
 * Import DB persist guard.
 *
 * Guards writes from the text import flow to PostgreSQL/Prisma.
 * ALL real DB write paths are blocked by default and require
 * multiple explicit opt-in environment variables.
 *
 * DEFAULT: DB persist is disabled. Import saves go to the in-memory
 * dev store (restart-lost) or are no-op.
 *
 * To enable DB persist:
 *   1. LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true
 *   2. DATABASE_URL must be configured
 *   3. LAP_ALLOW_REAL_DB_INTEGRATION=true (existing project guard)
 *
 * Even when enabled, all UI labels and result metadata MUST indicate
 * "dev-only", "未接生产用户系统", "不要用于生产数据".
 *
 * @module text-import-db-persist-guard
 * @previewOnly — this module is a safety mechanism; it controls whether
 *                real DB writes can occur
 */

import { hasDatabaseUrl } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Guard result types
// ---------------------------------------------------------------------------

export interface ImportDbPersistGuardBlocker {
  code: string;
  message: string;
}

export interface ImportDbPersistGuardResult {
  /** Whether all conditions are met for DB persist. */
  enabled: boolean;
  /** Always "dev-only" — never production. */
  mode: "dev-only";
  /** Whether writes to the database are currently allowed. */
  writesDatabaseAllowed: boolean;
  /** Whether at least 2 env vars must be explicitly set. */
  requiresExplicitOptIn: true;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Human-readable blocked reasons, empty when enabled. */
  blockedReasons: string[];
  /** Safe to expose to client — no secrets, env values, or paths revealed. */
  safeToExposeToClient: true;
  /** Whether the in-memory dev store is being used instead (fallback). */
  fallsBackToDevStore: boolean;
}

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_IMPORT_DB_PERSIST = "LAP_IMPORT_DB_PERSIST_DEV_ENABLED";
const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

// ---------------------------------------------------------------------------
// Process-level cached reads (safe — Next.js does not reload env at runtime)
// ---------------------------------------------------------------------------

let cachedImportDbPersistEnabled: boolean | null = null;
let cachedAllowRealDbIntegration: boolean | null = null;

function readImportDbPersistEnabled(): boolean {
  if (cachedImportDbPersistEnabled !== null) {
    return cachedImportDbPersistEnabled;
  }
  try {
    cachedImportDbPersistEnabled =
      process.env[ENV_IMPORT_DB_PERSIST] === "true";
  } catch {
    cachedImportDbPersistEnabled = false;
  }
  return cachedImportDbPersistEnabled;
}

function readAllowRealDbIntegration(): boolean {
  if (cachedAllowRealDbIntegration !== null) {
    return cachedAllowRealDbIntegration;
  }
  try {
    cachedAllowRealDbIntegration =
      process.env[ENV_ALLOW_REAL_DB_INTEGRATION] === "true";
  } catch {
    cachedAllowRealDbIntegration = false;
  }
  return cachedAllowRealDbIntegration;
}

// ---------------------------------------------------------------------------
// Guard evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the import DB persist guard.
 *
 * Returns a result that can be safely serialized and sent to the client.
 * No env values, secrets, or connection strings are leaked.
 */
export function evaluateImportDbPersistGuard(): ImportDbPersistGuardResult {
  const importDbEnabled = readImportDbPersistEnabled();
  const allowRealDb = readAllowRealDbIntegration();
  const dbUrlConfigured = safeHasDatabaseUrl();
  const blockedReasons: string[] = [];

  if (!importDbEnabled) {
    blockedReasons.push(
      "IMPORT_DB_PERSIST_NOT_ENABLED: LAP_IMPORT_DB_PERSIST_DEV_ENABLED 未设置为 true。DB 持久化默认关闭。",
    );
  }

  if (!allowRealDb) {
    blockedReasons.push(
      "REAL_DB_INTEGRATION_NOT_ENABLED: LAP_ALLOW_REAL_DB_INTEGRATION 未设置为 true。项目全局真实 DB 集成门控未通过。",
    );
  }

  if (!dbUrlConfigured) {
    blockedReasons.push(
      "DATABASE_URL_NOT_CONFIGURED: DATABASE_URL 未配置。无法连接数据库。",
    );
  }

  const allEnabled = importDbEnabled && allowRealDb && dbUrlConfigured;

  return {
    enabled: allEnabled,
    mode: "dev-only",
    writesDatabaseAllowed: allEnabled,
    requiresExplicitOptIn: true,
    productionReady: false,
    blockedReasons,
    safeToExposeToClient: true,
    fallsBackToDevStore: !allEnabled,
  };
}

/**
 * Convenience check — returns true only when all DB persist preconditions are met.
 */
export function isImportDbPersistEnabled(): boolean {
  return evaluateImportDbPersistGuard().enabled;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely check DATABASE_URL without exposing the value.
 * Wraps hasDatabaseUrl() in a try/catch to guard against any edge-case errors.
 */
function safeHasDatabaseUrl(): boolean {
  try {
    return hasDatabaseUrl();
  } catch {
    return false;
  }
}
