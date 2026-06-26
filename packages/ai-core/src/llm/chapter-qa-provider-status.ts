import type { ChapterQaContext } from "./chapter-qa-context";

export type ChapterQaProviderMode =
  | "mock"
  | "real"
  | "openai"
  | "anthropic"
  | "local";

export type ChapterQaProviderId =
  | "mock_server"
  | "real"
  | "openai"
  | "anthropic"
  | "local"
  | "unsupported";

export type ChapterQaProviderName = ChapterQaProviderId;
export type ChapterQaProviderKind = "mock" | "real" | "local" | "unsupported";
export type ChapterQaProviderSelectionSource = "provider_selector";
export type ChapterQaProviderTransport = "server_action";
export type ChapterQaRealAiStatus = "enabled" | "disabled";
export type ChapterQaProviderNetworkStatus = "used" | "not_used";
export type AiProviderSecretStatus = "present" | "missing" | "not_required";
export type AiProviderModelStatus = "configured" | "missing" | "not_required";
export type AiProviderRuntimeStatus =
  | "available"
  | "not_configured"
  | "not_implemented"
  | "disabled"
  | "provider_error";
export type ChapterQaProviderRuntimeStatusValue =
  | "available"
  | "disabled"
  | "not_configured"
  | "not_implemented"
  | "provider_error"
  | "unsupported";
export type ChapterQaProviderDisabledReason =
  | "not_configured"
  | "not_implemented"
  | "safety_boundary"
  | "unsupported"
  | "network_disabled"
  | "missing_api_key"
  | "missing_model"
  | "provider_not_implemented"
  | "unsupported_provider";

export interface ChapterQaProviderRuntimeStatus {
  provider: ChapterQaProviderId;
  providerId: ChapterQaProviderId;
  activeProviderId: ChapterQaProviderId | null;
  providerLabel: string;
  providerKind: ChapterQaProviderKind;
  requestedProviderMode: string;
  resolvedProviderMode: ChapterQaProviderMode;
  selection: ChapterQaProviderSelectionSource;
  transport: ChapterQaProviderTransport;
  realAi: ChapterQaRealAiStatus;
  realAiEnabled: boolean;
  network: ChapterQaProviderNetworkStatus;
  networkEnabled: boolean;
  networkAllowed: boolean;
  networkUsed: boolean;
  secretStatus: AiProviderSecretStatus;
  modelStatus: AiProviderModelStatus;
  canUseRealProvider: boolean;
  fallbackToMockEnabled: boolean;
  runtimeStatus: AiProviderRuntimeStatus;
  status: ChapterQaProviderRuntimeStatusValue;
  disabledReason: ChapterQaProviderDisabledReason | null;
  contextSource: ChapterQaContext["contextSource"];
}

export type ChapterQaProviderStatus = ChapterQaProviderRuntimeStatus;

export const chapterQaProviderModes: readonly ChapterQaProviderMode[] = [
  "mock",
  "real",
  "openai",
  "anthropic",
  "local",
];

export const mockChapterQaProviderStatus: ChapterQaProviderRuntimeStatus = {
  provider: "mock_server",
  providerId: "mock_server",
  activeProviderId: "mock_server",
  providerLabel: "Mock server Chapter Q&A provider",
  providerKind: "mock",
  requestedProviderMode: "mock",
  resolvedProviderMode: "mock",
  selection: "provider_selector",
  transport: "server_action",
  realAi: "disabled",
  realAiEnabled: false,
  network: "not_used",
  networkEnabled: false,
  networkAllowed: false,
  networkUsed: false,
  secretStatus: "not_required",
  modelStatus: "not_required",
  canUseRealProvider: false,
  fallbackToMockEnabled: true,
  runtimeStatus: "available",
  status: "available",
  disabledReason: "safety_boundary",
  contextSource: "current_reader_context",
};

export function isChapterQaProviderMode(
  value: unknown,
): value is ChapterQaProviderMode {
  return (
    typeof value === "string" &&
    chapterQaProviderModes.some((mode) => mode === value)
  );
}
