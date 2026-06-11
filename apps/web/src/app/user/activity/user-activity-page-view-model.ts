/**
 * User Activity Page View Model — computes activity timeline for the
 * /user/activity page.
 *
 * Aggregates DB learning activities + reading sessions with localStorage fallback.
 *
 * @module user-activity-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { LearningActivityRecord, ReadingSessionRecord } from "@learning-agent-platform/db";
import type { LocalLearningActivity, LocalReadingSession } from "../../../lib/local-learning-activity-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityTimelineItem {
  /** Unique timeline entry id. */
  id: string;
  /** Entry kind for rendering. */
  kind: "activity" | "session";
  /** Activity type or "reading-session". */
  type: string;
  /** Display title. */
  title: string;
  /** Target type (book, chapter, problem, note, bookmark). */
  targetType: string;
  /** Target ID for linking. */
  targetId: string;
  /** Optional book ID for linking. */
  bookId: string | null;
  /** Optional chapter ID for linking. */
  chapterId: string | null;
  /** Optional problem ID for linking. */
  problemId: string | null;
  /** When it occurred / started. */
  occurredAt: string;
  /** Duration in seconds, if applicable. */
  durationSeconds: number | null;
  /** Source badge: "db" or "local". */
  source: "db" | "local";
  /** Human-readable source label. */
  sourceLabel: string;
}

export interface ActivityTimelineView {
  /** Combined timeline entries sorted by occurredAt DESC. */
  items: ActivityTimelineItem[];
  /** Total number of entries. */
  totalEntries: number;
  /** Number of today's entries. */
  todayEntries: number;
  /** Total reading duration in minutes. */
  totalReadingMinutes: number;
  /** Source notice for UI. */
  dataSourceNotice: string;
  /** Whether any DB data is active. */
  anyDbActive: boolean;
  /** Whether the user has a session. */
  hasSession: boolean;
}

export interface ActivityPageInput {
  hasSession: boolean;
  /** DB learning activities (null when guard off). */
  dbActivities: LearningActivityRecord[] | null;
  /** Whether DB activity guard is enabled. */
  dbActivitiesEnabled: boolean;
  /** LocalStorage learning activities. */
  localActivities: LocalLearningActivity[];
  /** DB reading sessions (null when guard off). */
  dbSessions: ReadingSessionRecord[] | null;
  /** Whether DB session guard is enabled. */
  dbSessionsEnabled: boolean;
  /** LocalStorage reading sessions. */
  localSessions: LocalReadingSession[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_SOURCE_NOTICES = {
  allDb: "开发 DB 数据（dev-only）· 绑定 dev session · 未接生产账号",
  mixed: "部分数据来自开发 DB · 部分本地 fallback · 未接生产账号",
  allLocal: "数据来自 localStorage 本地存储 · 未连接数据库 · 未接生产账号",
} as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildActivityTimelineView(
  input: ActivityPageInput,
): ActivityTimelineView {
  const {
    hasSession,
    dbActivities,
    dbActivitiesEnabled,
    localActivities,
    dbSessions,
    dbSessionsEnabled,
    localSessions,
  } = input;

  const useDbActivities = dbActivitiesEnabled && dbActivities !== null;
  const useDbSessions = dbSessionsEnabled && dbSessions !== null;

  const timelineItems: ActivityTimelineItem[] = [];

  // Add DB activities
  if (useDbActivities && dbActivities !== null) {
    for (const a of dbActivities) {
      timelineItems.push({
        id: a.id,
        kind: "activity",
        type: a.activityType,
        title: sanitizeTitle(a.title),
        targetType: a.targetType,
        targetId: a.targetId,
        bookId: a.bookId ?? null,
        chapterId: a.chapterId ?? null,
        problemId: a.problemId ?? null,
        occurredAt: a.occurredAt.toISOString(),
        durationSeconds: safeDuration(a.durationSeconds),
        source: "db",
        sourceLabel: "开发 DB",
      });
    }
  }

  // Add DB sessions
  if (useDbSessions && dbSessions !== null) {
    for (const s of dbSessions) {
      timelineItems.push({
        id: s.id,
        kind: "session",
        type: "reading-session",
        title: `${sanitizeTitle(s.bookTitle)} · ${sanitizeTitle(s.chapterTitle)}`,
        targetType: "chapter",
        targetId: s.chapterId,
        bookId: s.bookId,
        chapterId: s.chapterId,
        problemId: null,
        occurredAt: s.startedAt.toISOString(),
        durationSeconds: safeDuration(s.durationSeconds),
        source: "db",
        sourceLabel: "开发 DB",
      });
    }
  }

  // Add local activities (only if DB is not active for that domain, or always as supplement)
  for (const a of localActivities) {
    timelineItems.push({
      id: a.activityId,
      kind: "activity",
      type: a.activityType,
      title: sanitizeTitle(a.title),
      targetType: a.targetType,
      targetId: a.targetId,
      bookId: a.bookId ?? null,
      chapterId: a.chapterId ?? null,
      problemId: a.problemId ?? null,
      occurredAt: a.occurredAt,
      durationSeconds: safeDuration(a.durationSeconds),
      source: "local",
      sourceLabel: "本地",
    });
  }

  // Add local sessions
  for (const s of localSessions) {
    timelineItems.push({
      id: s.sessionId,
      kind: "session",
      type: "reading-session",
      title: `${sanitizeTitle(s.bookTitle)} · ${sanitizeTitle(s.chapterTitle)}`,
      targetType: "chapter",
      targetId: s.chapterId,
      bookId: s.bookId,
      chapterId: s.chapterId,
      problemId: null,
      occurredAt: s.startedAt,
      durationSeconds: safeDuration(s.durationSeconds),
      source: "local",
      sourceLabel: "本地",
    });
  }

  // Sort by occurredAt DESC
  timelineItems.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  // Today's entries
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayEntries = timelineItems.filter((item) => item.occurredAt >= todayStart).length;

  // Total reading minutes
  const totalReadingSeconds = timelineItems
    .filter((item) => item.kind === "session" || item.type === "read-book")
    .reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  const totalReadingMinutes = Math.round(totalReadingSeconds / 60);

  // Data source notice
  const anyDbActive = useDbActivities || useDbSessions;
  const allLocal = !anyDbActive && (localActivities.length > 0 || localSessions.length > 0);
  let dataSourceNotice: string;
  if (!anyDbActive && !allLocal) {
    dataSourceNotice = "暂无学习活动数据。";
  } else if (anyDbActive && (localActivities.length > 0 || localSessions.length > 0)) {
    dataSourceNotice = DATA_SOURCE_NOTICES.mixed;
  } else if (anyDbActive) {
    dataSourceNotice = DATA_SOURCE_NOTICES.allDb;
  } else {
    dataSourceNotice = DATA_SOURCE_NOTICES.allLocal;
  }

  return {
    items: timelineItems,
    totalEntries: timelineItems.length,
    todayEntries,
    totalReadingMinutes,
    dataSourceNotice,
    anyDbActive,
    hasSession,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeTitle(raw: string): string {
  if (typeof raw !== "string") return "未知";
  return raw.trim().slice(0, 300);
}

function safeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Math.min(Math.trunc(value), 28800);
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
];

const FORBIDDEN_LABELS = [
  "生产可用",
  "真实数据",
  "云端同步成功",
  "生产学习记录已保存",
  "真实学习系统已完成",
] as const;

export function activityTimelineViewIsSafe(
  view: ActivityTimelineView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}
