import {
  AutonomyRiskLevel,
  type AutonomyRiskLevel as KnownRiskLevel,
} from "../autonomy/types";
import { compareRiskLevel } from "../autonomy/risk";
import type { AgentMetadata } from "./types";

export const AgentToolSandboxCapabilityPreview = {
  ReadProjectMetadata: "read_project_metadata",
  ReadLearningProgress: "read_learning_progress",
  ReadAgentPreviewRecord: "read_agent_preview_record",
  ReadRuntimePreviewRecord: "read_runtime_preview_record",
  ReadPermissionPreviewRecord: "read_permission_preview_record",
  ReadBookChapterMetadata: "read_book_chapter_metadata",
  SearchLocalPreviewIndex: "search_local_preview_index",
  InspectNonSensitiveStatus: "inspect_non_sensitive_status",
  GenerateStaticPreviewSummary: "generate_static_preview_summary",
} as const;

export type AgentToolSandboxCapabilityPreview =
  (typeof AgentToolSandboxCapabilityPreview)[keyof typeof AgentToolSandboxCapabilityPreview];

export const AgentToolSandboxRiskLevelPreview = {
  Low: AutonomyRiskLevel.Low,
  Medium: AutonomyRiskLevel.Medium,
  High: AutonomyRiskLevel.High,
  Critical: AutonomyRiskLevel.Critical,
  Unknown: "unknown",
} as const;

export type AgentToolSandboxRiskLevelPreview =
  (typeof AgentToolSandboxRiskLevelPreview)[keyof typeof AgentToolSandboxRiskLevelPreview];

export const AgentToolSandboxSideEffectLevelPreview = {
  None: "none",
  ReadOnly: "read_only",
  ExternalRead: "external_read",
  LocalWrite: "local_write",
  ExternalWrite: "external_write",
  CommandExecution: "command_execution",
  CredentialAccess: "credential_access",
  Unknown: "unknown",
} as const;

export type AgentToolSandboxSideEffectLevelPreview =
  (typeof AgentToolSandboxSideEffectLevelPreview)[keyof typeof AgentToolSandboxSideEffectLevelPreview];

export const AgentToolSandboxPolicyModePreview = {
  LowRiskReadOnlyPreview: "low_risk_read_only_preview",
  DisabledPreview: "disabled_preview",
} as const;

export type AgentToolSandboxPolicyModePreview =
  (typeof AgentToolSandboxPolicyModePreview)[keyof typeof AgentToolSandboxPolicyModePreview];

export const AgentToolSandboxDecisionKindPreview = {
  AllowPreviewOnly: "allow_preview_only",
  BlockPreview: "block_preview",
  RequirePermissionPreview: "require_permission_preview",
  RequireHumanReviewPreview: "require_human_review_preview",
} as const;

export type AgentToolSandboxDecisionKindPreview =
  (typeof AgentToolSandboxDecisionKindPreview)[keyof typeof AgentToolSandboxDecisionKindPreview];

export const AgentToolSandboxBlockReasonPreview = {
  PreviewOnlyBoundary: "preview_only_boundary",
  ToolNotAllowlisted: "tool_not_allowlisted",
  UnknownTool: "unknown_tool",
  UnsupportedCapability: "unsupported_capability",
  UnsupportedSideEffectLevel: "unsupported_side_effect_level",
  RiskTooHigh: "risk_too_high",
  RequiresPermission: "requires_permission",
  RequiresHumanReview: "requires_human_review",
  FileSystemReadDisabled: "file_system_read_disabled",
  FileSystemWriteDisabled: "file_system_write_disabled",
  ShellCommandDisabled: "shell_command_disabled",
  NetworkAccessDisabled: "network_access_disabled",
  DatabaseAccessDisabled: "database_access_disabled",
  BrowserAutomationDisabled: "browser_automation_disabled",
  CredentialAccessDisabled: "credential_access_disabled",
  ExternalSideEffectDisabled: "external_side_effect_disabled",
  MissingPurposeSummary: "missing_purpose_summary",
  UnsafeMetadata: "unsafe_metadata",
  UnknownRisk: "unknown_risk",
} as const;

export type AgentToolSandboxBlockReasonPreview =
  (typeof AgentToolSandboxBlockReasonPreview)[keyof typeof AgentToolSandboxBlockReasonPreview];

