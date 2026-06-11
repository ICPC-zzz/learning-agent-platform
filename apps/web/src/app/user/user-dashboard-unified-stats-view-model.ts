/**
 * User Dashboard Unified Stats View Model — merges server-side stats
 * (dev DB / dev session) with client-side localStorage stats into a
 * single unified stats panel for the /user page.
 *
 * Every stat item carries an explicit data-source label so users
 * always know whether a number came from the dev DB, localStorage
 * fallback, or is a placeholder.
 *
 * @module user-dashboard-unified-stats-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DashboardStatsView } from "./user-dashboard-stats-view-model";
import type { DashboardLearningStatsView } from "./user-dashboard-learning-stats-view-model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category used to group stats in the unified panel. */
export type UnifiedStatGroup =
  | "reading"
  | "problems"
  | "review"
  | "ai-assist"
  | "activity-plan";

/** Data source for a single stat. */
export type UnifiedStatSource =
  | "server-dev-db"
  | "local-storage-fallback"
  | "placeholder-not-connected"
  | "mixed";

/** Availability status of a single stat. */
export type UnifiedStatStatus =
  | "available"
  | "empty"
  | "not-connected"
  | "preview";

/** A single stat row in the unified dashboard panel. */
export interface UnifiedStatItem {
  statId: string;
  label: string;
  value: string;
  description: string;
  source: UnifiedStatSource;
  status: UnifiedStatStatus;
  href: string | null;
  safetyLabel: string;
  sortOrder: number;
  group: UnifiedStatGroup;
}

/** The complete unified stats view. */
export interface UnifiedStatsView {
  stats: UnifiedStatItem[];
  groupLabels: Record<UnifiedStatGroup, string>;
  overallNotice: string;
  hasAnyData: boolean;
  serverStatsActive: boolean;
  localStatsActive: boolean;
}

/** Simplified local stats input (from hydration component). */
export interface DashboardLocalStatsInput {
  favoriteBookCount: number;
  recentReadingCount: number;
  favoriteProblemCount: number;
  recentPracticeCount: number;
  wrongBookTotalCount: number;
  wrongBookNeedsReviewCount: number;
  bookmarkCount: number;
  noteCount: number;
  aiHistoryCount: number;
  learningActivityCount: number;
  todayActivityCount: number;
  totalReadingMinutes: number;
  todayReadingMinutes: number;
  reviewRecommendationCount: number;
  todayPlanTaskCount: number;
  /** A399: true if daily challenge is active today. */
  dailyChallengeActive: boolean;
  /** A399: daily challenge title, if active. */
  dailyChallengeTitle: string | null;
  /** A399: daily challenge status, if active. */
  dailyChallengeStatus: string | null;
}

/** Combined input for the unified stats builder. */
export interface UnifiedStatsInput {
  /** Server-side dashboard stats (from buildDashboardStatsView). */
  serverStats: DashboardStatsView | null;
  /** Server-side learning stats (from buildDashboardLearningStatsView). */
  serverLearningStats: DashboardLearningStatsView | null;
  /** Client-side local stats (from hydration). */
  localStats: DashboardLocalStatsInput | null;
  /** Whether a dev session exists. */
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<UnifiedStatGroup, string> = {
  "reading": "阅读",
  "problems": "题目",
  "review": "复习",
  "ai-assist": "AI 辅助",
  "activity-plan": "活动与计划",
};

const SOURCE_BADGE: Record<UnifiedStatSource, string> = {
  "server-dev-db": "DB",
  "local-storage-fallback": "localStorage fallback",
  "placeholder-not-connected": "not connected",
  "mixed": "mixed",
};

const OVERALL_NOTICE_ALL_DB = "开发 DB 数据（dev-only）· 绑定 dev session · 未接生产账号 · 未调用 LLM · 规则型统计";
const OVERALL_NOTICE_MIXED = "部分数据来自开发 DB · 部分来自 localStorage fallback · 未接生产账号 · 未调用 LLM · 规则型统计";
const OVERALL_NOTICE_ALL_LOCAL = "数据来自 localStorage 本地存储 · 未连接数据库 · 未接生产账号 · 未调用 LLM · 规则型统计";
const OVERALL_NOTICE_NONE = "暂无学习数据（开发预览）· 未接生产账号 · 未调用 LLM";

const FORBIDDEN_LABELS = [
  "AI 自动分析",
  "生产学习报告",
  "真实云端同步",
  "真实用户画像",
  "Agent 已运行",
  "LLM 生成",
  "生产可用",
  "真实数据",
] as const;

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi.*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\braw.*prompt\b/i,
  /\braw.*response\b/i,
  /\brawText\b/i,
  /\bfullChapterContent\b/i,
  /\bsubmittedCode\b/i,
];

