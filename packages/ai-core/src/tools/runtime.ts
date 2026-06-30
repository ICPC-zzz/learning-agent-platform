import { createChildAbortController, createTimeoutAbortPromise } from "./abort-controller.ts";
import {
  createToolErrorResult,
  createToolExecutionResult,
  getErrorMessage,
  safeToolSummaryForStatus,
  sanitizeSafeSummary,
} from "./errors.ts";
import { InMemoryToolRegistry } from "./registry.ts";
import {
  ToolAuditEventType,
  ToolCallErrorCode,
  ToolCallStatus,
  ToolExecutionStatus,
  ToolPermissionDecision,
  ToolRiskCategory,
  type JsonValue,
  type ToolAuditEvent,
  type ToolCallRequest,
  type ToolCallResult,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionRequest,
  type ToolExecutionResult,
  type ToolPermissionEvaluation,
  type ToolPermissionEvaluator,
  type ToolRegistration,
  type ToolRuntime,
} from "./types.ts";
import {
  createToolCallId,
  getToolCallName,
  isConfirmationGranted,
  normalizeToolName,
  validateToolInputAgainstSchema,
} from "./utils.ts";

export interface InMemoryToolRuntimeOptions {
  readonly permissionEvaluator?: ToolPermissionEvaluator;
  readonly auditSink?: (event: ToolAuditEvent) => void;
  readonly defaultTimeoutMs?: number;
}

export class InMemoryToolRuntime implements ToolRuntime {
  private readonly registry: InMemoryToolRegistry;
  private readonly permissionEvaluator: ToolPermissionEvaluator;
  private readonly auditSink?: (event: ToolAuditEvent) => void;
  private readonly defaultTimeoutMs: number;
  private readonly auditEvents: ToolAuditEvent[] = [];

  constructor(
    registryOrRegistrations:
      | InMemoryToolRegistry
      | readonly ToolRegistration[] = new InMemoryToolRegistry(),
    options: InMemoryToolRuntimeOptions = {},
  ) {
    this.registry =
      registryOrRegistrations instanceof InMemoryToolRegistry
        ? registryOrRegistrations
        : new InMemoryToolRegistry(registryOrRegistrations);
    this.permissionEvaluator =
      options.permissionEvaluator ?? defaultToolPermissionEvaluator;
    this.auditSink = options.auditSink;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    for (const definition of this.registry.list()) {
      this.audit(ToolAuditEventType.ToolRegistered, {
        toolCallId: `registered_${definition.name}`,
        definition,
        context: {},
        safeSummary: "工具已注册。",
      });
    }
  }

  async listTools(): Promise<ToolDefinition[]> {
    return this.registry.list();
  }

