import assert from "node:assert/strict";
import test from "node:test";

import { sendWebAgentMessageCore } from "./web-agent-message-core.ts";

const baseEnv = {
  NODE_ENV: "development",
  LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
};

const networkEnv = {
  ...baseEnv,
  LAP_WEB_AGENT_NETWORK_DEV_ENABLED: "1",
  LAP_ALLOW_AGENT_NETWORK: "1",
};

const externalEnv = {
  ...baseEnv,
  LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED: "1",
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "1",
  LAP_LLM_DEV_ENDPOINT: "https://example.invalid",
  LAP_LLM_DEV_API_KEY: "test-key",
  LAP_LLM_DEV_APIPassword: "test-password",
  LAP_LLM_DEV_MODEL: "gpt-5.4-mini",
};

async function withTemporaryEnv(overrides, run) {
  const previous = {};

  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createRepositories() {
  return {
    bookRepository: {
      async listBooks() {
        return [
          {
            id: "book-1",
            sourceType: "builtin",
            title: "TypeScript Guide",
            subtitle: null,
            author: "Team",
            description: null,
            sourceUrl: null,
            language: "en",
            tags: [],
            metadata: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ];
      },
      async getBookReaderData(bookId) {
        if (bookId !== "book-1") {
          return null;
        }

        return {
          book: {
            id: "book-1",
            sourceType: "builtin",
            title: "TypeScript Guide",
            subtitle: null,
            author: "Team",
            description: null,
            sourceUrl: null,
            language: "en",
            tags: [],
            metadata: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
          chapters: [
            {
              id: "chapter-1",
              bookId: "book-1",
              title: "Intro",
              orderIndex: 0,
              summary: "Basics and setup.",
              createdAt: new Date("2026-01-01T00:00:00Z"),
              updatedAt: new Date("2026-01-01T00:00:00Z"),
            },
          ],
          chunks: [],
        };
      },
    },
    readingProgressRepository: {
      async listReadingProgress() {
        return [
          {
            id: "progress-1",
            userId: "user-1",
            bookId: "book-1",
            chapterId: "chapter-1",
            progressRatio: 0.5,
            lastChunkId: null,
            completedAt: null,
            createdAt: new Date("2026-01-01T08:00:00Z"),
            updatedAt: new Date("2026-01-01T08:00:00Z"),
          },
        ];
      },
    },
    userRepository: {
      async getUserByEmail(email) {
        if (email !== "demo@example.com") {
          return null;
        }

        return {
          id: "user-1",
          email: "demo@example.com",
          name: "Demo User",
          authProvider: "demo",
          authProviderId: "demo-1",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        };
      },
    },
  };
}

function createExternalProvider(responses) {
  const calls = [];

  return {
    calls,
    provider: {
      mode: "external-dev-only",
      label: "fake-provider",
      async generate(request) {
        calls.push(request);
        const response = responses.shift();

        if (response === undefined) {
          throw new Error("No more fake responses configured.");
        }

        return {
          ok: true,
          answerSummary: response,
          providerMode: "external-dev-only",
          realProviderCalled: true,
          networkAccessed: false,
          secretSafe: true,
          rawPromptStored: false,
          rawResponseStored: false,
          devOnly: true,
          productionReady: false,
          warnings: [],
          createdAt: new Date().toISOString(),
        };
      },
    },
  };
}

test("rules select listBooks, progress, and bookDetail through the API path", async () => {
  const repos = createRepositories();

  const books = await sendWebAgentMessageCore(
    {
      message: "list books",
      toolPreviewEnabled: true,
    },
    { env: baseEnv, ...repos },
  );

  const progress = await sendWebAgentMessageCore(
    {
      message: "check reading progress",
      toolPreviewEnabled: true,
    },
    { env: baseEnv, ...repos },
  );

  const detail = await sendWebAgentMessageCore(
    {
      message: "show book detail bookId=book-1",
      toolPreviewEnabled: true,
    },
    { env: baseEnv, ...repos },
  );

  assert.equal(books.mode, "mock");
  assert.equal(books.selectedToolId, "listBooks");
  assert.equal(books.toolUsed, "listBooks");
  assert.equal(books.toolExecutionStatus, "success");
  assert.equal(books.toolResultPreview?.includes("TypeScript Guide"), true);
  assert.equal(books.toolJob?.status, "succeeded");
  assert.equal(books.loopStepCount, 2);
  assert.equal(books.loopToolCallCount, 1);
  assert.equal(books.skillCandidate.productionReady, false);

  assert.equal(progress.selectedToolId, "getReadingProgressSummary");
  assert.equal(progress.toolUsed, "getReadingProgressSummary");
  assert.equal(progress.toolExecutionStatus, "success");
  assert.equal(progress.toolJob?.status, "succeeded");
  assert.equal(progress.toolResultPreview?.includes("Read-only reading progress preview"), true);

  assert.equal(detail.selectedToolId, "getBookDetail");
  assert.equal(detail.toolUsed, "getBookDetail");
  assert.equal(detail.toolExecutionStatus, "success");
  assert.equal(detail.toolJob?.status, "succeeded");
  assert.equal(detail.toolResultPreview?.includes("Read-only book detail preview"), true);
  assert.equal(detail.toolResultPreview?.includes("Intro"), true);
  assert.equal(detail.safeToExposeToClient, true);
  assert.equal(detail.rawPromptStored, false);
  assert.equal(detail.rawResponseStored, false);
});

test("tool guard disabled by default blocks execution", async () => {
  const result = await sendWebAgentMessageCore(
    {
      message: "list books",
      toolPreviewEnabled: false,
    },
    { env: baseEnv, ...createRepositories() },
  );

  assert.equal(result.mode, "blocked");
  assert.equal(result.selectedToolId, "listBooks");
  assert.equal(result.toolExecutionStatus, "blocked");
  assert.equal(result.toolExecution.blockedReason, "tool_preview_disabled_by_default");
  assert.equal(result.toolJob?.status, "blocked");
  assert.equal(result.toolResultPreview?.includes("tool_preview_disabled_by_default"), true);
  assert.equal(result.safeToExposeToClient, true);
});

test("GitHub read-only preview succeeds when every dev guard is enabled", async () => {
  const mcpEnv = {
    NODE_ENV: "development",
    LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
    LAP_WEB_AGENT_MCP_DEV_ENABLED: "1",
    LAP_ALLOW_AGENT_MCP: "1",
    LAP_AGENT_GITHUB_READONLY_ENABLED: "1",
    LAP_AGENT_GITHUB_ALLOWED_REPOS: "openai/openai",
    GITHUB_TOKEN: "ghp_test_token",
  };

  const result = await withTemporaryEnv(mcpEnv, async () =>
    sendWebAgentMessageCore(
      {
        message: "github repo summary openai/openai",
        toolPreviewEnabled: true,
        requestedToolName: "githubGetRepoSummary",
        requestedToolInput: {
          repoFullName: "openai/openai",
          issueNumber: 1,
          perPage: 3,
        },
      },
      {
        env: {
          ...baseEnv,
          ...mcpEnv,
        },
        fetchImpl: async (url) => {
          const urlText = String(url);

          if (urlText.endsWith("/issues/1")) {
            return {
              ok: true,
              status: 200,
              url: urlText,
              headers: { get: () => "application/json" },
              async text() {
                return JSON.stringify({
                  number: 1,
                  title: "Preview issue detail",
                  state: "open",
                  body: "safe detail body",
                  html_url: "https://github.com/openai/openai/issues/1",
                });
              },
            };
          }

          if (urlText.includes("/repos/openai/openai/issues?")) {
            return {
              ok: true,
              status: 200,
              url: urlText,
              headers: { get: () => "application/json" },
              async text() {
                return JSON.stringify([
                  {
                    number: 1,
                    title: "Preview issue",
                    state: "open",
                    html_url: "https://github.com/openai/openai/issues/1",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                ]);
              },
            };
          }

          return {
            ok: true,
            status: 200,
            url: urlText,
            headers: { get: () => "application/json" },
            async text() {
              return JSON.stringify({
                full_name: "openai/openai",
                name: "openai",
                description: "OpenAI repo",
                private: false,
                default_branch: "main",
                stargazers_count: 1,
                forks_count: 2,
                open_issues_count: 3,
                html_url: "https://github.com/openai/openai",
              });
            },
          };
        },
        ...createRepositories(),
      },
    ),
  );

  assert.equal(result.selectedToolId, "githubGetRepoSummary");
  assert.equal(result.selectedMcpToolId, "githubGetRepoSummary");
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.toolJob?.status, "succeeded");
  assert.equal(result.toolResultPreview?.includes("GitHub repo summary preview"), true);
  assert.equal(result.toolExecution.providerMode, "live");
  assert.equal(result.toolExecution.githubRepoAccessStatus, "allowed");
  assert.equal(result.toolResultPreview?.includes("Issue detail: #1"), true);
  assert.equal(result.mcpGuard.allowed, true);
  assert.equal(result.mcpGuard.missingEnvKeys.length, 0);
});

test("GitHub preview blocks safely when MCP guard env is missing", async () => {
  const result = await withTemporaryEnv(
    {
      NODE_ENV: "development",
      LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
    },
    async () =>
      sendWebAgentMessageCore(
        {
          message: "list github issues openai/openai",
          toolPreviewEnabled: true,
        },
        {
          env: {
            ...baseEnv,
            NODE_ENV: "development",
            LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
          },
          ...createRepositories(),
        },
      ),
  );

  assert.equal(result.selectedToolId, "githubListIssues");
  assert.equal(result.toolExecutionStatus, "blocked");
  assert.equal(result.toolExecution.blockedReason, "mcp_guard_disabled");
  assert.equal(result.mcpGuard.allowed, false);
  assert.equal(result.mcpGuard.missingEnvKeys.includes("GITHUB_TOKEN"), true);
  assert.equal(result.mcpGuard.missingEnvKeys.includes("LAP_WEB_AGENT_MCP_DEV_ENABLED"), true);
  assert.equal(result.mcpGuard.missingEnvKeys.includes("LAP_ALLOW_AGENT_MCP"), true);
  assert.equal(
    result.mcpGuard.missingEnvKeys.includes("LAP_AGENT_GITHUB_ALLOWED_REPOS"),
    true,
  );
});

test("safeWebFetch can preview a public HTTPS page through the API path", async () => {
  const result = await sendWebAgentMessageCore(
    {
      message: "fetch https://example.com",
      toolPreviewEnabled: true,
    },
    {
      env: networkEnv,
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
      ...createRepositories(),
    },
  );

  assert.equal(result.networkGuard.allowed, true);
  assert.equal(result.selectedToolId, "safeWebFetch");
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.toolExecution.finalUrl, "https://example.com/");
  assert.equal(result.toolExecution.textPreview?.includes("Example Domain"), true);
  assert.equal(result.toolJob?.status, "succeeded");
});

test("safeWebFetch reads the network dev guard from process env", async () => {
  const result = await withTemporaryEnv(
    {
      NODE_ENV: "development",
      LAP_WEB_AGENT_TOOLS_DEV_ENABLED: "1",
      LAP_WEB_AGENT_NETWORK_DEV_ENABLED: "1",
      LAP_ALLOW_AGENT_NETWORK: "1",
    },
    async () =>
      sendWebAgentMessageCore(
        {
          message: "fetch https://example.com",
          toolPreviewEnabled: true,
        },
        {
          fetchImpl: async () => ({
            status: 200,
            url: "https://example.com/",
            headers: new Headers({
              "content-type": "text/plain; charset=utf-8",
            }),
            async text() {
              return "Example Domain";
            },
          }),
          ...createRepositories(),
        },
      ),
  );

  assert.equal(result.networkGuard.allowed, true);
  assert.equal(result.toolGuardEnabled, true);
  assert.equal(result.selectedToolId, "safeWebFetch");
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.toolExecution.finalUrl, "https://example.com/");
});

test("safeWebFetch blocks localhost URLs through the API path", async () => {
  let fetchCalls = 0;
  const result = await sendWebAgentMessageCore(
    {
      message: "fetch http://127.0.0.1/private",
      toolPreviewEnabled: true,
    },
    {
      env: networkEnv,
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("fetch must not run");
      },
      ...createRepositories(),
    },
  );

  assert.equal(fetchCalls, 0);
  assert.equal(result.networkGuard.allowed, true);
  assert.equal(result.selectedToolId, "safeWebFetch");
  assert.equal(result.toolExecutionStatus, "blocked");
  assert.equal(result.toolExecution.blockedReason, "blocked_private_address");
  assert.equal(result.toolJob?.status, "blocked");
});