export const AgentToolSandboxActorKindPreview = {
  User: "user",
  System: "system",
  AgentPreview: "agent_preview",
  RuntimePreview: "runtime_preview",
  Unknown: "unknown",
} as const;

export type AgentToolSandboxActorKindPreview =
  (typeof AgentToolSandboxActorKindPreview)[keyof typeof AgentToolSandboxActorKindPreview];

export interface AgentToolSandboxBoundaryFlagsPreview {
  previewOnly: true;
  executable: false;
  realToolExecutionEnabled: false;
  fileSystemReadEnabled: false;
  fileSystemWriteEnabled: false;
  shellCommandEnabled: false;
  networkAccessEnabled: false;
  databaseAccessEnabled: false;
  browserAutomationEnabled: false;
  credentialAccessEnabled: false;
  externalSideEffectEnabled: false;
  permissionConfirmationEnabled: false;
}

export interface AgentToolAllowlistEntryPreview {
  toolKey: string;
  displayName: string;
  capability: AgentToolSandboxCapabilityPreview;
  description: string;
  riskLevel: AgentToolSandboxRiskLevelPreview;
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview;
  allowedInReadOnlySandbox: boolean;
  requiresPermissionPreview: boolean;
  disabledReason?: string;
  metadata?: AgentMetadata;
}

export interface AgentToolSandboxPolicyPreview {
  policyKey: string;
  displayName: string;
  description: string;
  mode: AgentToolSandboxPolicyModePreview;
  allowedCapabilities: readonly AgentToolSandboxCapabilityPreview[];
  blockedCapabilities: readonly AgentToolSandboxCapabilityPreview[];
  allowedSideEffectLevels: readonly AgentToolSandboxSideEffectLevelPreview[];
  blockedSideEffectLevels: readonly AgentToolSandboxSideEffectLevelPreview[];
  maxRiskLevel: AgentToolSandboxRiskLevelPreview;
  requireAllowlistEntry: boolean;
  requirePermissionForMediumRisk: boolean;
  denyByDefault: boolean;
  boundaryFlags: AgentToolSandboxBoundaryFlagsPreview;
  createdForPreviewOnly: true;
}

export interface AgentToolSandboxRequestPreview {
  requestId: string;
  toolKey: string;
  requestedCapability: AgentToolSandboxCapabilityPreview;
  requestedSideEffectLevel: AgentToolSandboxSideEffectLevelPreview;
  declaredRiskLevel: AgentToolSandboxRiskLevelPreview;
  purposeSummary: string;
  inputSummary?: string;
  targetResourceKind?: string;
  targetResourceLabel?: string;
  requestedByActorKind?: AgentToolSandboxActorKindPreview;
  metadata?: AgentMetadata;
}

export interface AgentToolSandboxDecisionPreview {
  requestId: string;
  toolKey: string;
  allowed: boolean;
  decisionKind: AgentToolSandboxDecisionKindPreview;
  riskLevel: AgentToolSandboxRiskLevelPreview;
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview;
  blockedReasons: readonly AgentToolSandboxBlockReasonPreview[];
  warnings: readonly string[];
  matchedAllowlistEntry?: AgentToolAllowlistEntryPreview;
  policyKey: string;
  boundaryFlags: AgentToolSandboxBoundaryFlagsPreview;
  message: string;
}

export interface AgentToolSandboxEvaluationPreview {
  request: AgentToolSandboxRequestPreview;
  policy: AgentToolSandboxPolicyPreview;
  decision: AgentToolSandboxDecisionPreview;
  evaluatedAt?: string;
  notes?: readonly string[];
}

export interface EvaluateReadOnlyToolSandboxRequestPreviewInput {
  request: AgentToolSandboxRequestPreview;
  policy?: AgentToolSandboxPolicyPreview;
  allowlist?: readonly AgentToolAllowlistEntryPreview[];
  now?: string;
}

const DEFAULT_READ_ONLY_POLICY_KEY = "default_low_risk_read_only_preview";

