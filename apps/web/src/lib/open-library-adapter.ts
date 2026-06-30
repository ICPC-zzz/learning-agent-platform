/**
 * Open Library Adapter
 *
 * Maps raw Open Library API responses to safe, structured preview types.
 * All functions handle field-missing scenarios gracefully — no throws
 * on malformed or incomplete upstream data.
 *
 * Key principles:
 * - Never retains raw upstream docs
 * - title missing → "未命名书籍"
 * - authors missing → []
 * - isbn missing → []
 * - cover missing → empty string (no cover state)
 * - sourceUrl is Open Library page URL — no secrets
 * - coverUrl uses covers.openlibrary.org
 *
 * @module open-library-adapter
 * @previewOnly — dev-only adapter, not for production use
 */

import type {
  OpenLibrarySearchResponse,
  OpenLibraryWorkDetail,
  OpenLibraryEditionDetail,
} from "./open-library-client";

// ---------------------------------------------------------------------------
// Preview types
// ---------------------------------------------------------------------------

export interface OpenLibraryBookPreview {
  /** Provider identifier — always "open-library" */
  provider: "open-library";
  /** External ID (work key or edition key) */
  externalId: string;
  /** Book title, defaults to "未命名书籍" */
  title: string;
  /** Author names */
  authorNames: string[];
  /** First publish year (may be undefined) */
  firstPublishYear?: number;
  /** ISBNs found in the record (may be empty array) */
  isbn: string[];
  /** Language codes (may be empty array) */
  language: string[];
  /** Cover image ID from Open Library */
  coverId?: number;
  /** Cover image URL using Open Library covers endpoint */
  coverUrl: string;
  /** Work key (e.g. "/works/OL123W") */
  workKey?: string;
  /** Edition key (e.g. "/books/OL123M") */
  editionKey?: string;
  /** Subject tags (preview, up to 5) */
  subjects: string[];
  /** Open Library page URL — never contains secrets */
  sourceUrl: string;
  /** Human-readable label for external data */
  externalLabel: "外部数据预览 · 未导入本地";
  /** Always "search" or "detail" indicating how this was retrieved */
  retrievalMethod: "search" | "detail";
}

