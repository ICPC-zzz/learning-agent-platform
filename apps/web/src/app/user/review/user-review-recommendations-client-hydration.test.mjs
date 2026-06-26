/**
 * Tests for UserReviewRecommendationsClientHydration — view model integration tests.
 *
 * Run: node apps/web/src/app/user/review/user-review-recommendations-client-hydration.test.mjs
 */

import { buildReviewRecommendationsView, reviewRecommendationsViewIsSafe } from "./user-review-recommendations-view-model.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    console.error("FAIL: " + name + " — " + e.message);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg || "assertEqual failed") + ": expected " + b + ", got " + a);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("review hydration: empty data produces 0 recommendations", function () {
  var view = buildReviewRecommendationsView({
    hasSession: true,
    wrongBookEntries: [],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assertEqual(view.totalCount, 0);
  assertEqual(view.recommendations.length, 0);
  assert(view.message.includes("暂无足够数据"), "should mention no data");
});

test("review hydration: wrong book needs-review generates recommendations", function () {
  var view = buildReviewRecommendationsView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Two Sum", difficulty: "easy", tags: [], wrongCount: 3, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
      { wrongBookId: "wb-2", problemId: "p2", title: "Add Two Numbers", difficulty: "medium", tags: [], wrongCount: 2, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assertEqual(view.totalCount, 2);
  assertEqual(view.recommendations[0].priority, 1);
  assertEqual(view.recommendations[0].sourceType, "wrong-book");
});

test("review hydration: recommendations are deterministic from same input", function () {
  var input = {
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 3, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentPractice: [],
    recentReading: [
      { bookId: "b1", chapterId: "c1", bookTitle: "B", chapterTitle: "Ch1", progressRatio: 0.5, lastReadAt: new Date().toISOString(), sourceType: "local" },
    ],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  };
  var view1 = buildReviewRecommendationsView(input);
  var view2 = buildReviewRecommendationsView(input);
  assertEqual(view1.totalCount, view2.totalCount);
  // Compare without recommendationId (which uses a sequential counter)
  var stripped1 = view1.recommendations.map(function(r) { var c = Object.assign({}, r); delete c.recommendationId; return c; });
  var stripped2 = view2.recommendations.map(function(r) { var c = Object.assign({}, r); delete c.recommendationId; return c; });
  assertEqual(JSON.stringify(stripped1), JSON.stringify(stripped2));
});

test("review hydration: each recommendation has safety label", function () {
  var view = buildReviewRecommendationsView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 5, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.totalCount > 0);
  for (var i = 0; i < view.recommendations.length; i++) {
    assert(view.recommendations[i].safetyLabel.length > 0, "rec " + i + " missing safety label");
    assert(view.recommendations[i].safetyLabel.includes("规则型推荐"), "rec " + i + " should mention 规则型推荐");
  }
});

test("review hydration: safety check passes on valid output", function () {
  var view = buildReviewRecommendationsView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  var safetyCheck = reviewRecommendationsViewIsSafe(view);
  assert(safetyCheck.safe, "view should be safe");
  assertEqual(safetyCheck.violations.length, 0);
});

test("review hydration: data source notice is present", function () {
  var view = buildReviewRecommendationsView({
    hasSession: true,
    wrongBookEntries: [
      { wrongBookId: "wb-1", problemId: "p1", title: "Q1", difficulty: "easy", tags: [], wrongCount: 1, lastWrongAt: new Date().toISOString(), reviewStatus: "needs-review", notePreview: null, sourceType: "local" },
    ],
    recentPractice: [],
    recentReading: [],
    bookmarks: [],
    notes: [],
    aiHistory: [],
    favoriteProblems: [],
  });
  assert(view.dataSourceNotice.includes("规则型推荐"));
  assert(view.dataSourceNotice.includes("未调用 LLM"));
  assert(view.dataSourceNotice.includes("未接生产账号"));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("--- user-review-recommendations-client-hydration.test.mjs ---");
console.log("pass: " + pass);
console.log("fail: " + fail);
if (fail > 0) process.exitCode = 1;
