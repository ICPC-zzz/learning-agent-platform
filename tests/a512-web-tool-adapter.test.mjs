import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createAssistantCanonicalToolRuntime,
  executeAssistantToolWithCanonicalResult,
  getAssistantToolCanonicalName,
} from "../apps/web/src/lib/assistant/tools/tool-executor.ts";
import { ToolExecutionStatus } from "../packages/ai-core/src/tools/index.ts";

describe("A512 web assistant tool adapter", () => {
  it("maps assistant empty results to canonical empty status and safe output", async () => {
    const execution = await executeAssistantToolWithCanonicalResult(
      createAssistantTestTool({
        execute: async () => ({
          name: "search_codeforces_problems",
          ok: false,
          summary: "No candidate problems available from internal provider.",
          items: [],
          sources: [],
          warnings: ["empty"],
          errorCode: "empty",
          errorMessage: "No candidate problems available from internal provider.",
          timedOut: false,
          rawResponseStored: false,
        }),
      }),
      { query: "unlikely" },
      createAssistantContext(),
    );

    assert.equal(execution.canonicalResult.toolName, "assistant.search_codeforces_problems");
    assert.equal(execution.canonicalResult.status, ToolExecutionStatus.Empty);
    assert.equal(execution.result.ok, false);
    assert.equal(execution.result.errorCode, "empty_result");
    assert.doesNotMatch(execution.result.summary, /No candidate problems/i);
  });

  it("uses canonical timeout handling for slow assistant tools", async () => {
    const execution = await executeAssistantToolWithCanonicalResult(
      createAssistantTestTool({
        timeoutMs: 20,
        execute: async () => {
          await sleep(80);
          return {
            name: "search_codeforces_problems",
            ok: true,
            summary: "late result",
            items: [{ id: "late" }],
            sources: [],
            warnings: [],
            timedOut: false,
            rawResponseStored: false,
          };
        },
      }),
      { query: "slow" },
      createAssistantContext(),
    );

    assert.equal(execution.canonicalResult.status, ToolExecutionStatus.TimedOut);
    assert.equal(execution.result.timedOut, true);
    assert.equal(execution.result.errorCode, "timed_out");
  });

  it("exposes current assistant tools through the canonical runtime adapter", async () => {
    const runtime = createAssistantCanonicalToolRuntime(createAssistantContext());
    const names = (await runtime.listTools()).map((tool) => tool.name);

    assert.ok(names.includes(getAssistantToolCanonicalName("search_codeforces_problems")));
    assert.ok(names.includes(getAssistantToolCanonicalName("getUpcomingCodeforcesContests")));
  });
});

function createAssistantTestTool(overrides = {}) {
  return {
    name: "search_codeforces_problems",
    description: "Search Codeforces problems.",
    inputSchema: {
      type: "object",
      title: "Input",
      description: "Input",
      properties: {
        query: { type: "string", description: "Query" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      title: "Output",
      description: "Output",
      properties: {},
      additionalProperties: false,
    },
    timeoutMs: overrides.timeoutMs ?? 500,
    maxResults: 5,
    maxSummaryChars: 500,
    sourceLabel: "Codeforces",
    validateInput: (input) =>
      Boolean(input && typeof input === "object" && typeof input.query === "string"),
    execute: overrides.execute,
  };
}

function createAssistantContext() {
  return {
    userId: "user-a",
    question: "search",
    pageContext: { route: "/ai", pageType: "ai" },
    learningContext: {
      isAuthenticated: true,
      summary: "",
      recentPracticeCount: 0,
      recentReadingCount: 0,
      goalSummary: "",
      practiceSummary: "",
      readingSummary: "",
    },
    guardEnv: {},
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
