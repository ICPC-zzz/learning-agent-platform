import type { ExternalProviderFetch } from "@learning-agent-platform/ai-core/llm/external-chat-completions-provider";
import {
  LlmChatRole,
  LlmProviderMode,
  type LlmAssistantTurnResult,
  type LlmChatRequest,
  type LlmChatResult,
  type LlmProvider,
  type LlmToolCall,
  type LlmToolDefinition,
} from "@learning-agent-platform/ai-core/llm/llm-provider-contract";
import {
  ReliableAgentLoopEventType,
  ReliableAgentLoopStatus,
  runReliableAgentLoop,
  type ReliableAgentLoopEvent,
} from "@learning-agent-platform/ai-core/agent-runtime";
import type { ToolExecutionResult } from "@learning-agent-platform/ai-core/tools";

import { createAssistantProviderEnvSnapshot } from "./config/assistant-provider-config.ts";
import { evaluateWebAiQaGuard } from "../web-ai-qa-guard.ts";
import { isCodeforcesRefreshReminderMemory } from "./assistant-intent-resolver.ts";
import { listAssistantLongTermMemories } from "./memory-service.ts";
import { createOpenAiCompatibleLlmProvider } from "./providers/openai-compatible-llm-provider.ts";
import {
  type LearnerTrainingProfile,
  type PersonalizedCodeforcesCandidate,
  type UpcomingCodeforcesContest,
} from "./providers/codeforces-personalized-provider.ts";
import { resolveUserModelLlmProvider } from "./providers/user-model-resolver.ts";
import {
  createPersonalizedCodeforcesCandidatesDefinition,
  createResolveLearnerTrainingProfileDefinition,
  createUpcomingCodeforcesContestsDefinition,
} from "./tools/codeforces-tools.ts";
import {
  createAssistantCanonicalToolRuntime,
  executeAssistantToolWithCanonicalResult,
  getAssistantToolCanonicalName,
} from "./tools/tool-executor.ts";
import {
  eraseAssistantToolDefinition,
  type AnyAssistantToolDefinition,
  type AssistantToolExecutionResult,
  type AssistantToolName,
} from "./tools/tool-types.ts";
import { createEmptyAssistantLearningContext } from "./user-learning-context.ts";
import type {
  AssistantAgentAuditEventType,
  AssistantAgentName,
  AssistantAgentRunStatus,
  AssistantEvidenceReference,
  AssistantLearningContextSummary,
  AssistantMultiAgentTaskView,
  AssistantSource,
  AssistantStabilityInjectionMode,
  SafeAssistantPageContext,
} from "./assistant-types.ts";
import {
  A509_AGENT_NAMES,
  A509_DEFAULT_TASK_LIMITS,
  FileAssistantTaskRepository,
  canRetryAgentAfterTaskStatus,
  createAgentRun,
  createAuditEvent,
  createDefaultAssistantTaskRepository,
  isTerminalTaskStatus,
  retryableAgentStatus,
  toAssistantTaskView,
  type AssistantMultiAgentTaskRecord,
  type AssistantTaskAgentRunRecord,
} from "./assistant-task-repository.ts";

interface RunningTaskControl {
  controller: AbortController;
  taskTimedOut: boolean;
}

interface RuntimeStartOptions {
  repository?: FileAssistantTaskRepository;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
}

interface AgentOutcome {
  status: "succeeded" | "failed";
  summary: string;
  data?: Record<string, unknown>;
  errorCode?: string;
  evidence?: AssistantEvidenceReference[];
  usedTools?: string[];
  sourceRefs?: string[];
  developmentInjection?: string;
}

const runningTasks = getRunningTaskMap();
const runningAgentRetries = getRunningAgentRetrySet();

export async function createAndStartAssistantMultiAgentTask(input: {
  userId: string;
  conversationId: string;
  requestId: string;
  question: string;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  stabilityInjectionMode?: AssistantStabilityInjectionMode;
  repository?: FileAssistantTaskRepository;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
}): Promise<{ task: AssistantMultiAgentTaskView; created: boolean }> {
  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const { task, created } = await repository.createOrReuseTask({
    userId: input.userId,
    conversationId: input.conversationId,
    requestId: input.requestId,
    userVisibleRequest: input.question,
    stabilityInjectionMode: resolveServerAllowedStabilityMode(input.stabilityInjectionMode, input.guardEnv),
  });

  if (created || (task.status === "queued" && !runningTasks.has(task.id))) {
    startAssistantTaskExecution({
      repository,
      userId: input.userId,
      taskId: task.id,
      pageContext: input.pageContext,
      learningContext: input.learningContext,
      guardEnv: input.guardEnv,
      customFetch: input.customFetch,
    });
  }

  const current = await repository.getTask({ userId: input.userId, taskId: task.id });
  return { task: toAssistantTaskView(current), created };
}

export function startAssistantTaskExecution(input: {
  userId: string;
  taskId: string;
} & RuntimeStartOptions): void {
  if (runningTasks.has(input.taskId)) {
    return;
  }

  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const controller = new AbortController();
  const control: RunningTaskControl = { controller, taskTimedOut: false };
  runningTasks.set(input.taskId, control);

  void executeFullTask({
    ...input,
    repository,
    signal: controller.signal,
    control,
  }).finally(() => {
    runningTasks.delete(input.taskId);
  });
}

export async function listAssistantTasksForConversation(input: {
  userId: string;
  conversationId: string;
  repository?: FileAssistantTaskRepository;
}): Promise<AssistantMultiAgentTaskView[]> {
  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const records = await repository.recoverInterruptedTasks({
    userId: input.userId,
    conversationId: input.conversationId,
    activeTaskIds: [...runningTasks.keys()],
  });
  return records.map(toAssistantTaskView);
}

export async function cancelAssistantMultiAgentTask(input: {
  userId: string;
  taskId: string;
  repository?: FileAssistantTaskRepository;
}): Promise<AssistantMultiAgentTaskView> {
  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const requested = await repository.cancelTask({
    userId: input.userId,
    taskId: input.taskId,
  });
  const running = runningTasks.get(input.taskId);
  if (running) {
    running.controller.abort(new Error("USER_CANCELLED"));
    return toAssistantTaskView(requested);
  }

  const finalTask = await repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    if (task.status === "cancel_requested") {
      const now = new Date().toISOString();
      task.status = "cancelled";
      task.cancelledAt = now;
      task.completedAt = task.completedAt ?? now;
      task.finalAnswerStatus = "cancelled";
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "task_cancelled",
        status: task.status,
        safeMessage: "任务没有活动运行控制器，取消请求已安全落盘为 cancelled。",
      }));
    }
    return task;
  });
  return toAssistantTaskView(finalTask);
}

export async function retryAssistantAgentTask(input: {
  userId: string;
  taskId: string;
  agentName: AssistantAgentName;
  repository?: FileAssistantTaskRepository;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
}): Promise<AssistantMultiAgentTaskView> {
  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const retryKey = `${input.taskId}:${input.agentName}`;
  if (runningAgentRetries.has(retryKey)) {
    return toAssistantTaskView(await repository.getTask({ userId: input.userId, taskId: input.taskId }));
  }

  const mutation = await repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (record) => {
    if (!canRetryAgentAfterTaskStatus(record.status)) {
      return { task: record, allowed: false };
    }
    const latest = latestRun(record, input.agentName);
    if (!latest || !retryableAgentStatus(latest.status) || latest.attempt >= record.limits.maxAgentRetries + 1) {
      return { task: record, allowed: false };
    }
    if (latestRun(record, input.agentName)?.status === "running") {
      return { task: record, allowed: false };
    }
    record.status = "running";
    record.completedAt = null;
    record.errorCode = undefined;
    record.finalAnswerStatus = "pending";
    record.auditEvents.push(createAuditEvent({
      taskId: record.id,
      agentRunId: latest.id,
      eventType: "agent_retry_requested",
      status: record.status,
      safeMessage: `${formatAgentDisplayName(input.agentName)}重试已请求，只会重跑该步骤及受影响的聚合步骤。`,
      attempt: latest.attempt + 1,
    }));
    return { task: record, allowed: true };
  });

  if (!mutation.allowed) {
    return toAssistantTaskView(mutation.task);
  }

  runningAgentRetries.add(retryKey);
  void executeAgentRetry({
    repository,
    userId: input.userId,
    taskId: input.taskId,
    agentName: input.agentName,
    pageContext: input.pageContext,
    learningContext: input.learningContext,
    guardEnv: input.guardEnv,
    customFetch: input.customFetch,
  }).finally(() => runningAgentRetries.delete(retryKey));

  return toAssistantTaskView(mutation.task);
}

export async function retryAssistantWholeTask(input: {
  userId: string;
  taskId: string;
  repository?: FileAssistantTaskRepository;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
}): Promise<AssistantMultiAgentTaskView> {
  const repository = input.repository ?? createDefaultAssistantTaskRepository();
  const task = await repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (record) => {
    if (runningTasks.has(record.id) || record.taskRetryCount >= record.limits.maxTaskRetries) {
      return record;
    }
    if (record.status !== "failed" && record.status !== "timed_out") {
      return record;
    }
    record.taskRetryCount += 1;
    record.currentAttempt += 1;
    record.status = "queued";
    record.startedAt = null;
    record.completedAt = null;
    record.cancelledAt = null;
    record.errorCode = undefined;
    record.finalAnswer = null;
    record.finalAnswerStatus = "pending";
    record.auditEvents.push(createAuditEvent({
        taskId: record.id,
        eventType: "agent_retry_requested",
        status: record.status,
      safeMessage: "任务级重试已请求，将创建新的任务尝试并重新执行所有步骤。",
      attempt: record.currentAttempt,
    }));
    return record;
  });
  startAssistantTaskExecution({
    repository,
    userId: input.userId,
    taskId: input.taskId,
    pageContext: input.pageContext,
    learningContext: input.learningContext,
    guardEnv: input.guardEnv,
    customFetch: input.customFetch,
  });
  return toAssistantTaskView(task);
}

export function getActiveAssistantTaskIds(): string[] {
  return [...runningTasks.keys()];
}

export function isAssistantStabilityTestModeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return process.env.NODE_ENV !== "production" && env.LAP_AGENT_STABILITY_TEST_MODE === "1";
}

