/**
 * LLM Dev Smoke Test Runner — safe scaffolding for local manual verification of
 * Spark / OpenAI-compatible chat completions adapters.
 *
 * **Designation**: dev-only · dry-run default · no real network without explicit
 * multi-guard opt-in · never prints prompt/response/keys/passwords.
 *
 * @module llm-dev-smoke-runner
 * @previewOnly
 */

import {
  ExternalChatCompletionsProvider,
  loadExternalProviderConfig,
} from "./external-chat-completions-provider.ts";
import { LlmChatRole } from "./llm-provider-contract.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Environment variables the smoke test runner reads.
 * All values must be strings (process.env style). Real values are never printed.
 */
export interface SmokeTestEnv {
  LAP_LLM_DEV_SMOKE_TEST_ENABLED?: string;
  LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED?: string;
  LAP_ALLOW_EXTERNAL_LLM_PROVIDER?: string;
  LAP_LLM_PROVIDER?: string;
  LAP_LLM_DEV_ENDPOINT?: string;
  LAP_LLM_DEV_API_KEY?: string;
  LAP_LLM_DEV_APIPassword?: string;
  LAP_LLM_DEV_MODEL?: string;
  LAP_LLM_DEV_TIMEOUT_MS?: string;
  LAP_LLM_DEV_PROVIDER_ENABLED?: string;
}

/**
 * Injectable options for the smoke test runner. All default to safe values.
 */
export interface SmokeTestOptions {
  /** Default true — dry-run checks config but does not call any LLM. */
  dryRun?: boolean;
  /** Default false — network is blocked unless explicitly allowed. */
  allowNetwork?: boolean;
  /** Injectable fetch for testing. Defaults to globalThis.fetch. */
  fetchImpl?: typeof globalThis.fetch;
}

/**
 * Result of a single guard check — safe to print and log.
 */
export interface GuardStatus {
  smokeTestEnabled: boolean;
  readerQaExternalEnabled: boolean;
  allowExternalProvider: boolean;
  providerAllowed: boolean;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  apiPasswordConfigured: boolean;
  networkAllowed: boolean;
  allPassed: boolean;
  blockedReasons: string[];
}

/**
 * The full smoke test result — safe metadata only.
 * Never contains raw prompt, raw response, API keys, passwords,
 * authorization headers, or database URLs.
 */
export interface SmokeTestResult {
  ok: boolean;
  mode: "dry-run" | "blocked" | "external-dev-smoke" | "error";
  providerId: string;
  model: string;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  apiPasswordConfigured: boolean;
  timeoutMs: number;
  networkAttempted: boolean;
  externalProviderUsed: boolean;
  llmUsed: boolean;
  writesDatabase: false;
  toolsUsed: false;
  agentLoopUsed: false;
  rawPromptStored: false;
  rawResponseStored: false;
  rawResponsePrinted: false;
  secretSafe: true;
  productionReady: false;
  safeToExposeToClient: true;
  guardStatus: GuardStatus;
  responseReceived?: boolean;
  responseDurationMs?: number;
  redactedError?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Allowed dev provider IDs. These are the only values LAP_LLM_PROVIDER may
 * hold for the smoke test to proceed beyond dry-run.
 */
export const ALLOWED_DEV_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "spark-ultra-32k-dev",
  "spark-ultra-32k",
]);

/**
 * Minimal safe test prompt. Contains no project source, user data, book
 * content, or any sensitive information. Used only when all guards pass.
 * This prompt text is intentionally never printed in logs or results.
 */
const SMOKE_TEST_SYSTEM_MESSAGE = {
  role: LlmChatRole.System,
  content: "You are a health check responder.",
};

const SMOKE_TEST_USER_MESSAGE = {
  role: LlmChatRole.User,
  content: "Reply with exactly one word: OK",
};

// ---------------------------------------------------------------------------
// Guard checking
// ---------------------------------------------------------------------------

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) return false;
  var trimmed = value.trim();
  return trimmed === "1" || trimmed.toLowerCase() === "true";
}

function isNonEmpty(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value.trim().length > 0;
}

/**
 * Evaluate all guard conditions and return a safe GuardStatus.
 * Real values of keys/passwords/endpoints are never included in the output.
 */
