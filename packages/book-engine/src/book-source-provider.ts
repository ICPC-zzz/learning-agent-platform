/**
 * Book Source Provider contract.
 *
 * Defines the abstraction layer for fetching book metadata and chapter
 * previews from external book/content APIs. All providers MUST implement
 * this interface and return normalized, safe-to-expose metadata.
 */

export interface BookSourceProviderSafetyMetadata {
  providerId: string;
  productionReady: false;
  externalApiUsed: boolean;
  llmUsed: false;
  writesDatabase: false;
  rawResponseStored: false;
  safeToExposeToClient: true;
  guardBlocked: boolean;
  blockedReasons: string[];
  fallbackSource: "builtin" | "empty" | "none";
}

export interface BookSearchParams {
  query: string;
  maxResults?: number;
  language?: string;
}

export interface NormalizedBookMetadata {
  providerId: string;
  externalBookId: string;
  title: string;
  authors: string[];
  description: string;
  language: string;
  sourceUrl: string;
  licenseHint: string;
  coverImageUrl: string;
  chapterPreviewCount: number;
  importable: false;
  safety: BookSourceProviderSafetyMetadata;
}

export interface NormalizedChapterPreview {
  externalChapterId: string;
  title: string;
  orderIndex: number;
  estimatedCharCount: number;
  bodyAvailable: false;
}

export interface BookSearchResult {
  books: NormalizedBookMetadata[];
  totalResults: number;
  query: string;
  safety: BookSourceProviderSafetyMetadata;
}

export interface BookDetailResult {
  book: NormalizedBookMetadata | null;
  chapterPreviews: NormalizedChapterPreview[];
  safety: BookSourceProviderSafetyMetadata;
}

export interface BookSourceProvider {
  readonly providerId: string;
  readonly isRealApiEnabled: boolean;
  searchBooks(params: BookSearchParams): Promise<BookSearchResult>;
  getBookDetail(externalBookId: string): Promise<BookDetailResult>;
  getGuardStatus(): BookSourceProviderSafetyMetadata;
}

export function createBlockedSafetyMetadata(
  providerId, blockedReasons, fallbackSource
) {
  if (fallbackSource === void 0) { fallbackSource = "empty"; }
  return {
    providerId: providerId,
    productionReady: false,
    externalApiUsed: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    guardBlocked: true,
    blockedReasons: blockedReasons,
    fallbackSource: fallbackSource,
  };
}

export function createPassedSafetyMetadata(providerId) {
  return {
    providerId: providerId,
    productionReady: false,
    externalApiUsed: true,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    guardBlocked: false,
    blockedReasons: [],
    fallbackSource: "none",
  };
}

export function createErrorSafetyMetadata(
  providerId, errorMessage, fallbackSource
) {
  if (fallbackSource === void 0) { fallbackSource = "empty"; }
  return {
    providerId: providerId,
    productionReady: false,
    externalApiUsed: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    guardBlocked: true,
    blockedReasons: ["PROVIDER_ERROR: " + truncateSafeErrorMessage(errorMessage)],
    fallbackSource: fallbackSource,
  };
}

export function createEmptySearchResult(providerId, query, safety) {
  return {
    books: [],
    totalResults: 0,
    query: query,
    safety: safety,
  };
}

export function createEmptyDetailResult(safety) {
  return {
    book: null,
    chapterPreviews: [],
    safety: safety,
  };
}

function truncateSafeErrorMessage(message) {
  /* Strip URL query strings (may contain tokens) and collapse whitespace */
  var sanitized = stripUrlQueryParams(message);
  var cleaned = sanitized.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 200) { return cleaned; }
  return cleaned.slice(0, 197) + "...";
}

function stripUrlQueryParams(text) {
  var out = "";
  var i = 0;
  while (i < text.length) {
    if (text[i] === "?") {
      out = out + "?...";
      i = i + 1;
      while (i < text.length && text[i] !== " ") {
        i = i + 1;
      }
    } else {
      out = out + text[i];
      i = i + 1;
    }
  }
  return out;
}