async function tryExecuteReliableAgentLoopTask(input: {
  repository: FileAssistantTaskRepository;
  userId: string;
  taskId: string;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
  signal: AbortSignal;
  control: RunningTaskControl;
}): Promise<boolean> {
  const task = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
  if (shouldUseLegacyMultiAgentForStabilityMode(task.stabilityInjectionMode)) {
    return false;
  }
  const provider = await resolveReliableAgentLoopProvider({
    userId: input.userId,
    customFetch: input.customFetch,
    guardEnv: input.guardEnv,
    stabilityInjectionMode: task.stabilityInjectionMode,
  });

  if (
    !provider ||
    provider.provider.capabilities?.supportsToolCalling !== true ||
    typeof provider.provider.generateAssistantTurn !== "function"
  ) {
    return false;
  }

  const taskTimeout = setTimeout(() => {
    input.control.taskTimedOut = true;
    input.control.controller.abort(new Error("TASK_TIMEOUT"));
  }, task.limits.taskTimeoutMs);

  try {
    const started = await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (record) => {
      if (record.status !== "queued") {
        return { started: false, runId: null as string | null, blocked: false };
      }
      if (record.estimatedTokens > record.limits.maxEstimatedTokens) {
        record.status = "failed";
        record.completedAt = new Date().toISOString();
        record.errorCode = "context_budget_blocked";
        record.finalAnswerStatus = "failed";
        record.auditEvents.push(createAuditEvent({
          taskId: record.id,
          eventType: "budget_blocked",
          status: record.status,
          safeMessage: "请求超过任务上下文预算，Agent Loop 未启动。",
        }));
        return { started: false, runId: null as string | null, blocked: true };
      }

      const now = new Date().toISOString();
      const run = createAgentRun({
        taskId: record.id,
        agentName: "Orchestrator",
        role: "模型驱动的只读工具可靠 Agent Loop",
        attempt: nextAttemptForAgent(record, "Orchestrator"),
        timeoutMs: record.limits.taskTimeoutMs,
        safeInputSummary: `用户请求：${record.userVisibleRequest}`,
      });
      run.status = "running";
      run.startedAt = now;
      record.agentRuns.push(run);
      record.status = "running";
      record.startedAt = now;
      record.providerCallCount = 0;
      record.auditEvents.push(createAuditEvent({
        taskId: record.id,
        eventType: "task_started",
        status: record.status,
        safeMessage: "可靠 Agent Loop 任务已启动。",
      }));
      record.auditEvents.push(createAuditEvent({
        taskId: record.id,
        agentRunId: run.id,
        eventType: "agent_started",
        status: run.status,
        safeMessage: "模型驱动的编排器已启动。",
        attempt: run.attempt,
      }));
      return { started: true, runId: run.id, blocked: false };
    });

    if (!started.started) {
      return started.blocked;
    }

    const currentTask = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
    const learningContext = input.learningContext ?? createEmptyAssistantLearningContext(null, true);
    const pageContext = input.pageContext ?? { route: "/ai", pageType: "ai" as const };
    const memories = await listAssistantLongTermMemories(input.userId).catch(() => []);
    const memorySummary = buildReliableLoopMemorySummary(memories);
    const injectionMode = resolveReliableAgentLoopToolFaultInjectionMode(
      currentTask.stabilityInjectionMode,
      input.guardEnv,
    );
    const assistantDefinitions = createReliableLoopToolDefinitions(injectionMode);
    const toolRuntime = createAssistantCanonicalToolRuntime({
      userId: input.userId,
      question: currentTask.userVisibleRequest,
      pageContext,
      learningContext,
      guardEnv: input.guardEnv ?? createAssistantProviderEnvSnapshot(),
      customFetch: input.customFetch,
      signal: input.signal,
      forcePermissionDenied: injectionMode === "tool_permission_denied_once",
    }, assistantDefinitions);
    const allowedToolNames = [
      getAssistantToolCanonicalName("resolveLearnerTrainingProfile"),
      getAssistantToolCanonicalName("getPersonalizedCodeforcesCandidates"),
      getAssistantToolCanonicalName("getUpcomingCodeforcesContests"),
    ];
    const availableTools = (await toolRuntime.listTools())
      .filter((definition) => allowedToolNames.includes(definition.name));

    const result = await runReliableAgentLoop({
      provider: provider.provider,
      purposeSummary: "A515 reliable Codeforces training and contest Agent Loop",
      messages: buildReliableLoopMessages({
        task: currentTask,
        learningContext,
        pageContext,
        memorySummary,
      }),
      toolRuntime,
      tools: availableTools,
      allowToolNames: allowedToolNames,
      context: {
        userId: input.userId,
        conversationId: currentTask.conversationId,
        taskId: currentTask.id,
        agentRunId: started.runId ?? undefined,
        requestId: currentTask.requestId,
        agentId: "Orchestrator",
        signal: input.signal,
        enabledTools: allowedToolNames,
        metadata: {
          providerSource: provider.source,
        },
      },
      memoryContextSummary: memorySummary.safeEventSummary,
      limits: {
        maxModelTurns: 4,
        maxToolCalls: 6,
        maxParallelReadOnlyTools: 3,
        loopTimeoutMs: currentTask.limits.taskTimeoutMs,
        modelTimeoutMs: 30_000,
      },
      toolResultBudget: {
        maxSingleResultChars: currentTask.stabilityInjectionMode === "tool_large_result_once" ? 1_400 : 4_000,
        maxRoundResultChars: 8_000,
        maxLoopResultChars: 18_000,
        maxPreviewChars: 900,
        maxEvidenceRefs: currentTask.limits.maxEvidence,
        maxArtifacts: 8,
      },
      toolResultArtifactRepository: input.repository,
      contextCompression: {
        contextWindowTokens: currentTask.stabilityInjectionMode === "context_compression_failure" ? 512 : 16_000,
        forceCompressionFailure: currentTask.stabilityInjectionMode === "context_compression_failure",
        summaryModelAvailable: false,
      },
      eventSink: async (event) => {
        await persistReliableAgentLoopEvent({
          repository: input.repository,
          userId: input.userId,
          taskId: input.taskId,
          agentRunId: started.runId,
          event,
        });
      },
      signal: input.signal,
    });

    await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (record) => {
      const now = new Date().toISOString();
      const run = started.runId ? requireRun(record, started.runId) : latestRun(record, "Orchestrator");
      const taskStatus = mapReliableLoopStatusToTaskStatus(result.status);
      const finalAnswer = sanitizeReliableLoopFinalAnswer(result.finalAnswer);
      const evidence = evidenceFromReliableLoopToolResults(result.toolResults, "Orchestrator");

      if (run) {
        run.status = mapReliableLoopStatusToAgentStatus(result.status);
        run.completedAt = now;
        run.safeOutputSummary = finalAnswer || safeSummaryForReliableLoopStatus(result.status);
        run.usedTools = [...new Set(result.toolResults.map((toolResult) =>
          assistantToolNameFromCanonical(toolResult.toolName),
        ))].slice(0, 12);
        run.sourceRefs = result.toolResults
          .flatMap((toolResult) => toolResult.sourceRefs.map(sourceRefKey))
          .slice(0, 24);
        run.retryable = retryableAgentStatus(run.status);
        if (result.status !== ReliableAgentLoopStatus.Succeeded) {
          run.errorCode = result.status;
        }
        run.safeOutputData = {
          modelTurnCount: result.modelTurnCount,
          toolCallCount: result.toolCallCount,
          providerSource: provider.source,
        };
      }

      record.toolCallCount = result.toolCallCount;
      record.providerCallCount = result.modelTurnCount;
      record.finalAnswer = finalAnswer || safeSummaryForReliableLoopStatus(result.status);
      record.status = taskStatus;
      record.completedAt = now;
      record.cancelledAt = taskStatus === "cancelled" ? now : record.cancelledAt;
      record.finalAnswerStatus = mapReliableLoopStatusToFinalAnswerStatus(result.status);
      record.errorCode = reliableLoopErrorCode(result.status);
      attachEvidence(record, evidence, "Orchestrator");
      record.auditEvents.push(createAuditEvent({
        taskId: record.id,
        agentRunId: run?.id,
        eventType: taskAuditEventForReliableLoopStatus(result.status),
        status: record.status,
        safeMessage: safeSummaryForReliableLoopStatus(result.status),
      }));
      if (record.finalAnswerStatus === "available" || record.finalAnswerStatus === "partial") {
        record.auditEvents.push(createAuditEvent({
          taskId: record.id,
          agentRunId: run?.id,
          eventType: "final_answer_created",
          status: record.finalAnswerStatus,
          safeMessage: "最终回答已从可靠 Agent Loop 保存。",
        }));
      }
      return record;
    });

    return true;
  } catch {
    await finalizeAbortedTask(input);
    return true;
  } finally {
    clearTimeout(taskTimeout);
  }
}

function shouldUseLegacyMultiAgentForStabilityMode(
  mode: AssistantStabilityInjectionMode | undefined,
): boolean {
  return mode === "fail_upcoming_once" ||
    mode === "timeout_candidate_once" ||
    mode === "delay_task_for_cancel" ||
    mode === "tool_calling_unsupported";
}

type ReliableLoopProviderSource = "user_configured" | "env_dev" | "dev_stub";

async function resolveReliableAgentLoopProvider(input: {
  userId: string;
  customFetch?: ExternalProviderFetch;
  guardEnv?: Record<string, string | undefined>;
  stabilityInjectionMode?: AssistantStabilityInjectionMode;
}): Promise<{
  provider: LlmProvider;
  source: ReliableLoopProviderSource;
  label: string;
} | null> {
  if (
    isAssistantStabilityTestModeEnabled(input.guardEnv) &&
    input.stabilityInjectionMode === "tool_calling_unsupported"
  ) {
    return null;
  }

  if (shouldForceDevelopmentScriptedProvider(input.stabilityInjectionMode, input.guardEnv)) {
    const forcedProvider = createDevelopmentReliableLoopProvider({
      mode: input.stabilityInjectionMode,
      env: input.guardEnv,
    });
    if (forcedProvider) {
      return {
        provider: forcedProvider,
        source: "dev_stub",
        label: forcedProvider.label,
      };
    }
  }

  const providerEnv = input.guardEnv ?? createAssistantProviderEnvSnapshot();
  const guard = evaluateWebAiQaGuard(providerEnv);
  if (!guard.allowed) {
    return null;
  }

  const userProvider = await resolveUserModelLlmProvider({
    userId: input.userId,
    customFetch: input.customFetch,
  });
  if (userProvider) {
    const userProviderSupportsReliableLoop =
      userProvider.provider.capabilities?.supportsToolCalling === true &&
      typeof userProvider.provider.generateAssistantTurn === "function";
    if (
      userProviderSupportsReliableLoop ||
      !isAssistantStabilityTestModeEnabled(input.guardEnv) ||
      input.stabilityInjectionMode === "tool_calling_unsupported"
    ) {
      return {
        provider: userProvider.provider,
        source: "user_configured",
        label: userProvider.label,
      };
    }
  }

  const envProvider = createOpenAiCompatibleLlmProvider({
    env: providerEnv,
    customFetch: input.customFetch,
  });
  if (!envProvider.provider) {
    const devProvider = createDevelopmentReliableLoopProvider({
      mode: input.stabilityInjectionMode,
      env: input.guardEnv,
    });
    return devProvider
      ? {
          provider: devProvider,
          source: "dev_stub",
          label: devProvider.label,
        }
      : null;
  }
  return {
    provider: envProvider.provider,
    source: "env_dev",
    label: envProvider.status.label,
  };
}

