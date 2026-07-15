"use server";

import { randomUUID } from "node:crypto";

import {
  CompressionReason,
  DEFAULT_A505_CONTEXT_WINDOW_TOKENS,
  isExplicitCompressionCommand,
  shouldAutoCompress,
  type ConversationCompressionState,
} from "@learning-agent-platform/ai-core/memory";
import { readAssistantSession } from "./assistant-session.ts";
import { resolveAssistantIntent } from "./assistant-intent-resolver.ts";
import { runAssistantOrchestrator } from "./assistant-orchestrator.ts";
import {
  cancelAssistantMultiAgentTask,
  createAndStartAssistantMultiAgentTask,
  isAssistantStabilityTestModeEnabled,
  listAssistantTasksForConversation,
  retryAssistantAgentTask,
  retryAssistantWholeTask,
} from "./assistant-multi-agent-runtime.ts";
import {
  addAssistantMemory,
  deleteAssistantMemory,
  deleteAssistantMemoriesForConversation,
  listAssistantLongTermMemories,
  listAssistantMemories,
  markAssistantMemoryConsolidationSkippedForExplicitWrite,
  persistAssistantMemoryTurn,
  queueAssistantMemoryConsolidationAfterTurn,
  toggleAssistantMemoryEnabled,
  upsertExplicitAssistantLongTermMemory,
  updateAssistantMemoriesForConversationLifecycle,
} from "./memory-service.ts";
import {
  buildAssistantLearningContext,
  createEmptyAssistantLearningContext,
} from "./user-learning-context.ts";
import {
  AssistantConversationRepositoryError,
  createDefaultAssistantConversationRepository,
  resolveA505ContextWindowTokens,
  type CompressionTrigger,
} from "./assistant-conversation-repository.ts";
import type {
  AssistantChatMessage,
  AssistantCompressionRecordView,
  AssistantConversationListItem,
  AssistantContextCompressionView,
  AssistantMemoryInput,
  AssistantMemoryRecord,
  AssistantMultiAgentTaskView,
  AssistantRequestInput,
  AssistantResponse,
  AssistantStabilityInjectionMode,
  AssistantStructuredCompressionSummary,
} from "./assistant-types.ts";

type AssistantConversationActionResult =
  | {
      ok: true;
      conversation: {
        conversationId: string;
        messages: AssistantChatMessage[];
        tasks?: readonly AssistantMultiAgentTaskView[];
      };
      contextCompression: AssistantContextCompressionView;
      compressionEvent: AssistantCompressionRecordView | null;
      tasks: AssistantMultiAgentTaskView[];
    }
  | {
      ok: false;
      error: string;
    };

type AssistantTaskActionResult =
  | { ok: true; task: AssistantMultiAgentTaskView }
  | { ok: false; error: string };

type AssistantTaskListActionResult =
  | { ok: true; tasks: AssistantMultiAgentTaskView[] }
  | { ok: false; error: string };

type AssistantConversationListActionResult =
  | {
      ok: true;
      active: AssistantConversationListItem[];
      archived: AssistantConversationListItem[];
    }
  | {
      ok: false;
      error: string;
    };

