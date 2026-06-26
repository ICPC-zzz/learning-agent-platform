import type {
  AgentRuntimeAuditLogRecord,
  AgentRuntimeEventRecord,
  AgentRuntimeLlmCallRecord,
  AgentRuntimeRepository,
  AgentRuntimeRepositoryJsonValue,
  AppendRuntimeAuditLogPreviewInput,
  AppendRuntimeEventPreviewInput,
  AppendRuntimeLlmCallPreviewInput,
} from "./repositories/agent-runtime-repository.js";

type LlmCallPersistenceJsonPrimitive = string | number | boolean | null;
type LlmCallPersistenceJsonValue =
  | LlmCallPersistenceJsonPrimitive
  | LlmCallPersistenceJsonObject
  | LlmCallPersistenceJsonValue[];

interface LlmCallPersistenceJsonObject {
  [key: string]: LlmCallPersistenceJsonValue;
}

export const MockLlmCallPersistenceBlockedReason = {
  MissingExecutionId: "missing_execution_id",
  MissingProviderKey: "missing_provider_key",
  UnsafeMetadata: "unsafe_metadata",
  ResultNotSecretSafe: "result_not_secret_safe",
  ResultNotMockOnly: "result_not_mock_only",
  ResultIndicatesRealProviderCalled:
    "result_indicates_real_provider_called",
  ResultIndicatesNetworkAccess: "result_indicates_network_access",
  ResultIndicatesRawPromptStored:
    "result_indicates_raw_prompt_stored",
  ResultIndicatesRawMessagesStored:
    "result_indicates_raw_messages_stored",
  ResultIndicatesRawCompletionStored:
    "result_indicates_raw_completion_stored",
  ResultIndicatesRawResponseStored:
    "result_indicates_raw_response_stored",
  ResultIndicatesLlmCallEnabled:
    "result_indicates_llm_call_enabled",
  RawProviderErrorStored: "raw_provider_error_stored",
} as const;

export type MockLlmCallPersistenceBlockedReason =
  (typeof MockLlmCallPersistenceBlockedReason)[keyof typeof MockLlmCallPersistenceBlockedReason];

export interface LlmChatCompletionResultLike {
  ok?: boolean;
  providerKey?: string;
  modelLabel?: string;
  responseSummary?: string;
  usage?: {
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    totalEstimatedTokens?: number;
  };
  finishReason?: string;
  error?: {
    errorKind?: string;
    message?: string;
    retryable?: boolean;
    safeDetails?: unknown;
    secretSafe?: boolean;
    rawProviderErrorStored?: boolean;
  };
  warnings?: readonly string[];
  metadataSummary?: unknown;
  llmCallEnabled?: boolean;
  mockOnly?: boolean;
  realProviderCalled?: boolean;
  networkAccessed?: boolean;
  secretSafe?: boolean;
  rawPromptStored?: boolean;
  rawMessagesStored?: boolean;
  rawCompletionStored?: boolean;
  rawResponseStored?: boolean;
  createdAt?: string;
  message?: string;
  [key: string]: unknown;
}

export interface LlmCallPersistenceInput {
  executionId: string;
  stepId?: string;
  requestId?: string;
  providerKind?: string;
  modelLabel?: string;
  requestSummary?: string;
  purposeSummary?: string;
  result: LlmChatCompletionResultLike;
  actorKind?: string;
  riskLevel?: string;
  metadata?: unknown;
  now?: string;
}

export interface PersistMockLlmCallPreviewOptions {
  appendRuntimeEvent?: boolean;
  appendAuditLog?: boolean;
  maxSummaryLength?: number;
  includeMetadataSummary?: boolean;
}

export interface PersistMockLlmCallPreviewResult {
  ok: boolean;
  previewOnly: true;
  executionId: string;
  llmCallId?: string;
  auditLogId?: string;
  eventId?: string;
  persisted: {
    llmCall: boolean;
    auditLog: boolean;
    event: boolean;
  };
  warnings: string[];
  message: string;
}

