// Agent Runtime v1 -- Tool Executor (Safety Skeleton)
import type { AgentId, RunId } from "../core/agent-types.ts";
import type { AgentEvent } from "../core/agent-events.ts";
import { createToolRequestedEvent, createToolStartedEvent, createToolCompletedEvent, createToolRejectedEvent, createToolFailedEvent } from "../core/agent-events.ts";
import type { AgentTool, ToolExecutionContext, ToolExecutionResult, ToolExecutionStatus } from "./tool-types.ts";
import { ToolExecutionStatus as S, ToolPermissionDecision as D } from "./tool-types.ts";
import type { AgentToolRegistry } from "./tool-registry.ts";
import type { AgentToolPermissionEvaluator } from "./tool-permission.ts";
import { DefaultAgentToolPermissionEvaluator, isDenied, requiresConfirmation } from "./tool-permission.ts";

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
    super('Input validation failed for "' + toolName + '": ' + message);
    this.name = "ToolInputValidationError";
    this.toolName = toolName;
  }
}

type ExecReturn = { readonly result: ToolExecutionResult; readonly events: AgentEvent[] };

export class SkeletonAgentToolExecutor implements AgentToolExecutor {
  private readonly registry: AgentToolRegistry;
  private readonly permission: AgentToolPermissionEvaluator;
  private readonly config: ToolExecutorConfig;
  private readonly executedCallIds = new Set<string>();

  constructor(params?: {
    readonly registry?: AgentToolRegistry;
    readonly permission?: AgentToolPermissionEvaluator;
    readonly config?: Partial<ToolExecutorConfig>;
  }) {
    this.registry = params?.registry ?? (function() { throw new Error("ToolRegistry required"); })() as unknown as AgentToolRegistry;
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
    const events: AgentEvent[] = [];
    const toolCallId = "tcall_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const startedAt = new Date().toISOString();

    if (this.executedCallIds.has(toolCallId)) {
      return this.errorResult(toolCallId, toolName, S.Failed, "DUPLICATE_TOOL_CALL", "Tool call already executed", startedAt, events);
    }
    this.executedCallIds.add(toolCallId);

    events.push(createToolRequestedEvent(context.runId, context.agentId, { toolName, inputSummary: this.summarizeInput(input) }));

    const tool = this.registry.get(toolName);
    if (!tool) {
      return this.deniedResult(toolCallId, toolName, "Tool not registered", startedAt, events);
    }

    let validatedInput: unknown;
    try { validatedInput = tool.inputSchema.validate(input); }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.errorResult(toolCallId, toolName, S.Failed, "INPUT_VALIDATION_FAILED", msg, startedAt, events);
    }

    const execCtx: ToolExecutionContext = {
      agentId: context.agentId,
      runId: context.runId,
      userId: context.userId,
      conversationId: context.conversationId,
      taskId: context.taskId,
      signal: context.signal,
      isAuthenticated: context.isAuthenticated,
      isUserAuthorized: context.isUserAuthorized,
      runMode: this.config.mode,
    };

    const perm = this.permission.evaluate(tool.metadata, execCtx);
    if (isDenied(perm)) {
      return this.deniedResult(toolCallId, toolName, perm.reason, startedAt, events);
    }
    if (requiresConfirmation(perm)) {
      if (this.config.mode === "test") {
        return this.deniedResult(toolCallId, toolName, "Confirmation not available in test mode: " + perm.reason, startedAt, events);
      }
      return {
        result: {
          toolCallId, status: S.Rejected,
          safeSummary: perm.requiredConfirmationMessage ?? "Confirmation required.",
          errorCode: "CONFIRMATION_REQUIRED", retryable: true,
          startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - new Date(startedAt).getTime(),
        },
        events: [...events, createToolRejectedEvent(context.runId, context.agentId, { toolCallId, toolName, reason: perm.reason })],
      };
    }

    const timeoutMs = tool.metadata.timeoutMs;
    const ac = new AbortController();
    const tid = setTimeout(function() { ac.abort(new Error("Tool execution timed out.")); }, timeoutMs);
    if (context.signal) {
      if (context.signal.aborted) { clearTimeout(tid); return this.cancelledResult(toolCallId, toolName, startedAt, events); }
      context.signal.addEventListener("abort", function() { ac.abort(context.signal!.reason); }, { once: true });
    }

