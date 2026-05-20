import type {
  AgentRuntimeAuditLogRecord,
  AgentRuntimeEventRecord,
  AgentRuntimeExecutionRecord,
  AgentRuntimeLlmCallRecord,
  AgentRuntimeStepRecord,
  AgentRuntimeToolCallRecord,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");
type JsonRecord = Record<string, unknown>;

export type AgentRuntimePreviewDetailLoadStatus =
  | "database"
  | "not_found"
  | "unavailable"
  | "read_failed";

export type AgentRuntimePreviewDetailErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "not_found"
  | "invalid_execution_id"
  | "non_preview_record"
  | "unknown";

export interface RuntimeJsonSummary {
  available: boolean;
  type: "array" | "object" | "primitive" | "null";
  count: number | null;
  topLevelKeys: readonly string[];
  summary: string;
}

export interface RuntimeExecutionDetailItem {
  id: string;
  taskId: string | null;
  userIdShort: string | null;
  executionStatus: string;
  lifecycleStatus: string;
  currentStepId: string | null;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  toolExecutionEnabled: boolean;
  llmCallEnabled: boolean;
  permissionConfirmationEnabled: boolean;
  backgroundJobEnabled: boolean;
  streamingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  errorsSummary: RuntimeJsonSummary;
  errorPreviewItems: readonly RuntimeErrorPreviewItem[];
}

export interface RuntimeStepDetailItem {
  id: string;
  stepKey: string | null;
  title: string;
  kind: string;
  status: string;
  riskLevel: string | null;
  summary: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  blockedReasonsSummary: RuntimeJsonSummary;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeToolCallDetailItem {
  id: string;
  stepId: string | null;
  toolName: string;
  toolKind: string | null;
  status: string;
  requirementSummary: string | null;
  inputSummary: string | null;
  resultSummary: string | null;
  riskLevel: string | null;
  blockedReasonsSummary: RuntimeJsonSummary;
  sandboxRequired: boolean;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  toolExecutionEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeLlmCallDetailItem {
  id: string;
  stepId: string | null;
  providerKind: string | null;
  modelLabel: string | null;
  status: string;
  requestSummary: string | null;
  responseSummary: string | null;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  blockedReasonsSummary: RuntimeJsonSummary;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  llmCallEnabled: boolean;
  streamingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeEventDetailItem {
  id: string;
  eventKind: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string | null;
  message: string | null;
  payloadSummary: RuntimeJsonSummary;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  createdAt: string;
}

export interface RuntimeAuditLogDetailItem {
  id: string;
  actorKind: string | null;
  action: string;
  targetKind: string | null;
  riskLevel: string | null;
  riskSummary: string | null;
  previewOnly: boolean;
  executable: boolean;
  realExecutionEnabled: boolean;
  productionAuditEnabled: boolean;
  createdAt: string;
}

export interface RuntimeErrorPreviewItem {
  id: string;
  errorKind: string;
  message: string | null;
  blockedReason: string | null;
  previewOnly: boolean;
  createdAt: string | null;
}

export interface AgentRuntimePreviewDetailLoadResult {
  status: AgentRuntimePreviewDetailLoadStatus;
  execution: RuntimeExecutionDetailItem | null;
  steps: readonly RuntimeStepDetailItem[];
  toolCalls: readonly RuntimeToolCallDetailItem[];
  llmCalls: readonly RuntimeLlmCallDetailItem[];
  events: readonly RuntimeEventDetailItem[];
  auditLogs: readonly RuntimeAuditLogDetailItem[];
  stepCount: number;
  toolCallCount: number;
  llmCallCount: number;
  eventCount: number;
  auditLogCount: number;
  errorCount: number;
  message: string;
  errorCategory?: AgentRuntimePreviewDetailErrorCategory;
  previewOnly: true;
  executable: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  permissionConfirmationEnabled: false;
  backgroundJobEnabled: false;
  productionAuditEnabled: false;
  runtimeErrorsSource: "execution_errors_json";
  independentErrorRecordsSupported: false;
  recordOrder: "desc";
  limit: number;
}

const runtimeDetailRecordLimit = 100;
const defaultExecutionStatus = "preview_ready";
const defaultLifecycleStatus = "preview_only";
const defaultRecordStatus = "preview_only";
const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

const sensitiveTextPatterns = [
  "api key",
  "apikey",
  "api_key",
  "token",
  "authorization",
  "cookie",
  "private key",
  "client secret",
  "raw prompt",
  "raw messages",
  "raw tool input",
  "raw tool output",
] as const;

const previewOnlyFlags = {
  previewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  productionAuditEnabled: false,
  runtimeErrorsSource: "execution_errors_json",
  independentErrorRecordsSupported: false,
  recordOrder: "desc",
  limit: runtimeDetailRecordLimit,
} as const;

export async function loadAgentRuntimePreviewDetail(
  executionId: string,
): Promise<AgentRuntimePreviewDetailLoadResult> {
  const normalizedExecutionId = normalizeOptionalText(executionId);

  if (normalizedExecutionId === null) {
    return createResult({
      status: "not_found",
      errorCategory: "invalid_execution_id",
      message: "未找到运行预览详情，因为 executionId 为空或无效。",
    });
  }

  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "运行预览详情暂时无法加载。请检查数据库环境或稍后重试。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentRuntimeRepository"]>;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentRuntimeRepository(prisma);
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "运行预览详情暂时无法加载。请检查数据库环境或稍后重试。",
    });
  }

  try {
    const execution = await repository.getRuntimeExecutionById(
      normalizedExecutionId,
    );

    if (execution === null) {
      return createResult({
        status: "not_found",
        errorCategory: "not_found",
        message: "未找到对应的运行预览记录。",
      });
    }

    if (
      execution.previewOnly !== true ||
      execution.executable !== false ||
      execution.realExecutionEnabled !== false
    ) {
      return createResult({
        status: "not_found",
        errorCategory: "non_preview_record",
        message:
          "未找到可展示的运行预览记录。该页面只展示仅预览且不可执行的记录。",
      });
    }

    const [steps, toolCalls, llmCalls, events, auditLogs] =
      await Promise.all([
        repository.listRuntimeStepsByExecution(normalizedExecutionId, {
          limit: runtimeDetailRecordLimit,
        }),
        repository.listRuntimeToolCallsByExecution(normalizedExecutionId, {
          limit: runtimeDetailRecordLimit,
        }),
        repository.listRuntimeLlmCallsByExecution(normalizedExecutionId, {
          limit: runtimeDetailRecordLimit,
        }),
        repository.listRuntimeEventsByExecution(normalizedExecutionId, {
          limit: runtimeDetailRecordLimit,
        }),
        repository.listRuntimeAuditLogsByExecution(normalizedExecutionId, {
          limit: runtimeDetailRecordLimit,
        }),
      ]);

    return createResult({
      status: "database",
      execution: mapExecutionRecord(execution),
      steps: steps.map(mapStepRecord),
      toolCalls: toolCalls.map(mapToolCallRecord),
      llmCalls: llmCalls.map(mapLlmCallRecord),
      events: events.map(mapEventRecord),
      auditLogs: auditLogs.map(mapAuditLogRecord),
      message: "运行预览详情已从数据库只读加载。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "运行预览详情暂时无法加载。请检查数据库环境或稍后重试。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentRuntimePreviewDetailLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "运行预览详情暂时无法加载。请检查数据库环境或稍后重试。",
    });
  }
}

