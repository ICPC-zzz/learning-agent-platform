import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  A505_MIN_COMPRESSIBLE_MESSAGE_COUNT,
  CompressionReason,
  buildActiveConversationContext,
  createStructuredCompressionSummary,
  estimateConversationTokens,
  formatStructuredCompressionSummary,
  selectMessagesForCompression,
  type ConversationCompression,
  type ConversationCompressionState,
  type ConversationMessage,
  type ConversationMessageRole,
  type ConversationSession,
} from "@learning-agent-platform/ai-core/memory";

interface ConversationRecord {
  session: ConversationSession;
  messages: ConversationMessage[];
  compressions: ConversationCompression[];
  memoryConsolidation: AssistantMemoryConsolidationState;
}

interface UserConversationStore {
  version: 1;
  records: ConversationRecord[];
}

export type CompressionTrigger =
  | "manual_button"
  | "conversation_command"
  | "auto_budget";

export type AssistantConversationStatus = "active" | "archived" | "deleted";

export interface AssistantConversationListItem {
  id: string;
  title: string;
  status: AssistantConversationStatus;
  recentMessagePreview: string;
  messageCount: number;
  activeMessageCount: number;
  archivedMessageCount: number;
  compressionCount: number;
  longTermMemoryCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export type AssistantMemoryConsolidationStatus =
  | "never"
  | "skipped_not_enough_turns"
  | "skipped_explicit_write"
  | "skipped_model_unavailable"
  | "succeeded"
  | "failed"
  | "circuit_open";

export interface AssistantMemoryConsolidationState {
  version: 1;
  status: AssistantMemoryConsolidationStatus;
  lastConsolidatedMessageId: string | null;
  lastAttemptedMessageId: string | null;
  lastConsolidatedAt: string | null;
  pendingTrailingRun: boolean;
  runningTaskId: string | null;
  consecutiveFailureCount: number;
  trailingRunCount: number;
  lastErrorCode: string | null;
  explicitWriteMessageIds: string[];
  updatedAt: string | null;
}

export class AssistantConversationRepositoryError extends Error {
  readonly code:
    | "conversation_not_found"
    | "conversation_not_owned"
    | "conversation_archived"
    | "not_enough_messages"
    | "persistence_failed";

  constructor(
    code: AssistantConversationRepositoryError["code"],
    message: string,
  ) {
    super(message);
    this.name = "AssistantConversationRepositoryError";
    this.code = code;
  }
}

export class FileAssistantConversationRepository {
  private readonly rootDir: string;

  constructor(options: { rootDir?: string } = {}) {
    this.rootDir = options.rootDir ?? defaultConversationStoreDir();
  }

  async getOrCreateConversation(input: {
    userId: string;
    conversationId?: string | null;
    contextWindowTokens?: number;
  }): Promise<ConversationCompressionState> {
    const userId = normalizeUserId(input.userId);
    const store = await this.readStore(userId);
    const requestedId = normalizeConversationId(input.conversationId);
    let record = requestedId
      ? store.records.find((item) => item.session.id === requestedId)
      : store.records.find((item) => sessionStatus(item.session) === "active");

    if (!record) {
      record = createConversationRecord(userId, requestedId ?? createConversationId());
      store.records.unshift(record);
      await this.writeStore(userId, store);
    }
    if (sessionStatus(record.session) === "deleted") {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在或已删除。",
      );
    }

    return toState(record, input.contextWindowTokens);
  }

  async createConversation(input: {
    userId: string;
    title?: string;
    contextWindowTokens?: number;
  }): Promise<ConversationCompressionState> {
    const userId = normalizeUserId(input.userId);
    const store = await this.readStore(userId);
    const record = createConversationRecord(userId, createConversationId(), input.title);
    store.records.unshift(record);
    await this.writeStore(userId, store);
    return toState(record, input.contextWindowTokens);
  }

  async getConversation(input: {
    userId: string;
    conversationId: string;
    contextWindowTokens?: number;
  }): Promise<ConversationCompressionState> {
    const record = await this.requireRecord(input.userId, input.conversationId);
    return toState(record, input.contextWindowTokens);
  }

