/**
 * External Chat Completions Provider - dev-only OpenAI-compatible adapter.
 * @module external-chat-completions-provider @previewOnly
 */
import type {
  LlmAssistantTurnResult,
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  LlmSafeError,
  LlmSafeErrorKind,
  LlmToolCall,
} from "./llm-provider-contract.ts";
import { LlmChatRole, LlmProviderMode } from "./llm-provider-contract.ts";
import { createSafeError, createSafeResult } from "./llm-safe-result.ts";

export interface ExternalProviderEnv {
  endpoint?: string;
  apiKey?: string;
  apiPassword?: string;
  model?: string;
  timeoutMs?: number | string;
}

export interface ExternalProviderConfig {
  endpoint: string;
  apiKey: string;
  apiPassword?: string;
  model: string;
  timeoutMs: number;
  configured: boolean;
  blockedReason: string | null;
  supportsToolCalling?: boolean;
  supportsParallelToolCalls?: boolean;
}

export type ExternalProviderFetch = typeof globalThis.fetch;
export var LAP_LLM_DEV_ENDPOINT_KEY = "LAP_LLM_DEV_ENDPOINT";
export var LAP_LLM_DEV_API_KEY_KEY = "LAP_LLM_DEV_API_KEY";
export var LAP_LLM_DEV_MODEL_KEY = "LAP_LLM_DEV_MODEL";
export var LAP_LLM_DEV_TIMEOUT_MS_KEY = "LAP_LLM_DEV_TIMEOUT_MS";
var DEFAULT_TIMEOUT_MS = 15000;

export function loadExternalProviderConfig(env: ExternalProviderEnv): ExternalProviderConfig {
  var endpoint = (env.endpoint ?? "").trim();
  var apiKey = (env.apiKey ?? "").trim();
  var apiPassword = (env.apiPassword ?? "").trim();
  var model = (env.model ?? "").trim();
  var timeoutMs = parseTimeout(env.timeoutMs);
  var missing: string[] = [];
  if (!endpoint) missing.push(LAP_LLM_DEV_ENDPOINT_KEY);
  if (!apiKey && !apiPassword) missing.push(LAP_LLM_DEV_API_KEY_KEY);
  if (!model) missing.push(LAP_LLM_DEV_MODEL_KEY);
  return {
    endpoint: endpoint,
    apiKey: apiKey || apiPassword,
    apiPassword: apiPassword || undefined,
    model: model,
    timeoutMs: timeoutMs,
    configured: missing.length === 0,
    blockedReason: missing.length > 0 ? "Missing env vars: " + missing.join(", ") : null,
  };
}

function parseTimeout(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  if (typeof value === "string") { var p = parseInt(value, 10); if (Number.isFinite(p) && p > 0) return p; }
  return DEFAULT_TIMEOUT_MS;
}

export class ExternalChatCompletionsProvider implements LlmProvider {
  readonly mode = LlmProviderMode.ExternalDevOnly;
  readonly label = "External Chat Completions Provider (dev-only)";
  readonly capabilities: LlmProvider["capabilities"];
  private config: ExternalProviderConfig;
  private _fetch: ExternalProviderFetch;

  constructor(config: ExternalProviderConfig, customFetch?: ExternalProviderFetch) {
    this.config = config;
    this._fetch = customFetch ?? globalThis.fetch;
    this.capabilities = {
      supportsChat: true,
      supportsToolCalling: config.supportsToolCalling ?? true,
      supportsParallelToolCalls: config.supportsParallelToolCalls ?? true,
      toolCallProtocol: "openai-chat-completions",
    };
  }

