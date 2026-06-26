/**
 * Codeforces Catalog Policy
 *
 * Pure-function policy for determining which Codeforces problems are eligible
 * for the curated candidate problem pool. No database or network side effects.
 *
 * Default policy: Rating 800-2400, PROGRAMMING type only, no interactive,
 * no unrated problems.
 *
 * @module codeforces-catalog-policy
 */

import type { CodeforcesProblemPreview } from "./codeforces-adapter.ts";

// ---------------------------------------------------------------------------
// Policy type
// ---------------------------------------------------------------------------

export interface CodeforcesCatalogPolicy {
  /** Minimum rating for inclusion (inclusive). */
  minRating: number;
  /** Maximum rating for inclusion (inclusive). */
  maxRating: number;
  /** When true, problems without a rating are eligible. */
  includeUnrated: boolean;
  /** Tags that cause a problem to be rejected (case-insensitive). */
  excludeTags: string[];
  /** Problem types that are eligible. */
  allowedTypes: string[];
}

// ---------------------------------------------------------------------------
// Rejection reasons
// ---------------------------------------------------------------------------

export type CodeforcesRejectionReason =
  | "rating_below_min"
  | "rating_above_max"
  | "rating_missing"
  | "interactive"
  | "unsupported_type"
  | "contest_id_missing"
  | "index_missing"
  | "name_missing"
  | "stable_key_invalid";

export const ALL_REJECTION_REASONS: readonly CodeforcesRejectionReason[] = [
  "rating_below_min",
  "rating_above_max",
  "rating_missing",
  "interactive",
  "unsupported_type",
  "contest_id_missing",
  "index_missing",
  "name_missing",
  "stable_key_invalid",
];

// ---------------------------------------------------------------------------
// Policy result
// ---------------------------------------------------------------------------

export interface CodeforcesPolicyResult {
  /** Whether the problem is eligible for the catalog. */
  eligible: boolean;
  /** Rejection reason when eligible is false. */
  reason?: CodeforcesRejectionReason;
}

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

export const DEFAULT_CODEFORCES_CATALOG_POLICY: CodeforcesCatalogPolicy = {
  minRating: 800,
  maxRating: 2400,
  includeUnrated: false,
  excludeTags: ["interactive"],
  allowedTypes: ["PROGRAMMING"],
};

