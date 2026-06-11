import assert from "node:assert/strict";
import test from "node:test";

var MOD_URL = new URL("./recent-practice-page-view-model.ts", import.meta.url).href;
var mod = await import(MOD_URL);
var buildRecentPracticePageViewModel = mod.buildRecentPracticePageViewModel;
var recentPracticePageViewModelIsSafe = mod.recentPracticePageViewModelIsSafe;

function makeLocalPractice(overrides) {
  if (!overrides) overrides = {};
  return Object.assign({
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "easy",
    status: "practiced",
    updatedAt: new Date().toISOString(),
  }, overrides);
}

function makeDbPractice(overrides) {
  if (!overrides) overrides = {};
  return Object.assign({
    problemId: "p-db-1",
    problemTitle: "DB Practice",
    difficulty: "medium",
    status: "completed",
    updatedAt: new Date().toISOString(),
    source: "db-practice",
    ownerLabel: "dev user",
    notice: "dev-only",
  }, overrides);
}

test("DB practice takes priority over local", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [makeDbPractice()],
    dbPracticeEnabled: true,
    localPractice: [makeLocalPractice()],
    hasSession: true,
  });
  assert.equal(vm.sourceType, "db");
  assert.equal(vm.count, 1);
  assert.equal(vm.items[0].source, "db-practice");
});

test("DB disabled uses local", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [makeDbPractice()],
    dbPracticeEnabled: false,
    localPractice: [makeLocalPractice()],
    hasSession: true,
  });
  assert.equal(vm.sourceType, "local");
  assert.equal(vm.count, 1);
  assert.equal(vm.items[0].source, "local-practice");
});

test("DB enabled but empty falls to empty", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [],
    dbPracticeEnabled: true,
    localPractice: [],
    hasSession: true,
  });
  assert.equal(vm.sourceType, "empty");
  assert.equal(vm.count, 0);
});

test("empty when no data", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [],
    dbPracticeEnabled: false,
    localPractice: [],
    hasSession: false,
  });
  assert.equal(vm.sourceType, "empty");
  assert.equal(vm.count, 0);
});

test("empty with session shows guidance", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [],
    dbPracticeEnabled: false,
    localPractice: [],
    hasSession: true,
  });
  assert.equal(vm.sourceType, "empty");
  assert.ok(vm.message.indexOf("暂无") >= 0);
});

test("status labels are human-readable", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [makeDbPractice({ status: "needs-review" })],
    dbPracticeEnabled: true,
    localPractice: [],
    hasSession: true,
  });
  assert.equal(vm.items[0].statusLabel, "需要复习");
});

test("view model is safe", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [makeDbPractice()],
    dbPracticeEnabled: true,
    localPractice: [],
    hasSession: true,
  });
  assert.ok(recentPracticePageViewModelIsSafe(vm));
});

test("view model has no misleading labels", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [makeDbPractice()],
    dbPracticeEnabled: true,
    localPractice: [],
    hasSession: true,
  });
  var json = JSON.stringify(vm);
  assert.ok(json.indexOf("真实判题已接入") < 0);
  assert.ok(json.indexOf("生产同步成功") < 0);
  assert.ok(json.indexOf("云端保存完成") < 0);
});

test("multiple practice items", function () {
  var vm = buildRecentPracticePageViewModel({
    dbPractice: [],
    dbPracticeEnabled: false,
    localPractice: [
      makeLocalPractice({ problemId: "p-1" }),
      makeLocalPractice({ problemId: "p-2" }),
      makeLocalPractice({ problemId: "p-3" }),
    ],
    hasSession: true,
  });
  assert.equal(vm.count, 3);
});
