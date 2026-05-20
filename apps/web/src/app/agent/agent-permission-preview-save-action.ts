"use server";

import type {
  AgentPermissionDecisionPreview,
  AgentPermissionRequestPreview,
} from "@learning-agent-platform/ai-core";
import type {
  AgentPermissionDecisionPreviewLike,
  AgentPermissionRequestPreviewLike,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

type SaveAgentPermissionPreviewJsonPrimitive =
  | string
  | number
  | boolean
  | null;

export type SaveAgentPermissionPreviewJsonValue =
  | SaveAgentPermissionPreviewJsonPrimitive
  | { readonly [key: string]: SaveAgentPermissionPreviewJsonValue }
  | readonly SaveAgentPermissionPreviewJsonValue[];

export type SaveAgentPermissionPreviewMetadata = Readonly<
  Record<string, SaveAgentPermissionPreviewJsonValue>
>;

export interface SaveAgentPermissionPreviewInput {
  taskId?: string | null;
  taskText?: string;
  permissionRequestPreview: AgentPermissionRequestPreview;
  permissionDecisionPreview: AgentPermissionDecisionPreview;
  metadata?: SaveAgentPermissionPreviewMetadata;
}

export type SaveAgentPermissionPreviewStatus =
  | "saved"
  | "unavailable"
  | "failed";

export type SaveAgentPermissionPreviewErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "invalid_input"
  | "unknown";

const PREVIEW_ONLY_RESULT_FLAGS = {
  previewOnly: true,
  permissionFlowEnabled: false,
  decisionCaptured: false,
  executable: false,
  realExecutionEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const;

export type SaveAgentPermissionPreviewResult =
  typeof PREVIEW_ONLY_RESULT_FLAGS & {
    status: SaveAgentPermissionPreviewStatus;
    savedPermissionRequestId?: string;
    savedPermissionDecisionId?: string;
    decisionPreviewSaved: boolean;
    permissionPreviewRecordSaved: boolean;
    dataSaved: boolean;
    errorCategory?: SaveAgentPermissionPreviewErrorCategory;
    message: string;
  };

const previewPermissionSaveBoundaryMetadata = {
  saveBoundary: "agent_permission_preview_save_server_action_mvp",
  previewOnly: true,
  permissionFlowEnabled: false,
  decisionCaptured: false,
  executionDisabled: true,
} as const satisfies SaveAgentPermissionPreviewMetadata;

const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

export async function saveAgentPermissionPreview(
  input: SaveAgentPermissionPreviewInput,
): Promise<SaveAgentPermissionPreviewResult> {
  if (!isRecord(input.permissionRequestPreview)) {
    return createFailureResult({
      status: "failed",
      errorCategory: "invalid_input",
      message:
        "保存权限预览记录前必须提供权限请求预览。本次未保存任何内容。",
    });
  }

  if (!isRecord(input.permissionDecisionPreview)) {
    return createFailureResult({
      status: "failed",
      errorCategory: "invalid_input",
      message:
        "保存权限预览记录前必须提供权限决策预览。本次未保存任何内容。",
    });
  }

  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "由于未配置 DATABASE_URL，暂时无法保存权限预览。当前权限预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentPermissionRepository"]>;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentPermissionRepository(prisma);
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于 Prisma 客户端无法初始化，暂时无法保存权限预览。当前权限预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  const capturedAt = new Date().toISOString();
  const taskId = normalizeOptionalText(input.taskId);
  const requestMetadata = createMetadata({
    inputMetadata: input.metadata,
    capturedAt,
    recordKind: "permission_request_preview",
    taskText: input.taskText,
  });
  const requestCreateInput =
    dbBoundaryResult.mapAgentPermissionRequestPreviewToCreateInput(
      toMapperPermissionRequestPreview(input.permissionRequestPreview),
      {
        taskId,
        metadata: requestMetadata,
      },
    );

  try {
    const savedRequest =
      await repository.createPermissionRequestPreview(requestCreateInput);
    const decisionMetadata = createMetadata({
      inputMetadata: input.metadata,
      capturedAt,
      recordKind: "permission_decision_preview",
      taskText: input.taskText,
      savedPermissionRequestId: savedRequest.id,
    });
    const decisionCreateInput =
      dbBoundaryResult.mapAgentPermissionDecisionPreviewToCreateInput(
        toMapperPermissionDecisionPreview(input.permissionDecisionPreview),
        {
          permissionRequestId: savedRequest.id,
          taskId,
          metadata: decisionMetadata,
        },
      );

    try {
      const savedDecision =
        await repository.createPermissionDecisionPreview(decisionCreateInput);

      return {
        ...PREVIEW_ONLY_RESULT_FLAGS,
        status: "saved",
        savedPermissionRequestId: savedRequest.id,
        savedPermissionDecisionId: savedDecision.id,
        decisionPreviewSaved: true,
        permissionPreviewRecordSaved: true,
        dataSaved: true,
        message:
          "权限请求和权限决策预览记录已保存。没有捕获用户决策、没有授予权限，也没有执行任何智能体任务。",
      };
    } catch (error) {
      return {
        ...PREVIEW_ONLY_RESULT_FLAGS,
        status: "saved",
        savedPermissionRequestId: savedRequest.id,
        decisionPreviewSaved: false,
        permissionPreviewRecordSaved: true,
        dataSaved: true,
        errorCategory: isPrismaUnavailableError(error)
          ? "database_unavailable"
          : "repository_failed",
        message:
          "权限请求预览记录已保存，但权限决策形状预览记录未保存。没有捕获用户决策、没有授予权限，也没有执行任何智能体任务。",
      };
    }
  } catch (error) {
    return createRepositoryFailureResult(error);
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | SaveAgentPermissionPreviewResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 边界无法加载，暂时无法保存权限预览。当前权限预览仍可查看，且没有执行任何智能体任务。",
    });
  }
}

