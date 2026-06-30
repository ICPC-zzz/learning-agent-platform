/**
 * Open Library API Client
 *
 * Lightweight client for Open Library's public API. All functions:
 * 1. Run through the A463 unified guard (with LAP_BOOK_API_KEY treated as optional)
 * 2. Use safe fetch with timeout
 * 3. Sanitize all errors — no raw bodies, headers, or env values
 *
 * Open Library is a free, open book catalog — no API key required.
 *
 * Endpoints used:
 *   Search: GET /search.json?q={query}&limit={limit}
 *   Work detail: GET /works/{workKey}.json
 *   Edition detail: GET /books/{editionKey}.json
 *
 * @module open-library-client
 * @previewOnly — dev-only, not for production use
 */

import {
  evaluateExternalApiDevGuard,
  BOOK_API_CONTRACT,
  type ExternalApiDevGuardResult,
} from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenLibrarySearchInput {
  query: string;
  limit?: number;
  /** Optional: offset for pagination (not implemented yet) */
  offset?: number;
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: unknown[];
  /** Always false — raw response not exposed directly */
  _rawExposed: false;
}

export interface OpenLibraryWorkDetail {
  key?: string;
  title?: string;
  description?: string | { type: string; value: string };
  subjects?: string[];
  covers?: number[];
  authors?: unknown[];
  first_publish_date?: string;
  /** Always false — raw response not exposed directly */
  _rawExposed: false;
}

export interface OpenLibraryEditionDetail {
  key?: string;
  title?: string;
  authors?: unknown[];
  publish_date?: string;
  publishers?: string[];
  isbn_10?: string[];
  isbn_13?: string[];
  covers?: number[];
  languages?: unknown[];
  subjects?: string[];
  description?: string | { type: string; value: string };
  works?: unknown[];
  _rawExposed: false;
}

export interface OpenLibraryClientResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  guardBlocked: boolean;
  guard: ExternalApiDevGuardResult;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://openlibrary.org";
const DEFAULT_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Guard: Open Library — API key is optional
// ---------------------------------------------------------------------------

/**
 * Evaluate the A463 unified guard for Open Library.
 * LAP_BOOK_API_KEY is treated as optional — Open Library does not require an API key.
 */
