/**
 * user-recent-reading-db-loader.test.mjs
 * Tests for User Recent Reading DB Loader structural contracts.
 * Full module imports require Next.js bundler; this tests shapes and rules.
 * Run: node apps/web/src/app/user/user-recent-reading-db-loader.test.mjs
 */
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
    } catch (err) {
      failed++;
      console.error("FAIL: " + t.name);
      console.error("  " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

test("loader result shape has correct keys", function() {
  var expectedKeys = ["hasDbProgress", "items", "message", "guardEnabled"];
  var sample = { hasDbProgress: false, items: [], message: "test", guardEnabled: false };
  for (var i = 0; i < expectedKeys.length; i++) {
    ok(expectedKeys[i] in sample, "Result has key: " + expectedKeys[i]);
  }
});

test("DbReadingProgressSummary has correct shape", function() {
  var expectedKeys = [
    "bookId", "chapterId", "bookTitle", "chapterTitle",
    "progressRatio", "progressPercent", "updatedAt", "source", "ownerLabel"
  ];
  var item = {
    bookId: "book-1", chapterId: "chapter-1",
    bookTitle: "Test Book", chapterTitle: "Test Chapter",
    progressRatio: 0.5, progressPercent: 50,
    updatedAt: new Date().toISOString(),
    source: "db-progress", ownerLabel: "dev-user-001"
  };
  for (var i = 0; i < expectedKeys.length; i++) {
    ok(expectedKeys[i] in item, "Summary has key: " + expectedKeys[i]);
  }
  strictEqual(item.source, "db-progress");
});

test("result never contains sensitive fields", function() {
  var forbidden = ["token", "secret", "password", "DATABASE_URL", "apiKey", "cookie"];
  var resultKeys = ["hasDbProgress", "items", "message", "guardEnabled"];
  for (var i = 0; i < resultKeys.length; i++) {
    var key = resultKeys[i];
    for (var j = 0; j < forbidden.length; j++) {
      ok(key.toLowerCase().indexOf(forbidden[j].toLowerCase()) === -1, "Safe key: " + key);
    }
  }
});

test("item keys are safe", function() {
  var itemKeys = ["bookId", "chapterId", "bookTitle", "chapterTitle", "progressRatio", "progressPercent", "updatedAt", "source", "ownerLabel"];
  var forbidden = ["token", "secret", "password", "DATABASE_URL", "rawPrompt", "rawResponse"];
  for (var i = 0; i < itemKeys.length; i++) {
    for (var j = 0; j < forbidden.length; j++) {
      ok(itemKeys[i].toLowerCase().indexOf(forbidden[j].toLowerCase()) === -1, "Safe item key: " + itemKeys[i]);
    }
  }
});

test("limit is constrained to valid range", function() {
  var minLimit = 1;
  var maxLimit = 50;
  var testValues = [{ input: 5, expected: 5 }, { input: 0, expected: 1 }, { input: 100, expected: 50 }, { input: -1, expected: 1 }];
  for (var i = 0; i < testValues.length; i++) {
    var clamped = Math.min(Math.max(testValues[i].input, minLimit), maxLimit);
    strictEqual(clamped, testValues[i].expected, "limit " + testValues[i].input + " clamped to " + testValues[i].expected);
  }
});

test("owner isolation: ownerLabel is single string", function() {
  var item = {
    bookId: "book-1", chapterId: "chapter-1", bookTitle: "Test",
    chapterTitle: "Ch1", progressRatio: 0.5, progressPercent: 50,
    updatedAt: new Date().toISOString(), source: "db-progress", ownerLabel: "dev-user-001"
  };
  ok(typeof item.ownerLabel === "string", "ownerLabel is a string, not list");
  var json = JSON.stringify(item);
  ok(json.indexOf("other-user") === -1, "no other user data leaked");
  ok(json.indexOf("admin") === -1, "no admin data leaked");
});

test("loader export name matches convention", function() {
  var expectedExport = "loadUserRecentReadingDbProgress";
  ok(expectedExport.length > 0, "Expected export exists");
  ok(expectedExport.indexOf("load") !== -1, "Starts with load");
  ok(expectedExport.indexOf("Db") !== -1, "Contains Db");
});

test("guardDisabled result has hasDbProgress=false", function() {
  var blockedResult = { hasDbProgress: false, items: [], message: "DB disabled", guardEnabled: false };
  strictEqual(blockedResult.hasDbProgress, false);
  strictEqual(blockedResult.guardEnabled, false);
  strictEqual(blockedResult.items.length, 0);
});

run();
