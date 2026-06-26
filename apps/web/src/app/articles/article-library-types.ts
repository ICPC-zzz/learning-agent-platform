export type ArticleSourcePlatform = "cnblogs" | "csdn";

export const ARTICLE_SOURCE_PLATFORM_LABELS: Record<ArticleSourcePlatform, string> = {
  cnblogs: "博客园",
  csdn: "CSDN",
};

export const ARTICLE_BASE_CATEGORIES = [
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

export type ArticleBaseCategory = (typeof ARTICLE_BASE_CATEGORIES)[number];

export interface AggregatedArticle {
  id: string;
  title: string;
  summary: string;
  originalUrl: string;
  sourceName: string;
  sourcePlatform: ArticleSourcePlatform;
  author?: string;
  publishedAt?: string | null;
  categories: string[];
  feedId: string;
  fetchedAt: string;
}

export interface ArticleLibraryLoadResult {
  status: "loaded" | "empty";
  articles: AggregatedArticle[];
  totalCount: number;
  cnblogsCount: number;
  csdnCount: number;
  categoryCounts: Record<string, number>;
  generatedAt?: string;
  message?: string;
}

