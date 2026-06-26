/**
 * Model Gateway — Structured Generation Extension.
 *
 * Adds structured (JSON Schema) generation support on top of the
 * existing model-gateway infrastructure. Uses the OpenAI-compatible
 * adapter for actual HTTP calls.
 *
 * - Supports JSON Schema mode when ModelProfile.supportsJsonSchema is true
 * - Falls back to JSON output instructions in prompt when not supported
 * - Extracts and validates JSON from model responses
 * - Allows one format-repair retry
 * - Records token usage and latency
 * - NEVER logs secrets, raw prompts, or raw responses
 */

import { buildAuthHeaders } from "./auth-headers.ts";
import { validateBaseUrl, SSRF_DEFAULTS } from "./ssrf-guard.ts";
import type { ModelAuthMode } from "./auth-headers.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface StructuredGenerationConfig {
  baseUrl: string;
  authMode: ModelAuthMode;
  secrets?: {
    token?: string;
    apiKeyHeaderName?: string;
    username?: string;
    password?: string;
    customHeaders?: Array<{ name: string; value: string; sensitive?: boolean }>;
  };
  modelId: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
  supportsJsonSchema?: boolean;
}

export interface StructuredGenerationRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** Optional JSON Schema for structured output mode */
  jsonSchema?: Record<string, unknown>;
  /** Max characters in the output */
  maxOutputChars?: number;
}

export interface StructuredGenerationResult {
  success: boolean;
  /** Parsed JSON response, if successful */
  output: unknown;
  /** Token usage stats */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  latencyMs: number;
  modelCalled: string;
  /** Safe error code if failed */
  errorCode?: string;
  errorMessage?: string;
  /** Whether a format repair was attempted */
  hadFormatRepair: boolean;
  /** Whether JSON Schema mode was used */
  usedJsonSchema: boolean;
}

const MAX_REPAIR_CALLS = 1;
const MAX_OUTPUT_TOKENS_DEFAULT = 4096;

// ---------------------------------------------------------------------------
// Main structured generation function
// ---------------------------------------------------------------------------

