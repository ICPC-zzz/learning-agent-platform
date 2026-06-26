/**
 * Daily Challenge Progress Repository — dev-only disabled-by-default
 * repository for Daily Challenge progress persistence.
 *
 * V1: Pure skeleton — all methods return blocked metadata.
 * V2 (A401): When ALL guards pass AND a Prisma client is provided,
 *   `upsertProgress` delegates to the existing PrismaLearningActivityRepository
 *   to record a `daily_challenge_completed` LearningActivity.
 *   `findByDate` and `clearToday` remain skeleton-only in v2.
 *
 * DEFAULT: disabled. ALL write/read paths are blocked until explicit
 * environment variable opt-ins are set.
 *
 * Guard layers (must ALL pass for write):
 *   1. LAP_DAILY_CHALLENGE_DB_DEV_ENABLED=true
 *   2. LAP_ALLOW_REAL_DB_INTEGRATION=true (project global guard)
 *   3. DATABASE_URL configured
 *
 * Even when the guard passes, the write path uses the existing
 * LearningActivity model (not a new DailyChallenge table).
 * No Prisma migration is needed.
 *
 * @module daily-challenge-progress-repository
 * @previewOnly — v2: real adapter via LearningActivity when guard passes; skeleton fallback
 */

// ---------------------------------------------------------------------------
// Types
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
// Guard
// ---------------------------------------------------------------------------

const ENV_DB_ENABLED = "LAP_DAILY_CHALLENGE_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB = "LAP_ALLOW_REAL_DB_INTEGRATION";

export function isDailyChallengeDbGuardActive(): boolean {
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      return false;
    }
    const dailyChallengeDb = process.env[ENV_DB_ENABLED] === "true";
    const allowRealDb = process.env[ENV_ALLOW_REAL_DB] === "true";
    return dailyChallengeDb && allowRealDb && safeHasDatabaseUrl();
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

