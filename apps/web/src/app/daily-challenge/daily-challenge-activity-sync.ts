/**
 * Daily Challenge Activity Sync — bridges Daily Challenge completion events
 * into the existing LearningActivity DB dev-only write path.
 *
 * When a user completes a Daily Challenge:
 *   1. localStorage is ALWAYS saved first (guaranteed fallback).
 *   2. If ALL DB guards pass, a LearningActivity record with
 *      activityType="daily_challenge_completed" is written via the existing
 *      PrismaLearningActivityRepository.
 *   3. If ANY guard fails or DB write errors, localStorage state is preserved
 *      and the result metadata indicates fallback/blocked.
 *
 * DEFAULT: DB writes are DISABLED. All guards must be explicitly opted in.
 *
 * Guard layers (ALL must pass for DB write):
 *   1. LAP_DAILY_CHALLENGE_DB_DEV_ENABLED === "true"
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION === "true"
 *   3. DATABASE_URL configured
 *   4. A valid dev user ID (trustedId) must be provided
 *
 * Safety guarantees:
 *   - productionReady: ALWAYS false
 *   - llmUsed: ALWAYS false
 *   - externalApiUsed: ALWAYS false
 *   - No raw prompts/responses saved
 *   - No env var values exposed in metadata
 *
 * @module daily-challenge-activity-sync
 * @previewOnly — dev-only; DB writes disabled by default; no LLM; no external API
 */

import type { DailyChallengeState } from "../../lib/local-daily-challenge-store.ts";
import {
  loadDailyChallenge as loadFromLocalStorage,
  persistDailyChallenge as saveToLocalStorage,
} from "../../lib/local-daily-challenge-store.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyChallengeCompletionActivity {
  activityType: "daily_challenge_completed";
  challengeDate: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  status: "completed";
  completedAt: string | null;
  recommendationSource: string;
  recommendationReason: string;
  /** The dev session user ID that owns this activity. */
  ownerId: string;
}

export interface DailyChallengeActivitySyncMetadata {
  /** Whether this sync attempt wrote to the database. */
  writesDatabase: boolean;
  /** Where the data ultimately resides. */
  source: "localStorage" | "db-dev-preview" | "fallback" | "blocked";
  /** Always true — contains no secrets, env values, or connection strings. */
  safeToExposeToClient: true;
  /** Always false — never production-ready. */
  productionReady: false;
  /** Always false — this module never calls an LLM. */
  llmUsed: false;
  /** Always false — this module never calls an external API. */
  externalApiUsed: false;
  /** Whether all DB guards were satisfied. */
  guardSatisfied: boolean;
  /** Human-readable reason if DB write was blocked or fell back. */
  fallbackReason: string | null;
  /** The activity ID if DB write succeeded, null otherwise. */
  activityId: string | null;
}