export interface OpenLibraryDetailPreview {
  /** Provider identifier */
  provider: "open-library";
  /** External ID */
  externalId: string;
  /** Book title, defaults to "未命名书籍" */
  title: string;
  /** Description text (string, empty if missing) */
  description: string;
  /** Author names */
  authorNames: string[];
  /** Subject tags */
  subjects: string[];
  /** Cover image URLs */
  coverUrl: string;
  /** First publish date string */
  firstPublishDate: string;
  /** Open Library page URL */
  sourceUrl: string;
  /** Human-readable label for external data */
  externalLabel: "外部数据预览 · 未导入本地";
  /** Retrieval method */
  retrievalMethod: "detail";
  /** Language codes if available */
  language: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const COVERS_BASE_URL = "https://covers.openlibrary.org/b/id";
const SUBJECT_PREVIEW_MAX = 5;
const TITLE_FALLBACK = "未命名书籍";

// ---------------------------------------------------------------------------
// Search adapter
// ---------------------------------------------------------------------------

/**
 * Adapt raw Open Library search response into a list of book previews.
 *
 * Handles: empty docs, missing fields, abnormal docs (skip, don't throw).
 * Never retains the raw search response.
 */
export function adaptOpenLibrarySearchResults(
  response: OpenLibrarySearchResponse,
): OpenLibraryBookPreview[] {
  const docs = Array.isArray(response.docs) ? response.docs : [];
  return docs.map(adaptSearchDoc).filter(isValidPreview);
}

/**
 * Adapt a single search doc into a book preview.
 * Never throws — returns a preview with fallback values for missing fields.
 */
function adaptSearchDoc(doc: unknown): OpenLibraryBookPreview {
  if (!isRecord(doc)) {
    return emptyPreview("unknown");
  }

  const key = safeString(doc.key) ?? "/works/unknown";
  const externalId = key.replace(/^\/works\//, "").replace(/^\/books\//, "");
  const title = safeString(doc.title) ?? TITLE_FALLBACK;
  const authorNames = extractAuthorNames(doc);
  const firstPublishYear = extractFirstPublishYear(doc);
  const isbn = extractIsbns(doc);
  const language = extractLanguages(doc);
  const coverId = extractCoverId(doc);
  const coverUrl = buildCoverUrl(coverId);
  const subjects = extractSubjects(doc).slice(0, SUBJECT_PREVIEW_MAX);
  const sourceUrl = key.startsWith("/")
    ? `${OPEN_LIBRARY_BASE_URL}${key}`
    : key;
  const workKey = key.startsWith("/works/") ? key : undefined;
  const editionKey = key.startsWith("/books/") ? key : undefined;

  return {
    provider: "open-library",
    externalId,
    title: truncateSafe(title, 500),
    authorNames: authorNames.map((a) => truncateSafe(a, 200)),
    firstPublishYear,
    isbn: isbn.map((i) => truncateSafe(i, 20)),
    language: language.map((l) => truncateSafe(l, 10)),
    coverId: coverId ?? undefined,
    coverUrl: truncateSafe(coverUrl, 2000),
    workKey,
    editionKey,
    subjects: subjects.map((s) => truncateSafe(s, 200)),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "search",
  };
}

/**
 * Filter out invalid previews (empty externalId).
 */
function isValidPreview(p: OpenLibraryBookPreview): boolean {
  return p.externalId.length > 0 && p.externalId !== "unknown" && p.title !== TITLE_FALLBACK;
}

// ---------------------------------------------------------------------------
// Work detail adapter
// ---------------------------------------------------------------------------

/**
 * Adapt raw Open Library work detail into a detail preview.
 * Handles missing fields gracefully — never throws.
 */
export function adaptOpenLibraryWorkDetail(
  detail: OpenLibraryWorkDetail,
): OpenLibraryDetailPreview {
  const key = detail.key ?? "/works/unknown";
  const externalId = key.replace(/^\/works\//, "");
  const title = detail.title ?? TITLE_FALLBACK;
  const description = normalizeDescription(detail.description);
  const authorNames = extractWorkAuthorNames(detail);
  const subjects = extractWorkSubjects(detail).slice(0, SUBJECT_PREVIEW_MAX);
  const coverUrl = extractWorkCoverUrl(detail);
  const firstPublishDate = detail.first_publish_date ?? "";
  const sourceUrl = key.startsWith("/")
    ? `${OPEN_LIBRARY_BASE_URL}${key}`
    : key;
  const language: string[] = [];

  return {
    provider: "open-library",
    externalId: truncateSafe(externalId, 200),
    title: truncateSafe(title, 500),
    description: truncateSafe(description, 5000),
    authorNames: authorNames.map((a) => truncateSafe(a, 200)),
    subjects: subjects.map((s) => truncateSafe(s, 200)),
    coverUrl: truncateSafe(coverUrl, 2000),
    firstPublishDate: truncateSafe(firstPublishDate, 100),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "detail",
    language,
  };
}

/**
 * Adapt raw Open Library edition detail into a detail preview.
 * Handles missing fields gracefully — never throws.
 */
export function adaptOpenLibraryEditionDetail(
  detail: OpenLibraryEditionDetail,
): OpenLibraryDetailPreview {
  const key = detail.key ?? "/books/unknown";
  const externalId = key.replace(/^\/books\//, "");
  const title = detail.title ?? TITLE_FALLBACK;
  const description = normalizeDescription(detail.description);
  const authorNames = extractEditionAuthorNames(detail);
  const subjects = extractEditionSubjects(detail).slice(0, SUBJECT_PREVIEW_MAX);
  const coverUrl = extractEditionCoverUrl(detail);
  const firstPublishDate = detail.publish_date ?? "";
  const sourceUrl = key.startsWith("/")
    ? `${OPEN_LIBRARY_BASE_URL}${key}`
    : key;
  const language = extractEditionLanguages(detail);

  return {
    provider: "open-library",
    externalId: truncateSafe(externalId, 200),
    title: truncateSafe(title, 500),
    description: truncateSafe(description, 5000),
    authorNames: authorNames.map((a) => truncateSafe(a, 200)),
    subjects: subjects.map((s) => truncateSafe(s, 200)),
    coverUrl: truncateSafe(coverUrl, 2000),
    firstPublishDate: truncateSafe(firstPublishDate, 100),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "detail",
    language: language.map((l) => truncateSafe(l, 10)),
  };
}

// ---------------------------------------------------------------------------
// Field extractors — search doc
// ---------------------------------------------------------------------------

function extractAuthorNames(doc: Record<string, unknown>): string[] {
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

function extractFirstPublishYear(
  doc: Record<string, unknown>,
): number | undefined {
  const year = doc.first_publish_year;
  if (typeof year === "number" && Number.isFinite(year) && year > 0) {
    return year;
  }
  return undefined;
}

function extractIsbns(doc: Record<string, unknown>): string[] {
  // Try isbn field first (array of strings)
  const isbnField = doc.isbn;
  if (Array.isArray(isbnField)) {
    return isbnField
      .map((i) => (typeof i === "string" ? i.trim() : safeString(i)))
      .filter((i): i is string => i !== null && i.length > 0);
  }
  // Also check individual ISBN fields
  const isbns: string[] = [];
  for (const field of ["isbn_10", "isbn_13"]) {
    const val = doc[field];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string" && item.trim().length > 0) {
          isbns.push(item.trim());
        }
      }
    }
  }
  return isbns;
}

function extractLanguages(doc: Record<string, unknown>): string[] {
  const lang = doc.language;
  if (Array.isArray(lang)) {
    return lang
      .map((l) => (typeof l === "string" ? l.trim() : safeString(l)))
      .filter((l): l is string => l !== null && l.length > 0);
  }
  if (typeof lang === "string" && lang.trim().length > 0) {
    return [lang.trim()];
  }
  return [];
}

function extractCoverId(doc: Record<string, unknown>): number | undefined {
  const coverI = doc.cover_i;
  if (typeof coverI === "number" && Number.isFinite(coverI) && coverI > 0) {
    return coverI;
  }
  // Also check cover_edition_key for edition-level cover lookup
  const coverEdition = doc.cover_edition_key;
  if (typeof coverEdition === "string" && coverEdition.trim().length > 0) {
    // Can't directly get cover ID from edition key — return undefined
    return undefined;
  }
  return undefined;
}

function extractSubjects(doc: Record<string, unknown>): string[] {
  const subjects = doc.subject;
  if (Array.isArray(subjects)) {
    return subjects
      .map((s) => (typeof s === "string" ? s.trim() : safeString(s)))
      .filter((s): s is string => s !== null && s.length > 0);
  }
  // Also check "subject_facet" which often has cleaner subjects
  const subjectFacet = doc.subject_facet;
  if (Array.isArray(subjectFacet)) {
    return subjectFacet
      .map((s) => (typeof s === "string" ? s.trim() : safeString(s)))
      .filter((s): s is string => s !== null && s.length > 0);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Field extractors — work detail
// ---------------------------------------------------------------------------

function extractWorkAuthorNames(
  detail: OpenLibraryWorkDetail,
): string[] {
  const authors = detail.authors;
  if (!Array.isArray(authors)) return [];

  return authors
    .map((entry) => {
      if (!isRecord(entry)) return null;
      // Work format: { author: { key: "/authors/OL123A" } } or { type: { key: "/authors/OL123A" } }
      if (isRecord(entry.author)) {
        return safeString(entry.author.name) ?? extractNameFromKey(safeString(entry.author.key));
      }
      if (isRecord(entry.type)) {
        return safeString(entry.type.name) ?? extractNameFromKey(safeString(entry.type.key));
      }
      return safeString(entry.name) ?? extractNameFromKey(safeString(entry.key));
    })
    .filter((a): a is string => a !== null && a.length > 0);
}

function extractWorkSubjects(detail: OpenLibraryWorkDetail): string[] {
  const subjects = detail.subjects;
  if (Array.isArray(subjects)) {
    return subjects
      .map((s) => (typeof s === "string" ? s.trim() : safeString(s)))
      .filter((s): s is string => s !== null && s.length > 0);
  }
  return [];
}

function extractWorkCoverUrl(detail: OpenLibraryWorkDetail): string {
  const covers = detail.covers;
  if (Array.isArray(covers) && covers.length > 0) {
    const first = covers[0];
    if (typeof first === "number" && Number.isFinite(first) && first > 0) {
      return `${COVERS_BASE_URL}/${first}-M.jpg`;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Field extractors — edition detail
// ---------------------------------------------------------------------------

function extractEditionAuthorNames(
  detail: OpenLibraryEditionDetail,
): string[] {
  const authors = detail.authors;
  if (!Array.isArray(authors)) return [];

  return authors
    .map((entry) => {
      if (!isRecord(entry)) return null;
      return safeString(entry.name) ?? extractNameFromKey(safeString(entry.key));
    })
    .filter((a): a is string => a !== null && a.length > 0);
}

function extractEditionSubjects(
  detail: OpenLibraryEditionDetail,
): string[] {
  const subjects = detail.subjects;
  if (Array.isArray(subjects)) {
    return subjects
      .map((s) => (typeof s === "string" ? s.trim() : safeString(s)))
      .filter((s): s is string => s !== null && s.length > 0);
  }
  return [];
}

function extractEditionCoverUrl(detail: OpenLibraryEditionDetail): string {
  const covers = detail.covers;
  if (Array.isArray(covers) && covers.length > 0) {
    const first = covers[0];
    if (typeof first === "number" && Number.isFinite(first) && first > 0) {
      return `${COVERS_BASE_URL}/${first}-M.jpg`;
    }
  }
  return "";
}

function extractEditionLanguages(detail: OpenLibraryEditionDetail): string[] {
  const languages = detail.languages;
  if (Array.isArray(languages)) {
    return languages
      .map((l) => {
        if (isRecord(l) && typeof l.key === "string") {
          return l.key.replace(/^\/languages\//, "");
        }
        return typeof l === "string" ? l.trim() : null;
      })
      .filter((l): l is string => l !== null && l.length > 0);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function normalizeDescription(
  desc: unknown,
): string {
  if (typeof desc === "string") return desc;
  if (isRecord(desc) && typeof desc.value === "string") return desc.value;
  // Try to extract description from nested object format: { type: "/type/text", value: "..." }
  return "";
}

function buildCoverUrl(coverId: number | undefined): string {
  if (coverId === undefined) return "";
  return `${COVERS_BASE_URL}/${coverId}-M.jpg`;
}

function extractNameFromKey(key: string | null): string | null {
  if (key === null) return null;
  const parts = key.split("/");
  return parts[parts.length - 1] || null;
}

function emptyPreview(externalId: string): OpenLibraryBookPreview {
  return {
    provider: "open-library",
    externalId,
    title: TITLE_FALLBACK,
    authorNames: [],
    isbn: [],
    language: [],
    coverUrl: "",
    subjects: [],
    sourceUrl: "",
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "search",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function truncateSafe(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