interface MockLlmCallPersistenceRepository {
  appendRuntimeLlmCallPreview(
    executionId: string,
    input: AppendRuntimeLlmCallPreviewInput,
  ): Promise<AgentRuntimeLlmCallRecord>;
  appendRuntimeAuditLogPreview?(
    executionId: string,
    input: AppendRuntimeAuditLogPreviewInput,
  ): Promise<AgentRuntimeAuditLogRecord>;
  appendRuntimeEventPreview?(
    executionId: string,
    input: AppendRuntimeEventPreviewInput,
  ): Promise<AgentRuntimeEventRecord>;
}

interface MetadataSummary {
  kind: string;
  keyCount: number;
  safeKeys: string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
  valuesStored: false;
}

interface ResultSafetyEvaluation {
  status:
    | "mock_completed_preview"
    | "mock_failed_preview"
    | "blocked_preview";
  action:
    | "mock_llm_call_completed_preview"
    | "mock_llm_call_failed_preview"
    | "mock_llm_call_blocked_preview";
  eventKind:
    | "mock_llm_call_preview_persisted"
    | "mock_llm_call_failed_preview"
    | "mock_llm_call_blocked_preview";
  localBlockedReasons: MockLlmCallPersistenceBlockedReason[];
  blockedReasons: string[];
  dangerousResultDetected: boolean;
  unsafeMetadata: boolean;
  unsafeErrorSafeDetails: boolean;
  secretUnsafe: boolean;
}

const defaultMaxSummaryLength = 800;
const maxVisibleSummaryKeys = 12;
const redactedValue = "[redacted]";

const sensitiveMetadataKeys = new Set([
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
  "rawproviderresponse",
  "rawrequestbody",
]);

const rawPayloadKeys = new Set([
  "prompt",
  "rawprompt",
  "fullprompt",
  "messages",
  "rawmessages",
  "completion",
  "rawcompletion",
  "fullcompletion",
  "response",
  "rawresponse",
  "rawrequest",
  "rawrequestbody",
  "rawproviderresponse",
  "rawprovidererror",
]);

const previewBoundaryFlags = {
  previewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  schedulerEnabled: false,
  streamingEnabled: false,
  productionAuditEnabled: false,
  networkAccessed: false,
} as const satisfies LlmCallPersistenceJsonObject;

const previewSafetyFlags = {
  previewOnly: true,
  secretSafe: true,
  realProviderCalled: false,
  networkAccessed: false,
  rawPromptStored: false,
  rawMessagesStored: false,
  rawCompletionStored: false,
  rawResponseStored: false,
  rawProviderResponseStored: false,
  rawProviderErrorStored: false,
  realExecutionEnabled: false,
  llmCallEnabled: false,
  productionAuditEnabled: false,
} as const satisfies LlmCallPersistenceJsonObject;

