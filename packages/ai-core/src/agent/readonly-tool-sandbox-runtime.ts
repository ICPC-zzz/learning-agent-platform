import {
  AgentToolSandboxActorKindPreview,
  AgentToolSandboxCapabilityPreview,
  AgentToolSandboxDecisionKindPreview,
  AgentToolSandboxRiskLevelPreview,
  AgentToolSandboxSideEffectLevelPreview,
  createDefaultReadOnlyToolSandboxPolicyPreview,
  evaluateReadOnlyToolSandboxRequestPreview,
  type AgentToolAllowlistEntryPreview,
  type AgentToolSandboxActorKindPreview as AgentToolSandboxActorKindPreviewValue,
  type AgentToolSandboxDecisionPreview,
  type AgentToolSandboxPolicyPreview,
  type AgentToolSandboxRequestPreview,
  type AgentToolSandboxRiskLevelPreview as AgentToolSandboxRiskLevelPreviewValue,
  type AgentToolSandboxSideEffectLevelPreview as AgentToolSandboxSideEffectLevelPreviewValue,
} from "./tool-sandbox-preview";
import type { AgentMetadata } from "./types";

export const AgentReadOnlyToolKey = {
  ReadRuntimePreviewStatus: "read_runtime_preview_status",
  ReadAgentPreviewCapabilities: "read_agent_preview_capabilities",
  ReadToolSandboxPolicySummary: "read_tool_sandbox_policy_summary",
  ReadRuntimeBoundaryFlagsSummary: "read_runtime_boundary_flags_summary",
  ReadMockRuntimePreviewSample: "read_mock_runtime_preview_sample",
} as const;

export type AgentReadOnlyToolKey =
  (typeof AgentReadOnlyToolKey)[keyof typeof AgentReadOnlyToolKey];

export const AgentReadOnlyToolBlockedReason = {
  RuntimeDisabled: "runtime_disabled",
  ToolNotAllowlisted: "tool_not_allowlisted",
  DynamicToolsDisabled: "dynamic_tools_disabled",
  PolicyDenied: "policy_denied",
  UnsupportedTool: "unsupported_tool",
  UnsafeMetadata: "unsafe_metadata",
  FileSystemReadForbidden: "file_system_read_forbidden",
  FileSystemWriteForbidden: "file_system_write_forbidden",
  NetworkAccessForbidden: "network_access_forbidden",
  DatabaseAccessForbidden: "database_access_forbidden",
  ShellCommandForbidden: "shell_command_forbidden",
  BrowserAutomationForbidden: "browser_automation_forbidden",
  CredentialAccessForbidden: "credential_access_forbidden",
  LlmCallForbidden: "llm_call_forbidden",
  MissingPurposeSummary: "missing_purpose_summary",
} as const;

export type AgentReadOnlyToolBlockedReason =
  (typeof AgentReadOnlyToolBlockedReason)[keyof typeof AgentReadOnlyToolBlockedReason];

export type AgentReadOnlyToolSandboxRuntimeMode =
  | "disabled"
  | "mock_status_only";

export type AgentReadOnlyToolExecutionStatus =
  | "disabled"
  | "blocked"
  | "allowed_static_readonly";

export type AgentReadOnlyToolSideEffectLevel =
  | typeof AgentToolSandboxSideEffectLevelPreview.None
  | typeof AgentToolSandboxSideEffectLevelPreview.ReadOnly;

export type AgentReadOnlyToolForbiddenOperation =
  | "file_system_read"
  | "file_system_write"
  | "network_access"
  | "database_access"
  | "shell_command"
  | "browser_automation"
  | "credential_access"
  | "llm_call"
  | "dynamic_tool_registration"
  | "permission_bypass";

export interface AgentReadOnlyToolSandboxRuntimeConfig {
  runtimeEnabled: boolean;
  mode: AgentReadOnlyToolSandboxRuntimeMode;
  allowedToolKeys: readonly AgentReadOnlyToolKey[];
  denyByDefault: true;
  allowDynamicTools: false;
  allowFileSystemRead: false;
  allowFileSystemWrite: false;
  allowNetworkAccess: false;
  allowDatabaseAccess: false;
  allowShellCommand: false;
  allowBrowserAutomation: false;
  allowCredentialAccess: false;
  allowLlmCall: false;
  maxResultSummaryLength?: number;
}

