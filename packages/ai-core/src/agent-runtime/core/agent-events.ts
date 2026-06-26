// ============================================================
// Agent Runtime v1  --  Unified Event Protocol
// ============================================================
// All agent events share a common envelope with monotonic sequence.
// Events are typed as a discriminated union.

import type {
  AgentId,
  AgentTaskPriority,
  AgentTaskStatus,
  RunId,
  TaskId,
  AgentExecutionStatus,
  AgentTaskFailure,
} from "./agent-types.ts";

// -----------------------------------------------------------
// Event Envelope
// -----------------------------------------------------------

/** Unique identifier for each event. */
export type AgentEventId = string;

/** Monotonically increasing sequence number. */
export type AgentEventSequence = number;

/** All possible agent event types. */
export const AgentEventType = {
  // Run lifecycle
  RunStarted: "run.started",
  RunCompleted: "run.completed",
  RunFailed: "run.failed",
  RunCancelled: "run.cancelled",

  // Task lifecycle
  TaskCreated: "task.created",
  TaskStarted: "task.started",
  TaskCompleted: "task.completed",
  TaskFailed: "task.failed",

  // Agent lifecycle
  AgentStarted: "agent.started",
  AgentProgress: "agent.progress",
  AgentCompleted: "agent.completed",
  AgentFailed: "agent.failed",

  // Tool lifecycle
  ToolRequested: "tool.requested",
  ToolStarted: "tool.started",
  ToolCompleted: "tool.completed",
  ToolRejected: "tool.rejected",
  ToolFailed: "tool.failed",

  // Memory
  MemoryLoaded: "memory.loaded",
  MemoryCompacted: "memory.compacted",

  // Usage
  UsageUpdated: "usage.updated",

  // Output
  OutputDelta: "output.delta",
  OutputCompleted: "output.completed",
} as const;

export type AgentEventType =
  (typeof AgentEventType)[keyof typeof AgentEventType];

// -----------------------------------------------------------
// Common Event Base
// -----------------------------------------------------------

export interface AgentEventBase {
  readonly eventId: AgentEventId;
  readonly sequence: AgentEventSequence;
  readonly runId: RunId;
  readonly timestamp: string;
  readonly type: AgentEventType;
  readonly agentId?: AgentId;
  readonly taskId?: TaskId;
}

// -----------------------------------------------------------
// Concrete Event Payloads
// -----------------------------------------------------------

export interface RunStartedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.RunStarted;
  readonly payload: {
    readonly status: AgentExecutionStatus;
    readonly conversationId?: string;
    readonly userId?: string;
  };
}

export interface RunCompletedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.RunCompleted;
  readonly payload: {
    readonly status: AgentExecutionStatus;
    readonly summary?: string;
  };
}

export interface RunFailedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.RunFailed;
  readonly payload: {
    readonly status: AgentExecutionStatus;
    readonly errorCode: string;
    readonly errorMessage: string;
  };
}

export interface RunCancelledEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.RunCancelled;
  readonly payload: {
    readonly status: AgentExecutionStatus;
    readonly reason?: string;
  };
}

export interface TaskCreatedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.TaskCreated;
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly payload: {
    readonly intent: string;
    readonly priority: AgentTaskPriority;
  };
}

export interface TaskStartedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.TaskStarted;
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly payload: {
    readonly status: AgentTaskStatus;
  };
}

export interface TaskCompletedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.TaskCompleted;
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly payload: {
    readonly status: AgentTaskStatus;
    readonly summary?: string;
  };
}

export interface TaskFailedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.TaskFailed;
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly payload: {
    readonly status: AgentTaskStatus;
    readonly failure: AgentTaskFailure;
  };
}

export interface AgentStartedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.AgentStarted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly role: string;
  };
}

export interface AgentProgressEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.AgentProgress;
  readonly agentId: AgentId;
  readonly payload: {
    readonly message: string;
    readonly progress?: number;
  };
}

export interface AgentCompletedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.AgentCompleted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly summary?: string;
  };
}

export interface AgentFailedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.AgentFailed;
  readonly agentId: AgentId;
  readonly payload: {
    readonly errorCode: string;
    readonly errorMessage: string;
  };
}

export interface ToolRequestedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.ToolRequested;
  readonly agentId: AgentId;
  readonly payload: {
    readonly toolName: string;
    readonly inputSummary?: string;
  };
}

export interface ToolStartedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.ToolStarted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly toolCallId: string;
    readonly toolName: string;
  };
}

export interface ToolCompletedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.ToolCompleted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly status: string;
    readonly safeSummary?: string;
    readonly durationMs?: number;
  };
}

export interface ToolRejectedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.ToolRejected;
  readonly agentId: AgentId;
  readonly payload: {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly reason: string;
  };
}

export interface ToolFailedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.ToolFailed;
  readonly agentId: AgentId;
  readonly payload: {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly errorCode: string;
    readonly errorMessage: string;
  };
}

