import {
  LlmChatCompletionFinishReason,
  LlmChatMessageRole,
  LlmProviderCapability,
  LlmProviderErrorKind,
  LlmProviderKey,
  LlmProviderRuntimeMode,
  type LlmChatCompletionInput,
  type LlmChatCompletionResult,
  type LlmMetadataSummary,
  type LlmProvider,
  type LlmProviderConfig,
  type LlmProviderConfigSource,
  type LlmProviderError,
  type LlmProviderMetadata,
  type LlmUsagePreview,
} from "./llm-provider";

export type SparkProviderConfigSource = Extract<
  LlmProviderConfigSource,
  "env" | "manual" | "test"
>;

export type SparkProviderRuntimeMode =
  | typeof LlmProviderRuntimeMode.Disabled
  | typeof LlmProviderRuntimeMode.TestProviderDisabled;

export interface SparkProviderRedactedConfigSummary {
  providerKey: typeof LlmProviderKey.SparkTest;
  displayName: string;
  baseUrlLabel: string;
  modelLabel: string;
  enabled: false;
  secretConfigured: boolean;
  secretPreview: "not_loaded" | "configured_but_redacted" | "missing";
  safeForLogs: true;
}

export interface SparkProviderConfig {
  providerKey: typeof LlmProviderKey.SparkTest;
  displayName: string;
  enabled: false;
  mode: SparkProviderRuntimeMode;
  baseUrlLabel: string;
  modelLabel: string;
  timeoutMs?: number;
  maxRetries?: number;
  source: SparkProviderConfigSource;
  secretConfigured?: boolean;
  rawSecretAvailable: false;
  redactedConfigSummary: SparkProviderRedactedConfigSummary;
}

export interface SparkProviderRedactedConfigSummaryInput {
  providerKey: typeof LlmProviderKey.SparkTest;
  displayName: string;
  baseUrlLabel: string;
  modelLabel: string;
  enabled: boolean;
  secretConfigured?: boolean;
}

export type CreateDisabledSparkProviderConfigOverrides = Partial<
  Pick<
    SparkProviderConfig,
    | "displayName"
    | "baseUrlLabel"
    | "modelLabel"
    | "timeoutMs"
    | "maxRetries"
    | "source"
    | "secretConfigured"
  >
>;

export interface SparkMetadataSummary extends LlmMetadataSummary {
  warnings: readonly string[];
}

export interface SparkChatCompletionRequestMessage {
  role:
    | typeof LlmChatMessageRole.System
    | typeof LlmChatMessageRole.User
    | typeof LlmChatMessageRole.Assistant;
  content: string;
}

export interface SparkChatCompletionRequestPreview {
  model: string;
  messages: readonly SparkChatCompletionRequestMessage[];
  temperature?: number;
  max_tokens?: number;
  stream: false;
  metadataSummary?: SparkMetadataSummary;
}

export const SparkProviderErrorKind = {
  ProviderDisabled: "provider_disabled",
  InvalidRequest: "invalid_request",
  UnsafeMetadata: "unsafe_metadata",
  UnsupportedStreaming: "unsupported_streaming",
  UnsupportedToolCalling: "unsupported_tool_calling",
  ResponseMappingError: "response_mapping_error",
} as const;

export type SparkProviderErrorKind =
  (typeof SparkProviderErrorKind)[keyof typeof SparkProviderErrorKind];

export interface SparkProviderSafeError {
  errorKind: SparkProviderErrorKind;
  message: string;
  retryable: boolean;
  safeDetails?: LlmProviderMetadata;
}

export interface SparkChatCompletionRequestPreviewResult {
  ok: boolean;
  requestPreview: SparkChatCompletionRequestPreview;
  warnings: readonly string[];
  metadataSummary: SparkMetadataSummary;
  error?: SparkProviderSafeError;
  rawPromptStored: false;
  rawMessagesStored: false;
}

export interface SparkChatCompletionResponseChoiceLike {
  index?: number;
  message?: {
    role?: string;
    content?: string;
  };
  finish_reason?: string | null;
}

