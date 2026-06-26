import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebAgentToolRegistry,
  WebAgentToolName,
} from "./web-agent-readonly-tool-registry.ts";
import { runWebAgentSingleStep } from "./web-agent-single-step-runner.ts";

function createToolDataLoaders() {
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

test("rule-only path stays mock and does not call the LLM", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: false,
    llmProvider: provider,
  });

  assert.equal(calls.length, 0);
  assert.equal(result.mode, "mock");
  assert.equal(result.executionPath, "rule-only");
  assert.equal(result.llmUsed, false);
  assert.equal(result.toolIntentValidated, null);
  assert.equal(result.finalAnswerSource, "template");
  assert.equal(result.toolSelectionSource, "rules");
  assert.equal(result.toolUsed, WebAgentToolName.ListBooks);
});

test("missing guard reasons block the runner before any LLM call", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: false,
    llmProvider: provider,
    blockedReasons: ["missing required env"],
  });

  assert.equal(calls.length, 0);
  assert.equal(result.mode, "blocked");
  assert.equal(result.executionPath, "blocked");
  assert.equal(result.llmUsed, false);
  assert.equal(result.finalAnswerSource, "blocked");
  assert.equal(result.blockedReasons[0], "missing required env");
});

test("valid LLM tool intent executes one read-only tool and synthesizes the final reply", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([
    {
      answerSummary:
        '{"toolId":"listBooks","arguments":{"limit":2},"reason":"books","finalAnswerHint":"mention the two safe items"}',
    },
    {
      answerSummary:
        "Safe preview complete. The selected tool returned two books and the final reply stayed dev-only.",
    },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(calls.length, 2);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.selectedToolId, WebAgentToolName.ListBooks);
  assert.equal(result.toolSelectionSource, "llm");
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.toolIntentValidated, true);
  assert.equal(result.toolIntentReason, "books");
  assert.equal(result.toolIntentFinalAnswerHint, "mention the two safe items");
  assert.equal(result.toolUsed, WebAgentToolName.ListBooks);
  assert.equal(result.toolExecution.status, "success");
  assert.equal(result.toolResultPreview?.includes("Items shown: 2"), true);
  assert.equal(result.finalAnswerSource, "llm");
  assert.equal(result.finalAnswer.includes("Safe preview complete"), true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.realProviderCalled, true);
  assert.equal(typeof result.runId, "string");
  assert.equal(result.traceEvents.length > 0, true);
  assert.equal(result.toolCallRecords.length > 0, true);
  assert.equal(result.memoryPreview.productionReady, false);
  assert.equal(result.skillSeed.productionReady, false);
  assert.equal(JSON.stringify(result).includes("DATABASE_URL"), false);
  assert.equal(result.rawPromptStored, false);
  assert.equal(result.rawResponseStored, false);
});

test("invalid JSON falls back to the rule path", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([
    { answerSummary: "not json" },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(calls.length, 2);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.toolSelectionSource, "rules");
  assert.equal(result.toolIntentValidated, false);
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.finalAnswerSource, "template");
  assert.equal(result.toolExecution.status, "success");
  assert.equal(result.finalAnswer.includes("Fallback:"), true);
});

test("plain chat with no rule match uses a direct LLM reply", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider, calls } = createSequencedProvider([
    { answerSummary: "A safe ordinary chat reply." },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "hello",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(calls.length, 1);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.selectedToolId, null);
  assert.equal(result.toolSelectionSource, "blocked");
  assert.equal(result.toolIntentValidated, null);
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.finalAnswerSource, "llm");
  assert.equal(result.toolExecution.status, "blocked");
  assert.equal(result.finalAnswer.includes("A safe ordinary chat reply."), true);
});

test("unknown tool ids are blocked", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"toolId":"doesNotExist","arguments":{},"reason":"nope","finalAnswerHint":"none"}',
    },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "show me something impossible",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.executionPath, "blocked");
  assert.equal(result.toolSelectionSource, "blocked");
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(
    result.blockedReasons.some((reason) =>
      reason.toLowerCase().includes("unknown tool id"),
    ),
    true,
  );
  assert.equal(result.finalAnswerSource, "blocked");
});

test("unsafe tools are blocked even if the LLM selects them", async () => {
  const { loaders } = createToolDataLoaders();
  const unsafeTool = {
    ...getWebAgentToolRegistry()[0],
    readOnly: false,
  };
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"toolId":"listBooks","arguments":{"limit":1},"reason":"books","finalAnswerHint":"should not pass"}',
    },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: [unsafeTool],
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.mode, "blocked");
  assert.equal(result.toolExecution.status, "blocked");
  assert.equal(result.blockedReasons[0], "unsafe_tool_definition");
  assert.equal(result.finalAnswerSource, "blocked");
});

test("provider errors fall back safely to a template reply", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"toolId":"listBooks","arguments":{"limit":1},"reason":"books","finalAnswerHint":"safe"}',
    },
    {
      throwError: new Error("DATABASE_URL=postgres://secret"),
    },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  const payload = JSON.stringify(result);

  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.finalAnswerSource, "template");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.realProviderCalled, true);
  assert.equal(payload.includes("DATABASE_URL"), false);
  assert.equal(result.finalAnswer.includes("Fallback:"), true);
});

test("safe final answers do not leak secrets from the provider response", async () => {
  const { loaders } = createToolDataLoaders();
  const { provider } = createSequencedProvider([
    {
      answerSummary:
        '{"toolId":"listBooks","arguments":{"limit":1},"reason":"books","finalAnswerHint":"safe"}',
    },
    {
      answerSummary:
        "Here is your api_key: sk-abc123 and bearer xyz789",
    },
  ]);

  const result = await runWebAgentSingleStep({
    userMessage: "list books",
    availableTools: getWebAgentToolRegistry(),
    toolDataLoaders: loaders,
    toolPreviewEnabled: true,
    toolGuardNotice: "guard enabled",
    toolGuardSourceLabel: "tool-guard-enabled (dev-only preview)",
    llmSelectionAllowed: true,
    llmProvider: provider,
  });

  assert.equal(result.finalAnswer.includes("sk-abc123"), false);
  assert.equal(result.finalAnswer.includes("bearer xyz789"), false);
});
