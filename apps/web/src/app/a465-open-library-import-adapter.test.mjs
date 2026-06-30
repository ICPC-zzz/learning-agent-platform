/**
 * A465 — Open Library Import Adapter Tests
 * Usage: node apps/web/src/app/a465-open-library-import-adapter.test.mjs
 *
 * Tests:
 * - Preview + detail → import draft mapping
 * - No full text → safety chapter with warnings
 * - Missing fields → safe fallbacks
 * - No raw response retention
 * - Warnings explicitly mention no full text
 * - Chapter content is safe metadata only
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(`${PASS} [a465-adapter] ${name}`); }
  catch (e) { failed++; console.log(`${FAIL} [a465-adapter] ${name}\n       ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Import adapter simulation (mirrors open-library-import-adapter.ts logic)
// ---------------------------------------------------------------------------

const TITLE_FALLBACK = "未命名书籍";
const NO_FULL_TEXT_WARNING =
  "Open Library 当前只提供元数据预览，未导入完整正文。本书仅为元数据说明章节，不含完整书籍内容。";
const CHAPTER_TITLE_DEFAULT = "外部书籍信息";

function safeTrim(value) {
  if (value === undefined || value === null) return "";
  return value.trim();
}

function isNonEmpty(value) {
  return value.length > 0;
}

function truncateSafe(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function buildSafetyChapters(input) {
  const lines = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push("## 说明");
  lines.push("");
  lines.push(
    "本章节为导入自 Open Library 的外部书籍元数据说明。Open Library 当前只提供书目元数据，" +
    "不含完整书籍正文。以下信息仅用于帮助您了解本书的基本信息。",
  );
  lines.push("");

  if (input.authorNames.length > 0) {
    lines.push("## 作者");
    lines.push("");
    lines.push(input.authorNames.join("、"));
    lines.push("");
  }

  if (input.description) {
    lines.push("## 简介");
    lines.push("");
    lines.push(input.description);
    lines.push("");
  }

  if (input.subjects.length > 0) {
    lines.push("## 主题标签");
    lines.push("");
    lines.push(input.subjects.join("、"));
    lines.push("");
  }

  if (input.firstPublishYear) {
    lines.push("## 首次出版年份");
    lines.push("");
    lines.push(String(input.firstPublishYear));
    lines.push("");
  }

  if (input.isbn.length > 0) {
    lines.push("## ISBN");
    lines.push("");
    lines.push(input.isbn.join(", "));
    lines.push("");
  }

  if (input.sourceUrl) {
    lines.push("## Open Library 来源");
    lines.push("");
    lines.push(input.sourceUrl);
    lines.push("");
  }

  lines.push("## 重要提示");
  lines.push("");
  lines.push(NO_FULL_TEXT_WARNING);

  const content = lines.join("\n");

  return [{ title: CHAPTER_TITLE_DEFAULT, content, orderIndex: 0 }];
}

function createOpenLibraryImportDraft(preview, detail) {
  const warnings = [];
  const title = safeTrim(preview.title) || TITLE_FALLBACK;
  const authorNames = (preview.authorNames ?? []).map((a) => safeTrim(a)).filter(isNonEmpty);
  const sourceUrl = safeTrim(preview.sourceUrl) || "";
  const coverUrl = detail?.coverUrl
    ? safeTrim(detail.coverUrl)
    : safeTrim(preview.coverUrl) || "";
  const description = detail?.description
    ? safeTrim(detail.description)
    : "";
  const subjects = (preview.subjects ?? [])
    .map((s) => safeTrim(s))
    .filter(isNonEmpty)
    .slice(0, 10);
  const firstPublishYear = preview.firstPublishYear;
  const isbn = (preview.isbn ?? []).map((i) => safeTrim(i)).filter(isNonEmpty);

  warnings.push(NO_FULL_TEXT_WARNING);

  const chapters = buildSafetyChapters({
    title,
    authorNames,
    description,
    sourceUrl,
    subjects,
    firstPublishYear,
    isbn,
  });

  return {
    provider: "open-library",
    externalId: safeTrim(preview.externalId) || "",
    title: truncateSafe(title, 500),
    authorNames: authorNames.map((a) => truncateSafe(a, 200)),
    sourceUrl: truncateSafe(sourceUrl, 2000),
    coverUrl: truncateSafe(coverUrl, 2000),
    description: truncateSafe(description, 5000),
    subjects: subjects.map((s) => truncateSafe(s, 200)),
    firstPublishYear,
    isbn: isbn.map((i) => truncateSafe(i, 20)),
    chapters,
    warnings,
    productionReady: false,
    safeToExposeToClient: true,
    rawResponseStored: false,
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const validPreview = {
  provider: "open-library",
  externalId: "OL123W",
  title: "Learning Python",
  authorNames: ["Mark Lutz"],
  sourceUrl: "https://openlibrary.org/works/OL123W",
  coverUrl: "https://covers.openlibrary.org/b/id/123-M.jpg",
  subjects: ["Python", "Programming"],
  firstPublishYear: 2003,
  isbn: ["0596513984"],
  externalLabel: "外部数据预览 · 未导入本地",
  retrievalMethod: "search",
};

const validDetail = {
  provider: "open-library",
  externalId: "OL123W",
  title: "Learning Python",
  description: "A comprehensive guide to Python programming.",
  authorNames: ["Mark Lutz"],
  subjects: ["Python", "Programming", "Computer Science"],
  coverUrl: "https://covers.openlibrary.org/b/id/456-M.jpg",
  firstPublishDate: "2003",
  sourceUrl: "https://openlibrary.org/works/OL123W",
  externalLabel: "外部数据预览 · 未导入本地",
  retrievalMethod: "detail",
  language: ["eng"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Basic import draft ──

t("creates import draft from valid preview without detail", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft.provider, "open-library");
  assert.equal(draft.externalId, "OL123W");
  assert.equal(draft.title, "Learning Python");
  assert.deepEqual(draft.authorNames, ["Mark Lutz"]);
  assert.equal(draft.sourceUrl, "https://openlibrary.org/works/OL123W");
  assert.equal(draft.firstPublishYear, 2003);
  assert.deepEqual(draft.isbn, ["0596513984"]);
  assert.equal(draft.productionReady, false);
  assert.equal(draft.safeToExposeToClient, true);
  assert.equal(draft.rawResponseStored, false);
});

t("creates import draft with detail enrichment", () => {
  const draft = createOpenLibraryImportDraft(validPreview, validDetail);
  assert.equal(draft.description, "A comprehensive guide to Python programming.");
  assert.equal(draft.coverUrl, "https://covers.openlibrary.org/b/id/456-M.jpg");
});

// ── Safety chapter ──

t("always creates at least one safety chapter", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.ok(draft.chapters.length >= 1);
  assert.equal(draft.chapters[0].title, CHAPTER_TITLE_DEFAULT);
  assert.equal(draft.chapters[0].orderIndex, 0);
  assert.ok(draft.chapters[0].content.length > 0);
});

t("warnings explicitly state no full text", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.ok(draft.warnings.length >= 1);
  assert.ok(draft.warnings.some((w) => w.includes("未导入完整正文")));
  assert.ok(draft.warnings[0].includes("未导入完整正文"));
});

t("safety chapter contains metadata but not fabricated body text", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  const content = draft.chapters[0].content;
  assert.ok(content.includes("Learning Python"));
  assert.ok(content.includes("Mark Lutz"));
  assert.ok(content.includes("未导入完整正文"));
  // Must NOT fabricate fake body text like "Chapter 1: Introduction"
  assert.ok(!content.includes("Chapter 1: In the beginning"));
  assert.ok(!content.includes("Once upon a time"));
});

// ── Missing fields fallback ──

t("missing title falls back to 未命名书籍", () => {
  const p = { ...validPreview, title: "" };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.title, TITLE_FALLBACK);
});

t("missing authors produces empty array", () => {
  const p = { ...validPreview, authorNames: [] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.deepEqual(draft.authorNames, []);
});

t("missing sourceUrl produces empty string", () => {
  const p = { ...validPreview, sourceUrl: "" };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.sourceUrl, "");
});

t("missing isbn produces empty array", () => {
  const p = { ...validPreview, isbn: [] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.deepEqual(draft.isbn, []);
});

t("missing subjects produces empty array", () => {
  const p = { ...validPreview, subjects: [] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.deepEqual(draft.subjects, []);
});

t("null preview fields do not throw", () => {
  const p = { ...validPreview, authorNames: null, isbn: null, subjects: null };
  assert.doesNotThrow(() => createOpenLibraryImportDraft(p, null));
  const draft = createOpenLibraryImportDraft(p, null);
  assert.deepEqual(draft.authorNames, []);
  assert.deepEqual(draft.isbn, []);
  assert.deepEqual(draft.subjects, []);
});

// ── Trim and truncation ──

t("trims whitespace from title", () => {
  const p = { ...validPreview, title: "  Clean Code  " };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.title, "Clean Code");
});

t("truncates long title", () => {
  const p = { ...validPreview, title: "A".repeat(600) };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.ok(draft.title.length <= 500);
  assert.ok(draft.title.endsWith("..."));
});

t("truncates long author names", () => {
  const p = { ...validPreview, authorNames: ["A".repeat(300)] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.ok(draft.authorNames[0].length <= 200);
});

t("filters empty author names after trim", () => {
  const p = { ...validPreview, authorNames: ["  ", "Mark Lutz", "", "   "] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.deepEqual(draft.authorNames, ["Mark Lutz"]);
});

// ── No raw response retention ──

t("draft has no _raw or rawDoc field", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft._raw, undefined);
  assert.equal(draft.rawDoc, undefined);
  assert.equal(draft.rawResponse, undefined);
});

t("draft has no Open Library internal fields", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft.docs, undefined);
  assert.equal(draft.numFound, undefined);
  assert.equal(draft._rawExposed, undefined);
});

// ── Subjects capped at 10 ──

t("subjects are capped at 10", () => {
  const p = { ...validPreview, subjects: ["s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12"] };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.ok(draft.subjects.length <= 10);
});

// ── Production / safety markers ──

t("productionReady is always false", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft.productionReady, false);
});

t("rawResponseStored is always false", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft.rawResponseStored, false);
});

t("safeToExposeToClient is always true", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  assert.equal(draft.safeToExposeToClient, true);
});

// ── Chapter content safety ──

t("chapter content does not contain secret patterns", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  const content = draft.chapters[0].content;
  assert.ok(!content.includes("api_key"));
  assert.ok(!content.includes("API_KEY"));
  assert.ok(!content.includes("DATABASE_URL"));
  assert.ok(!content.includes("postgres://"));
});

t("chapter content includes safety warning about no full text", () => {
  const draft = createOpenLibraryImportDraft(validPreview, null);
  const content = draft.chapters[0].content;
  assert.ok(content.includes("未导入完整正文"));
  assert.ok(content.includes("不含完整书籍内容"));
});

// ── Japanese / Chinese titles ──

t("handles Japanese title correctly", () => {
  const p = { ...validPreview, title: "日本語の本" };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.title, "日本語の本");
  assert.ok(draft.chapters[0].content.includes("日本語の本"));
});

t("handles Chinese title correctly", () => {
  const p = { ...validPreview, title: "深入理解计算机系统" };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.title, "深入理解计算机系统");
  assert.ok(draft.chapters[0].content.includes("深入理解计算机系统"));
});

// ── Detail override ──

t("detail description overrides empty preview description", () => {
  const draft = createOpenLibraryImportDraft(validPreview, validDetail);
  assert.equal(draft.description, "A comprehensive guide to Python programming.");
});

t("detail coverUrl overrides preview coverUrl", () => {
  const draft = createOpenLibraryImportDraft(validPreview, validDetail);
  assert.equal(draft.coverUrl, "https://covers.openlibrary.org/b/id/456-M.jpg");
});

// ── Empty preview minimal ──

t("minimal preview with no data still creates import draft", () => {
  const p = {
    provider: "open-library",
    externalId: "minimal",
    title: "Minimal Book",
    authorNames: [],
    sourceUrl: "",
    isbn: [],
    subjects: [],
    externalLabel: "外部数据预览 · 未导入本地",
    retrievalMethod: "search",
  };
  const draft = createOpenLibraryImportDraft(p, null);
  assert.equal(draft.title, "Minimal Book");
  assert.equal(draft.chapters.length, 1);
  assert.ok(draft.warnings.length >= 1);
});

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n[a465-adapter] ${total} tests, ${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);
