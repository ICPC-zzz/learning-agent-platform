import {
  type WebAgentToolDefinition,
  type WebAgentToolExecutionResult,
} from "./web-agent-readonly-tool-registry.ts";
import {
  type WebAgentMcpTransport,
  WebAgentMcpTransport as WebAgentMcpTransportValue,
} from "./web-agent-mcp-registry.ts";

const McpToolName = {
  GithubListIssues: "githubListIssues",
  GithubGetRepoSummary: "githubGetRepoSummary",
} as const;

type McpToolName = (typeof McpToolName)[keyof typeof McpToolName];

export const McpPermission = {
  Disabled: "disabled",
  PreviewOnly: "previewOnly",
  ReadOnly: "readOnly",
  RequiresUserApproval: "requiresUserApproval",
  DevOnlyLive: "devOnlyLive",
  Forbidden: "forbidden",
} as const;

export type McpPermission =
  (typeof McpPermission)[keyof typeof McpPermission];

export const McpProviderMode = {
  Fake: "fake",
  Live: "live",
  Blocked: "blocked",
} as const;

export type McpProviderMode =
  (typeof McpProviderMode)[keyof typeof McpProviderMode];

export interface McpToolInputField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  example?: string;
}

export interface McpToolDescriptor {
  connectorId: string;
  toolId: McpToolName;
  displayName: string;
  description: string;
  permission: McpPermission;
  transport: WebAgentMcpTransport;
  inputSchema: {
    readonly fields: readonly McpToolInputField[];
  };
  readOnly: true;
  safeToExposeToClient: true;
  enabledByDefault: false;
  productionReady: false;
  devOnly: true;
  notes: readonly string[];
}

export interface McpConnector {
  connectorId: string;
  providerName: string;
  transport: WebAgentMcpTransport;
  description: string;
  permission: McpPermission;
  previewOnly: true;
  devOnly: true;
  liveConnectionEnabled: false;
  safeToExposeToClient: true;
  productionReady: false;
  toolDescriptors: readonly McpToolDescriptor[];
  notes: readonly string[];
}

export interface McpCallRequest {
  connectorId: string;
  toolId: McpToolName;
  toolInput: Record<string, unknown>;
  messagePreview: string;
  requestedAt?: string;
  toolPreviewEnabled: boolean;
  providerMode?: McpProviderMode;
  fetchImpl?: typeof globalThis.fetch;
}

export const McpCallStatus = {
  Queued: "queued",
  Running: "running",
  Succeeded: "succeeded",
  Blocked: "blocked",
  Failed: "failed",
  TimedOut: "timedOut",
} as const;

export type McpCallStatus =
  (typeof McpCallStatus)[keyof typeof McpCallStatus];

export interface McpCallResult {
  connectorId: string;
  connectorName: string;
  toolId: McpToolName | null;
  toolName: string | null;
  permission: McpPermission;
  providerMode: McpProviderMode;
  githubRepoAccessStatus: "allowed" | "blocked" | "not_checked";
  status: McpCallStatus;
  resultPreview: string | null;
  blockedReason: string | null;
  errorReason: string | null;
  missingEnvKeys: readonly string[];
  trace: readonly string[];
  inputSummary: string;
  finalUrl: string | null;
  contentType: string | null;
  readOnly: true;
  safeToExposeToClient: true;
  productionReady: false;
  secretSafe: true;
  rawPromptStored: false;
  rawResponseStored: false;
  devOnly: true;
}

export interface McpConnectorGuardResult {
  enabled: boolean;
  nonProduction: boolean;
  devEnabled: boolean;
  allowAgentMcp: boolean;
  githubReadonlyEnabled: boolean;
  allowed: boolean;
  missingEnvKeys: readonly string[];
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
  devOnly: true;
  productionReady: false;
}

export interface McpConnectorRuntimeOptions {
  env?: McpConnectorRuntimeEnv;
  fetchImpl?: typeof globalThis.fetch;
  connectors?: readonly McpConnector[];
}

export interface McpConnectorRuntimeEnv {
  NODE_ENV?: string;
  LAP_WEB_AGENT_MCP_DEV_ENABLED?: string;
  LAP_ALLOW_AGENT_MCP?: string;
  LAP_AGENT_GITHUB_READONLY_ENABLED?: string;
  LAP_AGENT_GITHUB_ALLOWED_REPOS?: string;
  GITHUB_TOKEN?: string;
}

const GITHUB_CONNECTOR_ID = "github";
const SLACK_CONNECTOR_ID = "slack";
const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
const DEFAULT_ISSUE_LIMIT = 5;
const DEFAULT_SUMMARY_ISSUE_LIMIT = 3;
const DEFAULT_MAX_PREVIEW_CHARS = 880;

const githubToolDescriptors: readonly McpToolDescriptor[] = [
  {
    connectorId: GITHUB_CONNECTOR_ID,
    toolId: McpToolName.GithubListIssues,
    displayName: "githubListIssues",
    description:
      "Read-only GitHub issue list preview. Returns a short sanitized summary only.",
    permission: McpPermission.ReadOnly,
    transport: WebAgentMcpTransportValue.Http,
    inputSchema: {
      fields: [
        {
          name: "repoFullName",
          type: "string",
          required: true,
          description: "GitHub repository in owner/name form.",
          example: "openai/openai",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Optional issue state filter.",
          example: "open",
        },
        {
          name: "perPage",
          type: "number",
          required: false,
          description: "Optional preview limit for issue rows.",
          example: "5",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Legacy alias for perPage.",
          example: "5",
        },
      ],
    },
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
    devOnly: true,
    notes: [
      "No write operation is exposed through this connector preview.",
      "Private repositories are blocked safely in this round.",
    ],
  },
  {
    connectorId: GITHUB_CONNECTOR_ID,
    toolId: McpToolName.GithubGetRepoSummary,
    displayName: "githubGetRepoSummary",
    description:
      "Read-only GitHub repository summary preview. Returns repo metadata plus a short issue preview only.",
    permission: McpPermission.ReadOnly,
    transport: WebAgentMcpTransportValue.Http,
    inputSchema: {
      fields: [
        {
          name: "repoFullName",
          type: "string",
          required: true,
          description: "GitHub repository in owner/name form.",
          example: "openai/openai",
        },
        {
          name: "issueNumber",
          type: "number",
          required: false,
          description: "Optional issue number to fetch a single issue detail preview.",
          example: "123",
        },
        {
          name: "perPage",
          type: "number",
          required: false,
          description: "Optional issue preview count when a list preview is included.",
          example: "3",
        },
      ],
    },
    readOnly: true,
    safeToExposeToClient: true,
    enabledByDefault: false,
    productionReady: false,
    devOnly: true,
    notes: [
      "Repository summary stays preview-only and sanitized.",
      "Private repositories are blocked safely in this round.",
    ],
  },
] as const;

