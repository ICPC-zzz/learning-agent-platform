import {
  LlmChatRole,
  type LlmProvider,
} from "@learning-agent-platform/ai-core/llm/llm-provider-contract";
import type { ExternalProviderFetch } from "@learning-agent-platform/ai-core/llm/external-chat-completions-provider";
import {
  buildMemoryContextBundle,
  retrieveRelevantMemories,
  summarizeWorkingMemoryMessages,
  type MemoryMetadata,
  type MemoryItem,
  type WorkingMemoryMessage,
} from "@learning-agent-platform/ai-core/memory";
import type { AddMemoryInput, MemoryRecord, MemoryRecordCategory, MemoryRepository } from "@learning-agent-platform/db";

import type {
  AssistantChatMessage,
  AssistantConversationSnapshot,
  AssistantMemoryInput,
  AssistantMemoryRecord,
  SafeAssistantPageContext,
} from "./assistant-types.ts";
import {
  createDefaultAssistantConversationRepository,
  type AssistantMemoryConsolidationState,
  type FileAssistantConversationRepository,
} from "./assistant-conversation-repository.ts";
import {
  isReadonlyLearningArtifactMemory,
  isUserManagedLongTermMemory,
} from "./learning-artifact-classification.ts";
import {
  extractExplicitLongTermMemory as resolveExplicitLongTermMemory,
  isCodeforcesRefreshReminderMemory,
} from "./assistant-intent-resolver.ts";
import { createOpenAiCompatibleLlmProvider } from "./providers/openai-compatible-llm-provider.ts";

const MAX_PROMPT_MEMORY_ITEMS = 8;
const MAX_PROMPT_MEMORY_CHARS = 1200;
const MAX_RETRIEVED_MEMORY_ITEMS = 5;
const MAX_SESSION_SUMMARY_MESSAGES = 8;

const INTERNAL_SESSION_SUMMARY_KIND = "session_summary";
const CONVERSATION_LONG_TERM_KIND = "conversation_long_term";
const BACKGROUND_CONSOLIDATION_KIND = "background_consolidation";
const ASSISTANT_DEV_AUTH_PROVIDER = "dev-session";
const MEMORY_CONSOLIDATION_DEFAULT_TURN_THRESHOLD = 8;
const MEMORY_CONSOLIDATION_TEST_TURN_THRESHOLD = 2;
const MEMORY_CONSOLIDATION_MAX_SOURCE_MESSAGES = 24;
const MEMORY_CONSOLIDATION_MIN_CONFIDENCE = 0.62;
const MEMORY_CONSOLIDATION_FAILURE_LIMIT = 3;

const runningMemoryConsolidations = new Map<string, Promise<void>>();

export type AssistantMemoryConsolidationCandidateKind =
  | "user_profile"
  | "feedback"
  | "project_context"
  | "external_reference";

export type AssistantMemoryConsolidationCandidateAction =
  | "create"
  | "supersede"
  | "ignore";

export interface AssistantMemoryConsolidationCandidate {
  kind: AssistantMemoryConsolidationCandidateKind;
  content: string;
  confidence: number;
  action?: AssistantMemoryConsolidationCandidateAction;
  targetMemoryId?: string | null;
  sourceMessageIds?: readonly string[];
  category?: AssistantMemoryRecord["category"];
  reasonSummary?: string;
}

export interface AssistantMemoryCandidateProvider {
  readonly kind: string;
  extractCandidates(input: {
    userId: string;
    conversationId: string;
    messages: readonly AssistantMemoryConsolidationMessage[];
    existingMemories: readonly AssistantMemoryRecord[];
  }): Promise<{
    candidates: readonly AssistantMemoryConsolidationCandidate[];
    warnings?: readonly string[];
  }>;
}

export interface AssistantMemoryConsolidationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface AssistantMemoryConsolidationResult {
  status: AssistantMemoryConsolidationState["status"];
  conversationId: string;
  attemptedMessageId: string | null;
  candidatesConsidered: number;
  memoriesCreated: number;
  memoriesSuperseded: number;
  skippedReason?: string;
}

interface AssistantMemoryDbContext {
  repo: MemoryRepository;
  ownerUserId: string;
  externalUserId: string;
  ownerIds: string[];
}

export async function listAssistantMemories(
  userId: string,
  options: { includeInternal?: boolean } = {},
): Promise<AssistantMemoryRecord[]> {
  if (!isNonEmptyString(userId)) {
    return [];
  }

  try {
    const context = await createAssistantMemoryDbContext(userId, {
      throwIfUnavailable: false,
    });
    if (!context) {
      return [];
    }

    const memories = await listMemoriesForOwnerAliases(context.repo, {
      ownerIds: context.ownerIds,
      limit: 100,
      includeDisabled: true,
    });

    return memories
      .map((memory) => toAssistantMemoryRecord(memory))
      .filter((memory) => options.includeInternal === true || isUserVisibleMemoryRecord(memory))
      .filter((memory) => memory.lifecycleStatus !== "deleted");
  } catch {
    return [];
  }
}

export async function listEnabledAssistantMemoriesForPrompt(
  userId: string,
): Promise<AssistantMemoryRecord[]> {
  const memories = await listAssistantMemories(userId);
  const enabledMemories = memories.filter((memory) => memory.enabled && isActiveLifecycle(memory));
  return enabledMemories.slice(0, MAX_PROMPT_MEMORY_ITEMS);
}

