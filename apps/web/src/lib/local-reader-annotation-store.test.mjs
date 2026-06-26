let pass = 0, fail = 0;
function ok(a, l) { if (a) pass++; else { fail++; console.error('FAIL: ' + l); } }
function eq(a, e, l) { if (a === e) pass++; else { fail++; console.error('FAIL: ' + l); } }
const STORE_URL = new URL("./local-reader-annotation-store.ts", import.meta.url).href;
const mod = await import(STORE_URL);
const x = mod;

ok(!x.hasSensitiveFields({bookmarkId:"1"}), "sensitive: clean");
ok(x.hasSensitiveFields({token:"abc"}), "sensitive: token");
ok(x.hasSensitiveFields({DATABASE_URL:"x"}), "sensitive: DATABASE_URL");
ok(x.hasSensitiveFields({fullChapterContent:"x"}), "sensitive: fullChapterContent");
ok(x.hasSensitiveFields({rawText:"x"}), "sensitive: rawText");
eq(x.validateNoteText("hello").valid, true, "validateNoteText: valid");
eq(x.validateNoteText("a".repeat(1001)).valid, false, "validateNoteText: too long");
eq(x.validateNoteText("a".repeat(1000)).valid, true, "validateNoteText: 1000 ok");
eq(x.normalizeNoteText("a".repeat(2000)).length, 1000, "normalizeNoteText");
eq(x.normalizeExcerptPreview(null), null, "excerpt: null");
eq(x.normalizeExcerptPreview("a".repeat(200)).length, 160, "excerpt: trim");

const id1 = x.generateAnnotationId("n");
ok(typeof id1 === "string" && id1.startsWith("n-"), "generateAnnotationId");
eq(x.buildStableBookmarkId("a","b"), x.buildStableBookmarkId("a","b"), "stable idempotent");

const vb = {bookmarkId:"bm-1",bookId:"b1",chapterId:"c1",bookTitle:"BT",chapterTitle:"CT",progressRatio:0.5,sourceType:"BUILTIN",createdAt:"2026-06-10T00:00:00.000Z",updatedAt:"2026-06-10T00:00:00.000Z"};
ok(x.isValidReaderLocalBookmark(vb), "valid bookmark");
ok(!x.isValidReaderLocalBookmark(null), "bookmark: null");
ok(!x.isValidReaderLocalBookmark({...vb,bookmarkId:""}), "bookmark: empty id");
ok(!x.isValidReaderLocalBookmark({...vb,progressRatio:1.5}), "bookmark: ratio>1");
ok(!x.isValidReaderLocalBookmark({...vb,progressRatio:-0.1}), "bookmark: ratio<0");
ok(!x.isValidReaderLocalBookmark({...vb,token:"x"}), "bookmark: sensitive");

const vn = {noteId:"n-1",bookId:"b1",chapterId:"c1",bookTitle:"BT",chapterTitle:"CT",progressRatio:0.3,noteText:"hello",excerptPreview:"ex",sourceType:"BUILTIN",createdAt:"2026-06-10T00:00:00.000Z",updatedAt:"2026-06-10T00:00:00.000Z"};
ok(x.isValidReaderLocalNote(vn), "valid note");
ok(!x.isValidReaderLocalNote({...vn,noteText:"a".repeat(1001)}), "note: too long");
ok(!x.isValidReaderLocalNote({...vn,excerptPreview:"a".repeat(161)}), "note: excerpt too long");
ok(x.isValidReaderLocalNote({...vn,excerptPreview:null}), "note: null ok");
ok(!x.isValidReaderLocalNote({...vn,rawText:"secret"}), "note: sensitive");

const b1 = {...vb,bookmarkId:"bm-1"};
const b2 = {...vb,bookmarkId:"bm-2",chapterId:"c2"};
eq(x.addReaderBookmark([],b1).length,1,"add bookmark");
eq(x.addReaderBookmark([b1],b2).length,2,"add bookmark diff");
eq(x.addReaderBookmark([b1],{...b1,progressRatio:0.8}).length,1,"add bookmark idempotent");
eq(x.removeReaderBookmark([b1,b2],"bm-1").length,1,"remove bookmark");
eq(x.removeReaderBookmarkByChapter([b1,b2],"b1","c1").length,1,"remove chapter");
ok(x.isReaderBookmarked([b1],"b1","c1"), "isBookmarked");
ok(!x.isReaderBookmarked([b1],"b1","none"), "not bookmarked");

const n1 = {...vn,noteId:"n-1"};
const n2 = {...vn,noteId:"n-2",chapterId:"c2"};
eq(x.addReaderNote([],n1).length,1,"add note");
eq(x.addReaderNote([n1],n2).length,2,"add note multiple");
eq(x.updateReaderNote([n1],"n-1",{noteText:"updated"})[0].noteText,"updated","update note");
eq(x.updateReaderNote([n1],"n-1",{noteText:"a".repeat(2000)})[0].noteText.length,1000,"update note trim");
eq(x.removeReaderNote([n1,n2],"n-1").length,1,"remove note");
eq(x.getReaderNotesByChapter([n1,n2],"b1","c1").length,1,"get notes");

ok(!x.hasForbiddenLabels("clean"), "forbidden: clean");
ok(x.hasForbiddenLabels("云端同步成功"), "forbidden: detected");
ok(x.hasForbiddenLabels("生产笔记已保存"), "forbidden: prod note");

console.log("pass: " + pass + "  fail: " + fail);
if (fail > 0) process.exitCode = 1;
