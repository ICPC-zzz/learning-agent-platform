import {
  buildMemoryContextBundle,
  extractMemoryCandidates,
  isForgetRequest,
  retrieveRelevantMemories,
  summarizeWorkingMemoryMessages,
  type MemoryMetadata,
  type MemoryItem,
  type WorkingMemoryMessage,
} from "@learning-agent-platform/ai-core";
import type { AddMemoryInput, MemoryRepository } from "@learning-agent-platform/db";

import type {
  AssistantChatMessage,
  AssistantConversationSnapshot,
  AssistantMemoryInput,
  AssistantMemoryRecord,
  SafeAssistantPageContext,
} from "./assistant-types.ts";

const MAX_PROMPT_MEMORY_ITEMS = 8;
const MAX_PROMPT_MEMORY_CHARS = 1200;
const MAX_RETRIEVED_MEMORY_ITEMS = 5;
const MAX_SESSION_SUMMARY_MESSAGES = 8;

const INTERNAL_SESSION_SUMMARY_KIND = "session_summary";

export async function listAssistantMemories(
  userId: string,
  options: { includeInternal?: boolean } = {},
): Promise<AssistantMemoryRecord[]> {
  if (!isNonEmptyString(userId)) {
    return [];
  }

  try {
    const { hasDatabaseUrl, getPrismaClient, PrismaMemoryRepository } = await import("@learning-agent-platform/db");
    if (!hasDatabaseUrl()) {
      return [];
    }

    const repo = new PrismaMemoryRepository(getPrismaClient());
    const memories = await repo.listMemoriesByOwner({
      userId,
      limit: 100,
      includeDisabled: true,
    });

    return memories
      .map((memory) => toAssistantMemoryRecord(memory))
      .filter((memory) => options.includeInternal === true || !isInternalMemoryRecord(memory));
  } catch {
    return [];
  }
}

export async function listEnabledAssistantMemoriesForPrompt(
  userId: string,
): Promise<AssistantMemoryRecord[]> {
  const memories = await listAssistantMemories(userId);
  const enabledMemories = memories.filter((memory) => memory.enabled);
  return enabledMemories.slice(0, MAX_PROMPT_MEMORY_ITEMS);
}

export function buildMemoryPromptSummary(memories: readonly AssistantMemoryRecord[]): string {
  if (memories.length === 0) {
    return "";
  }

  return memories
    .slice(0, MAX_PROMPT_MEMORY_ITEMS)
    .map((memory, index) => {
      const prefix = `${index + 1}. [${memory.category}]`;
      const content = limitText(memory.content, MAX_PROMPT_MEMORY_CHARS);
      return `${prefix} ${content}`;
    })
    .join("\n");
}

export async function buildAssistantMemoryContext(
  input: {
    userId?: string | null;
    question: string;
    pageContext: SafeAssistantPageContext;
    conversation?: AssistantConversationSnapshot | null;
  },
): Promise<{
  promptText: string;
  workingMemoryText: string;
  sessionSummaryText: string;
  retrievedMemoryText: string;
  retrievedMemories: AssistantMemoryRecord[];
}> {
  const conversationId = input.conversation?.conversationId ?? "assistant-memory-preview";
  const workingMemoryMessages = toWorkingMemoryMessages(
    normalizeConversationMessages(input.conversation?.messages ?? []),
    conversationId,
  );
  const workingMemoryText = summarizeWorkingMemoryMessages(workingMemoryMessages, {
    maxMessages: MAX_SESSION_SUMMARY_MESSAGES,
    maxChars: MAX_PROMPT_MEMORY_CHARS,
  });

  if (!isNonEmptyString(input.userId ?? undefined)) {
    return {
      promptText: buildMemoryContextBundle({
        workingMessages: workingMemoryMessages,
        memoryBudgetChars: MAX_PROMPT_MEMORY_CHARS,
      }).promptText,
      workingMemoryText,
      sessionSummaryText: "",
      retrievedMemoryText: "",
      retrievedMemories: [],
    };
  }

  const memories = await listAssistantMemories(input.userId as string, { includeInternal: true });
  const sessionSummary = findLatestSessionSummary(memories, input.conversation?.conversationId ?? null);
  const searchableMemories = memories.filter((memory) => isPromptEligibleMemory(memory));
  const query = buildMemorySearchQuery(input.question, input.pageContext, workingMemoryText);
  const retrieved = retrieveRelevantMemories({
    memories: searchableMemories.map(toMemoryItem),
    query,
    limit: MAX_RETRIEVED_MEMORY_ITEMS,
  });
  const retrievedRecords = retrieved
    .map((result) => memories.find((memory) => memory.id === result.item.id))
    .filter((memory): memory is AssistantMemoryRecord => Boolean(memory));

  return {
    promptText: buildMemoryContextBundle({
      workingMessages: workingMemoryMessages,
      sessionSummaryText: sessionSummary?.content ?? "",
      retrievedMemories: retrieved,
      memoryBudgetChars: MAX_PROMPT_MEMORY_CHARS,
    }).promptText,
    workingMemoryText,
    sessionSummaryText: sessionSummary?.content ?? "",
    retrievedMemoryText: buildMemoryPromptSummary(retrievedRecords),
    retrievedMemories: retrievedRecords,
  };
}

