export const bookEnginePackage = "book-engine";

export type * from "./types.js";
export { importPlainTextBook } from "./importers/plain-text.js";
export { normalizePlainText } from "./parsers/text-normalizer.js";
export { detectChapterHeading } from "./chaptering/heading-detector.js";
export { buildChaptersFromPlainText } from "./chaptering/chapter-builder.js";
export { chunkChaptersByCharacters } from "./chunkers/character-chunker.js";

export type SafeFetch = (
  url: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface BookSourceGuardStatus {
  providerId: string;
  productionReady: boolean;
  externalApiUsed: boolean;
  llmUsed: boolean;
  writesDatabase: boolean;
  rawResponseStored: boolean;
  safeToExposeToClient: boolean;
  guardBlocked: boolean;
  blockedReasons: string[];
  fallbackSource: "empty" | "sample";
}

export interface BookSearchResult {
  query: string;
  totalResults: number;
  books: Array<{
    providerId?: string;
    externalBookId: string;
    title: string;
    authors: string[];
    description: string;
    language: string;
    sourceUrl?: string;
    licenseHint: string;
    coverImageUrl: string;
    chapterPreviewCount?: number;
    importable?: false;
    safety?: BookSourceGuardStatus;
  }>;
  safety: BookSourceGuardStatus;
}

export interface BookSourceProvider {
  providerId: string;
  isRealApiEnabled: boolean;
  getGuardStatus(): BookSourceGuardStatus;
  searchBooks(input: {
    query: string;
    maxResults?: number;
    language?: string;
  }): Promise<BookSearchResult>;
  getBookDetail(input: string | {
    externalBookId: string;
  }): Promise<{
    book: BookSearchResult["books"][number] | null;
    chapterPreviews: Array<{
      externalChapterId?: string;
      title: string;
      orderIndex: number;
      preview?: string;
      estimatedCharCount: number;
      bodyAvailable: false;
    }>;
    safety: BookSourceGuardStatus;
  }>;
}

export {
  createImportedBookDraftFromNormalizedBookMetadata,
  createImportedBookDraftFromPreviewBook,
} from "./book-api-import-draft.js";
export type {
  CreateImportedBookDraftOptions,
  ImportedBookDraft,
  ImportedBookDraftChapter,
  ImportedBookDraftSource,
  ImportedBookPreviewDraftInput,
} from "./book-api-import-draft.js";

export function createOpenLibraryBookSourceProvider(input?: {
  timeoutMs?: number;
  fetch?: SafeFetch;
  env?: {
    bookApiDevEnabled?: boolean;
    allowExternalBookApi?: boolean;
    bookApiBaseUrl?: string | null;
    bookApiProvider?: string | null;
  };
}): BookSourceProvider {
  return createBlockedBookSourceProvider(
    "open-library-dev",
    input?.env?.allowExternalBookApi === true,
  );
}

export function createDevHttpBookSourceProvider(input?: {
  providerId?: string;
  enabled?: boolean;
  timeoutMs?: number;
  env?: {
    bookApiDevEnabled?: boolean;
    allowExternalBookApi?: boolean;
    bookApiBaseUrl?: string | null;
  };
}): BookSourceProvider {
  return createBlockedBookSourceProvider(
    input?.providerId ?? "dev-http-book-source",
    input?.enabled === true || input?.env?.allowExternalBookApi === true,
  );
}

function createBlockedBookSourceProvider(
  providerId: string,
  requestedEnabled: boolean,
): BookSourceProvider {
  const guardStatus: BookSourceGuardStatus = {
    providerId,
    productionReady: false,
    externalApiUsed: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    guardBlocked: true,
    blockedReasons: requestedEnabled
      ? ["external_book_api_provider_not_configured"]
      : ["external_book_api_disabled_by_default"],
    fallbackSource: "empty",
  };

  return {
    providerId,
    isRealApiEnabled: false,
    getGuardStatus() {
      return guardStatus;
    },
    async searchBooks(input) {
      return {
        query: input.query,
        totalResults: 0,
        books: [],
        safety: guardStatus,
      };
    },
    async getBookDetail() {
      return {
        book: null,
        chapterPreviews: [],
        safety: guardStatus,
      };
    },
  };
}
