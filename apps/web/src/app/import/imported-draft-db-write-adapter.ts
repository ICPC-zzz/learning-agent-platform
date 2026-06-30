import {
  createBookRepositoryInputFromImportedBook,
  getPrismaClient,
  PrismaBookRepository,
  type CreateBookWithContentInput,
  type CreateBookWithContentResult,
} from "@learning-agent-platform/db";
import type { ImportedBookDraft } from "@learning-agent-platform/book-engine";

import {
  createBlockedImportedDraftDbWriteGuard,
  evaluateImportedDraftDbWriteGuard,
  type ImportedDraftDbWriteGuardResult,
} from "./imported-draft-db-write-guard.ts";

export type ImportedDraftDbWriteStatus =
  | "blocked"
  | "written-dev-preview"
  | "error";

export type ImportedDraftDbWriteOwnerMode =
  | "trusted-dev-session"
  | "anonymous-fallback";

export interface ImportedDraftDbWriteResult {
  status: ImportedDraftDbWriteStatus;
  reasonCode: string;
  message: string;
  bookId: string | null;
  chapterId: string | null;
  bookIdPreview: string | null;
  chapterIdPreview: string | null;
  chapterIds: string[];
  chapterIdsPreview: string[];
  detailHref: string;
  readerHref: string;
  libraryHref: string;
  writesDatabase: boolean;
  callsRepository: boolean;
  productionReady: false;
  safeToExposeToClient: true;
  rawProviderResponseStored: false;
  llmUsed: false;
  ownerMode: ImportedDraftDbWriteOwnerMode;
  ownerLabel: string | null;
  blockedReasons: string[];
}

export interface ImportedDraftDbWriteAdapterRepository {
  createBookWithContent(
    input: CreateBookWithContentInput,
  ): Promise<CreateBookWithContentResult>;
}

export interface ImportedDraftDbWriteOptions {
  draft: ImportedBookDraft | null;
  guard?: ImportedDraftDbWriteGuardResult;
  repository?: ImportedDraftDbWriteAdapterRepository;
  ownerMode?: ImportedDraftDbWriteOwnerMode;
  ownerLabel?: string | null;
}

const DEFAULT_OWNER_MODE: ImportedDraftDbWriteOwnerMode = "anonymous-fallback";

export async function writeImportedDraftToDevDatabase(
  options: ImportedDraftDbWriteOptions,
): Promise<ImportedDraftDbWriteResult> {
  const guard = options.guard ?? evaluateImportedDraftDbWriteGuard();
  const ownerMode = options.ownerMode ?? DEFAULT_OWNER_MODE;
  const ownerLabel = options.ownerLabel ?? null;
  const normalizedDraft = normalizeImportedDraft(options.draft);

  const blocked = createBlockedImportedDraftDbWriteGuard();
  if (!guard.enabled) {
    return createBlockedResult({
      reasonCode: "guard-blocked",
      message: guard.blockedReasons.length > 0
        ? guard.blockedReasons.join(" ")
        : blocked.blockedReasons[0] ?? "Imported draft DB write is blocked.",
      guard,
      normalizedDraft,
      ownerMode,
      ownerLabel,
    });
  }

  if (normalizedDraft === null) {
    return createBlockedResult({
      reasonCode: "draft-invalid",
      message: "Imported draft is missing required fields for DB write.",
      guard,
      normalizedDraft,
      ownerMode,
      ownerLabel,
    });
  }

  const validationError = validateNormalizedDraft(normalizedDraft);
  if (validationError !== null) {
    return createBlockedResult({
      reasonCode: validationError.reasonCode,
      message: validationError.message,
      guard,
      normalizedDraft,
      ownerMode,
      ownerLabel,
    });
  }

  const preview = buildPreviewIds(normalizedDraft);
  const repository = options.repository ?? createRealImportedDraftRepository();

  if (repository === null) {
    return createErrorResult({
      reasonCode: "repository-unavailable",
      message:
        "Imported draft DB repository is unavailable in this environment.",
      guard,
      normalizedDraft,
      ownerMode,
      ownerLabel,
      preview,
    });
  }

  const repositoryInput = buildRepositoryInput(normalizedDraft, ownerMode, ownerLabel);

  try {
    const result = await repository.createBookWithContent(repositoryInput);
    const chapterIds = result.chapterIds ?? preview.chapterIdsPreview;
    const chapterId = chapterIds[0] ?? preview.chapterIdPreview;
    const links = createResultLinks(result.bookId, chapterId, preview.bookIdPreview, preview.chapterIdPreview);

    return {
      status: "written-dev-preview",
      reasonCode: "db-write-succeeded",
      message: "Imported draft saved to the dev database path.",
      bookId: result.bookId,
      chapterId,
      bookIdPreview: preview.bookIdPreview,
      chapterIdPreview: preview.chapterIdPreview,
      chapterIds,
      chapterIdsPreview: preview.chapterIdsPreview,
      detailHref: links.detailHref,
      readerHref: links.readerHref,
      libraryHref: links.libraryHref,
      writesDatabase: true,
      callsRepository: true,
      productionReady: false,
      safeToExposeToClient: true,
      rawProviderResponseStored: false,
      llmUsed: false,
      ownerMode,
      ownerLabel,
      blockedReasons: [],
    };
  } catch {
    return createErrorResult({
      reasonCode: "db-write-failed",
      message: "Imported draft DB write failed safely.",
      guard,
      normalizedDraft,
      ownerMode,
      ownerLabel,
      preview,
      callsRepository: true,
    });
  }
}

