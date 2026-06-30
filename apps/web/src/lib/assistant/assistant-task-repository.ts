import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  SaveToolResultArtifactInput,
  ToolResultArtifactRecord,
  ToolResultArtifactRepository,
} from "@learning-agent-platform/ai-core/agent-runtime";

import type {
  AssistantAgentAuditEventType,
  AssistantAgentAuditEventView,
  AssistantAgentName,
  AssistantAgentRunStatus,
  AssistantAgentRunView,
  AssistantEvidenceReference,
  AssistantMultiAgentTaskStatus,
  AssistantMultiAgentTaskView,
  AssistantStabilityInjectionMode,
  AssistantTaskFinalAnswerStatus,
  AssistantTaskLimitsView,
  AssistantToolResultArtifactView,
} from "./assistant-types.ts";

export const A509_AGENT_NAMES: readonly AssistantAgentName[] = [
  "Orchestrator",
  "LearnerProfile",
  "CandidateRecommendation",
  "UpcomingContest",
  "ResultAggregator",
];

export const A509_DEFAULT_TASK_LIMITS: AssistantTaskLimitsView = {
  taskTimeoutMs: 60_000,
  agentTimeoutMs: {
    Orchestrator: 10_000,
    LearnerProfile: 10_000,
    CandidateRecommendation: 15_000,
    UpcomingContest: 15_000,
    ResultAggregator: 10_000,
  },
  maxAgents: 5,
  maxToolCalls: 8,
  maxAgentRetries: 2,
  maxTaskRetries: 1,
  maxEvidence: 24,
  maxCandidateProblems: 10,
  maxEstimatedTokens: 8_000,
  maxProviderCalls: 0,
};

export interface AssistantTaskAgentRunRecord extends AssistantAgentRunView {
  queuedAt: string;
  safeOutputData?: Record<string, unknown> | null;
}

export interface AssistantMultiAgentTaskRecord {
  id: string;
  userId: string;
  conversationId: string;
  requestId: string;
  idempotencyKey: string;
  intent: "TRAINING_AND_CONTEST_PLAN";
  userVisibleRequest: string;
  status: AssistantMultiAgentTaskStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  currentAttempt: number;
  limits: AssistantTaskLimitsView;
  finalAnswer: string | null;
  finalAnswerStatus: AssistantTaskFinalAnswerStatus;
  errorCode?: string;
  agentRuns: AssistantTaskAgentRunRecord[];
  auditEvents: AssistantAgentAuditEventView[];
  evidence: AssistantEvidenceReference[];
  toolResultArtifacts: ToolResultArtifactRecord[];
  stabilityInjectionMode: AssistantStabilityInjectionMode;
  toolCallCount: number;
  taskRetryCount: number;
  estimatedTokens: number;
  providerCallCount: number;
}

interface UserTaskStore {
  version: 1;
  records: AssistantMultiAgentTaskRecord[];
}

export class AssistantTaskRepositoryError extends Error {
  readonly code:
    | "task_not_found"
    | "task_not_owned"
    | "task_not_mutable"
    | "invalid_request"
    | "persistence_failed";

  constructor(code: AssistantTaskRepositoryError["code"], message: string) {
    super(message);
    this.name = "AssistantTaskRepositoryError";
    this.code = code;
  }
}

const userStoreLocks = new Map<string, Promise<unknown>>();

export class FileAssistantTaskRepository implements ToolResultArtifactRepository {
  private readonly rootDir: string;

  constructor(options: { rootDir?: string } = {}) {
    this.rootDir = options.rootDir ?? defaultTaskStoreDir();
  }

