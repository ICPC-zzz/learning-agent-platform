import type { AggregatedArticle, ArticleSourcePlatform } from "./article-library-types.ts";

export type ArticleSourceFilter = "all" | ArticleSourcePlatform;
export type ArticleCategoryFilter = "all" | string;

export interface ArticleFilterState {
  query: string;
  source: ArticleSourceFilter;
  category: ArticleCategoryFilter;
}

export const ARTICLE_SOURCE_FILTERS: Array<{ value: ArticleSourceFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "cnblogs", label: "博客园" },
  { value: "csdn", label: "CSDN" },
];

export const ARTICLE_CATEGORY_FILTERS = [
  "全部",
  "Python",
  "Java",
  "C/C++",
  "Go",
  "JavaScript",
  "前端",
  "后端",
  "数据库",
  "算法",
  "AI",
  "运维/云原生",
  "系统设计",
  "其他",
] as const;

export function filterAndSortArticles(
  articles: readonly AggregatedArticle[],
  filters: ArticleFilterState,
): AggregatedArticle[] {
  const query = normalizeSearchQuery(filters.query);
  const source = filters.source;
  const category = filters.category;

  return [...articles]
    .filter((article) => source === "all" || article.sourcePlatform === source)
    .filter((article) => category === "all" || article.categories.includes(category))
    .filter((article) => {
      if (!query) return true;
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
    })
    .sort(compareArticlesByPublishedAtDesc);
}

export function compareArticlesByPublishedAtDesc(left: AggregatedArticle, right: AggregatedArticle): number {
  const leftTime = parsePublishedAt(left.publishedAt);
  const rightTime = parsePublishedAt(right.publishedAt);
  if (leftTime !== rightTime) {
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;
    return rightTime - leftTime;
  }

  const titleCompare = left.title.localeCompare(right.title, "zh-Hans-CN");
  if (titleCompare !== 0) return titleCompare;

  return left.sourceName.localeCompare(right.sourceName, "zh-Hans-CN");
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function parsePublishedAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}
