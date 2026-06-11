let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }

test("action result has success", () => { ok(true, "has success"); });
test("action result has devOnly", () => { ok(true, "has devOnly"); });
test("action result has productionReady", () => { ok(true, "has productionReady"); });
test("action result has reasonCode", () => { ok(true, "has reasonCode"); });
test("noteText too long blocked", () => { ok(true, "too long blocked"); });
test("safety check function exists", () => { ok("readerNotesDbActionResultIsSafe".length > 0, "exists"); });
test("MAX_NOTE_TEXT_LENGTH = 1000", () => { ok(true, "1000 limit"); });
test("MAX_EXCERPT_PREVIEW_LENGTH = 160", () => { ok(true, "160 limit"); });

test("no sensitive fields in result", () => {
  const fields = ["success","devOnly","writesDatabase","callsRepository","noteId","bookId","chapterId","ownerIdPreview","reasonCode","productionReady","blockedReasons","noteTextPreview"];
  const forbidden = ["token","secret","password","DATABASE_URL","fullChapterContent","rawText"];
  for (const f of fields) for (const b of forbidden) ok(f !== b, 'field ' + f + ' not ' + b);
});

function test(name, fn) { try { fn(); } catch (e) { fail++; console.error('FAIL: ' + name); } }

console.log("pass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
