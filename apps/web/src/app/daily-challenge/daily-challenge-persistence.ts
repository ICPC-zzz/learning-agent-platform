/**
 * Daily Challenge Persistence — unified read/write abstraction over
 * localStorage (default) and dev-only DB repository (guarded).
 *
 * DEFAULT: localStorage only. DB writes are blocked until multiple
 * explicit environment variable opt-ins are set.
 *
 * Guard layers:
 *   1. LAP_DAILY_CHALLENGE_DB_DEV_ENABLED=true
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION=true (project-level global guard)
 *   3. DATABASE_URL configured
 *
 * When guard is OFF: localStorage only.
 * When guard is ON: attempts DB read/write; falls back to localStorage
 *   on any DB error or when the repository is unavailable.
 *
 * All result objects carry safety metadata:
 *   source, writesDatabase, productionReady, safeToExposeToClient,
 *   llmUsed, externalApiUsed
 *
 * @module daily-challenge-persistence
 * @previewOnly — dev-only; DB writes are disabled by default; no LLM
 */

import type { DailyChallengeState } from "../../lib/local-daily-challenge-store.ts";
import {
  loadDailyChallenge as loadFromLocalStorage,
  persistDailyChallenge as saveToLocalStorage,
  clearDailyChallenge as clearLocalStorage,
} from "../../lib/local-daily-challenge-store.ts";

// ---------------------------------------------------------------------------
// Local repository interface (mirrors packages/db daily-challenge-progress-repository.ts)
// ---------------------------------------------------------------------------

export type DailyChallengeProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "needs-review";

export interface DailyChallengeProgressRecord {
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: DailyChallengeProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendationSource: string;
  recommendationReason: string;
}

export interface DailyChallengeProgressUpsertInput {
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: DailyChallengeProgressStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  recommendationSource: string;
  recommendationReason: string;
}

export interface DailyChallengeProgressSafetyMetadata {
  productionReady: false;
  llmUsed: false;
  externalApiUsed: false;
  safeToExposeToClient: true;
  writesDatabase: boolean;
  guardActive: boolean;
  status: "blocked" | "preview";
  blockedReasons: string[];
}

