/**
 * Codeforces Adapter
 *
 * Maps raw Codeforces API responses to safe, structured preview types.
 * All functions handle field-missing scenarios gracefully — no throws
 * on malformed or incomplete upstream data.
 *
 * Key principles:
 * - Never retains raw upstream problems or statistics
 * - missing contestId/index/name → skipped
 * - tags missing → []
 * - rating missing → undefined
 * - solvedCount matched from problemStatistics by contestId + index
 * - sourceUrl is Codeforces problem page URL — no secrets
 * - externalId format: "codeforces:{contestId}:{index}"
 *
 * @module codeforces-adapter
 * @previewOnly — dev-only adapter, not for production use
 */

import type { CodeforcesProblemSetResponse } from "./codeforces-client.ts";

// ---------------------------------------------------------------------------
// Preview types
// ---------------------------------------------------------------------------

export interface CodeforcesProblemPreview {
  /** Provider identifier — always "codeforces" */
  provider: "codeforces";
  /** External ID in format "codeforces:{contestId}:{index}" */
  externalId: string;
  /** Contest ID (e.g. 4 for Codeforces Round #4) */
  contestId?: number;
  /** Problem index in contest (e.g. "A", "B", "C1") */
  index: string;
  /** Problem name/title */
  name: string;
  /** Problem type (e.g. "PROGRAMMING", "QUESTION") */
  type?: string;
  /** Difficulty rating (800-3500, may be undefined for unrated problems) */
  rating?: number;
  /** Problem tags (e.g. ["dp", "greedy"]) */
  tags: string[];
  /** Number of users who solved this problem */
  solvedCount?: number;
  /** Codeforces problem page URL — never contains secrets */
  sourceUrl: string;
  /** Human-readable label for external data */
  externalLabel: "外部数据预览 · 未导入本地";
}

export interface CodeforcesAdapterResult {
  /** All adapted previews (unfiltered) */
  previews: CodeforcesProblemPreview[];
  /** Total count of problems from the API */
  totalFetched: number;
  /** Warnings about data quality (e.g. missing statistics) */
  warnings: string[];
  /** Never stored/saved */
  dbWritten: false;
  /** Always false */
  rawResponseStored: false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODEFORCES_PROBLEM_URL = "https://codeforces.com/problemset/problem";
const TAG_MAX = 30; // Sanity cap on tag count

// ---------------------------------------------------------------------------
// Raw type shapes
// ---------------------------------------------------------------------------

interface CodeforcesRawProblem {
  contestId?: number;
  index?: string;
  name?: string;
  type?: string;
  rating?: number;
  tags?: string[];
  points?: number;
  problemsetName?: string;
}

interface CodeforcesRawProblemStatistic {
  contestId?: number;
  index?: string;
  solvedCount?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adapt raw Codeforces problem set response into a list of problem previews.
 *
 * Merges problems with problemStatistics by matching contestId + index.
 * Handles: empty arrays, missing fields, malformed entries (skip, don't throw).
 * Never retains the raw response.
 */
export function adaptCodeforcesProblemSet(
  response: CodeforcesProblemSetResponse,
): CodeforcesAdapterResult {
  const warnings: string[] = [];

  if (!response.result) {
    return {
      previews: [],
      totalFetched: 0,
      warnings: ["Codeforces response had no result field"],
      dbWritten: false,
      rawResponseStored: false,
    };
  }

  const { problems, problemStatistics } = response.result;

  if (!Array.isArray(problems) || problems.length === 0) {
    return {
      previews: [],
      totalFetched: 0,
      warnings: ["Codeforces response contained no problems"],
      dbWritten: false,
      rawResponseStored: false,
    };
  }

  // Build statistics lookup: "contestId:index" → solvedCount
  const statsMap = buildStatsMap(problemStatistics, warnings);

  const previews: CodeforcesProblemPreview[] = [];

  for (const rawProblem of problems) {
    try {
      const preview = adaptProblem(rawProblem, statsMap);
      previews.push(preview);
    } catch (error) {
      // Skip malformed entries silently — don't break the whole list
      warnings.push(
        error instanceof Error
          ? `Skipped a malformed problem entry: ${error.message}`
          : "Skipped a malformed problem entry",
      );
    }
  }

  return {
    previews,
    totalFetched: problems.length,
    warnings,
    dbWritten: false,
    rawResponseStored: false,
  };
}

// ---------------------------------------------------------------------------
// Internal: Adapt single problem
// ---------------------------------------------------------------------------

function adaptProblem(
  raw: unknown,
  statsMap: Map<string, number>,
): CodeforcesProblemPreview {
  if (!isRecord(raw)) {
    throw new Error("Problem entry is not a valid object");
  }

  const problem = raw as CodeforcesRawProblem;

  const contestId = extractPositiveInteger(problem.contestId);
  const index = extractString(problem.index);
  const name = extractString(problem.name);
  const type = extractString(problem.type);
  const rating = extractPositiveInteger(problem.rating);
  const tags = extractTags(problem.tags);

  if (contestId === undefined) {
    throw new Error("missing contestId");
  }

  if (!index) {
    throw new Error("missing index");
  }

  if (!name) {
    throw new Error("missing name");
  }

  const sourceUrl = `${CODEFORCES_PROBLEM_URL}/${contestId}/${encodeURIComponent(index)}`;
  const externalId = `codeforces:${contestId}:${index}`;

  // Match solvedCount from statistics
  const statsKey = `${contestId}:${index}`;
  const solvedCount = statsMap.get(statsKey);

  return {
    provider: "codeforces",
    externalId: truncateSafe(externalId, 200),
    contestId,
    index: truncateSafe(index, 20),
    name: truncateSafe(name, 500),
    type: type ? truncateSafe(type, 50) : undefined,
    rating,
    tags,
    solvedCount,
    sourceUrl,
    externalLabel: "外部数据预览 · 未导入本地",
  };
}

// ---------------------------------------------------------------------------
// Internal: Build statistics lookup
// ---------------------------------------------------------------------------

function buildStatsMap(
  rawStats: unknown[],
  warnings: string[],
): Map<string, number> {
  const map = new Map<string, number>();

  if (!Array.isArray(rawStats)) {
    warnings.push("Codeforces problemStatistics is not an array");
    return map;
  }

  for (const entry of rawStats) {
    if (!isRecord(entry)) continue;

    const stat = entry as CodeforcesRawProblemStatistic;
    const contestId = extractPositiveInteger(stat.contestId);
    const index = extractString(stat.index);

    if (contestId === undefined || !index) continue;

    const key = `${contestId}:${index}`;
    const solvedCount = extractPositiveInteger(stat.solvedCount);

    if (solvedCount !== undefined) {
      map.set(key, solvedCount);
    }
  }

  if (map.size === 0) {
    warnings.push("No problem statistics were matched to problems");
  }

  return map;
}

// ---------------------------------------------------------------------------
// Internal: Extractors
// ---------------------------------------------------------------------------

function extractString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function extractPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.trunc(value);
  if (normalized <= 0) {
    return undefined;
  }

  return normalized;
}

function extractTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= TAG_MAX) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
