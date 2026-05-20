"use server";

import { revalidatePath } from "next/cache";

import type {
  MockRuntimePersistenceCounts,
  PersistMockRuntimePreviewResult,
} from "@learning-agent-platform/db";
import { createRuntimeMockPreviewPlan } from "./_lib/runtime-mock-preview-plan";

type DbBoundary = typeof import("@learning-agent-platform/db");

export type SaveMockRuntimePreviewStatus =
  | "saved"
  | "unavailable"
  | "failed";

export type SaveMockRuntimePreviewErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "orchestrator_unavailable"
  | "unknown";

const PREVIEW_ONLY_RESULT_FLAGS = {
  previewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  streamingEnabled: false,
  productionAuditEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  fileToolsUsed: false,
  commandToolsUsed: false,
  realExecutionDataSaved: false,
} as const;

export type SaveMockRuntimePreviewResult =
  typeof PREVIEW_ONLY_RESULT_FLAGS & {
    status: SaveMockRuntimePreviewStatus;
    executionId?: string;
    persistedCounts: MockRuntimePersistenceCounts;
    skippedCounts: MockRuntimePersistenceCounts;
    warnings: readonly string[];
    previewRecordSaved: boolean;
    errorCategory?: SaveMockRuntimePreviewErrorCategory;
    historyRefreshRecommended: boolean;
    message: string;
  };

const emptyCounts: MockRuntimePersistenceCounts = {
  executions: 0,
  steps: 0,
  toolCalls: 0,
  llmCalls: 0,
  events: 0,
  auditEvents: 0,
  errors: 0,
};

const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

export async function saveMockRuntimePreviewAction(): Promise<SaveMockRuntimePreviewResult> {
  const dbBoundaryResult = await loadDbBoundary();

  if ("status" in dbBoundaryResult) {
    return dbBoundaryResult;
  }

  if (!dbBoundaryResult.hasDatabaseUrl()) {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "保存运行预览记录失败。请检查数据库环境或稍后重试；未执行工具、未调用模型，也未产生真实副作用。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentRuntimeRepository"]>;
  let orchestrator: InstanceType<
    DbBoundary["PrismaAgentRuntimeMockRunnerPreview"]
  >;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentRuntimeRepository(prisma);
    orchestrator = new dbBoundaryResult.PrismaAgentRuntimeMockRunnerPreview(
      repository,
    );
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "保存运行预览记录失败。数据库预览保存边界无法初始化；未执行工具、未调用模型，也未产生真实副作用。",
    });
  }

  const capturedAt = new Date().toISOString();
  const mockPreviewPlan = createRuntimeMockPreviewPlan(capturedAt);

  try {
    const persistenceResult = await orchestrator.persistMockRuntimePreview(
      mockPreviewPlan,
      {
        appendChildren: true,
        maxSteps: 3,
        maxToolCalls: 2,
        maxLlmCalls: 1,
        maxEvents: 4,
        maxAuditEvents: 1,
        maxErrors: 0,
        now: capturedAt,
      },
    );

    if (!persistenceResult.ok || persistenceResult.executionId === undefined) {
      return createFailureResult({
        status: "failed",
        errorCategory: "repository_failed",
        message:
          "保存运行预览记录失败。预览保存边界未返回可用的记录 ID；未执行工具、未调用模型，也未产生真实副作用。",
      });
    }

    revalidatePath("/agent");

    return createSavedResult(persistenceResult);
  } catch (error) {
    return createRepositoryFailureResult(error);
  }
}

async function loadDbBoundary(): Promise<
  DbBoundary | SaveMockRuntimePreviewResult
> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "orchestrator_unavailable",
      message:
        "保存运行预览记录失败。数据库预览保存边界无法加载；未执行工具、未调用模型，也未产生真实副作用。",
    });
  }
}

function createSavedResult(
  persistenceResult: PersistMockRuntimePreviewResult,
): SaveMockRuntimePreviewResult {
  return {
    ...PREVIEW_ONLY_RESULT_FLAGS,
    status: "saved",
    executionId: persistenceResult.executionId,
    persistedCounts: persistenceResult.persistedCounts,
    skippedCounts: persistenceResult.skippedCounts,
    warnings: persistenceResult.warnings,
    previewRecordSaved: true,
    historyRefreshRecommended: true,
    message:
      "已保存一条运行预览记录。该记录仅用于展示，不代表 Agent 已真实运行；未执行工具、未调用模型，也未产生真实副作用。",
  };
}

function createRepositoryFailureResult(
  error: unknown,
): SaveMockRuntimePreviewResult {
  if (isPrismaUnavailableError(error)) {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "保存运行预览记录失败。请检查数据库环境或稍后重试；未执行工具、未调用模型，也未产生真实副作用。",
    });
  }

  return createFailureResult({
    status: "failed",
    errorCategory: "repository_failed",
    message:
      "保存运行预览记录失败。写入模拟运行预览记录时出现问题；未执行工具、未调用模型，也未产生真实副作用。",
  });
}

function createFailureResult(input: {
  readonly status: "unavailable" | "failed";
  readonly errorCategory: SaveMockRuntimePreviewErrorCategory;
  readonly message: string;
}): SaveMockRuntimePreviewResult {
  return {
    ...PREVIEW_ONLY_RESULT_FLAGS,
    status: input.status,
    persistedCounts: { ...emptyCounts },
    skippedCounts: { ...emptyCounts },
    warnings: [],
    previewRecordSaved: false,
    errorCategory: input.errorCategory,
    historyRefreshRecommended: false,
    message: input.message,
  };
}

function isPrismaUnavailableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;

  return typeof code === "string" && prismaUnavailableErrorCodes.has(code);
}