export interface DailyChallengeProgressFindResult {
  record: DailyChallengeProgressRecord | null;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressUpsertResult {
  record: DailyChallengeProgressRecord | null;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressClearResult {
  success: boolean;
  metadata: DailyChallengeProgressSafetyMetadata;
}

export interface DailyChallengeProgressRepository {
  findByDate(date: string): Promise<DailyChallengeProgressFindResult>;
  upsertProgress(input: DailyChallengeProgressUpsertInput): Promise<DailyChallengeProgressUpsertResult>;
  clearToday(date: string): Promise<DailyChallengeProgressClearResult>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersistenceSource =
  | "localStorage"
  | "db-dev-preview"
  | "fallback";

export interface DailyChallengePersistenceResult {
  /** Whether the operation succeeded. */
  success: boolean;
  /** The daily challenge state, or null if not found or error. */
  data: DailyChallengeState | null;
  /** Where the data was read from or written to. */
  source: PersistenceSource;
  /** Whether this operation wrote to the database. */
  writesDatabase: boolean;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Always true — contains no secrets, env values, or connection strings. */
  safeToExposeToClient: true;
  /** Always false — this module never calls an LLM. */
  llmUsed: false;
  /** Always false — this module never calls an external API. */
  externalApiUsed: false;
  /** Whether the DB guard is currently active. */
  guardActive: boolean;
  /** DB error message, if any (null when no error). Safe to display. */
  dbError: string | null;
  /** Human-readable notice describing the current data source. */
  notice: string;
}

export interface DailyChallengePersistenceStore {
  load(): Promise<DailyChallengePersistenceResult>;
  save(state: DailyChallengeState): Promise<DailyChallengePersistenceResult>;
  clear(): Promise<{ success: boolean; source: PersistenceSource }>;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

const ENV_DB_ENABLED = "LAP_DAILY_CHALLENGE_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB = "LAP_ALLOW_REAL_DB_INTEGRATION";

/**
 * Check whether the daily challenge DB dev-only guard is active.
 * Safe to call in any environment — does NOT throw.
 */
export function isDailyChallengeDbGuardActive(): boolean {
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      return false;
    }
    const dailyChallengeDb = process.env[ENV_DB_ENABLED] === "true";
    const allowRealDb = process.env[ENV_ALLOW_REAL_DB] === "true";
    const hasDbUrl = safeHasDatabaseUrl();
    return dailyChallengeDb && allowRealDb && hasDbUrl;
  } catch {
    return false;
  }
}

function safeHasDatabaseUrl(): boolean {
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      return false;
    }
    const url = process.env["DATABASE_URL"];
    return typeof url === "string" && url.trim().length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Persistence implementation
// ---------------------------------------------------------------------------

/**
 * Load the daily challenge state. Prefers localStorage; attempts DB
 * only when the guard is active and falls back to localStorage on error.
 */
async function loadDailyChallengePersistence(
  dbRepo?: DailyChallengeProgressRepository | null,
): Promise<DailyChallengePersistenceResult> {
  const guardActive =
    typeof dbRepo === "object" && dbRepo !== null && isDailyChallengeDbGuardActive();

  // Always read from localStorage first (fast, always available)
  const localState = loadFromLocalStorage();

  // If guard is not active, return localStorage result directly
  if (!guardActive) {
    if (localState !== null) {
      return {
        success: true,
        data: localState,
        source: "localStorage",
        writesDatabase: false,
        productionReady: false,
        safeToExposeToClient: true,
        llmUsed: false,
        externalApiUsed: false,
        guardActive: false,
        dbError: null,
        notice: "每日挑战数据来自 localStorage 本地存储 · 未调用 LLM · 开发预览",
      };
    }
    return {
      success: true,
      data: null,
      source: "localStorage",
      writesDatabase: false,
      productionReady: false,
      safeToExposeToClient: true,
      llmUsed: false,
      externalApiUsed: false,
      guardActive: false,
      dbError: null,
      notice: "每日挑战数据暂无（localStorage）· 未调用 LLM · 开发预览",
    };
  }

  // Guard is active — try DB read
  try {
    const result = await dbRepo!.findByDate(getTodayDateStringCompat());
    if (result !== null && result.record !== null) {
      const dbState = dbRecordToChallengeState(result.record);
      if (dbState !== null) {
        return {
          success: true,
          data: dbState,
          source: "db-dev-preview",
          writesDatabase: false,
          productionReady: false,
          safeToExposeToClient: true,
          llmUsed: false,
          externalApiUsed: false,
          guardActive: true,
          dbError: null,
          notice: "每日挑战数据来自开发 DB（dev-only）· 未调用 LLM · 开发预览",
        };
      }
    }
  } catch (err) {
    const dbErrorMessage = err instanceof Error ? err.message : "未知 DB 错误";
    if (localState !== null) {
      return {
        success: true,
        data: localState,
        source: "fallback",
        writesDatabase: false,
        productionReady: false,
        safeToExposeToClient: true,
        llmUsed: false,
        externalApiUsed: false,
        guardActive: true,
        dbError: dbErrorMessage,
        notice: "每日挑战数据来自 localStorage（DB 读取失败，已降级）· 未调用 LLM · 开发预览",
      };
    }
    return {
      success: false,
      data: null,
      source: "fallback",
      writesDatabase: false,
      productionReady: false,
      safeToExposeToClient: true,
      llmUsed: false,
      externalApiUsed: false,
      guardActive: true,
      dbError: dbErrorMessage,
      notice: "每日挑战数据不可用（DB 读取失败且 localStorage 无数据）· 未调用 LLM · 开发预览",
    };
  }

  // DB returned null record — fallback to localStorage
  if (localState !== null) {
    return {
      success: true,
      data: localState,
      source: "fallback",
      writesDatabase: false,
      productionReady: false,
      safeToExposeToClient: true,
      llmUsed: false,
      externalApiUsed: false,
      guardActive: true,
      dbError: null,
      notice: "每日挑战数据来自 localStorage（DB 无记录）· 未调用 LLM · 开发预览",
    };
  }

  return {
    success: true,
    data: null,
    source: "fallback",
    writesDatabase: false,
    productionReady: false,
    safeToExposeToClient: true,
    llmUsed: false,
    externalApiUsed: false,
    guardActive: true,
    dbError: null,
    notice: "每日挑战数据暂无（DB 和 localStorage 均无记录）· 未调用 LLM · 开发预览",
  };
}

/**
 * Persist the daily challenge state. Writes to localStorage always;
 * attempts DB write only when the guard is active. localStorage write
 * is always attempted regardless of DB success/failure.
 */
async function saveDailyChallengePersistence(
  state: DailyChallengeState,
  dbRepo?: DailyChallengeProgressRepository | null,
): Promise<DailyChallengePersistenceResult> {
  // Always persist to localStorage
  const localSaved = saveToLocalStorage(state);

  const guardActive =
    typeof dbRepo === "object" && dbRepo !== null && isDailyChallengeDbGuardActive();

  if (!guardActive) {
    return {
      success: localSaved,
      data: localSaved ? state : null,
      source: "localStorage",
      writesDatabase: false,
      productionReady: false,
      safeToExposeToClient: true,
      llmUsed: false,
      externalApiUsed: false,
      guardActive: false,
      dbError: null,
      notice: localSaved
        ? "每日挑战已保存到 localStorage · 未调用 LLM · 开发预览"
        : "每日挑战保存到 localStorage 失败 · 未调用 LLM · 开发预览",
    };
  }

  // Guard active — try DB write
  let dbSaved = false;
  let dbErrorMessage: string | null = null;

  try {
    const input = challengeStateToDbInput(state);
    if (input !== null) {
      const result = await dbRepo!.upsertProgress(input);
      // Check if the repository write path reported success
      if (result !== null && result.record !== null) {
        dbSaved = true;
      }
    }
  } catch (err) {
    dbErrorMessage = err instanceof Error ? err.message : "未知 DB 写错误";
  }

  if (dbSaved) {
    return {
      success: true,
      data: state,
      source: "db-dev-preview",
      writesDatabase: true,
      productionReady: false,
      safeToExposeToClient: true,
      llmUsed: false,
      externalApiUsed: false,
      guardActive: true,
      dbError: null,
      notice: "每日挑战已保存到开发 DB（dev-only）和 localStorage · 未调用 LLM · 开发预览",
    };
  }

  // DB write failed or was preview-only — fallback
  return {
    success: localSaved,
    data: localSaved ? state : null,
    source: "fallback",
    writesDatabase: false,
    productionReady: false,
    safeToExposeToClient: true,
    llmUsed: false,
    externalApiUsed: false,
    guardActive: true,
    dbError: dbErrorMessage,
    notice: localSaved
      ? "每日挑战已保存到 localStorage（DB 写入未生效，已降级）· 未调用 LLM · 开发预览"
      : "每日挑战保存失败（DB 和 localStorage 均写入失败）· 未调用 LLM · 开发预览",
  };
}

/**
 * Clear the daily challenge state from all persistence layers.
 */
async function clearDailyChallengePersistence(
  dbRepo?: DailyChallengeProgressRepository | null,
): Promise<{ success: boolean; source: PersistenceSource }> {
  clearLocalStorage();
  const guardActive =
    typeof dbRepo === "object" && dbRepo !== null && isDailyChallengeDbGuardActive();

  if (guardActive) {
    try {
      await dbRepo!.clearToday(getTodayDateStringCompat());
    } catch {
      // ignore DB clear errors
    }
  }

  return { success: true, source: guardActive ? "db-dev-preview" : "localStorage" };
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

/**
 * Create the daily challenge persistence store.
 *
 * @param dbRepo - Optional DB repository instance.
 *   When null or omitted, all operations use localStorage only.
 */
export function createDailyChallengePersistenceStore(
  dbRepo?: DailyChallengeProgressRepository | null,
): DailyChallengePersistenceStore {
  return {
    load() {
      return loadDailyChallengePersistence(dbRepo);
    },
    save(state: DailyChallengeState) {
      return saveDailyChallengePersistence(state, dbRepo);
    },
    clear() {
      return clearDailyChallengePersistence(dbRepo);
    },
  };
}

/**
 * Default store — localStorage only, no DB repository.
 */
export const dailyChallengePersistenceStore: DailyChallengePersistenceStore =
  createDailyChallengePersistenceStore(null);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Return the persistence metadata for when no store is available.
 * Always localStorage, always safe, never production-ready.
 */
export function getDefaultPersistenceMetadata(): {
  source: PersistenceSource;
  writesDatabase: false;
  productionReady: false;
  safeToExposeToClient: true;
  llmUsed: false;
  externalApiUsed: false;
  guardActive: false;
  dbError: null;
  notice: string;
} {
  return {
    source: "localStorage",
    writesDatabase: false,
    productionReady: false,
    safeToExposeToClient: true,
    llmUsed: false,
    externalApiUsed: false,
    guardActive: false,
    dbError: null,
    notice: "每日挑战数据来自 localStorage 本地存储 · 未调用 LLM · 开发预览",
  };
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

function getTodayDateStringCompat(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function dbRecordToChallengeState(
  record: DailyChallengeProgressRecord,
): DailyChallengeState | null {
  try {
    const validStatuses: string[] = ["not-started", "in-progress", "completed", "needs-review"];
    return {
      challengeDate: record.challengeDate,
      problemId: record.problemId,
      title: record.title,
      difficulty: record.difficulty,
      tags: record.tags,
      status: validStatuses.includes(record.status)
        ? (record.status as DailyChallengeState["status"])
        : "not-started",
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      updatedAt: record.updatedAt,
      recommendationSource: record.recommendationSource,
      recommendationReason: record.recommendationReason,
    };
  } catch {
    return null;
  }
}

function challengeStateToDbInput(
  state: DailyChallengeState,
): DailyChallengeProgressUpsertInput | null {
  try {
    return {
      challengeDate: state.challengeDate,
      problemId: state.problemId,
      title: state.title,
      difficulty: state.difficulty,
      tags: state.tags,
      status: state.status,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      updatedAt: state.updatedAt,
      recommendationSource: state.recommendationSource,
      recommendationReason: state.recommendationReason,
    };
  } catch {
    return null;
  }
}