  async generate(request: LlmChatRequest): Promise<LlmChatResult> {
    if (!this.config.configured) {
      return createSafeResult({
        answerSummary: "[external provider blocked] " + (this.config.blockedReason ?? "provider not configured"),
        providerMode: "external-dev-only",
        realProviderCalled: false,
        networkAccessed: false,
        warnings: ["External provider not fully configured. Missing required env vars."],
        error: createSafeError({ kind: "provider_disabled", message: this.config.blockedReason ?? "provider not configured", retryable: false }),
      });
    }
    var userMessages = request.messages.filter(function(m) { return m.role === "user"; });
    if (userMessages.length === 0) {
      return createSafeResult({
        answerSummary: "[external provider blocked] No user message.",
        providerMode: "external-dev-only", realProviderCalled: false, networkAccessed: false,
        warnings: ["Request contains no user message."],
        error: createSafeError({ kind: "invalid_request", message: "No user message.", retryable: false }),
      });
    }
    var body = buildRequestBody(request, this.config);
    try {
      var controller = new AbortController();
      var relayAbort = function() { controller.abort(request.signal?.reason); };
      request.signal?.addEventListener("abort", relayAbort, { once: true });
      if (request.signal?.aborted) {
        controller.abort(request.signal.reason);
      }
      var timeoutId = setTimeout(function() { controller.abort(); }, this.config.timeoutMs);
      var response: Response;
      try {
        var url = buildChatCompletionsUrl(this.config.endpoint);
        var headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: buildAuthorizationHeader(this.config),
        };
        if (this.config.apiPassword) {
          headers["X-APIPassword"] = this.config.apiPassword;
        }
        response = await this._fetch(url, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener("abort", relayAbort);
      }
      if (!response.ok) {
        var sc = response.status;
        var ek: LlmSafeErrorKind = sc === 401 || sc === 403 ? "provider_disabled" : sc === 429 ? "provider_error" : sc >= 500 ? "provider_error" : "network_error";
        return createSafeResult({
          answerSummary: "[external provider error] HTTP " + sc,
          providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
          warnings: ["External provider returned HTTP " + sc + ". Raw response body not retained."],
          error: createSafeError({ kind: ek, message: "HTTP " + sc, retryable: sc === 429 || sc >= 500 }),
        });
      }
      var responseText: string;
      try { responseText = await response.text(); } catch {
        return createSafeResult({
          answerSummary: "[external provider error] Cannot read response.",
          providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
          warnings: ["Cannot read external provider response."],
          error: createSafeError({ kind: "empty_response", message: "Cannot read response.", retryable: true }),
        });
      }
      var answerSummary = extractSafeContent(responseText);
      if (!answerSummary || answerSummary.trim().length === 0) {
        return createSafeResult({
          answerSummary: "[external provider warning] Empty response.",
          providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
          warnings: ["External provider returned empty response."],
          error: createSafeError({ kind: "empty_response", message: "Empty response content.", retryable: false }),
        });
      }
      return createSafeResult({
        answerSummary: sanitizeResponseContent(answerSummary, request.maxOutputChars),
        providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
        warnings: ["External provider (dev-only) returned an answer.", "Raw prompt/response not saved.", "devOnly: true, productionReady: false."],
      });
    } catch (err: unknown) {
      if ((err instanceof DOMException && err.name === "AbortError") || request.signal?.aborted) {
        return createSafeResult({
          answerSummary: request.signal?.aborted ? "模型调用已取消。" : "模型调用超时。",
          providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
          warnings: [request.signal?.aborted ? "模型调用已取消。" : "模型调用超时（" + this.config.timeoutMs + "ms）。"],
          error: createSafeError({ kind: "timeout", message: request.signal?.aborted ? "模型调用已取消。" : "模型调用超时。", retryable: true }),
        });
      }
      return createSafeResult({
        answerSummary: "[external provider error] Network error.",
        providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
        warnings: ["External provider request failed (network error).", "Error details not retained."],
        error: createSafeError({ kind: "network_error", message: "Network error calling external provider.", retryable: true }),
      });
    }
  }

