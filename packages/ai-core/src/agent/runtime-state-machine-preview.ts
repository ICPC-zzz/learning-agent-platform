import {
  AgentExecutionStatus,
  AgentRuntimeAuditActorKind,
  AgentRuntimeAuditEventKind,
  AgentRuntimeAuditTargetKind,
  AgentRuntimeEventKind,
  AgentRuntimeEventSeverity,
  AgentRuntimeLifecycleStatus,
  AgentRuntimeRiskLevel,
  createAgentRuntimeBoundaryFlagsPreview,
  createAgentRuntimeEventPreview,
  type AgentExecutionStatus as AgentExecutionStatusValue,
  type AgentRuntimeAuditActorKind as AgentRuntimeAuditActorKindValue,
  type AgentRuntimeAuditEventPreview,
  type AgentRuntimeEventPreview,
  type AgentRuntimeLifecycleStatus as AgentRuntimeLifecycleStatusValue,
  type AgentRuntimePreview,
  type AgentRuntimeSafetyFlags,
} from "./runtime-lifecycle-preview";

export const AgentRuntimeTransitionAction = {
  PreparePreview: "prepare_preview",
  RequestPermissionPreview: "request_permission_preview",
  MarkPermissionWaitingPreview: "mark_permission_waiting_preview",
  QueuePreview: "queue_preview",
  StartPreview: "start_preview",
  PausePreview: "pause_preview",
  ResumePreview: "resume_preview",
  RequestCancelPreview: "request_cancel_preview",
  CancelPreview: "cancel_preview",
  FailPreview: "fail_preview",
  CompletePreview: "complete_preview",
  ResetPreview: "reset_preview",
} as const;

export type AgentRuntimeTransitionAction =
  (typeof AgentRuntimeTransitionAction)[keyof typeof AgentRuntimeTransitionAction];

export const AgentRuntimeTransitionBlockReason = {
  RuntimeIsPreviewOnly: "runtime_is_preview_only",
  RealExecutionDisabled: "real_execution_disabled",
  ToolExecutionDisabled: "tool_execution_disabled",
  LlmCallDisabled: "llm_call_disabled",
  PermissionConfirmationDisabled: "permission_confirmation_disabled",
  PermissionRequired: "permission_required",
  HumanReviewRequired: "human_review_required",
  HighRiskToolRequirement: "high_risk_tool_requirement",
  ExternalSideEffectRisk: "external_side_effect_risk",
  InvalidStatusTransition: "invalid_status_transition",
  TerminalStatus: "terminal_status",
  MissingRuntime: "missing_runtime",
  UnknownAction: "unknown_action",
} as const;

export type AgentRuntimeTransitionBlockReason =
  (typeof AgentRuntimeTransitionBlockReason)[keyof typeof AgentRuntimeTransitionBlockReason];

export interface AgentRuntimeTransitionCheckInput {
  runtime?: AgentRuntimePreview;
  action: AgentRuntimeTransitionAction;
  allowPreviewOnlyTransition?: boolean;
}

export interface AgentRuntimeTransitionCheckResult {
  ok: boolean;
  action: AgentRuntimeTransitionAction;
  fromStatus?: AgentExecutionStatusValue;
  toStatus?: AgentExecutionStatusValue;
  blockedReasons: readonly AgentRuntimeTransitionBlockReason[];
  message: string;
}

export interface AgentRuntimeTransitionInput {
  runtime: AgentRuntimePreview;
  action: AgentRuntimeTransitionAction;
  now?: string;
  reason?: string;
  actorKind?: AgentRuntimeAuditActorKindValue;
  allowPreviewOnlyTransition?: boolean;
}

export interface AgentRuntimeTransitionResult {
  ok: boolean;
  runtime: AgentRuntimePreview;
  fromStatus: AgentExecutionStatusValue;
  toStatus?: AgentExecutionStatusValue;
  action: AgentRuntimeTransitionAction;
  blockedReasons: readonly AgentRuntimeTransitionBlockReason[];
  event?: AgentRuntimeEventPreview;
  auditEvent?: AgentRuntimeAuditEventPreview;
  message?: string;
}

