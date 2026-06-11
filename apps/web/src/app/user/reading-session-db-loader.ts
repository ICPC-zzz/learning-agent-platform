/**
 * Reading Session DB Loader — reads reading sessions from DB
 * when the guard passes, returns empty otherwise.
 *
 * Used by /user/activity page and /user dashboard stats.
 *
 * @module reading-session-db-loader
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaReadingSessionRepository,
  type ReadingSessionRecord,
  type ReadingSessionSummary,
} from "@learning-agent-platform/db";

import {
  evaluateReadingSessionDbGuard,
} from "./reading-session-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingSessionDbLoadResult {
  /** Whether guard was enabled and DB was queried. */
  guardEnabled: boolean;
  /** Whether DB data is available. */
  useDbSessions: boolean;
  /** Loaded DB sessions. */
  items: ReadingSessionRecord[];
  /** Summary statistics. */
  summary: ReadingSessionSummary;
  /** Human-readable message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load reading sessions for the owner resolved from the dev session cookie.
 * Falls back safely when guard is off or DB errors occur.
 */
export async function loadDbReadingSessions(
  cookieValue: string | undefined,
  limit?: number,
): Promise<ReadingSessionDbLoadResult> {
  const guard = evaluateReadingSessionDbGuard(cookieValue);

  if (!guard.enabled) {
    return {
      guardEnabled: false,
      useDbSessions: false,
      items: [],
      summary: { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 },
      message: guard.blockedReasons.length > 0
        ? guard.blockedReasons[0]
        : "阅读计时 DB 未启用。",
    };
  }

  if (!guard.sessionPayload) {
    return {
      guardEnabled: true,
      useDbSessions: false,
      items: [],
      summary: { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 },
      message: "无有效开发会话。",
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaReadingSessionRepository(prisma);

    const [sessions, summary] = await Promise.all([
      repository.listReadingSessionsByOwner({
        userId: ownerId,
        limit,
      }),
      repository.summarizeReadingSessionsByOwner(ownerId),
    ]);

    return {
      guardEnabled: true,
      useDbSessions: true,
      items: sessions,
      summary,
      message: sessions.length > 0
        ? `${sessions.length} 条阅读计时记录，总计 ${summary.totalDurationMinutes} 分钟。`
        : "暂无阅读计时记录。",
    };
  } catch (error: unknown) {
    const brief = error instanceof Error ? error.constructor.name : "unknown";
    return {
      guardEnabled: true,
      useDbSessions: false,
      items: [],
      summary: { totalSessions: 0, totalDurationSeconds: 0, totalDurationMinutes: 0 },
      message: `DB 阅读计时加载失败（${brief}）。请使用本地 fallback。`,
    };
  }
}
