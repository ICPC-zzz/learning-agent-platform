import {
  persistMockLlmCallPreview,
  type LlmCallPersistenceInput,
  type LlmChatCompletionResultLike,
  type PersistMockLlmCallPreviewOptions,
  type PersistMockLlmCallPreviewResult,
} from "./agent-llm-call-persistence.js";
import type {
  AgentRuntimeRepository,
  AgentRuntimeRepositoryJsonValue,
} from "./repositories/agent-runtime-repository.js";

type RuntimeMockLlmJsonPrimitive = string | number | boolean | null;
type RuntimeMockLlmJsonValue =
  | RuntimeMockLlmJsonPrimitive
  | RuntimeMockLlmJsonObject
  | RuntimeMockLlmJsonValue[];

interface RuntimeMockLlmJsonObject {
  [key: string]: RuntimeMockLlmJsonValue;
}

export interface RuntimeLlmCallRequestLike {
  requestId?: string;
  executionId?: string;
  providerKey?: string;
  modelLabel?: string;
  purposeSummary: string;
  inputSummary?: string;
  messagesSummary?: string;
  metadata?: unknown;
  requestedBy?: string;
  diagnosticOnly?: boolean;
  previewOnly?: boolean;
}

export interface RuntimeLlmCallUsageLike {
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  totalEstimatedTokens?: number;
}

export interface RuntimeLlmCallSafeErrorSummaryLike {
  errorKind?: string;
  message?: string;
  retryable?: boolean;
  secretSafe?: boolean;
  rawProviderErrorStored?: boolean;
  rawErrorStored?: boolean;
  rawProviderResponseStored?: boolean;
  headersStored?: boolean;
  authorizationHeaderStored?: boolean;
  stackStored?: boolean;
  valuesStored?: boolean;
  [key: string]: unknown;
}

export interface RuntimeLlmCallResultLike {
  ok?: boolean;
  requestId?: string;
  providerKey?: string;
  modelLabel?: string;
  responseSummary?: string;
  safeErrorSummary?: string | RuntimeLlmCallSafeErrorSummaryLike;
  usage?: RuntimeLlmCallUsageLike;
  latencyMs?: number;
  retryCount?: number;
  timeoutMs?: number;
  warnings?: readonly string[];
  blockedReasons?: readonly string[];
  realProviderCalled?: boolean;
  networkAccessed?: boolean;
  sparkProviderCalled?: boolean;
  mockProviderCalled?: boolean;
  rawPromptStored?: boolean;
  rawMessagesStored?: boolean;
  rawResponseStored?: boolean;
  rawProviderResponseStored?: boolean;
  secretSafe?: boolean;
  previewOnly?: boolean;
  diagnosticOnly?: boolean;
  llmCallEnabled?: boolean;
  message?: string;
  metadata?: unknown;
  resultLikeForPersistence?: unknown;
}

export type RuntimeLlmCallExecutorLike = (
  request: RuntimeLlmCallRequestLike,
  options?: unknown,
) => Promise<RuntimeLlmCallResultLike> | RuntimeLlmCallResultLike;

export interface PersistRuntimeMockLlmCallInput {
  executionId: string;
  request: RuntimeLlmCallRequestLike;
  executor: RuntimeLlmCallExecutorLike;
  actorKind?: string;
  riskLevel?: string;
  metadata?: unknown;
  now?: string;
}

export interface PersistRuntimeMockLlmCallOptions {
  maxSummaryLength?: number;
  appendAuditLog?: boolean;
  appendRuntimeEvent?: boolean;
  executorOptions?: unknown;
  persistenceOptions?: PersistMockLlmCallPreviewOptions;
}

export interface PersistRuntimeMockLlmCallResult {
  ok: boolean;
  executionId: string;
  requestId?: string;
  previewOnly: true;
  diagnosticOnly: false;
  skeleton: {
    invoked: boolean;
    ok: boolean;
    providerKey?: string;
    modelLabel?: string;
    mockProviderCalled?: boolean;
    realProviderCalled?: boolean;
    networkAccessed?: boolean;
  };
  persisted: {
    llmCall: boolean;
    auditLog: boolean;
    event: boolean;
  };
  llmCallId?: string;
  auditLogId?: string;
  eventId?: string;
  warnings: string[];
  blockedReasons: string[];
  message: string;
}

export const RuntimeMockLlmPersistenceSafetyIssue = {
  MissingExecutionId: "missing_execution_id",
  MissingRequest: "missing_request",
  MissingExecutor: "missing_executor",
  UnsafeMetadata: "unsafe_metadata",
  ExecutorResultNotSecretSafe: "executor_result_not_secret_safe",
  ExecutorResultRealProviderCalled: "executor_result_real_provider_called",
  ExecutorResultNetworkAccessed: "executor_result_network_accessed",
  ExecutorResultSparkProviderCalled: "executor_result_spark_provider_called",
  ExecutorResultRawPromptStored: "executor_result_raw_prompt_stored",
  ExecutorResultRawMessagesStored: "executor_result_raw_messages_stored",
  ExecutorResultRawResponseStored: "executor_result_raw_response_stored",
  ExecutorResultRawProviderResponseStored:
    "executor_result_raw_provider_response_stored",
  ExecutorResultDiagnosticOnly: "executor_result_diagnostic_only",
  ExecutorResultLlmCallEnabled: "executor_result_llm_call_enabled",
  ExecutorThrewSafeError: "executor_threw_safe_error",
} as const;