const githubConnector: McpConnector = {
  connectorId: GITHUB_CONNECTOR_ID,
  providerName: "GitHub",
  transport: WebAgentMcpTransportValue.Http,
  description:
    "Dev-only GitHub MCP connector preview. Only read-only tools are exposed.",
  permission: McpPermission.ReadOnly,
  previewOnly: true,
  devOnly: true,
  liveConnectionEnabled: false,
  safeToExposeToClient: true,
  productionReady: false,
  toolDescriptors: githubToolDescriptors,
  notes: [
    "No live connection is opened unless every dev guard is enabled.",
    "Only GitHub read-only preview tools are modeled here.",
  ],
};

const slackConnector: McpConnector = {
  connectorId: SLACK_CONNECTOR_ID,
  providerName: "Slack",
  transport: WebAgentMcpTransportValue.Http,
  description:
    "Metadata-only Slack MCP connector preview. No connection is opened.",
  permission: McpPermission.PreviewOnly,
  previewOnly: true,
  devOnly: true,
  liveConnectionEnabled: false,
  safeToExposeToClient: true,
  productionReady: false,
  toolDescriptors: [],
  notes: [
    "Slack remains metadata only in this round.",
    "No live Slack API call or handshake is performed.",
  ],
};

const connectorRegistry: readonly McpConnector[] = [
  githubConnector,
  slackConnector,
] as const;

export function getWebAgentMcpConnectorRegistry(): readonly McpConnector[] {
  return connectorRegistry.map((connector) =>
    cloneMcpConnector(connector),
  );
}

export function createWebAgentMcpConnectorRegistryPreview(): readonly McpConnector[] {
  return getWebAgentMcpConnectorRegistry();
}

export function getWebAgentMcpToolDescriptors(): readonly McpToolDescriptor[] {
  return githubToolDescriptors.map((descriptor) =>
    cloneMcpToolDescriptor(descriptor),
  );
}

export function createWebAgentMcpToolDescriptorsPreview(): readonly McpToolDescriptor[] {
  return getWebAgentMcpToolDescriptors();
}

export function evaluateWebAgentMcpConnectorGuard(
  env: McpConnectorRuntimeEnv,
): McpConnectorGuardResult {
  const nonProduction = isNonProductionEnv(env.NODE_ENV);
  const devEnabled = parseBooleanEnv(env.LAP_WEB_AGENT_MCP_DEV_ENABLED);
  const allowAgentMcp = parseBooleanEnv(env.LAP_ALLOW_AGENT_MCP);
  const githubReadonlyEnabled = parseBooleanEnv(
    env.LAP_AGENT_GITHUB_READONLY_ENABLED,
  );
  const missingEnvKeys: string[] = [];
  const blockedReasons: string[] = [];

  if (!nonProduction) {
    blockedReasons.push("non_production_required");
  }

  if (!devEnabled) {
    blockedReasons.push("LAP_WEB_AGENT_MCP_DEV_ENABLED is not enabled");
    missingEnvKeys.push("LAP_WEB_AGENT_MCP_DEV_ENABLED");
  }

  if (!allowAgentMcp) {
    blockedReasons.push("LAP_ALLOW_AGENT_MCP is not enabled");
    missingEnvKeys.push("LAP_ALLOW_AGENT_MCP");
  }

  if (!githubReadonlyEnabled) {
    blockedReasons.push("LAP_AGENT_GITHUB_READONLY_ENABLED is not enabled");
    missingEnvKeys.push("LAP_AGENT_GITHUB_READONLY_ENABLED");
  }

  if (normalizeRequiredText(env.GITHUB_TOKEN) === null) {
    blockedReasons.push("GITHUB_TOKEN is missing");
    missingEnvKeys.push("GITHUB_TOKEN");
  }

  if (normalizeRequiredText(env.LAP_AGENT_GITHUB_ALLOWED_REPOS) === null) {
    blockedReasons.push("LAP_AGENT_GITHUB_ALLOWED_REPOS is missing");
    missingEnvKeys.push("LAP_AGENT_GITHUB_ALLOWED_REPOS");
  }

  if (blockedReasons.length > 0) {
    return createMcpGuardResult({
      enabled: false,
      nonProduction,
      devEnabled,
      allowAgentMcp,
      githubReadonlyEnabled,
      allowed: false,
      missingEnvKeys,
      blockedReasons,
      notice:
        "GitHub MCP read-only preview is blocked. The dev-only guard, allowlist, and token are required in a non-production environment.",
      sourceLabel: "mcp-guard-blocked (preview disabled)",
    });
  }

  return createMcpGuardResult({
    enabled: true,
    nonProduction,
    devEnabled,
    allowAgentMcp,
    githubReadonlyEnabled,
    allowed: true,
    missingEnvKeys: [],
    blockedReasons: [],
    notice:
      "GitHub MCP read-only preview is enabled in this dev-only preview environment. The allowlist still gates each repository at call time.",
    sourceLabel: "mcp-guard-enabled (dev-only preview)",
  });
}

