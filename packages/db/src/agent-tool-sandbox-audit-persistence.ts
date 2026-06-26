import type {
  AgentRuntimeAuditLogRecord,
  AgentRuntimeEventRecord,
  AgentRuntimeRepository,
  AgentRuntimeRepositoryJsonValue,
  AgentRuntimeToolCallRecord,
  AppendRuntimeAuditLogPreviewInput,
  AppendRuntimeEventPreviewInput,
  AppendRuntimeToolCallPreviewInput,
} from "./repositories/agent-runtime-repository.js";

type ToolSandboxAuditJsonPrimitive = string | number | boolean | null;
type ToolSandboxAuditJsonValue =
  | ToolSandboxAuditJsonPrimitive
  | ToolSandboxAuditJsonObject
  | ToolSandboxAuditJsonValue[];

interface ToolSandboxAuditJsonObject {
  [key: string]: ToolSandboxAuditJsonValue;
}

export const ReadOnlyToolSandboxPersistenceBlockedReason = {
  MissingExecutionId: "missing_execution_id",
  MissingToolKey: "missing_tool_key",
  UnsafeMetadata: "unsafe_metadata",
  ResultNotReadOnly: "result_not_read_only",
  ResultNotPreviewOrMockOnly: "result_not_preview_or_mock_only",
  ResultNotSecretSafe: "result_not_secret_safe",
  ResultSafeDataContainsSensitiveKey:
    "result_safe_data_contains_sensitive_key",
  ResultSideEffectNotReadonly: "result_side_effect_not_readonly",
  ResultIndicatesNetworkAccess: "result_indicates_network_access",
  ResultIndicatesFileSystemAccess:
    "result_indicates_file_system_access",
  ResultIndicatesDatabaseAccess: "result_indicates_database_access",
  ResultIndicatesCommandExecution:
    "result_indicates_command_execution",
  ResultIndicatesLlmCall: "result_indicates_llm_call",
} as const;

export type ReadOnlyToolSandboxPersistenceBlockedReason =
  (typeof ReadOnlyToolSandboxPersistenceBlockedReason)[keyof typeof ReadOnlyToolSandboxPersistenceBlockedReason];

export interface ReadOnlyToolSandboxExecutionResultLike {
  ok?: boolean;
  executed?: boolean;
  toolKey: string;
  status?: string;
  resultSummary?: string;
  safeData?: unknown;
  blockedReasons?: readonly string[];
  warnings?: readonly string[];
  sandboxDecision?: unknown;
  readOnly?: boolean;
  previewOrMockOnly?: boolean;
  sideEffectLevel?: string;
  secretSafe?: boolean;
  networkAccessed?: boolean;
  fileSystemAccessed?: boolean;
  databaseAccessed?: boolean;
  commandExecuted?: boolean;
  llmCalled?: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface ReadOnlyToolSandboxPersistenceInput {
  executionId: string;
  requestId?: string;
  toolKey: string;
  purposeSummary?: string;
  requirementSummary?: string;
  inputSummary?: string;
  result: ReadOnlyToolSandboxExecutionResultLike;
  actorKind?: string;
  riskLevel?: string;
  metadata?: unknown;
  now?: string;
}

export interface PersistReadOnlyToolSandboxAuditPreviewOptions {
  appendRuntimeEvent?: boolean;
  maxSummaryLength?: number;
  includeSafeDataSummary?: boolean;
}

export interface PersistReadOnlyToolSandboxAuditPreviewResult {
  ok: boolean;
  previewOnly: true;
  executionId: string;
  toolCallId?: string;
  auditLogId?: string;
  eventId?: string;
  persisted: {
    toolCall: boolean;
    auditLog: boolean;
    event: boolean;
  };
  warnings: string[];
  message: string;
}

interface ToolSandboxAuditPersistenceRepository {
  appendRuntimeToolCallPreview(
    executionId: string,
    input: AppendRuntimeToolCallPreviewInput,
  ): Promise<AgentRuntimeToolCallRecord>;
  appendRuntimeAuditLogPreview(
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
  status: "allowed_static_readonly_preview" | "blocked_preview" | "disabled_preview";
  action:
    | "persist_readonly_tool_sandbox_attempt_preview"
    | "readonly_tool_sandbox_blocked_preview"
    | "readonly_tool_sandbox_allowed_static_preview";
  eventKind:
    | "readonly_tool_sandbox_attempt_preview"
    | "readonly_tool_sandbox_blocked_preview"
    | "readonly_tool_sandbox_allowed_static_preview";
  localBlockedReasons: ReadOnlyToolSandboxPersistenceBlockedReason[];
  blockedReasons: string[];
  dangerousResultDetected: boolean;
  secretUnsafe: boolean;
  unsafeMetadata: boolean;
  safeDataUnsafe: boolean;
}

const defaultMaxSummaryLength = 500;
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
  "rawprompt",
  "rawmessages",
  "rawtoolinput",
  "rawtooloutput",
]);

