import type { AssistantSource } from "../assistant-types.ts";
import {
  getCnblogsHotTechnicalArticles,
  searchCnblogsTechnicalArticles,
  type AssistantArticleResult,
} from "../providers/cnblogs-read-provider.ts";
import {
  getCsdnHotTechnicalArticles,
  searchCsdnTechnicalArticles,
} from "../providers/csdn-article-provider.ts";
import type {
  AssistantToolDefinition,
  AssistantToolExecutionContext,
  AssistantToolExecutionResult,
} from "./tool-types.ts";

export interface SearchTechnicalArticlesInput {
  query?: string;
  tags?: string[];
  source?: "all" | "cnblogs" | "csdn";
  limit?: number;
}

export interface HotTechnicalArticlesInput {
  source?: "all" | "cnblogs" | "csdn";
  tags?: string[];
  limit?: number;
}

export function createSearchTechnicalArticlesDefinition(): AssistantToolDefinition<SearchTechnicalArticlesInput, AssistantArticleResult> {
  return {
    name: "search_technical_articles",
    description: "从博客园和 CSDN 缓存中搜索技术文章。",
    inputSchema: {
      type: "object",
      title: "搜索技术文章输入",
      description: "按关键词、标签和来源筛选。",
      properties: {
        query: { type: "string", description: "搜索关键词。" },
        tags: { type: "array", description: "分类标签。", items: { type: "string", description: "单个标签。" } },
        source: { type: "string", description: '"all" | "cnblogs" | "csdn"' },
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: articleOutputSchema(),
    timeoutMs: 5_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "技术文章缓存",
    validateInput: isSearchTechnicalArticlesInput,
    execute: (input, context) => executeSearchTechnicalArticles(input, context),
  };
}

export function createHotTechnicalArticlesDefinition(): AssistantToolDefinition<HotTechnicalArticlesInput, AssistantArticleResult> {
  return {
    name: "get_hot_technical_articles",
    description: "从公开缓存读取近期或热门技术文章。",
    inputSchema: {
      type: "object",
      title: "热门技术文章输入",
      description: "按来源和标签读取近期或热门文章。",
      properties: {
        source: { type: "string", description: '"all" | "cnblogs" | "csdn"' },
        tags: { type: "array", description: "分类标签。", items: { type: "string", description: "单个标签。" } },
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: articleOutputSchema(),
    timeoutMs: 5_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "技术文章缓存",
    validateInput: isHotTechnicalArticlesInput,
    execute: (input, context) => executeHotTechnicalArticles(input, context),
  };
}

export async function executeSearchTechnicalArticles(
  input: SearchTechnicalArticlesInput,
  _context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantArticleResult>> {
  const normalized = normalizeSource(input.source);
  const query = normalizeText(input.query);
  const tags = normalizeTags(input.tags);
  const limit = clampLimit(input.limit ?? 10);

  const items = normalized === "cnblogs"
    ? searchCnblogsTechnicalArticles({ query, tags, limit })
    : normalized === "csdn"
      ? searchCsdnTechnicalArticles({ query, tags, limit })
      : mergeAndDedupe([
          ...searchCnblogsTechnicalArticles({ query, tags, limit }),
          ...searchCsdnTechnicalArticles({ query, tags, limit }),
        ], limit);

  return {
    name: "search_technical_articles",
    ok: items.length > 0,
    summary: summarizeArticles(items, "技术文章搜索结果"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["未找到匹配的技术文章"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "未找到匹配的技术文章。",
  };
}

export async function executeHotTechnicalArticles(
  input: HotTechnicalArticlesInput,
  _context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantArticleResult>> {
  const normalized = normalizeSource(input.source);
  const tags = normalizeTags(input.tags);
  const limit = clampLimit(input.limit ?? 10);

  const items = normalized === "cnblogs"
    ? getCnblogsHotTechnicalArticles({ tags, limit })
    : normalized === "csdn"
      ? getCsdnHotTechnicalArticles({ tags, limit })
      : mergeAndDedupe([
          ...getCnblogsHotTechnicalArticles({ tags, limit }),
          ...getCsdnHotTechnicalArticles({ tags, limit }),
        ], limit);

  return {
    name: "get_hot_technical_articles",
    ok: items.length > 0,
    summary: summarizeArticles(items, "热门技术文章"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["未找到匹配的热门技术文章"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "未找到匹配的热门技术文章。",
  };
}

function isSearchTechnicalArticlesInput(value: unknown): value is SearchTechnicalArticlesInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.query === undefined || typeof record.query === "string") &&
    (record.source === undefined || record.source === "all" || record.source === "cnblogs" || record.source === "csdn") &&
    (record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit))) &&
    (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")))
  );
}

function isHotTechnicalArticlesInput(value: unknown): value is HotTechnicalArticlesInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.source === undefined || record.source === "all" || record.source === "cnblogs" || record.source === "csdn") &&
    (record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit))) &&
    (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")))
  );
}

function mergeAndDedupe(items: readonly AssistantArticleResult[], limit: number): AssistantArticleResult[] {
  const seen = new Set<string>();
  const result: AssistantArticleResult[] = [];

  for (const item of items) {
    const key = item.originalUrl || item.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function summarizeArticles(items: readonly AssistantArticleResult[], prefix: string): string {
  if (items.length === 0) {
    return `${prefix}：没有结果。`;
  }

  const lines = [prefix];
  for (const item of items.slice(0, 5)) {
    const published = item.publishedAt ? ` | ${item.publishedAt.slice(0, 10)}` : "";
    lines.push(`- ${item.title}${published} | ${item.sourceName}`);
  }
  return lines.join("\n");
}

function toAssistantSources(items: readonly AssistantArticleResult[]): AssistantSource[] {
  return items.map((item) => ({
    title: item.title,
    source: item.sourceName,
    url: item.originalUrl,
  }));
}

function normalizeText(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeSource(value: string | undefined): "all" | "cnblogs" | "csdn" {
  if (value === "cnblogs" || value === "csdn" || value === "all") {
    return value;
  }

  return "all";
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(10, Math.trunc(value)));
}

function articleOutputSchema() {
  return {
    type: "object" as const,
    title: "技术文章条目",
    description: "安全的文章预览结果。",
    properties: {
      id: { type: "string" as const, description: "稳定 ID。" },
      title: { type: "string" as const, description: "文章标题。" },
      summary: { type: "string" as const, description: "短摘要。" },
      source: { type: "string" as const, description: "来源平台。" },
      sourceName: { type: "string" as const, description: "可读来源名称。" },
      publishedAt: { type: "string" as const, description: "发布时间。" },
      originalUrl: { type: "string" as const, description: "原文链接。" },
      tags: { type: "array" as const, description: "文章标签。", items: { type: "string" as const, description: "单个标签。" } },
    },
    additionalProperties: false as const,
  };
}
