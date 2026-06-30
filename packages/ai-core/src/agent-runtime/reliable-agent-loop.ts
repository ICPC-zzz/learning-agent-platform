import type {
  LlmChatMessage,
  LlmChatRequest,
  LlmProvider,
  LlmToolCall,
  LlmToolDefinition,
} from "../llm/llm-provider-contract.ts";
import { LlmChatRole } from "../llm/llm-provider-contract.ts";
import {
  createReliableAgentContextState,
  prepareMessagesForProvider,
  prepareToolResultForModel,
  resetToolResultRoundBudget,
  type ReliableAgentContextCompressionConfig,
  type ReliableAgentContextPreparationEvent,
  type ToolResultArtifactRepository,
  type ToolResultBudgetConfig,
} from "./tool-result-context.ts";
import {
  createToolExecutionResult,
  ToolCallErrorCode,
  ToolExecutionStatus,
  ToolRiskCategory,
  type JsonValue,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolRuntime,
} from "../tools/index.ts";

export const ReliableAgentLoopStatus = {
  Succeeded: "succeeded",
  PartiallySucceeded: "partially_succeeded",
  Failed: "failed",
  Cancelled: "cancelled",
  TimedOut: "timed_out",
  LimitReached: "limit_reached",
  UnsupportedToolCalling: "unsupported_tool_calling",
} as const;

export type ReliableAgentLoopStatus =
  (typeof ReliableAgentLoopStatus)[keyof typeof ReliableAgentLoopStatus];

export const ReliableAgentLoopEventType = {
  AgentLoopStarted: "agent_loop_started",
  MemoryContextLoaded: "memory_context_loaded",
  ModelRequestStarted: "model_request_started",
  ModelToolCallsReceived: "model_tool_calls_received",
  ToolCallValidationFailed: "tool_call_validation_failed",
  ToolCallQueued: "tool_call_queued",
  ToolCallStarted: "tool_call_started",
  ToolCallCompleted: "tool_call_completed",
  ToolResultBudgetApplied: "tool_result_budget_applied",
  ToolResultArtifactStored: "tool_result_artifact_stored",
  ToolResultAppended: "tool_result_appended",
  ToolResultMicrocompacted: "tool_result_microcompacted",
  ContextBudgetWarning: "context_budget_warning",
  ContextCompressed: "context_compressed",
  ContextCompressionFailed: "context_compression_failed",
  ContextCompressionPaused: "context_compression_paused",
  ContextBlocked: "context_blocked",
  ModelContinuationStarted: "model_continuation_started",
  ModelFinalAnswerReceived: "model_final_answer_received",
  AgentLoopLimitReached: "agent_loop_limit_reached",
  AgentLoopCancelled: "agent_loop_cancelled",
  AgentLoopTimedOut: "agent_loop_timed_out",
  AgentLoopFailed: "agent_loop_failed",
  AgentLoopCompleted: "agent_loop_completed",
} as const;

export type ReliableAgentLoopEventType =
  (typeof ReliableAgentLoopEventType)[keyof typeof ReliableAgentLoopEventType];