test("missing external guard stays rule-only and does not call the LLM", async () => {
  const repos = createRepositories();
  const fake = createExternalProvider([]);

  const result = await sendWebAgentMessageCore(
    {
      message: "list books",
      useExternalLlmDev: true,
      toolPreviewEnabled: true,
    },
    {
      env: baseEnv,
      externalProvider: fake.provider,
      ...repos,
    },
  );

  assert.equal(fake.calls.length, 0);
  assert.equal(result.mode, "mock");
  assert.equal(result.executionPath, "rule-only");
  assert.equal(result.llmUsed, false);
  assert.equal(result.selectedToolId, "listBooks");
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.toolJob?.status, "succeeded");
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
});

test("guard open plus fake LLM intent executes a safe tool", async () => {
  const repos = createRepositories();
  const fake = createExternalProvider([
    '{"toolId":"listBooks","arguments":{"limit":2},"reason":"books","finalAnswerHint":"mention the two safe items"}',
    "Safe preview complete. The selected tool returned two books.",
    '{"decision":"approve","findings":[],"revisionHints":[],"summary":"critic approved the safe preview"}',
  ]);

  const result = await sendWebAgentMessageCore(
    {
      message: "please show my books",
      useExternalLlmDev: true,
      toolPreviewEnabled: true,
    },
    {
      env: externalEnv,
      externalProvider: fake.provider,
      ...repos,
    },
  );

  assert.equal(fake.calls.length, 3);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.selectedToolId, "listBooks");
  assert.equal(result.toolSelectionSource, "llm");
  assert.equal(result.toolUsed, "listBooks");
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.llmUsed, true);
  assert.equal(result.toolIntentValidated, true);
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.toolResultPreview?.includes("Items shown: 1"), true);
  assert.equal(result.guardNotice.includes("dev-only"), true);
  assert.equal(result.finalAnswerSource, "llm");
  assert.equal(result.finalAnswer.includes("Safe preview complete"), true);
  assert.equal(result.criticReview?.decision, "approve");
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
  assert.equal(result.toolJob?.traceEvents.length > 0, true);
});

