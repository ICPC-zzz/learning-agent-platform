// Agent Runtime v1 -- Tool Executor Adapter
import {
  InMemoryToolRegistry,
  InMemoryToolRuntime,
  ToolCallErrorCode,
  ToolExecutionStatus as CanonicalToolExecutionStatus,
  ToolPermissionDecision as CanonicalToolPermissionDecision,
  ToolRiskCategory,
  ToolRiskLevel,
  type JsonValue,
  type ToolDefinition,
  type ToolExecutionResult as CanonicalToolExecutionResult,
  type ToolPermissionEvaluator,
  type ToolRegistration,
} from "../../tools/index.ts";
import type { AgentId, RunId } from "../core/agent-types.ts";
import type { AgentEvent } from "../core/agent-events.ts";
import {
  createToolCompletedEvent,
  createToolFailedEvent,
  createToolRejectedEvent,
  createToolRequestedEvent,
  createToolStartedEvent,
} from "../core/agent-events.ts";
import type {
  AgentTool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolExecutionStatus,
} from "./tool-types.ts";
import {
  ToolExecutionStatus as S,
} from "./tool-types.ts";
import type { AgentToolRegistry } from "./tool-registry.ts";
import type { AgentToolPermissionEvaluator } from "./tool-permission.ts";
import {
  DefaultAgentToolPermissionEvaluator,
  isDenied,
  requiresConfirmation,
} from "./tool-permission.ts";

export interface ToolExecutorConfig {
  readonly defaultTimeoutMs: number;
  readonly mode: "interactive" | "background" | "test";
}

export const DEFAULT_TOOL_EXECUTOR_CONFIG: ToolExecutorConfig = {
  defaultTimeoutMs: 60000,
  mode: "test",
};

export interface AgentToolExecutor {
  execute(toolName: string, input: unknown, context: {
    readonly agentId: AgentId;
    readonly runId: RunId;
    readonly userId?: string;
    readonly conversationId?: string;
    readonly taskId?: string;
    readonly signal?: AbortSignal;
    readonly isAuthenticated: boolean;
    readonly isUserAuthorized: boolean;
  }): Promise<{ readonly result: ToolExecutionResult; readonly events: AgentEvent[] }>;
}

export class ToolInputValidationError extends Error {
  public readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(`Input validation failed for "${toolName}": ${message}`);
    this.name = "ToolInputValidationError";
    this.toolName = toolName;
  }
}

type ExecReturn = { readonly result: ToolExecutionResult; readonly events: AgentEvent[] };

export class SkeletonAgentToolExecutor implements AgentToolExecutor {
  private readonly registry: AgentToolRegistry;
  private readonly permission: AgentToolPermissionEvaluator;
  private readonly config: ToolExecutorConfig;

  constructor(params?: {
    readonly registry?: AgentToolRegistry;
    readonly permission?: AgentToolPermissionEvaluator;
    readonly config?: Partial<ToolExecutorConfig>;
  }) {
    this.registry = params?.registry ?? (function() {
      throw new Error("ToolRegistry required");
    })() as unknown as AgentToolRegistry;
    this.permission = params?.permission ?? new DefaultAgentToolPermissionEvaluator();
    this.config = { ...DEFAULT_TOOL_EXECUTOR_CONFIG, ...params?.config };
  }