  listAuditEvents(): ToolAuditEvent[] {
    return [...this.auditEvents];
  }

  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const result = await this.executeTool(request);
    return mapExecutionResultToLegacyCallResult(result);
  }

  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const toolCallId = request.toolCallId ?? request.callId ?? createToolCallId();
    const startedAt = new Date().toISOString();
    const rawName = getToolCallName(request);
    const context = normalizeExecutionContext(request.context);

    if (rawName === undefined) {
      return this.finish(createToolExecutionResult({
        toolCallId,
        toolName: "",
        status: ToolExecutionStatus.InvalidInput,
        startedAt,
        errorCode: ToolCallErrorCode.InvalidToolRequest,
        safeSummary: "工具参数不完整，暂时无法执行。",
        retryable: false,
      }), context);
    }

    const normalizedName = normalizeRequestToolName(rawName);
    if (normalizedName === undefined) {
      return this.finish(createToolExecutionResult({
        toolCallId,
        toolName: rawName,
        status: ToolExecutionStatus.InvalidInput,
        startedAt,
        errorCode: ToolCallErrorCode.InvalidToolRequest,
        safeSummary: "工具参数不完整，暂时无法执行。",
        retryable: false,
      }), context);
    }

    const registration = this.registry.get(normalizedName);
    if (!registration) {
      return this.finish(createToolExecutionResult({
        toolCallId,
        toolName: normalizedName,
        status: ToolExecutionStatus.Failed,
        startedAt,
        errorCode: ToolCallErrorCode.ToolNotFound,
        safeSummary: "当前没有可用于完成此任务的工具。",
        retryable: false,
      }), context);
    }

    const { definition, handler } = registration;
    this.audit(ToolAuditEventType.ToolResolved, {
      toolCallId,
      definition,
      context,
      status: ToolExecutionStatus.Succeeded,
      safeSummary: "工具已解析。",
    });

    const enabledCheck = validateToolEnabledForContext(definition, context);
    if (enabledCheck) {
      return this.finish(this.permissionResult({
        toolCallId,
        definition,
        startedAt,
        context,
        reason: enabledCheck,
      }), context);
    }

    const schemaValidation = validateToolInputAgainstSchema(
      request.input,
      definition.inputSchema,
    );
    if (!schemaValidation.valid) {
      return this.finish(this.validationResult({
        toolCallId,
        definition,
        startedAt,
        context,
        reason: schemaValidation.message,
      }), context);
    }

    if (registration.validateInput) {
      const customValidation = await registration.validateInput(request.input, context);
      if (!customValidation.valid) {
        return this.finish(this.validationResult({
          toolCallId,
          definition,
          startedAt,
          context,
          reason: customValidation.safeSummary ?? "工具输入校验失败。",
          errorCode: customValidation.errorCode,
        }), context);
      }
    }

    const permission = this.permissionEvaluator(definition, {
      ...request,
      callId: toolCallId,
      context: toLegacyContext(context),
    });
    if (permission.decision === ToolPermissionDecision.Deny) {
      return this.finish(this.permissionResult({
        toolCallId,
        definition,
        startedAt,
        context,
        reason: permission.reason,
        errorCode: permission.reason === "tool_disabled_by_default"
          ? ToolCallErrorCode.DisabledByDefault
          : ToolCallErrorCode.PermissionDenied,
      }), context);
    }

    if (
      (definition.requiresConfirmation ||
        permission.decision === ToolPermissionDecision.RequireConfirmation) &&
      !isConfirmationGranted(request)
    ) {
      return this.finish(this.permissionResult({
        toolCallId,
        definition,
        startedAt,
        context,
        reason: "confirmation_required",
        errorCode: ToolCallErrorCode.ConfirmationRequired,
        retryable: true,
      }), context);
    }

    const child = createChildAbortController(context.signal);
    let timedOut = false;
    const timeoutMs = definition.timeoutMs ?? this.defaultTimeoutMs;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.abort(new Error("TOOL_TIMEOUT"));
    }, timeoutMs);

    if (child.signal.aborted) {
      clearTimeout(timeout);
      return this.finish(this.cancelledResult(toolCallId, definition, startedAt, context), context);
    }

    this.audit(ToolAuditEventType.ToolStarted, {
      toolCallId,
      definition,
      context,
      status: ToolExecutionStatus.Succeeded,
      safeSummary: `${definition.displayName ?? definition.name}开始执行。`,
    });

    try {
      const handlerResult = await Promise.race([
        Promise.resolve(handler({
          ...request,
          name: definition.name,
          toolName: definition.name,
          callId: toolCallId,
          context: sanitizeToolCallContext({ ...context, signal: child.signal }, definition),
          userId: undefined,
        } satisfies ToolCallRequest)),
        createTimeoutAbortPromise(child.signal),
      ]);
      clearTimeout(timeout);

      if (child.signal.aborted) {
        return this.finish(
          timedOut
            ? this.timeoutResult(toolCallId, definition, startedAt, context)
            : this.cancelledResult(toolCallId, definition, startedAt, context),
          context,
        );
      }

      return this.finish(normalizeHandlerResult({
        definition,
        startedAt,
        toolCallId,
        result: handlerResult,
      }), context);
    } catch (error) {
      clearTimeout(timeout);

      if (child.signal.aborted || isAbortLikeError(error)) {
        return this.finish(
          timedOut
            ? this.timeoutResult(toolCallId, definition, startedAt, context)
            : this.cancelledResult(toolCallId, definition, startedAt, context),
          context,
        );
      }

      return this.finish(createToolExecutionResult({
        toolCallId,
        toolName: definition.name,
        status: ToolExecutionStatus.Failed,
        startedAt,
        errorCode: ToolCallErrorCode.ExecutionFailed,
        safeSummary: "工具执行失败，请稍后重试。",
        retryable: true,
        metadata: {
          legacyErrorMessage: getErrorMessage(error),
          riskLevel: definition.riskLevel,
        },
      }), context);
    }
  }

  private validationResult(input: {
    toolCallId: string;
    definition: ToolDefinition;
    startedAt: string;
    context: ToolExecutionContext;
    reason: string;
    errorCode?: string;
  }): ToolExecutionResult {
    this.audit(ToolAuditEventType.ToolValidationFailed, {
      toolCallId: input.toolCallId,
      definition: input.definition,
      context: input.context,
      status: ToolExecutionStatus.InvalidInput,
      safeSummary: "工具参数不完整，暂时无法执行。",
      errorCode: input.errorCode ?? ToolCallErrorCode.InvalidToolInput,
    });
    return createToolExecutionResult({
      toolCallId: input.toolCallId,
      toolName: input.definition.name,
      status: ToolExecutionStatus.InvalidInput,
      startedAt: input.startedAt,
      errorCode: input.errorCode ?? ToolCallErrorCode.InvalidToolInput,
      safeSummary: "工具参数不完整，暂时无法执行。",
      retryable: false,
      metadata: { legacyErrorMessage: input.reason },
    });
  }

  private permissionResult(input: {
    toolCallId: string;
    definition: ToolDefinition;
    startedAt: string;
    context: ToolExecutionContext;
    reason: string;
    errorCode?: string;
    retryable?: boolean;
  }): ToolExecutionResult {
    this.audit(ToolAuditEventType.ToolPermissionDenied, {
      toolCallId: input.toolCallId,
      definition: input.definition,
      context: input.context,
      status: ToolExecutionStatus.PermissionDenied,
      safeSummary: "当前操作没有执行权限。",
      errorCode: input.errorCode ?? ToolCallErrorCode.PermissionDenied,
    });
    return createToolExecutionResult({
      toolCallId: input.toolCallId,
      toolName: input.definition.name,
      status: ToolExecutionStatus.PermissionDenied,
      startedAt: input.startedAt,
      errorCode: input.errorCode ?? ToolCallErrorCode.PermissionDenied,
      safeSummary: "当前操作没有执行权限。",
      retryable: input.retryable ?? false,
      metadata: { legacyErrorMessage: input.reason },
    });
  }

  private timeoutResult(
    toolCallId: string,
    definition: ToolDefinition,
    startedAt: string,
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    this.audit(ToolAuditEventType.ToolTimedOut, {
      toolCallId,
      definition,
      context,
      status: ToolExecutionStatus.TimedOut,
      safeSummary: "数据查询超时，你可以稍后重试。",
      errorCode: ToolCallErrorCode.TimedOut,
    });
    return createToolExecutionResult({
      toolCallId,
      toolName: definition.name,
      status: ToolExecutionStatus.TimedOut,
      startedAt,
      errorCode: ToolCallErrorCode.TimedOut,
      safeSummary: "数据查询超时，你可以稍后重试。",
      retryable: true,
    });
  }

  private cancelledResult(
    toolCallId: string,
    definition: ToolDefinition,
    startedAt: string,
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    this.audit(ToolAuditEventType.ToolCancelled, {
      toolCallId,
      definition,
      context,
      status: ToolExecutionStatus.Cancelled,
      safeSummary: "本次工具调用已取消。",
      errorCode: ToolCallErrorCode.Cancelled,
    });
    return createToolExecutionResult({
      toolCallId,
      toolName: definition.name,
      status: ToolExecutionStatus.Cancelled,
      startedAt,
      errorCode: ToolCallErrorCode.Cancelled,
      safeSummary: "本次工具调用已取消。",
      retryable: true,
    });
  }

  private finish(result: ToolExecutionResult, context: ToolExecutionContext): ToolExecutionResult {
    const eventType = auditEventTypeForResult(result.status);
    if (eventType) {
      this.audit(eventType, {
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        displayName: String(result.metadata?.displayName ?? result.toolName),
        context,
        status: result.status,
        safeSummary: result.safeSummary,
        errorCode: result.errorCode,
        durationMs: result.durationMs,
        sourceRefs: result.sourceRefs,
      });
    }
    this.audit(ToolAuditEventType.ToolResultReturned, {
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      displayName: String(result.metadata?.displayName ?? result.toolName),
      context,
      status: result.status,
      safeSummary: result.safeSummary,
      errorCode: result.errorCode,
      durationMs: result.durationMs,
      sourceRefs: result.sourceRefs,
    });
    return result;
  }

  private audit(
    eventType: ToolAuditEventType,
    input: {
      toolCallId: string;
      definition?: ToolDefinition;
      toolName?: string;
      displayName?: string;
      context: ToolExecutionContext;
      status?: ToolExecutionStatus;
      safeSummary?: string;
      errorCode?: string;
      durationMs?: number;
      sourceRefs?: ToolExecutionResult["sourceRefs"];
    },
  ): void {
    const event: ToolAuditEvent = {
      eventType,
      toolCallId: input.toolCallId,
      toolName: input.definition?.name ?? input.toolName ?? "",
      displayName: input.definition?.displayName ?? input.displayName,
      taskId: input.context.taskId,
      agentRunId: input.context.agentRunId,
      requestId: input.context.requestId,
      userId: input.context.userId,
      status: input.status,
      durationMs: input.durationMs,
      safeSummary: input.safeSummary,
      sourceRefs: input.sourceRefs,
      errorCode: input.errorCode,
      timestamp: new Date().toISOString(),
    };
    this.auditEvents.push(event);
    this.auditSink?.(event);
  }
}