export async function runAssistantAction(
  input: AssistantRequestInput,
  _options?: {
    guardEnv?: Record<string, string | undefined>;
    customFetch?: typeof fetch;
  },
): Promise<AssistantResponse> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return createA505SessionRequiredResponse(input);
  }

  const question = normalizeQuestion(input.question);
  if (question.length === 0) {
    return createA505ErrorResponse(input, "问题不能为空。", "question_empty");
  }

  const contextWindow = await resolveAssistantContextWindowTokens(session.userId);
  const repository = createDefaultAssistantConversationRepository();

  try {
    let state = await repository.getOrCreateConversation({
      userId: session.userId,
      conversationId: input.conversation?.conversationId ?? null,
      contextWindowTokens: contextWindow.tokens,
    });

    const resolvedIntent = resolveAssistantIntent(question);

    if (resolvedIntent.type === "MEMORY_WRITE") {
      state = await repository.appendMessage({
        userId: session.userId,
        conversationId: state.session.id,
        role: "user",
        visibleContent: question,
        contextWindowTokens: contextWindow.tokens,
      });
      const userMessageId = latestUserMessageId(toConversationSnapshot(state).messages);
      try {
        await upsertExplicitAssistantLongTermMemory({
          userId: session.userId,
          content: resolvedIntent.normalizedMemory,
          sourceConversationId: state.session.id,
          sourceMessageId: userMessageId,
          sourceExcerpt: question,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "长期记忆写入失败。";
        state = await repository.appendMessage({
          userId: session.userId,
          conversationId: state.session.id,
          role: "assistant",
          visibleContent: message,
          contextWindowTokens: contextWindow.tokens,
        });
        return attachConversationStateToResponse({
          response: createA509MemoryResponse({
            input,
            message,
            ok: false,
            timelineStatus: "failed",
            sourceConversationId: state.session.id,
          }),
          state,
          contextWindowSource: contextWindow.source,
          compressionEvent: null,
        });
      }

      state = await repository.appendMessage({
        userId: session.userId,
        conversationId: state.session.id,
        role: "assistant",
        visibleContent: resolvedIntent.confirmationText,
        contextWindowTokens: contextWindow.tokens,
      });
      await markAssistantMemoryConsolidationSkippedForExplicitWrite({
        userId: session.userId,
        conversationId: state.session.id,
        sourceMessageId: userMessageId,
        conversationRepository: repository,
      });

      return attachConversationStateToResponse({
        response: createA509MemoryResponse({
          input,
          message: resolvedIntent.confirmationText,
          ok: true,
          timelineStatus: "completed",
          sourceConversationId: state.session.id,
        }),
        state,
        contextWindowSource: contextWindow.source,
        compressionEvent: null,
      });
    }

    if (resolvedIntent.type === "MEMORY_READ") {
      state = await repository.appendMessage({
        userId: session.userId,
        conversationId: state.session.id,
        role: "user",
        visibleContent: question,
        contextWindowTokens: contextWindow.tokens,
      });
      const memories = await listAssistantLongTermMemories(session.userId);
      const answer = memories.length > 0
        ? [
            `我当前记得 ${memories.length} 条长期记忆：`,
            ...memories.slice(0, 8).map((memory, index) => `${index + 1}. ${memory.content}`),
          ].join("\n")
        : "当前没有可用的长期记忆。";
      state = await repository.appendMessage({
        userId: session.userId,
        conversationId: state.session.id,
        role: "assistant",
        visibleContent: answer,
        contextWindowTokens: contextWindow.tokens,
      });
      return attachConversationStateToResponse({
        response: createA509MemoryReadResponse({ input, message: answer }),
        state,
        contextWindowSource: contextWindow.source,
        compressionEvent: null,
      });
    }

    if (resolvedIntent.type === "CODEFORCES" && resolvedIntent.codeforcesIntent === "training_plan") {
      const serverLearningContext = await buildAssistantLearningContext({
        userId: session.userId,
        displayName: session.displayName ?? undefined,
      }).catch(() => createEmptyAssistantLearningContext(session.displayName ?? null, session.hasSession));
      const taskResult = await createAndStartAssistantMultiAgentTask({
        userId: session.userId,
        conversationId: state.session.id,
        requestId: normalizeRequestId(input.requestId),
        question,
        pageContext: input.pageContext,
        learningContext: serverLearningContext,
        stabilityInjectionMode: input.stabilityInjectionMode,
        guardEnv: _options?.guardEnv,
        customFetch: _options?.customFetch,
      });

      if (taskResult.created) {
        state = await repository.appendMessage({
          userId: session.userId,
          conversationId: state.session.id,
          role: "user",
          visibleContent: question,
          contextWindowTokens: contextWindow.tokens,
        });
      }

      const tasks = await listAssistantTasksForConversation({
        userId: session.userId,
        conversationId: state.session.id,
      });
      return createA509TaskResponse({
        input,
        state,
        contextWindowSource: contextWindow.source,
        task: taskResult.task,
        tasks,
        created: taskResult.created,
      });
    }

    state = await repository.appendMessage({
      userId: session.userId,
      conversationId: state.session.id,
      role: "user",
      visibleContent: question,
      contextWindowTokens: contextWindow.tokens,
    });

    let compressionEvent: AssistantCompressionRecordView | null = null;
    if (isExplicitCompressionCommand(question)) {
      state = await runCompressionAndAppendEvent({
        repository,
        userId: session.userId,
        conversationId: state.session.id,
        reason: CompressionReason.UserRequested,
        trigger: "conversation_command",
        contextWindowTokens: contextWindow.tokens,
      });
      compressionEvent = toCompressionView(latestCompression(state));
      return createA505OkResponse({
        input,
        state,
        contextWindowSource: contextWindow.source,
        message: "已根据用户请求压缩当前上下文。",
        providerMode: "unavailable",
        compressionEvent,
      });
    }

    if (shouldAutoCompress(state.activeContext.budgetResult)) {
      try {
        state = await runCompressionAndAppendEvent({
          repository,
          userId: session.userId,
          conversationId: state.session.id,
          reason: CompressionReason.ContextBudget,
          trigger: "auto_budget",
          contextWindowTokens: contextWindow.tokens,
        });
        compressionEvent = toCompressionView(latestCompression(state));
      } catch (error: unknown) {
        if (
          !(error instanceof AssistantConversationRepositoryError)
          || error.code !== "not_enough_messages"
        ) {
          throw error;
        }
      }
    }

    const serverLearningContext = await buildAssistantLearningContext({
      userId: session.userId,
      displayName: session.displayName ?? undefined,
    }).catch(() => createEmptyAssistantLearningContext(session.displayName ?? null, session.hasSession));

    const orchestratorResponse = await runAssistantOrchestrator(
      {
        ...input,
        question,
        userId: session.userId,
        learningContext: serverLearningContext,
        conversation: toConversationSnapshotForPrompt(state),
      },
      {
        guardEnv: _options?.guardEnv,
        customFetch: _options?.customFetch,
        stabilityInjectionMode: input.stabilityInjectionMode,
      },
    );
    const assistantText = orchestratorResponse.message;

    state = await repository.appendMessage({
      userId: session.userId,
      conversationId: state.session.id,
      role: "assistant",
      visibleContent: assistantText,
      contextWindowTokens: contextWindow.tokens,
    });

    const conversationSnapshot = toConversationSnapshot(state);
    await persistAssistantMemoryTurn({
      userId: session.userId,
      conversation: conversationSnapshot,
      question,
      answer: assistantText,
      pageContext: input.pageContext,
    });
    void queueAssistantMemoryConsolidationAfterTurn({
      userId: session.userId,
      conversation: conversationSnapshot,
      conversationRepository: repository,
      customFetch: _options?.customFetch,
      env: _options?.guardEnv,
    });

    return attachConversationStateToResponse({
      response: orchestratorResponse,
      state,
      contextWindowSource: contextWindow.source,
      compressionEvent,
    });
  } catch (error: unknown) {
    return createA505ErrorResponse(
      input,
      error instanceof AssistantConversationRepositoryError
        ? error.message
        : "AI 助手会话处理失败。",
      error instanceof AssistantConversationRepositoryError
        ? error.code
        : "a505_conversation_failed",
    );
  }
}

export async function loadAssistantConversationAction(
  conversationId?: string | null,
): Promise<AssistantConversationActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再使用服务端会话压缩。" };
  }

  try {
    const contextWindow = await resolveAssistantContextWindowTokens(session.userId);
    const state = await createDefaultAssistantConversationRepository()
      .getOrCreateConversation({
        userId: session.userId,
        conversationId: conversationId ?? null,
        contextWindowTokens: contextWindow.tokens,
      });

    const tasks = await listAssistantTasksForConversation({ userId: session.userId, conversationId: state.session.id });
    return {
      ok: true,
      conversation: { ...toConversationSnapshot(state), tasks },
      contextCompression: toContextCompressionView(state, contextWindow.source),
      compressionEvent: null,
      tasks,
    };
  } catch {
    return { ok: false, error: "读取 AI 助手会话失败。" };
  }
}

