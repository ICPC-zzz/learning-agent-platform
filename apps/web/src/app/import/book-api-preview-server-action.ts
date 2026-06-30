"use server";

import { createOpenLibraryBookSourceProvider, type BookSourceProvider } from "@learning-agent-platform/book-engine";

import {
  previewBookApiSearch,
  type BookApiPreviewViewModel,
  type PreviewBookApiSearchInput,
} from "./book-api-preview";
import { createOpenLibraryDevFetch } from "./open-library-dev-fetch";
import { getBookApiPreviewStatus } from "./book-api-preview-status";

export async function searchBookApiPreviewAction(
  input: PreviewBookApiSearchInput,
): Promise<BookApiPreviewViewModel> {
  const status = getBookApiPreviewStatus();

  if (status.providerMode === "blocked") {
    return previewBookApiSearch(createBlockedProvider(status.blockedReason), input, {
      providerMode: "blocked",
      blockedReason: status.blockedReason,
      missingEnvNames: status.missingEnvNames,
    });
  }

  const provider = createOpenLibraryBookSourceProvider({
    timeoutMs: 30_000,
    fetch: createOpenLibraryDevFetch({ timeoutMs: 30_000 }),
    env: {
      allowExternalBookApi: true,
      bookApiBaseUrl: readEnvString("LAP_BOOK_API_BASE_URL"),
      bookApiProvider: readEnvString("LAP_BOOK_API_PROVIDER"),
    },
  });

  return previewBookApiSearch(provider, input, {
    providerMode: "external-dev",
    blockedReason: status.blockedReason,
    missingEnvNames: status.missingEnvNames,
  });
}

function createBlockedProvider(blockedReason: string | null): BookSourceProvider {
  const guardStatus = {
    providerId: "open-library-dev",
    productionReady: false,
    externalApiUsed: false,
    llmUsed: false,
    writesDatabase: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    guardBlocked: true,
    blockedReasons: blockedReason ? [blockedReason] : [],
    fallbackSource: "empty" as const,
  };

  return {
    providerId: "open-library-dev",
    isRealApiEnabled: false,
    getGuardStatus() {
      return guardStatus;
    },
    async searchBooks() {
      return {
        books: [],
        totalResults: 0,
        query: "",
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

function readEnvString(key: string): string | null {
  try {
    const value = process.env[key];
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}