export function defaultToolPermissionEvaluator(
  definition: ToolDefinition,
  request: ToolCallRequest | ToolExecutionRequest,
): ToolPermissionEvaluation {
  const enabledTools = new Set(request.context?.enabledTools ?? []);

  if (definition.riskCategory === ToolRiskCategory.Forbidden) {
    return {
      decision: ToolPermissionDecision.Deny,
      reason: "tool_forbidden",
    };
  }

  if (definition.disabledByDefault !== false && !enabledTools.has(definition.name)) {
    return {
      decision: ToolPermissionDecision.Deny,
      reason: "tool_disabled_by_default",
    };
  }

  const requiredPermissions = definition.requiredPermissions ?? [];
  if (requiredPermissions.length > 0) {
    const grantedPermissions = new Set(request.context?.grantedPermissions ?? []);
    const missing = requiredPermissions.filter((permission) => !grantedPermissions.has(permission));

    if (missing.length > 0) {
      return {
        decision: ToolPermissionDecision.Deny,
        reason: "missing_required_permission",
        metadata: {
          missingPermissions: missing,
        },
      };
    }
  }

  if (definition.requiresConfirmation && !isConfirmationGranted(request)) {
    return {
      decision: ToolPermissionDecision.RequireConfirmation,
      reason: "confirmation_required",
    };
  }

  return {
    decision: ToolPermissionDecision.Allow,
    reason: "allowed",
  };
}

