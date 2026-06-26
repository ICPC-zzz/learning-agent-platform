import type { AgentTaskRecord } from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

export type AgentPreviewHistoryLoadStatus =
  | "database"
  | "unavailable"
  | "empty"
  | "read_failed";

export type AgentPreviewHistoryErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "missing_demo_user"
  | "unknown";

export interface AgentPreviewHistoryItem {
  id: string;
  taskSummary: string;
  taskTextPreview: string;
  mode: string;
  lifecycleStatus: string;
  readinessStatus: string;
  autonomyLevel: string;
  overallRiskLevel: string;
  executable: false;
  realExecutionEnabled: false;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentPreviewHistoryLoadResult {
  status: AgentPreviewHistoryLoadStatus;
  records: readonly AgentPreviewHistoryItem[];
  recordCount: number;
  message: string;
  errorCategory?: AgentPreviewHistoryErrorCategory;
  previewOnly: true;
  executable: false;
  realExecutionEnabled: false;
  userIdStrategy: "null_preview_user";
  limit: number;
}

const previewHistoryLimit = 8;
const previewHistoryUserId: string | null = null;
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
  userIdStrategy: "null_preview_user",
  limit: previewHistoryLimit,
} as const;

export async function loadAgentPreviewHistory(): Promise<AgentPreviewHistoryLoadResult> {
  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "由于未配置 DATABASE_URL，暂时无法读取预览历史。当前预览面板仍可使用。",
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
        "由于 Prisma 客户端无法初始化，暂时无法读取预览历史。当前预览面板仍可使用。",
    });
  }

  try {
    const records = await repository.listRecentPreviewTasks({
      userId: previewHistoryUserId,
      mode: "preview_only",
      limit: previewHistoryLimit,
    });
    const historyItems = records.map(mapRecordToHistoryItem);

    if (historyItems.length === 0) {
      return createResult({
        status: "empty",
        message: "暂无已保存的预览记录。",
      });
    }

    return createResult({
      status: "database",
      records: historyItems,
      message: "已从数据库读取最近保存的智能体预览记录。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "由于只读仓库查询失败，暂时无法读取预览历史。当前预览面板仍可使用。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentPreviewHistoryLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 边界无法加载，暂时无法读取预览历史。当前预览面板仍可使用。",
    });
  }
}

function mapRecordToHistoryItem(record: AgentTaskRecord): AgentPreviewHistoryItem {
  return {
    id: record.id,
    taskSummary:
      normalizeOptionalText(record.taskSummary) ?? "未命名预览任务。",
    taskTextPreview: truncateText(record.taskText, 220),
    mode: normalizeOptionalText(record.mode) ?? "preview_only",
    lifecycleStatus:
      normalizeOptionalText(record.lifecycleStatus) ?? "preview_created",
    readinessStatus:
      normalizeOptionalText(record.readinessStatus) ?? "preview_only",
    autonomyLevel: normalizeOptionalText(record.autonomyLevel) ?? "unknown",
    overallRiskLevel:
      normalizeOptionalText(record.overallRiskLevel) ?? "unknown",
    executable: false,
    realExecutionEnabled: false,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function createResult(input: {
  readonly status: AgentPreviewHistoryLoadStatus;
  readonly records?: readonly AgentPreviewHistoryItem[];
  readonly message: string;
  readonly errorCategory?: AgentPreviewHistoryErrorCategory;
}): AgentPreviewHistoryLoadResult {
  const records = input.records ?? [];
  const result: AgentPreviewHistoryLoadResult = {
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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