export interface AgentReadOnlyToolDefinition {
  toolKey: AgentReadOnlyToolKey;
  displayName: string;
  description: string;
  capability: AgentToolSandboxCapabilityPreview;
  riskLevel: AgentToolSandboxRiskLevelPreviewValue;
  sideEffectLevel: AgentReadOnlyToolSideEffectLevel;
  enabledByDefault: boolean;
  returnsStaticSafeSummary: true;
  requiresPolicyGate: true;
  forbiddenOperations: readonly AgentReadOnlyToolForbiddenOperation[];
}

export interface AgentReadOnlyToolExecutionInput {
  toolKey: string;
  purposeSummary: string;
  requestId?: string;
  actorKind?: AgentToolSandboxActorKindPreviewValue;
  metadata?: AgentMetadata;
}

export interface AgentReadOnlyToolRuntimePreviewStatusSafeData {
  runtimePreviewBoundaryAvailable: true;
  realAgentRuntimeEnabled: false;
  toolExecutionGeneralPurposeEnabled: false;
  llmCallEnabled: false;
  backgroundJobEnabled: false;
}

export interface AgentReadOnlyToolAgentPreviewCapabilitiesSafeData {
  taskPlanPreview: true;
  toolRequirementPreview: true;
  permissionPreview: true;
  runtimePreviewPersistence: true;
  readOnlyToolSandboxSkeleton: true;
  realToolExecution: false;
  realLlmCall: false;
}

export interface AgentReadOnlyToolPolicySummarySafeData {
  denyByDefault: true;
  allowlistRequired: true;
  dynamicToolsEnabled: false;
  dangerousCapabilitiesEnabled: false;
}

export interface AgentReadOnlyToolRuntimeBoundaryFlagsSummarySafeData {
  realExecutionEnabled: false;
  generalToolExecutionEnabled: false;
  toolExecutionEnabled: false;
  llmCallEnabled: false;
  permissionConfirmationEnabled: false;
  backgroundJobEnabled: false;
}

export interface AgentReadOnlyToolMockRuntimePreviewSampleSafeData {
  sampleKind: "mock_runtime_preview";
  message: "这是固定 mock/status 示例，不来自数据库，不来自文件，不来自模型。";
  containsRealToolResult: false;
  containsRealLlmResponse: false;
}

export interface AgentReadOnlyToolSafeData {
  moduleStatus?: AgentReadOnlyToolRuntimePreviewStatusSafeData;
  capabilities?: AgentReadOnlyToolAgentPreviewCapabilitiesSafeData;
  policySummary?: AgentReadOnlyToolPolicySummarySafeData;
  boundaryFlagsSummary?: AgentReadOnlyToolRuntimeBoundaryFlagsSummarySafeData;
  sample?: AgentReadOnlyToolMockRuntimePreviewSampleSafeData;
}

export interface AgentReadOnlyToolExecutionResult {
  ok: boolean;
  executed: boolean;
  toolKey: string;
  status: AgentReadOnlyToolExecutionStatus;
  resultSummary?: string;
  safeData?: AgentReadOnlyToolSafeData;
  blockedReasons: readonly AgentReadOnlyToolBlockedReason[];
  warnings: readonly string[];
  sandboxDecision?: AgentToolSandboxDecisionPreview;
  readOnly: true;
  previewOrMockOnly: true;
  sideEffectLevel: AgentReadOnlyToolSideEffectLevel;
  secretSafe: true;
  networkAccessed: false;
  fileSystemAccessed: false;
  databaseAccessed: false;
  commandExecuted: false;
  llmCalled: false;
  message: string;
}

