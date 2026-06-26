import type {
  AgentPermissionDecisionRecord,
  AgentPermissionRequestRecord,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

type JsonRecord = Record<string, unknown>;

export type AgentPermissionPreviewHistoryLoadStatus =
  | "database"
  | "unavailable"
  | "empty"
  | "read_failed";

export type AgentPermissionPreviewHistoryErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "unknown";

export interface AgentPermissionPreviewJsonSummary {
  available: boolean;
  count: number | null;
  topLevelKeys: readonly string[];
  summary: string;
}

export interface AgentPermissionPreviewHistoryItem {
  id: string;
  taskId: string | null;
  requestStatus: string;
  sourceRequestStatus: string;
  autonomyLevel: string;
  overallRiskLevel: string;
  allowedByCurrentAutonomy: boolean | null;
  requiresConfirmation: boolean;
  permissionFlowEnabled: false;
  executable: false;
  realExecutionEnabled: false;
  createdAt: string;
  updatedAt?: string;
  permissionRequestsSummary: AgentPermissionPreviewJsonSummary;
  blockedRequestsSummary: AgentPermissionPreviewJsonSummary;
  informationalRequestsSummary: AgentPermissionPreviewJsonSummary;
  decisionCount: number;
  latestDecisionId?: string;
  latestDecisionStatus?: string;
  latestDecisionCaptured?: false;
  latestDecisionPermissionFlowEnabled?: false;
  latestDecisionExecutable?: false;
  latestDecisionRealExecutionEnabled?: false;
  latestDecisionCreatedAt?: string;
}

export interface AgentPermissionPreviewHistoryLoadResult {
  status: AgentPermissionPreviewHistoryLoadStatus;
  records: readonly AgentPermissionPreviewHistoryItem[];
  recordCount: number;
  message: string;
  errorCategory?: AgentPermissionPreviewHistoryErrorCategory;
  previewOnly: true;
  permissionFlowEnabled: false;
  decisionCaptured: false;
  executable: false;
  realExecutionEnabled: false;
  taskIdStrategy: "null_preview_task";
  limit: number;
  decisionSummaryLimit: number;
}

const permissionPreviewHistoryLimit = 8;
const permissionDecisionSummaryLimit = 20;
const permissionPreviewHistoryTaskId: string | null = null;
const defaultRequestStatus = "preview_only";
const defaultSourceRequestStatus = "unknown";
const defaultAutonomyLevel = "unknown";
const defaultRiskLevel = "unknown";
const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

const previewOnlyFlags = {
  previewOnly: true,
  permissionFlowEnabled: false,
  decisionCaptured: false,
  executable: false,
  realExecutionEnabled: false,
  taskIdStrategy: "null_preview_task",
  limit: permissionPreviewHistoryLimit,
  decisionSummaryLimit: permissionDecisionSummaryLimit,
} as const;

export async function loadAgentPermissionPreviewHistory(): Promise<AgentPermissionPreviewHistoryLoadResult> {
  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "由于未配置 DATABASE_URL，暂时无法读取权限预览历史。当前权限预览面板仍可使用。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentPermissionRepository"]>;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentPermissionRepository(prisma);
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于 Prisma 客户端无法初始化，暂时无法读取权限预览历史。当前权限预览面板仍可使用。",
    });
  }

  try {
    const requestRecords =
      await repository.listRecentPermissionRequestPreviews({
        taskId: permissionPreviewHistoryTaskId,
        limit: permissionPreviewHistoryLimit,
      });
    const historyItems = await Promise.all(
      requestRecords.map(async (requestRecord) => {
        const decisions = await repository.listPermissionDecisionsByRequest(
          requestRecord.id,
          {
            limit: permissionDecisionSummaryLimit,
          },
        );

        return mapRequestRecordToHistoryItem(requestRecord, decisions);
      }),
    );

    if (historyItems.length === 0) {
      return createResult({
        status: "empty",
        message: "暂无已保存的权限预览记录。",
      });
    }

    return createResult({
      status: "database",
      records: historyItems,
      message:
        "已从数据库只读加载最近保存的权限预览记录。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "由于只读仓库查询失败，暂时无法读取权限预览历史。当前权限预览面板仍可使用。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentPermissionPreviewHistoryLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 边界无法加载，暂时无法读取权限预览历史。当前权限预览面板仍可使用。",
    });
  }
}