export class AgentLlmCallPersistence {
  private readonly repository: MockLlmCallPersistenceRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistMockLlmCallPreview(
    input: LlmCallPersistenceInput,
    options: PersistMockLlmCallPreviewOptions = {},
  ): Promise<PersistMockLlmCallPreviewResult> {
    const maxSummaryLength = normalizeMaxSummaryLength(
      options.maxSummaryLength,
    );
    const validationWarnings = validatePersistenceInput(input);
    const inputWarnings = normalizeUniqueStrings([
      ...validationWarnings,
      ...normalizeStringArray(input.result.warnings, maxSummaryLength),
    ]);

    if (validationWarnings.length > 0) {
      return {
        ok: false,
        previewOnly: true,
        executionId: normalizeOptionalText(input.executionId) ?? "",
        persisted: {
          llmCall: false,
          auditLog: false,
          event: false,
        },
        warnings: inputWarnings,
        message:
          "Mock LLM call persistence preview was blocked before repository writes because required identifiers were missing.",
      };
    }

    const metadataSummary = createMetadataSummary(input.metadata);
    const providerMetadataSummary = options.includeMetadataSummary === false
      ? undefined
      : createProviderMetadataSummary(input.result.metadataSummary);
    const errorSafeDetailsSummary = createMetadataSummary(
      input.result.error?.safeDetails,
    );
    const safetyEvaluation = evaluateResultSafety({
      input,
      metadataSummary,
      providerMetadataSummary,
      errorSafeDetailsSummary,
    });
    const resultWarnings = createResultWarnings({
      safetyEvaluation,
      metadataSummary,
      providerMetadataSummary,
      errorSafeDetailsSummary,
    });
    const warnings = normalizeUniqueStrings([
      ...inputWarnings,
      ...resultWarnings,
    ]);
    const llmCallInput = createLlmCallInput({
      input,
      safetyEvaluation,
      metadataSummary,
      providerMetadataSummary,
      errorSafeDetailsSummary,
      warnings,
      maxSummaryLength,
    });
    const llmCall = await this.repository.appendRuntimeLlmCallPreview(
      input.executionId,
      llmCallInput,
    );
    const shouldAppendAuditLog =
      options.appendAuditLog !== false &&
      this.repository.appendRuntimeAuditLogPreview !== undefined;
    const auditLog = shouldAppendAuditLog
      ? await this.repository.appendRuntimeAuditLogPreview?.(
          input.executionId,
          createAuditLogInput({
            input,
            llmCall,
            safetyEvaluation,
            metadataSummary,
            providerMetadataSummary,
            errorSafeDetailsSummary,
            warnings,
            maxSummaryLength,
          }),
        )
      : undefined;
    const shouldAppendEvent =
      options.appendRuntimeEvent !== false &&
      this.repository.appendRuntimeEventPreview !== undefined;
    const event = shouldAppendEvent
      ? await this.repository.appendRuntimeEventPreview?.(
          input.executionId,
          createRuntimeEventInput({
            input,
            llmCall,
            auditLog,
            safetyEvaluation,
            warnings,
            maxSummaryLength,
          }),
        )
      : undefined;

    return {
      ok: true,
      previewOnly: true,
      executionId: input.executionId,
      llmCallId: llmCall.id,
      auditLogId: auditLog?.id,
      eventId: event?.id,
      persisted: {
        llmCall: true,
        auditLog: auditLog !== undefined,
        event: event !== undefined,
      },
      warnings,
      message: createPersistenceResultMessage({
        safetyEvaluation,
        auditLogPersisted: auditLog !== undefined,
        eventPersisted: event !== undefined,
      }),
    };
  }
}

export async function persistMockLlmCallPreview(
  repository: AgentRuntimeRepository,
  input: LlmCallPersistenceInput,
  options: PersistMockLlmCallPreviewOptions = {},
): Promise<PersistMockLlmCallPreviewResult> {
  return new AgentLlmCallPersistence(repository).persistMockLlmCallPreview(
    input,
    options,
  );
}

function validatePersistenceInput(
  input: LlmCallPersistenceInput,
): MockLlmCallPersistenceBlockedReason[] {
  const reasons: MockLlmCallPersistenceBlockedReason[] = [];

  if (normalizeOptionalText(input.executionId) === null) {
    reasons.push(MockLlmCallPersistenceBlockedReason.MissingExecutionId);
  }

  return reasons;
}

function evaluateResultSafety(input: {
  readonly input: LlmCallPersistenceInput;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly providerMetadataSummary: MetadataSummary | undefined;
  readonly errorSafeDetailsSummary: MetadataSummary | undefined;
}): ResultSafetyEvaluation {
  const result = input.input.result;
  const localBlockedReasons: MockLlmCallPersistenceBlockedReason[] = [];
  const unsafeMetadata =
    input.metadataSummary?.sensitiveMetadataDetected === true ||
    input.providerMetadataSummary?.sensitiveMetadataDetected === true;
  const unsafeErrorSafeDetails =
    input.errorSafeDetailsSummary?.sensitiveMetadataDetected === true;

  if (unsafeMetadata || unsafeErrorSafeDetails) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.UnsafeMetadata,
    );
  }

  if (result.secretSafe === false || result.error?.secretSafe === false) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.ResultNotSecretSafe,
    );
  }

  if (result.mockOnly === false) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.ResultNotMockOnly,
    );
  }

  if (result.realProviderCalled === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason
        .ResultIndicatesRealProviderCalled,
    );
  }

  if (result.networkAccessed === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.ResultIndicatesNetworkAccess,
    );
  }

  if (result.rawPromptStored === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason
        .ResultIndicatesRawPromptStored,
    );
  }

  if (result.rawMessagesStored === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason
        .ResultIndicatesRawMessagesStored,
    );
  }

  if (result.rawCompletionStored === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason
        .ResultIndicatesRawCompletionStored,
    );
  }

  if (result.rawResponseStored === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason
        .ResultIndicatesRawResponseStored,
    );
  }

  if (result.llmCallEnabled === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.ResultIndicatesLlmCallEnabled,
    );
  }

  if (result.error?.rawProviderErrorStored === true) {
    localBlockedReasons.push(
      MockLlmCallPersistenceBlockedReason.RawProviderErrorStored,
    );
  }

  const dangerousResultDetected = localBlockedReasons.length > 0;
  const status = dangerousResultDetected
    ? "blocked_preview"
    : result.ok === true
      ? "mock_completed_preview"
      : "mock_failed_preview";

  return {
    status,
    action:
      status === "mock_completed_preview"
        ? "mock_llm_call_completed_preview"
        : status === "blocked_preview"
          ? "mock_llm_call_blocked_preview"
          : "mock_llm_call_failed_preview",
    eventKind:
      status === "mock_completed_preview"
        ? "mock_llm_call_preview_persisted"
        : status === "blocked_preview"
          ? "mock_llm_call_blocked_preview"
          : "mock_llm_call_failed_preview",
    localBlockedReasons: normalizeUniqueStrings(
      localBlockedReasons,
    ) as MockLlmCallPersistenceBlockedReason[],
    blockedReasons: normalizeUniqueStrings([
      ...normalizeStringArray(
        result.error?.errorKind === undefined
          ? undefined
          : [result.error.errorKind],
        defaultMaxSummaryLength,
      ),
      ...localBlockedReasons,
    ]),
    dangerousResultDetected,
    unsafeMetadata,
    unsafeErrorSafeDetails,
    secretUnsafe: result.secretSafe === false || result.error?.secretSafe === false,
  };
}

