import type {
  AgentTaskEventRecord,
  AgentTaskRecord,
  AgentTaskSnapshotRecord,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

type JsonRecord = Record<string, unknown>;

export type AgentPreviewTaskDetailLoadStatus =
  | "database"
  | "not_found"
  | "unavailable"
  | "read_failed";

export type AgentPreviewTaskDetailErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "not_found"
  | "invalid_task_id"
  | "unknown";

export interface AgentPreviewPayloadSummary {
  payloadAvailable: boolean;
  summary: string;
  topLevelKeys: readonly string[];
  hasPlanPreview: boolean;
  hasToolRequirementReview: boolean;
  hasSkillSuggestionPreview: boolean;
  hasMemoryContextPreview: boolean;
  hasExecutionReadinessPreview: boolean;
  readinessStatus?: string;
  overallRiskLevel?: string;
  blockerCount?: number;
  warningCount?: number;
  recommendedNextActionCount?: number;
}

export interface AgentPreviewTaskSafetyFlagsSummary {
  available: boolean;
  topLevelKeys: readonly string[];
  disabledRuntimeFlags: readonly string[];
}

export interface AgentPreviewTaskSafetyNotesSummary {
  available: boolean;
  count: number;
  previewItems: readonly string[];
  summary: string;
}

export interface AgentPreviewTaskDetailItem {
  id: string;
  taskText: string;
  taskSummary: string;
  mode: string;
  lifecycleStatus: string;
  readinessStatus: string;
  autonomyLevel: string;
  overallRiskLevel: string;
  executable: false;
  realExecutionEnabled: false;
  safetyFlagsSummary: AgentPreviewTaskSafetyFlagsSummary;
  previewPayloadSummary: AgentPreviewPayloadSummary;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentPreviewTaskSnapshotItem {
  id: string;
  snapshotKind: string;
  lifecycleStatus: string;
  taskSummary: string;
  executable: false;
  realExecutionEnabled: false;
  payloadSummary: AgentPreviewPayloadSummary;
  safetyNotesSummary: AgentPreviewTaskSafetyNotesSummary;
  createdAt: string;
}

export interface AgentPreviewTaskEventItem {
  id: string;
  eventType: string;
  source: string;
  severity: string;
  message: string;
  relatedStepIndexesSummary: string;
  relatedToolNamesSummary: string;
  relatedSkillNamesSummary: string;
  safetyNotesSummary: AgentPreviewTaskSafetyNotesSummary;
  createdAt: string;
}

export interface AgentPreviewTaskDetailLoadResult {
  status: AgentPreviewTaskDetailLoadStatus;
  task: AgentPreviewTaskDetailItem | null;
  snapshots: readonly AgentPreviewTaskSnapshotItem[];
  events: readonly AgentPreviewTaskEventItem[];
  snapshotCount: number;
  eventCount: number;
  message: string;
  errorCategory?: AgentPreviewTaskDetailErrorCategory;
  previewOnly: true;
  executable: false;
  realExecutionEnabled: false;
  snapshotOrder: "asc";
  eventOrder: "asc";
  limit: number;
}

const previewTaskTimelineLimit = 100;
const defaultTaskSummary = "未命名预览任务。";
const defaultMode = "preview_only";
const defaultLifecycleStatus = "preview_created";
const defaultReadinessStatus = "preview_only";
const defaultAutonomyLevel = "unknown";
const defaultRiskLevel = "unknown";
const defaultSnapshotKind = "combined_preview";
const defaultEventType = "preview_created";
const defaultEventSource = "system_preview";
const defaultEventSeverity = "info";
const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

const previewOnlyFlags = {
  previewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  snapshotOrder: "asc",
  eventOrder: "asc",
  limit: previewTaskTimelineLimit,
} as const;

const runtimeDisabledFlagKeys = [
  "executable",
  "realExecutionEnabled",
  "toolsExecuted",
  "llmCalled",
  "networkUsed",
  "memoryRetrievalExecuted",
  "embeddingsUsed",
  "vectorSearchUsed",
  "ragUsed",
  "dataSaved",
  "skillGenerated",
  "skillInstalled",
  "skillExecuted",
] as const;

export async function loadAgentPreviewTaskDetail(
  taskId: string,
): Promise<AgentPreviewTaskDetailLoadResult> {
  const normalizedTaskId = normalizeOptionalText(taskId);

  if (normalizedTaskId === null) {
    return createResult({
      status: "not_found",
      errorCategory: "invalid_task_id",
      message:
        "由于任务 ID 为空或无效，未找到任务预览详情。",
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
        "由于未配置 DATABASE_URL，暂时无法读取任务预览详情。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentTaskRepository"]>;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentTaskRepository(prisma);
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于 Prisma 客户端无法初始化，暂时无法读取任务预览详情。",
    });
  }

  try {
    const task = await repository.getTaskById(normalizedTaskId);

    if (task === null) {
      return createResult({
        status: "not_found",
        errorCategory: "not_found",
        message: "未找到已保存的智能体任务预览记录。",
      });
    }

    const [snapshots, events] = await Promise.all([
      repository.listSnapshotsByTask(normalizedTaskId, {
        limit: previewTaskTimelineLimit,
        order: "asc",
      }),
      repository.listEventsByTask(normalizedTaskId, {
        limit: previewTaskTimelineLimit,
        order: "asc",
      }),
    ]);

    return createResult({
      status: "database",
      task: mapTaskRecord(task),
      snapshots: snapshots.map(mapSnapshotRecord),
      events: events.map(mapEventRecord),
      message:
        "已从数据库只读加载智能体任务预览详情。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "由于只读仓库查询失败，暂时无法读取任务预览详情。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentPreviewTaskDetailLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 边界无法加载，暂时无法读取任务预览详情。",
    });
  }
}

function mapTaskRecord(record: AgentTaskRecord): AgentPreviewTaskDetailItem {
  return {
    id: record.id,
    taskText: record.taskText,
    taskSummary: normalizeOptionalText(record.taskSummary) ?? defaultTaskSummary,
    mode: normalizeOptionalText(record.mode) ?? defaultMode,
    lifecycleStatus:
      normalizeOptionalText(record.lifecycleStatus) ?? defaultLifecycleStatus,
    readinessStatus:
      normalizeOptionalText(record.readinessStatus) ?? defaultReadinessStatus,
    autonomyLevel:
      normalizeOptionalText(record.autonomyLevel) ?? defaultAutonomyLevel,
    overallRiskLevel:
      normalizeOptionalText(record.overallRiskLevel) ?? defaultRiskLevel,
    executable: false,
    realExecutionEnabled: false,
    safetyFlagsSummary: summarizeSafetyFlags(record.safetyFlags),
    previewPayloadSummary: summarizePreviewPayload(record.previewPayload),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapSnapshotRecord(
  record: AgentTaskSnapshotRecord,
): AgentPreviewTaskSnapshotItem {
  return {
    id: record.id,
    snapshotKind:
      normalizeOptionalText(record.snapshotKind) ?? defaultSnapshotKind,
    lifecycleStatus:
      normalizeOptionalText(record.lifecycleStatus) ?? defaultLifecycleStatus,
    taskSummary: normalizeOptionalText(record.taskSummary) ?? defaultTaskSummary,
    executable: false,
    realExecutionEnabled: false,
    payloadSummary: summarizePreviewPayload(record.payload),
    safetyNotesSummary: summarizeSafetyNotes(record.safetyNotes),
    createdAt: record.createdAt.toISOString(),
  };
}

function mapEventRecord(record: AgentTaskEventRecord): AgentPreviewTaskEventItem {
  return {
    id: record.id,
    eventType: normalizeOptionalText(record.eventType) ?? defaultEventType,
    source: normalizeOptionalText(record.source) ?? defaultEventSource,
    severity: normalizeOptionalText(record.severity) ?? defaultEventSeverity,
    message: record.message,
    relatedStepIndexesSummary: summarizeCollection(record.relatedStepIndexes),
    relatedToolNamesSummary: summarizeCollection(record.relatedToolNames),
    relatedSkillNamesSummary: summarizeCollection(record.relatedSkillNames),
    safetyNotesSummary: summarizeSafetyNotes(record.safetyNotes),
    createdAt: record.createdAt.toISOString(),
  };
}

function summarizePreviewPayload(value: unknown): AgentPreviewPayloadSummary {
  if (value === null || value === undefined) {
    return {
      payloadAvailable: false,
      summary: "没有保存预览负载。",
      topLevelKeys: [],
      hasPlanPreview: false,
      hasToolRequirementReview: false,
      hasSkillSuggestionPreview: false,
      hasMemoryContextPreview: false,
      hasExecutionReadinessPreview: false,
    };
  }

  if (!isRecord(value)) {
    return {
      payloadAvailable: true,
      summary: `预览负载已保存为 ${typeof value}。`,
      topLevelKeys: [],
      hasPlanPreview: false,
      hasToolRequirementReview: false,
      hasSkillSuggestionPreview: false,
      hasMemoryContextPreview: false,
      hasExecutionReadinessPreview: false,
    };
  }

  const readinessPreview = getNestedRecord(value, "executionReadinessPreview");
  const summary: AgentPreviewPayloadSummary = {
    payloadAvailable: true,
    summary: "预览负载已保存。",
    topLevelKeys: Object.keys(value).slice(0, 16),
    hasPlanPreview: isRecord(value.planPreview),
    hasToolRequirementReview: isRecord(value.toolRequirementReview),
    hasSkillSuggestionPreview: isRecord(value.skillSuggestionPreview),
    hasMemoryContextPreview: isRecord(value.memoryContextPreview),
    hasExecutionReadinessPreview: readinessPreview !== null,
  };
  const readinessStatus =
    getStringValue(readinessPreview, "readinessStatus") ??
    getStringValue(value, "readinessStatus");
  const overallRiskLevel =
    getStringValue(readinessPreview, "overallRiskLevel") ??
    getStringValue(value, "overallRiskLevel");
  const blockerCount = getArrayCount(readinessPreview, "blockers");
  const warningCount = getArrayCount(readinessPreview, "warnings");
  const recommendedNextActionCount = getArrayCount(
    readinessPreview,
    "recommendedNextActions",
  );

  if (readinessStatus !== null) {
    summary.readinessStatus = readinessStatus;
  }

  if (overallRiskLevel !== null) {
    summary.overallRiskLevel = overallRiskLevel;
  }

  if (blockerCount !== null) {
    summary.blockerCount = blockerCount;
  }

  if (warningCount !== null) {
    summary.warningCount = warningCount;
  }

  if (recommendedNextActionCount !== null) {
    summary.recommendedNextActionCount = recommendedNextActionCount;
  }

  return summary;
}

function summarizeSafetyFlags(
  value: unknown,
): AgentPreviewTaskSafetyFlagsSummary {
  if (!isRecord(value)) {
    return {
      available: false,
      topLevelKeys: [],
      disabledRuntimeFlags: [],
    };
  }

  return {
    available: true,
    topLevelKeys: Object.keys(value).slice(0, 16),
    disabledRuntimeFlags: runtimeDisabledFlagKeys.filter(
      (key) => value[key] === false,
    ),
  };
}

function summarizeSafetyNotes(
  value: unknown,
): AgentPreviewTaskSafetyNotesSummary {
  if (value === null || value === undefined) {
    return {
      available: false,
      count: 0,
      previewItems: [],
      summary: "没有保存安全说明。",
    };
  }

  if (Array.isArray(value)) {
    const previewItems = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 6);

    return {
      available: true,
      count: value.length,
      previewItems,
      summary: `已保存 ${value.length} 条安全说明。`,
    };
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).slice(0, 6);

    return {
      available: true,
      count: keys.length,
      previewItems: keys.map((key) => `${key}: 已保存`),
      summary: "安全说明已保存为对象。",
    };
  }

  return {
    available: true,
    count: 1,
    previewItems: [String(value)],
    summary: "已保存 1 条安全说明值。",
  };
}

function summarizeCollection(value: unknown): string {
  if (value === null || value === undefined) {
    return "无";
  }

  if (Array.isArray(value)) {
    const previewItems = value
      .map((item) => String(item))
      .filter((item) => item.trim().length > 0)
      .slice(0, 6);
    const suffix = value.length > previewItems.length ? "..." : "";

    return previewItems.length === 0
      ? `${value.length} 条`
      : `${previewItems.join(", ")}${suffix}（${value.length} 条）`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).slice(0, 6);

    return keys.length === 0
      ? "对象已保存"
      : `对象字段：${keys.join(", ")}`;
  }

  return String(value);
}

