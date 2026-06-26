type JsonPrimitive = string | number | boolean | null;
type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue =
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
} as const;

export type ToolCallErrorCode =
  (typeof ToolCallErrorCode)[keyof typeof ToolCallErrorCode];

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  inputSchema?: ToolSchema;
  outputSchema?: ToolSchema;
  metadata?: ToolMetadata;
}

export interface ToolCallContext {
  userId?: string;
  sessionId?: string;
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

export type ToolHandler = (
  request: ToolCallRequest,
) => Promise<ToolCallResult> | ToolCallResult;

export interface ToolRegistration {
  definition: ToolDefinition;
  handler: ToolHandler;
  metadata?: ToolMetadata;
}

export interface ToolRuntime {
  listTools(): Promise<ToolDefinition[]>;
  callTool(request: ToolCallRequest): Promise<ToolCallResult>;
}
