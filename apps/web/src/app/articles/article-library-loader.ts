import fs from "node:fs";
import path from "node:path";

import {
  ARTICLE_BASE_CATEGORIES,
  type AggregatedArticle,
  type ArticleLibraryLoadResult,
} from "./article-library-types.ts";
import { compareArticlesByPublishedAtDesc, parsePublishedAt } from "./article-library-filter.ts";

type ArticleDataFile = AggregatedArticle[];

const DEFAULT_ARTICLE_DATA_PATHS = [
  path.resolve(process.cwd(), "src/data/articles.generated.json"),
  path.resolve(process.cwd(), "apps/web/src/data/articles.generated.json"),
];

function resolveDefaultArticleDataPath(): string {
  for (const candidate of DEFAULT_ARTICLE_DATA_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return DEFAULT_ARTICLE_DATA_PATHS[0];
}

export function loadArticleLibrary(dataFilePath: string = resolveDefaultArticleDataPath()): ArticleLibraryLoadResult {
  const articles = normalizeArticles(readArticles(dataFilePath));
  const categoryCounts = collectCategoryCounts(articles);
  const cnblogsCount = articles.filter((article) => article.sourcePlatform === "cnblogs").length;
  const csdnCount = articles.filter((article) => article.sourcePlatform === "csdn").length;

  if (articles.length === 0) {
    return {
      status: "empty",
      articles: [],
      totalCount: 0,
      cnblogsCount: 0,
      csdnCount: 0,
      categoryCounts,
      message: "暂无可展示的技术文章。请先运行采集器生成 `articles.generated.json`。",
    };
  }

  return {
    status: "loaded",
    articles,
    totalCount: articles.length,
    cnblogsCount,
    csdnCount,
    categoryCounts,
    generatedAt: inferLatestFetchedAt(articles),
  };
}

function readArticles(dataFilePath: string): ReadonlyArray<unknown> {
  try {
    const raw = fs.readFileSync(dataFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeArticles(raw: ReadonlyArray<unknown>): AggregatedArticle[] {
  const typed = raw as ArticleDataFile;
  return typed
    .filter(isValidArticleRecord)
    .map((article) => ({
      ...article,
      title: normalizeText(article.title),
      summary: normalizeText(article.summary),
      originalUrl: normalizeText(article.originalUrl),
      sourceName: normalizeText(article.sourceName),
      author: normalizeOptionalText(article.author),
      publishedAt: normalizeOptionalText(article.publishedAt),
      categories: normalizeCategories(article.categories),
      feedId: normalizeText(article.feedId),
      fetchedAt: normalizeText(article.fetchedAt),
    }))
    .sort(compareArticlesByPublishedAtDesc);
}

function isValidArticleRecord(article: unknown): article is AggregatedArticle {
  if (!article || typeof article !== "object" || Array.isArray(article)) return false;
  const value = article as Record<string, unknown>;
  return (
    typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.summary === "string"
    && typeof value.originalUrl === "string"
    && typeof value.sourceName === "string"
    && (value.sourcePlatform === "cnblogs" || value.sourcePlatform === "csdn")
    && Array.isArray(value.categories)
    && typeof value.feedId === "string"
    && typeof value.fetchedAt === "string"
  );
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeCategories(categories: readonly string[]): string[] {
  const normalized = new Set<string>();
  for (const category of categories) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    normalized.add(trimmed);
  }
  if (normalized.size === 0) {
    normalized.add("其他");
  }
  return [...normalized].slice(0, 3);
}

function collectCategoryCounts(articles: AggregatedArticle[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of ARTICLE_BASE_CATEGORIES) {
    counts[category] = 0;
  }
  for (const article of articles) {
    for (const category of article.categories) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }
  return counts;
}

function inferLatestFetchedAt(articles: AggregatedArticle[]): string | undefined {
  const latest = articles
    .map((article) => parsePublishedAt(article.fetchedAt))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];
  return latest ? new Date(latest).toISOString() : undefined;
}