// ---------------------------------------------------------------------------
// Empty local stats
// ---------------------------------------------------------------------------

export function createEmptyLocalStats(): DashboardLocalStatsInput {
  return {
    favoriteBookCount: 0,
    recentReadingCount: 0,
    favoriteProblemCount: 0,
    recentPracticeCount: 0,
    wrongBookTotalCount: 0,
    wrongBookNeedsReviewCount: 0,
    bookmarkCount: 0,
    noteCount: 0,
    aiHistoryCount: 0,
    learningActivityCount: 0,
    todayActivityCount: 0,
    totalReadingMinutes: 0,
    todayReadingMinutes: 0,
    reviewRecommendationCount: 0,
    todayPlanTaskCount: 0,
    dailyChallengeActive: false,
    dailyChallengeTitle: null,
    dailyChallengeStatus: null,
  };
}

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

let _orderCounter = 0;
function nextOrder(group: UnifiedStatGroup, base: number): number {
  _orderCounter++;
  // base * 100 ensures group ordering; counter ensures unique values
  const groupBase: Record<UnifiedStatGroup, number> = {
    "reading": 100,
    "problems": 200,
    "review": 300,
    "ai-assist": 400,
    "activity-plan": 500,
  };
  return groupBase[group] + _orderCounter;
}

function makeStat(params: {
  statId: string;
  label: string;
  value: string | number;
  description: string;
  source: UnifiedStatSource;
  href: string | null;
  group: UnifiedStatGroup;
}): UnifiedStatItem {
  _orderCounter++;
  const status: UnifiedStatStatus =
    params.source === "placeholder-not-connected" ? "not-connected"
    : params.source === "mixed" ? "available"
    : params.value === 0 || params.value === "0" || params.value === "" ? "empty"
    : "available";

  return {
    statId: params.statId,
    label: params.label,
    value: String(params.value),
    description: params.description,
    source: params.source,
    status,
    href: params.href,
    safetyLabel: "规则型统计 · " + SOURCE_BADGE[params.source] + " · 开发预览 · 未调用 LLM",
    sortOrder: nextOrder(params.group, 0),
    group: params.group,
  };
}

/**
 * Build the unified dashboard stats view by merging server-side and
 * client-side data into a single panel array.
 *
 * Rules:
 * - Server stats take precedence for "value" display
 * - If both server and local have data for a given stat, source = "mixed"
 * - If only server has data, source = "server-dev-db"
 * - If only local has data, source = "local-storage-fallback"
 * - If neither has data, source = "placeholder-not-connected"
 * - Each stat gets a unique statId, href, group, and safety label
 */