  async createOrReuseTask(input: {
    userId: string;
    conversationId: string;
    requestId: string;
    userVisibleRequest: string;
    stabilityInjectionMode?: AssistantStabilityInjectionMode;
    limits?: Partial<AssistantTaskLimitsView>;
  }): Promise<{ task: AssistantMultiAgentTaskRecord; created: boolean }> {
    const userId = normalizeUserId(input.userId);
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId");
    const requestId = normalizeRequiredText(input.requestId, "requestId").slice(0, 120);
    const idempotencyKey = buildIdempotencyKey(userId, conversationId, requestId);
    const userVisibleRequest = String(input.userVisibleRequest ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (userVisibleRequest.length === 0) {
      throw new AssistantTaskRepositoryError("invalid_request", "任务请求不能为空。");
    }

    return withUserStoreLock(userId, async () => {
      const store = await this.readStore(userId);
      const existing = store.records.find((record) => record.idempotencyKey === idempotencyKey);
      if (existing) {
        existing.auditEvents.push(createAuditEvent({
          taskId: existing.id,
          eventType: "duplicate_request_reused",
          status: existing.status,
          safeMessage: "重复 requestId 被幂等复用，未创建第二个任务。",
        }));
        await this.writeStore(userId, store);
        return { task: cloneTask(existing), created: false };
      }

      const now = new Date().toISOString();
      const task: AssistantMultiAgentTaskRecord = {
        id: createTaskId(),
        userId,
        conversationId,
        requestId,
        idempotencyKey,
        intent: "TRAINING_AND_CONTEST_PLAN",
        userVisibleRequest,
        status: "queued",
        createdAt: now,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        currentAttempt: 1,
        limits: mergeLimits(input.limits),
        finalAnswer: null,
        finalAnswerStatus: "pending",
        agentRuns: [],
        auditEvents: [],
        evidence: [],
        toolResultArtifacts: [],
        stabilityInjectionMode: normalizeStabilityMode(input.stabilityInjectionMode),
        toolCallCount: 0,
        taskRetryCount: 0,
        estimatedTokens: estimateRequestTokens(userVisibleRequest),
        providerCallCount: 0,
      };
      task.auditEvents.push(createAuditEvent({
        taskId: task.id,
        eventType: "task_created",
        status: task.status,
        safeMessage: "多步骤任务已创建并持久化。",
      }));
      store.records.unshift(task);
      await this.writeStore(userId, store);
      return { task: cloneTask(task), created: true };
    });
  }

  async getTask(input: {
    userId: string;
    taskId: string;
  }): Promise<AssistantMultiAgentTaskRecord> {
    const userId = normalizeUserId(input.userId);
    const taskId = normalizeRequiredText(input.taskId, "taskId");
    const store = await this.readStore(userId);
    const task = findTask(store, taskId);
    if (!task) {
      throw new AssistantTaskRepositoryError("task_not_found", "任务不存在或不属于当前用户。");
    }
    return cloneTask(task);
  }

  async listConversationTasks(input: {
    userId: string;
    conversationId: string;
  }): Promise<AssistantMultiAgentTaskRecord[]> {
    const userId = normalizeUserId(input.userId);
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId");
    const store = await this.readStore(userId);
    return store.records
      .filter((record) => record.conversationId === conversationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneTask);
  }

  async mutateTask<T>(
    input: {
      userId: string;
      taskId: string;
    },
    mutator: (task: AssistantMultiAgentTaskRecord) => T,
  ): Promise<T> {
    const userId = normalizeUserId(input.userId);
    const taskId = normalizeRequiredText(input.taskId, "taskId");
    return withUserStoreLock(userId, async () => {
      const store = await this.readStore(userId);
      const task = findTask(store, taskId);
      if (!task) {
        throw new AssistantTaskRepositoryError("task_not_found", "任务不存在或不属于当前用户。");
      }
      const result = mutator(task);
      await this.writeStore(userId, store);
      return result;
    });
  }

  async cancelTask(input: {
    userId: string;
    taskId: string;
  }): Promise<AssistantMultiAgentTaskRecord> {
    return this.mutateTask(input, (task) => {
      if (isTerminalTaskStatus(task.status)) {
        return cloneTask(task);
      }
      if (task.status !== "cancel_requested") {
        task.status = "cancel_requested";
        task.auditEvents.push(createAuditEvent({
          taskId: task.id,
          eventType: "task_cancel_requested",
          status: task.status,
          safeMessage: "用户请求取消任务，运行中的步骤将收到取消信号。",
        }));
      }
      return cloneTask(task);
    });
  }

  async recoverInterruptedTasks(input: {
    userId: string;
    conversationId: string;
    activeTaskIds: readonly string[];
  }): Promise<AssistantMultiAgentTaskRecord[]> {
    const userId = normalizeUserId(input.userId);
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId");
    const active = new Set(input.activeTaskIds);
    return withUserStoreLock(userId, async () => {
      const store = await this.readStore(userId);
      let changed = false;
      for (const task of store.records) {
        if (task.conversationId !== conversationId || active.has(task.id) || isTerminalTaskStatus(task.status)) {
          continue;
        }
        changed = true;
        const now = new Date().toISOString();
        if (task.status === "cancel_requested") {
          task.status = "cancelled";
          task.cancelledAt = now;
          task.completedAt = task.completedAt ?? now;
          task.finalAnswerStatus = "cancelled";
          task.auditEvents.push(createAuditEvent({
            taskId: task.id,
            eventType: "task_cancelled",
            status: task.status,
            safeMessage: "任务在恢复时处于取消请求状态，已安全标记为 cancelled。",
          }));
        } else if (task.status === "queued" || task.status === "running") {
          task.status = "failed";
          task.completedAt = now;
          task.errorCode = "process_interrupted";
          task.finalAnswerStatus = "failed";
          for (const run of task.agentRuns) {
            if (run.status === "running") {
              run.status = "failed";
              run.completedAt = now;
              run.errorCode = "process_interrupted";
              run.retryable = true;
            } else if (run.status === "pending") {
              run.status = "skipped";
              run.completedAt = now;
              run.errorCode = "process_interrupted";
              run.retryable = true;
            }
          }
          task.auditEvents.push(createAuditEvent({
            taskId: task.id,
            eventType: "task_failed",
            status: task.status,
            safeMessage: "服务进程恢复时未找到运行控制器，任务已标记为 interrupted/failed，可由用户重试。",
          }));
        }
      }
      if (changed) {
        await this.writeStore(userId, store);
      }
      return store.records
        .filter((record) => record.conversationId === conversationId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(cloneTask);
    });
  }

  async saveToolResultArtifact(input: SaveToolResultArtifactInput): Promise<ToolResultArtifactRecord> {
    const ownerUserId = normalizeUserId(input.ownerUserId);
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId");
    const runId = normalizeRequiredText(input.runId, "runId");
    const now = input.createdAt ?? new Date().toISOString();
    const record: ToolResultArtifactRecord = {
      artifactId: createToolResultArtifactId(),
      ownerUserId,
      conversationId,
      runId,
      toolCallId: sanitizeSafeText(input.toolCallId, 160),
      toolName: sanitizeSafeText(input.toolName, 160),
      contentType: input.contentType,
      safePreview: sanitizeSafeText(input.safePreview, 1200),
      sourceRefs: input.sourceRefs.map(sanitizeArtifactSourceRef).slice(0, 16),
      size: Math.max(0, Math.trunc(input.size)),
      createdAt: now,
      expiresAt: input.expiresAt ?? defaultArtifactExpiresAt(now),
    };

    await this.writeArtifactFile(record, input.content);
    await withUserStoreLock(ownerUserId, async () => {
      const store = await this.readStore(ownerUserId);
      const task = findTaskByTaskOrRunId(store, runId);
      if (task && task.conversationId === conversationId) {
        task.toolResultArtifacts = [
          record,
          ...task.toolResultArtifacts.filter((item) => item.artifactId !== record.artifactId),
        ].slice(0, task.limits.maxEvidence);
        await this.writeStore(ownerUserId, store);
      }
    });

    return record;
  }

  async readToolResultArtifact(input: {
    ownerUserId: string;
    artifactId: string;
  }): Promise<unknown | null> {
    const ownerUserId = normalizeUserId(input.ownerUserId);
    const artifactId = normalizeRequiredText(input.artifactId, "artifactId");
    const store = await this.readStore(ownerUserId);
    const artifact = store.records
      .flatMap((record) => record.toolResultArtifacts)
      .find((record) => record.artifactId === artifactId && record.ownerUserId === ownerUserId);
    if (!artifact) {
      return null;
    }
    const raw = await readFile(this.artifactPathForRecord(artifact), "utf8").catch(() => "");
    if (raw.trim().length === 0) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { content?: unknown };
      return parsed.content ?? null;
    } catch {
      return null;
    }
  }

  async cleanupExpiredToolResultArtifacts(input: {
    ownerUserId: string;
    now?: string;
  }): Promise<number> {
    const ownerUserId = normalizeUserId(input.ownerUserId);
    const nowMs = new Date(input.now ?? new Date().toISOString()).getTime();
    let removed = 0;
    await withUserStoreLock(ownerUserId, async () => {
      const store = await this.readStore(ownerUserId);
      for (const task of store.records) {
        const retained: ToolResultArtifactRecord[] = [];
        for (const artifact of task.toolResultArtifacts) {
          const expiresAt = artifact.expiresAt ? new Date(artifact.expiresAt).getTime() : Number.POSITIVE_INFINITY;
          const stillReferenced = (typeof task.finalAnswer === "string" && task.finalAnswer.includes(artifact.artifactId)) ||
            task.evidence.some((evidence) =>
              evidence.recordId === artifact.artifactId || evidence.safeSummary.includes(artifact.artifactId),
            );
          if (Number.isFinite(expiresAt) && expiresAt <= nowMs && !stillReferenced) {
            removed += 1;
            await unlink(this.artifactPathForRecord(artifact)).catch(() => undefined);
          } else {
            retained.push(artifact);
          }
        }
        task.toolResultArtifacts = retained;
      }
      if (removed > 0) {
        await this.writeStore(ownerUserId, store);
      }
    });
    return removed;
  }

  private async readStore(userId: string): Promise<UserTaskStore> {
    try {
      const filePath = this.filePathForUser(userId);
      const raw = await readFile(filePath, "utf8").catch((error: unknown) => {
        if (isNodeError(error) && error.code === "ENOENT") {
          return "";
        }
        throw error;
      });
      if (raw.trim().length === 0) {
        return { version: 1, records: [] };
      }
      return normalizeStore(JSON.parse(raw), userId);
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return { version: 1, records: [] };
      }
      throw new AssistantTaskRepositoryError("persistence_failed", "读取任务持久化文件失败。");
    }
  }