export async function executeMcpConnectorCallPreview(
  input: McpCallRequest & {
    env?: McpConnectorRuntimeEnv;
    connectorRegistry?: readonly McpConnector[];
  },
): Promise<McpCallResult> {
  const env = input.env ?? readMcpConnectorRuntimeEnv();
  const connectorRegistry = input.connectorRegistry ?? connectorRegistryPreview;
  const providerMode = resolveGitHubProviderMode(input.providerMode);
  const connector =
    connectorRegistry.find((entry) => entry.connectorId === input.connectorId) ??
    null;
  const guard = evaluateWebAgentMcpConnectorGuard(env);

  if (connector === null) {
    return createBlockedMcpCallResult({
      connectorId: input.connectorId,
      connectorName: input.connectorId,
      toolId: input.toolId,
      toolName: getMcpToolDisplayName(input.toolId),
      permission: McpPermission.Disabled,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "connector_not_registered",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `connectorId=${sanitizeMcpPreviewText(input.connectorId)}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  const toolDescriptor = connector.toolDescriptors.find(
    (entry) => entry.toolId === input.toolId,
  );

  if (toolDescriptor === undefined) {
    return createBlockedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: input.toolId,
      toolName: getMcpToolDisplayName(input.toolId),
      permission: connector.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "tool_not_registered",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `toolId=${sanitizeMcpPreviewText(input.toolId)}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (!input.toolPreviewEnabled) {
    return createBlockedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: toolDescriptor.toolId,
      toolName: toolDescriptor.displayName,
      permission: toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "tool_preview_disabled_by_default",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        "toolPreviewEnabled=false",
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (providerMode === McpProviderMode.Live && !guard.allowed) {
    return createBlockedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: toolDescriptor.toolId,
      toolName: toolDescriptor.displayName,
      permission: toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "mcp_guard_disabled",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `guard=${guard.sourceLabel}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (toolDescriptor.permission !== McpPermission.ReadOnly) {
    return createBlockedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: toolDescriptor.toolId,
      toolName: toolDescriptor.displayName,
      permission: toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "write_operation_blocked",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `permission=${toolDescriptor.permission}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  try {
    const toolInput = normalizeJsonObject(input.toolInput);

    if (toolDescriptor.toolId === McpToolName.GithubListIssues) {
      return await executeGitHubListIssuesPreview({
        connector,
        toolDescriptor,
        toolInput,
        guard,
        env,
        fetchImpl: input.fetchImpl,
        providerMode,
      });
    }

    if (toolDescriptor.toolId === McpToolName.GithubGetRepoSummary) {
      return await executeGitHubRepoSummaryPreview({
        connector,
        toolDescriptor,
        toolInput,
        guard,
        env,
        fetchImpl: input.fetchImpl,
        providerMode,
      });
    }

    return createFailedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: toolDescriptor.toolId,
      toolName: toolDescriptor.displayName,
      permission: toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      errorReason: "unsupported_mcp_tool",
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=running",
        "status=failed",
        `toolId=${toolDescriptor.toolId}`,
      ],
      inputSummary: buildMcpInputSummary(toolInput),
      finalUrl: null,
      contentType: null,
    });
  } catch (error) {
    return createFailedMcpCallResult({
      connectorId: connector.connectorId,
      connectorName: connector.providerName,
      toolId: toolDescriptor.toolId,
      toolName: toolDescriptor.displayName,
      permission: toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      errorReason: sanitizeMcpPreviewText(extractErrorMessage(error), 180),
      missingEnvKeys: guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=running",
        "status=failed",
        "connector_error=redacted",
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }
}

export function createWebAgentToolExecutionResultFromMcpCallResult(
  input: McpCallResult,
): WebAgentToolExecutionResult {
  const status = mapMcpCallStatusToToolExecutionStatus(input.status);
  const resultPreview = input.resultPreview ?? buildFallbackMcpResultPreview(input);

  return {
    toolId: input.toolId,
    status,
    safeToExposeToClient: true,
    providerMode: input.providerMode,
    githubRepoAccessStatus: input.githubRepoAccessStatus,
    toolResultPreview: resultPreview,
    finalUrl: input.finalUrl,
    contentType: input.contentType,
    textPreview: resultPreview,
    truncated: false,
    blockedReason: input.blockedReason,
    errorReason:
      input.status === McpCallStatus.TimedOut
        ? "request_timeout"
        : input.errorReason,
    warnings: buildMcpCallWarnings(input),
    inputSummary: input.inputSummary,
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
}

function mapMcpCallStatusToToolExecutionStatus(
  status: McpCallStatus,
): WebAgentToolExecutionResult["status"] {
  if (status === McpCallStatus.Succeeded) {
    return "success";
  }

  if (status === McpCallStatus.Blocked) {
    return "blocked";
  }

  return "error";
}

function buildFallbackMcpResultPreview(input: McpCallResult): string {
  if (input.status === McpCallStatus.Blocked) {
    return `[blocked] ${input.blockedReason ?? "mcp_call_blocked"}`;
  }

  if (input.status === McpCallStatus.TimedOut) {
    return "[error] MCP call timed out safely.";
  }

  if (input.errorReason !== null) {
    return `[error] ${input.errorReason}`;
  }

  return "MCP call completed safely.";
}

function buildMcpCallWarnings(input: McpCallResult): readonly string[] {
  if (input.status === McpCallStatus.Succeeded) {
    return [];
  }

  const warnings = [
    input.blockedReason ?? input.errorReason ?? "mcp_call_not_completed",
  ];

  if (input.missingEnvKeys.length > 0) {
    warnings.push(`missingEnvKeys=${input.missingEnvKeys.join(",")}`);
  }

  return normalizeStringList(warnings);
}

export function getWebAgentMcpConnectorById(
  connectorId: string,
): McpConnector | null {
  const connector = connectorRegistry.find(
    (entry) => entry.connectorId === connectorId,
  );

  return connector === undefined ? null : cloneMcpConnector(connector);
}

export function getWebAgentMcpToolDescriptorById(
  toolId: McpToolName,
): McpToolDescriptor | null {
  const descriptor = githubToolDescriptors.find(
    (entry) => entry.toolId === toolId,
  );

  return descriptor === undefined ? null : cloneMcpToolDescriptor(descriptor);
}

function executeGitHubListIssuesPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  toolInput: Record<string, unknown>;
  guard: McpConnectorGuardResult;
  env: McpConnectorRuntimeEnv;
  fetchImpl?: typeof globalThis.fetch;
  providerMode: McpProviderMode;
}): Promise<McpCallResult> {
  return executeGitHubReadonlyPreview({
    ...input,
    toolName: input.toolDescriptor.displayName,
    buildResultPreview: (context) =>
      buildGitHubIssuesPreview(
        context.repoSummary,
        context.issueRows,
        context.providerMode,
        context.repoAccessStatus,
      ),
  });
}

function executeGitHubRepoSummaryPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  toolInput: Record<string, unknown>;
  guard: McpConnectorGuardResult;
  env: McpConnectorRuntimeEnv;
  fetchImpl?: typeof globalThis.fetch;
  providerMode: McpProviderMode;
}): Promise<McpCallResult> {
  return executeGitHubReadonlyPreview({
    ...input,
    toolName: input.toolDescriptor.displayName,
    buildResultPreview: (context) =>
      buildGitHubRepoSummaryPreview(
        context.repoSummary,
        context.issueRows,
        context.providerMode,
        context.repoAccessStatus,
        context.issueDetail,
      ),
  });
}

async function executeGitHubReadonlyPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  toolInput: Record<string, unknown>;
  guard: McpConnectorGuardResult;
  env: McpConnectorRuntimeEnv;
  fetchImpl?: typeof globalThis.fetch;
  providerMode: McpProviderMode;
  toolName: string;
  buildResultPreview: (context: {
    repoSummary: GitHubRepoSummary;
    issueRows: readonly GitHubIssueRow[];
    issueDetail: GitHubIssueDetail | null;
    providerMode: McpProviderMode;
    repoAccessStatus: "allowed" | "blocked" | "not_checked";
  }) => string;
}): Promise<McpCallResult> {
  const repoFullName = normalizeRequiredText(readString(input.toolInput.repoFullName));
  if (repoFullName === null) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: input.providerMode,
      githubRepoAccessStatus: "blocked",
      blockedReason: "missing_required_field:repoFullName",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        "missingRequiredField=repoFullName",
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  const normalizedRepo = normalizeRepoFullName(repoFullName);
  if (normalizedRepo === null) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: input.providerMode,
      githubRepoAccessStatus: "blocked",
      blockedReason: "invalid_repo_full_name",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `repoFullName=${sanitizeMcpPreviewText(repoFullName)}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  const [owner, repo] = normalizedRepo.split("/");
  const issueNumber = normalizeOptionalIssueNumber(readNumber(input.toolInput.issueNumber));
  if (input.toolDescriptor.toolId === McpToolName.GithubGetRepoSummary && input.toolInput.issueNumber !== undefined && issueNumber === null) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: input.providerMode,
      githubRepoAccessStatus: "blocked",
      blockedReason: "invalid_issue_number",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `issueNumber=${sanitizeMcpPreviewText(String(input.toolInput.issueNumber))}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  const perPage = input.toolDescriptor.toolId === McpToolName.GithubListIssues
    ? normalizeOptionalPerPage(input.toolInput.perPage, input.toolInput.limit)
    : normalizeOptionalPerPage(input.toolInput.perPage, null);

  if (
    input.toolDescriptor.toolId === McpToolName.GithubListIssues &&
    perPage === null &&
    (input.toolInput.perPage !== undefined || input.toolInput.limit !== undefined)
  ) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: input.providerMode,
      githubRepoAccessStatus: "blocked",
      blockedReason: "invalid_per_page",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `perPage=${sanitizeMcpPreviewText(String(input.toolInput.perPage ?? input.toolInput.limit))}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (input.providerMode === McpProviderMode.Fake) {
    return executeGitHubFakeReadonlyPreview({
      connector: input.connector,
      toolDescriptor: input.toolDescriptor,
      toolInput: input.toolInput,
      repoFullName: normalizedRepo,
      issueNumber,
      perPage: perPage ?? DEFAULT_ISSUE_LIMIT,
      toolName: input.toolName,
      buildResultPreview: input.buildResultPreview,
    });
  }

  if (input.providerMode === McpProviderMode.Live && !isRepoAllowlisted(normalizedRepo, input.env.LAP_AGENT_GITHUB_ALLOWED_REPOS)) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: McpProviderMode.Live,
      githubRepoAccessStatus: "blocked",
      blockedReason: "repo_not_allowlisted",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `repo=${sanitizeMcpPreviewText(normalizedRepo)}`,
        "allowlist=blocked",
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (input.providerMode === McpProviderMode.Live && !input.guard.allowed) {
    return createBlockedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: McpProviderMode.Blocked,
      githubRepoAccessStatus: "blocked",
      blockedReason: "mcp_guard_disabled",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=blocked",
        `guard=${input.guard.sourceLabel}`,
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  if (input.providerMode === McpProviderMode.Live) {
    return executeGitHubLiveReadonlyPreview({
      connector: input.connector,
      toolDescriptor: input.toolDescriptor,
      toolInput: input.toolInput,
      guard: input.guard,
      env: input.env,
      fetchImpl: input.fetchImpl,
      repoFullName: normalizedRepo,
      owner,
      repo,
      issueNumber,
      perPage: perPage ?? DEFAULT_ISSUE_LIMIT,
      toolName: input.toolName,
      buildResultPreview: input.buildResultPreview,
    });
  }

  return createBlockedMcpCallResult({
    connectorId: input.connector.connectorId,
    connectorName: input.connector.providerName,
    toolId: input.toolDescriptor.toolId,
    toolName: input.toolName,
    permission: input.toolDescriptor.permission,
    providerMode: McpProviderMode.Blocked,
    githubRepoAccessStatus: "blocked",
    blockedReason: "unsupported_provider_mode",
    missingEnvKeys: input.guard.missingEnvKeys,
    trace: [
      "status=queued",
      "status=blocked",
      `providerMode=${sanitizeMcpPreviewText(input.providerMode)}`,
    ],
    inputSummary: buildMcpInputSummary(input.toolInput),
    finalUrl: null,
    contentType: null,
  });
}

function executeGitHubFakeReadonlyPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  toolInput: Record<string, unknown>;
  repoFullName: string;
  issueNumber: number | null;
  perPage: number;
  toolName: string;
  buildResultPreview: (context: {
    repoSummary: GitHubRepoSummary;
    issueRows: readonly GitHubIssueRow[];
    issueDetail: GitHubIssueDetail | null;
    providerMode: McpProviderMode;
    repoAccessStatus: "allowed" | "blocked" | "not_checked";
  }) => string;
}): McpCallResult {
  const repoSummary = createFakeGitHubRepoSummary(input.repoFullName);
  const issueRows = createFakeGitHubIssueRows(input.repoFullName, input.perPage);
  const issueDetail =
    input.issueNumber === null
      ? null
      : createFakeGitHubIssueDetail(input.repoFullName, input.issueNumber);
  const resultPreview = input.buildResultPreview({
    repoSummary,
    issueRows,
    issueDetail,
    providerMode: McpProviderMode.Fake,
    repoAccessStatus: "not_checked",
  });

  return createSucceededMcpCallResult({
    connectorId: input.connector.connectorId,
    connectorName: input.connector.providerName,
    toolId: input.toolDescriptor.toolId,
    toolName: input.toolName,
    permission: input.toolDescriptor.permission,
    providerMode: McpProviderMode.Fake,
    githubRepoAccessStatus: "not_checked",
    resultPreview,
    inputSummary: buildMcpInputSummary(input.toolInput),
    finalUrl: sanitizeUrlForPreview(`https://github.com/${input.repoFullName}`),
    contentType: "application/json",
    trace: [
      "status=queued",
      "status=running",
      "status=succeeded",
      "provider=fake",
      `repo=${sanitizeMcpPreviewText(input.repoFullName)}`,
      `issueCount=${String(issueRows.length)}`,
      "safePreview=true",
    ],
  });
}

async function executeGitHubLiveReadonlyPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  toolInput: Record<string, unknown>;
  guard: McpConnectorGuardResult;
  env: McpConnectorRuntimeEnv;
  fetchImpl?: typeof globalThis.fetch;
  repoFullName: string;
  owner: string;
  repo: string;
  issueNumber: number | null;
  perPage: number;
  toolName: string;
  buildResultPreview: (context: {
    repoSummary: GitHubRepoSummary;
    issueRows: readonly GitHubIssueRow[];
    issueDetail: GitHubIssueDetail | null;
    providerMode: McpProviderMode;
    repoAccessStatus: "allowed" | "blocked" | "not_checked";
  }) => string;
}): Promise<McpCallResult> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return createFailedMcpCallResult({
      connectorId: input.connector.connectorId,
      connectorName: input.connector.providerName,
      toolId: input.toolDescriptor.toolId,
      toolName: input.toolName,
      permission: input.toolDescriptor.permission,
      providerMode: McpProviderMode.Live,
      githubRepoAccessStatus: "blocked",
      errorReason: "fetch_unavailable",
      missingEnvKeys: input.guard.missingEnvKeys,
      trace: [
        "status=queued",
        "status=running",
        "status=failed",
        "fetch=unavailable",
      ],
      inputSummary: buildMcpInputSummary(input.toolInput),
      finalUrl: null,
      contentType: null,
    });
  }

  const repoUrl = `${DEFAULT_GITHUB_API_BASE_URL}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  const issuesUrl =
    `${repoUrl}/issues?state=${encodeURIComponent(normalizeIssueState(readString(input.toolInput.state), "open"))}&per_page=${String(input.perPage)}&sort=created&direction=desc`;

  const repoResponse = await fetchJsonSafely(
    fetchImpl,
    repoUrl,
    input.guard,
    input.env,
  );
  if (repoResponse.ok === false) {
    return createGitHubBlockedResultFromFetchFailure({
      connector: input.connector,
      toolDescriptor: input.toolDescriptor,
      guard: input.guard,
      inputSummary: buildMcpInputSummary(input.toolInput),
      failure: repoResponse,
      tracePrefix: "repo",
      providerMode: McpProviderMode.Live,
    });
  }

  const repoSummary = normalizeGitHubRepoSummary(repoResponse.json);
  const repoVisibility = repoSummary.private === true ? "private" : "public";

  const issueDetail =
    input.issueNumber === null
      ? null
      : await fetchGitHubIssueDetailPreview({
          connector: input.connector,
          toolDescriptor: input.toolDescriptor,
          guard: input.guard,
          env: input.env,
          fetchImpl,
          repoUrl,
          issueNumber: input.issueNumber,
          inputSummary: buildMcpInputSummary(input.toolInput),
        });

  if (issueDetail !== null && issueDetail.kind === "blocked") {
    return issueDetail.result;
  }

  const issuesResponse = await fetchJsonSafely(
    fetchImpl,
    issuesUrl,
    input.guard,
    input.env,
  );
  if (issuesResponse.ok === false) {
    return createGitHubBlockedResultFromFetchFailure({
      connector: input.connector,
      toolDescriptor: input.toolDescriptor,
      guard: input.guard,
      inputSummary: buildMcpInputSummary(input.toolInput),
      failure: issuesResponse,
      tracePrefix: "issues",
      providerMode: McpProviderMode.Live,
    });
  }

  const issueRows = normalizeGitHubIssueRows(issuesResponse.json).slice(0, input.perPage);
  const resultPreview = input.buildResultPreview({
    repoSummary,
    issueRows,
    issueDetail: issueDetail === null ? null : issueDetail.result.githubIssueDetail,
    providerMode: McpProviderMode.Live,
    repoAccessStatus: "allowed",
  });

  const trace = [
    "status=queued",
    "status=running",
    "status=succeeded",
    "provider=live",
    `repo=${sanitizeMcpPreviewText(input.repoFullName)}`,
    `repoVisibility=${repoVisibility}`,
    `repoAccess=allowed`,
    `issueCount=${String(issueRows.length)}`,
    "safePreview=true",
  ];

  if (issueDetail !== null && issueDetail.result.githubIssueDetail !== null) {
    trace.push(`issueNumber=${String(issueDetail.result.githubIssueDetail.number)}`);
  }

  return createSucceededMcpCallResult({
    connectorId: input.connector.connectorId,
    connectorName: input.connector.providerName,
    toolId: input.toolDescriptor.toolId,
    toolName: input.toolName,
    permission: input.toolDescriptor.permission,
    providerMode: McpProviderMode.Live,
    githubRepoAccessStatus: "allowed",
    resultPreview,
    inputSummary: buildMcpInputSummary(input.toolInput),
    finalUrl: sanitizeUrlForPreview(issuesUrl),
    contentType: "application/json",
    trace,
  });
}

async function fetchGitHubIssueDetailPreview(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  guard: McpConnectorGuardResult;
  env: McpConnectorRuntimeEnv;
  fetchImpl: typeof globalThis.fetch;
  repoUrl: string;
  issueNumber: number;
  inputSummary: string;
}): Promise<
  | { kind: "ok"; result: { githubIssueDetail: GitHubIssueDetail | null } }
  | { kind: "blocked"; result: McpCallResult }
> {
  const issueUrl = `${input.repoUrl}/issues/${String(input.issueNumber)}`;
  const issueResponse = await fetchJsonSafely(
    input.fetchImpl,
    issueUrl,
    input.guard,
    input.env,
  );

  if (issueResponse.ok === false) {
    return {
      kind: "blocked",
      result: createGitHubBlockedResultFromFetchFailure({
        connector: input.connector,
        toolDescriptor: input.toolDescriptor,
        guard: input.guard,
        inputSummary: input.inputSummary,
        failure: issueResponse,
        tracePrefix: "issue",
        providerMode: McpProviderMode.Live,
      }),
    };
  }

  return {
    kind: "ok",
    result: {
      githubIssueDetail: normalizeGitHubIssueDetail(issueResponse.json),
    },
  };
}

function createGitHubBlockedResultFromFetchFailure(input: {
  connector: McpConnector;
  toolDescriptor: McpToolDescriptor;
  guard: McpConnectorGuardResult;
  inputSummary: string;
  failure: GitHubFetchResult;
  tracePrefix: "repo" | "issues" | "issue";
  providerMode: McpProviderMode;
}): McpCallResult {
  const blockedReason =
    input.failure.status === 404
      ? input.tracePrefix === "issue"
        ? "issue_not_found"
        : "repo_not_found"
      : input.failure.status === 401 || input.failure.status === 403
        ? "permission_insufficient"
        : "github_fetch_blocked";

  return createBlockedMcpCallResult({
    connectorId: input.connector.connectorId,
    connectorName: input.connector.providerName,
    toolId: input.toolDescriptor.toolId,
    toolName: input.toolDescriptor.displayName,
    permission: input.toolDescriptor.permission,
    providerMode: input.providerMode,
    githubRepoAccessStatus: "blocked",
    blockedReason,
    missingEnvKeys: input.guard.missingEnvKeys,
    trace: [
      "status=queued",
      "status=running",
      "status=blocked",
      `${input.tracePrefix}Status=${String(input.failure.status)}`,
      `${input.tracePrefix}Url=${sanitizeUrlForPreview(input.failure.url)}`,
    ],
    inputSummary: input.inputSummary,
    finalUrl: sanitizeUrlForPreview(input.failure.url),
    contentType: input.failure.contentType,
  });
}

function createSucceededMcpCallResult(input: {
  connectorId: string;
  connectorName: string;
  toolId: McpToolName;
  toolName: string;
  permission: McpPermission;
  providerMode: McpProviderMode;
  githubRepoAccessStatus: "allowed" | "blocked" | "not_checked";
  resultPreview: string;
  inputSummary: string;
  finalUrl: string | null;
  contentType: string | null;
  trace: readonly string[];
}): McpCallResult {
  return {
    connectorId: input.connectorId,
    connectorName: input.connectorName,
    toolId: input.toolId,
    toolName: input.toolName,
    permission: input.permission,
    providerMode: input.providerMode,
    githubRepoAccessStatus: input.githubRepoAccessStatus,
    status: McpCallStatus.Succeeded,
    resultPreview: truncatePreview(input.resultPreview),
    blockedReason: null,
    errorReason: null,
    missingEnvKeys: [],
    trace: normalizeStringList(input.trace),
    inputSummary: input.inputSummary,
    finalUrl: input.finalUrl,
    contentType: input.contentType,
    readOnly: true,
    safeToExposeToClient: true,
    productionReady: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
  };
}

function createBlockedMcpCallResult(input: {
  connectorId: string;
  connectorName: string;
  toolId: McpToolName | null;
  toolName: string | null;
  permission: McpPermission;
  providerMode: McpProviderMode;
  githubRepoAccessStatus: "allowed" | "blocked" | "not_checked";
  blockedReason: string;
  missingEnvKeys: readonly string[];
  trace: readonly string[];
  inputSummary: string;
  finalUrl: string | null;
  contentType: string | null;
}): McpCallResult {
  return {
    connectorId: input.connectorId,
    connectorName: input.connectorName,
    toolId: input.toolId,
    toolName: input.toolName,
    permission: input.permission,
    providerMode: input.providerMode,
    githubRepoAccessStatus: input.githubRepoAccessStatus,
    status: McpCallStatus.Blocked,
    resultPreview: truncatePreview(`[blocked] ${input.blockedReason}`),
    blockedReason: input.blockedReason,
    errorReason: null,
    missingEnvKeys: normalizeStringList(input.missingEnvKeys),
    trace: normalizeStringList(input.trace),
    inputSummary: input.inputSummary,
    finalUrl: input.finalUrl,
    contentType: input.contentType,
    readOnly: true,
    safeToExposeToClient: true,
    productionReady: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
  };
}

function createFailedMcpCallResult(input: {
  connectorId: string;
  connectorName: string;
  toolId: McpToolName | null;
  toolName: string | null;
  permission: McpPermission;
  providerMode: McpProviderMode;
  githubRepoAccessStatus: "allowed" | "blocked" | "not_checked";
  errorReason: string;
  missingEnvKeys: readonly string[];
  trace: readonly string[];
  inputSummary: string;
  finalUrl: string | null;
  contentType: string | null;
}): McpCallResult {
  return {
    connectorId: input.connectorId,
    connectorName: input.connectorName,
    toolId: input.toolId,
    toolName: input.toolName,
    permission: input.permission,
    providerMode: input.providerMode,
    githubRepoAccessStatus: input.githubRepoAccessStatus,
    status: McpCallStatus.Failed,
    resultPreview: truncatePreview(`[error] ${input.errorReason}`),
    blockedReason: null,
    errorReason: input.errorReason,
    missingEnvKeys: normalizeStringList(input.missingEnvKeys),
    trace: normalizeStringList(input.trace),
    inputSummary: input.inputSummary,
    finalUrl: input.finalUrl,
    contentType: input.contentType,
    readOnly: true,
    safeToExposeToClient: true,
    productionReady: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
  };
}

async function fetchJsonSafely(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  guard: McpConnectorGuardResult,
  env: McpConnectorRuntimeEnv,
): Promise<GitHubFetchResult> {
  try {
    const response = await fetchImpl(url, {
      headers: createGitHubHeaders(env, guard),
    });
    const contentType = response.headers.get("content-type") ?? "unknown";
    const text = await response.text();
    const json = safeParseJson(text);

    return {
      ok: response.ok,
      status: response.status,
      url: response.url || url,
      contentType,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      contentType: null,
      json: {
        error: sanitizeMcpPreviewText(extractErrorMessage(error), 180),
      },
    };
  }
}

function createGitHubHeaders(
  env: McpConnectorRuntimeEnv,
  guard: McpConnectorGuardResult,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "learning-agent-platform-preview",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (guard.allowed) {
    const token = normalizeRequiredText(env.GITHUB_TOKEN);
    if (token !== null) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

interface GitHubFetchResult {
  ok: boolean;
  status: number;
  url: string;
  contentType: string | null;
  json: unknown;
}

interface GitHubRepoSummary {
  full_name: string;
  name: string;
  description: string | null;
  private: boolean;
  default_branch: string | null;
  stargazers_count: number | null;
  forks_count: number | null;
  open_issues_count: number | null;
  html_url: string | null;
}

interface GitHubIssueRow {
  number: number;
  title: string;
  state: string;
  html_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function normalizeGitHubRepoSummary(value: unknown): GitHubRepoSummary {
  const record = isRecord(value) ? value : {};

  return {
    full_name: normalizePreviewText(readString(record.full_name) ?? ""),
    name: normalizePreviewText(readString(record.name) ?? ""),
    description:
      normalizeOptionalText(readString(record.description ?? null)) ?? null,
    private: readBoolean(record.private) === true,
    default_branch:
      normalizeOptionalText(readString(record.default_branch ?? null)) ?? null,
    stargazers_count: readNumber(record.stargazers_count) ?? null,
    forks_count: readNumber(record.forks_count) ?? null,
    open_issues_count: readNumber(record.open_issues_count) ?? null,
    html_url:
      normalizeOptionalText(readString(record.html_url ?? null)) ?? null,
  };
}

function normalizeGitHubIssueRows(value: unknown): readonly GitHubIssueRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        number: normalizePositiveInteger(readNumber(item.number), 0),
        title: normalizePreviewText(readString(item.title) ?? ""),
        state: normalizePreviewText(readString(item.state) ?? ""),
        html_url: normalizeOptionalText(readString(item.html_url ?? null)) ?? null,
        created_at:
          normalizeOptionalText(readString(item.created_at ?? null)) ?? null,
        updated_at:
          normalizeOptionalText(readString(item.updated_at ?? null)) ?? null,
      } satisfies GitHubIssueRow;
    })
    .filter((entry): entry is GitHubIssueRow => entry !== null);
}

function buildGitHubIssuesPreview(
  repoSummary: GitHubRepoSummary,
  issueRows: readonly GitHubIssueRow[],
  providerMode: McpProviderMode,
  repoAccessStatus: "allowed" | "blocked" | "not_checked",
): string {
  const lines = [
    "GitHub issues preview",
    `Provider: ${providerMode}`,
    `Repo access: ${repoAccessStatus}`,
    `Repository: ${repoSummary.full_name || repoSummary.name || "unknown"}`,
    `Visibility: ${repoSummary.private ? "private" : "public"}`,
    `Open issues: ${repoSummary.open_issues_count ?? issueRows.length}`,
    `Items shown: ${issueRows.length}`,
  ];

  if (repoSummary.description !== null) {
    lines.push(`Description: ${truncatePreview(repoSummary.description, 180)}`);
  }

  for (const issue of issueRows) {
    lines.push(
      `- #${issue.number} ${truncatePreview(issue.title, 120)} | ${issue.state} | ${issue.created_at ?? "unknown"}`,
    );
  }

  return lines.join("\n");
}

