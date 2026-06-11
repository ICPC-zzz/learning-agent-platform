/**
 * Learning Activity DB Loader — reads learning activities from DB
 * when the guard passes, returns empty otherwise.
 *
 * Used by /user/activity page and /user dashboard.
 *
 * @module learning-activity-db-loader
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaLearningActivityRepository,
  type LearningActivityRecord,
} from "@learning-agent-platform/db";

import {
  evaluateLearningActivityDbGuard,
} from "./learning-activity-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LearningActivityDbLoadResult {
  /** Whether guard was enabled and DB was queried. */
  guardEnabled: boolean;
  /** Whether DB data is available. */
  useDbActivities: boolean;
  /** Loaded DB activities. */
  items: LearningActivityRecord[];
  /** Human-readable message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load learning activities for the owner resolved from the dev session cookie.
 * Falls back safely when guard is off or DB errors occur.
 */
export async function loadDbLearningActivities(
  cookieValue: string | undefined,
  limit?: number,
): Promise<LearningActivityDbLoadResult> {
  const guard = evaluateLearningActivityDbGuard(cookieValue);

  if (!guard.enabled) {
    return {
      guardEnabled: false,
      useDbActivities: false,
      items: [],
      message: guard.blockedReasons.length > 0
        ? guard.blockedReasons[0]
        : "学习活动 DB 未启用。",
    };
  }

  if (!guard.sessionPayload) {
    return {
      guardEnabled: true,
      useDbActivities: false,
      items: [],
      message: "无有效开发会话。",
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaLearningActivityRepository(prisma);

    const activities = await repository.listLearningActivitiesByOwner({
      userId: ownerId,
      limit,
    });

    return {
      guardEnabled: true,
      useDbActivities: true,
      items: activities,
      message: activities.length > 0
        ? `${activities.length} 条学习活动记录。`
        : "暂无学习活动记录。",
    };
  } catch (error: unknown) {
    const brief = error instanceof Error ? error.constructor.name : "unknown";
    return {
      guardEnabled: true,
      useDbActivities: false,
      items: [],
      message: `DB 学习活动加载失败（${brief}）。请使用本地 fallback。`,
    };
  }
}
