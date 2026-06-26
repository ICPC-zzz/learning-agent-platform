import type { ChapterQaProvider } from "./chapter-qa-provider";
import {
  resolveChapterQaProviderRuntimeConfig,
  type ChapterQaProviderRuntimeConfig,
} from "./ai-provider-config";
import type {
  ChapterQaProviderMode,
  ChapterQaProviderRuntimeStatus,
} from "./chapter-qa-provider-status";
import { mockChapterQaProvider } from "./mock-chapter-qa-provider";

export interface SelectChapterQaProviderInput {
  mode?: unknown;
  runtimeConfig?: ChapterQaProviderRuntimeConfig;
  hasOpenAiApiKey?: boolean;
  hasAnthropicApiKey?: boolean;
}

export interface ChapterQaProviderSelection {
  mode: ChapterQaProviderMode | "unsupported";
  provider: ChapterQaProvider | null;
  status: ChapterQaProviderRuntimeStatus;
}

export function selectChapterQaProvider(
  input: SelectChapterQaProviderInput = {},
): ChapterQaProviderSelection {
  const status =
    input.runtimeConfig ??
    resolveChapterQaProviderRuntimeConfig({
      requestedProviderMode: readRequestedProviderMode(input.mode),
      hasOpenAiApiKey: input.hasOpenAiApiKey,
      hasAnthropicApiKey: input.hasAnthropicApiKey,
    });

  if (
    status.resolvedProviderMode === "mock" &&
    status.runtimeStatus === "available"
  ) {
    return {
      mode: "mock",
      provider: mockChapterQaProvider,
      status,
    };
  }

  return {
    mode: status.resolvedProviderMode,
    provider: null,
    status,
  };
}

function readRequestedProviderMode(value: unknown): string {
  if (value === undefined || value === null) {
    return "mock";
  }

  if (typeof value !== "string") {
    return "unsupported";
  }

  const normalized = value.trim();

  return normalized.length === 0 ? "mock" : normalized;
}
