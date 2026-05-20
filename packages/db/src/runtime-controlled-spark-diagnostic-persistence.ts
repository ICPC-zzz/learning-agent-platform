import {
  persistSparkDiagnosticPreview,
  type PersistSparkDiagnosticPreviewOptions,
  type PersistSparkDiagnosticPreviewResult,
  type SparkControlledDiagnosticCallResultLike,
  type SparkDiagnosticPersistenceInput,
} from "./spark-diagnostic-persistence.js";
import type {
  AgentRuntimeRepository,
  AgentRuntimeRepositoryJsonValue,
} from "./repositories/agent-runtime-repository.js";

type RuntimeControlledSparkDiagnosticJsonPrimitive =
  | string
  | number
  | boolean
  | null;
type RuntimeControlledSparkDiagnosticJsonValue =
  | RuntimeControlledSparkDiagnosticJsonPrimitive
  | RuntimeControlledSparkDiagnosticJsonObject
  | RuntimeControlledSparkDiagnosticJsonValue[];

interface RuntimeControlledSparkDiagnosticJsonObject {
  [key: string]: RuntimeControlledSparkDiagnosticJsonValue;
}

export type ControlledSparkDiagnosticStatus =
  | "blocked"
  | "skipped"
  | "called_once"
  | "failed_safely"
  | string;

