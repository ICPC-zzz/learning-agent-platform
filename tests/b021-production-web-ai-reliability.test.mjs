import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FileAssistantConversationRepository } from "../apps/web/src/lib/assistant/assistant-conversation-repository.ts";
import { runAssistantOrchestrator } from "../apps/web/src/lib/assistant/assistant-orchestrator.ts";

const read = (filePath) => readFileSync(filePath, "utf8");

test("B21 ordinary AI chat recovers stale deployment actions", () => {
  const source = read("apps/web/src/app/_components/AssistantChatPanel.tsx");
  assert.match(source, /getServerActionRecoveryMessage/);
  assert.match(source, /window\.location\.reload\(\)/);
});

test("B21 AI page mount does not invent a server-persisted conversation id", () => {
  const source = read("apps/web/src/app/_components/AssistantConversationStore.tsx");
  assert.match(source, /conversationId:\s*""/);
  assert.doesNotMatch(source, /conversationId:\s*createConversationId\(\)/);
  assert.doesNotMatch(source, /function createConversationId\(/);
});

test("B21 admin model status reads the same canonical environment snapshot as runtime", () => {
  const source = read("apps/web/src/lib/admin-status-center.ts");
  assert.match(source, /createAssistantProviderEnvSnapshot/);
  assert.match(source, /const env = createAssistantProviderEnvSnapshot\(\)/);
  assert.match(source, /evaluateWebAiQaGuard\(env\)/);
  assert.match(source, /loadAssistantProviderConfig\(env\)/);
});

test("B21 production environment template documents fail-closed Web AI opt-ins", () => {
  const source = read(".env.example");
  assert.match(source, /^LAP_ALLOW_PRODUCTION_WEB_AI="false"$/m);
  assert.match(source, /^LAP_ALLOW_REAL_LLM="false"$/m);
  assert.match(source, /^LAP_ASSISTANT_ENABLED="false"$/m);
  assert.match(source, /^LAP_LLM_ENABLED="false"$/m);
});

test("B21 protected-route redirects use the configured public origin", () => {
  const source = read("apps/web/src/middleware.ts");
  assert.match(source, /process\.env\.APP_BASE_URL/);
  assert.match(source, /resolvePublicOrigin/);
  assert.match(source, /isLocalHostname/);
  assert.match(source, /status:\s*503/);
  assert.doesNotMatch(source, /new URL\("\/auth\/login",\s*request\.url\)/);
  assert.doesNotMatch(source, /return request\.nextUrl\.origin/);
});

test("B21 every direct assistant provider path applies the production Web AI guard", () => {
  const multiAgentSource = read("apps/web/src/lib/assistant/assistant-multi-agent-runtime.ts");
  const memorySource = read("apps/web/src/lib/assistant/memory-service.ts");
  const multiGuard = multiAgentSource.indexOf("evaluateWebAiQaGuard(providerEnv)");
  const userProvider = multiAgentSource.indexOf("resolveUserModelLlmProvider({", multiGuard);
  const envProvider = multiAgentSource.indexOf("createOpenAiCompatibleLlmProvider({", multiGuard);
  assert.ok(multiGuard >= 0 && userProvider > multiGuard && envProvider > multiGuard);
  const finalAnswerStart = multiAgentSource.indexOf("async function generateModelFinalAnswer(");
  const finalAnswerGuard = multiAgentSource.indexOf("evaluateWebAiQaGuard(providerEnv)", finalAnswerStart);
  const finalAnswerUserProvider = multiAgentSource.indexOf("resolveUserModelLlmProvider({", finalAnswerStart);
  assert.ok(finalAnswerStart >= 0 && finalAnswerGuard > finalAnswerStart && finalAnswerUserProvider > finalAnswerGuard);
  assert.match(memorySource, /evaluateWebAiQaGuard\(providerEnv\)/);
});

test("B21 task control actions recover deployment-mismatched Server Actions", () => {
  const source = read("apps/web/src/app/_components/AssistantChatPanel.tsx");
  for (const fallback of ["取消任务失败。", "重试步骤失败。", "重试任务失败。"]){
    assert.match(source, new RegExp(`handleServerActionError\\(error, "${fallback}"\\)`));
  }
});

test("B21 reopening without an id restores the active conversation without creating an empty one", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "lap-b021-conversation-"));
  try {
    const repository = new FileAssistantConversationRepository({ rootDir });
    const created = await repository.createConversation({
      userId: "b021-user",
      title: "existing conversation",
    });
    const restored = await repository.getOrCreateConversation({
      userId: "b021-user",
      conversationId: null,
    });
    const active = await repository.listConversations({
      userId: "b021-user",
      status: "active",
    });

    assert.equal(restored.session.id, created.session.id);
    assert.equal(active.length, 1);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("B21 production double opt-in reaches the configured model provider", async () => {
  let providerCalls = 0;
  const response = await runAssistantOrchestrator(
    {
      question: "请解释动态规划状态设计的常见方法",
      pageContext: {
        route: "/ai",
        pageType: "ai",
        title: "AI 助手",
      },
      userId: null,
    },
    {
      guardEnv: {
        NODE_ENV: "production",
        LAP_ALLOW_PRODUCTION_WEB_AI: "true",
        LAP_ALLOW_REAL_LLM: "true",
        LAP_ASSISTANT_ENABLED: "true",
        LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED: "true",
        LAP_LLM_ENABLED: "true",
        LAP_LLM_PROVIDER: "openai-compatible",
        LAP_LLM_BASE_URL: "https://provider.example.com/v1",
        LAP_LLM_API_KEY: "test-key",
        LAP_LLM_MODEL: "test-model",
      },
      customFetch: async () => {
        providerCalls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            choices: [{ message: { content: "动态规划状态应描述子问题，并保证转移所需信息完整。" } }],
          }),
        };
      },
    },
  );

  assert.equal(providerCalls, 1);
  assert.equal(response.state, "ok");
  assert.equal(response.providerMode, "real");
  assert.equal(response.safeToExposeToClient.devOnly, false);
  assert.equal(response.safeToExposeToClient.productionReady, true);
});

test("B21 provider failures return only a safe Chinese message", async () => {
  const response = await runAssistantOrchestrator(
    {
      question: "请给出学习建议",
      pageContext: { route: "/ai", pageType: "ai", title: "AI 助手" },
      userId: null,
    },
    {
      guardEnv: {
        NODE_ENV: "production",
        LAP_ALLOW_PRODUCTION_WEB_AI: "true",
        LAP_ALLOW_REAL_LLM: "true",
        LAP_ASSISTANT_ENABLED: "true",
        LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED: "true",
        LAP_LLM_ENABLED: "true",
        LAP_LLM_PROVIDER: "openai-compatible",
        LAP_LLM_BASE_URL: "https://provider.example.com/v1",
        LAP_LLM_API_KEY: "test-key",
        LAP_LLM_MODEL: "test-model",
      },
      customFetch: async () => ({
        ok: false,
        status: 500,
        text: async () => "raw provider failure",
      }),
    },
  );

  assert.equal(response.state, "unavailable");
  assert.match(response.message, /[\u3400-\u9fff]/u);
  assert.doesNotMatch(response.message, /provider|HTTP|raw/i);
  assert.deepEqual(response.warnings, ["provider_call_failed"]);
  const source = read("apps/web/src/lib/assistant/assistant-orchestrator.ts");
  assert.doesNotMatch(source, /fallbackReason:\s*llmResult\.answerSummary/);
});
