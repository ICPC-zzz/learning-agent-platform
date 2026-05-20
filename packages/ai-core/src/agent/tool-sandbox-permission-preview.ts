import type { AutonomyLevel as AutonomyLevelValue } from "../autonomy/types";
import type {
  AgentExecutionStatus as AgentExecutionStatusValue,
  AgentRuntimeLifecycleStatus as AgentRuntimeLifecycleStatusValue,
} from "./runtime-lifecycle-preview";
import {
  AgentPermissionRequestKind,
  AgentPermissionRequestSeverity,
  AgentPermissionRequestSource,
  type AgentPermissionRequestKind as AgentPermissionRequestKindValue,
  type AgentPermissionRequestPreview,
  type AgentPermissionRequestRiskLevel,
  type AgentPermissionRequestSeverity as AgentPermissionRequestSeverityValue,
  type AgentPermissionRequestSource as AgentPermissionRequestSourceValue,
} from "./permission-request-preview";
import {
  AgentToolSandboxBlockReasonPreview,
  AgentToolSandboxDecisionKindPreview,
  AgentToolSandboxRiskLevelPreview,
  AgentToolSandboxSideEffectLevelPreview,
  type AgentToolSandboxBlockReasonPreview as AgentToolSandboxBlockReasonPreviewValue,
  type AgentToolSandboxDecisionPreview,
  type AgentToolSandboxRequestPreview,
} from "./tool-sandbox-preview";
import type { AgentMetadata } from "./types";

export const AgentToolSandboxPermissionIntegrationReasonPreview = {
  SandboxRequiresPermissionPreview:
    "sandbox_requires_permission_preview",
  SandboxRequiresHumanReviewPreview:
    "sandbox_requires_human_review_preview",
  SandboxBlockedByPolicy: "sandbox_blocked_by_policy",
  SandboxRiskTooHigh: "sandbox_risk_too_high",
  SandboxExternalSideEffectRisk: "sandbox_external_side_effect_risk",
  SandboxCredentialAccessRisk: "sandbox_credential_access_risk",
  SandboxCommandExecutionRisk: "sandbox_command_execution_risk",
  SandboxFileSystemRisk: "sandbox_file_system_risk",
  SandboxNetworkAccessRisk: "sandbox_network_access_risk",
  SandboxUnknownTool: "sandbox_unknown_tool",
  SandboxUnsupportedCapability: "sandbox_unsupported_capability",
  SandboxUnsupportedSideEffectLevel:
    "sandbox_unsupported_side_effect_level",
  SandboxUnknownRisk: "sandbox_unknown_risk",
  SandboxUnsafeMetadata: "sandbox_unsafe_metadata",
  SandboxNotAllowlisted: "sandbox_not_allowlisted",
  SandboxMissingPurposeSummary: "sandbox_missing_purpose_summary",
  SandboxMediumRiskReadOnlyReview:
    "sandbox_medium_risk_read_only_review",
  SandboxAllowedPreviewOnly: "sandbox_allowed_preview_only",
} as const;

export type AgentToolSandboxPermissionIntegrationReasonPreview =
  (typeof AgentToolSandboxPermissionIntegrationReasonPreview)[keyof typeof AgentToolSandboxPermissionIntegrationReasonPreview];

export interface AgentToolSandboxPermissionBoundaryFlagsPreview {
  previewOnly: true;
  permissionFlowEnabled: false;
  decisionCaptured: false;
  realExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  approvalActionEnabled: false;
  rejectionActionEnabled: false;
  confirmationActionEnabled: false;
  persistenceEnabled: false;
}

export interface AgentToolSandboxPermissionMetadataSummaryPreview {
  metadataKeyCount: number;
  safeMetadataKeys: readonly string[];
  sensitiveMetadataDetected: boolean;
  redactedSensitiveKeyCount: number;
  truncated: boolean;
}

export interface AgentToolSandboxPermissionRequestSourcePreview {
  sourceKind: "tool_sandbox_decision_preview";
  requestId: string;
  toolKey: string;
  requestedCapability: AgentToolSandboxRequestPreview["requestedCapability"];
  requestedSideEffectLevel: AgentToolSandboxRequestPreview["requestedSideEffectLevel"];
  sandboxDecisionKind: AgentToolSandboxDecisionPreview["decisionKind"];
  sandboxAllowed: boolean;
  sandboxBlockedReasons: readonly AgentToolSandboxBlockReasonPreviewValue[];
  sandboxWarnings: readonly string[];
  purposeSummary: string;
  riskLevel: AgentPermissionRequestRiskLevel;
  targetResourceKind?: string;
  targetResourceLabel?: string;
  metadataSummary?: AgentToolSandboxPermissionMetadataSummaryPreview;
}