function createRepositoryFailureResult(
  error: unknown,
): SaveAgentPermissionPreviewResult {
  if (isPrismaUnavailableError(error)) {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "由于数据库无法连接或初始化，暂时无法保存权限预览。当前权限预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  return createFailureResult({
    status: "failed",
    errorCategory: "repository_failed",
    message:
      "写入权限请求预览记录时保存失败。当前权限预览仍可查看，且没有执行任何智能体任务。",
  });
}

function createFailureResult(input: {
  readonly status: "unavailable" | "failed";
  readonly errorCategory: SaveAgentPermissionPreviewErrorCategory;
  readonly message: string;
}): SaveAgentPermissionPreviewResult {
  return {
    ...PREVIEW_ONLY_RESULT_FLAGS,
    status: input.status,
    decisionPreviewSaved: false,
    permissionPreviewRecordSaved: false,
    dataSaved: false,
    errorCategory: input.errorCategory,
    message: input.message,
  };
}

function createMetadata(input: {
  readonly inputMetadata: SaveAgentPermissionPreviewMetadata | undefined;
  readonly capturedAt: string;
  readonly recordKind: string;
  readonly taskText: string | undefined;
  readonly savedPermissionRequestId?: string;
}): SaveAgentPermissionPreviewMetadata {
  return {
    ...(input.inputMetadata ?? {}),
    ...previewPermissionSaveBoundaryMetadata,
    capturedAt: input.capturedAt,
    recordKind: input.recordKind,
    ...(input.taskText === undefined
      ? {}
      : { taskTextPreview: truncateText(input.taskText, 220) }),
    ...(input.savedPermissionRequestId === undefined
      ? {}
      : { savedPermissionRequestId: input.savedPermissionRequestId }),
  };
}

function toMapperPermissionRequestPreview(
  preview: AgentPermissionRequestPreview,
): AgentPermissionRequestPreviewLike {
  return { ...preview };
}

function toMapperPermissionDecisionPreview(
  preview: AgentPermissionDecisionPreview,
): AgentPermissionDecisionPreviewLike {
  return { ...preview };
}

function isPrismaUnavailableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;

  return typeof code === "string" && prismaUnavailableErrorCodes.has(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