export interface AgentRuntimeTransitionEventPreviewInput {
  runtime: AgentRuntimePreview;
  action: AgentRuntimeTransitionAction;
  fromStatus: AgentExecutionStatusValue;
  toStatus: AgentExecutionStatusValue;
  now?: string;
  reason?: string;
  relatedAuditEventIds?: readonly string[];
}

export interface AgentRuntimeTransitionAuditPreviewInput {
  runtime: AgentRuntimePreview;
  action: AgentRuntimeTransitionAction;
  fromStatus: AgentExecutionStatusValue;
  toStatus?: AgentExecutionStatusValue;
  blockedReasons?: readonly AgentRuntimeTransitionBlockReason[];
  now?: string;
  reason?: string;
  actorKind?: AgentRuntimeAuditActorKindValue;
}

const PREVIEW_TIMESTAMP = "1970-01-01T00:00:00.000Z";

const ALL_EXECUTION_STATUSES = [
  AgentExecutionStatus.Draft,
  AgentExecutionStatus.PreviewReady,
  AgentExecutionStatus.WaitingForPermission,
  AgentExecutionStatus.Queued,
  AgentExecutionStatus.Running,
  AgentExecutionStatus.Paused,
  AgentExecutionStatus.Cancelling,
  AgentExecutionStatus.Cancelled,
  AgentExecutionStatus.Failed,
  AgentExecutionStatus.Completed,
  AgentExecutionStatus.Blocked,
  AgentExecutionStatus.TimedOut,
] as const satisfies readonly AgentExecutionStatusValue[];

const TERMINAL_EXECUTION_STATUSES = [
  AgentExecutionStatus.Cancelled,
  AgentExecutionStatus.Failed,
  AgentExecutionStatus.Completed,
  AgentExecutionStatus.Blocked,
  AgentExecutionStatus.TimedOut,
] as const satisfies readonly AgentExecutionStatusValue[];

const TRANSITION_SOURCE_STATUSES = {
  [AgentRuntimeTransitionAction.PreparePreview]: [AgentExecutionStatus.Draft],
  [AgentRuntimeTransitionAction.RequestPermissionPreview]: [
    AgentExecutionStatus.PreviewReady,
  ],
  [AgentRuntimeTransitionAction.MarkPermissionWaitingPreview]: [
    AgentExecutionStatus.PreviewReady,
  ],
  [AgentRuntimeTransitionAction.QueuePreview]: [
    AgentExecutionStatus.PreviewReady,
    AgentExecutionStatus.WaitingForPermission,
  ],
  [AgentRuntimeTransitionAction.StartPreview]: [AgentExecutionStatus.Queued],
  [AgentRuntimeTransitionAction.PausePreview]: [AgentExecutionStatus.Running],
  [AgentRuntimeTransitionAction.ResumePreview]: [AgentExecutionStatus.Paused],
  [AgentRuntimeTransitionAction.RequestCancelPreview]: [
    AgentExecutionStatus.Queued,
    AgentExecutionStatus.Running,
    AgentExecutionStatus.Paused,
  ],
  [AgentRuntimeTransitionAction.CancelPreview]: [
    AgentExecutionStatus.Cancelling,
  ],
  [AgentRuntimeTransitionAction.FailPreview]: [
    AgentExecutionStatus.PreviewReady,
    AgentExecutionStatus.WaitingForPermission,
    AgentExecutionStatus.Queued,
    AgentExecutionStatus.Running,
    AgentExecutionStatus.Paused,
  ],
  [AgentRuntimeTransitionAction.CompletePreview]: [
    AgentExecutionStatus.Running,
  ],
  [AgentRuntimeTransitionAction.ResetPreview]: ALL_EXECUTION_STATUSES,
} as const satisfies Record<
  AgentRuntimeTransitionAction,
  readonly AgentExecutionStatusValue[]
