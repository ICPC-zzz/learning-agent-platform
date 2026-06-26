import type { PrismaClient } from "@prisma/client";
import {
  fetchCodeforcesProblemset,
  type CodeforcesClientResult,
  type CodeforcesProblemSetResponse,
} from "../../codeforces-client.ts";
import { adaptCodeforcesProblemSet, type CodeforcesProblemPreview } from "../../codeforces-adapter.ts";
import { loadAssistantProviderConfig, type AssistantProviderConfig } from "../config/assistant-provider-config.ts";
import type { AssistantProviderStatus } from "./provider-types.ts";

export interface AssistantCodeforcesProblemResult {
  contestId: number;
  index: string;
  title: string;
  rating?: number;
  tags: string[];
  originalUrl: string;
  localProblemId?: string;
}

export interface CodeforcesSearchInput {
  keyword?: string;
  tags?: string[];
  minRating?: number;
  maxRating?: number;
  limit?: number;
}

export interface CodeforcesRecommendInput {
  userId: string | null;
  limit?: number;
}

export interface AssistantCodeforcesProviderStatusBundle {
  status: AssistantProviderStatus;
  configured: boolean;
  enabled: boolean;
}

const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_RECOMMEND_LIMIT = 5;
const MAX_LIMIT = 10;
const PROBLEMSET_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedProblemset: {
  expiresAt: number;
  previews: CodeforcesProblemPreview[];
  warnings: string[];
} | null = null;

let cachedLocalProblemLookup:
  | {
      expiresAt: number;
      lookup: Map<string, string>;
    }
  | null = null;

export function createCodeforcesReadProviderStatus(
  options: { config?: AssistantProviderConfig } = {},
): AssistantProviderStatus {
  const config = options.config ?? loadAssistantProviderConfig();
  const configured = config.codeforces.enabled && Boolean(config.codeforces.baseUrl);
  const enabled = configured;

  return {
    id: "codeforces-read-provider",
    label: "Codeforces read provider",
    configured,
    enabled,
    healthy: enabled ? null : false,
    capabilities: ["problem_search", "problem_recommendation"],
    requiredEnvNames: ["LAP_CODEFORCES_ENABLED", "LAP_CODEFORCES_BASE_URL"],
    configuredEnvNames: configured ? ["LAP_CODEFORCES_ENABLED", "LAP_CODEFORCES_BASE_URL"] : [],
    missingEnvNames: configured ? [] : ["LAP_CODEFORCES_ENABLED", "LAP_CODEFORCES_BASE_URL"],
    sourceLabel: enabled ? "codeforces api" : "blocked",
    safeDescription: enabled
      ? "Codeforces public API is available."
      : "Codeforces public API is currently blocked.",
    previewOnly: true,
    devOnly: true,
    productionReady: false,
  };
}

export async function searchCodeforcesProblems(
  input: CodeforcesSearchInput = {},
  options: { customFetch?: typeof fetch } = {},
): Promise<AssistantCodeforcesProblemResult[]> {
  const previewSet = await loadProblemPreviews(options.customFetch);
  if (!previewSet) {
    return [];
  }

  const limit = clampLimit(input.limit ?? DEFAULT_SEARCH_LIMIT);
  const keyword = normalizeSearchText(input.keyword);
  const tags = normalizeTags(input.tags);
  const minRating = normalizeRating(input.minRating);
  const maxRating = normalizeRating(input.maxRating);

  const results = previewSet.previews
    .filter((problem) => matchesKeyword(problem, keyword))
    .filter((problem) => matchesTags(problem, tags))
    .filter((problem) => matchesRating(problem, minRating, maxRating))
    .sort((left, right) => scoreProblem(right, keyword, tags) - scoreProblem(left, keyword, tags))
    .slice(0, limit);

  return attachLocalProblemIds(results);
}

export async function recommendCodeforcesProblems(
  input: CodeforcesRecommendInput,
  options: { customFetch?: typeof fetch } = {},
): Promise<{
  items: AssistantCodeforcesProblemResult[];
  ratingRange: [number, number];
  tagHints: string[];
  excludedCount: number;
  dataLimited: boolean;
  warnings: string[];
}> {
  const previewSet = await loadProblemPreviews(options.customFetch);
  if (!previewSet) {
    return {
      items: [],
      ratingRange: [800, 1200],
      tagHints: [],
      excludedCount: 0,
      dataLimited: true,
      warnings: ["Codeforces problemset is unavailable."],
    };
  }

  const signals = await collectRecommendationSignals(input.userId);
  const ratingRange = deriveRatingRange(signals.overallScore, signals.recentRatings);
  const tagHints = signals.tagCounts.slice(0, 6).map((entry) => entry.tag);
  const excludedIds = new Set([
    ...signals.completedProblemIds,
    ...signals.attemptedProblemIds,
  ]);
  const limit = clampLimit(input.limit ?? DEFAULT_RECOMMEND_LIMIT);
  const eligible = previewSet.previews.filter((problem) => {
    if (problem.contestId === undefined) {
      return false;
    }

    const externalId = `codeforces:${problem.contestId}:${problem.index}`;
    if (excludedIds.has(externalId)) {
      return false;
    }

    if (problem.rating !== undefined) {
      if (problem.rating < ratingRange[0] || problem.rating > ratingRange[1]) {
        return false;
      }
    }

    if (tagHints.length > 0) {
      const overlap = countTagOverlap(problem.tags, tagHints);
      if (overlap === 0) {
        return false;
      }
    }

    return true;
  });

  const ranked = eligible
    .sort((left, right) => {
      const leftScore = scoreRecommendation(left, ratingRange, tagHints);
      const rightScore = scoreRecommendation(right, ratingRange, tagHints);
      return rightScore - leftScore;
    })
    .slice(0, limit);

  const attached = await attachLocalProblemIds(ranked);

  return {
    items: attached,
    ratingRange,
    tagHints,
    excludedCount: excludedIds.size,
    dataLimited: signals.dataLimited,
    warnings: previewSet.warnings.length > 0 ? [...previewSet.warnings] : [],
  };
}