export interface AgentToolSandboxPermissionIntegrationContextPreview {
  taskId?: string;
  runtimeId?: string;
  userId?: string;
  autonomyLevel?: AutonomyLevelValue;
  actorKind?: AgentToolSandboxRequestPreview["requestedByActorKind"];
  currentExecutionStatus?: AgentExecutionStatusValue;
  currentLifecycleStatus?: AgentRuntimeLifecycleStatusValue;
  toolRequirementSummary?: string;
  executionReadinessSummary?: string;
  now?: string;
}

export interface AgentToolSandboxPermissionIntegrationDecisionPreview {
  shouldCreatePermissionRequestPreview: boolean;
  shouldRequireHumanReviewPreview: boolean;
  shouldBlockWithoutPermissionPreview: boolean;
  reasons: readonly AgentToolSandboxPermissionIntegrationReasonPreview[];
  riskLevel: AgentPermissionRequestRiskLevel;
  message: string;
  previewOnly: true;
  boundaryFlags: AgentToolSandboxPermissionBoundaryFlagsPreview;
}

export interface AgentToolSandboxPermissionRequestCandidatePreview {
  candidateKind: "permission_request_preview_candidate";
  previewOnly: true;
  sourceKind: "tool_sandbox_decision_preview";
  requestId: string;
  sourceRequestId: string;
  taskId?: string;
  runtimeId?: string;
  userId?: string;
  requestKind: AgentPermissionRequestKindValue;
  source: AgentPermissionRequestSourceValue;
  severity: AgentPermissionRequestSeverityValue;
  title: string;
  description: string;
  riskLevel: AgentPermissionRequestRiskLevel;
  currentAutonomyLevel?: AutonomyLevelValue;
  relatedToolNames: readonly string[];
  relatedToolCategories: readonly string[];
  requiresUserConfirmation: boolean;
  allowedByCurrentAutonomy: false;
  blockedReason?: string;
  confirmationPromptText?: string;
  safetyNotes: readonly string[];
  boundaryFlags: AgentToolSandboxPermissionBoundaryFlagsPreview;
}

export interface AgentToolSandboxPermissionIntegrationResultPreview {
  ok: boolean;
  previewOnly: true;
  source: AgentToolSandboxPermissionRequestSourcePreview;
  integrationDecision: AgentToolSandboxPermissionIntegrationDecisionPreview;
  permissionRequestPreview?: AgentPermissionRequestPreview;
  permissionRequestCandidate?: AgentToolSandboxPermissionRequestCandidatePreview;
  warnings: readonly string[];
  message: string;
  boundaryFlags: AgentToolSandboxPermissionBoundaryFlagsPreview;
}

export interface CreateToolSandboxPermissionRequestSourcePreviewInput {
  sandboxRequest: AgentToolSandboxRequestPreview;
  sandboxDecision: AgentToolSandboxDecisionPreview;
}

export interface EvaluateToolSandboxPermissionNeedPreviewInput {
  sandboxRequest: AgentToolSandboxRequestPreview;
  sandboxDecision: AgentToolSandboxDecisionPreview;
  context?: AgentToolSandboxPermissionIntegrationContextPreview;
}

export interface CreateToolSandboxPermissionIntegrationPreviewInput {
  sandboxRequest: AgentToolSandboxRequestPreview;
  sandboxDecision: AgentToolSandboxDecisionPreview;
  context?: AgentToolSandboxPermissionIntegrationContextPreview;
}

const MAX_SAFE_METADATA_KEYS = 12;
const MAX_TEXT_LENGTH = 240;

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
]);

const DANGEROUS_BLOCK_REASONS =
  new Set<AgentToolSandboxBlockReasonPreviewValue>([
    AgentToolSandboxBlockReasonPreview.UnknownTool,
    AgentToolSandboxBlockReasonPreview.UnsupportedCapability,
    AgentToolSandboxBlockReasonPreview.UnsupportedSideEffectLevel,
    AgentToolSandboxBlockReasonPreview.UnsafeMetadata,
    AgentToolSandboxBlockReasonPreview.UnknownRisk,
    AgentToolSandboxBlockReasonPreview.CredentialAccessDisabled,
    AgentToolSandboxBlockReasonPreview.ShellCommandDisabled,
    AgentToolSandboxBlockReasonPreview.FileSystemWriteDisabled,
    AgentToolSandboxBlockReasonPreview.NetworkAccessDisabled,
    AgentToolSandboxBlockReasonPreview.DatabaseAccessDisabled,
    AgentToolSandboxBlockReasonPreview.BrowserAutomationDisabled,
    AgentToolSandboxBlockReasonPreview.ExternalSideEffectDisabled,
  ]);

