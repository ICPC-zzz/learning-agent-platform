import type {
  AgentPermissionDecisionRecord,
  AgentPermissionRequestRecord,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

type JsonRecord = Record<string, unknown>;

export type AgentPermissionPreviewDetailLoadStatus =
  | "database"
  | "not_found"
  | "unavailable"
  | "read_failed";

export type AgentPermissionPreviewDetailErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "not_found"
  | "invalid_permission_request_id"
  | "unknown";

export type AgentPermissionPreviewJsonSummaryType =
  | "array"
  | "object"
  | "primitive"
  | "null";

export interface AgentPermissionPreviewJsonSummary {
  available: boolean;
  type: AgentPermissionPreviewJsonSummaryType;
  count: number | null;
  topLevelKeys: readonly string[];
  summary: string;
}

export interface AgentPermissionRequestDetailItem {
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
  permissionRequestsSummary: AgentPermissionPreviewJsonSummary;
  blockedRequestsSummary: AgentPermissionPreviewJsonSummary;
  informationalRequestsSummary: AgentPermissionPreviewJsonSummary;
  confirmationSummary: AgentPermissionPreviewJsonSummary;
  riskSummary: AgentPermissionPreviewJsonSummary;
  recommendedNextActionsSummary: AgentPermissionPreviewJsonSummary;
  safetyNotesSummary: AgentPermissionPreviewJsonSummary;
  previewPayloadSummary: AgentPermissionPreviewJsonSummary;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentPermissionDecisionDetailItem {
  id: string;
  permissionRequestId: string | null;
  taskId: string | null;
  decisionStatus: string;
  sourceRequestStatus: string;
  permissionFlowEnabled: false;
  decisionCaptured: false;
  executable: false;
  realExecutionEnabled: false;
  requiredBeforeExecution: boolean;
  approvableRequestIdsSummary: AgentPermissionPreviewJsonSummary;
  blockedRequestIdsSummary: AgentPermissionPreviewJsonSummary;
  informationalRequestIdsSummary: AgentPermissionPreviewJsonSummary;
  missingDecisionReasonsSummary: AgentPermissionPreviewJsonSummary;
  blockedReasonsSummary: AgentPermissionPreviewJsonSummary;
  decisionItemsSummary: AgentPermissionPreviewJsonSummary;
  decisionShapePreviewSummary: AgentPermissionPreviewJsonSummary;
  recommendedNextActionsSummary: AgentPermissionPreviewJsonSummary;
  safetyNotesSummary: AgentPermissionPreviewJsonSummary;
  previewPayloadSummary: AgentPermissionPreviewJsonSummary;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentPermissionPreviewDetailLoadResult {
  status: AgentPermissionPreviewDetailLoadStatus;
  permissionRequest: AgentPermissionRequestDetailItem | null;
  decisions: readonly AgentPermissionDecisionDetailItem[];
  decisionCount: number;
  message: string;
  errorCategory?: AgentPermissionPreviewDetailErrorCategory;
  previewOnly: true;
  permissionFlowEnabled: false;
  decisionCaptured: false;
  executable: false;
  realExecutionEnabled: false;
  decisionOrder: "desc";
  limit: number;
}

const permissionDecisionDetailLimit = 100;
const defaultRequestStatus = "preview_only";
const defaultDecisionStatus = "no_decision_captured";
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
  decisionOrder: "desc",
  limit: permissionDecisionDetailLimit,
} as const;

export async function loadAgentPermissionPreviewDetail(
  permissionRequestId: string,
): Promise<AgentPermissionPreviewDetailLoadResult> {
  const normalizedPermissionRequestId = normalizeOptionalText(
    permissionRequestId,
  );

  if (normalizedPermissionRequestId === null) {
    return createResult({
      status: "not_found",
      errorCategory: "invalid_permission_request_id",
      message:
        "由于权限请求 ID 为空或无效，未找到权限预览详情。",
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
        "由于未配置 DATABASE_URL，暂时无法读取权限预览详情。",
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
        "由于 Prisma 客户端无法初始化，暂时无法读取权限预览详情。",
    });
  }

  try {
    const permissionRequest = await repository.getPermissionRequestById(
      normalizedPermissionRequestId,
    );

    if (permissionRequest === null) {
      return createResult({
        status: "not_found",
        errorCategory: "not_found",
        message: "未找到已保存的权限请求预览记录。",
      });
    }

    const decisions = await repository.listPermissionDecisionsByRequest(
      normalizedPermissionRequestId,
      {
        limit: permissionDecisionDetailLimit,
      },
    );

    return createResult({
      status: "database",
      permissionRequest: mapPermissionRequestRecord(permissionRequest),
      decisions: decisions.map(mapPermissionDecisionRecord),
      message:
        "已从数据库只读加载权限预览详情。",
    });
  } catch (error) {
    return createResult({
      status: "read_failed",
      errorCategory: isPrismaUnavailableError(error)
        ? "database_unavailable"
        : "repository_failed",
      message:
        "由于只读仓库查询失败，暂时无法读取权限预览详情。",
    });
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | AgentPermissionPreviewDetailLoadResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 边界无法加载，暂时无法读取权限预览详情。",
    });
  }
}

