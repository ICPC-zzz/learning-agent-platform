/**
 * Local imported book draft store.
 *
 * Persists external book API preview drafts to browser localStorage only.
 * No database writes, no raw provider response storage, no real external
 * API calls.
 */

import type {
  ImportedBookDraft,
  ImportedBookDraftChapter,
} from "@learning-agent-platform/book-engine";

export interface ImportedBookDraftLinks {
  detailHref: string;
  readerHref: string;
  libraryHref: string;
}

interface ImportedBookDraftStoreV1 {
  schemaVersion: 1;
  updatedAt: string;
  drafts: ImportedBookDraft[];
}

const STORE_KEY = "lap.web.importedBookDrafts.v1";
const MAX_STORED_DRAFTS = 50;
export const IMPORTED_BOOK_DRAFTS_CHANGED_EVENT =
  "lap.web.importedBookDrafts.changed";
const MAX_RENAMED_TITLE_LENGTH = 160;
export const MAX_IMPORTED_DRAFT_MANUAL_CHAPTER_TITLE_LENGTH = 160;
export const MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH = 20000;

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeGetItem(key: string): string | null {
  if (!isClient()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (!isClient()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  if (!isClient()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function persistImportedBookDrafts(
  drafts: readonly ImportedBookDraft[],
): boolean {
  const nextStore: ImportedBookDraftStoreV1 = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    drafts: [...drafts].slice(0, MAX_STORED_DRAFTS),
  };

  if (!safeSetItem(STORE_KEY, JSON.stringify(nextStore))) {
    return false;
  }

  notifyImportedBookDraftsChanged(nextStore.updatedAt, nextStore.drafts.length);
  return true;
}

function normalizeDraftTitleInput(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, MAX_RENAMED_TITLE_LENGTH);
  return normalized ?? fallback;
}

export function createImportedBookDraftLinks(
  draftId: string,
): ImportedBookDraftLinks {
  const encodedDraftId = encodeURIComponent(draftId);

  return {
    detailHref: `/books/${encodedDraftId}`,
    readerHref: `/reader?bookId=${encodedDraftId}`,
    libraryHref: "/books",
  };
}

export function upsertImportedBookDraft(
  drafts: readonly ImportedBookDraft[],
  draft: ImportedBookDraft,
): ImportedBookDraft[] {
  const normalizedDraft = normalizeImportedBookDraft(draft);
  if (normalizedDraft === null) {
    return [...drafts];
  }

  const existingIndex = drafts.findIndex(
    (entry) =>
      entry.providerId === normalizedDraft.providerId &&
      entry.externalBookId === normalizedDraft.externalBookId,
  );

  const nextDrafts = drafts.filter((_, index) => index !== existingIndex);
  const mergedDraft =
    existingIndex >= 0
      ? {
          ...normalizedDraft,
          draftId: drafts[existingIndex].draftId,
          createdAt: drafts[existingIndex].createdAt,
        }
      : normalizedDraft;

  return [mergedDraft, ...nextDrafts].slice(0, MAX_STORED_DRAFTS);
}

export function removeImportedBookDraft(
  drafts: readonly ImportedBookDraft[],
  draftId: string,
): ImportedBookDraft[] {
  return drafts.filter((draft) => draft.draftId !== draftId);
}

export function findImportedBookDraftById(
  drafts: readonly ImportedBookDraft[],
  draftId: string,
): ImportedBookDraft | null {
  return drafts.find((draft) => draft.draftId === draftId) ?? null;
}

export function findImportedBookDraftByProviderKey(
  drafts: readonly ImportedBookDraft[],
  providerId: string,
  externalBookId: string,
): ImportedBookDraft | null {
  return (
    drafts.find(
      (draft) =>
        draft.providerId === providerId && draft.externalBookId === externalBookId,
    ) ?? null
  );
}

export function loadImportedBookDrafts(): ImportedBookDraft[] {
  const raw = safeGetItem(STORE_KEY);
  if (raw === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    safeRemoveItem(STORE_KEY);
    return [];
  }

  const normalized = normalizeImportedBookDraftStore(parsed);
  if (normalized === null) {
    safeRemoveItem(STORE_KEY);
    return [];
  }

  return normalized.drafts;
}

export function listImportedBookDrafts(): ImportedBookDraft[] {
  return loadImportedBookDrafts();
}

export function loadImportedBookDraft(
  draftId: string,
): ImportedBookDraft | null {
  const drafts = loadImportedBookDrafts();
  return findImportedBookDraftById(drafts, draftId);
}

export function getImportedBookDraft(draftId: string): ImportedBookDraft | null {
  return loadImportedBookDraft(draftId);
}

export function loadImportedBookDraftByProviderKey(
  providerId: string,
  externalBookId: string,
): ImportedBookDraft | null {
  const drafts = loadImportedBookDrafts();
  return findImportedBookDraftByProviderKey(drafts, providerId, externalBookId);
}

export function saveImportedBookDraft(
  draft: ImportedBookDraft,
): ImportedBookDraft | null {
  const normalizedDraft = normalizeImportedBookDraft(draft);
  if (normalizedDraft === null) {
    return null;
  }

  const drafts = upsertImportedBookDraft(loadImportedBookDrafts(), normalizedDraft);
  if (!persistImportedBookDrafts(drafts)) {
    return null;
  }

  return drafts[0] ?? null;
}

export function deleteImportedBookDraft(draftId: string): boolean {
  return deleteDraft(draftId);
}

export function deleteDraft(draftId: string): boolean {
  const drafts = loadImportedBookDrafts();
  const nextDrafts = removeImportedBookDraft(drafts, draftId);

  if (nextDrafts.length === drafts.length) {
    return false;
  }

  return persistImportedBookDrafts(nextDrafts);
}

export function renameDraft(draftId: string, title: string): boolean {
  const drafts = loadImportedBookDrafts();
  const draftIndex = drafts.findIndex((draft) => draft.draftId === draftId);

  if (draftIndex < 0) {
    return false;
  }

  const currentDraft = drafts[draftIndex];
  const nextTitle = normalizeDraftTitleInput(title, currentDraft.title);

  if (nextTitle === currentDraft.title) {
    return false;
  }

  const nextDrafts = [...drafts];
  nextDrafts[draftIndex] = {
    ...currentDraft,
    title: nextTitle,
    updatedAt: new Date().toISOString(),
  };

  return persistImportedBookDrafts(nextDrafts);
}

export function updateDraftManualContent(
  draftId: string,
  content: { chapterTitle: string; body: string },
): boolean {
  const drafts = loadImportedBookDrafts();
  const draftIndex = drafts.findIndex((draft) => draft.draftId === draftId);

  if (draftIndex < 0) {
    return false;
  }

  const currentDraft = drafts[draftIndex];
  const currentChapter = currentDraft.chapters[0];

  if (currentChapter === undefined) {
    return false;
  }

  const nextBody = normalizeManualChapterBodyInput(
    content.body,
    MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH,
  );
  if (nextBody === null) {
    return false;
  }

  const nextTitle = normalizeManualChapterTitleInput(
    content.chapterTitle,
    currentChapter.title,
  );

  const nextChapters = [...currentDraft.chapters];
  nextChapters[0] = {
    ...currentChapter,
    title: nextTitle,
    plainText: nextBody,
  };

  const bodyChanged = currentDraft.bodyAvailable !== true;
  const titleChanged = currentChapter.title !== nextTitle;
  const textChanged = currentChapter.plainText !== nextBody;

  if (!bodyChanged && !titleChanged && !textChanged) {
    return false;
  }

  const nextDrafts = [...drafts];
  nextDrafts[draftIndex] = {
    ...currentDraft,
    chapters: nextChapters,
    bodyAvailable: true,
    updatedAt: new Date().toISOString(),
  };

  return persistImportedBookDrafts(nextDrafts);
}

function notifyImportedBookDraftsChanged(
  updatedAt: string,
  count: number,
): void {
  if (!isClient()) {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(IMPORTED_BOOK_DRAFTS_CHANGED_EVENT, {
        detail: {
          updatedAt,
          count,
        },
      }),
    );
  } catch {
    // Ignore browser event dispatch errors.
  }
}

function normalizeImportedBookDraftStore(
  value: unknown,
): ImportedBookDraftStoreV1 | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.updatedAt !== "string") {
    return null;
  }

  if (!Array.isArray(record.drafts)) {
    return null;
  }

  const drafts = record.drafts
    .map((draft) => normalizeImportedBookDraft(draft))
    .filter((draft): draft is ImportedBookDraft => draft !== null);

  return {
    schemaVersion: 1,
    updatedAt: record.updatedAt,
    drafts,
  };
}

