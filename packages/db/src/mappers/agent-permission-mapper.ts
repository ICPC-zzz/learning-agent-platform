import type {
  AgentPermissionRepositoryJsonValue,
  CreateAgentPermissionDecisionPreviewInput,
  CreateAgentPermissionRequestPreviewInput,
} from "../repositories/agent-permission-repository.js";

type AgentPermissionMapperJsonPrimitive = string | number | boolean | null;

type AgentPermissionMapperJsonValue =
  | AgentPermissionMapperJsonPrimitive
  | AgentPermissionMapperJsonObject
  | AgentPermissionMapperJsonValue[];

interface AgentPermissionMapperJsonObject {
  [key: string]: AgentPermissionMapperJsonValue;
}

export interface AgentPermissionRequestPreviewLike {
  requestStatus?: string | null;
  sourceRequestStatus?: string | null;
  autonomyLevel?: string | null;
  overallRiskLevel?: string | null;
  allowedByCurrentAutonomy?: boolean | null;
  requiresConfirmation?: boolean | null;
  permissionFlowEnabled?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  permissionRequests?: unknown;
  blockedRequests?: unknown;
  informationalRequests?: unknown;
  confirmationSummary?: unknown;
  riskSummary?: unknown;
  recommendedNextActions?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface AgentPermissionDecisionPreviewLike {
  decisionStatus?: string | null;
  sourceRequestStatus?: string | null;
  permissionFlowEnabled?: boolean;
  decisionCaptured?: boolean;
  executable?: boolean;
  realExecutionEnabled?: boolean;
  requiredBeforeExecution?: boolean | null;
  approvableRequestIds?: unknown;
  blockedRequestIds?: unknown;
  informationalRequestIds?: unknown;
  missingDecisionReasons?: unknown;
  blockedReasons?: unknown;
  decisionItems?: unknown;
  decisionShapePreview?: unknown;
  recommendedNextActions?: unknown;
  safetyNotes?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
}

export interface MapAgentPermissionRequestPreviewToCreateInputOptions {
  taskId?: string | null;
  metadata?: unknown;
}

export interface MapAgentPermissionDecisionPreviewToCreateInputOptions {
  permissionRequestId?: string | null;
  taskId?: string | null;
  metadata?: unknown;
}

export type MapAgentPermissionRequestPreviewOptions =
  MapAgentPermissionRequestPreviewToCreateInputOptions;

export type MapAgentPermissionDecisionPreviewOptions =
  MapAgentPermissionDecisionPreviewToCreateInputOptions;

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

const permissionPreviewFalseBooleanKeys = new Set([
  "permissionFlowEnabled",
  "decisionCaptured",
  "executable",
  "realExecutionEnabled",
  "toolsExecuted",
  "llmCalled",
  "networkUsed",
  "memoryRetrievalExecuted",
  "embeddingUsed",
  "embeddingsUsed",
  "vectorSearchUsed",
  "ragUsed",
  "dataSaved",
  "skillGenerated",
  "skillInstalled",
  "skillExecuted",
]);

const realPermissionFlowOnlyKeys = new Set([
  "approvedAt",
  "rejectedAt",
  "confirmedAt",
  "decidedAt",
  "decidedBy",
  "decidedByUserId",
  "decisionValue",
  "approvePermission",
  "rejectPermission",
  "confirmPermission",
  "grantPermission",
  "executePermission",
  "executeTask",
  "runTask",
  "startRuntime",
]);

export function mapAgentPermissionRequestPreviewToCreateInput(
  preview: AgentPermissionRequestPreviewLike,
  options: MapAgentPermissionRequestPreviewToCreateInputOptions = {},
): CreateAgentPermissionRequestPreviewInput {
  const createInput: CreateAgentPermissionRequestPreviewInput = {
    taskId: normalizeOptionalText(options.taskId),
    requestStatus: normalizeKnownText(
      preview.requestStatus,
      permissionRequestPreviewStatuses,
      defaultPermissionRequestStatus,
    ),
    sourceRequestStatus: normalizeKnownNullableText(
      preview.sourceRequestStatus,
      permissionRequestPreviewStatuses,
    ),
    autonomyLevel: normalizeOptionalText(preview.autonomyLevel),
    overallRiskLevel: normalizeOptionalText(preview.overallRiskLevel),
    allowedByCurrentAutonomy: normalizeOptionalBoolean(
      preview.allowedByCurrentAutonomy,
    ),
    requiresConfirmation: preview.requiresConfirmation === true,
    permissionFlowEnabled: false,
    executable: false,
    realExecutionEnabled: false,
    permissionRequests: createJsonValue(preview.permissionRequests, []),
    blockedRequests: createJsonValue(preview.blockedRequests, []),
    informationalRequests: createJsonValue(
      preview.informationalRequests,
      [],
    ),
    confirmationSummary: createJsonValue(preview.confirmationSummary, {}),
    riskSummary: createJsonValue(preview.riskSummary, {}),
    recommendedNextActions: createJsonValue(
      preview.recommendedNextActions,
      [],
    ),
    safetyNotes: createJsonValue(preview.safetyNotes, []),
    previewPayload: createPermissionRequestPreviewPayload(preview),
  };
  const metadata = toRepositoryJsonValue(
    options.metadata ?? preview.metadata,
  );

  if (metadata !== undefined) {
    createInput.metadata = metadata;
  }

  return createInput;
}

export function mapAgentPermissionDecisionPreviewToCreateInput(
  preview: AgentPermissionDecisionPreviewLike,
  options: MapAgentPermissionDecisionPreviewToCreateInputOptions = {},
): CreateAgentPermissionDecisionPreviewInput {
  const createInput: CreateAgentPermissionDecisionPreviewInput = {
    permissionRequestId: normalizeOptionalText(options.permissionRequestId),
    taskId: normalizeOptionalText(options.taskId),
    decisionStatus: normalizeKnownText(
      preview.decisionStatus,
      permissionDecisionPreviewStatuses,
      defaultPermissionDecisionStatus,
    ),
    sourceRequestStatus: normalizeKnownNullableText(
      preview.sourceRequestStatus,
      permissionRequestPreviewStatuses,
    ),
    permissionFlowEnabled: false,
    decisionCaptured: false,
    executable: false,
    realExecutionEnabled: false,
    requiredBeforeExecution: preview.requiredBeforeExecution === true,
    approvableRequestIds: createJsonValue(preview.approvableRequestIds, []),
    blockedRequestIds: createJsonValue(preview.blockedRequestIds, []),
    informationalRequestIds: createJsonValue(
      preview.informationalRequestIds,
      [],
    ),
    missingDecisionReasons: createJsonValue(
      preview.missingDecisionReasons,
      [],
    ),
    blockedReasons: createJsonValue(preview.blockedReasons, []),
    decisionItems: createJsonValue(preview.decisionItems, []),
    decisionShapePreview: createJsonValue(preview.decisionShapePreview, {}),
    recommendedNextActions: createJsonValue(
      preview.recommendedNextActions,
      [],
    ),
    safetyNotes: createJsonValue(preview.safetyNotes, []),
    previewPayload: createPermissionDecisionPreviewPayload(preview),
  };
  const metadata = toRepositoryJsonValue(
    options.metadata ?? preview.metadata,
  );

  if (metadata !== undefined) {
    createInput.metadata = metadata;
  }

  return createInput;
}

function createPermissionRequestPreviewPayload(
  preview: AgentPermissionRequestPreviewLike,
): AgentPermissionRepositoryJsonValue {
  return toRepositoryJsonValue({
    ...preview,
    requestStatus: normalizeKnownText(
      preview.requestStatus,
      permissionRequestPreviewStatuses,
      defaultPermissionRequestStatus,
    ),
    sourceRequestStatus: normalizeKnownNullableText(
      preview.sourceRequestStatus,
      permissionRequestPreviewStatuses,
    ),
    allowedByCurrentAutonomy: normalizeOptionalBoolean(
      preview.allowedByCurrentAutonomy,
    ),
    requiresConfirmation: preview.requiresConfirmation === true,
    permissionFlowEnabled: false,
    executable: false,
    realExecutionEnabled: false,
  }) as AgentPermissionRepositoryJsonValue;
}

function createPermissionDecisionPreviewPayload(
  preview: AgentPermissionDecisionPreviewLike,
): AgentPermissionRepositoryJsonValue {
  return toRepositoryJsonValue({
    ...preview,
    decisionStatus: normalizeKnownText(
      preview.decisionStatus,
      permissionDecisionPreviewStatuses,
      defaultPermissionDecisionStatus,
    ),
    sourceRequestStatus: normalizeKnownNullableText(
      preview.sourceRequestStatus,
      permissionRequestPreviewStatuses,
    ),
    permissionFlowEnabled: false,
    decisionCaptured: false,
    executable: false,
    realExecutionEnabled: false,
    requiredBeforeExecution: preview.requiredBeforeExecution === true,
  }) as AgentPermissionRepositoryJsonValue;
}

function createJsonValue(
  value: unknown,
  fallback: Exclude<AgentPermissionMapperJsonValue, null>,
): AgentPermissionRepositoryJsonValue {
  return toRepositoryJsonValue(value) ?? fallback;
}

function toRepositoryJsonValue(
  value: unknown,
): AgentPermissionRepositoryJsonValue | undefined {
  const sanitizedValue = sanitizeJsonValue(value);

  if (sanitizedValue === undefined || sanitizedValue === null) {
    return undefined;
  }

  return sanitizedValue as AgentPermissionRepositoryJsonValue;
}

function sanitizeJsonValue(
  value: unknown,
): AgentPermissionMapperJsonValue | undefined {
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
      .map((item) => sanitizeJsonValue(item))
      .filter(
        (item): item is AgentPermissionMapperJsonValue => item !== undefined,
      );
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const output: AgentPermissionMapperJsonObject = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (realPermissionFlowOnlyKeys.has(key)) {
      continue;
    }

    if (permissionPreviewFalseBooleanKeys.has(key)) {
      output[key] = false;
      continue;
    }

    const sanitizedNestedValue = sanitizeJsonValue(nestedValue);

    if (sanitizedNestedValue !== undefined) {
      output[key] = sanitizedNestedValue;
    }
  }

  return output;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeKnownText(
  value: unknown,
  allowedValues: ReadonlySet<string>,
  defaultValue: string,
): string {
  const normalized = normalizeOptionalText(value);

  return normalized !== null && allowedValues.has(normalized)
    ? normalized
    : defaultValue;
}

function normalizeKnownNullableText(
  value: unknown,
  allowedValues: ReadonlySet<string>,
): string | null {
  const normalized = normalizeOptionalText(value);

  return normalized !== null && allowedValues.has(normalized)
    ? normalized
    : null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