const DANGEROUS_SIDE_EFFECT_LEVELS =
  new Set<AgentToolSandboxSideEffectLevelPreview>([
    AgentToolSandboxSideEffectLevelPreview.LocalWrite,
    AgentToolSandboxSideEffectLevelPreview.ExternalWrite,
    AgentToolSandboxSideEffectLevelPreview.CommandExecution,
    AgentToolSandboxSideEffectLevelPreview.CredentialAccess,
    AgentToolSandboxSideEffectLevelPreview.Unknown,
  ]);

const CANDIDATE_BLOCK_REASONS =
  new Set<AgentToolSandboxBlockReasonPreviewValue>([
    AgentToolSandboxBlockReasonPreview.RequiresPermission,
    AgentToolSandboxBlockReasonPreview.RequiresHumanReview,
    AgentToolSandboxBlockReasonPreview.RiskTooHigh,
    AgentToolSandboxBlockReasonPreview.MissingPurposeSummary,
    AgentToolSandboxBlockReasonPreview.ToolNotAllowlisted,
  ]);

export function createToolSandboxPermissionBoundaryFlagsPreview(): AgentToolSandboxPermissionBoundaryFlagsPreview {
  return {
    previewOnly: true,
    permissionFlowEnabled: false,
    decisionCaptured: false,
    realExecutionEnabled: false,
    toolExecutionEnabled: false,
    llmCallEnabled: false,
    approvalActionEnabled: false,
    rejectionActionEnabled: false,
    confirmationActionEnabled: false,
    persistenceEnabled: false,
  };
}

export function createToolSandboxPermissionRequestSourcePreview(
  input: CreateToolSandboxPermissionRequestSourcePreviewInput,
): AgentToolSandboxPermissionRequestSourcePreview {
  const metadataSummary = createMetadataSummary(input.sandboxRequest.metadata);
  const source: AgentToolSandboxPermissionRequestSourcePreview = {
    sourceKind: "tool_sandbox_decision_preview",
    requestId: sanitizeIdentifier(input.sandboxRequest.requestId),
    toolKey: sanitizeIdentifier(input.sandboxRequest.toolKey),
    requestedCapability: input.sandboxRequest.requestedCapability,
    requestedSideEffectLevel:
      input.sandboxRequest.requestedSideEffectLevel,
    sandboxDecisionKind: input.sandboxDecision.decisionKind,
    sandboxAllowed: input.sandboxDecision.allowed,
    sandboxBlockedReasons: normalizeBlockReasons(
      input.sandboxDecision.blockedReasons,
    ),
    sandboxWarnings: sanitizeWarnings(input.sandboxDecision.warnings),
    purposeSummary: sanitizePurposeSummary({
      purposeSummary: input.sandboxRequest.purposeSummary,
      sandboxDecision: input.sandboxDecision,
    }),
    riskLevel: mapToolSandboxDecisionToPermissionRiskPreview(
      input.sandboxDecision,
    ),
  };

  if (input.sandboxRequest.targetResourceKind !== undefined) {
    source.targetResourceKind = sanitizeText(
      input.sandboxRequest.targetResourceKind,
    );
  }

  if (input.sandboxRequest.targetResourceLabel !== undefined) {
    source.targetResourceLabel = sanitizeText(
      input.sandboxRequest.targetResourceLabel,
    );
  }

  if (metadataSummary !== undefined) {
    source.metadataSummary = metadataSummary;
  }

  return source;
}

