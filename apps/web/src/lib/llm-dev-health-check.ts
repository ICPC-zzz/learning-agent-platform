/**
 * LLM Dev Health Check — sends a minimal test prompt to verify the LLM dev
 * provider is reachable and responding. Never exposes raw request/response or
 * secret values.
 *
 * @module llm-dev-health-check
 * @previewOnly
 */

import { evaluateLlmDevGuard, type LlmDevGuardResult } from "./llm-dev-provider-guard.ts";
import type { ExternalProviderEnv, ExternalProviderConfig, ExternalProviderFetch } from "../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts";
import {
  createAssistantProviderEnvSnapshot,
  loadAssistantProviderConfig,
} from "./assistant/config/assistant-provider-config.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmHealthCheckResult {
  /** Whether health check succeeded. */
  success: boolean;
  /** Provider identifier. */
  provider: string | null;
  /** Model name (safe — just the configured name). */
  model: string | null;
  /** ISO timestamp of check. */
  checkedAt: string;
  /** Safe summary message (no raw response). */
  message: string;
  /** Whether the guard blocked the check. */
  guardBlocked: boolean;
  /** Guard result details. */
  guard: LlmDevGuardResult;
  /** Always true. */
  devOnly: true;
  /** Always false. */
  productionReady: false;
  /** Whether an actual network call was made. */
  networkAccessed: boolean;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function performLlmHealthCheck(
  customFetch?: ExternalProviderFetch,
): Promise<LlmHealthCheckResult> {
  const guard = evaluateLlmDevGuard();
  const checkedAt = new Date().toISOString();

  if (!guard.allowed) {
    return {
      success: false,
      provider: guard.config.provider,
      model: guard.config.model,
      checkedAt,
      message: `LLM health check blocked: ${guard.blockedReasons.join(", ")}. ${guard.notice}`,
      guardBlocked: true,
      guard,
      devOnly: true,
      productionReady: false,
      networkAccessed: false,
    };
  }

  // Build provider config from the unified assistant-provider loader.
  const assistantEnv = createAssistantProviderEnvSnapshot();
  const assistantConfig = loadAssistantProviderConfig(assistantEnv);
  const env: ExternalProviderEnv = {
    endpoint: assistantConfig.llm.baseUrl,
    apiKey: assistantConfig.llm.apiKey,
    apiPassword: assistantConfig.llm.apiPassword,
    model: assistantConfig.llm.model,
    timeoutMs: String(assistantConfig.llm.timeoutMs),
  };

  // Dynamic import to avoid ESM issues in test environments
  const { loadExternalProviderConfig, ExternalChatCompletionsProvider } =
    await import("../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts");

  const config: ExternalProviderConfig = loadExternalProviderConfig(env);

  if (!config.configured) {
    return {
      success: false,
      provider: guard.config.provider,
      model: guard.config.model,
      checkedAt,
      message: `LLM config incomplete: ${config.blockedReason}`,
      guardBlocked: false,
      guard,
      devOnly: true,
      productionReady: false,
      networkAccessed: false,
    };
  }

  // Send minimal health check prompt
  const provider = new ExternalChatCompletionsProvider(config, customFetch);

  try {
    const result = await provider.generate({
      messages: [
        { role: "system", content: "You are a health check." },
        { role: "user", content: "Reply with OK only." },
      ],
      maxOutputChars: 50,
      purposeSummary: "LLM dev health check (dev-only)",
    });

    const answerOk = result.answerSummary.trim().length > 0;

    return {
      success: result.ok || answerOk,
      provider: guard.config.provider,
      model: guard.config.model,
      checkedAt,
      message: result.ok
        ? `Health check OK — provider responded.`
        : `Health check completed but provider returned non-OK result.`,
      guardBlocked: false,
      guard,
      devOnly: true,
      productionReady: false,
      networkAccessed: result.networkAccessed,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      provider: guard.config.provider,
      model: guard.config.model,
      checkedAt,
      message: `Health check failed: ${sanitizeErrorMessage(errMsg)}`,
      guardBlocked: false,
      guard,
      devOnly: true,
      productionReady: false,
      networkAccessed: true,
    };
  }
}

function sanitizeErrorMessage(msg: string): string {
  // Remove potential secret patterns
  return msg
    .replace(/\bbearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\b(api[_-]?key|api[_-]?secret|password|token|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 200);
}