export function checkAllGuards(
  env: SmokeTestEnv,
  allowNetwork: boolean,
): GuardStatus {
  var blocked: string[] = [];

  var smokeTestEnabled = isTruthy(env.LAP_LLM_DEV_SMOKE_TEST_ENABLED);
  if (!smokeTestEnabled) {
    blocked.push("LAP_LLM_DEV_SMOKE_TEST_ENABLED is not '1' or 'true'");
  }

  var readerQaExternalEnabled = isTruthy(env.LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED);
  if (!readerQaExternalEnabled) {
    blocked.push("LAP_READER_QA_EXTERNAL_LLM_DEV_ENABLED is not '1' or 'true'");
  }

  var allowExternalProvider = isTruthy(env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER);
  if (!allowExternalProvider) {
    blocked.push("LAP_ALLOW_EXTERNAL_LLM_PROVIDER is not '1' or 'true'");
  }

  var providerId = (env.LAP_LLM_PROVIDER ?? "").trim();
  var providerAllowed = ALLOWED_DEV_PROVIDER_IDS.has(providerId);
  if (!providerAllowed) {
    blocked.push(
      "LAP_LLM_PROVIDER '" +
        (providerId || "(empty)") +
        "' not in allowed dev provider IDs",
    );
  }

  var endpointConfigured = isNonEmpty(env.LAP_LLM_DEV_ENDPOINT);
  if (!endpointConfigured) {
    blocked.push("LAP_LLM_DEV_ENDPOINT is missing or empty");
  }

  var apiKeyConfigured = isNonEmpty(env.LAP_LLM_DEV_API_KEY);
  if (!apiKeyConfigured) {
    blocked.push("LAP_LLM_DEV_API_KEY is missing or empty");
  }

  var apiPasswordConfigured = isNonEmpty(env.LAP_LLM_DEV_APIPassword);
  if (!apiPasswordConfigured) {
    blocked.push("LAP_LLM_DEV_APIPassword is missing or empty");
  }

  var networkAllowed = allowNetwork;
  if (!networkAllowed) {
    blocked.push("allowNetwork is false (use --live to enable)");
  }

  var allPassed = blocked.length === 0;

  return {
    smokeTestEnabled: smokeTestEnabled,
    readerQaExternalEnabled: readerQaExternalEnabled,
    allowExternalProvider: allowExternalProvider,
    providerAllowed: providerAllowed,
    endpointConfigured: endpointConfigured,
    apiKeyConfigured: apiKeyConfigured,
    apiPasswordConfigured: apiPasswordConfigured,
    networkAllowed: networkAllowed,
    allPassed: allPassed,
    blockedReasons: blocked,
  };
}

// ---------------------------------------------------------------------------
// Smoke test runner
// ---------------------------------------------------------------------------

function makeEmptyResult(
  mode: SmokeTestResult["mode"],
  guardStatus: GuardStatus,
  env: SmokeTestEnv,
): SmokeTestResult {
  return {
    ok: mode === "external-dev-smoke",
    mode: mode,
    providerId: (env.LAP_LLM_PROVIDER ?? "").trim() || "(not set)",
    model: (env.LAP_LLM_DEV_MODEL ?? "").trim() || "(not set)",
    endpointConfigured: guardStatus.endpointConfigured,
    apiKeyConfigured: guardStatus.apiKeyConfigured,
    apiPasswordConfigured: guardStatus.apiPasswordConfigured,
    timeoutMs: parseTimeout(env.LAP_LLM_DEV_TIMEOUT_MS),
    networkAttempted: false,
    externalProviderUsed: false,
    llmUsed: false,
    writesDatabase: false,
    toolsUsed: false,
    agentLoopUsed: false,
    rawPromptStored: false,
    rawResponseStored: false,
    rawResponsePrinted: false,
    secretSafe: true,
    productionReady: false,
    safeToExposeToClient: true,
    guardStatus: guardStatus,
    createdAt: new Date().toISOString(),
  };
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) return 30000;
  var p = parseInt(value, 10);
  if (Number.isFinite(p) && p > 0) return p;
  return 30000;
}

/**
 * Sanitize an error message — strip any potential secrets, bearer tokens,
 * keys, passwords, or database URLs.
 */