export function evaluateToolSandboxPermissionNeedPreview(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
): AgentToolSandboxPermissionIntegrationDecisionPreview {
  const boundaryFlags = createToolSandboxPermissionBoundaryFlagsPreview();
  const riskLevel = mapToolSandboxDecisionToPermissionRiskPreview(
    input.sandboxDecision,
  );
  const reasons = getIntegrationReasons(input);
  const shouldBlockWithoutPermissionPreview =
    shouldBlockWithoutPermission(input);
  const shouldRequireHumanReviewPreview =
    !shouldBlockWithoutPermissionPreview &&
    shouldRequireHumanReview(input, reasons);
  const shouldCreatePermissionRequestPreview =
    !shouldBlockWithoutPermissionPreview &&
    shouldCreatePermissionRequest(input, reasons);

  return {
    shouldCreatePermissionRequestPreview,
    shouldRequireHumanReviewPreview,
    shouldBlockWithoutPermissionPreview,
    reasons,
    riskLevel,
    message: createIntegrationDecisionMessage({
      shouldCreatePermissionRequestPreview,
      shouldRequireHumanReviewPreview,
      shouldBlockWithoutPermissionPreview,
      sandboxDecision: input.sandboxDecision,
      reasons,
    }),
    previewOnly: true,
    boundaryFlags,
  };
}

export function createToolSandboxPermissionIntegrationPreview(
  input: CreateToolSandboxPermissionIntegrationPreviewInput,
): AgentToolSandboxPermissionIntegrationResultPreview {
  const boundaryFlags = createToolSandboxPermissionBoundaryFlagsPreview();
  const source = createToolSandboxPermissionRequestSourcePreview(input);
  const integrationDecision = evaluateToolSandboxPermissionNeedPreview(input);
  const permissionRequestCandidate =
    integrationDecision.shouldCreatePermissionRequestPreview
      ? createPermissionRequestCandidate({
          source,
          integrationDecision,
          context: input.context,
        })
      : undefined;
  const warnings = createIntegrationWarnings({
    source,
    integrationDecision,
    sandboxDecision: input.sandboxDecision,
  });

  return {
    ok: true,
    previewOnly: true,
    source,
    integrationDecision,
    permissionRequestCandidate,
    warnings,
    message: createIntegrationResultMessage({
      integrationDecision,
      hasCandidate: permissionRequestCandidate !== undefined,
    }),
    boundaryFlags,
  };
}

export function mapToolSandboxDecisionToPermissionRiskPreview(
  decision: AgentToolSandboxDecisionPreview,
): AgentPermissionRequestRiskLevel {
  switch (decision.riskLevel) {
    case AgentToolSandboxRiskLevelPreview.Low:
      return AgentToolSandboxRiskLevelPreview.Low;
    case AgentToolSandboxRiskLevelPreview.Medium:
      return AgentToolSandboxRiskLevelPreview.Medium;
    case AgentToolSandboxRiskLevelPreview.High:
      return AgentToolSandboxRiskLevelPreview.High;
    case AgentToolSandboxRiskLevelPreview.Critical:
      return AgentToolSandboxRiskLevelPreview.Critical;
    case AgentToolSandboxRiskLevelPreview.Unknown:
      return AgentToolSandboxRiskLevelPreview.Unknown;
  }
}

function createPermissionRequestCandidate(input: {
  readonly source: AgentToolSandboxPermissionRequestSourcePreview;
  readonly integrationDecision: AgentToolSandboxPermissionIntegrationDecisionPreview;
  readonly context: AgentToolSandboxPermissionIntegrationContextPreview | undefined;
}): AgentToolSandboxPermissionRequestCandidatePreview {
  const isHumanReview =
    input.integrationDecision.shouldRequireHumanReviewPreview;
  const severity = isHumanReview
    ? AgentPermissionRequestSeverity.Required
    : getCandidateSeverity(input.integrationDecision);
  const requestKind = isHumanReview
    ? AgentPermissionRequestKind.HighRiskConfirmation
    : AgentPermissionRequestKind.ToolPermission;
  const title = isHumanReview
    ? "Tool sandbox human review preview"
    : "Tool sandbox permission request preview candidate";
  const candidate: AgentToolSandboxPermissionRequestCandidatePreview = {
    candidateKind: "permission_request_preview_candidate",
    previewOnly: true,
    sourceKind: "tool_sandbox_decision_preview",
    requestId: createCandidateRequestId(input.source, input.context),
    sourceRequestId: input.source.requestId,
    requestKind,
    source: AgentPermissionRequestSource.Safety,
    severity,
    title,
    description: createCandidateDescription(input),
    riskLevel: input.integrationDecision.riskLevel,
    relatedToolNames: [input.source.toolKey],
    relatedToolCategories: normalizeUniqueStrings([
      input.source.requestedCapability,
      input.source.requestedSideEffectLevel,
    ]),
    requiresUserConfirmation: true,
    allowedByCurrentAutonomy: false,
    confirmationPromptText: isHumanReview
      ? "Future runtime would need human review before considering this sandbox request. This preview does not capture that review."
      : "Future runtime would need a real permission flow before considering this sandbox request. This preview does not capture permission.",
    safetyNotes: createCandidateSafetyNotes(input.integrationDecision),
    boundaryFlags: input.integrationDecision.boundaryFlags,
  };

  if (input.context?.taskId !== undefined) {
    candidate.taskId = sanitizeIdentifier(input.context.taskId);
  }

  if (input.context?.runtimeId !== undefined) {
    candidate.runtimeId = sanitizeIdentifier(input.context.runtimeId);
  }

  if (input.context?.userId !== undefined) {
    candidate.userId = sanitizeIdentifier(input.context.userId);
  }

  if (input.context?.autonomyLevel !== undefined) {
    candidate.currentAutonomyLevel = input.context.autonomyLevel;
  }

  if (input.integrationDecision.reasons.length > 0) {
    candidate.blockedReason =
      input.integrationDecision.reasons.join(", ");
  }

  return candidate;
}