async function loadProblemPreviews(customFetch?: typeof fetch): Promise<{
  previews: CodeforcesProblemPreview[];
  warnings: string[];
} | null> {
  if (!customFetch) {
    const now = Date.now();
    if (cachedProblemset && cachedProblemset.expiresAt > now) {
      return {
        previews: cachedProblemset.previews,
        warnings: cachedProblemset.warnings,
      };
    }
  }

  const response = await fetchCodeforcesProblemset();
  if (!response.success || !response.data) {
    return null;
  }

  const adapted = adaptCodeforcesProblemSet(response.data as CodeforcesProblemSetResponse);
  const result = {
    previews: adapted.previews,
    warnings: adapted.warnings,
  };

  if (!customFetch) {
    cachedProblemset = {
      expiresAt: Date.now() + PROBLEMSET_CACHE_TTL_MS,
      previews: adapted.previews,
      warnings: adapted.warnings,
    };
  }

  return result;
}

async function attachLocalProblemIds(
  items: readonly CodeforcesProblemPreview[],
): Promise<AssistantCodeforcesProblemResult[]> {
  const lookup = await getLocalProblemLookup();

  return items.map((item) => {
    const externalId = `codeforces:${item.contestId ?? "unknown"}:${item.index}`;
    const localProblemId = lookup.get(externalId) ?? lookup.get(item.sourceUrl);

    return {
      contestId: item.contestId ?? -1,
      index: item.index,
      title: item.name,
      rating: item.rating,
      tags: [...item.tags],
      originalUrl: item.sourceUrl,
      localProblemId,
    };
  });
}

async function getLocalProblemLookup(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedLocalProblemLookup && cachedLocalProblemLookup.expiresAt > now) {
    return cachedLocalProblemLookup.lookup;
  }

  const lookup = new Map<string, string>();

  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      cachedLocalProblemLookup = {
        expiresAt: now + PROBLEMSET_CACHE_TTL_MS,
        lookup,
      };
      return lookup;
    }

    const prisma = db.getPrismaClient();
    const repo = new db.PrismaLearningRepository(prisma);
    const records = await repo.listProblems({ limit: 2000 });

    for (const record of records) {
      if (record.sourceUrl) {
        lookup.set(record.sourceUrl, record.id);
      }

      const metadata = normalizeMetadata(record.metadata);
      if (typeof metadata.externalProblemId === "string") {
        lookup.set(metadata.externalProblemId, record.id);
      }

      if (typeof metadata.externalId === "string") {
        lookup.set(metadata.externalId, record.id);
      }
    }
  } catch {
    // Best-effort lookup only.
  }

  cachedLocalProblemLookup = {
    expiresAt: now + PROBLEMSET_CACHE_TTL_MS,
    lookup,
  };

  return lookup;
}

