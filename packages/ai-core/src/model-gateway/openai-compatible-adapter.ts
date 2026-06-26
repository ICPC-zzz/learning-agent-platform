/**
 * OpenAI-Compatible Provider Adapter
 *
 * Handles constructing requests and parsing responses for any
 * OpenAI-compatible HTTP API endpoint.
 */

import type { ModelAuthMode } from "./auth-headers.ts";
import { buildAuthHeaders } from "./auth-headers.ts";
import { validateBaseUrl, SSRF_DEFAULTS } from "./ssrf-guard.ts";

export interface AdapterConfig {
  baseUrl: string;
  authMode: ModelAuthMode;
  /** Decrypted tokens/secrets from CredentialVault */
  secrets?: {
    token?: string;
    apiKeyHeaderName?: string;
    username?: string;
    password?: string;
    customHeaders?: Array<{ name: string; value: string; sensitive?: boolean }>;
  };
  modelId: string;
  timeoutMs?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  modelId: string;
  resolvedModel?: string;
  errorCode?: string;
  errorMessage?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Send a minimal connection test request to an OpenAI-compatible endpoint.
 * This makes a real HTTP call — the caller is responsible for ensuring
 * secrets are only held in memory temporarily.
 */
export async function testOpenAiCompatibleConnection(
  config: AdapterConfig,
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  // 1. SSRF check
  const ssrfResult = validateBaseUrl(config.baseUrl);
  if (!ssrfResult.allowed) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      modelId: config.modelId,
      errorCode: "SSRF_BLOCKED",
      errorMessage: ssrfResult.reason,
    };
  }

  // 2. Build auth headers
  const authResult = buildAuthHeaders({
    mode: config.authMode,
    token: config.secrets?.token,
    apiKeyHeaderName: config.secrets?.apiKeyHeaderName,
    username: config.secrets?.username,
    password: config.secrets?.password,
    customHeaders: config.secrets?.customHeaders,
  });

  if (authResult.errors.length > 0) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      modelId: config.modelId,
      errorCode: "AUTH_ERROR",
      errorMessage: authResult.errors[0],
    };
  }

  // 3. Resolve the chat completions endpoint
  const endpoint = resolveEndpoint(ssrfResult.normalizedUrl);

  // 4. Build minimal test request
  const requestBody = {
    model: config.modelId,
    messages: [{ role: "user" as const, content: "Reply with OK." }],
    temperature: 0,
    max_tokens: 8,
    stream: false,
  };

  const timeoutMs = Math.min(config.timeoutMs ?? SSRF_DEFAULTS.defaultTimeoutMs, 60000);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authResult.headers,
  };

  // 5. Make the request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;

    // 6. Handle HTTP error statuses
    if (!response.ok) {
      const errorCode = mapHttpStatusToErrorCode(response.status);
      let safeErrorMsg = "";

      try {
        const text = await response.text();
        safeErrorMsg = extractSafeErrorSummary(text);
      } catch {
        // ignore
      }

      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode,
        errorMessage: safeErrorMsg || `${response.status} ${response.statusText}`,
      };
    }

    // 7. Parse and validate the response
    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "EMPTY_RESPONSE",
        errorMessage: "无法读取响应内容",
      };
    }

    // Check response size
    if (responseText.length > SSRF_DEFAULTS.maxResponseSize) {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "RESPONSE_TOO_LARGE",
        errorMessage: "响应内容超过大小限制",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "INVALID_JSON",
        errorMessage: "响应不是有效的 JSON",
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "INVALID_RESPONSE",
        errorMessage: "响应格式不正确",
      };
    }

    const obj = parsed as Record<string, unknown>;

    // Validate choices array
    const choices = Array.isArray(obj.choices) ? obj.choices : [];
    if (choices.length === 0) {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "NO_CHOICES",
        errorMessage: "响应中不包含 choices",
      };
    }

    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    if (!firstChoice || typeof firstChoice.message !== "object" || firstChoice.message === null) {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "INVALID_CHOICE",
        errorMessage: "响应 choice 格式不正确",
      };
    }

    // Extract token usage if available
    const usage = obj.usage as Record<string, number> | undefined;
    const tokenUsage = usage ? {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    } : undefined;

    const resolvedModel = typeof obj.model === "string" ? obj.model : config.modelId;

    return {
      success: true,
      latencyMs,
      modelId: config.modelId,
      resolvedModel,
      tokenUsage,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;

    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        latencyMs,
        modelId: config.modelId,
        errorCode: "TIMEOUT",
        errorMessage: `连接超时 (${timeoutMs}ms)`,
      };
    }

    return {
      success: false,
      latencyMs,
      modelId: config.modelId,
      errorCode: "NETWORK_ERROR",
      errorMessage: "网络连接失败",
    };
  }
}

function resolveEndpoint(baseUrl: string): string {
  const url = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (url.endsWith("/chat/completions")) return url;
  return `${url}/chat/completions`;
}

function mapHttpStatusToErrorCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return `HTTP_${status}`;
}

function extractSafeErrorSummary(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return "";

    const error = (parsed as Record<string, unknown>).error;
    if (typeof error === "string") return error.slice(0, 200);
    if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      if (typeof errObj.message === "string") return errObj.message.slice(0, 200);
    }
    return "";
  } catch {
    return text.slice(0, 100);
  }
}