function buildGitHubRepoSummaryPreview(
  repoSummary: GitHubRepoSummary,
  issueRows: readonly GitHubIssueRow[],
  providerMode: McpProviderMode,
  repoAccessStatus: "allowed" | "blocked" | "not_checked",
  issueDetail: GitHubIssueDetail | null,
): string {
  const lines = [
    "GitHub repo summary preview",
    `Provider: ${providerMode}`,
    `Repo access: ${repoAccessStatus}`,
    `Repository: ${repoSummary.full_name || repoSummary.name || "unknown"}`,
    `Visibility: ${repoSummary.private ? "private" : "public"}`,
    `Default branch: ${repoSummary.default_branch ?? "unknown"}`,
    `Stars: ${String(repoSummary.stargazers_count ?? 0)}`,
    `Forks: ${String(repoSummary.forks_count ?? 0)}`,
    `Open issues: ${String(repoSummary.open_issues_count ?? issueRows.length)}`,
  ];

  if (repoSummary.description !== null) {
    lines.push(`Description: ${truncatePreview(repoSummary.description, 180)}`);
  }

  if (repoSummary.html_url !== null) {
    lines.push(`URL: ${sanitizeUrlForPreview(repoSummary.html_url)}`);
  }

  if (issueRows.length > 0) {
    lines.push(`Recent issue preview count: ${String(issueRows.length)}`);
    for (const issue of issueRows) {
      lines.push(`- #${issue.number} ${truncatePreview(issue.title, 120)}`);
    }
  }

  if (issueDetail !== null) {
    lines.push(`Issue detail: #${issueDetail.number}`);
    lines.push(`- ${truncatePreview(issueDetail.title, 120)} | ${issueDetail.state}`);
    if (issueDetail.body !== null) {
      lines.push(`- Body: ${truncatePreview(issueDetail.body, 180)}`);
    }
  }

  return lines.join("\n");
}