export interface ControlledSparkDiagnosticRequestLike {
  requestId?: string;
  executionId?: string;
  purposeSummary: string;
  invocationKind?: "cli_manual" | "server_only_scaffold" | string;
  allowRealCallConfirmation?: boolean;
  diagnosticOnly?: boolean;
  previewOnly?: boolean;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface ControlledSparkDiagnosticUsageLike {
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  totalEstimatedTokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ControlledSparkDiagnosticResultLike {
  ok?: boolean;
  status?: ControlledSparkDiagnosticStatus;
  providerKey?: string;
  modelLabel?: string;
  requestId?: string;
  responseSummary?: string;
  safeErrorSummary?: unknown;
  usage?: ControlledSparkDiagnosticUsageLike;
  latencyMs?: number;
  retryCount?: number;
  timeoutMs?: number;
  warnings?: readonly string[];
  blockedReasons?: readonly string[];
  llmResultLike?: unknown;
  redactedConfigSummary?: unknown;
  externalRequestAttempted?: boolean;
  externalRequestCount?: number;
  possibleCostIncurred?: boolean;
  secretSafe?: boolean;
  realProviderCalled?: boolean;
  networkAccessed?: boolean;
  rawPromptStored?: boolean;
  rawMessagesStored?: boolean;
  rawResponseStored?: boolean;
  rawProviderResponseStored?: boolean;
  authorizationHeaderPrinted?: boolean;
  previewOnly?: boolean;
  diagnosticOnly?: boolean;
  message?: string;
  metadata?: unknown;
  [key: string]: unknown;
}

export type ControlledSparkDiagnosticExecutorLike = (
  request: ControlledSparkDiagnosticRequestLike,
  options?: unknown,
) =>
  | Promise<ControlledSparkDiagnosticResultLike>
  | ControlledSparkDiagnosticResultLike;

export interface PersistRuntimeControlledSparkDiagnosticInput {
  executionId: string;
  request: ControlledSparkDiagnosticRequestLike;
  executor: ControlledSparkDiagnosticExecutorLike;
  actorKind?: string;
  riskLevel?: string;
  metadata?: unknown;
  now?: string;
}

export interface PersistRuntimeControlledSparkDiagnosticOptions {
  maxSummaryLength?: number;
  appendAuditLog?: boolean;
  appendRuntimeEvent?: boolean;
  executorOptions?: unknown;
  persistenceOptions?: PersistSparkDiagnosticPreviewOptions;
  allowOnlyDiagnosticResults?: true;
}

export interface PersistRuntimeControlledSparkDiagnosticResult {
  ok: boolean;
  executionId: string;
  requestId?: string;
  previewOnly: true;
  diagnosticOnly: true;
  diagnostic: {
    invoked: boolean;
    ok: boolean;
    status?: string;
    externalRequestAttempted?: boolean;
    externalRequestCount?: number;
    possibleCostIncurred?: boolean;
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

export const RuntimeControlledSparkDiagnosticPersistenceSafetyIssue = {
  MissingExecutionId: "missing_execution_id",
  MissingRequest: "missing_request",
  MissingExecutor: "missing_executor",
  UnsafeMetadata: "unsafe_metadata",
  ExecutorResultNotDiagnostic: "executor_result_not_diagnostic",
  ExecutorResultNotSecretSafe: "executor_result_not_secret_safe",
  ExecutorResultExternalRequestCountTooHigh:
    "executor_result_external_request_count_too_high",
  ExecutorResultRawPromptStored: "executor_result_raw_prompt_stored",
  ExecutorResultRawMessagesStored: "executor_result_raw_messages_stored",
  ExecutorResultRawResponseStored: "executor_result_raw_response_stored",
  ExecutorResultRawProviderResponseStored:
    "executor_result_raw_provider_response_stored",
  ExecutorResultAuthorizationHeaderPrinted:
    "executor_result_authorization_header_printed",
  ExecutorThrewSafeError: "executor_threw_safe_error",
} as const;

export type RuntimeControlledSparkDiagnosticPersistenceSafetyIssue =
  (typeof RuntimeControlledSparkDiagnosticPersistenceSafetyIssue)[keyof typeof RuntimeControlledSparkDiagnosticPersistenceSafetyIssue];

export interface RuntimeControlledSparkDiagnosticSafeErrorSummary {
  errorKind: string;
  category:
    | "timeout"
    | "auth"
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

export interface RuntimeControlledSparkDiagnosticSafeErrorSummaryOptions {
  maxSummaryLength?: number;
}

export interface RuntimeControlledSparkDiagnosticMetadataSummary {
  kind: string;
  keyCount: number;
  safeKeys: string[];
  redactedKeys: string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
  valuesStored: false;
}

export interface RuntimeControlledSparkDiagnosticPersistenceMetadataSummary {
  kind: "runtime_controlled_spark_diagnostic_persistence_summary";
  requestId?: string;
  providerKey: string;
  modelLabel: string;
  requestPurposeSummary?: string;
  invocationKind?: string;
  diagnosticOnly: true;
  previewOnly: true;
  externalRequestAttempted: boolean;
  externalRequestCount: number;
  possibleCostIncurred: boolean;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  reportedResultFlags: {
    diagnosticOnly: boolean;
    previewOnly: boolean;
    secretSafe: boolean;
    rawPromptStored: boolean;
    rawMessagesStored: boolean;
    rawResponseStored: boolean;
    rawProviderResponseStored: boolean;
    authorizationHeaderPrinted: boolean;
    externalRequestCount: number;
    realProviderCalled: boolean;
    networkAccessed: boolean;
  };
  requestMetadataSummary?: RuntimeControlledSparkDiagnosticMetadataSummary;
  inputMetadataSummary?: RuntimeControlledSparkDiagnosticMetadataSummary;
  resultMetadataSummary?: RuntimeControlledSparkDiagnosticMetadataSummary;
  redactedConfigMetadataSummary?: RuntimeControlledSparkDiagnosticMetadataSummary;
  safeErrorSummary?: AgentRuntimeRepositoryJsonValue;
  warningsCount: number;
  blockedReasons: string[];
  safetyIssues: RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
  notRuntimeBusinessCall: true;
  executable: false;
  realExecutionEnabled: false;
  llmCallEnabled: false;
  streamingEnabled: false;
  toolCallingEnabled: false;
  agentLoopEnabled: false;
  uiInvocationEnabled: false;
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

interface MapControlledSparkDiagnosticResultOptions {
  maxSummaryLength?: number;
  safetyIssues?: readonly RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
  warnings?: readonly string[];
  blockedReasons?: readonly string[];
  safeErrorSummary?: RuntimeControlledSparkDiagnosticSafeErrorSummary;
  inputMetadata?: unknown;
}

const defaultMaxSummaryLength = 800;
const maxVisibleSummaryKeys = 12;
const redactedValue = "[redacted]";
const defaultProviderKey = "spark_test";
const defaultModelLabel = "Spark Ultra-32K";

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

export class PrismaRuntimeControlledSparkDiagnosticPersistence {
  private readonly repository: AgentRuntimeRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistRuntimeControlledSparkDiagnosticPreview(
    input: PersistRuntimeControlledSparkDiagnosticInput,
    options: PersistRuntimeControlledSparkDiagnosticOptions = {},
  ): Promise<PersistRuntimeControlledSparkDiagnosticResult> {
    const maxSummaryLength = normalizeMaxSummaryLength(
      options.maxSummaryLength,
    );
    const validationIssues = validateInput(input);
    const executionId = normalizeOptionalText(input.executionId) ?? "";
    const requestId = normalizeOptionalText(input.request?.requestId);

    if (validationIssues.length > 0) {
      return createNotPersistedResult({
        executionId,
        requestId,
        validationIssues,
      });
    }

    let diagnosticInvoked = false;
    let executorResult: ControlledSparkDiagnosticResultLike;
    let executorThrew = false;
    let thrownSafeErrorSummary:
      | RuntimeControlledSparkDiagnosticSafeErrorSummary
      | undefined;

    try {
      diagnosticInvoked = true;
      executorResult = await input.executor(
        input.request,
        options.executorOptions,
      );
    } catch (error) {
      executorThrew = true;
      thrownSafeErrorSummary =
        createRuntimeControlledSparkDiagnosticSafeErrorSummary(error, {
          maxSummaryLength,
        });
      executorResult = createExecutorThrownResult({
        input,
        safeErrorSummary: thrownSafeErrorSummary,
        maxSummaryLength,
      });
    }

    const safetyIssues = normalizeSafetyIssues([
      ...detectRuntimeControlledSparkDiagnosticPersistenceSafetyIssues(
        input.request,
        executorResult,
        input.metadata,
      ),
      ...(executorThrew
        ? [
            RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
              .ExecutorThrewSafeError,
          ]
        : []),
    ]);
    const blockedReasons = normalizeUniqueStrings([
      ...normalizeStringArray(
        executorResult.blockedReasons,
        maxSummaryLength,
      ),
      ...safetyIssues,
    ]);
    const warnings = normalizeUniqueStrings([
      ...normalizeStringArray(executorResult.warnings, maxSummaryLength),
      ...safetyIssues,
      ...(blockedReasons.length > 0
        ? ["runtime_controlled_spark_diagnostic_saved_as_blocked_preview"]
        : []),
      "runtime_controlled_spark_diagnostic_persistence_preview_only",
      "diagnostic_only_true",
      "not_runtime_business_call",
      "raw_prompt_not_stored",
      "raw_messages_not_stored",
      "raw_response_not_stored",
      "raw_provider_response_not_stored",
      "secret_not_stored",
      "authorization_header_not_stored",
    ]);
    const safeErrorSummary =
      thrownSafeErrorSummary ??
      createRuntimeControlledSparkDiagnosticSafeErrorSummary(
        executorResult.safeErrorSummary ?? executorResult.llmResultLike,
        { maxSummaryLength },
      );
    const sparkPersistenceInput =
      mapControlledSparkDiagnosticResultToSparkPersistenceInput(
        executorResult,
        input,
        {
          maxSummaryLength,
          inputMetadata: input.metadata,
          safetyIssues,
          warnings,
          blockedReasons,
          safeErrorSummary,
        },
      );
    const persistenceResult = await persistSparkDiagnosticPreview(
      this.repository,
      sparkPersistenceInput,
      createSparkPersistenceOptions(options, maxSummaryLength),
    );
    const persistedWarnings = normalizeUniqueStrings([
      ...warnings,
      ...persistenceResult.warnings,
    ]);
    const persistedBlockedReasons = normalizeUniqueStrings([
      ...blockedReasons,
      ...persistenceResult.blockedReasons,
    ]);
    const diagnosticOk =
      executorResult.ok === true &&
      safetyIssues.length === 0 &&
      persistedBlockedReasons.length === 0;

    return {
      ok: persistenceResult.ok && diagnosticOk,
      executionId: input.executionId,
      requestId: resolveRequestId(input.request, executorResult),
      previewOnly: true,
      diagnosticOnly: true,
      diagnostic: {
        invoked: diagnosticInvoked,
        ok: executorResult.ok === true,
        status: sanitizeSummary(executorResult.status, maxSummaryLength),
        externalRequestAttempted:
          executorResult.externalRequestAttempted === true,
        externalRequestCount:
          normalizeOptionalNonNegativeInteger(
            executorResult.externalRequestCount,
          ) ?? 0,
        possibleCostIncurred: executorResult.possibleCostIncurred === true,
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
        diagnosticOk,
        executorThrew,
        safetyIssues,
      }),
    };
  }
}

export async function persistRuntimeControlledSparkDiagnosticPreview(
  repository: AgentRuntimeRepository,
  input: PersistRuntimeControlledSparkDiagnosticInput,
  options: PersistRuntimeControlledSparkDiagnosticOptions = {},
): Promise<PersistRuntimeControlledSparkDiagnosticResult> {
  return new PrismaRuntimeControlledSparkDiagnosticPersistence(
    repository,
  ).persistRuntimeControlledSparkDiagnosticPreview(input, options);
}

export function mapControlledSparkDiagnosticResultToSparkPersistenceInput(
  result: ControlledSparkDiagnosticResultLike,
  input: PersistRuntimeControlledSparkDiagnosticInput,
  options: MapControlledSparkDiagnosticResultOptions = {},
): SparkDiagnosticPersistenceInput {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
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
    createRuntimeControlledSparkDiagnosticSafeErrorSummary(
      result.safeErrorSummary ?? result.llmResultLike,
      { maxSummaryLength },
    );
  const metadataSummary =
    createRuntimeControlledSparkDiagnosticPersistenceMetadataSummary(
      input.request,
      result,
      { maxSummaryLength },
      {
        inputMetadata: options.inputMetadata,
        safetyIssues,
        warnings,
        blockedReasons,
        safeErrorSummary,
        now: input.now,
      },
    );
  const providerKey =
    sanitizeSummary(result.providerKey, maxSummaryLength) ??
    defaultProviderKey;
  const modelLabel =
    sanitizeSummary(result.modelLabel, maxSummaryLength) ?? defaultModelLabel;
  const status = shouldPersistAsBlocked
    ? "blocked"
    : (sanitizeSummary(result.status, maxSummaryLength) ??
      (result.ok === true ? "called_once" : "failed_safely"));
  const responseSummary =
    sanitizeSummary(result.responseSummary, maxSummaryLength) ??
    sanitizeSummary(result.message, maxSummaryLength) ??
    safeErrorSummary.message;

  return {
    executionId: input.executionId,
    requestId: resolveRequestId(input.request, result),
    purposeSummary: createRequestSummary(input.request, maxSummaryLength),
    result: {
      ok: result.ok === true && !shouldPersistAsBlocked,
      status,
      providerKey,
      modelLabel,
      requestId: resolveRequestId(input.request, result),
      responseSummary,
      safeErrorSummary:
        result.ok === true &&
        !shouldPersistAsBlocked &&
        result.safeErrorSummary === undefined
          ? undefined
          : safeErrorSummary,
      usage: createUsageLike(result.usage),
      latencyMs: normalizeOptionalNonNegativeInteger(result.latencyMs),
      retryCount: normalizeOptionalNonNegativeInteger(result.retryCount) ?? 0,
      timeoutMs: normalizeOptionalNonNegativeInteger(result.timeoutMs),
      warnings,
      blockedReasons,
      llmResultLike: undefined,
      redactedConfigSummary: sanitizeUnknownJson(
        result.redactedConfigSummary,
      ),
      externalRequestAttempted: result.externalRequestAttempted === true,
      externalRequestCount:
        normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
      possibleCostIncurred: result.possibleCostIncurred === true,
      secretSafe: result.secretSafe,
      realProviderCalled: result.realProviderCalled === true,
      networkAccessed: result.networkAccessed === true,
      rawPromptStored: result.rawPromptStored === true,
      rawMessagesStored: result.rawMessagesStored === true,
      rawResponseStored: result.rawResponseStored === true,
      rawProviderResponseStored: result.rawProviderResponseStored === true,
      authorizationHeaderPrinted:
        result.authorizationHeaderPrinted === true,
      previewOnly: true,
      diagnosticOnly: result.diagnosticOnly === true,
      message:
        sanitizeSummary(result.message, maxSummaryLength) ??
        "Runtime controlled Spark diagnostic result-like was mapped to A119 Spark diagnostic persistence input.",
      metadata: metadataSummary,
    } satisfies SparkControlledDiagnosticCallResultLike,
    actorKind:
      sanitizeSummary(input.actorKind, maxSummaryLength) ??
      "system_diagnostic",
    riskLevel:
      sanitizeSummary(input.riskLevel, maxSummaryLength) ??
      (result.externalRequestAttempted === true ||
      result.possibleCostIncurred === true
        ? "medium"
        : "low"),
    metadata: metadataSummary,
    now: input.now,
  };
}

export function createRuntimeControlledSparkDiagnosticSafeErrorSummary(
  errorLike: unknown,
  options: RuntimeControlledSparkDiagnosticSafeErrorSummaryOptions = {},
): RuntimeControlledSparkDiagnosticSafeErrorSummary {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const errorObject = getRecord(errorLike);
  const rawErrorKind =
    getSafeStringField(errorObject, "errorKind") ??
    getSafeStringField(errorObject, "kind") ??
    getSafeStringField(errorObject, "code") ??
    (errorLike instanceof Error ? errorLike.name : undefined) ??
    "runtime_controlled_spark_diagnostic_safe_error";
  const rawMessage =
    getSafeStringField(errorObject, "message") ??
    (errorLike instanceof Error ? errorLike.message : undefined) ??
    (typeof errorLike === "string" ? errorLike : undefined) ??
    "Runtime controlled Spark diagnostic executor failed safely. Raw error details were not stored.";
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
      "runtime_controlled_spark_diagnostic_safe_error",
    category,
    message:
      sanitizeSummary(rawMessage, maxSummaryLength) ??
      "Runtime controlled Spark diagnostic error details were redacted.",
    retryable: category === "timeout" ? false : retryable,
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

export function detectRuntimeControlledSparkDiagnosticPersistenceSafetyIssues(
  request: ControlledSparkDiagnosticRequestLike | undefined,
  result?: ControlledSparkDiagnosticResultLike,
  metadata?: unknown,
): RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[] {
  const issues: RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[] = [];

  if (request === undefined || request === null) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue.MissingRequest,
    );
  }

  if (
    createMetadataSummary(metadata)?.sensitiveMetadataDetected === true ||
    createMetadataSummary(request?.metadata)?.sensitiveMetadataDetected ===
      true ||
    createMetadataSummary(result?.metadata)?.sensitiveMetadataDetected ===
      true ||
    createMetadataSummary(result?.safeErrorSummary)
      ?.sensitiveMetadataDetected === true ||
    createMetadataSummary(result?.redactedConfigSummary)
      ?.sensitiveMetadataDetected === true
  ) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue.UnsafeMetadata,
    );
  }

  if (result === undefined || result === null) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultNotDiagnostic,
    );
    return normalizeSafetyIssues(issues);
  }

