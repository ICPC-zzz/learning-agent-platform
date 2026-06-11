/**
 * Reader Notes DB Guard — controls whether dev-only reader notes
 * can be persisted to the database.
 *
 * DEFAULT: ALL DB writes are disabled. Requires multiple explicit opt-in
 * environment variables AND an active dev session.
 *
 * Guard layers:
 *   1. LAP_READER_NOTES_DB_DEV_ENABLED=true
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION=true (project global guard)
 *   3. DATABASE_URL configured
 *   4. LAP_WEB_AUTH_DEV_ENABLED=true (dev session guard)
 *   5. Dev session cookie present and valid
 *
 * Even when enabled, all UI labels and result metadata MUST indicate
 * "dev-only", "未接生产同步", "未接真实用户系统".
 *
 * @module reader-notes-db-guard
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

export interface ReaderNotesDbGuardBlocker {
  code: string;
  message: string;
}

export interface ReaderNotesDbGuardResult {
  enabled: boolean;
  mode: "dev-only";
  writesDatabaseAllowed: boolean;
  requiresExplicitOptIn: true;
  requiresDevSession: true;
  productionReady: false;
  blockedReasons: string[];
  safeToExposeToClient: true;
  callsRepository: boolean;
  sessionPayload: DevSessionCookiePayload | null;
}

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_READER_NOTES_DB = "LAP_READER_NOTES_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

// ---------------------------------------------------------------------------
// Process-level cached reads
// ---------------------------------------------------------------------------

let cachedReaderNotesDbEnabled: boolean | null = null;
let cachedAllowRealDbIntegration: boolean | null = null;

function readReaderNotesDbEnabled(): boolean {
  if (cachedReaderNotesDbEnabled !== null) {
    return cachedReaderNotesDbEnabled;
  }
  try {
    cachedReaderNotesDbEnabled =
      process.env[ENV_READER_NOTES_DB] === "true";
  } catch {
    cachedReaderNotesDbEnabled = false;
  }
  return cachedReaderNotesDbEnabled;
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

export function evaluateReaderNotesDbGuard(
  cookieValue: string | undefined,
): ReaderNotesDbGuardResult {
  const notesDbEnabled = readReaderNotesDbEnabled();
  const allowRealDb = readAllowRealDbIntegration();
  const dbUrlConfigured = safeHasDatabaseUrl();
  const devAuthGuard = getDevAuthGuardStatus();
  const blockedReasons: string[] = [];

  if (!notesDbEnabled) {
    blockedReasons.push(
      "READER_NOTES_DB_DISABLED: LAP_READER_NOTES_DB_DEV_ENABLED 未设置为 true。阅读器笔记 DB 持久化默认关闭。",
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
      "DEV_AUTH_DISABLED: LAP_WEB_AUTH_DEV_ENABLED 未设置为 true。开发登录未启用，无法绑定用户笔记。",
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
    notesDbEnabled &&
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

export function isReaderNotesDbEnabled(
  cookieValue: string | undefined,
): boolean {
  return evaluateReaderNotesDbGuard(cookieValue).enabled;
}

// ---------------------------------------------------------------------------
// Safe-to-expose status (for UI display)
// ---------------------------------------------------------------------------

export interface ReaderNotesDbStatusForUi {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  notice: string;
  requiresExplicitOptIn: true;
  requiresDevSession: true;
}

export function getReaderNotesDbStatusForUi(
  cookieValue: string | undefined,
): ReaderNotesDbStatusForUi {
  const guard = evaluateReaderNotesDbGuard(cookieValue);

  return {
    enabled: guard.enabled,
    mode: "dev-only",
    productionReady: false,
    requiresExplicitOptIn: true,
    requiresDevSession: true,
    notice: guard.enabled
      ? "阅读器笔记 DB 持久化已启用（dev-only）。笔记将绑定当前 dev session 用户，未接生产同步。"
      : guard.blockedReasons.length > 0
        ? `阅读器笔记 DB 持久化未启用：${guard.blockedReasons[0]}`
        : "阅读器笔记 DB 持久化默认关闭。本地笔记 fallback。",
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
