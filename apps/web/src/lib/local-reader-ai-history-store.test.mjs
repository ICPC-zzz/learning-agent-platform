import * as HS from "./local-reader-ai-history-store.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var RESET="\x1b[0m";
var p=0;var f=0;var failures=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;failures.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);failures.push(m);console.log(RED+"  "+m+RESET);}}

var store = {};
globalThis.window = { localStorage: { getItem: function(k) { return store[k] || null; }, setItem: function(k,v) { store[k]=v; }, removeItem: function(k) { delete store[k]; } } };

function resetStore() { store = {}; }

var sampleEntry = {
  bookId: "book-1",
  chapterId: "ch-1",
  bookTitle: "Python Basics",
  chapterTitle: "Chapter 1: Variables",
  questionPreview: "What is a variable?",
  answerPreview: "A variable is a named storage location.",
  providerMode: "mock",
  realProviderCalled: false,
  sourceType: "reader-qa",
  codeBlockCount: 2,
  safeToExposeToClient: true,
};

console.log("\n--- Add entry ---");
resetStore();
var e1 = HS.addReaderAiHistoryEntry(sampleEntry);
a(e1 !== null, "entry added");
a(e1.historyId.startsWith("local-ai-hist-"), "historyId generated");
ae(e1.bookTitle, "Python Basics", "bookTitle preserved");
ae(e1.providerMode, "mock", "mode preserved");

console.log("\n--- List entries ---");
var list = HS.listReaderAiHistoryEntries();
a(list.length >= 1, "list has entries");

console.log("\n--- List by bookId ---");
var byBook = HS.listReaderAiHistoryEntries({ bookId: "book-1" });
ae(byBook.length, 1, "found by bookId");
var byWrong = HS.listReaderAiHistoryEntries({ bookId: "wrong" });
ae(byWrong.length, 0, "not found by wrong bookId");

console.log("\n--- List by chapter ---");
var byCh = HS.listReaderAiHistoryEntries({ chapterId: "ch-1" });
ae(byCh.length, 1, "found by chapterId");

console.log("\n--- List with limit ---");
HS.addReaderAiHistoryEntry({ ...sampleEntry, chapterId: "ch-2", chapterTitle: "Ch2" });
HS.addReaderAiHistoryEntry({ ...sampleEntry, chapterId: "ch-3", chapterTitle: "Ch3" });
var limited = HS.listReaderAiHistoryEntries({ limit: 2 });
ae(limited.length, 2, "limit 2 works");

console.log("\n--- Count ---");
var count = HS.getReaderAiHistoryCount();
a(count >= 3, "count >= 3");
var countByBook = HS.getReaderAiHistoryCount({ bookId: "book-1" });
ae(countByBook, 3, "count by book");

console.log("\n--- Remove entry ---");
var toRemove = HS.listReaderAiHistoryEntries()[0];
var removed = HS.removeReaderAiHistoryEntry(toRemove.historyId);
a(removed, "entry removed");
var after = HS.listReaderAiHistoryEntries();
ae(after.length, 2, "one fewer after remove");

console.log("\n--- Remove non-existent ---");
var notRemoved = HS.removeReaderAiHistoryEntry("nonexistent");
a(!notRemoved, "non-existent not removed");

console.log("\n--- Clear all ---");
var cleared = HS.clearReaderAiHistory();
a(cleared >= 1, "entries cleared");
ae(HS.listReaderAiHistoryEntries().length, 0, "empty after clear");

console.log("\n--- Clear by scope ---");
resetStore();
HS.addReaderAiHistoryEntry({ ...sampleEntry, bookId: "b1", chapterId: "c1" });
HS.addReaderAiHistoryEntry({ ...sampleEntry, bookId: "b1", chapterId: "c2" });
HS.addReaderAiHistoryEntry({ ...sampleEntry, bookId: "b2", chapterId: "c3" });
var cByCh = HS.clearReaderAiHistory({ chapterId: "c1" });
ae(cByCh, 1, "cleared 1 by chapter");
ae(HS.listReaderAiHistoryEntries().length, 2, "2 remaining");
var cByBook = HS.clearReaderAiHistory({ bookId: "b1" });
ae(cByBook, 1, "cleared 1 by book");
ae(HS.listReaderAiHistoryEntries().length, 1, "1 remaining");

console.log("\n--- Question preview truncation ---");
resetStore();
var longQ = { ...sampleEntry, questionPreview: "x".repeat(300) };
var eq = HS.addReaderAiHistoryEntry(longQ);
ae(eq.questionPreview.length, 200, "question truncated to 200");

console.log("\n--- Answer preview truncation ---");
var longA = { ...sampleEntry, answerPreview: "y".repeat(600) };
var ea = HS.addReaderAiHistoryEntry(longA);
ae(ea.answerPreview.length, 500, "answer truncated to 500");

console.log("\n--- No raw prompt/response stored ---");
resetStore();
var fields = JSON.stringify(HS.listReaderAiHistoryEntries());
a(fields.indexOf("rawPrompt") < 0, "no rawPrompt in entries");
a(fields.indexOf("rawResponse") < 0, "no rawResponse in entries");

console.log("\n--- Dangerous fields blocked ---");
resetStore();
var bad = { ...sampleEntry, token: "abc", questionPreview: "q", answerPreview: "a" };
var eb = HS.addReaderAiHistoryEntry(bad);
a(eb === null, "entry with dangerous field blocked");

console.log("\n--- Missing required fields ---");
resetStore();
var eNull1 = HS.addReaderAiHistoryEntry({ ...sampleEntry, questionPreview: "" });
a(eNull1 === null, "empty question blocked");
var eNull2 = HS.addReaderAiHistoryEntry({ ...sampleEntry, bookId: "" });
a(eNull2 === null, "empty bookId blocked");

console.log("\n--- Store status ---");
resetStore();
HS.addReaderAiHistoryEntry(sampleEntry);
var status = HS.getAiHistoryStoreStatus();
a(status.available, "store available");
ae(status.storeKey, "lap.web.reader.aiHistory", "correct key");
ae(status.entryCount, 1, "correct count");
a(status.notice.indexOf("raw prompt") > 0, "notice mentions raw prompt");

console.log("\n--- JSON corruption fallback ---");
resetStore();
globalThis.window.localStorage.setItem("lap.web.reader.aiHistory", "not valid json{");
var afterCorrupt = HS.listReaderAiHistoryEntries();
a(Array.isArray(afterCorrupt), "returns array after corruption");
ae(afterCorrupt.length, 0, "empty after corruption");

console.log("\n"+"=".repeat(40));
console.log("Local history: "+p+" pass / "+f+" fail");
if(failures.length>0){for(var fi=0;fi<failures.length;fi++)console.log("  "+failures[fi]);}
process.exit(f>0?1:0);