  if (result.diagnosticOnly !== true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultNotDiagnostic,
    );
  }

  if (result.secretSafe === false) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultNotSecretSafe,
    );
  }

  if ((normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0) > 1) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultExternalRequestCountTooHigh,
    );
  }

  if (result.rawPromptStored === true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultRawPromptStored,
    );
  }

  if (result.rawMessagesStored === true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultRawMessagesStored,
    );
  }

  if (result.rawResponseStored === true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultRawResponseStored,
    );
  }

  if (result.rawProviderResponseStored === true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultRawProviderResponseStored,
    );
  }

  if (result.authorizationHeaderPrinted === true) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorResultAuthorizationHeaderPrinted,
    );
  }

  return normalizeSafetyIssues(issues);
}

export function createRuntimeControlledSparkDiagnosticPersistenceMetadataSummary(
  request: ControlledSparkDiagnosticRequestLike,
  result: ControlledSparkDiagnosticResultLike,
  options: PersistRuntimeControlledSparkDiagnosticOptions = {},
  evaluation: {
    inputMetadata?: unknown;
    safetyIssues?: readonly RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
    warnings?: readonly string[];
    blockedReasons?: readonly string[];
    safeErrorSummary?: RuntimeControlledSparkDiagnosticSafeErrorSummary;
    now?: string;
  } = {},
): AgentRuntimeRepositoryJsonValue | undefined {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const safetyIssues = normalizeSafetyIssues(
    evaluation.safetyIssues ??
      detectRuntimeControlledSparkDiagnosticPersistenceSafetyIssues(
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
  const summary: RuntimeControlledSparkDiagnosticPersistenceMetadataSummary = {
    kind: "runtime_controlled_spark_diagnostic_persistence_summary",
    requestId: resolveRequestId(request, result),
    providerKey:
      sanitizeSummary(result.providerKey, maxSummaryLength) ??
      defaultProviderKey,
    modelLabel:
      sanitizeSummary(result.modelLabel, maxSummaryLength) ??
      defaultModelLabel,
    requestPurposeSummary: sanitizeSummary(
      request.purposeSummary,
      maxSummaryLength,
    ),
    invocationKind: sanitizeSummary(request.invocationKind, maxSummaryLength),
    diagnosticOnly: true,
    previewOnly: true,
    externalRequestAttempted: result.externalRequestAttempted === true,
    externalRequestCount:
      normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
    possibleCostIncurred: result.possibleCostIncurred === true,
    realProviderCalled: result.realProviderCalled === true,
    networkAccessed: result.networkAccessed === true,
    reportedResultFlags: {
      diagnosticOnly: result.diagnosticOnly === true,
      previewOnly: result.previewOnly === true,
      secretSafe: result.secretSafe !== false,
      rawPromptStored: result.rawPromptStored === true,
      rawMessagesStored: result.rawMessagesStored === true,
      rawResponseStored: result.rawResponseStored === true,
      rawProviderResponseStored: result.rawProviderResponseStored === true,
      authorizationHeaderPrinted:
        result.authorizationHeaderPrinted === true,
      externalRequestCount:
        normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
      realProviderCalled: result.realProviderCalled === true,
      networkAccessed: result.networkAccessed === true,
    },
    requestMetadataSummary: createMetadataSummary(request.metadata),
    inputMetadataSummary: createMetadataSummary(evaluation.inputMetadata),
    resultMetadataSummary: createMetadataSummary(result.metadata),
    redactedConfigMetadataSummary: createMetadataSummary(
      result.redactedConfigSummary,
    ),
    safeErrorSummary: toRepositoryJsonValue(
      evaluation.safeErrorSummary ??
        createRuntimeControlledSparkDiagnosticSafeErrorSummary(
          result.safeErrorSummary,
          { maxSummaryLength },
        ),
    ),
    warningsCount: warnings.length,
    blockedReasons,
    safetyIssues,
    notRuntimeBusinessCall: true,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    toolCallingEnabled: false,
    agentLoopEnabled: false,
    uiInvocationEnabled: false,
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
  input: PersistRuntimeControlledSparkDiagnosticInput,
): RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[] {
  const issues: RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[] = [];

  if (normalizeOptionalText(input.executionId) === null) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue.MissingExecutionId,
    );
  }

  if (input.request === undefined || input.request === null) {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue.MissingRequest,
    );
  }

  if (typeof input.executor !== "function") {
    issues.push(
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue.MissingExecutor,
    );
  }

  return normalizeSafetyIssues(issues);
}

