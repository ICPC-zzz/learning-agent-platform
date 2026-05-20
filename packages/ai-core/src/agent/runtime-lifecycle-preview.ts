import { AutonomyRiskLevel } from "../autonomy/types";
import type { AgentMetadata } from "./types";

export const AgentExecutionStatus = {
  Draft: "draft",
  PreviewReady: "preview_ready",
  WaitingForPermission: "waiting_for_permission",
  Queued: "queued",
  Running: "running",
  Paused: "paused",
  Cancelling: "cancelling",
  Cancelled: "cancelled",
  Failed: "failed",
  Completed: "completed",
  Blocked: "blocked",
  TimedOut: "timed_out",
} as const;

export type AgentExecutionStatus =
  (typeof AgentExecutionStatus)[keyof typeof AgentExecutionStatus];

export const AgentRuntimeLifecycleStatus = {
  PreviewOnly: "preview_only",
  BoundaryDefined: "boundary_defined",
  PendingPermission: "pending_permission",
  ReadyToStart: "ready_to_start",
  Queued: "queued",
  Running: "running",
  WaitingForTool: "waiting_for_tool",
  WaitingForUser: "waiting_for_user",
  Paused: "paused",
  Cancelling: "cancelling",
  Cancelled: "cancelled",
  Completed: "completed",
  Failed: "failed",
  TimedOut: "timed_out",
  Blocked: "blocked",
  Disabled: "disabled",
} as const;

export type AgentRuntimeLifecycleStatus =
  (typeof AgentRuntimeLifecycleStatus)[keyof typeof AgentRuntimeLifecycleStatus];

export const AgentRuntimeRiskLevel = {
  Low: AutonomyRiskLevel.Low,
  Medium: AutonomyRiskLevel.Medium,
  High: AutonomyRiskLevel.High,
  Critical: AutonomyRiskLevel.Critical,
  Unknown: "unknown",
} as const;

export type AgentRuntimeRiskLevel =
  (typeof AgentRuntimeRiskLevel)[keyof typeof AgentRuntimeRiskLevel];

export interface AgentRuntimeBoundaryFlags {
  executable: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  permissionConfirmationEnabled: false;
  backgroundJobEnabled: false;
  persistenceEnabled: false;
  previewPersistenceOnly: true;
  streamingEnabled: false;
  schedulerEnabled: false;
  skillExecutionEnabled: false;
  memoryRetrievalEnabled: false;
  networkAccessEnabled: false;
}

export const AGENT_RUNTIME_BOUNDARY_FLAGS_PREVIEW = {
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  persistenceEnabled: false,
  previewPersistenceOnly: true,
  streamingEnabled: false,
  schedulerEnabled: false,
  skillExecutionEnabled: false,
  memoryRetrievalEnabled: false,
  networkAccessEnabled: false,
} as const satisfies AgentRuntimeBoundaryFlags;

export interface AgentRuntimeSafetyFlags {
  requiresPermissionConfirmation: boolean;
  requiresHumanReview: boolean;
  hasHighRiskToolRequirement: boolean;
  hasExternalSideEffectRisk: boolean;
  hasCredentialAccessRisk: boolean;
  isPreviewOnly: true;
}

export interface AgentRuntimeSafetyFlagsPreviewInput {
  requiresPermissionConfirmation?: boolean;
  requiresHumanReview?: boolean;
  hasHighRiskToolRequirement?: boolean;
  hasExternalSideEffectRisk?: boolean;
  hasCredentialAccessRisk?: boolean;
  overallRiskLevel?: AgentRuntimeRiskLevel;
}

export const AGENT_RUNTIME_SAFETY_FLAGS_PREVIEW = {
  requiresPermissionConfirmation: false,
  requiresHumanReview: true,
  hasHighRiskToolRequirement: false,
  hasExternalSideEffectRisk: false,
  hasCredentialAccessRisk: false,
  isPreviewOnly: true,
} as const satisfies AgentRuntimeSafetyFlags;

