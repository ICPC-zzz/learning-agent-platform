"use server";

import {
  createChapterQaAnswerMetadata,
  mockChapterQaProvider,
  mockChapterQaProviderStatus,
  selectChapterQaProvider,
} from "@learning-agent-platform/ai-core";
import type {
  ChapterQaAnswer,
  ChapterQaAnswerSource,
  ChapterQaFallbackReason,
  ChapterQaProviderErrorCategory,
  ChapterQaProviderRuntimeStatus,
} from "@learning-agent-platform/ai-core";

import {
  type AskChapterQuestionActionInput,
  type AskChapterQuestionActionFailure,
  type AskChapterQuestionActionResult,
} from "./reader-qa-action-types";
import { getReaderAiRuntimeConfig } from "./reader-ai-runtime-config";
import { saveReaderQaHistoryBestEffort } from "./reader-qa-history-save";
import {
  createSkippedNoAnswerHistorySaveResult,
  type ReaderQaReaderIdentity,
} from "./reader-qa-history-save-types";
import { validateAskChapterQuestionActionInput } from "./reader-qa-validation";
import { getOpenAiChapterQaProviderConfig } from "./server-providers/openai-chapter-qa-config";
import {
  createOpenAiChapterQaProvider,
  createOpenAiChapterQaProviderErrorStatus,
} from "./server-providers/openai-chapter-qa-provider";
import { OpenAiChapterQaProviderError } from "./server-providers/openai-chapter-qa-types";

export async function askChapterQuestionAction(
  input: AskChapterQuestionActionInput,
): Promise<AskChapterQuestionActionResult> {
  const runtimeConfig = getReaderAiRuntimeConfig();
  const validation = validateAskChapterQuestionActionInput(input);

  if (!validation.ok) {
    return {
      ok: false,
      status: "validation_error",
      message: validation.message,
      fieldErrors: validation.issues,
      providerStatus: runtimeConfig,
      fallbackUsed: false,
      fallbackReason: null,
      errorCategory: null,
      historySaveResult: createSkippedNoAnswerHistorySaveResult(),
    };
  }

  if (runtimeConfig.resolvedProviderMode === "openai") {
    return answerWithOpenAiProvider({
      runtimeConfig,
      question: validation.input.question,
      context: validation.input.context,
      readerIdentity: validation.input.readerIdentity,
    });
  }

  const providerSelection = selectChapterQaProvider({
    runtimeConfig,
  });

  if (providerSelection.provider === null) {
    return {
      ok: false,
      status: getUnavailableActionStatus(providerSelection.status),
      message: createProviderUnavailableMessage(providerSelection.status),
      providerStatus: providerSelection.status,
      fallbackUsed: false,
      fallbackReason: null,
      errorCategory: "provider_unavailable",
      historySaveResult: createSkippedNoAnswerHistorySaveResult(),
    };
  }

  if (typeof providerSelection.provider.answerQuestion !== "function") {
    return {
      ok: false,
      status: getUnavailableActionStatus(providerSelection.status),
      message: createProviderUnavailableMessage(providerSelection.status),
      providerStatus: providerSelection.status,
      fallbackUsed: false,
      fallbackReason: null,
      errorCategory: "provider_unavailable",
      historySaveResult: createSkippedNoAnswerHistorySaveResult(),
    };
  }

  try {
    const answer = await providerSelection.provider.answerQuestion({
      question: { text: validation.input.question },
      context: validation.input.context,
    });
    const answerWithRuntimeStatus = createAnswerWithMetadata({
      answer,
      providerStatus: providerSelection.status,
      answerSource: "mock",
    });

    return createSuccessActionResult({
      answer: answerWithRuntimeStatus,
      providerStatus: providerSelection.status,
      question: validation.input.question,
      readerIdentity: validation.input.readerIdentity,
    });
  } catch {
    return {
      ok: false,
      status: "provider_error",
      message:
        "模拟问答提供方未能返回回答；未调用真实模型。",
      providerStatus: providerSelection.status,
      fallbackUsed: false,
      fallbackReason: null,
      errorCategory: "unknown_provider_error",
      historySaveResult: createSkippedNoAnswerHistorySaveResult(),
    };
  }
}

