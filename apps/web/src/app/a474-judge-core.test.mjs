import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { tsImport } from "tsx/esm/api";

const judgeTypes = await tsImport("../lib/judge/judge-types.ts", import.meta.url);
const languageRunners = await tsImport("../lib/judge/language-runners.ts", import.meta.url);
const outputCompare = await tsImport("../lib/judge/output-compare.ts", import.meta.url);
const dockerGuard = await tsImport("../lib/judge/docker-judge-guard.ts", import.meta.url);
const judgeSubmission = await tsImport("../lib/judge/judge-submission.ts", import.meta.url);

function makeGuard(overrides = {}) {
  return {
    enabled: true,
    mode: "dev-only",
    productionReady: false,
    safeToExposeToClient: true,
    notice: "Docker 沙箱判题已启用。",
    networkNone: true,
    timeoutMs: 3000,
    memoryMb: 256,
    maxOutputBytes: 65536,
    ...overrides,
  };
}

function makeExecutionResult(overrides = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    outputLimitExceeded: false,
    spawnError: null,
    stdout: "",
    stderr: "",
    durationMs: 4,
    ...overrides,
  };
}

function createQueuedExecutor(results) {
  const calls = [];
  const queue = results.slice();
  return {
    calls,
    executor: {
      async execute(request) {
        calls.push(request);
        const next = queue.shift();
        if (!next) {
          throw new Error("unexpected executor call");
        }
        return next;
      },
    },
  };
}

function withEnv(entries, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("A474 core: language options cover the supported sandbox languages", () => {
  assert.deepEqual(
    languageRunners.JUDGE_LANGUAGE_OPTIONS.map((option) => option.id),
    judgeTypes.JUDGE_LANGUAGE_IDS,
  );
  assert.equal(languageRunners.normalizeJudgeLanguage("c++"), "cpp");
  assert.equal(languageRunners.normalizeJudgeLanguage("js"), "javascript");
  assert.equal(languageRunners.getJudgeLanguageConfig("java").fileName, "Main.java");
  assert.ok(languageRunners.getJudgeStarterCode("java").includes("class Main"));
  assert.ok(languageRunners.getJudgeStarterCode("python").includes("import sys"));
});

test("A474 core: output comparison normalizes line endings and trailing spaces", () => {
  const match = outputCompare.compareJudgeOutput("1\r\n2 \n", "1\n2\n");
  assert.equal(match.accepted, true);
  assert.equal(match.normalizedExpectedOutput, "1\n2");
  assert.equal(match.normalizedActualOutput, "1\n2");

  const mismatch = outputCompare.compareJudgeOutput("1\n2", "1\n3");
  assert.equal(mismatch.accepted, false);
});

test("A474 core: docker guard is blocked by default and only enables with opt-in", () => {
  withEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_DOCKER_JUDGE: undefined,
      LAP_JUDGE_TIMEOUT_MS: undefined,
      LAP_JUDGE_MEMORY_MB: undefined,
      LAP_JUDGE_MAX_OUTPUT_BYTES: undefined,
    },
    () => {
      const guard = dockerGuard.evaluateDockerJudgeGuard();
      assert.equal(guard.enabled, false);
      assert.equal(guard.isProduction, false);
      assert.ok(guard.blockedReasons.includes("DOCKER_JUDGE_DISABLED_BY_DEFAULT"));
      assert.equal(guard.notice.includes("LAP_"), false);
    },
  );

  withEnv(
    {
      NODE_ENV: "development",
      LAP_ALLOW_DOCKER_JUDGE: "true",
      LAP_JUDGE_TIMEOUT_MS: "9001",
      LAP_JUDGE_MEMORY_MB: "512",
      LAP_JUDGE_MAX_OUTPUT_BYTES: "4096",
    },
    () => {
      const guard = dockerGuard.evaluateDockerJudgeGuard();
      assert.equal(guard.enabled, true);
      assert.equal(guard.timeoutMs, 9001);
      assert.equal(guard.memoryMb, 512);
      assert.equal(guard.maxOutputBytes, 4096);
      assert.equal(guard.notice, "Docker 沙箱判题已启用。");
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      LAP_ALLOW_DOCKER_JUDGE: "true",
    },
    () => {
      const guard = dockerGuard.evaluateDockerJudgeGuard();
      assert.equal(guard.enabled, false);
      assert.equal(guard.isProduction, true);
      assert.ok(guard.blockedReasons.includes("PRODUCTION_BLOCKED"));
    },
  );
});

test("A474 core: docker guard status for UI hides env names", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllow = process.env.LAP_ALLOW_DOCKER_JUDGE;
  process.env.NODE_ENV = "development";
  process.env.LAP_ALLOW_DOCKER_JUDGE = "true";

  try {
    const uiGuard = dockerGuard.getDockerJudgeGuardStatusForUi();
    assert.equal(uiGuard.safeToExposeToClient, true);
    assert.equal(uiGuard.notice.includes("LAP_"), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAllow === undefined) delete process.env.LAP_ALLOW_DOCKER_JUDGE;
    else process.env.LAP_ALLOW_DOCKER_JUDGE = originalAllow;
  }
});