export function buildUnifiedStatsView(input: UnifiedStatsInput): UnifiedStatsView {
  const { serverStats, serverLearningStats, localStats, hasSession } = input;
  const local = localStats || createEmptyLocalStats();

  const stats: UnifiedStatItem[] = [];

  // ---- READING GROUP ----

  // 1. Favorite books
  const serverFavBooksCount = serverStats?.favoriteBooksCount ?? 0;
  const serverFavBooksSrc = serverStats?.favoriteBooksSource ?? "none";
  const localFavBooksCount = local.favoriteBookCount;
  const favBooksSource = resolveSource(serverFavBooksSrc, localFavBooksCount > 0);
  const favBooksValue = serverFavBooksSrc !== "none" ? serverFavBooksCount : localFavBooksCount;
  stats.push(makeStat({
    statId: "fav-books",
    label: "收藏书籍",
    value: favBooksValue,
    description: favBooksValue > 0 ? `已收藏 ${favBooksValue} 本书` : "暂无收藏书籍",
    source: favBooksSource,
    href: "/user/favorites/books",
    group: "reading",
  }));

  // 2. Recent reading
  const serverRecentReadingCount = serverStats?.recentReadingCount ?? 0;
  const serverRecentReadingSrc = serverStats?.recentReadingSource ?? "none";
  const localRecentReadingCount = local.recentReadingCount;
  const recentReadingSource = resolveSource(serverRecentReadingSrc, localRecentReadingCount > 0);
  const recentReadingValue = serverRecentReadingSrc !== "none" ? serverRecentReadingCount : localRecentReadingCount;
  stats.push(makeStat({
    statId: "recent-reading",
    label: "最近阅读",
    value: recentReadingValue,
    description: recentReadingValue > 0 ? `最近阅读 ${recentReadingValue} 个章节` : "暂无最近阅读记录",
    source: recentReadingSource,
    href: "/user/recent-reading",
    group: "reading",
  }));

  // 3. Reader bookmarks
  const serverBookmarksCount = serverStats?.readerBookmarksCount ?? 0;
  const serverBookmarksSrc = serverStats?.readerBookmarksSource ?? "none";
  const localBookmarkCount = local.bookmarkCount;
  const bookmarksSource = resolveSource(serverBookmarksSrc, localBookmarkCount > 0);
  const bookmarksValue = serverBookmarksSrc !== "none" ? serverBookmarksCount : localBookmarkCount;
  stats.push(makeStat({
    statId: "bookmarks",
    label: "阅读书签",
    value: bookmarksValue,
    description: bookmarksValue > 0 ? `${bookmarksValue} 个阅读书签` : "暂无阅读书签",
    source: bookmarksSource,
    href: "/user/bookmarks",
    group: "reading",
  }));

  // 4. Reader notes
  const serverNotesCount = serverStats?.readerNotesCount ?? 0;
  const serverNotesSrc = serverStats?.readerNotesSource ?? "none";
  const localNoteCount = local.noteCount;
  const notesSource = resolveSource(serverNotesSrc, localNoteCount > 0);
  const notesValue = serverNotesSrc !== "none" ? serverNotesCount : localNoteCount;
  stats.push(makeStat({
    statId: "notes",
    label: "阅读笔记",
    value: notesValue,
    description: notesValue > 0 ? `${notesValue} 条阅读笔记` : "暂无阅读笔记",
    source: notesSource,
    href: "/user/notes",
    group: "reading",
  }));

  // ---- PROBLEMS GROUP ----

  // 5. Favorite problems
  const serverFavProblemsCount = serverStats?.favoriteProblemsCount ?? 0;
  const serverFavProblemsSrc = serverStats?.favoriteProblemsSource ?? "none";
  const localFavProblemCount = local.favoriteProblemCount;
  const favProblemsSource = resolveSource(serverFavProblemsSrc, localFavProblemCount > 0);
  const favProblemsValue = serverFavProblemsSrc !== "none" ? serverFavProblemsCount : localFavProblemCount;
  stats.push(makeStat({
    statId: "fav-problems",
    label: "收藏题目",
    value: favProblemsValue,
    description: favProblemsValue > 0 ? `已收藏 ${favProblemsValue} 道题` : "暂无收藏题目",
    source: favProblemsSource,
    href: "/user/favorites/problems",
    group: "problems",
  }));

  // 6. Recent practice
  const serverRecentProblemsCount = serverStats?.recentProblemsCount ?? 0;
  const serverRecentProblemsSrc = serverStats?.recentProblemsSource ?? "none";
  const localRecentPracticeCount = local.recentPracticeCount;
  const recentProblemsSource = resolveSource(serverRecentProblemsSrc, localRecentPracticeCount > 0);
  const recentProblemsValue = serverRecentProblemsSrc !== "none" ? serverRecentProblemsCount : localRecentPracticeCount;
  stats.push(makeStat({
    statId: "recent-practice",
    label: "最近刷题",
    value: recentProblemsValue,
    description: recentProblemsValue > 0 ? `最近练习 ${recentProblemsValue} 道题` : "暂无刷题记录",
    source: recentProblemsSource,
    href: "/user/recent-practice",
    group: "problems",
  }));

  // 7. Wrong book
  const serverWrongBookCount = serverStats?.wrongBookTotalCount ?? 0;
  const serverWrongBookSrc = serverStats?.wrongBookSource ?? "none";
  const localWrongBookCount = local.wrongBookTotalCount;
  const wrongBookSource = resolveSource(serverWrongBookSrc, localWrongBookCount > 0);
  const wrongBookValue = serverWrongBookSrc !== "none" ? serverWrongBookCount : localWrongBookCount;
  const wrongBookNeedsReview = serverStats?.wrongBookNeedsReviewCount ?? local.wrongBookNeedsReviewCount;
  stats.push(makeStat({
    statId: "wrong-book",
    label: "错题本",
    value: wrongBookValue,
    description: wrongBookValue > 0
      ? `${wrongBookValue} 条错题记录${wrongBookNeedsReview > 0 ? "（" + wrongBookNeedsReview + " 条待复习）" : ""}`
      : "暂无错题记录",
    source: wrongBookSource,
    href: "/user/wrong-book",
    group: "problems",
  }));

  // ---- REVIEW GROUP ----

  // 8. Review recommendations
  const localReviewRecCount = local.reviewRecommendationCount;
  stats.push(makeStat({
    statId: "review-recs",
    label: "待复习推荐",
    value: localReviewRecCount,
    description: localReviewRecCount > 0 ? `约 ${localReviewRecCount} 条复习推荐` : "暂无复习推荐",
    source: localReviewRecCount > 0 ? "local-storage-fallback" : "placeholder-not-connected",
    href: "/user/review",
    group: "review",
  }));

  // ---- AI ASSIST GROUP ----

  // 9. AI history
  const localAiHistoryCount = local.aiHistoryCount;
  stats.push(makeStat({
    statId: "ai-history",
    label: "AI 问答历史",
    value: localAiHistoryCount,
    description: localAiHistoryCount > 0 ? `${localAiHistoryCount} 条问答记录（安全摘要）` : "暂无 AI 问答历史",
    source: localAiHistoryCount > 0 ? "local-storage-fallback" : "placeholder-not-connected",
    href: "/user/ai-history",
    group: "ai-assist",
  }));

  // ---- ACTIVITY & PLAN GROUP ----

  // 10. Learning activities
  const serverActivityCount = serverLearningStats?.totalActivityCount ?? 0;
  const serverActivitySource = serverLearningStats?.dataSource ?? "none";
  const localActivityCount = local.learningActivityCount;
  const activitySource = serverActivitySource === "db" ? "server-dev-db"
    : localActivityCount > 0 ? "local-storage-fallback"
    : "placeholder-not-connected";
  const activityValue = serverActivitySource === "db" ? serverActivityCount
    : localActivityCount;
  stats.push(makeStat({
    statId: "learning-activities",
    label: "学习活动",
    value: activityValue,
    description: activityValue > 0 ? `${activityValue} 条学习活动记录` : "暂无学习活动记录",
    source: activitySource,
    href: "/user/activity",
    group: "activity-plan",
  }));

  // 11. Reading duration
  const serverReadingMinutes = serverLearningStats?.totalReadingMinutes ?? 0;
  const localReadingMinutes = local.totalReadingMinutes;
  const readingMinsSource = serverLearningStats?.anyDbActive ? "server-dev-db"
    : localReadingMinutes > 0 ? "local-storage-fallback"
    : "placeholder-not-connected";
  const readingMinsValue = serverLearningStats?.anyDbActive ? serverReadingMinutes
    : localReadingMinutes;
  stats.push(makeStat({
    statId: "reading-duration",
    label: "阅读时长",
    value: readingMinsValue + " 分钟",
    description: readingMinsValue > 0 ? `累计阅读 ${readingMinsValue} 分钟` : "暂无阅读时长记录",
    source: readingMinsSource,
    href: "/user/activity",
    group: "activity-plan",
  }));

  // 12. Today plan tasks
  const localTodayPlanCount = local.todayPlanTaskCount;
  stats.push(makeStat({
    statId: "today-plan",
    label: "今日计划任务",
    value: localTodayPlanCount,
    description: localTodayPlanCount > 0 ? `今日 ${localTodayPlanCount} 个建议任务` : "暂无今日计划",
    source: localTodayPlanCount > 0 ? "local-storage-fallback" : "placeholder-not-connected",
    href: "/user/today",
    group: "activity-plan",
  }));

  // 13. A399 Daily Challenge
  const dcActive = local.dailyChallengeActive;
  const dcTitle = local.dailyChallengeTitle;
  const dcStatus = local.dailyChallengeStatus;
  const dcValue = dcActive && dcTitle ? dcTitle : "—";
  const dcDesc = dcActive
    ? "今日挑战：" + (dcTitle || "—") + (dcStatus ? "（" + dcStatus + "）" : "")
    : "暂无每日挑战";
  stats.push(makeStat({
    statId: "daily-challenge",
    label: "每日挑战",
    value: dcValue,
    description: dcDesc,
    source: dcActive ? "local-storage-fallback" : "placeholder-not-connected",
    href: "/daily-challenge",
    group: "activity-plan",
  }));

  // Determine overall state
  const hasAnyData = stats.some(function (s) { return s.status === "available" && s.value !== "0"; });
  const serverStatsActive = serverStats?.anyDbActive || serverLearningStats?.anyDbActive || false;
  const localStatsActive = (local.favoriteBookCount + local.recentReadingCount +
    local.wrongBookTotalCount + local.noteCount + local.bookmarkCount +
    local.learningActivityCount + local.totalReadingMinutes +
    local.aiHistoryCount + local.favoriteProblemCount + local.recentPracticeCount) > 0;

  let overallNotice: string;
  if (serverStatsActive && localStatsActive) {
    overallNotice = OVERALL_NOTICE_MIXED;
  } else if (serverStatsActive) {
    overallNotice = OVERALL_NOTICE_ALL_DB;
  } else if (localStatsActive) {
    overallNotice = OVERALL_NOTICE_ALL_LOCAL;
  } else {
    overallNotice = OVERALL_NOTICE_NONE;
  }

  return {
    stats: stats.sort(function (a, b) { return a.sortOrder - b.sortOrder; }),
    groupLabels: GROUP_LABELS,
    overallNotice,
    hasAnyData,
    serverStatsActive,
    localStatsActive,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the data source indicator for a stat.
 *
 * - If server has it (source !== "none") and local also has data → "mixed"
 * - If only server has it → "server-dev-db"
 * - If only local has it → "local-storage-fallback"
 * - If neither has it → "placeholder-not-connected"
 */
function resolveSource(
  serverSource: "db" | "local" | "none",
  hasLocal: boolean,
): UnifiedStatSource {
  if (serverSource === "db" && hasLocal) return "mixed";
  if (serverSource === "db") return "server-dev-db";
  if (hasLocal) return "local-storage-fallback";
  return "placeholder-not-connected";
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

/**
 * Verify that a unified stats view contains no sensitive fields
 * or misleading production labels.
 */
export function unifiedStatsViewIsSafe(
  view: UnifiedStatsView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  for (let i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("Sensitive field matched: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (let j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.includes(FORBIDDEN_LABELS[j])) {
      violations.push("Forbidden label found: " + FORBIDDEN_LABELS[j]);
    }
  }

  // Verify each stat has a safety label
  for (let k = 0; k < view.stats.length; k++) {
    const s = view.stats[k];
    if (!s.safetyLabel || s.safetyLabel.length === 0) {
      violations.push("Stat " + s.statId + " missing safety label");
    }
    if (s.safetyLabel.indexOf("未调用 LLM") === -1) {
      violations.push("Stat " + s.statId + " safety label missing no-LLM statement");
    }
    for (let m = 0; m < FORBIDDEN_LABELS.length; m++) {
      if (s.safetyLabel.includes(FORBIDDEN_LABELS[m])) {
        violations.push("Stat " + s.statId + " safety label contains forbidden: " + FORBIDDEN_LABELS[m]);
      }
      if (s.description.includes(FORBIDDEN_LABELS[m])) {
        violations.push("Stat " + s.statId + " description contains forbidden: " + FORBIDDEN_LABELS[m]);
      }
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Check that no individual stat\'s value string contains sensitive patterns.
 */
export function unifiedStatsValuesAreSafe(
  view: UnifiedStatsView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (let i = 0; i < view.stats.length; i++) {
    const s = view.stats[i];
    for (let j = 0; j < SENSITIVE_PATTERNS.length; j++) {
      if (SENSITIVE_PATTERNS[j].test(s.value)) {
        violations.push("Stat " + s.statId + " value contains sensitive data: " + SENSITIVE_PATTERNS[j].source);
      }
    }
  }
  return { safe: violations.length === 0, violations };
}