const DEFAULT_ALLOWED_CAPABILITIES = [
  AgentToolSandboxCapabilityPreview.ReadAgentPreviewRecord,
  AgentToolSandboxCapabilityPreview.ReadRuntimePreviewRecord,
  AgentToolSandboxCapabilityPreview.ReadPermissionPreviewRecord,
  AgentToolSandboxCapabilityPreview.InspectNonSensitiveStatus,
  AgentToolSandboxCapabilityPreview.GenerateStaticPreviewSummary,
] as const satisfies readonly AgentToolSandboxCapabilityPreview[];

const DEFAULT_BLOCKED_CAPABILITIES = [
  AgentToolSandboxCapabilityPreview.ReadProjectMetadata,
  AgentToolSandboxCapabilityPreview.ReadLearningProgress,
  AgentToolSandboxCapabilityPreview.ReadBookChapterMetadata,
  AgentToolSandboxCapabilityPreview.SearchLocalPreviewIndex,
] as const satisfies readonly AgentToolSandboxCapabilityPreview[];

const DEFAULT_ALLOWED_SIDE_EFFECT_LEVELS = [
  AgentToolSandboxSideEffectLevelPreview.None,
  AgentToolSandboxSideEffectLevelPreview.ReadOnly,
] as const satisfies readonly AgentToolSandboxSideEffectLevelPreview[];

const DEFAULT_BLOCKED_SIDE_EFFECT_LEVELS = [
  AgentToolSandboxSideEffectLevelPreview.ExternalRead,
  AgentToolSandboxSideEffectLevelPreview.LocalWrite,
  AgentToolSandboxSideEffectLevelPreview.ExternalWrite,
  AgentToolSandboxSideEffectLevelPreview.CommandExecution,
  AgentToolSandboxSideEffectLevelPreview.CredentialAccess,
  AgentToolSandboxSideEffectLevelPreview.Unknown,
] as const satisfies readonly AgentToolSandboxSideEffectLevelPreview[];

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

const MIN_PURPOSE_SUMMARY_LENGTH = 8;

export function createReadOnlyToolSandboxBoundaryFlagsPreview(): AgentToolSandboxBoundaryFlagsPreview {
  return {
    previewOnly: true,
    executable: false,
    realToolExecutionEnabled: false,
    fileSystemReadEnabled: false,
    fileSystemWriteEnabled: false,
    shellCommandEnabled: false,
    networkAccessEnabled: false,
    databaseAccessEnabled: false,
    browserAutomationEnabled: false,
    credentialAccessEnabled: false,
    externalSideEffectEnabled: false,
    permissionConfirmationEnabled: false,
  };
}

export function createDefaultReadOnlyToolSandboxPolicyPreview(): AgentToolSandboxPolicyPreview {
  return {
    policyKey: DEFAULT_READ_ONLY_POLICY_KEY,
    displayName: "Default low-risk read-only tool sandbox policy preview",
    description:
      "Preview-only policy boundary for future low-risk read-only tool requests. It does not execute tools.",
    mode: AgentToolSandboxPolicyModePreview.LowRiskReadOnlyPreview,
    allowedCapabilities: [...DEFAULT_ALLOWED_CAPABILITIES],
    blockedCapabilities: [...DEFAULT_BLOCKED_CAPABILITIES],
    allowedSideEffectLevels: [...DEFAULT_ALLOWED_SIDE_EFFECT_LEVELS],
    blockedSideEffectLevels: [...DEFAULT_BLOCKED_SIDE_EFFECT_LEVELS],
    maxRiskLevel: AgentToolSandboxRiskLevelPreview.Low,
    requireAllowlistEntry: true,
    requirePermissionForMediumRisk: true,
    denyByDefault: true,
    boundaryFlags: createReadOnlyToolSandboxBoundaryFlagsPreview(),
    createdForPreviewOnly: true,
  };
}