>;

const TRANSITION_TARGET_STATUS = {
  [AgentRuntimeTransitionAction.PreparePreview]:
    AgentExecutionStatus.PreviewReady,
  [AgentRuntimeTransitionAction.RequestPermissionPreview]:
    AgentExecutionStatus.WaitingForPermission,
  [AgentRuntimeTransitionAction.MarkPermissionWaitingPreview]:
    AgentExecutionStatus.WaitingForPermission,
  [AgentRuntimeTransitionAction.QueuePreview]: AgentExecutionStatus.Queued,
  [AgentRuntimeTransitionAction.StartPreview]: AgentExecutionStatus.Running,
  [AgentRuntimeTransitionAction.PausePreview]: AgentExecutionStatus.Paused,
  [AgentRuntimeTransitionAction.ResumePreview]: AgentExecutionStatus.Running,
  [AgentRuntimeTransitionAction.RequestCancelPreview]:
    AgentExecutionStatus.Cancelling,
  [AgentRuntimeTransitionAction.CancelPreview]: AgentExecutionStatus.Cancelled,
  [AgentRuntimeTransitionAction.FailPreview]: AgentExecutionStatus.Failed,
  [AgentRuntimeTransitionAction.CompletePreview]: AgentExecutionStatus.Completed,
  [AgentRuntimeTransitionAction.ResetPreview]: AgentExecutionStatus.Draft,
} as const satisfies Record<
  AgentRuntimeTransitionAction,
  AgentExecutionStatusValue
>;

export function canTransitionAgentRuntimePreview(
  input: AgentRuntimeTransitionCheckInput,
): AgentRuntimeTransitionCheckResult {
  const { runtime, action } = input;

  if (runtime === undefined) {
    return {
      ok: false,
      action,
      blockedReasons: [AgentRuntimeTransitionBlockReason.MissingRuntime],
      message: "Agent runtime transition preview was blocked because the runtime preview is missing.",
    };
  }

  const fromStatus = runtime.executionStatus;

  if (!isAgentRuntimeTransitionAction(action)) {
    return createBlockedCheckResult({
      action,
      fromStatus,
      blockedReasons: [AgentRuntimeTransitionBlockReason.UnknownAction],
    });
  }

  const previewBoundaryBlockReasons =
    getPreviewBoundaryBlockReasons(runtime);

  if (previewBoundaryBlockReasons.length > 0) {
    return createBlockedCheckResult({
      action,
      fromStatus,
      blockedReasons: previewBoundaryBlockReasons,
    });
  }

  if (
    isTerminalExecutionStatus(fromStatus) &&
    action !== AgentRuntimeTransitionAction.ResetPreview
  ) {
    return createBlockedCheckResult({
      action,
      fromStatus,
      blockedReasons: [AgentRuntimeTransitionBlockReason.TerminalStatus],
    });
  }

  const allowedSourceStatuses: readonly AgentExecutionStatusValue[] =
    TRANSITION_SOURCE_STATUSES[action];

  if (!allowedSourceStatuses.includes(fromStatus)) {
    return createBlockedCheckResult({
      action,
      fromStatus,
      blockedReasons: [
        AgentRuntimeTransitionBlockReason.InvalidStatusTransition,
      ],
    });
  }

  const safetyBlockReasons = getSafetyBlockReasons({
    runtime,
    action,
    fromStatus,
    allowPreviewOnlyTransition:
      input.allowPreviewOnlyTransition === true,
  });

  if (safetyBlockReasons.length > 0) {
    return createBlockedCheckResult({
      action,
      fromStatus,
      blockedReasons: safetyBlockReasons,
    });
  }

  const toStatus = TRANSITION_TARGET_STATUS[action];

  return {
    ok: true,
    action,
    fromStatus,
    toStatus,
    blockedReasons: [],
    message: createAllowedTransitionMessage({
      action,
      fromStatus,
      toStatus,
      allowPreviewOnlyTransition:
        input.allowPreviewOnlyTransition === true,
      reasonProvided: false,
    }),
  };
}

