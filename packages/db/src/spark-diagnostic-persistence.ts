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

type SparkDiagnosticPersistenceJsonPrimitive =
  | string
  | number
  | boolean
  | null;
type SparkDiagnosticPersistenceJsonValue =
  | SparkDiagnosticPersistenceJsonPrimitive
  | SparkDiagnosticPersistenceJsonObject
  | SparkDiagnosticPersistenceJsonValue[];

interface SparkDiagnosticPersistenceJsonObject {
  [key: string]: SparkDiagnosticPersistenceJsonValue;
}

export type SparkDiagnosticControlledStatus =
  | "blocked"
  | "skipped"
  | "called_once"
  | "failed_safely"
  | string;

export type SparkDiagnosticRuntimeLlmCallStatus =
  | "spark_diagnostic_completed_preview"
  | "spark_diagnostic_failed_preview"
  | "spark_diagnostic_blocked_preview"
  | "spark_diagnostic_skipped_preview";

export const SparkDiagnosticPersistenceSafetyIssue = {
  UnsafeMetadata: "unsafe_metadata",
  SecretNotSafe: "secret_not_safe",
  RawPromptStored: "raw_prompt_stored",
  RawMessagesStored: "raw_messages_stored",
  RawResponseStored: "raw_response_stored",
  RawProviderResponseStored: "raw_provider_response_stored",
  AuthorizationHeaderPrinted: "authorization_header_printed",
  ExternalRequestCountTooHigh: "external_request_count_too_high",
  NonDiagnosticResult: "non_diagnostic_result",
  MissingExecutionId: "missing_execution_id",
  MissingResult: "missing_result",
  RawErrorDetailsRedacted: "raw_error_details_redacted",
} as const;

export type SparkDiagnosticPersistenceSafetyIssue =
  (typeof SparkDiagnosticPersistenceSafetyIssue)[keyof typeof SparkDiagnosticPersistenceSafetyIssue];

export interface SparkControlledDiagnosticCallResultLike {
  ok?: boolean;
  status?: SparkDiagnosticControlledStatus;
  providerKey?: string;
  modelLabel?: string;
  requestId?: string;
  responseSummary?: string;
  safeErrorSummary?: unknown;
  usage?: {
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    totalEstimatedTokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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

export interface SparkDiagnosticPersistenceInput {
  executionId: string;
  requestId?: string;
  purposeSummary?: string;
  result: SparkControlledDiagnosticCallResultLike;
  actorKind?: string;
  riskLevel?: string;
  metadata?: unknown;
  now?: string;
}

export interface PersistSparkDiagnosticPreviewOptions {
  appendRuntimeEvent?: boolean;
  appendAuditLog?: boolean;
  maxSummaryLength?: number;
  maxErrorSummaryLength?: number;
  includeRedactedConfigSummary?: boolean;
  includeLatencySummary?: boolean;
  includeCostFlag?: boolean;
}

export interface PersistSparkDiagnosticPreviewResult {
  ok: boolean;
  diagnosticOnly: true;
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
  status?: SparkDiagnosticRuntimeLlmCallStatus;
  warnings: string[];
  blockedReasons: string[];
  message: string;
}

export interface SparkDiagnosticSafeErrorSummary {
  errorKind: string;
  category:
    | "timeout"
    | "auth"
    | "config"
    | "provider"
    | "retryable"
    | "unknown";
  message: string;
  retryable: boolean;
  timeout: boolean;
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
}

export interface SparkDiagnosticSafeErrorSummaryOptions {
  maxErrorSummaryLength?: number;
}

export interface SparkDiagnosticMetadataSummary {
  kind: "spark_diagnostic_persistence_summary";
  requestId?: string;
  providerKey: string;
  modelLabel: string;
  diagnosticOnly: boolean;
  sourceStatus?: string;
  externalRequestAttempted: boolean;
  externalRequestCount: number;
  possibleCostIncurred: boolean;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  latencyMs?: number;
  retryCount?: number;
  timeoutMs?: number;
  usageSummary?: AgentRuntimeRepositoryJsonValue;
  redactedConfigSummary?: AgentRuntimeRepositoryJsonValue;
  inputMetadataSummary?: MetadataSummary;
  resultMetadataSummary?: MetadataSummary;
  safeErrorSummary?: AgentRuntimeRepositoryJsonValue;
  warningsCount: number;
  blockedReasons: string[];
  safetyIssues: SparkDiagnosticPersistenceSafetyIssue[];
  previewOnly: true;
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
}

interface SparkDiagnosticPersistenceRepository {
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
  redactedKeys: string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
  valuesStored: false;
}

interface StatusEvaluation {
  status: SparkDiagnosticRuntimeLlmCallStatus;
  action:
    | "spark_diagnostic_completed_preview"
    | "spark_diagnostic_failed_preview"
    | "spark_diagnostic_blocked_preview"
    | "spark_diagnostic_skipped_preview";
  eventKind:
    | "spark_diagnostic_preview_persisted"
    | "spark_diagnostic_completed_preview"
    | "spark_diagnostic_failed_preview"
    | "spark_diagnostic_blocked_preview"
    | "spark_diagnostic_skipped_preview";
  safetyIssues: SparkDiagnosticPersistenceSafetyIssue[];
  blockedReasons: string[];
  warnings: string[];
}

const defaultMaxSummaryLength = 800;
const defaultMaxErrorSummaryLength = 800;
const maxVisibleSummaryKeys = 12;
const redactedValue = "[redacted]";

const knownDiagnosticStatuses = new Set([
  "blocked",
  "skipped",
  "called_once",
  "failed_safely",
]);

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
  "testapi",
  "xfyunsparkapikey",
  "xfyunsparkapisecret",
  "xfyunsparkapitoken",
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
  "rawresponse",
  "rawproviderresponse",
  "rawrequest",
  "rawrequestbody",
  "rawcompletion",
  "rawprovidererror",
  "rawerrordetails",
  "stack",
]);

