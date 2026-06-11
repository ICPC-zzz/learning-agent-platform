/**
 * Text Import Owner Context — bridges dev session to book owner ID.
 *
 * Extracts a safe owner identifier from the current dev session for use
 * when persisting imported books to the database. The ownerId is always
 * the dev session's userIdPreview — never a real DB user primary key.
 *
 * Safety:
 * - Never outputs cookie raw values, tokens, or secrets.
 * - Always returns a safe summary, not raw session data.
 * - Blocked reasons are explicit and human-readable.
 *
 * @module text-import-owner-context
 * @previewOnly — dev-only, not production user association
 */

import {
  deserializeDevSession,
  type DevSessionCookiePayload,
  type DevSessionSafeSummary,
} from "../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";
import { evaluateImportDbPersistGuard } from "./text-import-db-persist-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportOwnerContext {
  /** Whether a usable owner identity is available. */
  hasOwner: boolean;
  /** The owner identifier to use when creating books (userIdPreview). */
  ownerId: string | null;
  /** Display label for UI (from session displayName). */
  ownerLabel: string | null;
  /** Session summary for UI display. */
  sessionSummary: DevSessionSafeSummary;
  /** Whether the DB persist guard is enabled. */
  dbPersistEnabled: boolean;
  /** Whether the dev auth guard is enabled. */
  devAuthEnabled: boolean;
  /** Blocked reasons — why owner context is unavailable. */
  blockedReasons: string[];
  /** Safe to serialize to client. */
  safeToExposeToClient: true;
  /** Always "dev-only" — never production. */
  mode: "dev-only";
}

// ---------------------------------------------------------------------------
// Context resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the import owner context from the current request's dev session cookie.
 *
 * @param cookieValue - The raw cookie value from the request (lap-web-dev-session)
 * @returns ImportOwnerContext with safe summary, never raw cookie/token/secrets
 */
export function resolveImportOwnerContext(
  cookieValue: string | undefined,
): ImportOwnerContext {
  const devAuthGuard = getDevAuthGuardStatus();
  const dbPersistGuard = evaluateImportDbPersistGuard();
  const blockedReasons: string[] = [];

  if (!devAuthGuard.enabled) {
    blockedReasons.push(
      "DEV_AUTH_DISABLED: 开发登录未启用 (LAP_WEB_AUTH_DEV_ENABLED 未设置为 true)。无法关联用户。",
    );
  }

  if (!dbPersistGuard.enabled) {
    blockedReasons.push(
      "DB_PERSIST_DISABLED: DB 持久化未启用。无法写入用户归属。",
    );
  }

  const payload = deserializeDevSession(cookieValue);

  if (payload === null) {
    if (devAuthGuard.enabled) {
      blockedReasons.push(
        "NO_DEV_SESSION: 当前无有效开发会话。请先通过 /login 登录 dev session。",
      );
    }

    return {
      hasOwner: false,
      ownerId: null,
      ownerLabel: null,
      sessionSummary: {
        hasSession: false,
        user: null,
        sessionMode: null,
        productionReady: false,
        status: "未登录",
        notice: "无 dev session，无法关联导入书籍用户归属。",
      },
      dbPersistEnabled: dbPersistGuard.enabled,
      devAuthEnabled: devAuthGuard.enabled,
      blockedReasons,
      safeToExposeToClient: true,
      mode: "dev-only",
    };
  }

  // Has session — build safe owner context
  return {
    hasOwner: devAuthGuard.enabled && dbPersistGuard.enabled,
    ownerId: payload.userIdPreview,
    ownerLabel: payload.displayName,
    sessionSummary: {
      hasSession: true,
      user: {
        userIdPreview: payload.userIdPreview,
        displayName: payload.displayName,
        role: payload.role,
      },
      sessionMode: payload.sessionMode,
      productionReady: false,
      status: "开发会话已连接",
      notice: devAuthGuard.enabled && dbPersistGuard.enabled
        ? "dev session 归属 · 未接生产账号 · 导入书籍将关联到此开发用户"
        : "dev session 已连接，但 DB 持久化未启用，导入书籍不会写入用户归属",
    },
    dbPersistEnabled: dbPersistGuard.enabled,
    devAuthEnabled: devAuthGuard.enabled,
    blockedReasons,
    safeToExposeToClient: true,
    mode: "dev-only",
  };
}

// ---------------------------------------------------------------------------
// Blocked context convenience
// ---------------------------------------------------------------------------

/**
 * Build a blocked owner context when no cookie is available.
 * Used in test environments or when the server action cannot read cookies.
 */
export function createBlockedImportOwnerContext(
  reason: string,
): ImportOwnerContext {
  const devAuthGuard = getDevAuthGuardStatus();
  const dbPersistGuard = evaluateImportDbPersistGuard();

  return {
    hasOwner: false,
    ownerId: null,
    ownerLabel: null,
    sessionSummary: {
      hasSession: false,
      user: null,
      sessionMode: null,
      productionReady: false,
      status: "未登录",
      notice: reason,
    },
    dbPersistEnabled: dbPersistGuard.enabled,
    devAuthEnabled: devAuthGuard.enabled,
    blockedReasons: [reason],
    safeToExposeToClient: true,
    mode: "dev-only",
  };
}

// ---------------------------------------------------------------------------
// Sensitive field check (defense in depth)
// ---------------------------------------------------------------------------

const SENSITIVE_CONTEXT_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
];

/**
 * Verify that the owner context contains no sensitive fields.
 * Always returns true for valid contexts — this is for tests.
 */
export function importOwnerContextIsSafe(context: ImportOwnerContext): boolean {
  const json = JSON.stringify(context);
  return !SENSITIVE_CONTEXT_PATTERNS.some((p) => p.test(json));
}