export type RuntimeMockLlmPersistenceSafetyIssue =
  (typeof RuntimeMockLlmPersistenceSafetyIssue)[keyof typeof RuntimeMockLlmPersistenceSafetyIssue];

export interface RuntimeMockLlmSafeErrorSummary {
  errorKind: string;
  category:
    | "timeout"
    | "provider"
    | "policy"
    | "validation"
    | "retryable"
    | "unknown";
  message: string;
  retryable: boolean;
  secretSafe: true;
  rawErrorStored: false;
  rawProviderErrorStored: false;
  rawProviderResponseStored: false;
  headersStored: false;
  authorizationHeaderStored: false;
  stackStored: false;
  valuesStored: false;
  redactedSensitiveKeyCount: number;
  rawErrorDetailsRedacted: boolean;
  [key: string]: unknown;
}

export interface RuntimeMockLlmSafeErrorSummaryOptions {
  maxSummaryLength?: number;
}

export interface RuntimeMockLlmMetadataSummary {
  kind: string;
  keyCount: number;
  safeKeys: string[];
  redactedKeys: string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
  valuesStored: false;
}

export interface RuntimeMockLlmPersistenceMetadataSummary {
  kind: "runtime_mock_llm_persistence_summary";
  requestId?: string;
  providerKey: string;
  modelLabel: string;
  requestPurposeSummary?: string;
  mockProviderCalled: boolean;
  realProviderCalled: false;
  networkAccessed: false;
  sparkProviderCalled: false;
  reportedResultFlags: {
    mockProviderCalled: boolean;
    realProviderCalled: boolean;
    networkAccessed: boolean;
    sparkProviderCalled: boolean;
    rawPromptStored: boolean;
    rawMessagesStored: boolean;
    rawResponseStored: boolean;
    rawProviderResponseStored: boolean;
    secretSafe: boolean;
    llmCallEnabled: boolean;
    diagnosticOnly: boolean;
  };
  requestMetadataSummary?: RuntimeMockLlmMetadataSummary;
  inputMetadataSummary?: RuntimeMockLlmMetadataSummary;
  resultMetadataSummary?: RuntimeMockLlmMetadataSummary;
  resultLikeMetadataSummary?: RuntimeMockLlmMetadataSummary;
  safeErrorSummary?: AgentRuntimeRepositoryJsonValue;
  warningsCount: number;
  blockedReasons: string[];
  safetyIssues: RuntimeMockLlmPersistenceSafetyIssue[];
  previewOnly: true;
  diagnosticOnly: false;
  executable: false;
  realExecutionEnabled: false;
  llmCallEnabled: false;
  streamingEnabled: false;
  productionAuditEnabled: false;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  rawProviderResponseStored: false;
  authorizationHeaderStored: false;
  rawPayloadStored: false;
  valuesStored: false;
  persistedAtPreview?: string;
}

interface MapRuntimeLlmCallResultOptions {
  maxSummaryLength?: number;
  safetyIssues?: readonly RuntimeMockLlmPersistenceSafetyIssue[];
  warnings?: readonly string[];
  blockedReasons?: readonly string[];
  safeErrorSummary?: RuntimeMockLlmSafeErrorSummary;
}

const defaultMaxSummaryLength = 800;
const maxVisibleSummaryKeys = 12;
const redactedValue = "[redacted]";
const defaultProviderKind = "mock";
const defaultModelLabel = "mock-preview-model";

const sensitiveMetadataKeys = new Set(
  [
    "apiKey",
    "apiSecret",
    "secret",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "password",
    "credential",
    "credentials",
    "rawHeaders",
    "headers",
    "cookie",
    "setCookie",
    "privateKey",
    "clientSecret",
    "testapi",
    "XFYUN_SPARK_API_KEY",
    "XFYUN_SPARK_API_SECRET",
    "XFYUN_SPARK_API_TOKEN",
  ].map(normalizeMetadataKey),
);

const rawPayloadKeys = new Set(
  [
    "prompt",
    "rawPrompt",
    "fullPrompt",
    "messages",
    "rawMessages",
    "completion",
    "rawCompletion",
    "fullCompletion",
    "response",
    "rawResponse",
    "rawProviderResponse",
    "rawRequest",
    "rawRequestBody",
    "rawProviderError",
    "rawErrorDetails",
    "stack",
  ].map(normalizeMetadataKey),
);