export interface ReliableAgentLoopEvent {
  eventType: ReliableAgentLoopEventType;
  timestamp: string;
  modelTurn?: number;
  toolCallId?: string;
  toolName?: string;
  status?: ReliableAgentLoopStatus | ToolExecutionStatus;
  errorCode?: string;
  durationMs?: number;
  safeSummary?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ReliableAgentLoopLimits {
  maxModelTurns: number;
  maxToolCalls: number;
  maxParallelReadOnlyTools: number;
  modelTimeoutMs: number;
  loopTimeoutMs: number;
  maxToolResultChars: number;
}

export interface RunReliableAgentLoopInput {
  provider: LlmProvider;
  messages: readonly LlmChatMessage[];
  toolRuntime: ToolRuntime;
  tools?: readonly ToolDefinition[];
  allowToolNames?: readonly string[];
  context?: ToolExecutionContext;
  purposeSummary: string;
  memoryContextSummary?: string;
  limits?: Partial<ReliableAgentLoopLimits>;
  toolResultBudget?: Partial<ToolResultBudgetConfig>;
  toolResultArtifactRepository?: ToolResultArtifactRepository;
  contextCompression?: Partial<ReliableAgentContextCompressionConfig>;
  eventSink?: (event: ReliableAgentLoopEvent) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface ReliableAgentLoopResult {
  status: ReliableAgentLoopStatus;
  finalAnswer: string;
  messages: readonly LlmChatMessage[];
  events: readonly ReliableAgentLoopEvent[];
  toolResults: readonly ToolExecutionResult[];
  modelTurnCount: number;
  toolCallCount: number;
  warnings: readonly string[];
}

interface ValidatedToolCall {
  call: LlmToolCall;
  runtimeName: string;
  definition: ToolDefinition;
}

interface InvalidToolCall {
  call: LlmToolCall;
  result: ToolExecutionResult;
}

const DEFAULT_LIMITS: ReliableAgentLoopLimits = {
  maxModelTurns: 4,
  maxToolCalls: 6,
  maxParallelReadOnlyTools: 3,
  modelTimeoutMs: 30_000,
  loopTimeoutMs: 90_000,
  maxToolResultChars: 4_000,
};

const FORBIDDEN_ARGUMENT_KEYS = [
  "userid",
  "ownerid",
  "role",
  "permission",
  "credential",
  "credentials",
  "secret",
  "token",
  "password",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "url",
  "uri",
  "path",
  "filepath",
  "file_path",
  "filename",
  "file",
];

export async function runReliableAgentLoop(
  input: RunReliableAgentLoopInput,
): Promise<ReliableAgentLoopResult> {
  const limits = { ...DEFAULT_LIMITS, ...(input.limits ?? {}) };
  const events: ReliableAgentLoopEvent[] = [];
  const toolResults: ToolExecutionResult[] = [];
  const warnings: string[] = [];
  const messages: LlmChatMessage[] = [...input.messages];
  const controller = new AbortController();
  let timeoutReached = false;
  let modelTurnCount = 0;
  let toolCallCount = 0;
  let hasToolFailure = false;
  let pendingToolResultCallIds = new Set<string>();
  const contextState = createReliableAgentContextState();

  const relayAbort = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", relayAbort, { once: true });
  if (input.signal?.aborted) {
    controller.abort(input.signal.reason);
  }
  const timeoutId = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new Error("AGENT_LOOP_TIMEOUT"));
  }, limits.loopTimeoutMs);

  const emit = async (event: Omit<ReliableAgentLoopEvent, "timestamp">) => {
    const safeEvent: ReliableAgentLoopEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    events.push(safeEvent);
    await input.eventSink?.(safeEvent);
  };

  try {
    await emit({
      eventType: ReliableAgentLoopEventType.AgentLoopStarted,
      safeSummary: "可靠 Agent Loop 已启动。",
      metadata: {
        maxModelTurns: limits.maxModelTurns,
        maxToolCalls: limits.maxToolCalls,
      },
    });

    if (input.memoryContextSummary !== undefined) {
      await emit({
        eventType: ReliableAgentLoopEventType.MemoryContextLoaded,
        safeSummary: input.memoryContextSummary.length > 0
          ? "已加载安全记忆上下文。"
          : "没有可用的相关记忆上下文。",
      });
    }

    if (
      input.provider.capabilities?.supportsToolCalling !== true ||
      typeof input.provider.generateAssistantTurn !== "function"
    ) {
      await emit({
        eventType: ReliableAgentLoopEventType.AgentLoopFailed,
        status: ReliableAgentLoopStatus.UnsupportedToolCalling,
        safeSummary: "当前配置的对话模型不支持工具调用。",
      });
      return finish({
        status: ReliableAgentLoopStatus.UnsupportedToolCalling,
        finalAnswer: "当前配置的对话模型不支持工具调用，已切换到兼容路径或停止本轮模型驱动工具执行。",
      });
    }

    const listedTools = input.tools ?? await input.toolRuntime.listTools();
    const toolMaps = buildToolMaps(listedTools, input.allowToolNames);
    const modelTools = toolMaps.eligibleDefinitions.map(toLlmToolDefinition);
    const seenToolCallIds = new Set<string>();
    const seenToolSignatures = new Set<string>();

    while (modelTurnCount < limits.maxModelTurns) {
      throwIfAborted(controller.signal, timeoutReached);
      const preparedContext = prepareMessagesForProvider({
        messages,
        state: contextState,
        protectToolCallIds: pendingToolResultCallIds,
        compression: input.contextCompression,
      });
      messages.splice(0, messages.length, ...preparedContext.messages);
      for (const contextEvent of preparedContext.events) {
        await emit(contextPreparationEventToLoopEvent(contextEvent, modelTurnCount + 1));
      }
      if (preparedContext.blocked) {
        await emit({
          eventType: ReliableAgentLoopEventType.ContextBlocked,
          modelTurn: modelTurnCount + 1,
          status: ReliableAgentLoopStatus.Failed,
        safeSummary: "上下文在安全整理后仍达到阻断预算。",
        });
        return finish({
          status: ReliableAgentLoopStatus.Failed,
          finalAnswer: "上下文已接近上限且自动整理暂时无法继续，请开启新会话或先压缩上下文后重试。",
        });
      }

      modelTurnCount += 1;
      await emit({
        eventType: ReliableAgentLoopEventType.ModelRequestStarted,
        modelTurn: modelTurnCount,
        safeSummary: "模型请求已开始。",
      });

      const assistantTurn = await input.provider.generateAssistantTurn({
        messages,
        tools: modelTools,
        toolChoice: modelTools.length > 0 ? "auto" : "none",
        parallelToolCalls: input.provider.capabilities?.supportsParallelToolCalls === true,
        purposeSummary: input.purposeSummary,
        timeoutMs: limits.modelTimeoutMs,
        signal: controller.signal,
      } satisfies LlmChatRequest);
      pendingToolResultCallIds = new Set<string>();

      if (!assistantTurn.ok) {
        if (controller.signal.aborted) {
          const status = timeoutReached
            ? ReliableAgentLoopStatus.TimedOut
            : ReliableAgentLoopStatus.Cancelled;
          await emit({
            eventType: timeoutReached
              ? ReliableAgentLoopEventType.AgentLoopTimedOut
              : ReliableAgentLoopEventType.AgentLoopCancelled,
            modelTurn: modelTurnCount,
            status,
            safeSummary: timeoutReached ? "Agent Loop 已超时。" : "Agent Loop 已取消。",
          });
          return finish({
            status,
            finalAnswer: timeoutReached
              ? "本轮 Agent Loop 已超时，后续结果已被丢弃。"
              : "本轮 Agent Loop 已取消，后续结果已被丢弃。",
          });
        }
        await emit({
          eventType: ReliableAgentLoopEventType.AgentLoopFailed,
          modelTurn: modelTurnCount,
          status: ReliableAgentLoopStatus.Failed,
          safeSummary: assistantTurn.message.content || "模型请求失败。",
          errorCode: assistantTurn.error?.kind,
        });
        warnings.push(...assistantTurn.warnings);
        return finish({
          status: ReliableAgentLoopStatus.Failed,
          finalAnswer: assistantTurn.message.content || "模型调用失败，本轮没有生成可用回答。",
        });
      }

      const toolCalls = assistantTurn.message.toolCalls ?? [];
      if (toolCalls.length === 0 || assistantTurn.finishReason !== "tool_calls") {
        const finalAnswer = assistantTurn.message.content.trim();
        await emit({
          eventType: ReliableAgentLoopEventType.ModelFinalAnswerReceived,
          modelTurn: modelTurnCount,
          status: hasToolFailure
            ? ReliableAgentLoopStatus.PartiallySucceeded
            : ReliableAgentLoopStatus.Succeeded,
          safeSummary: finalAnswer.length > 0 ? "模型已返回最终回答。" : "模型返回了空最终回答。",
        });
        await emit({
          eventType: ReliableAgentLoopEventType.AgentLoopCompleted,
          status: hasToolFailure
            ? ReliableAgentLoopStatus.PartiallySucceeded
            : ReliableAgentLoopStatus.Succeeded,
          safeSummary: "Agent Loop 已完成。",
        });
        messages.push({
          role: LlmChatRole.Assistant,
          content: finalAnswer,
        });
        return finish({
          status: hasToolFailure
            ? ReliableAgentLoopStatus.PartiallySucceeded
            : ReliableAgentLoopStatus.Succeeded,
          finalAnswer: finalAnswer || "模型没有生成最终回答。",
        });
      }

      await emit({
        eventType: ReliableAgentLoopEventType.ModelToolCallsReceived,
        modelTurn: modelTurnCount,
        safeSummary: "模型请求了工具调用。",
        metadata: {
          toolCallCount: toolCalls.length,
        },
      });

      messages.push({
        role: LlmChatRole.Assistant,
        content: assistantTurn.message.content,
        toolCalls,
      });

      const validation = validateToolCalls({
        toolCalls,
        toolMaps,
        seenToolCallIds,
        seenToolSignatures,
        remainingToolCalls: Math.max(0, limits.maxToolCalls - toolCallCount),
      });

      for (const invalid of validation.invalid) {
        await emit({
          eventType: ReliableAgentLoopEventType.ToolCallValidationFailed,
          modelTurn: modelTurnCount,
          toolCallId: invalid.call.id,
          toolName: invalid.call.name,
          status: invalid.result.status,
          errorCode: invalid.result.errorCode,
          safeSummary: invalid.result.safeSummary,
        });
      }

      for (const valid of validation.valid) {
        await emit({
          eventType: ReliableAgentLoopEventType.ToolCallQueued,
          modelTurn: modelTurnCount,
          toolCallId: valid.call.id,
          toolName: valid.runtimeName,
          safeSummary: "工具调用已排队。",
        });
      }

      const executedResults = await executeValidatedToolCalls({
        calls: validation.valid,
        context: {
          ...(input.context ?? {}),
          signal: controller.signal,
          enabledTools: toolMaps.allowedRuntimeNames,
        },
        emit,
        modelTurn: modelTurnCount,
        maxParallel: limits.maxParallelReadOnlyTools,
        runtime: input.toolRuntime,
      });

      const resultByCallId = new Map<string, ToolExecutionResult>();
      for (const invalid of validation.invalid) {
        resultByCallId.set(invalid.call.id, invalid.result);
      }
      for (const result of executedResults) {
        resultByCallId.set(result.toolCallId, result);
      }

      resetToolResultRoundBudget(contextState);
      const nextPendingToolResultCallIds = new Set<string>();
      for (const call of toolCalls) {
        const result = resultByCallId.get(call.id) ?? createInvalidToolCallResult({
          call,
          runtimeName: call.name,
          reason: "缺少对应的工具结果。",
          errorCode: ToolCallErrorCode.ExecutionFailed,
        });
        const preparedToolResult = await prepareToolResultForModel({
          result,
          state: contextState,
          config: {
            maxSingleResultChars: limits.maxToolResultChars,
            ...(input.toolResultBudget ?? {}),
          },
          artifactRepository: input.toolResultArtifactRepository,
          ownerUserId: input.context?.userId,
          conversationId: input.context?.conversationId,
          runId: input.context?.agentRunId ?? input.context?.taskId ?? input.context?.requestId,
        });
        toolResults.push(preparedToolResult.safeResult);
        toolCallCount += 1;
        if (
          result.status !== ToolExecutionStatus.Succeeded &&
          result.status !== ToolExecutionStatus.Empty
        ) {
          hasToolFailure = true;
        }
        messages.push({
          role: LlmChatRole.Tool,
          toolCallId: call.id,
          content: preparedToolResult.modelContent,
        });
        nextPendingToolResultCallIds.add(call.id);
        if (preparedToolResult.budgetApplied) {
          await emit({
            eventType: ReliableAgentLoopEventType.ToolResultBudgetApplied,
            modelTurn: modelTurnCount,
            toolCallId: call.id,
            toolName: preparedToolResult.safeResult.toolName,
            status: preparedToolResult.safeResult.status,
            safeSummary: preparedToolResult.sensitiveResultNotPersisted
              ? "工具结果包含敏感字段，已仅回灌安全摘要。"
              : "工具结果超过预算，已替换为安全预览。",
            metadata: {
              injectedChars: preparedToolResult.injectedChars,
              artifactStored: preparedToolResult.artifact !== null,
              sensitiveResultNotPersisted: preparedToolResult.sensitiveResultNotPersisted,
            },
          });
        }
        if (preparedToolResult.artifact) {
          await emit({
            eventType: ReliableAgentLoopEventType.ToolResultArtifactStored,
            modelTurn: modelTurnCount,
            toolCallId: call.id,
            toolName: preparedToolResult.safeResult.toolName,
            status: preparedToolResult.safeResult.status,
            safeSummary: "大型工具结果已保存为安全 Artifact 引用。",
            metadata: {
              artifactId: preparedToolResult.artifact.artifactId,
              size: preparedToolResult.artifact.size,
            },
          });
        }
        await emit({
          eventType: ReliableAgentLoopEventType.ToolResultAppended,
          modelTurn: modelTurnCount,
          toolCallId: call.id,
          toolName: result.toolName,
          status: result.status,
          errorCode: result.errorCode,
          safeSummary: "工具结果已回灌到模型上下文。",
        });
      }
      pendingToolResultCallIds = nextPendingToolResultCallIds;

      if (
        toolCallCount >= limits.maxToolCalls ||
        validation.limitReached
      ) {
        await emit({
          eventType: ReliableAgentLoopEventType.AgentLoopLimitReached,
          modelTurn: modelTurnCount,
          status: ReliableAgentLoopStatus.LimitReached,
          safeSummary: "工具调用次数已达到 Agent Loop 上限。",
        });
        return finish({
          status: hasToolFailure
            ? ReliableAgentLoopStatus.PartiallySucceeded
            : ReliableAgentLoopStatus.LimitReached,
          finalAnswer: "本轮工具调用已达到上限，已停止继续请求模型。",
        });
      }

      await emit({
        eventType: ReliableAgentLoopEventType.ModelContinuationStarted,
        modelTurn: modelTurnCount,
        safeSummary: "工具结果回灌后已开始第二次模型请求。",
      });
    }

    await emit({
      eventType: ReliableAgentLoopEventType.AgentLoopLimitReached,
      modelTurn: modelTurnCount,
      status: ReliableAgentLoopStatus.LimitReached,
      safeSummary: "模型轮次已达到 Agent Loop 上限。",
    });
    return finish({
      status: ReliableAgentLoopStatus.LimitReached,
      finalAnswer: "本轮模型循环已达到上限，已停止继续执行。",
    });
  } catch (error) {
    if (controller.signal.aborted || isAbortLike(error)) {
      const status = timeoutReached
        ? ReliableAgentLoopStatus.TimedOut
        : ReliableAgentLoopStatus.Cancelled;
      await emit({
        eventType: timeoutReached
          ? ReliableAgentLoopEventType.AgentLoopTimedOut
          : ReliableAgentLoopEventType.AgentLoopCancelled,
        status,
        safeSummary: timeoutReached ? "Agent Loop 已超时。" : "Agent Loop 已取消。",
      });
      return finish({
        status,
        finalAnswer: timeoutReached ? "本轮处理超时，已停止执行。" : "本轮处理已取消。",
      });
    }

    await emit({
      eventType: ReliableAgentLoopEventType.AgentLoopFailed,
      status: ReliableAgentLoopStatus.Failed,
      safeSummary: "Agent Loop 执行失败，内部错误细节已隐藏。",
    });
    return finish({
      status: ReliableAgentLoopStatus.Failed,
      finalAnswer: "本轮 Agent Loop 执行失败，错误细节已隐藏。",
    });
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", relayAbort);
  }

  function finish(inputResult: {
    status: ReliableAgentLoopStatus;
    finalAnswer: string;
  }): ReliableAgentLoopResult {
    return {
      status: inputResult.status,
      finalAnswer: inputResult.finalAnswer,
      messages,
      events,
      toolResults,
      modelTurnCount,
      toolCallCount,
      warnings,
    };
  }
}

