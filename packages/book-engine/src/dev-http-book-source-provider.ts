/**
 * Dev-only HTTP Book Source Provider.
 *
 * A BookSourceProvider implementation that can call an external book API
 * over HTTP — but ONLY when multiple guard conditions are explicitly met.
 *
 * DEFAULT: All real HTTP calls are DISABLED. The provider returns blocked
 * metadata and empty results unless all guard env vars are set.
 *
 * GUARD conditions (ALL must be satisfied):
 *   1. LAP_BOOK_API_DEV_ENABLED === "1" or "true"
 *   2. LAP_ALLOW_EXTERNAL_BOOK_API === "1" or "true"
 *   3. LAP_BOOK_API_BASE_URL is set and non-empty
 *
 * When guards are blocked:
 *   - No fetch call is made
 *   - Returns { books: [], totalResults: 0 } with blocked safety metadata
 *   - fallbackSource = "empty"
 *
 * When guards pass:
 *   - Uses injected fetch function (real or fake for testing)
 *   - Calls GET {baseUrl}/search?q={query}&maxResults={n}&lang={lang}
 *   - Calls GET {baseUrl}/books/{externalBookId}
 *   - Normalizes response into safe fields only
 *   - Never stores raw response
 *   - Timeout enforced via AbortController
 *
 * Error handling:
 *   - Network errors → safe error metadata, empty results
 *   - Non-JSON responses → safe error metadata
 *   - Missing/extra fields → ignored, only known fields extracted
 *   - Timeout → safe error metadata
 *
 * DESIGNATION: 开发预览 — 外部书籍 API 默认关闭，未调用 LLM，未写 DB，
 *              未保存原始响应，仅展示 normalized metadata。
 *
 * @module dev-http-book-source-provider
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

// ---------------------------------------------------------------------------
// Process-level cached reads
// ---------------------------------------------------------------------------

let cachedBookApiDevEnabled: boolean | null = null;
let cachedAllowExternalBookApi: boolean | null = null;
let cachedBookApiBaseUrl: string | null | undefined = undefined;

function readBookApiDevEnabled(): boolean {
  if (cachedBookApiDevEnabled !== null) return cachedBookApiDevEnabled;
  try {
    const value = process.env[ENV_BOOK_API_DEV_ENABLED];
    cachedBookApiDevEnabled = value === "1" || value === "true";
  } catch {
    cachedBookApiDevEnabled = false;
  }
  return cachedBookApiDevEnabled;
}

function readAllowExternalBookApi(): boolean {
  if (cachedAllowExternalBookApi !== null) return cachedAllowExternalBookApi;
  try {
    const value = process.env[ENV_ALLOW_EXTERNAL_BOOK_API];
    cachedAllowExternalBookApi = value === "1" || value === "true";
  } catch {
    cachedAllowExternalBookApi = false;
  }
  return cachedAllowExternalBookApi;
}

function readBookApiBaseUrl(): string | null {
  if (cachedBookApiBaseUrl !== undefined) return cachedBookApiBaseUrl;
  try {
    const value = process.env[ENV_BOOK_API_BASE_URL];
    cachedBookApiBaseUrl = value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    cachedBookApiBaseUrl = null;
  }
  return cachedBookApiBaseUrl;
}

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
// Provider implementation
// ---------------------------------------------------------------------------

export interface DevHttpBookSourceProviderOptions {
  /** Injectable fetch function (real or fake). Defaults to global fetch. */
  fetch?: SafeFetch;
  /** Request timeout in milliseconds. Defaults to 10s. */
  timeoutMs?: number;
  /** Override env reads for testing. */
  env?: {
    bookApiDevEnabled?: boolean;
    allowExternalBookApi?: boolean;
    bookApiBaseUrl?: string | null;
  };
}