async function answerWithOpenAiProvider({
  runtimeConfig,
  question,
  context,
  readerIdentity,
}: {
  runtimeConfig: ChapterQaProviderRuntimeStatus;
  question: string;
  context: AskChapterQuestionActionInput["context"];
  readerIdentity: ReaderQaReaderIdentity;
}): Promise<AskChapterQuestionActionResult> {
  if (!runtimeConfig.canUseRealProvider) {
    return handleProviderUnavailable({
      runtimeConfig,
      question,
      context,
      readerIdentity,
    });
  }

  const providerConfig = getOpenAiChapterQaProviderConfig(runtimeConfig);

  if (providerConfig === null) {
    return handleProviderUnavailable({
      runtimeConfig: {
        ...runtimeConfig,
        runtimeStatus: "not_configured",
        status: "not_configured",
        disabledReason: "not_configured",
        canUseRealProvider: false,
        network: "not_used",
        networkUsed: false,
      },
      question,
      context,
      readerIdentity,
    });
  }

  const provider = createOpenAiChapterQaProvider(providerConfig);

  try {
    const answer = await provider.answerQuestion({
      question: { text: question },
      context,
    });

    return createSuccessActionResult({
      answer,
      providerStatus: answer.providerStatus,
      question,
      readerIdentity,
    });
  } catch (error) {
    const providerError = normalizeOpenAiProviderError(error);
    const providerStatus = createOpenAiChapterQaProviderErrorStatus(
      runtimeConfig,
      providerError.networkAttempted,
    );

    if (runtimeConfig.fallbackToMockEnabled) {
      return answerWithMockFallback({
        attemptedProviderStatus: providerStatus,
        question,
        context,
        readerIdentity,
        fallbackReason: providerError.category,
      });
    }

    return createProviderErrorFailure({
      providerStatus,
      errorCategory: providerError.category,
      message:
        "真实模型提供方未能返回回答；reader 预览不应依赖真实模型。",
    });
  }
}

async function handleProviderUnavailable({
  runtimeConfig,
  question,
  context,
  readerIdentity,
}: {
  runtimeConfig: ChapterQaProviderRuntimeStatus;
  question: string;
  context: AskChapterQuestionActionInput["context"];
  readerIdentity: ReaderQaReaderIdentity;
}): Promise<AskChapterQuestionActionResult> {
  if (runtimeConfig.fallbackToMockEnabled) {
    return answerWithMockFallback({
      attemptedProviderStatus: {
        ...runtimeConfig,
        network: "not_used",
        networkUsed: false,
      },
      question,
      context,
      readerIdentity,
      fallbackReason: "provider_unavailable",
    });
  }

  return createProviderUnavailableFailure({
    providerStatus: runtimeConfig,
    message: createProviderUnavailableMessage(runtimeConfig),
  });
}

async function answerWithMockFallback({
  attemptedProviderStatus,
  question,
  context,
  readerIdentity,
  fallbackReason,
}: {
  attemptedProviderStatus: ChapterQaProviderRuntimeStatus;
  question: string;
  context: AskChapterQuestionActionInput["context"];
  readerIdentity: ReaderQaReaderIdentity;
  fallbackReason: ChapterQaFallbackReason;
}): Promise<AskChapterQuestionActionResult> {
  const fallbackStatus = createFallbackMockProviderStatus(
    attemptedProviderStatus,
  );

  try {
    const mockAnswer = await mockChapterQaProvider.answerQuestion({
      question: { text: question },
      context,
    });
    const fallbackAnswer = createAnswerWithMetadata({
      answer: {
        ...mockAnswer,
        content: createFallbackMockContent(mockAnswer.content, fallbackReason),
      },
      providerStatus: fallbackStatus,
      answerSource: "fallback_mock",
      fallbackUsed: true,
      fallbackReason,
      errorCategory: fallbackReason,
      networkUsed: attemptedProviderStatus.networkUsed,
    });

    return createSuccessActionResult({
      answer: fallbackAnswer,
      providerStatus: fallbackStatus,
      question,
      readerIdentity,
    });
  } catch {
    return createProviderErrorFailure({
      providerStatus: fallbackStatus,
      errorCategory: "unknown_provider_error",
      message:
        "Mock fallback failed before it could return a deterministic answer.",
    });
  }
}

async function createSuccessActionResult({
  answer,
  providerStatus,
  question,
  readerIdentity,
}: {
  answer: ChapterQaAnswer;
  providerStatus: ChapterQaProviderRuntimeStatus;
  question: string;
  readerIdentity: ReaderQaReaderIdentity;
}): Promise<AskChapterQuestionActionResult> {
  const historySaveResult = await saveReaderQaHistoryBestEffort({
    readerIdentity,
    question,
    answer,
  });

  return {
    ok: true,
    status: "success",
    answer,
    providerStatus,
    historySaveResult,
  };
}