  async execute(toolName: string, input: unknown, context: {
    readonly agentId: AgentId;
    readonly runId: RunId;
    readonly userId?: string;
    readonly conversationId?: string;
    readonly taskId?: string;
    readonly signal?: AbortSignal;
    readonly isAuthenticated: boolean;
    readonly isUserAuthorized: boolean;
  }): Promise<ExecReturn> {
    const events: AgentEvent[] = [
      createToolRequestedEvent(context.runId, context.agentId, {
        toolName,
        inputSummary: this.summarizeInput(input),
      }),
    ];

    const tool = this.registry.get(toolName);
    if (!tool) {
      const result = this.toLegacyAgentResult({
        toolCallId: createAgentToolCallId(),
        toolName,
        status: CanonicalToolExecutionStatus.PermissionDenied,
        safeSummary: "当前没有可用于完成此任务的工具。",
        errorCode: ToolCallErrorCode.ToolNotFound,
        retryable: false,
        sourceRefs: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      });
      events.push(createToolRejectedEvent(context.runId, context.agentId, {
        toolCallId: result.toolCallId,
        toolName,
        reason: result.safeSummary,
      }));
      return { result, events };
    }

    const canonicalRegistry = new InMemoryToolRegistry([
      this.toCanonicalRegistration(tool, context),
    ]);
    const runtime = new InMemoryToolRuntime(canonicalRegistry, {
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      permissionEvaluator: this.createCanonicalPermissionEvaluator(context),
    });

    const canonical = await runtime.executeTool({
      toolName: tool.metadata.name,
      input: toJsonInput(input),
      context: {
        userId: context.userId,
        conversationId: context.conversationId,
        taskId: context.taskId,
        agentId: context.agentId,
        requestId: context.runId,
        enabledTools: this.registry.isEnabled(tool.metadata.name)
          ? [tool.metadata.name]
          : [],
        signal: context.signal,
      },
    });

    events.push(createToolStartedEvent(context.runId, context.agentId, {
      toolCallId: canonical.toolCallId,
      toolName: tool.metadata.name,
    }));

    const result = this.toLegacyAgentResult(canonical);
    if (result.status === S.Success) {
      events.push(createToolCompletedEvent(context.runId, context.agentId, {
        toolCallId: result.toolCallId,
        toolName: tool.metadata.name,
        status: result.status,
        safeSummary: result.safeSummary,
        durationMs: result.durationMs,
      }));
    } else if (result.status === S.Rejected) {
      events.push(createToolRejectedEvent(context.runId, context.agentId, {
        toolCallId: result.toolCallId,
        toolName: tool.metadata.name,
        reason: result.safeSummary,
      }));
    } else {
      events.push(createToolFailedEvent(context.runId, context.agentId, {
        toolCallId: result.toolCallId,
        toolName: tool.metadata.name,
        errorCode: result.errorCode ?? "TOOL_FAILED",
        errorMessage: result.safeSummary,
      }));
    }

    return { result, events };
  }

  private toCanonicalRegistration(
    tool: AgentTool,
    executionContext: {
      readonly agentId: AgentId;
      readonly runId: RunId;
      readonly userId?: string;
      readonly conversationId?: string;
      readonly taskId?: string;
      readonly signal?: AbortSignal;
      readonly isAuthenticated: boolean;
      readonly isUserAuthorized: boolean;
    },
  ): ToolRegistration {
    const definition: ToolDefinition = {
      name: tool.metadata.name,
      displayName: tool.metadata.description,
      description: tool.metadata.description,
      riskLevel: mapSensitivityToRiskLevel(tool.metadata.sensitivity),
      riskCategory: tool.metadata.readOnly
        ? ToolRiskCategory.ReadOnly
        : tool.metadata.requiresConfirmation
          ? ToolRiskCategory.WriteWithConfirmation
          : ToolRiskCategory.Forbidden,
      requiresConfirmation: tool.metadata.requiresConfirmation,
      enabled: this.registry.isEnabled(tool.metadata.name),
      disabledByDefault: !this.registry.isEnabled(tool.metadata.name),
      readOnly: tool.metadata.readOnly,
      sideEffect: tool.metadata.sideEffect,
      concurrencySafe: tool.metadata.parallelSafe,
      allowedAgents: tool.metadata.allowedAgents,
      timeoutMs: tool.metadata.timeoutMs,
      sourceLabel: tool.metadata.category,
      inputSchema: toCanonicalToolSchema(tool.inputSchema.schema),
      metadata: {
        adapter: "agent-runtime",
        version: tool.metadata.version,
      },
    };

    return {
      definition,
      validateInput: (rawInput) => {
        try {
          tool.inputSchema.validate(rawInput);
          return { valid: true };
        } catch {
          return {
            valid: false,
            safeSummary: "工具参数不完整，暂时无法执行。",
            errorCode: ToolCallErrorCode.InvalidToolInput,
          };
        }
      },
      handler: async (request) => {
        const validatedInput = tool.inputSchema.validate(request.input);
        const result = await tool.execute(validatedInput, {
          agentId: executionContext.agentId,
          runId: executionContext.runId,
          userId: executionContext.userId,
          conversationId: executionContext.conversationId,
          taskId: executionContext.taskId,
          signal: request.context?.signal,
          isAuthenticated: executionContext.isAuthenticated,
          isUserAuthorized: executionContext.isUserAuthorized,
          runMode: this.config.mode,
        } satisfies ToolExecutionContext);

        return this.toCanonicalExecutionResult(tool, request.callId ?? createAgentToolCallId(), result);
      },
    };
  }