const previewBoundaryFlags = {
  previewOnly: true,
  diagnosticOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  schedulerEnabled: false,
  productionAuditEnabled: false,
  agentLoopEnabled: false,
  uiInvocationEnabled: false,
  streamingEnabled: false,
  toolCallingEnabled: false,
} as const satisfies SparkDiagnosticPersistenceJsonObject;

export class PrismaSparkDiagnosticPersistence {
  private readonly repository: SparkDiagnosticPersistenceRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistSparkDiagnosticPreview(
    input: SparkDiagnosticPersistenceInput,
    options: PersistSparkDiagnosticPreviewOptions = {},
  ): Promise<PersistSparkDiagnosticPreviewResult> {
    const maxSummaryLength = normalizeMaxSummaryLength(
      options.maxSummaryLength,
    );
    const maxErrorSummaryLength = normalizeMaxSummaryLength(
      options.maxErrorSummaryLength,
      defaultMaxErrorSummaryLength,
    );
    const validationIssues = validatePersistenceInput(input);
    const validationWarnings = validationIssues.map((issue) => issue);
    const inputWarnings = normalizeUniqueStrings([
      ...validationWarnings,
      ...normalizeStringArray(input.result?.warnings, maxSummaryLength),
    ]);

    if (validationIssues.length > 0) {
      return {
        ok: false,
        diagnosticOnly: true,
        previewOnly: true,
        executionId: normalizeOptionalText(input.executionId) ?? "",
        persisted: {
          llmCall: false,
          auditLog: false,
          event: false,
        },
        warnings: inputWarnings,
        blockedReasons: validationIssues,
        message:
          "Spark diagnostic persistence preview was blocked before repository writes because required input was missing.",
      };
    }

    const safetyIssues = detectSparkDiagnosticSafetyIssues(
      input.result,
      input.metadata,
    );
    const safeErrorSummary = createSparkDiagnosticSafeErrorSummary(
      input.result.safeErrorSummary ?? input.result.llmResultLike,
      { maxErrorSummaryLength },
    );
    const statusEvaluation = evaluateStatus({
      input,
      safetyIssues,
      safeErrorSummary,
      maxSummaryLength,
    });
    const warnings = normalizeUniqueStrings([
      ...inputWarnings,
      ...statusEvaluation.warnings,
      "spark_diagnostic_persistence_preview_only",
      "diagnostic_only_true",
      "real_execution_enabled_false",
      "llm_call_enabled_false",
      "streaming_enabled_false",
      "production_audit_enabled_false",
      "raw_prompt_not_stored",
      "raw_messages_not_stored",
      "raw_response_not_stored",
      "raw_provider_response_not_stored",
      "authorization_header_not_stored",
    ]);
    const metadataSummary = createSparkDiagnosticPersistenceMetadataSummary(
      input.result,
      input,
      {
        ...options,
        maxSummaryLength,
        maxErrorSummaryLength,
      },
      {
        safetyIssues,
        warnings,
        blockedReasons: statusEvaluation.blockedReasons,
        safeErrorSummary,
      },
    );
    const llmCall = await this.repository.appendRuntimeLlmCallPreview(
      input.executionId,
      createLlmCallInput({
        input,
        statusEvaluation,
        safeErrorSummary,
        metadataSummary,
        maxSummaryLength,
      }),
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
            statusEvaluation,
            metadataSummary,
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
            statusEvaluation,
            warnings,
            maxSummaryLength,
          }),
        )
      : undefined;

    return {
      ok: true,
      diagnosticOnly: true,
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
      status: statusEvaluation.status,
      warnings,
      blockedReasons: statusEvaluation.blockedReasons,
      message: createPersistenceResultMessage({
        statusEvaluation,
        auditLogPersisted: auditLog !== undefined,
        eventPersisted: event !== undefined,
      }),
    };
  }
}

