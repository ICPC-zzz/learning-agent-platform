"use server";

import {
  AGENT_TASK_RECORD_PREVIEW_SAFETY_FLAGS,
  AgentExecutionReadinessRiskLevel,
  AgentExecutionReadinessStatus,
  AgentTaskEventSeverity,
  AgentTaskEventType,
  AgentTaskLifecycleStatus,
  AgentTaskRecordMode,
  AgentTaskRecordSource,
  AgentTaskSnapshotKind,
  type AgentExecutionReadinessPreview,
  type AgentMemoryContextPreview,
  type AgentSkillSuggestionPreview,
  type AgentTaskEventPreview,
  type AgentTaskPlanPreview,
  type AgentTaskRecordPreview,
  type AgentTaskSnapshotPreview,
  type AgentToolRequirementReviewPreview,
  type AutonomyLevel as AutonomyLevelValue,
} from "@learning-agent-platform/ai-core";
import type {
  AgentTaskEventPreviewLike,
  AgentTaskExecutionReadinessPreviewLike,
  AgentTaskRecordPreviewLike,
  AgentTaskSnapshotPreviewLike,
} from "@learning-agent-platform/db";

type DbBoundary = typeof import("@learning-agent-platform/db");

type SaveAgentTaskPreviewJsonPrimitive = string | number | boolean | null;

export type SaveAgentTaskPreviewJsonValue =
  | SaveAgentTaskPreviewJsonPrimitive
  | { readonly [key: string]: SaveAgentTaskPreviewJsonValue }
  | readonly SaveAgentTaskPreviewJsonValue[];

export type SaveAgentTaskPreviewMetadata = Readonly<
  Record<string, SaveAgentTaskPreviewJsonValue>
>;

export interface SaveAgentTaskPreviewInput {
  taskText: string;
  taskSummary?: string;
  autonomyLevel: AutonomyLevelValue;
  planPreview?: AgentTaskPlanPreview;
  toolRequirementReview?: AgentToolRequirementReviewPreview;
  skillSuggestionPreview?: AgentSkillSuggestionPreview;
  memoryContextPreview?: AgentMemoryContextPreview;
  executionReadinessPreview?: AgentExecutionReadinessPreview;
  metadata?: SaveAgentTaskPreviewMetadata;
}

export type SaveAgentTaskPreviewStatus =
  | "saved"
  | "unavailable"
  | "failed";

export type SaveAgentTaskPreviewErrorCategory =
  | "database_unavailable"
  | "prisma_unavailable"
  | "repository_failed"
  | "invalid_input"
  | "unknown";

const PREVIEW_ONLY_RESULT_FLAGS = {
  previewOnly: true,
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

export type SaveAgentTaskPreviewResult = typeof PREVIEW_ONLY_RESULT_FLAGS & {
  status: SaveAgentTaskPreviewStatus;
  savedTaskId?: string;
  snapshotSaved: boolean;
  eventSaved: boolean;
  errorCategory?: SaveAgentTaskPreviewErrorCategory;
  message: string;
};

const previewSaveBoundaryMetadata = {
  saveBoundary: "agent_task_preview_save_server_action_mvp",
  previewOnly: true,
  executionDisabled: true,
} as const satisfies SaveAgentTaskPreviewMetadata;

const previewSaveSafetyNotes = [
  "保存的记录仅用于预览。",
  "没有执行智能体任务。",
  "没有执行工具。",
  "没有调用模型。",
  "没有发起网络请求。",
  "没有执行记忆检索。",
  "没有使用 embedding。",
  "没有使用向量搜索。",
  "没有执行 RAG。",
  "没有生成、安装或执行 Skill。",
  "没有保存真实执行结果。",
] as const;

const prismaUnavailableErrorCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1012",
]);

