/**
 * Reader AI QA Guard — control whether chapter Q&A can call LLM provider.
 *
 * Multi-layer guard design (all disabled by default):
 * 1. LAP_READER_AI_QA_DEV_ENABLED — master switch (default false)
 * 2. LAP_LLM_DEV_PROVIDER_ENABLED — real provider switch (default false)
 * 3. LAP_LLM_DEV_ENDPOINT — endpoint presence
 * 4. LAP_LLM_DEV_API_KEY — API key presence
 * 5. LAP_LLM_DEV_MODEL — model presence
 *
 * Default behavior:
 * - guard off → mock-only (no network)
 * - any required env missing → fallback mock
 * - productionReady = false
 * - devOnly = true
 *
 * Designation: dev preview / dev-only / mock default
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

/** Required env keys for Reader AI QA - used by ask page for display. */
export const READER_AI_QA_REQUIRED_ENV_KEYS: readonly string[] = [
  "LAP_READER_AI_QA_DEV_ENABLED",
  "LAP_LLM_DEV_PROVIDER_ENABLED",
  "LAP_LLM_DEV_ENDPOINT",
  "LAP_LLM_DEV_API_KEY",
  "LAP_LLM_DEV_MODEL",
];

/** Auth env keys (subset of required) - used by ask page for display. */
export const READER_AI_QA_AUTH_ENV_KEYS: readonly string[] = [
  "LAP_LLM_DEV_API_KEY",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReaderAiQaGuardMode =
  | "blocked"
  | "mock_only"
  | "external_dev";

export type ReaderAiQaBlockedReason =
  | "reader_ai_qa_dev_disabled"
  | "llm_dev_provider_disabled"
  | "missing_endpoint"
  | "missing_api_key"
  | "missing_model";

export interface ReaderAiQaGuardEnv {
  LAP_READER_AI_QA_DEV_ENABLED?: string;
  LAP_LLM_DEV_PROVIDER_ENABLED?: string;
  LAP_LLM_DEV_ENDPOINT?: string;
  LAP_LLM_DEV_API_KEY?: string;
  LAP_LLM_DEV_MODEL?: string;
  // Additional env keys passed by callers for display/compatibility
  NODE_ENV?: string;
  LAP_WEB_LLM_QA_DEV_ENABLED?: string;
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER?: string;
  LAP_LLM_DEV_APIPassword?: string;
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
  /** Missing env key names for UI display. */
  missingEnvKeys: readonly string[];
  /** Whether NODE_ENV is not production (for UI display). */
  nonProduction: boolean;
  /** Human-readable summary for UI. */
  notice: string;
  /** Human-readable source label for UI. */
  sourceLabel: string;
  /** Always true - dev-only. */
  devOnly: true;
  /** Always false - not for production. */
  productionReady: false;
}

// ---------------------------------------------------------------------------
// Guard evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate the Reader AI QA guard against caller-supplied env.
 * Does NOT read process.env directly - enables test injection.
 */
export function evaluateReaderAiQaGuard(
  env: ReaderAiQaGuardEnv,
): ReaderAiQaGuardResult {
  const nonProduction = env.NODE_ENV !== "production";
  const readerQaEnabled = parseBooleanEnv(
    env.LAP_READER_AI_QA_DEV_ENABLED,
    false,
  );

  // Collect missing env keys for UI display
  const missingEnvKeys: string[] = [];
  if (!env.LAP_READER_AI_QA_DEV_ENABLED) missingEnvKeys.push("LAP_READER_AI_QA_DEV_ENABLED");
  if (!env.LAP_LLM_DEV_PROVIDER_ENABLED) missingEnvKeys.push("LAP_LLM_DEV_PROVIDER_ENABLED");
  if (!env.LAP_LLM_DEV_ENDPOINT?.trim()) missingEnvKeys.push("LAP_LLM_DEV_ENDPOINT");
  if (!env.LAP_LLM_DEV_API_KEY?.trim() && !env.LAP_LLM_DEV_APIPassword?.trim())
    missingEnvKeys.push("LAP_LLM_DEV_API_KEY");
  if (!env.LAP_LLM_DEV_MODEL?.trim()) missingEnvKeys.push("LAP_LLM_DEV_MODEL");

  const baseFields = { missingEnvKeys, nonProduction };

  // Layer 1: total disable
  if (!readerQaEnabled) {
    return createGuardResult({
      ...baseFields,
      mode: "blocked",
      blockedReasons: ["reader_ai_qa_dev_disabled"],
      allowMock: false,
      allowExternalDev: false,
      notice: "Reader AI QA dev mode is disabled. Set LAP_READER_AI_QA_DEV_ENABLED=true to enable.",
      sourceLabel: "blocked (dev mode not enabled)",
    });
  }

  // Layer 2: external provider check
  const llmDevProviderEnabled = parseBooleanEnv(
    env.LAP_LLM_DEV_PROVIDER_ENABLED,
    false,
  );

  if (!llmDevProviderEnabled) {
    return createGuardResult({
      ...baseFields,
      mode: "mock_only",
      blockedReasons: ["llm_dev_provider_disabled"],
      allowMock: true,
      allowExternalDev: false,
      notice: "Real LLM provider not enabled (LAP_LLM_DEV_PROVIDER_ENABLED != true). Using mock provider only.",
      sourceLabel: "mock-only (real provider not enabled)",
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
      ...baseFields,
      mode: "mock_only",
      blockedReasons: missingReasons,
      allowMock: true,
      allowExternalDev: false,
      notice: `Real LLM provider config incomplete (${reasonText}). Falling back to mock provider.`,
      sourceLabel: `mock-only (config incomplete: ${reasonText})`,
    });
  }

  // All checks passed - external dev provider is available
  return createGuardResult({
    ...baseFields,
    mode: "external_dev",
    blockedReasons: [],
    allowMock: true,
    allowExternalDev: true,
    notice: "dev-only external LLM provider available. Answers generated by real AI model (dev preview).",
    sourceLabel: "external-dev (dev preview)",
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
  missingEnvKeys: readonly string[];
  nonProduction: boolean;
}): ReaderAiQaGuardResult {
  return {
    mode: input.mode,
    blockedReasons: input.blockedReasons,
    allowMock: input.allowMock,
    allowExternalDev: input.allowExternalDev,
    allowed: input.allowMock || input.allowExternalDev,
    notice: input.notice,
    sourceLabel: input.sourceLabel,
    missingEnvKeys: input.missingEnvKeys,
    nonProduction: input.nonProduction,
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