function buildToolMaps(
  definitions: readonly ToolDefinition[],
  allowToolNames: readonly string[] | undefined,
): {
  byRuntimeName: Map<string, ToolDefinition>;
  byModelName: Map<string, string>;
  allowedRuntimeNames: string[];
  eligibleDefinitions: ToolDefinition[];
} {
  const explicitAllow = allowToolNames ? new Set(allowToolNames) : null;
  const byRuntimeName = new Map<string, ToolDefinition>();
  const byModelName = new Map<string, string>();
  const eligibleDefinitions: ToolDefinition[] = [];
  const allowedRuntimeNames: string[] = [];

  for (const definition of definitions) {
    byRuntimeName.set(definition.name, definition);
    const allowed = explicitAllow ? explicitAllow.has(definition.name) : true;
    if (!allowed || !isReadOnlyEligibleTool(definition)) {
      continue;
    }
    const modelName = encodeToolNameForProvider(definition.name);
    byModelName.set(modelName, definition.name);
    byModelName.set(definition.name, definition.name);
    eligibleDefinitions.push(definition);
    allowedRuntimeNames.push(definition.name);
  }

  return {
    byRuntimeName,
    byModelName,
    allowedRuntimeNames,
    eligibleDefinitions,
  };
}

function toLlmToolDefinition(definition: ToolDefinition): LlmToolDefinition {
  return {
    type: "function",
    runtimeName: definition.name,
    function: {
      name: encodeToolNameForProvider(definition.name),
      description: definition.description,
      parameters: normalizeToolSchema(definition.inputSchema),
    },
  };
}