export function createDefaultReadOnlyToolAllowlistPreview(): AgentToolAllowlistEntryPreview[] {
  return [
    {
      toolKey: "read_agent_preview_record",
      displayName: "Read Agent preview record",
      capability: AgentToolSandboxCapabilityPreview.ReadAgentPreviewRecord,
      description:
        "Preview label for a future read-only Agent preview record lookup. No lookup is implemented here.",
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      allowedInReadOnlySandbox: true,
      requiresPermissionPreview: false,
    },
    {
      toolKey: "read_runtime_preview_record",
      displayName: "Read runtime preview record",
      capability: AgentToolSandboxCapabilityPreview.ReadRuntimePreviewRecord,
      description:
        "Preview label for a future read-only runtime preview record lookup. No lookup is implemented here.",
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      allowedInReadOnlySandbox: true,
      requiresPermissionPreview: false,
    },
    {
      toolKey: "read_permission_preview_record",
      displayName: "Read permission preview record",
      capability: AgentToolSandboxCapabilityPreview.ReadPermissionPreviewRecord,
      description:
        "Preview label for a future read-only permission preview record lookup. No lookup is implemented here.",
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      allowedInReadOnlySandbox: true,
      requiresPermissionPreview: false,
    },
    {
      toolKey: "inspect_non_sensitive_status",
      displayName: "Inspect non-sensitive status",
      capability: AgentToolSandboxCapabilityPreview.InspectNonSensitiveStatus,
      description:
        "Preview label for inspecting non-sensitive status metadata supplied to the evaluator.",
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      allowedInReadOnlySandbox: true,
      requiresPermissionPreview: false,
    },
    {
      toolKey: "generate_static_preview_summary",
      displayName: "Generate static preview summary",
      capability:
        AgentToolSandboxCapabilityPreview.GenerateStaticPreviewSummary,
      description:
        "Preview label for deterministic static summary generation from caller-provided preview metadata.",
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.None,
      allowedInReadOnlySandbox: true,
      requiresPermissionPreview: false,
    },
  ];
}

export function evaluateReadOnlyToolSandboxRequestPreview(
  input: EvaluateReadOnlyToolSandboxRequestPreviewInput,
): AgentToolSandboxDecisionPreview {
  const policy =
    input.policy ?? createDefaultReadOnlyToolSandboxPolicyPreview();
  const allowlist =
    input.allowlist ?? createDefaultReadOnlyToolAllowlistPreview();
  const boundaryFlags = createReadOnlyToolSandboxBoundaryFlagsPreview();
  const matchedAllowlistEntry = findAllowlistEntry(
    input.request.toolKey,
    allowlist,
  );
  const effectiveRiskLevel = getEffectiveRiskLevel(
    input.request.declaredRiskLevel,
    matchedAllowlistEntry?.riskLevel,
  );
  const sideEffectLevel = input.request.requestedSideEffectLevel;
  const directBlockReasons = normalizeBlockReasons([
    ...getPolicyModeBlockReasons(policy),
    ...getAllowlistBlockReasons({
      request: input.request,
      policy,
      matchedAllowlistEntry,
    }),
    ...getCapabilityBlockReasons(input.request, policy),
    ...getSideEffectBlockReasons(sideEffectLevel, policy),
    ...getBoundaryBlockReasons(input.request, sideEffectLevel, boundaryFlags),
    ...getMetadataBlockReasons(input.request.metadata),
    ...getPurposeBlockReasons(input.request.purposeSummary),
    ...getUnknownRiskBlockReasons(effectiveRiskLevel),
  ]);
  const permissionBlockReasons = getPermissionBlockReasons({
    effectiveRiskLevel,
    policy,
    matchedAllowlistEntry,
  });
  const humanReviewBlockReasons = getHumanReviewBlockReasons(effectiveRiskLevel);
  const blockedReasons = normalizeBlockReasons([
    ...directBlockReasons,
    ...permissionBlockReasons,
    ...humanReviewBlockReasons,
  ]);
  const decisionKind = getDecisionKind({
    directBlockReasons,
    permissionBlockReasons,
    humanReviewBlockReasons,
  });
  const allowed =
    decisionKind === AgentToolSandboxDecisionKindPreview.AllowPreviewOnly;
  const warnings = createDecisionWarnings({
    allowed,
    policy,
    matchedAllowlistEntry,
  });

  return {
    requestId: input.request.requestId,
    toolKey: input.request.toolKey,
    allowed,
    decisionKind,
    riskLevel: effectiveRiskLevel,
    sideEffectLevel,
    blockedReasons,
    warnings,
    matchedAllowlistEntry:
      matchedAllowlistEntry === undefined
        ? undefined
        : sanitizeAllowlistEntryForDecision(matchedAllowlistEntry),
    policyKey: policy.policyKey,
    boundaryFlags,
    message: createDecisionMessage({
      allowed,
      decisionKind,
      blockedReasons,
    }),
  };
}

