import type { Prisma, PrismaClient } from "@prisma/client";

import type {
  GetReadingProgressInput,
  ListReadingProgressInput,
  MarkChapterCompletedInput,
  ReadingProgressRecord,
  ReadingProgressRepository,
  UpsertReadingProgressInput,
} from "../types.js";
import { normalizeProgressRatio } from "./reading-progress-mappers.js";

const defaultListReadingProgressLimit = 50;
const maxListReadingProgressLimit = 200;

export class PrismaReadingProgressRepository
  implements ReadingProgressRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertReadingProgress(
    input: UpsertReadingProgressInput,
  ): Promise<ReadingProgressRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const bookId = normalizeRequiredText(input.bookId, "Book id is required.");
    const chapterId = normalizeRequiredText(
      input.chapterId,
      "Chapter id is required.",
    );
    const progressRatio = normalizeProgressRatio(input.progressRatio);
    const completedAt = progressRatio >= 1 ? new Date() : null;
    const createData = createReadingProgressCreateData({
      userId,
      bookId,
      chapterId,
      progressRatio,
      completedAt,
      lastChunkId: input.lastChunkId,
    });
    const updateData = createReadingProgressUpdateData({
      progressRatio,
      completedAt,
      lastChunkId: input.lastChunkId,
    });

    return this.prisma.readingProgress.upsert({
      where: {
        userId_bookId_chapterId: {
          userId,
          bookId,
          chapterId,
        },
      },
      create: createData,
      update: updateData,
    });
  }

  async getReadingProgress(
    input: GetReadingProgressInput,
  ): Promise<ReadingProgressRecord | null> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const bookId = normalizeRequiredText(input.bookId, "Book id is required.");
    const chapterId = normalizeRequiredText(
      input.chapterId,
      "Chapter id is required.",
    );

    return this.prisma.readingProgress.findUnique({
      where: {
        userId_bookId_chapterId: {
          userId,
          bookId,
          chapterId,
        },
      },
    });
  }

  async listReadingProgress(
    input: ListReadingProgressInput,
  ): Promise<ReadingProgressRecord[]> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const limit = normalizeListReadingProgressLimit(input.limit);
    const where: Prisma.ReadingProgressWhereInput = { userId };

    if (input.bookId !== undefined) {
      where.bookId = normalizeRequiredText(input.bookId, "Book id is required.");
    }

    return this.prisma.readingProgress.findMany({
      where,
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  async markChapterCompleted(
    input: MarkChapterCompletedInput,
  ): Promise<ReadingProgressRecord> {
    return this.upsertReadingProgress({
      userId: input.userId,
      bookId: input.bookId,
      chapterId: input.chapterId,
      progressRatio: 1,
      lastChunkId: input.lastChunkId,
    });
  }
}

interface ReadingProgressCreateDataInput {
  userId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  completedAt: Date | null;
  lastChunkId?: string | null;
}

interface ReadingProgressUpdateDataInput {
  progressRatio: number;
  completedAt: Date | null;
  lastChunkId?: string | null;
}

function createReadingProgressCreateData(
  input: ReadingProgressCreateDataInput,
): Prisma.ReadingProgressCreateInput {
  const createData: Prisma.ReadingProgressCreateInput = {
    user: { connect: { id: input.userId } },
    book: { connect: { id: input.bookId } },
    chapter: { connect: { id: input.chapterId } },
    progressRatio: input.progressRatio,
    completedAt: input.completedAt,
  };

  if (input.lastChunkId !== undefined) {
    const lastChunkId = normalizeOptionalText(input.lastChunkId);

    if (lastChunkId !== null) {
      createData.lastChunk = { connect: { id: lastChunkId } };
    }
  }

  return createData;
}

function createReadingProgressUpdateData(
  input: ReadingProgressUpdateDataInput,
): Prisma.ReadingProgressUpdateInput {
  const updateData: Prisma.ReadingProgressUpdateInput = {
    progressRatio: input.progressRatio,
    completedAt: input.completedAt,
  };

  if (input.lastChunkId !== undefined) {
    const lastChunkId = normalizeOptionalText(input.lastChunkId);

    updateData.lastChunk =
      lastChunkId === null ? { disconnect: true } : { connect: { id: lastChunkId } };
  }

  return updateData;
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

function normalizeListReadingProgressLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultListReadingProgressLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxListReadingProgressLimit);
}