export function transitionAgentRuntimePreview(
  input: AgentRuntimeTransitionInput,
): AgentRuntimeTransitionResult {
  const { runtime, action } = input;
  const fromStatus = runtime.executionStatus;
  const check = canTransitionAgentRuntimePreview({
    runtime,
    action,
    allowPreviewOnlyTransition: input.allowPreviewOnlyTransition,
  });
  const now = input.now ?? runtime.updatedAt ?? runtime.createdAt ?? PREVIEW_TIMESTAMP;
  const reasonProvided =
    input.reason !== undefined && input.reason.trim().length > 0;

  if (!check.ok || check.toStatus === undefined) {
    const auditEvent = createAgentRuntimeTransitionAuditPreview({
      runtime,
      action,
      fromStatus,
      blockedReasons: check.blockedReasons,
      now,
      reason: input.reason,
      actorKind: input.actorKind,
    });

    return {
      ok: false,
      runtime,
      fromStatus,
      action,
      blockedReasons: check.blockedReasons,
      auditEvent,
      message: check.message,
    };
  }

  const toStatus = check.toStatus;
  const auditEvent = createAgentRuntimeTransitionAuditPreview({
    runtime,
    action,
    fromStatus,
    toStatus,
    now,
    reason: input.reason,
    actorKind: input.actorKind,
  });
  const event = createAgentRuntimeTransitionEventPreview({
    runtime,
    action,
    fromStatus,
    toStatus,
    now,
    reason: input.reason,
    relatedAuditEventIds: [auditEvent.auditEventId],
  });
  const message = createAllowedTransitionMessage({
    action,
    fromStatus,
    toStatus,
    allowPreviewOnlyTransition: input.allowPreviewOnlyTransition === true,
    reasonProvided,
  });
  const nextRuntime: AgentRuntimePreview = {
    ...runtime,
    executionStatus: toStatus,
    lifecycleStatus: toLifecycleStatus(toStatus),
    boundaryFlags: createAgentRuntimeBoundaryFlagsPreview(),
    safetyFlags: normalizeRuntimeSafetyFlags(runtime.safetyFlags),
    auditEvents: [...runtime.auditEvents, auditEvent],
    events: [...runtime.events, event],
    updatedAt: now,
    safetyNotes: mergeSafetyNotes(runtime.safetyNotes, [
      "Agent runtime state machine transition is preview-only.",
      "No real Agent runtime was started or advanced.",
      "No tools were executed.",
      "No LLM was called.",
      "No permission confirmation was captured.",
    ]),
  };

  return {
    ok: true,
    runtime: nextRuntime,
    fromStatus,
    toStatus,
    action,
    blockedReasons: [],
    event,
    auditEvent,
    message,
  };
}

export function createAgentRuntimeTransitionEventPreview(
  input: AgentRuntimeTransitionEventPreviewInput,
): AgentRuntimeEventPreview {
  const now =
    input.now ??
    input.runtime.updatedAt ??
    input.runtime.createdAt ??
    PREVIEW_TIMESTAMP;
  const reasonProvided =
    input.reason !== undefined && input.reason.trim().length > 0;

  return createAgentRuntimeEventPreview({
    runtimeId: input.runtime.runtimeId,
    eventId: createTransitionEventId({
      runtimeId: input.runtime.runtimeId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      createdAt: now,
    }),
    eventKind: toRuntimeEventKind(input.action),
    lifecycleStatus: toLifecycleStatus(input.toStatus),
    executionStatus: input.toStatus,
    severity: toRuntimeEventSeverity(input.action),
    message: createTransitionEventMessage({
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reasonProvided,
    }),
    safetyFlags: input.runtime.safetyFlags,
    relatedAuditEventIds: input.relatedAuditEventIds,
    createdAt: now,
    metadata: {
      transitionAction: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reasonProvided,
      previewOnly: true,
      realExecutionOccurred: false,
    },
  });
}

