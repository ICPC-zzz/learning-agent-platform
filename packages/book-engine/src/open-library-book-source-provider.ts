/**
 * Open Library dev-only Book Source Provider.
 *
 * A concrete BookSourceProvider that maps Open Library API responses into
 * NormalizedBookMetadata. Uses the same guard stack as DevHttpBookSourceProvider
 * plus an additional provider-selection guard (LAP_BOOK_API_PROVIDER).
 *
 * DEFAULT: All real HTTP calls are DISABLED. The provider returns blocked
 * metadata and empty results unless all guard conditions are explicitly met.
 *
 * GUARD conditions (ALL must be satisfied):
 *   1. LAP_BOOK_API_DEV_ENABLED === "1" or "true"
 *   2. LAP_ALLOW_EXTERNAL_BOOK_API === "1" or "true"
 *   3. LAP_BOOK_API_BASE_URL is set and non-empty (defaults to https://openlibrary.org)
 *   4. LAP_BOOK_API_PROVIDER === "open-library" or injected providerId matches
 *
 * When guards are blocked:
 *   - No fetch call is made
 *   - Returns { books: [], totalResults: 0 } with blocked safety metadata
 *
 * DESIGNATION: 开发预览 — Open Library dev-only adapter，外部书籍 API 默认关闭，
 *              未调用 LLM，未写 DB，未保存原始响应，仅展示 normalized metadata。
 *              productionReady=false，不可用于生产环境。
 *
 * Open Library API mapping:
 *   search: GET https://openlibrary.org/search.json?q={query}&limit={maxResults}
 *   detail: GET https://openlibrary.org/works/{id}.json
 *
 * @module open-library-book-source-provider
 * @previewOnly — dev-only adapter, not for production use
 */

import type {
  BookDetailResult,
  BookSearchParams,
  BookSearchResult,
  BookSourceProvider,
  BookSourceProviderSafetyMetadata,
  NormalizedBookMetadata,
  NormalizedChapterPreview,
} from "./book-source-provider.ts";
import {
  createBlockedSafetyMetadata,
  createEmptyDetailResult,
  createEmptySearchResult,
  createErrorSafetyMetadata,
  createPassedSafetyMetadata,
} from "./book-source-provider.ts";

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_BOOK_API_DEV_ENABLED = "LAP_BOOK_API_DEV_ENABLED";
const ENV_ALLOW_EXTERNAL_BOOK_API = "LAP_ALLOW_EXTERNAL_BOOK_API";
const ENV_BOOK_API_BASE_URL = "LAP_BOOK_API_BASE_URL";
const ENV_BOOK_API_PROVIDER = "LAP_BOOK_API_PROVIDER";

// ---------------------------------------------------------------------------
// Default base URL (only usable when all guards pass)
// ---------------------------------------------------------------------------

const DEFAULT_OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";

// ---------------------------------------------------------------------------
// Fetch type — allows injection of fake fetch for testing
// ---------------------------------------------------------------------------

