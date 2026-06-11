import type { PrismaClient } from "@prisma/client";

import type {
  EndReadingSessionInput,
  ListReadingSessionsByOwnerInput,
  ReadingSessionRecord,
  ReadingSessionRepository,
  ReadingSessionSummary,
  StartReadingSessionInput,
} from "../types.js";

/**
 * Prisma-backed ReadingSessionRepository for dev-only reading session tracking.
 *
 * ALL methods are dev-only. The guard (reading-session-db-guard) must pass
 * before any method is called.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 *
 * @devOnly — not production-ready
 */
export class PrismaReadingSessionRepository implements ReadingSessionRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async startReadingSession(
    input: StartReadingSessionInput,
  ): Promise<ReadingSessionRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");
    const bookTitle = normalizeRequiredText(input.bookTitle, "bookTitle required");
    const chapterTitle = normalizeRequiredText(input.chapterTitle, "chapterTitle required");
    const startedAt = normalizeDate(input.startedAt);
    const durationSeconds = normalizeDuration(input.durationSeconds);
    const progressRatio = normalizeProgressRatio(input.progressRatio);
    const sourceType = normalizeRequiredText(input.sourceType, "sourceType required");

    return this.prisma.readingSession.create({
      data: {
        userId,
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        startedAt,
        endedAt: null,
        durationSeconds,
        progressRatio,
        sourceType,
      },
    });
  }

  async endReadingSession(
    input: EndReadingSessionInput,
  ): Promise<ReadingSessionRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const sessionId = normalizeRequiredText(input.sessionId, "sessionId required");
    const endedAt = normalizeDate(input.endedAt);
    const durationSeconds = normalizeDuration(input.durationSeconds);

    // Verify ownership before update
    const existing = await this.prisma.readingSession.findFirst({
      where: { userId, id: sessionId },
    });

    if (existing === null) {
      throw new Error(`ReadingSession not found or not owned by user: ${sessionId}`);
    }

    return this.prisma.readingSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationSeconds,
      },
    });
  }

  async listReadingSessionsByOwner(
    input: ListReadingSessionsByOwnerInput,
  ): Promise<ReadingSessionRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.readingSession.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    });
  }

  async summarizeReadingSessionsByOwner(
    userId: string,
  ): Promise<ReadingSessionSummary> {
    const uid = normalizeRequiredText(userId, "userId required");

    const sessions = await this.prisma.readingSession.findMany({
      where: { userId: uid },
      select: {
        id: true,
        durationSeconds: true,
      },
    });

    const totalDurationSeconds = sessions.reduce(
      (sum, s) => sum + Math.max(0, s.durationSeconds),
      0,
    );

    return {
      totalSessions: sessions.length,
      totalDurationSeconds,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
    };
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

function normalizeDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return new Date();
  }
  return value;
}

function normalizeDuration(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  // Max 8 hours (28800 seconds)
  return Math.min(Math.trunc(value), 28800);
}

function normalizeProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
