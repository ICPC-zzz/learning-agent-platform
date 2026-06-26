import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebAgentReadOnlyToolRegistry,
  getWebAgentToolRegistry,
  inferWebAgentReadOnlyToolName,
  inferWebAgentToolName,
  WebAgentReadOnlyToolName,
} from "./web-agent-readonly-tool-registry.ts";

test("registry exposes exactly six read-only tools", () => {
  const registry = getWebAgentReadOnlyToolRegistry();

  assert.equal(registry.length, 6);
  assert.deepEqual(
    registry.map((tool) => tool.toolId),
    [
      WebAgentReadOnlyToolName.ListBooks,
      WebAgentReadOnlyToolName.GetReadingProgressSummary,
      WebAgentReadOnlyToolName.GetBookDetail,
      WebAgentReadOnlyToolName.SafeWebFetch,
      WebAgentReadOnlyToolName.GithubListIssues,
      WebAgentReadOnlyToolName.GithubGetRepoSummary,
    ],
  );

  for (const tool of registry) {
    assert.equal(tool.readOnly, true);
    assert.equal(tool.safeToExposeToClient, true);
    assert.equal(tool.enabledByDefault, false);
    assert.equal(
      tool.toolId === WebAgentReadOnlyToolName.SafeWebFetch
        ? tool.riskLevel
        : tool.toolId === WebAgentReadOnlyToolName.GithubListIssues ||
            tool.toolId === WebAgentReadOnlyToolName.GithubGetRepoSummary
          ? tool.riskLevel
          : "low",
      tool.toolId === WebAgentReadOnlyToolName.SafeWebFetch
        ? "critical"
        : tool.toolId === WebAgentReadOnlyToolName.GithubListIssues ||
            tool.toolId === WebAgentReadOnlyToolName.GithubGetRepoSummary
          ? "high"
          : "low",
    );
    assert.equal(tool.description.length > 0, true);
    assert.equal(tool.inputSchema.type, "object");
  }
});

test("registry alias and tool inference stay aligned", () => {
  assert.equal(getWebAgentToolRegistry().length, 6);
  assert.equal(
    inferWebAgentReadOnlyToolName("Please list books in the library"),
    WebAgentReadOnlyToolName.ListBooks,
  );
  assert.equal(
    inferWebAgentToolName("Show recent reading progress summary"),
    WebAgentReadOnlyToolName.GetReadingProgressSummary,
  );
  assert.equal(
    inferWebAgentToolName("查看书籍详情"),
    WebAgentReadOnlyToolName.GetBookDetail,
  );
  assert.equal(
    inferWebAgentToolName("fetch https://example.com"),
    WebAgentReadOnlyToolName.SafeWebFetch,
  );
  assert.equal(
    inferWebAgentToolName("github repo summary openai/openai"),
    WebAgentReadOnlyToolName.GithubGetRepoSummary,
  );
  assert.equal(
    inferWebAgentToolName("list github issues for openai/openai"),
    WebAgentReadOnlyToolName.GithubListIssues,
  );
  assert.equal(inferWebAgentToolName("hello"), null);
});
