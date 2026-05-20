import "server-only";

import { resolveChapterQaProviderRuntimeConfig } from "@learning-agent-platform/ai-core";
import type { ChapterQaProviderRuntimeConfig } from "@learning-agent-platform/ai-core";

export function getReaderAiRuntimeConfig(): ChapterQaProviderRuntimeConfig {
  return resolveChapterQaProviderRuntimeConfig({
    requestedProviderMode: process.env.AI_PROVIDER_MODE,
    networkEnabled: isEnabled(process.env.AI_PROVIDER_NETWORK_ENABLED),
    hasOpenAiApiKey: hasConfiguredSecret(process.env.OPENAI_API_KEY),
    hasOpenAiModel: hasConfiguredValue(process.env.OPENAI_MODEL),
    hasAnthropicApiKey: hasConfiguredSecret(process.env.ANTHROPIC_API_KEY),
    fallbackToMockEnabled: isFallbackToMockEnabled(
      process.env.AI_PROVIDER_FALLBACK_TO_MOCK,
    ),
  });
}

function hasConfiguredSecret(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasConfiguredValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnabled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function isFallbackToMockEnabled(value: string | undefined): boolean {
  if (typeof value !== "string") {
    return true;
  }

  return value.trim().toLowerCase() !== "false";
}