function shouldForceDevelopmentScriptedProvider(
  mode: AssistantStabilityInjectionMode | undefined,
  env?: Record<string, string | undefined>,
): boolean {
  if (!isAssistantStabilityTestModeEnabled(env)) {
    return false;
  }
  return mode === "tool_unknown_once" ||
    mode === "tool_duplicate_once" ||
    mode === "tool_large_result_once" ||
    mode === "agent_loop_max_turns" ||
    mode === "agent_loop_max_tool_calls" ||
    mode === "context_compression_failure";
}

function createDevelopmentReliableLoopProvider(input: {
  mode?: AssistantStabilityInjectionMode;
  env?: Record<string, string | undefined>;
}): LlmProvider | null {
  if (!isAssistantStabilityTestModeEnabled(input.env)) {
    return null;
  }
  if (input.mode === "tool_calling_unsupported") {
    return null;
  }

  let turn = 0;
  const mode = input.mode ?? "normal";
  return {
    mode: LlmProviderMode.Mock,
    label: "开发验收 Tool Calling Stub Provider",
    capabilities: {
      supportsChat: true,
      supportsToolCalling: true,
      supportsParallelToolCalls: true,
      toolCallProtocol: "openai-chat-completions",
    },
    generate: async (): Promise<LlmChatResult> => ({
      ok: true,
      answerSummary: "开发验收 Stub Provider 仅用于无真实 Tool Calling 模型时的浏览器 QA。",
      providerMode: LlmProviderMode.Mock,
      realProviderCalled: false,
      networkAccessed: false,
      secretSafe: true,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
      warnings: ["dev_stub_provider"],
      createdAt: new Date().toISOString(),
    }),
    generateAssistantTurn: async (request: LlmChatRequest): Promise<LlmAssistantTurnResult> => {
      if (request.signal?.aborted) {
        throw request.signal.reason ?? new Error("ABORTED");
      }
      turn += 1;
      const tools = createDevelopmentToolNameResolver(request.tools ?? []);

      if (mode === "agent_loop_max_turns" || mode === "context_compression_failure") {
        const candidateTool = tools.candidates ?? tools.profile ?? firstToolName(request.tools);
        return createDevelopmentToolTurn([{
          id: `a516_${mode}_${turn}`,
          type: "function",
          name: candidateTool,
          arguments: tools.candidates ? { limit: Math.max(1, turn) } : {},
        }]);
      }

      if (turn === 1) {
        if (mode === "tool_unknown_once") {
          return createDevelopmentToolTurn([{
            id: "a516_unknown_tool_1",
            type: "function",
            name: "a516_unregistered_readonly_tool",
            arguments: {},
          }]);
        }

        if (mode === "tool_duplicate_once") {
          const profileTool = tools.profile ?? firstToolName(request.tools);
          return createDevelopmentToolTurn([
            {
              id: "a516_duplicate_tool_1",
              type: "function",
              name: profileTool,
              arguments: {},
            },
            {
              id: "a516_duplicate_tool_2",
              type: "function",
              name: profileTool,
              arguments: {},
            },
          ]);
        }

        if (mode === "agent_loop_max_tool_calls") {
          const candidates = tools.candidates ?? firstToolName(request.tools);
          const contests = tools.contests ?? candidates;
          return createDevelopmentToolTurn([
            ...Array.from({ length: 4 }, (_, index) => ({
              id: `a516_many_candidates_${index + 1}`,
              type: "function" as const,
              name: candidates,
              arguments: { limit: index + 1 },
            })),
            ...Array.from({ length: 3 }, (_, index) => ({
              id: `a516_many_contests_${index + 1}`,
              type: "function" as const,
              name: contests,
              arguments: { limit: index + 1 },
            })),
          ]);
        }

        return createDevelopmentToolTurn(createDevelopmentDefaultToolCalls(tools, request.tools ?? []));
      }

      return createDevelopmentFinalTurn(buildDevelopmentReliableLoopFinalAnswer(request, mode));
    },
  };
}

function createDevelopmentToolNameResolver(tools: readonly LlmToolDefinition[]): {
  profile: string | null;
  candidates: string | null;
  contests: string | null;
} {
  const findByRuntime = (runtimeName: string) =>
    tools.find((tool) => tool.runtimeName === runtimeName)?.function.name ?? null;
  return {
    profile: findByRuntime("assistant.resolve_learner_training_profile"),
    candidates: findByRuntime("assistant.get_personalized_codeforces_candidates"),
    contests: findByRuntime("assistant.get_upcoming_codeforces_contests"),
  };
}

function createDevelopmentDefaultToolCalls(
  tools: ReturnType<typeof createDevelopmentToolNameResolver>,
  definitions: readonly LlmToolDefinition[],
): LlmToolCall[] {
  const calls: LlmToolCall[] = [];
  if (tools.profile) {
    calls.push({
      id: "a516_profile_1",
      type: "function",
      name: tools.profile,
      arguments: {},
    });
  }
  if (tools.candidates) {
    calls.push({
      id: "a516_candidates_1",
      type: "function",
      name: tools.candidates,
      arguments: { limit: 5 },
    });
  }
  if (tools.contests) {
    calls.push({
      id: "a516_contests_1",
      type: "function",
      name: tools.contests,
      arguments: { limit: 1 },
    });
  }
  if (calls.length > 0) {
    return calls;
  }
  return [{
    id: "a516_fallback_tool_1",
    type: "function",
    name: firstToolName(definitions),
    arguments: {},
  }];
}

function firstToolName(tools: readonly LlmToolDefinition[] | undefined): string {
  return tools?.[0]?.function.name ?? "a516_no_registered_tool";
}

function createDevelopmentToolTurn(toolCalls: readonly LlmToolCall[]): LlmAssistantTurnResult {
  return {
    ok: true,
    message: {
      role: LlmChatRole.Assistant,
      content: "",
      toolCalls,
    },
    finishReason: "tool_calls",
    providerMode: LlmProviderMode.Mock,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    warnings: ["dev_stub_provider"],
    createdAt: new Date().toISOString(),
  };
}

function createDevelopmentFinalTurn(content: string): LlmAssistantTurnResult {
  return {
    ok: true,
    message: {
      role: LlmChatRole.Assistant,
      content,
    },
    finishReason: "stop",
    providerMode: LlmProviderMode.Mock,
    realProviderCalled: false,
    networkAccessed: false,
    secretSafe: true,
    rawPromptStored: false,
    rawResponseStored: false,
    devOnly: true,
    productionReady: false,
    warnings: ["dev_stub_provider"],
    createdAt: new Date().toISOString(),
  };
}

function buildDevelopmentReliableLoopFinalAnswer(
  request: LlmChatRequest,
  mode: AssistantStabilityInjectionMode,
): string {
  const toolMessageCount = request.messages.filter((message) => message.role === LlmChatRole.Tool).length;
  const hasArtifactRef = request.messages.some((message) =>
    message.role === LlmChatRole.Tool && message.content.includes("artifactRef")
  );
  const hasFailure = request.messages.some((message) =>
    message.role === LlmChatRole.Tool &&
    /failed|invalid|permission_denied|timed_out|cancelled|duplicate|not_found|empty/i.test(message.content)
  );
  const lines = [
    "开发验收模式：已通过真实 Reliable Agent Loop、canonical Tool Runtime 和任务 Repository 完成本轮执行。",
    `本轮模型侧收到 ${toolMessageCount} 个安全 Tool Result。`,
  ];
  if (hasArtifactRef) {
    lines.push("大型 Tool Result 只以安全预览和 Artifact 引用进入模型上下文，页面不会展示内部存储路径。");
  }
  if (hasFailure || mode !== "normal") {
    lines.push("部分工具结果为失败、空结果或受限状态时，回答只保留已成功的依据，不虚构缺失数据。");
  }
  lines.push("建议优先按当前训练画像选择 5 道 Codeforces 题，并在最近一场可报名比赛前完成一次限时训练。");
  lines.push("本回答不包含内部提示词、模型原始响应、工具原始输入输出、凭据或内部路径。");
  return lines.join("\n");
}

function buildReliableLoopMemorySummary(
  memories: readonly { enabled?: boolean; category?: string; content?: string; id?: string }[],
): {
  safeEventSummary: string;
  visibleContext: string;
} {
  const enabled = memories
    .filter((memory) => memory.enabled !== false && typeof memory.content === "string" && memory.content.trim().length > 0)
    .slice(0, 8);

  return {
    safeEventSummary: enabled.length > 0
      ? `Loaded ${enabled.length} relevant long-term memory item(s).`
      : "No relevant long-term memory item was loaded.",
    visibleContext: enabled.map((memory, index) =>
      `${index + 1}. ${memory.category ?? "memory"}: ${String(memory.content).replace(/\s+/g, " ").trim().slice(0, 240)}`,
    ).join("\n"),
  };
}

function buildReliableLoopMessages(input: {
  task: AssistantMultiAgentTaskRecord;
  learningContext: AssistantLearningContextSummary;
  pageContext: SafeAssistantPageContext;
  memorySummary: ReturnType<typeof buildReliableLoopMemorySummary>;
}) {
  return [
    {
      role: LlmChatRole.System,
      content: [
        "You are the Learning Agent Platform assistant.",
        "Answer in Chinese. Keep Codeforces, Rating, URL, and problem names as needed.",
        "Use only the provided read-only tools when training level, personalized Codeforces candidates, or upcoming contests are needed.",
        "Do not expose chain-of-thought, raw prompts, raw tool input/output, provider payloads, credentials, database details, stack traces, or hidden context.",
        "If a tool fails, use the safe tool summary and clearly mark the answer as partial.",
      ].join("\n"),
    },
    {
      role: LlmChatRole.User,
      content: [
        `User request: ${input.task.userVisibleRequest}`,
        `Long-term memory:\n${input.memorySummary.visibleContext || "No relevant memory."}`,
        `Learning context:\n${formatLearningContextForReliableLoop(input.learningContext)}`,
        `Page context:\n${formatPageContextForReliableLoop(input.pageContext)}`,
        "Please produce the final answer only after using the necessary read-only tools.",
      ].join("\n\n"),
    },
  ];
}

function formatLearningContextForReliableLoop(context: AssistantLearningContextSummary): string {
  return [
    context.userLabel ? `User label: ${context.userLabel}` : "",
    context.abilityBand ? `Ability band: ${context.abilityBand}` : "",
    context.currentLevel ? `Current level: ${context.currentLevel}` : "",
    context.codeforcesProfileSummary ? `Codeforces profile: ${context.codeforcesProfileSummary}` : "",
    context.learningReportSummary ? `Learning report: ${context.learningReportSummary}` : "",
    context.reviewPlanSummary ? `Review plan: ${context.reviewPlanSummary}` : "",
    context.recentCodeAnalysisSummary ? `Code analysis: ${context.recentCodeAnalysisSummary}` : "",
    `Recent practice count: ${context.recentPracticeCount}`,
  ].filter(Boolean).join("\n") || "No learning context.";
}