export function createAgentRuntimeTransitionAuditPreview(
  input: AgentRuntimeTransitionAuditPreviewInput,
): AgentRuntimeAuditEventPreview {
  const now =
    input.now ??
    input.runtime.updatedAt ??
    input.runtime.createdAt ??
    PREVIEW_TIMESTAMP;
  const blockedReasons = normalizeUniqueStrings(input.blockedReasons ?? []);
  const reasonProvided =
    input.reason !== undefined && input.reason.trim().length > 0;
  const safetyFlags = normalizeRuntimeSafetyFlags(input.runtime.safetyFlags);
  const boundaryFlags = createAgentRuntimeBoundaryFlagsPreview();

  return {
    auditEventId: createTransitionAuditEventId({
      runtimeId: input.runtime.runtimeId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      blockedReasons,
      createdAt: now,
    }),
    eventKind:
      blockedReasons.length > 0
        ? AgentRuntimeAuditEventKind.SafetyBlockDetected
        : toRuntimeAuditEventKind(input.action),
    actorKind: input.actorKind ?? AgentRuntimeAuditActorKind.RuntimePreview,
    targetKind: AgentRuntimeAuditTargetKind.RuntimePreview,
    targetId: input.runtime.runtimeId,
    riskLevel: inferRuntimeRiskLevel(safetyFlags, blockedReasons),
    riskSummary: createAuditRiskSummary({
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      blockedReasons,
      reasonProvided,
    }),
    boundaryFlags,
    safetyFlags,
    previewOnly: true,
    productionAuditLogWritten: false,
    sensitiveDataIncluded: false,
    createdAt: now,
    safetyNotes: createTransitionAuditSafetyNotes(blockedReasons),
    metadata: {
      transitionAction: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus ?? null,
      blockedReasons,
      reasonProvided,
      previewOnly: true,
      realExecutionOccurred: false,
      toolExecutionOccurred: false,
      llmCallOccurred: false,
      permissionConfirmationCaptured: false,
    },
  };
}

function createBlockedCheckResult(input: {
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly blockedReasons: readonly AgentRuntimeTransitionBlockReason[];
}): AgentRuntimeTransitionCheckResult {
  return {
    ok: false,
    action: input.action,
    fromStatus: input.fromStatus,
    blockedReasons: normalizeBlockReasons(input.blockedReasons),
    message: createBlockedTransitionMessage({
      action: input.action,
      fromStatus: input.fromStatus,
      blockedReasons: input.blockedReasons,
    }),
  };
}

function getPreviewBoundaryBlockReasons(
  runtime: AgentRuntimePreview,
): AgentRuntimeTransitionBlockReason[] {
  const boundaryFlags = runtime.boundaryFlags;

  if (
    runtime.safetyFlags.isPreviewOnly !== true ||
    boundaryFlags.executable !== false ||
    boundaryFlags.realExecutionEnabled !== false ||
    boundaryFlags.toolExecutionEnabled !== false ||
    boundaryFlags.llmCallEnabled !== false ||
    boundaryFlags.permissionConfirmationEnabled !== false ||
    boundaryFlags.backgroundJobEnabled !== false ||
    boundaryFlags.streamingEnabled !== false ||
    boundaryFlags.schedulerEnabled !== false ||
    boundaryFlags.skillExecutionEnabled !== false ||
    boundaryFlags.memoryRetrievalEnabled !== false ||
    boundaryFlags.networkAccessEnabled !== false ||
    boundaryFlags.previewPersistenceOnly !== true
  ) {
    return [AgentRuntimeTransitionBlockReason.RuntimeIsPreviewOnly];
  }

  return [];
}

