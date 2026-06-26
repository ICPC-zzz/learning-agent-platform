// ============================================================
// Agent Runtime v1  --  Extended Tool Types
// ============================================================
// Extends the base ai-core tool types with agent-runtime specific
// metadata required for the unified execution base.

import type { AgentId } from "../core/agent-types.ts";

// -----------------------------------------------------------
// Tool Categories
// -----------------------------------------------------------

export const AgentToolCategory = {
  ReadOnly: "readonly",
  UserData: "user_data",
  ContentFetch: "content_fetch",
  Analysis: "analysis",
  Recommendation: "recommendation",
  CodeGeneration: "code_generation",
  Debug: "debug",
  System: "system",
  Test: "test",
} as const;

export type AgentToolCategory =
  (typeof AgentToolCategory)[keyof typeof AgentToolCategory];

// -----------------------------------------------------------
// Tool Sensitivity Level
// -----------------------------------------------------------

export const AgentToolSensitivity = {
  None: "none",
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type AgentToolSensitivity =
  (typeof AgentToolSensitivity)[keyof typeof AgentToolSensitivity];

// -----------------------------------------------------------
// Tool Input Schema
// -----------------------------------------------------------

/** JSON Schema-like type for tool input validation. */
export type ToolInputSchema<TInput = unknown> = {
  readonly _brand: "ToolInputSchema";
  readonly _inputType: TInput;
  readonly schema: Record<string, unknown>;

  /** Validate raw input against the schema. Returns validated input or throws. */
  validate(input: unknown): TInput;
};

// -----------------------------------------------------------
// Tool Execution Context
// -----------------------------------------------------------

export interface ToolExecutionContext {
  readonly agentId: AgentId;
  readonly runId: string;
  readonly userId?: string;
  readonly conversationId?: string;
  readonly taskId?: string;
  readonly signal?: AbortSignal;
  readonly isAuthenticated: boolean;
  readonly isUserAuthorized: boolean;
  readonly runMode: "interactive" | "background" | "test";
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// -----------------------------------------------------------
// Tool Execution Result
// -----------------------------------------------------------

export const ToolExecutionStatus = {
  Success: "success",
  Rejected: "rejected",
  Timeout: "timeout",
  Cancelled: "cancelled",
  Failed: "failed",
} as const;

export type ToolExecutionStatus =
  (typeof ToolExecutionStatus)[keyof typeof ToolExecutionStatus];

export interface ToolExecutionResult<TOutput = unknown> {
  readonly toolCallId: string;
  readonly status: ToolExecutionStatus;
  readonly data?: TOutput;
  readonly safeSummary: string;
  readonly errorCode?: string;
  readonly retryable: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

// -----------------------------------------------------------
// Agent Tool Metadata
// -----------------------------------------------------------

export interface AgentToolMetadata {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: AgentToolCategory;
  readonly readOnly: boolean;
  readonly sideEffect: boolean;
  readonly parallelSafe: boolean;
  readonly requiresConfirmation: boolean;
  readonly requiresAuthentication: boolean;
  readonly sensitivity: AgentToolSensitivity;
  readonly timeoutMs: number;
  readonly allowedAgents: readonly AgentId[];
  readonly disabledByDefault: boolean;
}

// -----------------------------------------------------------
// Agent Tool Interface (Unified)
// -----------------------------------------------------------

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  readonly metadata: AgentToolMetadata;
  readonly inputSchema: ToolInputSchema<TInput>;

  execute(
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult<TOutput>>;
}

// -----------------------------------------------------------
// Permission Decision
// -----------------------------------------------------------

export const ToolPermissionDecision = {
  Allow: "ALLOW",
  RequireConfirmation: "REQUIRE_CONFIRMATION",
  Deny: "DENY",
} as const;

export type ToolPermissionDecision =
  (typeof ToolPermissionDecision)[keyof typeof ToolPermissionDecision];

export interface ToolPermissionContext {
  readonly tool: AgentToolMetadata;
  readonly agentId: AgentId;
  readonly userId?: string;
  readonly runMode: ToolExecutionContext["runMode"];
  readonly isAuthenticated: boolean;
  readonly isUserAuthorized: boolean;
}

export interface ToolPermissionResult {
  readonly decision: ToolPermissionDecision;
  readonly reason: string;
  readonly requiredConfirmationMessage?: string;
}

// -----------------------------------------------------------
// Global Deny Rules
// -----------------------------------------------------------

/** Globally denied tool categories or operations. */
export const GLOBAL_DENY_RULES: Readonly<Record<string, string>> = {
  "docker.judge": "Docker Judge execution is globally disabled.",
  "shell.execute": "Arbitrary command execution is globally disabled.",
  "file.write.unauthorized": "Unauthorized file writes are globally disabled.",
  "db.destructive_write":
    "Destructive database writes are globally disabled.",
  "api_key.read": "API key reading is globally disabled.",
  "raw_prompt.persist": "Raw prompt persistence is globally disabled.",
  "raw_response.persist": "Raw response persistence is globally disabled.",
  "external_tool.unapproved":
    "Unapproved external tool execution is globally disabled.",
};

/**
 * Check if a tool matches any global deny rule by name or category.
 */
export function matchesGlobalDenyRule(
  toolMetadata: AgentToolMetadata,
): string | undefined {
  // Direct name match
  if (GLOBAL_DENY_RULES[toolMetadata.name]) {
    return GLOBAL_DENY_RULES[toolMetadata.name];
  }

  // Category-based checks
  if (
    toolMetadata.category === AgentToolCategory.System &&
    toolMetadata.sensitivity === AgentToolSensitivity.Critical
  ) {
    return "Critical system tools are globally restricted.";
  }

  return undefined;
}

// -----------------------------------------------------------
// Default Tool Metadata Factory
// -----------------------------------------------------------

/**
 * Default metadata values for a new tool.
 * All tools default to disabled, requiring confirmation, not read-only.
 */
export function createDefaultToolMetadata(
  overrides: Partial<AgentToolMetadata> & {
    readonly name: string;
    readonly description: string;
  },
): AgentToolMetadata {
  return {
    name: overrides.name,
    description: overrides.description,
    version: overrides.version ?? "1.0.0",
    category: overrides.category ?? AgentToolCategory.Test,
    readOnly: overrides.readOnly ?? false,
    sideEffect: overrides.sideEffect ?? true,
    parallelSafe: overrides.parallelSafe ?? false,
    requiresConfirmation: overrides.requiresConfirmation ?? true,
    requiresAuthentication:
      overrides.requiresAuthentication ?? false,
    sensitivity: overrides.sensitivity ?? AgentToolSensitivity.Medium,
    timeoutMs: overrides.timeoutMs ?? 30_000,
    allowedAgents: overrides.allowedAgents ?? [],
    disabledByDefault: overrides.disabledByDefault ?? true,
  };
}