export interface SparkChatCompletionResponseLike {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: readonly SparkChatCompletionResponseChoiceLike[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?:
    | string
    | {
        message?: string;
        type?: string;
        code?: string | number;
      }
    | null;
}

export interface SparkChatCompletionResponseMapperContext {
  modelLabel: string;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  llmCallEnabled?: boolean;
  metadataSummary?: SparkMetadataSummary;
  warnings?: readonly string[];
  createdAt?: string;
}

export interface SparkProviderAdapterStatus {
  providerKey: typeof LlmProviderKey.SparkTest;
  scaffoldAvailable: true;
  enabled: false;
  realCallEnabled: false;
  networkAccessEnabled: false;
  streamingSupported: false;
  toolCallingSupported: false;
  secretLoaded: false;
  message: string;
}

const DEFAULT_SPARK_DISPLAY_NAME = "Spark Ultra-32K Test Provider";
const DEFAULT_SPARK_BASE_URL_LABEL = "https://spark-api-open.xf-yun.com/v1";
const DEFAULT_SPARK_MODEL_LABEL = "Spark Ultra-32K";
const DEFAULT_CREATED_AT = "1970-01-01T00:00:00.000Z";
const MAX_SAFE_METADATA_KEYS = 12;
const MAX_RESPONSE_SUMMARY_LENGTH = 240;
const DISABLED_SPARK_PROVIDER_MESSAGE =
  "Spark provider adapter scaffold 当前默认禁用，未调用真实模型。";

const SPARK_PROVIDER_CAPABILITIES = [
  LlmProviderCapability.ChatCompletion,
] as const satisfies readonly LlmProviderCapability[];

const SENSITIVE_METADATA_KEYS = new Set([
  "apikey",
  "apisecret",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "password",
  "credential",
  "credentials",
  "rawheaders",
  "headers",
  "cookie",
  "setcookie",
  "privatekey",
  "clientsecret",
  "rawprompt",
  "rawmessages",
]);

const UNSUPPORTED_TOOL_CALLING_FIELDS = [
  "tools",
  "tool_choice",
  "functions",
  "function_call",
  "toolCalls",
] as const;

export function createDisabledSparkProviderConfig(
  overrides: CreateDisabledSparkProviderConfigOverrides = {},
): SparkProviderConfig {
  const baseConfig = {
    providerKey: LlmProviderKey.SparkTest,
    displayName:
      normalizeLabel(overrides.displayName) ?? DEFAULT_SPARK_DISPLAY_NAME,
    enabled: false,
    mode: LlmProviderRuntimeMode.TestProviderDisabled,
    baseUrlLabel:
      normalizeLabel(overrides.baseUrlLabel) ?? DEFAULT_SPARK_BASE_URL_LABEL,
    modelLabel:
      normalizeLabel(overrides.modelLabel) ?? DEFAULT_SPARK_MODEL_LABEL,
    timeoutMs: normalizePositiveInteger(overrides.timeoutMs),
    maxRetries: normalizeNonNegativeInteger(overrides.maxRetries),
    source: overrides.source ?? "test",
    secretConfigured: overrides.secretConfigured ?? false,
    rawSecretAvailable: false,
  } as const satisfies Omit<SparkProviderConfig, "redactedConfigSummary">;

  return {
    ...baseConfig,
    redactedConfigSummary:
      createSparkProviderRedactedConfigSummary(baseConfig),
  };
}

export function createSparkProviderRedactedConfigSummary(
  config: SparkProviderRedactedConfigSummaryInput,
): SparkProviderRedactedConfigSummary {
  const secretConfigured = config.secretConfigured === true;

  return {
    providerKey: LlmProviderKey.SparkTest,
    displayName: config.displayName,
    baseUrlLabel: config.baseUrlLabel,
    modelLabel: config.modelLabel,
    enabled: false,
    secretConfigured,
    secretPreview: secretConfigured
      ? "configured_but_redacted"
      : "not_loaded",
    safeForLogs: true,
  };
}

export function createSparkChatCompletionRequestPreview(
  input: LlmChatCompletionInput,
  config: SparkProviderConfig = createDisabledSparkProviderConfig(),
): SparkChatCompletionRequestPreviewResult {
  const metadataSummary = createSparkMetadataSummary(input);
  const streamRequested = isStreamRequested(input);
  const unsupportedToolCallingFields =
    getUnsupportedToolCallingFields(input);
  const validationError = validateRequestPreviewInput(input);
  const errorKind =
    validationError !== undefined
      ? SparkProviderErrorKind.InvalidRequest
      : streamRequested
        ? SparkProviderErrorKind.UnsupportedStreaming
        : unsupportedToolCallingFields.length > 0
          ? SparkProviderErrorKind.UnsupportedToolCalling
          : metadataSummary.sensitiveMetadataDetected
            ? SparkProviderErrorKind.UnsafeMetadata
            : undefined;
  const requestPreview: SparkChatCompletionRequestPreview = {
    model: normalizeLabel(input.model) ?? config.modelLabel,
    messages: createSparkRequestMessages(input),
    temperature: normalizeFiniteNumber(input.temperature),
    max_tokens: normalizePositiveInteger(input.maxTokens),
    stream: false,
    metadataSummary,
  };
  const warnings = createRequestPreviewWarnings({
    metadataSummary,
    streamRequested,
    unsupportedToolCallingFields,
    validationError,
  });

  return {
    ok: errorKind === undefined,
    requestPreview,
    warnings,
    metadataSummary,
    error:
      errorKind === undefined
        ? undefined
        : createSparkSafeError(errorKind, {
            validationError,
            unsupportedToolCallingFields,
            metadataSummary,
          }),
    rawPromptStored: false,
    rawMessagesStored: false,
  };
}

export function mapSparkChatCompletionResponseToLlmResult(
  responseLike: SparkChatCompletionResponseLike,
  context: SparkChatCompletionResponseMapperContext,
): LlmChatCompletionResult {
  const providerError = createResponseLikeProviderError(responseLike);
  const responseSummary = createResponseSummary(responseLike);
  const mappingError =
    providerError === undefined && responseSummary === undefined
      ? createResponseMappingLlmError()
      : undefined;
  const error = providerError ?? mappingError;

  return {
    ok: error === undefined,
    providerKey: LlmProviderKey.SparkTest,
    modelLabel:
      normalizeLabel(responseLike.model) ??
      normalizeLabel(context.modelLabel) ??
      DEFAULT_SPARK_MODEL_LABEL,
    responseSummary:
      responseSummary ??
      "Spark response-like object did not contain a safe assistant content summary.",
    usage: createUsagePreview(responseLike.usage),
    finishReason: mapSparkFinishReason(responseLike, error),
    error,
    warnings: normalizeUniqueStrings([
      "Spark response mapper stored only a truncated safe summary.",
      "Raw provider response was not stored.",
      "No credential value, auth header, cookie, or private key is included.",
      ...(context.warnings ?? []),
    ]),
    metadataSummary: context.metadataSummary,
    llmCallEnabled: context.llmCallEnabled === true,
    mockOnly: false,
    realProviderCalled: context.realProviderCalled === true,
    networkAccessed: context.networkAccessed === true,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    createdAt: context.createdAt ?? DEFAULT_CREATED_AT,
    message:
      error === undefined
        ? "Spark response-like object was mapped to an LLM result summary. Raw response storage remains disabled."
        : error.message,
  };
}

export function createSparkTestProvider(
  configOrOverrides:
    | SparkProviderConfig
    | CreateDisabledSparkProviderConfigOverrides = {},
): LlmProvider {
  const sparkConfig = isSparkProviderConfig(configOrOverrides)
    ? createDisabledSparkProviderConfig(configOrOverrides)
    : createDisabledSparkProviderConfig(configOrOverrides);
  const llmConfig = createLlmProviderConfigFromSparkConfig(sparkConfig);

  return {
    providerKey: LlmProviderKey.SparkTest,
    displayName: sparkConfig.displayName,
    capabilities: [...SPARK_PROVIDER_CAPABILITIES],
    config: llmConfig,
    createChatCompletion: async (input) => {
      const requestPreview = createSparkChatCompletionRequestPreview(
        input,
        sparkConfig,
      );

      return createDisabledSparkChatCompletionResult({
        input,
        config: sparkConfig,
        requestPreview,
      });
    },
  };
}

export function getSparkProviderAdapterStatus(
  config: SparkProviderConfig = createDisabledSparkProviderConfig(),
): SparkProviderAdapterStatus {
  void config;

  return {
    providerKey: LlmProviderKey.SparkTest,
    scaffoldAvailable: true,
    enabled: false,
    realCallEnabled: false,
    networkAccessEnabled: false,
    streamingSupported: false,
    toolCallingSupported: false,
    secretLoaded: false,
    message:
      "Spark provider adapter scaffold is available, but real calls, network access, streaming, tool calling, and credential loading are disabled.",
  };
}

function createDisabledSparkChatCompletionResult(input: {
  readonly input: LlmChatCompletionInput;
  readonly config: SparkProviderConfig;
  readonly requestPreview: SparkChatCompletionRequestPreviewResult;
}): LlmChatCompletionResult {
  const modelLabel =
    normalizeLabel(input.input.model) ?? input.config.modelLabel;

  return {
    ok: false,
    providerKey: LlmProviderKey.SparkTest,
    modelLabel,
    finishReason: LlmChatCompletionFinishReason.Error,
    error: {
      errorKind: LlmProviderErrorKind.ProviderDisabled,
      message: DISABLED_SPARK_PROVIDER_MESSAGE,
      retryable: false,
      safeDetails: {
        providerKey: LlmProviderKey.SparkTest,
        mode: input.config.mode,
        scaffoldAvailable: true,
        realProviderCalled: false,
        networkAccessed: false,
      },
      secretSafe: true,
      rawProviderErrorStored: false,
    },
    warnings: createDisabledProviderWarnings(
      input.config,
      input.requestPreview,
    ),
    metadataSummary: input.requestPreview.metadataSummary,
    llmCallEnabled: false,
    mockOnly: false,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    createdAt: DEFAULT_CREATED_AT,
    message: DISABLED_SPARK_PROVIDER_MESSAGE,
  };
}

function createLlmProviderConfigFromSparkConfig(
  config: SparkProviderConfig,
): LlmProviderConfig {
  return {
    providerKey: LlmProviderKey.SparkTest,
    displayName: config.displayName,
    enabled: false,
    mode: LlmProviderRuntimeMode.TestProviderDisabled,
    modelLabel: config.modelLabel,
    baseUrlLabel: config.baseUrlLabel,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    source: config.source,
    secretConfigured: config.secretConfigured ?? false,
    redactedConfigSummary: formatRedactedConfigSummary(
      config.redactedConfigSummary,
    ),
    rawSecretAvailable: false,
  };
}

function formatRedactedConfigSummary(
  summary: SparkProviderRedactedConfigSummary,
): string {
  return [
    `${summary.displayName} (${summary.providerKey})`,
    `model=${summary.modelLabel}`,
    `baseUrlLabel=${summary.baseUrlLabel}`,
    `enabled=${summary.enabled}`,
    `secretPreview=${summary.secretPreview}`,
    "safeForLogs=true",
  ].join("; ");
}

function createSparkMetadataSummary(
  input: LlmChatCompletionInput,
): SparkMetadataSummary {
  const metadataKeys = normalizeUniqueStrings([
    ...collectMetadataKeys(input.metadata),
    ...collectMetadataKeys(input.safetyContext?.metadata),
    ...input.messages.flatMap((message) =>
      collectMetadataKeys(message.metadata),
    ),
  ]);
  const safeMetadataKeys = metadataKeys
    .filter((key) => !isSensitiveMetadataKey(key))
    .map(sanitizeMetadataKeyForSummary)
    .filter((key) => key.length > 0);
  const visibleSafeMetadataKeys = safeMetadataKeys.slice(
    0,
    MAX_SAFE_METADATA_KEYS,
  );
  const redactedSensitiveKeyCount = metadataKeys.filter(
    isSensitiveMetadataKey,
  ).length;

  return {
    metadataKeyCount: metadataKeys.length,
    safeMetadataKeys: visibleSafeMetadataKeys,
    sensitiveMetadataDetected: redactedSensitiveKeyCount > 0,
    redactedSensitiveKeyCount,
    truncated: safeMetadataKeys.length > visibleSafeMetadataKeys.length,
    warnings:
      redactedSensitiveKeyCount > 0
        ? [
            "Sensitive metadata keys were detected; metadata values were omitted from the request preview.",
          ]
        : [],
  };
}

function collectMetadataKeys(
  metadata: LlmProviderMetadata | undefined,
): string[] {
  if (metadata === undefined) {
    return [];
  }

  const keys: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value === null || typeof value !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      visit(child);
    }
  };

  visit(metadata);

  return normalizeUniqueStrings(keys);
}