function getSafetyBlockReasons(input: {
  readonly runtime: AgentRuntimePreview;
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly allowPreviewOnlyTransition: boolean;
}): AgentRuntimeTransitionBlockReason[] {
  const safetyFlags = input.runtime.safetyFlags;

  if (
    input.action === AgentRuntimeTransitionAction.RequestPermissionPreview ||
    input.action === AgentRuntimeTransitionAction.MarkPermissionWaitingPreview
  ) {
    if (
      safetyFlags.requiresPermissionConfirmation ||
      safetyFlags.requiresHumanReview
    ) {
      return [];
    }

    return [AgentRuntimeTransitionBlockReason.InvalidStatusTransition];
  }

  if (
    input.action === AgentRuntimeTransitionAction.QueuePreview &&
    input.fromStatus === AgentExecutionStatus.WaitingForPermission &&
    !input.allowPreviewOnlyTransition
  ) {
    return [
      AgentRuntimeTransitionBlockReason.PermissionConfirmationDisabled,
    ];
  }

  if (
    input.action !== AgentRuntimeTransitionAction.QueuePreview ||
    input.fromStatus !== AgentExecutionStatus.PreviewReady
  ) {
    return [];
  }

  return normalizeBlockReasons([
    ...(safetyFlags.requiresPermissionConfirmation
      ? [AgentRuntimeTransitionBlockReason.PermissionRequired]
      : []),
    ...(safetyFlags.requiresHumanReview
      ? [AgentRuntimeTransitionBlockReason.HumanReviewRequired]
      : []),
    ...(safetyFlags.hasHighRiskToolRequirement
      ? [AgentRuntimeTransitionBlockReason.HighRiskToolRequirement]
      : []),
    ...(safetyFlags.hasExternalSideEffectRisk
      ? [AgentRuntimeTransitionBlockReason.ExternalSideEffectRisk]
      : []),
  ]);
}

function createAllowedTransitionMessage(input: {
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly toStatus: AgentExecutionStatusValue;
  readonly allowPreviewOnlyTransition: boolean;
  readonly reasonProvided: boolean;
}): string {
  const notes = [
    `Agent runtime preview transition ${input.action} moved ${input.fromStatus} to ${input.toStatus}.`,
    "This is preview-only; no real Agent runtime was started.",
  ];

  if (
    input.action === AgentRuntimeTransitionAction.StartPreview ||
    input.action === AgentRuntimeTransitionAction.CompletePreview
  ) {
    notes.push("No tools were executed and no LLM was called.");
  }

  if (
    input.action === AgentRuntimeTransitionAction.QueuePreview &&
    input.fromStatus === AgentExecutionStatus.WaitingForPermission &&
    input.allowPreviewOnlyTransition
  ) {
    notes.push("No real permission confirmation was captured.");
  }

  if (input.action === AgentRuntimeTransitionAction.ResetPreview) {
    notes.push("The preview state was reset without replaying or rerunning work.");
  }

  if (input.reasonProvided) {
    notes.push("A caller reason was provided but is not recorded in preview audit text.");
  }

  return notes.join(" ");
}

function createBlockedTransitionMessage(input: {
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly blockedReasons: readonly AgentRuntimeTransitionBlockReason[];
}): string {
  return [
    `Agent runtime preview transition ${input.action} from ${input.fromStatus} was blocked.`,
    `Reasons: ${normalizeBlockReasons(input.blockedReasons).join(", ")}.`,
    "No runtime status was changed and no real execution occurred.",
  ].join(" ");
}

function createTransitionEventMessage(input: {
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly toStatus: AgentExecutionStatusValue;
  readonly reasonProvided: boolean;
}): string {
  return createAllowedTransitionMessage({
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    allowPreviewOnlyTransition: false,
    reasonProvided: input.reasonProvided,
  });
}

