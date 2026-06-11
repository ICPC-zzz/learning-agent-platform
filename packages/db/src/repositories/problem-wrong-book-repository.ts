import type { PrismaClient } from "@prisma/client";

import type {
  AddProblemWrongBookInput,
  IsProblemInWrongBookInput,
  ListProblemWrongBookByOwnerInput,
  ProblemWrongBookRecord,
  ProblemWrongBookRepository,
  ProblemWrongBookReviewStatus,
  RecordProblemWrongInput,
  RemoveProblemWrongBookInput,
  UpdateProblemWrongBookNoteInput,
  UpdateProblemWrongBookReviewStatusInput,
} from "../types.js";
import { VALID_WRONG_BOOK_REVIEW_STATUSES } from "../types.js";

/**
 * Prisma-backed ProblemWrongBookRepository for dev-only wrong book records.
 *
 * ALL methods are dev-only. The guard (problem-wrong-book-db-guard) must pass
 * before any method is called.
 *
 * Uses the ProblemWrongBook model (added in A395 schema).
 * ownerId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 *
 * @devOnly — productionReady is false on ALL results
 */
export class PrismaProblemWrongBookRepository implements ProblemWrongBookRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addProblemToWrongBook(
    input: AddProblemWrongBookInput,
  ): Promise<ProblemWrongBookRecord> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const problemTitle = normalizeRequiredText(input.problemTitle, "problemTitle required");
    const difficulty = normalizeDifficulty(input.difficulty);
    const sourceType = normalizeSourceType(input.sourceType);

    // Idempotent — use @@unique([ownerId, problemId])
    // Check if exists first, then create if not
    const existing = await this.prisma.problemWrongBook.findFirst({
      where: { ownerId, problemId },
    });

    if (existing !== null) {
      return existing as ProblemWrongBookRecord;
    }

    return this.prisma.problemWrongBook.create({
      data: {
        ownerId,
        problemId,
        problemTitle,
        difficulty,
        tagsJson: normalizeTagsJson(input.tags),
        wrongCount: 1,
        lastWrongAt: new Date(),
        reviewStatus: "needs-review",
        notePreview: null,
        sourceType,
      },
    }) as Promise<ProblemWrongBookRecord>;
  }

  async recordProblemWrong(
    input: RecordProblemWrongInput,
  ): Promise<ProblemWrongBookRecord> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const problemTitle = normalizeRequiredText(input.problemTitle, "problemTitle required");
    const difficulty = normalizeDifficulty(input.difficulty);
    const sourceType = normalizeSourceType(input.sourceType);

    // Upsert: find existing or create with wrongCount=1
    const existing = await this.prisma.problemWrongBook.findFirst({
      where: { ownerId, problemId },
    });

    if (existing !== null) {
      return this.prisma.problemWrongBook.update({
        where: { id: existing.id },
        data: {
          problemTitle,
          difficulty,
          tagsJson: normalizeTagsJson(input.tags),
          wrongCount: existing.wrongCount + 1,
          lastWrongAt: new Date(),
        },
      }) as Promise<ProblemWrongBookRecord>;
    }

    return this.prisma.problemWrongBook.create({
      data: {
        ownerId,
        problemId,
        problemTitle,
        difficulty,
        tagsJson: normalizeTagsJson(input.tags),
        wrongCount: 1,
        lastWrongAt: new Date(),
        reviewStatus: "needs-review",
        notePreview: null,
        sourceType,
      },
    }) as Promise<ProblemWrongBookRecord>;
  }

  async removeProblemFromWrongBook(
    input: RemoveProblemWrongBookInput,
  ): Promise<boolean> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    try {
      const existing = await this.prisma.problemWrongBook.findFirst({
        where: { ownerId, problemId },
      });

      if (existing === null) {
        return false;
      }

      await this.prisma.problemWrongBook.delete({
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

  async updateProblemWrongBookReviewStatus(
    input: UpdateProblemWrongBookReviewStatusInput,
  ): Promise<ProblemWrongBookRecord> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const reviewStatus = normalizeReviewStatus(input.reviewStatus);

    const existing = await this.prisma.problemWrongBook.findFirst({
      where: { ownerId, problemId },
    });

    if (existing === null) {
      throw new Error(`ProblemWrongBook record not found for ownerId=${ownerId}, problemId=${problemId}`);
    }

    return this.prisma.problemWrongBook.update({
      where: { id: existing.id },
      data: { reviewStatus },
    }) as Promise<ProblemWrongBookRecord>;
  }

  async updateProblemWrongBookNote(
    input: UpdateProblemWrongBookNoteInput,
  ): Promise<ProblemWrongBookRecord> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");
    const notePreview = normalizeNotePreview(input.notePreview);

    const existing = await this.prisma.problemWrongBook.findFirst({
      where: { ownerId, problemId },
    });

    if (existing === null) {
      throw new Error(`ProblemWrongBook record not found for ownerId=${ownerId}, problemId=${problemId}`);
    }

    return this.prisma.problemWrongBook.update({
      where: { id: existing.id },
      data: { notePreview },
    }) as Promise<ProblemWrongBookRecord>;
  }

  async listProblemWrongBookByOwner(
    input: ListProblemWrongBookByOwnerInput,
  ): Promise<ProblemWrongBookRecord[]> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.problemWrongBook.findMany({
      where: { ownerId },
      take: limit,
      orderBy: [{ lastWrongAt: "desc" }, { id: "asc" }],
    }) as Promise<ProblemWrongBookRecord[]>;
  }

  async isProblemInWrongBook(
    input: IsProblemInWrongBookInput,
  ): Promise<boolean> {
    const ownerId = normalizeRequiredText(input.ownerId, "ownerId required");
    const problemId = normalizeRequiredText(input.problemId, "problemId required");

    const count = await this.prisma.problemWrongBook.count({
      where: { ownerId, problemId },
    });
    return count > 0;
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

function normalizeDifficulty(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  const valid = new Set(["easy", "medium", "hard", "challenge"]);
  return valid.has(normalized) ? normalized : "unknown";
}

function normalizeSourceType(raw: string | undefined): string {
  if (!raw || raw.trim().length === 0) return "manual";
  return raw.trim();
}

function normalizeTagsJson(tags: string[] | undefined): string {
  if (!Array.isArray(tags)) return "[]";
  const safe = tags
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 50);
  return JSON.stringify(safe);
}

function normalizeReviewStatus(status: string): ProblemWrongBookReviewStatus {
  if (!VALID_WRONG_BOOK_REVIEW_STATUSES.has(status.trim())) {
    throw new Error(
      `Invalid review status "${status}". Must be one of: ${Array.from(VALID_WRONG_BOOK_REVIEW_STATUSES).join(", ")}.`,
    );
  }
  return status.trim() as ProblemWrongBookReviewStatus;
}

function normalizeNotePreview(raw: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 300);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