function sanitizeError(message: string): string {
  var result = message;
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|api[_-]?password|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  return result;
}

/**
 * Run the LLM dev smoke test.
 *
 * Default behavior (dryRun=true, allowNetwork=false):
 *   - Checks all guard conditions
 *   - Returns dry-run metadata
 *   - Does NOT call any LLM or make any network request
 *
 * Live behavior (dryRun=false, allowNetwork=true, all guards pass):
 *   - Makes exactly one minimal chat completion request
 *   - Records only safe metadata (no prompt, response, keys, or headers printed)
 *   - Uses the existing ExternalChatCompletionsProvider
 */
export async function runLlmDevSmokeTest(
  env: SmokeTestEnv,
  options?: SmokeTestOptions,
): Promise<SmokeTestResult> {
  var dryRun = options?.dryRun !== false;
  var allowNetwork = options?.allowNetwork === true;
  var fetchImpl = options?.fetchImpl;

  var guardStatus = checkAllGuards(env, allowNetwork);

  if (dryRun) {
    return makeEmptyResult("dry-run", guardStatus, env);
  }

  if (!guardStatus.allPassed) {
    var blockedResult = makeEmptyResult("blocked", guardStatus, env);
    blockedResult.ok = false;
    return blockedResult;
  }

  try {
    var config = loadExternalProviderConfig({
      endpoint: env.LAP_LLM_DEV_ENDPOINT,
      apiKey: env.LAP_LLM_DEV_API_KEY,
      model: env.LAP_LLM_DEV_MODEL,
      timeoutMs: env.LAP_LLM_DEV_TIMEOUT_MS,
    });

    if (!config.configured) {
      var configBlocked = makeEmptyResult("blocked", guardStatus, env);
      configBlocked.ok = false;
      configBlocked.redactedError = "External provider config incomplete: " +
        sanitizeError(config.blockedReason ?? "unknown");
      return configBlocked;
    }

    var provider = new ExternalChatCompletionsProvider(config, fetchImpl);

    var startMs = Date.now();
    var chatResult = await provider.generate({
      messages: [SMOKE_TEST_SYSTEM_MESSAGE, SMOKE_TEST_USER_MESSAGE],
      timeoutMs: config.timeoutMs,
      maxOutputChars: 50,
      purposeSummary: "dev-smoke-test-health-check",
    });
    var durationMs = Date.now() - startMs;

    var responseReceived =
      chatResult.ok &&
      chatResult.answerSummary.length > 0 &&
      !chatResult.answerSummary.startsWith("[blocked]") &&
      !chatResult.answerSummary.startsWith("[external provider error]") &&
      !chatResult.answerSummary.startsWith("[external provider timeout]") &&
      !chatResult.answerSummary.startsWith("[external provider warning]");

    var isError =
      chatResult.error !== undefined &&
      chatResult.error.kind === "network_error";

    var smokeResult: SmokeTestResult = {
      ok: chatResult.ok && responseReceived === true && !isError,
      mode: isError ? "error" : "external-dev-smoke",
      providerId: (env.LAP_LLM_PROVIDER ?? "").trim(),
      model: config.model,
      endpointConfigured: true,
      apiKeyConfigured: true,
      apiPasswordConfigured: guardStatus.apiPasswordConfigured,
      timeoutMs: config.timeoutMs,
      networkAttempted: true,
      externalProviderUsed: true,
      llmUsed: true,
      writesDatabase: false,
      toolsUsed: false,
      agentLoopUsed: false,
      rawPromptStored: false,
      rawResponseStored: false,
      rawResponsePrinted: false,
      secretSafe: true,
      productionReady: false,
      safeToExposeToClient: true,
      guardStatus: guardStatus,
      responseReceived: responseReceived,
      responseDurationMs: durationMs,
      createdAt: new Date().toISOString(),
    };

    if (chatResult.error) {
      smokeResult.redactedError = sanitizeError(chatResult.error.message);
      if (!smokeResult.ok && !smokeResult.redactedError) {
        smokeResult.redactedError = "Unknown error during external provider call";
      }
    }

    return smokeResult;
  } catch (err: unknown) {
    var message = err instanceof Error ? err.message : String(err);
    var errorResult = makeEmptyResult("error", guardStatus, env);
    errorResult.ok = false;
    errorResult.networkAttempted = true;
    errorResult.externalProviderUsed = true;
    errorResult.redactedError = sanitizeError(message);
    return errorResult;
  }
}