export async function createAssistantConversationAction(): Promise<AssistantConversationActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再创建会话。" };
  }

  try {
    const contextWindow = await resolveAssistantContextWindowTokens(session.userId);
    const state = await createDefaultAssistantConversationRepository()
      .createConversation({
        userId: session.userId,
        contextWindowTokens: contextWindow.tokens,
      });
    return {
      ok: true,
      conversation: toConversationSnapshot(state),
      contextCompression: toContextCompressionView(state, contextWindow.source),
      compressionEvent: null,
      tasks: [],
    };
  } catch {
    return { ok: false, error: "创建 AI 助手会话失败。" };
  }
}

export async function listAssistantConversationsAction(): Promise<AssistantConversationListActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再读取会话列表。" };
  }

  try {
    const repository = createDefaultAssistantConversationRepository();
    const [active, archived, memories] = await Promise.all([
      repository.listConversations({ userId: session.userId, status: "active" }),
      repository.listConversations({ userId: session.userId, status: "archived" }),
      listAssistantLongTermMemories(session.userId),
    ]);
    const counts = countLongTermMemoriesByConversation(memories);
    return {
      ok: true,
      active: active.map((item) => ({ ...item, longTermMemoryCount: counts.get(item.id) ?? 0 })),
      archived: archived.map((item) => ({ ...item, longTermMemoryCount: counts.get(item.id) ?? 0 })),
    };
  } catch {
    return { ok: false, error: "读取 AI 助手会话列表失败。" };
  }
}

