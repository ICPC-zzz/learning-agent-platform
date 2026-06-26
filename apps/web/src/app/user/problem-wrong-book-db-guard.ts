/**
 * Problem Wrong Book DB Guard — controls whether dev-only problem wrong book
 * data can be persisted to the database.
 *
 * DEFAULT: ALL DB writes are disabled. Requires multiple explicit opt-in
 * environment variables AND an active dev session.
 *
 * Guard layers:
 *   1. LAP_PROBLEM_WRONG_BOOK_DB_DEV_ENABLED=true
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION=true (project global guard)
 *   3. DATABASE_URL configured
 *   4. LAP_WEB_AUTH_DEV_ENABLED=true (dev session guard)
 *   5. Dev session cookie present and valid
 *
 * Even when enabled, all UI labels and result metadata MUST indicate
 * "dev-only", "未接生产同步", "未接真实用户系统".
 *
 * @module problem-wrong-book-db-guard
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

export interface ProblemWrongBookDbGuardResult {
  /** Whether all conditions are met for dev-only wrong book DB writes. */
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

const ENV_WRONG_BOOK_DB = "LAP_PROBLEM_WRONG_BOOK_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

// ---------------------------------------------------------------------------
// Process-level cached reads
// ---------------------------------------------------------------------------

let cachedWrongBookDbEnabled: boolean | null = null;
let cachedAllowRealDbIntegration: boolean | null = null;

function readWrongBookDbEnabled(): boolean {
  if (cachedWrongBookDbEnabled !== null) {
    return cachedWrongBookDbEnabled;
  }
  try {
    cachedWrongBookDbEnabled =
      process.env[ENV_WRONG_BOOK_DB] === "true";
  } catch {
    cachedWrongBookDbEnabled = false;
  }
  return cachedWrongBookDbEnabled;
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

export function evaluateProblemWrongBookDbGuard(
  cookieValue: string | undefined,
): ProblemWrongBookDbGuardResult {
  const wrongBookDbEnabled = readWrongBookDbEnabled();
  const allowRealDb = readAllowRealDbIntegration();
  const dbUrlConfigured = safeHasDatabaseUrl();
  const devAuthGuard = getDevAuthGuardStatus();
  const blockedReasons: string[] = [];

  if (!wrongBookDbEnabled) {
    blockedReasons.push(
      "WRONG_BOOK_DB_DISABLED: LAP_PROBLEM_WRONG_BOOK_DB_DEV_ENABLED 未设置为 true。错题本 DB 持久化默认关闭。",
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
      "DEV_AUTH_DISABLED: LAP_WEB_AUTH_DEV_ENABLED 未设置为 true。开发登录未启用，无法绑定错题记录。",
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
    wrongBookDbEnabled &&
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

export function isProblemWrongBookDbEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateProblemWrongBookDbGuard(cookieValue).enabled;
}

// ---------------------------------------------------------------------------
// Safe-to-expose status (for UI display)
// ---------------------------------------------------------------------------

export interface ProblemWrongBookDbStatusForUi {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  notice: string;
  requiresExplicitOptIn: true;
  requiresDevSession: true;
}

export function getProblemWrongBookDbStatusForUi(
  cookieValue: string | undefined,
): ProblemWrongBookDbStatusForUi {
  const guard = evaluateProblemWrongBookDbGuard(cookieValue);

  return {
    enabled: guard.enabled,
    mode: "dev-only",
    productionReady: false,
    requiresExplicitOptIn: true,
    requiresDevSession: true,
    notice: guard.enabled
      ? "错题本 DB 持久化已启用（dev-only）。记录将绑定当前 dev session 用户，未接生产同步。"
      : guard.blockedReasons.length > 0
        ? `错题本 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "错题本 DB 持久化默认关闭。本地错题本 fallback。",
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
