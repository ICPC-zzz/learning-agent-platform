/**
 * User Dashboard Learning Stats View Model — extends the /user dashboard
 * with learning activity and reading session statistics.
 *
 * Aggregates DB data + localStorage fallback for learning activity count,
 * reading session totals, and today's summary.
 *
 * @module user-dashboard-learning-stats-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { LearningActivityRecord, ReadingSessionRecord } from "@learning-agent-platform/db";
import type { LocalLearningActivity, LocalReadingSession } from "../../lib/local-learning-activity-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardLearningStatsView {
  /** Today's learning activity count. */
  todayActivityCount: number;
  /** Total learning activity count. */
  totalActivityCount: number;
  /** Total reading duration in minutes. */
  totalReadingMinutes: number;
  /** Total reading sessions count. */
  totalReadingSessions: number;
  /** Today's reading duration in minutes. */
  todayReadingMinutes: number;
  /** Most recent activity title (null if none). */
  latestActivityTitle: string | null;
  /** Most recent activity time (null if none). */
  latestActivityTime: string | null;
  /** Source of data. */
  dataSource: "db" | "local" | "none";
  /** Human-readable source notice. */
  dataSourceNotice: string;
  /** Whether any DB data is active. */
  anyDbActive: boolean;
}

export interface DashboardLearningStatsInput {
  hasSession: boolean;
  /** DB learning activities. */
  dbActivities: LearningActivityRecord[] | null;
  /** Whether DB activity guard is enabled. */
  dbActivitiesEnabled: boolean;
  /** LocalStorage learning activities. */
  localActivities: LocalLearningActivity[];
  /** DB reading sessions. */
  dbSessions: ReadingSessionRecord[] | null;
  /** Whether DB session guard is enabled. */
  dbSessionsEnabled: boolean;
  /** LocalStorage reading sessions. */
  localSessions: LocalReadingSession[];
  /** DB reading session summary. */
  dbReadingSessionSummary: { totalSessions: number; totalDurationSeconds: number; totalDurationMinutes: number } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_SOURCE_NOTICES = {
  db: "学习统计来自开发 DB（dev-only）· 绑定 dev session · 未接生产账号",
  local: "学习统计来自 localStorage 本地存储 · 未连接数据库 · 未接生产账号",
  none: "暂无学习统计数据（开发预览）",
} as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildDashboardLearningStatsView(
  input: DashboardLearningStatsInput,
): DashboardLearningStatsView {
  const {
    hasSession,
    dbActivities,
    dbActivitiesEnabled,
    localActivities,
    dbSessions,
    dbSessionsEnabled,
    localSessions,
    dbReadingSessionSummary,
  } = input;

  const useDbActivities = dbActivitiesEnabled && dbActivities !== null;
  const useDbSessions = dbSessionsEnabled && dbSessions !== null && dbReadingSessionSummary !== null;

  // Today's start
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  let todayActivityCount: number;
  let totalActivityCount: number;
  let totalReadingMinutes: number;
  let totalReadingSessions: number;
  let todayReadingMinutes: number;
  let latestActivityTitle: string | null;
  let latestActivityTime: string | null;

  if (useDbActivities && dbActivities !== null) {
    totalActivityCount = dbActivities.length;
    todayActivityCount = dbActivities.filter(
      (a) => a.occurredAt.toISOString() >= todayStart,
    ).length;

    // Find latest activity
    if (dbActivities.length > 0) {
      const latest = dbActivities.reduce((max, a) =>
        a.occurredAt > max.occurredAt ? a : max,
      );
      latestActivityTitle = sanitizeTitle(latest.title);
      latestActivityTime = latest.occurredAt.toISOString();
    } else {
      latestActivityTitle = null;
      latestActivityTime = null;
    }
  } else {
    totalActivityCount = localActivities.length;
    todayActivityCount = localActivities.filter(
      (a) => a.occurredAt >= todayStart,
    ).length;

    if (localActivities.length > 0) {
      const sorted = [...localActivities].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
      latestActivityTitle = sanitizeTitle(sorted[0].title);
      latestActivityTime = sorted[0].occurredAt;
    } else {
      latestActivityTitle = null;
      latestActivityTime = null;
    }
  }

  if (useDbSessions && dbReadingSessionSummary !== null) {
    totalReadingSessions = dbReadingSessionSummary.totalSessions;
    totalReadingMinutes = dbReadingSessionSummary.totalDurationMinutes;

    // Today's reading from DB
    todayReadingMinutes = 0;
    if (dbSessions !== null) {
      const todaySeconds = dbSessions
        .filter((s) => s.startedAt.toISOString() >= todayStart)
        .reduce((sum, s) => sum + Math.max(0, s.durationSeconds), 0);
      todayReadingMinutes = Math.round(todaySeconds / 60);
    }
  } else {
    totalReadingSessions = localSessions.length;
    totalReadingMinutes = localSessions.reduce(
      (sum, s) => sum + Math.round(Math.max(0, s.durationSeconds) / 60),
      0,
    );
    todayReadingMinutes = localSessions
      .filter((s) => s.startedAt >= todayStart)
      .reduce((sum, s) => sum + Math.round(Math.max(0, s.durationSeconds) / 60), 0);
  }

  // Determine data source
  let dataSource: "db" | "local" | "none";
  if (useDbActivities || useDbSessions) {
    dataSource = "db";
  } else if (localActivities.length > 0 || localSessions.length > 0) {
    dataSource = "local";
  } else {
    dataSource = "none";
  }

  return {
    todayActivityCount,
    totalActivityCount,
    totalReadingMinutes,
    totalReadingSessions,
    todayReadingMinutes,
    latestActivityTitle,
    latestActivityTime,
    dataSource,
    dataSourceNotice: DATA_SOURCE_NOTICES[dataSource],
    anyDbActive: useDbActivities || useDbSessions,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeTitle(raw: string): string {
  if (typeof raw !== "string") return "未知";
  return raw.trim().slice(0, 300);
}