export async function renameAssistantConversationAction(input: {
  conversationId: string;
  title: string;
}): Promise<{ ok: true; item: AssistantConversationListItem } | { ok: false; error: string }> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再重命名会话。" };
  }

  try {
    const item = await createDefaultAssistantConversationRepository()
      .renameConversation({
        userId: session.userId,
        conversationId: input.conversationId,
        title: input.title,
      });
    return { ok: true, item };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof AssistantConversationRepositoryError
        ? error.message
        : "重命名会话失败。",
    };
  }
}

export async function archiveAssistantConversationAction(input: {
  conversationId: string;
}): Promise<{ ok: true; item: AssistantConversationListItem } | { ok: false; error: string }> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再归档会话。" };
  }

  try {
    const item = await createDefaultAssistantConversationRepository()
      .archiveConversation({
        userId: session.userId,
        conversationId: input.conversationId,
      });
    await updateAssistantMemoriesForConversationLifecycle({
      userId: session.userId,
      conversationId: input.conversationId,
      lifecycleStatus: "archived",
    });
    return { ok: true, item };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof AssistantConversationRepositoryError
        ? error.message
        : "归档会话失败。",
    };
  }
}

export async function restoreAssistantConversationAction(input: {
  conversationId: string;
}): Promise<{ ok: true; item: AssistantConversationListItem } | { ok: false; error: string }> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再恢复会话。" };
  }

  try {
    const item = await createDefaultAssistantConversationRepository()
      .restoreConversation({
        userId: session.userId,
        conversationId: input.conversationId,
      });
    await updateAssistantMemoriesForConversationLifecycle({
      userId: session.userId,
      conversationId: input.conversationId,
      lifecycleStatus: "active",
    });
    return { ok: true, item };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof AssistantConversationRepositoryError
        ? error.message
        : "恢复会话失败。",
    };
  }
}

export async function deleteAssistantConversationAction(input: {
  conversationId: string;
}): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再删除会话。" };
  }

  try {
    const deleted = await createDefaultAssistantConversationRepository()
      .deleteConversation({
        userId: session.userId,
        conversationId: input.conversationId,
      });
    if (deleted) {
      await deleteAssistantMemoriesForConversation({
        userId: session.userId,
        conversationId: input.conversationId,
      });
    }
    return { ok: true, deleted };
  } catch {
    return { ok: false, error: "删除会话失败。" };
  }
}

export async function compressAssistantConversationAction(input: {
  conversationId: string;
}): Promise<AssistantConversationActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再压缩上下文。" };
  }

  try {
    const contextWindow = await resolveAssistantContextWindowTokens(session.userId);
    const state = await runCompressionAndAppendEvent({
      repository: createDefaultAssistantConversationRepository(),
      userId: session.userId,
      conversationId: input.conversationId,
      reason: CompressionReason.UserRequested,
      trigger: "manual_button",
      contextWindowTokens: contextWindow.tokens,
    });
    return {
      ok: true,
      conversation: toConversationSnapshot(state),
      contextCompression: toContextCompressionView(state, contextWindow.source),
      compressionEvent: toCompressionView(latestCompression(state)),
      tasks: await listAssistantTasksForConversation({ userId: session.userId, conversationId: input.conversationId }),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof AssistantConversationRepositoryError
        ? error.message
        : "压缩执行失败。",
    };
  }
}

export async function listAssistantTasksAction(input: {
  conversationId: string;
}): Promise<AssistantTaskListActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再读取任务列表。" };
  }
  try {
    return {
      ok: true,
      tasks: await listAssistantTasksForConversation({
        userId: session.userId,
        conversationId: input.conversationId,
      }),
    };
  } catch {
    return { ok: false, error: "读取多步骤任务失败。" };
  }
}

export async function cancelAssistantTaskAction(input: {
  taskId: string;
}): Promise<AssistantTaskActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再取消任务。" };
  }
  try {
    return {
      ok: true,
      task: await cancelAssistantMultiAgentTask({
        userId: session.userId,
        taskId: input.taskId,
      }),
    };
  } catch {
    return { ok: false, error: "取消任务失败。" };
  }
}

export async function retryAssistantAgentTaskAction(input: {
  taskId: string;
  agentName: AssistantMultiAgentTaskView["canRetryAgentNames"][number];
}): Promise<AssistantTaskActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再重试步骤。" };
  }
  try {
    const learningContext = await buildAssistantLearningContext({
      userId: session.userId,
      displayName: session.displayName ?? undefined,
    }).catch(() => createEmptyAssistantLearningContext(session.displayName ?? null, session.hasSession));
    return {
      ok: true,
      task: await retryAssistantAgentTask({
        userId: session.userId,
        taskId: input.taskId,
        agentName: input.agentName,
        learningContext,
      }),
    };
  } catch {
    return { ok: false, error: "重试步骤失败。" };
  }
}