interface GitHubIssueDetail {
  number: number;
  title: string;
  state: string;
  body: string | null;
  html_url: string | null;
}

function normalizeGitHubIssueDetail(value: unknown): GitHubIssueDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const number = normalizeOptionalIssueNumber(readNumber(value.number));
  if (number === null) {
    return null;
  }

  return {
    number,
    title: normalizePreviewText(readString(value.title) ?? ""),
    state: normalizePreviewText(readString(value.state) ?? ""),
    body: normalizeOptionalText(readString(value.body ?? null)) ?? null,
    html_url: normalizeOptionalText(readString(value.html_url ?? null)) ?? null,
  };
}

function createFakeGitHubRepoSummary(repoFullName: string): GitHubRepoSummary {
  const [owner, repo] = repoFullName.split("/");
  return {
    full_name: repoFullName,
    name: repo,
    description: `Fake GitHub repo preview for ${repoFullName}.`,
    private: false,
    default_branch: "main",
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    html_url: `https://github.com/${owner}/${repo}`,
  };
}

function createFakeGitHubIssueRows(
  repoFullName: string,
  perPage: number,
): readonly GitHubIssueRow[] {
  const rows: GitHubIssueRow[] = [];

  for (let index = 1; index <= perPage; index += 1) {
    rows.push({
      number: index,
      title: `Fake issue ${index} for ${repoFullName}`,
      state: "open",
      html_url: `https://github.com/${repoFullName}/issues/${index}`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  }

  return rows;
}

function createFakeGitHubIssueDetail(
  repoFullName: string,
  issueNumber: number,
): GitHubIssueDetail {
  return {
    number: issueNumber,
    title: `Fake issue detail ${issueNumber} for ${repoFullName}`,
    state: "open",
    body: `Fake issue body for ${repoFullName} #${issueNumber}.`,
    html_url: `https://github.com/${repoFullName}/issues/${issueNumber}`,
  };
}

function createMcpGuardResult(input: {
  enabled: boolean;
  nonProduction: boolean;
  devEnabled: boolean;
  allowAgentMcp: boolean;
  githubReadonlyEnabled: boolean;
  allowed: boolean;
  missingEnvKeys: readonly string[];
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
}): McpConnectorGuardResult {
  return {
    enabled: input.enabled,
    nonProduction: input.nonProduction,
    devEnabled: input.devEnabled,
    allowAgentMcp: input.allowAgentMcp,
    githubReadonlyEnabled: input.githubReadonlyEnabled,
    allowed: input.allowed,
    missingEnvKeys: normalizeStringList(input.missingEnvKeys),
    blockedReasons: normalizeStringList(input.blockedReasons),
    notice: input.notice,
    sourceLabel: input.sourceLabel,
    devOnly: true,
    productionReady: false,
  };
}

function cloneMcpConnector(connector: McpConnector): McpConnector {
  return {
    ...connector,
    toolDescriptors: connector.toolDescriptors.map((descriptor) =>
      cloneMcpToolDescriptor(descriptor),
    ),
    notes: [...connector.notes],
  };
}

function cloneMcpToolDescriptor(
  descriptor: McpToolDescriptor,
): McpToolDescriptor {
  return {
    ...descriptor,
    inputSchema: {
      fields: descriptor.inputSchema.fields.map((field) => ({ ...field })),
    },
    notes: [...descriptor.notes],
  };
}

function buildMcpInputSummary(input: Record<string, unknown>): string {
  const entries = Object.entries(input).map(([key, value]) => {
    if (typeof value === "string") {
      return `${key}=${truncatePreview(value, 120)}`;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return `${key}=${String(value)}`;
    }

    return `${key}=[object]`;
  });

  return entries.length > 0 ? entries.join(", ") : "no-input";
}

function getMcpToolDisplayName(toolId: McpToolName): string {
  switch (toolId) {
    case McpToolName.GithubListIssues:
      return "githubListIssues";
    case McpToolName.GithubGetRepoSummary:
      return "githubGetRepoSummary";
    default:
      return toolId;
  }
}

function normalizeJsonObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = item;
    }
  }

  return result;
}