export async function generateStructured(
  config: StructuredGenerationConfig,
  request: StructuredGenerationRequest,
): Promise<StructuredGenerationResult> {
  const startTime = Date.now();

  // 1. SSRF validation
  const ssrfResult = validateBaseUrl(config.baseUrl);
  if (!ssrfResult.allowed) {
    return {
      success: false,
      output: null,
      usage: null,
      latencyMs: Date.now() - startTime,
      modelCalled: config.modelId,
      errorCode: "SSRF_BLOCKED",
      errorMessage: "网络地址安全校验未通过",
      hadFormatRepair: false,
      usedJsonSchema: false,
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
      output: null,
      usage: null,
      latencyMs: Date.now() - startTime,
      modelCalled: config.modelId,
      errorCode: "AUTH_ERROR",
      errorMessage: "鉴权配置错误",
      hadFormatRepair: false,
      usedJsonSchema: false,
    };
  }

  const endpoint = resolveEndpoint(ssrfResult.normalizedUrl);
  const timeoutMs = Math.min(config.timeoutMs ?? 60000, 120000);

  // 3. First call
  let result = await makeStructuredCall(
    endpoint,
    authResult.headers,
    config,
    request,
    timeoutMs,
    startTime,
  );

  // 4. If first call failed to produce valid JSON, attempt ONE repair call
  if (!result.success && result.errorCode === "INVALID_JSON" && request.jsonSchema) {
    const repairRequest: StructuredGenerationRequest = {
      messages: [
        ...request.messages,
        {
          role: "assistant",
          content: "[Previous attempt had invalid JSON format — retrying]",
        },
        {
          role: "user",
          content:
            "Your previous response was not valid JSON. You MUST output ONLY a valid JSON object. " +
            "No markdown fences, no extra text. Follow the schema exactly. Do not apologize or explain — just the JSON.",
        },
      ],
      jsonSchema: request.jsonSchema,
      maxOutputChars: request.maxOutputChars,
    };

    const repairResult = await makeStructuredCall(
      endpoint,
      authResult.headers,
      config,
      repairRequest,
      timeoutMs,
      startTime,
    );

    // Combine usage from both calls
    if (repairResult.usage && result.usage) {
      repairResult.usage = {
        promptTokens: result.usage.promptTokens + repairResult.usage.promptTokens,
        completionTokens: result.usage.completionTokens + repairResult.usage.completionTokens,
        totalTokens: result.usage.totalTokens + repairResult.usage.totalTokens,
      };
    }

    repairResult.hadFormatRepair = true;
    return repairResult;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Single structured call
// ---------------------------------------------------------------------------

async function makeStructuredCall(
  endpoint: string,
  authHeaders: Record<string, string>,
  config: StructuredGenerationConfig,
  request: StructuredGenerationRequest,
  timeoutMs: number,
  startTime: number,
): Promise<StructuredGenerationResult> {
  const body: Record<string, unknown> = {
    model: config.modelId,
    messages: request.messages,
    temperature: config.temperature ?? 0.1,
  };

  // Set max_tokens
  const maxTokens = request.maxOutputChars
    ? Math.ceil(request.maxOutputChars * 0.6) // ~0.6 tokens per char for non-English
    : MAX_OUTPUT_TOKENS_DEFAULT;
  body.max_tokens = maxTokens;

  // JSON Schema mode — only set response_format when the provider explicitly supports it.
  // Many providers (Spark, older models) don't support json_schema or json_object;
  // for those we rely purely on prompt instructions + post-hoc JSON extraction.
  const usedJsonSchema = Boolean(config.supportsJsonSchema && request.jsonSchema);
  if (usedJsonSchema && request.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "code_analysis_report",
        strict: true,
        schema: request.jsonSchema,
      },
    };
  }
  // When supportsJsonSchema is false: do NOT set any response_format.
  // The prompt already instructs the model to output structured JSON.

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;

    // Handle HTTP errors
    if (!response.ok) {
      const errorCode = mapHttpStatusToCode(response.status);
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode,
        errorMessage: getSafeHttpErrorMessage(response.status),
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    // Parse response
    let responseText: string;
    try {
      responseText = await response.text();
    } catch {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "EMPTY_RESPONSE",
        errorMessage: "无法读取模型响应",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    // Check response size
    if (responseText.length > SSRF_DEFAULTS.maxResponseSize) {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "OUTPUT_TRUNCATED",
        errorMessage: "模型响应超过大小限制",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    // Parse JSON from HTTP response
    let parsedHttp: Record<string, unknown>;
    try {
      parsedHttp = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "INVALID_RESPONSE",
        errorMessage: "模型返回格式异常",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    // Extract content from choices
    const choices = Array.isArray(parsedHttp.choices) ? parsedHttp.choices : [];
    if (choices.length === 0) {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "NO_CHOICES",
        errorMessage: "模型未返回有效选择",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    const content = typeof message?.content === "string" ? message.content : "";

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "EMPTY_OUTPUT",
        errorMessage: "模型返回空内容",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    // Parse the actual report JSON from the content
    let reportJson: unknown;
    try {
      reportJson = JSON.parse(content.trim());
    } catch {
      // Try extracting JSON from markdown or mixed text
      const extracted = extractJsonFromContent(content);
      if (extracted) {
        try {
          reportJson = JSON.parse(extracted);
        } catch {
          return {
            success: false,
            output: null,
            usage: getUsageFromResponse(parsedHttp),
            latencyMs,
            modelCalled: config.modelId,
            errorCode: "INVALID_JSON",
            errorMessage: "无法解析模型返回的 JSON",
            hadFormatRepair: false,
            usedJsonSchema,
          };
        }
      } else {
        return {
          success: false,
          output: null,
          usage: getUsageFromResponse(parsedHttp),
          latencyMs,
          modelCalled: config.modelId,
          errorCode: "INVALID_JSON",
          errorMessage: "模型未返回有效 JSON",
          hadFormatRepair: false,
          usedJsonSchema,
        };
      }
    }

    // Check if output was truncated (finish_reason === "length")
    const finishReason = firstChoice?.finish_reason;
    if (finishReason === "length") {
      return {
        success: false,
        output: reportJson,
        usage: getUsageFromResponse(parsedHttp),
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "OUTPUT_TRUNCATED",
        errorMessage: "模型输出被截断，请尝试减少代码长度",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    return {
      success: true,
      output: reportJson,
      usage: getUsageFromResponse(parsedHttp),
      latencyMs,
      modelCalled: typeof parsedHttp.model === "string" ? parsedHttp.model : config.modelId,
      hadFormatRepair: false,
      usedJsonSchema,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;

    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        output: null,
        usage: null,
        latencyMs,
        modelCalled: config.modelId,
        errorCode: "TIMEOUT",
        errorMessage: "模型调用超时",
        hadFormatRepair: false,
        usedJsonSchema,
      };
    }

    return {
      success: false,
      output: null,
      usage: null,
      latencyMs,
      modelCalled: config.modelId,
      errorCode: "NETWORK_ERROR",
      errorMessage: "网络连接失败",
      hadFormatRepair: false,
      usedJsonSchema,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEndpoint(baseUrl: string): string {
  const url = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (url.endsWith("/chat/completions")) return url;
  return `${url}/chat/completions`;
}

function mapHttpStatusToCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return `HTTP_${status}`;
}

function getSafeHttpErrorMessage(status: number): string {
  if (status === 401) return "模型鉴权失败，请检查凭据";
  if (status === 403) return "模型访问被拒绝";
  if (status === 404) return "模型端点未找到";
  if (status === 429) return "请求过于频繁，请稍后重试";
  if (status >= 500) return "模型服务暂时不可用";
  return `请求失败 (${status})`;
}

function getUsageFromResponse(parsed: Record<string, unknown>): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null {
  const usage = parsed.usage as Record<string, number> | undefined;
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

function extractJsonFromContent(text: string): string | null {
  const trimmed = text.trim();

  // Try markdown code fence extraction
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith("{")) return inner;
  }

  // Try finding the outermost { ... } pair
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}