  async appendMessage(input: {
    userId: string;
    conversationId: string;
    role: ConversationMessageRole;
    visibleContent: string;
    contextWindowTokens?: number;
  }): Promise<ConversationCompressionState> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record) {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在。",
      );
    }
    if (sessionStatus(record.session) !== "active") {
      throw new AssistantConversationRepositoryError(
        "conversation_archived",
        "会话已归档，恢复后才能继续发送消息。",
      );
    }

    const now = new Date().toISOString();
    const message: ConversationMessage = {
      id: createMessageId(input.role),
      conversationId,
      role: input.role,
      visibleContent: limitVisibleContent(input.visibleContent),
      createdAt: now,
    };
    record.messages.push(message);
    record.session = {
      ...record.session,
      title: updateTitle(record.session.title, message),
      updatedAt: now,
    };
    await this.writeStore(userId, store);
    return toState(record, input.contextWindowTokens);
  }

  async getMemoryConsolidationState(input: {
    userId: string;
    conversationId: string;
  }): Promise<AssistantMemoryConsolidationState> {
    const record = await this.requireRecord(input.userId, input.conversationId);
    return cloneMemoryConsolidationState(record.memoryConsolidation);
  }

  async updateMemoryConsolidationState(input: {
    userId: string;
    conversationId: string;
    patch: Partial<AssistantMemoryConsolidationState>;
  }): Promise<AssistantMemoryConsolidationState> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record || sessionStatus(record.session) === "deleted") {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "Conversation does not exist or is not owned by the current user.",
      );
    }

    record.memoryConsolidation = normalizeMemoryConsolidationState({
      ...record.memoryConsolidation,
      ...input.patch,
      version: 1,
      updatedAt: new Date().toISOString(),
    });
    await this.writeStore(userId, store);
    return cloneMemoryConsolidationState(record.memoryConsolidation);
  }

  async compressConversation(input: {
    userId: string;
    conversationId: string;
    reason: CompressionReason;
    trigger: CompressionTrigger;
    contextWindowTokens?: number;
  }): Promise<ConversationCompressionState> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record) {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在。",
      );
    }
    if (sessionStatus(record.session) !== "active") {
      throw new AssistantConversationRepositoryError(
        "conversation_archived",
        "会话已归档，恢复后才能压缩上下文。",
      );
    }

    const { sourceMessages, retainedMessages } = selectMessagesForCompression(
      record.messages,
    );
    if (sourceMessages.length < A505_MIN_COMPRESSIBLE_MESSAGE_COUNT) {
      throw new AssistantConversationRepositoryError(
        "not_enough_messages",
        "可压缩消息不足，请先继续进行几轮对话。",
      );
    }

    const now = new Date().toISOString();
    const compressionId = createCompressionId();
    const beforeEstimatedTokens = estimateConversationTokens(
      record.messages.filter((message) => message.archivedAt === undefined),
    );
    const summary = createStructuredCompressionSummary(sourceMessages);
    const summaryText = formatStructuredCompressionSummary(summary);
    const retainedIds = new Set(retainedMessages.map((message) => message.id));
    const archivedMessages = record.messages.map((message) => {
      if (
        message.archivedAt !== undefined
        || retainedIds.has(message.id)
        || (message.role !== "user" && message.role !== "assistant")
      ) {
        return message;
      }

      return {
        ...message,
        archivedAt: now,
        compressionId,
      };
    });
    const compressedThroughMessageId = sourceMessages[sourceMessages.length - 1]?.id;
    if (!compressedThroughMessageId) {
      throw new AssistantConversationRepositoryError(
        "not_enough_messages",
        "可压缩消息不足，请先继续进行几轮对话。",
      );
    }

    const afterEstimatedTokens = estimateConversationTokens(
      archivedMessages.filter((message) => message.archivedAt === undefined),
      summaryText,
    );
    const compression: ConversationCompression = {
      id: compressionId,
      conversationId,
      reason: input.reason,
      trigger: input.trigger,
      summary,
      summaryText,
      beforeEstimatedTokens,
      afterEstimatedTokens,
      archivedMessageCount: archivedMessages.filter((message) =>
        message.compressionId === compressionId && message.archivedAt === now,
      ).length,
      retainedMessageCount: retainedMessages.length,
      compressedThroughMessageId,
      createdAt: now,
      compressorKind: "local_structured_v1",
    };

    record.messages = archivedMessages;
    record.compressions.push(compression);
    record.session = {
      ...record.session,
      lastCompressedAt: now,
      compressionCount: record.session.compressionCount + 1,
      updatedAt: now,
    };

    await this.writeStore(userId, store);
    return toState(record, input.contextWindowTokens);
  }

  async listConversations(input: {
    userId: string;
    status?: "active" | "archived" | "all";
  }): Promise<AssistantConversationListItem[]> {
    const userId = normalizeUserId(input.userId);
    const store = await this.readStore(userId);
    const status = input.status ?? "active";
    return store.records
      .filter((record) => {
        const current = sessionStatus(record.session);
        if (current === "deleted") {
          return false;
        }
        return status === "all" ? true : current === status;
      })
      .map(toListItem)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async renameConversation(input: {
    userId: string;
    conversationId: string;
    title: string;
  }): Promise<AssistantConversationListItem> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record || sessionStatus(record.session) === "deleted") {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在或不属于当前用户。",
      );
    }

    const now = new Date().toISOString();
    record.session = {
      ...record.session,
      title: normalizeTitle(input.title, record.session.title),
      updatedAt: now,
    };
    await this.writeStore(userId, store);
    return toListItem(record);
  }

  async archiveConversation(input: {
    userId: string;
    conversationId: string;
  }): Promise<AssistantConversationListItem> {
    return this.setConversationStatus({
      ...input,
      status: "archived",
    });
  }

  async restoreConversation(input: {
    userId: string;
    conversationId: string;
  }): Promise<AssistantConversationListItem> {
    return this.setConversationStatus({
      ...input,
      status: "active",
    });
  }

  async deleteConversation(input: {
    userId: string;
    conversationId: string;
  }): Promise<boolean> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const before = store.records.length;
    store.records = store.records.filter((record) => record.session.id !== conversationId);
    if (store.records.length === before) {
      return false;
    }
    await this.writeStore(userId, store);
    return true;
  }

  private async setConversationStatus(input: {
    userId: string;
    conversationId: string;
    status: "active" | "archived";
  }): Promise<AssistantConversationListItem> {
    const userId = normalizeUserId(input.userId);
    const conversationId = requireConversationId(input.conversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record || sessionStatus(record.session) === "deleted") {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在或不属于当前用户。",
      );
    }

    const now = new Date().toISOString();
    record.session = {
      ...record.session,
      status: input.status,
      updatedAt: now,
      archivedAt: input.status === "archived" ? now : null,
      deletedAt: null,
    };
    await this.writeStore(userId, store);
    return toListItem(record);
  }

  private async requireRecord(
    rawUserId: string,
    rawConversationId: string,
  ): Promise<ConversationRecord> {
    const userId = normalizeUserId(rawUserId);
    const conversationId = requireConversationId(rawConversationId);
    const store = await this.readStore(userId);
    const record = findRecord(store, conversationId);
    if (!record) {
      throw new AssistantConversationRepositoryError(
        "conversation_not_found",
        "会话不存在或不属于当前用户。",
      );
    }
    if (record.session.userId !== userId) {
      throw new AssistantConversationRepositoryError(
        "conversation_not_owned",
        "会话不属于当前用户。",
      );
    }
    return record;
  }

  private async readStore(userId: string): Promise<UserConversationStore> {
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
      throw new AssistantConversationRepositoryError(
        "persistence_failed",
        "读取会话持久化文件失败。",
      );
    }
  }

  private async writeStore(
    userId: string,
    store: UserConversationStore,
  ): Promise<void> {
    try {
      await mkdir(this.rootDir, { recursive: true });
      const filePath = this.filePathForUser(userId);
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(tmpPath, filePath);
    } catch {
      throw new AssistantConversationRepositoryError(
        "persistence_failed",
        "写入会话持久化文件失败。",
      );
    }
  }

  private filePathForUser(userId: string): string {
    return path.join(this.rootDir, `${safeFileSegment(userId)}.json`);
  }
}

