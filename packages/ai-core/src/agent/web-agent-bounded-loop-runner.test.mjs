import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebAgentToolRegistry,
  WebAgentToolName,
} from "./web-agent-readonly-tool-registry.ts";
import { runWebAgentBoundedLoop } from "./web-agent-bounded-loop-runner.ts";

function createToolDataLoaders(options = {}) {
  const {
    listBooksImpl,
    getBookDetailImpl,
    getReadingProgressSummaryImpl,
  } = options;

  let listBooksCalls = 0;
  let getBookDetailCalls = 0;
  let getReadingProgressSummaryCalls = 0;

  return {
    calls: {
      get listBooks() {
        return listBooksCalls;
      },
      get getBookDetail() {
        return getBookDetailCalls;
      },
      get getReadingProgressSummary() {
        return getReadingProgressSummaryCalls;
      },
    },
    loaders: {
      async listBooks(limit) {
        listBooksCalls += 1;

        if (typeof listBooksImpl === "function") {
          return listBooksImpl(limit);
        }

        return [
          {
            bookId: "book-1",
            title: "TypeScript Guide",
            author: "Team",
            sourceType: "builtin",
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            bookId: "book-2",
            title: "Node Patterns",
            author: null,
            sourceType: "builtin",
            createdAt: "2026-01-02T00:00:00Z",
          },
        ].slice(0, limit);
      },
      async getBookDetail(bookId) {
        getBookDetailCalls += 1;

        if (typeof getBookDetailImpl === "function") {
          return getBookDetailImpl(bookId);
        }

        if (bookId !== "book-1") {
          return null;
        }

        return {
          book: {
            bookId: "book-1",
            title: "TypeScript Guide",
            author: "Team",
            sourceType: "builtin",
            createdAt: "2026-01-01T00:00:00Z",
          },
          chapters: [
            {
              chapterId: "chapter-1",
              title: "Intro",
              orderIndex: 0,
              summary: "Basics and setup.",
            },
          ],
        };
      },
      async getReadingProgressSummary(limit) {
        getReadingProgressSummaryCalls += 1;

        if (typeof getReadingProgressSummaryImpl === "function") {
          return getReadingProgressSummaryImpl(limit);
        }

        return {
          userLabel: "Demo User",
          records: [
            {
              bookId: "book-1",
              bookTitle: "TypeScript Guide",
              chapterId: "chapter-1",
              chapterTitle: "Intro",
              progressRatio: 0.5,
              updatedAt: "2026-01-01T08:00:00Z",
            },
          ].slice(0, limit),
        };
      },
    },
  };
}

function createSequencedProvider(responses) {
  const calls = [];

  return {
    calls,
    provider: {
      mode: "external-dev-only",
      label: "fake-provider",
      async generate(request) {
        calls.push(request);
        const next = responses.shift();

        if (next === undefined) {
          throw new Error("No more fake responses configured.");
        }

        if (typeof next === "function") {
          return next(request);
        }

        if (next.throwError) {
          throw next.throwError;
        }

        return {
          ok: next.ok !== false,
          answerSummary: next.answerSummary ?? "",
          providerMode: "external-dev-only",
          realProviderCalled: true,
          networkAccessed: false,
          secretSafe: true,
          rawPromptStored: false,
          rawResponseStored: false,
          devOnly: true,
          productionReady: false,
          warnings: next.warnings ?? [],
          createdAt: new Date().toISOString(),
        };
      },
    },
  };
}

test("bounded loop enforces maxSteps=2 and maxToolCalls=1", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"plan":"List books and answer safely","toolId":"listBooks","arguments":{"limit":2},"reason":"books","finalAnswerHint":"mention the safe preview"}',
    },
    {
      answerSummary:
        "Preview complete. The safe tool returned the requested book list.",
    },
    {
      answerSummary:
        '{"decision":"approve","findings":[],"revisionHints":[],"summary":"critic approved the safe preview"}',
    },
  ]);

  const result = await runWebAgentBoundedLoop({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    requestedExternalLlmDev: true,
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.loopMaxSteps, 2);
  assert.equal(result.loopMaxToolCalls, 1);
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
  assert.equal(result.steps.length, 2);
  assert.ok(result.toolCallRecords.length <= 1);
});