function normalizeToolSchema(schema: ToolDefinition["inputSchema"]): Record<string, unknown> {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    return schema as Record<string, unknown>;
  }
  return {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

function encodeToolNameForProvider(name: string): string {
  return name
    .replace(/[^A-Za-z0-9_-]+/g, "__")
    .replace(/^_+/, "")
    .slice(0, 64) || "tool";
}

function isReadOnlyEligibleTool(definition: ToolDefinition): boolean {
  return definition.enabled !== false &&
    definition.readOnly === true &&
    definition.sideEffect !== true &&
    definition.riskCategory === ToolRiskCategory.ReadOnly &&
    definition.requiresConfirmation === false;
}

function validateToolCalls(input: {
  toolCalls: readonly LlmToolCall[];
  toolMaps: ReturnType<typeof buildToolMaps>;
  seenToolCallIds: Set<string>;
  seenToolSignatures: Set<string>;
  remainingToolCalls: number;
}): {
  valid: ValidatedToolCall[];
  invalid: InvalidToolCall[];
  limitReached: boolean;
} {
  const valid: ValidatedToolCall[] = [];
  const invalid: InvalidToolCall[] = [];
  let limitReached = false;

  for (let index = 0; index < input.toolCalls.length; index += 1) {
    const call = input.toolCalls[index];
    const runtimeName = input.toolMaps.byModelName.get(call.name) ?? call.name;
    const definition = input.toolMaps.byRuntimeName.get(runtimeName);

    if (index >= input.remainingToolCalls) {
      limitReached = true;
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具调用次数已达到上限。",
          errorCode: ToolCallErrorCode.InvalidToolRequest,
        }),
      });
      continue;
    }

    if (input.seenToolCallIds.has(call.id)) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "重复的工具调用 ID。",
          errorCode: ToolCallErrorCode.DuplicateTool,
        }),
      });
      continue;
    }
    input.seenToolCallIds.add(call.id);

    if (call.argumentsParseError) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具参数不是合法 JSON。",
          errorCode: ToolCallErrorCode.InvalidToolInput,
        }),
      });
      continue;
    }

    if (!definition) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具未注册。",
          errorCode: ToolCallErrorCode.ToolNotFound,
        }),
      });
      continue;
    }

    if (!isReadOnlyEligibleTool(definition)) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具不是已启用的只读工具。",
          errorCode: ToolCallErrorCode.PermissionDenied,
          status: ToolExecutionStatus.PermissionDenied,
        }),
      });
      continue;
    }

    if (!input.toolMaps.allowedRuntimeNames.includes(runtimeName)) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具不在允许列表中。",
          errorCode: ToolCallErrorCode.PermissionDenied,
          status: ToolExecutionStatus.PermissionDenied,
        }),
      });
      continue;
    }

    if (containsForbiddenArgument(call.arguments)) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "工具参数包含禁止的身份、权限、凭据、URL 或文件字段。",
          errorCode: ToolCallErrorCode.InvalidToolInput,
        }),
      });
      continue;
    }

    const signature = `${runtimeName}:${stableStringify(call.arguments)}`;
    if (input.seenToolSignatures.has(signature)) {
      invalid.push({
        call,
        result: createInvalidToolCallResult({
          call,
          runtimeName,
          reason: "相同标准化参数的工具调用已被阻止。",
          errorCode: ToolCallErrorCode.DuplicateTool,
        }),
      });
      continue;
    }
    input.seenToolSignatures.add(signature);

    valid.push({
      call,
      runtimeName,
      definition,
    });
  }

  return {
    valid,
    invalid,
    limitReached,
  };
}