  private createCanonicalPermissionEvaluator(context: {
    readonly agentId: AgentId;
    readonly runId: RunId;
    readonly userId?: string;
    readonly conversationId?: string;
    readonly taskId?: string;
    readonly signal?: AbortSignal;
    readonly isAuthenticated: boolean;
    readonly isUserAuthorized: boolean;
  }): ToolPermissionEvaluator {
    return (definition) => {
      const tool = this.registry.get(definition.name);
      if (!tool || !this.registry.isEnabled(definition.name)) {
        return {
          decision: CanonicalToolPermissionDecision.Deny,
          reason: "tool_disabled_by_default",
        };
      }
      const permission = this.permission.evaluate(tool.metadata, {
        agentId: context.agentId,
        runId: context.runId,
        userId: context.userId,
        conversationId: context.conversationId,
        taskId: context.taskId,
        signal: context.signal,
        isAuthenticated: context.isAuthenticated,
        isUserAuthorized: context.isUserAuthorized,
        runMode: this.config.mode,
      });

      if (isDenied(permission)) {
        return {
          decision: CanonicalToolPermissionDecision.Deny,
          reason: permission.reason,
        };
      }

      if (requiresConfirmation(permission)) {
        return {
          decision: CanonicalToolPermissionDecision.RequireConfirmation,
          reason: permission.reason,
        };
      }

      return {
        decision: CanonicalToolPermissionDecision.Allow,
        reason: permission.reason,
      };
    };
  }

  private toCanonicalExecutionResult(
    tool: AgentTool,
    toolCallId: string,
    result: ToolExecutionResult,
  ): CanonicalToolExecutionResult {
    const status = mapAgentStatusToCanonical(result.status);
    return {
      toolCallId,
      toolName: tool.metadata.name,
      status,
      output: result.data,
      safeSummary: sanitizeAgentSafeSummary(result.safeSummary),
      errorCode: result.errorCode,
      retryable: result.retryable,
      sourceRefs: [],
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      metadata: {
        adapter: "agent-runtime",
        displayName: tool.metadata.description,
      },
    };
  }

  private toLegacyAgentResult(result: CanonicalToolExecutionResult): ToolExecutionResult {
    return {
      toolCallId: result.toolCallId,
      status: mapCanonicalStatusToAgent(result.status),
      data: this.config.mode === "test" ? undefined : result.output,
      safeSummary: sanitizeAgentSafeSummary(result.safeSummary),
      errorCode: result.errorCode,
      retryable: result.retryable,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
    };
  }

  private summarizeInput(input: unknown): string {
    if (typeof input === "string") return input.slice(0, 100);
    if (input === null || input === undefined) return "<empty>";
    return JSON.stringify(input).slice(0, 200);
  }
}

function mapAgentStatusToCanonical(status: ToolExecutionStatus): CanonicalToolExecutionStatus {
  switch (status) {
    case S.Success:
      return CanonicalToolExecutionStatus.Succeeded;
    case S.Rejected:
      return CanonicalToolExecutionStatus.PermissionDenied;
    case S.Timeout:
      return CanonicalToolExecutionStatus.TimedOut;
    case S.Cancelled:
      return CanonicalToolExecutionStatus.Cancelled;
    case S.Failed:
      return CanonicalToolExecutionStatus.Failed;
  }
}

function mapCanonicalStatusToAgent(status: CanonicalToolExecutionStatus): ToolExecutionStatus {
  switch (status) {
    case CanonicalToolExecutionStatus.Succeeded:
      return S.Success;
    case CanonicalToolExecutionStatus.Empty:
      return S.Failed;
    case CanonicalToolExecutionStatus.InvalidInput:
    case CanonicalToolExecutionStatus.PermissionDenied:
      return S.Rejected;
    case CanonicalToolExecutionStatus.TimedOut:
      return S.Timeout;
    case CanonicalToolExecutionStatus.Cancelled:
      return S.Cancelled;
    case CanonicalToolExecutionStatus.Failed:
      return S.Failed;
  }
}

function mapSensitivityToRiskLevel(sensitivity: string): ToolRiskLevel {
  switch (sensitivity) {
    case "none":
    case "low":
      return ToolRiskLevel.Low;
    case "medium":
      return ToolRiskLevel.Medium;
    case "high":
      return ToolRiskLevel.High;
    case "critical":
      return ToolRiskLevel.Critical;
    default:
      return ToolRiskLevel.Medium;
  }
}

function toJsonInput(input: unknown): JsonValue | undefined {
  if (input === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(input)) as JsonValue;
}

function toCanonicalToolSchema(value: unknown): ToolDefinition["inputSchema"] {
  const normalized = JSON.parse(JSON.stringify(value)) as JsonValue;
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
    return undefined;
  }
  return normalized as ToolDefinition["inputSchema"];
}

function createAgentToolCallId(): string {
  return `tcall_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeAgentSafeSummary(summary: string): string {
  if (/(api[_-]?key|secret|token|password|credential)/i.test(summary)) {
    return "[Summary redacted -- may contain sensitive data]";
  }
  if (/(invalid prisma|foreign key constraint|econnrefused|fetch failed|stack trace|failed with empty|tool_result)/i.test(summary)) {
    return "工具执行失败，请稍后重试。";
  }
  return summary;
}