function normalizeImportedBookDraft(
  value: ImportedBookDraft | unknown,
): ImportedBookDraft | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const draftId = normalizeText(record.draftId, 160);
  const source = record.source === "book-api-preview" ? record.source : null;
  const providerId = normalizeText(record.providerId, 120);
  const externalBookId = normalizeText(record.externalBookId, 200);
  const title = normalizeText(record.title, 500);
  const authors = normalizeTextList(record.authors, 24, 120);
  const description = normalizeText(record.description, 2000);
  const language = normalizeText(record.language, 20, "unknown");
  const sourceUrl = normalizeText(record.sourceUrl, 2000);
  const licenseHint = normalizeText(record.licenseHint, 100, "unknown");
  const coverImageUrl = normalizeText(record.coverImageUrl, 2000);
  const createdAt = normalizeIsoTimestamp(record.createdAt);
  const updatedAt = normalizeIsoTimestamp(record.updatedAt);
  const chapters = normalizeDraftChapters(record.chapters);

  if (
    draftId === null ||
    source === null ||
    providerId === null ||
    externalBookId === null ||
    title === null ||
    createdAt === null ||
    updatedAt === null ||
    chapters === null
  ) {
    return null;
  }

  return {
    draftId,
    source,
    providerId,
    externalBookId,
    title,
    authors,
    description: description ?? "",
    language: language ?? "unknown",
    sourceUrl: sourceUrl ?? "",
    licenseHint: licenseHint ?? "unknown",
    coverImageUrl: coverImageUrl ?? "",
    createdAt,
    updatedAt,
    chapters,
    bodyAvailable: record.bodyAvailable === true,
    productionReady: false,
    externalApiUsed: false,
    writesDatabase: false,
    llmUsed: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
  };
}