function normalizeHandlerResult(input: {
  definition: ToolDefinition;
  startedAt: string;
  toolCallId: string;
  result: ToolCallResult | ToolExecutionResult;
}): ToolExecutionResult {
  if (isToolExecutionResult(input.result)) {
    const status = input.result.status;
    return createToolExecutionResult({
      toolCallId: input.toolCallId,
      toolName: input.definition.name,
      status,
      startedAt: input.startedAt,
      output: input.result.output,
      safeSummary: safeToolSummaryForStatus({
        status,
        errorCode: input.result.errorCode,
        fallback: input.result.safeSummary,
      }),
      errorCode: input.result.errorCode,
      retryable: input.result.retryable,
      sourceRefs: input.result.sourceRefs,
      cached: input.result.cached,
      metadata: {
        ...(input.result.metadata ?? {}),
        displayName: input.definition.displayName ?? input.definition.name,
      },
    });
  }

  const legacy = input.result;
  if (legacy.status === ToolCallStatus.Success || legacy.status === ToolCallStatus.Succeeded) {
    const empty = isEmptyToolOutput(legacy.output);
    return createToolExecutionResult({
      toolCallId: input.toolCallId,
      toolName: input.definition.name,
      status: empty ? ToolExecutionStatus.Empty : ToolExecutionStatus.Succeeded,
      startedAt: input.startedAt,
      output: legacy.output,
      safeSummary: empty
        ? "本次查询没有找到符合条件的数据。"
        : sanitizeSafeSummary(String(legacy.metadata?.safeSummary ?? `${input.definition.displayName ?? input.definition.name}执行完成。`)),
      errorCode: empty ? ToolCallErrorCode.EmptyResult : undefined,
      retryable: false,
      sourceRefs: normalizeSourceRefs(legacy.metadata?.sourceRefs),
      cached: legacy.metadata?.cached === true,
      metadata: {
        ...(legacy.metadata ?? {}),
        displayName: input.definition.displayName ?? input.definition.name,
      },
    });
  }

  const status = legacy.errorCode === ToolCallErrorCode.InvalidToolInput
    ? ToolExecutionStatus.InvalidInput
    : legacy.errorCode === ToolCallErrorCode.PermissionDenied || legacy.errorCode === ToolCallErrorCode.DisabledByDefault
      ? ToolExecutionStatus.PermissionDenied
      : legacy.errorCode === ToolCallErrorCode.TimedOut
        ? ToolExecutionStatus.TimedOut
        : legacy.errorCode === ToolCallErrorCode.Cancelled
          ? ToolExecutionStatus.Cancelled
          : legacy.errorCode === ToolCallErrorCode.EmptyResult
            ? ToolExecutionStatus.Empty
            : ToolExecutionStatus.Failed;

  return createToolExecutionResult({
    toolCallId: input.toolCallId,
    toolName: input.definition.name,
    status,
    startedAt: input.startedAt,
    errorCode: legacy.errorCode,
    safeSummary: safeToolSummaryForStatus({
      status,
      errorCode: legacy.errorCode,
    }),
    retryable: status === ToolExecutionStatus.Failed || status === ToolExecutionStatus.TimedOut,
    sourceRefs: normalizeSourceRefs(legacy.metadata?.sourceRefs),
    cached: legacy.metadata?.cached === true,
    metadata: {
      ...(legacy.metadata ?? {}),
      ...(legacy.errorMessage ? { legacyErrorMessage: legacy.errorMessage } : {}),
      displayName: input.definition.displayName ?? input.definition.name,
    },
  });
}

