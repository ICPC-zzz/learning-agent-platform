import { ok, strictEqual } from "node:assert";

var tests = [];
var passed = 0;
var failed = 0;

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function run() {
  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log("PASS: " + t.name);
    } catch (err) {
      failed++;
      console.error("FAIL: " + t.name + " - " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

const VM_URL = new URL("./daily-challenge-rules.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { selectDailyChallenge, recommendationIsSafe } = vm;

const SAMPLE_URL = new URL("../problems/sample-programming-problems.ts", import.meta.url).href;
const sampleMod = await import(SAMPLE_URL);
const SAMPLE_PROBLEMS = sampleMod.SAMPLE_PROBLEMS;

function makeWrongEntry(overrides) {
  return Object.assign({
    problemId: "lap-builtin-001", title: "Array Problem", difficulty: "easy",
    tags: ["array"], wrongCount: 1, reviewStatus: "needs-review",
  }, overrides || {});
}

function makeFavEntry(overrides) {
  return Object.assign({
    problemId: "lap-builtin-003", title: "Palindrome Problem", difficulty: "medium", tags: ["string"],
  }, overrides || {});
}

function makePracticeEntry(overrides) {
  return Object.assign({
    problemId: "lap-builtin-002", title: "Two Sum", difficulty: "easy",
    status: "completed", updatedAt: "2026-06-05T00:00:00.000Z",
  }, overrides || {});
}

function baseInput(overrides) {
  return Object.assign({
    sampleProblems: SAMPLE_PROBLEMS, wrongBookEntries: [], favoriteProblems: [],
    recentPractice: [], learningActivityCount: 0, dateString: "2026-06-11",
  }, overrides || {});
}

test("rules: same input same date returns same problem", function () {
  var input = baseInput({ wrongBookEntries: [makeWrongEntry()] });
  var r1 = selectDailyChallenge(input);
  var r2 = selectDailyChallenge(input);
  ok(r1 !== null);
  strictEqual(r1.problemId, r2.problemId);
  strictEqual(r1.recommendationSource, r2.recommendationSource);
});

test("rules: no data fallback to built-in", function () {
  var r = selectDailyChallenge(baseInput());
  ok(r !== null);
  ok(r.isBuiltIn);
});

test("rules: wrong book needs-review gets priority", function () {
  var r = selectDailyChallenge(baseInput({
    wrongBookEntries: [makeWrongEntry({ problemId: "wb-1", reviewStatus: "needs-review" })],
    favoriteProblems: [makeFavEntry()],
  }));
  ok(r !== null);
  strictEqual(r.recommendationSource, "wrong-book-needs-review");
});

test("rules: multiple needs-review picks highest wrongCount", function () {
  var r = selectDailyChallenge(baseInput({
    wrongBookEntries: [
      makeWrongEntry({ problemId: "wb-1", wrongCount: 1, reviewStatus: "needs-review" }),
      makeWrongEntry({ problemId: "wb-2", wrongCount: 5, reviewStatus: "needs-review" }),
    ],
  }));
  ok(r !== null);
  strictEqual(r.problemId, "wb-2");
});

test("rules: wrong book high count when no needs-review", function () {
  var r = selectDailyChallenge(baseInput({
    wrongBookEntries: [makeWrongEntry({ problemId: "wb-1", wrongCount: 3, reviewStatus: "reviewed" })],
  }));
  ok(r !== null);
  strictEqual(r.recommendationSource, "wrong-book-high-count");
});

test("rules: favorite not recently practiced", function () {
  var r = selectDailyChallenge(baseInput({
    favoriteProblems: [makeFavEntry({ problemId: "fav-1" })],
    recentPractice: [makePracticeEntry({ problemId: "other-1", updatedAt: "2026-06-10T00:00:00.000Z" })],
  }));
  ok(r !== null);
  strictEqual(r.recommendationSource, "favorite-not-recent");
});

test("rules: favorite recently practiced is skipped", function () {
  var r = selectDailyChallenge(baseInput({
    favoriteProblems: [makeFavEntry({ problemId: "fav-1" })],
    recentPractice: [makePracticeEntry({ problemId: "fav-1", updatedAt: "2026-06-10T00:00:00.000Z" })],
  }));
  ok(r !== null);
  ok(r.recommendationSource !== "favorite-not-recent");
});

test("rules: recent practice needs-review", function () {
  var r = selectDailyChallenge(baseInput({
    recentPractice: [makePracticeEntry({ problemId: "rp-1", status: "needs-review", updatedAt: "2026-06-10T00:00:00.000Z" })],
  }));
  ok(r !== null);
  strictEqual(r.recommendationSource, "recent-practice-needs-review");
});

test("rules: same date hash returns same built-in problem", function () {
  var r1 = selectDailyChallenge(baseInput({ dateString: "2026-06-01" }));
  var r2 = selectDailyChallenge(baseInput({ dateString: "2026-06-01" }));
  ok(r1 !== null && r2 !== null);
  strictEqual(r1.problemId, r2.problemId);
});

test("rules: different dates can return different built-in problems", function () {
  var r1 = selectDailyChallenge(baseInput({ dateString: "2026-06-01" }));
  var r2 = selectDailyChallenge(baseInput({ dateString: "2026-06-02" }));
  ok(r1 !== null && r2 !== null);
});

test("rules: empty sample problems returns null", function () {
  var r = selectDailyChallenge(baseInput({ sampleProblems: [] }));
  strictEqual(r, null);
});

test("rules: empty sample with wrong book still works", function () {
  var r = selectDailyChallenge(baseInput({
    sampleProblems: [],
    wrongBookEntries: [makeWrongEntry({ problemId: "wb-1", reviewStatus: "needs-review" })],
  }));
  ok(r !== null);
  strictEqual(r.recommendationSource, "wrong-book-needs-review");
});

test("rules: recommendationIsSafe passes clean reco", function () {
  var r = selectDailyChallenge(baseInput());
  var result = recommendationIsSafe(r);
  ok(result.safe, "Violations: " + JSON.stringify(result.violations));
});

test("rules: estimated minutes is positive", function () {
  var r = selectDailyChallenge(baseInput());
  ok(r.estimatedMinutes > 0);
});

test("rules: high count does not crash", function () {
  var r = selectDailyChallenge(baseInput({ learningActivityCount: 9999 }));
  ok(r !== null);
});

test("rules: priority chain wrong-book > favorite", function () {
  var r = selectDailyChallenge(baseInput({
    wrongBookEntries: [makeWrongEntry({ problemId: "wb-1", reviewStatus: "needs-review" })],
    favoriteProblems: [makeFavEntry({ problemId: "fav-1" })],
  }));
  strictEqual(r.recommendationSource, "wrong-book-needs-review");
});

test("rules: priority chain wrong-book-high > practice", function () {
  var r = selectDailyChallenge(baseInput({
    wrongBookEntries: [makeWrongEntry({ problemId: "wb-1", wrongCount: 5, reviewStatus: "reviewed" })],
    recentPractice: [makePracticeEntry({ problemId: "rp-1", status: "needs-review" })],
  }));
  strictEqual(r.recommendationSource, "wrong-book-high-count");
});

test("rules: priority chain favorite > practice", function () {
  var r = selectDailyChallenge(baseInput({
    favoriteProblems: [makeFavEntry({ problemId: "fav-1" })],
    recentPractice: [makePracticeEntry({ problemId: "rp-1", status: "needs-review" })],
  }));
  strictEqual(r.recommendationSource, "favorite-not-recent");
});

test("rules: recommendation has no sensitive fields", function () {
  var r = selectDailyChallenge(baseInput());
  var json = JSON.stringify(r).toLowerCase();
  ok(json.indexOf("database_url") === -1);
  ok(json.indexOf("token") === -1);
  ok(json.indexOf("secret") === -1);
});

run();