function createAuditRiskSummary(input: {
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly toStatus: AgentExecutionStatusValue | undefined;
  readonly blockedReasons: readonly string[];
  readonly reasonProvided: boolean;
}): string {
  if (input.blockedReasons.length > 0) {
    return [
      `Preview transition ${input.action} was blocked before changing ${input.fromStatus}.`,
      `Blocked reasons: ${input.blockedReasons.join(", ")}.`,
      "No real execution, tool call, LLM call, or permission confirmation occurred.",
    ].join(" ");
  }

  return [
    `Preview transition ${input.action} moved ${input.fromStatus} to ${input.toStatus}.`,
    "The audit entry is preview-only and not a production audit log.",
    input.reasonProvided
      ? "A caller reason was provided but the reason text is not stored here."
      : "No caller reason text is stored here.",
  ].join(" ");
}

function createTransitionAuditSafetyNotes(
  blockedReasons: readonly string[],
): string[] {
  return [
    "Agent runtime state machine output is preview-only.",
    "No production audit log was written.",
    "No sensitive prompt, secret, API key, or raw tool payload is included.",
    "No real Agent runtime was started.",
    "No tools were executed.",
    "No LLM was called.",
    "No permission confirmation was captured.",
    ...(blockedReasons.length > 0
      ? ["The attempted preview transition was blocked before runtime mutation."]
      : []),
  ];
}

function toLifecycleStatus(
  status: AgentExecutionStatusValue,
): AgentRuntimeLifecycleStatusValue {
  switch (status) {
    case AgentExecutionStatus.Draft:
      return AgentRuntimeLifecycleStatus.PreviewOnly;
    case AgentExecutionStatus.PreviewReady:
      return AgentRuntimeLifecycleStatus.BoundaryDefined;
    case AgentExecutionStatus.WaitingForPermission:
      return AgentRuntimeLifecycleStatus.PendingPermission;
    case AgentExecutionStatus.Queued:
      return AgentRuntimeLifecycleStatus.Queued;
    case AgentExecutionStatus.Running:
      return AgentRuntimeLifecycleStatus.Running;
    case AgentExecutionStatus.Paused:
      return AgentRuntimeLifecycleStatus.Paused;
    case AgentExecutionStatus.Cancelling:
      return AgentRuntimeLifecycleStatus.Cancelling;
    case AgentExecutionStatus.Cancelled:
      return AgentRuntimeLifecycleStatus.Cancelled;
    case AgentExecutionStatus.Failed:
      return AgentRuntimeLifecycleStatus.Failed;
    case AgentExecutionStatus.Completed:
      return AgentRuntimeLifecycleStatus.Completed;
    case AgentExecutionStatus.Blocked:
      return AgentRuntimeLifecycleStatus.Blocked;
    case AgentExecutionStatus.TimedOut:
      return AgentRuntimeLifecycleStatus.TimedOut;
  }
}

function toRuntimeEventKind(
  action: AgentRuntimeTransitionAction,
): AgentRuntimeEventKind {
  if (
    action === AgentRuntimeTransitionAction.RequestPermissionPreview ||
    action === AgentRuntimeTransitionAction.MarkPermissionWaitingPreview
  ) {
    return AgentRuntimeEventKind.PermissionRequiredDetected;
  }

  if (
    action === AgentRuntimeTransitionAction.StartPreview ||
    action === AgentRuntimeTransitionAction.CompletePreview
  ) {
    return AgentRuntimeEventKind.ExecutionDisabledConfirmed;
  }

  return AgentRuntimeEventKind.RuntimeBoundaryReviewed;
}

function toRuntimeAuditEventKind(
  action: AgentRuntimeTransitionAction,
): AgentRuntimeAuditEventKind {
  if (
    action === AgentRuntimeTransitionAction.RequestPermissionPreview ||
    action === AgentRuntimeTransitionAction.MarkPermissionWaitingPreview ||
    action === AgentRuntimeTransitionAction.QueuePreview
  ) {
    return AgentRuntimeAuditEventKind.PermissionBoundaryReviewed;
  }

  return AgentRuntimeAuditEventKind.RuntimeBoundaryReviewed;
}

