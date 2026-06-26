// ============================================================
// Agent Runtime v1 — Core Agent Types
// ============================================================
// This module defines the unified contract for all future agents.
// All types are explicit and do not rely on scattered globals.

// -----------------------------------------------------------
// Agent Identity
// -----------------------------------------------------------

/** Unique identifier for an agent instance. */
export type AgentId = string;

/**
 * Enumerated agent roles in the system.
 */
export type AgentRole =
  | "orchestrator"
  | "cf-data-collector"
  | "cf-data-analyst"
  | "cf-report-writer"
  | "cf-problem-recommender"
  | "problem-parser"
  | "complexity-analyzer"
  | "debugger"
  | "code-optimizer"
  | "code-analyzer"
  | "content-collector"
  | "content-summarizer";

export type RunId = string;
export type TaskId = string;
export type ConversationId = string;

// -----------------------------------------------------------
// Agent Task
// -----------------------------------------------------------

export const AgentTaskStatus = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
  Blocked: "blocked",
} as const;

export type AgentTaskStatus =
  (typeof AgentTaskStatus)[keyof typeof AgentTaskStatus];

export const AgentTaskPriority = {
  Low: 1,
  Normal: 2,
  High: 3,
  Critical: 4,
} as const;

export type AgentTaskPriority = number;

export interface AgentTaskFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AgentTaskInput {
  readonly intent: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly conversationId?: ConversationId;
}

export interface AgentTask {
  readonly taskId: TaskId;
  readonly parentTaskId?: TaskId;
  readonly runId: RunId;
  readonly agentId: AgentId;
  readonly intent: string;
  readonly input: AgentTaskInput;
  readonly status: AgentTaskStatus;
  readonly priority: AgentTaskPriority;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly dependencies: readonly TaskId[];
  readonly failure?: AgentTaskFailure;
}

// -----------------------------------------------------------
// Agent Execution State
// -----------------------------------------------------------