function isToolExecutionResult(value: ToolCallResult | ToolExecutionResult): value is ToolExecutionResult {
  return typeof (value as ToolExecutionResult).safeSummary === "string"
    && typeof (value as ToolExecutionResult).toolCallId === "string"
    && typeof (value as ToolExecutionResult).retryable === "boolean"
    && Array.isArray((value as ToolExecutionResult).sourceRefs);
}

function mapExecutionResultToLegacyCallResult(result: ToolExecutionResult): ToolCallResult {
  if (result.status === ToolExecutionStatus.Succeeded) {
    return {
      toolName: result.toolName,
      name: result.toolName,
      status: ToolCallStatus.Success,
      callId: result.toolCallId,
      output: result.output as JsonValue | undefined,
      metadata: result.metadata,
    };
  }

  const errorCode = mapExecutionErrorCode(result);
  return createToolErrorResult({
    toolName: result.toolName,
    callId: result.toolCallId,
    status: result.status === ToolExecutionStatus.PermissionDenied
      ? ToolCallStatus.Denied
      : result.errorCode === ToolCallErrorCode.ConfirmationRequired
        ? ToolCallStatus.RequiresConfirmation
        : ToolCallStatus.Failed,
    errorCode,
    errorMessage: result.safeSummary,
    metadata: result.metadata,
  });
}

function mapExecutionErrorCode(result: ToolExecutionResult): ToolCallErrorCode {
  if (result.errorCode && Object.values(ToolCallErrorCode).includes(result.errorCode as ToolCallErrorCode)) {
    return result.errorCode as ToolCallErrorCode;
  }

  switch (result.status) {
    case ToolExecutionStatus.Empty:
      return ToolCallErrorCode.EmptyResult;
    case ToolExecutionStatus.InvalidInput:
      return ToolCallErrorCode.InvalidToolInput;
    case ToolExecutionStatus.PermissionDenied:
      return ToolCallErrorCode.PermissionDenied;
    case ToolExecutionStatus.TimedOut:
      return ToolCallErrorCode.TimedOut;
    case ToolExecutionStatus.Cancelled:
      return ToolCallErrorCode.Cancelled;
    case ToolExecutionStatus.Failed:
    case ToolExecutionStatus.Succeeded:
      return ToolCallErrorCode.ExecutionFailed;
  }
}