function createRealImportedDraftRepository(): ImportedDraftDbWriteAdapterRepository | null {
  try {
    return new PrismaBookRepository(getPrismaClient());
  } catch {
    return null;
  }
}

function buildRepositoryInput(
  draft: NormalizedImportedDraft,
  ownerMode: ImportedDraftDbWriteOwnerMode,
  ownerLabel: string | null,
): CreateBookWithContentInput {
  const importedAt = new Date().toISOString();
  const bodyChapterCount = draft.chapters.filter(
    (chapter) => chapter.plainText.trim().length > 0,
  ).length;
  const sourceMetadata = {
    importedAt,
    draftId: draft.draftId,
    providerId: draft.providerId,
    externalBookId: draft.externalBookId,
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    language: draft.language,
    chapterCount: draft.chapters.length,
    bodyChapterCount,
    bodyAvailable: draft.bodyAvailable,
    ownerMode,
    ownerLabel,
    writesDatabase: true,
    llmUsed: false,
    rawProviderResponseStored: false,
    safeToExposeToClient: true,
  };

  return createBookRepositoryInputFromImportedBook({
    document: {
      title: draft.title,
      author: draft.authors.length > 0 ? draft.authors.join(", ") : null,
      sourceType: "imported_url",
      sourceMetadata,
    },
    chapters: draft.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      orderIndex: chapter.orderIndex,
      level: chapter.level,
      plainText: chapter.plainText,
    })),
    chunks: draft.chapters.map((chapter) => ({
      id: `${chapter.id}-chunk-0`,
      chapterId: chapter.id,
      orderIndex: 0,
      plainText: chapter.plainText,
      charCount: chapter.plainText.length,
      startOffset: 0,
      endOffset: chapter.plainText.length,
    })),
  });
}

function normalizeImportedDraft(value: ImportedBookDraft | null): NormalizedImportedDraft | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const draftId = normalizeText(value.draftId, 160);
  const title = normalizeText(value.title, 500);
  const source = value.source === "book-api-preview" ? value.source : null;
  const providerId = normalizeText(value.providerId, 120);
  const externalBookId = normalizeText(value.externalBookId, 200);
  const authors = normalizeTextList(value.authors, 24, 120);
  const description = normalizeText(value.description, 2000, "") ?? "";
  const language = normalizeText(value.language, 20, "unknown") ?? "unknown";
  const sourceUrl = normalizeText(value.sourceUrl, 2000, "") ?? "";
  const chapters = normalizeDraftChapters(value.chapters);
  const bodyAvailable = value.bodyAvailable === true;

  if (
    draftId === null ||
    title === null ||
    source === null ||
    providerId === null ||
    externalBookId === null ||
    chapters === null
  ) {
    return null;
  }

  return {
    draftId,
    title,
    source,
    providerId,
    externalBookId,
    authors,
    description,
    language,
    sourceUrl,
    bodyAvailable,
    chapters,
  };
}

function normalizeDraftChapters(
  value: unknown,
): NormalizedImportedDraftChapter[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const chapters: NormalizedImportedDraftChapter[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const id = normalizeText(record.id, 160);
    const title = normalizeText(record.title, 160);
    const plainText = normalizePlainText(record.plainText, 20000);
    const orderIndex = normalizeInteger(record.orderIndex);
    const level = normalizeInteger(record.level);

    if (
      id === null ||
      title === null ||
      plainText === null ||
      orderIndex === null ||
      level === null
    ) {
      return null;
    }

    chapters.push({
      id,
      title,
      plainText,
      orderIndex,
      level,
    });
  }

  return chapters;
}

function validateNormalizedDraft(
  draft: NormalizedImportedDraft,
): { reasonCode: string; message: string } | null {
  if (draft.title.trim().length === 0) {
    return {
      reasonCode: "missing-title",
      message: "Imported draft title is required.",
    };
  }

  if (draft.draftId.trim().length === 0) {
    return {
      reasonCode: "missing-draft-id",
      message: "Imported draft id is required.",
    };
  }

  if (draft.chapters.length === 0) {
    return {
      reasonCode: "missing-chapters",
      message: "Imported draft needs at least one chapter.",
    };
  }

  const hasBody = draft.chapters.some(
    (chapter) => chapter.plainText.trim().length > 0,
  );

  if (!hasBody) {
    return {
      reasonCode: "missing-body",
      message: "Imported draft needs at least one chapter body or placeholder.",
    };
  }

  return null;
}

