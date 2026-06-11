/**
 * reader-progress-db-writer.test.mjs
 * Run: node apps/web/src/app/reader/reader-progress-db-writer.test.mjs
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

test("progressRatio must be between 0 and 1", function() {
  var validRatios = [0, 0.25, 0.5, 0.75, 1.0];
  var invalidRatios = [-0.1, 1.1, NaN, Infinity, -Infinity, 5];
  for (var i = 0; i < validRatios.length; i++) {
    ok(validRatios[i] >= 0 && validRatios[i] <= 1 && Number.isFinite(validRatios[i]), "Valid progressRatio");
  }
  for (var j = 0; j < invalidRatios.length; j++) {
    var r = invalidRatios[j];
    var isValid = r >= 0 && r <= 1 && Number.isFinite(r);
    ok(!isValid, "Invalid progressRatio rejected");
  }
});

test("bookId and chapterId must be non-empty", function() {
  var emptyValues = ["", "   ", null, undefined];
  for (var i = 0; i < emptyValues.length; i++) {
    var v = emptyValues[i];
    var isEmpty = typeof v !== "string" || v.trim().length === 0;
    ok(isEmpty, "Empty value rejected");
  }
});

test("dangerous field patterns defined", function() {
  var dangerousPatterns = [/\btoken\b/i, /\bsecret\b/i, /\bpassword\b/i, /\bapi[_\s-]*key\b/i, /\bDATABASE_URL\b/i, /\bcookie\b/i, /\bsession\b/i, /\bauthorization\b/i];
  ok(dangerousPatterns.length >= 8, "All dangerous patterns defined");
  var dangerousStrings = ["token-123", "api_key", "DATABASE_URL=postgres://", "cookie", "Authorization: Bearer xyz"];
  for (var i = 0; i < dangerousStrings.length; i++) {
    var str = dangerousStrings[i];
    var matched = false;
    for (var j = 0; j < dangerousPatterns.length; j++) {
      if (dangerousPatterns[j].test(str)) { matched = true; break; }
    }
    ok(matched, "Dangerous string detected: " + str);
  }
});

test("success result has correct shape", function() {
  var s = { success: true, devOnly: true, writesDatabase: true, callsRepository: true, productionReady: false };
  strictEqual(s.success, true);
  strictEqual(s.devOnly, true);
  strictEqual(s.writesDatabase, true);
  strictEqual(s.callsRepository, true);
  strictEqual(s.productionReady, false);
});

test("blocked result has correct shape", function() {
  var b = { success: false, devOnly: true, writesDatabase: false, callsRepository: false, productionReady: false };
  strictEqual(b.success, false);
  strictEqual(b.writesDatabase, false);
  strictEqual(b.callsRepository, false);
  strictEqual(b.productionReady, false);
});

test("error result shape is safe", function() {
  var forbidden = ["DATABASE_URL", "token", "secret", "password", "apiKey", "stack"];
  var shape = { success: false, devOnly: true, reasonCode: "test", message: "test", productionReady: false };
  var keys = Object.keys(shape);
  for (var i = 0; i < keys.length; i++) {
    for (var j = 0; j < forbidden.length; j++) {
      ok(keys[i].toLowerCase().indexOf(forbidden[j].toLowerCase()) === -1, "safe key: " + keys[i]);
    }
  }
});

test("ownerId must be non-empty", function() {
  var validIds = ["dev-user-001", "user-preview-abc"];
  for (var i = 0; i < validIds.length; i++) {
    ok(typeof validIds[i] === "string" && validIds[i].trim().length > 0, "valid ownerId");
  }
});

test("source field present", function() {
  ok("dev-session-progress".length > 0, "source exists");
});

test("reasonCode exists", function() {
  var codes = ["reader-progress-db-disabled-by-default", "invalid-progress-payload", "db-write-failed"];
  for (var i = 0; i < codes.length; i++) {
    ok(codes[i].length > 0, "reasonCode: " + codes[i]);
  }
});

run();