function formatPageContextForReliableLoop(context: SafeAssistantPageContext): string {
  return [
    `Route: ${context.route}`,
    `Page type: ${context.pageType}`,
    context.title ? `Title: ${context.title}` : "",
    context.summary ? `Summary: ${context.summary}` : "",
    context.rating ? `Rating: ${context.rating}` : "",
  ].filter(Boolean).join("\n") || "No page context.";
}

type AssistantToolFaultInjectionMode = Extract<
  AssistantStabilityInjectionMode,
  | "tool_empty_once"
  | "tool_internal_error_once"
  | "tool_timeout_once"
  | "tool_cancel_once"
  | "tool_permission_denied_once"
  | "tool_large_result_once"
  | "context_compression_failure"
>;

function resolveReliableAgentLoopToolFaultInjectionMode(
  mode: AssistantStabilityInjectionMode | undefined,
  env: Record<string, string | undefined> = process.env,
): AssistantToolFaultInjectionMode | null {
  if (!isAssistantStabilityTestModeEnabled(env)) {
    return null;
  }
  switch (mode) {
    case "tool_empty_once":
    case "tool_internal_error_once":
    case "tool_timeout_once":
    case "tool_cancel_once":
    case "tool_permission_denied_once":
    case "tool_large_result_once":
    case "context_compression_failure":
      return mode;
    default:
      return null;
  }
}

function createReliableLoopToolDefinitions(
  injectionMode: AssistantToolFaultInjectionMode | null,
): readonly AnyAssistantToolDefinition[] {
  const definitions: AnyAssistantToolDefinition[] = [
    eraseAssistantToolDefinition(createResolveLearnerTrainingProfileDefinition()),
    eraseAssistantToolDefinition(createPersonalizedCodeforcesCandidatesDefinition()),
    eraseAssistantToolDefinition(createUpcomingCodeforcesContestsDefinition()),
  ];
  if (!injectionMode || injectionMode === "tool_permission_denied_once") {
    return definitions;
  }

  let injected = false;
  return definitions.map((definition) => ({
    ...definition,
    timeoutMs: injectionMode === "tool_timeout_once" ? 20 : definition.timeoutMs,
    execute: async (toolInput, context) => {
      if (injected) {
        return definition.execute(toolInput, context);
      }
      injected = true;
      if (injectionMode === "tool_empty_once") {
        return {
          name: definition.name,
          ok: false,
          summary: "开发验收：未找到匹配数据。",
          items: [],
          sources: [],
          warnings: ["dev_tool_empty_injection"],
          errorCode: "empty",
          errorMessage: "开发验收：未找到匹配数据。",
          timedOut: false,
          rawResponseStored: false,
        };
      }
      if (injectionMode === "tool_internal_error_once") {
        throw new Error("Invalid Prisma invocation with redacted credential details.");
      }
      if (injectionMode === "tool_timeout_once") {
        await sleepForReliableLoopToolFault(120, context.signal);
        return definition.execute(toolInput, context);
      }
      if (injectionMode === "tool_cancel_once") {
        return {
          name: definition.name,
          ok: false,
          summary: "开发验收：工具调用已取消。",
          items: [],
          sources: [],
          warnings: ["dev_tool_cancel_injection"],
          errorCode: "cancelled",
          errorMessage: "开发验收：工具调用已取消。",
          timedOut: false,
          rawResponseStored: false,
        };
      }
      if (injectionMode === "tool_large_result_once" || injectionMode === "context_compression_failure") {
        return createDevelopmentLargeToolResult(definition.name);
      }
      const legacyLargeResultMode = injectionMode as AssistantToolFaultInjectionMode | null;
      if (legacyLargeResultMode === "tool_large_result_once" || legacyLargeResultMode === "context_compression_failure") {
        const result = await definition.execute(toolInput, context);
        return {
          ...result,
          summary: `${result.summary}（开发验收：已生成大型工具结果，模型只接收安全摘要。）`,
          items: [
            ...result.items,
            ...Array.from({ length: 220 }, (_, index) => ({
              id: `a516-large-result-${index + 1}`,
              title: `A516 large result row ${index + 1}`,
              rating: 800 + (index % 12) * 100,
              safeNote: "用于验证大 Tool Result 预算、Artifact 和 Preview，不包含敏感信息。",
              tags: ["implementation", "dp", "graphs", "math"].slice(0, (index % 4) + 1),
            })),
          ],
          warnings: [...result.warnings, "dev_tool_large_result_injection"],
        };
      }
      return definition.execute(toolInput, context);
    },
  }));
}

function createDevelopmentLargeToolResult(toolName: AssistantToolName): AssistantToolExecutionResult<Record<string, unknown>> {
  return {
    name: toolName,
    ok: true,
    summary: "开发验收：已生成大型安全工具结果，模型只能接收预算内 Preview 和 Artifact 引用。",
    items: Array.from({ length: 220 }, (_, index) => ({
      id: `a516-large-result-${index + 1}`,
      title: `A516 large result row ${index + 1}`,
      rating: 800 + (index % 12) * 100,
      safeNote: "用于验证 Tool Result 预算、Artifact 和 Preview，不包含敏感信息。",
      tags: ["implementation", "dp", "graphs", "math"].slice(0, (index % 4) + 1),
    })),
    sources: [{
      title: "A516 development safe large result",
      source: "development-safe-fixture",
      url: "a516-development-safe-large-result",
    }],
    warnings: ["dev_tool_large_result_injection"],
    timedOut: false,
    rawResponseStored: false,
  };
}

function sleepForReliableLoopToolFault(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("ABORTED"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal?.reason ?? new Error("ABORTED"));
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function persistReliableAgentLoopEvent(input: {
  repository: FileAssistantTaskRepository;
  userId: string;
  taskId: string;
  agentRunId: string | null;
  event: ReliableAgentLoopEvent;
}): Promise<void> {
  await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    if (isTerminalTaskStatus(task.status)) {
      return task;
    }
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      agentRunId: input.agentRunId ?? undefined,
      eventType: input.event.eventType,
      status: String(input.event.status ?? task.status),
      safeMessage: input.event.safeSummary ?? safeMessageForReliableLoopEvent(input.event.eventType),
      toolName: input.event.toolName,
    }));
    return task;
  });
}

function safeMessageForReliableLoopEvent(eventType: ReliableAgentLoopEvent["eventType"]): string {
  switch (eventType) {
    case ReliableAgentLoopEventType.AgentLoopStarted:
      return "可靠 Agent Loop 已启动。";
    case ReliableAgentLoopEventType.MemoryContextLoaded:
      return "已加载安全记忆上下文。";
    case ReliableAgentLoopEventType.ModelRequestStarted:
      return "模型请求已开始。";
    case ReliableAgentLoopEventType.ModelToolCallsReceived:
      return "模型返回了工具调用请求。";
    case ReliableAgentLoopEventType.ToolCallValidationFailed:
      return "工具调用校验失败。";
    case ReliableAgentLoopEventType.ToolCallQueued:
      return "工具调用已排队。";
    case ReliableAgentLoopEventType.ToolCallStarted:
      return "工具调用已开始。";
    case ReliableAgentLoopEventType.ToolCallCompleted:
      return "工具调用已完成。";
    case ReliableAgentLoopEventType.ToolResultBudgetApplied:
      return "工具结果已按预算替换为安全摘要。";
    case ReliableAgentLoopEventType.ToolResultArtifactStored:
      return "大型工具结果已保存为安全 Artifact 引用。";
    case ReliableAgentLoopEventType.ToolResultAppended:
      return "工具结果已回灌到模型上下文。";
    case ReliableAgentLoopEventType.ToolResultMicrocompacted:
      return "较早的工具结果已压缩为安全摘要。";
    case ReliableAgentLoopEventType.ContextBudgetWarning:
      return "上下文接近上限，已保留关键来源。";
    case ReliableAgentLoopEventType.ContextCompressed:
      return "上下文已自动整理。";
    case ReliableAgentLoopEventType.ContextCompressionFailed:
      return "上下文自动整理失败。";
    case ReliableAgentLoopEventType.ContextCompressionPaused:
      return "自动整理暂时暂停。";
    case ReliableAgentLoopEventType.ContextBlocked:
      return "上下文已达到阻断阈值。";
    case ReliableAgentLoopEventType.ModelContinuationStarted:
      return "工具结果回灌后已开始第二次模型请求。";
    case ReliableAgentLoopEventType.ModelFinalAnswerReceived:
      return "模型已返回最终回答。";
    case ReliableAgentLoopEventType.AgentLoopLimitReached:
      return "可靠 Agent Loop 已达到安全上限。";
    case ReliableAgentLoopEventType.AgentLoopCancelled:
      return "可靠 Agent Loop 已取消。";
    case ReliableAgentLoopEventType.AgentLoopTimedOut:
      return "可靠 Agent Loop 已超时。";
    case ReliableAgentLoopEventType.AgentLoopFailed:
      return "可靠 Agent Loop 执行失败。";
    case ReliableAgentLoopEventType.AgentLoopCompleted:
      return "可靠 Agent Loop 已完成。";
  }
}

function mapReliableLoopStatusToTaskStatus(
  status: ReliableAgentLoopStatus,
): AssistantMultiAgentTaskView["status"] {
  switch (status) {
    case ReliableAgentLoopStatus.Succeeded:
      return "succeeded";
    case ReliableAgentLoopStatus.PartiallySucceeded:
    case ReliableAgentLoopStatus.LimitReached:
      return "partial_success";
    case ReliableAgentLoopStatus.Cancelled:
      return "cancelled";
    case ReliableAgentLoopStatus.TimedOut:
      return "timed_out";
    case ReliableAgentLoopStatus.Failed:
    case ReliableAgentLoopStatus.UnsupportedToolCalling:
      return "failed";
  }
}

function mapReliableLoopStatusToAgentStatus(
  status: ReliableAgentLoopStatus,
): AssistantAgentRunStatus {
  switch (status) {
    case ReliableAgentLoopStatus.Succeeded:
    case ReliableAgentLoopStatus.PartiallySucceeded:
    case ReliableAgentLoopStatus.LimitReached:
      return "succeeded";
    case ReliableAgentLoopStatus.Cancelled:
      return "cancelled";
    case ReliableAgentLoopStatus.TimedOut:
      return "timed_out";
    case ReliableAgentLoopStatus.Failed:
    case ReliableAgentLoopStatus.UnsupportedToolCalling:
      return "failed";
  }
}

function mapReliableLoopStatusToFinalAnswerStatus(
  status: ReliableAgentLoopStatus,
): AssistantMultiAgentTaskView["finalAnswerStatus"] {
  switch (status) {
    case ReliableAgentLoopStatus.Succeeded:
      return "available";
    case ReliableAgentLoopStatus.PartiallySucceeded:
    case ReliableAgentLoopStatus.LimitReached:
      return "partial";
    case ReliableAgentLoopStatus.Cancelled:
      return "cancelled";
    case ReliableAgentLoopStatus.TimedOut:
    case ReliableAgentLoopStatus.Failed:
    case ReliableAgentLoopStatus.UnsupportedToolCalling:
      return "failed";
  }
}

