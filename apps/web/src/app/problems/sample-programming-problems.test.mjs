import assert from "node:assert/strict";
import test from "node:test";

const MOD_URL = new URL("./sample-programming-problems.ts", import.meta.url).href;
const mod = await import(MOD_URL);
const {
  SAMPLE_PROBLEMS,
  SAMPLE_PROBLEM_COUNT,
  SAMPLE_DIFFICULTY_COUNTS,
  ALL_SAMPLE_TAGS,
  SAMPLE_TAG_COUNT,
  sampleProblemDataIsSafe,
  allProblemsHaveRequiredFields,
} = mod;

// ---- Problem count ----

test("sample problems count >= 8", () => {
  assert.ok(SAMPLE_PROBLEM_COUNT >= 8, `Expected >= 8, got ${SAMPLE_PROBLEM_COUNT}`);
});

test("sample problems count matches array length", () => {
  assert.equal(SAMPLE_PROBLEM_COUNT, SAMPLE_PROBLEMS.length);
});

// ---- Required fields ----

test("all problems have required fields", () => {
  const result = allProblemsHaveRequiredFields(SAMPLE_PROBLEMS);
  assert.ok(result.valid, result.missing.join("; "));
});

// ---- Source type ----

test("all problems have sourceType built-in-sample", () => {
  for (const p of SAMPLE_PROBLEMS) {
    assert.equal(p.sourceType, "built-in-sample", `${p.problemId}: wrong sourceType`);
  }
});

// ---- Unique IDs ----

test("all problem IDs are unique", () => {
  const ids = SAMPLE_PROBLEMS.map((p) => p.problemId);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size);
});

// ---- Tags ----

test("all problems have non-empty tags", () => {
  for (const p of SAMPLE_PROBLEMS) {
    assert.ok(Array.isArray(p.tags), `${p.problemId}: tags not array`);
    assert.ok(p.tags.length > 0, `${p.problemId}: empty tags`);
  }
});

test("ALL_SAMPLE_TAGS is sorted and deduped", () => {
  assert.ok(Array.isArray(ALL_SAMPLE_TAGS));
  for (let i = 1; i < ALL_SAMPLE_TAGS.length; i++) {
    assert.ok(ALL_SAMPLE_TAGS[i] > ALL_SAMPLE_TAGS[i - 1], `Tags not sorted: ${ALL_SAMPLE_TAGS[i]}`);
  }
  const unique = new Set(ALL_SAMPLE_TAGS);
  assert.equal(ALL_SAMPLE_TAGS.length, unique.size);
});

test("SAMPLE_TAG_COUNT matches ALL_SAMPLE_TAGS", () => {
  assert.equal(SAMPLE_TAG_COUNT, ALL_SAMPLE_TAGS.length);
});

// ---- Difficulty counts ----

test("difficulty counts sum to total", () => {
  const sum = Object.values(SAMPLE_DIFFICULTY_COUNTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, SAMPLE_PROBLEM_COUNT);
});

test("difficulty counts have valid keys", () => {
  const validKeys = ["easy", "medium", "hard", "challenge"];
  for (const k of Object.keys(SAMPLE_DIFFICULTY_COUNTS)) {
    assert.ok(validKeys.includes(k), `Invalid difficulty key: ${k}`);
  }
});

// ---- Examples ----

test("all problems have at least one example", () => {
  for (const p of SAMPLE_PROBLEMS) {
    assert.ok(Array.isArray(p.examples), `${p.problemId}: examples not array`);
    assert.ok(p.examples.length > 0, `${p.problemId}: no examples`);
    for (const ex of p.examples) {
      assert.ok(typeof ex.input === "string" && ex.input.length > 0, `${p.problemId}: example missing input`);
      assert.ok(typeof ex.output === "string" && ex.output.length > 0, `${p.problemId}: example missing output`);
    }
  }
});

// ---- Hints ----

test("all problems have at least one hint", () => {
  for (const p of SAMPLE_PROBLEMS) {
    assert.ok(Array.isArray(p.hints), `${p.problemId}: hints not array`);
    assert.ok(p.hints.length > 0, `${p.problemId}: no hints`);
  }
});

// ---- estimatedMinutes ----

test("all problems have positive estimatedMinutes", () => {
  for (const p of SAMPLE_PROBLEMS) {
    assert.ok(p.estimatedMinutes > 0, `${p.problemId}: estimatedMinutes <= 0`);
  }
});

// ---- Safety ----

test("sample problem data is safe — no sensitive fields", () => {
  const result = sampleProblemDataIsSafe(SAMPLE_PROBLEMS);
  assert.ok(result.safe, result.violations.join("; "));
});

test("no forbidden labels in problem data", () => {
  const json = JSON.stringify(SAMPLE_PROBLEMS);
  assert.ok(!json.includes("LeetCode"));
  assert.ok(!json.includes("Luogu"));
  assert.ok(!json.includes("Codeforces"));
  assert.ok(!json.includes("真实判题已接入"));
  assert.ok(!json.includes("生产同步成功"));
  assert.ok(!json.includes("云端保存完成"));
  assert.ok(!json.includes("OJ 已接入"));
});