function getBlockedReasons(): string[] {
  const reasons: string[] = [];
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      reasons.push("PROCESS_ENV_UNAVAILABLE: process.env 不可用（客户端环境）。DB 持久化默认关闭。");
      return reasons;
    }
    if (process.env[ENV_DB_ENABLED] !== "true") {
      reasons.push("DAILY_CHALLENGE_DB_DISABLED: LAP_DAILY_CHALLENGE_DB_DEV_ENABLED 未设置为 true。每日挑战 DB 持久化默认关闭。");
    }
    if (process.env[ENV_ALLOW_REAL_DB] !== "true") {
      reasons.push("REAL_DB_INTEGRATION_NOT_ENABLED: LAP_ALLOW_REAL_DB_INTEGRATION 未设置为 true。项目全局真实 DB 集成门控未通过。");
    }
    if (!safeHasDatabaseUrl()) {
      reasons.push("DB_URL_NOT_CONFIGURED: 数据库连接字符串未配置。无法连接数据库。");
    }
    if (reasons.length === 0) {
      // Guard satisfied — v2 can write via LearningActivity model
    }
  } catch {
    reasons.push("GUARD_EVALUATION_ERROR: guard 评估异常。DB 持久化默认关闭。");
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// Preview / skeleton implementation (V1)
// ---------------------------------------------------------------------------

export function createDailyChallengeProgressRepository(): DailyChallengeProgressRepository {
  const blockedReasons = getBlockedReasons();
  const guardActive = isDailyChallengeDbGuardActive();

  function buildMetadata(writesDb: boolean, status: "blocked" | "preview", extraReasons: string[] = []): DailyChallengeProgressSafetyMetadata {
    return {
      productionReady: false, llmUsed: false, externalApiUsed: false,
      safeToExposeToClient: true, writesDatabase: writesDb,
      guardActive, status,
      blockedReasons: [...blockedReasons, ...extraReasons],
    };
  }

  return {
    async findByDate(date: string): Promise<DailyChallengeProgressFindResult> {
      return { record: null, metadata: buildMetadata(false, "blocked", [
        "FIND_BY_DATE_NOT_IMPLEMENTED: 每日挑战 DB 读取路径为 skeleton，不执行真实查询。"
      ]) };
    },
    async upsertProgress(input: DailyChallengeProgressUpsertInput): Promise<DailyChallengeProgressUpsertResult> {
      return { record: null, metadata: buildMetadata(false, "blocked", [
        "UPSERT_NOT_IMPLEMENTED: 每日挑战 DB 写入路径为 skeleton，不执行真实写入。"
      ]) };
    },
    async clearToday(date: string): Promise<DailyChallengeProgressClearResult> {
      return { success: false, metadata: buildMetadata(false, "blocked", [
        "CLEAR_NOT_IMPLEMENTED: 每日挑战 DB 清空路径为 skeleton，不执行真实删除。"
      ]) };
    },
  };
}

let _singletonRepo: DailyChallengeProgressRepository | null = null;

export function getDailyChallengeProgressRepository(): DailyChallengeProgressRepository {
  if (_singletonRepo === null) {
    _singletonRepo = createDailyChallengeProgressRepository();
  }
  return _singletonRepo;
}

// ---------------------------------------------------------------------------
// V2 real adapter (A401) — delegates to LearningActivity model
// ---------------------------------------------------------------------------

export function createRealDailyChallengeProgressRepository(
  getLearningActivityRepo: (() => {
    recordLearningActivity(input: {
      userId: string;
      activityType: string;
      title: string;
      targetType: string;
      targetId: string;
      bookId: string | null;
      chapterId: string | null;
      problemId: string | null;
      sourceType: string;
      occurredAt: Date;
      durationSeconds: number | null;
      metadataPreview: string | null;
    }): Promise<{ id: string }>;
  }) | null,
): DailyChallengeProgressRepository {
  const guardActive = isDailyChallengeDbGuardActive();

  function buildMeta(writesDb: boolean, status: "blocked" | "preview", extra: string[] = []): DailyChallengeProgressSafetyMetadata {
    return {
      productionReady: false, llmUsed: false, externalApiUsed: false,
      safeToExposeToClient: true, writesDatabase: writesDb,
      guardActive, status,
      blockedReasons: [...getBlockedReasonsV2(), ...extra],
    };
  }

  return {
    async findByDate(date: string): Promise<DailyChallengeProgressFindResult> {
      return { record: null, metadata: buildMeta(false, "blocked", [
        "FIND_BY_DATE_V2_SKELETON: 每日挑战读取路径仍为 skeleton。"
      ]) };
    },

    async upsertProgress(input: DailyChallengeProgressUpsertInput): Promise<DailyChallengeProgressUpsertResult> {
      if (!guardActive) {
        return { record: null, metadata: buildMeta(false, "blocked", [
          "UPSERT_GUARD_NOT_SATISFIED: DB guard 未满足。"
        ]) };
      }
      if (getLearningActivityRepo === null) {
        return { record: null, metadata: buildMeta(false, "blocked", [
          "NO_LEARNING_ACTIVITY_REPO: 工厂为 null。"
        ]) };
      }
      const repo = getLearningActivityRepo();
      if (repo === null) {
        return { record: null, metadata: buildMeta(false, "blocked", [
          "NO_LEARNING_ACTIVITY_REPO: 仓库不可用。"
        ]) };
      }
      try {
        await repo.recordLearningActivity({
          userId: input.problemId,
          activityType: "daily_challenge_completed",
          title: "完成每日挑战: " + input.title,
          targetType: "problem",
          targetId: input.problemId,
          bookId: null, chapterId: null,
          problemId: input.problemId,
          sourceType: "daily-challenge",
          occurredAt: new Date(input.completedAt || input.updatedAt),
          durationSeconds: null,
          metadataPreview: JSON.stringify({
            challengeDate: input.challengeDate, difficulty: input.difficulty,
            tags: input.tags, recommendationSource: input.recommendationSource,
            generatedBy: "deterministic-rules", llmUsed: false,
            externalApiUsed: false, productionReady: false,
          }).slice(0, 500),
        });
        return {
          record: {
            challengeDate: input.challengeDate, problemId: input.problemId,
            title: input.title, difficulty: input.difficulty,
            tags: input.tags, status: input.status,
            startedAt: input.startedAt, completedAt: input.completedAt,
            updatedAt: input.updatedAt,
            recommendationSource: input.recommendationSource,
            recommendationReason: input.recommendationReason,
          },
          metadata: buildMeta(true, "preview"),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        return { record: null, metadata: buildMeta(false, "blocked", [
          "UPSERT_DB_ERROR: " + msg.slice(0, 200)
        ]) };
      }
    },

    async clearToday(date: string): Promise<DailyChallengeProgressClearResult> {
      return { success: false, metadata: buildMeta(false, "blocked", [
        "CLEAR_TODAY_V2_SKELETON: 每日挑战清空仍为 skeleton。"
      ]) };
    },
  };
}

function getBlockedReasonsV2(): string[] {
  const reasons: string[] = [];
  try {
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      reasons.push("PROCESS_ENV_UNAVAILABLE: process.env 不可用（客户端环境）。");
      return reasons;
    }
    if (process.env[ENV_DB_ENABLED] !== "true") {
      reasons.push("DAILY_CHALLENGE_DB_DISABLED: LAP_DAILY_CHALLENGE_DB_DEV_ENABLED 未设置。");
    }
    if (process.env[ENV_ALLOW_REAL_DB] !== "true") {
      reasons.push("REAL_DB_INTEGRATION_NOT_ENABLED: LAP_ALLOW_REAL_DB_INTEGRATION 未设置。");
    }
    if (!safeHasDatabaseUrl()) {
      reasons.push("DB_URL_NOT_CONFIGURED: DATABASE_URL 未配置。");
    }
  } catch {
    reasons.push("GUARD_EVALUATION_ERROR: guard 评估异常。");
  }
  return reasons;
}
