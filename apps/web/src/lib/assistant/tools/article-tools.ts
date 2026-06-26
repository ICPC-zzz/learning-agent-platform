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
    description: "Search technical articles from CNBlogs and CSDN caches.",
    inputSchema: {
      type: "object",
      title: "Search technical articles input",
      description: "Search by keyword and tags, with an optional source filter.",
      properties: {
        query: { type: "string", description: "Free text keyword." },
        tags: { type: "array", description: "Category tags.", items: { type: "string", description: "One tag." } },
        source: { type: "string", description: '"all" | "cnblogs" | "csdn"' },
        limit: { type: "number", description: "Max result count." },
      },
      additionalProperties: false,
    },
    outputSchema: articleOutputSchema(),
    timeoutMs: 5_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "article cache",
    validateInput: isSearchTechnicalArticlesInput,
    execute: (input, context) => executeSearchTechnicalArticles(input, context),
  };
}

export function createHotTechnicalArticlesDefinition(): AssistantToolDefinition<HotTechnicalArticlesInput, AssistantArticleResult> {
  return {
    name: "get_hot_technical_articles",
    description: "Return recent or hot technical articles from the public cache.",
    inputSchema: {
      type: "object",
      title: "Hot technical articles input",
      description: "Return recent/hot articles with an optional source filter.",
      properties: {
        source: { type: "string", description: '"all" | "cnblogs" | "csdn"' },
        tags: { type: "array", description: "Category tags.", items: { type: "string", description: "One tag." } },
        limit: { type: "number", description: "Max result count." },
      },
      additionalProperties: false,
    },
    outputSchema: articleOutputSchema(),
    timeoutMs: 5_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "article cache",
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
    summary: summarizeArticles(items, "Technical article search results"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["no article matches"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "No technical article matches were found.",
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
    summary: summarizeArticles(items, "Hot technical articles"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["no hot article matches"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "No hot technical articles were found.",
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
    return `${prefix}: no results`;
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
    title: "Technical article item",
    description: "Safe article preview result.",
    properties: {
      id: { type: "string" as const, description: "Stable id." },
      title: { type: "string" as const, description: "Article title." },
      summary: { type: "string" as const, description: "Short summary." },
      source: { type: "string" as const, description: "Source platform." },
      sourceName: { type: "string" as const, description: "Readable source name." },
      publishedAt: { type: "string" as const, description: "Publish time." },
      originalUrl: { type: "string" as const, description: "Original link." },
      tags: { type: "array" as const, description: "Article tags.", items: { type: "string" as const, description: "One tag." } },
    },
    additionalProperties: false as const,
  };
}
