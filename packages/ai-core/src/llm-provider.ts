type LlmProviderJsonPrimitive = string | number | boolean | null;
type LlmProviderJsonValue =
  | LlmProviderJsonPrimitive
  | { readonly [key: string]: LlmProviderJsonValue }
  | readonly LlmProviderJsonValue[];

export type LlmProviderMetadata = {
  readonly [key: string]: LlmProviderJsonValue;
};

export const LlmProviderKey = {
  Mock: "mock",
  SparkTest: "spark_test",
  OpenAiCompatible: "openai_compatible",
  Local: "local",
  Custom: "custom",
} as const;

export type LlmProviderKey =
  (typeof LlmProviderKey)[keyof typeof LlmProviderKey];

export const LlmProviderCapability = {
  ChatCompletion: "chat_completion",
  SafeMockResponse: "safe_mock_response",
  UsageEstimation: "usage_estimation",
  RetryableErrorSimulation: "retryable_error_simulation",
  TimeoutRiskSimulation: "timeout_risk_simulation",
} as const;

export type LlmProviderCapability =
  (typeof LlmProviderCapability)[keyof typeof LlmProviderCapability];

export const LlmProviderRuntimeMode = {
  Disabled: "disabled",
  MockOnly: "mock_only",
  TestProviderDisabled: "test_provider_disabled",
  RealProviderDisabled: "real_provider_disabled",
} as const;

export type LlmProviderRuntimeMode =
  (typeof LlmProviderRuntimeMode)[keyof typeof LlmProviderRuntimeMode];

export type LlmProviderConfigSource = "mock" | "env" | "test" | "manual";

export interface LlmProviderConfig {
  providerKey: LlmProviderKey;
  displayName: string;
  enabled: boolean;
  mode: LlmProviderRuntimeMode;
  modelLabel?: string;
  baseUrlLabel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  source: LlmProviderConfigSource;
  secretConfigured?: boolean;
  redactedConfigSummary?: string;
  rawSecretAvailable: false;
}

export const LlmChatMessageRole = {
  System: "system",
  User: "user",
  Assistant: "assistant",
} as const;

export type LlmChatMessageRole =
  (typeof LlmChatMessageRole)[keyof typeof LlmChatMessageRole];

export interface LlmChatMessage {
  role: LlmChatMessageRole;
  content: string;
  contentSummary?: string;
  metadata?: LlmProviderMetadata;
}

export const LlmChatCompletionScenario = {
  Success: "success",
  ValidationError: "validation_error",
  RetryableTransientError: "retryable_transient_error",
  TimeoutRiskPreview: "timeout_risk_preview",
  BlockedByPolicy: "blocked_by_policy",
} as const;

export type LlmChatCompletionScenario =
  (typeof LlmChatCompletionScenario)[keyof typeof LlmChatCompletionScenario];

export interface LlmSafetyContext {
  policySummary?: string;
  safePurposeSummary?: string;
  metadata?: LlmProviderMetadata;
}

export interface LlmChatCompletionInput {
  messages: readonly LlmChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  requestPurpose: string;
  safetyContext?: LlmSafetyContext;
  metadata?: LlmProviderMetadata;
  scenario?: LlmChatCompletionScenario;
}

export interface LlmUsagePreview {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  totalEstimatedTokens: number;
}

export const LlmProviderErrorKind = {
  ValidationError: "validation_error",
  ProviderDisabled: "provider_disabled",
  PolicyBlocked: "policy_blocked",
  RetryableTransientError: "retryable_transient_error",
  TimeoutRiskPreview: "timeout_risk_preview",
  UnknownMockError: "unknown_mock_error",
} as const;

export type LlmProviderErrorKind =
  (typeof LlmProviderErrorKind)[keyof typeof LlmProviderErrorKind];

export interface LlmProviderError {
  errorKind: LlmProviderErrorKind;
  message: string;
  retryable: boolean;
  safeDetails?: LlmProviderMetadata;
  secretSafe: true;
  rawProviderErrorStored: false;
}

