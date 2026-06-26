/**
 * Codeforces Curated Pool Selector
 *
 * Rating-stratified, deterministic selection of Codeforces problems for the
 * Agent candidate pool. Uses solvedCount for prioritization within each rating
 * band, ensuring stable and repeatable selections.
 *
 * Pure functions — no database, no network, no side effects.
 *
 * @module codeforces-curated-pool
 */

import type { CodeforcesProblemPreview } from "./codeforces-adapter.ts";

// ---------------------------------------------------------------------------
// Quota types
// ---------------------------------------------------------------------------

export interface CodeforcesPoolQuota {
  /** The rating value (800, 900, 1000, ..., 2400) */
  rating: number;
  /** Maximum number of problems to select from this rating band */
  maxProblems: number;
}

export interface CodeforcesPoolConfig {
  /** Display name for this preset */
  preset: string;
  /** Hard upper limit on total selected problems */
  targetSize: number;
  /** Per-rating-band quotas */
  quotas: CodeforcesPoolQuota[];
  /** Description of the selection strategy */
  description: string;
}

// ---------------------------------------------------------------------------
// Selection result types
// ---------------------------------------------------------------------------

export interface CodeforcesPoolSelectionResult {
  /** Preset name */
  preset: string;
  /** Total eligible problems (passed policy) before selection */
  eligibleTotal: number;
  /** Total selected problems after applying quotas */
  selectedTotal: number;
  /** Selected previews */
  selected: CodeforcesProblemPreview[];
  /** Per-rating-band breakdown */
  ratingDistribution: CodeforcesRatingBandResult[];
  /** Tag coverage statistics for selected set */
  tagDistribution: CodeforcesTagDistributionEntry[];
  /** Stable — same input always produces same output */
  deterministic: true;
}

export interface CodeforcesRatingBandResult {
  rating: number;
  quota: number;
  available: number;
  selected: number;
}

