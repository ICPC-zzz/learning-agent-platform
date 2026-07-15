import { loadAssistantProviderConfig, type AssistantProviderEnv } from "./assistant/config/assistant-provider-config.ts";

export const LAP_ALLOW_DEV_LLM_KEY = "LAP_ALLOW_DEV_LLM";
export const LAP_ALLOW_WEB_AI_KEY = "LAP_ALLOW_WEB_AI";
export const LAP_LLM_DEV_PROVIDER_KEY = "LAP_LLM_DEV_PROVIDER";
export const LAP_LLM_DEV_ENDPOINT_KEY = "LAP_LLM_DEV_ENDPOINT";
export const LAP_LLM_DEV_API_KEY_KEY = "LAP_LLM_DEV_API_KEY";
export const LAP_LLM_DEV_API_PASSWORD_KEY = "LAP_LLM_DEV_API_PASSWORD";
export const LAP_LLM_DEV_MODEL_KEY = "LAP_LLM_DEV_MODEL";
export const LAP_LLM_DEV_TIMEOUT_MS_KEY = "LAP_LLM_DEV_TIMEOUT_MS";
export const LAP_WEB_LLM_QA_DEV_ENABLED_KEY = "LAP_WEB_LLM_QA_DEV_ENABLED";
export const LAP_READER_AI_QA_DEV_ENABLED_KEY = "LAP_READER_AI_QA_DEV_ENABLED";
export const LAP_ALLOW_EXTERNAL_LLM_PROVIDER_KEY = "LAP_ALLOW_EXTERNAL_LLM_PROVIDER";
export const LAP_ALLOW_REAL_LLM_KEY = "LAP_ALLOW_REAL_LLM";
export const LAP_ALLOW_PRODUCTION_WEB_AI_KEY = "LAP_ALLOW_PRODUCTION_WEB_AI";
export const LAP_LLM_DEV_APIPASSWORD_LEGACY_KEY = "LAP_LLM_DEV_APIPassword";
export const LAP_ASSISTANT_ENABLED_KEY = "LAP_ASSISTANT_ENABLED";
export const LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED_KEY = "LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED";
export const LAP_LLM_ENABLED_KEY = "LAP_LLM_ENABLED";
export const LAP_LLM_BASE_URL_KEY = "LAP_LLM_BASE_URL";
export const LAP_LLM_API_KEY_KEY = "LAP_LLM_API_KEY";
export const LAP_LLM_API_PASSWORD_KEY = "LAP_LLM_API_PASSWORD";
export const LAP_LLM_MODEL_KEY = "LAP_LLM_MODEL";

export const WEB_AI_QA_REQUIRED_ENV_KEYS = [
  LAP_ASSISTANT_ENABLED_KEY,
  LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED_KEY,
  LAP_LLM_ENABLED_KEY,
  LAP_LLM_BASE_URL_KEY,
  LAP_LLM_MODEL_KEY,
];

export const WEB_AI_QA_AUTH_ENV_KEYS = [
  LAP_LLM_API_KEY_KEY,
  LAP_LLM_API_PASSWORD_KEY,
];

export type WebAiQaGuardMode = "blocked" | "external_dev" | "external_production";

export interface WebAiQaGuardResult {
  mode: WebAiQaGuardMode;
  allowMock: boolean;
  allowExternalDev: boolean;
  allowExternalProduction: boolean;
  allowed: boolean;
  blockedReasons: string[];
  missingEnvKeys: string[];
  nonProduction: boolean;
  devOnly: boolean;
  productionReady: boolean;
  notice: string;
  sourceLabel: string;
}

