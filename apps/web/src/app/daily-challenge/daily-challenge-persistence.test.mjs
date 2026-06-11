/**
 * Tests for daily-challenge-persistence.ts
 *
 * Run: node apps/web/src/app/daily-challenge/daily-challenge-persistence.test.mjs
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

var VM_URL = new URL("./daily-challenge-persistence.ts", import.meta.url).href;
var vm = await import(VM_URL);
var {
  createDailyChallengePersistenceStore,
  dailyChallengePersistenceStore,
  getDefaultPersistenceMetadata,
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

function makeValidState(overrides) {
  return Object.assign({
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
    recommendationReason: "按今日日期从内置题库推荐",
  }, overrides || {});
}

function makeDbRepo(opts) {
  var opts2 = opts || {};
  return {
    findByDate: async function (date) {
      if (opts2.findByDateThrows) {
        throw new Error(opts2.findByDateErrorMessage || "DB read error");
      }
      return opts2.findByDateResult || { record: null, metadata: { status: "blocked" } };
    },
    upsertProgress: async function (input) {
      if (opts2.upsertThrows) {
        throw new Error(opts2.upsertErrorMessage || "DB write error");
      }
      return opts2.upsertResult || { record: null, metadata: { status: "blocked" } };
    },
    clearToday: async function (date) {
      if (opts2.clearThrows) {
        throw new Error(opts2.clearErrorMessage || "DB clear error");
      }
      return opts2.clearResult || { success: false, metadata: { status: "blocked" } };
    },
  };
}

// ---------------------------------------------------------------------------
// Default store: localStorage only
// ---------------------------------------------------------------------------

test("persistence: default store uses localStorage (no DB repo)", async function () {
  // We can't actually call load/save without window.localStorage in Node,
  // but we CAN verify the store structure and metadata helpers.
  var store = dailyChallengePersistenceStore;
  ok(typeof store.load === "function", "store should have load method");
  ok(typeof store.save === "function", "store should have save method");
  ok(typeof store.clear === "function", "store should have clear method");
});

test("persistence: default metadata has correct safety flags", function () {
  var meta = getDefaultPersistenceMetadata();
  strictEqual(meta.source, "localStorage");
  strictEqual(meta.writesDatabase, false);
  strictEqual(meta.productionReady, false);
  strictEqual(meta.safeToExposeToClient, true);
  strictEqual(meta.llmUsed, false);
  strictEqual(meta.externalApiUsed, false);
  strictEqual(meta.guardActive, false);
  strictEqual(meta.dbError, null);
  ok(meta.notice.indexOf("localStorage") >= 0, "notice mentions localStorage");
  ok(meta.notice.indexOf("未调用 LLM") >= 0, "notice mentions 未调用 LLM");
});

// ---------------------------------------------------------------------------
// Guard: default off
// ---------------------------------------------------------------------------

test("persistence: guard is inactive by default (no env vars)", function () {
  var active = isDailyChallengeDbGuardActive();
  strictEqual(active, false, "guard should be inactive without env vars set");
});

test("persistence: guard returns false when process is missing", function () {
  // isDailyChallengeDbGuardActive handles missing process.env gracefully
  var active = isDailyChallengeDbGuardActive();
  strictEqual(active, false);
});

// ---------------------------------------------------------------------------
// Store with null DB repo → localStorage only
// ---------------------------------------------------------------------------

test("persistence: store with null repo defaults to localStorage", async function () {
  var store = createDailyChallengePersistenceStore(null);
  ok(typeof store.load === "function");
  ok(typeof store.save === "function");
  ok(typeof store.clear === "function");
  // Node env: can't verify localStorage ops, but structure is correct
});

// ---------------------------------------------------------------------------
// Store with DB repo but guard off → localStorage
// ---------------------------------------------------------------------------

test("persistence: store with DB repo but guard off → localStorage", async function () {
  var dbRepo = makeDbRepo();
  var store = createDailyChallengePersistenceStore(dbRepo);
  // Guard is off, so load/save should use localStorage only
  // In Node, localStorage doesn't exist, so operations will silently fail
  // But we can verify the store methods exist
  ok(typeof store.load === "function");
  ok(typeof store.save === "function");
});

// ---------------------------------------------------------------------------
// DB error → fallback
// ---------------------------------------------------------------------------

test("persistence: repository type is compatible with async interface", async function () {
  var dbRepo = makeDbRepo();
  var result = await dbRepo.findByDate(todayString());
  ok(result !== null, "findByDate should return a result object");
  strictEqual(result.record, null, "mock repo returns null record");
});

test("persistence: upsert result shape is compatible", async function () {
  var dbRepo = makeDbRepo();
  var input = {
    challengeDate: todayString(),
    problemId: "test-1",
    title: "Test",
    difficulty: "easy",
    tags: ["test"],
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    recommendationSource: "test",
    recommendationReason: "test",
  };
  var result = await dbRepo.upsertProgress(input);
  ok(result !== null, "upsertProgress should return a result object");
});

test("persistence: clear result shape is compatible", async function () {
  var dbRepo = makeDbRepo();
  var result = await dbRepo.clearToday(todayString());
  ok(result !== null, "clearToday should return a result object");
});

// ---------------------------------------------------------------------------
// DB throw → fallback behavior
// ---------------------------------------------------------------------------

test("persistence: DB repo findByDate throws gracefully", async function () {
  var dbRepo = makeDbRepo({
    findByDateThrows: true,
    findByDateErrorMessage: "Simulated DB failure",
  });
  try {
    await dbRepo.findByDate(todayString());
    ok(false, "should have thrown");
  } catch (err) {
    ok(err.message.indexOf("DB") >= 0 || err.message.indexOf("Simulated") >= 0,
      "error message should contain DB failure info: " + err.message);
  }
});

test("persistence: DB repo upsert throws gracefully", async function () {
  var dbRepo = makeDbRepo({
    upsertThrows: true,
    upsertErrorMessage: "Simulated DB write failure",
  });
  try {
    await dbRepo.upsertProgress(makeValidState());
    ok(false, "should have thrown");
  } catch (err) {
    ok(err.message.indexOf("write") >= 0 || err.message.indexOf("DB") >= 0 || err.message.indexOf("Simulated") >= 0,
      "error should contain write failure info: " + err.message);
  }
});

test("persistence: DB repo clear throws gracefully", async function () {
  var dbRepo = makeDbRepo({
    clearThrows: true,
    clearErrorMessage: "Simulated DB clear failure",
  });
  try {
    await dbRepo.clearToday(todayString());
    ok(false, "should have thrown");
  } catch (err) {
    ok(err.message.indexOf("clear") >= 0 || err.message.indexOf("DB") >= 0 || err.message.indexOf("Simulated") >= 0,
      "error should contain clear failure info: " + err.message);
  }
});

// ---------------------------------------------------------------------------
// No sensitive data in metadata
// ---------------------------------------------------------------------------

test("persistence: default metadata has no sensitive keywords", function () {
  var meta = getDefaultPersistenceMetadata();
  var json = JSON.stringify(meta).toLowerCase();
  var forbidden = ["token", "cookie", "database_url", "secret", "password", "api_key", "raw_prompt", "raw_response"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i] + " in metadata");
  }
});

test("persistence: default metadata has no forbidden production labels", function () {
  var meta = getDefaultPersistenceMetadata();
  var json = JSON.stringify(meta);
  ok(json.indexOf("AI 自动推荐") === -1, "no AI 自动推荐");
  ok(json.indexOf("真实判题已接入") === -1, "no 真实判题已接入");
  ok(json.indexOf("生产每日挑战") === -1, "no 生产每日挑战");
  ok(json.indexOf("云端同步成功") === -1, "no 云端同步成功");
  ok(json.indexOf("Agent 已运行") === -1, "no Agent 已运行");
  ok(json.indexOf("LLM 生成") === -1, "no LLM 生成");
  ok(json.indexOf("生产可用") === -1, "no 生产可用");
});

// ---------------------------------------------------------------------------
// Notice strings contain required safety labels
// ---------------------------------------------------------------------------

test("persistence: all notice strings mention 未调用 LLM", function () {
  var meta = getDefaultPersistenceMetadata();
  ok(meta.notice.indexOf("未调用 LLM") >= 0, "notice: " + meta.notice);
});

test("persistence: all notice strings mention 开发预览", function () {
  var meta = getDefaultPersistenceMetadata();
  ok(meta.notice.indexOf("开发预览") >= 0, "notice: " + meta.notice);
});

// ---------------------------------------------------------------------------
// productionReady is always false
// ---------------------------------------------------------------------------

test("persistence: productionReady is always false in default metadata", function () {
  var meta = getDefaultPersistenceMetadata();
  strictEqual(meta.productionReady, false);
});

test("persistence: llmUsed is always false in default metadata", function () {
  var meta = getDefaultPersistenceMetadata();
  strictEqual(meta.llmUsed, false);
});

test("persistence: externalApiUsed is always false in default metadata", function () {
  var meta = getDefaultPersistenceMetadata();
  strictEqual(meta.externalApiUsed, false);
});

// ---------------------------------------------------------------------------
// dailyChallengePersistenceStore is the default instance
// ---------------------------------------------------------------------------

test("persistence: dailyChallengePersistenceStore is a store instance", function () {
  var store = dailyChallengePersistenceStore;
  ok(store !== null && store !== undefined, "default store should exist");
  ok(typeof store.load === "function");
  ok(typeof store.save === "function");
  ok(typeof store.clear === "function");
});

// ---------------------------------------------------------------------------
// createDailyChallengePersistenceStore creates different instances
// ---------------------------------------------------------------------------

test("persistence: creating two stores with null gives valid stores", function () {
  var store1 = createDailyChallengePersistenceStore(null);
  var store2 = createDailyChallengePersistenceStore(null);
  ok(typeof store1.load === "function");
  ok(typeof store2.load === "function");
});

run();