export function createDefaultAssistantConversationRepository(): FileAssistantConversationRepository {
  return new FileAssistantConversationRepository();
}

export function resolveA505ContextWindowTokens(
  env: Record<string, string | undefined> = process.env,
): number | undefined {
  const raw = env.LAP_AI_CONTEXT_WINDOW_TOKENS;
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 512 ? parsed : undefined;
}

function toState(
  record: ConversationRecord,
  contextWindowTokens?: number,
): ConversationCompressionState {
  return {
    session: record.session,
    messages: [...record.messages],
    compressions: [...record.compressions],
    activeContext: buildActiveConversationContext({
      session: record.session,
      messages: record.messages,
      compressions: record.compressions,
      contextWindowTokens,
    }),
  };
}

function createConversationRecord(
  userId: string,
  conversationId: string,
  title = "AI 助手会话",
): ConversationRecord {
  const now = new Date().toISOString();
  return {
    session: {
      id: conversationId,
      userId,
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null,
      lastCompressedAt: null,
      compressionCount: 0,
    },
    messages: [],
    compressions: [],
    memoryConsolidation: createDefaultMemoryConsolidationState(),
  };
}

function normalizeStore(value: unknown, userId: string): UserConversationStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, records: [] };
  }

  const record = value as { records?: unknown };
  const records = Array.isArray(record.records)
    ? record.records.map((item) => normalizeRecord(item, userId)).filter((item): item is ConversationRecord => item !== null)
    : [];
  return { version: 1, records };
}

