/**
 * Codeforces Agent Candidate Query Service
 *
 * Read-only service for Agent consumption. Queries the curated Codeforces
 * problem pool and returns candidate problems for training recommendations.
 *
 * Key invariants:
 * - Only queries curated pool problems (policy-filtered)
 * - Never returns forbidden fields (statement, examples, judge, solutions)
 * - No database writes
 * - Pure query logic — no LLM calls, no API calls
 *
 * @module codeforces-agent-candidates
 * @previewOnly — dev-only service, not for production Agent use
 */

import {
  DEFAULT_CODEFORCES_CATALOG_POLICY,
  evaluateCodeforcesCatalogPolicy,
  type CodeforcesCatalogPolicy,
} from "./codeforces-catalog-policy.ts";
import type { CodeforcesProblemPreview } from "./codeforces-adapter.ts";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CodeforcesAgentCandidateQuery {
  /** Minimum rating (inclusive). Default: catalog policy minRating */
  minRating?: number;
  /** Maximum rating (inclusive). Default: catalog policy maxRating */
  maxRating?: number;
  /** Include problems with at least one of these tags (OR semantics) */
  includeTags?: string[];
  /** Exclude problems with any of these tags */
  excludeTags?: string[];
  /** Problem keys (format: "codeforces:{contestId}:{index}") to exclude (already solved) */
  solvedProblemKeys?: string[];
  /** Problem keys recently recommended (excluded to avoid repeats) */
  recentlyRecommendedProblemKeys?: string[];
  /** Problem keys to explicitly exclude */
  excludeProblemKeys?: string[];
  /** Preferred tags for secondary sorting */
  preferredTags?: string[];
  /** Target rating for distance calculation */
  targetRating?: number;
  /** Sort order */
  sortBy?:
    | "rating_distance"
    | "solved_count"
    | "rating_asc"
    | "rating_desc";
  /** Maximum results to return. Default: 30. Max: 100. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CodeforcesAgentCandidate {
  /** Stable problem key: "codeforces:{contestId}:{index}" */
  problemKey: string;
  /** Internal DB problem ID */
  problemId: string;
  /** Contest ID */
  contestId: number;
  /** Problem index in contest (e.g. "A", "B1") */
  index: string;
  /** Problem name/title */
  name: string;
  /** Difficulty rating */
  rating: number;
  /** Problem tags */
  tags: string[];
  /** Number of Codeforces users who solved this problem */
  solvedCount: number | null;
  /** Link to the original Codeforces problem page */
  originalUrl: string;
  /** Which preferred tags this problem matched */
  matchedPreferredTags: string[];
  /** Absolute distance from target rating (if targetRating provided) */
  ratingDistance?: number;
}

// ---------------------------------------------------------------------------
// Query result
// ---------------------------------------------------------------------------