async function collectRecommendationSignals(userId: string | null): Promise<{
  overallScore: number | null;
  recentRatings: number[];
  completedProblemIds: string[];
  attemptedProblemIds: string[];
  tagCounts: Array<{ tag: string; count: number }>;
  dataLimited: boolean;
}> {
  if (!isNonEmptyString(userId)) {
    return {
      overallScore: null,
      recentRatings: [],
      completedProblemIds: [],
      attemptedProblemIds: [],
      tagCounts: [],
      dataLimited: true,
    };
  }

  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      return {
        overallScore: null,
        recentRatings: [],
        completedProblemIds: [],
        attemptedProblemIds: [],
        tagCounts: [],
        dataLimited: true,
      };
    }

    const prisma = db.getPrismaClient() as PrismaClient;
    const learningRepo = new db.PrismaLearningRepository(prisma);
    const attemptRepo = new db.PrismaProblemAttemptRepository(prisma);
    const wrongBookRepo = new db.PrismaProblemWrongBookRepository(prisma);

    const [profile, attempts, wrongBooks] = await Promise.all([
      learningRepo.getAbilityProfile(userId),
      attemptRepo.listRecentProblemAttemptsByUser(userId, 30),
      wrongBookRepo.listProblemWrongBookByOwner({ ownerId: userId, limit: 30 }),
    ]);

    const recentRatings = attempts
      .map((attempt) => normalizeProblemDifficultyToRating(attempt.difficulty))
      .filter((value): value is number => value !== null);

    const completedProblemIds = attempts
      .filter((attempt) => attempt.correctness === "CORRECT")
      .map((attempt) => toProblemKey(attempt.problemId, attempt.externalProblemId))
      .filter(isNonEmptyString);

    const attemptedProblemIds = attempts
      .map((attempt) => toProblemKey(attempt.problemId, attempt.externalProblemId))
      .filter(isNonEmptyString);

    const tagCounts = buildTagCounts([
      ...attempts.flatMap((attempt) => attempt.topicTags ?? []),
      ...wrongBooks.flatMap((book) => parseWrongBookTags(book.tagsJson)),
    ]);

    return {
      overallScore: typeof profile?.overallScore === "number" ? profile.overallScore : null,
      recentRatings,
      completedProblemIds,
      attemptedProblemIds,
      tagCounts,
      dataLimited: false,
    };
  } catch {
    return {
      overallScore: null,
      recentRatings: [],
      completedProblemIds: [],
      attemptedProblemIds: [],
      tagCounts: [],
      dataLimited: true,
    };
  }
}

function deriveRatingRange(
  overallScore: number | null,
  recentRatings: number[],
): [number, number] {
  if (typeof overallScore === "number" && Number.isFinite(overallScore)) {
    const base = clampRating(Math.round(overallScore * 20));
    return [Math.max(800, base - 150), Math.min(3500, base + 250)];
  }

  if (recentRatings.length > 0) {
    const average = Math.round(recentRatings.reduce((sum, value) => sum + value, 0) / recentRatings.length);
    return [Math.max(800, average - 150), Math.min(3500, average + 250)];
  }

  return [800, 1200];
}

function matchesKeyword(problem: CodeforcesProblemPreview, keyword: string): boolean {
  if (keyword.length === 0) {
    return true;
  }

  const haystack = [
    problem.name,
    problem.tags.join(" "),
    problem.externalId,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(keyword);
}

function matchesTags(problem: CodeforcesProblemPreview, tags: readonly string[]): boolean {
  if (tags.length === 0) {
    return true;
  }

  const problemTags = new Set(problem.tags.map((tag) => tag.toLowerCase()));
  return tags.every((tag) => problemTags.has(tag));
}

function matchesRating(
  problem: CodeforcesProblemPreview,
  minRating: number | null,
  maxRating: number | null,
): boolean {
  if (problem.rating === undefined) {
    return minRating === null && maxRating === null;
  }

  if (minRating !== null && problem.rating < minRating) {
    return false;
  }

  if (maxRating !== null && problem.rating > maxRating) {
    return false;
  }

  return true;
}

function scoreProblem(
  problem: CodeforcesProblemPreview,
  keyword: string,
  tags: readonly string[],
): number {
  let score = 0;
  if (typeof problem.rating === "number") {
    score += problem.rating;
  }

  if (keyword.length > 0) {
    const lowerName = problem.name.toLowerCase();
    if (lowerName.includes(keyword)) {
      score += 10_000;
    }
  }

  score += countTagOverlap(problem.tags, tags) * 1_000;
  return score;
}

function scoreRecommendation(
  problem: CodeforcesProblemPreview,
  ratingRange: [number, number],
  tagHints: string[],
): number {
  const rating = problem.rating ?? ratingRange[0];
  const center = Math.round((ratingRange[0] + ratingRange[1]) / 2);
  const proximity = Math.max(0, 2000 - Math.abs(rating - center));
  const overlap = countTagOverlap(problem.tags, tagHints) * 750;
  return proximity + overlap + (problem.solvedCount ? Math.min(500, Math.log10(problem.solvedCount + 1) * 100) : 0);
}

function countTagOverlap(tags: readonly string[], hints: readonly string[]): number {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()));
  let count = 0;
  for (const hint of hints) {
    if (normalized.has(hint.toLowerCase())) {
      count += 1;
    }
  }
  return count;
}

function buildTagCounts(tags: readonly string[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function parseWrongBookTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
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

function normalizeRating(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function normalizeProblemDifficultyToRating(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "easy":
      return 900;
    case "medium":
      return 1400;
    case "hard":
      return 1900;
    case "challenge":
      return 2400;
    default:
      return null;
  }
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function clampRating(value: number): number {
  return Math.max(800, Math.min(3500, value));
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toProblemKey(problemId: string | null, externalProblemId: string | null): string {
  if (isNonEmptyString(problemId)) {
    return problemId.trim();
  }

  if (isNonEmptyString(externalProblemId)) {
    return externalProblemId.trim();
  }

  return "";
}