export async function retryAssistantTaskAction(input: {
  taskId: string;
}): Promise<AssistantTaskActionResult> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return { ok: false, error: "请先登录开发会话后再重试任务。" };
  }
  try {
    const learningContext = await buildAssistantLearningContext({
      userId: session.userId,
      displayName: session.displayName ?? undefined,
    }).catch(() => createEmptyAssistantLearningContext(session.displayName ?? null, session.hasSession));
    return {
      ok: true,
      task: await retryAssistantWholeTask({
        userId: session.userId,
        taskId: input.taskId,
        learningContext,
      }),
    };
  } catch {
    return { ok: false, error: "重试任务失败。" };
  }
}

export async function getAssistantRuntimeConfigAction(): Promise<{
  stabilityTestModeEnabled: boolean;
  stabilityModes: AssistantStabilityInjectionMode[];
}> {
  return {
    stabilityTestModeEnabled: isAssistantStabilityTestModeEnabled(),
    stabilityModes: [
      "normal",
      "fail_upcoming_once",
      "timeout_candidate_once",
      "delay_task_for_cancel",
      "tool_empty_once",
      "tool_internal_error_once",
      "tool_timeout_once",
      "tool_cancel_once",
      "tool_permission_denied_once",
      "tool_large_result_once",
      "tool_unknown_once",
      "tool_duplicate_once",
      "agent_loop_max_turns",
      "agent_loop_max_tool_calls",
      "tool_calling_unsupported",
      "context_compression_failure",
    ],
  };
}

async function runCompressionAndAppendEvent(input: {
  repository: ReturnType<typeof createDefaultAssistantConversationRepository>;
  userId: string;
  conversationId: string;
  reason: CompressionReason;
  trigger: CompressionTrigger;
  contextWindowTokens: number;
}): Promise<ConversationCompressionState> {
  let state = await input.repository.compressConversation({
    userId: input.userId,
    conversationId: input.conversationId,
    reason: input.reason,
    trigger: input.trigger,
    contextWindowTokens: input.contextWindowTokens,
  });
  const compression = latestCompression(state);
  if (!compression) {
    return state;
  }

  state = await input.repository.appendMessage({
    userId: input.userId,
    conversationId: input.conversationId,
    role: "system",
    visibleContent: buildCompressionEventText(compression.trigger),
    contextWindowTokens: input.contextWindowTokens,
  });
  return state;
}

async function resolveAssistantContextWindowTokens(userId: string): Promise<{
  tokens: number;
  source: AssistantContextCompressionView["budget"]["contextWindowSource"];
}> {
  const modelProfileTokens = await readDefaultModelContextWindow(userId);
  if (modelProfileTokens !== null) {
    return { tokens: modelProfileTokens, source: "model_profile" };
  }

  const envTokens = resolveA505ContextWindowTokens();
  if (envTokens !== undefined) {
    return { tokens: envTokens, source: "env" };
  }

  return {
    tokens: DEFAULT_A505_CONTEXT_WINDOW_TOKENS,
    source: "development_default",
  };
}

async function readDefaultModelContextWindow(userId: string): Promise<number | null> {
  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      return null;
    }
    const repo = new db.PrismaModelProviderRepository(db.getPrismaClient());
    const profile = await repo.getDefaultProfile(userId, "CHAT");
    return profile && Number.isInteger(profile.contextWindow) && profile.contextWindow >= 512
      ? profile.contextWindow
      : null;
  } catch {
    return null;
  }
}

function createA505OkResponse(input: {
  input: AssistantRequestInput;
  state: ConversationCompressionState;
  contextWindowSource: AssistantContextCompressionView["budget"]["contextWindowSource"];
  message: string;
  providerMode: AssistantResponse["providerMode"];
  compressionEvent: AssistantCompressionRecordView | null;
}): AssistantResponse {
  return {
    state: "ok",
    message: input.message,
    actions: [],
    sources: [],
    usedTools: [],
    usedContext: {
      page: true,
      learning: false,
      memory: input.state.activeContext.latestCompression !== null,
    },
    providerMode: input.providerMode,
    safeToExposeToClient: {
      currentRoute: input.input.pageContext.route,
      pageType: input.input.pageContext.pageType,
      pageContextUsed: true,
      learningContextUsed: false,
      memoryContextUsed: input.state.activeContext.latestCompression !== null,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
    },
    blockedReasons: [],
    warnings: [
      "A505 local structured compression v1; no real LLM provider call.",
    ],
    conversation: toConversationSnapshot(input.state),
    contextCompression: toContextCompressionView(
      input.state,
      input.contextWindowSource,
    ),
    compressionEvent: input.compressionEvent,
  };
}

