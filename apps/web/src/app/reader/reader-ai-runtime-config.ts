import "server-only";

import { resolveChapterQaProviderRuntimeConfig } from "@learning-agent-platform/ai-core";
import type { ChapterQaProviderRuntimeConfig } from "@learning-agent-platform/ai-core";

export function getReaderAiRuntimeConfig(): ChapterQaProviderRuntimeConfig {
  return resolveChapterQaProviderRuntimeConfig({
    // A151 keeps reader Ask AI preview-only even if provider env vars exist.
    requestedProviderMode: "mock",
    networkEnabled: false,
    hasOpenAiApiKey: false,
    hasOpenAiModel: false,
    hasAnthropicApiKey: false,
    fallbackToMockEnabled: isFallbackToMockEnabled(
      process.env.AI_PROVIDER_FALLBACK_TO_MOCK,
    ),
  });
}

function isFallbackToMockEnabled(value: string | undefined): boolean {
  if (typeof value !== "string") {
    return true;
  }

  return value.trim().toLowerCase() !== "false";
}