function createLlmCallInput(input: {
  readonly input: LlmCallPersistenceInput;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly providerMetadataSummary: MetadataSummary | undefined;
  readonly errorSafeDetailsSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeLlmCallPreviewInput {
  const providerKind =
    sanitizeSummary(input.input.providerKind, input.maxSummaryLength) ??
    sanitizeSummary(input.input.result.providerKey, input.maxSummaryLength) ??
    "mock";
  const modelLabel =
    sanitizeSummary(input.input.modelLabel, input.maxSummaryLength) ??
    sanitizeSummary(input.input.result.modelLabel, input.maxSummaryLength) ??
    "mock-preview-model";

  return {
    stepId: sanitizeSummary(input.input.stepId, input.maxSummaryLength),
    providerKind,
    modelLabel,
    requestSummary:
      sanitizeSummary(input.input.requestSummary, input.maxSummaryLength) ??
      sanitizeSummary(input.input.purposeSummary, input.maxSummaryLength) ??
      "记录 mock LLM 调用预览结果；未保存 raw prompt 或 raw messages。",
    responseSummary: createResponseSummary({
      result: input.input.result,
      safetyEvaluation: input.safetyEvaluation,
      maxSummaryLength: input.maxSummaryLength,
    }),
    estimatedInputTokens: normalizeOptionalNonNegativeInteger(
      input.input.result.usage?.estimatedInputTokens,
    ),
    estimatedOutputTokens: normalizeOptionalNonNegativeInteger(
      input.input.result.usage?.estimatedOutputTokens,
    ),
    status: input.safetyEvaluation.status,
    blockedReasons:
      input.safetyEvaluation.blockedReasons.length > 0
        ? toRepositoryJsonValue(input.safetyEvaluation.blockedReasons)
        : undefined,
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    metadata: createPersistenceMetadata({
      input: input.input,
      safetyEvaluation: input.safetyEvaluation,
      metadataSummary: input.metadataSummary,
      providerMetadataSummary: input.providerMetadataSummary,
      errorSafeDetailsSummary: input.errorSafeDetailsSummary,
      warnings: input.warnings,
      recordKind: "runtime_llm_call_preview",
    }),
  };
}

function createAuditLogInput(input: {
  readonly input: LlmCallPersistenceInput;
  readonly llmCall: AgentRuntimeLlmCallRecord;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly providerMetadataSummary: MetadataSummary | undefined;
  readonly errorSafeDetailsSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeAuditLogPreviewInput {
  return {
    actorKind:
      sanitizeSummary(input.input.actorKind, input.maxSummaryLength) ??
      "system_preview",
    action: input.safetyEvaluation.action,
    targetKind: "runtime_llm_call_preview",
    riskLevel:
      sanitizeSummary(input.input.riskLevel, input.maxSummaryLength) ??
      "low",
    riskSummary:
      "记录 mock provider 的 LLM 调用预览结果；未调用真实模型、未访问网络、未读取密钥。",
    boundaryFlags: toRepositoryJsonValue(previewBoundaryFlags),
    safetyFlags: createAuditSafetyFlags(input.safetyEvaluation, input.input),
    metadata: createPersistenceMetadata({
      input: input.input,
      safetyEvaluation: input.safetyEvaluation,
      metadataSummary: input.metadataSummary,
      providerMetadataSummary: input.providerMetadataSummary,
      errorSafeDetailsSummary: input.errorSafeDetailsSummary,
      warnings: input.warnings,
      recordKind: "runtime_audit_log_preview",
      relatedLlmCallId: input.llmCall.id,
    }),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    productionAuditEnabled: false,
  };
}

function createRuntimeEventInput(input: {
  readonly input: LlmCallPersistenceInput;
  readonly llmCall: AgentRuntimeLlmCallRecord;
  readonly auditLog: AgentRuntimeAuditLogRecord | undefined;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeEventPreviewInput {
  const providerKind =
    sanitizeSummary(input.input.providerKind, input.maxSummaryLength) ??
    sanitizeSummary(input.input.result.providerKey, input.maxSummaryLength) ??
    "mock";
  const modelLabel =
    sanitizeSummary(input.input.modelLabel, input.maxSummaryLength) ??
    sanitizeSummary(input.input.result.modelLabel, input.maxSummaryLength) ??
    "mock-preview-model";

  return {
    eventKind: input.safetyEvaluation.eventKind,
    action: `${providerKind}:${modelLabel}`,
    message:
      input.safetyEvaluation.status === "blocked_preview"
        ? "已记录 mock LLM 调用预览的阻断结果；未调用真实模型，未访问网络，未读取密钥。"
        : input.safetyEvaluation.status === "mock_failed_preview"
          ? "已记录 mock LLM 调用预览的失败结果；未调用真实模型，未访问网络，未读取密钥。"
          : "已记录 mock LLM 调用预览；未调用真实模型，未访问网络，未读取密钥。",
    payload: toRepositoryJsonValue({
      providerKind,
      modelLabel,
      llmCallId: input.llmCall.id,
      auditLogId: input.auditLog?.id,
      status: input.safetyEvaluation.status,
      blockedReasons: input.safetyEvaluation.blockedReasons,
      warnings: input.warnings,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      llmCallEnabled: false,
      productionAuditEnabled: false,
    }),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
  };
}

function createAuditSafetyFlags(
  safetyEvaluation: ResultSafetyEvaluation,
  input: LlmCallPersistenceInput,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue({
    ...previewSafetyFlags,
    secretSafe:
      input.result.secretSafe !== false &&
      input.result.error?.secretSafe !== false &&
      !safetyEvaluation.unsafeMetadata &&
      !safetyEvaluation.unsafeErrorSafeDetails,
    dangerousResultDetected: safetyEvaluation.dangerousResultDetected,
    unsafeMetadataDetected: safetyEvaluation.unsafeMetadata,
    unsafeErrorSafeDetailsDetected:
      safetyEvaluation.unsafeErrorSafeDetails,
    reportedResultFlags: {
      llmCallEnabled: input.result.llmCallEnabled === true,
      realProviderCalled: input.result.realProviderCalled === true,
      networkAccessed: input.result.networkAccessed === true,
      rawPromptStored: input.result.rawPromptStored === true,
      rawMessagesStored: input.result.rawMessagesStored === true,
      rawCompletionStored: input.result.rawCompletionStored === true,
      rawResponseStored: input.result.rawResponseStored === true,
      rawProviderErrorStored:
        input.result.error?.rawProviderErrorStored === true,
    },
  });
}

function createPersistenceMetadata(input: {
  readonly input: LlmCallPersistenceInput;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly providerMetadataSummary: MetadataSummary | undefined;
  readonly errorSafeDetailsSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly recordKind: string;
  readonly relatedLlmCallId?: string;
}): AgentRuntimeRepositoryJsonValue | undefined {
  const metadata: Record<string, unknown> = {
    kind: "mock_llm_call_persistence_preview",
    recordKind: input.recordKind,
    requestId: normalizeOptionalText(input.input.requestId),
    providerKind:
      normalizeOptionalText(input.input.providerKind) ??
      normalizeOptionalText(input.input.result.providerKey) ??
      "mock",
    modelLabel:
      normalizeOptionalText(input.input.modelLabel) ??
      normalizeOptionalText(input.input.result.modelLabel) ??
      "mock-preview-model",
    relatedLlmCallId: input.relatedLlmCallId,
    sourceOk: input.input.result.ok === true,
    sourceFinishReason: normalizeOptionalText(input.input.result.finishReason),
    normalizedStatus: input.safetyEvaluation.status,
    usageSummary: createUsageSummary(input.input.result),
    errorSummary: createErrorSummary(input.input.result.error),
    metadataSummary: input.metadataSummary,
    providerMetadataSummary: input.providerMetadataSummary,
    errorSafeDetailsSummary: input.errorSafeDetailsSummary,
    blockedReasonCount: input.safetyEvaluation.blockedReasons.length,
    warningCount: input.warnings.length,
    localBlockedReasons: input.safetyEvaluation.localBlockedReasons,
    dangerousResultDetected: input.safetyEvaluation.dangerousResultDetected,
    unsafeMetadataDetected: input.safetyEvaluation.unsafeMetadata,
    unsafeErrorSafeDetailsDetected:
      input.safetyEvaluation.unsafeErrorSafeDetails,
    secretSafe: !input.safetyEvaluation.secretUnsafe,
    persistedAtPreview: normalizeOptionalText(input.input.now),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    productionAuditEnabled: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawCompletionStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    rawProviderErrorStored: false,
    rawPayloadStored: false,
    valuesStored: false,
  };

  return toRepositoryJsonValue(metadata);
}

function createUsageSummary(
  result: LlmChatCompletionResultLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  const estimatedInputTokens = normalizeOptionalNonNegativeInteger(
    result.usage?.estimatedInputTokens,
  );
  const estimatedOutputTokens = normalizeOptionalNonNegativeInteger(
    result.usage?.estimatedOutputTokens,
  );
  const totalEstimatedTokens = normalizeOptionalNonNegativeInteger(
    result.usage?.totalEstimatedTokens,
  );

  if (
    estimatedInputTokens === undefined &&
    estimatedOutputTokens === undefined &&
    totalEstimatedTokens === undefined
  ) {
    return undefined;
  }

  return toRepositoryJsonValue({
    estimatedInputTokens,
    estimatedOutputTokens,
    totalEstimatedTokens:
      totalEstimatedTokens ??
      (estimatedInputTokens ?? 0) + (estimatedOutputTokens ?? 0),
    valuesStored: false,
  });
}

function createErrorSummary(
  error: LlmChatCompletionResultLike["error"],
): AgentRuntimeRepositoryJsonValue | undefined {
  if (error === undefined) {
    return undefined;
  }

  return toRepositoryJsonValue({
    errorKind: normalizeOptionalText(error.errorKind) ?? "unknown",
    message: sanitizeSummary(error.message, defaultMaxSummaryLength),
    retryable: error.retryable === true,
    secretSafe: error.secretSafe !== false,
    safeDetailsSummary: createMetadataSummary(error.safeDetails),
    rawProviderErrorStored: false,
    valuesStored: false,
  });
}

function createResponseSummary(input: {
  readonly result: LlmChatCompletionResultLike;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly maxSummaryLength: number;
}): string {
  const baseSummary =
    sanitizeSummary(input.result.responseSummary, input.maxSummaryLength) ??
    sanitizeSummary(input.result.message, input.maxSummaryLength) ??
    sanitizeSummary(input.result.error?.message, input.maxSummaryLength) ??
    "Mock LLM result-like 输入已保存为 preview record。";

  if (input.safetyEvaluation.dangerousResultDetected) {
    const reasonSummary =
      input.safetyEvaluation.localBlockedReasons.join(", ");

    return sanitizeSummary(
      `检测到非 mock / 非安全 LLM 边界，已按 preview blocked 处理。原因：${reasonSummary}。安全摘要：${baseSummary}`,
      input.maxSummaryLength,
    ) as string;
  }

  if (input.safetyEvaluation.status === "mock_failed_preview") {
    return sanitizeSummary(
      `Mock LLM result-like 已按 failed preview 记录。${baseSummary}`,
      input.maxSummaryLength,
    ) as string;
  }

  return baseSummary;
}

function createResultWarnings(input: {
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly providerMetadataSummary: MetadataSummary | undefined;
  readonly errorSafeDetailsSummary: MetadataSummary | undefined;
}): string[] {
  return normalizeUniqueStrings([
    "mock_llm_call_persistence_preview_only",
    "real_execution_enabled_false",
    "llm_call_enabled_false",
    "streaming_enabled_false",
    "production_audit_enabled_false",
    "raw_prompt_not_stored",
    "raw_messages_not_stored",
    "raw_completion_not_stored",
    "raw_response_not_stored",
    ...(input.metadataSummary?.sensitiveMetadataDetected === true ||
    input.providerMetadataSummary?.sensitiveMetadataDetected === true ||
    input.errorSafeDetailsSummary?.sensitiveMetadataDetected === true
      ? ["unsafe_metadata"]
      : []),
    ...(input.safetyEvaluation.dangerousResultDetected
      ? ["dangerous_result_detected_saved_as_blocked_preview"]
      : []),
    ...(input.safetyEvaluation.secretUnsafe
      ? ["result_not_secret_safe_metadata_values_not_persisted"]
      : []),
  ]);
}

function createPersistenceResultMessage(input: {
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly auditLogPersisted: boolean;
  readonly eventPersisted: boolean;
}): string {
  const auditMessage = input.auditLogPersisted
    ? " Runtime audit log preview was also persisted."
    : " Runtime audit log preview was not persisted.";
  const eventMessage = input.eventPersisted
    ? " Runtime event preview was also persisted."
    : " Runtime event preview was not persisted.";

  if (input.safetyEvaluation.status === "mock_completed_preview") {
    return `Persisted mock LLM call preview records for a completed mock result. This did not call a provider, enable LLM calls, or enable production audit.${auditMessage}${eventMessage}`;
  }

  if (input.safetyEvaluation.status === "mock_failed_preview") {
    return `Persisted mock LLM call preview records for a failed mock result. This did not call a provider, enable LLM calls, or enable production audit.${auditMessage}${eventMessage}`;
  }

  return `Persisted mock LLM call preview records for a blocked result. This did not call a provider, enable LLM calls, or enable production audit.${auditMessage}${eventMessage}`;
}

function createProviderMetadataSummary(
  value: unknown,
): MetadataSummary | undefined {
  if (value === undefined) {
    return undefined;
  }

  return createMetadataSummary(value);
}

function createMetadataSummary(value: unknown): MetadataSummary | undefined {
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
  const visibleSafeKeys = safeKeys.slice(0, maxVisibleSummaryKeys);
  const redactedSensitiveKeyCount = keys.filter(
    (key) => isSensitiveKey(key) || isRawPayloadKey(key),
  ).length;

  return {
    kind: getMetadataKind(value),
    keyCount: keys.length,
    safeKeys: visibleSafeKeys,
    sensitiveMetadataDetected: redactedSensitiveKeyCount > 0,
    redactedSensitiveKeyCount,
    truncated: safeKeys.length > visibleSafeKeys.length,
    valuesStored: false,
  };
}

function collectMetadataKeys(value: unknown): string[] {
  const keys: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (current: unknown): void => {
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
): LlmCallPersistenceJsonValue | undefined {
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
        (item): item is LlmCallPersistenceJsonValue => item !== undefined,
      );
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seenObjects.has(value) || !isPlainObject(value)) {
    return undefined;
  }

  seenObjects.add(value);

  const output: LlmCallPersistenceJsonObject = {};

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
      /\b(api[-_ ]?key|api[-_ ]?secret|access[-_ ]?token|refresh[-_ ]?token|authorization|password|secret|credential|cookie|private[-_ ]?key|client[-_ ]?secret)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(raw[-_ ]?prompt|raw[-_ ]?messages|raw[-_ ]?completion|raw[-_ ]?request|raw[-_ ]?response|raw[-_ ]?provider[-_ ]?response)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
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

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNonNegativeInteger(
  value: number | null | undefined,
): number | undefined {
  if (value === undefined || value === null || !Number.isFinite(value)) {
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

  return typeof value;
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