async function executeValidatedToolCalls(input: {
  calls: readonly ValidatedToolCall[];
  context: ToolExecutionContext;
  emit: (event: Omit<ReliableAgentLoopEvent, "timestamp">) => Promise<void>;
  maxParallel: number;
  modelTurn: number;
  runtime: ToolRuntime;
}): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const hasProfileCandidateDependency =
    input.calls.some((call) => isTrainingProfileTool(call.runtimeName)) &&
    input.calls.some((call) => isPersonalizedCandidateTool(call.runtimeName));

  if (hasProfileCandidateDependency) {
    const profileCalls = input.calls.filter((call) => isTrainingProfileTool(call.runtimeName));
    const remainingCalls = input.calls.filter((call) => !isTrainingProfileTool(call.runtimeName));
    for (const call of profileCalls) {
      results.push(await executeOneToolCall(input, call));
    }
    results.push(...await executeInConcurrencyGroups(input, remainingCalls));
    return results;
  }

  results.push(...await executeInConcurrencyGroups(input, input.calls));
  return results;
}

async function executeInConcurrencyGroups(
  input: Parameters<typeof executeValidatedToolCalls>[0],
  calls: readonly ValidatedToolCall[],
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const parallelSafe = calls.filter((call) => call.definition.concurrencySafe === true);
  const serialOnly = calls.filter((call) => call.definition.concurrencySafe !== true);

  for (const call of serialOnly) {
    results.push(await executeOneToolCall(input, call));
  }

  const chunkSize = Math.max(1, input.maxParallel);
  for (let start = 0; start < parallelSafe.length; start += chunkSize) {
    const chunk = parallelSafe.slice(start, start + chunkSize);
    results.push(...await Promise.all(chunk.map((call) => executeOneToolCall(input, call))));
  }

  return results;
}