export async function persistSparkDiagnosticPreview(
  repository: AgentRuntimeRepository,
  input: SparkDiagnosticPersistenceInput,
  options: PersistSparkDiagnosticPreviewOptions = {},
): Promise<PersistSparkDiagnosticPreviewResult> {
  return new PrismaSparkDiagnosticPersistence(
    repository,
  ).persistSparkDiagnosticPreview(input, options);
}

export function createSparkDiagnosticSafeErrorSummary(
  errorLike: unknown,
  options: SparkDiagnosticSafeErrorSummaryOptions = {},
): SparkDiagnosticSafeErrorSummary {
  const maxErrorSummaryLength = normalizeMaxSummaryLength(
    options.maxErrorSummaryLength,
    defaultMaxErrorSummaryLength,
  );
  const errorObject = isPlainObject(errorLike) ? errorLike : undefined;
  const rawMessage =
    getSafeStringField(errorObject, "message") ??
    (typeof errorLike === "string" ? errorLike : undefined) ??
    "Spark diagnostic result did not include a safe error message.";
  const rawErrorKind =
    getSafeStringField(errorObject, "errorKind") ??
    getSafeStringField(errorObject, "kind") ??
    getSafeStringField(errorObject, "code") ??
    "unknown";
  const keys = collectMetadataKeys(errorLike);
  const redactedSensitiveKeyCount = keys.filter(
    (key) => isSensitiveKey(key) || isRawPayloadKey(key),
  ).length;
  const category = classifySafeErrorCategory(rawErrorKind, rawMessage);
  const retryable =
    getSafeBooleanField(errorObject, "retryable") ??
    (category === "retryable" || category === "provider");
  const timeout = category === "timeout";

  return {
    errorKind: sanitizeSummary(rawErrorKind, maxErrorSummaryLength) ?? "unknown",
    category,
    message:
      sanitizeSummary(rawMessage, maxErrorSummaryLength) ??
      "Spark diagnostic error details were redacted.",
    retryable: timeout ? false : retryable,
    timeout,
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

export function createSparkDiagnosticPersistenceMetadataSummary(
  result: SparkControlledDiagnosticCallResultLike,
  input: SparkDiagnosticPersistenceInput,
  options: PersistSparkDiagnosticPreviewOptions = {},
  evaluation?: {
    safetyIssues?: readonly SparkDiagnosticPersistenceSafetyIssue[];
    warnings?: readonly string[];
    blockedReasons?: readonly string[];
    safeErrorSummary?: SparkDiagnosticSafeErrorSummary;
  },
): AgentRuntimeRepositoryJsonValue | undefined {
  const maxSummaryLength = normalizeMaxSummaryLength(
    options.maxSummaryLength,
  );
  const safeErrorSummary =
    evaluation?.safeErrorSummary ??
    createSparkDiagnosticSafeErrorSummary(result.safeErrorSummary, {
      maxErrorSummaryLength: options.maxErrorSummaryLength,
    });
  const safetyIssues =
    evaluation?.safetyIssues ??
    detectSparkDiagnosticSafetyIssues(result, input.metadata);
  const warnings = normalizeUniqueStrings(
    evaluation?.warnings ?? normalizeStringArray(result.warnings, maxSummaryLength),
  );
  const blockedReasons = normalizeUniqueStrings([
    ...normalizeStringArray(result.blockedReasons, maxSummaryLength),
    ...(evaluation?.blockedReasons ?? []),
  ]);
  const metadata: SparkDiagnosticMetadataSummary = {
    kind: "spark_diagnostic_persistence_summary",
    requestId:
      sanitizeSummary(input.requestId, maxSummaryLength) ??
      sanitizeSummary(result.requestId, maxSummaryLength),
    providerKey:
      sanitizeSummary(result.providerKey, maxSummaryLength) ?? "spark_test",
    modelLabel:
      sanitizeSummary(result.modelLabel, maxSummaryLength) ??
      "Spark Ultra-32K",
    diagnosticOnly: result.diagnosticOnly === true,
    sourceStatus: sanitizeSummary(result.status, maxSummaryLength),
    externalRequestAttempted: result.externalRequestAttempted === true,
    externalRequestCount: normalizeOptionalNonNegativeInteger(
      result.externalRequestCount,
    ) ?? 0,
    possibleCostIncurred: result.possibleCostIncurred === true,
    realProviderCalled: result.realProviderCalled === true,
    networkAccessed: result.networkAccessed === true,
    usageSummary: createUsageSummary(result),
    redactedConfigSummary:
      options.includeRedactedConfigSummary === false
        ? undefined
        : sanitizeUnknownJson(result.redactedConfigSummary),
    inputMetadataSummary: createMetadataSummary(input.metadata),
    resultMetadataSummary: createMetadataSummary(result.metadata),
    safeErrorSummary: sanitizeUnknownJson(safeErrorSummary),
    warningsCount: warnings.length,
    blockedReasons,
    safetyIssues: normalizeUniqueStrings(
      safetyIssues,
    ) as SparkDiagnosticPersistenceSafetyIssue[],
    previewOnly: true,
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
  };

  if (options.includeLatencySummary !== false) {
    metadata.latencyMs = normalizeOptionalNonNegativeInteger(result.latencyMs);
    metadata.retryCount =
      normalizeOptionalNonNegativeInteger(result.retryCount) ?? 0;
    metadata.timeoutMs = normalizeOptionalNonNegativeInteger(result.timeoutMs);
  }

  if (options.includeCostFlag === false) {
    metadata.possibleCostIncurred = false;
  }

  return toRepositoryJsonValue(metadata);
}

export function detectSparkDiagnosticSafetyIssues(
  result: SparkControlledDiagnosticCallResultLike | undefined,
  metadata?: unknown,
): SparkDiagnosticPersistenceSafetyIssue[] {
  const issues: SparkDiagnosticPersistenceSafetyIssue[] = [];

  if (result === undefined || result === null) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.MissingResult);
    return issues;
  }

  const status = normalizeOptionalText(result.status);

  if (result.diagnosticOnly !== true && !isKnownDiagnosticStatus(status)) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.NonDiagnosticResult);
  }

  if (result.secretSafe === false) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.SecretNotSafe);
  }

  if (result.rawPromptStored === true) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.RawPromptStored);
  }

  if (result.rawMessagesStored === true) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.RawMessagesStored);
  }

  if (result.rawResponseStored === true) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.RawResponseStored);
  }

  if (result.rawProviderResponseStored === true) {
    issues.push(
      SparkDiagnosticPersistenceSafetyIssue.RawProviderResponseStored,
    );
  }

  if (result.authorizationHeaderPrinted === true) {
    issues.push(
      SparkDiagnosticPersistenceSafetyIssue.AuthorizationHeaderPrinted,
    );
  }

  if ((normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0) > 1) {
    issues.push(
      SparkDiagnosticPersistenceSafetyIssue.ExternalRequestCountTooHigh,
    );
  }

  if (
    createMetadataSummary(metadata)?.sensitiveMetadataDetected === true ||
    createMetadataSummary(result.metadata)?.sensitiveMetadataDetected === true
  ) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.UnsafeMetadata);
  }

  if (
    createMetadataSummary(result.safeErrorSummary)
      ?.sensitiveMetadataDetected === true
  ) {
    issues.push(
      SparkDiagnosticPersistenceSafetyIssue.RawErrorDetailsRedacted,
    );
  }

  return normalizeUniqueStrings(
    issues,
  ) as SparkDiagnosticPersistenceSafetyIssue[];
}