export class PrismaRuntimeMockLlmCallPersistence {
  private readonly repository: AgentRuntimeRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistRuntimeMockLlmCallPreview(
    input: PersistRuntimeMockLlmCallInput,
    options: PersistRuntimeMockLlmCallOptions = {},
  ): Promise<PersistRuntimeMockLlmCallResult> {
    const maxSummaryLength = normalizeMaxSummaryLength(
      options.maxSummaryLength,
    );
    const validationIssues = validateInput(input);
    const requestId = normalizeOptionalText(input.request?.requestId);
    const executionId = normalizeOptionalText(input.executionId) ?? "";

    if (validationIssues.length > 0) {
      return createNotPersistedResult({
        executionId,
        requestId,
        validationIssues,
      });
    }

    let skeletonInvoked = false;
    let executorResult: RuntimeLlmCallResultLike;
    let executorThrew = false;
    let thrownSafeErrorSummary: RuntimeMockLlmSafeErrorSummary | undefined;

    try {
      skeletonInvoked = true;
      executorResult = await input.executor(
        input.request,
        options.executorOptions,
      );
    } catch (error) {
      executorThrew = true;
      thrownSafeErrorSummary = createRuntimeMockLlmSafeErrorSummary(error, {
        maxSummaryLength,
      });
      executorResult = createExecutorThrownResult({
        input,
        safeErrorSummary: thrownSafeErrorSummary,
        maxSummaryLength,
      });
    }

    const safetyIssues = normalizeSafetyIssues([
      ...detectRuntimeMockLlmPersistenceSafetyIssues(
        input.request,
        executorResult,
        input.metadata,
      ),
      ...(executorThrew
        ? [RuntimeMockLlmPersistenceSafetyIssue.ExecutorThrewSafeError]
        : []),
    ]);
    const resultBlockedReasons = normalizeUniqueStrings([
      ...normalizeStringArray(
        executorResult.blockedReasons,
        maxSummaryLength,
      ),
      ...safetyIssues,
    ]);
    const warnings = normalizeUniqueStrings([
      ...normalizeStringArray(executorResult.warnings, maxSummaryLength),
      ...safetyIssues,
      ...(resultBlockedReasons.length > 0
        ? ["runtime_mock_llm_result_saved_as_blocked_preview"]
        : []),
      "runtime_mock_llm_persistence_preview_only",
      "raw_prompt_not_stored",
      "raw_messages_not_stored",
      "raw_response_not_stored",
      "raw_provider_response_not_stored",
      "secret_not_stored",
      "authorization_header_not_stored",
    ]);
    const persistenceInput = mapRuntimeLlmCallResultToMockLlmPersistenceInput(
      executorResult,
      input,
      {
        maxSummaryLength,
        safetyIssues,
        warnings,
        blockedReasons: resultBlockedReasons,
        safeErrorSummary: thrownSafeErrorSummary,
      },
    );
    const persistenceResult = await persistMockLlmCallPreview(
      this.repository,
      persistenceInput,
      createMockPersistenceOptions(options, maxSummaryLength),
    );
    const persistedWarnings = normalizeUniqueStrings([
      ...warnings,
      ...persistenceResult.warnings,
    ]);
    const persistedBlockedReasons = normalizeUniqueStrings([
      ...resultBlockedReasons,
      ...extractPersistenceBlockedReasons(persistenceResult),
    ]);
    const skeletonOk =
      executorResult.ok === true &&
      safetyIssues.length === 0 &&
      resultBlockedReasons.length === 0;

    return {
      ok: persistenceResult.ok && skeletonOk,
      executionId: input.executionId,
      requestId: resolveRequestId(input.request, executorResult),
      previewOnly: true,
      diagnosticOnly: false,
      skeleton: {
        invoked: skeletonInvoked,
        ok: executorResult.ok === true,
        providerKey: sanitizeSummary(
          executorResult.providerKey,
          maxSummaryLength,
        ),
        modelLabel: sanitizeSummary(
          executorResult.modelLabel,
          maxSummaryLength,
        ),
        mockProviderCalled: executorResult.mockProviderCalled === true,
        realProviderCalled: executorResult.realProviderCalled === true,
        networkAccessed: executorResult.networkAccessed === true,
      },
      persisted: persistenceResult.persisted,
      llmCallId: persistenceResult.llmCallId,
      auditLogId: persistenceResult.auditLogId,
      eventId: persistenceResult.eventId,
      warnings: persistedWarnings,
      blockedReasons: persistedBlockedReasons,
      message: createRuntimePersistenceResultMessage({
        persistenceResult,
        skeletonOk,
        executorThrew,
        safetyIssues,
      }),
    };
  }
}

export async function persistRuntimeMockLlmCallPreview(
  repository: AgentRuntimeRepository,
  input: PersistRuntimeMockLlmCallInput,
  options: PersistRuntimeMockLlmCallOptions = {},
): Promise<PersistRuntimeMockLlmCallResult> {
  return new PrismaRuntimeMockLlmCallPersistence(
    repository,
  ).persistRuntimeMockLlmCallPreview(input, options);
}

