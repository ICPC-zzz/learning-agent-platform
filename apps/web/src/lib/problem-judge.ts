import type { JudgeTestCase } from "./judge/judge-types";

export interface ProblemExampleLike {
  input?: unknown;
  output?: unknown;
  sampleInput?: unknown;
  sampleOutput?: unknown;
  sample_input?: unknown;
  sample_output?: unknown;
  testInput?: unknown;
  testOutput?: unknown;
  test_input?: unknown;
  test_output?: unknown;
  explanation?: unknown;
  label?: unknown;
}

export interface ProblemJudgeCaseSource {
  judgeTestCases?: readonly ProblemExampleLike[] | null | undefined;
  examples?: readonly ProblemExampleLike[] | null | undefined;
  maxCount?: number;
}

export function normalizeJudgeTestCases(
  examples: readonly ProblemExampleLike[] | null | undefined,
  maxCount = 20,
): JudgeTestCase[] {
  if (!Array.isArray(examples) || maxCount <= 0) {
    return [];
  }

  const result: JudgeTestCase[] = [];

  for (let i = 0; i < examples.length && result.length < maxCount; i += 1) {
    const example = examples[i];
    if (!example || typeof example !== "object") {
      continue;
    }

    const input = resolveJudgeExampleInput(example);
    const expectedOutput = resolveJudgeExampleOutput(example);
    if (input === null || expectedOutput === null) {
      continue;
    }

    const caseItem: JudgeTestCase = {
      input,
      expectedOutput,
    };

    if (typeof example.explanation === "string" && example.explanation.length > 0) {
      caseItem.explanation = example.explanation;
    }

    if (typeof example.label === "string" && example.label.length > 0) {
      caseItem.label = example.label;
    }

    result.push(caseItem);
  }

  return result;
}

function resolveJudgeExampleInput(example: ProblemExampleLike): string | null {
  return (
    (typeof example.input === "string" && example.input) ||
    (typeof example.sampleInput === "string" && example.sampleInput) ||
    (typeof example.sample_input === "string" && example.sample_input) ||
    (typeof example.testInput === "string" && example.testInput) ||
    (typeof example.test_input === "string" && example.test_input) ||
    null
  );
}

function resolveJudgeExampleOutput(example: ProblemExampleLike): string | null {
  return (
    (typeof example.output === "string" && example.output) ||
    (typeof example.sampleOutput === "string" && example.sampleOutput) ||
    (typeof example.sample_output === "string" && example.sample_output) ||
    (typeof example.testOutput === "string" && example.testOutput) ||
    (typeof example.test_output === "string" && example.test_output) ||
    null
  );
}

export function deriveJudgeTestCasesFromProblemSource(
  source: ProblemJudgeCaseSource,
): JudgeTestCase[] {
  const maxCount = source.maxCount ?? 20;
  const preferred = normalizeJudgeTestCases(source.judgeTestCases, maxCount);
  if (preferred.length > 0) {
    return preferred;
  }

  return normalizeJudgeTestCases(source.examples, maxCount);
}

export function createJudgeCaseLabel(index: number): string {
  return `样例 ${index + 1}`;
}
