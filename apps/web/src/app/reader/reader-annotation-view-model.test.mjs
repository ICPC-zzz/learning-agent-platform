/**
 * reader-annotation-view-model.test.mjs
 *
 * Tests for Reader Annotation View Model — bookmark/note state computation,
 * guard blocked, DB success, noteText validation, sensitive field checks,
 * and forbidden label checks.
 *
 * Run: node apps/web/src/app/reader/reader-annotation-view-model.test.mjs
 */

import * as vm from "./reader-annotation-view-model.ts";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label}`;
    failures.push(msg);
    console.log(`${RED}  FAIL${RESET} ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  } else {
    failed++;
    const msg = `FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.log(`${RED}  ${msg}${RESET}`);
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    failed++;
    console.log(`${RED}  FAIL${RESET} ${label} (no error thrown)`);
  } catch {
    passed++;
    console.log(`${GREEN}  PASS${RESET} ${label}`);
  }
}

// ---------------------------------------------------------------------------
// buildBookmarkControlState
// ---------------------------------------------------------------------------

console.log("\n--- Bookmark Control State ---");

const bmState1 = vm.buildBookmarkControlState({
  isBookmarkedInLocal: true,
  localBookmark: { bookmarkId: "bm-1", bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "Ch1", progressRatio: 0.5, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  isBookmarkedInDb: false,
  dbBookmarkEnabled: false,
  hasDevSession: false,
});
assert(bmState1.isBookmarked === true, "guard blocked → uses local fallback (isBookmarked=true)");
assertEqual(bmState1.bookmarkSource, "local", "guard blocked → bookmarkSource is 'local'");
assert(bmState1.dataSourceNotice.includes("本地"), "guard blocked → notice mentions local");
assert(bmState1.isDevOnly === true, "isDevOnly is true");
assert(bmState1.productionReady === false, "productionReady is false");

// DB action success → shows dev-only
const bmState2 = vm.buildBookmarkControlState({
  isBookmarkedInLocal: false,
  localBookmark: null,
  isBookmarkedInDb: true,
  dbBookmarkEnabled: true,
  hasDevSession: true,
});
assert(bmState2.isBookmarked === true, "DB enabled + session → isBookmarked=true");
assertEqual(bmState2.bookmarkSource, "db", "DB enabled → bookmarkSource is 'db'");
assert(bmState2.dataSourceNotice.includes("DB"), "DB success → notice mentions DB");
assert(bmState2.dataSourceNotice.includes("未接生产同步"), "DB success → notice includes product disclaimer");

// DB enabled but not in DB, local has it
const bmState3 = vm.buildBookmarkControlState({
  isBookmarkedInLocal: true,
  localBookmark: { bookmarkId: "bm-2", bookId: "b2", chapterId: "c2", bookTitle: "T2", chapterTitle: "C2", progressRatio: 0.3, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  isBookmarkedInDb: false,
  dbBookmarkEnabled: true,
  hasDevSession: true,
});
assert(bmState3.isBookmarked === true, "DB enabled + local only → isBookmarked=true");
assertEqual(bmState3.bookmarkSource, "local", "DB enabled but no DB bookmark → source is 'local'");

// No bookmark at all
const bmState4 = vm.buildBookmarkControlState({
  isBookmarkedInLocal: false,
  localBookmark: null,
  isBookmarkedInDb: false,
  dbBookmarkEnabled: false,
  hasDevSession: false,
});
assert(bmState4.isBookmarked === false, "no bookmark → isBookmarked=false");
assertEqual(bmState4.bookmarkSource, "none", "no bookmark → source is 'none'");
assert(bmState4.dataSourceNotice.includes("暂无"), "no bookmark → notice shows empty");

// DB enabled but no session
const bmState5 = vm.buildBookmarkControlState({
  isBookmarkedInLocal: false,
  localBookmark: null,
  isBookmarkedInDb: true,
  dbBookmarkEnabled: true,
  hasDevSession: false,
});
assert(bmState5.isBookmarked === false, "DB enabled but no session → fallback to local (empty)");

// bookmarkControlStateIsSafe - no violations
const safeResult1 = vm.bookmarkControlStateIsSafe(bmState1);
assert(safeResult1.safe === true, `bookmark state is safe (${safeResult1.violations.length} violations)`);

// ---------------------------------------------------------------------------
// buildNoteControlState
// ---------------------------------------------------------------------------

console.log("\n--- Note Control State ---");

const noteState1 = vm.buildNoteControlState({
  localNotes: [
    { noteId: "n1", bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "Ch1", progressRatio: 0.5, noteText: "Great chapter", excerptPreview: null, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  ],
  dbNoteEnabled: false,
  hasDevSession: false,
});
assertEqual(noteState1.localNotes.length, 1, "local notes preserved");
assert(noteState1.dataSourceNotice.includes("本地"), "guard blocked → notice mentions local");

// DB enabled with session
const noteState2 = vm.buildNoteControlState({
  localNotes: [],
  dbNoteEnabled: true,
  hasDevSession: true,
});
assertEqual(noteState2.localNotes.length, 0, "empty local notes when DB enabled");
assert(noteState2.dataSourceNotice.includes("DB"), "DB enabled → notice mentions DB");

// noteControlStateIsSafe - no violations
const safeResult2 = vm.noteControlStateIsSafe(noteState1);
assert(safeResult2.safe === true, `note state is safe (${safeResult2.violations.length} violations)`);

// ---------------------------------------------------------------------------
// validateAndNormalizeNoteInput
// ---------------------------------------------------------------------------

console.log("\n--- Note Text Validation ---");

// Valid text
const val1 = vm.validateAndNormalizeNoteInput({ text: "This is a note", excerpt: "This is..." });
assert(val1.valid === true, "valid noteText passes validation");
assertEqual(val1.normalizedText, "This is a note", "valid noteText is unmodified");

// noteText too long → blocked
const longText = "a".repeat(1001);
const val2 = vm.validateAndNormalizeNoteInput({ text: longText, excerpt: null });
assert(val2.valid === false, "noteText > 1000 chars → blocked");
assert(val2.reason.includes("1000"), "too long → reason mentions 1000 char limit");

// Empty noteText → blocked
const val3 = vm.validateAndNormalizeNoteInput({ text: "   ", excerpt: null });
assert(val3.valid === false, "empty/whitespace noteText → blocked");
assert(val3.reason.includes("不能为空"), "empty → reason mentions cannot be empty");

// Not a string
const val4 = vm.validateAndNormalizeNoteInput({ text: null, excerpt: null });
assert(val4.valid === false, "null noteText → blocked");

// Sensitive field in noteText → blocked
const val5 = vm.validateAndNormalizeNoteInput({ text: "my token is secret", excerpt: null });
assert(val5.valid === false, "sensitive field (token) → blocked");
assert(val5.reason.includes("敏感"), "sensitive → reason mentions sensitive");

// Sensitive: fullChapterContent pattern
const val6 = vm.validateAndNormalizeNoteInput({ text: "Here is fullChapterContent data", excerpt: null });
assert(val6.valid === false, "fullChapterContent pattern → blocked");

// Sensitive: DATABASE_URL pattern
const val7 = vm.validateAndNormalizeNoteInput({ text: "DATABASE_URL is set", excerpt: null });
assert(val7.valid === false, "DATABASE_URL pattern → blocked");

// Excerpt normalization
const val8 = vm.validateAndNormalizeNoteInput({ text: "Valid note", excerpt: "   excerpt with leading spaces   " });
assert(val8.valid === true, "valid with excerpt → passes");
assertEqual(val8.normalizedExcerpt, "excerpt with leading spaces", "excerpt is trimmed");

// Excerpt too long
const val9 = vm.validateAndNormalizeNoteInput({ text: "Valid note", excerpt: "e".repeat(200) });
assert(val9.valid === true, "valid with long excerpt → passes validation");
assert(val9.normalizedExcerpt.length <= 160, "long excerpt is truncated to 160 chars");

// Null excerpt
const val10 = vm.validateAndNormalizeNoteInput({ text: "Valid note", excerpt: null });
assert(val10.valid === true, "null excerpt ok");
assertEqual(val10.normalizedExcerpt, null, "null excerpt stays null");

// Sensitive: rawText
const val11 = vm.validateAndNormalizeNoteInput({ text: "contains rawText field", excerpt: null });
assert(val11.valid === false, "rawText pattern → blocked");

// ---------------------------------------------------------------------------
// hasSensitiveFields
// ---------------------------------------------------------------------------

console.log("\n--- hasSensitiveFields ---");

assert(vm.hasSensitiveFields("my token is here") === true, "token detected");
assert(vm.hasSensitiveFields("api_key=xxx") === true, "api_key detected");
assert(vm.hasSensitiveFields("DATABASE_URL is set") === true, "DATABASE_URL detected");
assert(vm.hasSensitiveFields("normal text") === false, "normal text passes");
assert(vm.hasSensitiveFields("fullChapterContent detected") === true, "fullChapterContent detected");
assert(vm.hasSensitiveFields("rawText at start") === true, "rawText detected");
assert(vm.hasSensitiveFields("no sensitive content here") === false, "no sensitive content passes");

// ---------------------------------------------------------------------------
// hasForbiddenLabels
// ---------------------------------------------------------------------------

console.log("\n--- hasForbiddenLabels ---");

assert(vm.hasForbiddenLabels("云端同步成功") === true, "forbidden: 云端同步成功");
assert(vm.hasForbiddenLabels("生产笔记已保存") === true, "forbidden: 生产笔记已保存");
assert(vm.hasForbiddenLabels("真实用户笔记系统") === true, "forbidden: 真实用户笔记系统");
assert(vm.hasForbiddenLabels("正式书签同步完成") === true, "forbidden: 正式书签同步完成");
assert(vm.hasForbiddenLabels("开发预览") === false, "allowed: 开发预览");
assert(vm.hasForbiddenLabels("dev-only") === false, "allowed: dev-only");
assert(vm.hasForbiddenLabels("本地书签") === false, "allowed: 本地书签");

// ---------------------------------------------------------------------------
// normalizeExcerptPreview
// ---------------------------------------------------------------------------

console.log("\n--- normalizeExcerptPreview ---");

assertEqual(vm.normalizeExcerptPreview(null), null, "null → null");
assertEqual(vm.normalizeExcerptPreview(undefined), null, "undefined → null");
assertEqual(vm.normalizeExcerptPreview("  Hello  "), "Hello", "whitespace trimmed");
assert(vm.normalizeExcerptPreview("a".repeat(200)).length === 160, "too long → truncated to 160");

// ---------------------------------------------------------------------------
// bookmarkControlStateIsSafe — edge cases
// ---------------------------------------------------------------------------

console.log("\n--- bookmarkControlStateIsSafe edge cases ---");

// State that would trigger violations if it contained forbidden labels
const unsafeBmState = {
  isBookmarked: true,
  bookmarkSource: "db",
  localBookmark: null,
  dbBookmarkEnabled: true,
  hasDevSession: true,
  dataSourceNotice: "云端同步成功",
  isDevOnly: true,
  productionReady: false,
};
const safeResult3 = vm.bookmarkControlStateIsSafe(unsafeBmState);
assert(safeResult3.safe === false, "state with forbidden label → unsafe");
assert(safeResult3.violations.length >= 1, "violations reported for forbidden label");

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

console.log(`\n${passed} pass / ${failed} fail`);

if (failures.length > 0) {
  console.log(`\n${YELLOW}Failures:${RESET}`);
  failures.forEach((f) => console.log(`  ${RED}${f}${RESET}`));
}

process.exit(failed > 0 ? 1 : 0);