export interface AgentReadOnlyToolSandboxSkeletonStatus {
  runtimeAvailable: true;
  defaultRuntimeEnabled: false;
  supportedToolCount: number;
  dangerousCapabilitiesEnabled: false;
  networkAccessEnabled: false;
  fileSystemAccessEnabled: false;
  databaseAccessEnabled: false;
  commandExecutionEnabled: false;
  browserAutomationEnabled: false;
  credentialAccessEnabled: false;
  llmCallEnabled: false;
}

export interface ExecuteReadOnlyToolSandboxSkeletonOptions {
  config?: AgentReadOnlyToolSandboxRuntimeConfig;
  definitions?: readonly AgentReadOnlyToolDefinition[];
  policy?: AgentToolSandboxPolicyPreview;
  allowlist?: readonly AgentToolAllowlistEntryPreview[];
  now?: string;
}

interface StaticHandlerResult {
  resultSummary: string;
  safeData: AgentReadOnlyToolSafeData;
}

const ALL_READ_ONLY_TOOL_KEYS = Object.values(AgentReadOnlyToolKey);

const DEFAULT_MAX_RESULT_SUMMARY_LENGTH = 600;

const FORBIDDEN_OPERATIONS = [
  "file_system_read",
  "file_system_write",
  "network_access",
  "database_access",
  "shell_command",
  "browser_automation",
  "credential_access",
  "llm_call",
  "dynamic_tool_registration",
  "permission_bypass",
] as const satisfies readonly AgentReadOnlyToolForbiddenOperation[];

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

export function createDefaultReadOnlyToolSandboxRuntimeConfig(): AgentReadOnlyToolSandboxRuntimeConfig {
  return {
    runtimeEnabled: false,
    mode: "disabled",
    allowedToolKeys: [],
    denyByDefault: true,
    allowDynamicTools: false,
    allowFileSystemRead: false,
    allowFileSystemWrite: false,
    allowNetworkAccess: false,
    allowDatabaseAccess: false,
    allowShellCommand: false,
    allowBrowserAutomation: false,
    allowCredentialAccess: false,
    allowLlmCall: false,
  };
}

export function createMockStatusOnlyReadOnlyToolSandboxRuntimeConfig(): AgentReadOnlyToolSandboxRuntimeConfig {
  return {
    ...createDefaultReadOnlyToolSandboxRuntimeConfig(),
    runtimeEnabled: true,
    mode: "mock_status_only",
    allowedToolKeys: [...ALL_READ_ONLY_TOOL_KEYS],
  };
}

export function createDefaultReadOnlyToolDefinitions(): AgentReadOnlyToolDefinition[] {
  return [
    {
      toolKey: AgentReadOnlyToolKey.ReadRuntimePreviewStatus,
      displayName: "Read runtime preview status",
      description:
        "Returns a fixed non-sensitive summary of runtime preview availability and disabled real execution boundaries.",
      capability: AgentToolSandboxCapabilityPreview.InspectNonSensitiveStatus,
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      enabledByDefault: true,
      returnsStaticSafeSummary: true,
      requiresPolicyGate: true,
      forbiddenOperations: [...FORBIDDEN_OPERATIONS],
    },
    {
      toolKey: AgentReadOnlyToolKey.ReadAgentPreviewCapabilities,
      displayName: "Read Agent preview capabilities",
      description:
        "Returns a fixed safe capability summary for existing Agent preview surfaces.",
      capability: AgentToolSandboxCapabilityPreview.InspectNonSensitiveStatus,
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      enabledByDefault: true,
      returnsStaticSafeSummary: true,
      requiresPolicyGate: true,
      forbiddenOperations: [...FORBIDDEN_OPERATIONS],
    },
    {
      toolKey: AgentReadOnlyToolKey.ReadToolSandboxPolicySummary,
      displayName: "Read tool sandbox policy summary",
      description:
        "Returns a fixed safe summary of deny-by-default policy boundaries for the sandbox skeleton.",
      capability:
        AgentToolSandboxCapabilityPreview.GenerateStaticPreviewSummary,
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.None,
      enabledByDefault: true,
      returnsStaticSafeSummary: true,
      requiresPolicyGate: true,
      forbiddenOperations: [...FORBIDDEN_OPERATIONS],
    },
    {
      toolKey: AgentReadOnlyToolKey.ReadRuntimeBoundaryFlagsSummary,
      displayName: "Read runtime boundary flags summary",
      description:
        "Returns a fixed safe summary of runtime boundary flags with real execution disabled.",
      capability: AgentToolSandboxCapabilityPreview.InspectNonSensitiveStatus,
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.ReadOnly,
      enabledByDefault: true,
      returnsStaticSafeSummary: true,
      requiresPolicyGate: true,
      forbiddenOperations: [...FORBIDDEN_OPERATIONS],
    },
    {
      toolKey: AgentReadOnlyToolKey.ReadMockRuntimePreviewSample,
      displayName: "Read mock runtime preview sample",
      description:
        "Returns a fixed mock/status sample that is not read from files, database, network, or model output.",
      capability:
        AgentToolSandboxCapabilityPreview.GenerateStaticPreviewSummary,
      riskLevel: AgentToolSandboxRiskLevelPreview.Low,
      sideEffectLevel: AgentToolSandboxSideEffectLevelPreview.None,
      enabledByDefault: true,
      returnsStaticSafeSummary: true,
      requiresPolicyGate: true,
      forbiddenOperations: [...FORBIDDEN_OPERATIONS],
    },
  ];
}

