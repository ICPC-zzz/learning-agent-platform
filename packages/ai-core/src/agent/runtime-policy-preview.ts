import {
  AgentExecutionStatus,
  AgentRuntimeRiskLevel,
  type AgentExecutionStatus as AgentExecutionStatusValue,
  type AgentRuntimeLifecycleStatus as AgentRuntimeLifecycleStatusValue,
  type AgentRuntimeRiskLevel as AgentRuntimeRiskLevelValue,
} from "./runtime-lifecycle-preview";
import type { AgentMetadata } from "./types";

type PolicyJsonPrimitive = string | number | boolean | null;
type PolicyJsonValue =
  | PolicyJsonPrimitive
  | { readonly [key: string]: PolicyJsonValue }
  | readonly PolicyJsonValue[];

export const AgentRuntimeAuditEventKindPreview = {
  RuntimePreviewCreated: "runtime_preview_created",
  RuntimeStatusTransitionPreviewed:
    "runtime_status_transition_previewed",
  RuntimeStepPreviewed: "runtime_step_previewed",
  RuntimeToolCallPreviewed: "runtime_tool_call_previewed",
  RuntimeLlmCallPreviewed: "runtime_llm_call_previewed",
  RuntimePermissionRequiredPreviewed:
    "runtime_permission_required_previewed",
  RuntimeSandboxBlockPreviewed: "runtime_sandbox_block_previewed",
  RuntimeCancellationRequestedPreviewed:
    "runtime_cancellation_requested_previewed",
  RuntimeTimeoutRiskPreviewed: "runtime_timeout_risk_previewed",
  RuntimeRetryRecommendedPreviewed:
    "runtime_retry_recommended_previewed",
  RuntimeRetryBlockedPreviewed: "runtime_retry_blocked_previewed",
  RuntimeErrorPreviewed: "runtime_error_previewed",
  RuntimeCompletedPreviewed: "runtime_completed_previewed",
  RuntimeFailedPreviewed: "runtime_failed_previewed",
  RuntimeCancelledPreviewed: "runtime_cancelled_previewed",
} as const;

export type AgentRuntimeAuditEventKindPreview =
  (typeof AgentRuntimeAuditEventKindPreview)[keyof typeof AgentRuntimeAuditEventKindPreview];

export const AgentRuntimePolicyActorKindPreview = {
  User: "user",
  System: "system",
  AgentPreview: "agent_preview",
  RuntimePreview: "runtime_preview",
  Unknown: "unknown",
} as const;

export type AgentRuntimePolicyActorKindPreview =
  (typeof AgentRuntimePolicyActorKindPreview)[keyof typeof AgentRuntimePolicyActorKindPreview];

export const AgentRuntimePolicyTargetKindPreview = {
  RuntimePreview: "runtime_preview",
  TaskPreview: "task_preview",
  StepPreview: "step_preview",
  ToolCallPreview: "tool_call_preview",
  LlmCallPreview: "llm_call_preview",
  PermissionPreview: "permission_preview",
  SandboxPreview: "sandbox_preview",
  SafetyPolicyPreview: "safety_policy_preview",
  Unknown: "unknown",
} as const;

export type AgentRuntimePolicyTargetKindPreview =
  (typeof AgentRuntimePolicyTargetKindPreview)[keyof typeof AgentRuntimePolicyTargetKindPreview];

export const AgentRuntimeAuditPolicyBlockReasonPreview = {
  EventKindDisabled: "event_kind_disabled",
  UnsafeAuditPolicyRequested: "unsafe_audit_policy_requested",
} as const;

export type AgentRuntimeAuditPolicyBlockReasonPreview =
  (typeof AgentRuntimeAuditPolicyBlockReasonPreview)[keyof typeof AgentRuntimeAuditPolicyBlockReasonPreview];

export interface AgentRuntimePolicyBoundaryFlagsPreview {
  previewOnly: true;
  auditPolicyEnabled: true;
  productionAuditEnabled: false;
  cancellationPolicyEnabled: true;
  realCancellationEnabled: false;
  timeoutPolicyEnabled: true;
  realTimeoutEnforcementEnabled: false;
  retryPolicyEnabled: true;
  realRetryEnabled: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  backgroundJobEnabled: false;
  schedulerEnabled: false;
  persistenceEnabled: false;
  permissionConfirmationEnabled: false;
}

