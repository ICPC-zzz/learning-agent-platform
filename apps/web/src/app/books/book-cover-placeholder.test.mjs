import assert from "node:assert/strict";
import test from "node:test";

const modUrl = new URL("./book-cover-placeholder.ts", import.meta.url).href;
const { generateBookCoverPlaceholder, isSampleSource, isDevImportSource } = await import(modUrl);

const SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
];

// ---------------------------------------------------------------------------
// Stability
// ---------------------------------------------------------------------------

test("same input produces same output", () => {
  const a1 = generateBookCoverPlaceholder({
    bookId: "sample-python-basics",
    title: "Python 基础入门示例",
    sourceType: "内置示例书",
  });
  const a2 = generateBookCoverPlaceholder({
    bookId: "sample-python-basics",
    title: "Python 基础入门示例",
    sourceType: "内置示例书",
  });
  assert.equal(a1.initials, a2.initials);
  assert.equal(a1.bgColor, a2.bgColor);
  assert.equal(a1.hueClass, a2.hueClass);
});

test("different titles produce different colors", () => {
  const a = generateBookCoverPlaceholder({
    bookId: "b1",
    title: "Python 基础入门示例",
    sourceType: "内置示例书",
  });
  const b = generateBookCoverPlaceholder({
    bookId: "b2",
    title: "JavaScript 异步编程示例",
    sourceType: "内置示例书",
  });
  // Different titles should generally produce different hue classes
  assert.notEqual(a.hueClass, b.hueClass);
});

test("same title different bookId produces different colors", () => {
  const a = generateBookCoverPlaceholder({
    bookId: "id-1",
    title: "Same Title",
    sourceType: "内置示例书",
  });
  const b = generateBookCoverPlaceholder({
    bookId: "id-2",
    title: "Same Title",
    sourceType: "内置示例书",
  });
  assert.notEqual(a.hueClass, b.hueClass);
});

// ---------------------------------------------------------------------------
// Initials extraction
// ---------------------------------------------------------------------------

test("CJK title extracts first 2 characters", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "算法与数据结构入门",
    sourceType: "内置示例书",
  });
  assert.equal(result.initials, "算法");
});

test("single CJK character title", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "书",
    sourceType: "内置示例书",
  });
  assert.equal(result.initials, "书");
});

test("English title extracts word initials", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "JavaScript Async Programming",
    sourceType: "内置示例书",
  });
  assert.equal(result.initials, "JA");
});

test("single word English title", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "Python",
    sourceType: "内置示例书",
  });
  assert.equal(result.initials, "P");
});

test("empty title returns question mark", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "",
    sourceType: "内置示例书",
  });
  assert.equal(result.initials, "?");
});

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

test("isSampleSource detects 内置示例书", () => {
  assert.equal(isSampleSource("内置示例书"), true);
  assert.equal(isSampleSource("builtin"), true);
  assert.equal(isSampleSource("dev-import"), false);
  assert.equal(isSampleSource(undefined), false);
});

test("isDevImportSource detects dev import", () => {
  assert.equal(isDevImportSource("开发内存书库 / 重启丢失"), true);
  assert.equal(isDevImportSource("dev-import"), true);
  assert.equal(isDevImportSource("dev-abc"), true);
  assert.equal(isDevImportSource("内置示例书"), false);
  assert.equal(isDevImportSource(undefined), false);
});

// ---------------------------------------------------------------------------
// Source badge labels
// ---------------------------------------------------------------------------

test("sample book gets sample source label", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "s1",
    title: "测试书",
    sourceType: "内置示例书",
  });
  assert.equal(result.sourceLabel, "内置示例");
  assert.equal(result.sourceBadgeClass, "badge-sample-book");
});

test("dev import gets dev source label", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "d1",
    title: "测试书",
    sourceType: "开发内存书库 / 重启丢失",
  });
  assert.equal(result.sourceLabel, "开发导入");
  assert.equal(result.sourceBadgeClass, "badge-dev-import");
});

test("database book gets db source label", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "db1",
    title: "测试书",
    sourceType: "saved_book",
  });
  assert.equal(result.sourceLabel, "saved_book");
  assert.equal(result.sourceBadgeClass, "badge-database");
});

// ---------------------------------------------------------------------------
// No sensitive fields
// ---------------------------------------------------------------------------

test("cover placeholder has no sensitive fields", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "s1",
    title: "Python 基础入门示例",
    sourceType: "内置示例书",
    difficulty: "入门",
    tags: ["Python", "入门"],
  });
  const json = JSON.stringify(result);
  for (const p of SENSITIVE_PATTERNS) {
    assert.equal(p.test(json), false, "found sensitive pattern: " + p);
  }
});

// ---------------------------------------------------------------------------
// Display title truncation
// ---------------------------------------------------------------------------

test("long title is truncated", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "这是一个非常非常长的书籍标题用于测试截断功能",
    sourceType: "内置示例书",
  });
  assert.ok(result.displayTitle.length <= 13); // 12 + "…"
  assert.ok(result.displayTitle.endsWith("…"));
});

test("short title not truncated", () => {
  const result = generateBookCoverPlaceholder({
    bookId: "t1",
    title: "Python",
    sourceType: "内置示例书",
  });
  assert.equal(result.displayTitle, "Python");
});

console.log("\nOK: All book-cover-placeholder tests passed\n");
