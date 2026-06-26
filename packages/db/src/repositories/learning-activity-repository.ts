import type { PrismaClient } from "@prisma/client";

import type {
  LearningActivityTargetType,
  LearningActivityType,
  LearningActivityRecord,
  LearningActivityRepository,
  ListLearningActivitiesByOwnerInput,
  RecordLearningActivityInput,
} from "../types.js";

/** Runtime constants — mirror the types.ts sets for use in validation. */
const VALID_ACTIVITY_TYPES_SET: ReadonlySet<string> = new Set([
  "read-book",
  "practice-problem",
  "favorite-book",
  "favorite-problem",
  "add-note",
  "add-bookmark",
  "import-book",
  "daily_challenge_completed",
]);

const VALID_TARGET_TYPES_SET: ReadonlySet<string> = new Set([
  "book",
  "chapter",
  "problem",
  "note",
  "bookmark",
]);

/**
 * Prisma-backed LearningActivityRepository for dev-only learning activity timeline.
 *
 * ALL methods are dev-only. The guard (learning-activity-db-guard) must pass
 * before any method is called.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 *
 * @devOnly — not production-ready
 */
export class PrismaLearningActivityRepository implements LearningActivityRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async recordLearningActivity(
    input: RecordLearningActivityInput,
  ): Promise<LearningActivityRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const activityType = normalizeActivityType(input.activityType);
    const title = normalizeRequiredText(input.title, "title required").slice(0, 300);
    const targetType = normalizeTargetType(input.targetType);
    const targetId = normalizeRequiredText(input.targetId, "targetId required");
    const bookId = normalizeOptionalText(input.bookId, 200);
    const chapterId = normalizeOptionalText(input.chapterId, 200);
    const problemId = normalizeOptionalText(input.problemId, 200);
    const sourceType = normalizeRequiredText(input.sourceType, "sourceType required");
    const occurredAt = normalizeDate(input.occurredAt);
    const durationSeconds = normalizeDuration(input.durationSeconds);
    const metadataPreview = normalizeMetadataPreview(input.metadataPreview);

    const record = await this.prisma.learningActivity.create({
      data: {
        userId,
        activityType,
        title,
        targetType,
        targetId,
        bookId,
        chapterId,
        problemId,
        sourceType,
        occurredAt,
        durationSeconds,
        metadataPreview,
      },
    });
    return mapLearningActivityRecord(record);
  }

  async listLearningActivitiesByOwner(
    input: ListLearningActivitiesByOwnerInput,
  ): Promise<LearningActivityRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    const where: { userId: string; activityType?: string } = { userId };
    if (input.activityType !== undefined) {
      const at = normalizeActivityType(input.activityType);
      where.activityType = at;
    }

    const records = await this.prisma.learningActivity.findMany({
      where,
      take: limit,
      orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
    });
    return records.map(mapLearningActivityRecord);
  }
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeActivityType(value: string): LearningActivityType {
  const normalized = value.trim();
  if (!VALID_ACTIVITY_TYPES_SET.has(normalized)) {
    throw new Error(
      `Invalid activityType "${normalized}". Must be one of: ${Array.from(VALID_ACTIVITY_TYPES_SET).join(", ")}.`,
    );
  }
  return normalized as LearningActivityType;
}

function normalizeTargetType(value: string): LearningActivityTargetType {
  const normalized = value.trim();
  if (!VALID_TARGET_TYPES_SET.has(normalized)) {
    throw new Error(
      `Invalid targetType "${normalized}". Must be one of: ${Array.from(VALID_TARGET_TYPES_SET).join(", ")}.`,
    );
  }
  return normalized as LearningActivityTargetType;
}

function normalizeDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return new Date();
  }
  return value;
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  // Max 8 hours (28800 seconds)
  return Math.min(Math.trunc(value), 28800);
}

function normalizeMetadataPreview(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 500);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function mapLearningActivityRecord(record: {
  id: string;
  userId: string;
  activityType: string;
  title: string;
  targetType: string;
  targetId: string;
  bookId: string | null;
  chapterId: string | null;
  problemId: string | null;
  sourceType: string;
  occurredAt: Date;
  durationSeconds: number | null;
  metadataPreview: string | null;
  createdAt: Date;
}): LearningActivityRecord {
  return {
    id: record.id,
    userId: record.userId,
    activityType: normalizeActivityType(record.activityType),
    title: record.title,
    targetType: normalizeTargetType(record.targetType),
    targetId: record.targetId,
    bookId: record.bookId,
    chapterId: record.chapterId,
    problemId: record.problemId,
    sourceType: record.sourceType,
    occurredAt: record.occurredAt,
    durationSeconds: record.durationSeconds,
    metadataPreview: record.metadataPreview,
    createdAt: record.createdAt,
  };
}