async function executeOneToolCall(
  input: Parameters<typeof executeValidatedToolCalls>[0],
  call: ValidatedToolCall,
): Promise<ToolExecutionResult> {
  await input.emit({
    eventType: ReliableAgentLoopEventType.ToolCallStarted,
    modelTurn: input.modelTurn,
    toolCallId: call.call.id,
    toolName: call.runtimeName,
    safeSummary: "工具调用已开始。",
  });

  const result = await input.runtime.executeTool({
    toolName: call.runtimeName,
    toolCallId: call.call.id,
    input: call.call.arguments as JsonValue,
    context: input.context,
  });

  await input.emit({
    eventType: ReliableAgentLoopEventType.ToolCallCompleted,
    modelTurn: input.modelTurn,
    toolCallId: call.call.id,
    toolName: call.runtimeName,
    status: result.status,
    errorCode: result.errorCode,
    durationMs: result.durationMs,
    safeSummary: result.safeSummary,
  });

  return result;
}

function createInvalidToolCallResult(input: {
  call: LlmToolCall;
  runtimeName: string;
  reason: string;
  errorCode: string;
  status?: ToolExecutionStatus;
}): ToolExecutionResult {
  const startedAt = new Date().toISOString();
  return createToolExecutionResult({
    toolCallId: input.call.id || `invalid_${Date.now()}`,
    toolName: input.runtimeName || input.call.name || "unknown_tool",
    status: input.status ?? ToolExecutionStatus.InvalidInput,
    startedAt,
    completedAt: startedAt,
    errorCode: input.errorCode,
    safeSummary: input.reason,
    retryable: false,
  });
}