function createAnswerWithMetadata({
  answer,
  providerStatus,
  answerSource,
  fallbackUsed = false,
  fallbackReason = null,
  errorCategory = null,
  networkUsed,
}: {
  answer: ChapterQaAnswer;
  providerStatus: ChapterQaProviderRuntimeStatus;
  answerSource: ChapterQaAnswerSource;
  fallbackUsed?: boolean;
  fallbackReason?: ChapterQaFallbackReason | null;
  errorCategory?: ChapterQaProviderErrorCategory | null;
  networkUsed?: boolean;
}): ChapterQaAnswer {
  return {
    ...answer,
    providerStatus,
    metadata: createChapterQaAnswerMetadata({
      answerSource,
      providerStatus,
      contextSummary: answer.contextSummary,
      usedChunkIndexes: answer.usedChunkIndexes,
      fallbackUsed,
      fallbackReason,
      errorCategory,
      networkUsed,
    }),
  };
}

function createFallbackMockProviderStatus(
  attemptedProviderStatus: ChapterQaProviderRuntimeStatus,
): ChapterQaProviderRuntimeStatus {
  return {
    ...mockChapterQaProviderStatus,
    provider: "mock_server",
    providerId: "mock_server",
    activeProviderId: "mock_server",
    providerLabel: "Mock fallback Chapter Q&A provider",
    providerKind: "mock",
    requestedProviderMode: attemptedProviderStatus.requestedProviderMode,
    resolvedProviderMode: attemptedProviderStatus.resolvedProviderMode,
    selection: attemptedProviderStatus.selection,
    transport: attemptedProviderStatus.transport,
    realAi: "disabled",
    realAiEnabled: false,
    network: attemptedProviderStatus.networkUsed ? "used" : "not_used",
    networkEnabled: attemptedProviderStatus.networkEnabled,
    networkAllowed: attemptedProviderStatus.networkAllowed,
    networkUsed: attemptedProviderStatus.networkUsed,
    secretStatus: attemptedProviderStatus.secretStatus,
    modelStatus: attemptedProviderStatus.modelStatus,
    canUseRealProvider: false,
    fallbackToMockEnabled: attemptedProviderStatus.fallbackToMockEnabled,
    runtimeStatus: "available",
    status: "available",
    disabledReason: attemptedProviderStatus.disabledReason,
    contextSource: attemptedProviderStatus.contextSource,
  };
}

function createFallbackMockContent(
  mockContent: string,
  fallbackReason: ChapterQaFallbackReason,
): string {
  return [
    `模拟回退说明：请求的真实模型提供方失败，错误分类为 ${fallbackReason}。当前回答来源为 fallback_mock，不会呈现为真实模型回答。`,
    mockContent,
  ].join("\n\n");
}

function createProviderUnavailableFailure({
  providerStatus,
  message,
}: {
  providerStatus: ChapterQaProviderRuntimeStatus;
  message: string;
}): AskChapterQuestionActionFailure {
  return {
    ok: false,
    status: "provider_unavailable",
    message,
    providerStatus,
    fallbackUsed: false,
    fallbackReason: null,
    errorCategory: "provider_unavailable",
    historySaveResult: createSkippedNoAnswerHistorySaveResult(),
  };
}

function createProviderErrorFailure({
  providerStatus,
  errorCategory,
  message,
}: {
  providerStatus: ChapterQaProviderRuntimeStatus;
  errorCategory: ChapterQaProviderErrorCategory;
  message: string;
}): AskChapterQuestionActionFailure {
  return {
    ok: false,
    status: "provider_error",
    message,
    providerStatus,
    fallbackUsed: false,
    fallbackReason: null,
    errorCategory,
    historySaveResult: createSkippedNoAnswerHistorySaveResult(),
  };
}

function normalizeOpenAiProviderError(error: unknown): {
  category: ChapterQaProviderErrorCategory;
  networkAttempted: boolean;
} {
  if (error instanceof OpenAiChapterQaProviderError) {
    return {
      category: error.category,
      networkAttempted: error.networkAttempted,
    };
  }

  return {
    category: "unknown_provider_error",
    networkAttempted: true,
  };
}

function getUnavailableActionStatus(
  status: ChapterQaProviderRuntimeStatus,
): "provider_unavailable" | "not_configured" | "disabled" {
  if (status.runtimeStatus === "not_configured") {
    return "not_configured";
  }

  if (status.runtimeStatus === "disabled") {
    return "disabled";
  }

  return "provider_unavailable";
}

function createProviderUnavailableMessage(
  status: ChapterQaProviderRuntimeStatus,
): string {
  if (status.disabledReason === "network_disabled") {
    return "章节问答真实模型提供方未启用：网络访问未启用。";
  }

  if (status.disabledReason === "missing_api_key") {
    return "章节问答真实模型提供方未启用：缺少 API key。";
  }

  if (status.disabledReason === "missing_model") {
    return "章节问答真实模型提供方未启用：缺少模型配置。";
  }

  return "章节问答提供方处于禁用或不可用状态。";
}