export function mapRuntimeLlmCallResultToMockLlmPersistenceInput(
  result: RuntimeLlmCallResultLike,
  input: PersistRuntimeMockLlmCallInput,
  options: MapRuntimeLlmCallResultOptions = {},
): LlmCallPersistenceInput {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const resultLike = getRecord(result.resultLikeForPersistence);
  const safetyIssues = normalizeSafetyIssues(options.safetyIssues ?? []);
  const blockedReasons = normalizeUniqueStrings([
    ...normalizeStringArray(result.blockedReasons, maxSummaryLength),
    ...(options.blockedReasons ?? []),
    ...safetyIssues,
  ]);
  const warnings = normalizeUniqueStrings([
    ...normalizeStringArray(result.warnings, maxSummaryLength),
    ...(options.warnings ?? []),
  ]);
  const shouldPersistAsBlocked = blockedReasons.length > 0;
  const safeErrorSummary =
    options.safeErrorSummary ??
    createRuntimeMockLlmSafeErrorSummary(
      result.safeErrorSummary ?? getField(resultLike, "safeErrorSummary"),
      { maxSummaryLength },
    );
  const responseSummary =
    getSafeResultSummary(result, resultLike, maxSummaryLength) ??
    safeErrorSummary.message;
  const mockResult: LlmChatCompletionResultLike = {
    ok: result.ok === true && !shouldPersistAsBlocked,
    providerKey:
      sanitizeSummary(
        result.providerKey ?? getField(resultLike, "providerKey"),
        maxSummaryLength,
      ) ?? defaultProviderKind,
    modelLabel: resolveModelLabel(result, resultLike, input, maxSummaryLength),
    responseSummary: sanitizeSummary(responseSummary, maxSummaryLength),
    usage: createUsageLike(result.usage ?? getField(resultLike, "usage")),
    finishReason:
      result.ok === true && !shouldPersistAsBlocked
        ? "mock_preview"
        : "policy_blocked",
    error:
      result.ok === true && !shouldPersistAsBlocked
        ? undefined
        : {
            errorKind:
              blockedReasons[0] ??
              safeErrorSummary.errorKind ??
              "runtime_mock_llm_call_blocked",
            message: safeErrorSummary.message,
            retryable: safeErrorSummary.retryable,
            safeDetails: {
              blockedReasons,
              safetyIssues,
              previewOnly: true,
              diagnosticOnly: false,
              valuesStored: false,
            },
            secretSafe: true,
            rawProviderErrorStored: false,
          },
    warnings,
    llmCallEnabled: false,
    mockOnly: !shouldPersistAsBlocked,
    realProviderCalled: result.realProviderCalled === true,
    networkAccessed: result.networkAccessed === true,
    secretSafe: result.secretSafe !== false,
    rawPromptStored: result.rawPromptStored === true,
    rawMessagesStored: result.rawMessagesStored === true,
    rawCompletionStored: false,
    rawResponseStored:
      result.rawResponseStored === true ||
      result.rawProviderResponseStored === true,
    createdAt: normalizeOptionalText(input.now) ?? undefined,
    message:
      sanitizeSummary(result.message, maxSummaryLength) ??
      "Runtime mock LLM result-like was mapped to A113 mock persistence input.",
    blockedReasons,
    previewOnly: true,
    diagnosticOnly: false,
    rawProviderResponseStored: false,
  };

  return {
    executionId: input.executionId,
    requestId: resolveRequestId(input.request, result),
    providerKind: defaultProviderKind,
    modelLabel: resolveModelLabel(result, resultLike, input, maxSummaryLength),
    requestSummary: createRequestSummary(input.request, maxSummaryLength),
    purposeSummary: sanitizeSummary(
      input.request.purposeSummary,
      maxSummaryLength,
    ),
    result: mockResult,
    actorKind:
      sanitizeSummary(input.actorKind, maxSummaryLength) ?? "runtime_skeleton",
    riskLevel: sanitizeSummary(input.riskLevel, maxSummaryLength) ?? "low",
    metadata: createRuntimeMockLlmPersistenceMetadataSummary(
      input.request,
      result,
      { maxSummaryLength },
      {
        inputMetadata: input.metadata,
        safetyIssues,
        warnings,
        blockedReasons,
        safeErrorSummary,
        now: input.now,
      },
    ),
    now: input.now,
  };
}

export function createRuntimeMockLlmSafeErrorSummary(
  errorLike: unknown,
  options: RuntimeMockLlmSafeErrorSummaryOptions = {},
): RuntimeMockLlmSafeErrorSummary {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const errorObject = getRecord(errorLike);
  const rawErrorKind =
    getSafeStringField(errorObject, "errorKind") ??
    getSafeStringField(errorObject, "kind") ??
    getSafeStringField(errorObject, "code") ??
    (errorLike instanceof Error ? errorLike.name : undefined) ??
    "runtime_mock_llm_safe_error";
  const rawMessage =
    getSafeStringField(errorObject, "message") ??
    (errorLike instanceof Error ? errorLike.message : undefined) ??
    (typeof errorLike === "string" ? errorLike : undefined) ??
    "Runtime mock LLM executor failed safely. Raw error details were not stored.";
  const keys = collectMetadataKeys(errorLike);

  if (errorLike instanceof Error) {
    keys.push("stack");
  }

  const redactedSensitiveKeyCount = keys.filter(
    (key) => isSensitiveKey(key) || isRawPayloadKey(key),
  ).length;
  const category = classifyErrorCategory(rawErrorKind, rawMessage);
  const retryable =
    getSafeBooleanField(errorObject, "retryable") ??
    category === "retryable";

  return {
    errorKind:
      sanitizeSummary(rawErrorKind, maxSummaryLength) ??
      "runtime_mock_llm_safe_error",
    category,
    message:
      sanitizeSummary(rawMessage, maxSummaryLength) ??
      "Runtime mock LLM error details were redacted.",
    retryable,
    secretSafe: true,
    rawErrorStored: false,
    rawProviderErrorStored: false,
    rawProviderResponseStored: false,
    headersStored: false,
    authorizationHeaderStored: false,
    stackStored: false,
    valuesStored: false,
    redactedSensitiveKeyCount,
    rawErrorDetailsRedacted: redactedSensitiveKeyCount > 0,
  };
}

