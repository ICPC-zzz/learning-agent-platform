import type { ArticleFavoriteRecord } from "@learning-agent-platform/db";

export interface DbFavoriteArticleView {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  createdAt: string;
  updatedAt: string;
  source: "db-article-favorite";
  ownerLabel: string | null;
  notice: string;
}

export interface DbArticleFavoritesLoadResult {
  guardEnabled: boolean;
  useDbFavorites: boolean;
  items: DbFavoriteArticleView[];
  message: string;
  ownerLabel: string | null;
}

export function mapArticleFavoriteRecordToView(
  record: ArticleFavoriteRecord,
  ownerLabel?: string | null,
): DbFavoriteArticleView {
  return {
    articleId: record.articleId,
    articleTitle: record.articleTitle,
    sourcePlatform: record.sourcePlatform,
    sourceName: record.sourceName,
    originalUrl: record.originalUrl,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    source: "db-article-favorite",
    ownerLabel: ownerLabel ?? "dev session user",
    notice: "dev-only / 绑定当前 dev session / 未同步生产账号",
  };
}

export function createEmptyDbArticleFavoritesLoadResult(
  guardEnabled: boolean,
  message: string,
): DbArticleFavoritesLoadResult {
  return {
    guardEnabled,
    useDbFavorites: false,
    items: [],
    message,
    ownerLabel: null,
  };
}

export function buildDbArticleFavoritesLoadResult(
  records: readonly ArticleFavoriteRecord[],
  ownerLabel?: string | null,
): DbArticleFavoritesLoadResult {
  return {
    guardEnabled: true,
    useDbFavorites: true,
    items: records.map((r) => mapArticleFavoriteRecordToView(r, ownerLabel)),
    message:
      records.length === 0
        ? "当前 dev session 下暂无文章收藏。"
        : `${records.length} 条文章收藏已从数据库加载。`,
    ownerLabel: ownerLabel ?? "dev session user",
  };
}