function createSparkRequestMessages(
  input: LlmChatCompletionInput,
): SparkChatCompletionRequestMessage[] {
  if (!Array.isArray(input.messages)) {
    return [];
  }

  return input.messages.map((message) => ({
    role: isSparkRequestRole(message.role)
      ? message.role
      : LlmChatMessageRole.User,
    content: typeof message.content === "string" ? message.content : "",
  }));
}

function validateRequestPreviewInput(
  input: LlmChatCompletionInput,
): string | undefined {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    return "Spark request preview requires at least one chat message.";
  }

  if (!input.messages.every((message) => isSparkRequestRole(message.role))) {
    return "Spark request preview received an unsupported chat message role.";
  }

  return undefined;
}

function createRequestPreviewWarnings(input: {
  readonly metadataSummary: SparkMetadataSummary;
  readonly streamRequested: boolean;
  readonly unsupportedToolCallingFields: readonly string[];
  readonly validationError: string | undefined;
}): string[] {
  return normalizeUniqueStrings([
    "Spark request preview was created locally; no HTTP request was sent.",
    "Credential values, auth headers, raw metadata payloads, and provider response bodies are not included.",
    "Streaming is unsupported and stream is forced to false.",
    ...(input.metadataSummary.warnings ?? []),
    ...(input.validationError === undefined ? [] : [input.validationError]),
    ...(input.streamRequested
      ? ["stream=true is unsupported for this scaffold and was not enabled."]
      : []),
    ...(input.unsupportedToolCallingFields.length === 0
      ? []
      : [
          `Tool calling fields are unsupported for this scaffold and were not included: ${input.unsupportedToolCallingFields.join(
            ", ",
          )}.`,
        ]),
  ]);
}

