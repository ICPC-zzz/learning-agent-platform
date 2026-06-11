import {
  loadReaderBookmarks,
  persistReaderBookmarks,
  addReaderBookmark,
  removeReaderBookmark,
  isValidReaderLocalBookmark,
  buildStableBookmarkId,
  hasSensitiveFields,
  hasForbiddenLabels,
} from "../../../lib/local-reader-annotation-store.ts";

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

// mock localStorage
var s = new Map();
globalThis.window = { localStorage: { getItem: function(k) { return s.has(k) ? s.get(k) : null; }, setItem: function(k, v) { s.set(k, v); }, removeItem: function(k) { s.delete(k); } } };

console.log("\n=== localStorage bookmarks load ===");
s.clear();
var bms = [{ bookmarkId: "bm-b1-c1", bookId: "b1", chapterId: "c1", bookTitle: "Test Book", chapterTitle: "Ch1", progressRatio: 0.5, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }, { bookmarkId: "bm-b2-c2", bookId: "b2", chapterId: "c2", bookTitle: "Book2", chapterTitle: "Ch2", progressRatio: 0.3, sourceType: "local", createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" }];
s.set("lap.web.user.readerBookmarks", JSON.stringify(bms));
var ld = loadReaderBookmarks();
eq(ld.length, 2, "loads 2 bookmarks");
ok(ld[0].bookId === "b1", "bookId correct");

console.log("\n=== JSON corruption fallback ===");
s.set("lap.web.user.readerBookmarks", "bad-json{{");
var bad = loadReaderBookmarks();
eq(bad.length, 0, "corrupted JSON -> empty");
ok(s.has("lap.web.user.readerBookmarks") === false, "corrupted key cleared");

console.log("\n=== add/remove ===");
s.clear();
s.set("lap.web.user.readerBookmarks", JSON.stringify([bms[0]]));
var cur = loadReaderBookmarks();
eq(cur.length, 1, "starts with 1");
var bm3 = { bookmarkId: "bm-b3-c3", bookId: "b3", chapterId: "c3", bookTitle: "T3", chapterTitle: "C3", progressRatio: 0.7, sourceType: "local", createdAt: "2026-01-03T00:00:00Z", updatedAt: "2026-01-03T00:00:00Z" };
var ad = addReaderBookmark(cur, bm3);
persistReaderBookmarks(ad);
cur = loadReaderBookmarks();
eq(cur.length, 2, "added -> 2");
var rm = removeReaderBookmark(cur, "bm-b3-c3");
persistReaderBookmarks(rm);
cur = loadReaderBookmarks();
eq(cur.length, 1, "removed -> 1");

console.log("\n=== validation ===");
var vb = { bookmarkId: "x", bookId: "b", chapterId: "c", bookTitle: "T", chapterTitle: "CT", progressRatio: 0.5, sourceType: "s", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
ok(isValidReaderLocalBookmark(vb) === true, "valid bookmark");
ok(isValidReaderLocalBookmark(Object.assign({}, vb, { bookId: "" })) === false, "empty bookId invalid");
ok(isValidReaderLocalBookmark(Object.assign({}, vb, { bookTitle: "token: secret" })) === false, "sensitive field invalid");

console.log("\n=== forbidden labels ===");
ok(hasForbiddenLabels(JSON.stringify(bms)) === false, "no forbidden labels");
ok(hasForbiddenLabels(JSON.stringify({ bookTitle: "云端同步成功" })) === true, "forbidden label detected");

console.log("\n=== sensitive ===");
ok(hasSensitiveFields(bms[0]) === false, "no sensitive");
ok(hasSensitiveFields(Object.assign({}, vb, { bookId: "DATABASE_URL" })) === true, "sensitive detected");

console.log("\n=== stable ID ===");
var i1 = buildStableBookmarkId("A", "c1");
var i2 = buildStableBookmarkId("A", "c1");
eq(i1, i2, "same book+ch -> same ID");
ok(i1 !== buildStableBookmarkId("A", "c2"), "diff chapter -> diff ID");

console.log("\n=== no leaks ===");
var all = bms.concat([vb]);
var js = JSON.stringify(all);
ok(js.includes("fullChapterContent") === false, "no fullChapterContent");
ok(js.includes("rawText") === false, "no rawText");
ok(js.includes("token") === false, "no token");
ok(js.includes("password") === false, "no password");

console.log("\n" + passed + " pass / " + failed + " fail");
if (failures.length > 0) { console.log("\nFailures:"); failures.forEach(function(f) { console.log("  " + RED + f + RESET); }); }
process.exit(failed > 0 ? 1 : 0);
