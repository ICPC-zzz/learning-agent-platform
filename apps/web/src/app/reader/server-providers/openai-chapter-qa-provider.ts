import "server-only";

import type {
  ChapterQaAnswer,
  ChapterQaContextField,
  ChapterQaProvider,
  ChapterQaProviderErrorCategory,
  ChapterQaProviderRequest,
  ChapterQaProviderRuntimeStatus,
} from "@learning-agent-platform/ai-core";
import {
  createChapterQaAnswerContextSummary,
  createChapterQaAnswerMetadata,
} from "@learning-agent-platform/ai-core";

import { buildOpenAiChapterQaPrompt } from "./openai-chapter-qa-prompt";
import {
  OpenAiChapterQaProviderError,
  type OpenAiChapterQaMessage,
  type OpenAiChapterQaProviderConfig,
} from "./openai-chapter-qa-types";

const usedContextFields: readonly ChapterQaContextField[] = [
  "bookTitle",
  "chapterTitle",
  "currentChunkText",
  "visibleTextExcerpt",
  "nearbyChunks",
  "currentChunkIndex",
  "totalChunks",
  "readingProgressPercent",
  "readingProgressSummary",
  "abilityProfileSummary",
  "userQuestion",
];

interface OpenAiChatCompletionRequestBody {
  model: string;
  messages: readonly OpenAiChapterQaMessage[];
  temperature: number;
  stream: false;
}

interface CreateOpenAiChapterQaProviderInput {
  config: OpenAiChapterQaProviderConfig;
}

type ReadOpenAiAnswerTextResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      category: Extract<
        ChapterQaProviderErrorCategory,
        "empty_answer" | "invalid_provider_response"
      >;
    };

export class OpenAiChapterQaProvider implements ChapterQaProvider {
  readonly status: ChapterQaProviderRuntimeStatus;

  private readonly config: OpenAiChapterQaProviderConfig;

  constructor({ config }: CreateOpenAiChapterQaProviderInput) {
    this.config = config;
    this.status = config.status;
  }

  async answerQuestion(
    request: ChapterQaProviderRequest,
  ): Promise<ChapterQaAnswer> {
    const prompt = buildOpenAiChapterQaPrompt(request);
    const content = await requestOpenAiAnswerText({
      config: this.config,
      messages: prompt.messages,
    });
    const providerStatus = createOpenAiChapterQaProviderSuccessStatus(
      this.status,
    );
    const usedChunkIndexes = resolveUsedChunkIndexes(request);
    const contextSummary = createChapterQaAnswerContextSummary(
      request.context,
      usedChunkIndexes,
    );

    return {
      content,
      providerStatus,
      usedContextFields,
      usedChunkIndexes,
      contextSummary,
      metadata: createChapterQaAnswerMetadata({
        answerSource: "real_openai",
        providerStatus,
        contextSummary,
        usedChunkIndexes,
      }),
      limitations: [
        "OpenAI-compatible provider only: non-streaming Chapter Q&A.",
        "Context is limited to the current reader context and nearby chunks.",
        "No conversation history, tool calls, RAG, embeddings, or answer persistence were used.",
      ],
    };
  }
}

export function createOpenAiChapterQaProvider(
  config: OpenAiChapterQaProviderConfig,
): OpenAiChapterQaProvider {
  return new OpenAiChapterQaProvider({ config });
}

export function createOpenAiChapterQaProviderErrorStatus(
  status: ChapterQaProviderRuntimeStatus,
  networkAttempted: boolean,
): ChapterQaProviderRuntimeStatus {
  return {
    ...status,
    network: networkAttempted ? "used" : "not_used",
    networkUsed: networkAttempted,
    runtimeStatus: "provider_error",
    status: "provider_error",
  };
}

function createOpenAiChapterQaProviderSuccessStatus(
  status: ChapterQaProviderRuntimeStatus,
): ChapterQaProviderRuntimeStatus {
  return {
    ...status,
    provider: "openai",
    providerId: "openai",
    activeProviderId: "openai",
    providerKind: "real",
    resolvedProviderMode: "openai",
    realAi: "enabled",
    realAiEnabled: true,
    network: "used",
    networkEnabled: true,
    networkAllowed: true,
    networkUsed: true,
    canUseRealProvider: true,
    runtimeStatus: "available",
    status: "available",
    disabledReason: null,
  };
}

async function requestOpenAiAnswerText({
  config,
  messages,
}: {
  config: OpenAiChapterQaProviderConfig;
  messages: readonly OpenAiChapterQaMessage[];
}): Promise<string> {
  const endpoint = createChatCompletionsUrl(config.baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  const body: OpenAiChatCompletionRequestBody = {
    model: config.model,
    messages,
    temperature: 0.2,
    stream: false,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OpenAiChapterQaProviderError("provider_http_error", true);
    }

    let responseBody: unknown;

    try {
      responseBody = await response.json();
    } catch {
      throw new OpenAiChapterQaProviderError(
        "invalid_provider_response",
        true,
      );
    }

    const answerText = readFirstAssistantText(responseBody);

    if (!answerText.ok) {
      throw new OpenAiChapterQaProviderError(answerText.category, true);
    }

    return answerText.text;
  } catch (error) {
    if (error instanceof OpenAiChapterQaProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new OpenAiChapterQaProviderError("timeout", true);
    }

    if (error instanceof TypeError) {
      throw new OpenAiChapterQaProviderError("network_error", true);
    }

    throw new OpenAiChapterQaProviderError("unknown_provider_error", true);
  } finally {
    clearTimeout(timeoutId);
  }
}

function createChatCompletionsUrl(baseUrl: string): string {
  try {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    return new URL("chat/completions", normalizedBaseUrl).toString();
  } catch {
    throw new OpenAiChapterQaProviderError("provider_unavailable", false);
  }
}

function readFirstAssistantText(
  responseBody: unknown,
): ReadOpenAiAnswerTextResult {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.choices)) {
    return { ok: false, category: "invalid_provider_response" };
  }

  let sawEmptyText = false;

  for (const choice of responseBody.choices) {
    if (!isRecord(choice) || !isRecord(choice.message)) {
      continue;
    }

    const content = choice.message.content;

    if (typeof content === "string" && content.trim().length > 0) {
      return { ok: true, text: content.trim() };
    }

    if (typeof content === "string") {
      sawEmptyText = true;
    }
  }

  return {
    ok: false,
    category: sawEmptyText ? "empty_answer" : "invalid_provider_response",
  };
}

function resolveUsedChunkIndexes(
  request: ChapterQaProviderRequest,
): readonly number[] {
  const nearbyChunkIndexes = request.context.nearbyChunks.map(
    (chunk) => chunk.orderIndex,
  );

  if (nearbyChunkIndexes.length > 0) {
    return nearbyChunkIndexes;
  }

  return [request.context.currentChunkIndex];
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
