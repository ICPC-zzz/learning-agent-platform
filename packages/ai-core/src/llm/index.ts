export type {
  LlmGenerateOptions,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmMessage,
  LlmMetadata,
  LlmProvider,
  LlmUsage,
} from "./types";
export type {
  BuildChapterQaContextInput,
  ChapterQaContext,
  ChapterQaContextBuilderChunk,
  ChapterQaContextChunk,
  ChapterQaContextSource,
  ChapterQaContextTextLimits,
  ChapterQaQuestion,
} from "./chapter-qa-context";
export type {
  ChapterQaAnswer,
  ChapterQaAnswerContextSummary,
  ChapterQaContextField,
  ChapterQaProvider,
  ChapterQaProviderRequest,
} from "./chapter-qa-provider";
export type {
  ChapterQaAnswerContextChunkRange,
  ChapterQaAnswerMetadata,
  ChapterQaAnswerSource,
  CreateChapterQaAnswerMetadataInput,
} from "./chapter-qa-answer-metadata";
export type {
  ChapterQaFallbackReason,
  ChapterQaProviderErrorCategory,
  ChapterQaProviderErrorInfo,
} from "./chapter-qa-provider-errors";
export type {
  AiProviderModelStatus,
  AiProviderRuntimeStatus,
  AiProviderSecretStatus,
  ChapterQaProviderDisabledReason,
  ChapterQaProviderId,
  ChapterQaProviderKind,
  ChapterQaProviderMode,
  ChapterQaProviderName,
  ChapterQaProviderNetworkStatus,
  ChapterQaProviderRuntimeStatus,
  ChapterQaProviderRuntimeStatusValue,
  ChapterQaProviderSelectionSource,
  ChapterQaProviderStatus,
  ChapterQaProviderTransport,
  ChapterQaRealAiStatus,
} from "./chapter-qa-provider-status";
export type {
  AiProviderRuntimeConfigInput,
  ChapterQaProviderRuntimeConfig,
} from "./ai-provider-config";
export type {
  ChapterQaProviderSelection,
  SelectChapterQaProviderInput,
} from "./chapter-qa-provider-selector";
export { LlmFinishReason, LlmMessageRole } from "./types";
export {
  buildChapterQaContext,
  defaultChapterQaContextTextLimits,
} from "./chapter-qa-context";
export {
  chapterQaProviderModes,
  isChapterQaProviderMode,
  mockChapterQaProviderStatus,
} from "./chapter-qa-provider-status";
export { resolveChapterQaProviderRuntimeConfig } from "./ai-provider-config";
export { selectChapterQaProvider } from "./chapter-qa-provider-selector";
export {
  createChapterQaAnswerContextSummary,
  createChapterQaAnswerMetadata,
} from "./chapter-qa-answer-metadata";
export { isChapterQaProviderErrorCategory } from "./chapter-qa-provider-errors";
export {
  MockChapterQaProvider,
  mockChapterQaProvider,
} from "./mock-chapter-qa-provider";

// --- New provider contract (A393) ---
export { LlmChatRole, LlmProviderMode } from "./llm-provider-contract";
export type {
  LlmChatMessage,
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
  LlmSafeError,
  LlmSafeErrorKind,
  LlmProviderMode as LlmProviderModeValue,
} from "./llm-provider-contract";
export {
  createBlockedResult,
  createMockSuccessResult,
  createSafeError,
  createSafeResult,
} from "./llm-safe-result";
export type { CreateSafeErrorInput, CreateSafeResultInput } from "./llm-safe-result";
export { MockLlmProvider, mockLlmProvider } from "./mock-llm-provider";
export {
  ExternalChatCompletionsProvider,
  LAP_LLM_DEV_API_KEY_KEY,
  LAP_LLM_DEV_ENDPOINT_KEY,
  LAP_LLM_DEV_MODEL_KEY,
  LAP_LLM_DEV_TIMEOUT_MS_KEY,
  loadExternalProviderConfig,
} from "./external-chat-completions-provider";
export type {
  ExternalProviderConfig,
  ExternalProviderEnv,
  ExternalProviderFetch,
} from "./external-chat-completions-provider";