const rawPayloadKeys = new Set([
  "prompt",
  "rawprompt",
  "fullprompt",
  "messages",
  "rawmessages",
  "completion",
  "rawcompletion",
  "rawresponse",
  "rawrequest",
  "rawtoolinput",
  "rawtooloutput",
  "command",
  "shellcommand",
  "powershellcommand",
  "script",
  "filecontent",
  "rawfilecontent",
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
  productionAuditEnabled: false,
} as const satisfies ToolSandboxAuditJsonObject;

const previewSafetyFlags = {
  previewOnly: true,
  readOnly: true,
  secretSafe: true,
  networkAccessed: false,
  fileSystemAccessed: false,
  databaseAccessed: false,
  commandExecuted: false,
  llmCalled: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  productionAuditEnabled: false,
} as const satisfies ToolSandboxAuditJsonObject;

export class AgentToolSandboxAuditPersistence {
  private readonly repository: ToolSandboxAuditPersistenceRepository;

  constructor(repository: AgentRuntimeRepository) {
    this.repository = repository;
  }

  async persistReadOnlyToolSandboxAuditPreview(
    input: ReadOnlyToolSandboxPersistenceInput,
    options: PersistReadOnlyToolSandboxAuditPreviewOptions = {},
  ): Promise<PersistReadOnlyToolSandboxAuditPreviewResult> {
    const maxSummaryLength = normalizeMaxSummaryLength(
      options.maxSummaryLength,
    );
    const validationWarnings = validatePersistenceInput(input);
    const warnings = normalizeUniqueStrings([
      ...validationWarnings,
      ...normalizeStringArray(input.result.warnings, maxSummaryLength),
    ]);

    if (validationWarnings.length > 0) {
      return {
        ok: false,
        previewOnly: true,
        executionId: normalizeOptionalText(input.executionId) ?? "",
        persisted: {
          toolCall: false,
          auditLog: false,
          event: false,
        },
        warnings,
        message:
          "Read-only tool sandbox audit persistence preview was blocked before repository writes because required identifiers were missing.",
      };
    }

    const metadataSummary = createMetadataSummary(input.metadata);
    const safeDataSummary = createSafeDataSummary({
      safeData: input.result.safeData,
      includeSafeDataSummary: options.includeSafeDataSummary === true,
    });
    const safetyEvaluation = evaluateResultSafety({
      input,
      metadataSummary,
      safeDataSummary,
    });
    const resultWarnings = createResultWarnings({
      safetyEvaluation,
      metadataSummary,
      safeDataSummary,
    });
    const normalizedWarnings = normalizeUniqueStrings([
      ...warnings,
      ...resultWarnings,
    ]);
    const toolCallInput = createToolCallInput({
      input,
      safetyEvaluation,
      metadataSummary,
      safeDataSummary,
      warnings: normalizedWarnings,
      maxSummaryLength,
    });
    const toolCall = await this.repository.appendRuntimeToolCallPreview(
      input.executionId,
      toolCallInput,
    );
    const auditLogInput = createAuditLogInput({
      input,
      toolCall,
      safetyEvaluation,
      metadataSummary,
      safeDataSummary,
      warnings: normalizedWarnings,
      maxSummaryLength,
    });
    const auditLog = await this.repository.appendRuntimeAuditLogPreview(
      input.executionId,
      auditLogInput,
    );
    const shouldAppendEvent =
      options.appendRuntimeEvent !== false &&
      this.repository.appendRuntimeEventPreview !== undefined;
    const event = shouldAppendEvent
      ? await this.repository.appendRuntimeEventPreview?.(
          input.executionId,
          createRuntimeEventInput({
            input,
            toolCall,
            auditLog,
            safetyEvaluation,
            warnings: normalizedWarnings,
            maxSummaryLength,
          }),
        )
      : undefined;

    return {
      ok: true,
      previewOnly: true,
      executionId: input.executionId,
      toolCallId: toolCall.id,
      auditLogId: auditLog.id,
      eventId: event?.id,
      persisted: {
        toolCall: true,
        auditLog: true,
        event: event !== undefined,
      },
      warnings: normalizedWarnings,
      message: createPersistenceResultMessage({
        safetyEvaluation,
        eventPersisted: event !== undefined,
      }),
    };
  }
}

export async function persistReadOnlyToolSandboxAuditPreview(
  repository: AgentRuntimeRepository,
  input: ReadOnlyToolSandboxPersistenceInput,
  options: PersistReadOnlyToolSandboxAuditPreviewOptions = {},
): Promise<PersistReadOnlyToolSandboxAuditPreviewResult> {
  return new AgentToolSandboxAuditPersistence(
    repository,
  ).persistReadOnlyToolSandboxAuditPreview(input, options);
}

function validatePersistenceInput(
  input: ReadOnlyToolSandboxPersistenceInput,
): ReadOnlyToolSandboxPersistenceBlockedReason[] {
  const reasons: ReadOnlyToolSandboxPersistenceBlockedReason[] = [];

  if (normalizeOptionalText(input.executionId) === null) {
    reasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.MissingExecutionId,
    );
  }

  if (normalizeOptionalText(input.toolKey) === null) {
    reasons.push(ReadOnlyToolSandboxPersistenceBlockedReason.MissingToolKey);
  }

  return reasons;
}