export interface DailyChallengeActivitySyncResult {
  success: boolean;
  /** The daily challenge state that was saved. */
  data: DailyChallengeState | null;
  metadata: DailyChallengeActivitySyncMetadata;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

const ENV_DC_DB_ENABLED = "LAP_DAILY_CHALLENGE_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB = "LAP_ALLOW_REAL_DB_INTEGRATION";

/**
 * Evaluate the Daily Challenge DB guard for activity sync.
 * All conditions must pass for writesDatabase to be true.
 */
export function evaluateDailyChallengeActivityGuard(
  trustedId?: string | null,
): {
  guardSatisfied: boolean;
  blockedReasons: string[];
} {
  const blockedReasons: string[] = [];

  // Check 1: Daily Challenge DB dev enabled
  const dcDbEnabled = safeReadEnv(ENV_DC_DB_ENABLED) === "true";
  if (!dcDbEnabled) {
    blockedReasons.push(
      "DAILY_CHALLENGE_DB_DISABLED: LAP_DAILY_CHALLENGE_DB_DEV_ENABLED 未设置为 true。每日挑战 DB 持久化默认关闭。",
    );
  }

  // Check 2: Project global real DB integration
  const allowRealDb = safeReadEnv(ENV_ALLOW_REAL_DB) === "true";
  if (!allowRealDb) {
    blockedReasons.push(
      "REAL_DB_INTEGRATION_NOT_ENABLED: LAP_ALLOW_REAL_DB_INTEGRATION 未设置为 true。项目全局真实 DB 集成门控未通过。",
    );
  }

  // Check 3: DATABASE_URL configured
  if (!safeHasDatabaseUrl()) {
    blockedReasons.push(
      "DATABASE_URL_NOT_CONFIGURED: 数据库连接字符串未配置。无法连接数据库。",
    );
  }

  // Check 4: Trusted user ID
  if (typeof trustedId !== "string" || trustedId.trim().length === 0) {
    blockedReasons.push(
      "NO_TRUSTED_USER_ID: 无可信用户 ID。需要有效的 dev session 或 trusted user ID。",
    );
  }

  return {
    guardSatisfied: blockedReasons.length === 0,
    blockedReasons,
  };
}

function safeReadEnv(key: string): string | undefined {
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      return undefined;
    }
    return process.env[key];
  } catch {
    return undefined;
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
// Repository dependency — abstracted for testability
// ---------------------------------------------------------------------------

export interface DailyChallengeActivityRepository {
  recordDailyChallengeCompletion(
    activity: DailyChallengeCompletionActivity,
  ): Promise<{ id: string }>;
}

/**
 * Factory: create a real Prisma-backed repository adapter.
 * This is the ONLY path that touches the database.
 *
 * Uses dynamic import to avoid bundling Prisma in client bundles.
 * In Node.js test environments, the PrismaLearningActivityRepository
 * is imported directly via the factory's `prismaClient` parameter.
 */
export function createRealDailyChallengeActivityRepository(
  prismaClient: unknown,
): DailyChallengeActivityRepository {
  // Lazy-load to keep Prisma out of client bundles
  let _PrismaLearningActivityRepository: new (client: unknown) => DailyChallengeActivityRepository;

  return {
    async recordDailyChallengeCompletion(
      activity: DailyChallengeCompletionActivity,
    ): Promise<{ id: string }> {
      if (!_PrismaLearningActivityRepository) {
        // Dynamic import for the Prisma repository class
        const mod = await import(
          "@learning-agent-platform/db"
        );
        _PrismaLearningActivityRepository = (mod as any)
          .PrismaLearningActivityRepository;
      }

      const repo = new _PrismaLearningActivityRepository!(prismaClient);
      const record = await (repo as any).recordLearningActivity({
        userId: activity.ownerId.trim(),
        activityType: "daily_challenge_completed",
        title: `完成每日挑战: ${activity.title}`,
        targetType: "problem",
        targetId: activity.problemId,
        bookId: null,
        chapterId: null,
        problemId: activity.problemId,
        sourceType: "daily-challenge",
        occurredAt: new Date(activity.completedAt || new Date().toISOString()),
        durationSeconds: null,
        metadataPreview: JSON.stringify({
          challengeDate: activity.challengeDate,
          difficulty: activity.difficulty,
          tags: activity.tags,
          recommendationSource: activity.recommendationSource,
          generatedBy: "deterministic-rules",
          llmUsed: false,
          externalApiUsed: false,
          productionReady: false,
        }).slice(0, 500),
      });

      return { id: record.id };
    },
  };
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Sync a Daily Challenge completion as a LearningActivity record.
 *
 * ALWAYS saves to localStorage first. Then, if all DB guards pass and a
 * repository is provided, attempts to write a LearningActivity record.
 * On any DB error, falls back to localStorage.
 *
 * @param state - The Daily Challenge state to persist
 * @param trustedId - The dev user ID (required for DB write)
 * @param dbRepo - Optional real DB repository adapter
 * @returns Result with complete safety metadata
 */
export async function syncDailyChallengeCompletion(
  state: DailyChallengeState,
  trustedId: string | null | undefined,
  dbRepo?: DailyChallengeActivityRepository | null,
): Promise<DailyChallengeActivitySyncResult> {
  // Step 1: Always save to localStorage first
  const localSaved = saveToLocalStorage(state);

  // Step 2: Evaluate the guard
  const { guardSatisfied, blockedReasons } =
    evaluateDailyChallengeActivityGuard(trustedId);

  // Step 3: If guard is not satisfied, return localStorage result
  if (!guardSatisfied) {
    return {
      success: localSaved,
      data: localSaved ? state : null,
      metadata: {
        writesDatabase: false,
        source: localSaved ? "localStorage" : "blocked",
        safeToExposeToClient: true,
        productionReady: false,
        llmUsed: false,
        externalApiUsed: false,
        guardSatisfied: false,
        fallbackReason: blockedReasons[0] || "guard-not-satisfied",
        activityId: null,
      },
    };
  }

  // Step 4: Guard satisfied — try DB write
  if (!dbRepo) {
    return {
      success: localSaved,
      data: localSaved ? state : null,
      metadata: {
        writesDatabase: false,
        source: "fallback",
        safeToExposeToClient: true,
        productionReady: false,
        llmUsed: false,
        externalApiUsed: false,
        guardSatisfied: true,
        fallbackReason: "NO_REPOSITORY: DB repository adapter 未提供。",
        activityId: null,
      },
    };
  }

  if (state.status !== "completed") {
    return {
      success: localSaved,
      data: localSaved ? state : null,
      metadata: {
        writesDatabase: false,
        source: "localStorage",
        safeToExposeToClient: true,
        productionReady: false,
        llmUsed: false,
        externalApiUsed: false,
        guardSatisfied: true,
        fallbackReason: "NOT_COMPLETED: 仅 completed 状态的挑战会写入学习活动。",
        activityId: null,
      },
    };
  }

  try {
    const activity = buildCompletionActivity(state, trustedId!.trim());
    const result = await dbRepo.recordDailyChallengeCompletion(activity);

    return {
      success: true,
      data: state,
      metadata: {
        writesDatabase: true,
        source: "db-dev-preview",
        safeToExposeToClient: true,
        productionReady: false,
        llmUsed: false,
        externalApiUsed: false,
        guardSatisfied: true,
        fallbackReason: null,
        activityId: result.id,
      },
    };
  } catch (err) {
    // DB write failed — localStorage already saved
    const fallbackReason =
      err instanceof Error ? err.message : "未知 DB 写入错误";

    return {
      success: localSaved,
      data: localSaved ? state : null,
      metadata: {
        writesDatabase: false,
        source: "fallback",
        safeToExposeToClient: true,
        productionReady: false,
        llmUsed: false,
        externalApiUsed: false,
        guardSatisfied: true,
        fallbackReason,
        activityId: null,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCompletionActivity(
  state: DailyChallengeState,
  ownerId: string,
): DailyChallengeCompletionActivity {
  return {
    activityType: "daily_challenge_completed",
    challengeDate: state.challengeDate,
    problemId: state.problemId,
    title: state.title,
    difficulty: state.difficulty,
    tags: state.tags,
    status: "completed",
    completedAt: state.completedAt,
    recommendationSource: state.recommendationSource,
    recommendationReason: state.recommendationReason,
    ownerId,
  };
}

// ---------------------------------------------------------------------------
// Safety validation (for tests)
// ---------------------------------------------------------------------------

const DANGEROUS_FIELD_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
  /\braw_prompt\b/i,
  /\braw_response\b/i,
];

/**
 * Check that a sync result contains no sensitive data.
 * For use in tests only.
 */
export function dailyChallengeActivitySyncResultIsSafe(
  result: DailyChallengeActivitySyncResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

/**
 * Check that the sync metadata has no forbidden production labels.
 * For use in tests only.
 */
export function dailyChallengeActivitySyncMetadataHasNoForbiddenLabels(
  metadata: DailyChallengeActivitySyncMetadata,
): boolean {
  const json = JSON.stringify(metadata).toLowerCase();
  const forbidden = [
    "ai 自动推荐",
    "真实判题已接入",
    "生产每日挑战",
    "云端同步成功",
    "agent 已运行",
    "llm 生成",
    "生产可用",
  ];
  return !forbidden.some((label) => json.includes(label));
}