export async function persistAssistantMemoryTurn(input: {
  userId?: string | null;
  conversation?: AssistantConversationSnapshot | null;
  question: string;
  answer: string;
  pageContext: SafeAssistantPageContext;
}): Promise<void> {
  if (!isNonEmptyString(input.userId ?? undefined) || !input.conversation) {
    return;
  }

  try {
    const { hasDatabaseUrl, getPrismaClient, PrismaMemoryRepository } = await import("@learning-agent-platform/db");
    if (!hasDatabaseUrl()) {
      return;
    }

    const userId = input.userId as string;
    const repo = new PrismaMemoryRepository(getPrismaClient());
    const allMemories = await repo.listMemoriesByOwner({
      userId,
      limit: 100,
      includeDisabled: true,
    });
    const existingRecords = allMemories.map((memory) => toAssistantMemoryRecord(memory));

    await persistSessionSummary({
      repo,
      userId,
      conversation: input.conversation,
      question: input.question,
      answer: input.answer,
      pageContext: input.pageContext,
      existingRecords,
    });

    await persistLongTermCandidates({
      repo,
      userId,
      conversation: input.conversation,
      existingRecords,
    });
  } catch {
    // Best-effort only.
  }
}

export async function addAssistantMemory(
  userId: string,
  input: AssistantMemoryInput,
): Promise<AssistantMemoryRecord> {
  if (!isNonEmptyString(userId)) {
    throw new Error("userId required");
  }

  const { hasDatabaseUrl, getPrismaClient, PrismaMemoryRepository } = await import("@learning-agent-platform/db");
  if (!hasDatabaseUrl()) {
    throw new Error("Database is unavailable.");
  }

  const repo = new PrismaMemoryRepository(getPrismaClient());
  const created = await repo.addMemory({
    userId,
    content: input.content,
    category: input.category,
    source: input.source,
    enabled: input.enabled,
    importance: input.importance,
    sessionId: input.sessionId ?? undefined,
    sourceMessageId: input.sourceMessageId ?? undefined,
    metadata: normalizeMetadataInput(input.metadata, {
      memoryType: input.memoryType ?? "RETRIEVABLE",
    }),
  });

  return toAssistantMemoryRecord(created);
}

export async function toggleAssistantMemoryEnabled(
  userId: string,
  memoryId: string,
  enabled: boolean,
): Promise<AssistantMemoryRecord | null> {
  if (!isNonEmptyString(userId) || !isNonEmptyString(memoryId)) {
    return null;
  }

  const { hasDatabaseUrl, getPrismaClient, PrismaMemoryRepository } = await import("@learning-agent-platform/db");
  if (!hasDatabaseUrl()) {
    return null;
  }

  const repo = new PrismaMemoryRepository(getPrismaClient());
  const updated = await repo.toggleMemoryEnabled({
    userId,
    memoryId,
    enabled,
  });

  return updated ? toAssistantMemoryRecord(updated) : null;
}

export async function deleteAssistantMemory(
  userId: string,
  memoryId: string,
): Promise<boolean> {
  if (!isNonEmptyString(userId) || !isNonEmptyString(memoryId)) {
    return false;
  }

  try {
    const { hasDatabaseUrl, getPrismaClient, PrismaMemoryRepository } = await import("@learning-agent-platform/db");
    if (!hasDatabaseUrl()) {
      return false;
    }

    const repo = new PrismaMemoryRepository(getPrismaClient());
    return repo.deleteMemory({ userId, memoryId });
  } catch {
    return false;
  }
}

