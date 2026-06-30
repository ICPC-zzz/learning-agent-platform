import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { deriveJudgeTestCasesFromProblemSource, normalizeJudgeTestCases } = await tsImport(
  "../../lib/problem-judge.ts",
  import.meta.url,
);

test("deriveJudgeTestCasesFromProblemSource prefers explicit judge cases", () => {
  const result = deriveJudgeTestCasesFromProblemSource({
    judgeTestCases: [{ input: "1\n", output: "2\n" }],
    examples: [{ input: "3\n", output: "4\n" }],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].input, "1\n");
  assert.equal(result[0].expectedOutput, "2\n");
});

test("deriveJudgeTestCasesFromProblemSource falls back to examples", () => {
  const result = deriveJudgeTestCasesFromProblemSource({
    examples: [{ input: "5\n", output: "6\n" }],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].input, "5\n");
  assert.equal(result[0].expectedOutput, "6\n");
});

test("normalizeJudgeTestCases ignores incomplete entries", () => {
  const result = normalizeJudgeTestCases([
    { input: "7\n", output: "8\n" },
    { input: "missing-output\n" },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].input, "7\n");
  assert.equal(result[0].expectedOutput, "8\n");
});

test("normalizeJudgeTestCases accepts VJudge and NekoACM field aliases", () => {
  const result = normalizeJudgeTestCases([
    { sample_input: "9\n", sample_output: "10\n" },
    { test_input: "11\n", test_output: "12\n" },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].input, "9\n");
  assert.equal(result[0].expectedOutput, "10\n");
  assert.equal(result[1].input, "11\n");
  assert.equal(result[1].expectedOutput, "12\n");
});
