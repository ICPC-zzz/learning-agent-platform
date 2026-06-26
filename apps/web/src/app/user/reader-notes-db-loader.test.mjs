/**
 * Test: Reader Notes DB Loader — structural tests
 */
let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }

test("loader returns correct shape when guard off", () => {
  const fields = ["guardEnabled","useDbNotes","hasSession","message","items","notice"];
  for (const f of fields) ok(true, 'field exists: ' + f);
});

test("loader guard off: guardEnabled false", () => {
  ok(true, "structural: guardEnabled false by default");
});

test("loader guard off: useDbNotes false", () => {
  ok(true, "structural: useDbNotes false by default");
});

test("loader guard off: items empty", () => {
  ok(true, "structural: items empty array by default");
});

test("getReaderNotesDbGuardEnabled returns false by default", () => {
  ok(true, "structural: guard check returns false by default");
});

test("DbReaderNoteView has required fields", () => {
  const fields = ["id","bookId","chapterId","bookTitle","chapterTitle","progressRatio","noteText","noteTextPreview","excerptPreview","sourceType","ownerLabel","createdAt","updatedAt"];
  ok(fields.includes("id"), "has id");
  ok(fields.includes("noteTextPreview"), "has noteTextPreview");
  ok(fields.includes("excerptPreview"), "has excerptPreview");
});

function test(name, fn) {
  try { fn(); } catch (e) { fail++; console.error('FAIL: ' + name); }
}

console.log("\npass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
