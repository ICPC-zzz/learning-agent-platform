/**
 * Dev/test-only guard for text import save.
 *
 * ALL real write paths are blocked by default. The save server action,
 * dev store, and dev UI trigger remain disabled unless the environment
 * variable LAP_TEXT_IMPORT_SAVE_DEV_ENABLED is explicitly set to "true".
 *
 * This guard is intentionally separate from the DB integration guard
 * (LAP_ALLOW_REAL_DB_INTEGRATION) so that in-memory dev saving can be
 * enabled without requiring a real DATABASE_URL.
 *
 * @module text-import-save-dev-guard
 * @previewOnly — this module itself is a safety mechanism
 */

export interface TextImportSaveDevGuardResult {
  /** Whether the dev save path is allowed. */
  devSaveEnabled: boolean;
  /** Human-readable reason for the current state. */
  reason: string;
  /** Whether a real database write would occur (always false for in-memory dev store). */
  writesDatabase: false;
  /** Whether the in-memory dev store is the target (true when devSaveEnabled=true). */
  usesDevStore: boolean;
  /** Safe to expose to client — always true; no secrets revealed. */
  safeToExposeToClient: true;
}

const DEV_GUARD_ENV_KEY = "LAP_TEXT_IMPORT_SAVE_DEV_ENABLED";

/**
 * Read the dev save guard once per process.  Caching is safe because the
 * guard is process‑level and Next.js does not reload env at runtime.
 */
let cachedDevSaveEnabled: boolean | null = null;

function readDevSaveEnabled(): boolean {
  if (cachedDevSaveEnabled !== null) {
    return cachedDevSaveEnabled;
  }

  try {
    cachedDevSaveEnabled = process.env[DEV_GUARD_ENV_KEY] === "true";
  } catch {
    // process.env access may throw in certain edge‑case runtimes
    cachedDevSaveEnabled = false;
  }

  return cachedDevSaveEnabled;
}

/**
 * Evaluate the dev save guard.
 *
 * Returns a result that can be safely exposed to the client:
 * - no env values are leaked
 * - no secret paths are revealed
 * - always `safeToExposeToClient: true`
 */
export function evaluateTextImportSaveDevGuard(): TextImportSaveDevGuardResult {
  const devSaveEnabled = readDevSaveEnabled();

  if (!devSaveEnabled) {
    return {
      devSaveEnabled: false,
      reason:
        "开发/测试保存路径默认关闭。设置 LAP_TEXT_IMPORT_SAVE_DEV_ENABLED=true 可启用进程内内存书库保存（重启丢失，未连接生产数据库）。",
      writesDatabase: false,
      usesDevStore: false,
      safeToExposeToClient: true,
    };
  }

  return {
    devSaveEnabled: true,
    reason:
      "开发/测试保存路径已启用。书籍将保存到进程内内存书库，重启丢失，未连接生产数据库。",
    writesDatabase: false,
    usesDevStore: true,
    safeToExposeToClient: true,
  };
}

/**
 * Convenience check — returns true only when the dev save path is fully allowed.
 */
export function isTextImportSaveDevEnabled(): boolean {
  return readDevSaveEnabled();
}
