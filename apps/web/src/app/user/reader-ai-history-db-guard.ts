/**
 * Reader AI History DB Guard — controls DB access for AI history storage.
 *
 * Guard layers (all default closed):
 * 1. LAP_ALLOW_REAL_DB_INTEGRATION=true
 * 2. DATABASE_URL present
 * 3. LAP_WEB_AUTH_DEV_ENABLED=true
 * 4. LAP_READER_AI_HISTORY_DB_DEV_ENABLED=true
 * 5. dev session exists
 *
 * When guard is closed:
 * - No repository access
 * - No DB writes
 * - Returns blocked
 * - localStorage fallback remains available
 *
 * Designation: **开发预览 · dev-only · 默认关闭 · 不写 DB**
 *
 * @module reader-ai-history-db-guard
 * @previewOnly
 */

export var LAP_READER_AI_HISTORY_DB_DEV_ENABLED_KEY = "LAP_READER_AI_HISTORY_DB_DEV_ENABLED";

export interface ReaderAiHistoryDbGuardEnv {
  LAP_ALLOW_REAL_DB_INTEGRATION?: string;
  DATABASE_URL?: string;
  LAP_WEB_AUTH_DEV_ENABLED?: string;
  LAP_READER_AI_HISTORY_DB_DEV_ENABLED?: string;
  hasDevSession?: boolean;
}

export interface ReaderAiHistoryDbGuardResult {
  enabled: boolean;
  blocked: boolean;
  blockedReasons: readonly string[];
  canRead: boolean;
  canWrite: boolean;
  devOnly: true;
  productionReady: false;
  notice: string;
  sourceLabel: string;
}

export function evaluateReaderAiHistoryDbGuard(
  env: ReaderAiHistoryDbGuardEnv,
): ReaderAiHistoryDbGuardResult {
  var reasons: string[] = [];

  var dbIntegration = parseBool(env.LAP_ALLOW_REAL_DB_INTEGRATION);
  if (!dbIntegration) {
    reasons.push("LAP_ALLOW_REAL_DB_INTEGRATION 未启用");
  }

  var hasDbUrl = typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0;
  if (!hasDbUrl) {
    reasons.push("DATABASE_URL 未配置");
  }

  var authEnabled = parseBool(env.LAP_WEB_AUTH_DEV_ENABLED);
  if (!authEnabled) {
    reasons.push("LAP_WEB_AUTH_DEV_ENABLED 未启用");
  }

  var historyEnabled = parseBool(env.LAP_READER_AI_HISTORY_DB_DEV_ENABLED);
  if (!historyEnabled) {
    reasons.push("LAP_READER_AI_HISTORY_DB_DEV_ENABLED 未启用");
  }

  if (!env.hasDevSession) {
    reasons.push("dev session 不存在");
  }

  var enabled = dbIntegration && hasDbUrl && authEnabled && historyEnabled;
  var blocked = reasons.length > 0;

  return {
    enabled: enabled,
    blocked: blocked,
    blockedReasons: reasons,
    canRead: enabled && env.hasDevSession === true,
    canWrite: enabled && env.hasDevSession === true,
    devOnly: true,
    productionReady: false,
    notice: blocked
      ? "Reader AI 历史 DB 未启用（" + reasons.join("; ") + "）。使用 localStorage fallback。"
      : "Reader AI 历史 DB 已启用（dev-only）。安全摘要存储到开发数据库。",
    sourceLabel: blocked ? "localStorage（DB 未启用）" : "开发 DB（dev-only）",
  };
}

function parseBool(val: string | undefined): boolean {
  if (val === undefined) return false;
  var v = val.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
