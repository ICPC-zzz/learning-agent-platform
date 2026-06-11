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

const VM_URL = new URL("./local-daily-challenge-store.ts", import.meta.url).href;
const vm = await import(VM_URL);
const {
  isValidDailyChallengeState,
  isValidDailyChallengeStatus,
  createDailyChallenge,
  startChallenge,
  completeChallenge,
  markChallengeNeedsReview,
  resetChallenge,
  getTodayDateString,
  hasSensitiveFields,
  hasForbiddenLabels,
  dailyChallengeStateIsLabelSafe,
} = vm;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides) {
  return Object.assign({
    challengeDate: getTodayDateString(),
    problemId: "lap-builtin-001",
    title: "Maximum Subarray Sum",
    difficulty: "easy",
    tags: ["array", "sliding-window"],
    status: "not-started",
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    recommendationSource: "builtin-fallback",
    recommendationReason: "From built-in fallback",
  }, overrides || {});
}

// ---------------------------------------------------------------------------
// Status validation
// ---------------------------------------------------------------------------

test("store: valid statuses accepted", function () {
  ok(isValidDailyChallengeStatus("not-started"));
  ok(isValidDailyChallengeStatus("in-progress"));
  ok(isValidDailyChallengeStatus("completed"));
  ok(isValidDailyChallengeStatus("needs-review"));
});

test("store: invalid statuses rejected", function () {
  ok(!isValidDailyChallengeStatus("pending"));
  ok(!isValidDailyChallengeStatus("started"));
  ok(!isValidDailyChallengeStatus(""));
  ok(!isValidDailyChallengeStatus(null));
  ok(!isValidDailyChallengeStatus(undefined));
  ok(!isValidDailyChallengeStatus(123));
});

// ---------------------------------------------------------------------------
// State validation
// ---------------------------------------------------------------------------

test("store: valid state passes validation", function () {
  var state = makeState();
  ok(isValidDailyChallengeState(state));
});

