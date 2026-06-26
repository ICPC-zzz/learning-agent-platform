import type { ArticleReadingRecord } from "@learning-agent-platform/db";

export interface DbRecentArticleReadingView {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  lastReadAt: string;
  createdAt: string;
  updatedAt: string;
  source: "db-article-reading";
  ownerLabel: string | null;
  notice: string;
}

export interface DbArticleRecentReadingLoadResult {
  guardEnabled: boolean;
  useDbRecentReadings: boolean;
  items: DbRecentArticleReadingView[];
  message: string;
  ownerLabel: string | null;
}

export function mapArticleReadingRecordToView(
  record: ArticleReadingRecord,
  ownerLabel?: string | null,
): DbRecentArticleReadingView {
  return {
    articleId: record.articleId,
    articleTitle: record.articleTitle,
    sourcePlatform: record.sourcePlatform,
    sourceName: record.sourceName,
    originalUrl: record.originalUrl,
    lastReadAt: record.lastReadAt instanceof Date ? record.lastReadAt.toISOString() : String(record.lastReadAt),
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    source: "db-article-reading",
    ownerLabel: ownerLabel ?? "dev session user",
    notice: "dev-only / 绑定当前 dev session / 未同步生产账号",
  };
}

export function createEmptyDbArticleRecentReadingLoadResult(
  guardEnabled: boolean,
  message: string,
): DbArticleRecentReadingLoadResult {
  return {
    guardEnabled,
    useDbRecentReadings: false,
    items: [],
    message,
    ownerLabel: null,
  };
}

export function buildDbArticleRecentReadingLoadResult(
  records: readonly ArticleReadingRecord[],
  ownerLabel?: string | null,
): DbArticleRecentReadingLoadResult {
  return {
    guardEnabled: true,
    useDbRecentReadings: true,
    items: records.map((r) => mapArticleReadingRecordToView(r, ownerLabel)),
    message:
      records.length === 0
        ? "当前 dev session 下暂无最近阅读文章。"
        : `${records.length} 条最近阅读文章已从数据库加载。`,
    ownerLabel: ownerLabel ?? "dev session user",
  };
}