function normalizeDraftChapters(
  value: unknown,
): ImportedBookDraftChapter[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const chapters: ImportedBookDraftChapter[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const id = normalizeText(record.id, 120);
    const title = normalizeText(record.title, 120);
    const orderIndex = normalizeNumber(record.orderIndex);
    const level = normalizeNumber(record.level);
    const plainText = normalizeChapterBody(record.plainText, MAX_IMPORTED_DRAFT_MANUAL_BODY_LENGTH);

    if (
      id === null ||
      title === null ||
      orderIndex === null ||
      level === null ||
      plainText === null
    ) {
      return null;
    }

    chapters.push({
      id,
      title,
      orderIndex,
      level,
      plainText,
    });
  }

  return chapters;
}

function normalizeText(
  value: unknown,
  maxLength: number,
  fallback?: string,
): string | null {
  if (typeof value !== "string") {
    return fallback === undefined ? null : fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) {
    return fallback === undefined ? null : fallback;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, Math.max(0, maxLength - 3)) + "...";
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

function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  if (cleaned.length === 0) {
    return null;
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeManualChapterTitleInput(value: unknown, fallback: string): string {
  return normalizeText(
    value,
    MAX_IMPORTED_DRAFT_MANUAL_CHAPTER_TITLE_LENGTH,
    fallback,
  ) ?? fallback;
}

function normalizeManualChapterBodyInput(
  value: unknown,
  maxLength: number,
): string | null {
  const normalized = normalizeChapterBody(value, maxLength);
  if (normalized === null) {
    return null;
  }

  if (normalized.trim().length === 0) {
    return null;
  }

  return normalized;
}

function normalizeChapterBody(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    return null;
  }

  return normalized;
}