  private async writeStore(userId: string, store: UserTaskStore): Promise<void> {
    try {
      await mkdir(this.rootDir, { recursive: true });
      const filePath = this.filePathForUser(userId);
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(tmpPath, filePath);
    } catch {
      throw new AssistantTaskRepositoryError("persistence_failed", "写入任务持久化文件失败。");
    }
  }

  private filePathForUser(userId: string): string {
    return path.join(this.rootDir, `${safeFileSegment(userId)}.json`);
  }

  private async writeArtifactFile(record: ToolResultArtifactRecord, content: unknown): Promise<void> {
    const filePath = this.artifactPathForRecord(record);
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify({
      version: 1,
      record,
      content,
    }, null, 2)}\n`, "utf8");
    await rename(tmpPath, filePath);
  }

  private artifactPathForRecord(record: ToolResultArtifactRecord): string {
    return path.join(
      this.rootDir,
      "tool-result-artifacts",
      safeFileSegment(record.ownerUserId),
      safeFileSegment(record.conversationId),
      safeFileSegment(record.runId),
      `${safeFileSegment(record.artifactId)}.json`,
    );
  }
}

export function createDefaultAssistantTaskRepository(): FileAssistantTaskRepository {
  return new FileAssistantTaskRepository();
}

export function createAgentRun(input: {
  taskId: string;
  agentName: AssistantAgentName;
  role: string;
  attempt: number;
  timeoutMs: number;
  safeInputSummary: string;
}): AssistantTaskAgentRunRecord {
  const now = new Date().toISOString();
  return {
    id: createAgentRunId(input.agentName),
    taskId: input.taskId,
    agentName: input.agentName,
    role: input.role,
    status: "pending",
    attempt: input.attempt,
    queuedAt: now,
    startedAt: null,
    completedAt: null,
    timeoutMs: input.timeoutMs,
    usedTools: [],
    sourceRefs: [],
    safeInputSummary: sanitizeSafeText(input.safeInputSummary, 500),
    safeOutputSummary: "",
    retryable: false,
    safeOutputData: null,
  };
}

export function createAuditEvent(input: {
  taskId: string;
  eventType: AssistantAgentAuditEventType;
  status: string;
  safeMessage: string;
  agentRunId?: string;
  toolName?: string;
  sourceRefs?: string[];
  attempt?: number;
}): AssistantAgentAuditEventView {
  return {
    id: createAuditEventId(),
    taskId: input.taskId,
    eventType: input.eventType,
    status: input.status,
    timestamp: new Date().toISOString(),
    safeMessage: sanitizeSafeText(input.safeMessage, 700),
    ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
    ...(input.toolName ? { toolName: sanitizeSafeText(input.toolName, 120) } : {}),
    ...(input.sourceRefs && input.sourceRefs.length > 0 ? { sourceRefs: input.sourceRefs.slice(0, 12) } : {}),
    ...(input.attempt !== undefined ? { attempt: Math.max(1, Math.trunc(input.attempt)) } : {}),
  };
}

export function toAssistantTaskView(task: AssistantMultiAgentTaskRecord): AssistantMultiAgentTaskView {
  const latestRuns = latestRunsByAgent(task.agentRuns);
  const completedAgentCount = latestRuns.filter((run) => run.status === "succeeded").length;
  const failedAgentCount = latestRuns.filter((run) =>
    run.status === "failed"
    || run.status === "timed_out"
    || run.status === "cancelled"
    || run.status === "skipped",
  ).length;
  const canRetryAgentNames = canRetryAgentAfterTaskStatus(task.status)
    ? latestRuns
      .filter((run) => run.retryable && retryableAgentStatus(run.status))
      .map((run) => run.agentName)
    : [];

  return {
    id: task.id,
    conversationId: task.conversationId,
    requestId: task.requestId,
    intent: task.intent,
    userVisibleRequest: task.userVisibleRequest,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    cancelledAt: task.cancelledAt,
    currentAttempt: task.currentAttempt,
    limits: task.limits,
    finalAnswer: task.finalAnswer,
    finalAnswerStatus: task.finalAnswerStatus,
    ...(task.errorCode ? { errorCode: task.errorCode } : {}),
    agentRuns: [...task.agentRuns]
      .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
      .map((run) => ({
        id: run.id,
        taskId: run.taskId,
        agentName: run.agentName,
        role: run.role,
        status: run.status,
        attempt: run.attempt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        timeoutMs: run.timeoutMs,
        usedTools: run.usedTools,
        sourceRefs: run.sourceRefs,
        safeInputSummary: run.safeInputSummary,
        safeOutputSummary: run.safeOutputSummary,
        ...(run.errorCode ? { errorCode: run.errorCode } : {}),
        retryable: run.retryable,
        ...(run.developmentInjection ? { developmentInjection: run.developmentInjection } : {}),
      })),
    auditEvents: [...task.auditEvents].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    evidence: [...task.evidence],
    toolResultArtifacts: task.toolResultArtifacts.map(toToolResultArtifactView),
    completedAgentCount,
    failedAgentCount,
    partial: task.status === "partial_success",
    canCancel: task.status === "queued" || task.status === "running",
    canRetryTask: (task.status === "failed" || task.status === "timed_out") && task.taskRetryCount < task.limits.maxTaskRetries,
    canRetryAgentNames,
    stabilityInjectionMode: task.stabilityInjectionMode,
  };
}

export function isTerminalTaskStatus(status: AssistantMultiAgentTaskStatus): boolean {
  return status === "succeeded"
    || status === "partial_success"
    || status === "failed"
    || status === "cancelled"
    || status === "timed_out";
}

export function retryableAgentStatus(status: AssistantAgentRunStatus): boolean {
  return status === "failed" || status === "timed_out" || status === "cancelled" || status === "skipped";
}

export function canRetryAgentAfterTaskStatus(status: AssistantMultiAgentTaskStatus): boolean {
  return status === "partial_success" || status === "failed" || status === "timed_out";
}

function latestRunsByAgent(runs: readonly AssistantTaskAgentRunRecord[]): AssistantTaskAgentRunRecord[] {
  const latest = new Map<AssistantAgentName, AssistantTaskAgentRunRecord>();
  for (const run of runs) {
    const current = latest.get(run.agentName);
    if (!current || run.attempt > current.attempt || (run.attempt === current.attempt && run.queuedAt > current.queuedAt)) {
      latest.set(run.agentName, run);
    }
  }
  return A509_AGENT_NAMES.map((name) => latest.get(name)).filter((run): run is AssistantTaskAgentRunRecord => Boolean(run));
}

function withUserStoreLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = userStoreLocks.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  userStoreLocks.set(userId, run.then(() => undefined, () => undefined));
  return run;
}

function normalizeStore(value: unknown, userId: string): UserTaskStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, records: [] };
  }
  const raw = value as { records?: unknown };
  const records = Array.isArray(raw.records)
    ? raw.records.map((record) => normalizeTask(record, userId)).filter((record): record is AssistantMultiAgentTaskRecord => record !== null)
    : [];
  return { version: 1, records };
}

function normalizeTask(value: unknown, userId: string): AssistantMultiAgentTaskRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string"
    || record.userId !== userId
    || typeof record.conversationId !== "string"
    || typeof record.requestId !== "string"
    || typeof record.userVisibleRequest !== "string"
  ) {
    return null;
  }
  const taskId = record.id;
  const userVisibleRequest = record.userVisibleRequest;

  const idempotencyKey = typeof record.idempotencyKey === "string"
    ? record.idempotencyKey
    : buildIdempotencyKey(userId, record.conversationId, record.requestId);

  return {
    id: taskId,
    userId,
    conversationId: record.conversationId,
    requestId: record.requestId,
    idempotencyKey,
    intent: "TRAINING_AND_CONTEST_PLAN",
    userVisibleRequest: sanitizeSafeText(userVisibleRequest, 1000),
    status: normalizeTaskStatus(record.status),
    createdAt: readDateString(record.createdAt),
    startedAt: readNullableDateString(record.startedAt),
    completedAt: readNullableDateString(record.completedAt),
    cancelledAt: readNullableDateString(record.cancelledAt),
    currentAttempt: readPositiveInt(record.currentAttempt, 1),
    limits: normalizeLimits(record.limits),
    finalAnswer: typeof record.finalAnswer === "string" ? sanitizeSafeText(record.finalAnswer, 4000) : null,
    finalAnswerStatus: normalizeFinalAnswerStatus(record.finalAnswerStatus),
    ...(typeof record.errorCode === "string" ? { errorCode: sanitizeSafeText(record.errorCode, 120) } : {}),
    agentRuns: Array.isArray(record.agentRuns)
      ? record.agentRuns.map((run) => normalizeAgentRun(run, taskId)).filter((run): run is AssistantTaskAgentRunRecord => run !== null)
      : [],
    auditEvents: Array.isArray(record.auditEvents)
      ? record.auditEvents.map((event) => normalizeAuditEvent(event, taskId)).filter((event): event is AssistantAgentAuditEventView => event !== null)
      : [],
    evidence: Array.isArray(record.evidence)
      ? record.evidence.map(normalizeEvidence).filter((item): item is AssistantEvidenceReference => item !== null)
      : [],
    toolResultArtifacts: Array.isArray(record.toolResultArtifacts)
      ? record.toolResultArtifacts.map((item) => normalizeToolResultArtifact(item, userId)).filter((item): item is ToolResultArtifactRecord => item !== null)
      : [],
    stabilityInjectionMode: normalizeStabilityMode(record.stabilityInjectionMode),
    toolCallCount: readPositiveInt(record.toolCallCount, 0),
    taskRetryCount: readPositiveInt(record.taskRetryCount, 0),
    estimatedTokens: readPositiveInt(record.estimatedTokens, estimateRequestTokens(userVisibleRequest)),
    providerCallCount: readPositiveInt(record.providerCallCount, 0),
  };
}

function normalizeAgentRun(value: unknown, taskId: string): AssistantTaskAgentRunRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.taskId !== taskId || !isAgentName(record.agentName)) {
    return null;
  }
  return {
    id: record.id,
    taskId,
    agentName: record.agentName,
    role: typeof record.role === "string" ? sanitizeSafeText(record.role, 160) : record.agentName,
    status: normalizeAgentStatus(record.status),
    attempt: readPositiveInt(record.attempt, 1),
    queuedAt: readDateString(record.queuedAt ?? record.startedAt),
    startedAt: readNullableDateString(record.startedAt),
    completedAt: readNullableDateString(record.completedAt),
    timeoutMs: readPositiveInt(record.timeoutMs, A509_DEFAULT_TASK_LIMITS.agentTimeoutMs[record.agentName]),
    usedTools: Array.isArray(record.usedTools) ? record.usedTools.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
    sourceRefs: Array.isArray(record.sourceRefs) ? record.sourceRefs.filter((item): item is string => typeof item === "string").slice(0, 24) : [],
    safeInputSummary: typeof record.safeInputSummary === "string" ? sanitizeSafeText(record.safeInputSummary, 500) : "",
    safeOutputSummary: typeof record.safeOutputSummary === "string" ? sanitizeSafeText(record.safeOutputSummary, 1000) : "",
    ...(typeof record.errorCode === "string" ? { errorCode: sanitizeSafeText(record.errorCode, 120) } : {}),
    retryable: record.retryable === true,
    ...(typeof record.developmentInjection === "string" ? { developmentInjection: sanitizeSafeText(record.developmentInjection, 160) } : {}),
    safeOutputData: normalizeRecordData(record.safeOutputData),
  };
}

function normalizeAuditEvent(value: unknown, taskId: string): AssistantAgentAuditEventView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.taskId !== taskId || !isAuditEventType(record.eventType)) {
    return null;
  }
  return {
    id: record.id,
    taskId,
    eventType: record.eventType,
    status: typeof record.status === "string" ? sanitizeSafeText(record.status, 80) : "",
    timestamp: readDateString(record.timestamp),
    safeMessage: typeof record.safeMessage === "string" ? sanitizeSafeText(record.safeMessage, 700) : "",
    ...(typeof record.agentRunId === "string" ? { agentRunId: record.agentRunId } : {}),
    ...(typeof record.toolName === "string" ? { toolName: sanitizeSafeText(record.toolName, 120) } : {}),
    ...(Array.isArray(record.sourceRefs) ? { sourceRefs: record.sourceRefs.filter((item): item is string => typeof item === "string").slice(0, 12) } : {}),
    ...(typeof record.attempt === "number" ? { attempt: Math.max(1, Math.trunc(record.attempt)) } : {}),
  };
}

function normalizeEvidence(value: unknown): AssistantEvidenceReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.label !== "string" || typeof record.source !== "string") {
    return null;
  }
  return {
    id: record.id,
    type: isEvidenceType(record.type) ? record.type : "assistant_task",
    label: sanitizeSafeText(record.label, 180),
    source: sanitizeSafeText(record.source, 180),
    ...(typeof record.recordId === "string" ? { recordId: sanitizeSafeText(record.recordId, 160) } : {}),
    ...(typeof record.officialUrl === "string" ? { officialUrl: sanitizeSafeUrl(record.officialUrl) } : {}),
    ...(typeof record.fetchedAt === "string" ? { fetchedAt: record.fetchedAt } : {}),
    cached: record.cached === true,
    realtime: record.realtime === true,
    safeSummary: typeof record.safeSummary === "string" ? sanitizeSafeText(record.safeSummary, 700) : "",
    usedByAgentNames: Array.isArray(record.usedByAgentNames)
      ? record.usedByAgentNames.filter(isAgentName)
      : [],
  };
}

function normalizeToolResultArtifact(
  value: unknown,
  userId: string,
): ToolResultArtifactRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.artifactId !== "string"
    || record.ownerUserId !== userId
    || typeof record.conversationId !== "string"
    || typeof record.runId !== "string"
    || typeof record.toolCallId !== "string"
    || typeof record.toolName !== "string"
  ) {
    return null;
  }
  return {
    artifactId: sanitizeSafeText(record.artifactId, 160),
    ownerUserId: userId,
    conversationId: sanitizeSafeText(record.conversationId, 160),
    runId: sanitizeSafeText(record.runId, 160),
    toolCallId: sanitizeSafeText(record.toolCallId, 160),
    toolName: sanitizeSafeText(record.toolName, 160),
    contentType: "application/json",
    safePreview: typeof record.safePreview === "string" ? sanitizeSafeText(record.safePreview, 1200) : "",
    sourceRefs: Array.isArray(record.sourceRefs)
      ? record.sourceRefs.map(sanitizeArtifactSourceRef).slice(0, 16)
      : [],
    size: readPositiveInt(record.size, 0),
    createdAt: readDateString(record.createdAt),
    expiresAt: readNullableDateString(record.expiresAt),
    ...(record.sensitiveResultNotPersisted === true ? { sensitiveResultNotPersisted: true } : {}),
  };
}

function toToolResultArtifactView(
  artifact: ToolResultArtifactRecord,
): AssistantToolResultArtifactView {
  return {
    artifactId: artifact.artifactId,
    conversationId: artifact.conversationId,
    runId: artifact.runId,
    toolCallId: artifact.toolCallId,
    toolName: artifact.toolName,
    contentType: artifact.contentType,
    safePreview: artifact.safePreview,
    sourceRefs: artifact.sourceRefs.map(sanitizeArtifactSourceRef),
    size: artifact.size,
    createdAt: artifact.createdAt,
    expiresAt: artifact.expiresAt,
    ...(artifact.sensitiveResultNotPersisted ? { sensitiveResultNotPersisted: true } : {}),
  };
}

function sanitizeArtifactSourceRef(
  value: unknown,
): ToolResultArtifactRecord["sourceRefs"][number] {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    title: typeof record.title === "string" ? sanitizeSafeText(record.title, 180) : "工具来源",
    source: typeof record.source === "string" ? sanitizeSafeText(record.source, 180) : "unknown",
    ...(typeof record.url === "string" ? { url: sanitizeSafeUrl(record.url) } : {}),
    ...(typeof record.recordId === "string" ? { recordId: sanitizeSafeText(record.recordId, 180) } : {}),
    ...(record.cached !== undefined ? { cached: record.cached === true } : {}),
    ...(typeof record.safeSummary === "string" ? { safeSummary: sanitizeSafeText(record.safeSummary, 700) } : {}),
  };
}

function findTask(store: UserTaskStore, taskId: string): AssistantMultiAgentTaskRecord | null {
  return store.records.find((record) => record.id === taskId) ?? null;
}

function findTaskByTaskOrRunId(
  store: UserTaskStore,
  id: string,
): AssistantMultiAgentTaskRecord | null {
  return store.records.find((record) =>
    record.id === id || record.agentRuns.some((run) => run.id === id),
  ) ?? null;
}

function mergeLimits(input: Partial<AssistantTaskLimitsView> | undefined): AssistantTaskLimitsView {
  if (!input) {
    return { ...A509_DEFAULT_TASK_LIMITS, agentTimeoutMs: { ...A509_DEFAULT_TASK_LIMITS.agentTimeoutMs } };
  }
  return {
    ...A509_DEFAULT_TASK_LIMITS,
    ...input,
    agentTimeoutMs: {
      ...A509_DEFAULT_TASK_LIMITS.agentTimeoutMs,
      ...(input.agentTimeoutMs ?? {}),
    },
  };
}

function normalizeLimits(value: unknown): AssistantTaskLimitsView {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return mergeLimits(undefined);
  }
  return mergeLimits(value as Partial<AssistantTaskLimitsView>);
}

function buildIdempotencyKey(userId: string, conversationId: string, requestId: string): string {
  return `${userId}::${conversationId}::${requestId}`;
}

function estimateRequestTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text ?? "").length / 3));
}

function createTaskId(): string {
  return `assistant-task-${randomUUID()}`;
}

function createAgentRunId(agentName: AssistantAgentName): string {
  return `agent-run-${agentName}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function createAuditEventId(): string {
  return `agent-audit-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function createToolResultArtifactId(): string {
  return `tool-result-artifact-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function defaultArtifactExpiresAt(createdAt: string): string {
  const createdMs = new Date(createdAt).getTime();
  const base = Number.isFinite(createdMs) ? createdMs : Date.now();
  return new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function defaultTaskStoreDir(): string {
  return path.join(findWorkspaceRoot(process.cwd()), ".codex_tmp", "a509-agent-tasks");
}

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  for (let index = 0; index < 8; index += 1) {
    if (path.basename(current) === "learning-agent-platform") {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) {
      break;
    }
    current = next;
  }
  return startDir;
}

function normalizeUserId(value: string): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) {
    throw new AssistantTaskRepositoryError("task_not_owned", "需要可信服务端用户身份。");
  }
  return normalized;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) {
    throw new AssistantTaskRepositoryError("invalid_request", `${label} required`);
  }
  return normalized;
}