    events.push(createToolStartedEvent(context.runId, context.agentId, { toolCallId, toolName }));

    try {
      const execResult = await tool.execute(validatedInput as any, { ...execCtx, signal: ac.signal });
      clearTimeout(tid);
      const safe = this.trimResult(execResult);
      events.push(createToolCompletedEvent(context.runId, context.agentId, { toolCallId, toolName, status: safe.status, safeSummary: safe.safeSummary, durationMs: safe.durationMs }));
      return { result: safe, events };
    } catch (err: unknown) {
      clearTimeout(tid);
      if (ac.signal.aborted) {
        const msg = (err as Error)?.message ?? "";
        return msg.indexOf("timed out") >= 0 ? this.timeoutResult(toolCallId, toolName, timeoutMs, startedAt, events) : this.cancelledResult(toolCallId, toolName, startedAt, events);
      }
      return this.errorResult(toolCallId, toolName, S.Failed, "EXECUTION_FAILED", err instanceof Error ? err.message : String(err), startedAt, events);
    }
  }

  private trimResult(r: ToolExecutionResult): ToolExecutionResult {
    const safe = this.sanitizeSafeSummary(r.safeSummary);
    return { ...r, safeSummary: safe, data: this.config.mode === "test" ? undefined : r.data };
  }

  private sanitizeSafeSummary(summary: string): string {
    var patterns = [/api[_-]?key/i, /secret/i, /token/i, /password/i, /credential/i];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(summary)) return "[Summary redacted -- may contain sensitive data]";
    }
    return summary;
  }

  private summarizeInput(input: unknown): string {
    if (typeof input === "string") return input.slice(0, 100);
    if (input === null || input === undefined) return "<empty>";
    return JSON.stringify(input).slice(0, 200);
  }

  private makeResult(toolCallId: string, toolName: string, status: ToolExecutionStatus, opts: {
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly safeSummary: string;
    readonly retryable: boolean;
    readonly data?: unknown;
    readonly startedAt: string;
    readonly extraEvents?: AgentEvent[];
  }): ExecReturn {
    var completedAt = new Date().toISOString();
    var durationMs = Date.now() - new Date(opts.startedAt).getTime();
    return {
      result: { toolCallId, status, safeSummary: opts.safeSummary, errorCode: opts.errorCode, retryable: opts.retryable, startedAt: opts.startedAt, completedAt, durationMs, data: opts.data },
      events: opts.extraEvents ?? [],
    };
  }

  private deniedResult(toolCallId: string, toolName: string, reason: string, startedAt: string, events: AgentEvent[]): ExecReturn {
    events.push(createToolRejectedEvent(events[0]?.runId ?? "unknown", events[0]?.agentId ?? "unknown", { toolCallId, toolName, reason }));
    return this.makeResult(toolCallId, toolName, S.Rejected, { errorCode: "PERMISSION_DENIED", errorMessage: reason, safeSummary: "Tool denied: " + reason, retryable: false, startedAt, extraEvents: events });
  }

  private errorResult(toolCallId: string, toolName: string, status: ToolExecutionStatus, errorCode: string, message: string, startedAt: string, events: AgentEvent[]): ExecReturn {
    events.push(createToolFailedEvent(events[0]?.runId ?? "unknown", events[0]?.agentId ?? "unknown", { toolCallId, toolName, errorCode, errorMessage: message }));
    return this.makeResult(toolCallId, toolName, status, { errorCode, errorMessage: message, safeSummary: "Tool failed: " + message, retryable: errorCode === "EXECUTION_FAILED", startedAt, extraEvents: events });
  }

  private timeoutResult(toolCallId: string, toolName: string, timeoutMs: number, startedAt: string, events: AgentEvent[]): ExecReturn {
    return this.errorResult(toolCallId, toolName, S.Timeout, "TIMEOUT", "Tool execution exceeded timeout of " + timeoutMs + "ms.", startedAt, events);
  }

  private cancelledResult(toolCallId: string, toolName: string, startedAt: string, events: AgentEvent[]): ExecReturn {
    return this.errorResult(toolCallId, toolName, S.Cancelled, "CANCELLED", "Tool execution was cancelled.", startedAt, events);
  }
}