export interface CodeforcesTagDistributionEntry {
  tag: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Agent pool v1 preset
// ---------------------------------------------------------------------------

/**
 * Agent Pool v1 — the default curated pool preset.
 *
 * Targets ~2000 problems with rating-stratified selection:
 * - 800-1000:  max 100 per 100-point band
 * - 1100-1800: max 150 per 100-point band
 * - 1900-2200: max 100 per 100-point band
 * - 2300-2400: max  50 per 100-point band
 *
 * Within each band, problems are sorted by solvedCount descending,
 * then contestId descending for stability.
 */
export const AGENT_POOL_V1_QUOTAS: CodeforcesPoolQuota[] = [
  // 800-1000: 100 each
  { rating: 800, maxProblems: 100 },
  { rating: 900, maxProblems: 100 },
  { rating: 1000, maxProblems: 100 },
  // 1100-1800: 150 each
  { rating: 1100, maxProblems: 150 },
  { rating: 1200, maxProblems: 150 },
  { rating: 1300, maxProblems: 150 },
  { rating: 1400, maxProblems: 150 },
  { rating: 1500, maxProblems: 150 },
  { rating: 1600, maxProblems: 150 },
  { rating: 1700, maxProblems: 150 },
  { rating: 1800, maxProblems: 150 },
  // 1900-2200: 100 each
  { rating: 1900, maxProblems: 100 },
  { rating: 2000, maxProblems: 100 },
  { rating: 2100, maxProblems: 100 },
  { rating: 2200, maxProblems: 100 },
  // 2300-2400: 50 each
  { rating: 2300, maxProblems: 50 },
  { rating: 2400, maxProblems: 50 },
];

export const AGENT_POOL_V1_CONFIG: CodeforcesPoolConfig = {
  preset: "agent-pool-v1",
  targetSize: 2000,
  quotas: AGENT_POOL_V1_QUOTAS,
  description:
    "Rating-stratified curated pool: 800-1000 (100/band), 1100-1800 (150/band), 1900-2200 (100/band), 2300-2400 (50/band). Sorted by solvedCount desc within each band.",
};

/** Maximum allowed target size — rejects anything larger. */
export const MAX_TARGET_SIZE = 30000;

/** Minimum allowed target size. */
export const MIN_TARGET_SIZE = 100;

/**
 * Full pool v2 — imports ALL available Codeforces problems.
 * Each 100-point band gets a very high quota so that nothing is left behind.
 * Total will be whatever the API actually provides (estimated 8,000-10,000).
 */
export const FULL_POOL_V2_QUOTAS: CodeforcesPoolQuota[] = [
  // 800-1000: 500 each (essentially unlimited — API won't have that many per band)
  { rating: 800, maxProblems: 500 },
  { rating: 900, maxProblems: 500 },
  { rating: 1000, maxProblems: 500 },
  // 1100-1800: 600 each
  { rating: 1100, maxProblems: 600 },
  { rating: 1200, maxProblems: 600 },
  { rating: 1300, maxProblems: 600 },
  { rating: 1400, maxProblems: 600 },
  { rating: 1500, maxProblems: 600 },
  { rating: 1600, maxProblems: 600 },
  { rating: 1700, maxProblems: 600 },
  { rating: 1800, maxProblems: 600 },
  // 1900-2400: 500 each
  { rating: 1900, maxProblems: 500 },
  { rating: 2000, maxProblems: 500 },
  { rating: 2100, maxProblems: 500 },
  { rating: 2200, maxProblems: 500 },
  { rating: 2300, maxProblems: 400 },
  { rating: 2400, maxProblems: 400 },
  // 2500-3500: 400 each (high-difficulty)
  { rating: 2500, maxProblems: 400 },
  { rating: 2600, maxProblems: 400 },
  { rating: 2700, maxProblems: 400 },
  { rating: 2800, maxProblems: 400 },
  { rating: 2900, maxProblems: 400 },
  { rating: 3000, maxProblems: 400 },
  { rating: 3100, maxProblems: 400 },
  { rating: 3200, maxProblems: 400 },
  { rating: 3300, maxProblems: 400 },
  { rating: 3400, maxProblems: 400 },
  { rating: 3500, maxProblems: 400 },
];

export const FULL_POOL_V2_CONFIG: CodeforcesPoolConfig = {
  preset: "full-pool-v2",
  targetSize: 30000,
  quotas: FULL_POOL_V2_QUOTAS,
  description:
    "Full Codeforces pool — imports all available problems across 800-3500. Per-band quotas set high enough to include everything the API provides.",
};

// ---------------------------------------------------------------------------
// Presets registry
// ---------------------------------------------------------------------------

export const CURATED_POOL_PRESETS: Record<string, CodeforcesPoolConfig> = {
  "agent-pool-v1": AGENT_POOL_V1_CONFIG,
  "full-pool-v2": FULL_POOL_V2_CONFIG,
};

// ---------------------------------------------------------------------------
// Tag coverage tracking
// ---------------------------------------------------------------------------

/** Tags to explicitly track in coverage reports. */
export const TRACKED_TAGS = [
  "implementation",
  "math",
  "greedy",
  "data structures",
  "dp",
  "graphs",
  "binary search",
  "two pointers",
  "strings",
  "number theory",
  "combinatorics",
  "trees",
  "shortest paths",
  "constructive algorithms",
];

// ---------------------------------------------------------------------------
// Core selection logic
// ---------------------------------------------------------------------------

/**
 * Select a curated problem pool from eligible previews using the given config.
 *
 * Steps:
 * 1. Group eligible previews by rating band (rounded down to nearest 100)
 * 2. Within each band, sort by solvedCount desc → contestId desc → index asc
 * 3. Apply per-band quota
 * 4. Apply global targetSize cap
 * 5. Compute tag distribution for the selected set
 *
 * Selection is fully deterministic: same input → same output every time.
 *
 * @param eligible - Policy-eligible problem previews (already filtered by catalog policy)
 * @param config - Pool configuration with quotas and target size
 * @returns Selection result with breakdowns
 */
export function selectCuratedPool(
  eligible: readonly CodeforcesProblemPreview[],
  config: CodeforcesPoolConfig,
): CodeforcesPoolSelectionResult {
  // Build quota lookup
  const quotaByRating = new Map<number, number>();
  for (const quota of config.quotas) {
    quotaByRating.set(quota.rating, quota.maxProblems);
  }

  // Group eligible problems by rating band
  const bandMap = new Map<number, CodeforcesProblemPreview[]>();
  for (const preview of eligible) {
    const rating = normalizeProblemRating(preview.rating);
    if (rating === null) continue; // Should already be filtered by policy

    const band = Math.floor(rating / 100) * 100;
    if (!quotaByRating.has(band)) continue; // Outside configured bands

    let group = bandMap.get(band);
    if (!group) {
      group = [];
      bandMap.set(band, group);
    }
    group.push(preview);
  }

  // Sort each band and apply quota
  const selected: CodeforcesProblemPreview[] = [];
  const ratingDistribution: CodeforcesRatingBandResult[] = [];

  const sortedBands = Array.from(bandMap.keys()).sort((a, b) => a - b);

  for (const band of sortedBands) {
    const quota = quotaByRating.get(band) ?? 0;
    const group = bandMap.get(band)!;

    // Sort: solvedCount desc → contestId desc → index asc
    const sorted = sortBandProblems(group);

    const taken = sorted.slice(0, quota);
    selected.push(...taken);

    ratingDistribution.push({
      rating: band,
      quota,
      available: group.length,
      selected: taken.length,
    });
  }

  // Also report bands with quota but no available problems
  for (const [rating, quota] of quotaByRating) {
    if (!bandMap.has(rating)) {
      ratingDistribution.push({
        rating,
        quota,
        available: 0,
        selected: 0,
      });
    }
  }

  // Sort rating distribution by rating
  ratingDistribution.sort((a, b) => a.rating - b.rating);

  // Apply global target size cap
  let finalSelected = selected;
  if (selected.length > config.targetSize) {
    finalSelected = selected.slice(0, config.targetSize);
  }

  // Tag distribution for selected set
  const tagDistribution = computeTagDistribution(finalSelected);

  return {
    preset: config.preset,
    eligibleTotal: eligible.length,
    selectedTotal: finalSelected.length,
    selected: finalSelected,
    ratingDistribution,
    tagDistribution,
    deterministic: true,
  };
}

/**
 * Validate a pool config for safety.
 * Returns an array of validation errors (empty = valid).
 */
export function validatePoolConfig(
  config: CodeforcesPoolConfig,
): string[] {
  const errors: string[] = [];

  if (!config.preset || typeof config.preset !== "string") {
    errors.push("preset must be a non-empty string");
  }

  if (
    typeof config.targetSize !== "number" ||
    !Number.isInteger(config.targetSize) ||
    config.targetSize < MIN_TARGET_SIZE ||
    config.targetSize > MAX_TARGET_SIZE
  ) {
    errors.push(
      `targetSize must be an integer between ${MIN_TARGET_SIZE} and ${MAX_TARGET_SIZE}, got ${config.targetSize}`,
    );
  }

  if (!Array.isArray(config.quotas) || config.quotas.length === 0) {
    errors.push("quotas must be a non-empty array");
  } else {
    const seenRatings = new Set<number>();
    for (const quota of config.quotas) {
      if (typeof quota.rating !== "number" || !Number.isInteger(quota.rating) || quota.rating < 800 || quota.rating > 2400) {
        errors.push(`Invalid quota rating: ${quota.rating}`);
      }
      if (typeof quota.maxProblems !== "number" || !Number.isInteger(quota.maxProblems) || quota.maxProblems < 1) {
        errors.push(`Invalid maxProblems for rating ${quota.rating}: ${quota.maxProblems}`);
      }
      if (seenRatings.has(quota.rating)) {
        errors.push(`Duplicate rating in quotas: ${quota.rating}`);
      }
      seenRatings.add(quota.rating);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeProblemRating(rating: number | undefined): number | null {
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return null;
  }
  return Math.trunc(rating);
}

function sortBandProblems(
  problems: CodeforcesProblemPreview[],
): CodeforcesProblemPreview[] {
  return [...problems].sort((a, b) => {
    // Primary: solvedCount descending (higher count = more validated)
    const aSolved = normalizeSolvedCount(a.solvedCount);
    const bSolved = normalizeSolvedCount(b.solvedCount);
    if (aSolved !== bSolved) return bSolved - aSolved;

    // Secondary: contestId descending (newer contests first)
    const aContest = normalizeContestId(a.contestId);
    const bContest = normalizeContestId(b.contestId);
    if (aContest !== bContest) return bContest - aContest;

    // Tertiary: index ascending (A before B before C1 before D)
    const aIndex = normalizeIndex(a.index);
    const bIndex = normalizeIndex(b.index);
    if (aIndex < bIndex) return -1;
    if (aIndex > bIndex) return 1;

    // Quaternary: externalId for tiebreaking
    const aKey = a.externalId ?? "";
    const bKey = b.externalId ?? "";
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;

    return 0;
  });
}

function normalizeSolvedCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
}

function normalizeContestId(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.trunc(value);
}

function normalizeIndex(value: string | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "ZZZ";
  }
  return value.trim();
}

function computeTagDistribution(
  problems: readonly CodeforcesProblemPreview[],
): CodeforcesTagDistributionEntry[] {
  const tagCounts = new Map<string, number>();

  for (const problem of problems) {
    if (!Array.isArray(problem.tags)) continue;
    for (const tag of problem.tags) {
      if (typeof tag !== "string") continue;
      const normalized = tag.trim().toLowerCase();
      if (normalized.length === 0) continue;
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    }
  }

  // Sort by count descending, then alphabetically
  const entries: CodeforcesTagDistributionEntry[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });

  return entries;
}

// ---------------------------------------------------------------------------
// Tag coverage warnings
// ---------------------------------------------------------------------------

/**
 * Check tracked tags for low coverage and return warnings.
 * Does not modify the selection — advisory only.
 */
export function checkTagCoverage(
  tagDistribution: readonly CodeforcesTagDistributionEntry[],
  threshold: number = 10,
): string[] {
  const warnings: string[] = [];
  const tagCounts = new Map(
    tagDistribution.map((entry) => [entry.tag, entry.count]),
  );

  for (const tag of TRACKED_TAGS) {
    const count = tagCounts.get(tag) ?? 0;
    if (count < threshold) {
      warnings.push(
        `Low coverage: "${tag}" has only ${count} problem(s) in the selected pool (threshold: ${threshold}). Consider adjusting quotas.`,
      );
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Preset lookup
// ---------------------------------------------------------------------------

/**
 * Resolve a preset name to its config, or return null if unknown.
 */
export function resolvePreset(name: string): CodeforcesPoolConfig | null {
  return CURATED_POOL_PRESETS[name] ?? null;
}

/**
 * Resolve a preset name to its config, throwing if unknown.
 */
export function requirePreset(name: string): CodeforcesPoolConfig {
  const config = resolvePreset(name);
  if (!config) {
    throw new Error(
      `Unknown preset "${name}". Available presets: ${Object.keys(CURATED_POOL_PRESETS).join(", ")}`,
    );
  }
  return config;
}
