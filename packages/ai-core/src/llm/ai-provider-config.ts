import type { ChapterQaContext } from "./chapter-qa-context";
import {
  isChapterQaProviderMode,
  type AiProviderModelStatus,
  type AiProviderRuntimeStatus,
  type AiProviderSecretStatus,
  type ChapterQaProviderDisabledReason,
  type ChapterQaProviderId,
  type ChapterQaProviderKind,
  type ChapterQaProviderMode,
  type ChapterQaProviderRuntimeStatus,
} from "./chapter-qa-provider-status";

export interface AiProviderRuntimeConfigInput {
  requestedProviderMode?: string | null;
  networkEnabled?: boolean;
  hasOpenAiApiKey?: boolean;
  hasOpenAiModel?: boolean;
  hasAnthropicApiKey?: boolean;
  fallbackToMockEnabled?: boolean;
}

export type ChapterQaProviderRuntimeConfig = ChapterQaProviderRuntimeStatus;

interface CreateRuntimeConfigInput {
  providerId: ChapterQaProviderId;
  activeProviderId: ChapterQaProviderId | null;
  providerLabel: string;
  providerKind: ChapterQaProviderKind;
  requestedProviderMode: string;
  resolvedProviderMode: ChapterQaProviderMode;
  secretStatus: AiProviderSecretStatus;
  modelStatus: AiProviderModelStatus;
  networkEnabled: boolean;
  runtimeStatus: AiProviderRuntimeStatus;
  disabledReason: ChapterQaProviderDisabledReason | null;
  canUseRealProvider?: boolean;
  realAiEnabled?: boolean;
  networkAllowed?: boolean;
  networkUsed?: boolean;
}

export function resolveChapterQaProviderRuntimeConfig(
  input: AiProviderRuntimeConfigInput = {},
): ChapterQaProviderRuntimeConfig {
  const requestedProviderMode = normalizeRequestedProviderMode(
    input.requestedProviderMode,
  );
  const fallbackToMockEnabled = input.fallbackToMockEnabled !== false;
  const finalize = (
    config: ChapterQaProviderRuntimeConfig,
  ): ChapterQaProviderRuntimeConfig => ({
    ...config,
    fallbackToMockEnabled,
  });

  if (!isChapterQaProviderMode(requestedProviderMode)) {
    return finalize(createRuntimeConfig({
      providerId: "mock_server",
      activeProviderId: "mock_server",
      providerLabel: "Mock server Chapter Q&A provider",
      providerKind: "mock",
      requestedProviderMode,
      resolvedProviderMode: "mock",
      secretStatus: "not_required",
      modelStatus: "not_required",
      networkEnabled: false,
      runtimeStatus: "available",
      disabledReason: "unsupported_provider",
    }));
  }

  if (requestedProviderMode === "mock") {
    return finalize(createRuntimeConfig({
      providerId: "mock_server",
      activeProviderId: "mock_server",
      providerLabel: "Mock server Chapter Q&A provider",
      providerKind: "mock",
      requestedProviderMode,
      resolvedProviderMode: "mock",
      secretStatus: "not_required",
      modelStatus: "not_required",
      networkEnabled: false,
      runtimeStatus: "available",
      disabledReason: "safety_boundary",
    }));
  }

  if (requestedProviderMode === "openai") {
    return finalize(createOpenAiRuntimeConfig({
      requestedProviderMode,
      networkEnabled: input.networkEnabled === true,
      hasOpenAiApiKey: input.hasOpenAiApiKey === true,
      hasOpenAiModel: input.hasOpenAiModel === true,
    }));
  }

  if (requestedProviderMode === "anthropic") {
    return finalize(createSecretBackedUnavailableConfig({
      providerId: "anthropic",
      providerLabel: "Anthropic Chapter Q&A provider",
      providerKind: "real",
      requestedProviderMode,
      hasRequiredSecret: input.hasAnthropicApiKey === true,
    }));
  }

  if (requestedProviderMode === "real") {
    return finalize(createSecretBackedUnavailableConfig({
      providerId: "real",
      providerLabel: "Real AI Chapter Q&A provider",
      providerKind: "real",
      requestedProviderMode,
      hasRequiredSecret:
        input.hasOpenAiApiKey === true || input.hasAnthropicApiKey === true,
    }));
  }

  return finalize(createRuntimeConfig({
    providerId: "local",
    activeProviderId: null,
    providerLabel: "Local Chapter Q&A provider",
    providerKind: "local",
    requestedProviderMode,
    resolvedProviderMode: "local",
    secretStatus: "not_required",
    modelStatus: "not_required",
    networkEnabled: false,
    runtimeStatus: "not_implemented",
    disabledReason: "provider_not_implemented",
  }));
}