function mapExecutionRecord(
  record: AgentRuntimeExecutionRecord,
): RuntimeExecutionDetailItem {
  const errorPreviewItems = summarizeRuntimeErrors(record.errors);

  return {
    id: record.id,
    taskId: normalizeOptionalText(record.taskId),
    userIdShort: shortenOptionalId(record.userId),
    executionStatus:
      normalizeOptionalText(record.executionStatus) ?? defaultExecutionStatus,
    lifecycleStatus:
      normalizeOptionalText(record.lifecycleStatus) ?? defaultLifecycleStatus,
    currentStepId: normalizeOptionalText(record.currentStepId),
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    toolExecutionEnabled: record.toolExecutionEnabled,
    llmCallEnabled: record.llmCallEnabled,
    permissionConfirmationEnabled: record.permissionConfirmationEnabled,
    backgroundJobEnabled: record.backgroundJobEnabled,
    streamingEnabled: record.streamingEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    errorsSummary: summarizeJsonPayload(
      record.errors,
      "错误预览字段 (execution.errors)",
    ),
    errorPreviewItems,
  };
}

function mapStepRecord(record: AgentRuntimeStepRecord): RuntimeStepDetailItem {
  return {
    id: record.id,
    stepKey: safeOptionalText(record.stepKey),
    title: safeText(record.title),
    kind: safeText(record.kind),
    status: safeOptionalText(record.status) ?? defaultRecordStatus,
    riskLevel: safeOptionalText(record.riskLevel),
    summary: safeOptionalText(record.summary),
    inputSummary: safeOptionalText(record.inputSummary),
    outputSummary: safeOptionalText(record.outputSummary),
    blockedReasonsSummary: summarizeJsonPayload(
      record.blockedReasons,
      "阻断原因字段 (blockedReasons)",
    ),
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapToolCallRecord(
  record: AgentRuntimeToolCallRecord,
): RuntimeToolCallDetailItem {
  return {
    id: record.id,
    stepId: safeOptionalText(record.stepId),
    toolName: safeText(record.toolName),
    toolKind: safeOptionalText(record.toolKind),
    status: safeOptionalText(record.status) ?? defaultRecordStatus,
    requirementSummary: safeOptionalText(record.requirementSummary),
    inputSummary: safeOptionalText(record.inputSummary),
    resultSummary: safeOptionalText(record.resultSummary),
    riskLevel: safeOptionalText(record.riskLevel),
    blockedReasonsSummary: summarizeJsonPayload(
      record.blockedReasons,
      "阻断原因字段 (blockedReasons)",
    ),
    sandboxRequired: record.sandboxRequired,
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    toolExecutionEnabled: record.toolExecutionEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapLlmCallRecord(
  record: AgentRuntimeLlmCallRecord,
): RuntimeLlmCallDetailItem {
  return {
    id: record.id,
    stepId: safeOptionalText(record.stepId),
    providerKind: safeOptionalText(record.providerKind),
    modelLabel: safeOptionalText(record.modelLabel),
    status: safeOptionalText(record.status) ?? defaultRecordStatus,
    requestSummary: safeOptionalText(record.requestSummary),
    responseSummary: safeOptionalText(record.responseSummary),
    estimatedInputTokens: record.estimatedInputTokens,
    estimatedOutputTokens: record.estimatedOutputTokens,
    blockedReasonsSummary: summarizeJsonPayload(
      record.blockedReasons,
      "阻断原因字段 (blockedReasons)",
    ),
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    llmCallEnabled: record.llmCallEnabled,
    streamingEnabled: record.streamingEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapEventRecord(record: AgentRuntimeEventRecord): RuntimeEventDetailItem {
  return {
    id: record.id,
    eventKind: safeText(record.eventKind),
    fromStatus: safeOptionalText(record.fromStatus),
    toStatus: safeOptionalText(record.toStatus),
    action: safeOptionalText(record.action),
    message: safeOptionalText(record.message),
    payloadSummary: summarizeJsonPayload(
      record.payload,
      "事件负载字段 (payload)",
    ),
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapAuditLogRecord(
  record: AgentRuntimeAuditLogRecord,
): RuntimeAuditLogDetailItem {
  return {
    id: record.id,
    actorKind: safeOptionalText(record.actorKind),
    action: safeText(record.action),
    targetKind: safeOptionalText(record.targetKind),
    riskLevel: safeOptionalText(record.riskLevel),
    riskSummary: safeOptionalText(record.riskSummary),
    previewOnly: record.previewOnly,
    executable: record.executable,
    realExecutionEnabled: record.realExecutionEnabled,
    productionAuditEnabled: record.productionAuditEnabled,
    createdAt: record.createdAt.toISOString(),
  };
}

function summarizeRuntimeErrors(value: unknown): readonly RuntimeErrorPreviewItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .slice(0, runtimeDetailRecordLimit)
    .map((item, index) => {
      const errorId =
        getSafeString(item, "errorId") ??
        getSafeString(item, "id") ??
        `execution-error-${index + 1}`;

      return {
        id: errorId,
        errorKind: getSafeString(item, "errorKind") ?? "unknown",
        message:
          getSafeString(item, "userVisibleSummary") ??
          getSafeString(item, "message"),
        blockedReason:
          getSafeString(item, "blockedReason") ??
          getSafeString(item, "disabledReason"),
        previewOnly: item.previewOnly === true,
        createdAt: getSafeString(item, "createdAt"),
      };
    });
}

function summarizeJsonPayload(value: unknown, label: string): RuntimeJsonSummary {
  if (value === null || value === undefined) {
    return {
      available: false,
      type: "null",
      count: null,
      topLevelKeys: [],
      summary: `${label} 未保存。`,
    };
  }

  if (Array.isArray(value)) {
    return {
      available: true,
      type: "array",
      count: value.length,
      topLevelKeys: [],
      summary: `${label} 已保存为 ${value.length} 条预览摘要；本页不展示原始负载。`,
    };
  }

  if (isRecord(value)) {
    const topLevelKeys = summarizeTopLevelKeys(value);

    return {
      available: true,
      type: "object",
      count: Object.keys(value).length,
      topLevelKeys,
      summary:
        topLevelKeys.length === 0
          ? `${label} 已保存为空对象；本页不展示原始负载。`
          : `${label} 已保存为对象；本页只展示安全顶层字段名，不展示原始负载。`,
    };
  }

  return {
    available: true,
    type: "primitive",
    count: null,
    topLevelKeys: [],
    summary: `${label} 已保存为基础值；本页不展示原始负载。`,
  };
}

function createResult(input: {
  readonly status: AgentRuntimePreviewDetailLoadStatus;
  readonly execution?: RuntimeExecutionDetailItem | null;
  readonly steps?: readonly RuntimeStepDetailItem[];
  readonly toolCalls?: readonly RuntimeToolCallDetailItem[];
  readonly llmCalls?: readonly RuntimeLlmCallDetailItem[];
  readonly events?: readonly RuntimeEventDetailItem[];
  readonly auditLogs?: readonly RuntimeAuditLogDetailItem[];
  readonly message: string;
  readonly errorCategory?: AgentRuntimePreviewDetailErrorCategory;
}): AgentRuntimePreviewDetailLoadResult {
  const steps = input.steps ?? [];
  const toolCalls = input.toolCalls ?? [];
  const llmCalls = input.llmCalls ?? [];
  const events = input.events ?? [];
  const auditLogs = input.auditLogs ?? [];
  const errorPreviewItems = input.execution?.errorPreviewItems ?? [];
  const result: AgentRuntimePreviewDetailLoadResult = {
    ...previewOnlyFlags,
    status: input.status,
    execution: input.execution ?? null,
    steps,
    toolCalls,
    llmCalls,
    events,
    auditLogs,
    stepCount: steps.length,
    toolCallCount: toolCalls.length,
    llmCallCount: llmCalls.length,
    eventCount: events.length,
    auditLogCount: auditLogs.length,
    errorCount: errorPreviewItems.length,
    message: input.message,
  };

  if (input.errorCategory !== undefined) {
    result.errorCategory = input.errorCategory;
  }

  return result;
}

function isPrismaUnavailableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;

  return typeof code === "string" && prismaUnavailableErrorCodes.has(code);
}

function getSafeString(value: JsonRecord, key: string): string | null {
  const nestedValue = value[key];

  return typeof nestedValue === "string" ? safeOptionalText(nestedValue) : null;
}

function safeText(value: string): string {
  return safeOptionalText(value) ?? "未记录";
}

function safeOptionalText(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);

  if (normalized === null) {
    return null;
  }

  if (containsSensitiveDisplayText(normalized)) {
    return "已隐藏可能敏感内容";
  }

  return normalized;
}

function summarizeTopLevelKeys(value: JsonRecord): readonly string[] {
  const keys: string[] = [];

  for (const key of Object.keys(value)) {
    const safeKey = containsSensitiveDisplayText(key) ? "已隐藏敏感键" : key;

    if (!keys.includes(safeKey)) {
      keys.push(safeKey);
    }

    if (keys.length >= 12) {
      break;
    }
  }

  return keys;
}

function containsSensitiveDisplayText(value: string): boolean {
  const lowered = value.toLowerCase();
  const compact = lowered.replace(/[^a-z0-9]/g, "");

  return sensitiveTextPatterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/[^a-z0-9]/g, "");

    return (
      lowered.includes(pattern) ||
      (normalizedPattern.length > 0 && compact.includes(normalizedPattern))
    );
  });
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function shortenOptionalId(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);

  if (normalized === null) {
    return null;
  }

  return normalized.length <= 12
    ? normalized
    : `${normalized.slice(0, 12)}...`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
