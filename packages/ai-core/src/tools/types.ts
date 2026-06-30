export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | readonly JsonValue[];

export type ToolMetadata = JsonObject;
export type ToolSchema = JsonObject;

export const ToolRiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type ToolRiskLevel =
  (typeof ToolRiskLevel)[keyof typeof ToolRiskLevel];

export const ToolCallStatus = {
  Success: "success",
  Succeeded: "succeeded",
  Failed: "failed",
  Blocked: "blocked",
  RequiresConfirmation: "requires_confirmation",
  Denied: "denied",
  NeedsConfirmation: "needs_confirmation",
} as const;

export type ToolCallStatus =
  (typeof ToolCallStatus)[keyof typeof ToolCallStatus];

export const ToolCallErrorCode = {
  ToolNotFound: "tool_not_found",
  DuplicateTool: "duplicate_tool",
  InvalidToolDefinition: "invalid_tool_definition",
  ConfirmationRequired: "confirmation_required",
  ExecutionFailed: "execution_failed",
  InvalidToolRequest: "invalid_tool_request",
  DisabledByDefault: "disabled_by_default",
  PermissionDenied: "permission_denied",
  InvalidToolInput: "invalid_tool_input",
  EmptyResult: "empty_result",
  TimedOut: "timed_out",
  Cancelled: "cancelled",
  ExternalUnavailable: "external_unavailable",
} as const;

export type ToolCallErrorCode =
  (typeof ToolCallErrorCode)[keyof typeof ToolCallErrorCode];

export interface ToolDefinition {
  name: string;
  description: string;
  displayName?: string;
  riskLevel: ToolRiskLevel;
  riskCategory?: ToolRiskCategory;
  requiresConfirmation: boolean;
  enabled?: boolean;
  disabledByDefault?: boolean;
  readOnly?: boolean;
  sideEffect?: boolean;
  concurrencySafe?: boolean;
  allowClientUserId?: boolean;
  allowedAgents?: readonly string[];
  timeoutMs?: number;
  sourceLabel?: string;
  requiredPermissions?: readonly string[];
  inputSchema?: ToolSchema;
  outputSchema?: ToolSchema;
  metadata?: ToolMetadata;
}

export interface ToolCallContext {
  agentId?: string;
  agentRunId?: string;
  requestId?: string;
  taskId?: string;
  conversationId?: string;
  trustedUserId?: string;
  userId?: string;
  sessionId?: string;
  preview?: boolean;
  enabledTools?: readonly string[];
  grantedPermissions?: readonly string[];
  signal?: AbortSignal;
  metadata?: ToolMetadata;
}

export interface ToolConfirmation {
  granted: boolean;
  reason?: string;
  confirmedAt?: string;
}

export interface ToolCallRequest {
  name?: string;
  toolName?: string;
  input?: JsonValue;
  callId?: string;
  context?: ToolCallContext;
  confirmation?: ToolConfirmation;
  confirmationGranted?: boolean;
  confirmationReason?: string;
  userId?: string;
  sessionId?: string;
  metadata?: ToolMetadata;
}

export interface ToolCallResult {
  toolName: string;
  name?: string;
  status: ToolCallStatus;
  callId?: string;
  output?: JsonValue;
  errorCode?: ToolCallErrorCode;
  errorMessage?: string;
  metadata?: ToolMetadata;
}

export const ToolRiskCategory = {
  ReadOnly: "read_only",
  WriteWithConfirmation: "write_with_confirmation",
  Forbidden: "forbidden",
} as const;

export type ToolRiskCategory =
  (typeof ToolRiskCategory)[keyof typeof ToolRiskCategory];

export const ToolExecutionStatus = {
  Succeeded: "succeeded",
  Empty: "empty",
  InvalidInput: "invalid_input",
  PermissionDenied: "permission_denied",
  TimedOut: "timed_out",
  Cancelled: "cancelled",
  Failed: "failed",
} as const;

export type ToolExecutionStatus =
  (typeof ToolExecutionStatus)[keyof typeof ToolExecutionStatus];

