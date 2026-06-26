/**
 * Book API Preview Service.
 *
 * Provides a server-side/service-side boundary for querying external book
 * APIs through the BookSourceProvider contract. This service wraps the
 * provider and returns a safe preview view model suitable for the import UI.
 *
 * DEFAULT: External book API is disabled. Returns a disabled preview with
 * fallback suggestions (built-in books) when guards are blocked.
 *
 * DESIGNATION: dev preview — external book API disabled by default,
 *               no LLM calls, no DB writes, no raw response storage.
 *
 * @module book-api-preview
 * @previewOnly — all results are dev-only previews
 */

import type {
  BookSearchResult,
  BookSourceProvider,
} from "@learning-agent-platform/book-engine";

// ---------------------------------------------------------------------------
// View model types
// ---------------------------------------------------------------------------

export interface BookApiPreviewViewModel {
  /** Query that produced this preview (or intended query). */
  query: string;

  /** Whether the external book API was actually queried. */
  externalApiQueried: boolean;

  /** Whether the preview is blocked (guards not met). */
  apiBlocked: boolean;

  /** Human-readable blocked reasons, empty when unblocked. */
  blockedReasons: string[];

  /** Normalized book results (empty if blocked or no results). */
  books: BookApiPreviewBookViewModel[];

  /** Total results from the provider (0 if blocked). */
  totalResults: number;

  /** Fallback suggestions when API is blocked. */
  fallbackSuggestions: string[];

  /** Safety metadata for the client. */
  productionReady: false;
  llmUsed: false;
  writesDatabase: false;
  rawResponseStored: false;
  safeToExposeToClient: true;
}

export interface BookApiPreviewBookViewModel {
  /** Provider identifier used for local draft keys. */
  providerId: string;

  /** External book ID (provider-specific). */
  externalBookId: string;

  /** Book title. */
  title: string;

  /** Authors. */
  authors: string[];

  /** Short description. */
  description: string;

  /** Language code. */
  language: string;

  /** License hint. */
  licenseHint: string;

  /** Source URL for attribution/import preview. */
  sourceUrl: string;

  /** Cover image URL (may be empty). */
  coverImageUrl: string;

  /** Always false in this phase. */
  importable: false;
}

// ---------------------------------------------------------------------------
// Fallback suggestions
// ---------------------------------------------------------------------------

const BUILTIN_FALLBACK_SUGGESTIONS = [
  "使用项目内置示例书籍（Python 基础入门、JavaScript 异步编程、算法与数据结构）",
  "通过「文本导入」粘贴纯文本内容并生成规则式预览",
  "外部书籍 API 默认关闭，需配置环境变量后启用",
];

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export interface PreviewBookApiSearchInput {
  query: string;
  maxResults?: number;
  language?: string;
}

/**
 * Query books from the configured Book Source Provider and return a safe
 * preview view model. When the provider is blocked, returns a disabled
 * preview with fallback suggestions.
 *
 * This is the main entry point for the import/book API preview flow.
 */
export async function previewBookApiSearch(
  provider: BookSourceProvider,
  input: PreviewBookApiSearchInput,
  _context?: {
    providerMode: string;
    blockedReason: string | null;
    missingEnvNames: string[];
  },
): Promise<BookApiPreviewViewModel> {
  const guardStatus = provider.getGuardStatus();

  if (guardStatus.guardBlocked) {
    return createBlockedPreview(input.query, guardStatus.blockedReasons);
  }

  try {
    const result: BookSearchResult = await provider.searchBooks({
      query: input.query,
      maxResults: input.maxResults,
      language: input.language,
    });

    return mapSearchResultToViewModel(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorPreview(input.query, message);
  }
}

// ---------------------------------------------------------------------------
// Internal mappers
// ---------------------------------------------------------------------------

function mapSearchResultToViewModel(
  result: BookSearchResult,
): BookApiPreviewViewModel {
  return {
    query: result.query,
    externalApiQueried: true,
    apiBlocked: false,
    blockedReasons: [],
    books: result.books.map(mapBookToViewModel),
    totalResults: result.totalResults,
    fallbackSuggestions: result.books.length === 0 ? BUILTIN_FALLBACK_SUGGESTIONS : [],
    productionReady: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
  };
}

function mapBookToViewModel(
  book: {
    providerId?: string;
    externalBookId: string;
    title: string;
    authors: string[];
    description: string;
    language: string;
    sourceUrl?: string;
    licenseHint: string;
    coverImageUrl: string;
  },
): BookApiPreviewBookViewModel {
  return {
    providerId: book.providerId ?? "unknown",
    externalBookId: book.externalBookId,
    title: book.title,
    authors: book.authors,
    description: book.description,
    language: book.language,
    licenseHint: book.licenseHint,
    sourceUrl: book.sourceUrl ?? "",
    coverImageUrl: book.coverImageUrl,
    importable: false,
  };
}

function createBlockedPreview(
  query: string,
  blockedReasons: string[],
): BookApiPreviewViewModel {
  return {
    query,
    externalApiQueried: false,
    apiBlocked: true,
    blockedReasons,
    books: [],
    totalResults: 0,
    fallbackSuggestions: BUILTIN_FALLBACK_SUGGESTIONS,
    productionReady: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
  };
}

function createErrorPreview(
  query: string,
  errorMessage: string,
): BookApiPreviewViewModel {
  return {
    query,
    externalApiQueried: false,
    apiBlocked: true,
    blockedReasons: ["BOOK_API_PREVIEW_ERROR: " + truncateError(errorMessage)],
    books: [],
    totalResults: 0,
    fallbackSuggestions: BUILTIN_FALLBACK_SUGGESTIONS,
    productionReady: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
  };
}

function truncateError(message: string): string {
  var cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 150) return cleaned;
  return cleaned.slice(0, 147) + "...";
}
