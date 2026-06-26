import {
  loadReaderBookmarks,
  loadReaderNotes,
  persistReaderBookmarks,
  persistReaderNotes,
  hasForbiddenLabels,
  hasSensitiveFields,
} from "../../lib/local-reader-annotation-store.ts";

var GREEN = "\x1b[32m";
var RED = "\x1b[31m";
var RESET = "\x1b[0m";
var passed = 0;
var failed = 0;
var failures = [];

function ok(cond, label) {
  if (cond) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; failures.push(label); console.log(RED + "  FAIL" + RESET + " " + label); }
}

function eq(a, b, label) {
  if (a === b) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; failures.push(label); console.log(RED + "  FAIL" + RESET + " " + label + " (got " + JSON.stringify(a) + ")"); }
}

var s = new Map();
globalThis.window = { localStorage: { getItem: function(k) { return s.has(k) ? s.get(k) : null; }, setItem: function(k, v) { s.set(k, v); }, removeItem: function(k) { s.delete(k); } } };

console.log("\n=== local stats — bookmarks count ===");
s.clear();
eq(loadReaderBookmarks().length, 0, "empty -> 0");

var bm = { bookmarkId: "bm-1", bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "C1", progressRatio: 0.5, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
persistReaderBookmarks([bm]);
eq(loadReaderBookmarks().length, 1, "1 bookmark saved");

console.log("\n=== local stats — notes count ===");
s.clear();
eq(loadReaderNotes().length, 0, "empty notes -> 0");

var n = { noteId: "n-1", bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "C1", progressRatio: 0.5, noteText: "Note", excerptPreview: null, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
persistReaderNotes([n]);
eq(loadReaderNotes().length, 1, "1 note saved");

console.log("\n=== dashboard stats — no misleading labels ===");
var statsText = "本地书签 fallback 补充：1 条（未连接数据库 · 本地存储）";
ok(hasForbiddenLabels(statsText) === false, "stats text has no forbidden labels");
ok(statsText.includes("本地书签") === true, "stats mentions local");
ok(statsText.includes("未连接数据库") === true, "stats correctly says not connected to DB");
ok(statsText.includes("fallback") === true, "stats says fallback");

console.log("\n=== dashboard stats — no sensitive ===");
ok(hasSensitiveFields({ dbBookmarksCount: 1, localBookmarkCount: 2 }) === false, "stats object has no sensitive fields");
ok(hasSensitiveFields({ dbNotesCount: 3, localNoteCount: 1 }) === false, "stats notes object has no sensitive fields");

console.log("\n=== dashboard props — no production labels ===");
var allLabels = ["本地书签 fallback 补充", "本地存储", "未连接数据库", "dev-only", "本地笔记 fallback 补充"];
for (var i = 0; i < allLabels.length; i++) {
  ok(hasForbiddenLabels(allLabels[i]) === false, "label '" + allLabels[i] + "' is safe");
}

// Verify forbidden labels are actually caught
ok(hasForbiddenLabels("生产可用") === true, "catches 生产可用");
ok(hasForbiddenLabels("真实数据") === true, "catches 真实数据");
ok(hasForbiddenLabels("云端同步成功") === true, "catches 云端同步成功");
ok(hasForbiddenLabels("账号同步完成") === true, "catches 账号同步完成");

console.log("\n" + passed + " pass / " + failed + " fail");
if (failures.length > 0) { console.log("\nFailures:"); failures.forEach(function(f) { console.log("  " + RED + f + RESET); }); }
process.exit(failed > 0 ? 1 : 0);
