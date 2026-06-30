import assert from "node:assert/strict";
import { describe, it } from "node:test";

/* global process */

import { runAssistantOrchestrator } from "../apps/web/src/lib/assistant/assistant-orchestrator.ts";

describe("A513 browser tool runtime validation injections", () => {
  const cases = [
    ["tool_empty_once", "empty"],
    ["tool_internal_error_once", "failed"],
    ["tool_timeout_once", "timed_out"],
    ["tool_cancel_once", "cancelled"],
    ["tool_permission_denied_once", "permission_denied"],
  ];

  for (const [mode, expectedStatus] of cases) {
    it(`maps ${mode} through the canonical tool timeline`, async () => {
      const previous = process.env.LAP_AGENT_STABILITY_TEST_MODE;
      process.env.LAP_AGENT_STABILITY_TEST_MODE = "1";
      try {
        const response = await runAssistantOrchestrator(
          {
            question: "近期 Codeforces 比赛",
            pageContext: {
              route: "/ai",
              pageType: "ai",
              title: "AI",
            },
            userId: null,
          },
          {
            stabilityInjectionMode: mode,
          },
        );

        const contestTimeline = response.toolTimeline?.find((item) => item.toolName === "getUpcomingCodeforcesContests");
        assert.ok(contestTimeline, "expected upcoming contest tool timeline item");
        assert.equal(contestTimeline.status, expectedStatus);
        assert.equal(response.safeToExposeToClient.rawResponseStored, false);
        assert.doesNotMatch(response.message, /api_key|secret|Invalid Prisma|stack trace/i);
        assert.doesNotMatch(contestTimeline.safetySummary ?? "", /api_key|secret|Invalid Prisma|stack trace/i);
      } finally {
        if (previous === undefined) {
          delete process.env.LAP_AGENT_STABILITY_TEST_MODE;
        } else {
          process.env.LAP_AGENT_STABILITY_TEST_MODE = previous;
        }
      }
    });
  }
});