function buildPreviewIds(draft: NormalizedImportedDraft): {
  bookIdPreview: string;
  chapterIdPreview: string | null;
  chapterIdsPreview: string[];
} {
  const bookIdPreview = `preview-book:${draft.draftId}`;
  const chapterIdsPreview = draft.chapters.map((chapter) => chapter.id);

  return {
    bookIdPreview,
    chapterIdPreview: chapterIdsPreview[0] ?? null,
    chapterIdsPreview,
  };
}

function createBlockedResult(options: {
  reasonCode: string;
  message: string;
  guard: ImportedDraftDbWriteGuardResult;
  normalizedDraft: NormalizedImportedDraft | null;
  ownerMode: ImportedDraftDbWriteOwnerMode;
  ownerLabel: string | null;
}): ImportedDraftDbWriteResult {
  const preview = options.normalizedDraft === null
    ? {
        bookIdPreview: null,
        chapterIdPreview: null,
        chapterIdsPreview: [],
      }
    : buildPreviewIds(options.normalizedDraft);

  return {
    status: "blocked",
    reasonCode: options.reasonCode,
    message: options.message,
    bookId: null,
    chapterId: null,
    bookIdPreview: preview.bookIdPreview,
    chapterIdPreview: preview.chapterIdPreview,
    chapterIds: [],
    chapterIdsPreview: preview.chapterIdsPreview,
    detailHref: createResultLinks(null, null, preview.bookIdPreview, preview.chapterIdPreview).detailHref,
    readerHref: createResultLinks(null, null, preview.bookIdPreview, preview.chapterIdPreview).readerHref,
    libraryHref: "/books",
    writesDatabase: false,
    callsRepository: false,
    productionReady: false,
    safeToExposeToClient: true,
    rawProviderResponseStored: false,
    llmUsed: false,
    ownerMode: options.ownerMode,
    ownerLabel: options.ownerLabel,
    blockedReasons: [...options.guard.blockedReasons],
  };
}

function createErrorResult(options: {
  reasonCode: string;
  message: string;
  guard: ImportedDraftDbWriteGuardResult;
  normalizedDraft: NormalizedImportedDraft | null;
  ownerMode: ImportedDraftDbWriteOwnerMode;
  ownerLabel: string | null;
  preview?: ReturnType<typeof buildPreviewIds>;
  callsRepository?: boolean;
}): ImportedDraftDbWriteResult {
  const preview = options.preview ??
    (options.normalizedDraft === null
      ? {
          bookIdPreview: null,
          chapterIdPreview: null,
          chapterIdsPreview: [],
        }
      : buildPreviewIds(options.normalizedDraft));

  return {
    status: "error",
    reasonCode: options.reasonCode,
    message: options.message,
    bookId: null,
    chapterId: null,
    bookIdPreview: preview.bookIdPreview,
    chapterIdPreview: preview.chapterIdPreview,
    chapterIds: [],
    chapterIdsPreview: preview.chapterIdsPreview,
    detailHref: createResultLinks(null, null, preview.bookIdPreview, preview.chapterIdPreview).detailHref,
    readerHref: createResultLinks(null, null, preview.bookIdPreview, preview.chapterIdPreview).readerHref,
    libraryHref: "/books",
    writesDatabase: false,
    callsRepository: options.callsRepository === true,
    productionReady: false,
    safeToExposeToClient: true,
    rawProviderResponseStored: false,
    llmUsed: false,
    ownerMode: options.ownerMode,
    ownerLabel: options.ownerLabel,
    blockedReasons: [...options.guard.blockedReasons],
  };
}

function createResultLinks(
  bookId: string | null,
  chapterId: string | null,
  previewBookId: string | null,
  previewChapterId: string | null,
): {
  detailHref: string;
  readerHref: string;
  libraryHref: string;
} {
  const resolvedBookId = bookId ?? previewBookId;
  const resolvedChapterId = chapterId ?? previewChapterId;
  const libraryHref = "/books";

  if (resolvedBookId === null) {
    return {
      detailHref: libraryHref,
      readerHref: "/reader",
      libraryHref,
    };
  }

  const encodedBookId = encodeURIComponent(resolvedBookId);
  const readerHref =
    resolvedChapterId === null
      ? `/reader?bookId=${encodedBookId}`
      : `/reader?bookId=${encodedBookId}&chapterId=${encodeURIComponent(resolvedChapterId)}`;

  return {
    detailHref: `/books/${encodedBookId}`,
    readerHref,
    libraryHref,
  };
}

function normalizeText(
  value: unknown,
  maxLength: number,
  fallback?: string,
): string | null {
  if (typeof value !== "string") {
    return fallback === undefined ? null : fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return fallback === undefined ? null : fallback;
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizePlainText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.length === 0 || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeTextList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    const normalized = normalizeText(entry, maxLength);
    if (normalized === null || seen.has(normalized)) {
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

interface NormalizedImportedDraft {
  draftId: string;
  title: string;
  source: "book-api-preview";
  providerId: string;
  externalBookId: string;
  authors: string[];
  description: string;
  language: string;
  sourceUrl: string;
  bodyAvailable: boolean;
  chapters: NormalizedImportedDraftChapter[];
}

interface NormalizedImportedDraftChapter {
  id: string;
  title: string;
  plainText: string;
  orderIndex: number;
  level: number;
}
