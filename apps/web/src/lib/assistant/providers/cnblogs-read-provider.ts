import { loadArticleLibrary } from "../../../app/articles/article-library-loader.ts";
import { compareArticlesByPublishedAtDesc, parsePublishedAt } from "../../../app/articles/article-library-filter.ts";
import type { AggregatedArticle } from "../../../app/articles/article-library-types.ts";
import type { AssistantProviderStatus } from "./provider-types.ts";

export interface AssistantArticleResult {
  id: string;
  title: string;
  summary: string;
  source: "cnblogs" | "csdn";
  sourceName: string;
  publishedAt?: string;
  originalUrl: string;
  tags: string[];
}

export interface TechnicalArticleSearchInput {
  query?: string;
  tags?: string[];
  limit?: number;
}

export function createCnblogsReadProviderStatus(): AssistantProviderStatus {
  const library = loadArticleLibrary();
  const configured = library.articles.some((article) => article.sourcePlatform === "cnblogs");
  return {
    id: "cnblogs-read-provider",
    label: "CNBlogs read provider",
    configured,
    enabled: configured,
    healthy: configured ? true : false,
    capabilities: ["article_search", "article_hot"],
    requiredEnvNames: [],
    configuredEnvNames: [],
    missingEnvNames: configured ? [] : ["articles.generated.json"],
    sourceLabel: configured ? "cnblogs rss cache" : "cnblogs cache missing",
    safeDescription: configured
      ? "CNBlogs article cache is available."
      : "CNBlogs article cache is missing.",
    previewOnly: true,
    devOnly: true,
    productionReady: false,
  };
}

export function searchCnblogsTechnicalArticles(
  input: TechnicalArticleSearchInput = {},
): AssistantArticleResult[] {
  return searchArticlesBySource("cnblogs", input);
}

export function getCnblogsHotTechnicalArticles(
  input: Omit<TechnicalArticleSearchInput, "query"> = {},
): AssistantArticleResult[] {
  return getHotArticlesBySource("cnblogs", input);
}

export function toAssistantArticleResult(article: AggregatedArticle): AssistantArticleResult {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    source: article.sourcePlatform,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt ?? undefined,
    originalUrl: article.originalUrl,
    tags: [...article.categories],
  };
}

function searchArticlesBySource(
  source: "cnblogs" | "csdn",
  input: TechnicalArticleSearchInput,
): AssistantArticleResult[] {
  const library = loadArticleLibrary();
  const limit = clampLimit(input.limit ?? 10);
  const query = normalizeSearchText(input.query);
  const tags = normalizeTags(input.tags);

  const candidates = library.articles
    .filter((article) => article.sourcePlatform === source)
    .filter((article) => matchesQuery(article, query))
    .filter((article) => matchesTags(article, tags))
    .sort((left, right) => scoreArticle(right, query) - scoreArticle(left, query) || compareArticlesByPublishedAtDesc(left, right));

  return candidates.slice(0, limit).map(toAssistantArticleResult);
}

function getHotArticlesBySource(
  source: "cnblogs" | "csdn",
  input: Omit<TechnicalArticleSearchInput, "query">,
): AssistantArticleResult[] {
  const library = loadArticleLibrary();
  const limit = clampLimit(input.limit ?? 10);
  const tags = normalizeTags(input.tags);

  return library.articles
    .filter((article) => article.sourcePlatform === source)
    .filter((article) => matchesTags(article, tags))
    .sort(compareArticlesByPublishedAtDesc)
    .slice(0, limit)
    .map(toAssistantArticleResult);
}

function matchesQuery(article: AggregatedArticle, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystack = [
    article.title,
    article.summary,
    article.sourceName,
    article.author ?? "",
    article.categories.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesTags(article: AggregatedArticle, tags: readonly string[]): boolean {
  if (tags.length === 0) {
    return true;
  }

  const articleTags = new Set(article.categories.map((tag) => tag.toLowerCase()));
  return tags.every((tag) => articleTags.has(tag));
}

function scoreArticle(article: AggregatedArticle, query: string): number {
  const title = article.title.toLowerCase();
  const summary = article.summary.toLowerCase();
  let score = parsePublishedAt(article.publishedAt) ?? 0;

  if (query.length > 0 && title.includes(query)) {
    score += 20_000_000_000;
  }

  for (const token of query.split(/\s+/).filter((token) => token.length > 1)) {
    if (title.includes(token)) {
      score += 1_000_000_000;
    }
    if (summary.includes(token)) {
      score += 200_000_000;
    }
  }

  return score;
}

function normalizeSearchText(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .slice(0, 8);
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(10, Math.trunc(value)));
}