function createNotPersistedResult(input: {
  readonly executionId: string;
  readonly requestId: string | null;
  readonly validationIssues: readonly RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
}): PersistRuntimeControlledSparkDiagnosticResult {
  return {
    ok: false,
    executionId: input.executionId,
    requestId: input.requestId ?? undefined,
    previewOnly: true,
    diagnosticOnly: true,
    diagnostic: {
      invoked: false,
      ok: false,
      externalRequestAttempted: false,
      externalRequestCount: 0,
      possibleCostIncurred: false,
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
      "Runtime controlled Spark diagnostic persistence preview was blocked before executor invocation because required input was missing.",
  };
}

function createExecutorThrownResult(input: {
  readonly input: PersistRuntimeControlledSparkDiagnosticInput;
  readonly safeErrorSummary: RuntimeControlledSparkDiagnosticSafeErrorSummary;
  readonly maxSummaryLength: number;
}): ControlledSparkDiagnosticResultLike {
  return {
    ok: false,
    status: "failed_safely",
    providerKey: defaultProviderKey,
    modelLabel: defaultModelLabel,
    requestId:
      normalizeOptionalText(input.input.request.requestId) ?? undefined,
    safeErrorSummary: input.safeErrorSummary,
    warnings: [
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorThrewSafeError,
    ],
    blockedReasons: [
      RuntimeControlledSparkDiagnosticPersistenceSafetyIssue
        .ExecutorThrewSafeError,
    ],
    externalRequestAttempted: false,
    externalRequestCount: 0,
    possibleCostIncurred: false,
    secretSafe: true,
    realProviderCalled: false,
    networkAccessed: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    authorizationHeaderPrinted: false,
    previewOnly: true,
    diagnosticOnly: true,
    message: input.safeErrorSummary.message,
  };
}

function createSparkPersistenceOptions(
  options: PersistRuntimeControlledSparkDiagnosticOptions,
  maxSummaryLength: number,
): PersistSparkDiagnosticPreviewOptions {
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
  request: ControlledSparkDiagnosticRequestLike,
  maxSummaryLength: number,
): string {
  const parts = [
    sanitizeSummary(request.purposeSummary, maxSummaryLength),
    sanitizeSummary(request.invocationKind, maxSummaryLength),
    "controlled_spark_diagnostic_only",
    "not_runtime_business_call",
    "raw_prompt_not_stored",
    "raw_messages_not_stored",
  ].filter((part): part is string => part !== undefined);

  return sanitizeSummary(parts.join(" | "), maxSummaryLength) as string;
}

function createRuntimePersistenceResultMessage(input: {
  readonly persistenceResult: PersistSparkDiagnosticPreviewResult;
  readonly diagnosticOk: boolean;
  readonly executorThrew: boolean;
  readonly safetyIssues: readonly RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
}): string {
  if (input.executorThrew) {
    return "Persisted runtime controlled Spark diagnostic preview as a safe executor error. The helper did not call Spark, access network, read env, save raw prompt, save raw response, expose secret, call UI, or enter Agent loop.";
  }

  if (input.safetyIssues.length > 0) {
    return "Persisted runtime controlled Spark diagnostic preview as blocked because the executor result crossed the diagnostic safety boundary. No raw prompt, raw messages, raw response, raw provider response, authorization header, or secret was stored.";
  }

  if (!input.diagnosticOk) {
    return "Persisted runtime controlled Spark diagnostic preview for a blocked, skipped, or failed diagnostic result. This remains diagnostic-only preview persistence and is not a runtime business call.";
  }

  return input.persistenceResult.message;
}

function resolveRequestId(
  request: ControlledSparkDiagnosticRequestLike,
  result: ControlledSparkDiagnosticResultLike,
): string | undefined {
  return (
    normalizeOptionalText(result.requestId) ??
    normalizeOptionalText(request.requestId) ??
    undefined
  );
}

function createUsageLike(
  value: ControlledSparkDiagnosticUsageLike | undefined,
): ControlledSparkDiagnosticUsageLike | undefined {
  const estimatedInputTokens = normalizeOptionalNonNegativeInteger(
    value?.estimatedInputTokens,
  );
  const estimatedOutputTokens = normalizeOptionalNonNegativeInteger(
    value?.estimatedOutputTokens,
  );
  const totalEstimatedTokens =
    normalizeOptionalNonNegativeInteger(value?.totalEstimatedTokens) ??
    normalizeOptionalNonNegativeInteger(value?.total_tokens) ??
    (estimatedInputTokens !== undefined || estimatedOutputTokens !== undefined
      ? (estimatedInputTokens ?? 0) + (estimatedOutputTokens ?? 0)
      : undefined);
  const promptTokens = normalizeOptionalNonNegativeInteger(
    value?.prompt_tokens,
  );
  const completionTokens = normalizeOptionalNonNegativeInteger(
    value?.completion_tokens,
  );

  if (
    estimatedInputTokens === undefined &&
    estimatedOutputTokens === undefined &&
    totalEstimatedTokens === undefined &&
    promptTokens === undefined &&
    completionTokens === undefined
  ) {
    return undefined;
  }

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    totalEstimatedTokens,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalEstimatedTokens,
  };
}

