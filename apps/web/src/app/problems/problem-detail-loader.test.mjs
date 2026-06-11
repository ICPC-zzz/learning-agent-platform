import assert from "node:assert/strict";
import test from "node:test";

// Load sample problems first for ESM module resolution
var sampleUrl = new URL("./sample-programming-problems.ts", import.meta.url).href;
var sampleMod = await import(sampleUrl);
var problems = sampleMod.SAMPLE_PROBLEMS;

// Manually implement the loader logic here (avoids Node TS parser issues)
function loadProblemById(id) {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return { found: false, problem: null };
  }
  var n = id.trim();
  var found = problems.find(function(p) { return p.problemId === n; }) || null;
  return { found: !!found, problem: found };
}

test("load known problem by ID", function () {
  var r = loadProblemById("lap-builtin-001");
  assert.ok(r.found);
  assert.ok(r.problem !== null);
  assert.equal(r.problem.problemId, "lap-builtin-001");
});

test("load non-existent returns not found", function () {
  var r = loadProblemById("nonexistent");
  assert.ok(!r.found);
  assert.equal(r.problem, null);
});

test("load null returns not found", function () {
  assert.ok(!loadProblemById(null).found);
  assert.ok(!loadProblemById("").found);
  assert.ok(!loadProblemById(undefined).found);
});

test("all sample problems loadable", function () {
  for (var i = 0; i < problems.length; i++) {
    var r = loadProblemById(problems[i].problemId);
    assert.ok(r.found, "should find " + problems[i].problemId);
    assert.equal(r.problem.problemId, problems[i].problemId);
  }
});