function taskAuditEventForReliableLoopStatus(
  status: ReliableAgentLoopStatus,
): AssistantAgentAuditEventType {
  switch (status) {
    case ReliableAgentLoopStatus.Succeeded:
      return "task_completed";
    case ReliableAgentLoopStatus.PartiallySucceeded:
    case ReliableAgentLoopStatus.LimitReached:
      return "task_partial_success";
    case ReliableAgentLoopStatus.Cancelled:
      return "task_cancelled";
    case ReliableAgentLoopStatus.TimedOut:
      return "task_timed_out";
    case ReliableAgentLoopStatus.Failed:
    case ReliableAgentLoopStatus.UnsupportedToolCalling:
      return "task_failed";
  }
}

function reliableLoopErrorCode(status: ReliableAgentLoopStatus): string | undefined {
  return status === ReliableAgentLoopStatus.Succeeded
    ? undefined
    : status;
}

function safeSummaryForReliableLoopStatus(status: ReliableAgentLoopStatus): string {
  switch (status) {
    case ReliableAgentLoopStatus.Succeeded:
      return "可靠 Agent Loop 已成功完成。";
    case ReliableAgentLoopStatus.PartiallySucceeded:
      return "可靠 Agent Loop 已完成，但存在部分工具失败。";
    case ReliableAgentLoopStatus.LimitReached:
      return "可靠 Agent Loop 达到安全上限后已停止。";
    case ReliableAgentLoopStatus.Cancelled:
      return "可靠 Agent Loop 已取消。";
    case ReliableAgentLoopStatus.TimedOut:
      return "可靠 Agent Loop 已超时。";
    case ReliableAgentLoopStatus.UnsupportedToolCalling:
      return "当前配置的模型不支持工具调用。";
    case ReliableAgentLoopStatus.Failed:
      return "可靠 Agent Loop 执行失败。";
  }
}

function evidenceFromReliableLoopToolResults(
  results: readonly ToolExecutionResult[],
  agentName: AssistantAgentName,
): AssistantEvidenceReference[] {
  const evidence: AssistantEvidenceReference[] = [];
  for (const result of results) {
    for (const source of result.sourceRefs.slice(0, 8)) {
      evidence.push({
        id: `evidence-${hashText(`${source.title}|${source.source}|${source.url ?? source.recordId ?? ""}`)}`,
        type: evidenceTypeForCanonicalTool(result.toolName),
        label: source.title,
        source: source.source,
        officialUrl: source.url?.startsWith("http") ? source.url : undefined,
        recordId: source.recordId ?? (source.url && !source.url.startsWith("http") ? source.url : undefined),
        fetchedAt: new Date().toISOString(),
        cached: source.cached === true,
        realtime: /official|codeforces/i.test(source.source) && source.cached !== true,
        safeSummary: source.safeSummary ?? result.safeSummary,
        usedByAgentNames: [agentName],
      });
    }
  }
  return evidence;
}

function evidenceTypeForCanonicalTool(toolName: string): AssistantEvidenceReference["type"] {
  if (toolName === getAssistantToolCanonicalName("getUpcomingCodeforcesContests")) {
    return "codeforces_contest_list";
  }
  if (toolName === getAssistantToolCanonicalName("getPersonalizedCodeforcesCandidates")) {
    return "local_curated_problem_pool";
  }
  if (toolName === getAssistantToolCanonicalName("resolveLearnerTrainingProfile")) {
    return "learning_report";
  }
  return "assistant_task";
}

function assistantToolNameFromCanonical(toolName: string): string {
  if (toolName === getAssistantToolCanonicalName("resolveLearnerTrainingProfile")) {
    return "resolveLearnerTrainingProfile";
  }
  if (toolName === getAssistantToolCanonicalName("getPersonalizedCodeforcesCandidates")) {
    return "getPersonalizedCodeforcesCandidates";
  }
  if (toolName === getAssistantToolCanonicalName("getUpcomingCodeforcesContests")) {
    return "getUpcomingCodeforcesContests";
  }
  return toolName;
}

function sourceRefKey(source: { title: string; source: string; url?: string; recordId?: string }): string {
  return `${source.source}|${source.url ?? source.recordId ?? ""}|${source.title}`.slice(0, 240);
}

function sanitizeReliableLoopFinalAnswer(value: string): string {
  return sanitizeVisibleFinalAnswer(value)
    .replace(/\bbearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\b(api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|secret|credential|cookie|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\b(DATABASE_URL|postgres:\/\/|mysql:\/\/)[^\s]*/gi, "[redacted]")
    .slice(0, 4000);
}

async function executeFullTask(input: {
  repository: FileAssistantTaskRepository;
  userId: string;
  taskId: string;
  pageContext?: SafeAssistantPageContext;
  learningContext?: AssistantLearningContextSummary | null;
  guardEnv?: Record<string, string | undefined>;
  customFetch?: ExternalProviderFetch;
  signal: AbortSignal;
  control: RunningTaskControl;
}): Promise<void> {
  if (await tryExecuteReliableAgentLoopTask(input)) {
    return;
  }

  const task = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
  const taskTimeout = setTimeout(() => {
    input.control.taskTimedOut = true;
    input.control.controller.abort(new Error("TASK_TIMEOUT"));
  }, task.limits.taskTimeoutMs);

  try {
    await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (record) => {
      if (record.status !== "queued") {
        return record;
      }
      if (record.estimatedTokens > record.limits.maxEstimatedTokens) {
        record.status = "failed";
        record.completedAt = new Date().toISOString();
        record.errorCode = "context_budget_blocked";
        record.finalAnswerStatus = "failed";
        record.auditEvents.push(createAuditEvent({
          taskId: record.id,
          eventType: "budget_blocked",
          status: record.status,
          safeMessage: "请求超过任务上下文预算，未启动执行步骤。",
        }));
        return record;
      }
      record.status = "running";
      record.startedAt = new Date().toISOString();
      record.auditEvents.push(createAuditEvent({
        taskId: record.id,
        eventType: "task_started",
        status: record.status,
        safeMessage: "多步骤任务开始执行。",
      }));
      return record;
    });

    await runAgentAttempt(input, "Orchestrator", async () => ({
      status: "succeeded",
      summary: "已拆分为学习画像、题目候选、近期比赛和结果聚合步骤。",
      data: { plannedAgents: A509_AGENT_NAMES },
    }));
    throwIfSignalAborted(input.signal);

    const learner = runAgentAttempt(input, "LearnerProfile", (ctx) => runLearnerProfileAgent(input, ctx.signal, ctx.run));
    const contest = runAgentAttempt(input, "UpcomingContest", (ctx) => runUpcomingContestAgent(input, ctx.signal, ctx.run));
    await learner.catch(() => undefined);
    await contest.catch(() => undefined);
    throwIfSignalAborted(input.signal);

    await runAgentAttempt(input, "CandidateRecommendation", (ctx) => runCandidateRecommendationAgent(input, ctx.signal, ctx.run));
    throwIfSignalAborted(input.signal);
    await runResultAggregatorAndFinish(input, false);
  } catch {
    await finalizeAbortedTask(input);
  } finally {
    clearTimeout(taskTimeout);
  }
}

async function executeAgentRetry(input: {
  repository: FileAssistantTaskRepository;
  userId: string;
  taskId: string;
  agentName: AssistantAgentName;
} & RuntimeStartOptions): Promise<void> {
  const controller = new AbortController();
  const control: RunningTaskControl = { controller, taskTimedOut: false };
  const task = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
  const taskTimeout = setTimeout(() => {
    control.taskTimedOut = true;
    controller.abort(new Error("TASK_TIMEOUT"));
  }, task.limits.taskTimeoutMs);

  try {
    const base = { ...input, signal: controller.signal, control };
    if (input.agentName === "LearnerProfile") {
      await runAgentAttempt(base, "LearnerProfile", (ctx) => runLearnerProfileAgent(base, ctx.signal, ctx.run));
      throwIfSignalAborted(controller.signal);
      await runAgentAttempt(base, "CandidateRecommendation", (ctx) => runCandidateRecommendationAgent(base, ctx.signal, ctx.run));
    } else if (input.agentName === "CandidateRecommendation") {
      await runAgentAttempt(base, "CandidateRecommendation", (ctx) => runCandidateRecommendationAgent(base, ctx.signal, ctx.run));
    } else if (input.agentName === "UpcomingContest") {
      await runAgentAttempt(base, "UpcomingContest", (ctx) => runUpcomingContestAgent(base, ctx.signal, ctx.run));
    }
    throwIfSignalAborted(controller.signal);
    await runResultAggregatorAndFinish(base, true);
  } catch {
    await finalizeAbortedTask({ ...input, signal: controller.signal, control });
  } finally {
    clearTimeout(taskTimeout);
  }
}

async function runAgentAttempt(
  input: {
    repository: FileAssistantTaskRepository;
    userId: string;
    taskId: string;
    pageContext?: SafeAssistantPageContext;
    learningContext?: AssistantLearningContextSummary | null;
    guardEnv?: Record<string, string | undefined>;
    customFetch?: ExternalProviderFetch;
    signal: AbortSignal;
  },
  agentName: AssistantAgentName,
  worker: (context: { signal: AbortSignal; run: AssistantTaskAgentRunRecord }) => Promise<AgentOutcome>,
): Promise<AgentOutcome> {
  const initial = await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    const attempt = nextAttemptForAgent(task, agentName);
    const run = createAgentRun({
      taskId: task.id,
      agentName,
      role: agentRole(agentName),
      attempt,
      timeoutMs: task.limits.agentTimeoutMs[agentName],
      safeInputSummary: safeInputForAgent(task, agentName),
    });
    task.agentRuns.push(run);
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        agentRunId: run.id,
        eventType: "agent_queued",
        status: run.status,
      safeMessage: `${formatAgentDisplayName(agentName)}已入队。`,
        attempt,
      }));
    return { task, run };
  });

  const run = initial.run;
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(input.signal.reason ?? new Error("TASK_ABORTED"));
  input.signal.addEventListener("abort", relayAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("AGENT_TIMEOUT"));
  }, run.timeoutMs);

  try {
    await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
      const current = requireRun(task, run.id);
      current.status = "running";
      current.startedAt = new Date().toISOString();
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        agentRunId: current.id,
        eventType: current.attempt > 1 ? "agent_retry_started" : "agent_started",
        status: current.status,
        safeMessage: `${formatAgentDisplayName(agentName)}开始执行。`,
        attempt: current.attempt,
      }));
      return task;
    });

    const outcome = await Promise.race([
      worker({ signal: controller.signal, run }).catch((error: unknown): AgentOutcome => ({
        status: "failed",
        summary: error instanceof Error ? sanitizeVisibleFinalAnswer(error.message) : "步骤执行失败。",
        errorCode: isAbortLikeError(error) ? "agent_cancelled" : "agent_failed",
      })),
      new Promise<AgentOutcome>((resolve) => {
        controller.signal.addEventListener("abort", () => {
          resolve({
            status: "failed",
            summary: timedOut ? `${formatAgentDisplayName(agentName)}超时。` : `${formatAgentDisplayName(agentName)}已取消。`,
            errorCode: timedOut ? "agent_timeout" : "agent_cancelled",
          });
        }, { once: true });
      }),
    ]);

    await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
      const current = requireRun(task, run.id);
      const status = resolveRunStatus(outcome, timedOut, input.signal.aborted);
      current.status = status;
      current.completedAt = new Date().toISOString();
      current.safeOutputSummary = outcome.summary;
      current.retryable = retryableAgentStatus(status);
      current.usedTools = outcome.usedTools ?? current.usedTools;
      current.sourceRefs = outcome.sourceRefs ?? current.sourceRefs;
      current.safeOutputData = outcome.data ?? null;
      if (outcome.errorCode) {
        current.errorCode = outcome.errorCode;
      }
      if (outcome.developmentInjection) {
        current.developmentInjection = outcome.developmentInjection;
      }
      attachEvidence(task, outcome.evidence ?? [], agentName);
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        agentRunId: current.id,
        eventType: agentEventForStatus(status, current.attempt),
        status,
        safeMessage: outcome.summary,
        sourceRefs: current.sourceRefs,
        attempt: current.attempt,
      }));
      return task;
    });

    return outcome;
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", relayAbort);
  }
}