export function explainToolSandboxDecisionPreview(
  decision: AgentToolSandboxDecisionPreview,
): string {
  if (decision.allowed) {
    return [
      `Tool sandbox decision preview ${decision.requestId} is allow_preview_only.`,
      "No real tool execution is enabled by this decision.",
      "Boundary flags still disable tool execution, filesystem, shell, network, database, browser automation, credentials, external side effects, and permission confirmation.",
    ].join(" ");
  }

  return [
    `Tool sandbox decision preview ${decision.requestId} is ${decision.decisionKind}.`,
    `Blocked reasons: ${decision.blockedReasons.join(", ")}.`,
    "No real tool execution occurred.",
  ].join(" ");
}

function findAllowlistEntry(
  toolKey: string,
  allowlist: readonly AgentToolAllowlistEntryPreview[],
): AgentToolAllowlistEntryPreview | undefined {
  const normalizedToolKey = normalizeKey(toolKey);

  return allowlist.find(
    (entry) => normalizeKey(entry.toolKey) === normalizedToolKey,
  );
}

function getEffectiveRiskLevel(
  declaredRiskLevel: AgentToolSandboxRiskLevelPreview,
  allowlistRiskLevel: AgentToolSandboxRiskLevelPreview | undefined,
): AgentToolSandboxRiskLevelPreview {
  if (!isAgentToolSandboxRiskLevelPreview(declaredRiskLevel)) {
    return AgentToolSandboxRiskLevelPreview.Unknown;
  }

  if (
    allowlistRiskLevel === undefined ||
    !isAgentToolSandboxRiskLevelPreview(allowlistRiskLevel)
  ) {
    return declaredRiskLevel;
  }

  if (
    declaredRiskLevel === AgentToolSandboxRiskLevelPreview.Unknown ||
    allowlistRiskLevel === AgentToolSandboxRiskLevelPreview.Unknown
  ) {
    return AgentToolSandboxRiskLevelPreview.Unknown;
  }

  return compareRiskLevel(declaredRiskLevel, allowlistRiskLevel) >= 0
    ? declaredRiskLevel
    : allowlistRiskLevel;
}

function getAllowlistBlockReasons(input: {
  readonly request: AgentToolSandboxRequestPreview;
  readonly policy: AgentToolSandboxPolicyPreview;
  readonly matchedAllowlistEntry: AgentToolAllowlistEntryPreview | undefined;
}): AgentToolSandboxBlockReasonPreview[] {
  if (!input.policy.requireAllowlistEntry) {
    return [];
  }

  if (input.matchedAllowlistEntry === undefined) {
    return [
      AgentToolSandboxBlockReasonPreview.UnknownTool,
      AgentToolSandboxBlockReasonPreview.ToolNotAllowlisted,
    ];
  }

  const reasons: AgentToolSandboxBlockReasonPreview[] = [];

  if (!input.matchedAllowlistEntry.allowedInReadOnlySandbox) {
    reasons.push(AgentToolSandboxBlockReasonPreview.ToolNotAllowlisted);
  }

  if (input.matchedAllowlistEntry.disabledReason !== undefined) {
    reasons.push(AgentToolSandboxBlockReasonPreview.ToolNotAllowlisted);
  }

  if (
    input.matchedAllowlistEntry.capability !==
    input.request.requestedCapability
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.UnsupportedCapability);
  }

  if (
    !input.policy.allowedSideEffectLevels.includes(
      input.matchedAllowlistEntry.sideEffectLevel,
    )
  ) {
    reasons.push(
      AgentToolSandboxBlockReasonPreview.UnsupportedSideEffectLevel,
    );
  }

  return reasons;
}

function getPolicyModeBlockReasons(
  policy: AgentToolSandboxPolicyPreview,
): AgentToolSandboxBlockReasonPreview[] {
  return policy.mode === AgentToolSandboxPolicyModePreview.DisabledPreview
    ? [AgentToolSandboxBlockReasonPreview.PreviewOnlyBoundary]
    : [];
}

