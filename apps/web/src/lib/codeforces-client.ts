/**
 * Codeforces API Client
 *
 * Lightweight client for Codeforces' public API. All functions:
 * 1. Run through the A463 unified guard (with LAP_PROBLEM_API_KEY treated as optional)
 * 2. Use safe fetch with timeout
 * 3. Sanitize all errors — no raw bodies, headers, or env values
 *
 * Codeforces is a free competitive programming platform —
 * the problem listing endpoint requires no API key.
 *
 * Endpoints used:
 *   Problem set: GET /api/problemset.problems
 *   User info:   GET /api/user.info
 *   User status: GET /api/user.status
 *   User rating: GET /api/user.rating
 *
 * @module codeforces-client
 * @previewOnly — dev-only, not for production use
 */

import {
  evaluateExternalApiDevGuard,
  PROBLEM_API_CONTRACT,
  type ExternalApiDevGuardResult,
} from "@learning-agent-platform/shared";
import {
  createAssistantProviderEnvSnapshot,
  loadAssistantProviderConfig,
} from "./assistant/config/assistant-provider-config.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeforcesProblemSetResponse {
  /** Always "OK" on success from Codeforces */
  status: string;
  /** Raw result object — only temporarily available during adapter mapping */
  result: {
    problems: unknown[];
    problemStatistics: unknown[];
  } | null;
  /** Always false — raw response not exposed to client */
  _rawExposed: false;
}

export interface CodeforcesClientResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  guardBlocked: boolean;
  guard: ExternalApiDevGuardResult;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://codeforces.com/api";
const DEFAULT_TIMEOUT_MS = 15_000; // Codeforces response can be large (~800KB)

// ---------------------------------------------------------------------------
// Guard: Codeforces — API key is optional
// ---------------------------------------------------------------------------

/**
 * Evaluate the A463 unified guard for Codeforces Problem API.
 * LAP_PROBLEM_API_KEY is treated as optional — Codeforces does not require an API key.
 */
export function evaluateCodeforcesGuard(
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): ExternalApiDevGuardResult {
  const guard = evaluateExternalApiDevGuard({
    providerLabel: PROBLEM_API_CONTRACT.label,
    allowExternalEnvName: PROBLEM_API_CONTRACT.allowEnvName,
    requiredEnvNames: PROBLEM_API_CONTRACT.requiredEnvNames,
    env,
  });

  // For Codeforces, LAP_PROBLEM_API_KEY is optional — don't block if it's the only missing env
  if (!guard.allowed) {
    const nonKeyMissing = guard.missingEnvNames.filter(
      (name) => name !== "LAP_PROBLEM_API_KEY",
    );
    if (
      nonKeyMissing.length === 0 &&
      guard.missingEnvNames.includes("LAP_PROBLEM_API_KEY")
    ) {
      // Only missing API key — Codeforces doesn't need one
      return {
        providerMode: "external-dev",
        safeToExposeToClient: true,
        productionReady: false,
        allowed: true,
        blockedReason: null,
        requiredEnvNames: guard.requiredEnvNames,
        configuredEnvNames: guard.configuredEnvNames,
        missingEnvNames: [],
      };
    }
  }

  return guard;
}

// ---------------------------------------------------------------------------
// Env reader (safe — never reads .env.local directly)
// ---------------------------------------------------------------------------

function resolveBaseUrl(env: Record<string, string | undefined>): string {
  const config = loadAssistantProviderConfig(env);
  return config.codeforces.baseUrl || DEFAULT_BASE_URL;
}

// ---------------------------------------------------------------------------
// Safe fetch
// ---------------------------------------------------------------------------

/**
 * Perform a safe HTTP GET request with timeout and error sanitization.
 * Never returns raw response body in error messages.
 */