export function executeReadOnlyToolSandboxSkeleton(
  input: AgentReadOnlyToolExecutionInput,
  options: ExecuteReadOnlyToolSandboxSkeletonOptions = {},
): AgentReadOnlyToolExecutionResult {
  const config =
    options.config ?? createDefaultReadOnlyToolSandboxRuntimeConfig();
  const definitions =
    options.definitions ?? createDefaultReadOnlyToolDefinitions();
  const definition = findDefinition(input.toolKey, definitions);
  const sideEffectLevel =
    definition?.sideEffectLevel ??
    AgentToolSandboxSideEffectLevelPreview.None;

  if (!config.runtimeEnabled || config.mode === "disabled") {
    return createBlockedResult({
      input,
      sideEffectLevel,
      status: "disabled",
      blockedReasons: [AgentReadOnlyToolBlockedReason.RuntimeDisabled],
      warnings: [
        "Read-only tool sandbox skeleton runtime is disabled by default.",
      ],
      message:
        "Read-only tool sandbox skeleton runtime is disabled. No handler was invoked.",
    });
  }

  const unsafeConfigReasons = getUnsafeConfigBlockReasons(config);
  if (unsafeConfigReasons.length > 0) {
    return createBlockedResult({
      input,
      sideEffectLevel,
      blockedReasons: unsafeConfigReasons,
      warnings: [
        "Read-only tool sandbox skeleton refuses configs that enable dangerous capabilities.",
      ],
      message:
        "Read-only tool sandbox skeleton blocked the request because the runtime config is not safe.",
    });
  }

  if (input.purposeSummary.trim().length === 0) {
    return createBlockedResult({
      input,
      sideEffectLevel,
      blockedReasons: [AgentReadOnlyToolBlockedReason.MissingPurposeSummary],
      warnings: ["A short non-sensitive purpose summary is required."],
      message:
        "Read-only tool sandbox skeleton blocked the request because purposeSummary is missing.",
    });
  }

  if (metadataHasSensitiveKeys(input.metadata)) {
    return createBlockedResult({
      input,
      sideEffectLevel,
      blockedReasons: [AgentReadOnlyToolBlockedReason.UnsafeMetadata],
      warnings: [
        "Unsafe metadata keys were detected. Metadata values were not returned.",
      ],
      message:
        "Read-only tool sandbox skeleton blocked the request because metadata contains unsafe keys.",
    });
  }

  const sandboxRequest = createSandboxRequestPreview(input, definition);
  const sandboxDecision = evaluateReadOnlyToolSandboxRequestPreview({
    request: sandboxRequest,
    policy:
      options.policy ?? createDefaultReadOnlyToolSandboxPolicyPreview(),
    allowlist:
      options.allowlist ??
      createSkeletonAllowlistPreview(definitions),
    now: options.now,
  });

  if (
    !sandboxDecision.allowed ||
    sandboxDecision.decisionKind !==
      AgentToolSandboxDecisionKindPreview.AllowPreviewOnly
  ) {
    return createBlockedResult({
      input,
      sideEffectLevel,
      blockedReasons: [AgentReadOnlyToolBlockedReason.PolicyDenied],
      warnings: sandboxDecision.warnings,
      sandboxDecision,
      message:
        "Read-only tool sandbox skeleton blocked the request because the A97 policy gate did not allow it.",
    });
  }

  if (!isAgentReadOnlyToolKey(input.toolKey) || definition === undefined) {
    return createBlockedResult({
      input,
      sideEffectLevel,
      blockedReasons: [
        AgentReadOnlyToolBlockedReason.ToolNotAllowlisted,
        AgentReadOnlyToolBlockedReason.UnsupportedTool,
      ],
      warnings: [
        "Only fixed mock/status read-only tool keys are supported.",
      ],
      sandboxDecision,
      message:
        "Read-only tool sandbox skeleton blocked an unknown or unsupported tool key.",
    });
  }

  if (!config.allowedToolKeys.includes(input.toolKey)) {
    return createBlockedResult({
      input,
      sideEffectLevel: definition.sideEffectLevel,
      blockedReasons: [AgentReadOnlyToolBlockedReason.ToolNotAllowlisted],
      warnings: [
        "The fixed tool key is not enabled in the runtime config allowlist.",
      ],
      sandboxDecision,
      message:
        "Read-only tool sandbox skeleton blocked the request because the tool key is not enabled.",
    });
  }

  if (
    !definition.enabledByDefault ||
    !definition.returnsStaticSafeSummary ||
    !definition.requiresPolicyGate
  ) {
    return createBlockedResult({
      input,
      sideEffectLevel: definition.sideEffectLevel,
      blockedReasons: [AgentReadOnlyToolBlockedReason.UnsupportedTool],
      warnings: [
        "Tool definitions must remain enabled, static-safe, and policy-gated.",
      ],
      sandboxDecision,
      message:
        "Read-only tool sandbox skeleton blocked a non-static or non-policy-gated tool definition.",
    });
  }

  const handlerResult = invokeStaticReadOnlyHandler(input.toolKey);
  const resultSummary = truncateSummary(
    handlerResult.resultSummary,
    config.maxResultSummaryLength,
  );

  return {
    ok: true,
    executed: true,
    toolKey: input.toolKey,
    status: "allowed_static_readonly",
    resultSummary,
    safeData: handlerResult.safeData,
    blockedReasons: [],
    warnings: normalizeUniqueStrings([
      ...sandboxDecision.warnings,
      "Only a fixed static mock/status handler was invoked.",
      "This is not a general-purpose tool executor.",
    ]),
    sandboxDecision,
    readOnly: true,
    previewOrMockOnly: true,
    sideEffectLevel: definition.sideEffectLevel,
    secretSafe: true,
    networkAccessed: false,
    fileSystemAccessed: false,
    databaseAccessed: false,
    commandExecuted: false,
    llmCalled: false,
    message:
      "Fixed read-only mock/status handler returned a static safe summary. No IO, database, command, network, browser, credential, or LLM operation occurred.",
  };
}