  async generateAssistantTurn(
    request: LlmChatRequest,
  ): Promise<LlmAssistantTurnResult> {
    if (!this.config.configured) {
      return createAssistantTurnError({
        message: "[external provider blocked] " + (this.config.blockedReason ?? "provider not configured"),
        warning: "External provider not fully configured. Missing required env vars.",
        error: createSafeError({
          kind: "provider_disabled",
          message: this.config.blockedReason ?? "provider not configured",
          retryable: false,
        }),
        realProviderCalled: false,
        networkAccessed: false,
      });
    }

    var body = buildRequestBody(request, this.config);
    try {
      var controller = new AbortController();
      var relayAbort = function() { controller.abort(request.signal?.reason); };
      request.signal?.addEventListener("abort", relayAbort, { once: true });
      if (request.signal?.aborted) {
        controller.abort(request.signal.reason);
      }
      var timeoutId = setTimeout(function() { controller.abort(); }, request.timeoutMs ?? this.config.timeoutMs);
      var response: Response;
      try {
        response = await this._fetch(buildChatCompletionsUrl(this.config.endpoint), {
          method: "POST",
          headers: buildHeaders(this.config),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener("abort", relayAbort);
      }

      if (!response.ok) {
        var statusCode = response.status;
        var errorKind: LlmSafeErrorKind =
          statusCode === 401 || statusCode === 403
            ? "provider_disabled"
            : statusCode === 429 || statusCode >= 500
              ? "provider_error"
              : "network_error";
        return createAssistantTurnError({
          message: "[external provider error] HTTP " + statusCode,
          warning: "External provider returned HTTP " + statusCode + ". Raw response body not retained.",
          error: createSafeError({
            kind: errorKind,
            message: "HTTP " + statusCode,
            retryable: statusCode === 429 || statusCode >= 500,
          }),
          realProviderCalled: true,
          networkAccessed: true,
        });
      }

      var responseText = await response.text();
      var parsedTurn = extractAssistantTurn(responseText, request.maxOutputChars);
      if (!parsedTurn.ok) {
        return createAssistantTurnError({
          message: parsedTurn.safeMessage,
          warning: parsedTurn.warning,
          error: createSafeError({
            kind: "empty_response",
            message: parsedTurn.safeMessage,
            retryable: false,
          }),
          realProviderCalled: true,
          networkAccessed: true,
        });
      }

      return {
        ok: true,
        message: parsedTurn.message,
        finishReason: parsedTurn.finishReason,
        providerMode: "external-dev-only",
        realProviderCalled: true,
        networkAccessed: true,
        secretSafe: true,
        rawPromptStored: false,
        rawResponseStored: false,
        devOnly: true,
        productionReady: false,
        warnings: [
          "External provider (dev-only) returned an assistant turn.",
          "Raw prompt/response not saved.",
        ],
        createdAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      if ((err instanceof DOMException && err.name === "AbortError") || request.signal?.aborted) {
        return createAssistantTurnError({
          message: request.signal?.aborted ? "Model call cancelled." : "Model call timed out.",
          warning: request.signal?.aborted ? "Model call cancelled." : "Model call timed out.",
          error: createSafeError({
            kind: "timeout",
            message: request.signal?.aborted ? "Model call cancelled." : "Model call timed out.",
            retryable: true,
          }),
          realProviderCalled: true,
          networkAccessed: true,
        });
      }
      return createAssistantTurnError({
        message: "[external provider error] Network error.",
        warning: "External provider request failed (network error). Error details not retained.",
        error: createSafeError({
          kind: "network_error",
          message: "Network error calling external provider.",
          retryable: true,
        }),
        realProviderCalled: true,
        networkAccessed: true,
      });
    }
  }
}

function buildChatCompletionsUrl(endpoint: string): string {
  var normalized = endpoint.replace(/\/+$/, "");
  if (normalized.toLowerCase().endsWith("/chat/completions")) {
    return normalized;
  }
  return normalized + "/chat/completions";
}

function buildAuthorizationHeader(config: ExternalProviderConfig): string {
  if (config.apiPassword && isSparkOpenApiEndpoint(config.endpoint)) {
    return "Bearer " + config.apiPassword;
  }
  return "Bearer " + config.apiKey;
}

function buildHeaders(config: ExternalProviderConfig): Record<string, string> {
  var headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: buildAuthorizationHeader(config),
  };
  if (config.apiPassword) {
    headers["X-APIPassword"] = config.apiPassword;
  }
  return headers;
}

function isSparkOpenApiEndpoint(endpoint: string): boolean {
  try {
    var url = new URL(endpoint);
    var host = url.hostname.toLowerCase();
    return host === "spark-api-open.xf-yun.com" || host.endsWith(".xf-yun.com");
  } catch {
    return endpoint.toLowerCase().includes("spark-api-open.xf-yun.com");
  }
}

interface OpenAiRequestBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  max_tokens?: number;
  temperature?: number;
  tools?: readonly unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
}

function buildRequestBody(request: LlmChatRequest, config: ExternalProviderConfig): OpenAiRequestBody {
  var body: OpenAiRequestBody = {
    model: config.model,
    messages: request.messages.map(mapMessageForOpenAi),
    temperature: 0.7,
  };
  if (request.maxOutputChars && request.maxOutputChars > 0) {
    body.max_tokens = Math.ceil(request.maxOutputChars * 0.5);
  }
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map(function(tool) {
      return {
        type: "function",
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters ?? {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      };
    });
    body.tool_choice = request.toolChoice ?? "auto";
    if (request.parallelToolCalls !== undefined) {
      body.parallel_tool_calls = request.parallelToolCalls;
    }
  }
  return body;
}

function mapMessageForOpenAi(message: LlmChatRequest["messages"][number]): Record<string, unknown> {
  if (message.role === LlmChatRole.Tool) {
    return {
      role: "tool",
      tool_call_id: message.toolCallId ?? "",
      content: message.content,
    };
  }

  if (message.role === LlmChatRole.Assistant && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: message.content.length > 0 ? message.content : null,
      tool_calls: message.toolCalls.map(function(call) {
        return {
          id: call.id,
          type: "function",
          function: {
            name: call.name,
            arguments: call.argumentsText ?? JSON.stringify(call.arguments ?? {}),
          },
        };
      }),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

function extractSafeContent(responseText: string): string {
  try {
    var parsed = JSON.parse(responseText);
    if (!parsed || typeof parsed !== "object") return "";
    var choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    if (choices.length === 0) return "";
    var firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== "object") return "";
    var message = firstChoice.message;
    if (!message || typeof message !== "object") return "";
    var content = message.content;
    if (typeof content === "string") return content;
    return "";
  } catch { return ""; }
}

function extractAssistantTurn(
  responseText: string,
  maxOutputChars?: number,
): {
  ok: true;
  message: LlmAssistantTurnResult["message"];
  finishReason: LlmAssistantTurnResult["finishReason"];
} | {
  ok: false;
  safeMessage: string;
  warning: string;
} {
  try {
    var parsed = JSON.parse(responseText);
    if (!parsed || typeof parsed !== "object") {
      return {
        ok: false,
        safeMessage: "[external provider warning] Empty response.",
        warning: "External provider returned a non-object response.",
      };
    }
    var choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    if (choices.length === 0) {
      return {
        ok: false,
        safeMessage: "[external provider warning] Empty response.",
        warning: "External provider returned no choices.",
      };
    }
    var firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== "object") {
      return {
        ok: false,
        safeMessage: "[external provider warning] Empty response.",
        warning: "External provider returned an invalid first choice.",
      };
    }
    var rawMessage = firstChoice.message;
    if (!rawMessage || typeof rawMessage !== "object") {
      return {
        ok: false,
        safeMessage: "[external provider warning] Empty response.",
        warning: "External provider returned no assistant message.",
      };
    }

    var content = typeof rawMessage.content === "string"
      ? sanitizeResponseContent(rawMessage.content, maxOutputChars)
      : "";
    var toolCalls = parseToolCalls(rawMessage.tool_calls);
    if (content.trim().length === 0 && toolCalls.length === 0) {
      return {
        ok: false,
        safeMessage: "[external provider warning] Empty response.",
        warning: "External provider returned no content or tool calls.",
      };
    }
    return {
      ok: true,
      message: {
        role: LlmChatRole.Assistant,
        content,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      },
      finishReason: normalizeFinishReason(firstChoice.finish_reason, toolCalls.length),
    };
  } catch {
    return {
      ok: false,
      safeMessage: "[external provider warning] Invalid response.",
      warning: "External provider returned invalid JSON. Raw response not retained.",
    };
  }
}

function parseToolCalls(value: unknown): LlmToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  var calls: LlmToolCall[] = [];
  for (var i = 0; i < value.length; i++) {
    var item = value[i];
    if (!item || typeof item !== "object") {
      continue;
    }
    var fn = (item as { function?: unknown }).function;
    if (!fn || typeof fn !== "object") {
      continue;
    }
    var id = typeof (item as { id?: unknown }).id === "string"
      ? String((item as { id: string }).id)
      : "tool_call_" + i;
    var name = typeof (fn as { name?: unknown }).name === "string"
      ? String((fn as { name: string }).name)
      : "";
    if (name.length === 0) {
      continue;
    }
    var parsedArguments = parseToolArguments((fn as { arguments?: unknown }).arguments);
    calls.push({
      id,
      type: "function",
      name,
      arguments: parsedArguments.arguments,
      ...(parsedArguments.argumentsText ? { argumentsText: parsedArguments.argumentsText } : {}),
      ...(parsedArguments.argumentsParseError ? { argumentsParseError: parsedArguments.argumentsParseError } : {}),
    });
  }
  return calls;
}