test("invalid LLM tool input falls back safely to rules", async () => {
  const repos = createRepositories();
  const fake = createExternalProvider(["not json", "", "not json either"]);

  const result = await sendWebAgentMessageCore(
    {
      message: "list books",
      useExternalLlmDev: true,
      toolPreviewEnabled: true,
    },
    {
      env: externalEnv,
      externalProvider: fake.provider,
      ...repos,
    },
  );

  assert.equal(fake.calls.length, 3);
  assert.equal(result.mode, "external-llm-dev");
  assert.equal(result.executionPath, "external-llm-dev");
  assert.equal(result.toolSelectionSource, "rules");
  assert.equal(result.toolIntentValidated, false);
  assert.equal(result.providerMode, "external-dev-only");
  assert.equal(result.llmUsed, true);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.toolExecutionStatus, "success");
  assert.equal(result.finalAnswerSource, "template");
  assert.equal(result.finalAnswer.includes("Fallback:"), true);
  assert.equal(result.criticReview?.decision, "approve");
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
});

test("tool errors are sanitized and do not leak secrets", async () => {
  const result = await sendWebAgentMessageCore(
    {
      message: "list books",
      toolPreviewEnabled: true,
    },
    {
      env: baseEnv,
      bookRepository: {
        async listBooks() {
          throw new Error("DATABASE_URL=postgres://secret");
        },
        async getBookReaderData() {
          throw new Error("should not be used");
        },
      },
      readingProgressRepository: {
        async listReadingProgress() {
          throw new Error("should not be used");
        },
      },
      userRepository: {
        async getUserByEmail() {
          throw new Error("should not be used");
        },
      },
    },
  );

  const payload = JSON.stringify(result);

  assert.equal(result.toolExecutionStatus, "error");
  assert.equal(result.toolExecution.errorReason, "preview_execution_failed_safely");
  assert.equal(result.toolJob?.status, "failed");
  assert.equal(payload.includes("DATABASE_URL"), false);
  assert.equal(result.assistantMessage.includes("DATABASE_URL"), false);
  assert.equal(result.loopStepCount, 2);
  assert.equal(result.loopToolCallCount, 1);
});

test("skill candidate preview stays advisory only", async () => {
  const result = await sendWebAgentMessageCore(
    {
      message: "list books",
      toolPreviewEnabled: true,
    },
    { env: baseEnv, ...createRepositories() },
  );

  assert.equal(result.skillCandidate.productionReady, false);
  assert.equal(result.devOnly, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.rawPromptStored, false);
  assert.equal(result.rawResponseStored, false);
  assert.equal(result.secretSafe, true);
});
