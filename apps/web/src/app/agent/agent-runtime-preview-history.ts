import type { AgentRuntimeExecutionRecord } from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

export type AgentRuntimePreviewHistoryLoadStatus =
  | "database"
  | "unavailable"
  | "empty"
  | "read_failed";

export type AgentRuntimePreviewHistoryErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "unknown";

export interface AgentRuntimePreviewHistoryItem {
  id: string;
  shortId: string;
  taskId: string | null;
  shortTaskId: string | null;
  executionStatus: string;
  lifecycleStatus: string;
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
}

export interface AgentRuntimePreviewHistoryLoadResult {
  status: AgentRuntimePreviewHistoryLoadStatus;
  records: readonly AgentRuntimePreviewHistoryItem[];
  recordCount: number;
  message: string;
  errorCategory?: AgentRuntimePreviewHistoryErrorCategory;
  previewOnly: true;
  executable: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  permissionConfirmationEnabled: false;
  backgroundJobEnabled: false;
  userIdStrategy: "demo_runtime_preview_user";
  userId: string;
  limit: number;
}

const runtimePreviewHistoryLimit = 8;
const runtimePreviewHistoryUserId = "runtime_preview_demo_user";
const defaultExecutionStatus = "preview_ready";
const defaultLifecycleStatus = "preview_only";
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
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  userIdStrategy: "demo_runtime_preview_user",
  userId: runtimePreviewHistoryUserId,
  limit: runtimePreviewHistoryLimit,
} as const;

export async function loadAgentRuntimePreviewHistory(): Promise<AgentRuntimePreviewHistoryLoadResult> {
  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "运行预览记录暂时无法加载，因为当前未配置 DATABASE_URL。此错误不影响当前 Agent 预览页面的其他只读内容。",
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
        "运行预览记录暂时无法加载，因为 Prisma client 无法初始化。此错误不影响当前 Agent 预览页面的其他只读内容。",
    });
  }

  try {
    const records = await repository.listRuntimeExecutionsByUser(
      runtimePreviewHistoryUserId,
      {
        limit: runtimePreviewHistoryLimit,
      },
    );
    const historyItems = records.map(mapRecordToHistoryItem);

    if (historyItems.length === 0) {
      return createResult({
        status: "empty",
        message:
          "暂无运行预览记录。你可以通过“保存预览记录”生成一条模拟预览数据，用于检查运行预览页面展示效果。",
      });
    }

    return createResult({
      status: "database",
      records: historyItems,
      message: "最近运行预览记录已从数据库只读加载。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "运行预览记录暂时无法加载。请检查数据库环境或稍后重试。此错误不影响当前 Agent 预览页面的其他只读内容。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentRuntimePreviewHistoryLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "运行预览记录暂时无法加载，因为数据库 package 或 Prisma 边界无法加载。此错误不影响当前 Agent 预览页面的其他只读内容。",
    });
  }
}

function mapRecordToHistoryItem(
  record: AgentRuntimeExecutionRecord,
): AgentRuntimePreviewHistoryItem {
  const normalizedTaskId = normalizeOptionalText(record.taskId);

  return {
    id: record.id,
    shortId: shortenId(record.id),
    taskId: normalizedTaskId,
    shortTaskId:
      normalizedTaskId === null ? null : shortenId(normalizedTaskId),
    executionStatus:
      normalizeOptionalText(record.executionStatus) ?? defaultExecutionStatus,
    lifecycleStatus:
      normalizeOptionalText(record.lifecycleStatus) ?? defaultLifecycleStatus,
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
  };
}

function createResult(input: {
  readonly status: AgentRuntimePreviewHistoryLoadStatus;
  readonly records?: readonly AgentRuntimePreviewHistoryItem[];
  readonly message: string;
  readonly errorCategory?: AgentRuntimePreviewHistoryErrorCategory;
}): AgentRuntimePreviewHistoryLoadResult {
  const records = input.records ?? [];
  const result: AgentRuntimePreviewHistoryLoadResult = {
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

function shortenId(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 10)}...`;
}