function shouldCreatePermissionRequest(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
  reasons: readonly AgentToolSandboxPermissionIntegrationReasonPreview[],
): boolean {
  if (
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.RequirePermissionPreview ||
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.RequireHumanReviewPreview
  ) {
    return true;
  }

  if (
    input.sandboxDecision.allowed &&
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.AllowPreviewOnly
  ) {
    return shouldReviewAllowedPreviewOnly(input);
  }

  return (
    input.sandboxDecision.blockedReasons.some((reason) =>
      CANDIDATE_BLOCK_REASONS.has(reason),
    ) ||
    reasons.includes(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxMediumRiskReadOnlyReview,
    )
  );
}

function shouldRequireHumanReview(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
  reasons: readonly AgentToolSandboxPermissionIntegrationReasonPreview[],
): boolean {
  return (
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.RequireHumanReviewPreview ||
    input.sandboxDecision.blockedReasons.includes(
      AgentToolSandboxBlockReasonPreview.RequiresHumanReview,
    ) ||
    input.sandboxDecision.blockedReasons.includes(
      AgentToolSandboxBlockReasonPreview.RiskTooHigh,
    ) ||
    reasons.includes(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxRiskTooHigh,
    )
  );
}

function shouldBlockWithoutPermission(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
): boolean {
  if (input.sandboxDecision.blockedReasons.some(isDangerousBlockReason)) {
    return true;
  }

  if (DANGEROUS_SIDE_EFFECT_LEVELS.has(input.sandboxDecision.sideEffectLevel)) {
    return true;
  }

  if (metadataHasSensitiveKeys(input.sandboxRequest.metadata)) {
    return true;
  }

  if (
    input.sandboxDecision.riskLevel ===
    AgentToolSandboxRiskLevelPreview.Unknown
  ) {
    return true;
  }

  if (
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.BlockPreview &&
    input.sandboxDecision.blockedReasons.length === 0
  ) {
    return true;
  }

  return input.sandboxDecision.blockedReasons.includes(
    AgentToolSandboxBlockReasonPreview.PreviewOnlyBoundary,
  );
}

function shouldReviewAllowedPreviewOnly(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
): boolean {
  if (
    input.sandboxDecision.riskLevel ===
    AgentToolSandboxRiskLevelPreview.Medium
  ) {
    return true;
  }

  const warnings = input.sandboxDecision.warnings.map((warning) =>
    warning.toLowerCase(),
  );

  return warnings.some(
    (warning) =>
      warning.includes("permission") ||
      warning.includes("confirm") ||
      warning.includes("human review") ||
      warning.includes("medium risk"),
  );
}