function normalizeTaskStatus(value: unknown): AssistantMultiAgentTaskStatus {
  return value === "queued"
    || value === "running"
    || value === "partial_success"
    || value === "succeeded"
    || value === "failed"
    || value === "cancel_requested"
    || value === "cancelled"
    || value === "timed_out"
    ? value
    : "failed";
}

function normalizeAgentStatus(value: unknown): AssistantAgentRunStatus {
  return value === "pending"
    || value === "running"
    || value === "succeeded"
    || value === "failed"
    || value === "cancelled"
    || value === "timed_out"
    || value === "skipped"
    ? value
    : "failed";
}

function normalizeFinalAnswerStatus(value: unknown): AssistantTaskFinalAnswerStatus {
  return value === "pending"
    || value === "available"
    || value === "partial"
    || value === "cancelled"
    || value === "failed"
    ? value
    : "pending";
}

function normalizeStabilityMode(value: unknown): AssistantStabilityInjectionMode {
  return value === "fail_upcoming_once"
    || value === "timeout_candidate_once"
    || value === "delay_task_for_cancel"
    || value === "tool_empty_once"
    || value === "tool_internal_error_once"
    || value === "tool_timeout_once"
    || value === "tool_cancel_once"
    || value === "tool_permission_denied_once"
    || value === "tool_large_result_once"
    || value === "tool_unknown_once"
    || value === "tool_duplicate_once"
    || value === "agent_loop_max_turns"
    || value === "agent_loop_max_tool_calls"
    || value === "tool_calling_unsupported"
    || value === "context_compression_failure"
    ? value
    : "normal";
}

