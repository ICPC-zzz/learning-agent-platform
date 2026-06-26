/**
 * Codeforces Import Adapter
 *
 * Maps Codeforces problem preview data into a safe local metadata draft.
 *
 * Key design rules:
 * - missing contestId/index/name → invalid draft
 * - sourceUrl is Codeforces problem page URL — no secrets
 * - tags/rating all mapped safely with fallbacks
 * - no body text, sample data, writeups, judge data, LLM calls, or page scraping
 *
 * @module codeforces-import-adapter
 * @previewOnly — dev-only import adapter, not for production use
 */

import type { CodeforcesProblemPreview } from "./codeforces-adapter.ts";

// ---------------------------------------------------------------------------
// Import draft type
// ---------------------------------------------------------------------------

export interface CodeforcesImportDraft {
  /** Provider identifier — always "codeforces" */
  provider: "codeforces";
  /** External ID in format "codeforces:{contestId}:{index}" */
  externalId: string;
  /** Contest ID */
  contestId?: number;
  /** Problem index in contest */
  index: string;
  /** Problem name/title */
  name: string;
  /** Difficulty rating (800-3500) */
  rating?: number;
  /** Problem tags */
  tags: string[];
  /** Number of users who solved this problem */
  solvedCount?: number;
  /** Codeforces problem page URL */
  sourceUrl: string;
  /** Safety warnings */
  warnings: string[];
  /** Difficulty mapped from rating */
  difficulty: "easy" | "medium" | "hard" | "challenge" | "unknown";
  /** Metadata-only payload for DB write paths. */
  metadata: Record<string, unknown>;
  /** False when required Codeforces identity fields are missing. */
  valid: boolean;
  /** Always false — dev-only */
  productionReady: false;
  /** Always true — safe to expose */
  safeToExposeToClient: true;
  /** Never stored */
  rawResponseStored: false;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CODEFORCES_PROBLEM_URL = "https://codeforces.com/problemset/problem";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an import draft from a Codeforces problem preview.
 *
 * @param preview — A466 CodeforcesProblemPreview from search results
 * @returns      — Safe import draft suitable for DB writing
 */
export function createCodeforcesImportDraft(
  preview: CodeforcesProblemPreview,
): CodeforcesImportDraft {
  const warnings: string[] = [];
  const name = safeTrim(preview.name);
  const tags = (preview.tags ?? [])
    .map((t) => safeTrim(t).toLowerCase())
    .filter(isNonEmpty)
    .filter((tag, index, allTags) => allTags.indexOf(tag) === index)
    .slice(0, 30);
  const rating = typeof preview.rating === "number" && Number.isFinite(preview.rating) && preview.rating > 0
    ? Math.trunc(preview.rating)
    : undefined;
  const solvedCount = typeof preview.solvedCount === "number" && Number.isFinite(preview.solvedCount)
    ? preview.solvedCount
    : undefined;
  const externalId = safeTrim(preview.externalId) || "";
  const contestId = typeof preview.contestId === "number" && Number.isFinite(preview.contestId)
    ? Math.trunc(preview.contestId)
    : undefined;
  const index = safeTrim(preview.index);

  if (!contestId || contestId <= 0) {
    warnings.push("missing contestId");
  }

  if (!index) {
    warnings.push("missing index");
  }

  if (!name) {
    warnings.push("missing name");
  }

  const sourceUrl = contestId && index
    ? `${CODEFORCES_PROBLEM_URL}/${contestId}/${encodeURIComponent(index)}`
    : "";

  // Map rating to difficulty
  const difficulty = mapRatingToDifficulty(rating);
  const valid = warnings.length === 0;

  return {
    provider: "codeforces",
    externalId: truncateSafe(externalId, 200),
    contestId,
    index: truncateSafe(index, 20),
    name: truncateSafe(name, 500),
    rating,
    tags,
    solvedCount,
    sourceUrl: truncateSafe(sourceUrl, 2000),
    warnings,
    difficulty,
    metadata: {
      provider: "codeforces",
      providerId: "codeforces",
      externalId,
      externalProblemId: externalId,
      contestId: contestId ?? null,
      index,
      rating: rating ?? null,
      tags,
      originalUrl: sourceUrl,
      sourceUrl,
      solvedCount: solvedCount ?? null,
      indexOnly: true,
    },
    valid,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
  };
}

// ---------------------------------------------------------------------------
// Rating → Difficulty mapping
// ---------------------------------------------------------------------------

/**
 * Map Codeforces rating to internal difficulty level.
 *
 * Mapping:
 *   800-1199  → easy
 *   1200-1699 → medium
 *   1700-2199 → hard
 *   2200+     → challenge
 *   unknown   → unknown
 */
export function mapRatingToDifficulty(rating?: number): "easy" | "medium" | "hard" | "challenge" | "unknown" {
  if (rating === undefined || !Number.isFinite(rating)) return "unknown";
  if (rating < 1200) return "easy";
  if (rating < 1700) return "medium";
  if (rating < 2200) return "hard";
  return "challenge";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeTrim(value: string | undefined | null): string {
  if (value === undefined || value === null) return "";
  return value.trim();
}

function isNonEmpty(value: string): boolean {
  return value.length > 0;
}

function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