export function getReadOnlyToolSandboxSkeletonStatus(): AgentReadOnlyToolSandboxSkeletonStatus {
  return {
    runtimeAvailable: true,
    defaultRuntimeEnabled: false,
    supportedToolCount: ALL_READ_ONLY_TOOL_KEYS.length,
    dangerousCapabilitiesEnabled: false,
    networkAccessEnabled: false,
    fileSystemAccessEnabled: false,
    databaseAccessEnabled: false,
    commandExecutionEnabled: false,
    browserAutomationEnabled: false,
    credentialAccessEnabled: false,
    llmCallEnabled: false,
  };
}

function createSkeletonAllowlistPreview(
  definitions: readonly AgentReadOnlyToolDefinition[],
): AgentToolAllowlistEntryPreview[] {
  return definitions.map((definition) => ({
    toolKey: definition.toolKey,
    displayName: definition.displayName,
    capability: definition.capability,
    description: definition.description,
    riskLevel: definition.riskLevel,
    sideEffectLevel: definition.sideEffectLevel,
    allowedInReadOnlySandbox: true,
    requiresPermissionPreview: false,
  }));
}

function createSandboxRequestPreview(
  input: AgentReadOnlyToolExecutionInput,
  definition: AgentReadOnlyToolDefinition | undefined,
): AgentToolSandboxRequestPreview {
  return {
    requestId:
      input.requestId ??
      `readonly_tool_sandbox_skeleton_${sanitizeIdentifier(input.toolKey)}`,
    toolKey: input.toolKey,
    requestedCapability:
      definition?.capability ??
      AgentToolSandboxCapabilityPreview.GenerateStaticPreviewSummary,
    requestedSideEffectLevel:
      definition?.sideEffectLevel ??
      AgentToolSandboxSideEffectLevelPreview.None,
    declaredRiskLevel:
      definition?.riskLevel ?? AgentToolSandboxRiskLevelPreview.Unknown,
    purposeSummary: input.purposeSummary,
    inputSummary:
      "Fixed read-only mock/status tool skeleton request. Raw input is not stored.",
    requestedByActorKind:
      input.actorKind ?? AgentToolSandboxActorKindPreview.AgentPreview,
    metadata: input.metadata,
  };
}