function validateToolEnabledForContext(
  definition: ToolDefinition,
  context: ToolExecutionContext,
): string | null {
  if (definition.enabled === false) {
    return "tool_disabled";
  }

  const allowedAgents = definition.allowedAgents ?? [];
  if (allowedAgents.length > 0 && context.agentId && !allowedAgents.includes(context.agentId)) {
    return "agent_not_allowed";
  }

  return null;
}

function normalizeExecutionContext(
  context: ToolExecutionRequest["context"] | ToolCallRequest["context"],
): ToolExecutionContext {
  const trustedUserId = context && "trustedUserId" in context
    ? context.trustedUserId
    : undefined;
  const sessionId = context && "sessionId" in context
    ? context.sessionId
    : undefined;

  return {
    userId: trustedUserId ?? context?.userId,
    conversationId: context?.conversationId ?? sessionId,
    taskId: context?.taskId,
    agentRunId: context?.agentRunId,
    requestId: context?.requestId,
    agentId: context?.agentId,
    signal: context?.signal,
    enabledTools: context?.enabledTools,
    grantedPermissions: context?.grantedPermissions,
    metadata: context?.metadata,
  };
}

function toLegacyContext(context: ToolExecutionContext): ToolCallRequest["context"] {
  return {
    trustedUserId: context.userId,
    conversationId: context.conversationId,
    taskId: context.taskId,
    agentRunId: context.agentRunId,
    requestId: context.requestId,
    agentId: context.agentId,
    enabledTools: context.enabledTools,
    grantedPermissions: context.grantedPermissions,
    signal: context.signal,
    metadata: context.metadata,
  };
}

function sanitizeToolCallContext(
  context: ToolExecutionContext,
  definition: ToolDefinition,
): ToolCallRequest["context"] {
  return {
    ...toLegacyContext(context),
    userId: definition.allowClientUserId === true
      ? context.userId
      : undefined,
  };
}

function normalizeRequestToolName(name: string): string | undefined {
  try {
    return normalizeToolName(name);
  } catch {
    return undefined;
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && /abort|cancel|timeout|timed out/i.test(error.message);
}

function isEmptyToolOutput(output: unknown): boolean {
  if (output === null || output === undefined) {
    return true;
  }
  if (Array.isArray(output)) {
    return output.length === 0;
  }
  if (typeof output === "object") {
    const items = (output as { items?: unknown; candidates?: unknown[]; contests?: unknown[] }).items;
    if (Array.isArray(items)) {
      return items.length === 0;
    }
  }
  return false;
}

function normalizeSourceRefs(value: unknown): ToolExecutionResult["sourceRefs"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "工具来源",
      source: typeof item.source === "string" ? item.source : "unknown",
      ...(typeof item.url === "string" ? { url: item.url } : {}),
      ...(typeof item.recordId === "string" ? { recordId: item.recordId } : {}),
      ...(typeof item.safeSummary === "string" ? { safeSummary: item.safeSummary } : {}),
      ...(typeof item.cached === "boolean" ? { cached: item.cached } : {}),
    }));
}

function auditEventTypeForResult(status: ToolExecutionStatus): ToolAuditEventType | null {
  switch (status) {
    case ToolExecutionStatus.Succeeded:
      return ToolAuditEventType.ToolSucceeded;
    case ToolExecutionStatus.Empty:
      return ToolAuditEventType.ToolEmpty;
    case ToolExecutionStatus.TimedOut:
      return null;
    case ToolExecutionStatus.Cancelled:
      return null;
    case ToolExecutionStatus.InvalidInput:
      return null;
    case ToolExecutionStatus.PermissionDenied:
      return null;
    case ToolExecutionStatus.Failed:
      return ToolAuditEventType.ToolFailed;
  }
}