function isAgentName(value: unknown): value is AssistantAgentName {
  return value === "Orchestrator"
    || value === "LearnerProfile"
    || value === "CandidateRecommendation"
    || value === "UpcomingContest"
    || value === "ResultAggregator";
}

function isAuditEventType(value: unknown): value is AssistantAgentAuditEventType {
  return typeof value === "string" && [
    "task_created",
    "task_started",
    "task_cancel_requested",
    "task_cancelled",
    "task_timed_out",
    "task_completed",
    "task_partial_success",
    "task_failed",
    "agent_queued",
    "agent_started",
    "agent_succeeded",
    "agent_failed",
    "agent_timed_out",
    "agent_cancelled",
    "agent_retry_requested",
    "agent_retry_started",
    "agent_retry_succeeded",
    "tool_started",
    "tool_succeeded",
    "tool_empty",
    "tool_timed_out",
    "tool_permission_denied",
    "tool_failed",
    "tool_cancelled",
    "evidence_attached",
    "final_answer_created",
    "final_answer_rebuilt",
    "duplicate_request_reused",
    "budget_warning",
    "budget_blocked",
    "agent_loop_started",
    "memory_context_loaded",
    "model_request_started",
    "model_tool_calls_received",
    "tool_call_validation_failed",
    "tool_call_queued",
    "tool_call_started",
    "tool_call_completed",
    "tool_result_budget_applied",
    "tool_result_artifact_stored",
    "tool_result_appended",
    "tool_result_microcompacted",
    "context_budget_warning",
    "context_compressed",
    "context_compression_failed",
    "context_compression_paused",
    "context_blocked",
    "model_continuation_started",
    "model_final_answer_received",
    "agent_loop_limit_reached",
    "agent_loop_cancelled",
    "agent_loop_timed_out",
    "agent_loop_failed",
    "agent_loop_completed",
  ].includes(value);
}

function isEvidenceType(value: unknown): value is AssistantEvidenceReference["type"] {
  return typeof value === "string" && [
    "learning_report",
    "codeforces_account_snapshot",
    "local_curated_problem_pool",
    "codeforces_contest_list",
    "cached_contest_list",
    "code_analysis_record",
    "review_plan",
    "user_long_term_memory",
    "assistant_task",
  ].includes(value);
}

function readDateString(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
    ? value
    : new Date(0).toISOString();
}

function readNullableDateString(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
    ? value
    : null;
}

function readPositiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function normalizeRecordData(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function cloneTask(task: AssistantMultiAgentTaskRecord): AssistantMultiAgentTaskRecord {
  return JSON.parse(JSON.stringify(task)) as AssistantMultiAgentTaskRecord;
}

function safeFileSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 120);
}

function sanitizeSafeText(value: string, maxChars: number): string {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/g, "[redacted-url]")
    .replace(/\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

function sanitizeSafeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }
    return url.toString().slice(0, 300);
  } catch {
    return "";
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