export function evaluateWebAiQaGuard(
  env: AssistantProviderEnv = {},
): WebAiQaGuardResult {
  const config = loadAssistantProviderConfig(env);
  const nonProduction = isNonProductionEnv(env.NODE_ENV);
  const productionWebAiEnabled = parseBooleanCandidate(
    env.LAP_ALLOW_PRODUCTION_WEB_AI,
    undefined,
    false,
  );
  const realLlmEnabled = parseBooleanCandidate(
    env.LAP_ALLOW_REAL_LLM,
    undefined,
    false,
  );
  const blockedReasons: string[] = [];
  const missingEnvKeys: string[] = [];

  if (
    nonProduction
    && !parseBooleanCandidate(env.LAP_WEB_LLM_QA_DEV_ENABLED, env.LAP_READER_AI_QA_DEV_ENABLED, false)
  ) {
    blockedReasons.push("web_llm_qa_dev_disabled");
    missingEnvKeys.push(LAP_WEB_LLM_QA_DEV_ENABLED_KEY, LAP_READER_AI_QA_DEV_ENABLED_KEY);
  }

  if (!config.assistant.enabled) {
    blockedReasons.push("assistant_disabled");
    missingEnvKeys.push(
      LAP_ASSISTANT_ENABLED_KEY,
      LAP_ALLOW_DEV_LLM_KEY,
      LAP_WEB_LLM_QA_DEV_ENABLED_KEY,
      LAP_READER_AI_QA_DEV_ENABLED_KEY,
      "LAP_ALLOW_REAL_LLM",
    );
  }

  if (!config.assistant.externalToolsEnabled) {
    blockedReasons.push("allow_external_llm_provider_disabled");
    missingEnvKeys.push(
      LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED_KEY,
      LAP_ALLOW_WEB_AI_KEY,
      LAP_ALLOW_EXTERNAL_LLM_PROVIDER_KEY,
    );
  }

  if (!config.llm.enabled) {
    blockedReasons.push("llm_disabled");
    missingEnvKeys.push(LAP_LLM_ENABLED_KEY);
  }

  if (config.llm.provider === "none") {
    blockedReasons.push("llm_provider_disabled");
    missingEnvKeys.push(LAP_LLM_DEV_PROVIDER_KEY, "LAP_LLM_PROVIDER");
  }

  if (!config.llm.baseUrl) {
    blockedReasons.push("missing_endpoint");
    missingEnvKeys.push(LAP_LLM_BASE_URL_KEY, LAP_LLM_DEV_ENDPOINT_KEY);
  }

  if (!config.llm.apiKey && !config.llm.apiPassword) {
    blockedReasons.push("missing_auth_material");
    missingEnvKeys.push(
      LAP_LLM_API_KEY_KEY,
      LAP_LLM_API_PASSWORD_KEY,
      LAP_LLM_DEV_API_KEY_KEY,
      LAP_LLM_DEV_API_PASSWORD_KEY,
      LAP_LLM_DEV_APIPASSWORD_LEGACY_KEY,
    );
  }

  if (!config.llm.model) {
    blockedReasons.push("missing_model");
    missingEnvKeys.push(LAP_LLM_MODEL_KEY, LAP_LLM_DEV_MODEL_KEY);
  }

  if (!nonProduction && (!productionWebAiEnabled || !realLlmEnabled)) {
    blockedReasons.push("production_only");
    if (!productionWebAiEnabled) {
      missingEnvKeys.push(LAP_ALLOW_PRODUCTION_WEB_AI_KEY);
    }
    if (!realLlmEnabled) {
      missingEnvKeys.push(LAP_ALLOW_REAL_LLM_KEY);
    }
  }

  const allowed = blockedReasons.length === 0;
  const missingList = Array.from(new Set(missingEnvKeys));

  if (!allowed) {
    return {
      mode: "blocked",
      allowMock: false,
      allowExternalDev: false,
      allowExternalProduction: false,
      allowed: false,
      blockedReasons,
      missingEnvKeys: missingList,
      nonProduction,
      devOnly: nonProduction,
      productionReady: false,
      notice: buildSafeBlockedNotice(nonProduction),
      sourceLabel: nonProduction ? "开发模型配置未就绪" : "正式模型配置未就绪",
    };
  }

  if (!nonProduction) {
    return {
      mode: "external_production",
      allowMock: false,
      allowExternalDev: false,
      allowExternalProduction: true,
      allowed: true,
      blockedReasons: [],
      missingEnvKeys: [],
      nonProduction: false,
      devOnly: false,
      productionReady: true,
      notice: "正式 AI 模型服务已启用。",
      sourceLabel: "正式外部模型",
    };
  }

  return {
    mode: "external_dev",
    allowMock: true,
    allowExternalDev: true,
    allowExternalProduction: false,
    allowed: true,
    blockedReasons: [],
    missingEnvKeys: [],
    nonProduction,
    devOnly: true,
    productionReady: false,
    notice: "开发环境外部模型已启用，不会向页面暴露原始提示词、响应或密钥。",
    sourceLabel: "开发外部模型",
  };
}

function buildSafeBlockedNotice(nonProduction: boolean): string {
  return nonProduction
    ? "AI 模型服务尚未完整配置，请联系管理员检查模型设置。"
    : "AI 服务暂时不可用，请稍后重试。";
}

function isNonProductionEnv(nodeEnv: string | undefined): boolean {
  if (typeof nodeEnv !== "string" || nodeEnv.trim().length === 0) {
    return true;
  }

  return nodeEnv.trim().toLowerCase() !== "production";
}

function parseBooleanCandidate(
  primary: string | undefined,
  secondary: string | undefined,
  defaultValue: boolean,
): boolean {
  const candidates = [primary, secondary];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return defaultValue;
}
