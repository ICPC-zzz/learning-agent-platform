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

const VM_URL = new URL("./daily-challenge-view-model.ts", import.meta.url).href;
const vm = await import(VM_URL);
const {
  buildDailyChallengePageView,
  buildDailyChallengeSummary,
  dailyChallengeViewIsSafe,
  dailyChallengeSummaryIsSafe,
} = vm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecommendation(overrides) {
  return Object.assign({
    problemId: "lap-builtin-001",
    title: "Maximum Subarray Sum",
    difficulty: "easy",
    tags: ["array", "sliding-window"],
    estimatedMinutes: 10,
    recommendationSource: "builtin-date-hash",
    recommendationReason: "按今日日期从内置题库推荐",
    isBuiltIn: true,
  }, overrides || {});
}

function makeState(overrides) {
  return Object.assign({
    challengeDate: "2026-06-11",
    problemId: "lap-builtin-001",
    title: "Maximum Subarray Sum",
    difficulty: "easy",
    tags: ["array", "sliding-window"],
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-06-11T00:00:00.000Z",
    recommendationSource: "builtin-date-hash",
    recommendationReason: "按今日日期从内置题库推荐",
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Page view model — normal states
// ---------------------------------------------------------------------------

test("vm: new challenge view (no state yet)", function () {
  var view = buildDailyChallengePageView({
    challengeState: null,
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  ok(view.hasChallenge);
  strictEqual(view.challengeState, null);
  strictEqual(view.statusLabel, "未开始");
  ok(view.availableActions.length > 0, "Should have start action");
  ok(view.relatedLinks.length > 0);
  strictEqual(view.isError, false);
});

test("vm: active challenge in-progress", function () {
  var state = makeState({ status: "in-progress" });
  var view = buildDailyChallengePageView({
    challengeState: state,
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  strictEqual(view.statusLabel, "进行中");
  // Should have complete, needs-review, reset actions
  ok(view.availableActions.length >= 2);
});

test("vm: completed challenge", function () {
  var state = makeState({ status: "completed" });
  var view = buildDailyChallengePageView({
    challengeState: state,
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  strictEqual(view.statusLabel, "已完成");
});

test("vm: needs-review challenge", function () {
  var state = makeState({ status: "needs-review" });
  var view = buildDailyChallengePageView({
    challengeState: state,
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  strictEqual(view.statusLabel, "需要复习");
});

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

test("vm: error view with message", function () {
  var view = buildDailyChallengePageView({
    challengeState: null,
    recommendation: null,
    hasError: true,
    errorMessage: "Something went wrong",
  });
  strictEqual(view.isError, true);
  strictEqual(view.statusLabel, "错误");
  strictEqual(view.hasChallenge, false);
  ok(view.relatedLinks.length > 0, "Should have fallback links");
});

test("vm: no recommendation but no state", function () {
  var view = buildDailyChallengePageView({
    challengeState: null,
    recommendation: null,
    hasError: false,
    errorMessage: null,
  });
  strictEqual(view.isError, true);
});

// ---------------------------------------------------------------------------
// Safety notices
// ---------------------------------------------------------------------------

test("vm: safety notices include required content", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var noticesText = view.safetyNotices.join(" ");
  ok(noticesText.indexOf("开发预览") >= 0, "Should include 开发预览");
  ok(noticesText.indexOf("未调用 LLM") >= 0, "Should include 未调用 LLM");
  ok(noticesText.indexOf("规则生成") >= 0, "Should include 规则生成");
});

test("vm: data source notice mentions no LLM", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  ok(view.dataSourceNotice.indexOf("未调用 LLM") >= 0);
  ok(view.dataSourceNotice.indexOf("未接真实判题") >= 0);
});

// ---------------------------------------------------------------------------
// Related links
// ---------------------------------------------------------------------------

test("vm: related links include problem detail", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation({ problemId: "lap-builtin-001" }),
    hasError: false,
    errorMessage: null,
  });
  var problemLink = view.relatedLinks.filter(function (l) { return l.label === "题目详情"; });
  ok(problemLink.length > 0);
  ok(problemLink[0].href.indexOf("lap-builtin-001") >= 0);
});

test("vm: related links include today plan and wrong book", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var labels = view.relatedLinks.map(function (l) { return l.label; });
  ok(labels.indexOf("今日计划") >= 0);
  ok(labels.indexOf("错题本") >= 0);
  ok(labels.indexOf("复习推荐") >= 0);
  ok(labels.indexOf("题目中心") >= 0);
});

// ---------------------------------------------------------------------------
// Actions for different statuses
// ---------------------------------------------------------------------------

test("vm: not-started has start action", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState({ status: "not-started" }),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var startAction = view.availableActions.filter(function (a) { return a.actionId === "start"; });
  strictEqual(startAction.length, 1);
});

test("vm: in-progress has complete and needs-review actions", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState({ status: "in-progress" }),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var actionIds = view.availableActions.map(function (a) { return a.actionId; });
  ok(actionIds.indexOf("complete") >= 0);
  ok(actionIds.indexOf("needs-review") >= 0);
});

// ---------------------------------------------------------------------------
// View safety
// ---------------------------------------------------------------------------

test("vm: view is safe for normal view", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var result = dailyChallengeViewIsSafe(view);
  ok(result.safe, "Violations: " + JSON.stringify(result.violations));
});

test("vm: view has no forbidden labels", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var json = JSON.stringify(view);
  ok(json.indexOf("AI 自动推荐") === -1);
  ok(json.indexOf("真实判题已接入") === -1);
  ok(json.indexOf("生产每日挑战") === -1);
  ok(json.indexOf("云端同步成功") === -1);
  ok(json.indexOf("Agent 已运行") === -1);
  ok(json.indexOf("LLM 生成") === -1);
  ok(json.indexOf("生产可用") === -1);
});

test("vm: view has no sensitive fields", function () {
  var view = buildDailyChallengePageView({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
    hasError: false,
    errorMessage: null,
  });
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["database_url", "token", "secret", "password", "cookie", "api_key", "rawprompt", "rawresponse"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

// ---------------------------------------------------------------------------
// Summary view
// ---------------------------------------------------------------------------

test("vm: summary for active challenge", function () {
  var summary = buildDailyChallengeSummary({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
  });
  ok(summary.hasChallenge);
  strictEqual(summary.title, "Maximum Subarray Sum");
  strictEqual(summary.href, "/daily-challenge");
  ok(summary.sourceNotice.indexOf("未调用 LLM") >= 0);
});

test("vm: summary for no challenge", function () {
  var summary = buildDailyChallengeSummary({
    challengeState: null,
    recommendation: null,
  });
  ok(!summary.hasChallenge);
  strictEqual(summary.title, null);
  strictEqual(summary.href, "/daily-challenge");
});

test("vm: summary is safe", function () {
  var summary = buildDailyChallengeSummary({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
  });
  var result = dailyChallengeSummaryIsSafe(summary);
  ok(result.safe, "Violations: " + JSON.stringify(result.violations));
});

test("vm: summary has no production labels", function () {
  var summary = buildDailyChallengeSummary({
    challengeState: makeState(),
    recommendation: makeRecommendation(),
  });
  var json = JSON.stringify(summary);
  ok(json.indexOf("AI 自动推荐") === -1);
  ok(json.indexOf("生产每日挑战") === -1);
});

run();
