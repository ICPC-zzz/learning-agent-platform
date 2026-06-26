import assert from "node:assert/strict";
import test from "node:test";

// Direct inline tests that don't need tsx — these test the data module
// Run with: node --experimental-strip-types --test this-file.mjs

const CODE_BLOCK_FENCE = /```(\w+)?/;
function hasFencedCodeBlock(text) {
  return CODE_BLOCK_FENCE.test(text);
}

// Import the module
const SAMPLE_URL = new URL("./sample-programming-books.ts", import.meta.url).href;
const mod = await import(SAMPLE_URL);
const {
  SAMPLE_BOOKS_META,
  getSampleBook,
  getSampleChapter,
  isSampleBookId,
  listSampleBookIds,
  getSampleBookMeta,
  listSampleBookMetas,
} = mod;

const SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bsk-[A-Za-z0-9]{8,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]+\b/i,
  /\bghp_[A-Za-z0-9]{8,}\b/i,
];

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------
test("sample books count >= 3", () => {
  assert.ok(SAMPLE_BOOKS_META.length >= 3,
    "Expected >= 3 sample books, got " + SAMPLE_BOOKS_META.length);
});

test("each book has >= 2 chapters", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    assert.ok(meta.readerBook.chapters.length >= 2,
      meta.title + " has " + meta.readerBook.chapters.length + " chapters");
  }
});

test("at least 4 chapters contain fenced code blocks", () => {
  let count = 0;
  for (const meta of SAMPLE_BOOKS_META) {
    for (const ch of meta.readerBook.chapters) {
      if (hasFencedCodeBlock(ch.plainText)) count++;
    }
  }
  assert.ok(count >= 4, "Expected >= 4 chapters with code blocks, got " + count);
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------
test("getSampleBook finds books by ID", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    const book = getSampleBook(meta.bookId);
    assert.ok(book !== null, meta.bookId + " not found");
    assert.equal(book.document.title, meta.title);
  }
});

test("getSampleBook returns null for unknown ID", () => {
  assert.equal(getSampleBook("non-existent"), null);
});

test("getSampleChapter finds chapters", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    const ch = meta.readerBook.chapters[0];
    const result = getSampleChapter(meta.bookId, ch.id);
    assert.ok(result !== null);
    assert.equal(result.chapter.title, ch.title);
  }
});

test("getSampleChapter returns null for unknown chapter", () => {
  const id = SAMPLE_BOOKS_META[0].bookId;
  assert.equal(getSampleChapter(id, "bad-chapter"), null);
});

test("getSampleChapter returns null for unknown book", () => {
  assert.equal(getSampleChapter("bad-book", "any-ch"), null);
});

test("isSampleBookId works correctly", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    assert.equal(isSampleBookId(meta.bookId), true);
  }
  assert.equal(isSampleBookId("non-existent"), false);
  assert.equal(isSampleBookId(""), false);
});

test("listSampleBookIds returns all IDs", () => {
  const ids = listSampleBookIds();
  assert.equal(ids.length, SAMPLE_BOOKS_META.length);
});

test("getSampleBookMeta returns metadata", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    const found = getSampleBookMeta(meta.bookId);
    assert.ok(found !== null);
    assert.equal(found.title, meta.title);
    assert.equal(found.difficulty, meta.difficulty);
  }
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------
test("no sensitive fields in content", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    for (const ch of meta.readerBook.chapters) {
      const text = ch.plainText;
      assert.equal(/\bDATABASE_URL\b/i.test(text), false,
        ch.title + " contains DATABASE_URL");
      assert.equal(/E:[\\\/]code/i.test(meta.bookId), false,
        "bookId contains file path");
    }
  }
});

test("no hardcoded credentials in content", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    for (const ch of meta.readerBook.chapters) {
      for (const p of SENSITIVE_PATTERNS) {
        assert.equal(p.test(ch.plainText), false,
          ch.title + " matches " + p);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Content quality
// ---------------------------------------------------------------------------
test("all books have non-empty titles and descriptions", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    assert.ok(meta.title.trim().length > 0);
    assert.ok(meta.description.trim().length > 0);
  }
});

test("all chapters have non-empty titles and content", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    for (const ch of meta.readerBook.chapters) {
      assert.ok(ch.title.trim().length > 0);
      assert.ok(ch.plainText.trim().length > 0);
    }
  }
});

test("valid difficulty values", () => {
  const valid = ["入门", "中级", "进阶"];
  for (const meta of SAMPLE_BOOKS_META) {
    assert.ok(valid.includes(meta.difficulty),
      meta.bookId + " difficulty: " + meta.difficulty);
  }
});

test("Python book has python code blocks", () => {
  const book = getSampleBook("sample-python-basics");
  assert.ok(book !== null);
  assert.ok(hasFencedCodeBlock(book.chapters[0].plainText));
});

test("JS book has js code blocks", () => {
  const book = getSampleBook("sample-js-async");
  assert.ok(book !== null);
  assert.ok(hasFencedCodeBlock(book.chapters[0].plainText));
});

test("unique book IDs", () => {
  const ids = SAMPLE_BOOKS_META.map((m) => m.bookId);
  assert.equal(ids.length, new Set(ids).size);
});

test("unique chapter IDs per book", () => {
  for (const meta of SAMPLE_BOOKS_META) {
    const ids = meta.readerBook.chapters.map((ch) => ch.id);
    assert.equal(ids.length, new Set(ids).size,
      meta.title + " has duplicate chapter IDs");
  }
});

console.log("\nOK: All sample-programming-books tests passed\n");