function toAssistantMemoryRecord(record: {
  id: string;
  userId: string;
  sessionId: string | null;
  sourceMessageId: string | null;
  memoryType: string;
  content: string;
  category: string;
  source: string;
  enabled: boolean;
  importance: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AssistantMemoryRecord {
  return {
    id: record.id,
    userId: record.userId,
    sessionId: record.sessionId,
    sourceMessageId: record.sourceMessageId,
    memoryType: normalizeMemoryType(record.memoryType),
    content: record.content,
    category: normalizeCategory(record.category),
    source: normalizeSource(record.source),
    enabled: record.enabled,
    importance: record.importance,
    metadata: record.metadata === null ? null : record.metadata as AssistantMemoryRecord["metadata"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toMemoryItem(record: AssistantMemoryRecord): MemoryItem {
  return {
    id: record.id,
    userId: record.userId,
    sessionId: record.sessionId ?? undefined,
    layer: memoryTypeToLayer(record.memoryType),
    content: record.content,
    importance: record.importance,
    metadata: normalizeRecordMetadata(record),
    createdAt: record.createdAt,
  };
}

function normalizeRecordMetadata(record: AssistantMemoryRecord): MemoryMetadata | undefined {
  const metadata: Record<string, string> = {};

  if (record.memoryType) {
    metadata.memoryType = record.memoryType;
  }
  if (record.sessionId) {
    metadata.sessionId = record.sessionId;
  }
  if (record.sourceMessageId) {
    metadata.sourceMessageId = record.sourceMessageId;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeMetadataInput(
  metadata: Record<string, unknown> | null | undefined,
  defaults: { memoryType: AssistantMemoryRecord["memoryType"] },
): AddMemoryInput["metadata"] {
  const base = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
  if (defaults.memoryType) {
    base.memoryType = defaults.memoryType;
  }
  return base as AddMemoryInput["metadata"];
}

function normalizeCategory(value: string): AssistantMemoryRecord["category"] {
  switch (value) {
    case "preference":
    case "goal":
    case "learning":
    case "project":
    case "other":
      return value;
    default:
      return "other";
  }
}

function normalizeSource(value: string): AssistantMemoryRecord["source"] {
  return value === "assistant_suggested" ? "assistant_suggested" : "user_created";
}

function normalizeMemoryType(value: string): AssistantMemoryRecord["memoryType"] {
  switch (value) {
    case "PROFILE":
    case "SESSION_SUMMARY":
    case "RETRIEVABLE":
      return value;
    default:
      return "RETRIEVABLE";
  }
}

function memoryTypeToLayer(memoryType: AssistantMemoryRecord["memoryType"]): MemoryItem["layer"] {
  if (memoryType === "PROFILE") {
    return "profile";
  }

  if (memoryType === "SESSION_SUMMARY") {
    return "session";
  }

  return "retrievable";
}

function normalizeConversationMessages(
  messages: readonly AssistantChatMessage[],
): readonly AssistantChatMessage[] {
  return messages
    .slice(-MAX_SESSION_SUMMARY_MESSAGES)
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: normalizeText(message.content),
      createdAt: message.createdAt,
      ...(message.actions ? { actions: message.actions } : {}),
      ...(message.state ? { state: message.state } : {}),
      ...(message.providerMode ? { providerMode: message.providerMode } : {}),
    }))
    .filter((message) => message.content.length > 0);
}

function toWorkingMemoryMessages(
  messages: readonly AssistantChatMessage[],
  sessionId: string,
): readonly WorkingMemoryMessage[] {
  return messages.map((message) => ({
    id: message.id,
    sessionId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));
}

function buildMemorySearchQuery(
  question: string,
  pageContext: SafeAssistantPageContext,
  workingMemoryText: string,
): string {
  return [
    question,
    pageContext.pageType,
    pageContext.title ?? "",
    pageContext.summary ?? "",
    workingMemoryText,
  ]
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0)
    .join(" ");
}

function findLatestSessionSummary(
  memories: readonly AssistantMemoryRecord[],
  conversationId: string | null,
): AssistantMemoryRecord | null {
  if (!conversationId) {
    return null;
  }

  return memories
    .filter((memory) => memory.memoryType === "SESSION_SUMMARY" && memory.sessionId === conversationId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

function isPromptEligibleMemory(memory: AssistantMemoryRecord): boolean {
  return memory.enabled && !isInternalMemoryRecord(memory);
}

function isInternalMemoryRecord(memory: AssistantMemoryRecord): boolean {
  return memory.memoryType === "SESSION_SUMMARY"
    || normalizeText(String(memory.metadata && typeof memory.metadata === "object" ? (memory.metadata as Record<string, unknown>).memoryKind : ""))
      === INTERNAL_SESSION_SUMMARY_KIND;
}

async function persistSessionSummary(input: {
  repo: Pick<MemoryRepository, "addMemory" | "deleteMemory">;
  userId: string;
  conversation: AssistantConversationSnapshot;
  question: string;
  answer: string;
  pageContext: SafeAssistantPageContext;
  existingRecords: AssistantMemoryRecord[];
}): Promise<void> {
  const summaryMessages = normalizeConversationMessages(input.conversation.messages);
  if (summaryMessages.length === 0) {
    return;
  }

  const summaryThread = toWorkingMemoryMessages([
    ...summaryMessages,
    {
      id: `${input.conversation.conversationId}-assistant-summary`,
      role: "assistant" as const,
      content: normalizeText(input.answer),
      createdAt: new Date().toISOString(),
    },
  ].filter((message) => normalizeText(message.content).length > 0), input.conversation.conversationId);

  const answerSummaryText = summarizeWorkingMemoryMessages(summaryThread, {
    maxMessages: MAX_SESSION_SUMMARY_MESSAGES,
    maxChars: 800,
  });
  if (answerSummaryText.length === 0) {
    return;
  }

  const latestSummary = findLatestSessionSummary(input.existingRecords, input.conversation.conversationId);
  if (latestSummary && normalizeText(latestSummary.content) === normalizeText(answerSummaryText)) {
    return;
  }

  const previousSummaries = input.existingRecords.filter(
    (record) =>
      record.memoryType === "SESSION_SUMMARY"
      && record.sessionId === input.conversation.conversationId,
  );
  await Promise.all(
    previousSummaries.map((record) =>
      input.repo.deleteMemory({
        userId: input.userId,
        memoryId: record.id,
      }).catch(() => false),
    ),
  );

  const sourceMessageId = latestUserMessageId(summaryMessages);
  await input.repo.addMemory({
    userId: input.userId,
    content: answerSummaryText,
    category: "goal",
    source: "assistant_suggested",
    enabled: true,
    importance: 0.75,
    sessionId: input.conversation.conversationId,
    sourceMessageId,
      metadata: {
      memoryType: "SESSION_SUMMARY",
      memoryKind: INTERNAL_SESSION_SUMMARY_KIND,
      conversationId: input.conversation.conversationId,
      question: limitText(input.question, 240),
      answer: limitText(input.answer, 240),
      pageType: input.pageContext.pageType,
      route: input.pageContext.route,
      sourceMessageIds: summaryMessages.map((message) => message.id),
    },
  });
}

async function persistLongTermCandidates(input: {
  repo: Pick<MemoryRepository, "addMemory">;
  userId: string;
  conversation: AssistantConversationSnapshot;
  existingRecords: AssistantMemoryRecord[];
}): Promise<void> {
  const candidates = extractMemoryCandidates(toWorkingMemoryMessages(
    normalizeConversationMessages(input.conversation.messages),
    input.conversation.conversationId,
  ), {
    limit: 5,
  });
  if (candidates.length === 0) {
    return;
  }

  const existingNormalized = new Set(
    input.existingRecords
      .filter((record) => !isInternalMemoryRecord(record))
      .map((record) => normalizeText(record.content)),
  );

  for (const candidate of candidates) {
    if (candidate.content.length === 0) {
      continue;
    }

    const normalizedContent = normalizeText(candidate.content);
    if (existingNormalized.has(normalizedContent)) {
      continue;
    }

    if (isForgetRequest(candidate.content)) {
      continue;
    }

    existingNormalized.add(normalizedContent);
    await input.repo.addMemory({
      userId: input.userId,
      content: candidate.content,
      category: mapCandidateKindToCategory(candidate.kind),
      source: "assistant_suggested",
      enabled: true,
      importance: Math.max(0.35, Math.min(0.95, candidate.confidence)),
      sessionId: input.conversation.conversationId,
      sourceMessageId: candidate.sourceMessageIds[0] ?? null,
      metadata: {
        memoryType: "RETRIEVABLE",
        memoryKind: candidate.kind,
        conversationId: input.conversation.conversationId,
        sourceMessageIds: candidate.sourceMessageIds,
        sourceExcerpt: candidate.sourceExcerpt ?? candidate.content,
      },
    });
  }
}

function mapCandidateKindToCategory(kind: string): AssistantMemoryRecord["category"] {
  switch (kind) {
    case "preference":
    case "goal":
    case "learning":
    case "project":
      return kind;
    default:
      return "other";
  }
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

function normalizeText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function limitText(value: string, maxChars: number): string {
  const normalized = String(value ?? "");
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function isNonEmptyString(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