function toRuntimeEventSeverity(
  action: AgentRuntimeTransitionAction,
): AgentRuntimeEventSeverity {
  if (
    action === AgentRuntimeTransitionAction.FailPreview ||
    action === AgentRuntimeTransitionAction.CancelPreview
  ) {
    return AgentRuntimeEventSeverity.Warning;
  }

  return AgentRuntimeEventSeverity.Info;
}

function inferRuntimeRiskLevel(
  safetyFlags: AgentRuntimeSafetyFlags,
  blockedReasons: readonly string[],
): AgentRuntimeRiskLevel {
  if (
    blockedReasons.includes(
      AgentRuntimeTransitionBlockReason.HighRiskToolRequirement,
    ) ||
    safetyFlags.hasCredentialAccessRisk
  ) {
    return AgentRuntimeRiskLevel.High;
  }

  if (
    blockedReasons.length > 0 ||
    safetyFlags.requiresPermissionConfirmation ||
    safetyFlags.requiresHumanReview ||
    safetyFlags.hasExternalSideEffectRisk
  ) {
    return AgentRuntimeRiskLevel.Medium;
  }

  return AgentRuntimeRiskLevel.Low;
}

function isTerminalExecutionStatus(
  status: AgentExecutionStatusValue,
): boolean {
  return (
    TERMINAL_EXECUTION_STATUSES as readonly AgentExecutionStatusValue[]
  ).includes(status);
}

function isAgentRuntimeTransitionAction(
  action: AgentRuntimeTransitionAction,
): action is AgentRuntimeTransitionAction {
  return Object.values(AgentRuntimeTransitionAction).includes(action);
}

function normalizeRuntimeSafetyFlags(
  safetyFlags: AgentRuntimeSafetyFlags,
): AgentRuntimeSafetyFlags {
  return {
    requiresPermissionConfirmation:
      safetyFlags.requiresPermissionConfirmation,
    requiresHumanReview: safetyFlags.requiresHumanReview,
    hasHighRiskToolRequirement: safetyFlags.hasHighRiskToolRequirement,
    hasExternalSideEffectRisk: safetyFlags.hasExternalSideEffectRisk,
    hasCredentialAccessRisk: safetyFlags.hasCredentialAccessRisk,
    isPreviewOnly: true,
  };
}

function normalizeBlockReasons(
  values: readonly AgentRuntimeTransitionBlockReason[],
): AgentRuntimeTransitionBlockReason[] {
  return normalizeUniqueStrings(values) as AgentRuntimeTransitionBlockReason[];
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

function mergeSafetyNotes(
  currentNotes: readonly string[],
  nextNotes: readonly string[],
): string[] {
  return normalizeUniqueStrings([...currentNotes, ...nextNotes]);
}

function createTransitionEventId(input: {
  readonly runtimeId: string;
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly toStatus: AgentExecutionStatusValue;
  readonly createdAt: string;
}): string {
  return `runtime_transition_event_preview_${hashString(
    [
      input.runtimeId,
      input.action,
      input.fromStatus,
      input.toStatus,
      input.createdAt,
    ].join("|"),
  )}`;
}

function createTransitionAuditEventId(input: {
  readonly runtimeId: string;
  readonly action: AgentRuntimeTransitionAction;
  readonly fromStatus: AgentExecutionStatusValue;
  readonly toStatus: AgentExecutionStatusValue | undefined;
  readonly blockedReasons: readonly string[];
  readonly createdAt: string;
}): string {
  return `runtime_transition_audit_preview_${hashString(
    [
      input.runtimeId,
      input.action,
      input.fromStatus,
      input.toStatus ?? "",
      input.blockedReasons.join(","),
      input.createdAt,
    ].join("|"),
  )}`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash.toString(36).padStart(7, "0");
}
