import type { PrismaClient } from "@prisma/client";

import type {
  GetProblemPracticeStatusInput,
  ListProblemPracticeByOwnerInput,
  ProblemPracticeActivityRecord,
  ProblemPracticeRepository,
  ProblemPracticeStatus,
  RecordProblemPracticeInput,
  RemoveProblemPracticeInput,
} from "../types.js";

/**
 * Prisma-backed ProblemPracticeRepository for dev-only practice records.
 *
 * ALL methods are dev-only. The guard (problem-practice-db-guard) must pass
 * before any method is called.
 *
 * Uses the ProblemPracticeActivity model (added in A387 schema).
 * Status transitions are upsert-based — repeated calls for the same
 * userId+problemId update the existing record.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 */
export class PrismaProblemPracticeRepository implements ProblemPracticeRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async recordPractice(
    input: RecordProblemPracticeInput,
  ): Promise<ProblemPracticeActivityRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const problemTitle = normalizeRequiredText(input.problemTitle, "problemTitle required");
    const difficulty = normalizeRequiredText(input.difficulty, "difficulty required");
    const status = normalizeStatus(input.status);
    const tags = normalizeTags(input.tags);

    // Upsert: same userId+problemId updates the existing record
    // We use findFirst + upsert because ProblemPracticeActivity doesn't have
    // a @@unique on (userId, problemId) — only @@index.
    // We use a composite approach: find existing by userId+problemId, then
    // create or update.
    const existing = await this.prisma.problemPracticeActivity.findFirst({
      where: { userId, problemId },
    });

    if (existing !== null) {
      const updated = await this.prisma.problemPracticeActivity.update({
        where: { id: existing.id },
        data: {
          problemTitle,
          difficulty,
          status,
          tags,
        },
      });
      return mapProblemPracticeRecord(updated);
    }

    const created = await this.prisma.problemPracticeActivity.create({
      data: {
        userId,
        problemId,
        problemTitle,
        difficulty,
        status,
        tags,
      },
    });
    return mapProblemPracticeRecord(created);
  }

  async listPracticeByOwner(
    input: ListProblemPracticeByOwnerInput,
  ): Promise<ProblemPracticeActivityRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    const records = await this.prisma.problemPracticeActivity.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    return records.map(mapProblemPracticeRecord);
  }

  async getProblemPracticeStatus(
    input: GetProblemPracticeStatusInput,
  ): Promise<ProblemPracticeActivityRecord | null> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    const record = await this.prisma.problemPracticeActivity.findFirst({
      where: { userId, problemId },
    });
    return record === null ? null : mapProblemPracticeRecord(record);
  }

  async removeProblemPractice(
    input: RemoveProblemPracticeInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    try {
      const existing = await this.prisma.problemPracticeActivity.findFirst({
        where: { userId, problemId },
      });

      if (existing === null) {
        return false;
      }

      await this.prisma.problemPracticeActivity.delete({
        where: { id: existing.id },
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

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "not-started",
  "practiced",
  "completed",
  "needs-review",
]);

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }
  return normalized;
}

function normalizeStatus(status: ProblemPracticeStatus): ProblemPracticeStatus {
  const normalized = status.trim();
  if (!VALID_STATUSES.has(normalized)) {
    throw new Error(
      `Invalid practice status "${normalized}". Must be one of: ${Array.from(VALID_STATUSES).join(", ")}.`,
    );
  }
  return normalized as ProblemPracticeStatus;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 50);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function mapProblemPracticeRecord(record: {
  id: string;
  userId: string;
  problemId: string;
  problemTitle: string;
  difficulty: string;
  status: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): ProblemPracticeActivityRecord {
  return {
    ...record,
    status: normalizeStatus(record.status as ProblemPracticeStatus),
  };
}