function parseToolArguments(value: unknown): {
  arguments: Record<string, unknown>;
  argumentsText?: string;
  argumentsParseError?: string;
} {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      arguments: value as Record<string, unknown>,
    };
  }

  if (typeof value !== "string") {
    return {
      arguments: {},
    };
  }

  try {
    var parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        arguments: parsed as Record<string, unknown>,
        argumentsText: value,
      };
    }
    return {
      arguments: {},
      argumentsText: value,
      argumentsParseError: "tool arguments must be a JSON object",
    };
  } catch {
    return {
      arguments: {},
      argumentsText: value,
      argumentsParseError: "tool arguments are not valid JSON",
    };
  }
}

function normalizeFinishReason(
  value: unknown,
  toolCallCount: number,
): LlmAssistantTurnResult["finishReason"] {
  if (value === "stop" || value === "length" || value === "content_filter") {
    return value;
  }
  if (value === "tool_calls" || toolCallCount > 0) {
    return "tool_calls";
  }
  return "unknown";
}

function createAssistantTurnError(input: {
  message: string;
  warning: string;
  error: LlmSafeError;
  realProviderCalled: boolean;
  networkAccessed: boolean;
}): LlmAssistantTurnResult {
  return {
    ok: false,
    message: {
      role: LlmChatRole.Assistant,
      content: sanitizeResponseContent(input.message, 700),
    },
    finishReason: "error",
    providerMode: "external-dev-only",
    realProviderCalled: input.realProviderCalled,
    networkAccessed: input.networkAccessed,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    error: input.error,
    warnings: [input.warning, "Raw prompt/response not saved."],
    createdAt: new Date().toISOString(),
  };
}

function sanitizeResponseContent(content: string, maxChars?: number): string {
  var result = content;
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(/\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi, "$1=[redacted]");
  var limit = (maxChars && maxChars > 0) ? maxChars : 4096;
  if (result.length > limit) result = result.slice(0, limit - 3) + "...";
  return result;
}
