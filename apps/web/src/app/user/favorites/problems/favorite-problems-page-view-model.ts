/**
 * Favorite Problems Page View Model — builds UI views for the
 * /user/favorites/problems page, prioritizing DB data with
 * localStorage fallback.
 *
 * @module favorite-problems-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { FavoriteProblemEntry } from "../../../../lib/local-user-problem-store";
import type { DbProblemFavoriteView } from "../../problem-favorites-db-loader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoriteProblemPageView {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  favoritedAt: string;
  source: "db-problem-favorite" | "local-problem-favorite";
  notice: string;
}

export interface FavoriteProblemsPageViewModel {
  items: FavoriteProblemPageView[];
  sourceType: "db" | "local" | "empty";
  count: number;
  message: string;
  notice: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapDbView(pageView: DbProblemFavoriteView): FavoriteProblemPageView {
  return {
    problemId: pageView.problemId,
    title: pageView.problemTitle,
    difficulty: pageView.difficulty,
    tags: pageView.tags,
    favoritedAt: pageView.createdAt,
    source: "db-problem-favorite",
    notice: pageView.notice,
  };
}

function mapLocalView(entry: FavoriteProblemEntry): FavoriteProblemPageView {
  return {
    problemId: entry.problemId,
    title: entry.title,
    difficulty: entry.difficulty,
    tags: entry.tags,
    favoritedAt: entry.favoritedAt,
    source: "local-problem-favorite",
    notice: "本地收藏 · 未接生产同步 · 仅在当前浏览器中可用",
  };
}

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildFavoriteProblemsPageViewModel(params: {
  dbFavorites: DbProblemFavoriteView[];
  dbFavoritesEnabled: boolean;
  localFavorites: FavoriteProblemEntry[];
  hasSession: boolean;
}): FavoriteProblemsPageViewModel {
  const { dbFavorites, dbFavoritesEnabled, localFavorites, hasSession } = params;

  // DB priority
  if (dbFavoritesEnabled && dbFavorites.length > 0) {
    const items = dbFavorites.map(mapDbView);
    return {
      items,
      sourceType: "db",
      count: items.length,
      message: `${items.length} 道收藏题目（开发 DB）`,
      notice: "开发 DB 收藏 · 绑定 dev session · 未接生产同步",
    };
  }

  // Local fallback
  if (localFavorites.length > 0) {
    const items = localFavorites.map(mapLocalView);
    return {
      items,
      sourceType: "local",
      count: items.length,
      message: `${items.length} 道收藏题目（本地）`,
      notice: "数据来自 local storage 本地存储 · 未连接数据库 · 未接生产账号",
    };
  }

  // Empty
  return {
    items: [],
    sourceType: "empty",
    count: 0,
    message: hasSession
      ? "暂无收藏题目。前往题目中心浏览并收藏。"
      : "请先登录 dev session 后使用收藏功能。",
    notice: hasSession
      ? "在题目中心点击收藏按钮即可添加。"
      : "收藏功能需登录 dev session。",
  };
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
];

export function favoriteProblemsPageViewModelIsSafe(
  vm: FavoriteProblemsPageViewModel,
): boolean {
  const json = JSON.stringify(vm);
  return !SENSITIVE_PATTERNS.some((p) => p.test(json));
}