function createSparkSafeError(
  errorKind: SparkProviderErrorKind,
  input: {
    readonly validationError: string | undefined;
    readonly unsupportedToolCallingFields: readonly string[];
    readonly metadataSummary: SparkMetadataSummary;
  },
): SparkProviderSafeError {
  switch (errorKind) {
    case SparkProviderErrorKind.InvalidRequest:
      return {
        errorKind,
        message:
          input.validationError ??
          "Spark request preview rejected an invalid request shape.",
        retryable: false,
      };
    case SparkProviderErrorKind.UnsafeMetadata:
      return {
        errorKind,
        message:
          "Spark request preview detected unsafe metadata keys. Metadata values were not included.",
        retryable: false,
        safeDetails: {
          redactedSensitiveKeyCount:
            input.metadataSummary.redactedSensitiveKeyCount,
        },
      };
    case SparkProviderErrorKind.UnsupportedStreaming:
      return {
        errorKind,
        message:
          "Spark request preview rejected streaming because this scaffold does not support streaming.",
        retryable: false,
      };
    case SparkProviderErrorKind.UnsupportedToolCalling:
      return {
        errorKind,
        message:
          "Spark request preview rejected tool calling because this scaffold does not support tool calling.",
        retryable: false,
        safeDetails: {
          unsupportedToolCallingFieldCount:
            input.unsupportedToolCallingFields.length,
        },
      };
    case SparkProviderErrorKind.ProviderDisabled:
    case SparkProviderErrorKind.ResponseMappingError:
      return {
        errorKind,
        message: "Spark provider scaffold returned a safe local error.",
        retryable: false,
      };
  }
}

