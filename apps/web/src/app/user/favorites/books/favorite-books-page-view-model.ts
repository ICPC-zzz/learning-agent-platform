/**
 * Favorite Books Page View Model — pure logic for /user/favorites/books page.
 *
 * Handles DB favorites priority, localStorage fallback, session state,
 * empty state, safety filtering, and unfavorite entry points.
 *
 * @module favorite-books-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { DbFavoriteBookView } from "../../favorites-db-view-model";
import type { FavoriteBookEntry } from "../../../../lib/local-user-library-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteBooksPageView {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** Whether the DB favorites guard is enabled. */
  dbFavoritesEnabled: boolean;
  /** User-facing data source label. */
  dataSourceLabel: string;
  /** Data source notice for UI display. */
  dataSourceNotice: string;
  /** Favorite items to display (DB or local). */
  items: FavoriteBooksPageItemView[];
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

export interface FavoriteBooksPageItemView {
  bookId: string;
  title: string;
  sourceType: string;
  firstChapterId: string | null;
  favoriteTime: string;
  /** Badge label: 开发 DB 收藏 or 本地收藏 fallback */
  badge: "db-favorite" | "local-fallback";
  /** Badge display text. */
  badgeText: string;
  /** Book detail URL. */
  detailUrl: string;
  /** Reader URL (if first chapter available). */
  readUrl: string | null;
  /** Unfavorite action label. */
  unfavoriteLabel: string;
  /** Whether unfavorite targets DB (vs. localStorage). */
  unfavoriteTarget: "db" | "local";
}

export interface FavoriteBooksPageInput {
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** DB favorites from loader. */
  dbFavorites: DbFavoriteBookView[] | null;
  /** Whether DB favorites guard passed. */
  dbFavoritesEnabled: boolean;
  /** DB loader message. */
  dbFavoritesMessage: string | null;
  /** LocalStorage favorites. */
  localFavorites: FavoriteBookEntry[];
  /** Dev session owner display name. */
  ownerLabel?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_MESSAGES = {
  noData: "暂无收藏书籍",
  devPreview: "收藏功能当前为开发预览",
  dbEnabledEmpty: "DB 收藏已启用但当前无收藏记录。使用收藏按钮添加。",
  localOnly: "收藏数据仅保存在浏览器 localStorage 中，未同步到数据库。",
  notLoggedIn: "未登录 dev session。收藏数据保存在本地浏览器，未同步账号。",
} as const;

const FORBIDDEN_LABELS = [
  "云端收藏成功",
  "生产收藏已保存",
  "真实用户收藏系统已完成",
  "云端同步成功",
  "生产可用",
  "真实用户系统已完成",
] as const;

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

/**
 * Build the favorite books page view model.
 *
 * DB favorites take priority when DB guard is enabled and data exists.
 * Falls back to localStorage favorites otherwise.
 *
 * Always renders safe — no secrets, no misleading production labels.
 */
export function buildFavoriteBooksPageView(
  input: FavoriteBooksPageInput,
): FavoriteBooksPageView {
  const { hasSession, dbFavorites, dbFavoritesEnabled, dbFavoritesMessage, localFavorites, ownerLabel } = input;

  // Determine data source
  const useDbFavorites = dbFavoritesEnabled && dbFavorites !== null && dbFavorites.length > 0;
  const items = useDbFavorites
    ? mapDbFavoritesToPageItems(dbFavorites!)
    : mapLocalFavoritesToPageItems(localFavorites);

  const dataSourceLabel = useDbFavorites
    ? "开发 DB 收藏（dev-only）"
    : "本地收藏 fallback";
  const dataSourceNotice = useDbFavorites
    ? (dbFavoritesMessage ?? "开发 DB 收藏 · 绑定 dev session 用户 · 未接生产同步")
    : (hasSession
      ? "Dev session 已连接，但收藏数据为本地存储，未同步到数据库。"
      : "当前未登录，收藏数据保存在本地浏览器中。");

  const isEmpty = items.length === 0;

  let emptyMessage: string;
  let emptySubMessage: string;

  if (!isEmpty) {
    emptyMessage = "";
    emptySubMessage = "";
  } else if (!hasSession) {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = EMPTY_MESSAGES.notLoggedIn;
  } else if (dbFavoritesEnabled) {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = EMPTY_MESSAGES.dbEnabledEmpty;
  } else {
    emptyMessage = EMPTY_MESSAGES.noData;
    emptySubMessage = `${EMPTY_MESSAGES.devPreview} · ${EMPTY_MESSAGES.localOnly}`;
  }

  return {
    hasSession,
    dbFavoritesEnabled,
    dataSourceLabel,
    dataSourceNotice,
    items,
    totalCount: items.length,
    emptyMessage,
    emptySubMessage,
    isEmpty,
    ownerLabel: ownerLabel ?? null,
    loginUrl: "/login?redirect=/user/favorites/books",
  };
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapDbFavoritesToPageItems(
  dbFavorites: DbFavoriteBookView[],
): FavoriteBooksPageItemView[] {
  return dbFavorites.map((fav) => ({
    bookId: fav.bookId,
    title: fav.bookTitle,
    sourceType: fav.sourceType,
    firstChapterId: fav.firstChapterId,
    favoriteTime: fav.createdAt,
    badge: "db-favorite" as const,
    badgeText: "开发 DB 收藏",
    detailUrl: `/books/${encodeURIComponent(fav.bookId)}`,
    readUrl: fav.firstChapterId
      ? `/reader?bookId=${encodeURIComponent(fav.bookId)}&chapterId=${encodeURIComponent(fav.firstChapterId)}`
      : null,
    unfavoriteLabel: "取消收藏（开发 DB）",
    unfavoriteTarget: "db" as const,
  }));
}

function mapLocalFavoritesToPageItems(
  localFavorites: FavoriteBookEntry[],
): FavoriteBooksPageItemView[] {
  return localFavorites.map((fav) => ({
    bookId: fav.bookId,
    title: fav.title,
    sourceType: fav.sourceType,
    firstChapterId: fav.firstChapterId ?? null,
    favoriteTime: fav.updatedAt,
    badge: "local-fallback" as const,
    badgeText: "本地收藏 fallback",
    detailUrl: `/books/${encodeURIComponent(fav.bookId)}`,
    readUrl: fav.firstChapterId
      ? `/reader?bookId=${encodeURIComponent(fav.bookId)}&chapterId=${encodeURIComponent(fav.firstChapterId)}`
      : null,
    unfavoriteLabel: "取消收藏（本地）",
    unfavoriteTarget: "local" as const,
  }));
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
export function favoriteBooksPageViewIsSafe(view: FavoriteBooksPageView): {
  safe: boolean;
  violations: string[];
} {
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
        violations.push(`Sensitive field in item ${item.bookId}: ${pattern.source}`);
      }
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Check that no production-misleading labels appear in a collection of strings.
 */
export function noMisleadingProductionLabels(
  labels: readonly string[],
): boolean {
  return labels.every(
    (label) => !FORBIDDEN_LABELS.some((forbidden) => label.includes(forbidden)),
  );
}