function normalizePreviewText(value: string): string {
  return sanitizeMcpPreviewText(value, 180);
}

function truncatePreview(value: string, maxChars = DEFAULT_MAX_PREVIEW_CHARS): string {
  const sanitized = sanitizeMcpPreviewText(value, maxChars);
  if (sanitized.length <= maxChars) {
    return sanitized;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${sanitized.slice(0, maxChars - 3).trimEnd()}...`;
}

function sanitizeMcpPreviewText(value: string, maxChars = 180): string {
  let result = value.trim().replace(/\s+/g, " ");
  result = result.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (match) =>
    sanitizeUrlForPreview(match),
  );
  result = result.replace(/\bfile:\/\/[^\s"'<>]+/gi, "file://[redacted]");
  result = result.replace(/\bbearer\s+\S+/gi, "bearer [redacted]");
  result = result.replace(
    /\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|credentials|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );
  result = result.replace(/\bDATABASE_URL\s*[:=]\s*\S+/gi, "DATABASE_URL=[redacted]");
  result = result.replace(
    /\b(raw[_-]?prompt|raw[_-]?messages|raw[_-]?completion|raw[_-]?request|raw[_-]?response|raw[_-]?provider[_-]?response|headers|raw[_-]?headers)\b\s*[:=]\s*\S+/gi,
    "$1=[redacted]",
  );

  if (result.length <= maxChars) {
    return result;
  }

  if (maxChars <= 3) {
    return ".".repeat(maxChars);
  }

  return `${result.slice(0, maxChars - 3).trimEnd()}...`;
}

function sanitizeUrlForPreview(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return truncatePreview(value, 200);
  }
}

function normalizePositiveInteger(
  value: number | null,
  fallback: number,
): number {
  if (value === null || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeOptionalIssueNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function normalizeOptionalPerPage(
  preferredValue: unknown,
  fallbackValue: unknown,
): number | null {
  const primary = readNumber(preferredValue);
  if (primary !== null) {
    return normalizeBoundedPerPage(primary);
  }

  const fallback = readNumber(fallbackValue);
  if (fallback !== null) {
    return normalizeBoundedPerPage(fallback);
  }

  if (preferredValue !== undefined || fallbackValue !== undefined) {
    return null;
  }

  return null;
}

function normalizeBoundedPerPage(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    return null;
  }

  return normalized;
}

function normalizeIssueState(
  value: string | null,
  fallback: string,
): string {
  const normalized = normalizeOptionalText(value);

  if (normalized === null) {
    return fallback;
  }

  const allowedStates = new Set(["open", "closed", "all"]);
  return allowedStates.has(normalized.toLowerCase())
    ? normalized.toLowerCase()
    : fallback;
}

function normalizeRepoFullName(value: string): string | null {
  const normalized = normalizeRequiredText(value);

  if (normalized === null) {
    return null;
  }

  const parts = normalized.split("/").filter((part) => part.length > 0);
  if (parts.length !== 2) {
    return null;
  }

  return `${parts[0].trim()}/${parts[1].trim()}`;
}

function isRepoAllowlisted(
  normalizedRepo: string,
  allowlistValue: string | undefined,
): boolean {
  const allowlist = parseGitHubAllowedRepos(allowlistValue);
  return allowlist.has(normalizedRepo);
}

function parseGitHubAllowedRepos(
  allowlistValue: string | undefined,
): ReadonlySet<string> {
  const normalizedAllowlist = normalizeRequiredText(allowlistValue);
  if (normalizedAllowlist === null) {
    return new Set();
  }

  const values = normalizedAllowlist
    .split(/[\n,;]/g)
    .map((value) => normalizeRepoFullName(value))
    .filter((value): value is string => value !== null);

  return new Set(values);
}

function normalizeRequiredText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return parseBooleanEnv(value);
  }

  return null;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function resolveGitHubProviderMode(
  value: McpProviderMode | undefined,
): McpProviderMode {
  if (value === McpProviderMode.Fake) {
    return McpProviderMode.Fake;
  }

  if (value === McpProviderMode.Live) {
    return McpProviderMode.Live;
  }

  return McpProviderMode.Live;
}

function isNonProductionEnv(nodeEnv: string | undefined): boolean {
  if (nodeEnv === undefined) {
    return true;
  }

  return nodeEnv.trim().toLowerCase() !== "production";
}

function readMcpConnectorRuntimeEnv(): McpConnectorRuntimeEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    LAP_WEB_AGENT_MCP_DEV_ENABLED: process.env.LAP_WEB_AGENT_MCP_DEV_ENABLED,
    LAP_ALLOW_AGENT_MCP: process.env.LAP_ALLOW_AGENT_MCP,
    LAP_AGENT_GITHUB_READONLY_ENABLED:
      process.env.LAP_AGENT_GITHUB_READONLY_ENABLED,
    LAP_AGENT_GITHUB_ALLOWED_REPOS:
      process.env.LAP_AGENT_GITHUB_ALLOWED_REPOS,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: sanitizeMcpPreviewText(value, 240) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = sanitizeMcpPreviewText(value, 160);
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

const connectorRegistryPreview = connectorRegistry;