// ---------------------------------------------------------------------------
// Safe CLI formatter — never prints keys, passwords, prompts, or responses
// ---------------------------------------------------------------------------

/**
 * Format a smoke test result for CLI display.
 * Guaranteed to never print API keys, passwords, prompts, or raw responses.
 */
export function formatSmokeTestResult(result: SmokeTestResult): string {
  var lines: string[] = [];

  lines.push("=== LLM Dev Smoke Test Result ===");
  lines.push("");
  lines.push("  ok: " + String(result.ok));
  lines.push("  mode: " + result.mode);
  lines.push("  providerId: " + result.providerId);
  lines.push("  model: " + result.model);
  lines.push("");
  lines.push("--- Configuration ---");
  lines.push("  endpointConfigured: " + String(result.endpointConfigured));
  lines.push("  apiKeyConfigured: " + String(result.apiKeyConfigured));
  lines.push("  apiPasswordConfigured: " + String(result.apiPasswordConfigured));
  lines.push("  timeoutMs: " + String(result.timeoutMs));
  lines.push("");
  lines.push("--- Guard Status ---");
  lines.push("  smokeTestEnabled: " + String(result.guardStatus.smokeTestEnabled));
  lines.push("  readerQaExternalEnabled: " + String(result.guardStatus.readerQaExternalEnabled));
  lines.push("  allowExternalProvider: " + String(result.guardStatus.allowExternalProvider));
  lines.push("  providerAllowed: " + String(result.guardStatus.providerAllowed));
  lines.push("  endpointConfigured (guard): " + String(result.guardStatus.endpointConfigured));
  lines.push("  apiKeyConfigured (guard): " + String(result.guardStatus.apiKeyConfigured));
  lines.push("  apiPasswordConfigured (guard): " + String(result.guardStatus.apiPasswordConfigured));
  lines.push("  networkAllowed: " + String(result.guardStatus.networkAllowed));
  lines.push("  allPassed: " + String(result.guardStatus.allPassed));

  if (result.guardStatus.blockedReasons.length > 0) {
    lines.push("");
    lines.push("--- Blocked Reasons ---");
    for (var i = 0; i < result.guardStatus.blockedReasons.length; i++) {
      lines.push("  - " + result.guardStatus.blockedReasons[i]);
    }
  }

  lines.push("");
  lines.push("--- Safety Assertions ---");
  lines.push("  networkAttempted: " + String(result.networkAttempted));
  lines.push("  externalProviderUsed: " + String(result.externalProviderUsed));
  lines.push("  llmUsed: " + String(result.llmUsed));
  lines.push("  writesDatabase: " + String(result.writesDatabase));
  lines.push("  toolsUsed: " + String(result.toolsUsed));
  lines.push("  agentLoopUsed: " + String(result.agentLoopUsed));
  lines.push("  rawPromptStored: " + String(result.rawPromptStored));
  lines.push("  rawResponseStored: " + String(result.rawResponseStored));
  lines.push("  rawResponsePrinted: " + String(result.rawResponsePrinted));
  lines.push("  secretSafe: " + String(result.secretSafe));
  lines.push("  productionReady: " + String(result.productionReady));
  lines.push("  safeToExposeToClient: " + String(result.safeToExposeToClient));

  if (result.responseReceived !== undefined) {
    lines.push("");
    lines.push("--- Live Test ---");
    lines.push("  responseReceived: " + String(result.responseReceived));
    if (result.responseDurationMs !== undefined) {
      lines.push("  responseDurationMs: " + String(result.responseDurationMs));
    }
    if (result.redactedError) {
      lines.push("  redactedError: " + result.redactedError);
    }
  }

  lines.push("");
  lines.push("  createdAt: " + result.createdAt);
  lines.push("");
  lines.push("=== Result: " + (result.ok ? "PASS" : "FAIL / BLOCKED / DRY-RUN") + " ===");

  return lines.join("\n");
}
