import type {
  AgentTask,
  AgentTaskEvent,
  AgentTaskSnapshot,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export type AgentTaskRepositoryJsonValue = Prisma.InputJsonValue;

export type AgentTaskRecord = AgentTask;

export type AgentTaskSnapshotRecord = AgentTaskSnapshot;

export type AgentTaskEventRecord = AgentTaskEvent;

export type AgentTaskTimelineOrder = "asc" | "desc";

export interface CreateAgentTaskInput {
  userId?: string | null;
  taskText: string;
  taskSummary?: string | null;
  source?: string | null;
  mode?: string | null;
  lifecycleStatus?: string | null;
  autonomyLevel?: string | null;
  overallRiskLevel?: string | null;
  readinessStatus?: string | null;
  executable?: false;
  realExecutionEnabled?: false;
  safetyFlags?: AgentTaskRepositoryJsonValue;
  previewPayload?: AgentTaskRepositoryJsonValue;
  metadata?: AgentTaskRepositoryJsonValue;
}

export interface AppendAgentTaskSnapshotInput {
  taskId: string;
  snapshotKind: string;
  lifecycleStatus?: string | null;
  taskSummary?: string | null;
  executable?: false;
  realExecutionEnabled?: false;
  payload?: AgentTaskRepositoryJsonValue;
  safetyNotes?: AgentTaskRepositoryJsonValue;
  metadata?: AgentTaskRepositoryJsonValue;
}

export interface AppendAgentTaskEventInput {
  taskId: string;
  eventType: string;
  source: string;
  severity: string;
  message: string;
  relatedStepIds?: AgentTaskRepositoryJsonValue;
  relatedStepIndexes?: AgentTaskRepositoryJsonValue;
  relatedToolNames?: AgentTaskRepositoryJsonValue;
  relatedSkillNames?: AgentTaskRepositoryJsonValue;
  safetyNotes?: AgentTaskRepositoryJsonValue;
  metadata?: AgentTaskRepositoryJsonValue;
}

export interface ListAgentTasksByUserOptions {
  limit?: number;
  cursor?: string;
  lifecycleStatus?: string;
  readinessStatus?: string;
}

export interface ListRecentPreviewTasksOptions {
  userId?: string | null;
  limit?: number;
  mode?: string | null;
  lifecycleStatus?: string;
  readinessStatus?: string;
}

export interface ListAgentTaskTimelineOptions {
  limit?: number;
  cursor?: string;
  order?: AgentTaskTimelineOrder;
}

export interface AgentTaskRepository {
  createPreviewTask(input: CreateAgentTaskInput): Promise<AgentTaskRecord>;

  getTaskById(taskId: string): Promise<AgentTaskRecord | null>;

  listTasksByUser(
    userId: string,
    options?: ListAgentTasksByUserOptions,
  ): Promise<AgentTaskRecord[]>;

  listRecentPreviewTasks(
    options?: ListRecentPreviewTasksOptions,
  ): Promise<AgentTaskRecord[]>;

  appendSnapshot(
    input: AppendAgentTaskSnapshotInput,
  ): Promise<AgentTaskSnapshotRecord>;

  appendEvent(input: AppendAgentTaskEventInput): Promise<AgentTaskEventRecord>;

  listSnapshotsByTask(
    taskId: string,
    options?: ListAgentTaskTimelineOptions,
  ): Promise<AgentTaskSnapshotRecord[]>;

  listEventsByTask(
    taskId: string,
    options?: ListAgentTaskTimelineOptions,
  ): Promise<AgentTaskEventRecord[]>;
}

const defaultAgentTaskListLimit = 20;
const maxAgentTaskListLimit = 100;
const defaultAgentTaskTimelineLimit = 20;
const maxAgentTaskTimelineLimit = 100;
const defaultAgentTaskSource = "user";
const defaultAgentTaskMode = "preview_only";
const disabledAgentTaskMode = "disabled";
const defaultAgentTaskLifecycleStatus = "preview_created";

const agentTaskPreviewSafetyFlags = {
  executable: false,
  realExecutionEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  dataSaved: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const satisfies AgentTaskRepositoryJsonValue;

export class PrismaAgentTaskRepository implements AgentTaskRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPreviewTask(
    input: CreateAgentTaskInput,
  ): Promise<AgentTaskRecord> {
    const userId = normalizeOptionalText(input.userId);
    const data: Prisma.AgentTaskCreateInput = {
      taskText: normalizeRequiredText(input.taskText, "Task text is required."),
      taskSummary: normalizeOptionalText(input.taskSummary),
      source: normalizeOptionalText(input.source) ?? defaultAgentTaskSource,
      mode: normalizePreviewMode(input.mode),
      lifecycleStatus:
        normalizeOptionalText(input.lifecycleStatus) ??
        defaultAgentTaskLifecycleStatus,
      autonomyLevel: normalizeOptionalText(input.autonomyLevel),
      overallRiskLevel: normalizeOptionalText(input.overallRiskLevel),
      readinessStatus: normalizeOptionalText(input.readinessStatus),
      executable: false,
      realExecutionEnabled: false,
      safetyFlags: input.safetyFlags ?? agentTaskPreviewSafetyFlags,
    };

    if (userId !== null) {
      data.user = { connect: { id: userId } };
    }

    if (input.previewPayload !== undefined) {
      data.previewPayload = input.previewPayload;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.agentTask.create({ data });
  }

  async getTaskById(taskId: string): Promise<AgentTaskRecord | null> {
    const id = normalizeRequiredText(taskId, "Agent task id is required.");

    return this.prisma.agentTask.findUnique({
      where: { id },
    });
  }

  async listTasksByUser(
    userId: string,
    options: ListAgentTasksByUserOptions = {},
  ): Promise<AgentTaskRecord[]> {
    const normalizedUserId = normalizeRequiredText(
      userId,
      "User id is required.",
    );
    const where: Prisma.AgentTaskWhereInput = {
      userId: normalizedUserId,
    };
    const cursor = normalizeOptionalText(options.cursor);

    if (options.lifecycleStatus !== undefined) {
      where.lifecycleStatus = normalizeRequiredText(
        options.lifecycleStatus,
        "Agent task lifecycleStatus filter cannot be empty.",
      );
    }

    if (options.readinessStatus !== undefined) {
      where.readinessStatus = normalizeRequiredText(
        options.readinessStatus,
        "Agent task readinessStatus filter cannot be empty.",
      );
    }

    return this.prisma.agentTask.findMany({
      where,
      take: normalizeLimit(
        options.limit,
        defaultAgentTaskListLimit,
        maxAgentTaskListLimit,
      ),
      ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async listRecentPreviewTasks(
    options: ListRecentPreviewTasksOptions = {},
  ): Promise<AgentTaskRecord[]> {
    const where: Prisma.AgentTaskWhereInput = {
      userId: normalizeOptionalText(options.userId ?? null),
      mode: normalizePreviewMode(options.mode),
    };

    if (options.lifecycleStatus !== undefined) {
      where.lifecycleStatus = normalizeRequiredText(
        options.lifecycleStatus,
        "Agent task lifecycleStatus filter cannot be empty.",
      );
    }

    if (options.readinessStatus !== undefined) {
      where.readinessStatus = normalizeRequiredText(
        options.readinessStatus,
        "Agent task readinessStatus filter cannot be empty.",
      );
    }

    return this.prisma.agentTask.findMany({
      where,
      take: normalizeLimit(
        options.limit,
        defaultAgentTaskListLimit,
        maxAgentTaskListLimit,
      ),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendSnapshot(
    input: AppendAgentTaskSnapshotInput,
  ): Promise<AgentTaskSnapshotRecord> {
    const data: Prisma.AgentTaskSnapshotCreateInput = {
      task: {
        connect: {
          id: normalizeRequiredText(input.taskId, "Agent task id is required."),
        },
      },
      snapshotKind: normalizeRequiredText(
        input.snapshotKind,
        "Agent task snapshot kind is required.",
      ),
      lifecycleStatus: normalizeOptionalText(input.lifecycleStatus),
      taskSummary: normalizeOptionalText(input.taskSummary),
      executable: false,
      realExecutionEnabled: false,
    };

    if (input.payload !== undefined) {
      data.payload = input.payload;
    }

    if (input.safetyNotes !== undefined) {
      data.safetyNotes = input.safetyNotes;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.agentTaskSnapshot.create({ data });
  }

  async appendEvent(
    input: AppendAgentTaskEventInput,
  ): Promise<AgentTaskEventRecord> {
    const data: Prisma.AgentTaskEventCreateInput = {
      task: {
        connect: {
          id: normalizeRequiredText(input.taskId, "Agent task id is required."),
        },
      },
      eventType: normalizeRequiredText(
        input.eventType,
        "Agent task event type is required.",
      ),
      source: normalizeRequiredText(
        input.source,
        "Agent task event source is required.",
      ),
      severity: normalizeRequiredText(
        input.severity,
        "Agent task event severity is required.",
      ),
      message: normalizeRequiredText(
        input.message,
        "Agent task event message is required.",
      ),
    };

    if (input.relatedStepIds !== undefined) {
      data.relatedStepIds = input.relatedStepIds;
    }

    if (input.relatedStepIndexes !== undefined) {
      data.relatedStepIndexes = input.relatedStepIndexes;
    }

    if (input.relatedToolNames !== undefined) {
      data.relatedToolNames = input.relatedToolNames;
    }

    if (input.relatedSkillNames !== undefined) {
      data.relatedSkillNames = input.relatedSkillNames;
    }

    if (input.safetyNotes !== undefined) {
      data.safetyNotes = input.safetyNotes;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.agentTaskEvent.create({ data });
  }

  async listSnapshotsByTask(
    taskId: string,
    options: ListAgentTaskTimelineOptions = {},
  ): Promise<AgentTaskSnapshotRecord[]> {
    const id = normalizeRequiredText(taskId, "Agent task id is required.");
    const cursor = normalizeOptionalText(options.cursor);

    return this.prisma.agentTaskSnapshot.findMany({
      where: { taskId: id },
      take: normalizeLimit(
        options.limit,
        defaultAgentTaskTimelineLimit,
        maxAgentTaskTimelineLimit,
      ),
      ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
      orderBy: [{ createdAt: normalizeTimelineOrder(options.order) }, { id: "asc" }],
    });
  }

  async listEventsByTask(
    taskId: string,
    options: ListAgentTaskTimelineOptions = {},
  ): Promise<AgentTaskEventRecord[]> {
    const id = normalizeRequiredText(taskId, "Agent task id is required.");
    const cursor = normalizeOptionalText(options.cursor);

    return this.prisma.agentTaskEvent.findMany({
      where: { taskId: id },
      take: normalizeLimit(
        options.limit,
        defaultAgentTaskTimelineLimit,
        maxAgentTaskTimelineLimit,
      ),
      ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
      orderBy: [{ createdAt: normalizeTimelineOrder(options.order) }, { id: "asc" }],
    });
  }
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizePreviewMode(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value);

  if (normalized === disabledAgentTaskMode) {
    return disabledAgentTaskMode;
  }

  return defaultAgentTaskMode;
}

function normalizeTimelineOrder(
  order: AgentTaskTimelineOrder | undefined,
): AgentTaskTimelineOrder {
  return order === "asc" ? "asc" : "desc";
}

function normalizeLimit(
  limit: number | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxLimit);
}
