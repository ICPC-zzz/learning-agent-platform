/**
 * Reader QA Provider Selection — selects the appropriate LLM provider for Reader
 * chapter Q&A based on guard evaluation, dev-only config, and runtime context.
 *
 * All paths are testable via injectable `customFetch` — no real network calls
 * are made during automated tests.
 *
 * Designation: 开发预览 · dev-only · mock 默认 · external LLM 默认关闭
 *
 * @module reader-qa-provider-selection
 * @previewOnly
 */

import type { LlmProvider } from "../../../../../packages/ai-core/src/llm/llm-provider-contract.ts";
import type { ReaderAiQaGuardResult } from "./reader-ai-qa-guard";
import type {
  ExternalProviderConfig,
  ExternalProviderFetch,
} from "../../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The provider mode after selection and any fallback logic.
 *
 * - "mock" — mock provider used (default, or guard allows mock only)
 * - "external-dev-preview" — external dev provider successfully selected
 * - "blocked" — all LLM calls blocked (guard blocks everything)
 * - "fallback" — external was available but failed, fell back to mock
 */
export type ReaderQaProviderMode =
  | "mock"
  | "external-dev-preview"
  | "blocked"
  | "fallback";

export interface ReaderQaProviderSelectionInput {
  guardResult: ReaderAiQaGuardResult;
  externalConfig?: ExternalProviderConfig;
  customFetch?: ExternalProviderFetch;
}

export interface ReaderQaProviderSelectionResult {
  provider: LlmProvider | null;
  providerMode: ReaderQaProviderMode;
  llmUsed: boolean;
  externalProviderUsed: boolean;
  writesDatabase: false;
  rawPromptStored: false;
  rawResponseStored: false;
  productionReady: false;
  safeToExposeToClient: true;
  fallbackReason?: string;
  selectionLabel: string;
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

export async function selectReaderQaProvider(
  input: ReaderQaProviderSelectionInput,
): Promise<ReaderQaProviderSelectionResult> {
  const { guardResult, externalConfig, customFetch } = input;

  // Case 1: Guard blocks everything -> no provider
  if (!guardResult.allowed) {
    return createBlocked("blocked (Guard blocks all LLM calls)");
  }

  // Case 2: Guard allows mock only -> return mock
  if (guardResult.mode === "mock_only") {
    const { mockLlmProvider } = await importMockProvider();
    return createSelection(mockLlmProvider, "mock", false, false,
      "mock (dev preview, default mock provider)");
  }

  // Case 3: Guard allows external dev -> try to construct external provider
  if (guardResult.mode === "external_dev") {
    // Config missing -> fallback to mock
    if (!externalConfig || !externalConfig.configured) {
      const reason = externalConfig?.blockedReason ?? "external provider config missing";
      const { mockLlmProvider } = await importMockProvider();
      return createSelection(mockLlmProvider, "fallback", false, false,
        "fallback (external provider config incomplete, fallback to mock)", reason);
    }

    // Try to construct external provider
    try {
      const { ExternalChatCompletionsProvider } = await importExternalProvider();
      const provider = new ExternalChatCompletionsProvider(externalConfig, customFetch);
      return createSelection(provider, "external-dev-preview", true, true,
        "external-dev-preview (dev preview, external LLM provider)");
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "external provider construction failed";
      const { mockLlmProvider } = await importMockProvider();
      return createSelection(mockLlmProvider, "fallback", false, false,
        "fallback (external provider construction failed, fallback to mock)", reason);
    }
  }

  // Unknown guard mode -> fallback
  const { mockLlmProvider } = await importMockProvider();
  return createSelection(mockLlmProvider, "fallback", false, false,
    "fallback (unknown guard mode, fallback to mock)",
    "unknown guard mode: " + guardResult.mode);
}

// ---------------------------------------------------------------------------
// Dynamic import helpers (isolated for testability)
// ---------------------------------------------------------------------------

async function importMockProvider(): Promise<{ mockLlmProvider: LlmProvider }> {
  return await import(
    "../../../../../packages/ai-core/src/llm/mock-llm-provider.ts"
  );
}

async function importExternalProvider(): Promise<{
  ExternalChatCompletionsProvider: new (
    config: ExternalProviderConfig,
    customFetch?: ExternalProviderFetch,
  ) => LlmProvider;
}> {
  return await import(
    "../../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts"
  );
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function createBlocked(label: string): ReaderQaProviderSelectionResult {
  return {
    provider: null,
    providerMode: "blocked",
    llmUsed: false,
    externalProviderUsed: false,
    writesDatabase: false,
    rawPromptStored: false,
    rawResponseStored: false,
    productionReady: false,
    safeToExposeToClient: true,
    selectionLabel: label,
  };
}

function createSelection(
  provider: LlmProvider,
  mode: ReaderQaProviderMode,
  llmUsed: boolean,
  externalUsed: boolean,
  label: string,
  fallbackReason?: string,
): ReaderQaProviderSelectionResult {
  return {
    provider,
    providerMode: mode,
    llmUsed,
    externalProviderUsed: externalUsed,
    writesDatabase: false,
    rawPromptStored: false,
    rawResponseStored: false,
    productionReady: false,
    safeToExposeToClient: true,
    fallbackReason,
    selectionLabel: label,
  };
}