export interface AgentRuntimeAuditPolicyPreview {
  policyKey: string;
  displayName: string;
  description: string;
  enabledEventKinds: readonly AgentRuntimeAuditEventKindPreview[];
  redactedFieldNames: readonly string[];
  includeBoundaryFlags: boolean;
  includeSafetyFlags: boolean;
  includeRiskSummary: boolean;
  includeRawPrompt: boolean;
  includeRawToolInput: boolean;
  includeSecrets: boolean;
  productionAuditEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export interface AgentRuntimeAuditPreviewInput {
  eventKind: AgentRuntimeAuditEventKindPreview;
  runtimeId?: string;
  taskId?: string;
  userId?: string;
  actorKind?: AgentRuntimePolicyActorKindPreview;
  action?: string;
  targetKind?: AgentRuntimePolicyTargetKindPreview;
  riskLevel?: AgentRuntimeRiskLevelValue;
  riskSummary?: string;
  message?: string;
  metadata?: AgentMetadata;
  boundaryFlags?: AgentRuntimePolicyBoundaryFlagsPreview;
  safetyFlags?: AgentMetadata;
}

export interface AgentRuntimeAuditPolicyDecisionPreview {
  shouldCreateAuditEventPreview: boolean;
  eventKind: AgentRuntimeAuditEventKindPreview;
  redactedMetadata?: AgentMetadata;
  warnings: readonly string[];
  blockedReasons: readonly AgentRuntimeAuditPolicyBlockReasonPreview[];
  message: string;
  previewOnly: true;
  productionAuditEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export const AgentRuntimeCancellationReasonPreview = {
  UserRequested: "user_requested",
  PermissionDeniedPreview: "permission_denied_preview",
  SandboxBlockedPreview: "sandbox_blocked_preview",
  TimeoutRiskPreview: "timeout_risk_preview",
  RetryLimitPreview: "retry_limit_preview",
  SafetyPolicyBlocked: "safety_policy_blocked",
  DependencyFailedPreview: "dependency_failed_preview",
  ManualReviewRequired: "manual_review_required",
  Unknown: "unknown",
} as const;

export type AgentRuntimeCancellationReasonPreview =
  (typeof AgentRuntimeCancellationReasonPreview)[keyof typeof AgentRuntimeCancellationReasonPreview];

export const AgentRuntimeCancellationBlockReasonPreview = {
  TerminalStatus: "terminal_status",
  MissingReasonSummary: "missing_reason_summary",
  RealCancellationDisabled: "real_cancellation_disabled",
  UnsupportedActor: "unsupported_actor",
  InvalidRuntimeStatus: "invalid_runtime_status",
  UnknownReason: "unknown_reason",
} as const;

export type AgentRuntimeCancellationBlockReasonPreview =
  (typeof AgentRuntimeCancellationBlockReasonPreview)[keyof typeof AgentRuntimeCancellationBlockReasonPreview];

export interface AgentRuntimeCancellationRequestPreview {
  requestId: string;
  runtimeId?: string;
  taskId?: string;
  requestedByActorKind?: AgentRuntimePolicyActorKindPreview;
  reason: AgentRuntimeCancellationReasonPreview;
  reasonSummary?: string;
  currentExecutionStatus: AgentExecutionStatusValue;
  currentLifecycleStatus?: AgentRuntimeLifecycleStatusValue;
  requestedAt?: string;
  metadata?: AgentMetadata;
}

export interface AgentRuntimeCancellationPolicyPreview {
  policyKey: string;
  displayName: string;
  cancellableStatuses: readonly AgentExecutionStatusValue[];
  terminalStatuses: readonly AgentExecutionStatusValue[];
  requireReasonSummary: boolean;
  allowUserRequestedCancellation: boolean;
  allowPolicyRequestedCancellation: boolean;
  realCancellationEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export interface AgentRuntimeCancellationDecisionPreview {
  acceptedForPreview: boolean;
  shouldTransitionToCancellingPreview: boolean;
  shouldTransitionToCancelledPreview: boolean;
  redactedMetadata?: AgentMetadata;
  blockedReasons: readonly AgentRuntimeCancellationBlockReasonPreview[];
  warnings: readonly string[];
  message: string;
  previewOnly: true;
  realCancellationEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export const AgentRuntimeTimeoutBlockReasonPreview = {
  TerminalStatus: "terminal_status",
  InvalidRuntimeStatus: "invalid_runtime_status",
  ElapsedTimeUnavailable: "elapsed_time_unavailable",
} as const;

export type AgentRuntimeTimeoutBlockReasonPreview =
  (typeof AgentRuntimeTimeoutBlockReasonPreview)[keyof typeof AgentRuntimeTimeoutBlockReasonPreview];

export interface AgentRuntimeTimeoutPolicyPreview {
  policyKey: string;
  displayName: string;
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
  stepTimeoutMs?: number;
  toolCallTimeoutMs?: number;
  llmCallTimeoutMs?: number;
  timeoutRiskThresholdMs?: number;
  realTimeoutEnforcementEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export interface AgentRuntimeTimeoutEvaluationInputPreview {
  runtimeId?: string;
  taskId?: string;
  currentExecutionStatus: AgentExecutionStatusValue;
  currentLifecycleStatus?: AgentRuntimeLifecycleStatusValue;
  startedAt?: string;
  now?: string;
  elapsedMs?: number;
  currentStepKind?: string;
  currentStepStartedAt?: string;
  currentStepElapsedMs?: number;
  metadata?: AgentMetadata;
}

export interface AgentRuntimeTimeoutDecisionPreview {
  hasTimeoutRiskPreview: boolean;
  wouldTimeoutInRealRuntimePreview: boolean;
  shouldRecommendCancellationPreview: boolean;
  shouldCreateAuditEventPreview: boolean;
  elapsedMs?: number;
  timeoutMs: number;
  redactedMetadata?: AgentMetadata;
  blockedReasons: readonly AgentRuntimeTimeoutBlockReasonPreview[];
  warnings: readonly string[];
  message: string;
  previewOnly: true;
  realTimeoutEnforcementEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export const AgentRuntimeRetryReasonPreview = {
  TransientErrorPreview: "transient_error_preview",
  TimeoutRiskPreview: "timeout_risk_preview",
  DependencyUnavailablePreview: "dependency_unavailable_preview",
  SandboxPolicyBlockPreview: "sandbox_policy_block_preview",
  PermissionRequiredPreview: "permission_required_preview",
  ValidationErrorPreview: "validation_error_preview",
  UnknownErrorPreview: "unknown_error_preview",
} as const;

export type AgentRuntimeRetryReasonPreview =
  (typeof AgentRuntimeRetryReasonPreview)[keyof typeof AgentRuntimeRetryReasonPreview];

export const AgentRuntimeRetryBlockReasonPreview = {
  RetryLimitReached: "retry_limit_reached",
  TerminalStatus: "terminal_status",
  NonRetryableReason: "non_retryable_reason",
  RequiresPermission: "requires_permission",
  RequiresHumanReview: "requires_human_review",
  HighRisk: "high_risk",
  RealRetryDisabled: "real_retry_disabled",
  UnknownFailureReason: "unknown_failure_reason",
  InvalidRuntimeStatus: "invalid_runtime_status",
} as const;

export type AgentRuntimeRetryBlockReasonPreview =
  (typeof AgentRuntimeRetryBlockReasonPreview)[keyof typeof AgentRuntimeRetryBlockReasonPreview];

export interface AgentRuntimeRetryPolicyPreview {
  policyKey: string;
  displayName: string;
  maxPreviewRetryAttempts: number;
  retryableReasons: readonly AgentRuntimeRetryReasonPreview[];
  nonRetryableReasons: readonly AgentRuntimeRetryReasonPreview[];
  retryableStatuses: readonly AgentExecutionStatusValue[];
  terminalStatuses: readonly AgentExecutionStatusValue[];
  requireHumanReviewAfterAttempts: number;
  realRetryEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export interface AgentRuntimeRetryEvaluationInputPreview {
  runtimeId?: string;
  taskId?: string;
  currentExecutionStatus: AgentExecutionStatusValue;
  currentLifecycleStatus?: AgentRuntimeLifecycleStatusValue;
  failureReason?: AgentRuntimeRetryReasonPreview;
  blockedReasons?: readonly string[];
  attemptCount: number;
  maxAttemptsOverride?: number;
  riskLevel?: AgentRuntimeRiskLevelValue;
  requiresPermission?: boolean;
  requiresHumanReview?: boolean;
  metadata?: AgentMetadata;
}

export interface AgentRuntimeRetryDecisionPreview {
  shouldRetryPreview: boolean;
  shouldBlockRetryPreview: boolean;
  shouldRequireHumanReviewPreview: boolean;
  nextAttemptNumber?: number;
  redactedMetadata?: AgentMetadata;
  blockedReasons: readonly AgentRuntimeRetryBlockReasonPreview[];
  warnings: readonly string[];
  message: string;
  previewOnly: true;
  realRetryEnabled: false;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

export const AgentRuntimeSafetyPolicyRecommendedActionPreview = {
  NoActionPreview: "no_action_preview",
  CreateAuditEventPreview: "create_audit_event_preview",
  AcceptCancellationPreview: "accept_cancellation_preview",
  RecommendCancellationPreview: "recommend_cancellation_preview",
  RetryPreview: "retry_preview",
  HumanReviewPreview: "human_review_preview",
  BlockedPreview: "blocked_preview",
} as const;

export type AgentRuntimeSafetyPolicyRecommendedActionPreview =
  (typeof AgentRuntimeSafetyPolicyRecommendedActionPreview)[keyof typeof AgentRuntimeSafetyPolicyRecommendedActionPreview];

export interface AgentRuntimeSafetyPolicyEvaluationInputPreview {
  auditInput?: AgentRuntimeAuditPreviewInput;
  auditDecision?: AgentRuntimeAuditPolicyDecisionPreview;
  auditPolicy?: AgentRuntimeAuditPolicyPreview;
  cancellationRequest?: AgentRuntimeCancellationRequestPreview;
  cancellationDecision?: AgentRuntimeCancellationDecisionPreview;
  cancellationPolicy?: AgentRuntimeCancellationPolicyPreview;
  timeoutInput?: AgentRuntimeTimeoutEvaluationInputPreview;
  timeoutDecision?: AgentRuntimeTimeoutDecisionPreview;
  timeoutPolicy?: AgentRuntimeTimeoutPolicyPreview;
  retryInput?: AgentRuntimeRetryEvaluationInputPreview;
  retryDecision?: AgentRuntimeRetryDecisionPreview;
  retryPolicy?: AgentRuntimeRetryPolicyPreview;
}

export interface AgentRuntimeSafetyPolicyEvaluationPreview {
  auditDecision?: AgentRuntimeAuditPolicyDecisionPreview;
  cancellationDecision?: AgentRuntimeCancellationDecisionPreview;
  timeoutDecision?: AgentRuntimeTimeoutDecisionPreview;
  retryDecision?: AgentRuntimeRetryDecisionPreview;
  combinedWarnings: readonly string[];
  combinedBlockedReasons: readonly string[];
  recommendedNextPreviewAction: AgentRuntimeSafetyPolicyRecommendedActionPreview;
  previewOnly: true;
  boundaryFlags: AgentRuntimePolicyBoundaryFlagsPreview;
}

const DEFAULT_AUDIT_POLICY_KEY = "default_runtime_audit_policy_preview";
const DEFAULT_CANCELLATION_POLICY_KEY =
  "default_runtime_cancellation_policy_preview";
const DEFAULT_TIMEOUT_POLICY_KEY = "default_runtime_timeout_policy_preview";
const DEFAULT_RETRY_POLICY_KEY = "default_runtime_retry_policy_preview";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_TIMEOUT_MS = 1_800_000;
const PREVIEW_REDACTION_VALUE = "[redacted]";

const SENSITIVE_METADATA_KEYS = new Set([
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
  "privatekey",
  "clientsecret",
  "rawprompt",
  "rawmessages",
  "rawtoolinput",
  "rawtooloutput",
]);

const DEFAULT_REDACTED_FIELD_NAMES = [
  "apiKey",
  "apiSecret",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "password",
  "credential",
  "credentials",
  "rawHeaders",
  "headers",
  "cookie",
  "setCookie",
  "privateKey",
  "clientSecret",
  "rawPrompt",
  "rawMessages",
  "rawToolInput",
  "rawToolOutput",
] as const;

const DEFAULT_AUDIT_EVENT_KINDS = Object.values(
  AgentRuntimeAuditEventKindPreview,
);

const CANCELLABLE_STATUSES = [
  AgentExecutionStatus.Queued,
  AgentExecutionStatus.Running,
  AgentExecutionStatus.Paused,
  AgentExecutionStatus.WaitingForPermission,
  AgentExecutionStatus.Cancelling,
] as const satisfies readonly AgentExecutionStatusValue[];

const TERMINAL_EXECUTION_STATUSES = [
  AgentExecutionStatus.Completed,
  AgentExecutionStatus.Failed,
  AgentExecutionStatus.Cancelled,
  AgentExecutionStatus.TimedOut,
  AgentExecutionStatus.Blocked,
] as const satisfies readonly AgentExecutionStatusValue[];

const RETRYABLE_STATUSES = [
  AgentExecutionStatus.Failed,
  AgentExecutionStatus.TimedOut,
  AgentExecutionStatus.Blocked,
] as const satisfies readonly AgentExecutionStatusValue[];

const RETRY_TERMINAL_STATUSES = [
  AgentExecutionStatus.Completed,
  AgentExecutionStatus.Cancelled,
] as const satisfies readonly AgentExecutionStatusValue[];

const RETRYABLE_REASONS = [
  AgentRuntimeRetryReasonPreview.TransientErrorPreview,
  AgentRuntimeRetryReasonPreview.DependencyUnavailablePreview,
  AgentRuntimeRetryReasonPreview.TimeoutRiskPreview,
] as const satisfies readonly AgentRuntimeRetryReasonPreview[];

const NON_RETRYABLE_REASONS = [
  AgentRuntimeRetryReasonPreview.PermissionRequiredPreview,
  AgentRuntimeRetryReasonPreview.ValidationErrorPreview,
  AgentRuntimeRetryReasonPreview.SandboxPolicyBlockPreview,
  AgentRuntimeRetryReasonPreview.UnknownErrorPreview,
] as const satisfies readonly AgentRuntimeRetryReasonPreview[];

export function createRuntimePolicyBoundaryFlagsPreview(): AgentRuntimePolicyBoundaryFlagsPreview {
  return {
    previewOnly: true,
    auditPolicyEnabled: true,
    productionAuditEnabled: false,
    cancellationPolicyEnabled: true,
    realCancellationEnabled: false,
    timeoutPolicyEnabled: true,
    realTimeoutEnforcementEnabled: false,
    retryPolicyEnabled: true,
    realRetryEnabled: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    llmCallEnabled: false,
    backgroundJobEnabled: false,
    schedulerEnabled: false,
    persistenceEnabled: false,
    permissionConfirmationEnabled: false,
  };
}

export function createDefaultRuntimeAuditPolicyPreview(): AgentRuntimeAuditPolicyPreview {
  return {
    policyKey: DEFAULT_AUDIT_POLICY_KEY,
    displayName: "Default runtime audit policy preview",
    description:
      "Preview-only audit policy boundary for classifying future runtime audit events. It does not write production audit logs.",
    enabledEventKinds: [...DEFAULT_AUDIT_EVENT_KINDS],
    redactedFieldNames: [...DEFAULT_REDACTED_FIELD_NAMES],
    includeBoundaryFlags: true,
    includeSafetyFlags: true,
    includeRiskSummary: true,
    includeRawPrompt: false,
    includeRawToolInput: false,
    includeSecrets: false,
    productionAuditEnabled: false,
    boundaryFlags: createRuntimePolicyBoundaryFlagsPreview(),
  };
}

export function evaluateRuntimeAuditPolicyPreview(
  input: AgentRuntimeAuditPreviewInput,
  policy: AgentRuntimeAuditPolicyPreview = createDefaultRuntimeAuditPolicyPreview(),
): AgentRuntimeAuditPolicyDecisionPreview {
  const boundaryFlags = createRuntimePolicyBoundaryFlagsPreview();
  const redaction = redactMetadata(input.metadata, policy.redactedFieldNames);
  const blockedReasons = normalizeAuditBlockReasons([
    ...(policy.enabledEventKinds.includes(input.eventKind)
      ? []
      : [AgentRuntimeAuditPolicyBlockReasonPreview.EventKindDisabled]),
    ...(policy.includeSecrets ||
    policy.includeRawPrompt ||
    policy.includeRawToolInput
      ? [
          AgentRuntimeAuditPolicyBlockReasonPreview
            .UnsafeAuditPolicyRequested,
        ]
      : []),
  ]);
  const warnings = normalizeUniqueStrings([
    "Runtime audit policy evaluation is preview-only.",
    "No production audit log was written.",
    "Raw prompts, raw messages, raw tool input, raw tool output, secrets, tokens, authorization headers, and cookies are not included.",
    "Production audit remains disabled by boundary flags.",
    ...redaction.warnings,
    ...(blockedReasons.includes(
      AgentRuntimeAuditPolicyBlockReasonPreview.UnsafeAuditPolicyRequested,
    )
      ? ["Unsafe audit policy options were ignored for preview safety."]
      : []),
  ]);
  const shouldCreateAuditEventPreview =
    blockedReasons.length === 0 &&
    policy.enabledEventKinds.includes(input.eventKind);
  const decision: AgentRuntimeAuditPolicyDecisionPreview = {
    shouldCreateAuditEventPreview,
    eventKind: input.eventKind,
    warnings,
    blockedReasons,
    message: shouldCreateAuditEventPreview
      ? "Runtime audit policy preview would classify this event as audit-worthy, but no production audit log was written."
      : "Runtime audit policy preview did not create an audit event preview. No production audit log was written.",
    previewOnly: true,
    productionAuditEnabled: false,
    boundaryFlags,
  };

  if (redaction.redactedMetadata !== undefined) {
    decision.redactedMetadata = redaction.redactedMetadata;
  }

  return decision;
}

export function createDefaultRuntimeCancellationPolicyPreview(): AgentRuntimeCancellationPolicyPreview {
  return {
    policyKey: DEFAULT_CANCELLATION_POLICY_KEY,
    displayName: "Default runtime cancellation policy preview",
    cancellableStatuses: [...CANCELLABLE_STATUSES],
    terminalStatuses: [...TERMINAL_EXECUTION_STATUSES],
    requireReasonSummary: false,
    allowUserRequestedCancellation: true,
    allowPolicyRequestedCancellation: true,
    realCancellationEnabled: false,
    boundaryFlags: createRuntimePolicyBoundaryFlagsPreview(),
  };
}

export function evaluateRuntimeCancellationRequestPreview(
  request: AgentRuntimeCancellationRequestPreview,
  policy: AgentRuntimeCancellationPolicyPreview = createDefaultRuntimeCancellationPolicyPreview(),
): AgentRuntimeCancellationDecisionPreview {
  const boundaryFlags = createRuntimePolicyBoundaryFlagsPreview();
  const redaction = redactMetadata(request.metadata);
  const blockedReasons = normalizeCancellationBlockReasons([
    ...getCancellationStatusBlockReasons(request, policy),
    ...getCancellationReasonBlockReasons(request),
    ...getCancellationActorBlockReasons(request),
    ...(policy.requireReasonSummary &&
    (request.reasonSummary ?? "").trim().length === 0
      ? [AgentRuntimeCancellationBlockReasonPreview.MissingReasonSummary]
      : []),
  ]);
  const acceptedForPreview =
    blockedReasons.length === 0 &&
    policy.cancellableStatuses.includes(request.currentExecutionStatus);
  const shouldTransitionToCancellingPreview =
    acceptedForPreview &&
    request.currentExecutionStatus !== AgentExecutionStatus.Cancelling;
  const shouldTransitionToCancelledPreview =
    acceptedForPreview &&
    request.currentExecutionStatus === AgentExecutionStatus.Cancelling;
  const warnings = normalizeUniqueStrings([
    "Runtime cancellation decision is preview-only.",
    "No AbortController, process stop, promise cancellation, cleanup job, or runtime mutation was performed.",
    "Real cancellation remains disabled by boundary flags.",
    ...redaction.warnings,
    ...(request.reason === AgentRuntimeCancellationReasonPreview.Unknown
      ? ["Cancellation reason is unknown in preview input."]
      : []),
  ]);
  const decision: AgentRuntimeCancellationDecisionPreview = {
    acceptedForPreview,
    shouldTransitionToCancellingPreview,
    shouldTransitionToCancelledPreview,
    blockedReasons,
    warnings,
    message: createCancellationMessage({
      acceptedForPreview,
      shouldTransitionToCancellingPreview,
      shouldTransitionToCancelledPreview,
      blockedReasons,
      status: request.currentExecutionStatus,
    }),
    previewOnly: true,
    realCancellationEnabled: false,
    boundaryFlags,
  };

  if (redaction.redactedMetadata !== undefined) {
    decision.redactedMetadata = redaction.redactedMetadata;
  }

  return decision;
}

export function createDefaultRuntimeTimeoutPolicyPreview(): AgentRuntimeTimeoutPolicyPreview {
  return {
    policyKey: DEFAULT_TIMEOUT_POLICY_KEY,
    displayName: "Default runtime timeout policy preview",
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    maxTimeoutMs: DEFAULT_MAX_TIMEOUT_MS,
    stepTimeoutMs: 120_000,
    toolCallTimeoutMs: 60_000,
    llmCallTimeoutMs: 180_000,
    timeoutRiskThresholdMs: DEFAULT_TIMEOUT_MS,
    realTimeoutEnforcementEnabled: false,
    boundaryFlags: createRuntimePolicyBoundaryFlagsPreview(),
  };
}

export function evaluateRuntimeTimeoutPreview(
  input: AgentRuntimeTimeoutEvaluationInputPreview,
  policy: AgentRuntimeTimeoutPolicyPreview = createDefaultRuntimeTimeoutPolicyPreview(),
): AgentRuntimeTimeoutDecisionPreview {
  const boundaryFlags = createRuntimePolicyBoundaryFlagsPreview();
  const redaction = redactMetadata(input.metadata);
  const elapsedMs = getEffectiveElapsedMs(input);
  const timeoutMs = getEffectiveTimeoutMs(input, policy);
  const isTerminal = policyTerminalStatuses().includes(
    input.currentExecutionStatus,
  );
  const blockedReasons = normalizeTimeoutBlockReasons([
    ...(isAgentExecutionStatus(input.currentExecutionStatus)
      ? []
      : [AgentRuntimeTimeoutBlockReasonPreview.InvalidRuntimeStatus]),
    ...(isTerminal ? [AgentRuntimeTimeoutBlockReasonPreview.TerminalStatus] : []),
    ...(elapsedMs === undefined
      ? [AgentRuntimeTimeoutBlockReasonPreview.ElapsedTimeUnavailable]
      : []),
  ]);
  const timeoutRiskThresholdMs = Math.min(
    timeoutMs,
    normalizePositiveInteger(policy.timeoutRiskThresholdMs, timeoutMs),
  );
  const wouldTimeoutInRealRuntimePreview =
    elapsedMs !== undefined && !isTerminal && elapsedMs >= timeoutMs;
  const hasTimeoutRiskPreview =
    elapsedMs !== undefined &&
    !isTerminal &&
    elapsedMs >= timeoutRiskThresholdMs;
  const shouldRecommendCancellationPreview =
    wouldTimeoutInRealRuntimePreview && !isTerminal;
  const shouldCreateAuditEventPreview = hasTimeoutRiskPreview;
  const warnings = normalizeUniqueStrings([
    "Runtime timeout evaluation is preview-only.",
    "No timer, scheduler, worker, wait, sleep, or timeout enforcement was started.",
    "Real timeout enforcement remains disabled by boundary flags.",
    ...redaction.warnings,
    ...(elapsedMs === undefined
      ? ["Elapsed time could not be computed from elapsedMs or startedAt/now."]
      : []),
  ]);
  const decision: AgentRuntimeTimeoutDecisionPreview = {
    hasTimeoutRiskPreview,
    wouldTimeoutInRealRuntimePreview,
    shouldRecommendCancellationPreview,
    shouldCreateAuditEventPreview,
    timeoutMs,
    blockedReasons,
    warnings,
    message: createTimeoutMessage({
      elapsedMs,
      timeoutMs,
      hasTimeoutRiskPreview,
      wouldTimeoutInRealRuntimePreview,
      shouldRecommendCancellationPreview,
      blockedReasons,
    }),
    previewOnly: true,
    realTimeoutEnforcementEnabled: false,
    boundaryFlags,
  };

  if (elapsedMs !== undefined) {
    decision.elapsedMs = elapsedMs;
  }

  if (redaction.redactedMetadata !== undefined) {
    decision.redactedMetadata = redaction.redactedMetadata;
  }

  return decision;
}

export function createDefaultRuntimeRetryPolicyPreview(): AgentRuntimeRetryPolicyPreview {
  return {
    policyKey: DEFAULT_RETRY_POLICY_KEY,
    displayName: "Default runtime retry policy preview",
    maxPreviewRetryAttempts: 2,
    retryableReasons: [...RETRYABLE_REASONS],
    nonRetryableReasons: [...NON_RETRYABLE_REASONS],
    retryableStatuses: [...RETRYABLE_STATUSES],
    terminalStatuses: [...RETRY_TERMINAL_STATUSES],
    requireHumanReviewAfterAttempts: 2,
    realRetryEnabled: false,
    boundaryFlags: createRuntimePolicyBoundaryFlagsPreview(),
  };
}

export function evaluateRuntimeRetryPreview(
  input: AgentRuntimeRetryEvaluationInputPreview,
  policy: AgentRuntimeRetryPolicyPreview = createDefaultRuntimeRetryPolicyPreview(),
): AgentRuntimeRetryDecisionPreview {
  const boundaryFlags = createRuntimePolicyBoundaryFlagsPreview();
  const redaction = redactMetadata(input.metadata);
  const attemptCount = normalizeAttemptCount(input.attemptCount);
  const maxAttempts = normalizeMaxAttempts(
    input.maxAttemptsOverride,
    policy.maxPreviewRetryAttempts,
  );
  const failureReason = input.failureReason;
  const highRisk = isHighOrCriticalRisk(input.riskLevel);
  const failureReasonKnown =
    failureReason !== undefined && isRetryReasonPreview(failureReason);
  const blockedReasons = normalizeRetryBlockReasons([
    ...(attemptCount >= maxAttempts
      ? [AgentRuntimeRetryBlockReasonPreview.RetryLimitReached]
      : []),
    ...(policy.terminalStatuses.includes(input.currentExecutionStatus)
      ? [AgentRuntimeRetryBlockReasonPreview.TerminalStatus]
      : []),
    ...(policy.retryableStatuses.includes(input.currentExecutionStatus)
      ? []
      : policy.terminalStatuses.includes(input.currentExecutionStatus)
        ? []
        : [AgentRuntimeRetryBlockReasonPreview.InvalidRuntimeStatus]),
    ...(input.requiresPermission === true
      ? [AgentRuntimeRetryBlockReasonPreview.RequiresPermission]
      : []),
    ...(input.requiresHumanReview === true
      ? [AgentRuntimeRetryBlockReasonPreview.RequiresHumanReview]
      : []),
    ...(highRisk ? [AgentRuntimeRetryBlockReasonPreview.HighRisk] : []),
    ...(!failureReasonKnown
      ? [AgentRuntimeRetryBlockReasonPreview.UnknownFailureReason]
      : []),
    ...(failureReasonKnown &&
    policy.nonRetryableReasons.includes(failureReason)
      ? [AgentRuntimeRetryBlockReasonPreview.NonRetryableReason]
      : []),
  ]);
  const retryableReason =
    failureReasonKnown && policy.retryableReasons.includes(failureReason);
  const shouldRequireHumanReviewPreview =
    input.requiresPermission === true ||
    input.requiresHumanReview === true ||
    highRisk ||
    attemptCount >= policy.requireHumanReviewAfterAttempts;
  const shouldRetryPreview =
    blockedReasons.length === 0 &&
    retryableReason &&
    policy.retryableStatuses.includes(input.currentExecutionStatus);
  const shouldBlockRetryPreview = !shouldRetryPreview;
  const warnings = normalizeUniqueStrings([
    "Runtime retry evaluation is preview-only.",
    "No retry loop, tool retry, LLM retry, queue retry, or execution replay was performed.",
    "Real retry remains disabled by boundary flags.",
    ...redaction.warnings,
    ...(input.blockedReasons ?? []).map(
      (reason) => `Caller supplied blocked reason preview: ${reason}.`,
    ),
  ]);
  const decision: AgentRuntimeRetryDecisionPreview = {
    shouldRetryPreview,
    shouldBlockRetryPreview,
    shouldRequireHumanReviewPreview,
    blockedReasons,
    warnings,
    message: createRetryMessage({
      shouldRetryPreview,
      shouldRequireHumanReviewPreview,
      blockedReasons,
      attemptCount,
      maxAttempts,
      failureReason,
    }),
    previewOnly: true,
    realRetryEnabled: false,
    boundaryFlags,
  };

  if (shouldRetryPreview) {
    decision.nextAttemptNumber = attemptCount + 1;
  }

  if (redaction.redactedMetadata !== undefined) {
    decision.redactedMetadata = redaction.redactedMetadata;
  }

  return decision;
}

export function evaluateRuntimeSafetyPolicyPreview(
  input: AgentRuntimeSafetyPolicyEvaluationInputPreview,
): AgentRuntimeSafetyPolicyEvaluationPreview {
  const boundaryFlags = createRuntimePolicyBoundaryFlagsPreview();
  const auditDecision =
    input.auditDecision ??
    (input.auditInput === undefined
      ? undefined
      : evaluateRuntimeAuditPolicyPreview(
          input.auditInput,
          input.auditPolicy,
        ));
  const cancellationDecision =
    input.cancellationDecision ??
    (input.cancellationRequest === undefined
      ? undefined
      : evaluateRuntimeCancellationRequestPreview(
          input.cancellationRequest,
          input.cancellationPolicy,
        ));
  const timeoutDecision =
    input.timeoutDecision ??
    (input.timeoutInput === undefined
      ? undefined
      : evaluateRuntimeTimeoutPreview(input.timeoutInput, input.timeoutPolicy));
  const retryDecision =
    input.retryDecision ??
    (input.retryInput === undefined
      ? undefined
      : evaluateRuntimeRetryPreview(input.retryInput, input.retryPolicy));
  const combinedWarnings = normalizeUniqueStrings([
    ...(auditDecision?.warnings ?? []),
    ...(cancellationDecision?.warnings ?? []),
    ...(timeoutDecision?.warnings ?? []),
    ...(retryDecision?.warnings ?? []),
    "Runtime safety policy aggregation is preview-only.",
    "No runtime, tool, LLM, scheduler, timer, retry loop, cancellation action, persistence write, or production audit log was executed.",
  ]);
  const combinedBlockedReasons = normalizeUniqueStrings([
    ...(auditDecision?.blockedReasons ?? []),
    ...(cancellationDecision?.blockedReasons ?? []),
    ...(timeoutDecision?.blockedReasons ?? []),
    ...(retryDecision?.blockedReasons ?? []),
  ]);

  return {
    auditDecision,
    cancellationDecision,
    timeoutDecision,
    retryDecision,
    combinedWarnings,
    combinedBlockedReasons,
    recommendedNextPreviewAction: getRecommendedNextPreviewAction({
      auditDecision,
      cancellationDecision,
      timeoutDecision,
      retryDecision,
      combinedBlockedReasons,
    }),
    previewOnly: true,
    boundaryFlags,
  };
}

function getCancellationStatusBlockReasons(
  request: AgentRuntimeCancellationRequestPreview,
  policy: AgentRuntimeCancellationPolicyPreview,
): AgentRuntimeCancellationBlockReasonPreview[] {
  if (!isAgentExecutionStatus(request.currentExecutionStatus)) {
    return [AgentRuntimeCancellationBlockReasonPreview.InvalidRuntimeStatus];
  }

  if (policy.terminalStatuses.includes(request.currentExecutionStatus)) {
    return [AgentRuntimeCancellationBlockReasonPreview.TerminalStatus];
  }

  if (!policy.cancellableStatuses.includes(request.currentExecutionStatus)) {
    return [AgentRuntimeCancellationBlockReasonPreview.InvalidRuntimeStatus];
  }

  return [];
}

function getCancellationReasonBlockReasons(
  request: AgentRuntimeCancellationRequestPreview,
): AgentRuntimeCancellationBlockReasonPreview[] {
  if (!isCancellationReasonPreview(request.reason)) {
    return [AgentRuntimeCancellationBlockReasonPreview.UnknownReason];
  }

  if (
    request.reason === AgentRuntimeCancellationReasonPreview.UserRequested
  ) {
    return [];
  }

  if (
    request.reason === AgentRuntimeCancellationReasonPreview.Unknown &&
    (request.reasonSummary ?? "").trim().length === 0
  ) {
    return [AgentRuntimeCancellationBlockReasonPreview.UnknownReason];
  }

  return [];
}

function getCancellationActorBlockReasons(
  request: AgentRuntimeCancellationRequestPreview,
): AgentRuntimeCancellationBlockReasonPreview[] {
  if (request.requestedByActorKind === undefined) {
    return [];
  }

  return isPolicyActorKindPreview(request.requestedByActorKind)
    ? []
    : [AgentRuntimeCancellationBlockReasonPreview.UnsupportedActor];
}

function createCancellationMessage(input: {
  readonly acceptedForPreview: boolean;
  readonly shouldTransitionToCancellingPreview: boolean;
  readonly shouldTransitionToCancelledPreview: boolean;
  readonly blockedReasons: readonly AgentRuntimeCancellationBlockReasonPreview[];
  readonly status: AgentExecutionStatusValue;
}): string {
  if (!input.acceptedForPreview) {
    return [
      `Runtime cancellation request preview was blocked from status ${input.status}.`,
      `Reasons: ${input.blockedReasons.join(", ")}.`,
      "No real cancellation occurred.",
    ].join(" ");
  }

  if (input.shouldTransitionToCancelledPreview) {
    return "Runtime cancellation request was accepted for preview and would show a cancelled preview state. No real cancellation occurred.";
  }

  if (input.shouldTransitionToCancellingPreview) {
    return "Runtime cancellation request was accepted for preview and would show a cancelling preview state. No real cancellation occurred.";
  }

  return "Runtime cancellation request was accepted for preview only. No real cancellation occurred.";
}

function getEffectiveElapsedMs(
  input: AgentRuntimeTimeoutEvaluationInputPreview,
): number | undefined {
  const directElapsedMs = normalizeNonNegativeInteger(input.elapsedMs);

  if (directElapsedMs !== undefined) {
    return directElapsedMs;
  }

  const stepElapsedMs = normalizeNonNegativeInteger(input.currentStepElapsedMs);

  if (stepElapsedMs !== undefined) {
    return stepElapsedMs;
  }

  const runtimeElapsedMs = calculateElapsedMs(input.startedAt, input.now);

  if (runtimeElapsedMs !== undefined) {
    return runtimeElapsedMs;
  }

  return calculateElapsedMs(input.currentStepStartedAt, input.now);
}

function getEffectiveTimeoutMs(
  input: AgentRuntimeTimeoutEvaluationInputPreview,
  policy: AgentRuntimeTimeoutPolicyPreview,
): number {
  const defaultTimeoutMs = normalizePositiveInteger(
    policy.defaultTimeoutMs,
    DEFAULT_TIMEOUT_MS,
  );
  const maxTimeoutMs = normalizePositiveInteger(
    policy.maxTimeoutMs,
    DEFAULT_MAX_TIMEOUT_MS,
  );
  const clampedDefaultTimeoutMs = Math.min(defaultTimeoutMs, maxTimeoutMs);
  const stepKind = (input.currentStepKind ?? "").toLowerCase();

  if (stepKind.includes("tool")) {
    return Math.min(
      normalizePositiveInteger(
        policy.toolCallTimeoutMs,
        clampedDefaultTimeoutMs,
      ),
      maxTimeoutMs,
    );
  }

  if (stepKind.includes("llm")) {
    return Math.min(
      normalizePositiveInteger(
        policy.llmCallTimeoutMs,
        clampedDefaultTimeoutMs,
      ),
      maxTimeoutMs,
    );
  }

  if (
    input.currentStepElapsedMs !== undefined ||
    input.currentStepStartedAt !== undefined
  ) {
    return Math.min(
      normalizePositiveInteger(policy.stepTimeoutMs, clampedDefaultTimeoutMs),
      maxTimeoutMs,
    );
  }

  return clampedDefaultTimeoutMs;
}

function createTimeoutMessage(input: {
  readonly elapsedMs: number | undefined;
  readonly timeoutMs: number;
  readonly hasTimeoutRiskPreview: boolean;
  readonly wouldTimeoutInRealRuntimePreview: boolean;
  readonly shouldRecommendCancellationPreview: boolean;
  readonly blockedReasons: readonly AgentRuntimeTimeoutBlockReasonPreview[];
}): string {
  if (input.elapsedMs === undefined) {
    return "Runtime timeout preview could not compute elapsed time. No timeout enforcement occurred.";
  }

  if (input.blockedReasons.includes(AgentRuntimeTimeoutBlockReasonPreview.TerminalStatus)) {
    return "Runtime timeout preview skipped timeout risk because the runtime status is terminal. No timeout enforcement occurred.";
  }

  if (input.wouldTimeoutInRealRuntimePreview) {
    return `Runtime timeout preview sees elapsedMs=${input.elapsedMs} at or above timeoutMs=${input.timeoutMs}. It would recommend cancellation in preview only.`;
  }

  if (input.hasTimeoutRiskPreview) {
    return `Runtime timeout preview sees elapsedMs=${input.elapsedMs} near timeoutMs=${input.timeoutMs}. It only creates a risk preview.`;
  }

  return `Runtime timeout preview sees elapsedMs=${input.elapsedMs} below timeoutMs=${input.timeoutMs}. No timeout enforcement occurred.`;
}

function createRetryMessage(input: {
  readonly shouldRetryPreview: boolean;
  readonly shouldRequireHumanReviewPreview: boolean;
  readonly blockedReasons: readonly AgentRuntimeRetryBlockReasonPreview[];
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly failureReason: AgentRuntimeRetryReasonPreview | undefined;
}): string {
  if (input.shouldRetryPreview) {
    return [
      `Runtime retry policy preview recommends attempt ${input.attemptCount + 1} for ${input.failureReason ?? "unknown failure"}.`,
      "No real retry was executed.",
    ].join(" ");
  }

  if (input.shouldRequireHumanReviewPreview) {
    return [
      "Runtime retry policy preview requires human or permission review before any future retry.",
      `Reasons: ${input.blockedReasons.join(", ")}.`,
      "No real retry was executed.",
    ].join(" ");
  }

  return [
    `Runtime retry policy preview blocked retry at attemptCount=${input.attemptCount} with maxAttempts=${input.maxAttempts}.`,
    `Reasons: ${input.blockedReasons.join(", ")}.`,
    "No real retry was executed.",
  ].join(" ");
}

function getRecommendedNextPreviewAction(input: {
  readonly auditDecision: AgentRuntimeAuditPolicyDecisionPreview | undefined;
  readonly cancellationDecision:
    | AgentRuntimeCancellationDecisionPreview
    | undefined;
  readonly timeoutDecision: AgentRuntimeTimeoutDecisionPreview | undefined;
  readonly retryDecision: AgentRuntimeRetryDecisionPreview | undefined;
  readonly combinedBlockedReasons: readonly string[];
}): AgentRuntimeSafetyPolicyRecommendedActionPreview {
  if (input.combinedBlockedReasons.length > 0) {
    if (
      input.retryDecision?.shouldRequireHumanReviewPreview === true ||
      input.cancellationDecision?.acceptedForPreview === false
    ) {
      return AgentRuntimeSafetyPolicyRecommendedActionPreview.HumanReviewPreview;
    }

    return AgentRuntimeSafetyPolicyRecommendedActionPreview.BlockedPreview;
  }

  if (input.cancellationDecision?.acceptedForPreview === true) {
    return AgentRuntimeSafetyPolicyRecommendedActionPreview
      .AcceptCancellationPreview;
  }

  if (
    input.timeoutDecision?.shouldRecommendCancellationPreview === true
  ) {
    return AgentRuntimeSafetyPolicyRecommendedActionPreview
      .RecommendCancellationPreview;
  }

  if (input.retryDecision?.shouldRetryPreview === true) {
    return AgentRuntimeSafetyPolicyRecommendedActionPreview.RetryPreview;
  }

  if (input.auditDecision?.shouldCreateAuditEventPreview === true) {
    return AgentRuntimeSafetyPolicyRecommendedActionPreview
      .CreateAuditEventPreview;
  }

  return AgentRuntimeSafetyPolicyRecommendedActionPreview.NoActionPreview;
}

function calculateElapsedMs(
  startedAt: string | undefined,
  now: string | undefined,
): number | undefined {
  if (startedAt === undefined || now === undefined) {
    return undefined;
  }

  const startedAtMs = Date.parse(startedAt);
  const nowMs = Date.parse(now);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    return undefined;
  }

  return normalizeNonNegativeInteger(nowMs - startedAtMs);
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizeNonNegativeInteger(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function normalizeAttemptCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function normalizeMaxAttempts(
  override: number | undefined,
  policyDefault: number,
): number {
  if (override !== undefined && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }

  return Math.max(0, Math.floor(policyDefault));
}

function policyTerminalStatuses(): readonly AgentExecutionStatusValue[] {
  return TERMINAL_EXECUTION_STATUSES;
}

function isHighOrCriticalRisk(
  riskLevel: AgentRuntimeRiskLevelValue | undefined,
): boolean {
  return (
    riskLevel === AgentRuntimeRiskLevel.High ||
    riskLevel === AgentRuntimeRiskLevel.Critical
  );
}

function redactMetadata(
  metadata: AgentMetadata | undefined,
  redactedFieldNames: readonly string[] = DEFAULT_REDACTED_FIELD_NAMES,
): {
  readonly redactedMetadata: AgentMetadata | undefined;
  readonly redactedFieldNames: readonly string[];
  readonly warnings: readonly string[];
} {
  if (metadata === undefined) {
    return {
      redactedMetadata: undefined,
      redactedFieldNames: [],
      warnings: [],
    };
  }

  const redactedKeys = new Set<string>();
  const explicitSensitiveKeys = new Set(
    redactedFieldNames.map(normalizeMetadataKey),
  );
  const redactedMetadata = redactMetadataObject(
    metadata,
    redactedKeys,
    explicitSensitiveKeys,
  );
  const redactedFieldNameList = normalizeUniqueStrings([...redactedKeys]);

  return {
    redactedMetadata,
    redactedFieldNames: redactedFieldNameList,
    warnings:
      redactedFieldNameList.length > 0
        ? [
            `sensitive_metadata_redacted:${redactedFieldNameList.join(",")}`,
          ]
        : [],
  };
}

function redactMetadataObject(
  metadata: { readonly [key: string]: PolicyJsonValue },
  redactedKeys: Set<string>,
  explicitSensitiveKeys: ReadonlySet<string>,
): AgentMetadata {
  const output: Record<string, PolicyJsonValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveMetadataKey(key, explicitSensitiveKeys)) {
      redactedKeys.add(key);
      output[key] = PREVIEW_REDACTION_VALUE;
      continue;
    }

    output[key] = redactMetadataValue(
      value,
      redactedKeys,
      explicitSensitiveKeys,
    );
  }

  return output as AgentMetadata;
}

function redactMetadataValue(
  value: PolicyJsonValue,
  redactedKeys: Set<string>,
  explicitSensitiveKeys: ReadonlySet<string>,
): PolicyJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) =>
      redactMetadataValue(item, redactedKeys, explicitSensitiveKeys),
    );
  }

  if (isPolicyJsonRecord(value)) {
    return redactMetadataObject(value, redactedKeys, explicitSensitiveKeys);
  }

  return value;
}

function isPolicyJsonRecord(
  value: PolicyJsonValue,
): value is { readonly [key: string]: PolicyJsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveMetadataKey(
  key: string,
  explicitSensitiveKeys: ReadonlySet<string>,
): boolean {
  const normalizedKey = normalizeMetadataKey(key);

  return (
    SENSITIVE_METADATA_KEYS.has(normalizedKey) ||
    explicitSensitiveKeys.has(normalizedKey)
  );
}

function isAgentExecutionStatus(
  status: AgentExecutionStatusValue,
): status is AgentExecutionStatusValue {
  return (
    Object.values(AgentExecutionStatus) as readonly string[]
  ).includes(status);
}

function isCancellationReasonPreview(
  reason: AgentRuntimeCancellationReasonPreview,
): reason is AgentRuntimeCancellationReasonPreview {
  return (
    Object.values(AgentRuntimeCancellationReasonPreview) as readonly string[]
  ).includes(reason);
}

function isRetryReasonPreview(
  reason: AgentRuntimeRetryReasonPreview,
): reason is AgentRuntimeRetryReasonPreview {
  return (
    Object.values(AgentRuntimeRetryReasonPreview) as readonly string[]
  ).includes(reason);
}

function isPolicyActorKindPreview(
  actorKind: AgentRuntimePolicyActorKindPreview,
): actorKind is AgentRuntimePolicyActorKindPreview {
  return (
    Object.values(AgentRuntimePolicyActorKindPreview) as readonly string[]
  ).includes(actorKind);
}

function normalizeAuditBlockReasons(
  values: readonly AgentRuntimeAuditPolicyBlockReasonPreview[],
): AgentRuntimeAuditPolicyBlockReasonPreview[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentRuntimeAuditPolicyBlockReasonPreview[];
}

function normalizeCancellationBlockReasons(
  values: readonly AgentRuntimeCancellationBlockReasonPreview[],
): AgentRuntimeCancellationBlockReasonPreview[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentRuntimeCancellationBlockReasonPreview[];
}

function normalizeTimeoutBlockReasons(
  values: readonly AgentRuntimeTimeoutBlockReasonPreview[],
): AgentRuntimeTimeoutBlockReasonPreview[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentRuntimeTimeoutBlockReasonPreview[];
}

function normalizeRetryBlockReasons(
  values: readonly AgentRuntimeRetryBlockReasonPreview[],
): AgentRuntimeRetryBlockReasonPreview[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentRuntimeRetryBlockReasonPreview[];
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
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