test("store: state with missing problemId rejected", function () {
  var state = makeState({ problemId: "" });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with invalid status rejected", function () {
  var state = makeState({ status: "invalid-status" });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with empty tags rejected", function () {
  var state = makeState({ tags: [] });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with too many tags rejected", function () {
  var state = makeState({ tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"] });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with sensitive fields rejected", function () {
  var state = makeState({ recommendationReason: "contains api_key secret token" });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with DATABASE_URL rejected", function () {
  var state = makeState({ title: "DATABASE_URL=postgres://" });
  ok(hasSensitiveFields({ title: state.title }));
  ok(!isValidDailyChallengeState(state));
});

test("store: state with completedAt before startedAt rejected", function () {
  var state = makeState({
    startedAt: "2026-06-11T12:00:00.000Z",
    completedAt: "2026-06-11T10:00:00.000Z",
  });
  ok(!isValidDailyChallengeState(state));
});

test("store: state with completedAt after startedAt accepted", function () {
  var state = makeState({
    startedAt: "2026-06-11T10:00:00.000Z",
    completedAt: "2026-06-11T12:00:00.000Z",
    status: "completed",
  });
  ok(isValidDailyChallengeState(state));
});

// ---------------------------------------------------------------------------
// createDailyChallenge
// ---------------------------------------------------------------------------

test("store: createDailyChallenge sets correct defaults", function () {
  var state = createDailyChallenge({
    problemId: "p-1",
    title: "Test Problem",
    difficulty: "easy",
    tags: ["arrays"],
    recommendationSource: "builtin-fallback",
    recommendationReason: "Test reason",
  });
  strictEqual(state.problemId, "p-1");
  strictEqual(state.status, "not-started");
  strictEqual(state.startedAt, null);
  strictEqual(state.completedAt, null);
  strictEqual(state.challengeDate, getTodayDateString());
  ok(state.updatedAt.length > 0);
  ok(isValidDailyChallengeState(state));
});

// ---------------------------------------------------------------------------
// Status mutations
// ---------------------------------------------------------------------------

test("store: startChallenge sets in-progress and startedAt", function () {
  var state = makeState();
  var updated = startChallenge(state);
  strictEqual(updated.status, "in-progress");
  ok(updated.startedAt !== null, "startedAt should be set");
  ok(new Date(updated.startedAt).getTime() > 0);
});

test("store: completeChallenge sets completed and completedAt", function () {
  var state = makeState();
  var started = startChallenge(state);
  var completed = completeChallenge(started);
  strictEqual(completed.status, "completed");
  ok(completed.completedAt !== null, "completedAt should be set");
});

test("store: markChallengeNeedsReview sets needs-review", function () {
  var state = makeState();
  var updated = markChallengeNeedsReview(state);
  strictEqual(updated.status, "needs-review");
});

test("store: resetChallenge returns to not-started", function () {
  var state = makeState();
  var started = startChallenge(state);
  var completed = completeChallenge(started);
  var reset = resetChallenge(completed);
  strictEqual(reset.status, "not-started");
  strictEqual(reset.startedAt, null);
  strictEqual(reset.completedAt, null);
});

// ---------------------------------------------------------------------------
// JSON corruption / safe fallback
// ---------------------------------------------------------------------------

test("store: hasSensitiveFields detects api_key", function () {
  ok(hasSensitiveFields({ api_key: "test" }));
  ok(hasSensitiveFields({ some: { nested: { token: "x" } } }));
});

test("store: hasSensitiveFields rejects null/undefined", function () {
  ok(!hasSensitiveFields(null));
  ok(!hasSensitiveFields(undefined));
});

test("store: hasSensitiveFields rejects clean data", function () {
  ok(!hasSensitiveFields({ problemId: "p-1", title: "hello" }));
});

// ---------------------------------------------------------------------------
// Forbidden labels
// ---------------------------------------------------------------------------

test("store: hasForbiddenLabels detects production labels", function () {
  ok(hasForbiddenLabels("AI 自动推荐内容"));
  ok(hasForbiddenLabels("真实判题已接入"));
  ok(hasForbiddenLabels("生产每日挑战上线"));
  ok(hasForbiddenLabels("云端同步成功啦"));
  ok(hasForbiddenLabels("Agent 已运行任务"));
});

test("store: hasForbiddenLabels rejects safe text", function () {
  ok(!hasForbiddenLabels("规则生成每日挑战"));
  ok(!hasForbiddenLabels("未调用 LLM"));
  ok(!hasForbiddenLabels("确定性规则推荐"));
});

test("store: dailyChallengeStateIsLabelSafe flags forbidden labels", function () {
  var state = makeState({ recommendationReason: "AI 自动推荐每日挑战" });
  var result = dailyChallengeStateIsLabelSafe(state);
  ok(!result.safe);
  ok(result.violations.length > 0);
});

test("store: dailyChallengeStateIsLabelSafe passes clean state", function () {
  var state = makeState();
  var result = dailyChallengeStateIsLabelSafe(state);
  ok(result.safe);
});

// ---------------------------------------------------------------------------
// Date string
// ---------------------------------------------------------------------------

test("store: getTodayDateString returns YYYY-MM-DD format", function () {
  var d = getTodayDateString();
  ok(/^\d{4}-\d{2}-\d{2}$/.test(d), "Expected YYYY-MM-DD, got: " + d);
});

// ---------------------------------------------------------------------------
// User code / sensitive content not saved
// ---------------------------------------------------------------------------

test("store: state with submittedCode is rejected", function () {
  var state = makeState({ recommendationReason: "submittedCode: xyz" });
  ok(!isValidDailyChallengeState(state), "submittedCode should be rejected");
});

test("store: state with userSubmittedCode is rejected", function () {
  var state = makeState({ title: "userSubmittedCode here" });
  ok(hasSensitiveFields({ title: state.title }), "userSubmittedCode should trigger sensitive check");
  ok(!isValidDailyChallengeState(state));
});

test("store: state with raw prompt is rejected", function () {
  var state = makeState({ recommendationReason: "raw_prompt: some text" });
  ok(hasSensitiveFields({ reason: state.recommendationReason }));
  ok(!isValidDailyChallengeState(state));
});

test("store: state with raw response is rejected", function () {
  var state = makeState({ title: "raw_response: data" });
  ok(hasSensitiveFields({ title: state.title }));
  ok(!isValidDailyChallengeState(state));
});

test("store: state with judgeOutput is rejected", function () {
  var state = makeState({ recommendationReason: "judgeOutput: AC" });
  ok(!isValidDailyChallengeState(state), "judgeOutput should be rejected");
});

test("store: state with rawJudgeOutput is rejected", function () {
  var state = makeState({ title: "rawJudgeOutput" });
  ok(hasSensitiveFields({ title: state.title }));
  ok(!isValidDailyChallengeState(state));
});

// ---------------------------------------------------------------------------
// Tags truncation
// ---------------------------------------------------------------------------

test("store: createDailyChallenge truncates tags to max", function () {
  var manyTags = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"];
  var state = createDailyChallenge({
    problemId: "p-1",
    title: "Test",
    difficulty: "easy",
    tags: manyTags,
    recommendationSource: "test",
    recommendationReason: "test",
  });
  ok(state.tags.length <= 10, "Tags truncated to max 10, got " + state.tags.length);
});

// ---------------------------------------------------------------------------
// Invalid status blocked
// ---------------------------------------------------------------------------

test("store: setting invalid status via object is rejected", function () {
  var state = makeState({ status: "not-a-valid-status" });
  ok(!isValidDailyChallengeState(state));
});

run();
