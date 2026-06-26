/**
 * Article Library DB Guard — controls whether dev-only article favorites
 * and recent reading can be persisted to the database.
 *
 * DEFAULT: ALL DB writes are disabled. Requires the project-wide
 * real DB integration gate AND an active dev session.
 */

import { hasDatabaseUrl } from "@learning-agent-platform/db";
import {
  deserializeDevSession,
  type DevSessionCookiePayload,
} from "../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";

export interface ArticleLibraryDbGuardResult {
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

const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

let cachedAllowRealDbIntegration: boolean | null = null;

function readAllowRealDbIntegration(): boolean {
  if (cachedAllowRealDbIntegration !== null) {
    return cachedAllowRealDbIntegration;
  }
  try {
    cachedAllowRealDbIntegration = process.env[ENV_ALLOW_REAL_DB_INTEGRATION] === "true";
  } catch {
    cachedAllowRealDbIntegration = false;
  }
  return cachedAllowRealDbIntegration;
}

export function evaluateArticleLibraryDbGuard(
  cookieValue: string | undefined,
): ArticleLibraryDbGuardResult {
  const allowRealDb = readAllowRealDbIntegration();
  const dbUrlConfigured = hasDatabaseUrl();
  const devAuthGuard = getDevAuthGuardStatus();
  const blockedReasons: string[] = [];

  if (!allowRealDb) {
    blockedReasons.push(
      "REAL_DB_INTEGRATION_NOT_ENABLED: LAP_ALLOW_REAL_DB_INTEGRATION 未设置为 true。项目全局真实 DB 集成未通过。",
    );
  }

  if (!dbUrlConfigured) {
    blockedReasons.push(
      "DATABASE_URL_NOT_CONFIGURED: DATABASE_URL 未配置。无法连接数据库。",
    );
  }

  if (!devAuthGuard.enabled) {
    blockedReasons.push(
      "DEV_AUTH_DISABLED: LAP_WEB_AUTH_DEV_ENABLED 未设置为 true。开发登录未启用，无法绑定文章数据。",
    );
  }

  const sessionPayload = deserializeDevSession(cookieValue);
  if (sessionPayload === null && devAuthGuard.enabled) {
    blockedReasons.push(
      "NO_DEV_SESSION: 当前无有效开发会话。请先通过 /login 登录 dev session。",
    );
  }

  const allEnabled =
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

export function isArticleLibraryDbEnabled(cookieValue: string | undefined): boolean {
  return evaluateArticleLibraryDbGuard(cookieValue).enabled;
}