export function mapSparkDiagnosticStatusToRuntimeLlmCallStatus(
  result: SparkControlledDiagnosticCallResultLike,
  issues: readonly SparkDiagnosticPersistenceSafetyIssue[] = [],
): SparkDiagnosticRuntimeLlmCallStatus {
  if (hasBlockingSafetyIssue(issues)) {
    return "spark_diagnostic_blocked_preview";
  }

  switch (result.status) {
    case "called_once":
      return result.ok === true
        ? "spark_diagnostic_completed_preview"
        : "spark_diagnostic_failed_preview";
    case "failed_safely":
      return "spark_diagnostic_failed_preview";
    case "blocked":
      return "spark_diagnostic_blocked_preview";
    case "skipped":
      return "spark_diagnostic_skipped_preview";
    default:
      return result.ok === true
        ? "spark_diagnostic_completed_preview"
        : "spark_diagnostic_failed_preview";
  }
}

function validatePersistenceInput(
  input: SparkDiagnosticPersistenceInput,
): SparkDiagnosticPersistenceSafetyIssue[] {
  const issues: SparkDiagnosticPersistenceSafetyIssue[] = [];

  if (normalizeOptionalText(input.executionId) === null) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.MissingExecutionId);
  }

  if (input.result === undefined || input.result === null) {
    issues.push(SparkDiagnosticPersistenceSafetyIssue.MissingResult);
  }

  return issues;
}