function mapRequestRecordToHistoryItem(
  requestRecord: AgentPermissionRequestRecord,
  decisions: readonly AgentPermissionDecisionRecord[],
): AgentPermissionPreviewHistoryItem {
  const latestDecision = decisions[0];
  const item: AgentPermissionPreviewHistoryItem = {
    id: requestRecord.id,
    taskId: normalizeOptionalText(requestRecord.taskId),
    requestStatus:
      normalizeOptionalText(requestRecord.requestStatus) ??
      defaultRequestStatus,
    sourceRequestStatus:
      normalizeOptionalText(requestRecord.sourceRequestStatus) ??
      defaultSourceRequestStatus,
    autonomyLevel:
      normalizeOptionalText(requestRecord.autonomyLevel) ??
      defaultAutonomyLevel,
    overallRiskLevel:
      normalizeOptionalText(requestRecord.overallRiskLevel) ??
      defaultRiskLevel,
    allowedByCurrentAutonomy: requestRecord.allowedByCurrentAutonomy,
    requiresConfirmation: requestRecord.requiresConfirmation,
    permissionFlowEnabled: false,
    executable: false,
    realExecutionEnabled: false,
    createdAt: requestRecord.createdAt.toISOString(),
    updatedAt: requestRecord.updatedAt.toISOString(),
    permissionRequestsSummary: summarizeJsonPayload(
      requestRecord.permissionRequests,
      "permissionRequests",
    ),
    blockedRequestsSummary: summarizeJsonPayload(
      requestRecord.blockedRequests,
      "blockedRequests",
    ),
    informationalRequestsSummary: summarizeJsonPayload(
      requestRecord.informationalRequests,
      "informationalRequests",
    ),
    decisionCount: decisions.length,
  };

  if (latestDecision !== undefined) {
    item.latestDecisionId = latestDecision.id;
    item.latestDecisionStatus =
      normalizeOptionalText(latestDecision.decisionStatus) ??
      "no_decision_captured";
    item.latestDecisionCaptured = false;
    item.latestDecisionPermissionFlowEnabled = false;
    item.latestDecisionExecutable = false;
    item.latestDecisionRealExecutionEnabled = false;
    item.latestDecisionCreatedAt = latestDecision.createdAt.toISOString();
  }

  return item;
}

function summarizeJsonPayload(
  value: unknown,
  label: string,
): AgentPermissionPreviewJsonSummary {
  if (value === null || value === undefined) {
    return {
      available: false,
      count: null,
      topLevelKeys: [],
      summary: `${label} 预览负载未保存。`,
    };
  }

  if (Array.isArray(value)) {
    return {
      available: true,
      count: value.length,
      topLevelKeys: [],
      summary: `${label} 已保存为 ${value.length} 条预览项。`,
    };
  }

  if (isRecord(value)) {
    const topLevelKeys = Object.keys(value).slice(0, 8);

    return {
      available: true,
      count: null,
      topLevelKeys,
      summary:
        topLevelKeys.length === 0
          ? `${label} 已保存为空对象。`
          : `${label} 已保存为对象，本页只展示顶层字段名。`,
    };
  }

  return {
    available: true,
    count: null,
    topLevelKeys: [],
    summary: `${label} 已保存为 ${typeof value}。`,
  };
}

function createResult(input: {
  readonly status: AgentPermissionPreviewHistoryLoadStatus;
  readonly records?: readonly AgentPermissionPreviewHistoryItem[];
  readonly message: string;
  readonly errorCategory?: AgentPermissionPreviewHistoryErrorCategory;
}): AgentPermissionPreviewHistoryLoadResult {
  const records = input.records ?? [];
  const result: AgentPermissionPreviewHistoryLoadResult = {
    ...previewOnlyFlags,
    status: input.status,
    records,
    recordCount: records.length,
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