function createMetadataSummary(
  value: unknown,
): RuntimeControlledSparkDiagnosticMetadataSummary | undefined {
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
  const visibleRedactedKeys = redactedKeys.slice(0, maxVisibleSummaryKeys);

  return {
    kind: getMetadataKind(value),
    keyCount: keys.length,
    safeKeys: visibleSafeKeys,
    redactedKeys: visibleRedactedKeys,
    sensitiveMetadataDetected: redactedKeys.length > 0,
    redactedSensitiveKeyCount: redactedKeys.length,
    truncated:
      safeKeys.length > visibleSafeKeys.length ||
      redactedKeys.length > visibleRedactedKeys.length,
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

function sanitizeUnknownJson(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue(value);
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
): RuntimeControlledSparkDiagnosticJsonValue | undefined {
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
      .filter(
        (item): item is RuntimeControlledSparkDiagnosticJsonValue =>
          item !== undefined,
      );
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seenObjects.has(value) || !isPlainObject(value)) {
    return undefined;
  }

  seenObjects.add(value);

  const output: RuntimeControlledSparkDiagnosticJsonObject = {};

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
  values: readonly RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[],
): RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[] {
  return normalizeUniqueStrings(
    values,
  ) as RuntimeControlledSparkDiagnosticPersistenceSafetyIssue[];
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
): RuntimeControlledSparkDiagnosticSafeErrorSummary["category"] {
  const text = `${errorKind} ${message}`.toLowerCase();

  if (text.includes("timeout")) {
    return "timeout";
  }

  if (
    text.includes("auth") ||
    text.includes("authorization") ||
    text.includes("unauthorized")
  ) {
    return "auth";
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

  if (text.includes("provider") || text.includes("spark")) {
    return "provider";
  }

  return "unknown";
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isPlainObject(value) ? value : undefined;
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