function normalizeRecord(value: unknown, userId: string): ConversationRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as {
    session?: unknown;
    messages?: unknown;
    compressions?: unknown;
    memoryConsolidation?: unknown;
  };
  const session = normalizeSession(record.session, userId);
  if (!session) {
    return null;
  }

  return {
    session,
    messages: Array.isArray(record.messages)
      ? record.messages.map((item) => normalizeMessage(item, session.id)).filter((item): item is ConversationMessage => item !== null)
      : [],
    compressions: Array.isArray(record.compressions)
      ? record.compressions.map((item) => normalizeCompression(item, session.id)).filter((item): item is ConversationCompression => item !== null)
      : [],
    memoryConsolidation: normalizeMemoryConsolidationState(record.memoryConsolidation),
  };
}

function normalizeSession(value: unknown, userId: string): ConversationSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  if (id.length === 0 || record.userId !== userId) {
    return null;
  }

  return {
    id,
    userId,
    title: typeof record.title === "string" ? record.title : "AI 助手会话",
    status: normalizeConversationStatus(record.status),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
    archivedAt: typeof record.archivedAt === "string" ? record.archivedAt : null,
    deletedAt: typeof record.deletedAt === "string" ? record.deletedAt : null,
    lastCompressedAt: typeof record.lastCompressedAt === "string" ? record.lastCompressedAt : null,
    compressionCount: typeof record.compressionCount === "number" ? Math.max(0, Math.trunc(record.compressionCount)) : 0,
  };
}

function createDefaultMemoryConsolidationState(): AssistantMemoryConsolidationState {
  return {
    version: 1,
    status: "never",
    lastConsolidatedMessageId: null,
    lastAttemptedMessageId: null,
    lastConsolidatedAt: null,
    pendingTrailingRun: false,
    runningTaskId: null,
    consecutiveFailureCount: 0,
    trailingRunCount: 0,
    lastErrorCode: null,
    explicitWriteMessageIds: [],
    updatedAt: null,
  };
}

function normalizeMemoryConsolidationState(value: unknown): AssistantMemoryConsolidationState {
  const defaults = createDefaultMemoryConsolidationState();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  return {
    version: 1,
    status: normalizeMemoryConsolidationStatus(record.status),
    lastConsolidatedMessageId: optionalString(record.lastConsolidatedMessageId),
    lastAttemptedMessageId: optionalString(record.lastAttemptedMessageId),
    lastConsolidatedAt: optionalString(record.lastConsolidatedAt),
    pendingTrailingRun: record.pendingTrailingRun === true,
    runningTaskId: optionalString(record.runningTaskId),
    consecutiveFailureCount: normalizeNonNegativeInt(record.consecutiveFailureCount),
    trailingRunCount: normalizeNonNegativeInt(record.trailingRunCount),
    lastErrorCode: optionalString(record.lastErrorCode),
    explicitWriteMessageIds: Array.isArray(record.explicitWriteMessageIds)
      ? record.explicitWriteMessageIds.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt: optionalString(record.updatedAt),
  };
}

function cloneMemoryConsolidationState(
  state: AssistantMemoryConsolidationState,
): AssistantMemoryConsolidationState {
  return {
    ...state,
    explicitWriteMessageIds: [...state.explicitWriteMessageIds],
  };
}

function normalizeMemoryConsolidationStatus(value: unknown): AssistantMemoryConsolidationStatus {
  switch (value) {
    case "skipped_not_enough_turns":
    case "skipped_explicit_write":
    case "skipped_model_unavailable":
    case "succeeded":
    case "failed":
    case "circuit_open":
      return value;
    default:
      return "never";
  }
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function normalizeMessage(value: unknown, conversationId: string): ConversationMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string"
    || record.conversationId !== conversationId
    || !isMessageRole(record.role)
    || typeof record.visibleContent !== "string"
    || typeof record.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    conversationId,
    role: record.role,
    visibleContent: limitVisibleContent(record.visibleContent),
    createdAt: record.createdAt,
    ...(typeof record.archivedAt === "string" ? { archivedAt: record.archivedAt } : {}),
    ...(typeof record.compressionId === "string" ? { compressionId: record.compressionId } : {}),
  };
}