test("guard missing does not call the LLM and falls back to rule-only", async () => {
  const { loaders, calls } = createToolDataLoaders();
  const { provider } = createSequencedProvider([]);

  const result = await runWebAgentBoundedLoop({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: false,
    toolGuardNotice: "guard unavailable",
    toolGuardSourceLabel: "tool-guard-blocked (preview disabled)",
    requestedExternalLlmDev: true,
    llmSelectionAllowed: false,
    llmProvider: provider,
  });

  assert.equal(calls.listBooks, 0);
  assert.equal(result.mode, "mock");
  assert.equal(result.executionPath, "rule-only");
  assert.equal(result.llmUsed, false);
  assert.equal(result.selectedToolId, WebAgentToolName.ListBooks);
  assert.equal(result.toolExecution.status, "blocked");
  assert.equal(result.toolExecution.blockedReason, "tool_preview_guard_unavailable");
  assert.equal(result.toolCallRecords.length, 1);
});

test("valid plan and tool intent run the tool once and synthesize the final answer", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([
    {
      answerSummary:
        '{"plan":"Summarize the book list","toolId":"listBooks","arguments":{"limit":2},"reason":"books","finalAnswerHint":"mention two safe items"}',
    },
    {
      answerSummary:
        "Safe preview complete. The selected tool returned two books and the reply stayed dev-only.",
    },
  ]);

  const result = await runWebAgentBoundedLoop({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    requestedExternalLlmDev: true,
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(calls.length, 3);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.selectedToolId, WebAgentToolName.ListBooks);
  assert.equal(result.toolSelectionSource, "llm");
  assert.equal(result.toolExecution.status, "success");
  assert.equal(result.finalAnswerSource, "llm");
  assert.equal(result.llmUsed, true);
  assert.equal(result.criticReview?.decision, "approve");
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
  assert.equal(result.steps.length, 2);
  assert.equal(result.toolCallRecords.length, 1);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
  assert.equal(result.rawPromptStored, false);
  assert.equal(result.rawResponseStored, false);
});

test("safeWebFetch can run through the bounded loop with a guarded fetch", async () => {
  const { loaders } = createToolDataLoaders();
  const result = await runWebAgentBoundedLoop({
    userMessage: "fetch https://example.com",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    requestedExternalLlmDev: false,
    llmSelectionAllowed: false,
    fetchImpl: async () => ({
      status: 200,
      url: "https://example.com/",
      headers: new Headers({
        "content-type": "text/html; charset=utf-8",
      }),
      async text() {
        return "<html><body>Example Domain</body></html>";
      },
    }),
    networkGuard: {
      enabled: true,
      nonProduction: true,
      networkDevEnabled: true,
      allowAgentNetwork: true,
      allowed: true,
      blockedReasons: [],
      notice: "enabled",
      sourceLabel: "network-guard-enabled (dev-only preview)",
      devOnly: true,
      productionReady: false,
    },
  });

  assert.equal(result.selectedToolId, "safeWebFetch");
  assert.equal(result.toolExecution.status, "success");
  assert.equal(result.toolUsed, "safeWebFetch");
  assert.equal(result.toolExecution.finalUrl, "https://example.com/");
  assert.equal(result.toolExecution.textPreview?.includes("Example Domain"), true);
});

test("invalid tool intent falls back safely to rules", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"plan":"Pretend to do something unsafe","toolId":"dropDatabase","arguments":{},"reason":"unsafe","finalAnswerHint":"ignore this"}',
    },
    {
      answerSummary:
        "Safe fallback answer. The loop selected the rule-based tool instead.",
    },
  ]);

  const result = await runWebAgentBoundedLoop({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    requestedExternalLlmDev: true,
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.toolIntentValidated, false);
  assert.equal(result.toolSelectionSource, "rules");
  assert.equal(result.selectedToolId, WebAgentToolName.ListBooks);
  assert.equal(result.toolExecution.status, "success");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
});

test("tool errors stay safe and do not leak raw prompt or raw response data", async () => {
  const { loaders } = createToolDataLoaders({
    listBooksImpl() {
      throw new Error("stack: sensitive internal stack trace");
    },
  });
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"plan":"List books","toolId":"listBooks","arguments":{"limit":2},"reason":"books","finalAnswerHint":"mention the safe preview"}',
    },
    {
      answerSummary:
        "Safe fallback answer. secret-token=shh-secret-token raw_prompt=keep-out",
    },
  ]);

  const result = await runWebAgentBoundedLoop({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolExecutionAllowed: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    requestedExternalLlmDev: true,
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.toolExecution.status, "error");
  assert.equal(result.toolUsed, WebAgentToolName.ListBooks);
  assert.equal(result.finalAnswer.includes("shh-secret-token"), false);
  assert.equal(result.finalAnswer.includes("keep-out"), false);
  assert.equal(result.finalAnswer.includes("stack: sensitive internal stack trace"), false);
  assert.equal(JSON.stringify(result).includes("shh-secret-token"), false);
  assert.equal(JSON.stringify(result).includes("stack: sensitive internal stack trace"), false);
});
