import assert from "node:assert/strict";
import test from "node:test";

const modUrl = new URL("./book-display-summary.ts", import.meta.url).href;
const {
  hasFencedCodeBlock,
  countCodeBlockChapters,
  estimateReadingMinutes,
  estimateTotalReadingMinutes,
  computeBookDisplaySummary,
  getFirstChapterInfo,
  buildReaderHref,
  hasSensitiveFields,
} = await import(modUrl);

const SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
];

// ---- Code block detection ----

test("hasFencedCodeBlock detects fenced block", () => {
  assert.equal(hasFencedCodeBlock("```python\nprint('hi')\n```"), true);
});

test("hasFencedCodeBlock detects tilde fenced block", () => {
  assert.equal(hasFencedCodeBlock("~~~js\nconst x = 1;\n~~~"), true);
});

test("hasFencedCodeBlock false for plain text", () => {
  assert.equal(hasFencedCodeBlock("This is just plain text."), false);
});

test("hasFencedCodeBlock false for empty string", () => {
  assert.equal(hasFencedCodeBlock(""), false);
});

test("hasFencedCodeBlock true for multiple blocks", () => {
  const text = "```python\na=1\n```\n\n```js\nconst b=2;\n```";
  assert.equal(hasFencedCodeBlock(text), true);
});

// ---- countCodeBlockChapters ----

test("countCodeBlockChapters counts correctly", () => {
  const chapters = [
    { plainText: "```python\nprint(1)\n```" },
    { plainText: "plain text" },
    { plainText: "```js\nconst x=1;\n```" },
  ];
  assert.equal(countCodeBlockChapters(chapters), 2);
});

test("countCodeBlockChapters empty returns 0", () => {
  assert.equal(countCodeBlockChapters([]), 0);
});

test("countCodeBlockChapters all code returns full count", () => {
  const chapters = [
    { plainText: "```python\na\n```" },
    { plainText: "```js\nb\n```" },
  ];
  assert.equal(countCodeBlockChapters(chapters), 2);
});

// ---- Reading time ----

test("estimateReadingMinutes for short text", () => {
  assert.equal(estimateReadingMinutes(100), 1);
});

test("estimateReadingMinutes rounds up", () => {
  assert.equal(estimateReadingMinutes(301), 2);
});

test("estimateReadingMinutes for long text", () => {
  assert.equal(estimateReadingMinutes(900), 3);
});

test("estimateTotalReadingMinutes sums chars", () => {
  const chapters = [
    { plainText: "a".repeat(300) },
    { plainText: "b".repeat(300) },
  ];
  assert.equal(estimateTotalReadingMinutes(chapters), 2);
});

// ---- computeBookDisplaySummary ----

test("computeBookDisplaySummary includes all fields", () => {
  const chapters = [
    { plainText: "```python\nprint(1)\n```\n\nSome text here.\n".repeat(10) },
    { plainText: "No code here, just text.\n".repeat(20) },
    { plainText: "```js\nconst x = 1;\n```\nMore text.\n".repeat(5) },
  ];
  const result = computeBookDisplaySummary({ chapters });
  assert.equal(result.chapterCount, 3);
  assert.equal(result.codeBlockChapterCount, 2);
  assert.equal(result.hasCodeBlocks, true);
  assert.ok(result.estimatedReadingMinutes >= 1);
});

test("computeBookDisplaySummary no code blocks", () => {
  const chapters = [
    { plainText: "Just plain text.\n".repeat(50) },
    { plainText: "More plain text.\n".repeat(30) },
  ];
  const result = computeBookDisplaySummary({ chapters });
  assert.equal(result.codeBlockChapterCount, 0);
  assert.equal(result.hasCodeBlocks, false);
});

test("computeBookDisplaySummary empty chapters", () => {
  const result = computeBookDisplaySummary({ chapters: [] });
  assert.equal(result.chapterCount, 0);
  assert.equal(result.codeBlockChapterCount, 0);
  assert.equal(result.hasCodeBlocks, false);
  assert.equal(result.estimatedReadingMinutes, 1);
});

// ---- getFirstChapterInfo ----

test("getFirstChapterInfo returns first chapter", () => {
  const info = getFirstChapterInfo({
    bookId: "test-book",
    chapters: [
      { id: "ch1", title: "第一章", orderIndex: 0, plainText: "a".repeat(300) },
      { id: "ch2", title: "第二章", orderIndex: 1, plainText: "b".repeat(600) },
    ],
  });
  assert.notEqual(info, null);
  assert.equal(info.chapterId, "ch1");
  assert.equal(info.title, "第一章");
  assert.equal(info.readerHref, "/reader?bookId=test-book&chapterId=ch1");
  assert.equal(info.estimatedReadingMinutes, 1);
});

test("getFirstChapterInfo returns null for empty chapters", () => {
  assert.equal(getFirstChapterInfo({ bookId: "x", chapters: [] }), null);
});

test("getFirstChapterInfo hasCodeBlock detection", () => {
  const info = getFirstChapterInfo({
    bookId: "t1",
    chapters: [
      { id: "c1", title: "Ch1", orderIndex: 0, plainText: "```python\nprint(1)\n```" },
    ],
  });
  assert.equal(info.hasCodeBlock, true);
});

test("getFirstChapterInfo no code block", () => {
  const info = getFirstChapterInfo({
    bookId: "t1",
    chapters: [
      { id: "c1", title: "Ch1", orderIndex: 0, plainText: "Plain text" },
    ],
  });
  assert.equal(info.hasCodeBlock, false);
});

// ---- buildReaderHref ----

test("buildReaderHref with chapterId", () => {
  assert.equal(
    buildReaderHref("my-book", "my-chapter"),
    "/reader?bookId=my-book&chapterId=my-chapter",
  );
});

test("buildReaderHref without chapterId", () => {
  assert.equal(
    buildReaderHref("my-book"),
    "/reader?bookId=my-book",
  );
});

// ---- Safety ----

test("display summary has no sensitive fields", () => {
  const summary = computeBookDisplaySummary({
    chapters: [{ plainText: "```python\nprint('safe')\n```" }],
  });
  assert.equal(hasSensitiveFields(summary), false);
});

test("first chapter info has no sensitive fields", () => {
  const info = getFirstChapterInfo({
    bookId: "safe",
    chapters: [{ id: "c1", title: "Safe", orderIndex: 0, plainText: "content" }],
  });
  assert.equal(hasSensitiveFields(info), false);
});

test("sensitive field detection catches DATABASE_URL", () => {
  assert.equal(hasSensitiveFields({ x: "DATABASE_URL=postgres://..." }), true);
});

test("sensitive field detection catches token", () => {
  assert.equal(hasSensitiveFields({ x: "my token is abc" }), true);
});

console.log("\nOK: All book-display-summary tests passed\n");