function createDisabledProviderWarnings(
  config: SparkProviderConfig,
  requestPreview: SparkChatCompletionRequestPreviewResult,
): string[] {
  return normalizeUniqueStrings([
    "Spark provider adapter scaffold is disabled by default.",
    "No Spark model was called.",
    "No network request was made.",
    "No env file or credential value was read.",
    "Raw prompt, raw messages, and raw response are not stored in the provider result.",
    "Streaming and tool calling are unsupported in this scaffold.",
    formatRedactedConfigSummary(config.redactedConfigSummary),
    ...requestPreview.warnings,
  ]);
}

function createResponseLikeProviderError(
  responseLike: SparkChatCompletionResponseLike,
): LlmProviderError | undefined {
  if (responseLike.error === undefined || responseLike.error === null) {
    return undefined;
  }

  const errorType =
    typeof responseLike.error === "object"
      ? normalizeLabel(responseLike.error.type)
      : undefined;
  const errorCode =
    typeof responseLike.error === "object"
      ? normalizeLabel(String(responseLike.error.code ?? ""))
      : undefined;

  return {
    errorKind: LlmProviderErrorKind.UnknownMockError,
    message:
      "Spark response-like object contained a provider error summary. Raw provider error was not stored.",
    retryable: false,
    safeDetails: {
      reason: "response error field present",
      ...(errorType === undefined ? {} : { errorType }),
      ...(errorCode === undefined ? {} : { errorCode }),
    },
    secretSafe: true,
    rawProviderErrorStored: false,
  };
}

