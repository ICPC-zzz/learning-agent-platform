/**
 * External Chat Completions Provider - dev-only OpenAI-compatible adapter.
 * @module external-chat-completions-provider @previewOnly
 */
import type { LlmChatRequest, LlmChatResult, LlmProvider, LlmSafeErrorKind } from "./llm-provider-contract.ts";
import { LlmProviderMode } from "./llm-provider-contract.ts";
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
  model: string;
  timeoutMs: number;
  configured: boolean;
  blockedReason: string | null;
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
  var model = (env.model ?? "").trim();
  var timeoutMs = parseTimeout(env.timeoutMs);
  var missing: string[] = [];
  if (!endpoint) missing.push(LAP_LLM_DEV_ENDPOINT_KEY);
  if (!apiKey) missing.push(LAP_LLM_DEV_API_KEY_KEY);
  if (!model) missing.push(LAP_LLM_DEV_MODEL_KEY);
  return {
    endpoint: endpoint,
    apiKey: apiKey,
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
  private config: ExternalProviderConfig;
  private _fetch: ExternalProviderFetch;

  constructor(config: ExternalProviderConfig, customFetch?: ExternalProviderFetch) {
    this.config = config;
    this._fetch = customFetch ?? globalThis.fetch;
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
      var timeoutId = setTimeout(function() { controller.abort(); }, this.config.timeoutMs);
      var response: Response;
      try {
        var url = this.config.endpoint.replace(/\/$/, "") + "/chat/completions";
        response = await this._fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + this.config.apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeoutId); }
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
      if (err instanceof DOMException && err.name === "AbortError") {
        return createSafeResult({
          answerSummary: "[external provider timeout] Request timed out.",
          providerMode: "external-dev-only", realProviderCalled: true, networkAccessed: true,
          warnings: ["External provider timeout (" + this.config.timeoutMs + "ms)."],
          error: createSafeError({ kind: "timeout", message: "Timeout (" + this.config.timeoutMs + "ms).", retryable: true }),
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
}

interface OpenAiRequestBody { model: string; messages: Array<{ role: string; content: string }>; max_tokens?: number; temperature?: number; }

function buildRequestBody(request: LlmChatRequest, config: ExternalProviderConfig): OpenAiRequestBody {
  var body: OpenAiRequestBody = {
    model: config.model,
    messages: request.messages.map(function(m) { return { role: m.role, content: m.content }; }),
    temperature: 0.7,
  };
  if (request.maxOutputChars && request.maxOutputChars > 0) {
    body.max_tokens = Math.ceil(request.maxOutputChars * 0.5);
  }
  return body;
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

function sanitizeResponseContent(content: string, maxChars?: number): string {
  var result = content;
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(/\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi, "$1=[redacted]");
  var limit = (maxChars && maxChars > 0) ? maxChars : 4096;
  if (result.length > limit) result = result.slice(0, limit - 3) + "...";
  return result;
}
