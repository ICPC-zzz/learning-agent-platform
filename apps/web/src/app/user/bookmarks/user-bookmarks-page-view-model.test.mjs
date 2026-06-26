/**
 * Test: User Bookmarks Page View Model — structural tests
 */
let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }
function eq(a, e, l) { if (a === e) pass++; else { fail++; console.error('FAIL: ' + l); } }

const VM_URL = new URL("./user-bookmarks-page-view-model.ts", import.meta.url).href;
const { buildBookmarksPageViewModel } = await import(VM_URL);

// Empty
const e = buildBookmarksPageViewModel({ dbItems: null, dbEnabled: false, hasSession: false, dbMessage: "disabled", localItems: [] });
eq(e.dataSource, "none", "empty: none");
eq(e.totalCount, 0, "empty: 0");
eq(e.isDevOnly, true, "empty: devOnly");
eq(e.productionReady, false, "empty: not prod");

// DB
const di = { id: "1", bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "C", progressRatio: 0.5, sourceType: "B", sourceLabel: "db", ownerLabel: "u", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const dv = buildBookmarksPageViewModel({ dbItems: [di], dbEnabled: true, hasSession: true, dbMessage: "", localItems: [] });
eq(dv.dataSource, "db", "db: source");
eq(dv.items.length, 1, "db: count");
eq(dv.items[0].sourceLabel, "db", "db: label");

// Local
const li = { bookmarkId: "l1", bookId: "b2", chapterId: "c2", bookTitle: "L", chapterTitle: "C", progressRatio: 0.3, sourceType: "I", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const lv = buildBookmarksPageViewModel({ dbItems: null, dbEnabled: false, hasSession: false, dbMessage: "", localItems: [li] });
eq(lv.dataSource, "local", "local: source");

// DB preferred
const bv = buildBookmarksPageViewModel({ dbItems: [di], dbEnabled: true, hasSession: true, dbMessage: "", localItems: [li] });
eq(bv.dataSource, "db", "both: DB preferred");

// No forbidden labels
ok(!JSON.stringify(dv).includes("生产可用"), "no forbidden label");
ok(!JSON.stringify(dv).includes("云端同步"), "no cloud sync");

console.log("\npass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
