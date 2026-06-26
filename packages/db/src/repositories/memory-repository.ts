import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  AddMemoryInput,
  DeleteMemoryInput,
  ListMemoriesByOwnerInput,
  MemoryRecord,
  MemoryRecordCategory,
  MemoryRecordSource,
  MemoryRepository,
  ToggleMemoryEnabledInput,
} from "../types.js";

const MAX_MEMORY_CONTENT_LENGTH = 500;
const MAX_MEMORIES_PER_USER = 100;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

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

    await assertMemoryQuota(this.prisma, userId);

    const metadata = normalizeMetadata(input.metadata, {
      category,
      source,
      enabled,
    });

    const created = await this.prisma.memoryItem.create({
      data: {
        userId,
        sessionId,
        sourceMessageId,
        memoryType: mapCategoryToMemoryType(category),
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

      await this.prisma.memoryItem.delete({
        where: { id: memoryId },
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
}

async function assertMemoryQuota(prisma: PrismaClient, userId: string): Promise<void> {
  const count = await prisma.memoryItem.count({ where: { userId } });
  if (count >= MAX_MEMORIES_PER_USER) {
    throw new Error(`Memory limit reached. Max ${MAX_MEMORIES_PER_USER} items per user.`);
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
): Prisma.InputJsonValue {
  const base = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  base.category = defaults.category;
  base.source = defaults.source;
  base.enabled = defaults.enabled;
  return base as Prisma.InputJsonObject;
}

function mergeMetadata(metadata: unknown, patch: { enabled: boolean }): Prisma.InputJsonValue {
  const base = metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {};
  base.enabled = patch.enabled;
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
