import type { AssistantSource } from "../assistant-types.ts";
import type {
  AssistantCodeforcesProblemResult,
  CodeforcesRecommendInput,
  CodeforcesSearchInput,
} from "../providers/codeforces-read-provider.ts";
import {
  recommendCodeforcesProblems,
  searchCodeforcesProblems,
} from "../providers/codeforces-read-provider.ts";
import type {
  AssistantToolDefinition,
  AssistantToolExecutionContext,
  AssistantToolExecutionResult,
} from "./tool-types.ts";

export function createSearchCodeforcesProblemsDefinition(): AssistantToolDefinition<CodeforcesSearchInput, AssistantCodeforcesProblemResult> {
  return {
    name: "search_codeforces_problems",
    description: "Search Codeforces problems by keyword, tags, and rating range.",
    inputSchema: {
      type: "object",
      title: "Search Codeforces problems input",
      description: "Search by keyword and rating/tag filters.",
      properties: {
        keyword: { type: "string", description: "Keyword to match against title or tags." },
        tags: { type: "array", description: "Problem tags.", items: { type: "string", description: "One tag." } },
        minRating: { type: "number", description: "Minimum rating." },
        maxRating: { type: "number", description: "Maximum rating." },
        limit: { type: "number", description: "Max result count." },
      },
      additionalProperties: false,
    },
    outputSchema: codeforcesOutputSchema(),
    timeoutMs: 8_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "codeforces api",
    validateInput: isSearchCodeforcesProblemsInput,
    execute: (input, context) => executeSearchCodeforcesProblems(input, context),
  };
}

export function createRecommendCodeforcesProblemsDefinition(): AssistantToolDefinition<CodeforcesRecommendInput, AssistantCodeforcesProblemResult> {
  return {
    name: "recommend_codeforces_problems",
    description: "Recommend Codeforces problems for the current user based on learning signals.",
    inputSchema: {
      type: "object",
      title: "Recommend Codeforces problems input",
      description: "UserId is resolved on the server side; only limit is accepted from the caller.",
      properties: {
        limit: { type: "number", description: "Max result count." },
      },
      additionalProperties: false,
    },
    outputSchema: codeforcesOutputSchema(),
    timeoutMs: 10_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "codeforces api",
    validateInput: isRecommendCodeforcesProblemsInput,
    execute: (input, context) => executeRecommendCodeforcesProblems(input, context),
  };
}

export async function executeSearchCodeforcesProblems(
  input: CodeforcesSearchInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantCodeforcesProblemResult>> {
  const items = await searchCodeforcesProblems(
    {
      keyword: input.keyword,
      tags: input.tags,
      minRating: input.minRating,
      maxRating: input.maxRating,
      limit: input.limit,
    },
    { customFetch: context.customFetch },
  );

  return {
    name: "search_codeforces_problems",
    ok: items.length > 0,
    summary: summarizeProblems(items, "Codeforces problem search results"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["no codeforces matches"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "No Codeforces problems matched the filters.",
  };
}

export async function executeRecommendCodeforcesProblems(
  input: CodeforcesRecommendInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantCodeforcesProblemResult>> {
  const recommendation = await recommendCodeforcesProblems(
    {
      userId: context.userId,
      limit: input.limit,
    },
    { customFetch: context.customFetch },
  );

  return {
    name: "recommend_codeforces_problems",
    ok: recommendation.items.length > 0,
    summary: summarizeRecommendation(
      recommendation.items,
      recommendation.ratingRange,
      recommendation.tagHints,
      recommendation.dataLimited,
    ),
    items: recommendation.items,
    sources: toAssistantSources(recommendation.items),
    warnings: recommendation.warnings,
    timedOut: false,
    rawResponseStored: false,
    errorCode: recommendation.items.length > 0 ? undefined : "empty",
    errorMessage: recommendation.items.length > 0 ? undefined : "No Codeforces recommendations could be produced.",
  };
}

function isSearchCodeforcesProblemsInput(value: unknown): value is CodeforcesSearchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.keyword === undefined || typeof record.keyword === "string") &&
    (record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit))) &&
    (record.minRating === undefined || (typeof record.minRating === "number" && Number.isFinite(record.minRating))) &&
    (record.maxRating === undefined || (typeof record.maxRating === "number" && Number.isFinite(record.maxRating))) &&
    (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")))
  );
}

function isRecommendCodeforcesProblemsInput(value: unknown): value is CodeforcesRecommendInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit));
}

function summarizeProblems(
  items: readonly AssistantCodeforcesProblemResult[],
  prefix: string,
): string {
  if (items.length === 0) {
    return `${prefix}: no results`;
  }

  const lines = [prefix];
  for (const item of items.slice(0, 5)) {
    const rating = typeof item.rating === "number" ? ` | ${item.rating}` : "";
    lines.push(`- ${item.contestId}${item.index} ${item.title}${rating}`);
  }
  return lines.join("\n");
}

function summarizeRecommendation(
  items: readonly AssistantCodeforcesProblemResult[],
  ratingRange: [number, number],
  tagHints: string[],
  dataLimited: boolean,
): string {
  if (items.length === 0) {
    return "Codeforces recommendation results: no problems available.";
  }

  const lines = [
    `Codeforces recommendation range: ${ratingRange[0]}-${ratingRange[1]}${dataLimited ? " (learning data limited)" : ""}`,
  ];
  if (tagHints.length > 0) {
    lines.push(`- tag hints: ${tagHints.slice(0, 6).join(", ")}`);
  }
  for (const item of items.slice(0, 5)) {
    const rating = typeof item.rating === "number" ? ` | ${item.rating}` : "";
    lines.push(`- ${item.contestId}${item.index} ${item.title}${rating}`);
  }
  return lines.join("\n");
}

function toAssistantSources(items: readonly AssistantCodeforcesProblemResult[]): AssistantSource[] {
  return items.map((item) => ({
    title: `${item.contestId}${item.index} ${item.title}`,
    source: item.localProblemId ? "platform problem library" : "Codeforces",
    url: item.localProblemId ? `/problems/${item.localProblemId}` : item.originalUrl,
  }));
}

function codeforcesOutputSchema() {
  return {
    type: "object" as const,
    title: "Codeforces problem item",
    description: "Safe Codeforces problem preview result.",
    properties: {
      contestId: { type: "number" as const, description: "Contest id." },
      index: { type: "string" as const, description: "Problem index." },
      title: { type: "string" as const, description: "Problem title." },
      rating: { type: "number" as const, description: "Rating." },
      tags: { type: "array" as const, description: "Problem tags.", items: { type: "string" as const, description: "One tag." } },
      originalUrl: { type: "string" as const, description: "Original Codeforces URL." },
      localProblemId: { type: "string" as const, description: "Optional local problem route id." },
    },
    additionalProperties: false as const,
  };
}