function invokeStaticReadOnlyHandler(
  toolKey: AgentReadOnlyToolKey,
): StaticHandlerResult {
  switch (toolKey) {
    case AgentReadOnlyToolKey.ReadRuntimePreviewStatus:
      return {
        resultSummary:
          "Runtime preview boundary is available; real Agent runtime, general tool execution, LLM calls, and background jobs are disabled.",
        safeData: {
          moduleStatus: {
            runtimePreviewBoundaryAvailable: true,
            realAgentRuntimeEnabled: false,
            toolExecutionGeneralPurposeEnabled: false,
            llmCallEnabled: false,
            backgroundJobEnabled: false,
          },
        },
      };
    case AgentReadOnlyToolKey.ReadAgentPreviewCapabilities:
      return {
        resultSummary:
          "Agent preview capabilities include task plan, tool requirement, permission, runtime preview persistence, and this read-only sandbox skeleton; real tools and LLM calls remain disabled.",
        safeData: {
          capabilities: {
            taskPlanPreview: true,
            toolRequirementPreview: true,
            permissionPreview: true,
            runtimePreviewPersistence: true,
            readOnlyToolSandboxSkeleton: true,
            realToolExecution: false,
            realLlmCall: false,
          },
        },
      };
    case AgentReadOnlyToolKey.ReadToolSandboxPolicySummary:
      return {
        resultSummary:
          "Read-only tool sandbox skeleton is deny-by-default, requires a fixed allowlist, disables dynamic tools, and enables no dangerous capabilities.",
        safeData: {
          policySummary: {
            denyByDefault: true,
            allowlistRequired: true,
            dynamicToolsEnabled: false,
            dangerousCapabilitiesEnabled: false,
          },
        },
      };
    case AgentReadOnlyToolKey.ReadRuntimeBoundaryFlagsSummary:
      return {
        resultSummary:
          "Runtime boundary flags keep real execution, general tool execution, LLM calls, permission confirmation, and background jobs disabled.",
        safeData: {
          boundaryFlagsSummary: {
            realExecutionEnabled: false,
            generalToolExecutionEnabled: false,
            toolExecutionEnabled: false,
            llmCallEnabled: false,
            permissionConfirmationEnabled: false,
            backgroundJobEnabled: false,
          },
        },
      };
    case AgentReadOnlyToolKey.ReadMockRuntimePreviewSample:
      return {
        resultSummary:
          "Fixed mock runtime preview sample returned from static code only; it is not from DB, file, network, or model output.",
        safeData: {
          sample: {
            sampleKind: "mock_runtime_preview",
            message:
              "这是固定 mock/status 示例，不来自数据库，不来自文件，不来自模型。",
            containsRealToolResult: false,
            containsRealLlmResponse: false,
          },
        },
      };
  }
}