function getCapabilityBlockReasons(
  request: AgentToolSandboxRequestPreview,
  policy: AgentToolSandboxPolicyPreview,
): AgentToolSandboxBlockReasonPreview[] {
  const isExplicitlyAllowed = policy.allowedCapabilities.includes(
    request.requestedCapability,
  );
  const isExplicitlyBlocked = policy.blockedCapabilities.includes(
    request.requestedCapability,
  );

  if (isExplicitlyBlocked || (policy.denyByDefault && !isExplicitlyAllowed)) {
    return [AgentToolSandboxBlockReasonPreview.UnsupportedCapability];
  }

  return [];
}

function getSideEffectBlockReasons(
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview,
  policy: AgentToolSandboxPolicyPreview,
): AgentToolSandboxBlockReasonPreview[] {
  if (!isAgentToolSandboxSideEffectLevelPreview(sideEffectLevel)) {
    return [
      AgentToolSandboxBlockReasonPreview.UnsupportedSideEffectLevel,
      AgentToolSandboxBlockReasonPreview.ExternalSideEffectDisabled,
    ];
  }

  if (
    policy.blockedSideEffectLevels.includes(sideEffectLevel) ||
    !policy.allowedSideEffectLevels.includes(sideEffectLevel)
  ) {
    return [AgentToolSandboxBlockReasonPreview.UnsupportedSideEffectLevel];
  }

  return [];
}

function getBoundaryBlockReasons(
  request: AgentToolSandboxRequestPreview,
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview,
  boundaryFlags: AgentToolSandboxBoundaryFlagsPreview,
): AgentToolSandboxBlockReasonPreview[] {
  const reasons: AgentToolSandboxBlockReasonPreview[] = [];

  if (
    sideEffectLevel ===
      AgentToolSandboxSideEffectLevelPreview.CommandExecution &&
    !boundaryFlags.shellCommandEnabled
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.ShellCommandDisabled);
  }

  if (
    sideEffectLevel === AgentToolSandboxSideEffectLevelPreview.LocalWrite &&
    !boundaryFlags.fileSystemWriteEnabled
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.FileSystemWriteDisabled);
  }

  if (
    (sideEffectLevel === AgentToolSandboxSideEffectLevelPreview.ExternalRead ||
      sideEffectLevel ===
        AgentToolSandboxSideEffectLevelPreview.ExternalWrite) &&
    !boundaryFlags.networkAccessEnabled
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.NetworkAccessDisabled);
  }

  if (
    sideEffectLevel === AgentToolSandboxSideEffectLevelPreview.ExternalWrite &&
    !boundaryFlags.externalSideEffectEnabled
  ) {
    reasons.push(
      AgentToolSandboxBlockReasonPreview.ExternalSideEffectDisabled,
    );
  }

  if (
    sideEffectLevel ===
      AgentToolSandboxSideEffectLevelPreview.CredentialAccess &&
    !boundaryFlags.credentialAccessEnabled
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.CredentialAccessDisabled);
  }

  if (
    targetSuggestsFileSystem(request) &&
    !boundaryFlags.fileSystemReadEnabled
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.FileSystemReadDisabled);
  }

  if (targetSuggestsDatabase(request) && !boundaryFlags.databaseAccessEnabled) {
    reasons.push(AgentToolSandboxBlockReasonPreview.DatabaseAccessDisabled);
  }

  if (targetSuggestsNetwork(request) && !boundaryFlags.networkAccessEnabled) {
    reasons.push(AgentToolSandboxBlockReasonPreview.NetworkAccessDisabled);
  }

  if (
    targetSuggestsBrowserAutomation(request) &&
    !boundaryFlags.browserAutomationEnabled
  ) {
    reasons.push(
      AgentToolSandboxBlockReasonPreview.BrowserAutomationDisabled,
    );
  }

  return reasons;
}

function getMetadataBlockReasons(
  metadata: AgentMetadata | undefined,
): AgentToolSandboxBlockReasonPreview[] {
  if (metadata === undefined || !hasSensitiveMetadataKey(metadata)) {
    return [];
  }

  return [
    AgentToolSandboxBlockReasonPreview.UnsafeMetadata,
    AgentToolSandboxBlockReasonPreview.CredentialAccessDisabled,
  ];
}