export function detectRuntimeMockLlmPersistenceSafetyIssues(
  request: RuntimeLlmCallRequestLike | undefined,
  result?: RuntimeLlmCallResultLike,
  metadata?: unknown,
): RuntimeMockLlmPersistenceSafetyIssue[] {
  const issues: RuntimeMockLlmPersistenceSafetyIssue[] = [];

  if (request === undefined || request === null) {
    issues.push(RuntimeMockLlmPersistenceSafetyIssue.MissingRequest);
  }

  if (
    createMetadataSummary(metadata)?.sensitiveMetadataDetected === true ||
    createMetadataSummary(request?.metadata)?.sensitiveMetadataDetected ===
      true ||
    createMetadataSummary(result?.metadata)?.sensitiveMetadataDetected ===
      true ||
    createMetadataSummary(result?.resultLikeForPersistence)
      ?.sensitiveMetadataDetected === true ||
    createMetadataSummary(result?.safeErrorSummary)
      ?.sensitiveMetadataDetected === true
  ) {
    issues.push(RuntimeMockLlmPersistenceSafetyIssue.UnsafeMetadata);
  }

  if (result === undefined || result === null) {
    return normalizeSafetyIssues(issues);
  }

  if (result.secretSafe === false) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultNotSecretSafe,
    );
  }

  if (result.realProviderCalled === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultRealProviderCalled,
    );
  }

  if (result.networkAccessed === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultNetworkAccessed,
    );
  }

  if (result.sparkProviderCalled === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultSparkProviderCalled,
    );
  }

  if (result.rawPromptStored === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultRawPromptStored,
    );
  }

  if (result.rawMessagesStored === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultRawMessagesStored,
    );
  }

  if (result.rawResponseStored === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultRawResponseStored,
    );
  }

  if (result.rawProviderResponseStored === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue
        .ExecutorResultRawProviderResponseStored,
    );
  }

  if (result.diagnosticOnly === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultDiagnosticOnly,
    );
  }

  if (result.llmCallEnabled === true) {
    issues.push(
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorResultLlmCallEnabled,
    );
  }

  return normalizeSafetyIssues(issues);
}

export function createRuntimeMockLlmPersistenceMetadataSummary(
  request: RuntimeLlmCallRequestLike,
  result: RuntimeLlmCallResultLike,
  options: PersistRuntimeMockLlmCallOptions = {},
  evaluation: {
    inputMetadata?: unknown;
    safetyIssues?: readonly RuntimeMockLlmPersistenceSafetyIssue[];
    warnings?: readonly string[];
    blockedReasons?: readonly string[];
    safeErrorSummary?: RuntimeMockLlmSafeErrorSummary;
    now?: string;
  } = {},
): AgentRuntimeRepositoryJsonValue | undefined {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const resultLike = getRecord(result.resultLikeForPersistence);
  const safetyIssues = normalizeSafetyIssues(
    evaluation.safetyIssues ??
      detectRuntimeMockLlmPersistenceSafetyIssues(
        request,
        result,
        evaluation.inputMetadata,
      ),
  );
  const blockedReasons = normalizeUniqueStrings([
    ...normalizeStringArray(result.blockedReasons, maxSummaryLength),
    ...(evaluation.blockedReasons ?? []),
    ...safetyIssues,
  ]);
  const warnings = normalizeUniqueStrings([
    ...normalizeStringArray(result.warnings, maxSummaryLength),
    ...(evaluation.warnings ?? []),
  ]);
  const summary: RuntimeMockLlmPersistenceMetadataSummary = {
    kind: "runtime_mock_llm_persistence_summary",
    requestId: resolveRequestId(request, result),
    providerKey:
      sanitizeSummary(
        result.providerKey ?? getField(resultLike, "providerKey"),
        maxSummaryLength,
      ) ?? defaultProviderKind,
    modelLabel: resolveModelLabel(result, resultLike, { request }, maxSummaryLength),
    requestPurposeSummary: sanitizeSummary(
      request.purposeSummary,
      maxSummaryLength,
    ),
    mockProviderCalled: result.mockProviderCalled === true,
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    reportedResultFlags: {
      mockProviderCalled: result.mockProviderCalled === true,
      realProviderCalled: result.realProviderCalled === true,
      networkAccessed: result.networkAccessed === true,
      sparkProviderCalled: result.sparkProviderCalled === true,
      rawPromptStored: result.rawPromptStored === true,
      rawMessagesStored: result.rawMessagesStored === true,
      rawResponseStored: result.rawResponseStored === true,
      rawProviderResponseStored: result.rawProviderResponseStored === true,
      secretSafe: result.secretSafe !== false,
      llmCallEnabled: result.llmCallEnabled === true,
      diagnosticOnly: result.diagnosticOnly === true,
    },
    requestMetadataSummary: createMetadataSummary(request.metadata),
    inputMetadataSummary: createMetadataSummary(evaluation.inputMetadata),
    resultMetadataSummary: createMetadataSummary(result.metadata),
    resultLikeMetadataSummary: createMetadataSummary(
      result.resultLikeForPersistence,
    ),
    safeErrorSummary: toRepositoryJsonValue(
      evaluation.safeErrorSummary ??
        createRuntimeMockLlmSafeErrorSummary(result.safeErrorSummary, {
          maxSummaryLength,
        }),
    ),
    warningsCount: warnings.length,
    blockedReasons,
    safetyIssues,
    previewOnly: true,
    diagnosticOnly: false,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    productionAuditEnabled: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    authorizationHeaderStored: false,
    rawPayloadStored: false,
    valuesStored: false,
    persistedAtPreview: normalizeOptionalText(evaluation.now) ?? undefined,
  };

  return toRepositoryJsonValue(summary);
}

