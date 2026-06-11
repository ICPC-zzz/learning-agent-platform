/**
 * Reader AI QA Guard — 控制章节问答是否允许调用 LLM provider。
 *
 * 多层 guard 设计（全部默认关闭）:
 * 1. LAP_READER_AI_QA_DEV_ENABLED — 总开关（默认 false）
 * 2. LAP_LLM_DEV_PROVIDER_ENABLED — 真实 provider 开关（默认 false）
 * 3. LAP_LLM_DEV_ENDPOINT — endpoint 存在性
 * 4. LAP_LLM_DEV_API_KEY — API key 存在性
 * 5. LAP_LLM_DEV_MODEL — model 存在性
 *
 * 默认行为:
 * - guard 关闭 → mock-only（不访问网络）
 * - 任何必需 env 缺失 → fallback mock
 * - productionReady = false
 * - devOnly = true
 *
 * Designation: **开发预览 · dev-only · mock 默认 · 未接生产 AI 服务**
 *
 * @module reader-ai-qa-guard
 * @previewOnly
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAP_READER_AI_QA_DEV_ENABLED_KEY = "LAP_READER_AI_QA_DEV_ENABLED";
export const LAP_LLM_DEV_PROVIDER_ENABLED_KEY = "LAP_LLM_DEV_PROVIDER_ENABLED";
export const LAP_LLM_DEV_ENDPOINT_KEY = "LAP_LLM_DEV_ENDPOINT";
export const LAP_LLM_DEV_API_KEY_KEY = "LAP_LLM_DEV_API_KEY";
export const LAP_LLM_DEV_MODEL_KEY = "LAP_LLM_DEV_MODEL";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReaderAiQaGuardMode =
  | "blocked"       // 总开关关闭，完全不响应
  | "mock_only"     // 仅允许 mock provider
  | "external_dev"; // 允许 dev-only external provider

export type ReaderAiQaBlockedReason =
  | "reader_ai_qa_dev_disabled"        // LAP_READER_AI_QA_DEV_ENABLED != true
  | "llm_dev_provider_disabled"        // LAP_LLM_DEV_PROVIDER_ENABLED != true
  | "missing_endpoint"                 // LAP_LLM_DEV_ENDPOINT 缺失
  | "missing_api_key"                  // LAP_LLM_DEV_API_KEY 缺失
  | "missing_model";                   // LAP_LLM_DEV_MODEL 缺失

export interface ReaderAiQaGuardEnv {
  LAP_READER_AI_QA_DEV_ENABLED?: string;
  LAP_LLM_DEV_PROVIDER_ENABLED?: string;
  LAP_LLM_DEV_ENDPOINT?: string;
  LAP_LLM_DEV_API_KEY?: string;
  LAP_LLM_DEV_MODEL?: string;
}

export interface ReaderAiQaGuardResult {
  /** Effective mode after all checks. */
  mode: ReaderAiQaGuardMode;
  /** Whether mock provider can be used. */
  allowMock: boolean;
  /** Whether external dev provider can be used. */
  allowExternalDev: boolean;
  /** Whether any provider can be used (mock or external). */
  allowed: boolean;
  /** Reasons why request was blocked / limited. */
  blockedReasons: readonly ReaderAiQaBlockedReason[];
  /** Human-readable summary for UI. */
  notice: string;
  /** Human-readable source label for UI. */
  sourceLabel: string;
  /** Always true — dev-only. */
  devOnly: true;
  /** Always false — not for production. */
  productionReady: false;
}

// ---------------------------------------------------------------------------
// Guard evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate the Reader AI QA guard against caller-supplied env.
 * Does NOT read process.env directly — enables test injection.
 */
export function evaluateReaderAiQaGuard(
  env: ReaderAiQaGuardEnv,
): ReaderAiQaGuardResult {
  const readerQaEnabled = parseBooleanEnv(
    env.LAP_READER_AI_QA_DEV_ENABLED,
    false,
  );

  // Layer 1: total disable
  if (!readerQaEnabled) {
    return createGuardResult({
      mode: "blocked",
      blockedReasons: ["reader_ai_qa_dev_disabled"],
      allowMock: false,
      allowExternalDev: false,
      notice: "Reader AI 问答开发模式未启用。设置 LAP_READER_AI_QA_DEV_ENABLED=true 以启用。",
      sourceLabel: "blocked（开发模式未启用）",
    });
  }

  // Layer 2: external provider check
  const llmDevProviderEnabled = parseBooleanEnv(
    env.LAP_LLM_DEV_PROVIDER_ENABLED,
    false,
  );

  if (!llmDevProviderEnabled) {
    // Reader QA is enabled, but only mock is allowed
    return createGuardResult({
      mode: "mock_only",
      blockedReasons: ["llm_dev_provider_disabled"],
      allowMock: true,
      allowExternalDev: false,
      notice: "真实 LLM provider 未启用（LAP_LLM_DEV_PROVIDER_ENABLED != true）。当前仅使用 mock provider。",
      sourceLabel: "mock-only（真实 provider 未启用）",
    });
  }

  // Layer 3-5: check each required env var
  const missingReasons: ReaderAiQaBlockedReason[] = [];
  const endpoint = env.LAP_LLM_DEV_ENDPOINT?.trim();
  const apiKey = env.LAP_LLM_DEV_API_KEY?.trim();
  const model = env.LAP_LLM_DEV_MODEL?.trim();

  if (!endpoint) missingReasons.push("missing_endpoint");
  if (!apiKey) missingReasons.push("missing_api_key");
  if (!model) missingReasons.push("missing_model");

  if (missingReasons.length > 0) {
    const reasonText = missingReasons.join(", ");
    return createGuardResult({
      mode: "mock_only",
      blockedReasons: missingReasons,
      allowMock: true,
      allowExternalDev: false,
      notice: `真实 LLM provider 配置不完整（${reasonText}）。回退到 mock provider。`,
      sourceLabel: `mock-only（配置不完整: ${reasonText}）`,
    });
  }

  // All checks passed — external dev provider is available
  return createGuardResult({
    mode: "external_dev",
    blockedReasons: [],
    allowMock: true,
    allowExternalDev: true,
    notice: "dev-only external LLM provider 可用。回答由真实 AI 模型生成（开发预览）。",
    sourceLabel: "external-dev（开发预览）",
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGuardResult(input: {
  mode: ReaderAiQaGuardMode;
  blockedReasons: readonly ReaderAiQaBlockedReason[];
  allowMock: boolean;
  allowExternalDev: boolean;
  notice: string;
  sourceLabel: string;
}): ReaderAiQaGuardResult {
  return {
    mode: input.mode,
    blockedReasons: input.blockedReasons,
    allowMock: input.allowMock,
    allowExternalDev: input.allowExternalDev,
    allowed: input.allowMock || input.allowExternalDev,
    notice: input.notice,
    sourceLabel: input.sourceLabel,
    devOnly: true,
    productionReady: false,
  };
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}
