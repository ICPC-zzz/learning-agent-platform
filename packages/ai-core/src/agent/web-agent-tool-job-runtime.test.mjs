import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebAgentToolJobRuntime,
  ToolJobStatus,
  ToolJobTraceEventKind,
} from "./web-agent-tool-job-runtime.ts";
import {
  WebAgentToolName,
} from "./web-agent-readonly-tool-registry.ts";
import {
  getWebAgentToolRegistry,
} from "./web-agent-readonly-tool-registry.ts";

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

test("submitToolJob starts queued before the async runner resolves", async () => {
  const { loaders } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: loaders,
    policy: { enabled: false },
  });

  const handle = runtime.submitToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  const queued = handle.getSnapshot();
  assert.equal(queued.status, ToolJobStatus.Queued);
  assert.equal(queued.traceEvents[0].kind, ToolJobTraceEventKind.Queued);

  const result = await handle.result;

  assert.equal(result.status, ToolJobStatus.Blocked);
  assert.equal(result.blockedReason, "tool_job_disabled_by_default");
  assert.equal(result.result?.resultPreview?.includes("blocked"), true);
});

test("disabled policy blocks tool execution", async () => {
  const { loaders } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: loaders,
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.Blocked);
  assert.equal(result.blockedReason, "tool_job_disabled_by_default");
  assert.equal(result.result?.resultPreview?.includes("blocked"), true);
});

test("non readOnly tools are blocked", async () => {
  const { loaders } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: loaders,
    toolRegistry: [
      {
        ...getWebAgentToolRegistry()[0],
        readOnly: false,
      },
    ],
    policy: { enabled: true },
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.Blocked);
  assert.equal(result.blockedReason, "unsafe_tool_definition");
});

test("unsafe tool results are blocked", async () => {
  const { loaders } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: loaders,
    policy: { enabled: true },
    executor: async () => ({
      toolId: WebAgentToolName.ListBooks,
      status: "success",
      safeToExposeToClient: false,
      toolResultPreview: "unsafe output",
      blockedReason: null,
      errorReason: null,
      warnings: [],
      inputSummary: "limit=2",
      readOnly: true,
      enabledByDefault: false,
      productionReady: false,
    }),
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.Blocked);
  assert.equal(result.blockedReason, "unsafe_result");
  assert.equal(result.result?.resultPreview?.includes("unsafe"), true);
});

test("successful tools return succeeded jobs", async () => {
  const { loaders, calls } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: loaders,
    policy: { enabled: true },
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.Succeeded);
  assert.equal(result.result?.toolExecutionStatus, "success");
  assert.equal(result.result?.resultPreview?.includes("TypeScript Guide"), true);
  assert.equal(calls.listBooks, 1);
});

test("tool errors are sanitized and become failed jobs", async () => {
  const { loaders } = createToolDataLoaders();
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: {
      ...loaders,
      async listBooks() {
        throw new Error("DATABASE_URL=postgres://secret");
      },
    },
    policy: { enabled: true },
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  const payload = JSON.stringify(result);

  assert.equal(result.status, ToolJobStatus.Failed);
  assert.equal(result.errorReason?.includes("DATABASE_URL"), false);
  assert.equal(payload.includes("DATABASE_URL"), false);
  assert.equal(result.result?.resultPreview?.includes("failed safely"), true);
});

test("tool jobs time out when execution takes too long", async () => {
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: createToolDataLoaders().loaders,
    policy: {
      enabled: true,
      timeoutMs: 5,
    },
    executor: async () =>
      new Promise(() => {
        // Intentionally never resolves to exercise the timeout path.
      }),
  });

  const result = await runtime.runToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.TimedOut);
  assert.equal(result.timeoutReason?.includes("timed out"), true);
});

test("tool jobs map request_timeout tool results to timedOut", async () => {
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: createToolDataLoaders().loaders,
    policy: {
      enabled: true,
    },
    executor: async () => ({
      toolId: WebAgentToolName.ListBooks,
      status: "error",
      safeToExposeToClient: true,
      toolResultPreview: "The safe preview timed out after 2500ms.",
      finalUrl: "https://example.com/",
      contentType: "text/html; charset=utf-8",
      textPreview: "timeout",
      truncated: false,
      blockedReason: null,
      errorReason: "request_timeout",
      warnings: ["The request timed out safely."],
      inputSummary: "limit=2",
      readOnly: true,
      enabledByDefault: false,
      productionReady: false,
    }),
  });

  const result = await runtime.runToolJob({
    messagePreview: "fetch page",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  assert.equal(result.status, ToolJobStatus.TimedOut);
  assert.equal(result.timeoutReason, "request_timeout");
  assert.equal(result.result?.toolExecutionStatus, "error");
});

test("tool jobs can be cancelled", async () => {
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: createToolDataLoaders().loaders,
    policy: {
      enabled: true,
      timeoutMs: 100,
    },
    executor: async () =>
      new Promise(() => {
        // Intentionally never resolves to exercise the cancellation path.
      }),
  });

  const handle = runtime.submitToolJob({
    messagePreview: "list books",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  const cancelled = handle.cancel("user cancelled");
  assert.equal(cancelled?.status, ToolJobStatus.Queued);

  const result = await handle.result;
  assert.equal(result.status, ToolJobStatus.Cancelled);
  assert.equal(result.cancelledReason, "user cancelled");
});

test("trace events stay secret-safe and previews are truncated", async () => {
  const runtime = createWebAgentToolJobRuntime({
    toolDataLoaders: createToolDataLoaders().loaders,
    policy: {
      enabled: true,
      maxPreviewBytes: 20,
    },
    executor: async () => ({
      toolId: WebAgentToolName.ListBooks,
      status: "success",
      safeToExposeToClient: true,
      toolResultPreview: "abcdefghijklmnopqrstuvwxyz",
      blockedReason: null,
      errorReason: null,
      warnings: [],
      inputSummary: "limit=2",
      readOnly: true,
      enabledByDefault: false,
      productionReady: false,
    }),
  });

  const result = await runtime.runToolJob({
    messagePreview: "api_key=sk-test raw prompt",
    selectedToolId: WebAgentToolName.ListBooks,
    selectedToolInput: { limit: 2 },
    selectedBy: "rules",
    selectionSource: "rules",
    toolPreviewEnabled: true,
  });

  const payload = JSON.stringify(result);

  assert.equal(payload.includes("sk-test"), false);
  assert.equal(
    result.traceEvents.every(
      (event) => event.rawPromptStored === false && event.rawResponseStored === false,
    ),
    true,
  );
  assert.equal(result.result?.previewTruncated, true);
  assert.equal(result.result?.resultPreview?.endsWith("..."), true);
});