export const LlmChatCompletionFinishReason = {
  Stop: "stop",
  Error: "error",
  PolicyBlocked: "policy_blocked",
  TimeoutRiskPreview: "timeout_risk_preview",
  MockPreview: "mock_preview",
} as const;

export type LlmChatCompletionFinishReason =
  (typeof LlmChatCompletionFinishReason)[keyof typeof LlmChatCompletionFinishReason];

export interface LlmMetadataSummary {
  metadataKeyCount: number;
  safeMetadataKeys: readonly string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
}

export interface LlmChatCompletionResult {
  ok: boolean;
  providerKey: LlmProviderKey;
  modelLabel: string;
  responseSummary?: string;
  usage?: LlmUsagePreview;
  finishReason?: LlmChatCompletionFinishReason;
  error?: LlmProviderError;
  warnings: readonly string[];
  metadataSummary?: LlmMetadataSummary;
  llmCallEnabled: boolean;
  mockOnly: boolean;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  secretSafe: true;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  createdAt?: string;
  message: string;
}

export interface LlmProvider {
  readonly providerKey: LlmProviderKey;
  readonly displayName: string;
  readonly capabilities: readonly LlmProviderCapability[];
  readonly config: LlmProviderConfig;

  createChatCompletion(
    input: LlmChatCompletionInput,
  ): Promise<LlmChatCompletionResult>;
}

export type CreateMockLlmProviderConfigOverrides = Partial<
  Omit<
    LlmProviderConfig,
    "providerKey" | "source" | "rawSecretAvailable"
  >
>;

export const MOCK_LLM_PROVIDER_CAPABILITIES = [
  LlmProviderCapability.ChatCompletion,
  LlmProviderCapability.SafeMockResponse,
  LlmProviderCapability.UsageEstimation,
  LlmProviderCapability.RetryableErrorSimulation,
  LlmProviderCapability.TimeoutRiskSimulation,
] as const satisfies readonly LlmProviderCapability[];

const DEFAULT_MOCK_MODEL_LABEL = "mock-preview-model";
const DEFAULT_MOCK_CREATED_AT = "1970-01-01T00:00:00.000Z";
const MIN_REQUEST_PURPOSE_LENGTH = 4;
const MAX_SAFE_METADATA_KEYS = 12;
const MOCK_OUTPUT_TOKEN_ESTIMATE = 48;

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
  "rawresponse",
  "rawcompletion",
]);

export function createMockLlmProviderConfig(
  overrides: CreateMockLlmProviderConfigOverrides = {},
): LlmProviderConfig {
  return {
    providerKey: LlmProviderKey.Mock,
    displayName: overrides.displayName ?? "Mock LLM provider",
    enabled: overrides.enabled ?? true,
    mode: overrides.mode ?? LlmProviderRuntimeMode.MockOnly,
    modelLabel: overrides.modelLabel ?? DEFAULT_MOCK_MODEL_LABEL,
    baseUrlLabel: overrides.baseUrlLabel ?? "not_configured",
    timeoutMs: overrides.timeoutMs ?? 0,
    maxRetries: overrides.maxRetries ?? 0,
    source: "mock",
    secretConfigured: overrides.secretConfigured ?? false,
    redactedConfigSummary:
      overrides.redactedConfigSummary ??
      "Mock provider only. No secret is required, no env is read, and no network endpoint is configured.",
    rawSecretAvailable: false,
  };
}

export function createMockLlmProvider(
  configOverrides: CreateMockLlmProviderConfigOverrides = {},
): LlmProvider {
  const config = createMockLlmProviderConfig(configOverrides);

  return {
    providerKey: LlmProviderKey.Mock,
    displayName: config.displayName,
    capabilities: [...MOCK_LLM_PROVIDER_CAPABILITIES],
    config,
    createChatCompletion: async (input) =>
      createMockLlmChatCompletionResult(input, config),
  };
}