function mapPermissionRequestRecord(
  record: AgentPermissionRequestRecord,
): AgentPermissionRequestDetailItem {
  return {
    id: record.id,
    taskId: normalizeOptionalText(record.taskId),
    requestStatus:
      normalizeOptionalText(record.requestStatus) ?? defaultRequestStatus,
    sourceRequestStatus:
      normalizeOptionalText(record.sourceRequestStatus) ??
      defaultSourceRequestStatus,
    autonomyLevel:
      normalizeOptionalText(record.autonomyLevel) ?? defaultAutonomyLevel,
    overallRiskLevel:
      normalizeOptionalText(record.overallRiskLevel) ?? defaultRiskLevel,
    allowedByCurrentAutonomy: record.allowedByCurrentAutonomy,
    requiresConfirmation: record.requiresConfirmation,
    permissionFlowEnabled: false,
    executable: false,
    realExecutionEnabled: false,
    permissionRequestsSummary: summarizeJsonPayload(
      record.permissionRequests,
      "permissionRequests",
    ),
    blockedRequestsSummary: summarizeJsonPayload(
      record.blockedRequests,
      "blockedRequests",
    ),
    informationalRequestsSummary: summarizeJsonPayload(
      record.informationalRequests,
      "informationalRequests",
    ),
    confirmationSummary: summarizeJsonPayload(
      record.confirmationSummary,
      "confirmationSummary",
    ),
    riskSummary: summarizeJsonPayload(record.riskSummary, "riskSummary"),
    recommendedNextActionsSummary: summarizeJsonPayload(
      record.recommendedNextActions,
      "recommendedNextActions",
    ),
    safetyNotesSummary: summarizeJsonPayload(
      record.safetyNotes,
      "safetyNotes",
    ),
    previewPayloadSummary: summarizeJsonPayload(
      record.previewPayload,
      "previewPayload",
    ),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapPermissionDecisionRecord(
  record: AgentPermissionDecisionRecord,
): AgentPermissionDecisionDetailItem {
  return {
    id: record.id,
    permissionRequestId: normalizeOptionalText(record.permissionRequestId),
    taskId: normalizeOptionalText(record.taskId),
    decisionStatus:
      normalizeOptionalText(record.decisionStatus) ?? defaultDecisionStatus,
    sourceRequestStatus:
      normalizeOptionalText(record.sourceRequestStatus) ??
      defaultSourceRequestStatus,
    permissionFlowEnabled: false,
    decisionCaptured: false,
    executable: false,
    realExecutionEnabled: false,
    requiredBeforeExecution: record.requiredBeforeExecution,
    approvableRequestIdsSummary: summarizeJsonPayload(
      record.approvableRequestIds,
      "approvableRequestIds",
    ),
    blockedRequestIdsSummary: summarizeJsonPayload(
      record.blockedRequestIds,
      "blockedRequestIds",
    ),
    informationalRequestIdsSummary: summarizeJsonPayload(
      record.informationalRequestIds,
      "informationalRequestIds",
    ),
    missingDecisionReasonsSummary: summarizeJsonPayload(
      record.missingDecisionReasons,
      "missingDecisionReasons",
    ),
    blockedReasonsSummary: summarizeJsonPayload(
      record.blockedReasons,
      "blockedReasons",
    ),
    decisionItemsSummary: summarizeJsonPayload(
      record.decisionItems,
      "decisionItems",
    ),
    decisionShapePreviewSummary: summarizeJsonPayload(
      record.decisionShapePreview,
      "decisionShapePreview",
    ),
    recommendedNextActionsSummary: summarizeJsonPayload(
      record.recommendedNextActions,
      "recommendedNextActions",
    ),
    safetyNotesSummary: summarizeJsonPayload(
      record.safetyNotes,
      "safetyNotes",
    ),
    previewPayloadSummary: summarizeJsonPayload(
      record.previewPayload,
      "previewPayload",
    ),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function summarizeJsonPayload(
  value: unknown,
  label: string,
): AgentPermissionPreviewJsonSummary {
  if (value === null || value === undefined) {
    return {
      available: false,
      type: "null",
      count: null,
      topLevelKeys: [],
      summary: `${label} 预览负载未保存。`,
    };
  }

  if (Array.isArray(value)) {
    return {
      available: true,
      type: "array",
      count: value.length,
      topLevelKeys: [],
      summary: `${label} 已保存为 ${value.length} 条预览项。`,
    };
  }

  if (isRecord(value)) {
    const topLevelKeys = Object.keys(value).slice(0, 12);

    return {
      available: true,
      type: "object",
      count: Object.keys(value).length,
      topLevelKeys,
      summary:
        topLevelKeys.length === 0
          ? `${label} 已保存为空对象。`
          : `${label} 已保存为对象，本页只展示顶层字段名。`,
    };
  }

  return {
    available: true,
    type: "primitive",
    count: null,
    topLevelKeys: [],
    summary: `${label} 已保存为 ${typeof value}。`,
  };
}

function createResult(input: {
  readonly status: AgentPermissionPreviewDetailLoadStatus;
  readonly permissionRequest?: AgentPermissionRequestDetailItem | null;
  readonly decisions?: readonly AgentPermissionDecisionDetailItem[];
  readonly message: string;
  readonly errorCategory?: AgentPermissionPreviewDetailErrorCategory;
}): AgentPermissionPreviewDetailLoadResult {
  const decisions = input.decisions ?? [];
  const result: AgentPermissionPreviewDetailLoadResult = {
    ...previewOnlyFlags,
    status: input.status,
    permissionRequest: input.permissionRequest ?? null,
    decisions,
    decisionCount: decisions.length,
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