function createA509TaskResponse(input: {
  input: AssistantRequestInput;
  state: ConversationCompressionState;
  contextWindowSource: AssistantContextCompressionView["budget"]["contextWindowSource"];
  task: AssistantMultiAgentTaskView;
  tasks: AssistantMultiAgentTaskView[];
  created: boolean;
}): AssistantResponse {
  const conversation = toConversationSnapshot(input.state);
  return {
    state: "ok",
    message: input.created
      ? "多步骤任务已创建并开始执行。"
      : "检测到重复 requestId，已复用原多步骤任务。",
    actions: [],
    sources: [],
    usedTools: [],
    toolTimeline: [],
    usedContext: {
      page: true,
      learning: true,
      memory: false,
    },
    providerMode: "unavailable",
    safeToExposeToClient: {
      currentRoute: input.input.pageContext.route,
      pageType: input.input.pageContext.pageType,
      pageContextUsed: true,
      learningContextUsed: true,
      memoryContextUsed: false,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
    },
    blockedReasons: [],
    warnings: [
      "A509 持久化多步骤任务路径。",
      input.task.stabilityInjectionMode !== "normal" ? "开发验收注入已启用，仅限非生产环境。" : "",
    ].filter((item) => item.length > 0),
    conversation: {
      ...conversation,
      tasks: input.tasks,
    },
    tasks: input.tasks,
    contextCompression: toContextCompressionView(
      input.state,
      input.contextWindowSource,
    ),
    compressionEvent: null,
  };
}

function createA509MemoryResponse(input: {
  input: AssistantRequestInput;
  message: string;
  ok: boolean;
  timelineStatus: "completed" | "failed";
  sourceConversationId: string;
}): AssistantResponse {
  const now = new Date().toISOString();
  return {
    state: input.ok ? "ok" : "error",
    message: input.message,
    actions: [],
    sources: input.ok
      ? [{
          title: "长期记忆",
          source: "用户明确写入",
          url: `/ai#memory-${encodeURIComponent(input.sourceConversationId)}`,
        }]
      : [],
    usedTools: [],
    toolTimeline: [
      {
        status: "completed",
        toolName: "识别用户意图",
        startedAt: now,
        completedAt: now,
        dataSource: "服务端确定性规则",
        usedCache: false,
        safetySummary: "识别为长期记忆写入请求，显式记忆操作优先于 Codeforces 关键词。",
      },
      {
        status: input.timelineStatus,
        toolName: "保存长期记忆",
        startedAt: now,
        completedAt: now,
        dataSource: "服务端记忆仓库",
        usedCache: false,
        safetySummary: input.ok
          ? "长期记忆已写入当前用户空间，未调用 Codeforces 工具，未调用模型。"
          : "长期记忆写入失败，未调用 Codeforces 工具，未调用模型。",
      },
    ],
    usedContext: { page: true, learning: false, memory: true },
    providerMode: "unavailable",
    safeToExposeToClient: {
      currentRoute: input.input.pageContext.route,
      pageType: input.input.pageContext.pageType,
      pageContextUsed: true,
      learningContextUsed: false,
      memoryContextUsed: true,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
    },
    blockedReasons: input.ok ? [] : ["memory_write_failed"],
    warnings: input.ok ? ["确定性长期记忆写入，未调用真实模型。"] : [],
  };
}

function createA509MemoryReadResponse(input: {
  input: AssistantRequestInput;
  message: string;
}): AssistantResponse {
  const now = new Date().toISOString();
  return {
    state: "ok",
    message: input.message,
    actions: [],
    sources: [{
      title: "长期记忆",
      source: "服务端记忆仓库",
      url: "/ai",
    }],
    usedTools: [],
    toolTimeline: [{
      status: "completed",
      toolName: "读取长期记忆",
      startedAt: now,
      completedAt: now,
      dataSource: "服务端记忆仓库",
      usedCache: false,
      safetySummary: "只读取当前用户启用的长期记忆，不展示短期工作记忆或隐藏上下文。",
    }],
    usedContext: { page: true, learning: false, memory: true },
    providerMode: "unavailable",
    safeToExposeToClient: {
      currentRoute: input.input.pageContext.route,
      pageType: input.input.pageContext.pageType,
      pageContextUsed: true,
      learningContextUsed: false,
      memoryContextUsed: true,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
    },
    blockedReasons: [],
    warnings: ["确定性长期记忆读取，未调用真实模型。"],
  };
}

