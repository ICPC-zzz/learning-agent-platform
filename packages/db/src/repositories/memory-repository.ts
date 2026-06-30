import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  AddMemoryInput,
  DeleteMemoryInput,
  DeleteConversationMemoriesInput,
  ListMemoriesByOwnerInput,
  MemoryRecord,
  MemoryRecordCategory,
  MemoryLifecycleStatus,
  MemoryRecordSource,
  MemoryRepository,
  ToggleMemoryEnabledInput,
  UpdateMemoryMetadataInput,
  UpdateConversationMemoryLifecycleInput,
} from "../types.js";

const MAX_MEMORY_CONTENT_LENGTH = 500;
const MAX_MEMORIES_PER_USER = 100;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DELETED_MEMORY_CONTENT_PLACEHOLDER = "Deleted long-term memory. Safe tombstone retained.";

const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bdatabase_url\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bverification[_\s-]*code\b/i,
];

export class PrismaMemoryRepository implements MemoryRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listMemoriesByOwner(
    input: ListMemoriesByOwnerInput,
  ): Promise<MemoryRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeLimit(input.limit);
    const includeDisabled = input.includeDisabled === true;

    const records = await this.prisma.memoryItem.findMany({
      where: { userId },
      take: MAX_MEMORIES_PER_USER,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });

    return records
      .map(mapRecord)
      .filter((record) => includeDisabled || record.enabled)
      .slice(0, limit);
  }

  async addMemory(input: AddMemoryInput): Promise<MemoryRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const content = normalizeContent(input.content);
    const category = normalizeCategory(input.category);
    const source = normalizeSource(input.source);
    const enabled = input.enabled !== false;
    const importance = normalizeImportance(input.importance);
    const sessionId = normalizeOptionalText(input.sessionId);
    const sourceMessageId = normalizeOptionalText(input.sourceMessageId);
    const foreignRefs = await resolveMemoryForeignRefs(this.prisma, {
      sessionId,
      sourceMessageId,
    });

    await assertMemoryQuota(this.prisma, userId);

    const metadata = preserveExternalReferenceMetadata(
      normalizeMetadata(input.metadata, {
        category,
        source,
        enabled,
      }),
      {
        sessionId,
        sourceMessageId,
        dbSessionId: foreignRefs.sessionId,
        dbSourceMessageId: foreignRefs.sourceMessageId,
      },
    );

    const created = await this.prisma.memoryItem.create({
      data: {
        userId,
        sessionId: foreignRefs.sessionId,
        sourceMessageId: foreignRefs.sourceMessageId,
        memoryType: resolveMemoryType(input.metadata, category),
        content,
        importance,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return mapRecord(created);
  }

  async toggleMemoryEnabled(
    input: ToggleMemoryEnabledInput,
  ): Promise<MemoryRecord | null> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const memoryId = normalizeRequiredText(input.memoryId, "memoryId required");

    const existing = await this.prisma.memoryItem.findFirst({
      where: { id: memoryId, userId },
    });

    if (!existing) {
      return null;
    }

    const metadata = mergeMetadata(existing.metadata, {
      enabled: input.enabled,
    });

    const updated = await this.prisma.memoryItem.update({
      where: { id: memoryId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });

    return mapRecord(updated);
  }

  async deleteMemory(input: DeleteMemoryInput): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const memoryId = normalizeRequiredText(input.memoryId, "memoryId required");

    try {
      const existing = await this.prisma.memoryItem.findFirst({
        where: { id: memoryId, userId },
      });

      if (!existing) {
        return false;
      }

      if (shouldPhysicallyDeleteMemory(existing)) {
        await this.prisma.memoryItem.delete({
          where: { id: memoryId },
        });
        return true;
      }

      const deletedAt = new Date().toISOString();
      await this.prisma.memoryItem.update({
        where: { id: memoryId },
        data: {
          content: DELETED_MEMORY_CONTENT_PLACEHOLDER,
          metadata: mergeMetadata(existing.metadata, {
            enabled: false,
            lifecycleStatus: "deleted",
            deletedAt,
            tombstone: {
              contentFingerprint: createMemoryContentFingerprint(existing.content),
              deletedAt,
              source: "user_delete",
            },
          }) as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2025"
      ) {
        return false;
      }
      throw error;
    }
  }

  async updateMemoryMetadata(
    input: UpdateMemoryMetadataInput,
  ): Promise<MemoryRecord | null> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const memoryId = normalizeRequiredText(input.memoryId, "memoryId required");

    const existing = await this.prisma.memoryItem.findFirst({
      where: { id: memoryId, userId },
    });
    if (!existing) {
      return null;
    }

    const data: Prisma.MemoryItemUpdateInput = {};
    if (input.content !== undefined) {
      data.content = normalizeContent(input.content);
    }
    data.metadata = mergeMetadata(existing.metadata, {
      ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
      ...(input.metadata !== undefined && input.metadata !== null && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? input.metadata as Record<string, unknown>
        : {}),
    }) as Prisma.InputJsonValue;

    const updated = await this.prisma.memoryItem.update({
      where: { id: memoryId },
      data,
    });
    return mapRecord(updated);
  }

  async updateConversationMemoryLifecycle(
    input: UpdateConversationMemoryLifecycleInput,
  ): Promise<MemoryRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId required");
    const lifecycleStatus = normalizeLifecycleStatus(input.lifecycleStatus);
    const records = await this.prisma.memoryItem.findMany({
      where: { userId },
      take: MAX_MEMORIES_PER_USER,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    const targets = records.filter((record) =>
      record.memoryType === "RETRIEVABLE"
      && memoryBelongsToConversation(record, conversationId),
    );

    const updated = await Promise.all(
      targets.map((record) =>
        this.prisma.memoryItem.update({
          where: { id: record.id },
          data: {
            metadata: mergeMetadata(record.metadata, {
              enabled: lifecycleStatus === "active",
              lifecycleStatus,
              sourceConversationId: conversationId,
              updatedAt: new Date().toISOString(),
            }) as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    return updated.map(mapRecord);
  }

  async deleteConversationMemories(
    input: DeleteConversationMemoriesInput,
  ): Promise<number> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const conversationId = normalizeRequiredText(input.conversationId, "conversationId required");
    const records = await this.prisma.memoryItem.findMany({
      where: { userId },
      take: MAX_MEMORIES_PER_USER,
    });
    const targets = records.filter((record) =>
      record.sessionId === conversationId
      || memoryBelongsToConversation(record, conversationId),
    );
    const deletedAt = new Date().toISOString();
    await Promise.all(
      targets.map((record) =>
        shouldPhysicallyDeleteMemory(record)
          ? this.prisma.memoryItem.delete({ where: { id: record.id } })
          : this.prisma.memoryItem.update({
              where: { id: record.id },
              data: {
                content: DELETED_MEMORY_CONTENT_PLACEHOLDER,
                metadata: mergeMetadata(record.metadata, {
                  enabled: false,
                  lifecycleStatus: "deleted",
                  sourceConversationId: conversationId,
                  deletedAt,
                  tombstone: {
                    contentFingerprint: createMemoryContentFingerprint(record.content),
                    deletedAt,
                    source: "conversation_delete",
                    sourceConversationId: conversationId,
                  },
                }) as Prisma.InputJsonValue,
              },
            }),
      ),
    );
    return targets.length;
  }
}

async function assertMemoryQuota(prisma: PrismaClient, userId: string): Promise<void> {
  const count = await prisma.memoryItem.count({ where: { userId } });
  if (count >= MAX_MEMORIES_PER_USER) {
    throw new Error(`Memory limit reached. Max ${MAX_MEMORIES_PER_USER} items per user.`);
  }
}

async function resolveMemoryForeignRefs(
  prisma: PrismaClient,
  input: {
    sessionId: string | null;
    sourceMessageId: string | null;
  },
): Promise<{
  sessionId: string | null;
  sourceMessageId: string | null;
}> {
  const [sessionExists, sourceMessageExists] = await Promise.all([
    input.sessionId ? agentSessionExists(prisma, input.sessionId) : Promise.resolve(false),
    input.sourceMessageId ? agentMessageExists(prisma, input.sourceMessageId) : Promise.resolve(false),
  ]);

  return {
    sessionId: sessionExists ? input.sessionId : null,
    sourceMessageId: sourceMessageExists ? input.sourceMessageId : null,
  };
}

async function agentSessionExists(prisma: PrismaClient, sessionId: string): Promise<boolean> {
  try {
    const record = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    return record !== null;
  } catch {
    return false;
  }
}

async function agentMessageExists(prisma: PrismaClient, messageId: string): Promise<boolean> {
  try {
    const record = await prisma.agentMessage.findUnique({
      where: { id: messageId },
      select: { id: true },
    });
    return record !== null;
  } catch {
    return false;
  }
}

function mapRecord(record: {
  id: string;
  userId: string;
  sessionId: string | null;
  sourceMessageId: string | null;
  memoryType: string;
  content: string;
  importance: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MemoryRecord {
  const metadata = normalizeMetadataValue(record.metadata);
  return {
    id: record.id,
    userId: record.userId,
    sessionId: record.sessionId,
    sourceMessageId: record.sourceMessageId,
    memoryType: mapMemoryType(record.memoryType),
    content: record.content,
    category: metadata.category,
    source: metadata.source,
    enabled: metadata.enabled,
    importance: normalizeImportance(record.importance),
    metadata: record.metadata === null ? null : record.metadata as MemoryRecord["metadata"],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeMetadata(
  metadata: unknown,
  defaults: { category: MemoryRecordCategory; source: MemoryRecordSource; enabled: boolean },
): Prisma.InputJsonObject {
  const base = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  base.category = defaults.category;
  base.source = defaults.source;
  base.enabled = defaults.enabled;
  return base as Prisma.InputJsonObject;
}

function preserveExternalReferenceMetadata(
  metadata: Prisma.InputJsonObject,
  refs: {
    sessionId: string | null;
    sourceMessageId: string | null;
    dbSessionId: string | null;
    dbSourceMessageId: string | null;
  },
): Prisma.InputJsonObject {
  const next: Record<string, unknown> = { ...metadata };

  if (refs.sessionId !== null) {
    if (typeof next.sourceConversationId !== "string") {
      next.sourceConversationId = refs.sessionId;
    }
    if (refs.dbSessionId === null) {
      if (typeof next.externalSessionId !== "string") {
        next.externalSessionId = refs.sessionId;
      }
      next.sessionReferenceKind = "external";
    } else if (typeof next.sessionReferenceKind !== "string") {
      next.sessionReferenceKind = "prisma";
    }
  }

  if (refs.sourceMessageId !== null) {
    if (typeof next.sourceMessageId !== "string") {
      next.sourceMessageId = refs.sourceMessageId;
    }
    if (refs.dbSourceMessageId === null) {
      if (typeof next.externalSourceMessageId !== "string") {
        next.externalSourceMessageId = refs.sourceMessageId;
      }
      next.sourceMessageReferenceKind = "external";
    } else if (typeof next.sourceMessageReferenceKind !== "string") {
      next.sourceMessageReferenceKind = "prisma";
    }
  }

  return next as Prisma.InputJsonObject;
}

function mergeMetadata(
  metadata: unknown,
  patch: Record<string, unknown> & {
    enabled?: boolean;
    lifecycleStatus?: MemoryLifecycleStatus;
    sourceConversationId?: string;
    updatedAt?: string;
  },
): Prisma.InputJsonValue {
  const base = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  if (typeof patch.enabled === "boolean") base.enabled = patch.enabled;
  if (patch.lifecycleStatus) base.lifecycleStatus = patch.lifecycleStatus;
  if (patch.sourceConversationId) base.sourceConversationId = patch.sourceConversationId;
  if (patch.updatedAt) base.lifecycleUpdatedAt = patch.updatedAt;
  for (const [key, value] of Object.entries(patch)) {
    if (
      key === "enabled"
      || key === "lifecycleStatus"
      || key === "sourceConversationId"
      || key === "updatedAt"
    ) {
      continue;
    }
    if (value !== undefined) {
      base[key] = value;
    }
  }
  if (typeof base.category !== "string") base.category = "other";
  if (typeof base.source !== "string") base.source = "user_created";
  return base as Prisma.InputJsonObject;
}

function normalizeMetadataValue(metadata: unknown): {
  category: MemoryRecordCategory;
  source: MemoryRecordSource;
  enabled: boolean;
} {
  const record = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  return {
    category: normalizeCategory(typeof record.category === "string" ? record.category : undefined),
    source: normalizeSource(typeof record.source === "string" ? record.source : undefined),
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
  };
}

function mapCategoryToMemoryType(category: MemoryRecordCategory): "PROFILE" | "RETRIEVABLE" | "SESSION_SUMMARY" {
  if (category === "preference") return "PROFILE";
  if (category === "goal") return "SESSION_SUMMARY";
  return "RETRIEVABLE";
}

function resolveMemoryType(
  metadata: AddMemoryInput["metadata"] | undefined,
  category: MemoryRecordCategory,
): "PROFILE" | "RETRIEVABLE" | "SESSION_SUMMARY" {
  if (metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)) {
    const requested = (metadata as Record<string, unknown>).memoryType;
    if (typeof requested === "string") {
      return mapMemoryType(requested);
    }
  }
  return mapCategoryToMemoryType(category);
}

function mapMemoryType(memoryType: string): "PROFILE" | "SESSION_SUMMARY" | "RETRIEVABLE" {
  const upper = memoryType.toUpperCase();
  if (upper === "PROFILE" || upper === "SESSION_SUMMARY" || upper === "RETRIEVABLE") {
    return upper as "PROFILE" | "SESSION_SUMMARY" | "RETRIEVABLE";
  }
  return "RETRIEVABLE";
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeContent(content: string): string {
  const normalized = normalizeRequiredText(content, "content required");
  if (normalized.length > MAX_MEMORY_CONTENT_LENGTH) {
    throw new Error(`Memory content too long. Max ${MAX_MEMORY_CONTENT_LENGTH} chars.`);
  }
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error("Memory content contains sensitive data.");
  }
  return normalized;
}

function normalizeCategory(category: string | undefined): MemoryRecordCategory {
  switch ((category ?? "other").trim()) {
    case "preference":
    case "goal":
    case "learning":
    case "project":
    case "other":
      return (category ?? "other").trim() as MemoryRecordCategory;
    default:
      return "other";
  }
}

function normalizeSource(source: string | undefined): MemoryRecordSource {
  switch ((source ?? "user_created").trim()) {
    case "assistant_suggested":
    case "user_created":
      return (source ?? "user_created").trim() as MemoryRecordSource;
    default:
      return "user_created";
  }
}

function normalizeImportance(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

function normalizeLifecycleStatus(value: string): MemoryLifecycleStatus {
  if (
    value === "historical"
    || value === "archived"
    || value === "superseded"
    || value === "deleted"
  ) {
    return value;
  }
  return "active";
}

function shouldPhysicallyDeleteMemory(record: { memoryType: string; metadata: unknown }): boolean {
  if (record.memoryType === "SESSION_SUMMARY") {
    return true;
  }
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).memoryKind === "session_summary";
}

function createMemoryContentFingerprint(content: string): string {
  return normalizeFingerprintText(content);
}

function normalizeFingerprintText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim()
    .slice(0, 180);
}

function memoryBelongsToConversation(
  record: { metadata: unknown },
  conversationId: string,
): boolean {
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const sourceConversationId = (metadata as Record<string, unknown>).sourceConversationId;
  const legacyConversationId = (metadata as Record<string, unknown>).conversationId;
  return sourceConversationId === conversationId || legacyConversationId === conversationId;
}
