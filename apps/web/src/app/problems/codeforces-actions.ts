"use server";

/**
 * Codeforces Search Actions
 *
 * Server actions for searching/filtering/paginating Codeforces problem previews.
 *
 * All actions:
 * 1. Run through the Codeforces guard — blocked → no fetch
 * 2. Validate input parameters
 * 3. Fetch Codeforces problemset when allowed
 * 4. Adapt and filter results locally
 * 5. Return safe structure — no raw response, no env values, no DB writes
 *
 * @module codeforces-actions
 * @previewOnly — dev-only, not for production use
 */

import { evaluateCodeforcesGuard } from "../../lib/codeforces-client.ts";
import { fetchCodeforcesProblemset } from "../../lib/codeforces-client.ts";
import { adaptCodeforcesProblemSet } from "../../lib/codeforces-adapter.ts";
import type { CodeforcesProblemPreview } from "../../lib/codeforces-adapter.ts";
import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeforcesSearchInput {
  /** Free-text keyword to match against problem name */
  query?: string;
  /** Single tag filter (e.g. "dp", "greedy") */
  tag?: string;
  /** Minimum rating (inclusive) */
  minRating?: number;
  /** Maximum rating (inclusive) */
  maxRating?: number;
  /** Page number (1-based) */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

export interface CodeforcesSearchResult {
  success: boolean;
  /** Matching problem previews for current page */
  results: CodeforcesProblemPreview[];
  /** Total number of problems matching filters */
  totalMatched: number;
  /** Current page number (1-based) */
  page: number;
  /** Results per page */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Guard result — always included */
  guard: ExternalApiDevGuardResult;
  /** Whether the guard blocked the request */
  guardBlocked: boolean;
  /** Warnings about data quality */
  warnings: string[];
  /** Always false — never writes to DB */
  dbModified: false;
  /** Always false — raw response never stored */
  rawResponseStored: false;
  /** Always false — never exposes env values */
  envValuesExposed: false;
  /** Error message (null if success) */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 200;
const MAX_TAG_LENGTH = 100;
const RATING_MIN = 800;
const RATING_MAX = 4000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search Codeforces problems with filters and pagination.
 *
 * 1. Validates input
 * 2. Evaluates guard → blocked if env not configured
 * 3. Fetches Codeforces problemset (one API call, returned data is large)
 * 4. Adapts raw response to safe previews
 * 5. Applies client-side filtering (query, tag, rating range)
 * 6. Applies pagination
 * 7. Returns safe result — no raw response, no env values, no DB writes
 */
export async function searchCodeforcesProblems(
  input: CodeforcesSearchInput = {},
): Promise<CodeforcesSearchResult> {
  // Step 1: Validate input
  const validated = validateInput(input);

  // Step 2: Evaluate guard
  const guard = evaluateCodeforcesGuard();

  if (!guard.allowed) {
    return {
      success: false,
      results: [],
      totalMatched: 0,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: 0,
      hasNextPage: false,
      guard,
      guardBlocked: true,
      warnings: [],
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
      error: guard.blockedReason ?? "Problem API blocked by guard",
    };
  }

  // Step 3: Fetch Codeforces problemset
  const fetchResult = await fetchCodeforcesProblemset();

  if (!fetchResult.success || !fetchResult.data) {
    return {
      success: false,
      results: [],
      totalMatched: 0,
      page: validated.page,
      pageSize: validated.pageSize,
      totalPages: 0,
      hasNextPage: false,
      guard,
      guardBlocked: false,
      warnings: [],
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
      error: fetchResult.error ?? "Failed to fetch Codeforces problemset",
    };
  }

  // Step 4: Adapt raw response
  const adapted = adaptCodeforcesProblemSet(fetchResult.data);

  // Step 5: Filter
  const filtered = filterPreviews(adapted.previews, validated);

  // Step 6: Paginate
  const totalMatched = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / validated.pageSize));
  const safePage = Math.min(validated.page, totalPages);
  const startIdx = (safePage - 1) * validated.pageSize;
  const endIdx = Math.min(startIdx + validated.pageSize, totalMatched);
  const paginated = filtered.slice(startIdx, endIdx);

  return {
    success: true,
    results: paginated,
    totalMatched,
    page: safePage,
    pageSize: validated.pageSize,
    totalPages,
    hasNextPage: safePage < totalPages,
    guard,
    guardBlocked: false,
    warnings: adapted.warnings,
    dbModified: false,
    rawResponseStored: false,
    envValuesExposed: false,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

interface ValidatedInput {
  query: string;
  tag: string;
  minRating: number | undefined;
  maxRating: number | undefined;
  page: number;
  pageSize: number;
}

function validateInput(input: CodeforcesSearchInput): ValidatedInput {
  // Query
  let query = "";
  if (typeof input.query === "string") {
    query = input.query.trim().slice(0, MAX_QUERY_LENGTH);
  }

  // Tag
  let tag = "";
  if (typeof input.tag === "string") {
    tag = input.tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
  }

  // Rating range
  let minRating: number | undefined;
  if (typeof input.minRating === "number" && Number.isFinite(input.minRating)) {
    const clamped = Math.round(input.minRating);
    if (clamped >= RATING_MIN && clamped <= RATING_MAX) {
      minRating = clamped;
    }
  }

  let maxRating: number | undefined;
  if (typeof input.maxRating === "number" && Number.isFinite(input.maxRating)) {
    const clamped = Math.round(input.maxRating);
    if (clamped >= RATING_MIN && clamped <= RATING_MAX) {
      maxRating = clamped;
    }
  }

  // Ensure minRating <= maxRating if both set
  if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
    // Swap them
    [minRating, maxRating] = [maxRating, minRating];
  }

  // Page
  let page = DEFAULT_PAGE;
  if (typeof input.page === "number" && Number.isFinite(input.page)) {
    const p = Math.round(input.page);
    if (p >= 1 && p <= 1000) {
      page = p;
    }
  }

  // Page size
  let pageSize = DEFAULT_PAGE_SIZE;
  if (typeof input.pageSize === "number" && Number.isFinite(input.pageSize)) {
    const ps = Math.round(input.pageSize);
    if (ps >= 1 && ps <= MAX_PAGE_SIZE) {
      pageSize = ps;
    }
  }

  return { query, tag, minRating, maxRating, page, pageSize };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function filterPreviews(
  previews: CodeforcesProblemPreview[],
  filters: ValidatedInput,
): CodeforcesProblemPreview[] {
  let results = previews;

  // Filter by keyword (case-insensitive match on name)
  if (filters.query.length > 0) {
    const lowerQuery = filters.query.toLowerCase();
    results = results.filter((p) =>
      p.name.toLowerCase().includes(lowerQuery),
    );
  }

  // Filter by tag
  if (filters.tag.length > 0) {
    results = results.filter((p) =>
      p.tags.some((t) => t === filters.tag),
    );
  }

  // Filter by min rating
  if (filters.minRating !== undefined) {
    results = results.filter(
      (p) => p.rating !== undefined && p.rating >= filters.minRating!,
    );
  }

  // Filter by max rating
  if (filters.maxRating !== undefined) {
    results = results.filter(
      (p) => p.rating !== undefined && p.rating <= filters.maxRating!,
    );
  }

  return results;
}