function contextPreparationEventToLoopEvent(
  event: ReliableAgentContextPreparationEvent,
  modelTurn: number,
): Omit<ReliableAgentLoopEvent, "timestamp"> {
  switch (event.type) {
    case "tool_result_microcompacted":
      return {
        eventType: ReliableAgentLoopEventType.ToolResultMicrocompacted,
        modelTurn,
        safeSummary: event.safeSummary,
        metadata: {
          compactedMessageCount: event.compactedMessageCount ?? 0,
        },
      };
    case "context_budget_warning":
      return {
        eventType: ReliableAgentLoopEventType.ContextBudgetWarning,
        modelTurn,
        safeSummary: event.safeSummary,
        metadata: {
          beforeTokens: event.beforeTokens ?? 0,
        },
      };
    case "context_compressed":
      return {
        eventType: ReliableAgentLoopEventType.ContextCompressed,
        modelTurn,
        safeSummary: event.safeSummary,
        metadata: {
          beforeTokens: event.beforeTokens ?? 0,
          afterTokens: event.afterTokens ?? 0,
          compactedMessageCount: event.compactedMessageCount ?? 0,
          sourceRange: event.sourceRange ?? "",
        },
      };
    case "context_compression_failed":
      return {
        eventType: ReliableAgentLoopEventType.ContextCompressionFailed,
        modelTurn,
        safeSummary: event.safeSummary,
        metadata: {
          beforeTokens: event.beforeTokens ?? 0,
          afterTokens: event.afterTokens ?? 0,
        },
      };
    case "context_compression_paused":
      return {
        eventType: ReliableAgentLoopEventType.ContextCompressionPaused,
        modelTurn,
        safeSummary: event.safeSummary,
        metadata: {
          beforeTokens: event.beforeTokens ?? 0,
        },
      };
    case "context_blocked":
      return {
        eventType: ReliableAgentLoopEventType.ContextBlocked,
        modelTurn,
        status: ReliableAgentLoopStatus.Failed,
        safeSummary: event.safeSummary,
      };
  }
}

