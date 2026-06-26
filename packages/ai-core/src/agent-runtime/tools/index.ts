// Agent Runtime v1 -- Tools Module Exports

// For names that exist ONLY as types (no const value), use export type
export type {
  AgentTool,
  AgentToolMetadata,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolInputSchema,
  ToolPermissionContext,
  ToolPermissionResult,
} from "./tool-types.ts";

export type {
  AgentToolRegistry,
} from "./tool-registry.ts";

export type {
  AgentToolPermissionEvaluator,
} from "./tool-permission.ts";

export type {
  AgentToolExecutor,
  ToolExecutorConfig,
} from "./tool-executor.ts";

// For names that exist as BOTH const + type, the value export covers the type too
export {
  AgentToolCategory,
  AgentToolSensitivity,
  ToolExecutionStatus,
  ToolPermissionDecision,
  GLOBAL_DENY_RULES,
  createDefaultToolMetadata,
  matchesGlobalDenyRule,
} from "./tool-types.ts";

export {
  AgentToolRegistryError,
  InMemoryAgentToolRegistry,
} from "./tool-registry.ts";

export {
  DefaultAgentToolPermissionEvaluator,
  isDenied,
  isAllowed,
  requiresConfirmation,
} from "./tool-permission.ts";

export {
  DEFAULT_TOOL_EXECUTOR_CONFIG,
  SkeletonAgentToolExecutor,
  ToolInputValidationError,
} from "./tool-executor.ts";
