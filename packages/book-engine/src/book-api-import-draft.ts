/**
 * Book API imported draft conversion helpers.
 *
 * Converts normalized external book metadata into a safe local draft shape
 * that can be stored in browser localStorage and opened in the Reader as a
 * preview-only placeholder.
 */

import type { NormalizedBookMetadata } from "./book-source-provider.ts";
import { createPassedSafetyMetadata } from "./book-source-provider.ts";

export type ImportedBookDraftSource = "book-api-preview";

export interface ImportedBookDraftChapter {
  id: string;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}

export interface ImportedBookDraft {
  draftId: string;
  source: ImportedBookDraftSource;
  providerId: string;
  externalBookId: string;
  title: string;
  authors: string[];
  description: string;
  language: string;
  sourceUrl: string;
  licenseHint: string;
  coverImageUrl: string;
  createdAt: string;
  updatedAt: string;
  chapters: ImportedBookDraftChapter[];
  bodyAvailable: boolean;
  productionReady: false;
  externalApiUsed: false;
  writesDatabase: false;
  llmUsed: false;
  rawResponseStored: false;
  safeToExposeToClient: true;
}

export interface CreateImportedBookDraftOptions {
  draftId?: string;
  now?: string | Date;
  placeholderChapterTitle?: string;
}

export interface ImportedBookPreviewDraftInput {
  providerId: string;
  externalBookId: string;
  title: string;
  authors: readonly string[];
  description: string;
  language: string;
  sourceUrl: string;
  licenseHint: string;
  coverImageUrl: string;
}

const DEFAULT_PLACEHOLDER_CHAPTER_TITLE = "External Source Preview";
const DEFAULT_PLACEHOLDER_CHAPTER_TEXT =
  "This local draft was created from external book metadata and has no fetched body yet. It is preview-only, not a full import.";

export function createImportedBookDraftFromNormalizedBookMetadata(
  metadata: NormalizedBookMetadata,
  options: CreateImportedBookDraftOptions = {},
): ImportedBookDraft {
  const now = normalizeIsoTimestamp(options.now);
  const draftId = normalizeDraftId(options.draftId);
  const placeholderChapterTitle = normalizeText(
    options.placeholderChapterTitle,
    DEFAULT_PLACEHOLDER_CHAPTER_TITLE,
    120,
  );

  const authors = normalizeStringList(metadata.authors, 24, 120);

  return {
    draftId,
    source: "book-api-preview",
    providerId: normalizeText(metadata.providerId, "unknown-provider", 120),
    externalBookId: normalizeText(metadata.externalBookId, "unknown-book", 200),
    title: normalizeText(metadata.title, "Untitled external draft", 500),
    authors,
    description: normalizeText(metadata.description, "", 2000),
    language: normalizeText(metadata.language, "unknown", 20),
    sourceUrl: normalizeText(metadata.sourceUrl, "", 2000),
    licenseHint: normalizeText(metadata.licenseHint, "unknown", 100),
    coverImageUrl: normalizeText(metadata.coverImageUrl, "", 2000),
    createdAt: now,
    updatedAt: now,
    chapters: [
      {
        id: `${draftId}-chapter-0`,
        title: placeholderChapterTitle,
        orderIndex: 0,
        level: 1,
        plainText: DEFAULT_PLACEHOLDER_CHAPTER_TEXT,
      },
    ],
    bodyAvailable: false,
    productionReady: false,
    externalApiUsed: false,
    writesDatabase: false,
    llmUsed: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
  };
}

export function createImportedBookDraftFromPreviewBook(
  input: ImportedBookPreviewDraftInput,
  options: CreateImportedBookDraftOptions = {},
): ImportedBookDraft {
  return createImportedBookDraftFromNormalizedBookMetadata(
    {
      providerId: input.providerId,
      externalBookId: input.externalBookId,
      title: input.title,
      authors: Array.from(input.authors),
      description: input.description,
      language: input.language,
      sourceUrl: input.sourceUrl,
      licenseHint: input.licenseHint,
      coverImageUrl: input.coverImageUrl,
      chapterPreviewCount: 0,
      importable: false,
      safety: createPassedSafetyMetadata(input.providerId),
    },
    options,
  );
}

function normalizeDraftId(draftId?: string): string {
  const trimmed = typeof draftId === "string" ? draftId.trim() : "";
  if (trimmed.length > 0) {
    return trimmed;
  }

  return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now().toString(36)}`;
}

function normalizeIsoTimestamp(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function normalizeText(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) {
    return fallback;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, Math.max(0, maxLength - 3)) + "...";
}

function normalizeStringList(
  values: readonly string[] | unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeText(value, "", maxLength);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}