function createResponseMappingLlmError(): LlmProviderError {
  return {
    errorKind: LlmProviderErrorKind.UnknownMockError,
    message:
      "Spark response-like object could not be mapped to a safe assistant response summary.",
    retryable: false,
    safeDetails: { reason: SparkProviderErrorKind.ResponseMappingError },
    secretSafe: true,
    rawProviderErrorStored: false,
  };
}

function createResponseSummary(
  responseLike: SparkChatCompletionResponseLike,
): string | undefined {
  const firstContent = responseLike.choices?.find(
    (choice) =>
      typeof choice.message?.content === "string" &&
      choice.message.content.trim().length > 0,
  )?.message?.content;

  if (firstContent === undefined) {
    return undefined;
  }

  return truncateSummary(normalizeWhitespace(firstContent));
}

function createUsagePreview(
  usage: SparkChatCompletionResponseLike["usage"] | undefined,
): LlmUsagePreview | undefined {
  if (usage === undefined) {
    return undefined;
  }

  const estimatedInputTokens = normalizeNonNegativeInteger(
    usage.prompt_tokens,
  );
  const estimatedOutputTokens = normalizeNonNegativeInteger(
    usage.completion_tokens,
  );
  const totalEstimatedTokens =
    normalizeNonNegativeInteger(usage.total_tokens) ??
    (estimatedInputTokens ?? 0) + (estimatedOutputTokens ?? 0);

  if (
    estimatedInputTokens === undefined &&
    estimatedOutputTokens === undefined &&
    usage.total_tokens === undefined
  ) {
    return undefined;
  }

  return {
    estimatedInputTokens: estimatedInputTokens ?? 0,
    estimatedOutputTokens: estimatedOutputTokens ?? 0,
    totalEstimatedTokens,
  };
}

function mapSparkFinishReason(
  responseLike: SparkChatCompletionResponseLike,
  error: LlmProviderError | undefined,
): LlmChatCompletionFinishReason {
  if (error !== undefined) {
    return LlmChatCompletionFinishReason.Error;
  }

  const finishReason = normalizeLabel(
    responseLike.choices?.[0]?.finish_reason ?? undefined,
  );

  if (finishReason === "stop") {
    return LlmChatCompletionFinishReason.Stop;
  }

  return LlmChatCompletionFinishReason.MockPreview;
}

function isSparkProviderConfig(
  value: SparkProviderConfig | CreateDisabledSparkProviderConfigOverrides,
): value is SparkProviderConfig {
  return (
    "providerKey" in value &&
    value.providerKey === LlmProviderKey.SparkTest &&
    "redactedConfigSummary" in value
  );
}

function isStreamRequested(input: LlmChatCompletionInput): boolean {
  const maybeStreamInput = input as unknown as { readonly stream?: unknown };

  return maybeStreamInput.stream === true;
}

function getUnsupportedToolCallingFields(
  input: LlmChatCompletionInput,
): string[] {
  const unknownInput = input as unknown as Record<string, unknown>;

  return UNSUPPORTED_TOOL_CALLING_FIELDS.filter((fieldName) => {
    const value = unknownInput[fieldName];

    if (value === undefined || value === null || value === false) {
      return false;
    }

    return !(Array.isArray(value) && value.length === 0);
  });
}

function isSparkRequestRole(
  role: string,
): role is SparkChatCompletionRequestMessage["role"] {
  return (
    role === LlmChatMessageRole.System ||
    role === LlmChatMessageRole.User ||
    role === LlmChatMessageRole.Assistant
  );
}

function isSensitiveMetadataKey(key: string): boolean {
  return SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key));
}

function sanitizeMetadataKeyForSummary(value: string): string {
  return value.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeLabel(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeFiniteNumber(value: number | undefined): number | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : value;
}

function normalizePositiveInteger(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeNonNegativeInteger(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function truncateSummary(value: string): string {
  if (value.length <= MAX_RESPONSE_SUMMARY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_RESPONSE_SUMMARY_LENGTH - 3)}...`;
}
