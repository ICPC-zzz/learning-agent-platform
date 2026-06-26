/**
 * LLM Safe Result factory functions. @module llm-safe-result @previewOnly
 */
import type { LlmChatResult, LlmProviderMode, LlmSafeError, LlmSafeErrorKind } from "./llm-provider-contract.ts";

export interface CreateSafeResultInput {
  answerSummary: string;
  providerMode: LlmProviderMode;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  warnings?: readonly string[];
  error?: LlmSafeError;
}

export function createSafeResult(input: CreateSafeResultInput): LlmChatResult {
  return {
    ok: input.error === undefined,
    answerSummary: sanitizeAnswer(input.answerSummary),
    providerMode: input.providerMode,
    realProviderCalled: input.realProviderCalled,
    networkAccessed: input.networkAccessed,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    error: input.error,
    warnings: input.warnings ?? [],
    createdAt: new Date().toISOString(),
  };
}

export interface CreateSafeErrorInput {
  kind: LlmSafeErrorKind;
  message: string;
  retryable?: boolean;
}

export function createSafeError(input: CreateSafeErrorInput): LlmSafeError {
  return {
    kind: input.kind,
    message: sanitizeAnswer(input.message),
    retryable: input.retryable ?? false,
    secretSafe: true,
    rawProviderResponseStored: false,
  };
}

export function createBlockedResult(blockedReasons: readonly string[], providerMode?: LlmProviderMode): LlmChatResult {
  var mode = providerMode ?? "mock";
  var reasonText = blockedReasons.length > 0 ? blockedReasons.join("; ") : "guard blocked";
  return createSafeResult({
    answerSummary: "[blocked] " + reasonText,
    providerMode: mode,
    realProviderCalled: false,
    networkAccessed: false,
    warnings: ["LLM call blocked by guard. No provider was called."].concat(blockedReasons.map(function(r) { return "Reason: " + r; })),
    error: createSafeError({ kind: "blocked_by_guard", message: reasonText, retryable: false }),
  });
}

export function createMockSuccessResult(answerSummary: string): LlmChatResult {
  return createSafeResult({
    answerSummary: answerSummary,
    providerMode: "mock",
    realProviderCalled: false,
    networkAccessed: false,
    warnings: [
      "Mock provider only; no real model was called.",
      "No network request was made.",
      "No env file, secret, API key, or authorization header was read.",
    ],
  });
}

var MAX_ANSWER_CHARS = 4096;

function sanitizeAnswer(text: string): string {
  var result = text;
  // Strip bearer tokens
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  // Strip api_key/secret/token patterns
  result = result.replace(/\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi, "$1=[redacted]");
  // Strip DATABASE_URL
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  // Strip raw prompt/response patterns
  result = result.replace(/\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi, "$1=[redacted]");
  // Length limit
  if (result.length > MAX_ANSWER_CHARS) {
    result = result.slice(0, MAX_ANSWER_CHARS - 3) + "...";
  }
  return result;
}
