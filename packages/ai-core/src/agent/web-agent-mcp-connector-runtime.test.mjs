import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebAgentToolExecutionResultFromMcpCallResult,
  evaluateWebAgentMcpConnectorGuard,
  executeMcpConnectorCallPreview,
  McpCallStatus,
  McpPermission,
  getWebAgentMcpConnectorRegistry,
} from "./web-agent-mcp-connector-runtime.ts";
import { WebAgentToolName } from "./web-agent-readonly-tool-registry.ts";

function createJsonFetch(responseMap) {
  return async (url) => {
    const response = responseMap[url];
    if (response === undefined) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    return {
      ok: response.ok,
      status: response.status,
      url,
      headers: {
        get(name) {
          if (name.toLowerCase() === "content-type") {
            return "application/json";
          }
          return null;
        },
      },
      async text() {
        return JSON.stringify(response.body);
      },
    };
  };
}

function createAllowedEnv(overrides = {}) {
  return {
    NODE_ENV: "development",
    LAP_WEB_AGENT_MCP_DEV_ENABLED: "1",
    LAP_ALLOW_AGENT_MCP: "1",
    LAP_AGENT_GITHUB_READONLY_ENABLED: "1",
    LAP_AGENT_GITHUB_ALLOWED_REPOS: "openai/openai",
    GITHUB_TOKEN: "ghp_test_token",
    ...overrides,
  };
}

test("MCP guard blocks by default until every dev guard is enabled", () => {
  const guard = evaluateWebAgentMcpConnectorGuard({
    NODE_ENV: "development",
  });

  assert.equal(guard.allowed, false);
  assert.equal(guard.enabled, false);
  assert.equal(guard.missingEnvKeys.includes("LAP_WEB_AGENT_MCP_DEV_ENABLED"), true);
  assert.equal(guard.missingEnvKeys.includes("LAP_ALLOW_AGENT_MCP"), true);
  assert.equal(
    guard.missingEnvKeys.includes("LAP_AGENT_GITHUB_READONLY_ENABLED"),
    true,
  );
  assert.equal(guard.missingEnvKeys.includes("LAP_AGENT_GITHUB_ALLOWED_REPOS"), true);
  assert.equal(guard.missingEnvKeys.includes("GITHUB_TOKEN"), true);
});

test("MCP preview stays disabled when the preview toggle is off", async () => {
  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubListIssues,
    toolInput: { repoFullName: "openai/openai" },
    messagePreview: "github issues",
    toolPreviewEnabled: false,
    env: createAllowedEnv(),
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.status, McpCallStatus.Blocked);
  assert.equal(result.blockedReason, "tool_preview_disabled_by_default");
  assert.equal(result.providerMode, "blocked");
});

test("GitHub fake provider succeeds without network", async () => {
  let fetchCalls = 0;
  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubGetRepoSummary,
    toolInput: {
      repoFullName: "openai/openai",
      issueNumber: 12,
      perPage: 2,
    },
    messagePreview: "github repo summary",
    toolPreviewEnabled: true,
    providerMode: "fake",
    env: {
      NODE_ENV: "development",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("should not be called");
    },
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.status, McpCallStatus.Succeeded);
  assert.equal(result.providerMode, "fake");
  assert.equal(result.githubRepoAccessStatus, "not_checked");
  assert.equal(result.resultPreview?.includes("Provider: fake"), true);
  assert.equal(result.resultPreview?.includes("Issue detail"), true);
  assert.equal(result.resultPreview?.includes("Fake issue detail 12"), true);
});

test("GitHub live provider succeeds when allowlist and token are configured", async () => {
  const env = createAllowedEnv();
  const fetchImpl = createJsonFetch({
    "https://api.github.com/repos/openai/openai": {
      ok: true,
      status: 200,
      body: {
        full_name: "openai/openai",
        name: "openai",
        description: "OpenAI public repository",
        private: false,
        default_branch: "main",
        stargazers_count: 1,
        forks_count: 2,
        open_issues_count: 3,
        html_url: "https://github.com/openai/openai",
      },
    },
    "https://api.github.com/repos/openai/openai/issues/12": {
      ok: true,
      status: 200,
      body: {
        number: 12,
        title: "Preview issue detail",
        state: "open",
        body: "safe detail body",
        html_url: "https://github.com/openai/openai/issues/12",
      },
    },
    "https://api.github.com/repos/openai/openai/issues?state=open&per_page=3&sort=created&direction=desc":
      {
        ok: true,
        status: 200,
        body: [
          {
            number: 101,
            title: "Preview issue",
            state: "open",
            html_url: "https://github.com/openai/openai/issues/101",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T01:00:00Z",
          },
        ],
      },
  });

  const repoSummaryResult = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubGetRepoSummary,
    toolInput: {
      repoFullName: "openai/openai",
      issueNumber: 12,
      perPage: 3,
    },
    messagePreview: "github repo summary",
    toolPreviewEnabled: true,
    env,
    fetchImpl,
  });

  const listIssuesResult = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubListIssues,
    toolInput: { repoFullName: "openai/openai", perPage: 3, state: "open" },
    messagePreview: "github issues",
    toolPreviewEnabled: true,
    env,
    fetchImpl,
  });

  const execution = createWebAgentToolExecutionResultFromMcpCallResult(
    listIssuesResult,
  );

  assert.equal(repoSummaryResult.status, McpCallStatus.Succeeded);
  assert.equal(listIssuesResult.status, McpCallStatus.Succeeded);
  assert.equal(repoSummaryResult.providerMode, "live");
  assert.equal(listIssuesResult.providerMode, "live");
  assert.equal(repoSummaryResult.githubRepoAccessStatus, "allowed");
  assert.equal(listIssuesResult.githubRepoAccessStatus, "allowed");
  assert.equal(repoSummaryResult.resultPreview?.includes("GitHub repo summary preview"), true);
  assert.equal(repoSummaryResult.resultPreview?.includes("Provider: live"), true);
  assert.equal(repoSummaryResult.resultPreview?.includes("Issue detail: #12"), true);
  assert.equal(listIssuesResult.resultPreview?.includes("GitHub issues preview"), true);
  assert.equal(listIssuesResult.resultPreview?.includes("Preview issue"), true);
  assert.equal(execution.status, "success");
  assert.equal(execution.safeToExposeToClient, true);
  assert.equal(execution.readOnly, true);
});

