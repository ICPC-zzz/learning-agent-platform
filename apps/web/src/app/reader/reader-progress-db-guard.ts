/**
 * Reader Progress DB Guard — controls whether dev-only reading progress
 * can be persisted to the database.
 *
 * DEFAULT: ALL DB writes are disabled. Requires multiple explicit opt-in
 * environment variables AND an active dev session.
 *
 * Guard layers:
 *   1. LAP_READER_PROGRESS_DB_DEV_ENABLED=true
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION=true (project global guard)
 *   3. DATABASE_URL configured
 *   4. LAP_WEB_AUTH_DEV_ENABLED=true (dev session guard)
 *   5. Dev session cookie present and valid
 *
 * Even when enabled, all UI labels and result metadata MUST indicate
 * "dev-only", "未接生产同步", "未接真实用户系统".
 *
 * @module reader-progress-db-guard
 * @previewOnly — dev-only safety mechanism; production DB writes are blocked
 */

import { hasDatabaseUrl } from "@learning-agent-platform/db";
import {
  deserializeDevSession,
  type DevSessionCookiePayload,
} from "../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderProgressDbGuardBlocker {
  code: string;
  message: string;
}

export interface ReaderProgressDbGuardResult {
  /** Whether all conditions are met for dev-only progress DB writes. */
  enabled: boolean;
  /** Always "dev-only" — never production. */
  mode: "dev-only";
  /** Whether writes to the database are currently allowed. */
  writesDatabaseAllowed: boolean;
  /** Whether explicit opt-in env vars are required. */
  requiresExplicitOptIn: true;
  /** Whether a dev session is required. */
  requiresDevSession: true;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Human-readable blocked reasons, empty when enabled. */
  blockedReasons: string[];
  /** Safe to expose to client — no secrets, env values, or paths revealed. */
  safeToExposeToClient: true;
  /** Whether will attempt repository calls (only when all guards pass). */
  callsRepository: boolean;
  /** The dev session payload, or null when no session. */
  sessionPayload: DevSessionCookiePayload | null;
}

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_READER_PROGRESS_DB = "LAP_READER_PROGRESS_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

// ---------------------------------------------------------------------------
// Process-level cached reads
// ---------------------------------------------------------------------------

let cachedReaderProgressDbEnabled: boolean | null = null;
let cachedAllowRealDbIntegration: boolean | null = null;

function readReaderProgressDbEnabled(): boolean {
  if (cachedReaderProgressDbEnabled !== null) {
    return cachedReaderProgressDbEnabled;
  }
  try {
    cachedReaderProgressDbEnabled =
      process.env[ENV_READER_PROGRESS_DB] === "true";
  } catch {
    cachedReaderProgressDbEnabled = false;
  }
  return cachedReaderProgressDbEnabled;
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
 * Evaluate the reader progress DB guard.
 *
 * Checks all required conditions. Returns a result safe to serialize
 * to the client. Never exposes env values, secrets, or connection strings.
 *
 * @param cookieValue - The raw dev session cookie value (lap-web-dev-session)
 */
export function evaluateReaderProgressDbGuard(
  cookieValue: string | undefined,
): ReaderProgressDbGuardResult {
  const readerProgressEnabled = readReaderProgressDbEnabled();
  const allowRealDb = readAllowRealDbIntegration();
  const dbUrlConfigured = safeHasDatabaseUrl();
  const devAuthGuard = getDevAuthGuardStatus();
  const blockedReasons: string[] = [];

  if (!readerProgressEnabled) {
    blockedReasons.push(
      "READER_PROGRESS_DB_DISABLED: LAP_READER_PROGRESS_DB_DEV_ENABLED 未设置为 true。阅读进度 DB 持久化默认关闭。",
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

  if (!devAuthGuard.enabled) {
    blockedReasons.push(
      "DEV_AUTH_DISABLED: LAP_WEB_AUTH_DEV_ENABLED 未设置为 true。开发登录未启用，无法绑定用户进度。",
    );
  }

  const sessionPayload = deserializeDevSession(cookieValue);

  if (sessionPayload === null) {
    if (devAuthGuard.enabled) {
      blockedReasons.push(
        "NO_DEV_SESSION: 当前无有效开发会话。请先通过 /login 登录 dev session。",
      );
    }
  }

  const allEnabled =
    readerProgressEnabled &&
    allowRealDb &&
    dbUrlConfigured &&
    devAuthGuard.enabled &&
    sessionPayload !== null;

  return {
    enabled: allEnabled,
    mode: "dev-only",
    writesDatabaseAllowed: allEnabled,
    requiresExplicitOptIn: true,
    requiresDevSession: true,
    productionReady: false,
    blockedReasons,
    safeToExposeToClient: true,
    callsRepository: allEnabled,
    sessionPayload,
  };
}

/**
 * Convenience — returns true only when all preconditions are met.
 */
export function isReaderProgressDbEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateReaderProgressDbGuard(cookieValue).enabled;
}

// ---------------------------------------------------------------------------
// Safe-to-expose status (for UI display)
// ---------------------------------------------------------------------------

export interface ReaderProgressDbStatusForUi {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  notice: string;
  requiresExplicitOptIn: true;
  requiresDevSession: true;
}

/**
 * Build a UI-safe status object from the guard result.
 * Never exposes env values or raw cookie data.
 */
export function getReaderProgressDbStatusForUi(
  cookieValue: string | undefined,
): ReaderProgressDbStatusForUi {
  const guard = evaluateReaderProgressDbGuard(cookieValue);

  return {
    enabled: guard.enabled,
    mode: "dev-only",
    productionReady: false,
    requiresExplicitOptIn: true,
    requiresDevSession: true,
    notice: guard.enabled
      ? "阅读进度 DB 持久化已启用（dev-only）。进度将绑定当前 dev session 用户，未接生产同步。"
      : guard.blockedReasons.length > 0
        ? `阅读进度 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "阅读进度 DB 持久化默认关闭。",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeHasDatabaseUrl(): boolean {
  try {
    return hasDatabaseUrl();
  } catch {
    return false;
  }
}