export const AgentRuntimeEventKind = {
  RuntimePreviewCreated: "runtime_preview_created",
  RuntimeBoundaryReviewed: "runtime_boundary_reviewed",
  BoundaryFlagsCreated: "boundary_flags_created",
  SafetyFlagsCreated: "safety_flags_created",
  StepPreviewCreated: "step_preview_created",
  ToolCallPreviewCreated: "tool_call_preview_created",
  LlmCallPreviewCreated: "llm_call_preview_created",
  AuditPreviewCreated: "audit_preview_created",
  ErrorPreviewCreated: "error_preview_created",
  PermissionRequiredDetected: "permission_required_detected",
  ExecutionDisabledConfirmed: "execution_disabled_confirmed",
} as const;

export type AgentRuntimeEventKind =
  (typeof AgentRuntimeEventKind)[keyof typeof AgentRuntimeEventKind];

export const AgentRuntimeEventSeverity = {
  Info: "info",
  Warning: "warning",
  Blocked: "blocked",
  Error: "error",
} as const;

export type AgentRuntimeEventSeverity =
  (typeof AgentRuntimeEventSeverity)[keyof typeof AgentRuntimeEventSeverity];

export const AgentRuntimeErrorKind = {
  Validation: "validation",
  Permission: "permission",
  Boundary: "boundary",
  ToolPreview: "tool_preview",
  LlmPreview: "llm_preview",
  TimeoutPreview: "timeout_preview",
  CancellationPreview: "cancellation_preview",
  Unknown: "unknown",
} as const;

export type AgentRuntimeErrorKind =
  (typeof AgentRuntimeErrorKind)[keyof typeof AgentRuntimeErrorKind];

export const AgentRuntimeStepKind = {
  PlanReview: "plan_review",
  PermissionReview: "permission_review",
  SafetyCheck: "safety_check",
  ToolCallPreview: "tool_call_preview",
  LlmCallPreview: "llm_call_preview",
  MemoryContextPreview: "memory_context_preview",
  AuditPreview: "audit_preview",
  Summary: "summary",
} as const;

export type AgentRuntimeStepKind =
  (typeof AgentRuntimeStepKind)[keyof typeof AgentRuntimeStepKind];

export const AgentRuntimeStepStatus = {
  PreviewOnly: "preview_only",
  NotStarted: "not_started",
  WaitingForPermission: "waiting_for_permission",
  Blocked: "blocked",
  Disabled: "disabled",
} as const;

export type AgentRuntimeStepStatus =
  (typeof AgentRuntimeStepStatus)[keyof typeof AgentRuntimeStepStatus];

export const AgentRuntimeToolCallPreviewStatus = {
  PreviewOnly: "preview_only",
  NotExecuted: "not_executed",
  WaitingForPermission: "waiting_for_permission",
  Blocked: "blocked",
  Disabled: "disabled",
} as const;

export type AgentRuntimeToolCallPreviewStatus =
  (typeof AgentRuntimeToolCallPreviewStatus)[keyof typeof AgentRuntimeToolCallPreviewStatus];

export const AgentRuntimeLlmProviderKind = {
  Unknown: "unknown",
  Hosted: "hosted",
  Local: "local",
  Custom: "custom",
  Mock: "mock",
  Disabled: "disabled",
} as const;

export type AgentRuntimeLlmProviderKind =
  (typeof AgentRuntimeLlmProviderKind)[keyof typeof AgentRuntimeLlmProviderKind];

export const AgentRuntimeLlmCallPreviewStatus = {
  PreviewOnly: "preview_only",
  NotCalled: "not_called",
  WaitingForPermission: "waiting_for_permission",
  Blocked: "blocked",
  Disabled: "disabled",
} as const;

export type AgentRuntimeLlmCallPreviewStatus =
  (typeof AgentRuntimeLlmCallPreviewStatus)[keyof typeof AgentRuntimeLlmCallPreviewStatus];

export const AgentRuntimeAuditEventKind = {
  RuntimeBoundaryReviewed: "runtime_boundary_reviewed",
  PermissionBoundaryReviewed: "permission_boundary_reviewed",
  ToolCallWouldBeRequested: "tool_call_would_be_requested",
  LlmCallWouldBeRequested: "llm_call_would_be_requested",
  SafetyBlockDetected: "safety_block_detected",
  PreviewCreated: "preview_created",
} as const;