export interface MemoryLoadedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.MemoryLoaded;
  readonly agentId: AgentId;
  readonly payload: {
    readonly layer: string;
    readonly itemCount: number;
  };
}

export interface MemoryCompactedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.MemoryCompacted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly preTokenEstimate: number;
    readonly postTokenEstimate: number;
    readonly trigger: string;
  };
}

export interface UsageUpdatedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.UsageUpdated;
  readonly payload: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cachedInputTokens: number;
    readonly reasoningTokens: number;
    readonly toolCalls: number;
    readonly estimatedCost?: number;
    readonly provider?: string;
    readonly model?: string;
  };
}

export interface OutputDeltaEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.OutputDelta;
  readonly agentId: AgentId;
  readonly payload: {
    readonly text: string;
  };
}

export interface OutputCompletedEvent extends AgentEventBase {
  readonly type: typeof AgentEventType.OutputCompleted;
  readonly agentId: AgentId;
  readonly payload: {
    readonly fullText?: string;
  };
}

// -----------------------------------------------------------
// Discriminated Union
// -----------------------------------------------------------

export type AgentEvent =
  | RunStartedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent
  | TaskCreatedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | AgentStartedEvent
  | AgentProgressEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | ToolRequestedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ToolRejectedEvent
  | ToolFailedEvent
  | MemoryLoadedEvent
  | MemoryCompactedEvent
  | UsageUpdatedEvent
  | OutputDeltaEvent
  | OutputCompletedEvent;

// -----------------------------------------------------------
// Event Factory Helpers
// -----------------------------------------------------------

let _globalSequence = 0;

/** Reset the global sequence counter (for testing only). */
export function resetEventSequence(): void {
  _globalSequence = 0;
}

/** Create a unique event ID. */
export function createEventId(): AgentEventId {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Get the next monotonic sequence number. */
export function nextSequence(): AgentEventSequence {
  return ++_globalSequence;
}

/** Base fields for constructing events without duplication. */
function eventBase(
  type: AgentEventType,
  runId: RunId,
  overrides?: Partial<AgentEventBase>,
): AgentEventBase {
  return {
    eventId: createEventId(),
    sequence: nextSequence(),
    runId,
    timestamp: new Date().toISOString(),
    type,
    ...overrides,
  };
}

export function createRunStartedEvent(
  runId: RunId,
  payload: RunStartedEvent["payload"],
): RunStartedEvent {
  return {
    ...eventBase(AgentEventType.RunStarted, runId),
    type: AgentEventType.RunStarted,
    payload,
  };
}

export function createRunCompletedEvent(
  runId: RunId,
  payload: RunCompletedEvent["payload"] | {
    readonly totalSteps: number;
    readonly completedSteps: number;
    readonly result: string;
  },
): RunCompletedEvent {
  return {
    ...eventBase(AgentEventType.RunCompleted, runId),
    type: AgentEventType.RunCompleted,
    payload: "status" in payload
      ? payload
      : {
          status: "completed",
          summary: `${payload.result} (${payload.completedSteps}/${payload.totalSteps})`,
        },
  };
}

export function createRunFailedEvent(
  runId: RunId,
  payload: RunFailedEvent["payload"] | {
    readonly reason: string;
    readonly completedSteps?: number;
  },
): RunFailedEvent {
  return {
    ...eventBase(AgentEventType.RunFailed, runId),
    type: AgentEventType.RunFailed,
    payload: "status" in payload
      ? payload
      : {
          status: "failed",
          errorCode: "RUN_FAILED",
          errorMessage: payload.reason,
        },
  };
}

export function createRunCancelledEvent(
  runId: RunId,
  payload: RunCancelledEvent["payload"],
): RunCancelledEvent {
  return {
    ...eventBase(AgentEventType.RunCancelled, runId),
    type: AgentEventType.RunCancelled,
    payload,
  };
}

export function createTaskCreatedEvent(
  runId: RunId,
  agentId: AgentId,
  taskId: TaskId,
  payload: TaskCreatedEvent["payload"],
): TaskCreatedEvent {
  return {
    ...eventBase(AgentEventType.TaskCreated, runId, { agentId, taskId }),
    type: AgentEventType.TaskCreated,
    agentId,
    taskId,
    payload,
  };
}

export function createTaskStartedEvent(
  runId: RunId,
  agentId: AgentId,
  taskId: TaskId,
): TaskStartedEvent {
  return {
    ...eventBase(AgentEventType.TaskStarted, runId, { agentId, taskId }),
    type: AgentEventType.TaskStarted,
    agentId,
    taskId,
    payload: { status: "running" as const },
  };
}

export function createTaskCompletedEvent(
  runId: RunId,
  agentId: AgentId,
  taskId: TaskId,
  payload: TaskCompletedEvent["payload"],
): TaskCompletedEvent {
  return {
    ...eventBase(AgentEventType.TaskCompleted, runId, { agentId, taskId }),
    type: AgentEventType.TaskCompleted,
    agentId,
    taskId,
    payload,
  };
}

export function createTaskFailedEvent(
  runId: RunId,
  agentId: AgentId,
  taskId: TaskId,
  payload: TaskFailedEvent["payload"],
): TaskFailedEvent {
  return {
    ...eventBase(AgentEventType.TaskFailed, runId, { agentId, taskId }),
    type: AgentEventType.TaskFailed,
    agentId,
    taskId,
    payload,
  };
}

export function createAgentStartedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: AgentStartedEvent["payload"],
): AgentStartedEvent {
  return {
    ...eventBase(AgentEventType.AgentStarted, runId, { agentId }),
    type: AgentEventType.AgentStarted,
    agentId,
    payload,
  };
}

