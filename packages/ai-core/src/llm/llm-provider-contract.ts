/**
 * LLM Provider Contract — safe provider abstraction for dev-only Reader QA.
 *
 * This contract defines the minimal safe interface for LLM chat completion
 * providers. It is intentionally narrow: no tool calling, no streaming, no
 * multi-turn persistence.
 *
 * Designation: **开发预览 · dev-only · mock 默认 · 不接生产 AI 服务**
 *
 * @module llm-provider-contract
 * @previewOnly
 */

// ---------------------------------------------------------------------------
// Provider mode
// ---------------------------------------------------------------------------

export const LlmProviderMode = {
  Mock: "mock",
  ExternalDevOnly: "external-dev-only",
} as const;

export type LlmProviderMode =
  (typeof LlmProviderMode)[keyof typeof LlmProviderMode];

// ---------------------------------------------------------------------------
// Chat message role
// ---------------------------------------------------------------------------

export const LlmChatRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
} as const;

export type LlmChatRole =
  (typeof LlmChatRole)[keyof typeof LlmChatRole];

// ---------------------------------------------------------------------------
// Chat message
// ---------------------------------------------------------------------------

/**
 * A single chat message. content must be a safe string — no raw cookies,
 * tokens, secrets, or API keys.
 */
export interface LlmChatMessage {
  role: LlmChatRole;
  content: string;
}

// ---------------------------------------------------------------------------
// Chat request
// ---------------------------------------------------------------------------

/**
 * A safe chat completion request. message history is limited; raw sessions,
 * tokens, and secrets are forbidden.
 */
export interface LlmChatRequest {
  messages: readonly LlmChatMessage[];
  /** Max milliseconds before timeout. */
  timeoutMs?: number;
  /** Max input characters across all messages. */
  maxInputChars?: number;
  /** Max characters in the generated response. */
  maxOutputChars?: number;
  /** Human-readable purpose for audit logs (never raw prompt). */
  purposeSummary: string;
}

// ---------------------------------------------------------------------------
// Safe error
// ---------------------------------------------------------------------------

/**
 * A sanitized error that never exposes raw provider responses, API keys,
 * authorization headers, or internal stack traces.
 */
export interface LlmSafeError {
  kind: LlmSafeErrorKind;
  message: string;
  retryable: boolean;
  /** Always true — raw provider errors are stripped. */
  secretSafe: true;
  /** Always false — raw responses are not retained. */
  rawProviderResponseStored: false;
}

export type LlmSafeErrorKind =
  | "blocked_by_guard"
  | "provider_disabled"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "invalid_request"
  | "empty_response"
  | "content_too_large";

// ---------------------------------------------------------------------------
// Chat result
// ---------------------------------------------------------------------------

/**
 * A safe chat completion result. Never exposes:
 * - raw provider responses (JSON bodies)
 * - authorization headers
 * - raw prompt
 * - raw request payload
 * - raw HTTP status codes or trace IDs
 */
export interface LlmChatResult {
  ok: boolean;
  /** Safe summary of the answer (truncated if needed). */
  answerSummary: string;
  /** Which provider mode was used. */
  providerMode: LlmProviderMode;
  /** Whether a real external provider was called. */
  realProviderCalled: boolean;
  /** Whether network access occurred. */
  networkAccessed: boolean;
  /** Always true — raw responses were not retained. */
  secretSafe: true;
  /** Always false — raw prompts are never persisted. */
  rawPromptStored: false;
  /** Always false — raw provider JSON is never persisted. */
  rawResponseStored: false;
  /** Always true — this is dev-only. */
  devOnly: true;
  /** Always false — not production-ready. */
  productionReady: false;
  /** Safe error, if the call failed. */
  error?: LlmSafeError;
  /** Non-sensitive warnings. */
  warnings: readonly string[];
  /** ISO timestamp of when the result was created. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * A minimal LLM chat completion provider.
 *
 * Implementations:
 * - MockLlmProvider: returns deterministic text, no network.
 * - ExternalChatCompletionsProvider: OpenAI-compatible endpoint, dev-only.
 */
export interface LlmProvider {
  /** Which mode this provider operates in. */
  readonly mode: LlmProviderMode;
  /** Human-readable label for UI display. */
  readonly label: string;

  /**
   * Generate a chat completion. Never returns raw provider responses.
   * Errors are always sanitized via LlmSafeError.
   */
  generate(request: LlmChatRequest): Promise<LlmChatResult>;
}