function createA505SessionRequiredResponse(input: AssistantRequestInput): AssistantResponse {
  return createA505ErrorResponse(
    input,
    "请先登录开发会话。A505 会话压缩需要可信服务端 userId，不能使用客户端伪造身份。",
    "session_required",
  );
}

function createA505ErrorResponse(
  input: AssistantRequestInput,
  message: string,
  reason: string,
): AssistantResponse {
  return {
    state: "error",
    message,
    actions: [],
    sources: [],
    usedTools: [],
    usedContext: { page: false, learning: false, memory: false },
    providerMode: "error",
    safeToExposeToClient: {
      currentRoute: input.pageContext.route,
      pageType: input.pageContext.pageType,
      pageContextUsed: false,
      learningContextUsed: false,
      memoryContextUsed: false,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
    },
    blockedReasons: [reason],
    warnings: [],
    conversation: input.conversation ?? undefined,
  };
}

function toConversationSnapshot(state: ConversationCompressionState): {
  conversationId: string;
  messages: AssistantChatMessage[];
} {
  return {
    conversationId: state.session.id,
    messages: state.messages
      .map((message): AssistantChatMessage => ({
        id: message.id,
        role: message.role,
        content: message.visibleContent,
        createdAt: message.createdAt,
        ...(message.archivedAt ? { archivedAt: message.archivedAt } : {}),
        ...(message.compressionId ? { compressionId: message.compressionId } : {}),
      })),
  };
}

function toActiveConversationSnapshot(state: ConversationCompressionState): {
  conversationId: string;
  messages: AssistantChatMessage[];
} {
  return {
    conversationId: state.session.id,
    messages: toConversationSnapshot(state).messages.filter((message) => !message.archivedAt),
  };
}

function toConversationSnapshotForPrompt(state: ConversationCompressionState): {
  conversationId: string;
  messages: AssistantChatMessage[];
} {
  const base = {
    ...toActiveConversationSnapshot(state),
    messages: toActiveConversationSnapshot(state).messages.filter((message) =>
      !isProviderFailureOrSelfDenialMessage(message),
    ),
  };
  const latestCompression = state.activeContext.latestCompression;
  if (!latestCompression) {
    return base;
  }

  return {
    conversationId: base.conversationId,
    messages: [
      {
        id: `prompt-${latestCompression.id}`,
        role: "system",
        content: [
          "已压缩的历史上下文摘要：",
          latestCompression.summaryText,
        ].join("\n"),
        createdAt: latestCompression.createdAt,
        compressionId: latestCompression.id,
      },
      ...base.messages,
    ],
  };
}

function isProviderFailureOrSelfDenialMessage(message: AssistantChatMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  const normalized = message.content.replace(/\s+/g, " ").trim().toLowerCase();
  return normalized.includes("external provider error")
    || normalized.includes("http 401")
    || normalized.includes("ai 服务暂时不可用")
    || normalized.includes("暂未接入真实 llm")
    || normalized.includes("未接入真实 llm")
    || normalized.includes("没有 llm connection");
}

function attachConversationStateToResponse(input: {
  response: AssistantResponse;
  state: ConversationCompressionState;
  contextWindowSource: AssistantContextCompressionView["budget"]["contextWindowSource"];
  compressionEvent: AssistantCompressionRecordView | null;
}): AssistantResponse {
  const conversation = toConversationSnapshot(input.state);
  return {
    ...input.response,
    conversation: {
      ...conversation,
      messages: attachResponseMetadataToLatestAssistantMessage(
        conversation.messages,
        input.response,
      ),
    },
    contextCompression: toContextCompressionView(
      input.state,
      input.contextWindowSource,
    ),
    compressionEvent: input.compressionEvent,
  };
}

function attachResponseMetadataToLatestAssistantMessage(
  messages: readonly AssistantChatMessage[],
  response: AssistantResponse,
): AssistantChatMessage[] {
  let latestAssistantIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      latestAssistantIndex = index;
      break;
    }
  }

  if (latestAssistantIndex < 0) {
    return [...messages];
  }

  return messages.map((message, index) => {
    if (index !== latestAssistantIndex) {
      return message;
    }

    return {
      ...message,
      actions: response.actions,
      sources: response.sources,
      usedTools: response.usedTools,
      toolTimeline: response.toolTimeline,
      state: response.state,
      providerMode: response.providerMode,
    };
  });
}

