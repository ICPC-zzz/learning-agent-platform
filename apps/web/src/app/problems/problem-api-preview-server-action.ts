"use server";

import type {
  ProblemApiDifficultyFilter,
  ProblemListParams,
  ProblemListResult,
  ProblemSearchParams,
  ProblemSearchResult,
} from "@learning-agent-platform/learning-engine";
import { createProblemApiProvider } from "@learning-agent-platform/learning-engine";

import type {
  ProblemApiPreviewStatusSnapshot,
  ProblemApiPreviewViewModel,
} from "./problem-api-preview-types";
import type { ProblemApiPreviewRequest } from "./problem-api-preview-request.ts";
import { normalizeProblemApiPreviewRequest } from "./problem-api-preview-request.ts";
import { getProblemApiPreviewStatus } from "./problem-api-status.ts";

export async function previewProblemApiAction(
  request: ProblemApiPreviewRequest,
): Promise<ProblemApiPreviewViewModel> {
  const status = getProblemApiPreviewStatus();
  const normalizedRequest = normalizeProblemApiPreviewRequest(request);
  const sourceMode = (normalizedRequest.query ?? "").length > 0 ? "search" : "list";

  if (status.providerMode === "blocked") {
    return createBlockedProblemPreview(normalizedRequest, status, sourceMode);
  }

  const provider = createProblemApiProvider({
    env: {
      allowExternalProblemApi: true,
      problemApiBaseUrl: readEnvString("LAP_PROBLEM_API_BASE_URL"),
      problemApiProvider: readEnvString("LAP_PROBLEM_API_PROVIDER"),
    },
  });

  const result =
    sourceMode === "search"
      ? await provider.searchProblems(toProblemSearchParams(normalizedRequest))
      : await provider.listProblems(toProblemListParams(normalizedRequest));

  return mapProviderResultToViewModel(result, sourceMode);
}

function mapProviderResultToViewModel(
  result: ProblemSearchResult | ProblemListResult,
  sourceMode: ProblemApiPreviewViewModel["sourceMode"],
): ProblemApiPreviewViewModel {
  return {
    providerMode: result.providerMode,
    safeToExposeToClient: true,
    productionReady: false,
    rawResponseStored: false,
    blockedReason: result.blockedReason,
    error: result.error,
    missingEnvNames: result.missingEnvNames,
    query: "query" in result ? result.query : "",
    filters: result.filters,
    paginationPreview: result.paginationPreview,
    totalResults: result.totalResults,
    itemsPreview: result.itemsPreview,
    sourceMode,
    externalApiQueried: sourceMode !== "mock",
    apiBlocked: result.apiBlocked,
  };
}

function createBlockedProblemPreview(
  request: ProblemApiPreviewRequest,
  status: ProblemApiPreviewStatusSnapshot,
  sourceMode: ProblemApiPreviewViewModel["sourceMode"],
): ProblemApiPreviewViewModel {
  const normalized = normalizeProblemApiPreviewRequest(request);

  return {
    providerMode: "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    rawResponseStored: false,
    blockedReason: status.blockedReason,
    error: null,
    missingEnvNames: status.missingEnvNames,
    query: normalized.query ?? "",
    filters: {
      difficulty: normalizeDifficultyFilter(normalized.difficulty),
      tags: Array.isArray(normalized.tags) ? [...normalized.tags] : [],
      page: normalized.page ?? 1,
      pageSize: normalized.pageSize ?? normalized.maxResults ?? 10,
    },
    paginationPreview: {
      page: normalized.page ?? 1,
      pageSize: normalized.pageSize ?? normalized.maxResults ?? 10,
      totalResults: 0,
      totalPages: 0,
      hasNextPage: false,
      nextPage: null,
    },
    totalResults: 0,
    itemsPreview: [],
    sourceMode,
    externalApiQueried: false,
    apiBlocked: true,
  };
}

function toProblemSearchParams(request: ProblemApiPreviewRequest): ProblemSearchParams {
  return {
    query: request.query ?? "",
    difficulty: normalizeDifficultyFilter(request.difficulty),
    tags: Array.isArray(request.tags) ? request.tags : [],
    page: request.page,
    pageSize: request.pageSize,
    maxResults: request.maxResults,
    language: request.language,
  };
}

function toProblemListParams(request: ProblemApiPreviewRequest): ProblemListParams {
  return {
    difficulty: normalizeDifficultyFilter(request.difficulty),
    tags: Array.isArray(request.tags) ? request.tags : [],
    page: request.page,
    pageSize: request.pageSize,
    maxResults: request.maxResults,
    language: request.language,
  };
}

function normalizeDifficultyFilter(
  value: string | null | undefined,
): ProblemApiDifficultyFilter {
  switch (value) {
    case "easy":
    case "medium":
    case "hard":
    case "challenge":
    case "unknown":
      return value;
    default:
      return null;
  }
}

function readEnvString(key: string): string | null {
  try {
    const value = process.env[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}