function getIntegrationReasons(
  input: EvaluateToolSandboxPermissionNeedPreviewInput,
): AgentToolSandboxPermissionIntegrationReasonPreview[] {
  const reasons: AgentToolSandboxPermissionIntegrationReasonPreview[] = [];

  if (
    input.sandboxDecision.decisionKind ===
    AgentToolSandboxDecisionKindPreview.RequirePermissionPreview
  ) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxRequiresPermissionPreview,
    );
  }

  if (
    input.sandboxDecision.decisionKind ===
    AgentToolSandboxDecisionKindPreview.RequireHumanReviewPreview
  ) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxRequiresHumanReviewPreview,
    );
  }

  if (
    input.sandboxDecision.decisionKind ===
    AgentToolSandboxDecisionKindPreview.BlockPreview
  ) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxBlockedByPolicy,
    );
  }

  if (
    input.sandboxDecision.allowed &&
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.AllowPreviewOnly
  ) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxAllowedPreviewOnly,
    );
  }

  for (const reason of input.sandboxDecision.blockedReasons) {
    reasons.push(...mapBlockReasonToIntegrationReasons(reason));
  }

  reasons.push(
    ...mapSideEffectToIntegrationReasons(
      input.sandboxDecision.sideEffectLevel,
    ),
  );

  if (metadataHasSensitiveKeys(input.sandboxRequest.metadata)) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxUnsafeMetadata,
    );
  }

  if (
    input.sandboxDecision.riskLevel ===
    AgentToolSandboxRiskLevelPreview.Medium
  ) {
    reasons.push(
      AgentToolSandboxPermissionIntegrationReasonPreview
        .SandboxMediumRiskReadOnlyReview,
    );
  }

  return normalizeIntegrationReasons(reasons);
}

function mapBlockReasonToIntegrationReasons(
  reason: AgentToolSandboxBlockReasonPreviewValue,
): AgentToolSandboxPermissionIntegrationReasonPreview[] {
  switch (reason) {
    case AgentToolSandboxBlockReasonPreview.RequiresPermission:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxRequiresPermissionPreview,
      ];
    case AgentToolSandboxBlockReasonPreview.RequiresHumanReview:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxRequiresHumanReviewPreview,
      ];
    case AgentToolSandboxBlockReasonPreview.RiskTooHigh:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxRiskTooHigh,
      ];
    case AgentToolSandboxBlockReasonPreview.CredentialAccessDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxCredentialAccessRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.ShellCommandDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxCommandExecutionRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.FileSystemReadDisabled:
    case AgentToolSandboxBlockReasonPreview.FileSystemWriteDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxFileSystemRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.NetworkAccessDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxNetworkAccessRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.DatabaseAccessDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxExternalSideEffectRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.BrowserAutomationDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxExternalSideEffectRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.ExternalSideEffectDisabled:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxExternalSideEffectRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.UnknownTool:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnknownTool,
      ];
    case AgentToolSandboxBlockReasonPreview.UnsupportedCapability:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnsupportedCapability,
      ];
    case AgentToolSandboxBlockReasonPreview.UnsupportedSideEffectLevel:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnsupportedSideEffectLevel,
      ];
    case AgentToolSandboxBlockReasonPreview.UnknownRisk:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnknownRisk,
      ];
    case AgentToolSandboxBlockReasonPreview.UnsafeMetadata:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnsafeMetadata,
      ];
    case AgentToolSandboxBlockReasonPreview.ToolNotAllowlisted:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxNotAllowlisted,
      ];
    case AgentToolSandboxBlockReasonPreview.MissingPurposeSummary:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxMissingPurposeSummary,
      ];
    case AgentToolSandboxBlockReasonPreview.PreviewOnlyBoundary:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxBlockedByPolicy,
      ];
  }
}

function mapSideEffectToIntegrationReasons(
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview,
): AgentToolSandboxPermissionIntegrationReasonPreview[] {
  switch (sideEffectLevel) {
    case AgentToolSandboxSideEffectLevelPreview.LocalWrite:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxFileSystemRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.ExternalWrite:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxExternalSideEffectRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.CommandExecution:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxCommandExecutionRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.CredentialAccess:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxCredentialAccessRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.ExternalRead:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxNetworkAccessRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.Unknown:
      return [
        AgentToolSandboxPermissionIntegrationReasonPreview
          .SandboxUnknownRisk,
      ];
    case AgentToolSandboxSideEffectLevelPreview.None:
    case AgentToolSandboxSideEffectLevelPreview.ReadOnly:
      return [];
  }
}

