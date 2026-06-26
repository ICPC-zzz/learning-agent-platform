import type {
  AgentPermissionDecision,
  AgentPermissionRequest,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export type AgentPermissionRepositoryJsonValue = Prisma.InputJsonValue;

export type AgentPermissionRequestRecord = AgentPermissionRequest;

export type AgentPermissionDecisionRecord = AgentPermissionDecision;

export interface CreateAgentPermissionRequestPreviewInput {
  taskId?: string | null;
  requestStatus?: string | null;
  sourceRequestStatus?: string | null;
  autonomyLevel?: string | null;
  overallRiskLevel?: string | null;
  allowedByCurrentAutonomy?: boolean | null;
  requiresConfirmation?: boolean;
  permissionFlowEnabled?: false;
  executable?: false;
  realExecutionEnabled?: false;
  permissionRequests?: AgentPermissionRepositoryJsonValue;
  blockedRequests?: AgentPermissionRepositoryJsonValue;
  informationalRequests?: AgentPermissionRepositoryJsonValue;
  confirmationSummary?: AgentPermissionRepositoryJsonValue;
  riskSummary?: AgentPermissionRepositoryJsonValue;
  recommendedNextActions?: AgentPermissionRepositoryJsonValue;
  safetyNotes?: AgentPermissionRepositoryJsonValue;
  previewPayload?: AgentPermissionRepositoryJsonValue;
  metadata?: AgentPermissionRepositoryJsonValue;
}

export interface CreateAgentPermissionDecisionPreviewInput {
  permissionRequestId?: string | null;
  taskId?: string | null;
  decisionStatus?: string | null;
  sourceRequestStatus?: string | null;
  permissionFlowEnabled?: false;
  decisionCaptured?: false;
  executable?: false;
  realExecutionEnabled?: false;
  requiredBeforeExecution?: boolean;
  approvableRequestIds?: AgentPermissionRepositoryJsonValue;
  blockedRequestIds?: AgentPermissionRepositoryJsonValue;
  informationalRequestIds?: AgentPermissionRepositoryJsonValue;
  missingDecisionReasons?: AgentPermissionRepositoryJsonValue;
  blockedReasons?: AgentPermissionRepositoryJsonValue;
  decisionItems?: AgentPermissionRepositoryJsonValue;
  decisionShapePreview?: AgentPermissionRepositoryJsonValue;
  recommendedNextActions?: AgentPermissionRepositoryJsonValue;
  safetyNotes?: AgentPermissionRepositoryJsonValue;
  previewPayload?: AgentPermissionRepositoryJsonValue;
  metadata?: AgentPermissionRepositoryJsonValue;
}

export interface ListAgentPermissionRequestsByTaskOptions {
  limit?: number;
  requestStatus?: string;
  requiresConfirmation?: boolean;
}

export interface ListRecentAgentPermissionRequestPreviewsOptions {
  taskId?: string | null;
  limit?: number;
  requestStatus?: string;
  requiresConfirmation?: boolean;
}

export interface ListAgentPermissionDecisionsByRequestOptions {
  limit?: number;
  decisionStatus?: string;
}

export interface ListAgentPermissionDecisionsByTaskOptions {
  limit?: number;
  decisionStatus?: string;
}

export interface AgentPermissionRepository {
  createPermissionRequestPreview(
    input: CreateAgentPermissionRequestPreviewInput,
  ): Promise<AgentPermissionRequestRecord>;

  getPermissionRequestById(
    id: string,
  ): Promise<AgentPermissionRequestRecord | null>;

  listPermissionRequestsByTask(
    taskId: string,
    options?: ListAgentPermissionRequestsByTaskOptions,
  ): Promise<AgentPermissionRequestRecord[]>;

  listRecentPermissionRequestPreviews(
    options?: ListRecentAgentPermissionRequestPreviewsOptions,
  ): Promise<AgentPermissionRequestRecord[]>;

  createPermissionDecisionPreview(
    input: CreateAgentPermissionDecisionPreviewInput,
  ): Promise<AgentPermissionDecisionRecord>;

  getPermissionDecisionById(
    id: string,
  ): Promise<AgentPermissionDecisionRecord | null>;

  listPermissionDecisionsByRequest(
    permissionRequestId: string,
    options?: ListAgentPermissionDecisionsByRequestOptions,
  ): Promise<AgentPermissionDecisionRecord[]>;

  listPermissionDecisionsByTask(
    taskId: string,
    options?: ListAgentPermissionDecisionsByTaskOptions,
  ): Promise<AgentPermissionDecisionRecord[]>;
}

const defaultAgentPermissionListLimit = 20;
const maxAgentPermissionListLimit = 100;
const defaultPermissionRequestStatus = "preview_only";
const defaultPermissionDecisionStatus = "no_decision_captured";

const permissionRequestPreviewStatuses = new Set([
  "preview_only",
  "no_permission_required",
  "confirmation_required",
  "blocked",
  "not_ready",
  "disabled",
]);

const permissionDecisionPreviewStatuses = new Set([
  "preview_only",
  "pending_user_confirmation",
  "blocked",
  "disabled",
  "no_decision_captured",
]);

export class PrismaAgentPermissionRepository
  implements AgentPermissionRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createPermissionRequestPreview(
    input: CreateAgentPermissionRequestPreviewInput,
  ): Promise<AgentPermissionRequestRecord> {
    const data: Prisma.AgentPermissionRequestCreateInput = {
      taskId: normalizeOptionalText(input.taskId),
      requestStatus: normalizePermissionRequestStatus(input.requestStatus),
      sourceRequestStatus: normalizeOptionalText(input.sourceRequestStatus),
      autonomyLevel: normalizeOptionalText(input.autonomyLevel),
      overallRiskLevel: normalizeOptionalText(input.overallRiskLevel),
      allowedByCurrentAutonomy: input.allowedByCurrentAutonomy ?? null,
      requiresConfirmation: input.requiresConfirmation ?? false,
      permissionFlowEnabled: false,
      executable: false,
      realExecutionEnabled: false,
    };

    if (input.permissionRequests !== undefined) {
      data.permissionRequests = input.permissionRequests;
    }

    if (input.blockedRequests !== undefined) {
      data.blockedRequests = input.blockedRequests;
    }

    if (input.informationalRequests !== undefined) {
      data.informationalRequests = input.informationalRequests;
    }

    if (input.confirmationSummary !== undefined) {
      data.confirmationSummary = input.confirmationSummary;
    }

    if (input.riskSummary !== undefined) {
      data.riskSummary = input.riskSummary;
    }

    if (input.recommendedNextActions !== undefined) {
      data.recommendedNextActions = input.recommendedNextActions;
    }

    if (input.safetyNotes !== undefined) {
      data.safetyNotes = input.safetyNotes;
    }

    if (input.previewPayload !== undefined) {
      data.previewPayload = input.previewPayload;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.agentPermissionRequest.create({ data });
  }

  async getPermissionRequestById(
    id: string,
  ): Promise<AgentPermissionRequestRecord | null> {
    return this.prisma.agentPermissionRequest.findUnique({
      where: {
        id: normalizeRequiredText(
          id,
          "Agent permission request id is required.",
        ),
      },
    });
  }

  async listPermissionRequestsByTask(
    taskId: string,
    options: ListAgentPermissionRequestsByTaskOptions = {},
  ): Promise<AgentPermissionRequestRecord[]> {
    const where: Prisma.AgentPermissionRequestWhereInput = {
      taskId: normalizeRequiredText(taskId, "Agent task id is required."),
    };

    if (options.requestStatus !== undefined) {
      where.requestStatus = normalizeRequiredText(
        options.requestStatus,
        "Agent permission requestStatus filter cannot be empty.",
      );
    }

    if (options.requiresConfirmation !== undefined) {
      where.requiresConfirmation = options.requiresConfirmation;
    }

    return this.prisma.agentPermissionRequest.findMany({
      where,
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async listRecentPermissionRequestPreviews(
    options: ListRecentAgentPermissionRequestPreviewsOptions = {},
  ): Promise<AgentPermissionRequestRecord[]> {
    const where: Prisma.AgentPermissionRequestWhereInput = {
      taskId: normalizeOptionalText(options.taskId ?? null),
      permissionFlowEnabled: false,
      executable: false,
      realExecutionEnabled: false,
    };

    if (options.requestStatus !== undefined) {
      where.requestStatus = normalizeRequiredText(
        options.requestStatus,
        "Agent permission requestStatus filter cannot be empty.",
      );
    }

    if (options.requiresConfirmation !== undefined) {
      where.requiresConfirmation = options.requiresConfirmation;
    }

    return this.prisma.agentPermissionRequest.findMany({
      where,
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async createPermissionDecisionPreview(
    input: CreateAgentPermissionDecisionPreviewInput,
  ): Promise<AgentPermissionDecisionRecord> {
    const permissionRequestId = normalizeOptionalText(
      input.permissionRequestId,
    );
    const data: Prisma.AgentPermissionDecisionCreateInput = {
      taskId: normalizeOptionalText(input.taskId),
      decisionStatus: normalizePermissionDecisionStatus(input.decisionStatus),
      sourceRequestStatus: normalizeOptionalText(input.sourceRequestStatus),
      permissionFlowEnabled: false,
      decisionCaptured: false,
      executable: false,
      realExecutionEnabled: false,
      requiredBeforeExecution: input.requiredBeforeExecution ?? false,
    };

    if (permissionRequestId !== null) {
      data.permissionRequest = {
        connect: { id: permissionRequestId },
      };
    }

    if (input.approvableRequestIds !== undefined) {
      data.approvableRequestIds = input.approvableRequestIds;
    }

    if (input.blockedRequestIds !== undefined) {
      data.blockedRequestIds = input.blockedRequestIds;
    }

    if (input.informationalRequestIds !== undefined) {
      data.informationalRequestIds = input.informationalRequestIds;
    }

    if (input.missingDecisionReasons !== undefined) {
      data.missingDecisionReasons = input.missingDecisionReasons;
    }

    if (input.blockedReasons !== undefined) {
      data.blockedReasons = input.blockedReasons;
    }

    if (input.decisionItems !== undefined) {
      data.decisionItems = input.decisionItems;
    }

    if (input.decisionShapePreview !== undefined) {
      data.decisionShapePreview = input.decisionShapePreview;
    }

    if (input.recommendedNextActions !== undefined) {
      data.recommendedNextActions = input.recommendedNextActions;
    }

    if (input.safetyNotes !== undefined) {
      data.safetyNotes = input.safetyNotes;
    }

    if (input.previewPayload !== undefined) {
      data.previewPayload = input.previewPayload;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return this.prisma.agentPermissionDecision.create({ data });
  }

  async getPermissionDecisionById(
    id: string,
  ): Promise<AgentPermissionDecisionRecord | null> {
    return this.prisma.agentPermissionDecision.findUnique({
      where: {
        id: normalizeRequiredText(
          id,
          "Agent permission decision id is required.",
        ),
      },
    });
  }

  async listPermissionDecisionsByRequest(
    permissionRequestId: string,
    options: ListAgentPermissionDecisionsByRequestOptions = {},
  ): Promise<AgentPermissionDecisionRecord[]> {
    const where: Prisma.AgentPermissionDecisionWhereInput = {
      permissionRequestId: normalizeRequiredText(
        permissionRequestId,
        "Agent permission request id is required.",
      ),
    };

    if (options.decisionStatus !== undefined) {
      where.decisionStatus = normalizeRequiredText(
        options.decisionStatus,
        "Agent permission decisionStatus filter cannot be empty.",
      );
    }

    return this.prisma.agentPermissionDecision.findMany({
      where,
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async listPermissionDecisionsByTask(
    taskId: string,
    options: ListAgentPermissionDecisionsByTaskOptions = {},
  ): Promise<AgentPermissionDecisionRecord[]> {
    const where: Prisma.AgentPermissionDecisionWhereInput = {
      taskId: normalizeRequiredText(taskId, "Agent task id is required."),
    };

    if (options.decisionStatus !== undefined) {
      where.decisionStatus = normalizeRequiredText(
        options.decisionStatus,
        "Agent permission decisionStatus filter cannot be empty.",
      );
    }

    return this.prisma.agentPermissionDecision.findMany({
      where,
      take: normalizeLimit(options.limit),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
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

function normalizePermissionRequestStatus(
  value: string | null | undefined,
): string {
  return normalizeKnownPreviewText(
    value,
    permissionRequestPreviewStatuses,
    defaultPermissionRequestStatus,
  );
}

function normalizePermissionDecisionStatus(
  value: string | null | undefined,
): string {
  return normalizeKnownPreviewText(
    value,
    permissionDecisionPreviewStatuses,
    defaultPermissionDecisionStatus,
  );
}

function normalizeKnownPreviewText(
  value: string | null | undefined,
  allowedValues: ReadonlySet<string>,
  defaultValue: string,
): string {
  const normalized = normalizeOptionalText(value);

  return normalized !== null && allowedValues.has(normalized)
    ? normalized
    : defaultValue;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultAgentPermissionListLimit;
  }

  return Math.min(
    Math.max(Math.trunc(limit), 1),
    maxAgentPermissionListLimit,
  );
}