function validateInput(
  input: PersistRuntimeMockLlmCallInput,
): RuntimeMockLlmPersistenceSafetyIssue[] {
  const issues: RuntimeMockLlmPersistenceSafetyIssue[] = [];

  if (normalizeOptionalText(input.executionId) === null) {
    issues.push(RuntimeMockLlmPersistenceSafetyIssue.MissingExecutionId);
  }

  if (input.request === undefined || input.request === null) {
    issues.push(RuntimeMockLlmPersistenceSafetyIssue.MissingRequest);
  }

  if (typeof input.executor !== "function") {
    issues.push(RuntimeMockLlmPersistenceSafetyIssue.MissingExecutor);
  }

  return normalizeSafetyIssues(issues);
}

function createNotPersistedResult(input: {
  readonly executionId: string;
  readonly requestId: string | null;
  readonly validationIssues: readonly RuntimeMockLlmPersistenceSafetyIssue[];
}): PersistRuntimeMockLlmCallResult {
  return {
    ok: false,
    executionId: input.executionId,
    requestId: input.requestId ?? undefined,
    previewOnly: true,
    diagnosticOnly: false,
    skeleton: {
      invoked: false,
      ok: false,
      mockProviderCalled: false,
      realProviderCalled: false,
      networkAccessed: false,
    },
    persisted: {
      llmCall: false,
      auditLog: false,
      event: false,
    },
    warnings: normalizeUniqueStrings(input.validationIssues),
    blockedReasons: normalizeUniqueStrings(input.validationIssues),
    message:
      "Runtime mock LLM call persistence preview was blocked before executor invocation because required input was missing.",
  };
}

function createExecutorThrownResult(input: {
  readonly input: PersistRuntimeMockLlmCallInput;
  readonly safeErrorSummary: RuntimeMockLlmSafeErrorSummary;
  readonly maxSummaryLength: number;
}): RuntimeLlmCallResultLike {
  return {
    ok: false,
    requestId: normalizeOptionalText(input.input.request.requestId) ?? undefined,
    providerKey:
      sanitizeSummary(input.input.request.providerKey, input.maxSummaryLength) ??
      defaultProviderKind,
    modelLabel:
      sanitizeSummary(input.input.request.modelLabel, input.maxSummaryLength) ??
      defaultModelLabel,
    safeErrorSummary: input.safeErrorSummary,
    warnings: [RuntimeMockLlmPersistenceSafetyIssue.ExecutorThrewSafeError],
    blockedReasons: [
      RuntimeMockLlmPersistenceSafetyIssue.ExecutorThrewSafeError,
    ],
    realProviderCalled: false,
    networkAccessed: false,
    sparkProviderCalled: false,
    mockProviderCalled: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    secretSafe: true,
    previewOnly: true,
    diagnosticOnly: false,
    llmCallEnabled: false,
    message: input.safeErrorSummary.message,
  };
}

function createMockPersistenceOptions(
  options: PersistRuntimeMockLlmCallOptions,
  maxSummaryLength: number,
): PersistMockLlmCallPreviewOptions {
  return {
    ...options.persistenceOptions,
    maxSummaryLength:
      options.persistenceOptions?.maxSummaryLength ?? maxSummaryLength,
    appendAuditLog:
      options.appendAuditLog ?? options.persistenceOptions?.appendAuditLog,
    appendRuntimeEvent:
      options.appendRuntimeEvent ??
      options.persistenceOptions?.appendRuntimeEvent,
  };
}