export function createMockLlmChatCompletionResult(
  input: LlmChatCompletionInput,
  config: LlmProviderConfig = createMockLlmProviderConfig(),
): LlmChatCompletionResult {
  const modelLabel = normalizeModelLabel(input.model, config.modelLabel);
  const metadataSummary = createMetadataSummary(input);
  const base = createBaseMockResult({
    config,
    modelLabel,
    metadataSummary,
  });

  if (!isMockProviderEnabled(config)) {
    return createMockErrorResult({
      base,
      errorKind: LlmProviderErrorKind.ProviderDisabled,
      retryable: false,
      message:
        "Mock LLM provider is disabled by config. No real provider was called.",
      finishReason: LlmChatCompletionFinishReason.Error,
      safeDetails: {
        reason: "provider disabled",
        mode: config.mode,
      },
    });
  }

  const validationError = validateMockInput(input);
  if (validationError !== undefined) {
    return createMockErrorResult({
      base,
      errorKind: LlmProviderErrorKind.ValidationError,
      retryable: false,
      message: validationError,
      finishReason: LlmChatCompletionFinishReason.Error,
      safeDetails: { reason: "mock input validation failed" },
    });
  }

  if (metadataSummary.sensitiveMetadataDetected) {
    return createMockErrorResult({
      base,
      errorKind: LlmProviderErrorKind.PolicyBlocked,
      retryable: false,
      message:
        "Mock LLM provider blocked the request because sensitive metadata keys were detected.",
      finishReason: LlmChatCompletionFinishReason.PolicyBlocked,
      safeDetails: {
        reason: "sensitive metadata key detected",
        sensitiveMetadataKeyCount: metadataSummary.redactedSensitiveKeyCount,
      },
    });
  }

  const scenario = input.scenario ?? LlmChatCompletionScenario.Success;

  switch (scenario) {
    case LlmChatCompletionScenario.Success:
      return {
        ...base,
        ok: true,
        responseSummary:
          "这是 mock provider 返回的安全摘要，用于验证 provider abstraction；未调用真实模型。",
        usage: createUsagePreview(input),
        finishReason: LlmChatCompletionFinishReason.MockPreview,
        message:
          "Mock LLM provider returned a safe summary. No real LLM call, network request, secret access, or raw response storage occurred.",
      };
    case LlmChatCompletionScenario.ValidationError:
      return createMockErrorResult({
        base,
        errorKind: LlmProviderErrorKind.ValidationError,
        retryable: false,
        message:
          "Mock LLM provider validation_error scenario was requested. No real provider was called.",
        finishReason: LlmChatCompletionFinishReason.Error,
        safeDetails: { reason: "requested mock validation_error scenario" },
      });
    case LlmChatCompletionScenario.RetryableTransientError:
      return createMockErrorResult({
        base,
        errorKind: LlmProviderErrorKind.RetryableTransientError,
        retryable: true,
        message:
          "Mock LLM provider retryable_transient_error scenario was requested. This is a retryable mock error only.",
        finishReason: LlmChatCompletionFinishReason.Error,
        safeDetails: {
          reason: "requested mock retryable transient error scenario",
        },
      });
    case LlmChatCompletionScenario.TimeoutRiskPreview:
      return createMockErrorResult({
        base,
        errorKind: LlmProviderErrorKind.TimeoutRiskPreview,
        retryable: true,
        message:
          "Mock LLM provider timeout_risk_preview scenario was requested. This is only a mock timeout risk preview, not a real timeout.",
        finishReason: LlmChatCompletionFinishReason.TimeoutRiskPreview,
        safeDetails: { reason: "mock timeout risk preview only" },
      });
    case LlmChatCompletionScenario.BlockedByPolicy:
      return createMockErrorResult({
        base,
        errorKind: LlmProviderErrorKind.PolicyBlocked,
        retryable: false,
        message:
          "Mock LLM provider blocked_by_policy scenario was requested. No real provider was called.",
        finishReason: LlmChatCompletionFinishReason.PolicyBlocked,
        safeDetails: { reason: "requested mock policy block scenario" },
      });
  }
}

export function containsSensitiveLlmProviderMetadata(
  metadata: LlmProviderMetadata | undefined,
): boolean {
  return collectMetadataKeys(metadata).some(isSensitiveMetadataKey);
}

