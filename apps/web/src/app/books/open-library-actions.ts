"use server";

/**
 * Open Library Server Actions for Books Page
 *
 * Server-side actions that:
 * 1. Check the A463 guard status
 * 2. Guard blocked → return blocked state (no fetch)
 * 3. Guard allowed → call Open Library client → adapter → safe preview
 * 4. Never return raw response, env values, API keys, or secrets
 * 5. Never write to DB, never create book/chapter records, never import
 *
 * @module open-library-actions
 * @previewOnly — dev-only search and detail preview, not for production
 */

import {
  searchOpenLibraryBooks,
  getOpenLibraryWorkDetail,
  getOpenLibraryEditionDetail,
  evaluateOpenLibraryGuard,
} from "../../lib/open-library-client";
import {
  adaptOpenLibrarySearchResults,
  adaptOpenLibraryWorkDetail,
  adaptOpenLibraryEditionDetail,
  type OpenLibraryBookPreview,
  type OpenLibraryDetailPreview,
} from "../../lib/open-library-adapter";
import type { ExternalApiDevGuardResult } from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface OpenLibrarySearchActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Guard result (always included, even on success) */
  guard: ExternalApiDevGuardResult;
  /** Whether the guard blocked the request */
  guardBlocked: boolean;
  /** Search result previews (empty if blocked or error) */
  results: OpenLibraryBookPreview[];
  /** Total results found (0 if blocked or error) */
  totalResults: number;
  /** Error message (null if success) */
  error: string | null;
  /** The query that was used */
  query: string;
  /** Always "search" */
  actionType: "search";
  /** Safety marker */
  dbModified: false;
  rawResponseStored: false;
  envValuesExposed: false;
}

export interface OpenLibraryDetailActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** Guard result */
  guard: ExternalApiDevGuardResult;
  /** Whether the guard blocked the request */
  guardBlocked: boolean;
  /** Detail preview (null if blocked or error) */
  detail: OpenLibraryDetailPreview | null;
  /** Error message (null if success) */
  error: string | null;
  /** Action type */
  actionType: "detail";
  /** Safety marker */
  dbModified: false;
  rawResponseStored: false;
  envValuesExposed: false;
}

// ---------------------------------------------------------------------------
// Search action
// ---------------------------------------------------------------------------

/**
 * Search Open Library for books matching the query.
 * Returns safe preview data — no raw API responses, no env values.
 */
export async function openLibrarySearchAction(
  query: string,
  limit?: number,
): Promise<OpenLibrarySearchActionResult> {
  const guard = evaluateOpenLibraryGuard();

  // Guard blocked — no fetch
  if (!guard.allowed) {
    return {
      success: false,
      guard,
      guardBlocked: true,
      results: [],
      totalResults: 0,
      error: guard.blockedReason ?? "Book API blocked by guard",
      query,
      actionType: "search",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  // Guard allowed — do real search
  const searchResult = await searchOpenLibraryBooks(
    { query, limit: limit ?? 10 },
  );

  if (!searchResult.success) {
    return {
      success: false,
      guard: searchResult.guard,
      guardBlocked: searchResult.guardBlocked,
      results: [],
      totalResults: 0,
      error: searchResult.error,
      query,
      actionType: "search",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  // Adapt results
  const results = searchResult.data
    ? adaptOpenLibrarySearchResults(searchResult.data)
    : [];

  return {
    success: true,
    guard: searchResult.guard,
    guardBlocked: false,
    results,
    totalResults: searchResult.data?.numFound ?? results.length,
    error: null,
    query,
    actionType: "search",
    dbModified: false,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

// ---------------------------------------------------------------------------
// Detail actions
// ---------------------------------------------------------------------------

/**
 * Get detailed information about an Open Library work.
 */
export async function openLibraryWorkDetailAction(
  workKey: string,
): Promise<OpenLibraryDetailActionResult> {
  const guard = evaluateOpenLibraryGuard();

  if (!guard.allowed) {
    return {
      success: false,
      guard,
      guardBlocked: true,
      detail: null,
      error: guard.blockedReason ?? "Book API blocked by guard",
      actionType: "detail",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  const detailResult = await getOpenLibraryWorkDetail(workKey);

  if (!detailResult.success || !detailResult.data) {
    return {
      success: false,
      guard: detailResult.guard,
      guardBlocked: detailResult.guardBlocked,
      detail: null,
      error: detailResult.error,
      actionType: "detail",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  const detail = adaptOpenLibraryWorkDetail(detailResult.data);

  return {
    success: true,
    guard: detailResult.guard,
    guardBlocked: false,
    detail,
    error: null,
    actionType: "detail",
    dbModified: false,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}

/**
 * Get detailed information about an Open Library edition.
 */
export async function openLibraryEditionDetailAction(
  editionKey: string,
): Promise<OpenLibraryDetailActionResult> {
  const guard = evaluateOpenLibraryGuard();

  if (!guard.allowed) {
    return {
      success: false,
      guard,
      guardBlocked: true,
      detail: null,
      error: guard.blockedReason ?? "Book API blocked by guard",
      actionType: "detail",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  const detailResult = await getOpenLibraryEditionDetail(editionKey);

  if (!detailResult.success || !detailResult.data) {
    return {
      success: false,
      guard: detailResult.guard,
      guardBlocked: detailResult.guardBlocked,
      detail: null,
      error: detailResult.error,
      actionType: "detail",
      dbModified: false,
      rawResponseStored: false,
      envValuesExposed: false,
    };
  }

  const detail = adaptOpenLibraryEditionDetail(detailResult.data);

  return {
    success: true,
    guard: detailResult.guard,
    guardBlocked: false,
    detail,
    error: null,
    actionType: "detail",
    dbModified: false,
    rawResponseStored: false,
    envValuesExposed: false,
  };
}