function toContextCompressionView(
  state: ConversationCompressionState,
  contextWindowSource: AssistantContextCompressionView["budget"]["contextWindowSource"],
): AssistantContextCompressionView {
  const activeContext = state.activeContext;
  return {
    conversationId: state.session.id,
    lastCompressedAt: state.session.lastCompressedAt,
    compressionCount: state.session.compressionCount,
    latestCompression: toCompressionView(activeContext.latestCompression),
    budget: {
      estimatedTokens: activeContext.estimatedTokens,
      contextWindowTokens: activeContext.budget.contextWindowTokens,
      effectiveInputLimit: activeContext.budgetResult.effectiveInputLimit,
      percentUsed: activeContext.budgetResult.percentUsed,
      status: activeContext.budgetResult.status,
      warningThreshold: activeContext.budgetResult.warningThreshold,
      compressionThreshold: activeContext.budgetResult.compressionThreshold,
      blockingThreshold: activeContext.budgetResult.blockingThreshold,
      tokenEstimateLabel: "估算值",
      contextWindowSource,
    },
    activeMessageCount: activeContext.activeMessages.length,
    archivedMessageCount: activeContext.excludedArchivedMessageIds.length,
    includedMessageIds: activeContext.includedMessageIds,
    excludedArchivedMessageIds: activeContext.excludedArchivedMessageIds,
  };
}

function toCompressionView(
  compression: ConversationCompressionState["compressions"][number] | null,
): AssistantCompressionRecordView | null {
  if (!compression) {
    return null;
  }

  return {
    id: compression.id,
    reason: compression.reason,
    trigger: compression.trigger,
    summary: compression.summary as AssistantStructuredCompressionSummary,
    summaryText: compression.summaryText,
    beforeEstimatedTokens: compression.beforeEstimatedTokens,
    afterEstimatedTokens: compression.afterEstimatedTokens,
    archivedMessageCount: compression.archivedMessageCount,
    retainedMessageCount: compression.retainedMessageCount,
    compressedThroughMessageId: compression.compressedThroughMessageId,
    createdAt: compression.createdAt,
    compressorKind: compression.compressorKind,
  };
}

function latestCompression(
  state: ConversationCompressionState,
): ConversationCompressionState["compressions"][number] | null {
  return [...state.compressions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0] ?? null;
}

function countLongTermMemoriesByConversation(
  memories: readonly AssistantMemoryRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    if (!memory.sourceConversationId || memory.memoryType !== "RETRIEVABLE") {
      continue;
    }
    counts.set(memory.sourceConversationId, (counts.get(memory.sourceConversationId) ?? 0) + 1);
  }
  return counts;
}

function buildCompressionEventText(trigger: CompressionTrigger): string {
  if (trigger === "auto_budget") {
    return "已因接近上下文窗口自动压缩上下文。原因：上下文预算触发。";
  }
  return "已手动压缩上下文。原因：用户手动请求。";
}

function normalizeQuestion(question: string): string {
  return String(question ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function latestUserMessageId(messages: readonly AssistantChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return message.id;
    }
  }
  return null;
}

function normalizeRequestId(value: string | null | undefined): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0
    ? normalized.slice(0, 120)
    : `server-request-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function listAssistantMemoriesAction(): Promise<AssistantMemoryRecord[]> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return [];
  }
  return listAssistantMemories(session.userId);
}

export async function listAssistantMemoryOverviewAction(): Promise<AssistantMemoryRecord[]> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return [];
  }

  return listAssistantMemories(session.userId, { includeInternal: true });
}

export async function listAssistantLongTermMemoriesAction(): Promise<AssistantMemoryRecord[]> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return [];
  }

  return listAssistantLongTermMemories(session.userId);
}

export async function addAssistantMemoryAction(
  input: AssistantMemoryInput,
): Promise<AssistantMemoryRecord> {
  const session = await readAssistantSession();
  if (!session.userId) {
    throw new Error("Session is required.");
  }
  return addAssistantMemory(session.userId, input);
}

export async function toggleAssistantMemoryEnabledAction(
  memoryId: string,
  enabled: boolean,
): Promise<AssistantMemoryRecord | null> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return null;
  }
  return toggleAssistantMemoryEnabled(session.userId, memoryId, enabled);
}

export async function deleteAssistantMemoryAction(
  memoryId: string,
): Promise<boolean> {
  const session = await readAssistantSession();
  if (!session.userId) {
    return false;
  }
  return deleteAssistantMemory(session.userId, memoryId);
}