function createIntegrationDecisionMessage(input: {
  readonly shouldCreatePermissionRequestPreview: boolean;
  readonly shouldRequireHumanReviewPreview: boolean;
  readonly shouldBlockWithoutPermissionPreview: boolean;
  readonly sandboxDecision: AgentToolSandboxDecisionPreview;
  readonly reasons: readonly AgentToolSandboxPermissionIntegrationReasonPreview[];
}): string {
  if (input.shouldBlockWithoutPermissionPreview) {
    return [
      "Tool sandbox permission integration preview is blocked without creating a normal permission request candidate.",
      "The sandbox decision includes risks that must not be bypassed by preview permission.",
      `Reasons: ${input.reasons.join(", ")}.`,
    ].join(" ");
  }

  if (input.shouldRequireHumanReviewPreview) {
    return "Tool sandbox decision preview would need human review before any future runtime boundary. This is not a real approval flow.";
  }

  if (input.shouldCreatePermissionRequestPreview) {
    return "Tool sandbox decision preview can produce a permission request preview candidate. This candidate is not executable and captures no decision.";
  }

  if (
    input.sandboxDecision.allowed &&
    input.sandboxDecision.decisionKind ===
      AgentToolSandboxDecisionKindPreview.AllowPreviewOnly
  ) {
    return "Tool sandbox decision preview is allow_preview_only, so no permission request preview candidate is needed by default. Real execution remains disabled.";
  }

  return "Tool sandbox decision preview does not create a permission request candidate. Real execution remains disabled.";
}

function createIntegrationResultMessage(input: {
  readonly integrationDecision: AgentToolSandboxPermissionIntegrationDecisionPreview;
  readonly hasCandidate: boolean;
}): string {
  if (input.integrationDecision.shouldBlockWithoutPermissionPreview) {
    return "Sandbox permission integration preview produced a block summary only; it does not create an approvable permission request.";
  }

  if (input.hasCandidate) {
    return "Sandbox permission integration preview produced a safe permission request candidate for later preview wiring.";
  }

  return "Sandbox permission integration preview completed without a permission request candidate.";
}

function createIntegrationWarnings(input: {
  readonly source: AgentToolSandboxPermissionRequestSourcePreview;
  readonly integrationDecision: AgentToolSandboxPermissionIntegrationDecisionPreview;
  readonly sandboxDecision: AgentToolSandboxDecisionPreview;
}): string[] {
  return normalizeUniqueStrings([
    ...input.source.sandboxWarnings,
    "Sandbox permission integration is preview-only.",
    "No permission request was saved.",
    "No permission decision was captured.",
    "No tool was executed.",
    "No LLM was called.",
    "No network request was made.",
    "No database was read or written.",
    ...(input.source.metadataSummary?.sensitiveMetadataDetected === true
      ? ["Sensitive metadata keys were detected and redacted from the source summary."]
      : []),
    ...(input.integrationDecision.shouldBlockWithoutPermissionPreview
      ? ["Blocked sandbox decisions are not converted into approvable permission requests."]
      : []),
    ...(input.sandboxDecision.allowed
      ? ["allow_preview_only does not authorize runtime execution."]
      : []),
  ]);
}

function createCandidateDescription(input: {
  readonly source: AgentToolSandboxPermissionRequestSourcePreview;
  readonly integrationDecision: AgentToolSandboxPermissionIntegrationDecisionPreview;
}): string {
  return [
    `Sandbox request ${input.source.requestId} for tool ${input.source.toolKey} would need future permission preview handling.`,
    `Capability: ${input.source.requestedCapability}.`,
    `Side effect level: ${input.source.requestedSideEffectLevel}.`,
    `Risk level: ${input.integrationDecision.riskLevel}.`,
    "This candidate cannot approve, authorize, save, or execute anything.",
  ].join(" ");
}

function createCandidateSafetyNotes(
  decision: AgentToolSandboxPermissionIntegrationDecisionPreview,
): string[] {
  return normalizeUniqueStrings([
    "This is a permission request preview candidate derived from a tool sandbox decision preview.",
    "It is not a real permission request.",
    "It does not capture Approve, Reject, Confirm, or any real user decision.",
    "It cannot bypass the tool sandbox.",
    "No tool was executed.",
    "No LLM was called.",
    "No permission request or decision was saved.",
    ...(decision.shouldRequireHumanReviewPreview
      ? ["Human review is preview-only and not implemented as an action."]
      : []),
  ]);
}

function getCandidateSeverity(
  decision: AgentToolSandboxPermissionIntegrationDecisionPreview,
): AgentPermissionRequestSeverityValue {
  if (decision.riskLevel === AgentToolSandboxRiskLevelPreview.High) {
    return AgentPermissionRequestSeverity.Required;
  }

  if (decision.riskLevel === AgentToolSandboxRiskLevelPreview.Critical) {
    return AgentPermissionRequestSeverity.Blocked;
  }

  return AgentPermissionRequestSeverity.Required;
}