function evaluateStatus(input: {
  readonly input: SparkDiagnosticPersistenceInput;
  readonly safetyIssues: readonly SparkDiagnosticPersistenceSafetyIssue[];
  readonly safeErrorSummary: SparkDiagnosticSafeErrorSummary;
  readonly maxSummaryLength: number;
}): StatusEvaluation {
  const status = mapSparkDiagnosticStatusToRuntimeLlmCallStatus(
    input.input.result,
    input.safetyIssues,
  );
  const resultBlockedReasons = normalizeStringArray(
    input.input.result.blockedReasons,
    input.maxSummaryLength,
  );
  const issueBlockedReasons = input.safetyIssues.filter(
    (issue) =>
      issue !== SparkDiagnosticPersistenceSafetyIssue.RawErrorDetailsRedacted,
  );
  const blockedReasons = normalizeUniqueStrings([
    ...resultBlockedReasons,
    ...issueBlockedReasons,
  ]);
  const warnings = normalizeUniqueStrings([
    ...input.safetyIssues,
    ...(input.safeErrorSummary.rawErrorDetailsRedacted
      ? [SparkDiagnosticPersistenceSafetyIssue.RawErrorDetailsRedacted]
      : []),
    ...(input.input.result.externalRequestAttempted === true
      ? [
          "spark_diagnostic_external_request_summary_only_possible_cost_recorded",
        ]
      : []),
    ...(status === "spark_diagnostic_blocked_preview"
      ? ["spark_diagnostic_saved_as_blocked_preview"]
      : []),
  ]);

  return {
    status,
    action: status,
    eventKind:
      status === "spark_diagnostic_completed_preview"
        ? "spark_diagnostic_preview_persisted"
        : status,
    safetyIssues: normalizeUniqueStrings(
      input.safetyIssues,
    ) as SparkDiagnosticPersistenceSafetyIssue[],
    blockedReasons,
    warnings,
  };
}