export const AgentExecutionStatus = {
  Idle: "idle",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export type AgentExecutionStatus =
  (typeof AgentExecutionStatus)[keyof typeof AgentExecutionStatus];

export interface AgentSharedContext {
  readonly entries: Readonly<Record<string, unknown>>;
}

export interface AgentPrivateContext {
  readonly agentId: AgentId;
  readonly entries: Readonly<Record<string, unknown>>;
}

export interface AgentToolCallSummary {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly agentId: AgentId;
  readonly taskId?: TaskId;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
}

export interface AgentUsageSnapshot {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly reasoningTokens: number;
  readonly toolCalls: number;
  readonly estimatedCost?: number;
  readonly currency: string;
}

export interface AgentCancellationState {
  readonly cancelled: boolean;
  readonly reason?: string;
  readonly cancelledAt?: string;
}

export interface AgentExecutionState {
  readonly runId: RunId;
  readonly conversationId?: ConversationId;
  readonly userId?: string;
  readonly activeAgentId?: AgentId;
  readonly turnCount: number;
  readonly status: AgentExecutionStatus;
  readonly pendingTasks: readonly AgentTask[];
  readonly runningTasks: readonly AgentTask[];
  readonly completedTasks: readonly AgentTask[];
  readonly failedTasks: readonly AgentTask[];
  readonly sharedContext: AgentSharedContext;
  readonly privateAgentContexts: Readonly<Record<AgentId, AgentPrivateContext>>;
  readonly toolCalls: readonly AgentToolCallSummary[];
  readonly usage: AgentUsageSnapshot;
  readonly cancellation: AgentCancellationState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// -----------------------------------------------------------
// State Factory
// -----------------------------------------------------------

export function createInitialAgentExecutionState(params: {
  readonly runId: RunId;
  readonly conversationId?: ConversationId;
  readonly userId?: string;
}): AgentExecutionState {
  const now = new Date().toISOString();
  return {
    runId: params.runId,
    conversationId: params.conversationId,
    userId: params.userId,
    activeAgentId: undefined,
    turnCount: 0,
    status: AgentExecutionStatus.Idle,
    pendingTasks: [],
    runningTasks: [],
    completedTasks: [],
    failedTasks: [],
    sharedContext: { entries: {} },
    privateAgentContexts: {},
    toolCalls: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      toolCalls: 0,
      estimatedCost: undefined,
      currency: "USD",
    },
    cancellation: { cancelled: false },
    createdAt: now,
    updatedAt: now,
  };
}

// -----------------------------------------------------------
// Immutable State Transitions
// -----------------------------------------------------------

function patchState(
  state: AgentExecutionState,
  patch: Partial<AgentExecutionState>,
): AgentExecutionState {
  return {
    ...state,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function transitionToRunning(
  state: AgentExecutionState,
  activeAgentId?: AgentId,
): AgentExecutionState {
  if (state.status !== AgentExecutionStatus.Idle) {
    throw new Error(
      `Cannot transition to running from status "${state.status}". Must be idle.`,
    );
  }
  return patchState(state, {
    status: AgentExecutionStatus.Running,
    activeAgentId: activeAgentId ?? state.activeAgentId,
  });
}

export function transitionToCompleted(
  state: AgentExecutionState,
): AgentExecutionState {
  if (state.status !== AgentExecutionStatus.Running) {
    throw new Error(
      `Cannot transition to completed from status "${state.status}". Must be running.`,
    );
  }
  if (state.runningTasks.length > 0) {
    throw new Error(
      "Cannot transition to completed while tasks are still running.",
    );
  }
  return patchState(state, { status: AgentExecutionStatus.Completed });
}

export function transitionToFailed(
  state: AgentExecutionState,
): AgentExecutionState {
  if (state.status !== AgentExecutionStatus.Running) {
    throw new Error(
      `Cannot transition to failed from status "${state.status}". Must be running.`,
    );
  }
  return patchState(state, { status: AgentExecutionStatus.Failed });
}

export function transitionToCancelled(
  state: AgentExecutionState,
  reason?: string,
): AgentExecutionState {
  const allowed: AgentExecutionStatus[] = [
    AgentExecutionStatus.Idle,
    AgentExecutionStatus.Running,
    AgentExecutionStatus.Failed,
  ];
  if (!allowed.includes(state.status)) {
    throw new Error(
      `Cannot transition to cancelled from status "${state.status}".`,
    );
  }
  return patchState(state, {
    status: AgentExecutionStatus.Cancelled,
    cancellation: {
      cancelled: true,
      reason,
      cancelledAt: new Date().toISOString(),
    },
  });
}

// -----------------------------------------------------------
// Task Operations (immutable)
// -----------------------------------------------------------

export function addTask(
  state: AgentExecutionState,
  task: AgentTask,
): AgentExecutionState {
  const pending = state.pendingTasks as AgentTask[];
  if (pending.some((t) => t.taskId === task.taskId)) {
    throw new Error(`Task "${task.taskId}" already exists.`);
  }
  return patchState(state, {
    pendingTasks: [...pending, task],
  });
}

export function startTask(
  state: AgentExecutionState,
  taskId: TaskId,
): AgentExecutionState {
  const pending = state.pendingTasks as AgentTask[];
  const idx = pending.findIndex((t) => t.taskId === taskId);
  if (idx === -1) {
    throw new Error(`Task "${taskId}" not found in pending tasks.`);
  }
  const task = pending[idx]!;
  const startedTask: AgentTask = {
    ...task,
    status: AgentTaskStatus.Running,
    startedAt: new Date().toISOString(),
  };
  return patchState(state, {
    pendingTasks: [
      ...pending.slice(0, idx),
      ...pending.slice(idx + 1),
    ],
    runningTasks: [...state.runningTasks, startedTask],
  });
}

export function completeTask(
  state: AgentExecutionState,
  taskId: TaskId,
): AgentExecutionState {
  const running = state.runningTasks as AgentTask[];
  const idx = running.findIndex((t) => t.taskId === taskId);
  if (idx === -1) {
    throw new Error(`Task "${taskId}" not found in running tasks.`);
  }
  const task = running[idx]!;
  const completedTask: AgentTask = {
    ...task,
    status: AgentTaskStatus.Completed,
    completedAt: new Date().toISOString(),
  };
  return patchState(state, {
    runningTasks: [
      ...running.slice(0, idx),
      ...running.slice(idx + 1),
    ],
    completedTasks: [...state.completedTasks, completedTask],
  });
}

export function failTask(
  state: AgentExecutionState,
  taskId: TaskId,
  failure: AgentTaskFailure,
): AgentExecutionState {
  const running = state.runningTasks as AgentTask[];
  const runningIdx = running.findIndex((t) => t.taskId === taskId);
  if (runningIdx !== -1) {
    const task = running[runningIdx]!;
    const failedTask: AgentTask = {
      ...task,
      status: AgentTaskStatus.Failed,
      completedAt: new Date().toISOString(),
      failure,
    };
    return patchState(state, {
      runningTasks: [
        ...running.slice(0, runningIdx),
        ...running.slice(runningIdx + 1),
      ],
      failedTasks: [...state.failedTasks, failedTask],
    });
  }
  const pending = state.pendingTasks as AgentTask[];
  const pendingIdx = pending.findIndex((t) => t.taskId === taskId);
  if (pendingIdx !== -1) {
    const task = pending[pendingIdx]!;
    const failedTask: AgentTask = {
      ...task,
      status: AgentTaskStatus.Failed,
      completedAt: new Date().toISOString(),
      failure,
    };
    return patchState(state, {
      pendingTasks: [
        ...pending.slice(0, pendingIdx),
        ...pending.slice(pendingIdx + 1),
      ],
      failedTasks: [...state.failedTasks, failedTask],
    });
  }
  throw new Error(
    `Task "${taskId}" not found in pending or running tasks.`,
  );
}

export function incrementTurn(
  state: AgentExecutionState,
): AgentExecutionState {
  return patchState(state, { turnCount: state.turnCount + 1 });
}

export function setActiveAgent(
  state: AgentExecutionState,
  agentId: AgentId,
): AgentExecutionState {
  return patchState(state, { activeAgentId: agentId });
}

export function updateSharedContext(
  state: AgentExecutionState,
  entries: Readonly<Record<string, unknown>>,
): AgentExecutionState {
  return patchState(state, {
    sharedContext: {
      entries: { ...state.sharedContext.entries, ...entries },
    },
  });
}

export function updatePrivateAgentContext(
  state: AgentExecutionState,
  agentId: AgentId,
  entries: Readonly<Record<string, unknown>>,
): AgentExecutionState {
  const existing = state.privateAgentContexts[agentId];
  return patchState(state, {
    privateAgentContexts: {
      ...state.privateAgentContexts,
      [agentId]: {
        agentId,
        entries: { ...(existing?.entries ?? {}), ...entries },
      },
    },
  });
}

export function recordToolCall(
  state: AgentExecutionState,
  summary: AgentToolCallSummary,
): AgentExecutionState {
  const updatedUsage: AgentUsageSnapshot = {
    ...state.usage,
    toolCalls: state.usage.toolCalls + 1,
  };
  return patchState(state, {
    toolCalls: [...state.toolCalls, summary],
    usage: updatedUsage,
  });
}

export function accumulateUsage(
  state: AgentExecutionState,
  delta: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly cachedInputTokens?: number;
    readonly reasoningTokens?: number;
    readonly estimatedCost?: number;
  },
): AgentExecutionState {
  const usage = state.usage;
  let newEstimatedCost = usage.estimatedCost;
  if (delta.estimatedCost !== undefined) {
    newEstimatedCost = (usage.estimatedCost ?? 0) + delta.estimatedCost;
  }
  return patchState(state, {
    usage: {
      ...usage,
      inputTokens: usage.inputTokens + (delta.inputTokens ?? 0),
      outputTokens: usage.outputTokens + (delta.outputTokens ?? 0),
      cachedInputTokens: usage.cachedInputTokens + (delta.cachedInputTokens ?? 0),
      reasoningTokens: usage.reasoningTokens + (delta.reasoningTokens ?? 0),
      estimatedCost: newEstimatedCost,
    },
  });
}
