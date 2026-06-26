/**
 * LLM Dev Provider Guard — controls whether dev LLM calls are allowed.
 *
 * Rules:
 * - Production: ALWAYS blocked.
 * - Dev/test: blocked unless all required env vars are set and allow flags are enabled.
 * - Never exposes env values.
 * - When blocked, does not fetch.
 *
 * @module llm-dev-provider-guard
 * @previewOnly
 */

import { getLlmDevProviderConfig, type LlmDevProviderConfig } from "./llm-dev-provider-config.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LlmDevProviderMode = "blocked" | "ready";

export type LlmDevBlockedReason =
  | "production_blocked"
  | "allow_dev_llm_missing"
  | "allow_web_ai_missing"
  | "endpoint_missing"
  | "api_key_missing"
  | "model_missing";

export interface LlmDevGuardResult {
  /** Whether LLM calls may proceed. */
  allowed: boolean;
  /** Current mode. */
  mode: LlmDevProviderMode;
  /** Reasons why blocked (empty if allowed). */
  blockedReasons: LlmDevBlockedReason[];
  /** Missing env var names (canonical). */
  missingEnvNames: string[];
  /** Human-readable notice for UI. */
  notice: string;
  /** Short label for UI badges. */
  sourceLabel: string;
  /** Config snapshot (safe, no values). */
  config: LlmDevProviderConfig;
  /** Always true. */
  devOnly: true;
  /** Always false. */
  productionReady: false;
}

// ---------------------------------------------------------------------------
// Guard evaluator
// ---------------------------------------------------------------------------

export function evaluateLlmDevGuard(): LlmDevGuardResult {
  const config = getLlmDevProviderConfig();

  const blockedReasons: LlmDevBlockedReason[] = [];

  if (config.productionBlocked) {
    blockedReasons.push("production_blocked");
  }
  if (!config.envStatus.find((s) => s.name === "LAP_ALLOW_DEV_LLM")?.configured) {
    blockedReasons.push("allow_dev_llm_missing");
  }
  if (!config.envStatus.find((s) => s.name === "LAP_ALLOW_WEB_AI")?.configured) {
    blockedReasons.push("allow_web_ai_missing");
  }
  if (!config.envStatus.find((s) => s.name === "LAP_LLM_DEV_ENDPOINT")?.configured) {
    blockedReasons.push("endpoint_missing");
  }
  if (!config.envStatus.find((s) => s.name === "LAP_LLM_DEV_API_KEY")?.configured) {
    blockedReasons.push("api_key_missing");
  }
  if (!config.envStatus.find((s) => s.name === "LAP_LLM_DEV_MODEL")?.configured) {
    blockedReasons.push("model_missing");
  }

  const allowed = blockedReasons.length === 0;
  const notice = config.notice;

  return {
    allowed,
    mode: allowed ? "ready" : "blocked",
    blockedReasons,
    missingEnvNames: config.missingEnvNames,
    notice,
    sourceLabel: config.sourceLabel,
    config,
    devOnly: true,
    productionReady: false,
  };
}

// ---------------------------------------------------------------------------
// Quick check: can we proceed to health check or LLM call?
// ---------------------------------------------------------------------------

export function canCallLlmDevProvider(): boolean {
  const guard = evaluateLlmDevGuard();
  return guard.allowed;
}

export function assertCanCallLlmDevProvider(): void {
  const guard = evaluateLlmDevGuard();
  if (!guard.allowed) {
    throw new Error(`LLM dev provider blocked: ${guard.blockedReasons.join(", ")}`);
  }
}