export class DevHttpBookSourceProvider implements BookSourceProvider {
  readonly providerId = "dev-http";
  readonly #fetch: SafeFetch;
  readonly #timeoutMs: number;
  readonly #env: {
    bookApiDevEnabled: boolean;
    allowExternalBookApi: boolean;
    bookApiBaseUrl: string | null;
  };

  constructor(options: DevHttpBookSourceProviderOptions = {}) {
    this.#fetch = options.fetch ?? (globalThis as unknown as { fetch: SafeFetch }).fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (options.env) {
      this.#env = {
        bookApiDevEnabled: options.env.bookApiDevEnabled ?? false,
        allowExternalBookApi: options.env.allowExternalBookApi ?? false,
        bookApiBaseUrl: options.env.bookApiBaseUrl ?? null,
      };
    } else {
      this.#env = {
        bookApiDevEnabled: readBookApiDevEnabled(),
        allowExternalBookApi: readAllowExternalBookApi(),
        bookApiBaseUrl: readBookApiBaseUrl(),
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

    const baseUrl = this.#env.bookApiBaseUrl!;
    const maxResults = params.maxResults ?? 10;
    const langParam = params.language ? `&lang=${encodeURIComponent(params.language)}` : "";
    const url = `${baseUrl}/search?q=${encodeURIComponent(params.query)}&maxResults=${maxResults}${langParam}`;

    try {
      const data = await this.#safeFetchJson(url);
      const normalized = this.#normalizeSearchResponse(data, params.query);

      return {
        books: normalized,
        totalResults: normalized.length,
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

    const baseUrl = this.#env.bookApiBaseUrl!;
    const url = `${baseUrl}/books/${encodeURIComponent(externalBookId)}`;

    try {
      const data = await this.#safeFetchJson(url);
      const book = this.#normalizeBookDetail(data);

      return {
        book,
        chapterPreviews: this.#extractChapterPreviews(data),
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

    if (!this.#env.bookApiBaseUrl) {
      blockedReasons.push(
        "BOOK_API_BASE_URL_NOT_SET: LAP_BOOK_API_BASE_URL 未配置。无法确定外部书籍 API 地址。",
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
        throw error; // re-throw our own HTTP errors as-is
      }
      // Wrap network/unknown errors
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Book API request failed: ${truncateForError(message)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -----------------------------------------------------------------------
  // Internal: response normalization
  // -----------------------------------------------------------------------

  /**
   * Normalize a search response from the external API.
   * Only extracts known safe fields. Extra/unknown fields are ignored.
   * Raw response is NOT stored — only the normalized result is returned.
   */
  #normalizeSearchResponse(data: unknown, query: string): NormalizedBookMetadata[] {
    if (!isRecord(data)) return [];

    const items = Array.isArray(data.items) ? data.items : Array.isArray(data.books) ? data.books : Array.isArray(data.results) ? data.results : [];

    return items.slice(0, 20).map((item) => this.#normalizeSingleBook(item));
  }

  /**
   * Normalize a book detail response.
   */
  #normalizeBookDetail(data: unknown): NormalizedBookMetadata | null {
    if (!isRecord(data)) return null;

    // Support both wrapped { book: {...} } and raw book object
    const bookData = isRecord(data.book) ? data.book : data;
    if (!isRecord(bookData)) return null;

    return this.#normalizeSingleBook(bookData);
  }

  /**
   * Normalize a single book entry to safe fields.
   */
  #normalizeSingleBook(item: unknown): NormalizedBookMetadata {
    if (!isRecord(item)) {
      return this.#emptyBookMetadata("unknown");
    }

    const id = safeString(item.id) || safeString(item.externalId) || safeString(item.bookId) || "unknown";
    const title = safeString(item.title) || safeString(item.name) || "未知书名";
    const authors = extractAuthors(item);
    const description = safeString(item.description) || safeString(item.summary) || safeString(item.desc) || "";
    const language = safeString(item.language) || safeString(item.lang) || "unknown";
    const sourceUrl = safeString(item.sourceUrl) || safeString(item.url) || safeString(item.infoLink) || "";
    const licenseHint = safeString(item.license) || safeString(item.rights) || "unknown";
    const coverImageUrl = safeString(item.coverImageUrl) || safeString(item.coverUrl) || safeString(item.thumbnail) || "";

    return {
      providerId: this.providerId,
      externalBookId: id,
      title: truncateSafe(title, 500),
      authors: authors.map((a) => truncateSafe(a, 200)),
      description: truncateSafe(description, 2000),
      language: truncateSafe(language, 10),
      sourceUrl: truncateSafe(sourceUrl, 2000),
      licenseHint: truncateSafe(licenseHint, 100),
      coverImageUrl: truncateSafe(coverImageUrl, 2000),
      chapterPreviewCount: 0,
      importable: false,
      safety: createPassedSafetyMetadata(this.providerId),
    };
  }

  /**
   * Extract chapter previews from a book detail response.
   * Only extracts title/order metadata — no body content.
   */
  #extractChapterPreviews(_data: unknown): NormalizedChapterPreview[] {
    // This round does NOT extract chapter content.
    // Future rounds may expand this to extract TOC metadata.
    return [];
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
 * Create a DevHttpBookSourceProvider with default settings.
 * Uses real process.env and global fetch.
 */
export function createDevHttpBookSourceProvider(
  options?: DevHttpBookSourceProviderOptions,
): DevHttpBookSourceProvider {
  return new DevHttpBookSourceProvider(options);
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

function extractAuthors(item: Record<string, unknown>): string[] {
  const authors = item.authors ?? item.author;

  if (Array.isArray(authors)) {
    return authors.map((a) => (typeof a === "string" ? a : safeString(a?.name) ?? String(a))).filter((a) => a.length > 0);
  }

  if (typeof authors === "string" && authors.trim().length > 0) {
    return authors.split(/[,;，；、]/).map((a) => a.trim()).filter((a) => a.length > 0);
  }

  return [];
}

/**
 * Safe truncation — prevents overly long strings from leaking into metadata.
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