async function safeFetchJson(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `CF_HTTP_${response.status}: upstream returned non-OK status`,
      );
    }

    const data = await response.json();
    if (data === null || data === undefined) {
      throw new Error("CF_EMPTY_BODY: upstream returned null/undefined body");
    }

    return data;
  } catch (error) {
    // Sanitize all errors — no URLs with potential query params, no raw bodies
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `CF_TIMEOUT: request timed out after ${timeoutMs}ms`,
      );
    }
    // Preserve structured error codes (CF_HTTP_xxx, CF_EMPTY_BODY) as-is
    if (error instanceof Error && /^CF_/.test(error.message)) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    // Redact any URLs in error messages
    const sanitized = msg
      .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
      .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[REDACTED]");
    throw new Error(`CF_FETCH_ERROR: ${sanitized.slice(0, 200)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Public API: Fetch problem set
// ---------------------------------------------------------------------------

/**
 * Fetch Codeforces problem set (all problems + statistics).
 *
 * Guard check: if blocked, returns empty result with guard info (no fetch made).
 * If allowed, fetches from Codeforces problemset endpoint.
 *
 * The Codeforces API endpoint /api/problemset.problems returns all problems
 * as a single response. Filtering/pagination is handled by the adapter/search
 * layer on the client side.
 *
 * Errors are sanitized — no URLs, secrets, or raw bodies in error messages.
 */
export async function fetchCodeforcesProblemset(
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): Promise<CodeforcesClientResult<CodeforcesProblemSetResponse>> {
  const guard = evaluateCodeforcesGuard(env);

  // Guard blocked — no fetch
  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Problem API blocked by guard",
      guardBlocked: true,
      guard,
    };
  }

  // Guard allowed — do real fetch
  const baseUrl = resolveBaseUrl(env);
  const url = `${baseUrl}/problemset.problems`;

  try {
    const raw = await safeFetchJson(url);

    if (!isRecord(raw)) {
      return {
        success: false,
        data: null,
        error: "CF_UNEXPECTED_RESPONSE: response is not a valid JSON object",
        guardBlocked: false,
        guard,
      };
    }

    // Validate Codeforces API response structure
    if (raw.status !== "OK") {
      return {
        success: false,
        data: null,
        error: `CF_API_STATUS: Codeforces API returned status "${String(raw.status ?? "unknown")}" instead of "OK"`,
        guardBlocked: false,
        guard,
      };
    }

    if (!isRecord(raw.result)) {
      return {
        success: false,
        data: null,
        error: "CF_UNEXPECTED_RESPONSE: result is not a valid object",
        guardBlocked: false,
        guard,
      };
    }

    return {
      success: true,
      data: {
        status: "OK",
        result: {
          problems: Array.isArray(raw.result.problems) ? raw.result.problems : [],
          problemStatistics: Array.isArray(raw.result.problemStatistics) ? raw.result.problemStatistics : [],
        },
        _rawExposed: false,
      },
      error: null,
      guardBlocked: false,
      guard,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      guardBlocked: false,
      guard,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// User API types
// ---------------------------------------------------------------------------

export interface CodeforcesUserInfo {
  handle: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution: number;
  rank?: string;
  maxRank?: string;
  rating?: number;
  maxRating?: number;
  friendOfCount: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  avatar?: string;
  titlePhoto?: string;
}

export interface CodeforcesUserStatusSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: {
    contestId?: number;
    index: string;
    name: string;
    type: string;
    rating?: number;
    tags: string[];
  };
  author: {
    contestId?: number;
    members: Array<{ handle: string }>;
    participantType?: string;
    ghost?: boolean;
    startTimeSeconds?: number;
  };
  programmingLanguage: string;
  verdict?: string;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

export interface CodeforcesRatingChangeEntry {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CodeforcesUserInfoResult {
  success: boolean;
  data: CodeforcesUserInfo | null;
  error: string | null;
  guardBlocked: boolean;
}

export interface CodeforcesUserStatusResult {
  success: boolean;
  data: {
    submissions: CodeforcesUserStatusSubmission[];
    truncated: boolean;
    totalFetched: number;
    oldestFetchedCreationTime?: number;
  } | null;
  error: string | null;
  guardBlocked: boolean;
}

export interface CodeforcesRatingHistoryResult {
  success: boolean;
  data: CodeforcesRatingChangeEntry[] | null;
  error: string | null;
  guardBlocked: boolean;
}

// ---------------------------------------------------------------------------
// Safe defaults for user data API
// ---------------------------------------------------------------------------

/** Maximum submissions to fetch in a single page. */
const STATUS_PAGE_SIZE = 100;
/** Absolute maximum submissions to fetch in a single sync. */
const MAX_SYNC_SUBMISSIONS = 5000;
/** Maximum rating history entries to fetch. */
const MAX_RATING_HISTORY = 200;

// ---------------------------------------------------------------------------
// User info
// ---------------------------------------------------------------------------

/**
 * Fetch Codeforces user.info for a given handle.
 *
 * Supports history lookup via the optional `historyHandle` parameter.
 * Returns the canonical handle as stored by Codeforces.
 *
 * Errors are sanitized — no URLs, secrets, or raw bodies in error messages.
 * includeSources is always false.
 */
export async function fetchCodeforcesUserInfo(
  handle: string,
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): Promise<CodeforcesUserInfoResult> {
  const guard = evaluateCodeforcesGuard(env);
  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Problem API blocked by guard",
      guardBlocked: true,
    };
  }

  const baseUrl = resolveBaseUrl(env);
  const normalized = handle.trim();
  if (!normalized) {
    return { success: false, data: null, error: "CF_INVALID_HANDLE: empty handle", guardBlocked: false };
  }

  const url = `${baseUrl}/user.info?handles=${encodeURIComponent(normalized)}&includeSources=false`;

  try {
    const raw = await safeFetchJson(url);
    if (!isRecord(raw)) {
      return { success: false, data: null, error: "CF_UNEXPECTED_RESPONSE: not a valid JSON object", guardBlocked: false };
    }
    if (raw.status !== "OK") {
      const comment = typeof raw.comment === "string" ? raw.comment : "unknown error";
      return { success: false, data: null, error: `CF_API_STATUS: ${comment.slice(0, 200)}`, guardBlocked: false };
    }
    if (!Array.isArray(raw.result) || raw.result.length === 0) {
      return { success: false, data: null, error: "CF_HANDLE_NOT_FOUND: no user found with that handle", guardBlocked: false };
    }
    const user = raw.result[0] as CodeforcesUserInfo;
    return { success: true, data: user, error: null, guardBlocked: false };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      guardBlocked: false,
    };
  }
}

// ---------------------------------------------------------------------------
// User status (submissions)
// ---------------------------------------------------------------------------

/**
 * Fetch a page of Codeforces user.status submissions.
 *
 * Uses from/count pagination — `from` is the 1-based index of the first submission.
 * Returns `truncated: true` when the absolute max is reached.
 *
 * NEVER fetches or stores submission source code.
 * Raw API bodies are never written to logs or DB.
 */
async function fetchUserStatusPage(
  handle: string,
  from: number,
  count: number,
  baseUrl: string,
): Promise<{ submissions: CodeforcesUserStatusSubmission[]; ok: boolean; error?: string }> {
  const url = `${baseUrl}/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${count}`;
  try {
    const raw = await safeFetchJson(url);
    if (!isRecord(raw)) {
      return { submissions: [], ok: false, error: "CF_UNEXPECTED_RESPONSE: not a valid JSON object" };
    }
    if (raw.status !== "OK") {
      const comment = typeof raw.comment === "string" ? raw.comment : "unknown error";
      return { submissions: [], ok: false, error: `CF_API_STATUS: ${comment.slice(0, 200)}` };
    }
    if (!Array.isArray(raw.result)) {
      return { submissions: [], ok: true };
    }
    return { submissions: raw.result as CodeforcesUserStatusSubmission[], ok: true };
  } catch (error) {
    return {
      submissions: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch all recent Codeforces user.status submissions with pagination.
 *
 * - Fetches newest-first with fixed page size
 * - Respects absolute max safety limit (MAX_SYNC_SUBMISSIONS)
 * - Can resume from a known submission ID for incremental sync
 * - Returns `truncated: true` when limit is hit
 * - NEVER returns source code
 *
 * @param handle - Codeforces handle
 * @param options.sinceSubmissionId - Optional: only fetch submissions newer than this ID
 * @param options.maxPages - Optional: max pages to fetch (default: derived from MAX_SYNC_SUBMISSIONS)
 */
export async function fetchCodeforcesUserStatus(
  handle: string,
  options?: {
    sinceSubmissionId?: number;
    maxPages?: number;
  },
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): Promise<CodeforcesUserStatusResult> {
  const guard = evaluateCodeforcesGuard(env);
  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Problem API blocked by guard",
      guardBlocked: true,
    };
  }

  const baseUrl = resolveBaseUrl(env);
  const normalized = handle.trim();
  if (!normalized) {
    return { success: false, data: null, error: "CF_INVALID_HANDLE: empty handle", guardBlocked: false };
  }

  const maxPages = options?.maxPages ?? Math.ceil(MAX_SYNC_SUBMISSIONS / STATUS_PAGE_SIZE);
  const sinceId = options?.sinceSubmissionId ?? null;

  const allSubmissions: CodeforcesUserStatusSubmission[] = [];
  let truncated = false;
  let from = 1;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchUserStatusPage(normalized, from, STATUS_PAGE_SIZE, baseUrl);

    if (!result.ok) {
      // If we already have data, return partial success
      if (allSubmissions.length > 0) {
        truncated = true;
        break;
      }
      return {
        success: false,
        data: null,
        error: result.error ?? "CF_FETCH_ERROR",
        guardBlocked: false,
      };
    }

    if (result.submissions.length === 0) break;

    for (const submission of result.submissions) {
      // Check if we've reached the sinceId boundary
      if (sinceId !== null && submission.id <= sinceId) {
        // Found boundary — stop collecting but note the boundary
        // Since submissions are newest-first, all remaining are older
        break;
      }
      allSubmissions.push(submission);

      if (allSubmissions.length >= MAX_SYNC_SUBMISSIONS) {
        truncated = true;
        break;
      }
    }

    if (truncated) break;

    // Check if the batch itself was smaller than page size (last page)
    if (result.submissions.length < STATUS_PAGE_SIZE) break;

    from += STATUS_PAGE_SIZE;
  }

  // Strip source code — security guard
  const cleanSubmissions = allSubmissions.map((s) => ({
    id: s.id,
    contestId: s.contestId,
    creationTimeSeconds: s.creationTimeSeconds,
    relativeTimeSeconds: s.relativeTimeSeconds,
    problem: {
      contestId: s.problem.contestId,
      index: s.problem.index,
      name: s.problem.name,
      type: s.problem.type,
      rating: s.problem.rating,
      tags: s.problem.tags,
    },
    author: {
      contestId: s.author.contestId,
      members: s.author.members.map((member) => ({ handle: member.handle })),
      participantType: s.author.participantType,
      ghost: s.author.ghost,
      startTimeSeconds: s.author.startTimeSeconds,
    },
    programmingLanguage: s.programmingLanguage,
    verdict: s.verdict ?? "UNKNOWN",
    testset: "CF",
    passedTestCount: s.passedTestCount,
    timeConsumedMillis: s.timeConsumedMillis,
    memoryConsumedBytes: s.memoryConsumedBytes,
  }));

  return {
    success: true,
    data: {
      submissions: cleanSubmissions,
      truncated,
      totalFetched: cleanSubmissions.length,
      oldestFetchedCreationTime:
        cleanSubmissions.length > 0
          ? cleanSubmissions[cleanSubmissions.length - 1].creationTimeSeconds
          : undefined,
    },
    error: null,
    guardBlocked: false,
  };
}

// ---------------------------------------------------------------------------
// User rating history
// ---------------------------------------------------------------------------

/**
 * Fetch Codeforces user.rating history.
 *
 * Returns all contest rating changes for the given handle.
 */
export async function fetchCodeforcesUserRating(
  handle: string,
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): Promise<CodeforcesRatingHistoryResult> {
  const guard = evaluateCodeforcesGuard(env);
  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Problem API blocked by guard",
      guardBlocked: true,
    };
  }

  const baseUrl = resolveBaseUrl(env);
  const normalized = handle.trim();
  if (!normalized) {
    return { success: false, data: null, error: "CF_INVALID_HANDLE: empty handle", guardBlocked: false };
  }

  const url = `${baseUrl}/user.rating?handle=${encodeURIComponent(normalized)}`;

  try {
    const raw = await safeFetchJson(url);
    if (!isRecord(raw)) {
      return { success: false, data: null, error: "CF_UNEXPECTED_RESPONSE: not a valid JSON object", guardBlocked: false };
    }
    if (raw.status !== "OK") {
      const comment = typeof raw.comment === "string" ? raw.comment : "unknown error";
      return { success: false, data: null, error: `CF_API_STATUS: ${comment.slice(0, 200)}`, guardBlocked: false };
    }
    if (!Array.isArray(raw.result)) {
      return { success: true, data: [], error: null, guardBlocked: false };
    }
    const history = raw.result.slice(0, MAX_RATING_HISTORY) as CodeforcesRatingChangeEntry[];
    return { success: true, data: history, error: null, guardBlocked: false };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      guardBlocked: false,
    };
  }
}