export type AgentRuntimeAuditEventKind =
  (typeof AgentRuntimeAuditEventKind)[keyof typeof AgentRuntimeAuditEventKind];

export const AgentRuntimeAuditActorKind = {
  User: "user",
  System: "system",
  AgentPreview: "agent_preview",
  RuntimePreview: "runtime_preview",
  Unknown: "unknown",
} as const;

export type AgentRuntimeAuditActorKind =
  (typeof AgentRuntimeAuditActorKind)[keyof typeof AgentRuntimeAuditActorKind];

export const AgentRuntimeAuditTargetKind = {
  RuntimePreview: "runtime_preview",
  StepPreview: "step_preview",
  ToolCallPreview: "tool_call_preview",
  LlmCallPreview: "llm_call_preview",
  PermissionPreview: "permission_preview",
  SafetyBoundary: "safety_boundary",
} as const;

export type AgentRuntimeAuditTargetKind =
  (typeof AgentRuntimeAuditTargetKind)[keyof typeof AgentRuntimeAuditTargetKind];

export interface AgentRuntimeErrorPreview {
  errorId: string;
  errorKind: AgentRuntimeErrorKind;
  title: string;
  message: string;
  severity: AgentRuntimeEventSeverity;
  recoverable: boolean;
  userVisibleSummary: string;
  disabledReason?: string;
  relatedStepId?: string;
  relatedToolCallId?: string;
  relatedLlmCallId?: string;
  createdAt?: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

/** Domain event shape for runtime preview only; it is not a DB event. */
export interface AgentRuntimeEventPreview {
  eventId: string;
  runtimeId?: string;
  eventKind: AgentRuntimeEventKind;
  lifecycleStatus: AgentRuntimeLifecycleStatus;
  executionStatus: AgentExecutionStatus;
  severity: AgentRuntimeEventSeverity;
  message: string;
  source: "runtime_preview";
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  relatedStepIds: readonly string[];
  relatedToolCallIds: readonly string[];
  relatedLlmCallIds: readonly string[];
  relatedAuditEventIds: readonly string[];
  createdAt: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimeStepPreview {
  stepId: string;
  stepIndex: number;
  title: string;
  kind: AgentRuntimeStepKind;
  status: AgentRuntimeStepStatus;
  riskLevel: AgentRuntimeRiskLevel;
  summary: string;
  plannedAction?: string;
  executable: false;
  realExecutionEnabled: false;
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  disabledReason: string;
  relatedToolCallIds: readonly string[];
  relatedLlmCallIds: readonly string[];
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimeToolCallPreview {
  toolCallId: string;
  stepId?: string;
  toolName: string;
  toolCategory?: string;
  purpose: string;
  inputSummary?: string;
  riskLevel: AgentRuntimeRiskLevel;
  status: AgentRuntimeToolCallPreviewStatus;
  requiresPermissionConfirmation: boolean;
  previewOnly: true;
  executed: false;
  executable: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  disabledReason: string;
  notExecutedReason: string;
  requestedAt?: string;
  createdAt?: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimeTokenEstimate {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AgentRuntimeLlmCallPreview {
  llmCallId: string;
  stepId?: string;
  providerKind: AgentRuntimeLlmProviderKind;
  modelLabel?: string;
  baseUrlLabel?: string;
  requestSummary: string;
  estimatedTokens?: AgentRuntimeTokenEstimate;
  status: AgentRuntimeLlmCallPreviewStatus;
  previewOnly: true;
  called: false;
  executable: false;
  realExecutionEnabled: false;
  llmCallEnabled: false;
  streamingEnabled: false;
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  disabledReason: string;
  notCalledReason: string;
  createdAt?: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimeAuditEventPreview {
  auditEventId: string;
  eventKind: AgentRuntimeAuditEventKind;
  actorKind: AgentRuntimeAuditActorKind;
  actorLabel?: string;
  targetKind: AgentRuntimeAuditTargetKind;
  targetId?: string;
  riskLevel: AgentRuntimeRiskLevel;
  riskSummary: string;
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  previewOnly: true;
  productionAuditLogWritten: false;
  sensitiveDataIncluded: false;
  createdAt: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentRuntimePreview {
  runtimeId: string;
  taskId?: string;
  userId?: string;
  taskSummary: string;
  executionStatus: AgentExecutionStatus;
  lifecycleStatus: AgentRuntimeLifecycleStatus;
  boundaryFlags: AgentRuntimeBoundaryFlags;
  safetyFlags: AgentRuntimeSafetyFlags;
  steps: readonly AgentRuntimeStepPreview[];
  toolCalls: readonly AgentRuntimeToolCallPreview[];
  llmCalls: readonly AgentRuntimeLlmCallPreview[];
  auditEvents: readonly AgentRuntimeAuditEventPreview[];
  events: readonly AgentRuntimeEventPreview[];
  errors: readonly AgentRuntimeErrorPreview[];
  createdAt: string;
  updatedAt: string;
  safetyNotes: readonly string[];
  metadata?: AgentMetadata;
}

export interface AgentInitialRuntimePreviewInput {
  runtimeId?: string;
  taskId?: string;
  userId?: string;
  taskSummary?: string;
  createdAt?: string;
  updatedAt?: string;
  safetyFlags?: AgentRuntimeSafetyFlagsPreviewInput;
  metadata?: AgentMetadata;
}

export interface AgentRuntimeEventPreviewInput {
  eventId?: string;
  runtimeId?: string;
  eventKind: AgentRuntimeEventKind;
  lifecycleStatus?: AgentRuntimeLifecycleStatus;
  executionStatus?: AgentExecutionStatus;
  severity?: AgentRuntimeEventSeverity;
  message: string;
  safetyFlags?: AgentRuntimeSafetyFlagsPreviewInput;
  relatedStepIds?: readonly string[];
  relatedToolCallIds?: readonly string[];
  relatedLlmCallIds?: readonly string[];
  relatedAuditEventIds?: readonly string[];
  createdAt?: string;
  metadata?: AgentMetadata;
}

const PREVIEW_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const RUNTIME_PREVIEW_DISABLED_REASON =
  "Agent runtime lifecycle preview is boundary-only. Real runtime, tools, LLM calls, permission confirmation, background jobs, streaming, network access, persistence, and scheduler execution are disabled.";

export function createAgentRuntimeBoundaryFlagsPreview(): AgentRuntimeBoundaryFlags {
  return { ...AGENT_RUNTIME_BOUNDARY_FLAGS_PREVIEW };
}

export function createAgentRuntimeSafetyFlagsPreview(
  input: AgentRuntimeSafetyFlagsPreviewInput = {},
): AgentRuntimeSafetyFlags {
  const hasHighRiskToolRequirement =
    input.hasHighRiskToolRequirement ??
    isHighOrCriticalRisk(input.overallRiskLevel);
  const hasExternalSideEffectRisk =
    input.hasExternalSideEffectRisk ?? false;
  const hasCredentialAccessRisk = input.hasCredentialAccessRisk ?? false;

  return {
    requiresPermissionConfirmation:
      input.requiresPermissionConfirmation ??
      (hasHighRiskToolRequirement ||
        hasExternalSideEffectRisk ||
        hasCredentialAccessRisk),
    requiresHumanReview: input.requiresHumanReview ?? true,
    hasHighRiskToolRequirement,
    hasExternalSideEffectRisk,
    hasCredentialAccessRisk,
    isPreviewOnly: true,
  };
}

export function createAgentRuntimeEventPreview(
  input: AgentRuntimeEventPreviewInput,
): AgentRuntimeEventPreview {
  const boundaryFlags = createAgentRuntimeBoundaryFlagsPreview();
  const safetyFlags = createAgentRuntimeSafetyFlagsPreview(input.safetyFlags);
  const createdAt = input.createdAt ?? PREVIEW_TIMESTAMP;

  return {
    eventId:
      input.eventId ??
      createEventId({
        eventKind: input.eventKind,
        message: input.message,
        runtimeId: input.runtimeId,
        createdAt,
      }),
    runtimeId: input.runtimeId,
    eventKind: input.eventKind,
    lifecycleStatus:
      input.lifecycleStatus ?? AgentRuntimeLifecycleStatus.PreviewOnly,
    executionStatus: input.executionStatus ?? AgentExecutionStatus.PreviewReady,
    severity: input.severity ?? AgentRuntimeEventSeverity.Info,
    message: input.message,
    source: "runtime_preview",
    boundaryFlags,
    safetyFlags,
    relatedStepIds: normalizeUniqueStrings(input.relatedStepIds ?? []),
    relatedToolCallIds: normalizeUniqueStrings(
      input.relatedToolCallIds ?? [],
    ),
    relatedLlmCallIds: normalizeUniqueStrings(input.relatedLlmCallIds ?? []),
    relatedAuditEventIds: normalizeUniqueStrings(
      input.relatedAuditEventIds ?? [],
    ),
    createdAt,
    safetyNotes: createRuntimePreviewSafetyNotes(),
    metadata: input.metadata,
  };
}

export function createInitialAgentRuntimePreview(
  input: AgentInitialRuntimePreviewInput = {},
): AgentRuntimePreview {
  const createdAt = input.createdAt ?? PREVIEW_TIMESTAMP;
  const runtimeId =
    input.runtimeId ??
    createRuntimeId({
      taskId: input.taskId,
      userId: input.userId,
      taskSummary: input.taskSummary,
      createdAt,
    });
  const boundaryFlags = createAgentRuntimeBoundaryFlagsPreview();
  const safetyFlags = createAgentRuntimeSafetyFlagsPreview(input.safetyFlags);
  const initialEvent = createAgentRuntimeEventPreview({
    runtimeId,
    eventKind: AgentRuntimeEventKind.RuntimePreviewCreated,
    lifecycleStatus: AgentRuntimeLifecycleStatus.PreviewOnly,
    executionStatus: AgentExecutionStatus.PreviewReady,
    message:
      "Initial Agent runtime lifecycle preview was created. Real execution remains disabled.",
    createdAt,
    safetyFlags: input.safetyFlags,
  });

  return {
    runtimeId,
    taskId: input.taskId,
    userId: input.userId,
    taskSummary:
      input.taskSummary ??
      "Agent runtime lifecycle preview is available for future review.",
    executionStatus: AgentExecutionStatus.PreviewReady,
    lifecycleStatus: AgentRuntimeLifecycleStatus.PreviewOnly,
    boundaryFlags,
    safetyFlags,
    steps: [],
    toolCalls: [],
    llmCalls: [],
    auditEvents: [],
    events: [initialEvent],
    errors: [],
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    safetyNotes: createRuntimePreviewSafetyNotes(),
    metadata: input.metadata,
  };
}

function createRuntimePreviewSafetyNotes(): string[] {
  return [
    "Agent runtime lifecycle output is preview-only.",
    "No Agent runtime was started.",
    "No Agent loop was executed.",
    "No tools were executed.",
    "No LLM was called.",
    "No permission confirmation was captured.",
    "No background job or scheduler was started.",
    "No streaming was enabled.",
    "No network request was made.",
    "No persistence write was performed by ai-core.",
    RUNTIME_PREVIEW_DISABLED_REASON,
  ];
}

function isHighOrCriticalRisk(
  riskLevel: AgentRuntimeRiskLevel | undefined,
): boolean {
  return (
    riskLevel === AutonomyRiskLevel.High ||
    riskLevel === AutonomyRiskLevel.Critical
  );
}

function createRuntimeId(input: {
  readonly taskId: string | undefined;
  readonly userId: string | undefined;
  readonly taskSummary: string | undefined;
  readonly createdAt: string;
}): string {
  return `runtime_preview_${hashString(
    [
      input.taskId ?? "",
      input.userId ?? "",
      input.taskSummary ?? "",
      input.createdAt,
    ].join("|"),
  )}`;
}

function createEventId(input: {
  readonly eventKind: AgentRuntimeEventKind;
  readonly message: string;
  readonly runtimeId: string | undefined;
  readonly createdAt: string;
}): string {
  return `runtime_event_preview_${hashString(
    [
      input.runtimeId ?? "",
      input.eventKind,
      input.message,
      input.createdAt,
    ].join("|"),
  )}`;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