export async function saveAgentTaskPreview(
  input: SaveAgentTaskPreviewInput,
): Promise<SaveAgentTaskPreviewResult> {
  const taskText = input.taskText.trim();

  if (taskText.length === 0) {
    return createFailureResult({
      status: "failed",
      errorCategory: "invalid_input",
      message:
        "保存智能体预览记录前必须填写任务文本。本次未保存任何内容。",
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
        "由于未配置 DATABASE_URL，暂时无法保存预览。当前预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  let repository: InstanceType<DbBoundary["PrismaAgentTaskRepository"]>;

  try {
    const prisma = dbBoundaryResult.getPrismaClient();
    repository = new dbBoundaryResult.PrismaAgentTaskRepository(prisma);
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于 Prisma 客户端无法初始化，暂时无法保存预览。当前预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  const capturedAt = new Date().toISOString();
  const recordPreview = createPreviewRecord(input, taskText, capturedAt);
  const createInput =
    dbBoundaryResult.mapAgentTaskRecordPreviewToCreateInput(
      toMapperRecordPreview(recordPreview),
    );

  try {
    const savedTask = await repository.createPreviewTask(createInput);
    const snapshotSaved = await appendCombinedSnapshot({
      dbBoundary: dbBoundaryResult,
      repository,
      taskId: savedTask.id,
      snapshot: recordPreview.snapshots[0],
    });
    const eventSaved = await appendPreviewEvent({
      dbBoundary: dbBoundaryResult,
      repository,
      taskId: savedTask.id,
      event: recordPreview.events[0],
    });

    return {
      ...PREVIEW_ONLY_RESULT_FLAGS,
      status: "saved",
      savedTaskId: savedTask.id,
      snapshotSaved,
      eventSaved,
      message: createSavedMessage(snapshotSaved, eventSaved),
    };
  } catch (error) {
    return createRepositoryFailureResult(error);
  }
}

async function loadDbBoundary(): Promise<DbBoundary | SaveAgentTaskPreviewResult> {
  try {
    return await import("@learning-agent-platform/db");
  } catch {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "prisma_unavailable",
      message:
        "由于数据库包或 Prisma 客户端边界无法加载，暂时无法保存预览。当前预览仍可查看，且没有执行任何智能体任务。",
    });
  }
}

function createPreviewRecord(
  input: SaveAgentTaskPreviewInput,
  taskText: string,
  capturedAt: string,
): AgentTaskRecordPreview {
  const taskSummary = createTaskSummary(input, taskText);
  const lifecycleStatus = getLifecycleStatus(input.executionReadinessPreview);
  const overallRiskLevel =
    input.executionReadinessPreview?.overallRiskLevel ??
    input.planPreview?.estimatedRiskLevel ??
    AgentExecutionReadinessRiskLevel.Unknown;
  const metadata = createMetadata(input.metadata, capturedAt);
  const snapshot = createCombinedSnapshot({
    input,
    taskSummary,
    lifecycleStatus,
    metadata,
    capturedAt,
  });
  const event = createPreviewCreatedEvent({
    input,
    taskSummary,
    lifecycleStatus,
    metadata,
    capturedAt,
  });

  return {
    taskText,
    taskSummary,
    source: AgentTaskRecordSource.User,
    mode: AgentTaskRecordMode.PreviewOnly,
    lifecycleStatus,
    autonomyLevel: input.autonomyLevel,
    overallRiskLevel,
    executable: false,
    realExecutionEnabled: false,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    planPreview: input.planPreview,
    toolRequirementReview: input.toolRequirementReview,
    skillSuggestionPreview: input.skillSuggestionPreview,
    memoryContextPreview: input.memoryContextPreview,
    executionReadinessPreview: input.executionReadinessPreview,
    snapshots: [snapshot],
    events: [event],
    safetyFlags: AGENT_TASK_RECORD_PREVIEW_SAFETY_FLAGS,
    safetyNotes: previewSaveSafetyNotes,
    metadata,
  };
}

function createCombinedSnapshot(input: {
  readonly input: SaveAgentTaskPreviewInput;
  readonly taskSummary: string;
  readonly lifecycleStatus: AgentTaskLifecycleStatus;
  readonly metadata: SaveAgentTaskPreviewMetadata;
  readonly capturedAt: string;
}): AgentTaskSnapshotPreview {
  return {
    snapshotKind: AgentTaskSnapshotKind.CombinedPreview,
    lifecycleStatus: input.lifecycleStatus,
    taskSummary: input.taskSummary,
    capturedAt: input.capturedAt,
    executable: false,
    realExecutionEnabled: false,
    planPreview: input.input.planPreview,
    toolRequirementReview: input.input.toolRequirementReview,
    skillSuggestionPreview: input.input.skillSuggestionPreview,
    memoryContextPreview: input.input.memoryContextPreview,
    executionReadinessPreview: input.input.executionReadinessPreview,
    safetyNotes: previewSaveSafetyNotes,
    metadata: {
      ...input.metadata,
      snapshotPurpose: "combined_preview",
    },
  };
}

function createPreviewCreatedEvent(input: {
  readonly input: SaveAgentTaskPreviewInput;
  readonly taskSummary: string;
  readonly lifecycleStatus: AgentTaskLifecycleStatus;
  readonly metadata: SaveAgentTaskPreviewMetadata;
  readonly capturedAt: string;
}): AgentTaskEventPreview {
  return {
    eventType: AgentTaskEventType.PreviewCreated,
    source: AgentTaskRecordSource.SystemPreview,
    message: "智能体任务预览已保存。",
    severity: getEventSeverity(input.input.executionReadinessPreview),
    occurredAt: input.capturedAt,
    relatedStepIds: input.input.planPreview?.steps.map((step) => step.stepId),
    relatedStepIndexes: input.input.planPreview?.steps.map(
      (_step, index) => index + 1,
    ),
    relatedToolNames: normalizeUniqueStrings(
      input.input.toolRequirementReview?.requirements.flatMap(
        (requirement) => requirement.candidateToolNames,
      ) ?? [],
    ),
    relatedSkillNames: normalizeUniqueStrings(
      input.input.skillSuggestionPreview?.suggestions.map(
        (suggestion) => suggestion.skillName,
      ) ?? [],
    ),
    safetyNotes: [
      ...previewSaveSafetyNotes,
      `保存时的生命周期状态：${input.lifecycleStatus}。`,
      `保存时的任务摘要：${input.taskSummary}。`,
    ],
    metadata: {
      ...input.metadata,
      eventPurpose: "preview_created",
    },
  };
}

async function appendCombinedSnapshot(input: {
  readonly dbBoundary: DbBoundary;
  readonly repository: InstanceType<DbBoundary["PrismaAgentTaskRepository"]>;
  readonly taskId: string;
  readonly snapshot: AgentTaskSnapshotPreview | undefined;
}): Promise<boolean> {
  if (input.snapshot === undefined) {
    return false;
  }

  try {
    const appendInput =
      input.dbBoundary.mapAgentTaskSnapshotPreviewToAppendInput(
        toMapperSnapshotPreview(input.snapshot),
        input.taskId,
      );

    await input.repository.appendSnapshot(appendInput);

    return true;
  } catch {
    return false;
  }
}

async function appendPreviewEvent(input: {
  readonly dbBoundary: DbBoundary;
  readonly repository: InstanceType<DbBoundary["PrismaAgentTaskRepository"]>;
  readonly taskId: string;
  readonly event: AgentTaskEventPreview | undefined;
}): Promise<boolean> {
  if (input.event === undefined) {
    return false;
  }

  try {
    const appendInput = input.dbBoundary.mapAgentTaskEventPreviewToAppendInput(
      toMapperEventPreview(input.event),
      input.taskId,
    );

    await input.repository.appendEvent(appendInput);

    return true;
  } catch {
    return false;
  }
}

function createTaskSummary(
  input: SaveAgentTaskPreviewInput,
  taskText: string,
): string {
  return (
    normalizeOptionalText(input.taskSummary) ??
    normalizeOptionalText(input.executionReadinessPreview?.taskSummary) ??
    normalizeOptionalText(input.planPreview?.taskSummary) ??
    `任务预览：${truncateText(taskText, 160)}`
  );
}

function getLifecycleStatus(
  readinessPreview: AgentExecutionReadinessPreview | undefined,
): AgentTaskLifecycleStatus {
  if (readinessPreview === undefined) {
    return AgentTaskLifecycleStatus.PreviewCreated;
  }

  if (
    readinessPreview.readinessStatus === AgentExecutionReadinessStatus.Blocked
  ) {
    return AgentTaskLifecycleStatus.Blocked;
  }

  if (
    readinessPreview.readinessStatus ===
    AgentExecutionReadinessStatus.NeedsConfirmation
  ) {
    return AgentTaskLifecycleStatus.NeedsConfirmation;
  }

  if (
    readinessPreview.readinessStatus ===
    AgentExecutionReadinessStatus.ReadyForFutureManualReview
  ) {
    return AgentTaskLifecycleStatus.ReadyForFutureManualReview;
  }

  if (
    readinessPreview.readinessStatus ===
    AgentExecutionReadinessStatus.NotReady
  ) {
    return AgentTaskLifecycleStatus.ExecutionDisabled;
  }

  return AgentTaskLifecycleStatus.ReadinessReviewed;
}

function getEventSeverity(
  readinessPreview: AgentExecutionReadinessPreview | undefined,
): AgentTaskEventSeverity {
  if (readinessPreview === undefined) {
    return AgentTaskEventSeverity.Info;
  }

  if (
    readinessPreview.readinessStatus === AgentExecutionReadinessStatus.Blocked ||
    readinessPreview.blockers.length > 0
  ) {
    return AgentTaskEventSeverity.Blocked;
  }

  if (
    readinessPreview.readinessStatus ===
      AgentExecutionReadinessStatus.NeedsConfirmation ||
    readinessPreview.overallRiskLevel ===
      AgentExecutionReadinessRiskLevel.High ||
    readinessPreview.overallRiskLevel ===
      AgentExecutionReadinessRiskLevel.Critical ||
    readinessPreview.warnings.length > 0
  ) {
    return AgentTaskEventSeverity.Warning;
  }

  return AgentTaskEventSeverity.Info;
}

function createMetadata(
  metadata: SaveAgentTaskPreviewMetadata | undefined,
  capturedAt: string,
): SaveAgentTaskPreviewMetadata {
  return {
    ...(metadata ?? {}),
    ...previewSaveBoundaryMetadata,
    capturedAt,
  };
}

function createSavedMessage(
  snapshotSaved: boolean,
  eventSaved: boolean,
): string {
  if (snapshotSaved && eventSaved) {
    return "预览记录已保存，并写入组合预览快照和 preview_created 事件。没有执行任何智能体任务。";
  }

  if (!snapshotSaved && !eventSaved) {
    return "预览记录已保存，但尽力保存的快照和事件写入失败。没有执行任何智能体任务。";
  }

  if (!snapshotSaved) {
    return "预览记录已保存，但尽力保存的组合预览快照未写入。没有执行任何智能体任务。";
  }

  return "预览记录已保存，但尽力保存的预览事件未写入。没有执行任何智能体任务。";
}

function createRepositoryFailureResult(
  error: unknown,
): SaveAgentTaskPreviewResult {
  if (isPrismaUnavailableError(error)) {
    return createFailureResult({
      status: "unavailable",
      errorCategory: "database_unavailable",
      message:
        "由于数据库无法连接或初始化，暂时无法保存预览。当前预览仍可查看，且没有执行任何智能体任务。",
    });
  }

  return createFailureResult({
    status: "failed",
    errorCategory: "repository_failed",
    message:
      "写入智能体任务预览记录时保存失败。当前预览仍可查看，且没有执行任何智能体任务。",
  });
}

function createFailureResult(input: {
  readonly status: "unavailable" | "failed";
  readonly errorCategory: SaveAgentTaskPreviewErrorCategory;
  readonly message: string;
}): SaveAgentTaskPreviewResult {
  return {
    ...PREVIEW_ONLY_RESULT_FLAGS,
    status: input.status,
    snapshotSaved: false,
    eventSaved: false,
    errorCategory: input.errorCategory,
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

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function toMapperRecordPreview(
  record: AgentTaskRecordPreview,
): AgentTaskRecordPreviewLike {
  return {
    ...record,
    executionReadinessPreview: toMapperExecutionReadinessPreview(
      record.executionReadinessPreview,
    ),
    snapshots: record.snapshots.map(toMapperSnapshotPreview),
    events: record.events.map(toMapperEventPreview),
  };
}

function toMapperSnapshotPreview(
  snapshot: AgentTaskSnapshotPreview,
): AgentTaskSnapshotPreviewLike {
  return {
    ...snapshot,
    executionReadinessPreview: toMapperExecutionReadinessPreview(
      snapshot.executionReadinessPreview,
    ),
  };
}

function toMapperEventPreview(
  event: AgentTaskEventPreview,
): AgentTaskEventPreviewLike {
  return { ...event };
}

function toMapperExecutionReadinessPreview(
  preview: AgentExecutionReadinessPreview | undefined,
): AgentTaskExecutionReadinessPreviewLike | undefined {
  if (preview === undefined) {
    return undefined;
  }

  return { ...preview };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