function containsForbiddenArgument(value: unknown): boolean {
  return containsForbiddenArgumentAtPath(value, []);
}

function containsForbiddenArgumentAtPath(value: unknown, path: string[]): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return looksLikeForbiddenString(value);
  }
  if (typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item, index) =>
      containsForbiddenArgumentAtPath(item, [...path, String(index)]),
    );
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_]/g, "").toLowerCase();
    if (FORBIDDEN_ARGUMENT_KEYS.includes(normalizedKey)) {
      return true;
    }
    if (containsForbiddenArgumentAtPath(child, [...path, key])) {
      return true;
    }
  }
  return false;
}

function looksLikeForbiddenString(value: string): boolean {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return true;
  }
  if (/^\/(?:etc|home|users|var|tmp|mnt|root)\//i.test(trimmed)) {
    return true;
  }
  return false;
}

function isTrainingProfileTool(name: string): boolean {
  return /resolve.*training.*profile|training.*level/i.test(name);
}

function isPersonalizedCandidateTool(name: string): boolean {
  return /personalized.*candidate|candidate.*codeforces/i.test(name);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(",")}}`;
}

function throwIfAborted(signal: AbortSignal, timeoutReached: boolean): void {
  if (!signal.aborted) {
    return;
  }
  throw timeoutReached ? new Error("AGENT_LOOP_TIMEOUT") : new Error("AGENT_LOOP_CANCELLED");
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && /abort|cancel|timeout/i.test(error.message);
}
