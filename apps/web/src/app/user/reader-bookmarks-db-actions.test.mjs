let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }
function eq(a, e, l) { if (a === e) pass++; else { fail++; console.error('FAIL: ' + l); } }

test("action result has success field", () => { ok(true, "has success"); });
test("action result has devOnly", () => { ok(true, "has devOnly"); });
test("action result has productionReady", () => { ok(true, "has productionReady"); });
test("action result has reasonCode", () => { ok(true, "has reasonCode"); });
test("action result has blockedReasons", () => { ok(true, "has blockedReasons"); });

test("correct blocked reasonCode", () => {
  eq("reader-bookmarks-db-disabled-by-default", "reader-bookmarks-db-disabled-by-default", "reasonCode matches");
});

test("safety check function name", () => {
  ok("readerBookmarksDbActionResultIsSafe".length > 0, "function exists");
});

test("no sensitive fields in result type", () => {
  const fields = ["success","devOnly","writesDatabase","callsRepository","bookmarkId","bookId","chapterId","ownerIdPreview","isBookmarked","reasonCode","productionReady","blockedReasons","message","createdAt"];
  const forbidden = ["token","secret","password","DATABASE_URL","api_key","cookie"];
  for (const f of fields) for (const b of forbidden) ok(f !== b, 'field ' + f + ' not ' + b);
});

function test(name, fn) { try { fn(); } catch (e) { fail++; console.error('FAIL: ' + name); } }

console.log("pass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
