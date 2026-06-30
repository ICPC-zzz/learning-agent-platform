/**
 * Web AI User Data Summary — server-side read-only aggregator for safe user
 * learning data that the /ai assistant can read. Returns only sanitized
 * counts and summaries; no secrets, tokens, or raw payloads.
 *
 * @module web-ai-user-data-summary
 * @previewOnly
 */

"use server";

import type { WebAiUserDataSummary } from "./web-ai-context-builder";
import { buildEmptyUserDataSummary, buildUserDataSummary } from "./web-ai-context-builder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebAiUserDataSummaryInput {
  /** Optional: known imported book count from localStorage. */
  localStorageImportedBookCount?: number;
  /** Optional: known imported problem count from localStorage. */
  localStorageImportedProblemCount?: number;
}

export interface WebAiUserDataSummaryResult {
  summary: WebAiUserDataSummary;
  source: "db" | "localStorage" | "empty";
  dbAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function getWebAiUserDataSummary(
  input?: WebAiUserDataSummaryInput,
): Promise<WebAiUserDataSummaryResult> {
  // Check DB availability
  const dbAvailable = hasDatabaseUrl();

  if (!dbAvailable) {
    // Fallback to localStorage counts if provided
    const summary = buildUserDataSummary({
      dbAvailable: false,
      importedBookCount: input?.localStorageImportedBookCount ?? 0,
      importedProblemCount: input?.localStorageImportedProblemCount ?? 0,
      recentReadingSummary: "",
      learningStatsSummary: "",
      favoritesSummary: "",
    });
    return { summary, source: input ? "localStorage" : "empty", dbAvailable: false };
  }

  // DB available — attempt to aggregate safe summaries
  try {
    // Dynamic imports to avoid build-time DB dependency issues
    const { getSafeUserDataSummary } = await import("./web-ai-user-data-db-loader");
    const dbSummary = await getSafeUserDataSummary(input);
    return dbSummary;
  } catch {
    // DB load failed — fallback
    const summary = buildUserDataSummary({
      dbAvailable: true,
      importedBookCount: input?.localStorageImportedBookCount ?? 0,
      importedProblemCount: input?.localStorageImportedProblemCount ?? 0,
      recentReadingSummary: "[DB 读取失败，使用本地缓存]",
      learningStatsSummary: "[DB 读取失败]",
      favoritesSummary: "",
    });
    return { summary, source: "localStorage", dbAvailable: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasDatabaseUrl(): boolean {
  try {
    const url = process.env.DATABASE_URL;
    return typeof url === "string" && url.trim().length > 0;
  } catch {
    return false;
  }
}
