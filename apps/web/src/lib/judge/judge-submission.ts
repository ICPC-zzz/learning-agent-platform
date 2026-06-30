import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  formatJudgeSubmissionStatus,
  getJudgeLanguageOptions,
  type JudgeGuardStatusForUi,
  type JudgeLanguageId,
  type JudgeSubmissionRequest,
  type JudgeSubmissionResult,
  type JudgeSubmissionStatus,
  type JudgeTestCase,
  type JudgeTestCaseResult,
} from "./judge-types";
import { compareJudgeOutput, previewJudgeText } from "./output-compare";
import { getJudgeLanguageConfig, normalizeJudgeLanguage } from "./language-runners";
import {
  createDockerSandboxRunner,
  type DockerSandboxExecutionResult,
  type DockerSandboxRunner,
} from "./docker-sandbox-runner";
import {
  evaluateDockerJudgeGuard,
  type DockerJudgeGuardResult,
} from "./docker-judge-guard";

export interface JudgeSubmissionDependencies {
  executor?: DockerSandboxRunner;
  guard?: DockerJudgeGuardResult;
  now?: () => number;
  mkdtemp?: typeof fs.mkdtemp;
  writeFile?: typeof fs.writeFile;
  rm?: typeof fs.rm;
  tmpdir?: typeof os.tmpdir;
}

export const MAX_PROBLEM_ID_BYTES = 120;
export const MAX_PROBLEM_TITLE_BYTES = 200;
export const MAX_CODE_BYTES = 65536;
export const MAX_TEST_CASES = 20;
export const MAX_TEST_CASE_INPUT_BYTES = 8192;
export const MAX_TEST_CASE_OUTPUT_BYTES = 8192;
export const MAX_PREVIEW_CHARS = 240;