function createRequestSummary(
  request: RuntimeLlmCallRequestLike,
  maxSummaryLength: number,
): string {
  const parts = [
    sanitizeSummary(request.purposeSummary, maxSummaryLength),
    sanitizeSummary(request.inputSummary, maxSummaryLength),
    sanitizeSummary(request.messagesSummary, maxSummaryLength),
  ].filter((part): part is string => part !== undefined);
  const summary =
    parts.length > 0
      ? parts.join(" | ")
      : "Runtime mock LLM request summary only; raw prompt and raw messages were not stored.";

  return sanitizeSummary(summary, maxSummaryLength) as string;
}

function getSafeResultSummary(
  result: RuntimeLlmCallResultLike,
  resultLike: Record<string, unknown> | undefined,
  maxSummaryLength: number,
): string | undefined {
  return (
    sanitizeSummary(result.responseSummary, maxSummaryLength) ??
    sanitizeSummary(getField(resultLike, "responseSummary"), maxSummaryLength) ??
    sanitizeSummary(result.message, maxSummaryLength) ??
    sanitizeSummary(getField(resultLike, "message"), maxSummaryLength)
  );
}

function resolveRequestId(
  request: RuntimeLlmCallRequestLike,
  result: RuntimeLlmCallResultLike,
): string | undefined {
  return (
    normalizeOptionalText(result.requestId) ??
    normalizeOptionalText(request.requestId) ??
    undefined
  );
}

function resolveModelLabel(
  result: RuntimeLlmCallResultLike,
  resultLike: Record<string, unknown> | undefined,
  input: Pick<PersistRuntimeMockLlmCallInput, "request">,
  maxSummaryLength: number,
): string {
  return (
    sanitizeSummary(result.modelLabel, maxSummaryLength) ??
    sanitizeSummary(getField(resultLike, "modelLabel"), maxSummaryLength) ??
    sanitizeSummary(input.request.modelLabel, maxSummaryLength) ??
    defaultModelLabel
  );
}

function createUsageLike(value: unknown): RuntimeLlmCallUsageLike | undefined {
  const usage = getRecord(value);
  const estimatedInputTokens = normalizeOptionalNonNegativeInteger(
    usage?.estimatedInputTokens,
  );
  const estimatedOutputTokens = normalizeOptionalNonNegativeInteger(
    usage?.estimatedOutputTokens,
  );
  const totalEstimatedTokens = normalizeOptionalNonNegativeInteger(
    usage?.totalEstimatedTokens,
  );

  if (
    estimatedInputTokens === undefined &&
    estimatedOutputTokens === undefined &&
    totalEstimatedTokens === undefined
  ) {
    return undefined;
  }

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    totalEstimatedTokens:
      totalEstimatedTokens ??
      (estimatedInputTokens ?? 0) + (estimatedOutputTokens ?? 0),
  };
}

function createRuntimePersistenceResultMessage(input: {
  readonly persistenceResult: PersistMockLlmCallPreviewResult;
  readonly skeletonOk: boolean;
  readonly executorThrew: boolean;
  readonly safetyIssues: readonly RuntimeMockLlmPersistenceSafetyIssue[];
}): string {
  if (input.executorThrew) {
    return "Persisted runtime mock LLM call preview as a safe executor error. No raw error stack, raw prompt, raw messages, raw response, secret, Spark call, network request, UI call, or Agent loop was used.";
  }

  if (input.safetyIssues.length > 0) {
    return "Persisted runtime mock LLM call preview as blocked because the executor result crossed the mock-only safety boundary. No raw prompt, raw messages, raw response, raw provider response, or secret was stored.";
  }

  if (!input.skeletonOk) {
    return "Persisted runtime mock LLM call preview for a blocked or failed skeleton result. This remains mock-only preview persistence.";
  }

  return input.persistenceResult.message;
}

function extractPersistenceBlockedReasons(
  result: PersistMockLlmCallPreviewResult,
): string[] {
  return result.warnings.includes(
    "dangerous_result_detected_saved_as_blocked_preview",
  )
    ? ["dangerous_result_detected_saved_as_blocked_preview"]
    : [];
}

function createMetadataSummary(
  value: unknown,
): RuntimeMockLlmMetadataSummary | undefined {
  if (value === undefined) {
    return undefined;
  }

  const keys = collectMetadataKeys(value);
  const safeKeys = normalizeUniqueStrings(
    keys
      .filter((key) => !isSensitiveKey(key))
      .filter((key) => !isRawPayloadKey(key))
      .map(sanitizeMetadataKey),
  );
  const redactedKeys = normalizeUniqueStrings(
    keys
      .filter((key) => isSensitiveKey(key) || isRawPayloadKey(key))
      .map(sanitizeMetadataKey),
  );
  const visibleSafeKeys = safeKeys.slice(0, maxVisibleSummaryKeys);

  return {
    kind: getMetadataKind(value),
    keyCount: keys.length,
    safeKeys: visibleSafeKeys,
    redactedKeys: redactedKeys.slice(0, maxVisibleSummaryKeys),
    sensitiveMetadataDetected: redactedKeys.length > 0,
    redactedSensitiveKeyCount: redactedKeys.length,
    truncated:
      safeKeys.length > visibleSafeKeys.length ||
      redactedKeys.length > maxVisibleSummaryKeys,
    valuesStored: false,
  };
}

