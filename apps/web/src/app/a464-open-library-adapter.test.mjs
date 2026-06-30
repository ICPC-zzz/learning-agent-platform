/**
 * A464 — Open Library Adapter Tests
 * Usage: node apps/web/src/app/a464-open-library-adapter.test.mjs
 *
 * Tests:
 * - Complete Search API doc → correct mapping
 * - Missing fields → no throw
 * - coverUrl generation
 * - sourceUrl generation
 * - No raw doc retention
 * - Work detail mapping
 * - Description string/object formats
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(`${PASS} [a464-adapter] ${name}`); }
  catch (e) { failed++; console.log(`${FAIL} [a464-adapter] ${name}\n       ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Adapter simulation (mirrors open-library-adapter.ts logic)
// ---------------------------------------------------------------------------

const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const COVERS_BASE_URL = "https://covers.openlibrary.org/b/id";
const TITLE_FALLBACK = "未命名书籍";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function truncateSafe(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

// ── Search Adapter ──

function adaptSearchDoc(doc) {
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
  const subjects = extractSubjects(doc).slice(0, 5);
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

function adaptSearchResults(response) {
  const docs = Array.isArray(response.docs) ? response.docs : [];
  return docs.map(adaptSearchDoc).filter(isValidPreview);
}

function isValidPreview(p) {
  return p.externalId.length > 0 && p.externalId !== "unknown" && p.title !== TITLE_FALLBACK;
}

// ── Detail Adapters ──

function adaptWorkDetail(detail) {
  const key = detail.key ?? "/works/unknown";
  const externalId = key.replace(/^\/works\//, "");
  const title = detail.title ?? TITLE_FALLBACK;
  const description = normalizeDescription(detail.description);
  const authorNames = extractWorkAuthorNames(detail);
  const subjects = extractWorkSubjects(detail).slice(0, 5);
  const coverUrl = extractWorkCoverUrl(detail);
  const firstPublishDate = detail.first_publish_date ?? "";
  const sourceUrl = key.startsWith("/") ? `${OPEN_LIBRARY_BASE_URL}${key}` : key;

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
    language: [],
  };
}

// ── Extractors ──

function extractAuthorNames(doc) {
  const authorName = doc.author_name;
  if (Array.isArray(authorName)) {
    return authorName.map(a => typeof a === "string" ? a.trim() : safeString(a)).filter(Boolean);
  }
  if (typeof authorName === "string" && authorName.trim().length > 0) return [authorName.trim()];
  return [];
}

function extractFirstPublishYear(doc) {
  const year = doc.first_publish_year;
  if (typeof year === "number" && Number.isFinite(year) && year > 0) return year;
  return undefined;
}

function extractIsbns(doc) {
  const isbns = [];
  const isbnField = doc.isbn;
  if (Array.isArray(isbnField)) {
    isbnField.forEach(i => {
      if (typeof i === "string" && i.trim().length > 0) isbns.push(i.trim());
    });
  }
  for (const field of ["isbn_10", "isbn_13"]) {
    const val = doc[field];
    if (Array.isArray(val)) {
      val.forEach(item => {
        if (typeof item === "string" && item.trim().length > 0) isbns.push(item.trim());
      });
    }
  }
  return isbns;
}

function extractLanguages(doc) {
  const lang = doc.language;
  if (Array.isArray(lang)) return lang.map(l => typeof l === "string" ? l.trim() : safeString(l)).filter(Boolean);
  if (typeof lang === "string" && lang.trim().length > 0) return [lang.trim()];
  return [];
}

function extractCoverId(doc) {
  const coverI = doc.cover_i;
  if (typeof coverI === "number" && Number.isFinite(coverI) && coverI > 0) return coverI;
  return undefined;
}

function extractSubjects(doc) {
  const subjects = doc.subject;
  if (Array.isArray(subjects)) {
    return subjects.map(s => typeof s === "string" ? s.trim() : safeString(s)).filter(Boolean);
  }
  const subjectFacet = doc.subject_facet;
  if (Array.isArray(subjectFacet)) {
    return subjectFacet.map(s => typeof s === "string" ? s.trim() : safeString(s)).filter(Boolean);
  }
  return [];
}

function extractWorkAuthorNames(detail) {
  const authors = detail.authors;
  if (!Array.isArray(authors)) return [];
  return authors.map(entry => {
    if (!isRecord(entry)) return null;
    if (isRecord(entry.author)) return safeString(entry.author.name) ?? extractNameFromKey(safeString(entry.author.key));
    return safeString(entry.name) ?? extractNameFromKey(safeString(entry.key));
  }).filter(Boolean);
}

function extractWorkSubjects(detail) {
  const subjects = detail.subjects;
  if (Array.isArray(subjects)) {
    return subjects.map(s => typeof s === "string" ? s.trim() : safeString(s)).filter(Boolean);
  }
  return [];
}

function extractWorkCoverUrl(detail) {
  const covers = detail.covers;
  if (Array.isArray(covers) && covers.length > 0) {
    const first = covers[0];
    if (typeof first === "number" && Number.isFinite(first) && first > 0) {
      return `${COVERS_BASE_URL}/${first}-M.jpg`;
    }
  }
  return "";
}

function normalizeDescription(desc) {
  if (typeof desc === "string") return desc;
  if (isRecord(desc) && typeof desc.value === "string") return desc.value;
  return "";
}

function buildCoverUrl(coverId) {
  if (coverId === undefined) return "";
  return `${COVERS_BASE_URL}/${coverId}-M.jpg`;
}

function extractNameFromKey(key) {
  if (key === null) return null;
  const parts = key.split("/");
  return parts[parts.length - 1] || null;
}

function emptyPreview(externalId) {
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

// ---------------------------------------------------------------------------
// Tests: Complete search doc mapping
// ---------------------------------------------------------------------------

const FULL_SEARCH_DOC = {
  key: "/works/OL123W",
  title: "Python Programming",
  author_name: ["Guido van Rossum", "Mark Lutz"],
  first_publish_year: 2020,
  isbn: ["9780596158101", "0596158102"],
  language: ["eng"],
  cover_i: 12345,
  subject: ["Computers", "Programming", "Python"],
};

t("search doc: full fields mapped correctly", () => {
  const preview = adaptSearchDoc(FULL_SEARCH_DOC);
  assert.equal(preview.provider, "open-library");
  assert.equal(preview.title, "Python Programming");
  assert.equal(preview.externalId, "OL123W");
  assert.equal(preview.firstPublishYear, 2020);
  assert.deepEqual(preview.authorNames, ["Guido van Rossum", "Mark Lutz"]);
  assert.ok(preview.isbn.includes("9780596158101"));
  assert.ok(preview.isbn.includes("0596158102"));
  assert.deepEqual(preview.language, ["eng"]);
  assert.equal(preview.coverId, 12345);
  assert.equal(preview.coverUrl, "https://covers.openlibrary.org/b/id/12345-M.jpg");
  assert.deepEqual(preview.subjects, ["Computers", "Programming", "Python"]);
  assert.equal(preview.sourceUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(preview.workKey, "/works/OL123W");
  assert.equal(preview.retrievalMethod, "search");
});

t("search doc: externalLabel has correct text", () => {
  const preview = adaptSearchDoc(FULL_SEARCH_DOC);
  assert.equal(preview.externalLabel, "外部数据预览 · 未导入本地");
});

t("search doc: sourceUrl does NOT contain secrets", () => {
  const preview = adaptSearchDoc({
    key: "/works/OL999W",
    title: "Test Book",
  });
  assert.equal(preview.sourceUrl, "https://openlibrary.org/works/OL999W");
  assert.ok(!preview.sourceUrl.includes("api_key"));
  assert.ok(!preview.sourceUrl.includes("secret"));
  assert.ok(!preview.sourceUrl.includes("token"));
});

// ---------------------------------------------------------------------------
// Tests: Missing fields — no throw
// ---------------------------------------------------------------------------

t("search doc: missing title → fallback '未命名书籍'", () => {
  const preview = adaptSearchDoc({ key: "/works/OL1W" });
  assert.equal(preview.title, "未命名书籍");
});

t("search doc: missing authors → empty array", () => {
  const preview = adaptSearchDoc({ key: "/works/OL2W", title: "Test" });
  assert.deepEqual(preview.authorNames, []);
});

t("search doc: missing firstPublishYear → undefined", () => {
  const preview = adaptSearchDoc({ key: "/works/OL3W", title: "Test" });
  assert.equal(preview.firstPublishYear, undefined);
});

t("search doc: missing isbn → empty array", () => {
  const preview = adaptSearchDoc({ key: "/works/OL4W", title: "Test" });
  assert.deepEqual(preview.isbn, []);
});

t("search doc: missing language → empty array", () => {
  const preview = adaptSearchDoc({ key: "/works/OL5W", title: "Test" });
  assert.deepEqual(preview.language, []);
});

t("search doc: missing cover_i → empty coverUrl", () => {
  const preview = adaptSearchDoc({ key: "/works/OL6W", title: "Test" });
  assert.equal(preview.coverUrl, "");
  assert.equal(preview.coverId, undefined);
});

t("search doc: missing subjects → empty array", () => {
  const preview = adaptSearchDoc({ key: "/works/OL7W", title: "Test" });
  assert.deepEqual(preview.subjects, []);
});

t("search doc: non-record input → returns empty preview", () => {
  const preview = adaptSearchDoc("not an object");
  assert.equal(preview.title, "未命名书籍");
});

t("search doc: null input → returns empty preview", () => {
  const preview = adaptSearchDoc(null);
  assert.equal(preview.title, "未命名书籍");
});

// ---------------------------------------------------------------------------
// Tests: coverUrl generation
// ---------------------------------------------------------------------------

t("coverUrl: generated from cover_i", () => {
  const doc = { key: "/works/OL10W", title: "X", cover_i: 42 };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.coverUrl, "https://covers.openlibrary.org/b/id/42-M.jpg");
});

t("coverUrl: cover_i=0 → empty (0 is treated as no cover)", () => {
  const doc = { key: "/works/OL11W", title: "X", cover_i: 0 };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.coverUrl, "");
});

t("coverUrl: cover_i negative → empty", () => {
  const doc = { key: "/works/OL12W", title: "X", cover_i: -5 };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.coverUrl, "");
});

// ---------------------------------------------------------------------------
// Tests: sourceUrl generation
// ---------------------------------------------------------------------------

t("sourceUrl: /works/ key → Open Library works URL", () => {
  const doc = { key: "/works/OL15W", title: "X" };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.sourceUrl, "https://openlibrary.org/works/OL15W");
});

t("sourceUrl: /books/ key → Open Library books URL", () => {
  const doc = { key: "/books/OL16M", title: "X" };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.sourceUrl, "https://openlibrary.org/books/OL16M");
});

// ---------------------------------------------------------------------------
// Tests: subject preview (max 5)
// ---------------------------------------------------------------------------

t("search doc: subjects truncated to 5", () => {
  const doc = {
    key: "/works/OL20W",
    title: "X",
    subject: ["A", "B", "C", "D", "E", "F", "G"],
  };
  const preview = adaptSearchDoc(doc);
  assert.equal(preview.subjects.length, 5);
  assert.deepEqual(preview.subjects, ["A", "B", "C", "D", "E"]);
});

// ---------------------------------------------------------------------------
// Tests: adaptSearchResults → handles empty docs
// ---------------------------------------------------------------------------

t("adaptSearchResults: empty docs → empty array", () => {
  const results = adaptSearchResults({ docs: [] });
  assert.deepEqual(results, []);
});

t("adaptSearchResults: null docs → empty array", () => {
  const results = adaptSearchResults({ docs: null });
  assert.deepEqual(results, []);
});

t("adaptSearchResults: skips 'unknown' entries (no title)", () => {
  const results = adaptSearchResults({ docs: [{ key: "/works/unknown" }] });
  assert.equal(results.length, 0, "Should skip entry with unknown key and no title");
});

// ---------------------------------------------------------------------------
// Tests: Work detail mapping
// ---------------------------------------------------------------------------

const FULL_WORK_DETAIL = {
  key: "/works/OL100W",
  title: "Learning Machine Learning",
  description: "A comprehensive guide to ML",
  authors: [
    { author: { key: "/authors/OL10A" } },
    { author: { key: "/authors/OL11A", name: "Jane Smith" } },
  ],
  subjects: ["Machine Learning", "AI", "Data Science"],
  covers: [555, 666],
  first_publish_date: "2019",
};

t("work detail: title mapped", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.equal(detail.title, "Learning Machine Learning");
});

t("work detail: description string format", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.equal(detail.description, "A comprehensive guide to ML");
});

t("work detail: description object format { value }", () => {
  const detail = adaptWorkDetail({
    key: "/works/OL101W",
    title: "X",
    description: { type: "/type/text", value: "An object-style description" },
  });
  assert.equal(detail.description, "An object-style description");
});

t("work detail: description missing → empty string", () => {
  const detail = adaptWorkDetail({ key: "/works/OL102W", title: "X" });
  assert.equal(detail.description, "");
});

t("work detail: author names extracted from work format", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.ok(detail.authorNames.includes("Jane Smith"));
});

t("work detail: subjects mapped", () => {
  const detail = adaptWorkDetail({
    key: "/works/OL103W",
    title: "X",
    subjects: ["Python", "Web"],
  });
  assert.deepEqual(detail.subjects, ["Python", "Web"]);
});

t("work detail: coverUrl from covers array", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.equal(detail.coverUrl, "https://covers.openlibrary.org/b/id/555-M.jpg");
});

t("work detail: coverUrl empty when no covers", () => {
  const detail = adaptWorkDetail({ key: "/works/OL104W", title: "X" });
  assert.equal(detail.coverUrl, "");
});

t("work detail: firstPublishDate mapped", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.equal(detail.firstPublishDate, "2019");
});

t("work detail: sourceUrl correct", () => {
  const detail = adaptWorkDetail(FULL_WORK_DETAIL);
  assert.equal(detail.sourceUrl, "https://openlibrary.org/works/OL100W");
});

t("work detail: missing everything → no throw", () => {
  const detail = adaptWorkDetail({});
  assert.equal(detail.title, "未命名书籍");
  assert.equal(detail.description, "");
  assert.deepEqual(detail.authorNames, []);
  assert.deepEqual(detail.subjects, []);
  assert.equal(detail.coverUrl, "");
  assert.equal(detail.firstPublishDate, "");
});

t("work detail: externalLabel correct", () => {
  const detail = adaptWorkDetail({ key: "/works/OL105W", title: "X" });
  assert.equal(detail.externalLabel, "外部数据预览 · 未导入本地");
});

// ---------------------------------------------------------------------------
// Tests: No raw doc retention
// ---------------------------------------------------------------------------

t("search doc: no raw doc retained", () => {
  const rawDoc = { key: "/works/OL200W", title: "Raw Data", _secret: "should not appear" };
  const preview = adaptSearchDoc(rawDoc);
  assert.equal(preview.title, "Raw Data");
  // The preview should NOT have _secret or rawData fields
  assert.ok(!("_secret" in preview));
  assert.ok(!("rawData" in preview));
  assert.ok(!("rawDoc" in preview));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== A464 Adapter Tests: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ""} ===`);

if (failed > 0) {
  process.exitCode = 1;
}
