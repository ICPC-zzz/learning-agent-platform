/**
 * Tests for daily-challenge-progress-repository.ts
 *
 * Run: node packages/db/src/repositories/daily-challenge-progress-repository.test.mjs
 */

import { ok, strictEqual, deepStrictEqual } from "node:assert";

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

// Import via relative path since this test file is in the same directory
var VM_URL = new URL("./daily-challenge-progress-repository.ts", import.meta.url).href;
var vm = await import(VM_URL);
var {
  createDailyChallengeProgressRepository,
  getDailyChallengeProgressRepository,
  isDailyChallengeDbGuardActive,
} = vm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var todayString = function () {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, "0");
  var d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
};

function makeUpsertInput() {
  return {
    challengeDate: todayString(),
    problemId: "lap-builtin-001",
    title: "Maximum Subarray Sum",
    difficulty: "easy",
    tags: ["array", "sliding-window"],
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    recommendationSource: "builtin-date-hash",
    recommendationReason: "Test reason",
  };
}

// ---------------------------------------------------------------------------
// Guard: default off
// ---------------------------------------------------------------------------

test("repo: guard is inactive by default", function () {
  var active = isDailyChallengeDbGuardActive();
  strictEqual(active, false, "guard should be inactive without env vars");
});

// ---------------------------------------------------------------------------
// Repository creation
// ---------------------------------------------------------------------------

test("repo: createDailyChallengeProgressRepository returns an object", function () {
  var repo = createDailyChallengeProgressRepository();
  ok(repo !== null && typeof repo === "object", "should return a repository object");
  ok(typeof repo.findByDate === "function", "should have findByDate");
  ok(typeof repo.upsertProgress === "function", "should have upsertProgress");
  ok(typeof repo.clearToday === "function", "should have clearToday");
});

test("repo: getDailyChallengeProgressRepository returns singleton", function () {
  var repo1 = getDailyChallengeProgressRepository();
  var repo2 = getDailyChallengeProgressRepository();
  ok(repo1 === repo2, "should return the same singleton instance");
});

// ---------------------------------------------------------------------------
// findByDate: always returns null record with blocked metadata
// ---------------------------------------------------------------------------

test("repo: findByDate returns null record with blocked metadata", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  ok(result !== null && result !== undefined, "should return a result");
  strictEqual(result.record, null, "should return null record (skeleton mode)");
  ok(result.metadata !== undefined, "should have metadata");

  var meta = result.metadata;
  strictEqual(meta.productionReady, false);
  strictEqual(meta.llmUsed, false);
  strictEqual(meta.externalApiUsed, false);
  strictEqual(meta.safeToExposeToClient, true);
  strictEqual(meta.writesDatabase, false);
  ok(meta.status === "blocked" || meta.status === "preview",
    "status should be blocked or preview, got: " + meta.status);
});

test("repo: findByDate metadata has blocked status in v1", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  strictEqual(result.metadata.status, "blocked",
    "v1 skeleton should always be blocked");
});

// ---------------------------------------------------------------------------
// upsertProgress: does not write to DB
// ---------------------------------------------------------------------------

test("repo: upsertProgress returns null record with blocked metadata", async function () {
  var repo = createDailyChallengeProgressRepository();
  var input = makeUpsertInput();
  var result = await repo.upsertProgress(input);
  ok(result !== null, "should return a result");
  strictEqual(result.record, null, "should return null record (skeleton, no real write)");

  var meta = result.metadata;
  strictEqual(meta.writesDatabase, false, "should not write to database");
  strictEqual(meta.productionReady, false);
  strictEqual(meta.llmUsed, false);
  strictEqual(meta.externalApiUsed, false);
  strictEqual(meta.safeToExposeToClient, true);
});

test("repo: upsertProgress does not write DB even with valid input", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.upsertProgress(makeUpsertInput());
  strictEqual(result.metadata.writesDatabase, false,
    "DB writes should always be false in skeleton");
});

// ---------------------------------------------------------------------------
// clearToday: does not delete from DB
// ---------------------------------------------------------------------------

test("repo: clearToday returns failed with blocked metadata", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.clearToday(todayString());
  ok(result !== null, "should return a result");
  strictEqual(result.success, false, "should not succeed in skeleton mode");

  var meta = result.metadata;
  strictEqual(meta.writesDatabase, false);
  strictEqual(meta.productionReady, false);
  strictEqual(meta.llmUsed, false);
});

// ---------------------------------------------------------------------------
// Metadata safety
// ---------------------------------------------------------------------------

test("repo: result metadata has no sensitive keywords", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  var json = JSON.stringify(result.metadata).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password", "api_key", "raw_prompt", "raw_response"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i] + " in repo metadata");
  }
});

test("repo: result metadata has no forbidden production labels", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  var json = JSON.stringify(result.metadata);
  var labels = ["AI 自动推荐", "真实判题已接入", "生产每日挑战", "云端同步成功", "Agent 已运行", "生产可用"];
  for (var i = 0; i < labels.length; i++) {
    ok(json.indexOf(labels[i]) === -1, "No " + labels[i]);
  }
});

// ---------------------------------------------------------------------------
// Blocked reasons are populated
// ---------------------------------------------------------------------------

test("repo: blocked reasons are non-empty for skeleton repo", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  ok(result.metadata.blockedReasons.length > 0,
    "blocked reasons should be non-empty: " + JSON.stringify(result.metadata.blockedReasons));
});

// ---------------------------------------------------------------------------
// Multiple calls return consistent results
// ---------------------------------------------------------------------------

test("repo: multiple findByDate calls return consistent blocked results", async function () {
  var repo = createDailyChallengeProgressRepository();
  var r1 = await repo.findByDate(todayString());
  var r2 = await repo.findByDate(todayString());
  strictEqual(r1.record, r2.record, "both should return null");
  strictEqual(r1.metadata.writesDatabase, r2.metadata.writesDatabase);
  strictEqual(r1.metadata.productionReady, r2.metadata.productionReady);
  strictEqual(r1.metadata.llmUsed, r2.metadata.llmUsed);
  strictEqual(r1.metadata.externalApiUsed, r2.metadata.externalApiUsed);
});

test("repo: multiple upsert calls return consistent blocked results", async function () {
  var repo = createDailyChallengeProgressRepository();
  var input = makeUpsertInput();
  var r1 = await repo.upsertProgress(input);
  var r2 = await repo.upsertProgress(input);
  strictEqual(r1.metadata.writesDatabase, false);
  strictEqual(r2.metadata.writesDatabase, false);
});

// ---------------------------------------------------------------------------
// No sensitive fields in blocked reasons
// ---------------------------------------------------------------------------

test("repo: blocked reasons contain no sensitive keywords", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  var reasons = result.metadata.blockedReasons.join(" ");
  var sensitive = ["DATABASE_URL=", "token=", "secret=", "password=", "api_key="];
  for (var i = 0; i < sensitive.length; i++) {
    ok(reasons.indexOf(sensitive[i]) === -1,
      "Blocked reasons should not contain " + sensitive[i] + ": " + reasons);
  }
});

test("repo: blocked reasons reference env var names but not values", async function () {
  var repo = createDailyChallengeProgressRepository();
  var result = await repo.findByDate(todayString());
  var reasons = result.metadata.blockedReasons.join(" ");
  ok(reasons.indexOf("LAP_DAILY_CHALLENGE_DB_DEV_ENABLED") >= 0
    || reasons.indexOf("PROCESS_ENV_UNAVAILABLE") >= 0,
    "should mention env var name or environment unavailability");
});

run();