function createLlmCallInput(input: {
  readonly input: SparkDiagnosticPersistenceInput;
  readonly statusEvaluation: StatusEvaluation;
  readonly safeErrorSummary: SparkDiagnosticSafeErrorSummary;
  readonly metadataSummary: AgentRuntimeRepositoryJsonValue | undefined;
  readonly maxSummaryLength: number;
}): AppendRuntimeLlmCallPreviewInput {
  const result = input.input.result;
  const providerKind =
    sanitizeSummary(result.providerKey, input.maxSummaryLength) ??
    "spark_test";
  const modelLabel =
    sanitizeSummary(result.modelLabel, input.maxSummaryLength) ??
    "Spark Ultra-32K";

  return {
    providerKind,
    modelLabel,
    requestSummary:
      sanitizeSummary(input.input.purposeSummary, input.maxSummaryLength) ??
      "Spark 受控诊断调用，仅使用固定安全 prompt；不保存 raw prompt。",
    responseSummary: createResponseSummary({
      result,
      statusEvaluation: input.statusEvaluation,
      safeErrorSummary: input.safeErrorSummary,
      maxSummaryLength: input.maxSummaryLength,
    }),
    estimatedInputTokens: getEstimatedInputTokens(result),
    estimatedOutputTokens: getEstimatedOutputTokens(result),
    status: input.statusEvaluation.status,
    blockedReasons:
      input.statusEvaluation.blockedReasons.length > 0
        ? toRepositoryJsonValue(input.statusEvaluation.blockedReasons)
        : undefined,
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    llmCallEnabled: false,
    streamingEnabled: false,
    metadata: input.metadataSummary,
  };
}

function createAuditLogInput(input: {
  readonly input: SparkDiagnosticPersistenceInput;
  readonly llmCall: AgentRuntimeLlmCallRecord;
  readonly statusEvaluation: StatusEvaluation;
  readonly metadataSummary: AgentRuntimeRepositoryJsonValue | undefined;
  readonly maxSummaryLength: number;
}): AppendRuntimeAuditLogPreviewInput {
  const result = input.input.result;

  return {
    actorKind:
      sanitizeSummary(input.input.actorKind, input.maxSummaryLength) ??
      "system_diagnostic",
    action:
      input.statusEvaluation.status === "spark_diagnostic_completed_preview"
        ? "spark_diagnostic_completed_preview"
        : input.statusEvaluation.action,
    targetKind: "runtime_llm_call_preview",
    riskLevel:
      sanitizeSummary(input.input.riskLevel, input.maxSummaryLength) ??
      (result.externalRequestAttempted === true ||
      result.possibleCostIncurred === true
        ? "medium"
        : "low"),
    riskSummary:
      "记录一次 Spark 受控诊断调用摘要；不保存 raw prompt、raw response 或 secret；不代表 Agent loop 已启用。",
    boundaryFlags: toRepositoryJsonValue(previewBoundaryFlags),
    safetyFlags: createAuditSafetyFlags(result, input.statusEvaluation),
    metadata: toRepositoryJsonValue({
      relatedLlmCallId: input.llmCall.id,
      summary: input.metadataSummary,
      previewOnly: true,
      diagnosticOnly: true,
      productionAuditEnabled: false,
      rawPromptStored: false,
      rawMessagesStored: false,
      rawResponseStored: false,
      rawProviderResponseStored: false,
      authorizationHeaderStored: false,
    }),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    productionAuditEnabled: false,
  };
}

