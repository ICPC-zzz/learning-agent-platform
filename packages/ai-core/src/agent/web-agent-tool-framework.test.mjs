import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebAgentSkillCandidatePreview,
  executeWebAgentToolPreview,
  WebAgentToolName,
} from "./web-agent-tool-framework.ts";

function createDataLoaders() {
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
      async listBooks() {
        listBooksCalls += 1;
        return [
          {
            bookId: "book-1",
            title: "TypeScript Guide",
            author: "Team",
            sourceType: "builtin",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ];
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
      async getReadingProgressSummary() {
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
          ],
        };
      },
    },
  };
}

test("listBooks preview returns safe read-only data", async () => {
  const { loaders, calls } = createDataLoaders();
  const result = await executeWebAgentToolPreview({
    message: "list books",
    toolId: WebAgentToolName.ListBooks,
    toolPreviewEnabled: true,
    toolInput: {},
    dataLoaders: loaders,
  });

  assert.equal(result.status, "success");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.toolId, WebAgentToolName.ListBooks);
  assert.equal(result.toolResultPreview?.includes("TypeScript Guide"), true);
  assert.equal(result.toolResultPreview?.includes("Read-only book preview"), true);
  assert.equal(calls.listBooks, 1);
  assert.equal(calls.getBookDetail, 0);
  assert.equal(calls.getReadingProgressSummary, 0);
});

test("getBookDetail preview resolves a fake repo record", async () => {
  const { loaders, calls } = createDataLoaders();
  const result = await executeWebAgentToolPreview({
    message: "查看书籍详情",
    toolId: WebAgentToolName.GetBookDetail,
    toolPreviewEnabled: true,
    toolInput: { bookId: "book-1" },
    dataLoaders: loaders,
  });

  assert.equal(result.status, "success");
  assert.equal(result.toolId, WebAgentToolName.GetBookDetail);
  assert.equal(result.toolResultPreview?.includes("Read-only book detail preview"), true);
  assert.equal(result.toolResultPreview?.includes("Intro"), true);
  assert.equal(result.toolResultPreview?.includes("Basics and setup."), true);
  assert.equal(result.inputSummary.includes("bookId=book-1"), true);
  assert.equal(calls.listBooks, 0);
  assert.equal(calls.getBookDetail, 1);
});

test("preview disabled blocks by default without touching data loaders", async () => {
  const { loaders, calls } = createDataLoaders();
  const result = await executeWebAgentToolPreview({
    message: "阅读进度",
    toolId: WebAgentToolName.GetReadingProgressSummary,
    toolPreviewEnabled: false,
    toolInput: {},
    dataLoaders: loaders,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.toolResultPreview?.includes("disabled by default"), true);
  assert.equal(calls.listBooks, 0);
  assert.equal(calls.getBookDetail, 0);
  assert.equal(calls.getReadingProgressSummary, 0);
});

test("preview errors fail safely without leaking secrets or stack details", async () => {
  const result = await executeWebAgentToolPreview({
    message: "list books",
    toolId: WebAgentToolName.ListBooks,
    toolPreviewEnabled: true,
    toolInput: {},
    dataLoaders: {
      async listBooks() {
        throw new Error("DATABASE_URL=postgres://secret");
      },
      async getBookDetail() {
        throw new Error("should not be used");
      },
      async getReadingProgressSummary() {
        throw new Error("should not be used");
      },
    },
  });

  const payload = JSON.stringify(result);
  assert.equal(result.status, "error");
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(payload.includes("DATABASE_URL"), false);
  assert.equal(result.errorReason, "preview_execution_failed_safely");
  assert.equal(result.toolResultPreview?.includes("failed safely"), true);
});

test("skill candidates stay preview-only and do not claim production readiness", async () => {
  const skillCandidate = createWebAgentSkillCandidatePreview({
    message: "Please show a read-only preview of saved books.",
    toolId: WebAgentToolName.ListBooks,
    toolExecution: {
      toolId: WebAgentToolName.ListBooks,
      status: "success",
      safeToExposeToClient: true,
      toolResultPreview: "Read-only book preview",
      blockedReason: null,
      errorReason: null,
      warnings: [],
      inputSummary: "no-input",
      readOnly: true,
      enabledByDefault: false,
      productionReady: false,
    },
  });

  assert.equal(skillCandidate.productionReady, false);
  assert.equal(skillCandidate.requiredTools[0], WebAgentToolName.ListBooks);
  assert.equal(skillCandidate.name.includes("skill draft"), true);
  assert.equal(skillCandidate.safetyNotes.some((note) => note.includes("preview-only")), true);
});