function getPurposeBlockReasons(
  purposeSummary: string,
): AgentToolSandboxBlockReasonPreview[] {
  return purposeSummary.trim().length < MIN_PURPOSE_SUMMARY_LENGTH
    ? [AgentToolSandboxBlockReasonPreview.MissingPurposeSummary]
    : [];
}

function getUnknownRiskBlockReasons(
  riskLevel: AgentToolSandboxRiskLevelPreview,
): AgentToolSandboxBlockReasonPreview[] {
  return riskLevel === AgentToolSandboxRiskLevelPreview.Unknown
    ? [AgentToolSandboxBlockReasonPreview.UnknownRisk]
    : [];
}

function getPermissionBlockReasons(input: {
  readonly effectiveRiskLevel: AgentToolSandboxRiskLevelPreview;
  readonly policy: AgentToolSandboxPolicyPreview;
  readonly matchedAllowlistEntry: AgentToolAllowlistEntryPreview | undefined;
}): AgentToolSandboxBlockReasonPreview[] {
  const reasons: AgentToolSandboxBlockReasonPreview[] = [];

  if (
    input.effectiveRiskLevel === AgentToolSandboxRiskLevelPreview.Medium &&
    input.policy.requirePermissionForMediumRisk
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.RequiresPermission);
  }

  if (
    input.matchedAllowlistEntry?.requiresPermissionPreview === true &&
    input.effectiveRiskLevel !== AgentToolSandboxRiskLevelPreview.High &&
    input.effectiveRiskLevel !== AgentToolSandboxRiskLevelPreview.Critical
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.RequiresPermission);
  }

  if (
    isKnownSandboxRiskLevel(input.effectiveRiskLevel) &&
    isKnownSandboxRiskLevel(input.policy.maxRiskLevel) &&
    compareRiskLevel(input.effectiveRiskLevel, input.policy.maxRiskLevel) >
      0 &&
    input.effectiveRiskLevel === AgentToolSandboxRiskLevelPreview.Medium
  ) {
    reasons.push(AgentToolSandboxBlockReasonPreview.RequiresPermission);
  }

  return reasons;
}

function getHumanReviewBlockReasons(
  riskLevel: AgentToolSandboxRiskLevelPreview,
): AgentToolSandboxBlockReasonPreview[] {
  if (
    riskLevel === AgentToolSandboxRiskLevelPreview.High ||
    riskLevel === AgentToolSandboxRiskLevelPreview.Critical
  ) {
    return [
      AgentToolSandboxBlockReasonPreview.RiskTooHigh,
      AgentToolSandboxBlockReasonPreview.RequiresHumanReview,
    ];
  }

  return [];
}

function getDecisionKind(input: {
  readonly directBlockReasons: readonly AgentToolSandboxBlockReasonPreview[];
  readonly permissionBlockReasons: readonly AgentToolSandboxBlockReasonPreview[];
  readonly humanReviewBlockReasons: readonly AgentToolSandboxBlockReasonPreview[];
}): AgentToolSandboxDecisionKindPreview {
  if (input.directBlockReasons.length > 0) {
    return AgentToolSandboxDecisionKindPreview.BlockPreview;
  }

  if (input.humanReviewBlockReasons.length > 0) {
    return AgentToolSandboxDecisionKindPreview.RequireHumanReviewPreview;
  }

  if (input.permissionBlockReasons.length > 0) {
    return AgentToolSandboxDecisionKindPreview.RequirePermissionPreview;
  }

  return AgentToolSandboxDecisionKindPreview.AllowPreviewOnly;
}

function createDecisionWarnings(input: {
  readonly allowed: boolean;
  readonly policy: AgentToolSandboxPolicyPreview;
  readonly matchedAllowlistEntry: AgentToolAllowlistEntryPreview | undefined;
}): string[] {
  const warnings = [
    "Tool sandbox evaluation is preview-only and does not execute tools.",
    "The returned decision is not a real permission decision or runtime authorization.",
  ];

  if (input.allowed) {
    warnings.push(
      "allow_preview_only only means this request shape may fit a future low-risk read-only sandbox.",
    );
  }

  if (input.policy.boundaryFlags.networkAccessEnabled === false) {
    warnings.push("Network access remains disabled by boundary flags.");
  }

  if (input.matchedAllowlistEntry === undefined) {
    warnings.push("No allowlist entry was matched.");
  }

  return normalizeUniqueStrings(warnings);
}