async function runLearnerProfileAgent(
  input: RuntimeStartOptions & { repository: FileAssistantTaskRepository; userId: string; taskId: string },
  signal: AbortSignal,
  run: AssistantTaskAgentRunRecord,
): Promise<AgentOutcome> {
  await maybeDelayForInjection(input, "LearnerProfile", run, signal);
  const result = await runTool(input, run, eraseAssistantToolDefinition(createResolveLearnerTrainingProfileDefinition()), {}, signal);
  const profile = result.items[0] as LearnerTrainingProfile | undefined;
  const acceptable = result.ok || isEmptyToolResult(result);
  return {
    status: acceptable ? "succeeded" : "failed",
    summary: acceptable ? result.summary : result.errorMessage ?? result.summary,
    data: profile ? { profile } : undefined,
    errorCode: acceptable ? undefined : result.errorCode ?? "profile_unavailable",
    usedTools: [result.name],
    sourceRefs: result.sources.map(sourceKey),
    evidence: evidenceFromToolResult(result, "LearnerProfile"),
  };
}

async function runCandidateRecommendationAgent(
  input: RuntimeStartOptions & { repository: FileAssistantTaskRepository; userId: string; taskId: string },
  signal: AbortSignal,
  run: AssistantTaskAgentRunRecord,
): Promise<AgentOutcome> {
  await maybeDelayForInjection(input, "CandidateRecommendation", run, signal);
  const result = await runTool(input, run, eraseAssistantToolDefinition(createPersonalizedCodeforcesCandidatesDefinition()), {
    limit: A509_DEFAULT_TASK_LIMITS.maxCandidateProblems,
  }, signal);
  const candidates = result.items as PersonalizedCodeforcesCandidate[];
  const acceptable = result.ok || isEmptyToolResult(result);
  return {
    status: acceptable ? "succeeded" : "failed",
    summary: acceptable ? result.summary : result.errorMessage ?? result.summary,
    data: { candidates },
    errorCode: acceptable ? undefined : result.errorCode ?? "candidate_unavailable",
    usedTools: [result.name],
    sourceRefs: result.sources.map(sourceKey),
    evidence: evidenceFromToolResult(result, "CandidateRecommendation"),
  };
}

async function runUpcomingContestAgent(
  input: RuntimeStartOptions & { repository: FileAssistantTaskRepository; userId: string; taskId: string },
  signal: AbortSignal,
  run: AssistantTaskAgentRunRecord,
): Promise<AgentOutcome> {
  const injection = await maybeDelayForInjection(input, "UpcomingContest", run, signal);
  if (injection === "fail_upcoming_once") {
    return {
      status: "failed",
      summary: "开发验收注入：近期比赛步骤首次执行失败。",
      errorCode: "development_injected_failure",
      developmentInjection: "开发验收注入",
    };
  }
  const result = await runTool(input, run, eraseAssistantToolDefinition(createUpcomingCodeforcesContestsDefinition()), { limit: 5 }, signal);
  const contests = result.items as UpcomingCodeforcesContest[];
  const acceptable = result.ok || isEmptyToolResult(result);
  return {
    status: acceptable ? "succeeded" : "failed",
    summary: acceptable ? result.summary : result.errorMessage ?? result.summary,
    data: { contests },
    errorCode: acceptable ? undefined : result.errorCode ?? "contest_unavailable",
    usedTools: [result.name],
    sourceRefs: result.sources.map(sourceKey),
    evidence: evidenceFromToolResult(result, "UpcomingContest"),
  };
}

async function runResultAggregatorAndFinish(
  input: {
    repository: FileAssistantTaskRepository;
    userId: string;
    taskId: string;
    signal: AbortSignal;
  } & RuntimeStartOptions,
  rebuilt: boolean,
): Promise<void> {
  const outcome = await runAgentAttempt(input, "ResultAggregator", async () => {
    const task = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
    const profile = latestOutput<LearnerTrainingProfile>(task, "LearnerProfile", "profile");
    const candidates = latestOutput<PersonalizedCodeforcesCandidate[]>(task, "CandidateRecommendation", "candidates") ?? [];
    const contests = latestOutput<UpcomingCodeforcesContest[]>(task, "UpcomingContest", "contests") ?? [];
    const failedAgents = latestRuns(task).filter((run) =>
      run.agentName !== "ResultAggregator" && retryableAgentStatus(run.status),
    );
    const longTermMemories = await listAssistantLongTermMemories(input.userId);
    const shouldRefreshReportsFirst = longTermMemories.some((memory) =>
      memory.enabled && isCodeforcesRefreshReminderMemory(memory.content),
    );

    const modelAnswer = await generateModelFinalAnswer({
      userId: input.userId,
      profile,
      candidates,
      contests,
      failedAgents,
      shouldRefreshReportsFirst,
      customFetch: input.customFetch,
      guardEnv: input.guardEnv,
      signal: input.signal,
    });
    const deterministicAnswer = buildFinalAnswer({
      profile,
      candidates,
      contests,
      failedAgents,
      evidence: task.evidence,
      shouldRefreshReportsFirst,
      modelStatusLine: modelAnswer.providerResolved
        ? "用户配置的 AI 模型本次未返回可用中文回答。以下是服务端根据只读工具结果生成的确定性摘要，未冒充真实模型回答。"
        : "尚未配置可用的 AI 模型，请先到模型管理中配置并启用模型。以下是服务端根据只读工具结果生成的确定性摘要，未冒充真实模型回答。",
    });
    const answer = modelAnswer.answer ?? deterministicAnswer;

    if (!profile && candidates.length === 0 && contests.length === 0) {
      return {
        status: "failed",
        summary: "没有可用步骤输出，无法生成最终回答。",
        errorCode: "no_agent_output",
      };
    }
    return {
      status: "succeeded",
      summary: modelAnswer.answer
        ? (failedAgents.length > 0 ? "已调用用户配置模型，根据可用步骤输出生成部分中文结果。" : "已调用用户配置模型生成中文最终回答。")
        : (failedAgents.length > 0 ? "已根据可用步骤输出生成部分确定性结果。" : "已生成确定性多步骤结果。"),
      data: { finalAnswer: answer, partial: failedAgents.length > 0, modelUsed: Boolean(modelAnswer.answer) },
      evidence: shouldRefreshReportsFirst
        ? [createLongTermMemoryEvidence(input.userId, longTermMemories.find((memory) => isCodeforcesRefreshReminderMemory(memory.content))?.id ?? null)]
        : [],
    };
  });

  await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    const now = new Date().toISOString();
    const latest = latestRuns(task);
    const failedAgents = latest.filter((run) =>
      run.agentName !== "ResultAggregator" && retryableAgentStatus(run.status),
    );
    const aggregator = latestRun(task, "ResultAggregator");

    if (aggregator?.status !== "succeeded") {
      task.status = "failed";
      task.completedAt = now;
      task.errorCode = aggregator?.errorCode ?? "aggregator_failed";
      task.finalAnswerStatus = "failed";
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "task_failed",
        status: task.status,
        safeMessage: "所有关键步骤输出不可用，任务失败。",
      }));
      return task;
    }

    const finalAnswer = typeof outcome.data?.finalAnswer === "string" ? outcome.data.finalAnswer : "";
    task.finalAnswer = finalAnswer;
    task.finalAnswerStatus = failedAgents.length > 0 ? "partial" : "available";
    task.status = failedAgents.length > 0 ? "partial_success" : "succeeded";
    task.completedAt = now;
    task.errorCode = failedAgents.length > 0 ? "partial_agent_failure" : undefined;
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      eventType: failedAgents.length > 0 ? "task_partial_success" : "task_completed",
      status: task.status,
      safeMessage: failedAgents.length > 0
        ? "任务部分成功，最终回答只使用已成功步骤的依据。"
        : "任务成功完成，最终回答已生成。",
    }));
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      eventType: rebuilt ? "final_answer_rebuilt" : "final_answer_created",
      status: task.finalAnswerStatus,
      safeMessage: rebuilt ? "重试后已重新构建最终回答。" : "最终回答已根据证据生成。",
    }));
    return task;
  });
}

async function runTool(
  input: RuntimeStartOptions & { repository: FileAssistantTaskRepository; userId: string; taskId: string },
  run: AssistantTaskAgentRunRecord,
  definition: AnyAssistantToolDefinition,
  toolInput: unknown,
  signal: AbortSignal,
): Promise<AssistantToolExecutionResult<unknown>> {
  const allowed = await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    if (task.toolCallCount >= task.limits.maxToolCalls) {
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        agentRunId: run.id,
        eventType: "budget_blocked",
        status: task.status,
        safeMessage: "工具调用次数达到任务限制，后续工具被阻止。",
        toolName: definition.name,
      }));
      return false;
    }
    task.toolCallCount += 1;
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      agentRunId: run.id,
      eventType: "tool_started",
      status: "running",
      safeMessage: `${formatToolDisplayName(definition.name)}开始执行。`,
      toolName: definition.name,
      attempt: run.attempt,
    }));
    return true;
  });

  if (!allowed) {
    return {
      name: definition.name,
      ok: false,
      summary: "工具调用预算已用尽。",
      items: [],
      sources: [],
      warnings: ["budget_blocked"],
      errorCode: "budget_blocked",
      errorMessage: "工具调用预算已用尽。",
      timedOut: false,
      rawResponseStored: false,
    };
  }

  const execution = await executeAssistantToolWithCanonicalResult(definition, toolInput, {
    userId: input.userId,
    question: "",
    pageContext: input.pageContext ?? { route: "/ai", pageType: "ai" },
    learningContext: input.learningContext ?? createEmptyAssistantLearningContext(null, true),
    guardEnv: input.guardEnv ?? createAssistantProviderEnvSnapshot(),
    customFetch: input.customFetch,
    signal,
  });
  const result = execution.result;
  const canonical = execution.canonicalResult;

  await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      agentRunId: run.id,
      eventType: toolAuditEventForCanonicalStatus(canonical.status),
      status: canonical.status,
      safeMessage: canonical.safeSummary,
      toolName: result.name,
      sourceRefs: result.sources.map(sourceKey),
      attempt: run.attempt,
    }));
    return task;
  });

  return result;
}