test("GitHub repo not in allowlist blocks safely", async () => {
  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubListIssues,
    toolInput: { repoFullName: "openai/not-allowlisted", perPage: 2 },
    messagePreview: "github issues",
    toolPreviewEnabled: true,
    env: createAllowedEnv({
      LAP_AGENT_GITHUB_ALLOWED_REPOS: "openai/openai,openai/another-repo",
    }),
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.status, McpCallStatus.Blocked);
  assert.equal(result.blockedReason, "repo_not_allowlisted");
  assert.equal(result.providerMode, "live");
  assert.equal(result.githubRepoAccessStatus, "blocked");
});

test("missing token blocks safely without leaking raw values", async () => {
  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubListIssues,
    toolInput: { repoFullName: "openai/openai", perPage: 2 },
    messagePreview: "github issues",
    toolPreviewEnabled: true,
    env: createAllowedEnv({
      GITHUB_TOKEN: undefined,
    }),
    fetchImpl: async () => {
      throw new Error("DATABASE_URL=postgres://secret");
    },
  });

  const payload = JSON.stringify(result);
  assert.equal(result.status, McpCallStatus.Blocked);
  assert.equal(result.missingEnvKeys.includes("GITHUB_TOKEN"), true);
  assert.equal(payload.includes("postgres://secret"), false);
  assert.equal(payload.includes("DATABASE_URL=postgres://secret"), false);
  assert.equal(payload.includes("ghp_test_token"), false);
});

test("connector errors fail safely with redacted traces", async () => {
  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: WebAgentToolName.GithubListIssues,
    toolInput: { repoFullName: "openai/openai", perPage: 2 },
    messagePreview: "github issues",
    toolPreviewEnabled: true,
    env: createAllowedEnv(),
    fetchImpl: async () => {
      throw new Error("raw response with secret token");
    },
  });

  const payload = JSON.stringify(result);
  assert.equal(result.status, McpCallStatus.Blocked);
  assert.equal(result.blockedReason, "github_fetch_blocked");
  assert.equal(payload.includes("secret token"), false);
  assert.equal(payload.includes("raw response"), false);
  assert.equal(
    result.trace.some((entry) => entry.includes("ghp_test_token")),
    false,
  );
});

test("GitHub write requests are blocked by the read-only connector", async () => {
  const registry = getWebAgentMcpConnectorRegistry();
  const github = registry.find((connection) => connection.connectorId === "github");

  assert.ok(github);

  const writeToolId = "githubWritePreview";
  const writeConnector = {
    ...github,
    toolDescriptors: [
      ...github.toolDescriptors,
      {
        connectorId: "github",
        toolId: writeToolId,
        displayName: "githubWritePreview",
        description: "Write preview tool.",
        permission: McpPermission.RequiresUserApproval,
        transport: github.transport,
        inputSchema: {
          fields: [
            {
              name: "repoFullName",
              type: "string",
              required: true,
              description: "GitHub repository in owner/name form.",
              example: "openai/openai",
            },
          ],
        },
        readOnly: false,
        safeToExposeToClient: true,
        enabledByDefault: false,
        productionReady: false,
        devOnly: true,
        notes: ["Write operations must stay blocked."],
      },
    ],
  };

  const result = await executeMcpConnectorCallPreview({
    connectorId: "github",
    toolId: writeToolId,
    toolInput: { repoFullName: "openai/openai" },
    messagePreview: "github write request",
    toolPreviewEnabled: true,
    providerMode: "live",
    env: createAllowedEnv(),
    connectorRegistry: [writeConnector],
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.status, McpCallStatus.Blocked);
  assert.equal(result.blockedReason, "write_operation_blocked");
  assert.equal(result.providerMode, "blocked");
});

test("Slack stays metadata-only and does not expose a live connector", () => {
  const registry = getWebAgentMcpConnectorRegistry();
  const slack = registry.find((connection) => connection.connectorId === "slack");

  assert.equal(slack?.liveConnectionEnabled, false);
  assert.equal(slack?.toolDescriptors.length, 0);
  assert.equal(slack?.permission, "previewOnly");
});