export type ToolErrorCode =
  | ToolCallErrorCode
  | "tool_not_found"
  | "disabled_tool"
  | "invalid_input"
  | "permission_denied"
  | "timed_out"
  | "cancelled"
  | "empty_result"
  | "external_unavailable"
  | "execution_failed";

export interface ToolSourceReference {
  title: string;
  source: string;
  url?: string;
  recordId?: string;
  cached?: boolean;
  safeSummary?: string;
}

export interface ToolExecutionContext {
  userId?: string;
  conversationId?: string;
  taskId?: string;
  agentRunId?: string;
  requestId?: string;
  agentId?: string;
  signal?: AbortSignal;
  enabledTools?: readonly string[];
  grantedPermissions?: readonly string[];
  metadata?: ToolMetadata;
}

export interface ToolExecutionRequest {
  name?: string;
  toolName?: string;
  toolCallId?: string;
  callId?: string;
  input?: JsonValue;
  context?: ToolExecutionContext;
  confirmation?: ToolConfirmation;
  confirmationGranted?: boolean;
  confirmationReason?: string;
  metadata?: ToolMetadata;
}

export interface ToolExecutionResult<TOutput = unknown> {
  toolCallId: string;
  toolName: string;
  status: ToolExecutionStatus;
  output?: TOutput;
  safeSummary: string;
  errorCode?: string;
  retryable: boolean;
  sourceRefs: ToolSourceReference[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  cached?: boolean;
  metadata?: ToolMetadata;
}

export interface ToolValidationResult {
  valid: boolean;
  safeSummary?: string;
  errorCode?: string;
}

export type ToolHandler = (
  request: ToolCallRequest,
) => Promise<ToolCallResult | ToolExecutionResult> | ToolCallResult | ToolExecutionResult;

export interface ToolRegistration {
  definition: ToolDefinition;
  handler: ToolHandler;
  validateInput?: (
    input: JsonValue | undefined,
    context: ToolExecutionContext,
  ) => Promise<ToolValidationResult> | ToolValidationResult;
  metadata?: ToolMetadata;
}

export const ToolPermissionDecision = {
  Allow: "allow",
  Deny: "deny",
  RequireConfirmation: "require_confirmation",
} as const;

export type ToolPermissionDecision =
  (typeof ToolPermissionDecision)[keyof typeof ToolPermissionDecision];

export interface ToolPermissionEvaluation {
  decision: ToolPermissionDecision;
  reason: string;
  metadata?: ToolMetadata;
}

export type ToolPermissionEvaluator = (
  definition: ToolDefinition,
  request: ToolCallRequest | ToolExecutionRequest,
) => ToolPermissionEvaluation;

export interface ToolRuntime {
  listTools(): Promise<ToolDefinition[]>;
  callTool(request: ToolCallRequest): Promise<ToolCallResult>;
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export const ToolAuditEventType = {
  ToolRegistered: "tool_registered",
  ToolResolved: "tool_resolved",
  ToolValidationFailed: "tool_validation_failed",
  ToolPermissionDenied: "tool_permission_denied",
  ToolStarted: "tool_started",
  ToolSucceeded: "tool_succeeded",
  ToolEmpty: "tool_empty",
  ToolTimedOut: "tool_timed_out",
  ToolCancelled: "tool_cancelled",
  ToolFailed: "tool_failed",
  ToolResultReturned: "tool_result_returned",
} as const;

export type ToolAuditEventType =
  (typeof ToolAuditEventType)[keyof typeof ToolAuditEventType];

export interface ToolAuditEvent {
  eventType: ToolAuditEventType;
  toolCallId: string;
  toolName: string;
  displayName?: string;
  taskId?: string;
  agentRunId?: string;
  requestId?: string;
  userId?: string;
  status?: ToolExecutionStatus;
  durationMs?: number;
  safeSummary?: string;
  sourceRefs?: ToolSourceReference[];
  errorCode?: string;
  timestamp: string;
}