function toolAuditEventForCanonicalStatus(status: string): AssistantAgentAuditEventType {
  switch (status) {
    case "succeeded":
      return "tool_succeeded";
    case "empty":
      return "tool_empty";
    case "timed_out":
      return "tool_timed_out";
    case "cancelled":
      return "tool_cancelled";
    case "permission_denied":
      return "tool_permission_denied";
    default:
      return "tool_failed";
  }
}

function isEmptyToolResult(result: AssistantToolExecutionResult<unknown>): boolean {
  return result.errorCode === "empty" || result.errorCode === "empty_result";
}

async function finalizeAbortedTask(input: {
  repository: FileAssistantTaskRepository;
  userId: string;
  taskId: string;
  signal: AbortSignal;
  control: RunningTaskControl;
}): Promise<void> {
  await input.repository.mutateTask({ userId: input.userId, taskId: input.taskId }, (task) => {
    if (isTerminalTaskStatus(task.status)) {
      return task;
    }
    const now = new Date().toISOString();
    if (input.control.taskTimedOut) {
      task.status = "timed_out";
      task.errorCode = "task_timeout";
      task.finalAnswerStatus = "failed";
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "task_timed_out",
        status: task.status,
        safeMessage: "任务总超时已触发，晚到结果会被丢弃。",
      }));
    } else {
      task.status = "cancelled";
      task.cancelledAt = now;
      task.finalAnswerStatus = "cancelled";
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "task_cancelled",
        status: task.status,
        safeMessage: "任务已取消，不会生成新的最终回答。",
      }));
    }
    task.completedAt = now;
    for (const run of task.agentRuns) {
      if (run.status === "running") {
        run.status = input.control.taskTimedOut ? "timed_out" : "cancelled";
        run.completedAt = now;
        run.errorCode = input.control.taskTimedOut ? "task_timeout" : "task_cancelled";
        run.retryable = true;
      } else if (run.status === "pending") {
        run.status = "skipped";
        run.completedAt = now;
        run.errorCode = input.control.taskTimedOut ? "task_timeout" : "task_cancelled";
        run.retryable = true;
      }
    }
    return task;
  });
}

function resolveRunStatus(
  outcome: AgentOutcome,
  timedOut: boolean,
  taskAborted: boolean,
): AssistantAgentRunStatus {
  if (timedOut) {
    return "timed_out";
  }
  if (taskAborted && outcome.errorCode === "agent_cancelled") {
    return "cancelled";
  }
  return outcome.status === "succeeded" ? "succeeded" : "failed";
}

function agentEventForStatus(status: AssistantAgentRunStatus, attempt: number): AssistantAgentAuditEventType {
  if (status === "succeeded") {
    return attempt > 1 ? "agent_retry_succeeded" : "agent_succeeded";
  }
  if (status === "timed_out") {
    return "agent_timed_out";
  }
  if (status === "cancelled") {
    return "agent_cancelled";
  }
  return "agent_failed";
}

async function maybeDelayForInjection(
  input: RuntimeStartOptions & { repository: FileAssistantTaskRepository; userId: string; taskId: string },
  agentName: AssistantAgentName,
  run: AssistantTaskAgentRunRecord,
  signal: AbortSignal,
): Promise<AssistantStabilityInjectionMode | null> {
  const task = await input.repository.getTask({ userId: input.userId, taskId: input.taskId });
  const mode = task.stabilityInjectionMode;
  if (mode === "normal" || run.attempt > 1) {
    return null;
  }
  if (mode === "delay_task_for_cancel") {
    await sleep(1_500, signal);
    return mode;
  }
  if (mode === "timeout_candidate_once" && agentName === "CandidateRecommendation") {
    await sleep(run.timeoutMs + 2_000, signal);
    return mode;
  }
  if (mode === "fail_upcoming_once" && agentName === "UpcomingContest") {
    return mode;
  }
  return null;
}

function attachEvidence(
  task: AssistantMultiAgentTaskRecord,
  evidence: readonly AssistantEvidenceReference[],
  agentName: AssistantAgentName,
): void {
  for (const item of evidence) {
    if (task.evidence.length >= task.limits.maxEvidence) {
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "budget_warning",
        status: task.status,
        safeMessage: "依据数量达到限制，后续来源只保留在步骤摘要中。",
      }));
      return;
    }
    const existing = task.evidence.find((current) =>
      current.label === item.label && current.source === item.source && current.officialUrl === item.officialUrl,
    );
    if (existing) {
      if (!existing.usedByAgentNames.includes(agentName)) {
        existing.usedByAgentNames.push(agentName);
      }
      continue;
    }
    task.evidence.push({
      ...item,
      usedByAgentNames: item.usedByAgentNames.includes(agentName) ? item.usedByAgentNames : [...item.usedByAgentNames, agentName],
    });
    task.auditEvents.push(createAuditEvent({
      taskId: task.id,
      eventType: "evidence_attached",
      status: task.status,
      safeMessage: `证据已关联：${item.label}`,
      sourceRefs: [item.id],
    }));
  }
}

function evidenceFromToolResult(
  result: AssistantToolExecutionResult<unknown>,
  agentName: AssistantAgentName,
): AssistantEvidenceReference[] {
  return result.sources.slice(0, 10).map((source) => ({
    id: `evidence-${hashText(`${source.title}|${source.source}|${source.url}`)}`,
    type: evidenceTypeForSource(source, result.name),
    label: source.title,
    source: source.source,
    officialUrl: source.url.startsWith("http") ? source.url : undefined,
    recordId: source.url.startsWith("/") ? source.url : undefined,
    fetchedAt: new Date().toISOString(),
    cached: /cache|pool|local/i.test(source.source),
    realtime: /official|codeforces/i.test(source.source) && !/cache|pool|local/i.test(source.source),
    safeSummary: `${formatToolDisplayName(result.name)}：${result.summary}`.slice(0, 650),
    usedByAgentNames: [agentName],
  }));
}

function evidenceTypeForSource(source: AssistantSource, toolName: AssistantToolName): AssistantEvidenceReference["type"] {
  const normalized = `${source.source} ${source.title}`.toLowerCase();
  if (toolName === "getUpcomingCodeforcesContests") {
    return normalized.includes("cache") ? "cached_contest_list" : "codeforces_contest_list";
  }
  if (toolName === "getPersonalizedCodeforcesCandidates") {
    return "local_curated_problem_pool";
  }
  if (toolName === "resolveLearnerTrainingProfile") {
    return normalized.includes("learning") ? "learning_report" : "codeforces_account_snapshot";
  }
  return "assistant_task";
}

async function generateModelFinalAnswer(input: {
  userId: string;
  profile: LearnerTrainingProfile | null;
  candidates: readonly PersonalizedCodeforcesCandidate[];
  contests: readonly UpcomingCodeforcesContest[];
  failedAgents: readonly AssistantTaskAgentRunRecord[];
  shouldRefreshReportsFirst: boolean;
  customFetch?: ExternalProviderFetch;
  guardEnv?: Record<string, string | undefined>;
  signal: AbortSignal;
}): Promise<{ answer: string | null; providerResolved: boolean }> {
  const providerEnv = input.guardEnv ?? createAssistantProviderEnvSnapshot();
  const guard = evaluateWebAiQaGuard(providerEnv);
  if (!guard.allowed) {
    return { answer: null, providerResolved: false };
  }

  const provider = await resolveUserModelLlmProvider({
    userId: input.userId,
    customFetch: input.customFetch,
  });
  if (!provider) {
    return { answer: null, providerResolved: false };
  }

  const messages = [
    {
      role: LlmChatRole.System,
      content: [
        "你是编程学习平台的中文学习助手。",
        "必须使用中文回答，允许保留 Codeforces、Rating、URL、题目英文名和模型名称。",
        "只能基于服务端提供的只读工具结果生成自然语言，不得编造题目、比赛或用户数据。",
        "不得输出 Chain of Thought、隐藏推理、Prompt、当前上下文、raw tool input/output 或凭据。",
        "如果有长期记忆提醒，必须放在回答最前面。",
      ].join("\n"),
    },
    {
      role: LlmChatRole.User,
      content: [
        input.shouldRefreshReportsFirst
          ? "长期记忆提醒：建议用户先刷新学习分析报告和复习报告，以确保推荐依据是最新的。"
          : "长期记忆提醒：无。",
        input.profile
          ? `训练画像：官方 Rating ${input.profile.officialRating ?? "暂无"}；真实水平估计 ${input.profile.estimatedRealRating ?? "暂无"}；采用 Rating ${input.profile.effectiveTrainingRating ?? "暂无"}；区间 ${input.profile.recommendedMinRating ?? "暂无"}-${input.profile.recommendedMaxRating ?? "暂无"}；依据 ${input.profile.evidenceSummary}`
          : "训练画像：暂无可信训练画像。",
        `候选题：${input.candidates.map((item) =>
          `${item.problemKey} ${item.name}，Rating ${item.rating}，标签 ${item.tags.join(", ")}，链接 ${item.originalUrl}，理由 ${item.recommendationReason}`,
        ).join("\n") || "无"}`,
        `近期比赛：${input.contests.map((contest) =>
          `${contest.name}，${contest.startTime}，${contest.relativeStart}，${contest.officialUrl}`,
        ).join("\n") || "无"}`,
        input.failedAgents.length > 0
          ? `缺失步骤：${input.failedAgents.map((run) => `${formatAgentDisplayName(run.agentName)}${formatRunStatus(run.status)}`).join("；")}`
          : "缺失步骤：无。",
        "请生成简洁中文最终回答，先提醒，再列出题目和比赛；不要输出内部工具调试字段。",
      ].join("\n\n"),
    },
  ];

  const result = await provider.provider.generate({
    messages,
    maxInputChars: 8000,
    maxOutputChars: 2800,
    timeoutMs: 15_000,
    purposeSummary: "A509+ 多步骤最终中文回答生成",
    signal: input.signal,
  }).catch(() => null);

  if (!result?.ok) {
    return { answer: null, providerResolved: true };
  }

  const answer = sanitizeVisibleFinalAnswer(result.answerSummary);
  return { answer: answer.length > 0 ? answer : null, providerResolved: true };
}