function createCandidateRequestId(
  source: AgentToolSandboxPermissionRequestSourcePreview,
  context: AgentToolSandboxPermissionIntegrationContextPreview | undefined,
): string {
  return `tool_sandbox_permission_candidate_${hashString(
    [
      source.requestId,
      source.toolKey,
      source.sandboxDecisionKind,
      source.riskLevel,
      context?.taskId ?? "",
      context?.runtimeId ?? "",
      context?.autonomyLevel ?? "",
    ].join("|"),
  )}`;
}

function isDangerousBlockReason(
  reason: AgentToolSandboxBlockReasonPreviewValue,
): boolean {
  return DANGEROUS_BLOCK_REASONS.has(reason);
}

function createMetadataSummary(
  metadata: AgentMetadata | undefined,
): AgentToolSandboxPermissionMetadataSummaryPreview | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const keys = collectMetadataKeys(metadata);
  const safeKeys = normalizeUniqueStrings(
    keys
      .filter((key) => !isSensitiveMetadataKey(key))
      .map(sanitizeMetadataKeyForSummary),
  ).filter((key) => key.length > 0);
  const visibleSafeKeys = safeKeys.slice(0, MAX_SAFE_METADATA_KEYS);
  const redactedSensitiveKeyCount = keys.filter(isSensitiveMetadataKey).length;

  return {
    metadataKeyCount: keys.length,
    safeMetadataKeys: visibleSafeKeys,
    sensitiveMetadataDetected: redactedSensitiveKeyCount > 0,
    redactedSensitiveKeyCount,
    truncated: safeKeys.length > visibleSafeKeys.length,
  };
}

function metadataHasSensitiveKeys(
  metadata: AgentMetadata | undefined,
): boolean {
  return (
    metadata !== undefined &&
    collectMetadataKeys(metadata).some(isSensitiveMetadataKey)
  );
}

function collectMetadataKeys(metadata: AgentMetadata): string[] {
  const keys: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value === null || typeof value !== "object") {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      visit(child);
    }
  };

  visit(metadata);

  return normalizeUniqueStrings(keys);
}

function isSensitiveMetadataKey(key: string): boolean {
  return SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key));
}

function sanitizePurposeSummary(input: {
  readonly purposeSummary: string;
  readonly sandboxDecision: AgentToolSandboxDecisionPreview;
}): string {
  if (
    input.sandboxDecision.sideEffectLevel ===
      AgentToolSandboxSideEffectLevelPreview.CommandExecution ||
    input.sandboxDecision.sideEffectLevel ===
      AgentToolSandboxSideEffectLevelPreview.CredentialAccess ||
    input.sandboxDecision.blockedReasons.includes(
      AgentToolSandboxBlockReasonPreview.UnsafeMetadata,
    ) ||
    input.sandboxDecision.blockedReasons.includes(
      AgentToolSandboxBlockReasonPreview.ShellCommandDisabled,
    ) ||
    input.sandboxDecision.blockedReasons.includes(
      AgentToolSandboxBlockReasonPreview.CredentialAccessDisabled,
    )
  ) {
    return "Purpose summary withheld because command, credential, or unsafe metadata risk was detected in preview.";
  }

  return sanitizeText(input.purposeSummary);
}

function sanitizeWarnings(warnings: readonly string[]): string[] {
  return normalizeUniqueStrings(warnings.map(sanitizeText));
}

function sanitizeText(value: string): string {
  const redacted = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /\b(api[-_ ]?key|token|authorization|cookie|password|secret|credential)s?\b\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    );

  return redacted.length > MAX_TEXT_LENGTH
    ? `${redacted.slice(0, MAX_TEXT_LENGTH - 3)}...`
    : redacted;
}

function sanitizeIdentifier(value: string): string {
  return sanitizeText(value).replace(/[^\w:./@-]/g, "_");
}

function sanitizeMetadataKeyForSummary(value: string): string {
  return value.replace(/[^\w.-]/g, "_").slice(0, 64);
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeBlockReasons(
  values: readonly AgentToolSandboxBlockReasonPreviewValue[],
): AgentToolSandboxBlockReasonPreviewValue[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentToolSandboxBlockReasonPreviewValue[];
}

function normalizeIntegrationReasons(
  values: readonly AgentToolSandboxPermissionIntegrationReasonPreview[],
): AgentToolSandboxPermissionIntegrationReasonPreview[] {
  return normalizeUniqueStrings(
    values,
  ) as AgentToolSandboxPermissionIntegrationReasonPreview[];
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