export function createAgentCompletedEvent(
  runId: RunId,
  agentId: AgentId,
  payload?: AgentCompletedEvent["payload"],
): AgentCompletedEvent {
  return {
    ...eventBase(AgentEventType.AgentCompleted, runId, { agentId }),
    type: AgentEventType.AgentCompleted,
    agentId,
    payload: payload ?? {},
  };
}

export function createAgentFailedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: AgentFailedEvent["payload"],
): AgentFailedEvent {
  return {
    ...eventBase(AgentEventType.AgentFailed, runId, { agentId }),
    type: AgentEventType.AgentFailed,
    agentId,
    payload,
  };
}

export function createAgentProgressEvent(
  runId: RunId,
  agentId: AgentId,
  payload: AgentProgressEvent["payload"],
): AgentProgressEvent {
  return {
    ...eventBase(AgentEventType.AgentProgress, runId, { agentId }),
    type: AgentEventType.AgentProgress,
    agentId,
    payload,
  };
}

export function createToolRequestedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: ToolRequestedEvent["payload"],
): ToolRequestedEvent {
  return {
    ...eventBase(AgentEventType.ToolRequested, runId, { agentId }),
    type: AgentEventType.ToolRequested,
    agentId,
    payload,
  };
}

export function createToolStartedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: ToolStartedEvent["payload"],
): ToolStartedEvent {
  return {
    ...eventBase(AgentEventType.ToolStarted, runId, { agentId }),
    type: AgentEventType.ToolStarted,
    agentId,
    payload,
  };
}

export function createToolCompletedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: ToolCompletedEvent["payload"],
): ToolCompletedEvent {
  return {
    ...eventBase(AgentEventType.ToolCompleted, runId, { agentId }),
    type: AgentEventType.ToolCompleted,
    agentId,
    payload,
  };
}

export function createToolRejectedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: ToolRejectedEvent["payload"],
): ToolRejectedEvent {
  return {
    ...eventBase(AgentEventType.ToolRejected, runId, { agentId }),
    type: AgentEventType.ToolRejected,
    agentId,
    payload,
  };
}

export function createToolFailedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: ToolFailedEvent["payload"],
): ToolFailedEvent {
  return {
    ...eventBase(AgentEventType.ToolFailed, runId, { agentId }),
    type: AgentEventType.ToolFailed,
    agentId,
    payload,
  };
}

export function createMemoryLoadedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: MemoryLoadedEvent["payload"],
): MemoryLoadedEvent {
  return {
    ...eventBase(AgentEventType.MemoryLoaded, runId, { agentId }),
    type: AgentEventType.MemoryLoaded,
    agentId,
    payload,
  };
}

export function createMemoryCompactedEvent(
  runId: RunId,
  agentId: AgentId,
  payload: MemoryCompactedEvent["payload"],
): MemoryCompactedEvent {
  return {
    ...eventBase(AgentEventType.MemoryCompacted, runId, { agentId }),
    type: AgentEventType.MemoryCompacted,
    agentId,
    payload,
  };
}

export function createUsageUpdatedEvent(
  runId: RunId,
  payload: UsageUpdatedEvent["payload"],
): UsageUpdatedEvent {
  return {
    ...eventBase(AgentEventType.UsageUpdated, runId),
    type: AgentEventType.UsageUpdated,
    payload,
  };
}

export function createOutputDeltaEvent(
  runId: RunId,
  agentId: AgentId,
  payload: OutputDeltaEvent["payload"],
): OutputDeltaEvent {
  return {
    ...eventBase(AgentEventType.OutputDelta, runId, { agentId }),
    type: AgentEventType.OutputDelta,
    agentId,
    payload,
  };
}

export function createOutputCompletedEvent(
  runId: RunId,
  agentId: AgentId,
  payload?: OutputCompletedEvent["payload"],
): OutputCompletedEvent {
  return {
    ...eventBase(AgentEventType.OutputCompleted, runId, { agentId }),
    type: AgentEventType.OutputCompleted,
    agentId,
    payload: payload ?? {},
  };
}