test("A474 core: judge submission accepts a passing Python solution", async () => {
  const { executor, calls } = createQueuedExecutor([
    makeExecutionResult({ stdout: "" }),
  ]);

  const result = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-1",
      problemTitle: "Sum",
      language: "python",
      code: "print(1)\n",
      testCases: [{ input: "", expectedOutput: "\n" }],
    },
    {
      guard: makeGuard(),
      executor,
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1;
          return tick;
        };
      })(),
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );

  assert.equal(result.status, "accepted");
  assert.equal(result.success, true);
  assert.equal(result.passedCount, 1);
  assert.equal(result.totalCount, 1);
  assert.equal(result.languageLabel, "Python");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].command, ["python", "main.py"]);
  assert.equal(calls[0].workingDir, "/workspace");
});

test("A474 core: judge submission reports wrong answer with previews", async () => {
  const { executor } = createQueuedExecutor([
    makeExecutionResult({ stdout: "2\n" }),
  ]);

  const result = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-2",
      problemTitle: "Double",
      language: "python",
      code: "print(2)\n",
      testCases: [{ input: "", expectedOutput: "1\n" }],
    },
    {
      guard: makeGuard(),
      executor,
      now: (() => {
        let tick = 0;
        return () => {
          tick += 1;
          return tick;
        };
      })(),
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );

  assert.equal(result.status, "wrong_answer");
  assert.equal(result.failedCaseIndex, 1);
  assert.equal(result.testCaseResults[0].status, "wrong_answer");
  assert.ok(result.testCaseResults[0].expectedOutputPreview.includes("1"));
  assert.ok(result.testCaseResults[0].actualOutputPreview?.includes("2"));
});

test("A474 core: judge submission reports compile errors for compiled languages", async () => {
  const { executor } = createQueuedExecutor([
    makeExecutionResult({ exitCode: 1, stderr: "gcc: error: bad code" }),
  ]);

  const result = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-3",
      problemTitle: "Compile",
      language: "c",
      code: "int main(void) { return 0; }\n",
      testCases: [{ input: "", expectedOutput: "0\n" }],
    },
    {
      guard: makeGuard(),
      executor,
      now: () => 1,
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );

  assert.equal(result.status, "compile_error");
  assert.equal(result.compileErrorPreview?.includes("bad code"), true);
  assert.equal(result.testCaseResults.length, 0);
});

test("A474 core: judge submission reports runtime errors and time limits", async () => {
  const runtimeQueue = createQueuedExecutor([
    makeExecutionResult({ exitCode: 1, stderr: "boom" }),
  ]);
  const runtimeResult = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-4",
      problemTitle: "Runtime",
      language: "javascript",
      code: 'console.log("x");\n',
      testCases: [{ input: "", expectedOutput: "x\n" }],
    },
    {
      guard: makeGuard(),
      executor: runtimeQueue.executor,
      now: () => 1,
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );
  assert.equal(runtimeResult.status, "runtime_error");
  assert.equal(runtimeResult.runtimeErrorPreview?.includes("boom"), true);

  const tleQueue = createQueuedExecutor([
    makeExecutionResult({ timedOut: true }),
  ]);
  const tleResult = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-5",
      problemTitle: "Timeout",
      language: "python",
      code: "pass\n",
      testCases: [{ input: "", expectedOutput: "ok\n" }],
    },
    {
      guard: makeGuard(),
      executor: tleQueue.executor,
      now: () => 1,
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );
  assert.equal(tleResult.status, "time_limit_exceeded");
  assert.equal(tleResult.testCaseResults[0].status, "time_limit_exceeded");
});

test("A474 core: judge submission blocks when guard is disabled and handles empty test cases", async () => {
  const blocked = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-6",
      problemTitle: "Blocked",
      language: "python",
      code: "pass\n",
      testCases: [{ input: "", expectedOutput: "" }],
    },
    {
      guard: makeGuard({ enabled: false, notice: "当前环境未开启本地判题。" }),
      executor: {
        async execute() {
          throw new Error("should not be called");
        },
      },
      now: () => 1,
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );
  assert.equal(blocked.status, "system_error");
  assert.equal(blocked.message.includes("本地判题"), true);
  assert.equal(blocked.testCaseResults.length, 0);

  const noCases = await judgeSubmission.judgeProblemCodeSubmission(
    {
      problemId: "prob-7",
      problemTitle: "Empty",
      language: "python",
      code: "pass\n",
      testCases: [],
    },
    {
      guard: makeGuard(),
      executor: {
        async execute() {
          throw new Error("should not be called");
        },
      },
      now: () => 1,
      mkdtemp: async () => path.join(process.cwd(), "tmp", "lap-judge-core"),
      writeFile: async () => undefined,
      rm: async () => undefined,
      tmpdir: () => path.join(process.cwd(), "tmp"),
    },
  );
  assert.equal(noCases.status, "no_test_cases");
  assert.equal(noCases.noTestCases, true);
  assert.equal(noCases.passedCount, 0);
});