function collectMetadataKeys(value: unknown): string[] {
  const keys: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (current: unknown): void => {
    if (current instanceof Error) {
      keys.push("name", "message", "stack");
      return;
    }

    if (current === null || typeof current !== "object") {
      return;
    }

    if (seen.has(current)) {
      return;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    if (!isPlainObject(current)) {
      return;
    }

    for (const [key, nestedValue] of Object.entries(current)) {
      keys.push(key);
      visit(nestedValue);
    }
  };

  visit(value);

  return normalizeUniqueStrings(keys);
}

function toRepositoryJsonValue(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  const sanitized = sanitizeJsonValue(value, new WeakSet<object>());

  if (sanitized === undefined || sanitized === null) {
    return undefined;
  }

  return sanitized as AgentRuntimeRepositoryJsonValue;
}

function sanitizeJsonValue(
  value: unknown,
  seenObjects: WeakSet<object>,
): RuntimeMockLlmJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeInlineSecrets(value, defaultMaxSummaryLength);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seenObjects.has(value)) {
      return undefined;
    }

    seenObjects.add(value);

    return value
      .map((item) => sanitizeJsonValue(item, seenObjects))
      .filter((item): item is RuntimeMockLlmJsonValue => item !== undefined);
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seenObjects.has(value) || !isPlainObject(value)) {
    return undefined;
  }

  seenObjects.add(value);

  const output: RuntimeMockLlmJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key) || isRawPayloadKey(key)) {
      output[key] = redactedValue;
      continue;
    }

    const sanitizedNestedValue = sanitizeJsonValue(
      nestedValue,
      seenObjects,
    );

    if (sanitizedNestedValue !== undefined) {
      output[key] = sanitizedNestedValue;
    }
  }

  return output;
}

function sanitizeSummary(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return undefined;
  }

  return sanitizeInlineSecrets(normalized, maxLength);
}

function sanitizeInlineSecrets(value: string, maxLength: number): string {
  const redacted = value
    .replace(
      /\b(api[-_ ]?key|api[-_ ]?secret|access[-_ ]?token|refresh[-_ ]?token|authorization|password|secret|credential|credentials|cookie|private[-_ ]?key|client[-_ ]?secret|token|testapi|xfyun[-_ ]?spark[-_ ]?api[-_ ]?key|xfyun[-_ ]?spark[-_ ]?api[-_ ]?secret|xfyun[-_ ]?spark[-_ ]?api[-_ ]?token)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(raw[-_ ]?prompt|raw[-_ ]?messages|raw[-_ ]?completion|raw[-_ ]?request|raw[-_ ]?request[-_ ]?body|raw[-_ ]?response|raw[-_ ]?provider[-_ ]?response|raw[-_ ]?headers|headers|stack)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    );

  return redacted.length > maxLength
    ? `${redacted.slice(0, Math.max(maxLength - 3, 0))}...`
    : redacted;
}

function normalizeStringArray(
  value: unknown,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeUniqueStrings(
    value
      .map((item) => sanitizeSummary(item, maxLength))
      .filter((item): item is string => item !== undefined),
  );
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      output.push(normalized);
    }
  }

  return output;
}

function normalizeSafetyIssues(
  values: readonly RuntimeMockLlmPersistenceSafetyIssue[],
): RuntimeMockLlmPersistenceSafetyIssue[] {
  return normalizeUniqueStrings(values) as RuntimeMockLlmPersistenceSafetyIssue[];
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNonNegativeInteger(
  value: unknown,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(Math.trunc(value), 0);
}

function normalizeMaxSummaryLength(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 120) {
    return defaultMaxSummaryLength;
  }

  return Math.trunc(value);
}

function getMetadataKind(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  if (value instanceof Error) {
    return "error";
  }

  return typeof value;
}

function classifyErrorCategory(
  errorKind: string,
  message: string,
): RuntimeMockLlmSafeErrorSummary["category"] {
  const text = `${errorKind} ${message}`.toLowerCase();

  if (text.includes("timeout")) {
    return "timeout";
  }

  if (text.includes("policy") || text.includes("blocked")) {
    return "policy";
  }

  if (text.includes("validation") || text.includes("missing")) {
    return "validation";
  }

  if (text.includes("retry") || text.includes("transient")) {
    return "retryable";
  }

  if (text.includes("provider")) {
    return "provider";
  }

  return "unknown";
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
}

function getField(
  record: Record<string, unknown> | undefined,
  field: string,
): unknown {
  return record?.[field];
}

function getSafeStringField(
  record: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  return sanitizeSummary(record?.[field], defaultMaxSummaryLength);
}

function getSafeBooleanField(
  record: Record<string, unknown> | undefined,
  field: string,
): boolean | undefined {
  return typeof record?.[field] === "boolean"
    ? (record[field] as boolean)
    : undefined;
}

function isSensitiveKey(key: string): boolean {
  return sensitiveMetadataKeys.has(normalizeMetadataKey(key));
}

function isRawPayloadKey(key: string): boolean {
  return rawPayloadKeys.has(normalizeMetadataKey(key));
}

function sanitizeMetadataKey(value: string): string {
  return value.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