function createLongTermMemoryEvidence(
  userId: string,
  memoryId: string | null,
): AssistantEvidenceReference {
  return {
    id: `evidence-long-term-memory-${memoryId ?? hashText(userId)}`,
    type: "user_long_term_memory",
    label: "用户长期记忆提醒",
    source: "服务端长期记忆",
    recordId: memoryId ?? undefined,
    fetchedAt: new Date().toISOString(),
    cached: false,
    realtime: false,
    safeSummary: "已应用用户明确写入的长期记忆：推荐 Codeforces 题目或后续刷题建议前，先提醒刷新学习分析报告和复习报告。",
    usedByAgentNames: ["ResultAggregator"],
  };
}

function buildFinalAnswer(input: {
  profile: LearnerTrainingProfile | null;
  candidates: readonly PersonalizedCodeforcesCandidate[];
  contests: readonly UpcomingCodeforcesContest[];
  failedAgents: readonly AssistantTaskAgentRunRecord[];
  evidence: readonly AssistantEvidenceReference[];
  shouldRefreshReportsFirst: boolean;
  modelStatusLine?: string;
}): string {
  const lines: string[] = [];
  if (input.shouldRefreshReportsFirst) {
    lines.push("建议你先刷新学习分析报告和复习报告，以确保推荐依据是最新的。");
    lines.push("");
  }
  if (input.modelStatusLine) {
    lines.push(input.modelStatusLine);
    lines.push("");
  }
  lines.push("多步骤结果");
  if (input.profile) {
    lines.push(`学习画像：训练 Rating ${input.profile.effectiveTrainingRating ?? "暂无"}；推荐区间 ${input.profile.recommendedMinRating ?? "?"}-${input.profile.recommendedMaxRating ?? "?"}；依据：${input.profile.evidenceSummary}`);
  } else {
    lines.push("学习画像：暂时不可用，未猜测你的真实水平。");
  }

  lines.push("今日练习建议：");
  if (input.candidates.length > 0) {
    for (const item of input.candidates.slice(0, 6)) {
      lines.push(`- ${item.problemKey} ${item.name}（Rating ${item.rating}，层级：${formatCandidateLevel(item.candidateLevel)}）：${item.recommendationReason} ${item.originalUrl}`);
    }
  } else {
    lines.push("- 候选题步骤暂时没有返回可信题目。");
  }

  lines.push("近期可参加比赛：");
  if (input.contests.length > 0) {
    for (const contest of input.contests.slice(0, 3)) {
      lines.push(`- ${contest.name}：${contest.startTime}，${contest.relativeStart}，${contest.officialUrl}`);
    }
  } else {
    lines.push("- 比赛步骤暂时没有返回未来比赛；不会用历史比赛替代。");
  }

  if (input.failedAgents.length > 0) {
    lines.push(`缺失部分：${input.failedAgents.map((run) => `${formatAgentDisplayName(run.agentName)}（${formatRunStatus(run.status)}）`).join("、")}。可在时间线中单独重试失败步骤。`);
  }

  lines.push("本次回答依据：");
  if (input.evidence.length > 0) {
    for (const item of input.evidence.slice(0, 8)) {
      lines.push(`- ${item.label}｜${item.source}｜${item.cached ? "缓存/本地" : item.realtime ? "实时" : "记录"}｜${item.usedByAgentNames.map(formatAgentDisplayName).join("、")}`);
    }
  } else {
    lines.push("- 当前没有可展示证据。");
  }

  return lines.join("\n").slice(0, 4000);
}

function sanitizeVisibleFinalAnswer(value: string): string {
  return String(value ?? "")
    .replace(new RegExp(`\\b${"Evi" + "dence"}\\b`, "g"), "依据")
    .replace(new RegExp(`\\b${"Official" + " rating"}\\b`, "g"), "官方 Rating")
    .replace(new RegExp(`\\b${"Estimated" + " real rating"}\\b`, "g"), "真实水平估计")
    .replace(new RegExp(`\\b${"Adopted" + " training rating"}\\b`, "g"), "本次采用训练 Rating")
    .replace(new RegExp(`\\b${"Training" + " range"}\\b`, "g"), "推荐题目区间")
    .replace(new RegExp(`\\b${"No candidate" + " problems available"}\\b`, "g"), "未找到候选题")
    .replace(new RegExp(`\\b${"Read-only" + " context"}\\b`, "g"), "只读上下文")
    .replace(new RegExp(`\\b${"failed with" + " empty"}\\b`, "g"), "没有可用结果")
    .trim()
    .slice(0, 4000);
}

function formatCandidateLevel(level: PersonalizedCodeforcesCandidate["candidateLevel"]): string {
  switch (level) {
    case "target_range_weak_tag":
      return "目标区间且命中薄弱标签";
    case "target_range_any_tag":
      return "目标区间补足";
    case "expanded_range":
      return "放宽 Rating 区间";
    case "nearest_rating":
      return "最接近目标 Rating";
  }
}

function formatAgentDisplayName(name: string): string {
  switch (name) {
    case "Orchestrator":
      return "意图识别步骤";
    case "LearnerProfile":
      return "学习画像步骤";
    case "CandidateRecommendation":
      return "候选题步骤";
    case "UpcomingContest":
      return "近期比赛步骤";
    case "ResultAggregator":
      return "中文回答步骤";
    default:
      return "执行步骤";
  }
}

function formatToolDisplayName(name: string): string {
  switch (name) {
    case "resolveLearnerTrainingProfile":
      return "解析用户真实训练水平";
    case "getPersonalizedCodeforcesCandidates":
      return "查询个性化候选题目";
    case "getUpcomingCodeforcesContests":
      return "查询近期 Codeforces 比赛";
    case "recommend_codeforces_problems":
      return "推荐 Codeforces 题目";
    case "search_codeforces_problems":
      return "搜索 Codeforces 题目";
    case "search_technical_articles":
      return "搜索技术文章";
    case "get_hot_technical_articles":
      return "读取热门技术文章";
    default:
      return name;
  }
}

function formatRunStatus(status: AssistantAgentRunStatus): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "运行中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    case "timed_out":
      return "已超时";
    case "skipped":
      return "已跳过";
  }
}

function latestOutput<T>(
  task: AssistantMultiAgentTaskRecord,
  agentName: AssistantAgentName,
  key: string,
): T | null {
  const run = latestRun(task, agentName);
  if (!run || run.status !== "succeeded" || !run.safeOutputData) {
    return null;
  }
  return (run.safeOutputData as Record<string, unknown>)[key] as T ?? null;
}

function latestRuns(task: AssistantMultiAgentTaskRecord): AssistantTaskAgentRunRecord[] {
  const latest = new Map<AssistantAgentName, AssistantTaskAgentRunRecord>();
  for (const run of task.agentRuns) {
    const current = latest.get(run.agentName);
    if (!current || run.attempt > current.attempt || (run.attempt === current.attempt && run.queuedAt > current.queuedAt)) {
      latest.set(run.agentName, run);
    }
  }
  return A509_AGENT_NAMES.map((name) => latest.get(name)).filter((run): run is AssistantTaskAgentRunRecord => Boolean(run));
}

function latestRun(task: AssistantMultiAgentTaskRecord, agentName: AssistantAgentName): AssistantTaskAgentRunRecord | null {
  return latestRuns(task).find((run) => run.agentName === agentName) ?? null;
}

function nextAttemptForAgent(task: AssistantMultiAgentTaskRecord, agentName: AssistantAgentName): number {
  const attempts = task.agentRuns.filter((run) => run.agentName === agentName).map((run) => run.attempt);
  return attempts.length > 0 ? Math.max(...attempts) + 1 : 1;
}

function requireRun(task: AssistantMultiAgentTaskRecord, runId: string): AssistantTaskAgentRunRecord {
  const run = task.agentRuns.find((item) => item.id === runId);
  if (!run) {
    throw new Error("AgentRun not found");
  }
  return run;
}

function safeInputForAgent(task: AssistantMultiAgentTaskRecord, agentName: AssistantAgentName): string {
  if (agentName === "Orchestrator") {
    return `用户请求：${task.userVisibleRequest}`;
  }
  if (agentName === "LearnerProfile") {
    return "读取当前用户学习画像、长期记忆中的学习报告和 Codeforces 账号快照。";
  }
  if (agentName === "CandidateRecommendation") {
    return "基于学习画像从本地精选 Codeforces 题池读取候选题。";
  }
  if (agentName === "UpcomingContest") {
    return "读取 Codeforces 官方未来 contest.list 或短期缓存。";
  }
  return "聚合已完成步骤的结构化输出，不读取内部上下文或隐藏 prompt。";
}

function agentRole(agentName: AssistantAgentName): string {
  switch (agentName) {
    case "Orchestrator":
      return "拆分任务、建立依赖和安全边界";
    case "LearnerProfile":
      return "解析可信学习画像和训练 Rating";
    case "CandidateRecommendation":
      return "读取本地精选题池并生成练习候选";
    case "UpcomingContest":
      return "读取未来 Codeforces 比赛";
    case "ResultAggregator":
      return "聚合可用结果并生成最终回答";
  }
}

function resolveServerAllowedStabilityMode(
  mode: AssistantStabilityInjectionMode | undefined,
  env?: Record<string, string | undefined>,
): AssistantStabilityInjectionMode {
  if (!isAssistantStabilityTestModeEnabled(env)) {
    return "normal";
  }
  return mode === "fail_upcoming_once"
    || mode === "timeout_candidate_once"
    || mode === "delay_task_for_cancel"
    || mode === "tool_empty_once"
    || mode === "tool_internal_error_once"
    || mode === "tool_timeout_once"
    || mode === "tool_cancel_once"
    || mode === "tool_permission_denied_once"
    || mode === "tool_large_result_once"
    || mode === "tool_unknown_once"
    || mode === "tool_duplicate_once"
    || mode === "agent_loop_max_turns"
    || mode === "agent_loop_max_tool_calls"
    || mode === "tool_calling_unsupported"
    || mode === "context_compression_failure"
    ? mode
    : "normal";
}

function sourceKey(source: AssistantSource): string {
  return `${source.source}|${source.url}|${source.title}`.slice(0, 240);
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("ABORTED"));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(signal.reason ?? new Error("ABORTED"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function throwIfSignalAborted(signal: AbortSignal): void {
  if (!signal.aborted) {
    return;
  }
  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }
  throw new Error("TASK_ABORTED");
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && /abort|cancel|timeout/i.test(error.message);
}

function getRunningTaskMap(): Map<string, RunningTaskControl> {
  const globalRuntime = globalThis as typeof globalThis & {
    __lapA509RunningTasks?: Map<string, RunningTaskControl>;
  };
  if (!globalRuntime.__lapA509RunningTasks) {
    globalRuntime.__lapA509RunningTasks = new Map();
  }
  return globalRuntime.__lapA509RunningTasks;
}

function getRunningAgentRetrySet(): Set<string> {
  const globalRuntime = globalThis as typeof globalThis & {
    __lapA509RunningAgentRetries?: Set<string>;
  };
  if (!globalRuntime.__lapA509RunningAgentRetries) {
    globalRuntime.__lapA509RunningAgentRetries = new Set();
  }
  return globalRuntime.__lapA509RunningAgentRetries;
}