function createDecisionMessage(input: {
  readonly allowed: boolean;
  readonly decisionKind: AgentToolSandboxDecisionKindPreview;
  readonly blockedReasons: readonly AgentToolSandboxBlockReasonPreview[];
}): string {
  if (input.allowed) {
    return "Tool sandbox policy preview returned allow_preview_only. Real tool execution remains disabled.";
  }

  return [
    `Tool sandbox policy preview returned ${input.decisionKind}.`,
    `Reasons: ${input.blockedReasons.join(", ")}.`,
    "No tool was executed.",
  ].join(" ");
}

function sanitizeAllowlistEntryForDecision(
  entry: AgentToolAllowlistEntryPreview,
): AgentToolAllowlistEntryPreview {
  return {
    toolKey: entry.toolKey,
    displayName: entry.displayName,
    capability: entry.capability,
    description: entry.description,
    riskLevel: entry.riskLevel,
    sideEffectLevel: entry.sideEffectLevel,
    allowedInReadOnlySandbox: entry.allowedInReadOnlySandbox,
    requiresPermissionPreview: entry.requiresPermissionPreview,
    disabledReason: entry.disabledReason,
  };
}

function hasSensitiveMetadataKey(metadata: AgentMetadata): boolean {
  return Object.keys(metadata).some((key) =>
    SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key)),
  );
}

function targetSuggestsFileSystem(
  request: AgentToolSandboxRequestPreview,
): boolean {
  return targetHasAnyKeyword(request, [
    "file",
    "filesystem",
    "path",
    "directory",
    "folder",
    "workspace",
  ]);
}

function targetSuggestsDatabase(
  request: AgentToolSandboxRequestPreview,
): boolean {
  return targetHasAnyKeyword(request, [
    "database",
    "db",
    "prisma",
    "sql",
    "repository",
  ]);
}

function targetSuggestsNetwork(
  request: AgentToolSandboxRequestPreview,
): boolean {
  return targetHasAnyKeyword(request, [
    "network",
    "web",
    "http",
    "https",
    "url",
    "api",
    "external",
  ]);
}

function targetSuggestsBrowserAutomation(
  request: AgentToolSandboxRequestPreview,
): boolean {
  return targetHasAnyKeyword(request, [
    "browser",
    "page",
    "dom",
    "playwright",
    "chrome",
  ]);
}

function targetHasAnyKeyword(
  request: AgentToolSandboxRequestPreview,
  keywords: readonly string[],
): boolean {
  const targetText = normalizeWhitespace(
    `${request.targetResourceKind ?? ""} ${request.targetResourceLabel ?? ""}`,
  );

  return keywords.some((keyword) => targetText.includes(keyword));
}

function isKnownSandboxRiskLevel(
  riskLevel: AgentToolSandboxRiskLevelPreview,
): riskLevel is KnownRiskLevel {
  return (
    riskLevel === AutonomyRiskLevel.Low ||
    riskLevel === AutonomyRiskLevel.Medium ||
    riskLevel === AutonomyRiskLevel.High ||
    riskLevel === AutonomyRiskLevel.Critical
  );
}

function isAgentToolSandboxRiskLevelPreview(
  riskLevel: AgentToolSandboxRiskLevelPreview,
): riskLevel is AgentToolSandboxRiskLevelPreview {
  return Object.values(AgentToolSandboxRiskLevelPreview).includes(riskLevel);
}

function isAgentToolSandboxSideEffectLevelPreview(
  sideEffectLevel: AgentToolSandboxSideEffectLevelPreview,
): sideEffectLevel is AgentToolSandboxSideEffectLevelPreview {
  return Object.values(AgentToolSandboxSideEffectLevelPreview).includes(
    sideEffectLevel,
  );
}

function normalizeBlockReasons(
  values: readonly AgentToolSandboxBlockReasonPreview[],
): AgentToolSandboxBlockReasonPreview[] {
  return normalizeUniqueStrings(values) as AgentToolSandboxBlockReasonPreview[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMetadataKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