export interface CodeforcesAgentCandidateResult {
  candidates: CodeforcesAgentCandidate[];
  totalCandidates: number;
  querySummary: {
    minRating: number;
    maxRating: number;
    includeTags: string[];
    excludeTags: string[];
    excludedKeysCount: number;
    sortBy: string;
    hasTargetRating: boolean;
  };
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_KEYS_ARRAY = 5000;
const MAX_TAGS_ARRAY = 50;

// ---------------------------------------------------------------------------
// Problem record shape from DB
// ---------------------------------------------------------------------------

export interface AgentCandidateProblemRecord {
  id: string;
  title: string;
  tags: string[];
  source: string | null;
  sourceUrl: string | null;
  metadata: unknown;
  difficulty: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query the curated Codeforces problem pool for Agent training candidates.
 *
 * This is a read-only in-memory filter over pre-fetched DB records.
 * It does NOT:
 * - Write to the database
 * - Call external APIs
 * - Invoke LLMs
 * - Return forbidden fields (statement, examples, solutions, etc.)
 *
 * @param records - All curated Codeforces problems from the database
 * @param query - Candidate selection criteria
 * @returns Filtered and sorted candidate list
 */
export function queryCodeforcesAgentCandidates(
  records: readonly AgentCandidateProblemRecord[],
  query: CodeforcesAgentCandidateQuery = {},
): CodeforcesAgentCandidateResult {
  // --- Normalize inputs ---
  const limit = normalizeLimit(query.limit);
  const sortBy = normalizeSortBy(query.sortBy);

  const policy: CodeforcesCatalogPolicy = {
    ...DEFAULT_CODEFORCES_CATALOG_POLICY,
    minRating: query.minRating ?? DEFAULT_CODEFORCES_CATALOG_POLICY.minRating,
    maxRating: query.maxRating ?? DEFAULT_CODEFORCES_CATALOG_POLICY.maxRating,
    excludeTags: normalizeExcludeTags(query.excludeTags),
  };

  const includeTags = normalizeTags(query.includeTags);
  const preferredTags = normalizeTags(query.preferredTags);
  const targetRating = normalizeTargetRating(query.targetRating);

  // Build exclusion set
  const excludeKeys = new Set<string>();
  addKeysToSet(excludeKeys, query.solvedProblemKeys);
  addKeysToSet(excludeKeys, query.recentlyRecommendedProblemKeys);
  addKeysToSet(excludeKeys, query.excludeProblemKeys);

  // --- Validate ---
  validateQuery(policy, limit);

  // --- Filter ---
  const candidates: CodeforcesAgentCandidate[] = [];

  for (const record of records) {
    // Extract metadata
    const metadata = asRecord(record.metadata);
    const rating = extractRating(metadata);
    const contestId = extractContestId(metadata);
    const index = extractIndex(metadata);
    const problemKey = buildProblemKey(contestId, index);
    const tags = normalizeRecordTags(record.tags);
    const solvedCount = extractSolvedCount(metadata);
    const originalUrl = extractSourceUrl(record, metadata);

    // Policy check
    const preview = buildPolicyPreview(problemKey, contestId, index, record.title, rating, tags);
    const policyResult = evaluateCodeforcesCatalogPolicy(preview, policy);
    if (!policyResult.eligible) continue;

    // Rating range check
    if (rating === null) continue;
    if (rating < policy.minRating) continue;
    if (rating > policy.maxRating) continue;

    // Exclude keys check
    if (excludeKeys.has(problemKey)) continue;

    // Include tags check (OR semantics)
    if (includeTags.length > 0) {
      const lowerTags = new Set(tags.map((t) => t.toLowerCase()));
      const hasMatch = includeTags.some((tag) => lowerTags.has(tag.toLowerCase()));
      if (!hasMatch) continue;
    }

    // Exclude tags check
    if (policy.excludeTags.length > 0) {
      const lowerTags = new Set(tags.map((t) => t.toLowerCase()));
      const hasExcluded = policy.excludeTags.some((tag) => lowerTags.has(tag.toLowerCase()));
      if (hasExcluded) continue;
    }

    // Compute matched preferred tags
    const matchedPreferredTags = computeMatchedPreferredTags(tags, preferredTags);

    // Compute rating distance
    const ratingDistance = targetRating !== null && rating !== null
      ? Math.abs(rating - targetRating)
      : undefined;

    candidates.push({
      problemKey,
      problemId: record.id,
      contestId,
      index,
      name: record.title,
      rating,
      tags,
      solvedCount,
      originalUrl,
      matchedPreferredTags,
      ratingDistance,
    });
  }

  // --- Sort ---
  sortCandidates(candidates, sortBy, targetRating, preferredTags);

  // --- Limit ---
  const limited = candidates.slice(0, limit);

  return {
    candidates: limited,
    totalCandidates: candidates.length,
    querySummary: {
      minRating: policy.minRating,
      maxRating: policy.maxRating,
      includeTags,
      excludeTags: policy.excludeTags,
      excludedKeysCount: excludeKeys.size,
      sortBy,
      hasTargetRating: targetRating !== null,
    },
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateAgentCandidateQuery(
  query: CodeforcesAgentCandidateQuery,
): string[] {
  const errors: string[] = [];

  // minRating > maxRating
  const minRating = query.minRating ?? DEFAULT_CODEFORCES_CATALOG_POLICY.minRating;
  const maxRating = query.maxRating ?? DEFAULT_CODEFORCES_CATALOG_POLICY.maxRating;
  if (minRating > maxRating) {
    errors.push(`minRating (${minRating}) cannot be greater than maxRating (${maxRating})`);
  }

  // Limit bounds
  if (query.limit !== undefined) {
    if (typeof query.limit !== "number" || !Number.isInteger(query.limit) || query.limit < 1) {
      errors.push(`limit must be a positive integer, got ${query.limit}`);
    } else if (query.limit > MAX_LIMIT) {
      errors.push(`limit cannot exceed ${MAX_LIMIT}, got ${query.limit}`);
    }
  }

  // Target rating
  if (query.targetRating !== undefined) {
    if (typeof query.targetRating !== "number" || !Number.isInteger(query.targetRating) || query.targetRating < 800) {
      errors.push(`targetRating must be an integer >= 800, got ${query.targetRating}`);
    }
  }

  // Array sizes
  if (query.solvedProblemKeys && query.solvedProblemKeys.length > MAX_KEYS_ARRAY) {
    errors.push(`solvedProblemKeys cannot exceed ${MAX_KEYS_ARRAY} entries`);
  }

  // Tag count
  if (query.includeTags && query.includeTags.length > MAX_TAGS_ARRAY) {
    errors.push(`includeTags cannot exceed ${MAX_TAGS_ARRAY} entries`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Internal: normalization
// ---------------------------------------------------------------------------

function normalizeLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  const n = Math.trunc(value);
  if (n < 1) return DEFAULT_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

function normalizeSortBy(value: string | undefined): string {
  const valid = new Set(["rating_distance", "solved_count", "rating_asc", "rating_desc"]);
  if (typeof value === "string" && valid.has(value)) return value;
  return "rating_distance";
}

function normalizeTags(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of value) {
    if (typeof tag !== "string") continue;
    const trimmed = tag.trim().toLowerCase();
    if (trimmed.length === 0 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeExcludeTags(value: string[] | undefined): string[] {
  const tags = normalizeTags(value);
  if (tags.length === 0) {
    // Always exclude interactive by default
    return ["interactive"];
  }
  return tags;
}

function normalizeTargetRating(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 800) {
    return null;
  }
  return value;
}

function addKeysToSet(set: Set<string>, keys: string[] | undefined): void {
  if (!Array.isArray(keys)) return;
  for (const key of keys) {
    if (typeof key === "string" && key.trim().length > 0) {
      set.add(key.trim());
    }
  }
}

function validateQuery(policy: CodeforcesCatalogPolicy, limit: number): void {
  if (policy.minRating > policy.maxRating) {
    throw new Error(`Invalid rating range: ${policy.minRating}-${policy.maxRating}`);
  }
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`Invalid limit: ${limit}`);
  }
}

// ---------------------------------------------------------------------------
// Internal: metadata extraction
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function extractRating(metadata: Record<string, unknown>): number | null {
  const value = metadata.rating ?? metadata.codeforcesRating;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractContestId(metadata: Record<string, unknown>): number {
  const value = metadata.contestId;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function extractIndex(metadata: Record<string, unknown>): string {
  const value = metadata.index;
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return "";
}

function extractSolvedCount(metadata: Record<string, unknown>): number | null {
  const value = metadata.solvedCount;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  return null;
}

function extractSourceUrl(
  record: AgentCandidateProblemRecord,
  metadata: Record<string, unknown>,
): string {
  // Prefer sourceUrl from record, then from metadata
  const candidates = [
    record.sourceUrl,
    extractText(metadata.originalUrl),
    extractText(metadata.sourceUrl),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return "";
}

function extractText(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

// ---------------------------------------------------------------------------
// Internal: helpers
// ---------------------------------------------------------------------------

function buildProblemKey(contestId: number, index: string): string {
  return `codeforces:${contestId}:${index}`;
}

function normalizeRecordTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().toLowerCase());
}

function buildPolicyPreview(
  problemKey: string,
  contestId: number,
  index: string,
  name: string,
  rating: number | null,
  tags: string[],
): CodeforcesProblemPreview {
  return {
    provider: "codeforces",
    externalId: problemKey,
    contestId: contestId > 0 ? contestId : undefined,
    index,
    name,
    type: "PROGRAMMING",
    rating: rating ?? undefined,
    tags,
    sourceUrl: "",
    externalLabel: "外部数据预览 · 未导入本地",
  };
}

function computeMatchedPreferredTags(
  problemTags: string[],
  preferredTags: string[],
): string[] {
  if (preferredTags.length === 0) return [];
  const lowerTags = new Set(problemTags.map((t) => t.toLowerCase()));
  return preferredTags.filter((tag) => lowerTags.has(tag.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Internal: sorting
// ---------------------------------------------------------------------------

function sortCandidates(
  candidates: CodeforcesAgentCandidate[],
  sortBy: string,
  targetRating: number | null,
  preferredTags: string[],
): void {
  candidates.sort((a, b) => {
    let cmp = 0;

    switch (sortBy) {
      case "rating_distance": {
        // Closest to target rating first
        if (targetRating !== null) {
          const distA = a.ratingDistance ?? Number.MAX_SAFE_INTEGER;
          const distB = b.ratingDistance ?? Number.MAX_SAFE_INTEGER;
          cmp = distA - distB;
        }
        break;
      }
      case "solved_count": {
        const solvedA = a.solvedCount ?? 0;
        const solvedB = b.solvedCount ?? 0;
        cmp = solvedB - solvedA; // Higher solved count first
        break;
      }
      case "rating_asc": {
        cmp = a.rating - b.rating;
        break;
      }
      case "rating_desc": {
        cmp = b.rating - a.rating;
        break;
      }
    }

    // Secondary: preferred tags match count (more matches = higher)
    if (cmp === 0 && preferredTags.length > 0) {
      cmp = b.matchedPreferredTags.length - a.matchedPreferredTags.length;
    }

    // Tertiary: solvedCount descending (more validated = better)
    if (cmp === 0) {
      const solvedA = a.solvedCount ?? 0;
      const solvedB = b.solvedCount ?? 0;
      cmp = solvedB - solvedA;
    }

    // Quaternary: problemKey stable ordering
    if (cmp === 0) {
      cmp = a.problemKey.localeCompare(b.problemKey);
    }

    return cmp;
  });
}
