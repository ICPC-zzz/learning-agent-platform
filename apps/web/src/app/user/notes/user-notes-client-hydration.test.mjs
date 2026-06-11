import {
  loadReaderNotes,
  persistReaderNotes,
  addReaderNote,
  removeReaderNote,
  isValidReaderLocalNote,
  validateNoteText,
  normalizeNoteText,
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

var s = new Map();
globalThis.window = { localStorage: { getItem: function(k) { return s.has(k) ? s.get(k) : null; }, setItem: function(k, v) { s.set(k, v); }, removeItem: function(k) { s.delete(k); } } };

console.log("\n=== localStorage notes load ===");
s.clear();
var ns = [{ noteId: "n-1", bookId: "b1", chapterId: "c1", bookTitle: "Test", chapterTitle: "Ch1", progressRatio: 0.5, noteText: "Great chapter", excerptPreview: null, sourceType: "local", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }, { noteId: "n-2", bookId: "b2", chapterId: "c2", bookTitle: "B2", chapterTitle: "C2", progressRatio: 0.3, noteText: "Notes here", excerptPreview: "Excerpt", sourceType: "local", createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" }];
s.set("lap.web.user.readerNotes", JSON.stringify(ns));
var ld = loadReaderNotes();
eq(ld.length, 2, "loads 2 notes");
ok(ld[0].noteText === "Great chapter", "noteText correct");
ok(ld[1].excerptPreview === "Excerpt", "excerptPreview correct");

console.log("\n=== JSON corruption ===");
s.set("lap.web.user.readerNotes", "bad-json{{");
var bad = loadReaderNotes();
eq(bad.length, 0, "corrupted -> empty");

console.log("\n=== add/remove ===");
s.clear();
s.set("lap.web.user.readerNotes", JSON.stringify([ns[0]]));
var cur = loadReaderNotes();
eq(cur.length, 1, "starts with 1");
var n3 = { noteId: "n-3", bookId: "b3", chapterId: "c3", bookTitle: "T3", chapterTitle: "C3", progressRatio: 0.7, noteText: "Third note", excerptPreview: null, sourceType: "local", createdAt: "2026-01-03T00:00:00Z", updatedAt: "2026-01-03T00:00:00Z" };
var ad = addReaderNote(cur, n3);
persistReaderNotes(ad);
cur = loadReaderNotes();
eq(cur.length, 2, "added -> 2");
var rm = removeReaderNote(cur, "n-3");
persistReaderNotes(rm);
cur = loadReaderNotes();
eq(cur.length, 1, "removed -> 1");

console.log("\n=== noteText validation ===");
var v1 = validateNoteText("Hello world");
ok(v1.valid === true, "valid text passes");
var v2 = validateNoteText("a".repeat(1001));
ok(v2.valid === false, ">1000 blocked");
ok(v2.reason.includes("1000"), "reason mentions 1000");
var v3 = validateNoteText("");
ok(v3.valid === true, "empty string passes (length check is by char count)");
var v4 = validateNoteText("my secret token is here");
ok(v4.valid === false, "sensitive (token) blocked");

console.log("\n=== forbidden labels ===");
ok(hasForbiddenLabels(JSON.stringify(ns)) === false, "no forbidden labels");
ok(hasForbiddenLabels("生产笔记已保存") === true, "forbidden label detected");
ok(hasForbiddenLabels("真实用户笔记系统") === true, "forbidden label detected");

console.log("\n=== no leaks ===");
var all = ns.concat([n3]);
var js = JSON.stringify(all);
ok(js.includes("fullChapterContent") === false, "no fullChapterContent");
ok(js.includes("rawText") === false, "no rawText");
ok(js.includes("token") === false, "no token");
ok(js.includes("password") === false, "no password");

console.log("\n=== normalization ===");
eq(normalizeNoteText("a".repeat(1001)).length, 1000, "truncated to 1000");
eq(normalizeNoteText("short"), "short", "short unchanged");

console.log("\n=== validation ===");
var vn = { noteId: "x", bookId: "b", chapterId: "c", bookTitle: "T", chapterTitle: "CT", progressRatio: 0.5, noteText: "Hello", excerptPreview: null, sourceType: "s", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
ok(isValidReaderLocalNote(vn) === true, "valid note");
ok(isValidReaderLocalNote(Object.assign({}, vn, { noteId: "" })) === false, "empty noteId invalid");
ok(isValidReaderLocalNote(Object.assign({}, vn, { noteText: "a".repeat(1001) })) === false, "noteText too long invalid");
ok(isValidReaderLocalNote(Object.assign({}, vn, { noteText: "token: secret" })) === false, "sensitive noteText invalid");
ok(isValidReaderLocalNote(Object.assign({}, vn, { excerptPreview: "e".repeat(161) })) === false, "excerpt too long invalid");

console.log("\n" + passed + " pass / " + failed + " fail");
if (failures.length > 0) { console.log("\nFailures:"); failures.forEach(function(f) { console.log("  " + RED + f + RESET); }); }
process.exit(failed > 0 ? 1 : 0);