export async function listAssistantLongTermMemories(
  userId: string,
): Promise<AssistantMemoryRecord[]> {
  const memories = await listAssistantMemories(userId, { includeInternal: false });
  return memories
    .filter(isUserManagedLongTermMemory)
    .filter((memory) => !isInternalMemoryRecord(memory))
    .filter(isActiveLifecycle);
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
    const context = await createAssistantMemoryDbContext(input.userId as string, {
      throwIfUnavailable: false,
    });
    if (!context) {
      return;
    }

    const repo = context.repo;
    const allMemories = await listMemoriesForOwnerAliases(repo, {
      ownerIds: context.ownerIds,
      limit: 100,
      includeDisabled: true,
    });
    const existingRecords = allMemories.map((memory) => toAssistantMemoryRecord(memory));

    await persistSessionSummary({
      repo,
      userId: context.ownerUserId,
      conversation: input.conversation,
      question: input.question,
      answer: input.answer,
      pageContext: input.pageContext,
      existingRecords,
    });

    await persistConversationLongTermMemory({
      repo,
      userId: context.ownerUserId,
      conversation: input.conversation,
      question: input.question,
      existingRecords,
    });

  } catch {
    // Best-effort only.
  }
}

export async function queueAssistantMemoryConsolidationAfterTurn(input: {
  userId?: string | null;
  conversation?: AssistantConversationSnapshot | null;
  conversationRepository?: FileAssistantConversationRepository;
  memoryRepository?: MemoryRepository;
  memoryOwnerUserId?: string;
  memoryOwnerIds?: readonly string[];
  provider?: AssistantMemoryCandidateProvider | null;
  customFetch?: ExternalProviderFetch;
}): Promise<{ queued: boolean; trailing: boolean; taskId: string | null }> {
  if (!isNonEmptyString(input.userId ?? undefined) || !input.conversation) {
    return { queued: false, trailing: false, taskId: null };
  }

  const userId = input.userId as string;
  const conversationId = input.conversation.conversationId;
  const repository = input.conversationRepository ?? createDefaultAssistantConversationRepository();
  const key = `${userId}::${conversationId}`;
  const taskId = `memory-consolidation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  if (runningMemoryConsolidations.has(key)) {
    await repository.updateMemoryConsolidationState({
      userId,
      conversationId,
      patch: {
        pendingTrailingRun: true,
        runningTaskId: taskId,
      },
    }).catch(() => undefined);
    return { queued: false, trailing: true, taskId };
  }

  const run = runQueuedMemoryConsolidation({
    userId,
    conversationId,
    repository,
    memoryRepository: input.memoryRepository,
    memoryOwnerUserId: input.memoryOwnerUserId,
    memoryOwnerIds: input.memoryOwnerIds,
    provider: input.provider,
    customFetch: input.customFetch,
    taskId,
  }).finally(() => {
    runningMemoryConsolidations.delete(key);
  });
  runningMemoryConsolidations.set(key, run);
  void run.catch(() => undefined);
  return { queued: true, trailing: false, taskId };
}

export async function markAssistantMemoryConsolidationSkippedForExplicitWrite(input: {
  userId: string;
  conversationId: string;
  sourceMessageId: string | null;
  conversationRepository?: FileAssistantConversationRepository;
}): Promise<void> {
  if (!isNonEmptyString(input.userId) || !isNonEmptyString(input.conversationId)) {
    return;
  }

  const repository = input.conversationRepository ?? createDefaultAssistantConversationRepository();
  const state = await repository.getConversation({
    userId: input.userId,
    conversationId: input.conversationId,
  }).catch(() => null);
  const cursor = await repository.getMemoryConsolidationState({
    userId: input.userId,
    conversationId: input.conversationId,
  }).catch(() => null);
  const latestMessageId = state ? latestConversationMessageId(toConsolidationMessagesFromState(state.messages)) : null;
  const explicitWriteMessageIds = new Set(cursor?.explicitWriteMessageIds ?? []);
  if (input.sourceMessageId) {
    explicitWriteMessageIds.add(input.sourceMessageId);
  }

  await repository.updateMemoryConsolidationState({
    userId: input.userId,
    conversationId: input.conversationId,
    patch: {
      status: "skipped_explicit_write",
      lastConsolidatedMessageId: latestMessageId,
      lastAttemptedMessageId: latestMessageId,
      lastConsolidatedAt: new Date().toISOString(),
      pendingTrailingRun: false,
      runningTaskId: null,
      consecutiveFailureCount: 0,
      lastErrorCode: null,
      explicitWriteMessageIds: [...explicitWriteMessageIds],
    },
  }).catch(() => undefined);
}

export async function runAssistantMemoryConsolidationNow(input: {
  userId: string;
  conversationId: string;
  conversationRepository?: FileAssistantConversationRepository;
  memoryRepository?: MemoryRepository;
  memoryOwnerUserId?: string;
  memoryOwnerIds?: readonly string[];
  provider?: AssistantMemoryCandidateProvider | null;
  customFetch?: ExternalProviderFetch;
  force?: boolean;
  env?: Record<string, string | undefined>;
}): Promise<AssistantMemoryConsolidationResult> {
  const repository = input.conversationRepository ?? createDefaultAssistantConversationRepository();
  const env = input.env ?? process.env;
  const state = await repository.getConversation({
    userId: input.userId,
    conversationId: input.conversationId,
  });
  const cursor = await repository.getMemoryConsolidationState({
    userId: input.userId,
    conversationId: input.conversationId,
  });
  const messages = toConsolidationMessagesFromState(state.messages);
  const latestMessageId = latestConversationMessageId(messages);
  const threshold = resolveMemoryConsolidationTurnThreshold(env);
  const userTurnsSinceCursor = countUserTurnsAfter(messages, cursor.lastConsolidatedMessageId);

  if (!latestMessageId || (!input.force && userTurnsSinceCursor < threshold)) {
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "skipped_not_enough_turns",
        lastAttemptedMessageId: latestMessageId,
        runningTaskId: null,
      },
    }).catch(() => undefined);
    return {
      status: "skipped_not_enough_turns",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
      skippedReason: "not_enough_turns",
    };
  }

  if (cursor.consecutiveFailureCount >= MEMORY_CONSOLIDATION_FAILURE_LIMIT) {
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "circuit_open",
        lastAttemptedMessageId: latestMessageId,
        runningTaskId: null,
      },
    }).catch(() => undefined);
    return {
      status: "circuit_open",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
      skippedReason: "consecutive_failures",
    };
  }

  const provider = input.provider ?? createConfiguredAssistantMemoryCandidateProvider({
    customFetch: input.customFetch,
  });
  if (!provider) {
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "skipped_model_unavailable",
        lastAttemptedMessageId: latestMessageId,
        runningTaskId: null,
        lastErrorCode: "model_unavailable",
      },
    }).catch(() => undefined);
    return {
      status: "skipped_model_unavailable",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
      skippedReason: "model_unavailable",
    };
  }

  const dbContext = input.memoryRepository
    ? {
        repo: input.memoryRepository,
        ownerUserId: input.memoryOwnerUserId ?? input.userId,
        externalUserId: input.userId,
        ownerIds: input.memoryOwnerIds?.length
          ? [...input.memoryOwnerIds]
          : uniqueOwnerIds([input.memoryOwnerUserId ?? input.userId, input.userId]),
      }
    : await createAssistantMemoryDbContext(input.userId, {
        throwIfUnavailable: false,
      });
  if (!dbContext) {
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "skipped_model_unavailable",
        lastAttemptedMessageId: latestMessageId,
        runningTaskId: null,
        lastErrorCode: "memory_repository_unavailable",
      },
    }).catch(() => undefined);
    return {
      status: "skipped_model_unavailable",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
      skippedReason: "memory_repository_unavailable",
    };
  }

  try {
    const allMemories = await listMemoriesForOwnerAliases(dbContext.repo, {
      ownerIds: dbContext.ownerIds,
      limit: 100,
      includeDisabled: true,
    });
    const existingRecords = allMemories.map((memory) => toAssistantMemoryRecord(memory));
    const sourceMessages = messagesAfterCursor(messages, cursor.lastConsolidatedMessageId)
      .slice(-MEMORY_CONSOLIDATION_MAX_SOURCE_MESSAGES);
    const extracted = await provider.extractCandidates({
      userId: input.userId,
      conversationId: input.conversationId,
      messages: sourceMessages,
      existingMemories: existingRecords.filter(isPromptEligibleMemory),
    });
    const applied = await applyAssistantMemoryConsolidationCandidates({
      context: dbContext,
      conversationId: input.conversationId,
      providerKind: provider.kind,
      candidates: extracted.candidates,
      existingRecords,
      sourceMessages,
    });
    const now = new Date().toISOString();
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "succeeded",
        lastConsolidatedMessageId: latestMessageId,
        lastAttemptedMessageId: latestMessageId,
        lastConsolidatedAt: now,
        runningTaskId: null,
        consecutiveFailureCount: 0,
        lastErrorCode: null,
      },
    });
    return {
      status: "succeeded",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: extracted.candidates.length,
      memoriesCreated: applied.memoriesCreated,
      memoriesSuperseded: applied.memoriesSuperseded,
    };
  } catch (error: unknown) {
    await repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        status: "failed",
        lastAttemptedMessageId: latestMessageId,
        runningTaskId: null,
        consecutiveFailureCount: cursor.consecutiveFailureCount + 1,
        lastErrorCode: safeMemoryConsolidationErrorCode(error),
      },
    }).catch(() => undefined);
    return {
      status: "failed",
      conversationId: input.conversationId,
      attemptedMessageId: latestMessageId,
      candidatesConsidered: 0,
      memoriesCreated: 0,
      memoriesSuperseded: 0,
      skippedReason: "provider_or_repository_failure",
    };
  }
}

export async function addAssistantMemory(
  userId: string,
  input: AssistantMemoryInput,
): Promise<AssistantMemoryRecord> {
  if (!isNonEmptyString(userId)) {
    throw new Error("userId required");
  }

  const context = await createAssistantMemoryDbContext(userId, {
    throwIfUnavailable: true,
  });
  if (!context) {
    throw new Error("长期记忆服务暂时不可用，请稍后重试。");
  }
  const created = await context.repo.addMemory({
    userId: context.ownerUserId,
    content: input.content,
    category: input.category,
    source: input.source,
    enabled: input.enabled,
    importance: input.importance,
    sessionId: input.sessionId ?? undefined,
    sourceMessageId: input.sourceMessageId ?? undefined,
    metadata: withAssistantOwnerMetadata(
      normalizeMetadataInput(input.metadata, {
        memoryType: input.memoryType ?? "RETRIEVABLE",
        lifecycleStatus: metadataLifecycleStatus(input.metadata),
      }),
      context,
    ),
  });

  return toAssistantMemoryRecord(created);
}

export async function upsertExplicitAssistantLongTermMemory(input: {
  userId: string;
  content: string;
  sourceConversationId: string;
  sourceMessageId: string | null;
  sourceExcerpt: string;
}): Promise<AssistantMemoryRecord> {
  if (!isNonEmptyString(input.userId) || !isNonEmptyString(input.content)) {
    throw new Error("userId and content are required");
  }

  const context = await createAssistantMemoryDbContext(input.userId, {
    throwIfUnavailable: true,
  });
  if (!context) {
    throw new Error("数据库不可用，无法写入长期记忆。");
  }

  const repo = context.repo;
  const existing = await listMemoriesForOwnerAliases(repo, {
    ownerIds: context.ownerIds,
    limit: 100,
    includeDisabled: true,
  });
  const existingRecords = existing.map((memory) => toAssistantMemoryRecord(memory));
  const duplicates = existingRecords.filter((memory) =>
    memory.memoryType === "RETRIEVABLE"
    && memory.lifecycleStatus !== "deleted"
    && isSemanticallySameExplicitMemory(memory.content, input.content)
  );

  await Promise.all(
    duplicates.map((memory) =>
      deleteMemoryForOwnerAliases(repo, context.ownerIds, memory.id).catch(() => false),
    ),
  );

  const created = await repo.addMemory({
    userId: context.ownerUserId,
    content: limitText(input.content, 480),
    category: "learning",
    source: "user_created",
    enabled: true,
    importance: 0.9,
    sessionId: null,
    sourceMessageId: input.sourceMessageId,
    metadata: withAssistantOwnerMetadata({
      memoryType: "RETRIEVABLE",
      memoryKind: CONVERSATION_LONG_TERM_KIND,
      tier: "long_term",
      explicitSource: "user_explicit",
      lifecycleStatus: "active",
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
      sourceExcerpt: limitText(input.sourceExcerpt, 240),
      deduplicatedMemoryIds: duplicates.map((memory) => memory.id),
    }, context),
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

  const context = await createAssistantMemoryDbContext(userId, {
    throwIfUnavailable: false,
  });
  if (!context) {
    return null;
  }

  const updated = await toggleMemoryForOwnerAliases(
    context.repo,
    context.ownerIds,
    memoryId,
    enabled,
  );

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
    const context = await createAssistantMemoryDbContext(userId, {
      throwIfUnavailable: false,
    });
    if (!context) {
      return false;
    }

    return deleteMemoryForOwnerAliases(context.repo, context.ownerIds, memoryId);
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
  const sourceConversationId = metadataSourceConversationId(record.metadata);
  const sourceMessageId = record.sourceMessageId ?? metadataSourceMessageId(record.metadata);
  return {
    id: record.id,
    userId: record.userId,
    sessionId: record.sessionId ?? sourceConversationId,
    sourceMessageId,
    memoryType: normalizeMemoryType(record.memoryType),
    content: record.content,
    category: normalizeCategory(record.category),
    source: normalizeSource(record.source),
    enabled: record.enabled,
    importance: record.importance,
    metadata: record.metadata === null ? null : record.metadata as AssistantMemoryRecord["metadata"],
    lifecycleStatus: metadataLifecycleStatus(record.metadata),
    sourceConversationId,
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
  if (record.sourceConversationId) {
    metadata.sourceConversationId = record.sourceConversationId;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeMetadataInput(
  metadata: Record<string, unknown> | null | undefined,
  defaults: {
    memoryType: AssistantMemoryRecord["memoryType"];
    lifecycleStatus?: AssistantMemoryRecord["lifecycleStatus"];
  },
): AddMemoryInput["metadata"] {
  const base = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
  if (defaults.memoryType) {
    base.memoryType = defaults.memoryType;
  }
  if (defaults.lifecycleStatus && typeof base.lifecycleStatus !== "string") {
    base.lifecycleStatus = defaults.lifecycleStatus;
  }
  return base as AddMemoryInput["metadata"];
}

export async function updateAssistantMemoriesForConversationLifecycle(input: {
  userId: string;
  conversationId: string;
  lifecycleStatus: "active" | "historical" | "archived";
}): Promise<AssistantMemoryRecord[]> {
  if (!isNonEmptyString(input.userId) || !isNonEmptyString(input.conversationId)) {
    return [];
  }

  try {
    const context = await createAssistantMemoryDbContext(input.userId, {
      throwIfUnavailable: false,
    });
    if (!context) {
      return [];
    }

    const updated: MemoryRecord[] = [];
    for (const ownerId of context.ownerIds) {
      const records = (await context.repo.updateConversationMemoryLifecycle?.({
        userId: ownerId,
        conversationId: input.conversationId,
        lifecycleStatus: input.lifecycleStatus,
      })) ?? [];
      updated.push(...records);
    }
    return dedupeMemoryRecords(updated).map((record) => toAssistantMemoryRecord(record));
  } catch {
    return [];
  }
}

export async function deleteAssistantMemoriesForConversation(input: {
  userId: string;
  conversationId: string;
}): Promise<number> {
  if (!isNonEmptyString(input.userId) || !isNonEmptyString(input.conversationId)) {
    return 0;
  }

  try {
    const context = await createAssistantMemoryDbContext(input.userId, {
      throwIfUnavailable: false,
    });
    if (!context) {
      return 0;
    }

    let deleted = 0;
    for (const ownerId of context.ownerIds) {
      deleted += (await context.repo.deleteConversationMemories?.({
        userId: ownerId,
        conversationId: input.conversationId,
      })) ?? 0;
    }
    return deleted;
  } catch {
    return 0;
  }
}

async function runQueuedMemoryConsolidation(input: {
  userId: string;
  conversationId: string;
  repository: FileAssistantConversationRepository;
  memoryRepository?: MemoryRepository;
  memoryOwnerUserId?: string;
  memoryOwnerIds?: readonly string[];
  provider?: AssistantMemoryCandidateProvider | null;
  customFetch?: ExternalProviderFetch;
  taskId: string;
}): Promise<void> {
  await input.repository.updateMemoryConsolidationState({
    userId: input.userId,
    conversationId: input.conversationId,
    patch: {
      runningTaskId: input.taskId,
      pendingTrailingRun: false,
    },
  }).catch(() => undefined);

  await runAssistantMemoryConsolidationNow({
    userId: input.userId,
    conversationId: input.conversationId,
    conversationRepository: input.repository,
    memoryRepository: input.memoryRepository,
    memoryOwnerUserId: input.memoryOwnerUserId,
    memoryOwnerIds: input.memoryOwnerIds,
    provider: input.provider,
    customFetch: input.customFetch,
  });

  const cursor = await input.repository.getMemoryConsolidationState({
    userId: input.userId,
    conversationId: input.conversationId,
  }).catch(() => null);
  if (cursor?.pendingTrailingRun === true && cursor.trailingRunCount < 1) {
    await input.repository.updateMemoryConsolidationState({
      userId: input.userId,
      conversationId: input.conversationId,
      patch: {
        pendingTrailingRun: false,
        trailingRunCount: cursor.trailingRunCount + 1,
      },
    }).catch(() => undefined);
    await runAssistantMemoryConsolidationNow({
      userId: input.userId,
      conversationId: input.conversationId,
      conversationRepository: input.repository,
      memoryRepository: input.memoryRepository,
      memoryOwnerUserId: input.memoryOwnerUserId,
      memoryOwnerIds: input.memoryOwnerIds,
      provider: input.provider,
      customFetch: input.customFetch,
      force: true,
    });
  }
}

function createConfiguredAssistantMemoryCandidateProvider(input: {
  customFetch?: ExternalProviderFetch;
} = {}): AssistantMemoryCandidateProvider | null {
  const bundle = createOpenAiCompatibleLlmProvider({ customFetch: input.customFetch });
  if (!bundle.provider) {
    return null;
  }
  return createLlmAssistantMemoryCandidateProvider(bundle.provider);
}

function createLlmAssistantMemoryCandidateProvider(
  provider: LlmProvider,
): AssistantMemoryCandidateProvider {
  return {
    kind: `llm:${provider.label}`,
    extractCandidates: async (input) => {
      const result = await provider.generate({
        messages: [
          {
            role: LlmChatRole.System,
            content: [
              "Extract durable user memories from the conversation.",
              "Return JSON only: {\"candidates\":[{\"kind\":\"user_profile|feedback|project_context|external_reference\",\"content\":\"...\",\"confidence\":0.0,\"action\":\"create|supersede|ignore\",\"targetMemoryId\":null,\"sourceMessageIds\":[\"...\"],\"reasonSummary\":\"...\"}]}",
              "Only include stable preferences, goals, project constraints, or external references.",
              "Do not include secrets, tokens, passwords, API keys, cookies, transient chat phrasing, or raw diagnostic data.",
              "If nothing is durable, return {\"candidates\":[]}.",
            ].join("\n"),
          },
          {
            role: LlmChatRole.User,
            content: buildMemoryConsolidationProviderPrompt(input),
          },
        ],
        maxInputChars: 6000,
        maxOutputChars: 1800,
        timeoutMs: 20_000,
        purposeSummary: "background long-term memory consolidation candidate extraction",
      });
      if (!result.ok) {
        throw new Error(result.error?.kind ?? "llm_memory_candidate_failed");
      }
      return {
        candidates: parseMemoryConsolidationCandidates(result.answerSummary),
        warnings: result.warnings,
      };
    },
  };
}

async function applyAssistantMemoryConsolidationCandidates(input: {
  context: AssistantMemoryDbContext;
  conversationId: string;
  providerKind: string;
  candidates: readonly AssistantMemoryConsolidationCandidate[];
  existingRecords: readonly AssistantMemoryRecord[];
  sourceMessages: readonly AssistantMemoryConsolidationMessage[];
}): Promise<{ memoriesCreated: number; memoriesSuperseded: number }> {
  let memoriesCreated = 0;
  let memoriesSuperseded = 0;
  const knownSourceMessageIds = new Set(input.sourceMessages.map((message) => message.id));
  const existingFingerprints = new Map<string, AssistantMemoryRecord>();
  const deletedFingerprints = new Set<string>();

  for (const record of input.existingRecords) {
    const fingerprint = memoryFingerprintFromRecord(record);
    if (!fingerprint) {
      continue;
    }
    if (record.lifecycleStatus === "deleted") {
      deletedFingerprints.add(fingerprint);
    } else if (isActiveLifecycle(record)) {
      existingFingerprints.set(fingerprint, record);
    }
  }

  for (const rawCandidate of input.candidates.slice(0, 8)) {
    const candidate = normalizeMemoryConsolidationCandidate(rawCandidate);
    if (!candidate || candidate.action === "ignore" || candidate.confidence < MEMORY_CONSOLIDATION_MIN_CONFIDENCE) {
      continue;
    }
    if (containsSensitiveMemoryText(candidate.content)) {
      continue;
    }

    const fingerprint = createMemoryContentFingerprint(candidate.content);
    if (!fingerprint || deletedFingerprints.has(fingerprint) || existingFingerprints.has(fingerprint)) {
      continue;
    }

    const sourceMessageIds = (candidate.sourceMessageIds ?? [])
      .filter((id) => knownSourceMessageIds.has(id))
      .slice(0, 8);
    if (
      (candidate.action === "supersede" || candidate.targetMemoryId)
      && candidate.targetMemoryId
      && input.context.repo.updateMemoryMetadata
    ) {
      const target = input.existingRecords.find((record) =>
        record.id === candidate.targetMemoryId
        && isActiveLifecycle(record)
        && record.lifecycleStatus !== "deleted"
      );
      if (target) {
        const updated = await updateMemoryMetadataForOwnerAliases(input.context.repo, input.context.ownerIds, {
          memoryId: target.id,
          enabled: false,
          metadata: {
            ...(target.metadata ?? {}),
            lifecycleStatus: "superseded",
            supersededAt: new Date().toISOString(),
            supersededByCandidateFingerprint: fingerprint,
          },
        });
        if (updated) {
          memoriesSuperseded += 1;
        }
      }
    }

    const created = await input.context.repo.addMemory({
      userId: input.context.ownerUserId,
      content: limitText(candidate.content, 480),
      category: memoryCategoryForConsolidationCandidate(candidate),
      source: "assistant_suggested",
      enabled: true,
      importance: normalizeCandidateImportance(candidate.confidence),
      sessionId: null,
      sourceMessageId: sourceMessageIds[0] ?? null,
      metadata: withAssistantOwnerMetadata({
        memoryType: "RETRIEVABLE",
        memoryKind: BACKGROUND_CONSOLIDATION_KIND,
        tier: "long_term",
        lifecycleStatus: "active",
        sourceConversationId: input.conversationId,
        sourceMessageIds,
        sourceMessageId: sourceMessageIds[0] ?? null,
        candidateKind: candidate.kind,
        candidateConfidence: candidate.confidence,
        candidateReasonSummary: limitText(candidate.reasonSummary ?? "", 240),
        candidateProviderKind: input.providerKind,
        contentFingerprint: fingerprint,
        createdBy: "background_memory_consolidation",
      }, input.context),
    });
    existingFingerprints.set(fingerprint, toAssistantMemoryRecord(created));
    memoriesCreated += 1;
  }

  return { memoriesCreated, memoriesSuperseded };
}

async function createAssistantMemoryDbContext(
  userId: string,
  options: { throwIfUnavailable: boolean },
): Promise<AssistantMemoryDbContext | null> {
  const externalUserId = normalizeOwnerText(userId);
  if (!externalUserId) {
    if (options.throwIfUnavailable) {
      throw new Error("长期记忆需要可信服务端用户身份。");
    }
    return null;
  }

  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      if (options.throwIfUnavailable) {
        throw new Error("长期记忆数据库暂时不可用。");
      }
      return null;
    }

    const prisma = db.getPrismaClient();
    const userRepo = new db.PrismaUserRepository(prisma);
    const owner = await userRepo.findOrCreateUser({
      authProvider: ASSISTANT_DEV_AUTH_PROVIDER,
      authProviderId: externalUserId,
      name: externalUserId,
    });

    return {
      repo: new db.PrismaMemoryRepository(prisma),
      ownerUserId: owner.id,
      externalUserId,
      ownerIds: uniqueOwnerIds([owner.id, externalUserId]),
    };
  } catch (error: unknown) {
    if (options.throwIfUnavailable) {
      if (error instanceof Error && /^长期记忆/.test(error.message)) {
        throw error;
      }
      throw new Error("长期记忆服务暂时不可用，请稍后重试。");
    }
    return null;
  }
}

async function listMemoriesForOwnerAliases(
  repo: MemoryRepository,
  input: {
    ownerIds: readonly string[];
    limit: number;
    includeDisabled: boolean;
  },
): Promise<MemoryRecord[]> {
  const records: MemoryRecord[] = [];
  for (const ownerId of input.ownerIds) {
    try {
      records.push(...await repo.listMemoriesByOwner({
        userId: ownerId,
        limit: input.limit,
        includeDisabled: input.includeDisabled,
      }));
    } catch {
      // Legacy owner aliases are best-effort compatibility reads.
    }
  }
  return dedupeMemoryRecords(records).slice(0, input.limit);
}

async function toggleMemoryForOwnerAliases(
  repo: MemoryRepository,
  ownerIds: readonly string[],
  memoryId: string,
  enabled: boolean,
): Promise<MemoryRecord | null> {
  for (const ownerId of ownerIds) {
    const updated = await repo.toggleMemoryEnabled({
      userId: ownerId,
      memoryId,
      enabled,
    }).catch(() => null);
    if (updated) {
      return updated;
    }
  }
  return null;
}

async function deleteMemoryForOwnerAliases(
  repo: MemoryRepository,
  ownerIds: readonly string[],
  memoryId: string,
): Promise<boolean> {
  for (const ownerId of ownerIds) {
    const deleted = await repo.deleteMemory({
      userId: ownerId,
      memoryId,
    }).catch(() => false);
    if (deleted) {
      return true;
    }
  }
  return false;
}

async function updateMemoryMetadataForOwnerAliases(
  repo: MemoryRepository,
  ownerIds: readonly string[],
  input: {
    memoryId: string;
    enabled?: boolean;
    metadata: Record<string, unknown>;
  },
): Promise<MemoryRecord | null> {
  if (!repo.updateMemoryMetadata) {
    return null;
  }
  for (const ownerId of ownerIds) {
    const updated = await repo.updateMemoryMetadata({
      userId: ownerId,
      memoryId: input.memoryId,
      enabled: input.enabled,
      metadata: input.metadata as AddMemoryInput["metadata"],
    }).catch(() => null);
    if (updated) {
      return updated;
    }
  }
  return null;
}

function dedupeMemoryRecords(records: readonly MemoryRecord[]): MemoryRecord[] {
  const byId = new Map<string, MemoryRecord>();
  for (const record of records) {
    byId.set(record.id, record);
  }
  return [...byId.values()].sort((left, right) => {
    const byUpdated = right.updatedAt.getTime() - left.updatedAt.getTime();
    return byUpdated !== 0 ? byUpdated : left.id.localeCompare(right.id);
  });
}

function withAssistantOwnerMetadata(
  metadata: AddMemoryInput["metadata"],
  context: AssistantMemoryDbContext,
): AddMemoryInput["metadata"] {
  const base = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  base.ownerReferenceKind = ASSISTANT_DEV_AUTH_PROVIDER;
  base.ownerUserIdPreview = context.externalUserId;
  return base as AddMemoryInput["metadata"];
}

function uniqueOwnerIds(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeOwnerText(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
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

function toConsolidationMessagesFromState(
  messages: readonly {
    id: string;
    role: string;
    visibleContent: string;
    createdAt: string;
  }[],
): AssistantMemoryConsolidationMessage[] {
  return messages
    .filter((message) =>
      message.role === "user" || message.role === "assistant" || message.role === "system",
    )
    .map((message) => ({
      id: message.id,
      role: message.role as AssistantMemoryConsolidationMessage["role"],
      content: limitText(normalizeStorageText(message.visibleContent), 700),
      createdAt: message.createdAt,
    }))
    .filter((message) => message.content.length > 0);
}

function latestConversationMessageId(
  messages: readonly AssistantMemoryConsolidationMessage[],
): string | null {
  return messages[messages.length - 1]?.id ?? null;
}

function countUserTurnsAfter(
  messages: readonly AssistantMemoryConsolidationMessage[],
  cursorMessageId: string | null,
): number {
  return messagesAfterCursor(messages, cursorMessageId)
    .filter((message) => message.role === "user").length;
}

function messagesAfterCursor(
  messages: readonly AssistantMemoryConsolidationMessage[],
  cursorMessageId: string | null,
): AssistantMemoryConsolidationMessage[] {
  if (!cursorMessageId) {
    return [...messages];
  }
  const index = messages.findIndex((message) => message.id === cursorMessageId);
  return index >= 0 ? messages.slice(index + 1) : [...messages];
}

function resolveMemoryConsolidationTurnThreshold(
  env: Record<string, string | undefined>,
): number {
  return env.NODE_ENV !== "production" && env.LAP_MEMORY_CONSOLIDATION_TEST_MODE === "1"
    ? MEMORY_CONSOLIDATION_TEST_TURN_THRESHOLD
    : MEMORY_CONSOLIDATION_DEFAULT_TURN_THRESHOLD;
}

function buildMemoryConsolidationProviderPrompt(input: {
  userId: string;
  conversationId: string;
  messages: readonly AssistantMemoryConsolidationMessage[];
  existingMemories: readonly AssistantMemoryRecord[];
}): string {
  const messageLines = input.messages
    .slice(-MEMORY_CONSOLIDATION_MAX_SOURCE_MESSAGES)
    .map((message) => `${message.id} | ${message.role} | ${limitText(message.content, 700)}`);
  const memoryLines = input.existingMemories
    .slice(0, 20)
    .map((memory) => `${memory.id} | ${memory.category} | ${limitText(memory.content, 260)}`);
  return [
    `conversationId: ${input.conversationId}`,
    "existingActiveMemories:",
    memoryLines.length > 0 ? memoryLines.join("\n") : "(none)",
    "conversationMessages:",
    messageLines.length > 0 ? messageLines.join("\n") : "(none)",
  ].join("\n");
}

function parseMemoryConsolidationCandidates(
  text: string,
): AssistantMemoryConsolidationCandidate[] {
  const parsed = safeParseJsonObjectOrArray(text);
  const rawCandidates: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).candidates)
      ? (parsed as Record<string, unknown>).candidates as unknown[]
      : [];
  return rawCandidates
    .map((item: unknown) => normalizeMemoryConsolidationCandidate(item))
    .filter((item: AssistantMemoryConsolidationCandidate | null): item is AssistantMemoryConsolidationCandidate => item !== null)
    .slice(0, 8);
}

function safeParseJsonObjectOrArray(text: string): unknown {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
      } catch {
        return null;
      }
    }
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeMemoryConsolidationCandidate(
  value: unknown,
): AssistantMemoryConsolidationCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const content = normalizeStorageText(record.content);
  if (content.length < 8) {
    return null;
  }
  return {
    kind: normalizeCandidateKind(record.kind),
    content: limitText(content, 480),
    confidence: normalizeCandidateConfidence(record.confidence),
    action: normalizeCandidateAction(record.action),
    targetMemoryId: typeof record.targetMemoryId === "string" ? record.targetMemoryId : null,
    sourceMessageIds: Array.isArray(record.sourceMessageIds)
      ? record.sourceMessageIds.filter((item): item is string => typeof item === "string")
      : [],
    category: normalizeCandidateCategory(record.category),
    reasonSummary: typeof record.reasonSummary === "string" ? limitText(record.reasonSummary, 240) : "",
  };
}

function normalizeCandidateKind(value: unknown): AssistantMemoryConsolidationCandidateKind {
  switch (value) {
    case "user_profile":
    case "feedback":
    case "project_context":
    case "external_reference":
      return value;
    default:
      return "project_context";
  }
}

function normalizeCandidateAction(value: unknown): AssistantMemoryConsolidationCandidateAction {
  switch (value) {
    case "supersede":
    case "ignore":
      return value;
    default:
      return "create";
  }
}

function normalizeCandidateCategory(value: unknown): AssistantMemoryRecord["category"] | undefined {
  switch (value) {
    case "preference":
    case "goal":
    case "learning":
    case "project":
    case "other":
      return value;
    default:
      return undefined;
  }
}

function normalizeCandidateConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeCandidateImportance(confidence: number): number {
  return Math.max(0.5, Math.min(0.95, confidence));
}

function memoryCategoryForConsolidationCandidate(
  candidate: AssistantMemoryConsolidationCandidate,
): MemoryRecordCategory {
  if (candidate.category) {
    return candidate.category;
  }
  switch (candidate.kind) {
    case "user_profile":
    case "feedback":
      return "preference";
    case "external_reference":
      return "learning";
    case "project_context":
    default:
      return "project";
  }
}

function memoryFingerprintFromRecord(record: AssistantMemoryRecord): string | null {
  const metadataFingerprint = metadataContentFingerprint(record.metadata);
  if (metadataFingerprint) {
    return metadataFingerprint;
  }
  if (record.lifecycleStatus === "deleted") {
    return null;
  }
  return createMemoryContentFingerprint(record.content);
}

function metadataContentFingerprint(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  if (typeof record.contentFingerprint === "string" && record.contentFingerprint.length > 0) {
    return record.contentFingerprint;
  }
  const tombstone = record.tombstone;
  if (tombstone && typeof tombstone === "object" && !Array.isArray(tombstone)) {
    const fingerprint = (tombstone as Record<string, unknown>).contentFingerprint;
    if (typeof fingerprint === "string" && fingerprint.length > 0) {
      return fingerprint;
    }
  }
  return null;
}

function createMemoryContentFingerprint(content: string): string {
  return normalizeStorageText(content)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 180);
}

function containsSensitiveMemoryText(content: string): boolean {
  return /\b(password|token|secret|api[_\s-]*key|database_url|cookie|session|verification[_\s-]*code)\b/i
    .test(content);
}

function normalizeStorageText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeMemoryConsolidationErrorCode(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return limitText(error.message.replace(/[^a-z0-9_.:-]+/gi, "_").toLowerCase(), 80);
  }
  return "unknown_error";
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
  return memory.enabled && isActiveLifecycle(memory) && !isInternalMemoryRecord(memory);
}

function isUserVisibleMemoryRecord(memory: AssistantMemoryRecord): boolean {
  return !isInternalMemoryRecord(memory) && !isReadonlyLearningArtifactMemory(memory);
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
      sourceConversationId: input.conversation.conversationId,
      lifecycleStatus: "active",
      question: limitText(input.question, 240),
      answer: limitText(input.answer, 240),
      pageType: input.pageContext.pageType,
      route: input.pageContext.route,
      sourceMessageIds: summaryMessages.map((message) => message.id),
    },
  });
}

async function persistConversationLongTermMemory(input: {
  repo: Pick<MemoryRepository, "addMemory">;
  userId: string;
  conversation: AssistantConversationSnapshot;
  question: string;
  existingRecords: AssistantMemoryRecord[];
}): Promise<void> {
  const extracted = resolveExplicitLongTermMemory(input.question);
  if (!extracted) {
    return;
  }
  const candidate = extracted.normalizedMemory;

  const duplicate = input.existingRecords.some((record) =>
    record.memoryType === "RETRIEVABLE"
    && record.lifecycleStatus !== "deleted"
    && isSemanticallySameExplicitMemory(record.content, candidate),
  );
  if (duplicate) {
    return;
  }

  const sourceMessageId = latestUserMessageId(input.conversation.messages);
  await input.repo.addMemory({
    userId: input.userId,
    content: candidate,
    category: "learning",
    source: "user_created",
    enabled: true,
    importance: 0.9,
    sessionId: null,
    sourceMessageId,
    metadata: {
      memoryType: "RETRIEVABLE",
      memoryKind: CONVERSATION_LONG_TERM_KIND,
      tier: "long_term",
      explicitSource: "user_explicit",
      sourceConversationId: input.conversation.conversationId,
      sourceMessageId,
      lifecycleStatus: "active",
      sourceExcerpt: limitText(input.question, 240),
    },
  });
}

function isSemanticallySameExplicitMemory(left: string, right: string): boolean {
  if (isCodeforcesRefreshReminderMemory(left) && isCodeforcesRefreshReminderMemory(right)) {
    return true;
  }
  const a = normalizeComparableMemory(left);
  const b = normalizeComparableMemory(right);
  return a.length > 0 && b.length > 0 && (a === b || a.includes(b) || b.includes(a));
}

function normalizeComparableMemory(value: string): string {
  return normalizeText(value)
    .replace(/[，。！？；：、,.!?;:\s"“”'‘’`~\-—_()[\]（）【】]/g, "");
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

function normalizeOwnerText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isActiveLifecycle(memory: AssistantMemoryRecord): boolean {
  return memory.lifecycleStatus === undefined || memory.lifecycleStatus === "active";
}

function metadataLifecycleStatus(metadata: unknown): AssistantMemoryRecord["lifecycleStatus"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "active";
  }
  const value = (metadata as Record<string, unknown>).lifecycleStatus;
  if (value === "historical" || value === "archived" || value === "superseded" || value === "deleted") {
    return value;
  }
  return "active";
}

function metadataSourceConversationId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const value = record.sourceConversationId ?? record.conversationId ?? record.externalSessionId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function metadataSourceMessageId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const value = record.sourceMessageId ?? record.externalSourceMessageId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