export function evaluateOpenLibraryGuard(
  env?: Record<string, string | undefined>,
): ExternalApiDevGuardResult {
  const guard = evaluateExternalApiDevGuard({
    providerLabel: BOOK_API_CONTRACT.label,
    allowExternalEnvName: BOOK_API_CONTRACT.allowEnvName,
    requiredEnvNames: BOOK_API_CONTRACT.requiredEnvNames,
    env,
  });

  // For Open Library, LAP_BOOK_API_KEY is optional — don't block if it's the only missing env
  if (!guard.allowed) {
    const nonKeyMissing = guard.missingEnvNames.filter(
      (name) => name !== "LAP_BOOK_API_KEY",
    );
    if (
      nonKeyMissing.length === 0 &&
      guard.missingEnvNames.includes("LAP_BOOK_API_KEY")
    ) {
      // Only missing API key — Open Library doesn't need one
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

function safeGetEnv(name: string): string | undefined {
  try {
    return process.env[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function resolveBaseUrl(): string {
  return safeGetEnv("LAP_BOOK_API_BASE_URL") || DEFAULT_BASE_URL;
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
    const fetchOpts: RequestInit = {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    };
    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
      throw new Error(
        `OL_HTTP_${response.status}: upstream returned non-OK status`,
      );
    }

    const data = await response.json();
    if (data === null || data === undefined) {
      throw new Error("OL_EMPTY_BODY: upstream returned null/undefined body");
    }

    return data;
  } catch (error) {
    // Sanitize all errors — no URLs with potential query params, no raw bodies
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `OL_TIMEOUT: request timed out after ${timeoutMs}ms`,
      );
    }
    // Preserve structured error codes (OL_HTTP_xxx, OL_EMPTY_BODY) as-is
    if (error instanceof Error && /^OL_/.test(error.message)) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    // Redact any URLs in error messages
    const sanitized = msg
      .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
      .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[REDACTED]");
    throw new Error(`OL_FETCH_ERROR: ${sanitized.slice(0, 200)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Public API: Search
// ---------------------------------------------------------------------------

/**
 * Search Open Library for books matching the given query.
 *
 * Guard check: if blocked, returns empty result with guard info (no fetch made).
 * If allowed, fetches from Open Library search endpoint.
 *
 * Errors are sanitized — no URLs, secrets, or raw bodies in error messages.
 */
export async function searchOpenLibraryBooks(
  input: OpenLibrarySearchInput,
  env?: Record<string, string | undefined>,
): Promise<OpenLibraryClientResult<OpenLibrarySearchResponse>> {
  const guard = evaluateOpenLibraryGuard(env);

  // Validate query
  const query = (input.query ?? "").trim();
  if (query.length === 0) {
    return {
      success: false,
      data: null,
      error: "OL_INVALID_QUERY: search query must not be empty",
      guardBlocked: false,
      guard,
    };
  }
  if (query.length > 500) {
    return {
      success: false,
      data: null,
      error: "OL_INVALID_QUERY: search query exceeds 500 character limit",
      guardBlocked: false,
      guard,
    };
  }

  // Guard blocked — no fetch
  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Book API blocked by guard",
      guardBlocked: true,
      guard,
    };
  }

  // Guard allowed — do real fetch
  const baseUrl = resolveBaseUrl();
  const limit = input.limit ?? 10;
  const url = `${baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 20)}`;

  try {
    const raw = await safeFetchJson(url);

    if (!isRecord(raw)) {
      return {
        success: false,
        data: null,
        error: "OL_UNEXPECTED_RESPONSE: search response is not a valid JSON object",
        guardBlocked: false,
        guard,
      };
    }

    return {
      success: true,
      data: {
        numFound: safeNumber(raw.numFound) ?? 0,
        start: safeNumber(raw.start) ?? 0,
        docs: Array.isArray(raw.docs) ? raw.docs : [],
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
// Public API: Work Detail
// ---------------------------------------------------------------------------

/**
 * Get detailed information about an Open Library work.
 *
 * @param workKey — e.g. "OL123W" (with or without "/works/" prefix)
 */
export async function getOpenLibraryWorkDetail(
  workKey: string,
  env?: Record<string, string | undefined>,
): Promise<OpenLibraryClientResult<OpenLibraryWorkDetail>> {
  const guard = evaluateOpenLibraryGuard(env);

  const id = (workKey ?? "").trim().replace(/^\/works\//, "");
  if (id.length === 0) {
    return {
      success: false,
      data: null,
      error: "OL_INVALID_WORK_KEY: work key must not be empty",
      guardBlocked: false,
      guard,
    };
  }

  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Book API blocked by guard",
      guardBlocked: true,
      guard,
    };
  }

  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/works/${encodeURIComponent(id)}.json`;

  try {
    const raw = await safeFetchJson(url);

    if (!isRecord(raw)) {
      return {
        success: false,
        data: null,
        error: "OL_UNEXPECTED_RESPONSE: work detail response is not a valid JSON object",
        guardBlocked: false,
        guard,
      };
    }

    return {
      success: true,
      data: {
        key: safeString(raw.key) ?? undefined,
        title: safeString(raw.title) ?? undefined,
        description: safeDescription(raw.description),
        subjects: Array.isArray(raw.subjects) ? raw.subjects : undefined,
        covers: Array.isArray(raw.covers) ? raw.covers : undefined,
        authors: Array.isArray(raw.authors) ? raw.authors : undefined,
        first_publish_date: safeString(raw.first_publish_date) ?? undefined,
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
// Public API: Edition Detail
// ---------------------------------------------------------------------------

/**
 * Get detailed information about an Open Library edition.
 *
 * @param editionKey — e.g. "OL123M" (with or without "/books/" prefix)
 */
export async function getOpenLibraryEditionDetail(
  editionKey: string,
  env?: Record<string, string | undefined>,
): Promise<OpenLibraryClientResult<OpenLibraryEditionDetail>> {
  const guard = evaluateOpenLibraryGuard(env);

  const id = (editionKey ?? "").trim().replace(/^\/books\//, "");
  if (id.length === 0) {
    return {
      success: false,
      data: null,
      error: "OL_INVALID_EDITION_KEY: edition key must not be empty",
      guardBlocked: false,
      guard,
    };
  }

  if (!guard.allowed) {
    return {
      success: false,
      data: null,
      error: guard.blockedReason ?? "Book API blocked by guard",
      guardBlocked: true,
      guard,
    };
  }

  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/books/${encodeURIComponent(id)}.json`;

  try {
    const raw = await safeFetchJson(url);

    if (!isRecord(raw)) {
      return {
        success: false,
        data: null,
        error: "OL_UNEXPECTED_RESPONSE: edition detail response is not a valid JSON object",
        guardBlocked: false,
        guard,
      };
    }

    return {
      success: true,
      data: {
        key: safeString(raw.key) ?? undefined,
        title: safeString(raw.title) ?? undefined,
        authors: Array.isArray(raw.authors) ? raw.authors : undefined,
        publish_date: safeString(raw.publish_date) ?? undefined,
        publishers: Array.isArray(raw.publishers) ? raw.publishers : undefined,
        isbn_10: Array.isArray(raw.isbn_10) ? raw.isbn_10 : undefined,
        isbn_13: Array.isArray(raw.isbn_13) ? raw.isbn_13 : undefined,
        covers: Array.isArray(raw.covers) ? raw.covers : undefined,
        languages: Array.isArray(raw.languages) ? raw.languages : undefined,
        subjects: Array.isArray(raw.subjects) ? raw.subjects : undefined,
        description: safeDescription(raw.description),
        works: Array.isArray(raw.works) ? raw.works : undefined,
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

function safeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function safeDescription(value: unknown): OpenLibraryWorkDetail["description"] {
  if (typeof value === "string") {
    return value;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const type = safeString(value.type);
  const descriptionValue = safeString(value.value);
  if (!type || !descriptionValue) {
    return undefined;
  }
  return { type, value: descriptionValue };
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}