function normalizeCompression(value: unknown, conversationId: string): ConversationCompression | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string"
    || record.conversationId !== conversationId
    || !isCompressionReasonValue(record.reason)
    || (record.trigger !== "manual_button" && record.trigger !== "conversation_command" && record.trigger !== "auto_budget")
    || typeof record.summaryText !== "string"
    || typeof record.createdAt !== "string"
  ) {
    return null;
  }

  const emptySummary = createStructuredCompressionSummary([]);
  return {
    id: record.id,
    conversationId,
    reason: record.reason,
    trigger: record.trigger,
    summary: isStructuredSummary(record.summary) ? record.summary : emptySummary,
    summaryText: record.summaryText,
    beforeEstimatedTokens: numberOrZero(record.beforeEstimatedTokens),
    afterEstimatedTokens: numberOrZero(record.afterEstimatedTokens),
    archivedMessageCount: numberOrZero(record.archivedMessageCount),
    retainedMessageCount: numberOrZero(record.retainedMessageCount),
    compressedThroughMessageId: typeof record.compressedThroughMessageId === "string" ? record.compressedThroughMessageId : "",
    createdAt: record.createdAt,
    compressorKind: "local_structured_v1",
  };
}

function isStructuredSummary(value: unknown): value is ConversationCompression["summary"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return [
    "userCurrentGoal",
    "confirmedFacts",
    "explicitConstraints",
    "decisionsMade",
    "unresolvedQuestions",
    "importantCodeOrErrorClues",
    "recentConversationState",
  ].every((key) => Array.isArray(record[key]));
}

function findRecord(
  store: UserConversationStore,
  conversationId: string,
): ConversationRecord | null {
  return store.records.find((record) => record.session.id === conversationId) ?? null;
}

function toListItem(record: ConversationRecord): AssistantConversationListItem {
  const activeMessages = record.messages.filter((message) => message.archivedAt === undefined);
  const recentMessage = [...activeMessages]
    .reverse()
    .find((message) => message.role === "user" || message.role === "assistant");
  return {
    id: record.session.id,
    title: record.session.title,
    status: sessionStatus(record.session),
    recentMessagePreview: recentMessage ? limitPreview(recentMessage.visibleContent) : "暂无消息",
    messageCount: record.messages.length,
    activeMessageCount: activeMessages.length,
    archivedMessageCount: record.messages.length - activeMessages.length,
    compressionCount: record.session.compressionCount,
    longTermMemoryCount: 0,
    createdAt: record.session.createdAt,
    updatedAt: record.session.updatedAt,
    archivedAt: record.session.archivedAt ?? null,
    deletedAt: record.session.deletedAt ?? null,
  };
}

function updateTitle(currentTitle: string, message: ConversationMessage): string {
  if (currentTitle !== "AI 助手会话" || message.role !== "user") {
    return currentTitle;
  }
  const normalized = message.visibleContent.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 32) : currentTitle;
}

function normalizeTitle(value: string, fallback: string): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 48) : fallback;
}

function normalizeConversationStatus(value: unknown): AssistantConversationStatus {
  return value === "archived" || value === "deleted" ? value : "active";
}

function sessionStatus(session: ConversationSession): AssistantConversationStatus {
  return normalizeConversationStatus(session.status);
}

function limitPreview(value: string): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length <= 80 ? normalized : `${normalized.slice(0, 77).trimEnd()}...`;
}

function defaultConversationStoreDir(): string {
  return path.join(findWorkspaceRoot(process.cwd()), ".codex_tmp", "a505-assistant-conversations");
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
    throw new AssistantConversationRepositoryError(
      "conversation_not_owned",
      "需要可信服务端用户身份。",
    );
  }
  return normalized;
}

function normalizeConversationId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function requireConversationId(value: string): string {
  const normalized = normalizeConversationId(value);
  if (!normalized) {
    throw new AssistantConversationRepositoryError(
      "conversation_not_found",
      "会话不存在。",
    );
  }
  return normalized;
}

function createConversationId(): string {
  return `assistant-conv-${randomUUID()}`;
}

function createMessageId(role: ConversationMessageRole): string {
  return `assistant-${role}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function createCompressionId(): string {
  return `assistant-compression-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function safeFileSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 120);
}

function limitVisibleContent(value: string): string {
  return String(value ?? "").replace(/\s+$/g, "").slice(0, 4000);
}

function isMessageRole(value: unknown): value is ConversationMessageRole {
  return value === "user" || value === "assistant" || value === "system";
}

function isCompressionReasonValue(value: unknown): value is CompressionReason {
  return value === CompressionReason.ContextBudget
    || value === CompressionReason.UserRequested
    || value === CompressionReason.ConversationBoundary;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