function createRuntimeEventInput(input: {
  readonly input: SparkDiagnosticPersistenceInput;
  readonly llmCall: AgentRuntimeLlmCallRecord;
  readonly auditLog: AgentRuntimeAuditLogRecord | undefined;
  readonly statusEvaluation: StatusEvaluation;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeEventPreviewInput {
  const result = input.input.result;
  const providerKey =
    sanitizeSummary(result.providerKey, input.maxSummaryLength) ??
    "spark_test";
  const modelLabel =
    sanitizeSummary(result.modelLabel, input.maxSummaryLength) ??
    "Spark Ultra-32K";
  const externalMessage =
    result.externalRequestAttempted === true
      ? "该诊断记录表示发生过一次外部 Spark 测试请求，可能产生费用；结果已做脱敏摘要。"
      : "已记录 Spark 诊断调用摘要；未保存 raw prompt、raw response 或 secret。";

  return {
    eventKind: input.statusEvaluation.eventKind,
    action: `${providerKey}:${modelLabel}`,
    message: externalMessage,
    payload: toRepositoryJsonValue({
      providerKey,
      modelLabel,
      llmCallId: input.llmCall.id,
      auditLogId: input.auditLog?.id,
      status: input.statusEvaluation.status,
      blockedReasons: input.statusEvaluation.blockedReasons,
      warnings: input.warnings,
      externalRequestAttempted: result.externalRequestAttempted === true,
      externalRequestCount:
        normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
      possibleCostIncurred: result.possibleCostIncurred === true,
      previewOnly: true,
      diagnosticOnly: true,
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
  result: SparkControlledDiagnosticCallResultLike,
  statusEvaluation: StatusEvaluation,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue({
    previewOnly: true,
    diagnosticOnly: true,
    secretSafe:
      result.secretSafe !== false &&
      !statusEvaluation.safetyIssues.includes(
        SparkDiagnosticPersistenceSafetyIssue.UnsafeMetadata,
      ),
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    rawProviderResponseStored: false,
    authorizationHeaderPrinted: false,
    externalRequestAttempted: result.externalRequestAttempted === true,
    externalRequestCount:
      normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
    possibleCostIncurred: result.possibleCostIncurred === true,
    realProviderCalled: result.realProviderCalled === true,
    networkAccessed: result.networkAccessed === true,
    reportedResultFlags: {
      rawPromptStored: result.rawPromptStored === true,
      rawMessagesStored: result.rawMessagesStored === true,
      rawResponseStored: result.rawResponseStored === true,
      rawProviderResponseStored: result.rawProviderResponseStored === true,
      authorizationHeaderPrinted:
        result.authorizationHeaderPrinted === true,
      secretSafe: result.secretSafe !== false,
      externalRequestCount:
        normalizeOptionalNonNegativeInteger(result.externalRequestCount) ?? 0,
    },
    safetyIssues: statusEvaluation.safetyIssues,
    productionAuditEnabled: false,
    agentLoopEnabled: false,
    uiInvocationEnabled: false,
    streamingEnabled: false,
    toolCallingEnabled: false,
  });
}

function createResponseSummary(input: {
  readonly result: SparkControlledDiagnosticCallResultLike;
  readonly statusEvaluation: StatusEvaluation;
  readonly safeErrorSummary: SparkDiagnosticSafeErrorSummary;
  readonly maxSummaryLength: number;
}): string {
  if (input.statusEvaluation.status === "spark_diagnostic_completed_preview") {
    return (
      sanitizeSummary(input.result.responseSummary, input.maxSummaryLength) ??
      "Spark diagnostic completed and only a safe response summary was persisted."
    );
  }

  if (input.statusEvaluation.status === "spark_diagnostic_failed_preview") {
    return sanitizeSummary(
      `Spark diagnostic failed safely. ${input.safeErrorSummary.message}`,
      input.maxSummaryLength,
    ) as string;
  }

  if (input.statusEvaluation.status === "spark_diagnostic_skipped_preview") {
    return sanitizeSummary(
      `Spark diagnostic was skipped. ${input.safeErrorSummary.message}`,
      input.maxSummaryLength,
    ) as string;
  }

  const reasonSummary =
    input.statusEvaluation.blockedReasons.length > 0
      ? input.statusEvaluation.blockedReasons.join(", ")
      : "blocked_by_safety_boundary";

  return sanitizeSummary(
    `Spark diagnostic persistence was saved as blocked preview. Reasons: ${reasonSummary}. ${input.safeErrorSummary.message}`,
    input.maxSummaryLength,
  ) as string;
}

function createPersistenceResultMessage(input: {
  readonly statusEvaluation: StatusEvaluation;
  readonly auditLogPersisted: boolean;
  readonly eventPersisted: boolean;
}): string {
  const auditMessage = input.auditLogPersisted
    ? " Runtime audit log preview was also persisted."
    : " Runtime audit log preview was not persisted.";
  const eventMessage = input.eventPersisted
    ? " Runtime event preview was also persisted."
    : " Runtime event preview was not persisted.";

  return `Persisted Spark diagnostic preview summary with status=${input.statusEvaluation.status}. This did not call Spark, enable Agent loop LLM calls, save raw prompt, or enable production audit.${auditMessage}${eventMessage}`;
}

function hasBlockingSafetyIssue(
  issues: readonly SparkDiagnosticPersistenceSafetyIssue[],
): boolean {
  return issues.some(
    (issue) =>
      issue !== SparkDiagnosticPersistenceSafetyIssue.RawErrorDetailsRedacted,
  );
}

function isKnownDiagnosticStatus(status: string | null): boolean {
  return status !== null && knownDiagnosticStatuses.has(status);
}

function createUsageSummary(
  result: SparkControlledDiagnosticCallResultLike,
): AgentRuntimeRepositoryJsonValue | undefined {
  const estimatedInputTokens = getEstimatedInputTokens(result);
  const estimatedOutputTokens = getEstimatedOutputTokens(result);
  const totalEstimatedTokens =
    normalizeOptionalNonNegativeInteger(result.usage?.totalEstimatedTokens) ??
    normalizeOptionalNonNegativeInteger(result.usage?.total_tokens) ??
    (estimatedInputTokens !== undefined || estimatedOutputTokens !== undefined
      ? (estimatedInputTokens ?? 0) + (estimatedOutputTokens ?? 0)
      : undefined);

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
    totalEstimatedTokens,
    valuesStored: false,
  });
}

function getEstimatedInputTokens(
  result: SparkControlledDiagnosticCallResultLike,
): number | undefined {
  return (
    normalizeOptionalNonNegativeInteger(result.usage?.estimatedInputTokens) ??
    normalizeOptionalNonNegativeInteger(result.usage?.prompt_tokens)
  );
}

function getEstimatedOutputTokens(
  result: SparkControlledDiagnosticCallResultLike,
): number | undefined {
  return (
    normalizeOptionalNonNegativeInteger(result.usage?.estimatedOutputTokens) ??
    normalizeOptionalNonNegativeInteger(result.usage?.completion_tokens)
  );
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
): SparkDiagnosticPersistenceJsonValue | undefined {
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
        (item): item is SparkDiagnosticPersistenceJsonValue =>
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

  const output: SparkDiagnosticPersistenceJsonObject = {};

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
    .replace(/\bbearer\s+\S+/giu, "bearer [redacted]")
    .replace(
      /\b(api[-_ ]?key|api[-_ ]?secret|access[-_ ]?token|refresh[-_ ]?token|authorization|password|secret|credential|credentials|cookie|private[-_ ]?key|client[-_ ]?secret|testapi|xfyun[-_ ]?spark[-_ ]?api[-_ ]?(key|secret|token))\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(raw[-_ ]?prompt|raw[-_ ]?messages|raw[-_ ]?completion|raw[-_ ]?request|raw[-_ ]?request[-_ ]?body|raw[-_ ]?response|raw[-_ ]?provider[-_ ]?response|headers|raw[-_ ]?headers|set[-_ ]?cookie|stack)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      "$1=[redacted]",
    );

  return redacted.length > maxLength
    ? `${redacted.slice(0, Math.max(maxLength - 3, 0))}...`
    : redacted;
}

function normalizeStringArray(value: unknown, maxLength: number): string[] {
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

function normalizeMaxSummaryLength(
  value: number | undefined,
  fallback = defaultMaxSummaryLength,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 120) {
    return fallback;
  }

  return Math.trunc(value);
}

function classifySafeErrorCategory(
  errorKind: string,
  message: string,
): SparkDiagnosticSafeErrorSummary["category"] {
  const normalized = `${errorKind} ${message}`.toLowerCase();

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "timeout";
  }

  if (
    normalized.includes("auth") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("permission")
  ) {
    return "auth";
  }

  if (
    normalized.includes("config") ||
    normalized.includes("missing_secret") ||
    normalized.includes("provider_disabled")
  ) {
    return "config";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("rate") ||
    normalized.includes("retry")
  ) {
    return "retryable";
  }

  if (normalized.includes("provider") || normalized.includes("spark")) {
    return "provider";
  }

  return "unknown";
}

function getSafeStringField(
  value: Readonly<Record<string, unknown>> | undefined,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return sanitizeSummary(value[fieldName], defaultMaxErrorSummaryLength);
}

function getSafeBooleanField(
  value: Readonly<Record<string, unknown>> | undefined,
  fieldName: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const fieldValue = value[fieldName];

  return typeof fieldValue === "boolean" ? fieldValue : undefined;
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