function evaluateResultSafety(input: {
  readonly input: ReadOnlyToolSandboxPersistenceInput;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly safeDataSummary: MetadataSummary | undefined;
}): ResultSafetyEvaluation {
  const result = input.input.result;
  const localBlockedReasons: ReadOnlyToolSandboxPersistenceBlockedReason[] = [];
  const sideEffectLevel = normalizeOptionalText(result.sideEffectLevel);
  const unsafeMetadata =
    input.metadataSummary?.sensitiveMetadataDetected === true;
  const safeDataUnsafe =
    input.safeDataSummary?.sensitiveMetadataDetected === true;

  if (unsafeMetadata) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.UnsafeMetadata,
    );
  }

  if (result.readOnly === false) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.ResultNotReadOnly,
    );
  }

  if (result.previewOrMockOnly === false) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.ResultNotPreviewOrMockOnly,
    );
  }

  if (result.secretSafe === false) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.ResultNotSecretSafe,
    );
  }

  if (safeDataUnsafe) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultSafeDataContainsSensitiveKey,
    );
  }

  if (
    sideEffectLevel !== null &&
    sideEffectLevel !== "none" &&
    sideEffectLevel !== "read_only"
  ) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultSideEffectNotReadonly,
    );
  }

  if (result.networkAccessed === true) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultIndicatesNetworkAccess,
    );
  }

  if (result.fileSystemAccessed === true) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultIndicatesFileSystemAccess,
    );
  }

  if (result.databaseAccessed === true) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultIndicatesDatabaseAccess,
    );
  }

  if (result.commandExecuted === true) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason
        .ResultIndicatesCommandExecution,
    );
  }

  if (result.llmCalled === true) {
    localBlockedReasons.push(
      ReadOnlyToolSandboxPersistenceBlockedReason.ResultIndicatesLlmCall,
    );
  }

  const resultBlockedReasons = normalizeStringArray(
    result.blockedReasons,
    defaultMaxSummaryLength,
  );
  const dangerousResultDetected = localBlockedReasons.length > 0;
  const status = normalizeOptionalText(result.status);
  const disabled =
    status === "disabled" ||
    resultBlockedReasons.includes("runtime_disabled") ||
    (result.executed === false && result.ok !== false);
  const shouldBlock =
    result.ok === false ||
    dangerousResultDetected ||
    resultBlockedReasons.length > 0;
  const persistenceStatus = disabled
    ? "disabled_preview"
    : shouldBlock
      ? "blocked_preview"
      : "allowed_static_readonly_preview";

  return {
    status: persistenceStatus,
    action:
      persistenceStatus === "allowed_static_readonly_preview"
        ? "readonly_tool_sandbox_allowed_static_preview"
        : persistenceStatus === "blocked_preview"
          ? "readonly_tool_sandbox_blocked_preview"
          : "persist_readonly_tool_sandbox_attempt_preview",
    eventKind:
      persistenceStatus === "allowed_static_readonly_preview"
        ? "readonly_tool_sandbox_allowed_static_preview"
        : persistenceStatus === "blocked_preview"
          ? "readonly_tool_sandbox_blocked_preview"
          : "readonly_tool_sandbox_attempt_preview",
    localBlockedReasons: normalizeUniqueStrings(
      localBlockedReasons,
    ) as ReadOnlyToolSandboxPersistenceBlockedReason[],
    blockedReasons: normalizeUniqueStrings([
      ...resultBlockedReasons,
      ...localBlockedReasons,
    ]),
    dangerousResultDetected,
    secretUnsafe: result.secretSafe === false,
    unsafeMetadata,
    safeDataUnsafe,
  };
}

