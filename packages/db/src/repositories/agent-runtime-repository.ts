import type {
  AgentRuntimeAuditLog,
  AgentRuntimeEvent,
  AgentRuntimeExecution,
  AgentRuntimeLlmCall,
  AgentRuntimeStep,
  AgentRuntimeToolCall,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export type AgentRuntimeRepositoryJsonValue = Prisma.InputJsonValue;

export type AgentRuntimeExecutionRecord = AgentRuntimeExecution;

export type AgentRuntimeStepRecord = AgentRuntimeStep;

export type AgentRuntimeToolCallRecord = AgentRuntimeToolCall;

export type AgentRuntimeLlmCallRecord = AgentRuntimeLlmCall;

export type AgentRuntimeEventRecord = AgentRuntimeEvent;

export type AgentRuntimeAuditLogRecord = AgentRuntimeAuditLog;

export interface CreateRuntimeExecutionPreviewInput {
  taskId?: string | null;
  userId?: string | null;
  executionStatus?: string | null;
  lifecycleStatus?: string | null;
  boundaryFlags?: AgentRuntimeRepositoryJsonValue;
  safetyFlags?: AgentRuntimeRepositoryJsonValue;
  transitionState?: AgentRuntimeRepositoryJsonValue;
  currentStepId?: string | null;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  llmCallEnabled?: boolean;
  permissionConfirmationEnabled?: boolean;
  backgroundJobEnabled?: boolean;
  streamingEnabled?: boolean;
  previewOnly?: boolean;
  metadata?: AgentRuntimeRepositoryJsonValue;
  errors?: AgentRuntimeRepositoryJsonValue;
}

export interface AppendRuntimeStepPreviewInput {
  stepKey?: string | null;
  title: string;
  kind: string;
  status?: string | null;
  riskLevel?: string | null;
  summary?: string | null;
  inputSummary?: string | null;
  outputSummary?: string | null;
  blockedReasons?: AgentRuntimeRepositoryJsonValue;
  metadata?: AgentRuntimeRepositoryJsonValue;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
}

export interface AppendRuntimeToolCallPreviewInput {
  stepId?: string | null;
  toolName: string;
  toolKind?: string | null;
  status?: string | null;
  requirementSummary?: string | null;
  inputSummary?: string | null;
  resultSummary?: string | null;
  riskLevel?: string | null;
  blockedReasons?: AgentRuntimeRepositoryJsonValue;
  sandboxRequired?: boolean;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  metadata?: AgentRuntimeRepositoryJsonValue;
}

export interface AppendRuntimeLlmCallPreviewInput {
  stepId?: string | null;
  providerKind?: string | null;
  modelLabel?: string | null;
  requestSummary?: string | null;
  responseSummary?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  status?: string | null;
  blockedReasons?: AgentRuntimeRepositoryJsonValue;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  llmCallEnabled?: boolean;
  streamingEnabled?: boolean;
  metadata?: AgentRuntimeRepositoryJsonValue;
}

export interface AppendRuntimeEventPreviewInput {
  eventKind: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  action?: string | null;
  message?: string | null;
  payload?: AgentRuntimeRepositoryJsonValue;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
}

export interface AppendRuntimeAuditLogPreviewInput {
  actorKind?: string | null;
  action: string;
  targetKind?: string | null;
  riskLevel?: string | null;
  riskSummary?: string | null;
  boundaryFlags?: AgentRuntimeRepositoryJsonValue;
  safetyFlags?: AgentRuntimeRepositoryJsonValue;
  metadata?: AgentRuntimeRepositoryJsonValue;
  previewOnly?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  productionAuditEnabled?: boolean;
}

export interface ListRuntimeExecutionsByTaskOptions {
  limit?: number;
}

export interface ListRuntimeExecutionsByUserOptions {
  limit?: number;
}

export interface ListRuntimeRecordsByExecutionOptions {
  limit?: number;
}

export interface AgentRuntimeRepository {
  createRuntimeExecutionPreview(
    input: CreateRuntimeExecutionPreviewInput,
  ): Promise<AgentRuntimeExecutionRecord>;

  getRuntimeExecutionById(
    executionId: string,
  ): Promise<AgentRuntimeExecutionRecord | null>;

  listRuntimeExecutionsByTask(
    taskId: string,
    options?: ListRuntimeExecutionsByTaskOptions,
  ): Promise<AgentRuntimeExecutionRecord[]>;

  listRuntimeExecutionsByUser(
    userId: string,
    options?: ListRuntimeExecutionsByUserOptions,
  ): Promise<AgentRuntimeExecutionRecord[]>;

  appendRuntimeStepPreview(
    executionId: string,
    input: AppendRuntimeStepPreviewInput,
  ): Promise<AgentRuntimeStepRecord>;

  listRuntimeStepsByExecution(
    executionId: string,
    options?: ListRuntimeRecordsByExecutionOptions,
  ): Promise<AgentRuntimeStepRecord[]>;

  appendRuntimeToolCallPreview(
    executionId: string,
    input: AppendRuntimeToolCallPreviewInput,
  ): Promise<AgentRuntimeToolCallRecord>;

  listRuntimeToolCallsByExecution(
    executionId: string,
    options?: ListRuntimeRecordsByExecutionOptions,
  ): Promise<AgentRuntimeToolCallRecord[]>;

  appendRuntimeLlmCallPreview(
    executionId: string,
    input: AppendRuntimeLlmCallPreviewInput,
  ): Promise<AgentRuntimeLlmCallRecord>;

  listRuntimeLlmCallsByExecution(
    executionId: string,
    options?: ListRuntimeRecordsByExecutionOptions,
  ): Promise<AgentRuntimeLlmCallRecord[]>;

  appendRuntimeEventPreview(
    executionId: string,
    input: AppendRuntimeEventPreviewInput,
  ): Promise<AgentRuntimeEventRecord>;

  listRuntimeEventsByExecution(
    executionId: string,
    options?: ListRuntimeRecordsByExecutionOptions,
  ): Promise<AgentRuntimeEventRecord[]>;

  appendRuntimeAuditLogPreview(
    executionId: string,
    input: AppendRuntimeAuditLogPreviewInput,
  ): Promise<AgentRuntimeAuditLogRecord>;

  listRuntimeAuditLogsByExecution(
    executionId: string,
    options?: ListRuntimeRecordsByExecutionOptions,
  ): Promise<AgentRuntimeAuditLogRecord[]>;
}

const defaultRuntimeListLimit = 20;
const maxRuntimeListLimit = 100;
const defaultRuntimeExecutionStatus = "preview_ready";
const defaultRuntimeLifecycleStatus = "preview_only";
const defaultRuntimeRecordStatus = "preview_only";

const runtimePreviewFlags = {
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
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  dataSaved: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
} as const satisfies AgentRuntimeRepositoryJsonValue;

const metadataSensitiveKeys = new Set([
  "apikey",
  "apisecret",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "password",
  "credential",
  "credentials",
  "rawheaders",
  "headers",
  "cookie",
  "setcookie",
  "rawrequestwithsecrets",
]);

const metadataPreviewFalseBooleanKeys = new Set([
  "executable",
  "realexecutionenabled",
  "toolexecutionenabled",
  "llmcallenabled",
  "permissionconfirmationenabled",
  "backgroundjobenabled",
  "streamingenabled",
  "productionauditenabled",
  "toolsexecuted",
  "llmcalled",
  "networkused",
  "memoryretrievalexecuted",
  "embeddingused",
  "embeddingsused",
  "vectorsearchused",
  "ragused",
  "datasaved",
  "skillgenerated",
  "skillinstalled",
  "skillexecuted",
]);

const metadataPreviewTrueBooleanKeys = new Set(["previewonly"]);

export class PrismaAgentRuntimeRepository implements AgentRuntimeRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createRuntimeExecutionPreview(
    input: CreateRuntimeExecutionPreviewInput,
  ): Promise<AgentRuntimeExecutionRecord> {
    const taskId = normalizeOptionalText(input.taskId);
    const data: Prisma.AgentRuntimeExecutionCreateInput = {
      userId: normalizeOptionalText(input.userId),
      executionStatus:
        normalizeOptionalText(input.executionStatus) ??
        defaultRuntimeExecutionStatus,
      lifecycleStatus:
        normalizeOptionalText(input.lifecycleStatus) ??
        defaultRuntimeLifecycleStatus,
      boundaryFlags: sanitizeRuntimePreviewFlags(input.boundaryFlags),
      safetyFlags: sanitizeRuntimePreviewFlags(input.safetyFlags),
      currentStepId: normalizeOptionalText(input.currentStepId),
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
      llmCallEnabled: false,
      permissionConfirmationEnabled: false,
      backgroundJobEnabled: false,
      streamingEnabled: false,
      previewOnly: true,
    };

    if (taskId !== null) {
      data.task = { connect: { id: taskId } };
    }

    if (input.transitionState !== undefined) {
      data.transitionState = sanitizeRuntimeMetadata(input.transitionState);
    }

    if (input.metadata !== undefined) {
      data.metadata = sanitizeRuntimeMetadata(input.metadata);
    }

    if (input.errors !== undefined) {
      data.errors = sanitizeRuntimeMetadata(input.errors);
    }

    return this.prisma.agentRuntimeExecution.create({ data });
  }

  async getRuntimeExecutionById(
    executionId: string,
  ): Promise<AgentRuntimeExecutionRecord | null> {
    return this.prisma.agentRuntimeExecution.findUnique({
      where: {
        id: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
      },
    });
  }

  async listRuntimeExecutionsByTask(
    taskId: string,
    options: ListRuntimeExecutionsByTaskOptions = {},
  ): Promise<AgentRuntimeExecutionRecord[]> {
    return this.prisma.agentRuntimeExecution.findMany({
      where: {
        taskId: normalizeRequiredText(taskId, "Agent task id is required."),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async listRuntimeExecutionsByUser(
    userId: string,
    options: ListRuntimeExecutionsByUserOptions = {},
  ): Promise<AgentRuntimeExecutionRecord[]> {
    return this.prisma.agentRuntimeExecution.findMany({
      where: {
        userId: normalizeRequiredText(userId, "User id is required."),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendRuntimeStepPreview(
    executionId: string,
    input: AppendRuntimeStepPreviewInput,
  ): Promise<AgentRuntimeStepRecord> {
    const data: Prisma.AgentRuntimeStepCreateInput = {
      execution: {
        connect: {
          id: normalizeRequiredText(
            executionId,
            "Agent runtime execution id is required.",
          ),
        },
      },
      stepKey: normalizeOptionalText(input.stepKey),
      title: normalizeRequiredText(
        input.title,
        "Agent runtime step title is required.",
      ),
      kind: normalizeRequiredText(
        input.kind,
        "Agent runtime step kind is required.",
      ),
      status:
        normalizeOptionalText(input.status) ?? defaultRuntimeRecordStatus,
      riskLevel: normalizeOptionalText(input.riskLevel),
      summary: normalizeOptionalText(input.summary),
      inputSummary: normalizeOptionalText(input.inputSummary),
      outputSummary: normalizeOptionalText(input.outputSummary),
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
    };

    if (input.blockedReasons !== undefined) {
      data.blockedReasons = sanitizeRuntimeMetadata(input.blockedReasons);
    }

    if (input.metadata !== undefined) {
      data.metadata = sanitizeRuntimeMetadata(input.metadata);
    }

    return this.prisma.agentRuntimeStep.create({ data });
  }

  async listRuntimeStepsByExecution(
    executionId: string,
    options: ListRuntimeRecordsByExecutionOptions = {},
  ): Promise<AgentRuntimeStepRecord[]> {
    return this.prisma.agentRuntimeStep.findMany({
      where: {
        executionId: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendRuntimeToolCallPreview(
    executionId: string,
    input: AppendRuntimeToolCallPreviewInput,
  ): Promise<AgentRuntimeToolCallRecord> {
    const data: Prisma.AgentRuntimeToolCallCreateInput = {
      execution: {
        connect: {
          id: normalizeRequiredText(
            executionId,
            "Agent runtime execution id is required.",
          ),
        },
      },
      stepId: normalizeOptionalText(input.stepId),
      toolName: normalizeRequiredText(
        input.toolName,
        "Agent runtime tool name is required.",
      ),
      toolKind: normalizeOptionalText(input.toolKind),
      status:
        normalizeOptionalText(input.status) ?? defaultRuntimeRecordStatus,
      requirementSummary: normalizeOptionalText(input.requirementSummary),
      inputSummary: normalizeOptionalText(input.inputSummary),
      resultSummary: normalizeOptionalText(input.resultSummary),
      riskLevel: normalizeOptionalText(input.riskLevel),
      sandboxRequired: true,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      toolExecutionEnabled: false,
    };

    if (input.blockedReasons !== undefined) {
      data.blockedReasons = sanitizeRuntimeMetadata(input.blockedReasons);
    }

    if (input.metadata !== undefined) {
      data.metadata = sanitizeRuntimeMetadata(input.metadata);
    }

    return this.prisma.agentRuntimeToolCall.create({ data });
  }

  async listRuntimeToolCallsByExecution(
    executionId: string,
    options: ListRuntimeRecordsByExecutionOptions = {},
  ): Promise<AgentRuntimeToolCallRecord[]> {
    return this.prisma.agentRuntimeToolCall.findMany({
      where: {
        executionId: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
        toolExecutionEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendRuntimeLlmCallPreview(
    executionId: string,
    input: AppendRuntimeLlmCallPreviewInput,
  ): Promise<AgentRuntimeLlmCallRecord> {
    const data: Prisma.AgentRuntimeLlmCallCreateInput = {
      execution: {
        connect: {
          id: normalizeRequiredText(
            executionId,
            "Agent runtime execution id is required.",
          ),
        },
      },
      stepId: normalizeOptionalText(input.stepId),
      providerKind: normalizeOptionalText(input.providerKind),
      modelLabel: normalizeOptionalText(input.modelLabel),
      requestSummary: normalizeOptionalText(input.requestSummary),
      responseSummary: normalizeOptionalText(input.responseSummary),
      estimatedInputTokens: normalizeOptionalNonNegativeInteger(
        input.estimatedInputTokens,
      ),
      estimatedOutputTokens: normalizeOptionalNonNegativeInteger(
        input.estimatedOutputTokens,
      ),
      status:
        normalizeOptionalText(input.status) ?? defaultRuntimeRecordStatus,
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      llmCallEnabled: false,
      streamingEnabled: false,
    };

    if (input.blockedReasons !== undefined) {
      data.blockedReasons = sanitizeRuntimeMetadata(input.blockedReasons);
    }

    if (input.metadata !== undefined) {
      data.metadata = sanitizeRuntimeLlmMetadata(input.metadata);
    }

    return this.prisma.agentRuntimeLlmCall.create({ data });
  }

  async listRuntimeLlmCallsByExecution(
    executionId: string,
    options: ListRuntimeRecordsByExecutionOptions = {},
  ): Promise<AgentRuntimeLlmCallRecord[]> {
    return this.prisma.agentRuntimeLlmCall.findMany({
      where: {
        executionId: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
        llmCallEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendRuntimeEventPreview(
    executionId: string,
    input: AppendRuntimeEventPreviewInput,
  ): Promise<AgentRuntimeEventRecord> {
    const data: Prisma.AgentRuntimeEventCreateInput = {
      execution: {
        connect: {
          id: normalizeRequiredText(
            executionId,
            "Agent runtime execution id is required.",
          ),
        },
      },
      eventKind: normalizeRequiredText(
        input.eventKind,
        "Agent runtime event kind is required.",
      ),
      fromStatus: normalizeOptionalText(input.fromStatus),
      toStatus: normalizeOptionalText(input.toStatus),
      action: normalizeOptionalText(input.action),
      message: normalizeOptionalText(input.message),
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
    };

    if (input.payload !== undefined) {
      data.payload = sanitizeRuntimeMetadata(input.payload);
    }

    return this.prisma.agentRuntimeEvent.create({ data });
  }

  async listRuntimeEventsByExecution(
    executionId: string,
    options: ListRuntimeRecordsByExecutionOptions = {},
  ): Promise<AgentRuntimeEventRecord[]> {
    return this.prisma.agentRuntimeEvent.findMany({
      where: {
        executionId: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async appendRuntimeAuditLogPreview(
    executionId: string,
    input: AppendRuntimeAuditLogPreviewInput,
  ): Promise<AgentRuntimeAuditLogRecord> {
    const data: Prisma.AgentRuntimeAuditLogCreateInput = {
      execution: {
        connect: {
          id: normalizeRequiredText(
            executionId,
            "Agent runtime execution id is required.",
          ),
        },
      },
      actorKind: normalizeOptionalText(input.actorKind),
      action: normalizeRequiredText(
        input.action,
        "Agent runtime audit log action is required.",
      ),
      targetKind: normalizeOptionalText(input.targetKind),
      riskLevel: normalizeOptionalText(input.riskLevel),
      riskSummary: normalizeOptionalText(input.riskSummary),
      boundaryFlags: sanitizeRuntimePreviewFlags(input.boundaryFlags),
      safetyFlags: sanitizeRuntimePreviewFlags(input.safetyFlags),
      previewOnly: true,
      executable: false,
      realExecutionEnabled: false,
      productionAuditEnabled: false,
    };

    if (input.metadata !== undefined) {
      data.metadata = sanitizeRuntimeMetadata(input.metadata);
    }

    return this.prisma.agentRuntimeAuditLog.create({ data });
  }

  async listRuntimeAuditLogsByExecution(
    executionId: string,
    options: ListRuntimeRecordsByExecutionOptions = {},
  ): Promise<AgentRuntimeAuditLogRecord[]> {
    return this.prisma.agentRuntimeAuditLog.findMany({
      where: {
        executionId: normalizeRequiredText(
          executionId,
          "Agent runtime execution id is required.",
        ),
        previewOnly: true,
        executable: false,
        realExecutionEnabled: false,
        productionAuditEnabled: false,
      },
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }
}

function sanitizeRuntimePreviewFlags(
  value: AgentRuntimeRepositoryJsonValue | undefined,
): AgentRuntimeRepositoryJsonValue {
  const sanitizedValue = sanitizeRuntimeJsonValue(value);
  const sanitizedObject = isRuntimeJsonObject(sanitizedValue)
    ? sanitizedValue
    : {};

  return {
    ...sanitizedObject,
    ...runtimePreviewFlags,
  } as AgentRuntimeRepositoryJsonValue;
}

function sanitizeRuntimeLlmMetadata(
  value: AgentRuntimeRepositoryJsonValue,
): AgentRuntimeRepositoryJsonValue | undefined {
  return sanitizeRuntimeMetadata(value);
}

function sanitizeRuntimeMetadata(
  value: AgentRuntimeRepositoryJsonValue,
): AgentRuntimeRepositoryJsonValue | undefined {
  const sanitizedValue = sanitizeRuntimeJsonValue(value);

  if (sanitizedValue === undefined || sanitizedValue === null) {
    return undefined;
  }

  return sanitizedValue as AgentRuntimeRepositoryJsonValue;
}

function sanitizeRuntimeJsonValue(
  value: unknown,
): RuntimeJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeRuntimeJsonValue(item))
      .filter((item): item is RuntimeJsonValue => item !== undefined);
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const output: RuntimeJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeMetadataKey(key);

    if (metadataSensitiveKeys.has(normalizedKey)) {
      continue;
    }

    if (metadataPreviewTrueBooleanKeys.has(normalizedKey)) {
      output[key] = true;
      continue;
    }

    if (metadataPreviewFalseBooleanKeys.has(normalizedKey)) {
      output[key] = false;
      continue;
    }

    const sanitizedNestedValue = sanitizeRuntimeJsonValue(nestedValue);

    if (sanitizedNestedValue !== undefined) {
      output[key] = sanitizedNestedValue;
    }
  }

  return output;
}

function normalizeMetadataKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isRuntimeJsonObject(
  value: RuntimeJsonValue | undefined,
): value is RuntimeJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeOptionalNonNegativeInteger(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(Math.trunc(value), 0);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultRuntimeListLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxRuntimeListLimit);
}

type RuntimeJsonPrimitive = string | number | boolean | null;

type RuntimeJsonValue =
  | RuntimeJsonPrimitive
  | RuntimeJsonObject
  | RuntimeJsonValue[];

interface RuntimeJsonObject {
  [key: string]: RuntimeJsonValue;
}
