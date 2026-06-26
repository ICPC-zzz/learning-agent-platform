import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  READER_LOCAL_STATUS_SUMMARY_KEY,
  parseReaderLocalStatusSummary,
  parseReaderLocalStatusSummaryRaw,
  readReaderLocalStatusDiagnostics,
  formatProgress,
  formatReadingSeconds,
  buildDesktopReaderContinueHref,
} = require("./local-learning-status-panel");

function createStorage(records) {
  const map = new Map(Object.entries(records));
  return {
    getItem(key) {
      if (!map.has(key)) {
        return null;
      }
      return map.get(key);
    },
  };
}

test("diagnostics parser: no localStatus key returns empty-state message", () => {
  const diagnostics = readReaderLocalStatusDiagnostics(createStorage({}));

  assert.equal(diagnostics.storageAvailable, true);
  assert.equal(diagnostics.hasSummaryKey, false);
  assert.equal(diagnostics.parseError, false);
  assert.equal(diagnostics.summary, null);
  assert.equal(diagnostics.statusText, "暂无本地 Reader 学习状态摘要");
  assert.equal(diagnostics.hintText, "请先在 Reader 中阅读或刷新本地状态");
});

test("diagnostics parser: complete localStatus summary resolves core fields", () => {
  const diagnostics = readReaderLocalStatusDiagnostics(
    createStorage({
      [READER_LOCAL_STATUS_SUMMARY_KEY]: JSON.stringify({
        schemaVersion: 1,
        source: "reader",
        previewOnly: true,
        bookId: "book-a",
        chapterId: "ch-9",
        progressPercent: 66,
        noteCount: 4,
        bookmarkCount: 7,
        readingSeconds: 321,
        updatedAt: "2026-05-27T12:00:00.000Z",
      }),
    })
  );

  assert.equal(diagnostics.storageAvailable, true);
  assert.equal(diagnostics.hasSummaryKey, true);
  assert.equal(diagnostics.parseError, false);
  assert.equal(diagnostics.summary?.bookId, "book-a");
  assert.equal(diagnostics.summary?.chapterId, "ch-9");
  assert.equal(diagnostics.summary?.progressPercent, 66);
  assert.equal(diagnostics.summary?.noteCount, 4);
  assert.equal(diagnostics.summary?.bookmarkCount, 7);
  assert.equal(diagnostics.summary?.readingSeconds, 321);
  assert.equal(formatProgress(diagnostics.summary), "66%");
  assert.equal(formatReadingSeconds(diagnostics.summary), "321 秒");
});

test("diagnostics parser: bad JSON safely degrades", () => {
  const diagnostics = readReaderLocalStatusDiagnostics(
    createStorage({
      [READER_LOCAL_STATUS_SUMMARY_KEY]: "{ bad-json",
    })
  );

  assert.equal(diagnostics.storageAvailable, true);
  assert.equal(diagnostics.hasSummaryKey, true);
  assert.equal(diagnostics.parseError, true);
  assert.equal(diagnostics.summary, null);
  assert.equal(diagnostics.statusText, "本地状态不可解析，已安全降级");

  const rawResult = parseReaderLocalStatusSummaryRaw("{ broken");
  assert.equal(rawResult.summary, null);
  assert.equal(rawResult.parseError, true);
});

test("diagnostics parser: progressRatio/progressPercent and sessionSeconds compatibility", () => {
  const fromPercent = parseReaderLocalStatusSummary({
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    bookId: "book-b",
    chapterId: "ch-1",
    progressPercent: 75,
    sessionSeconds: 500,
    updatedAt: "2026-05-27T12:00:00.000Z",
  });

  assert.equal(fromPercent?.progressPercent, 75);
  assert.equal(fromPercent?.progressRatio, 0.75);
  assert.equal(fromPercent?.readingSeconds, 500);
  assert.equal(fromPercent?.noteCount, 0);
  assert.equal(fromPercent?.bookmarkCount, 0);

  const fromRatio = parseReaderLocalStatusSummary({
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    progressRatio: 0.25,
    readingSeconds: 120,
    updatedAt: "2026-05-27T12:00:00.000Z",
  });

  assert.equal(fromRatio?.progressRatio, 0.25);
  assert.equal(fromRatio?.progressPercent, 25);
  assert.equal(fromRatio?.readingSeconds, 120);
});

test("diagnostics parser: unavailable localStorage safely degrades", () => {
  const unavailable = readReaderLocalStatusDiagnostics(null);
  assert.equal(unavailable.storageAvailable, false);
  assert.equal(unavailable.statusText, "当前页面本地状态读取不可用");

  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
  };
  const fromThrow = readReaderLocalStatusDiagnostics(throwingStorage);
  assert.equal(fromThrow.storageAvailable, false);
  assert.equal(fromThrow.statusText, "当前页面本地状态读取不可用");
});

test("reader continue href: complete summary builds fixed reader route", () => {
  const href = buildDesktopReaderContinueHref({
    bookId: "book-a",
    chapterId: "ch-9",
  });
  assert.equal(href, "/reader?bookId=book-a&chapterId=ch-9");
});

test("reader continue href: special chars are safely encoded", () => {
  const href = buildDesktopReaderContinueHref({
    bookId: "book a/?",
    chapterId: "chapter=1&2",
  });
  assert.equal(
    href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
});

test("reader continue href: missing fields falls back to /reader", () => {
  assert.equal(buildDesktopReaderContinueHref(null), "/reader");
  assert.equal(buildDesktopReaderContinueHref({}), "/reader");
  assert.equal(
    buildDesktopReaderContinueHref({ bookId: "book-a", chapterId: " " }),
    "/reader"
  );
  assert.equal(
    buildDesktopReaderContinueHref({ bookId: 123, chapterId: "chapter-1" }),
    "/reader"
  );
});