function findDefinition(
  toolKey: string,
  definitions: readonly AgentReadOnlyToolDefinition[],
): AgentReadOnlyToolDefinition | undefined {
  if (!isAgentReadOnlyToolKey(toolKey)) {
    return undefined;
  }

  return definitions.find((definition) => definition.toolKey === toolKey);
}

function isAgentReadOnlyToolKey(value: string): value is AgentReadOnlyToolKey {
  return (ALL_READ_ONLY_TOOL_KEYS as readonly string[]).includes(value);
}

function getUnsafeConfigBlockReasons(
  config: AgentReadOnlyToolSandboxRuntimeConfig,
): AgentReadOnlyToolBlockedReason[] {
  const reasons: AgentReadOnlyToolBlockedReason[] = [];

  if (config.allowDynamicTools !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.DynamicToolsDisabled);
  }

  if (config.allowFileSystemRead !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.FileSystemReadForbidden);
  }

  if (config.allowFileSystemWrite !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.FileSystemWriteForbidden);
  }

  if (config.allowNetworkAccess !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.NetworkAccessForbidden);
  }

  if (config.allowDatabaseAccess !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.DatabaseAccessForbidden);
  }

  if (config.allowShellCommand !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.ShellCommandForbidden);
  }

  if (config.allowBrowserAutomation !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.BrowserAutomationForbidden);
  }

  if (config.allowCredentialAccess !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.CredentialAccessForbidden);
  }

  if (config.allowLlmCall !== false) {
    reasons.push(AgentReadOnlyToolBlockedReason.LlmCallForbidden);
  }

  return normalizeUniqueStrings(reasons) as AgentReadOnlyToolBlockedReason[];
}

function createBlockedResult(input: {
  readonly input: AgentReadOnlyToolExecutionInput;
  readonly sideEffectLevel: AgentReadOnlyToolSideEffectLevel;
  readonly blockedReasons: readonly AgentReadOnlyToolBlockedReason[];
  readonly warnings?: readonly string[];
  readonly sandboxDecision?: AgentToolSandboxDecisionPreview;
  readonly status?: AgentReadOnlyToolExecutionStatus;
  readonly message: string;
}): AgentReadOnlyToolExecutionResult {
  return {
    ok: false,
    executed: false,
    toolKey: input.input.toolKey,
    status: input.status ?? "blocked",
    blockedReasons: normalizeUniqueStrings(
      input.blockedReasons,
    ) as AgentReadOnlyToolBlockedReason[],
    warnings: normalizeUniqueStrings(input.warnings ?? []),
    sandboxDecision: input.sandboxDecision,
    readOnly: true,
    previewOrMockOnly: true,
    sideEffectLevel: input.sideEffectLevel,
    secretSafe: true,
    networkAccessed: false,
    fileSystemAccessed: false,
    databaseAccessed: false,
    commandExecuted: false,
    llmCalled: false,
    message: input.message,
  };
}

function metadataHasSensitiveKeys(
  metadata: AgentMetadata | undefined,
): boolean {
  if (metadata === undefined) {
    return false;
  }

  return collectMetadataKeys(metadata).some((key) =>
    SENSITIVE_METADATA_KEYS.has(normalizeMetadataKey(key)),
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

function truncateSummary(
  value: string,
  maxLength: number | undefined,
): string {
  const safeMaxLength =
    maxLength === undefined ||
    !Number.isFinite(maxLength) ||
    maxLength <= 0
      ? DEFAULT_MAX_RESULT_SUMMARY_LENGTH
      : Math.floor(maxLength);

  return value.length > safeMaxLength
    ? `${value.slice(0, safeMaxLength - 3)}...`
    : value;
}

function sanitizeIdentifier(value: string): string {
  const sanitized = value.trim().replace(/[^\w:./@-]/g, "_");

  return sanitized.length > 0 ? sanitized : "unknown_tool";
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