function createBaseMockResult(input: {
  readonly config: LlmProviderConfig;
  readonly modelLabel: string;
  readonly metadataSummary: LlmMetadataSummary;
}): LlmChatCompletionResult {
  return {
    ok: false,
    providerKey: LlmProviderKey.Mock,
    modelLabel: input.modelLabel,
    warnings: createMockWarnings(input.config),
    metadataSummary: input.metadataSummary,
    llmCallEnabled: false,
    mockOnly: true,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    createdAt: DEFAULT_MOCK_CREATED_AT,
    message:
      "Mock LLM provider result was initialized. No real provider was called.",
  };
}

function createMockErrorResult(input: {
  readonly base: LlmChatCompletionResult;
  readonly errorKind: LlmProviderErrorKind;
  readonly retryable: boolean;
  readonly message: string;
  readonly finishReason: LlmChatCompletionFinishReason;
  readonly safeDetails?: LlmProviderMetadata;
}): LlmChatCompletionResult {
  return {
    ...input.base,
    ok: false,
    finishReason: input.finishReason,
    error: {
      errorKind: input.errorKind,
      message: input.message,
      retryable: input.retryable,
      safeDetails: input.safeDetails,
      secretSafe: true,
      rawProviderErrorStored: false,
    },
    message: input.message,
  };
}

function validateMockInput(
  input: LlmChatCompletionInput,
): string | undefined {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    return "Mock LLM provider requires at least one chat message.";
  }

  if (
    typeof input.requestPurpose !== "string" ||
    input.requestPurpose.trim().length < MIN_REQUEST_PURPOSE_LENGTH
  ) {
    return "Mock LLM provider requires a non-sensitive requestPurpose summary.";
  }

  if (
    input.scenario !== undefined &&
    !isLlmChatCompletionScenario(input.scenario)
  ) {
    return "Mock LLM provider received an unsupported scenario.";
  }

  if (
    input.messages.some((message) => !isLlmChatMessageRole(message.role))
  ) {
    return "Mock LLM provider received an unsupported chat message role.";
  }

  return undefined;
}

function isMockProviderEnabled(config: LlmProviderConfig): boolean {
  return (
    config.providerKey === LlmProviderKey.Mock &&
    config.enabled === true &&
    config.mode === LlmProviderRuntimeMode.MockOnly &&
    config.rawSecretAvailable === false
  );
}

function createUsagePreview(input: LlmChatCompletionInput): LlmUsagePreview {
  const inputTextLength =
    input.requestPurpose.length +
    (input.safetyContext?.safePurposeSummary?.length ?? 0) +
    input.messages.reduce((total, message) => {
      return (
        total +
        (message.contentSummary?.length ?? 0) +
        message.content.length
      );
    }, 0);
  const estimatedInputTokens = Math.max(1, Math.ceil(inputTextLength / 4));
  const estimatedOutputTokens = MOCK_OUTPUT_TOKEN_ESTIMATE;

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    totalEstimatedTokens: estimatedInputTokens + estimatedOutputTokens,
  };
}

function createMetadataSummary(
  input: LlmChatCompletionInput,
): LlmMetadataSummary {
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

function createMockWarnings(config: LlmProviderConfig): string[] {
  return normalizeUniqueStrings([
    "Mock provider only; no real model was called.",
    "No network request was made.",
    "No env file, secret, API key, authorization header, cookie, or private key was read.",
    "Raw prompt, raw messages, and raw response are not stored in the result.",
    "Streaming and tool calling are unsupported in this scaffold.",
    config.redactedConfigSummary ?? "",
  ]);
}

function normalizeModelLabel(
  inputModel: string | undefined,
  configModelLabel: string | undefined,
): string {
  const normalizedInputModel = inputModel?.trim();

  if (normalizedInputModel !== undefined && normalizedInputModel.length > 0) {
    return normalizedInputModel;
  }

  return configModelLabel ?? DEFAULT_MOCK_MODEL_LABEL;
}

function isLlmChatCompletionScenario(
  value: LlmChatCompletionScenario,
): value is LlmChatCompletionScenario {
  return Object.values(LlmChatCompletionScenario).includes(value);
}

function isLlmChatMessageRole(
  value: LlmChatMessageRole,
): value is LlmChatMessageRole {
  return Object.values(LlmChatMessageRole).includes(value);
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

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}
