/**
 * Recent Reading Page View Model — pure logic for /user/recent-reading page.
 *
 * Handles DB reading progress priority, localStorage fallback,
 * session state, empty state, and safety filtering.
 *
 * @module recent-reading-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbReadingProgressSummary } from "../../user-recent-reading-db-loader";
import type { RecentReadingEntry } from "../../../../lib/local-user-library-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentReadingPageView {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** Whether DB reading progress guard is enabled. */
  dbProgressEnabled: boolean;
  /** User-facing data source label. */
  dataSourceLabel: string;
  /** Data source notice for UI display. */
  dataSourceNotice: string;
  /** Reading progress items to display (DB or local). */
  items: RecentReadingPageItemView[];
  /** Total count of displayed items. */
  totalCount: number;
  /** Empty state message. */
  emptyMessage: string;
  /** Empty state sub-message. */
  emptySubMessage: string;
  /** Whether the list is empty. */
  isEmpty: boolean;
  /** Session owner display name. */
  ownerLabel: string | null;
  /** Login entry URL. */
  loginUrl: string;
}

export interface RecentReadingPageItemView {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  progressPercent: number;
  progressDisplay: string;
  updatedAt: string;
  sourceType: string;
  /** Badge: 开发 DB 阅读进度 or 本地最近阅读 fallback */
  badge: "db-progress" | "local-fallback";
  /** Badge display text. */
  badgeText: string;
  /** Continue reading URL. */
  continueReadingUrl: string;
  /** Book detail URL. */
  detailUrl: string;
}

export interface RecentReadingPageInput {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** DB reading progress items. */
  dbProgressItems: DbReadingProgressSummary[] | null;
  /** Whether DB progress guard is enabled. */
  dbProgressEnabled: boolean;
  /** DB loader message. */
  dbProgressMessage: string | null;
  /** LocalStorage recent reading entries. */
  localEntries: RecentReadingEntry[];
  /** Dev session owner display name. */
  ownerLabel?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_MESSAGES = {
  noData: "暂无最近阅读",
  notLoggedIn: "未登录 dev session。最近阅读数据保存在本地浏览器，未同步账号。",
  dbProgressEmpty: "开发 DB 阅读进度为空。前往 Reader 开始阅读后将在此显示。",
  localOnly: "最近阅读数据仅保存在浏览器 localStorage 中，未同步到数据库。",
} as const;

const FORBIDDEN_LABELS = [
  "云端同步完成",
  "生产阅读进度已保存",
  "真实用户进度系统已完成",
  "云端同步成功",
  "生产可用",
  "真实用户系统已完成",
  "云端收藏成功",
  "生产收藏已保存",
] as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

/**
 * Build the recent reading page view model.
 *
 * DB reading progress takes priority when DB guard is enabled and data exists.
 * Falls back to localStorage recent reading otherwise.
 *
 * Always renders safe — no secrets, no misleading production labels.
 */
export function buildRecentReadingPageView(
  input: RecentReadingPageInput,
): RecentReadingPageView {
  const {
    hasSession,
    dbProgressItems,
    dbProgressEnabled,
    dbProgressMessage,
    localEntries,
    ownerLabel,
  } = input;

  // Determine data source
  const useDbProgress =
    dbProgressEnabled && dbProgressItems !== null && dbProgressItems.length > 0;
  const items = useDbProgress
    ? mapDbProgressToPageItems(dbProgressItems!)
    : mapLocalEntriesToPageItems(localEntries);

  const dataSourceLabel = useDbProgress
    ? "开发 DB 阅读进度（dev-only）"
    : "本地最近阅读 fallback";
  const dataSourceNotice = useDbProgress
    ? (dbProgressMessage ?? "开发 DB 阅读进度 · 绑定 dev session 用户 · 未接生产同步")
    : (hasSession
      ? "Dev session 已连接，但最近阅读数据为本地存储，未同步到数据库。"
      : "当前未登录，最近阅读数据保存在本地浏览器中。");

  const isEmpty = items.length === 0;

  let emptyMessage: string;
  let emptySubMessage: string;

  if (!isEmpty) {
    emptyMessage = "";
    emptySubMessage = "";
  } else if (!hasSession) {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = EMPTY_MESSAGES.notLoggedIn;
  } else if (dbProgressEnabled) {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = EMPTY_MESSAGES.dbProgressEmpty;
  } else {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = EMPTY_MESSAGES.localOnly;
  }

  return {
    hasSession,
    dbProgressEnabled,
    dataSourceLabel,
    dataSourceNotice,
    items,
    totalCount: items.length,
    emptyMessage,
    emptySubMessage,
    isEmpty,
    ownerLabel: ownerLabel ?? null,
    loginUrl: "/login?redirect=/user/recent-reading",
  };
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapDbProgressToPageItems(
  dbProgress: DbReadingProgressSummary[],
): RecentReadingPageItemView[] {
  return dbProgress.map((p) => ({
    bookId: p.bookId,
    bookTitle: p.bookTitle,
    chapterTitle: p.chapterTitle,
    progressPercent: p.progressPercent,
    progressDisplay: formatProgressPercent(p.progressPercent),
    updatedAt: p.updatedAt,
    sourceType: "db-progress" as string,
    badge: "db-progress" as const,
    badgeText: "开发 DB 阅读进度",
    continueReadingUrl: `/reader?bookId=${encodeURIComponent(p.bookId)}&chapterId=${encodeURIComponent(p.chapterId)}`,
    detailUrl: `/books/${encodeURIComponent(p.bookId)}`,
  }));
}

function mapLocalEntriesToPageItems(
  localEntries: RecentReadingEntry[],
): RecentReadingPageItemView[] {
  return localEntries.map((entry) => ({
    bookId: entry.bookId,
    bookTitle: entry.bookTitle,
    chapterTitle: entry.chapterTitle,
    progressPercent: 0, // localStorage entries don't have progress ratio
    progressDisplay: "N/A（本地记录）",
    updatedAt: entry.lastReadAt,
    sourceType: entry.sourceType,
    badge: "local-fallback" as const,
    badgeText: "本地最近阅读 fallback",
    continueReadingUrl: `/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`,
    detailUrl: `/books/${encodeURIComponent(entry.bookId)}`,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a progress percentage for UI display.
 */
export function formatProgressPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0%";
  const clamped = Math.min(Math.max(Math.round(percent), 0), 100);
  return `${clamped}%`;
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
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
  /\brawText\b/i,
  /\braw[_\s-]*prompt\b/i,
  /\braw[_\s-]*response\b/i,
];

/**
 * Verify that a page view contains no sensitive fields or misleading labels.
 */
export function recentReadingPageViewIsSafe(
  view: RecentReadingPageView,
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(view);

  // Check sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  // Check forbidden labels
  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  // Check individual item fields
  for (const item of view.items) {
    const itemJson = JSON.stringify(item);
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(itemJson)) {
        violations.push(
          `Sensitive field in item ${item.bookId}: ${pattern.source}`,
        );
      }
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Check that continue reading URLs are well-formed.
 */
export function continueReadingUrlsAreValid(
  items: RecentReadingPageItemView[],
): boolean {
  for (const item of items) {
    if (!item.continueReadingUrl.startsWith("/reader?bookId=")) return false;
    if (!item.continueReadingUrl.includes("chapterId=")) return false;
  }
  return true;
}