function createResult(input: {
  readonly status: AgentPreviewTaskDetailLoadStatus;
  readonly task?: AgentPreviewTaskDetailItem | null;
  readonly snapshots?: readonly AgentPreviewTaskSnapshotItem[];
  readonly events?: readonly AgentPreviewTaskEventItem[];
  readonly message: string;
  readonly errorCategory?: AgentPreviewTaskDetailErrorCategory;
}): AgentPreviewTaskDetailLoadResult {
  const snapshots = input.snapshots ?? [];
  const events = input.events ?? [];
  const result: AgentPreviewTaskDetailLoadResult = {
    ...previewOnlyFlags,
    status: input.status,
    task: input.task ?? null,
    snapshots,
    events,
    snapshotCount: snapshots.length,
    eventCount: events.length,
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedRecord(
  value: JsonRecord,
  key: string,
): JsonRecord | null {
  const nestedValue = value[key];

  return isRecord(nestedValue) ? nestedValue : null;
}

function getStringValue(value: JsonRecord | null, key: string): string | null {
  if (value === null) {
    return null;
  }

  const nestedValue = value[key];

  return typeof nestedValue === "string" && nestedValue.trim().length > 0
    ? nestedValue
    : null;
}

function getArrayCount(value: JsonRecord | null, key: string): number | null {
  if (value === null) {
    return null;
  }

  const nestedValue = value[key];

  return Array.isArray(nestedValue) ? nestedValue.length : null;
}