function createToolCallInput(input: {
  readonly input: ReadOnlyToolSandboxPersistenceInput;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly safeDataSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeToolCallPreviewInput {
  return {
    toolName: normalizeOptionalText(input.input.toolKey) ?? "unknown_tool",
    toolKind: "read_only_sandbox_skeleton",
    status: input.safetyEvaluation.status,
    requirementSummary:
      sanitizeSummary(
        input.input.requirementSummary,
        input.maxSummaryLength,
      ) ?? "记录低风险只读工具沙箱的请求预览",
    inputSummary:
      sanitizeSummary(input.input.inputSummary, input.maxSummaryLength) ??
      sanitizeSummary(
        input.input.purposeSummary,
        input.maxSummaryLength,
      ) ??
      "只保存只读工具沙箱 skeleton 请求的安全摘要；未保存 raw tool input。",
    resultSummary: createResultSummary({
      result: input.input.result,
      safetyEvaluation: input.safetyEvaluation,
      maxSummaryLength: input.maxSummaryLength,
    }),
    riskLevel: sanitizeSummary(input.input.riskLevel, input.maxSummaryLength) ?? "low",
    blockedReasons:
      input.safetyEvaluation.blockedReasons.length > 0
        ? toRepositoryJsonValue(input.safetyEvaluation.blockedReasons)
        : undefined,
    sandboxRequired: true,
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    metadata: createPersistenceMetadata({
      input: input.input,
      safetyEvaluation: input.safetyEvaluation,
      metadataSummary: input.metadataSummary,
      safeDataSummary:
        input.safetyEvaluation.safeDataUnsafe ||
        input.safetyEvaluation.secretUnsafe
          ? undefined
          : input.safeDataSummary,
      warnings: input.warnings,
      recordKind: "runtime_tool_call_preview",
    }),
  };
}

function createAuditLogInput(input: {
  readonly input: ReadOnlyToolSandboxPersistenceInput;
  readonly toolCall: AgentRuntimeToolCallRecord;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly safeDataSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeAuditLogPreviewInput {
  return {
    actorKind:
      sanitizeSummary(input.input.actorKind, input.maxSummaryLength) ??
      "system_preview",
    action: input.safetyEvaluation.action,
    targetKind: "runtime_tool_call_preview",
    riskLevel: sanitizeSummary(input.input.riskLevel, input.maxSummaryLength) ?? "low",
    riskSummary:
      "记录低风险只读工具沙箱 skeleton 的尝试结果；未执行危险工具、未调用模型、未访问文件/网络/数据库。",
    boundaryFlags: toRepositoryJsonValue(previewBoundaryFlags),
    safetyFlags: createAuditSafetyFlags(input.safetyEvaluation, input.input),
    metadata: createPersistenceMetadata({
      input: input.input,
      safetyEvaluation: input.safetyEvaluation,
      metadataSummary: input.metadataSummary,
      safeDataSummary:
        input.safetyEvaluation.safeDataUnsafe ||
        input.safetyEvaluation.secretUnsafe
          ? undefined
          : input.safeDataSummary,
      warnings: input.warnings,
      recordKind: "runtime_audit_log_preview",
      relatedToolCallId: input.toolCall.id,
    }),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    productionAuditEnabled: false,
  };
}

function createRuntimeEventInput(input: {
  readonly input: ReadOnlyToolSandboxPersistenceInput;
  readonly toolCall: AgentRuntimeToolCallRecord;
  readonly auditLog: AgentRuntimeAuditLogRecord;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly warnings: readonly string[];
  readonly maxSummaryLength: number;
}): AppendRuntimeEventPreviewInput {
  return {
    eventKind: input.safetyEvaluation.eventKind,
    action: sanitizeSummary(input.input.toolKey, input.maxSummaryLength),
    message:
      input.safetyEvaluation.status === "allowed_static_readonly_preview"
        ? "已记录只读工具沙箱 skeleton 的静态只读结果预览；未执行危险工具，未调用模型。"
        : "已记录只读工具沙箱 skeleton 的预览尝试；未执行危险工具，未调用模型。",
    payload: toRepositoryJsonValue({
      toolKey: normalizeOptionalText(input.input.toolKey),
      toolCallId: input.toolCall.id,
      auditLogId: input.auditLog.id,
      status: input.safetyEvaluation.status,
      blockedReasons: input.safetyEvaluation.blockedReasons,
      warnings: input.warnings,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
      llmCallEnabled: false,
    }),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
  };
}

function createAuditSafetyFlags(
  safetyEvaluation: ResultSafetyEvaluation,
  input: ReadOnlyToolSandboxPersistenceInput,
): AgentRuntimeRepositoryJsonValue | undefined {
  return toRepositoryJsonValue({
    ...previewSafetyFlags,
    readOnly: input.result.readOnly !== false,
    secretSafe:
      input.result.secretSafe !== false &&
      !safetyEvaluation.unsafeMetadata &&
      !safetyEvaluation.safeDataUnsafe,
    dangerousResultDetected: safetyEvaluation.dangerousResultDetected,
    unsafeMetadataDetected: safetyEvaluation.unsafeMetadata,
    reportedResultFlags: {
      networkAccessed: input.result.networkAccessed === true,
      fileSystemAccessed: input.result.fileSystemAccessed === true,
      databaseAccessed: input.result.databaseAccessed === true,
      commandExecuted: input.result.commandExecuted === true,
      llmCalled: input.result.llmCalled === true,
    },
  });
}

function createPersistenceMetadata(input: {
  readonly input: ReadOnlyToolSandboxPersistenceInput;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly safeDataSummary: MetadataSummary | undefined;
  readonly warnings: readonly string[];
  readonly recordKind: string;
  readonly relatedToolCallId?: string;
}): AgentRuntimeRepositoryJsonValue | undefined {
  const sandboxDecisionSummary = summarizeSandboxDecision(
    input.input.result.sandboxDecision,
  );
  const resultToolKey = normalizeOptionalText(input.input.result.toolKey);
  const metadata: Record<string, unknown> = {
    kind: "readonly_tool_sandbox_audit_persistence_preview",
    recordKind: input.recordKind,
    requestId: normalizeOptionalText(input.input.requestId),
    toolKey: normalizeOptionalText(input.input.toolKey),
    resultToolKey:
      resultToolKey !== normalizeOptionalText(input.input.toolKey)
        ? resultToolKey
        : undefined,
    relatedToolCallId: input.relatedToolCallId,
    sourceStatus: normalizeOptionalText(input.input.result.status),
    normalizedStatus: input.safetyEvaluation.status,
    ok: input.input.result.ok === true,
    executed: input.input.result.executed === true,
    readOnly: input.input.result.readOnly !== false,
    previewOrMockOnly: input.input.result.previewOrMockOnly !== false,
    sideEffectLevel: normalizeOptionalText(input.input.result.sideEffectLevel),
    secretSafe: input.input.result.secretSafe !== false,
    blockedReasonCount: input.safetyEvaluation.blockedReasons.length,
    warningCount: input.warnings.length,
    localBlockedReasons: input.safetyEvaluation.localBlockedReasons,
    dangerousResultDetected: input.safetyEvaluation.dangerousResultDetected,
    metadataSummary: input.metadataSummary,
    safeDataSummary: input.safeDataSummary,
    sandboxDecisionSummary,
    persistedAtPreview: normalizeOptionalText(input.input.now),
    previewOnly: true,
    executable: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    llmCallEnabled: false,
    productionAuditEnabled: false,
    rawPayloadStored: false,
  };

  return toRepositoryJsonValue(metadata);
}

function createResultSummary(input: {
  readonly result: ReadOnlyToolSandboxExecutionResultLike;
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly maxSummaryLength: number;
}): string {
  const baseSummary =
    sanitizeSummary(input.result.resultSummary, input.maxSummaryLength) ??
    sanitizeSummary(input.result.message, input.maxSummaryLength) ??
    "只读工具沙箱 skeleton result-like 输入已保存为 preview record。";

  if (input.safetyEvaluation.dangerousResultDetected) {
    const reasonSummary = input.safetyEvaluation.localBlockedReasons.join(", ");

    return sanitizeSummary(
      `检测到非只读安全边界，已按 preview blocked 处理。原因：${reasonSummary}。原始结果摘要仅保留安全摘要：${baseSummary}`,
      input.maxSummaryLength,
    ) as string;
  }

  if (input.safetyEvaluation.status === "blocked_preview") {
    return sanitizeSummary(
      `只读工具沙箱 skeleton result-like 已按 blocked preview 记录。${baseSummary}`,
      input.maxSummaryLength,
    ) as string;
  }

  if (input.safetyEvaluation.status === "disabled_preview") {
    return sanitizeSummary(
      `只读工具沙箱 skeleton runtime disabled / attempt preview 已记录；未执行工具。${baseSummary}`,
      input.maxSummaryLength,
    ) as string;
  }

  return baseSummary;
}

function createResultWarnings(input: {
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly metadataSummary: MetadataSummary | undefined;
  readonly safeDataSummary: MetadataSummary | undefined;
}): string[] {
  return normalizeUniqueStrings([
    "tool_sandbox_audit_persistence_preview_only",
    "real_execution_enabled_false",
    "tool_execution_enabled_false",
    "llm_call_enabled_false",
    ...(input.metadataSummary?.sensitiveMetadataDetected === true
      ? ["unsafe_metadata"]
      : []),
    ...(input.safeDataSummary?.sensitiveMetadataDetected === true
      ? ["unsafe_safe_data_summary_skipped"]
      : []),
    ...(input.safetyEvaluation.dangerousResultDetected
      ? ["dangerous_result_detected_saved_as_blocked_preview"]
      : []),
    ...(input.safetyEvaluation.secretUnsafe
      ? ["result_not_secret_safe_safe_data_not_persisted"]
      : []),
  ]);
}

function createPersistenceResultMessage(input: {
  readonly safetyEvaluation: ResultSafetyEvaluation;
  readonly eventPersisted: boolean;
}): string {
  const eventMessage = input.eventPersisted
    ? " Runtime event preview was also persisted."
    : " Runtime event preview was not persisted.";

  if (input.safetyEvaluation.status === "allowed_static_readonly_preview") {
    return `Persisted read-only tool sandbox audit preview records for an allowed static read-only result. This did not execute a tool or enable production audit.${eventMessage}`;
  }

  if (input.safetyEvaluation.status === "disabled_preview") {
    return `Persisted read-only tool sandbox audit preview records for a disabled / attempted result. This did not execute a tool or enable production audit.${eventMessage}`;
  }

  return `Persisted read-only tool sandbox audit preview records for a blocked result. This did not execute a tool or enable production audit.${eventMessage}`;
}

function summarizeSandboxDecision(
  value: unknown,
): AgentRuntimeRepositoryJsonValue | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  return toRepositoryJsonValue({
    requestId: normalizeOptionalText(value.requestId),
    toolKey: normalizeOptionalText(value.toolKey),
    allowed: value.allowed === true,
    decisionKind: normalizeOptionalText(value.decisionKind),
    riskLevel: normalizeOptionalText(value.riskLevel),
    sideEffectLevel: normalizeOptionalText(value.sideEffectLevel),
    blockedReasons: normalizeStringArray(
      value.blockedReasons,
      defaultMaxSummaryLength,
    ),
    warnings: normalizeStringArray(value.warnings, defaultMaxSummaryLength),
    policyKey: normalizeOptionalText(value.policyKey),
    previewOnly: true,
    rawDecisionStored: false,
  });
}

function createSafeDataSummary(input: {
  readonly safeData: unknown;
  readonly includeSafeDataSummary: boolean;
}): MetadataSummary | undefined {
  if (!input.includeSafeDataSummary || input.safeData === undefined) {
    return undefined;
  }

  return createMetadataSummary(input.safeData);
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
): ToolSandboxAuditJsonValue | undefined {
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
        (item): item is ToolSandboxAuditJsonValue => item !== undefined,
      );
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seenObjects.has(value) || !isPlainObject(value)) {
    return undefined;
  }

  seenObjects.add(value);

  const output: ToolSandboxAuditJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key) || isRawPayloadKey(key)) {
      output[key] = redactedValue;
      continue;
    }

    const sanitizedNestedValue = sanitizeJsonValue(nestedValue, seenObjects);

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
      /\b(raw[-_ ]?prompt|raw[-_ ]?messages|raw[-_ ]?tool[-_ ]?input|raw[-_ ]?tool[-_ ]?output|raw[-_ ]?request|raw[-_ ]?response)\b\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
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

function normalizeMaxSummaryLength(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 80) {
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