/** Full pool policy — 800-3500, include unrated, no interactive. */
export const FULL_POOL_CATALOG_POLICY: CodeforcesCatalogPolicy = {
  minRating: 800,
  maxRating: 3500,
  includeUnrated: true,
  excludeTags: ["interactive"],
  allowedTypes: ["PROGRAMMING"],
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a Codeforces problem preview is eligible for the curated
 * candidate problem pool under the given policy.
 *
 * Pure function — no database, no network, no side effects.
 *
 * Checks (in order):
 *   1. contestId must be a positive integer
 *   2. index must be a non-empty string
 *   3. name must be a non-empty string
 *   4. type must be in allowedTypes
 *   5. rating must be present (unless includeUnrated)
 *   6. rating must be >= minRating
 *   7. rating must be <= maxRating
 *   8. tags must not contain any excluded tag
 *
 * @param preview - Codeforces problem preview from the adapter
 * @param policy - Catalog policy (defaults to DEFAULT_CODEFORCES_CATALOG_POLICY)
 * @returns PolicyResult with eligible flag and optional rejection reason
 */
export function evaluateCodeforcesCatalogPolicy(
  preview: CodeforcesProblemPreview,
  policy: CodeforcesCatalogPolicy = DEFAULT_CODEFORCES_CATALOG_POLICY,
): CodeforcesPolicyResult {
  // 1. contestId must exist and be positive
  if (
    typeof preview.contestId !== "number" ||
    !Number.isFinite(preview.contestId) ||
    preview.contestId <= 0 ||
    !Number.isInteger(preview.contestId)
  ) {
    return { eligible: false, reason: "contest_id_missing" };
  }

  // 2. index must be a non-empty string
  if (typeof preview.index !== "string" || preview.index.trim().length === 0) {
    return { eligible: false, reason: "index_missing" };
  }

  // 3. name must be a non-empty string
  if (typeof preview.name !== "string" || preview.name.trim().length === 0) {
    return { eligible: false, reason: "name_missing" };
  }

  // 4. type must be in allowedTypes (if allowedTypes is non-empty)
  if (policy.allowedTypes.length > 0) {
    const problemType =
      typeof preview.type === "string" && preview.type.trim().length > 0
        ? preview.type.trim().toUpperCase()
        : null;

    if (
      problemType === null ||
      !policy.allowedTypes.includes(problemType)
    ) {
      return { eligible: false, reason: "unsupported_type" };
    }
  }

  // 5. Rating check — must be present unless includeUnrated
  const hasRating =
    typeof preview.rating === "number" &&
    Number.isFinite(preview.rating) &&
    preview.rating > 0;

  if (!hasRating) {
    if (!policy.includeUnrated) {
      return { eligible: false, reason: "rating_missing" };
    }
    // includeUnrated: skip min/max checks for unrated problems
  } else {
    // 6. Rating >= minRating
    if (preview.rating! < policy.minRating) {
      return { eligible: false, reason: "rating_below_min" };
    }

    // 7. Rating <= maxRating
    if (preview.rating! > policy.maxRating) {
      return { eligible: false, reason: "rating_above_max" };
    }
  }

  // 8. Tags must not contain any excluded tag (case-insensitive)
  if (policy.excludeTags.length > 0 && Array.isArray(preview.tags)) {
    const lowerTags = new Set(
      preview.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase()),
    );

    for (const excluded of policy.excludeTags) {
      if (lowerTags.has(excluded.toLowerCase())) {
        return { eligible: false, reason: "interactive" };
      }
    }
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Policy merge helper
// ---------------------------------------------------------------------------

/**
 * Merge CLI overrides into the default policy.
 * Returns a new policy object — does not mutate inputs.
 *
 * @param overrides - Partial policy overrides from CLI arguments
 * @param base - Base policy to merge into (defaults to DEFAULT)
 * @returns New policy object
 */
export function mergeCatalogPolicy(
  overrides: Partial<CodeforcesCatalogPolicy>,
  base: CodeforcesCatalogPolicy = DEFAULT_CODEFORCES_CATALOG_POLICY,
): CodeforcesCatalogPolicy {
  return {
    minRating: overrides.minRating ?? base.minRating,
    maxRating: overrides.maxRating ?? base.maxRating,
    includeUnrated: overrides.includeUnrated ?? base.includeUnrated,
    excludeTags: overrides.excludeTags ?? [...base.excludeTags],
    allowedTypes: overrides.allowedTypes ?? [...base.allowedTypes],
  };
}

// ---------------------------------------------------------------------------
// Policy-based problem classification (for cleanup reports)
// ---------------------------------------------------------------------------

export interface CodeforcesPolicyClassification {
  eligible: boolean;
  reason?: CodeforcesRejectionReason;
  /** The problem's rating (null if missing from metadata). */
  rating: number | null;
  /** The problem's type from metadata. */
  problemType: string | null;
  /** Whether the problem has any user associations. */
  hasUserAssociations: boolean;
  /** The problem's external key for identification. */
  externalKey: string;
  /** Problem title for display. */
  title: string;
}

/**
 * Classify a database problem record against the catalog policy.
 * Used for read-only cleanup reports — never deletes or modifies data.
 *
 * @param record - A problem record with metadata from the database
 * @param hasUserAssociations - Whether this problem has user associations
 *   (favorites, practice records, wrong book entries, attempts, recommendations)
 * @param policy - Catalog policy to evaluate against
 * @returns Classification result
 */
export function classifyProblemAgainstPolicy(
  record: {
    title: string;
    metadata: unknown;
  },
  hasUserAssociations: boolean,
  policy: CodeforcesCatalogPolicy = DEFAULT_CODEFORCES_CATALOG_POLICY,
): CodeforcesPolicyClassification {
  const metadata = asRecord(record.metadata);
  const rating = extractRating(metadata);
  const problemType = extractText(metadata.type);
  const contestId = extractPositiveInteger(metadata.contestId);
  const index = extractText(metadata.index);
  const externalKey =
    contestId !== null && index !== null
      ? `codeforces:${contestId}:${index}`
      : "unknown";

  // Extract tags from metadata for interactive/other excluded tag checks
  const tags = extractTags(metadata);

  // Build a minimal preview for policy evaluation.
  // DB records may not have `type` stored — treat missing type as PROGRAMMING
  // so we don't falsely reject old data on `unsupported_type`.
  const preview: CodeforcesProblemPreview = {
    provider: "codeforces",
    externalId: externalKey,
    contestId: contestId ?? undefined,
    index: index ?? "",
    name: record.title,
    type: problemType ?? "PROGRAMMING",
    rating: rating ?? undefined,
    tags,
    sourceUrl: "",
    externalLabel: "外部数据预览 · 未导入本地",
  };

  const policyResult = evaluateCodeforcesCatalogPolicy(preview, policy);

  return {
    eligible: policyResult.eligible,
    reason: policyResult.reason,
    rating,
    problemType,
    hasUserAssociations,
    externalKey,
    title: record.title,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function extractRating(metadata: Record<string, unknown>): number | null {
  const value = extractPositiveInteger(
    metadata.rating ?? metadata.codeforcesRating,
  );
  return value;
}

function extractPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function extractText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractTags(metadata: Record<string, unknown>): string[] {
  const raw = metadata.tags ?? metadata.codeforcesTags;
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase();
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= 30) break;
  }
  return result;
}