export async function judgeProblemCodeSubmission(
  request: JudgeSubmissionRequest,
  deps: JudgeSubmissionDependencies = {},
): Promise<JudgeSubmissionResult> {
  const now = deps.now ?? (() => Date.now());
  const guard = deps.guard ?? evaluateDockerJudgeGuard();
  const executor = deps.executor ?? createDockerSandboxRunner();

  const problemId = normalizeProblemId(request.problemId);
  const problemTitle = normalizeProblemTitle(request.problemTitle);
  const language = normalizeJudgeLanguage(request.language);
  const code = typeof request.code === "string" ? request.code : "";
  const testCases = normalizeJudgeTestCases(request.testCases);

  if (!guard.enabled) {
    return buildSystemErrorResult({
      guard,
      problemId: problemId ?? "",
      problemTitle: problemTitle ?? "",
      language: language ?? "python",
      message: "当前环境未开启本地判题。",
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: 0,
    });
  }

  if (problemId === null || problemTitle === null || language === null) {
    return buildSystemErrorResult({
      guard,
      problemId: problemId ?? "",
      problemTitle: problemTitle ?? "",
      language: language ?? "python",
      message: "提交内容校验失败，无法进入本地判题。",
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: 0,
    });
  }

  if (byteLength(problemId) > MAX_PROBLEM_ID_BYTES) {
    return buildSystemErrorResult({
      guard,
      problemId,
      problemTitle,
      language,
      message: "题目标识过长，已拒绝执行本地判题。",
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: 0,
    });
  }

  if (byteLength(problemTitle) > MAX_PROBLEM_TITLE_BYTES) {
    return buildSystemErrorResult({
      guard,
      problemId,
      problemTitle,
      language,
      message: "题目标题过长，已拒绝执行本地判题。",
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: 0,
    });
  }

  if (byteLength(code) > MAX_CODE_BYTES) {
    return buildSystemErrorResult({
      guard,
      problemId,
      problemTitle,
      language,
      message: "代码过长，已拒绝执行本地判题。",
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: 0,
    });
  }

  if (testCases.length === 0) {
    return {
      success: false,
      status: "no_test_cases",
      statusLabel: formatJudgeSubmissionStatus("no_test_cases"),
      problemId,
      problemTitle,
      language,
      languageLabel: resolveLanguageLabel(language),
      guard: toUiGuardStatus(guard),
      noTestCases: true,
      passedCount: 0,
      totalCount: 0,
      durationMs: 0,
      message: "该题暂无本地测试用例，无法自动判题。",
      compileErrorPreview: null,
      runtimeErrorPreview: null,
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: [],
      safeToExposeToClient: true,
      productionReady: false,
    };
  }

  const config = getJudgeLanguageConfig(language);
  const tmpdir = deps.tmpdir ?? os.tmpdir;
  const mkdtemp = deps.mkdtemp ?? fs.mkdtemp;
  const writeFile = deps.writeFile ?? fs.writeFile;
  const rm = deps.rm ?? fs.rm;
  const startedAt = now();
  const tempDir = await mkdtemp(path.join(tmpdir(), "lap-judge-"));
  const sourcePath = path.join(tempDir, config.fileName);

  try {
    await writeFile(sourcePath, code, "utf8");

    if (config.compileCommand && config.compileCommand.length > 0) {
      const compileResult = await executor.execute({
        image: config.image,
        command: config.compileCommand,
        mountDir: tempDir,
        workingDir: "/workspace",
        stdin: "",
        timeoutMs: guard.timeoutMs,
        memoryMb: guard.memoryMb,
        cpus: 1,
        maxOutputBytes: guard.maxOutputBytes,
        containerName: createContainerName(problemId, language, "compile"),
      });

      const compileFailure = buildCompileFailureResult({
        guard,
        problemId,
        problemTitle,
        language,
        languageLabel: config.label,
        compileResult,
        totalCount: testCases.length,
        durationMs: now() - startedAt,
      });
      if (compileFailure) {
        return compileFailure;
      }
    }

    const caseResults: JudgeTestCaseResult[] = [];
    let passedCount = 0;

    for (let index = 0; index < testCases.length; index += 1) {
      const testCase = testCases[index];
      const caseIndex = index + 1;
      const caseStartedAt = now();

      const runResult = await executor.execute({
        image: config.image,
        command: config.runCommand,
        mountDir: tempDir,
        workingDir: "/workspace",
        stdin: testCase.input,
        timeoutMs: guard.timeoutMs,
        memoryMb: guard.memoryMb,
        cpus: 1,
        maxOutputBytes: guard.maxOutputBytes,
        containerName: createContainerName(problemId, language, `run-${caseIndex}`),
      });

      const failedCase = buildRunFailureCaseResult({
        testCase,
        caseIndex,
        runResult,
        caseDurationMs: now() - caseStartedAt,
      });
      if (failedCase) {
        caseResults.push(failedCase.result);
        return buildFailureSubmissionResult({
          guard,
          problemId,
          problemTitle,
          language,
          languageLabel: config.label,
          status: failedCase.status,
          message: failedCase.message,
          compileErrorPreview: null,
          runtimeErrorPreview: failedCase.runtimeErrorPreview,
          systemErrorPreview: failedCase.systemErrorPreview,
          failedCaseIndex: caseIndex,
          passedCount,
          totalCount: testCases.length,
          durationMs: now() - startedAt,
          testCaseResults: caseResults,
        });
      }

      const comparison = compareJudgeOutput(testCase.expectedOutput, runResult.stdout);
      if (!comparison.accepted) {
        const failedResult: JudgeTestCaseResult = {
          index: caseIndex,
          label: testCase.label ?? `样例 ${caseIndex}`,
          status: "wrong_answer",
          durationMs: now() - caseStartedAt,
          inputPreview: previewJudgeText(testCase.input, MAX_PREVIEW_CHARS),
          expectedOutputPreview: previewJudgeText(testCase.expectedOutput, MAX_PREVIEW_CHARS),
          actualOutputPreview: previewJudgeText(runResult.stdout, MAX_PREVIEW_CHARS),
          stderrPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
        };
        caseResults.push(failedResult);

        return buildFailureSubmissionResult({
          guard,
          problemId,
          problemTitle,
          language,
          languageLabel: config.label,
          status: "wrong_answer",
          message: `第 ${caseIndex} 个测试点未通过。`,
          compileErrorPreview: null,
          runtimeErrorPreview: null,
          systemErrorPreview: null,
          failedCaseIndex: caseIndex,
          passedCount,
          totalCount: testCases.length,
          durationMs: now() - startedAt,
          testCaseResults: caseResults,
        });
      }

      passedCount += 1;
      caseResults.push({
        index: caseIndex,
        label: testCase.label ?? `样例 ${caseIndex}`,
        status: "accepted",
        durationMs: now() - caseStartedAt,
        inputPreview: previewJudgeText(testCase.input, MAX_PREVIEW_CHARS),
        expectedOutputPreview: previewJudgeText(testCase.expectedOutput, MAX_PREVIEW_CHARS),
        actualOutputPreview: null,
        stderrPreview: null,
      });
    }

    return {
      success: true,
      status: "accepted",
      statusLabel: formatJudgeSubmissionStatus("accepted"),
      problemId,
      problemTitle,
      language,
      languageLabel: config.label,
      guard: toUiGuardStatus(guard),
      noTestCases: false,
      passedCount,
      totalCount: testCases.length,
      durationMs: now() - startedAt,
      message: "全部测试通过。",
      compileErrorPreview: null,
      runtimeErrorPreview: null,
      systemErrorPreview: null,
      failedCaseIndex: null,
      testCaseResults: caseResults,
      safeToExposeToClient: true,
      productionReady: false,
    };
  } catch (error: unknown) {
    return buildSystemErrorResult({
      guard,
      problemId,
      problemTitle,
      language,
      message: "本地判题执行失败。",
      systemErrorPreview: safePreview(error instanceof Error ? error.message : String(error), MAX_PREVIEW_CHARS),
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: testCases.length,
      durationMs: now() - startedAt,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function buildCompileFailureResult(input: {
  guard: DockerJudgeGuardResult;
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  languageLabel: string;
  compileResult: DockerSandboxExecutionResult;
  totalCount: number;
  durationMs: number;
}): JudgeSubmissionResult | null {
  const { compileResult } = input;

  if (compileResult.spawnError !== null) {
    return buildSystemErrorResult({
      guard: input.guard,
      problemId: input.problemId,
      problemTitle: input.problemTitle,
      language: input.language,
      message: "本地判题沙箱不可用。",
      systemErrorPreview: safePreview(compileResult.spawnError, MAX_PREVIEW_CHARS),
      failedCaseIndex: null,
      testCaseResults: [],
      totalCount: input.totalCount,
      durationMs: input.durationMs,
    });
  }

  if (compileResult.timedOut) {
    return buildFailureSubmissionResult({
      guard: input.guard,
      problemId: input.problemId,
      problemTitle: input.problemTitle,
      language: input.language,
      languageLabel: input.languageLabel,
      status: "system_error",
      message: "编译阶段超时。",
      compileErrorPreview: null,
      runtimeErrorPreview: null,
      systemErrorPreview: safePreview(compileResult.stderr || compileResult.stdout, MAX_PREVIEW_CHARS),
      failedCaseIndex: null,
      passedCount: 0,
      totalCount: input.totalCount,
      durationMs: input.durationMs,
      testCaseResults: [],
    });
  }

  if (compileResult.exitCode !== 0) {
    return buildFailureSubmissionResult({
      guard: input.guard,
      problemId: input.problemId,
      problemTitle: input.problemTitle,
      language: input.language,
      languageLabel: input.languageLabel,
      status: "compile_error",
      message: "编译失败。",
      compileErrorPreview: safePreview(compileResult.stderr || compileResult.stdout, MAX_PREVIEW_CHARS),
      runtimeErrorPreview: null,
      systemErrorPreview: null,
      failedCaseIndex: null,
      passedCount: 0,
      totalCount: input.totalCount,
      durationMs: input.durationMs,
      testCaseResults: [],
    });
  }

  return null;
}

function buildRunFailureCaseResult(input: {
  testCase: JudgeTestCase;
  caseIndex: number;
  runResult: DockerSandboxExecutionResult;
  caseDurationMs: number;
}): {
  result: JudgeTestCaseResult;
  status: JudgeSubmissionStatus;
  message: string;
  runtimeErrorPreview: string | null;
  systemErrorPreview: string | null;
} | null {
  const { runResult } = input;
  const label = input.testCase.label ?? `样例 ${input.caseIndex}`;
  const inputPreview = previewJudgeText(input.testCase.input, MAX_PREVIEW_CHARS);
  const expectedPreview = previewJudgeText(input.testCase.expectedOutput, MAX_PREVIEW_CHARS);

  if (runResult.spawnError !== null) {
    return {
      result: {
        index: input.caseIndex,
        label,
        status: "system_error",
        durationMs: input.caseDurationMs,
        inputPreview,
        expectedOutputPreview: expectedPreview,
        actualOutputPreview: null,
        stderrPreview: safePreview(runResult.stderr || runResult.spawnError, MAX_PREVIEW_CHARS),
      },
      status: "system_error",
      message: "本地判题沙箱不可用。",
      runtimeErrorPreview: null,
      systemErrorPreview: safePreview(runResult.stderr || runResult.spawnError, MAX_PREVIEW_CHARS),
    };
  }

  if (runResult.timedOut) {
    return {
      result: {
        index: input.caseIndex,
        label,
        status: "time_limit_exceeded",
        durationMs: input.caseDurationMs,
        inputPreview,
        expectedOutputPreview: expectedPreview,
        actualOutputPreview: null,
        stderrPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
      },
      status: "time_limit_exceeded",
      message: `第 ${input.caseIndex} 个测试点超时。`,
      runtimeErrorPreview: null,
      systemErrorPreview: null,
    };
  }

  if (runResult.outputLimitExceeded) {
    return {
      result: {
        index: input.caseIndex,
        label,
        status: "runtime_error",
        durationMs: input.caseDurationMs,
        inputPreview,
        expectedOutputPreview: expectedPreview,
        actualOutputPreview: safePreview(runResult.stdout, MAX_PREVIEW_CHARS),
        stderrPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
      },
      status: "runtime_error",
      message: `第 ${input.caseIndex} 个测试点输出超过沙箱限制。`,
      runtimeErrorPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
      systemErrorPreview: null,
    };
  }

  if (runResult.exitCode !== 0) {
    return {
      result: {
        index: input.caseIndex,
        label,
        status: "runtime_error",
        durationMs: input.caseDurationMs,
        inputPreview,
        expectedOutputPreview: expectedPreview,
        actualOutputPreview: safePreview(runResult.stdout, MAX_PREVIEW_CHARS),
        stderrPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
      },
      status: "runtime_error",
      message: `第 ${input.caseIndex} 个测试点运行错误。`,
      runtimeErrorPreview: safePreview(runResult.stderr, MAX_PREVIEW_CHARS),
      systemErrorPreview: null,
    };
  }

  return null;
}

function buildFailureSubmissionResult(input: {
  guard: DockerJudgeGuardResult;
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  languageLabel: string;
  status: JudgeSubmissionStatus;
  message: string;
  compileErrorPreview: string | null;
  runtimeErrorPreview: string | null;
  systemErrorPreview: string | null;
  failedCaseIndex: number | null;
  passedCount: number;
  totalCount: number;
  durationMs: number;
  testCaseResults: JudgeTestCaseResult[];
}): JudgeSubmissionResult {
  return {
    success: false,
    status: input.status,
    statusLabel: formatJudgeSubmissionStatus(input.status),
    problemId: input.problemId,
    problemTitle: input.problemTitle,
    language: input.language,
    languageLabel: input.languageLabel,
    guard: toUiGuardStatus(input.guard),
    noTestCases: false,
    passedCount: input.passedCount,
    totalCount: input.totalCount,
    durationMs: input.durationMs,
    message: input.message,
    compileErrorPreview: input.compileErrorPreview,
    runtimeErrorPreview: input.runtimeErrorPreview,
    systemErrorPreview: input.systemErrorPreview,
    failedCaseIndex: input.failedCaseIndex,
    testCaseResults: input.testCaseResults,
    safeToExposeToClient: true,
    productionReady: false,
  };
}

function buildSystemErrorResult(input: {
  guard: DockerJudgeGuardResult;
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  message: string;
  systemErrorPreview: string | null;
  failedCaseIndex: number | null;
  testCaseResults: JudgeTestCaseResult[];
  totalCount: number;
  durationMs: number;
}): JudgeSubmissionResult {
  return {
    success: false,
    status: "system_error",
    statusLabel: formatJudgeSubmissionStatus("system_error"),
    problemId: input.problemId,
    problemTitle: input.problemTitle,
    language: input.language,
    languageLabel: resolveLanguageLabel(input.language),
    guard: toUiGuardStatus(input.guard),
    noTestCases: input.totalCount === 0,
    passedCount: 0,
    totalCount: input.totalCount,
    durationMs: input.durationMs,
    message: input.message,
    compileErrorPreview: null,
    runtimeErrorPreview: null,
    systemErrorPreview: input.systemErrorPreview,
    failedCaseIndex: input.failedCaseIndex,
    testCaseResults: input.testCaseResults,
    safeToExposeToClient: true,
    productionReady: false,
  };
}

function normalizeProblemId(value: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProblemTitle(value: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeJudgeTestCases(examples: readonly JudgeTestCase[] | null | undefined): JudgeTestCase[] {
  if (!Array.isArray(examples)) {
    return [];
  }

  const normalized: JudgeTestCase[] = [];

  for (let index = 0; index < examples.length && normalized.length < MAX_TEST_CASES; index += 1) {
    const example = examples[index];
    if (!example || typeof example.input !== "string" || typeof example.expectedOutput !== "string") {
      continue;
    }

    if (byteLength(example.input) > MAX_TEST_CASE_INPUT_BYTES) {
      continue;
    }

    if (byteLength(example.expectedOutput) > MAX_TEST_CASE_OUTPUT_BYTES) {
      continue;
    }

    normalized.push({
      input: example.input,
      expectedOutput: example.expectedOutput,
      explanation: typeof example.explanation === "string" ? example.explanation : undefined,
      label: typeof example.label === "string" ? example.label : undefined,
    });
  }

  return normalized;
}

function toUiGuardStatus(guard: DockerJudgeGuardResult): JudgeGuardStatusForUi {
  return {
    enabled: guard.enabled,
    mode: "dev-only",
    productionReady: false,
    safeToExposeToClient: true,
    notice: guard.notice,
    networkNone: true,
    timeoutMs: guard.timeoutMs,
    memoryMb: guard.memoryMb,
    maxOutputBytes: guard.maxOutputBytes,
  };
}

function safePreview(value: string, maxChars = MAX_PREVIEW_CHARS): string {
  const text = typeof value === "string" ? value : String(value);
  return previewJudgeText(text, maxChars);
}

function resolveLanguageLabel(language: JudgeLanguageId): string {
  return getJudgeLanguageOptions().find((item) => item.id === language)?.label ?? language;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function createContainerName(problemId: string, language: JudgeLanguageId, stage: string): string {
  const suffix = randomUUID().slice(0, 8);
  const safeProblemId = problemId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 24);
  return `lap-judge-${safeProblemId}-${language}-${stage}-${suffix}`;
}
