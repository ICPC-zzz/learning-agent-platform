import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  cancelAssistantMultiAgentTask,
  retryAssistantAgentTask,
  startAssistantTaskExecution,
} from "../apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts";
import {
  A509_DEFAULT_TASK_LIMITS,
  AssistantTaskRepositoryError,
  FileAssistantTaskRepository,
  createAgentRun,
} from "../apps/web/src/lib/assistant/assistant-task-repository.ts";
import { executeAssistantTool } from "../apps/web/src/lib/assistant/tools/tool-executor.ts";
import { createEmptyAssistantLearningContext } from "../apps/web/src/lib/assistant/user-learning-context.ts";

const originalEnv = {
  LAP_AGENT_STABILITY_TEST_MODE: process.env.LAP_AGENT_STABILITY_TEST_MODE,
  NODE_ENV: process.env.NODE_ENV,
};

const cfGuardEnv = {
  LAP_ALLOW_EXTERNAL_PROBLEM_API: "1",
  LAP_PROBLEM_API_PROVIDER: "codeforces",
  LAP_PROBLEM_API_BASE_URL: "https://codeforces.com/api",
  LAP_AGENT_STABILITY_TEST_MODE: "1",
};

afterEach(() => {
  restoreEnv();
});

describe("A509 multi-agent task repository and runtime", () => {
  it("reuses the same task for concurrent duplicate requestId submissions", async () => {
    await withRepository(async (repo) => {
      const input = {
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-1",
        userVisibleRequest: "根据我的真实水平推荐今天练习的题，再告诉我最近一场可以参加的 Codeforces 比赛。",
      };

      const [first, second] = await Promise.all([
        repo.createOrReuseTask(input),
        repo.createOrReuseTask(input),
      ]);

      assert.equal(first.task.id, second.task.id);
      assert.equal((await repo.listConversationTasks({ userId: "user-a", conversationId: "conv-a" })).length, 1);
      const restored = await repo.getTask({ userId: "user-a", taskId: first.task.id });
      assert.equal(
        restored.auditEvents.some((event) => event.eventType === "duplicate_request_reused"),
        true,
      );
    });
  });

  it("isolates tasks by trusted server userId", async () => {
    await withRepository(async (repo) => {
      const created = await repo.createOrReuseTask({
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-private",
        userVisibleRequest: "private task",
      });

      await assert.rejects(
        () => repo.getTask({ userId: "user-b", taskId: created.task.id }),
        (error) => error instanceof AssistantTaskRepositoryError && error.code === "task_not_found",
      );
      assert.equal((await repo.listConversationTasks({ userId: "user-b", conversationId: "conv-a" })).length, 0);
    });
  });

  it("marks orphaned running tasks as failed during refresh recovery", async () => {
    await withRepository(async (repo, rootDir) => {
      const created = await repo.createOrReuseTask({
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-interrupted",
        userVisibleRequest: "running task",
      });
      await repo.mutateTask({ userId: "user-a", taskId: created.task.id }, (task) => {
        task.status = "running";
        const run = createAgentRun({
          taskId: task.id,
          agentName: "LearnerProfile",
          role: "test",
          attempt: 1,
          timeoutMs: 1000,
          safeInputSummary: "test",
        });
        run.status = "running";
        task.agentRuns.push(run);
        return task;
      });

      const freshRepo = new FileAssistantTaskRepository({ rootDir });
      const recovered = await freshRepo.recoverInterruptedTasks({
        userId: "user-a",
        conversationId: "conv-a",
        activeTaskIds: [],
      });

      assert.equal(recovered[0].status, "failed");
      assert.equal(recovered[0].errorCode, "process_interrupted");
      assert.equal(recovered[0].agentRuns[0].retryable, true);
    });
  });

  it("cancels a running delayed task without producing a final answer", async () => {
    enableStabilityMode();
    await withRepository(async (repo) => {
      const created = await repo.createOrReuseTask({
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-cancel",
        userVisibleRequest: "根据我的真实水平推荐今天练习的题，再告诉我最近一场可以参加的 Codeforces 比赛。",
        stabilityInjectionMode: "delay_task_for_cancel",
        limits: quickLimits({ taskTimeoutMs: 4000 }),
      });

      startAssistantTaskExecution({
        repository: repo,
        userId: "user-a",
        taskId: created.task.id,
        guardEnv: cfGuardEnv,
        customFetch: okContestFetch(),
      });
      await sleep(80);
      const cancelling = await cancelAssistantMultiAgentTask({
        repository: repo,
        userId: "user-a",
        taskId: created.task.id,
      });
      assert.equal(cancelling.status === "cancel_requested" || cancelling.status === "cancelled", true);

      const final = await waitForTask(repo, "user-a", created.task.id, (task) => task.status === "cancelled");
      assert.equal(final.finalAnswer, null);
      assert.equal(final.auditEvents.some((event) => event.eventType === "task_cancelled"), true);
    });
  });

  it("records an agent timeout and keeps late results from making the task succeeded", async () => {
    enableStabilityMode();
    await withRepository(async (repo) => {
      const created = await repo.createOrReuseTask({
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-timeout",
        userVisibleRequest: "根据我的真实水平推荐今天练习的题，再告诉我最近一场可以参加的 Codeforces 比赛。",
        stabilityInjectionMode: "timeout_candidate_once",
        limits: quickLimits({
          taskTimeoutMs: 5000,
          agentTimeoutMs: { CandidateRecommendation: 120 },
        }),
      });

      startAssistantTaskExecution({
        repository: repo,
        userId: "user-a",
        taskId: created.task.id,
        guardEnv: cfGuardEnv,
        customFetch: okContestFetch(),
      });

      const final = await waitForTask(repo, "user-a", created.task.id, (task) =>
        task.status === "partial_success" || task.status === "failed",
      );
      const candidate = final.agentRuns.find((run) => run.agentName === "CandidateRecommendation");
      assert.equal(candidate?.status, "timed_out");
      assert.notEqual(final.status, "succeeded");
      assert.equal(final.auditEvents.some((event) => event.eventType === "agent_timed_out"), true);
    });
  });

  it("retries only the failed UpcomingContest agent and preserves the failed attempt", async () => {
    enableStabilityMode();
    await withRepository(async (repo) => {
      const created = await repo.createOrReuseTask({
        userId: "user-a",
        conversationId: "conv-a",
        requestId: "req-retry",
        userVisibleRequest: "根据我的真实水平推荐今天练习的题，再告诉我最近一场可以参加的 Codeforces 比赛。",
        stabilityInjectionMode: "fail_upcoming_once",
        limits: quickLimits({ taskTimeoutMs: 5000 }),
      });

      startAssistantTaskExecution({
        repository: repo,
        userId: "user-a",
        taskId: created.task.id,
        guardEnv: cfGuardEnv,
        customFetch: okContestFetch(),
      });

      const partial = await waitForTask(repo, "user-a", created.task.id, (task) =>
        (task.status === "partial_success" || task.status === "failed")
        && task.agentRuns.some((run) => run.agentName === "UpcomingContest" && run.status === "failed"),
      );
      const beforeProfileAttempts = partial.agentRuns.filter((run) => run.agentName === "LearnerProfile").length;

      await retryAssistantAgentTask({
        repository: repo,
        userId: "user-a",
        taskId: created.task.id,
        agentName: "UpcomingContest",
        guardEnv: cfGuardEnv,
        customFetch: okContestFetch(),
      });

      const retried = await waitForTask(repo, "user-a", created.task.id, (task) =>
        task.agentRuns.some((run) => run.agentName === "UpcomingContest" && run.status === "succeeded" && run.attempt === 2)
        && task.auditEvents.some((event) => event.eventType === "final_answer_rebuilt"),
      );
      const upcomingRuns = retried.agentRuns.filter((run) => run.agentName === "UpcomingContest");
      assert.equal(upcomingRuns.some((run) => run.status === "failed" && run.attempt === 1), true);
      assert.equal(upcomingRuns.some((run) => run.status === "succeeded" && run.attempt === 2), true);
      assert.equal(retried.agentRuns.filter((run) => run.agentName === "LearnerProfile").length, beforeProfileAttempts);
      assert.equal(retried.auditEvents.some((event) => event.eventType === "final_answer_rebuilt"), true);
    });
  });

  it("aborts tool execution through AbortSignal", async () => {
    const controller = new AbortController();
    const definition = {
      name: "getUpcomingCodeforcesContests",
      description: "test",
      inputSchema: { type: "object", title: "test", description: "test", properties: {}, additionalProperties: false },
      outputSchema: { type: "object", title: "test", description: "test", properties: {}, additionalProperties: false },
      timeoutMs: 5000,
      maxResults: 1,
      maxSummaryChars: 100,
      sourceLabel: "test",
      validateInput: () => true,
      execute: async (_input, context) => {
        await new Promise((resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      },
    };

    const pending = executeAssistantTool(definition, {}, {
      userId: "user-a",
      question: "test",
      pageContext: { route: "/ai", pageType: "ai" },
      learningContext: createEmptyAssistantLearningContext(null, true),
      signal: controller.signal,
    });
    controller.abort(new Error("cancel"));
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "cancelled");
  });
});

async function withRepository(fn) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "lap-a509-repo-"));
  try {
    const repo = new FileAssistantTaskRepository({ rootDir });
    await fn(repo, rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

function quickLimits(overrides = {}) {
  return {
    ...A509_DEFAULT_TASK_LIMITS,
    ...overrides,
    agentTimeoutMs: {
      ...A509_DEFAULT_TASK_LIMITS.agentTimeoutMs,
      ...(overrides.agentTimeoutMs ?? {}),
    },
  };
}

function enableStabilityMode() {
  process.env.LAP_AGENT_STABILITY_TEST_MODE = "1";
  process.env.NODE_ENV = "test";
}

function restoreEnv() {
  if (originalEnv.LAP_AGENT_STABILITY_TEST_MODE === undefined) {
    delete process.env.LAP_AGENT_STABILITY_TEST_MODE;
  } else {
    process.env.LAP_AGENT_STABILITY_TEST_MODE = originalEnv.LAP_AGENT_STABILITY_TEST_MODE;
  }
  if (originalEnv.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
}

function okContestFetch() {
  return async (url, init) => {
    assert.equal(String(url), "https://codeforces.com/api/contest.list?gym=false");
    assert.equal(init.signal instanceof AbortSignal, true);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: "OK",
        result: [{
          id: 1900,
          name: "Codeforces Round 1900",
          type: "CF",
          phase: "BEFORE",
          frozen: false,
          durationSeconds: 7200,
          startTimeSeconds: Math.floor((Date.now() + 3600_000) / 1000),
          relativeTimeSeconds: -3600,
        }],
      }),
    };
  };
}

async function waitForTask(repo, userId, taskId, predicate, timeoutMs = 7000) {
  const deadline = Date.now() + timeoutMs;
  let latest = await repo.getTask({ userId, taskId });
  while (Date.now() < deadline) {
    latest = await repo.getTask({ userId, taskId });
    if (predicate(latest)) {
      return latest;
    }
    await sleep(50);
  }
  assert.fail(`Timed out waiting for task. Last status: ${latest.status}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
