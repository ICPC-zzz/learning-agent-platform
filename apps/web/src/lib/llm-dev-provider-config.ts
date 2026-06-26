import {
  createAssistantProviderEnvSnapshot,
  loadAssistantProviderConfig,
  type AssistantProviderEnv,
} from "./assistant/config/assistant-provider-config.ts";

export const LLM_DEV_ENV = {
  ALLOW_DEV_LLM: "LAP_ALLOW_DEV_LLM",
  ALLOW_WEB_AI: "LAP_ALLOW_WEB_AI",
  PROVIDER: "LAP_LLM_DEV_PROVIDER",
  ENDPOINT: "LAP_LLM_DEV_ENDPOINT",
  API_KEY: "LAP_LLM_DEV_API_KEY",
  API_PASSWORD: "LAP_LLM_DEV_API_PASSWORD",
  MODEL: "LAP_LLM_DEV_MODEL",
  TIMEOUT_MS: "LAP_LLM_DEV_TIMEOUT_MS",
} as const;

export const LLM_DEV_ENV_LEGACY = {
  ALLOW_DEV_LLM: "LAP_WEB_LLM_QA_DEV_ENABLED",
  ALLOW_WEB_AI: "LAP_ALLOW_EXTERNAL_LLM_PROVIDER",
  API_PASSWORD: "LAP_LLM_DEV_APIPassword",
} as const;

export type LlmDevProvider = "xunfei-spark" | "other";

export interface LlmDevEnvStatus {
  name: string;
  configured: boolean;
}

export interface LlmDevProviderConfig {
  ready: boolean;
  provider: LlmDevProvider | null;
  envStatus: LlmDevEnvStatus[];
  missingEnvNames: string[];
  configuredEnvNames: string[];
  model: string | null;
  timeoutMs: number;
  devOnly: true;
  productionReady: false;
  productionBlocked: boolean;
  nonProduction: boolean;
  notice: string;
  sourceLabel: string;
}

export function getLlmDevProviderConfig(
  env: AssistantProviderEnv = createAssistantProviderEnvSnapshot(),
): LlmDevProviderConfig {
  const config = loadAssistantProviderConfig(env);
  const productionBlocked = isProductionEnv(env.NODE_ENV);
  const provider: LlmDevProvider | null =
    config.llm.provider === "spark"
      ? "xunfei-spark"
      : config.llm.provider === "openai-compatible"
        ? "other"
        : null;

  const envStatus: LlmDevEnvStatus[] = [
    { name: LLM_DEV_ENV.ALLOW_DEV_LLM, configured: config.assistant.enabled || config.llm.enabled },
    { name: LLM_DEV_ENV.ALLOW_WEB_AI, configured: config.assistant.externalToolsEnabled },
    { name: LLM_DEV_ENV.ENDPOINT, configured: Boolean(config.llm.baseUrl) },
    { name: LLM_DEV_ENV.API_KEY, configured: Boolean(config.llm.apiKey) },
    { name: LLM_DEV_ENV.API_PASSWORD, configured: Boolean(config.llm.apiPassword) },
    { name: LLM_DEV_ENV.MODEL, configured: Boolean(config.llm.model) },
  ];

  const configuredEnvNames = envStatus.filter((entry) => entry.configured).map((entry) => entry.name);
  const missingEnvNames = envStatus.filter((entry) => !entry.configured).map((entry) => entry.name);
  const ready =
    config.assistant.enabled &&
    config.assistant.externalToolsEnabled &&
    config.llm.enabled &&
    config.llm.provider !== "none" &&
    Boolean(config.llm.baseUrl) &&
    (Boolean(config.llm.apiKey) || Boolean(config.llm.apiPassword)) &&
    Boolean(config.llm.model) &&
    !productionBlocked;

  return {
    ready,
    provider,
    envStatus,
    missingEnvNames,
    configuredEnvNames,
    model: config.llm.model ?? null,
    timeoutMs: config.llm.timeoutMs,
    devOnly: true,
    productionReady: false,
    productionBlocked,
    nonProduction: !productionBlocked,
    notice: ready
      ? "LLM dev provider ready. Dev-only external LLM calls are available. No raw prompt/response will be saved."
      : buildNotice({
        productionBlocked,
        missingEnvNames,
        provider,
      }),
    sourceLabel: ready
      ? "ready (dev-only preview)"
      : productionBlocked
        ? "blocked (production)"
        : "blocked (missing env)",
  };
}

export function getLlmDevEnvSnapshot(
  env: AssistantProviderEnv = createAssistantProviderEnvSnapshot(),
): Record<string, boolean> {
  const config = getLlmDevProviderConfig(env);
  const snapshot: Record<string, boolean> = {};

  for (const entry of config.envStatus) {
    snapshot[entry.name] = entry.configured;
  }

  return snapshot;
}

function buildNotice(input: {
  productionBlocked: boolean;
  missingEnvNames: string[];
  provider: LlmDevProvider | null;
}): string {
  if (input.productionBlocked) {
    return "LLM dev provider blocked: NODE_ENV is production. Dev-only LLM calls are not allowed in production.";
  }

  if (input.provider === null) {
    return "LLM dev provider blocked: provider is not configured.";
  }

  if (input.missingEnvNames.length > 0) {
    return `LLM dev provider blocked: missing env vars: ${input.missingEnvNames.join(", ")}.`;
  }

  return "LLM dev provider blocked.";
}

function isProductionEnv(nodeEnv: string | undefined): boolean {
  if (typeof nodeEnv !== "string" || nodeEnv.trim().length === 0) {
    return false;
  }

  return nodeEnv.trim().toLowerCase() === "production";
}
