/**
 * Web Agent dev-only guard.
 *
 * The Web Agent can stay in a safe mock mode by default. A real external LLM
 * call is allowed only when the caller explicitly opts in and every dev guard
 * passes. No secret values are returned.
 *
 * @module web-agent-dev-guard
 * @previewOnly
 */

export const LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED_KEY =
  "LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED";
export const LAP_ALLOW_EXTERNAL_LLM_PROVIDER_KEY =
  "LAP_ALLOW_EXTERNAL_LLM_PROVIDER";
export const LAP_LLM_DEV_ENDPOINT_KEY = "LAP_LLM_DEV_ENDPOINT";
export const LAP_LLM_DEV_API_KEY_KEY = "LAP_LLM_DEV_API_KEY";
export const LAP_LLM_DEV_MODEL_KEY = "LAP_LLM_DEV_MODEL";

export type WebAgentDevMode = "mock" | "blocked" | "external-llm-dev";

export interface WebAgentDevEnv {
  LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED?: string;
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER?: string;
  LAP_LLM_DEV_ENDPOINT?: string;
  LAP_LLM_DEV_API_KEY?: string;
  LAP_LLM_DEV_APIPassword?: string;
  LAP_LLM_DEV_MODEL?: string;
  NODE_ENV?: string;
}

export interface WebAgentDevGuardResult {
  mode: WebAgentDevMode;
  requestedExternalLlmDev: boolean;
  externalLlmDevEnabled: boolean;
  allowExternalProvider: boolean;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
  nonProduction: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
  devOnly: true;
  productionReady: false;
}

export function evaluateWebAgentDevGuard(
  env: WebAgentDevEnv,
  requestedExternalLlmDev: boolean,
): WebAgentDevGuardResult {
  const nonProduction = isNonProductionEnv(env.NODE_ENV);

  if (!requestedExternalLlmDev) {
    return createGuardResult({
      mode: "mock",
      requestedExternalLlmDev: false,
      externalLlmDevEnabled: parseBooleanEnv(
        env.LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED,
      ),
      allowExternalProvider: parseBooleanEnv(
        env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
      ),
      endpointConfigured: isConfigured(env.LAP_LLM_DEV_ENDPOINT),
      apiKeyConfigured: isConfigured(env.LAP_LLM_DEV_API_KEY),
      modelConfigured: isConfigured(env.LAP_LLM_DEV_MODEL),
      nonProduction,
      allowed: true,
      blockedReasons: [],
      notice:
        "Web Agent 使用 mock 预览模式。显式勾选 dev-only 外部 LLM 才会尝试真实调用。",
      sourceLabel: "mock (default preview)",
    });
  }

  const externalLlmDevEnabled = parseBooleanEnv(
    env.LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED,
  );
  const allowExternalProvider = parseBooleanEnv(
    env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
  );
  const endpointConfigured = isConfigured(env.LAP_LLM_DEV_ENDPOINT);
  const apiKeyConfigured = isConfigured(env.LAP_LLM_DEV_API_KEY);
  const modelConfigured = isConfigured(env.LAP_LLM_DEV_MODEL);
  const blockedReasons: string[] = [];

  if (!nonProduction) {
    blockedReasons.push("non_production_required");
  }

  if (!externalLlmDevEnabled) {
    blockedReasons.push("LAP_WEB_AGENT_EXTERNAL_LLM_DEV_ENABLED is not enabled");
  }

  if (!allowExternalProvider) {
    blockedReasons.push("LAP_ALLOW_EXTERNAL_LLM_PROVIDER is not enabled");
  }

  if (!endpointConfigured) {
    blockedReasons.push("LAP_LLM_DEV_ENDPOINT is missing or empty");
  }

  if (!apiKeyConfigured) {
    blockedReasons.push("LAP_LLM_DEV_API_KEY is missing or empty");
  }

  if (!modelConfigured) {
    blockedReasons.push("LAP_LLM_DEV_MODEL is missing or empty");
  }

  if (blockedReasons.length > 0) {
    return createGuardResult({
      mode: "blocked",
      requestedExternalLlmDev: true,
      externalLlmDevEnabled,
      allowExternalProvider,
      endpointConfigured,
      apiKeyConfigured,
      modelConfigured,
      nonProduction,
      allowed: false,
      blockedReasons,
      notice:
        "Web Agent dev-only 外部 LLM 路径被 guard 阻止。当前保持安全的 mock/blocked 预览。",
      sourceLabel: "blocked (guard failed)",
    });
  }

  return createGuardResult({
    mode: "external-llm-dev",
    requestedExternalLlmDev: true,
    externalLlmDevEnabled,
    allowExternalProvider,
    endpointConfigured,
    apiKeyConfigured,
    modelConfigured,
    nonProduction,
    allowed: true,
    blockedReasons: [],
    notice:
      "Web Agent dev-only external LLM 可用。此路径仅用于开发预览，不保存 raw prompt/response。",
    sourceLabel: "external-llm-dev (dev-only preview)",
  });
}

function createGuardResult(input: {
  mode: WebAgentDevMode;
  requestedExternalLlmDev: boolean;
  externalLlmDevEnabled: boolean;
  allowExternalProvider: boolean;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
  nonProduction: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
}): WebAgentDevGuardResult {
  return {
    mode: input.mode,
    requestedExternalLlmDev: input.requestedExternalLlmDev,
    externalLlmDevEnabled: input.externalLlmDevEnabled,
    allowExternalProvider: input.allowExternalProvider,
    endpointConfigured: input.endpointConfigured,
    apiKeyConfigured: input.apiKeyConfigured,
    modelConfigured: input.modelConfigured,
    nonProduction: input.nonProduction,
    allowed: input.allowed,
    blockedReasons: input.blockedReasons,
    notice: input.notice,
    sourceLabel: input.sourceLabel,
    devOnly: true,
    productionReady: false,
  };
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonProductionEnv(nodeEnv: string | undefined): boolean {
  const normalized = nodeEnv?.trim().toLowerCase();
  if (!isConfigured(normalized)) {
    return true;
  }

  return normalized !== "production";
}
