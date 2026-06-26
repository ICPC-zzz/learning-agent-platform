import type { LlmProvider } from "@learning-agent-platform/ai-core/llm/llm-provider-contract";
import {
  ExternalChatCompletionsProvider,
  loadExternalProviderConfig,
  type ExternalProviderFetch,
} from "@learning-agent-platform/ai-core/llm/external-chat-completions-provider";

import { loadAssistantProviderConfig, type AssistantProviderConfig, type AssistantProviderEnv } from "../config/assistant-provider-config.ts";
import type { AssistantProviderStatus } from "./provider-types.ts";

export interface AssistantLlmProviderBundle {
  status: AssistantProviderStatus;
  provider: LlmProvider | null;
  configured: boolean;
  enabled: boolean;
}

export interface AssistantLlmProviderOptions {
  env?: AssistantProviderEnv;
  config?: AssistantProviderConfig;
  customFetch?: ExternalProviderFetch;
}

export function createOpenAiCompatibleLlmProvider(
  options: AssistantLlmProviderOptions = {},
): AssistantLlmProviderBundle {
  const config = options.config ?? loadAssistantProviderConfig(options.env);
  const configured = isLlmConfigured(config);
  const enabled = configured && config.assistant.enabled && config.assistant.externalToolsEnabled && config.llm.enabled;

  const status: AssistantProviderStatus = {
    id: "openai-compatible-llm-provider",
    label: "OpenAI-compatible LLM",
    configured,
    enabled,
    healthy: enabled ? null : false,
    capabilities: ["llm_chat"],
    requiredEnvNames: [
      "LAP_ASSISTANT_ENABLED",
      "LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED",
      "LAP_LLM_ENABLED",
      "LAP_LLM_PROVIDER",
      "LAP_LLM_BASE_URL",
      "LAP_LLM_API_KEY",
      "LAP_LLM_MODEL",
    ],
    configuredEnvNames: buildConfiguredEnvNames(config),
    missingEnvNames: buildMissingEnvNames(config),
    sourceLabel: enabled
      ? "real llm provider"
      : configured
        ? "configured (disabled)"
        : "blocked (missing env)",
    safeDescription: enabled
      ? "OpenAI-compatible chat completions provider is enabled."
      : configured
        ? "OpenAI-compatible chat completions provider is configured but disabled."
        : "OpenAI-compatible chat completions provider is not fully configured.",
    previewOnly: true,
    devOnly: true,
    productionReady: false,
  };

  if (!enabled) {
    return {
      status,
      provider: null,
      configured,
      enabled,
    };
  }

  const providerConfig = loadExternalProviderConfig({
    endpoint: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    apiPassword: config.llm.apiPassword,
    model: config.llm.model,
    timeoutMs: config.llm.timeoutMs,
  });

  const provider = new ExternalChatCompletionsProvider(providerConfig, options.customFetch) as unknown as LlmProvider;

  return {
    status,
    provider,
    configured,
    enabled,
  };
}

function isLlmConfigured(config: AssistantProviderConfig): boolean {
  return (
    config.llm.provider !== "none" &&
    typeof config.llm.baseUrl === "string" &&
    config.llm.baseUrl.length > 0 &&
    typeof config.llm.model === "string" &&
    config.llm.model.length > 0 &&
    (typeof config.llm.apiKey === "string" || typeof config.llm.apiPassword === "string")
  );
}

function buildConfiguredEnvNames(config: AssistantProviderConfig): string[] {
  const names = new Set<string>();

  if (config.assistant.enabled) {
    names.add("LAP_ASSISTANT_ENABLED");
  }

  if (config.assistant.externalToolsEnabled) {
    names.add("LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED");
  }

  if (config.llm.enabled) {
    names.add("LAP_LLM_ENABLED");
  }

  if (config.llm.provider !== "none") {
    names.add("LAP_LLM_PROVIDER");
  }

  if (config.llm.baseUrl) {
    names.add("LAP_LLM_BASE_URL");
  }

  if (config.llm.apiKey) {
    names.add("LAP_LLM_API_KEY");
  }

  if (config.llm.apiPassword) {
    names.add("LAP_LLM_API_PASSWORD");
  }

  if (config.llm.model) {
    names.add("LAP_LLM_MODEL");
  }

  return [...names];
}

function buildMissingEnvNames(config: AssistantProviderConfig): string[] {
  const missing: string[] = [];

  if (!config.assistant.enabled) {
    missing.push("LAP_ASSISTANT_ENABLED", "LAP_ALLOW_REAL_LLM", "LAP_ALLOW_DEV_LLM", "LAP_WEB_LLM_QA_DEV_ENABLED", "LAP_READER_AI_QA_DEV_ENABLED");
  }

  if (!config.assistant.externalToolsEnabled) {
    missing.push("LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED", "LAP_ALLOW_WEB_AI", "LAP_ALLOW_EXTERNAL_LLM_PROVIDER");
  }

  if (!config.llm.enabled) {
    missing.push("LAP_LLM_ENABLED");
  }

  if (config.llm.provider === "none") {
    missing.push("LAP_LLM_PROVIDER");
  }

  if (!config.llm.baseUrl) {
    missing.push("LAP_LLM_BASE_URL", "LAP_LLM_DEV_ENDPOINT");
  }

  if (!config.llm.apiKey && !config.llm.apiPassword) {
    missing.push("LAP_LLM_API_KEY", "LAP_LLM_API_PASSWORD", "LAP_LLM_DEV_API_KEY", "LAP_LLM_DEV_API_PASSWORD", "LAP_LLM_DEV_APIPassword");
  }

  if (!config.llm.model) {
    missing.push("LAP_LLM_MODEL", "LAP_LLM_DEV_MODEL");
  }

  return [...new Set(missing)];
}