export type SafeFetch = (
  url: string | URL,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

// ---------------------------------------------------------------------------
// Default timeout (ms)
// ---------------------------------------------------------------------------

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Options for creating the provider
// ---------------------------------------------------------------------------

export interface OpenLibraryBookSourceProviderOptions {
  /** Injectable fetch function (real or fake). Defaults to global fetch. */
  fetch?: SafeFetch;
  /** Request timeout in milliseconds. Defaults to 10s. */
  timeoutMs?: number;
  /** Override env reads for testing. */
  env?: {
    bookApiDevEnabled?: boolean;
    allowExternalBookApi?: boolean;
    bookApiBaseUrl?: string | null;
    bookApiProvider?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class OpenLibraryBookSourceProvider implements BookSourceProvider {
  readonly providerId = "open-library-dev";
  readonly #fetch: SafeFetch;
  readonly #timeoutMs: number;
  readonly #env: {
    bookApiDevEnabled: boolean;
    allowExternalBookApi: boolean;
    bookApiBaseUrl: string | null;
    bookApiProvider: string | null;
  };

  constructor(options: OpenLibraryBookSourceProviderOptions = {}) {
    this.#fetch = options.fetch ?? (globalThis as unknown as { fetch: SafeFetch }).fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (options.env) {
      this.#env = {
        bookApiDevEnabled: options.env.bookApiDevEnabled ?? false,
        allowExternalBookApi: options.env.allowExternalBookApi ?? false,
        bookApiBaseUrl: options.env.bookApiBaseUrl ?? null,
        bookApiProvider: options.env.bookApiProvider ?? null,
      };
    } else {
      this.#env = {
        bookApiDevEnabled: readEnvBool(ENV_BOOK_API_DEV_ENABLED),
        allowExternalBookApi: readEnvBool(ENV_ALLOW_EXTERNAL_BOOK_API),
        bookApiBaseUrl: readEnvString(ENV_BOOK_API_BASE_URL),
        bookApiProvider: readEnvString(ENV_BOOK_API_PROVIDER),
      };
    }
  }

  // -----------------------------------------------------------------------
  // BookSourceProvider interface
  // -----------------------------------------------------------------------

  get isRealApiEnabled(): boolean {
    return this.#evaluateGuard().guardBlocked === false;
  }

  getGuardStatus(): BookSourceProviderSafetyMetadata {
    return this.#evaluateGuard();
  }

  async searchBooks(params: BookSearchParams): Promise<BookSearchResult> {
    const guard = this.#evaluateGuard();

    if (guard.guardBlocked) {
      return createEmptySearchResult(this.providerId, params.query, guard);
    }

    const baseUrl = this.#env.bookApiBaseUrl || DEFAULT_OPEN_LIBRARY_BASE_URL;
    const maxResults = params.maxResults ?? 10;
    const langParam = params.language ? `&language=${encodeURIComponent(params.language)}` : "";
    const url = `${baseUrl}/search.json?q=${encodeURIComponent(params.query)}&limit=${maxResults}${langParam}`;

    try {
      const data = await this.#safeFetchJson(url);
      const normalized = this.#normalizeSearchResponse(data, params.query);

      return {
        books: normalized,
        totalResults: this.#extractTotalResults(data),
        query: params.query,
        safety: createPassedSafetyMetadata(this.providerId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const safety = createErrorSafetyMetadata(this.providerId, message, "empty");
      return createEmptySearchResult(this.providerId, params.query, safety);
    }
  }

  async getBookDetail(externalBookId: string): Promise<BookDetailResult> {
    const guard = this.#evaluateGuard();

    if (guard.guardBlocked) {
      return createEmptyDetailResult(guard);
    }

    const baseUrl = this.#env.bookApiBaseUrl || DEFAULT_OPEN_LIBRARY_BASE_URL;

    // Accept both "OL123W" and "/works/OL123W" formats
    const workId = externalBookId.startsWith("/works/")
      ? externalBookId.slice("/works/".length)
      : externalBookId;

    const url = `${baseUrl}/works/${encodeURIComponent(workId)}.json`;

    try {
      const data = await this.#safeFetchJson(url);
      const book = this.#normalizeWorkDetail(data);

      return {
        book,
        chapterPreviews: [],
        safety: createPassedSafetyMetadata(this.providerId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const safety = createErrorSafetyMetadata(this.providerId, message, "empty");
      return createEmptyDetailResult(safety);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: guard evaluation
  // -----------------------------------------------------------------------

  #evaluateGuard(): BookSourceProviderSafetyMetadata {
    const blockedReasons: string[] = [];

    if (!this.#env.bookApiDevEnabled) {
      blockedReasons.push(
        "BOOK_API_DEV_NOT_ENABLED: LAP_BOOK_API_DEV_ENABLED 未设置为 1 或 true。外部书籍 API 默认关闭。",
      );
    }

    if (!this.#env.allowExternalBookApi) {
      blockedReasons.push(
        "EXTERNAL_BOOK_API_NOT_ALLOWED: LAP_ALLOW_EXTERNAL_BOOK_API 未设置为 1 或 true。项目全局外部书籍 API 门控未通过。",
      );
    }

    // Base URL: must be explicitly set (we check the env override, not the
    // default). The default is only used after guard passes.
    if (!this.#env.bookApiBaseUrl || this.#env.bookApiBaseUrl.trim().length === 0) {
      blockedReasons.push(
        "BOOK_API_BASE_URL_NOT_SET: LAP_BOOK_API_BASE_URL 未配置。无法确定 Open Library API 地址。",
      );
    }

    // Provider selection guard
    if (!this.#env.bookApiProvider) {
      blockedReasons.push(
        "BOOK_API_PROVIDER_NOT_SET: LAP_BOOK_API_PROVIDER 未设置为 open-library。未选择 Open Library 书源提供者。",
      );
    } else if (!this.#env.bookApiProvider.split(",").map((s) => s.trim()).includes("open-library")) {
      blockedReasons.push(
        "BOOK_API_PROVIDER_MISMATCH: LAP_BOOK_API_PROVIDER 未包含 open-library。当前书源提供者选择不匹配。",
      );
    }

    if (blockedReasons.length > 0) {
      return createBlockedSafetyMetadata(this.providerId, blockedReasons, "empty");
    }

    return createPassedSafetyMetadata(this.providerId);
  }

  // -----------------------------------------------------------------------
  // Internal: safe fetch with timeout
  // -----------------------------------------------------------------------

  async #safeFetchJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: upstream book API returned non-OK status`);
      }

      const data = await response.json();

      if (data === null || data === undefined) {
        throw new Error("Upstream book API returned null/undefined body");
      }

      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`Request timed out after ${this.#timeoutMs}ms`);
      }
      if (error instanceof Error && error.message.startsWith("HTTP ")) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Book API request failed: ${truncateForError(message)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: Open Library search response normalization
  // -----------------------------------------------------------------------

  /**
   * Normalize Open Library search.json response.
   * Open Library format: { numFound: N, docs: [{ key, title, author_name, ... }] }
   */
  #normalizeSearchResponse(data: unknown, _query: string): NormalizedBookMetadata[] {
    if (!isRecord(data)) return [];

    const docs = Array.isArray(data.docs) ? data.docs : [];
    return docs.slice(0, 20).map((doc) => this.#normalizeSearchDoc(doc));
  }

  #extractTotalResults(data: unknown): number {
    if (!isRecord(data)) return 0;
    const numFound = data.numFound;
    if (typeof numFound === "number" && Number.isFinite(numFound) && numFound >= 0) {
      return numFound;
    }
    const numFoundExact = data.num_found ?? data.numFoundExact ?? data.total;
    if (typeof numFoundExact === "number" && Number.isFinite(numFoundExact) && numFoundExact >= 0) {
      return numFoundExact;
    }
    return 0;
  }

  /**
   * Normalize a single Open Library search doc entry.
   * Open Library doc fields: key, title, author_name, first_publish_year,
   * language, cover_i, subject, ...
   */
  #normalizeSearchDoc(doc: unknown): NormalizedBookMetadata {
    if (!isRecord(doc)) {
      return this.#emptyBookMetadata("unknown");
    }

    const key = safeString(doc.key) || "unknown";
    const externalBookId = key.startsWith("/works/") ? key.slice("/works/".length) : key;
    const title = safeString(doc.title) || "未知书名";
    const authors = extractAuthorsFromDoc(doc);
    const description = safeString(doc.first_sentence) || safeString(doc.subtitle) || "";
    const language = normalizeOpenLibraryLanguage(doc.language);
    const sourceUrl = `https://openlibrary.org${key}`;
    const licenseHint = "unknown";
    const coverImageUrl = buildOpenLibraryCoverUrl(doc.cover_i);
    const chapterPreviewCount = 0;

    return {
      providerId: this.providerId,
      externalBookId,
      title: truncateSafe(title, 500),
      authors: authors.map((a) => truncateSafe(a, 200)),
      description: truncateSafe(description, 2000),
      language: truncateSafe(language, 10),
      sourceUrl: truncateSafe(sourceUrl, 2000),
      licenseHint: truncateSafe(licenseHint, 100),
      coverImageUrl: truncateSafe(coverImageUrl, 2000),
      chapterPreviewCount,
      importable: false,
      safety: createPassedSafetyMetadata(this.providerId),
    };
  }

  // -----------------------------------------------------------------------
  // Internal: Open Library work detail normalization
  // -----------------------------------------------------------------------

  /**
   * Normalize Open Library work detail response (works/{id}.json).
   * Open Library format: { key, title, authors, description, covers, subjects, ... }
   */
  #normalizeWorkDetail(data: unknown): NormalizedBookMetadata | null {
    if (!isRecord(data)) return null;

    const key = safeString(data.key) || "unknown";
    const externalBookId = key.startsWith("/works/") ? key.slice("/works/".length) : key;
    const title = safeString(data.title) || "未知书名";
    const authors = extractAuthorsFromWork(data);
    const description = normalizeDescription(data.description);
    const language = "unknown"; // Work endpoint doesn't always include language
    const sourceUrl = `https://openlibrary.org${key}`;
    const licenseHint = "unknown";
    const coverImageUrl = buildOpenLibraryCoverUrlFromCovers(data.covers);
    const chapterPreviewCount = 0;

    return {
      providerId: this.providerId,
      externalBookId,
      title: truncateSafe(title, 500),
      authors: authors.map((a) => truncateSafe(a, 200)),
      description: truncateSafe(description, 2000),
      language: truncateSafe(language, 10),
      sourceUrl: truncateSafe(sourceUrl, 2000),
      licenseHint: truncateSafe(licenseHint, 100),
      coverImageUrl: truncateSafe(coverImageUrl, 2000),
      chapterPreviewCount,
      importable: false,
      safety: createPassedSafetyMetadata(this.providerId),
    };
  }

  /**
   * Create an empty book metadata entry for parsing failures.
   */
  #emptyBookMetadata(externalBookId: string): NormalizedBookMetadata {
    return {
      providerId: this.providerId,
      externalBookId,
      title: "未知书名",
      authors: [],
      description: "",
      language: "unknown",
      sourceUrl: "",
      licenseHint: "unknown",
      coverImageUrl: "",
      chapterPreviewCount: 0,
      importable: false,
      safety: createPassedSafetyMetadata(this.providerId),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create an OpenLibraryBookSourceProvider with default settings.
 * Uses real process.env and global fetch when not overridden.
 */
export function createOpenLibraryBookSourceProvider(
  options?: OpenLibraryBookSourceProviderOptions,
): OpenLibraryBookSourceProvider {
  return new OpenLibraryBookSourceProvider(options);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readEnvBool(key: string): boolean {
  try {
    const value = process.env[key];
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function readEnvString(key: string): string | null {
  try {
    const value = process.env[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Open Library-specific normalization helpers
// ---------------------------------------------------------------------------

/**
 * Extract authors from Open Library search doc.
 * Open Library: author_name is a string[].
 */
function extractAuthorsFromDoc(doc: Record<string, unknown>): string[] {
  const authorName = doc.author_name;
  if (Array.isArray(authorName)) {
    return authorName
      .map((a) => (typeof a === "string" ? a.trim() : safeString(a)))
      .filter((a): a is string => a !== null && a.length > 0);
  }
  if (typeof authorName === "string" && authorName.trim().length > 0) {
    return [authorName.trim()];
  }
  return [];
}

/**
 * Extract authors from Open Library work detail.
 * Open Library: authors is [{ author: { key } }, ...] or [{ key, name }, ...].
 */
function extractAuthorsFromWork(data: Record<string, unknown>): string[] {
  const authors = data.authors;

  if (Array.isArray(authors)) {
    return authors
      .map((entry) => {
        if (!isRecord(entry)) return null;
        // Open Library work format: { author: { key: "/authors/OL123A" } }
        // Search doc format: { key: "/authors/OL123A", name: "Author Name" }
        if (isRecord(entry.author)) {
          return safeString(entry.author.name) || extractAuthorNameFromKey(safeString(entry.author.key));
        }
        return safeString(entry.name) || extractAuthorNameFromKey(safeString(entry.key));
      })
      .filter((a): a is string => a !== null && a.length > 0);
  }

  return [];
}

/**
 * Extract a human-readable author name from an Open Library author key.
 * For example, "/authors/OL123A" → "OL123A". This is a fallback; the
 * name field should be preferred when available.
 */
function extractAuthorNameFromKey(key: string | null): string | null {
  if (key === null) return null;
  const parts = key.split("/");
  return parts[parts.length - 1] || null;
}

/**
 * Normalize Open Library language field.
 * Open Library: language is string[] (e.g., ["eng", "spa"]) or single string.
 */
function normalizeOpenLibraryLanguage(lang: unknown): string {
  if (Array.isArray(lang) && lang.length > 0) {
    const first = lang[0];
    if (typeof first === "string") return first.trim().substring(0, 10);
  }
  if (typeof lang === "string" && lang.trim().length > 0) {
    return lang.trim().substring(0, 10);
  }
  return "unknown";
}

/**
 * Normalize description field from Open Library.
 * Open Library: description can be a string or { type: "/type/text", value: "..." }.
 */
function normalizeDescription(desc: unknown): string {
  if (typeof desc === "string") return desc;
  if (isRecord(desc) && typeof desc.value === "string") return desc.value;
  return "";
}

/**
 * Build a cover image URL from an Open Library cover_i integer.
 * Format: https://covers.openlibrary.org/b/id/{cover_i}-M.jpg
 */
function buildOpenLibraryCoverUrl(coverI: unknown): string {
  if (typeof coverI === "number" && Number.isFinite(coverI) && coverI > 0) {
    return `https://covers.openlibrary.org/b/id/${coverI}-M.jpg`;
  }
  return "";
}

/**
 * Build a cover image URL from Open Library work covers array.
 * Open Library: covers is number[] (cover IDs).
 */
function buildOpenLibraryCoverUrlFromCovers(covers: unknown): string {
  if (Array.isArray(covers) && covers.length > 0) {
    const first = covers[0];
    if (typeof first === "number" && Number.isFinite(first) && first > 0) {
      return `https://covers.openlibrary.org/b/id/${first}-M.jpg`;
    }
  }
  return "";
}

/**
 * Truncate a string to a maximum length.
 */
function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function truncateForError(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 150) return cleaned;
  return cleaned.slice(0, 147) + "...";
}