function normalizeRequestedProviderMode(value: string | null | undefined): string {
  if (value === undefined || value === null) {
    return "mock";
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length === 0 ? "mock" : normalized;
}

function createOpenAiRuntimeConfig({
  requestedProviderMode,
  networkEnabled,
  hasOpenAiApiKey,
  hasOpenAiModel,
}: {
  requestedProviderMode: Extract<ChapterQaProviderMode, "openai">;
  networkEnabled: boolean;
  hasOpenAiApiKey: boolean;
  hasOpenAiModel: boolean;
}): ChapterQaProviderRuntimeConfig {
  const secretStatus: AiProviderSecretStatus = hasOpenAiApiKey
    ? "present"
    : "missing";
  const modelStatus: AiProviderModelStatus = hasOpenAiModel
    ? "configured"
    : "missing";

  if (!hasOpenAiApiKey) {
    return createRuntimeConfig({
      providerId: "openai",
      activeProviderId: null,
      providerLabel: "OpenAI-compatible Chapter Q&A provider",
      providerKind: "real",
      requestedProviderMode,
      resolvedProviderMode: "openai",
      secretStatus,
      modelStatus,
      networkEnabled,
      networkAllowed: networkEnabled,
      runtimeStatus: "not_configured",
      disabledReason: "missing_api_key",
    });
  }

  if (!hasOpenAiModel) {
    return createRuntimeConfig({
      providerId: "openai",
      activeProviderId: null,
      providerLabel: "OpenAI-compatible Chapter Q&A provider",
      providerKind: "real",
      requestedProviderMode,
      resolvedProviderMode: "openai",
      secretStatus,
      modelStatus,
      networkEnabled,
      networkAllowed: networkEnabled,
      runtimeStatus: "not_configured",
      disabledReason: "missing_model",
    });
  }

  if (!networkEnabled) {
    return createRuntimeConfig({
      providerId: "openai",
      activeProviderId: null,
      providerLabel: "OpenAI-compatible Chapter Q&A provider",
      providerKind: "real",
      requestedProviderMode,
      resolvedProviderMode: "openai",
      secretStatus,
      modelStatus,
      networkEnabled,
      runtimeStatus: "disabled",
      disabledReason: "network_disabled",
    });
  }

  return createRuntimeConfig({
    providerId: "openai",
    activeProviderId: "openai",
    providerLabel: "OpenAI-compatible Chapter Q&A provider",
    providerKind: "real",
    requestedProviderMode,
    resolvedProviderMode: "openai",
    secretStatus,
    modelStatus,
    networkEnabled,
    networkAllowed: true,
    realAiEnabled: true,
    canUseRealProvider: true,
    runtimeStatus: "available",
    disabledReason: null,
  });
}

function createSecretBackedUnavailableConfig({
  providerId,
  providerLabel,
  providerKind,
  requestedProviderMode,
  hasRequiredSecret,
}: {
  providerId: Exclude<ChapterQaProviderId, "mock_server" | "unsupported">;
  providerLabel: string;
  providerKind: Extract<ChapterQaProviderKind, "real">;
  requestedProviderMode: Exclude<ChapterQaProviderMode, "mock" | "local">;
  hasRequiredSecret: boolean;
}): ChapterQaProviderRuntimeConfig {
  return createRuntimeConfig({
    providerId,
    activeProviderId: null,
    providerLabel,
    providerKind,
    requestedProviderMode,
    resolvedProviderMode: requestedProviderMode,
    secretStatus: hasRequiredSecret ? "present" : "missing",
    modelStatus: "not_required",
    networkEnabled: false,
    runtimeStatus: hasRequiredSecret ? "not_implemented" : "not_configured",
    disabledReason: hasRequiredSecret
      ? "provider_not_implemented"
      : "not_configured",
  });
}

function createRuntimeConfig({
  providerId,
  activeProviderId,
  providerLabel,
  providerKind,
  requestedProviderMode,
  resolvedProviderMode,
  secretStatus,
  modelStatus,
  networkEnabled,
  runtimeStatus,
  disabledReason,
  canUseRealProvider = false,
  realAiEnabled = false,
  networkAllowed = false,
  networkUsed = false,
}: CreateRuntimeConfigInput): ChapterQaProviderRuntimeConfig {
  return {
    provider: providerId,
    providerId,
    activeProviderId,
    providerLabel,
    providerKind,
    requestedProviderMode,
    resolvedProviderMode,
    selection: "provider_selector",
    transport: "server_action",
    realAi: realAiEnabled ? "enabled" : "disabled",
    realAiEnabled,
    network: networkUsed ? "used" : "not_used",
    networkEnabled,
    networkAllowed,
    networkUsed,
    fallbackToMockEnabled: true,
    secretStatus,
    modelStatus,
    canUseRealProvider,
    runtimeStatus,
    status: runtimeStatus,
    disabledReason,
    contextSource: "current_reader_context" satisfies ChapterQaContext["contextSource"],
  };
}
