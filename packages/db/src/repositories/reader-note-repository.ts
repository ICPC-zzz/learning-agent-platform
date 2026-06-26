import type { PrismaClient } from "@prisma/client";

import type {
  AddReaderNoteInput,
  ListReaderNotesByBookChapterInput,
  ListReaderNotesByOwnerInput,
  ReaderNoteRecord,
  ReaderNoteRepository,
  RemoveReaderNoteInput,
  UpdateReaderNoteInput,
} from "../types.js";

/** Maximum noteText length in characters. */
const MAX_NOTE_TEXT_LENGTH = 1000;

/** Maximum excerptPreview length in characters. */
const MAX_EXCERPT_PREVIEW_LENGTH = 160;

/**
 * Prisma-backed ReaderNoteRepository for dev-only reader notes.
 *
 * ALL methods are dev-only. The guard (reader-notes-db-guard) must pass
 * before any method is called.
 *
 * Multiple notes per chapter are allowed.
 *
 * Note: userId is a plain String, NOT a FK to User table.
 * Dev session users may not have real User records.
 *
 * @devOnly — not production-ready
 */
export class PrismaReaderNoteRepository implements ReaderNoteRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addReaderNote(
    input: AddReaderNoteInput,
  ): Promise<ReaderNoteRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");
    const bookTitle = normalizeRequiredText(input.bookTitle, "bookTitle required");
    const chapterTitle = normalizeRequiredText(input.chapterTitle, "chapterTitle required");
    const progressRatio = normalizeProgressRatio(input.progressRatio);
    const noteText = normalizeNoteText(input.noteText);
    const excerptPreview = normalizeExcerptPreview(input.excerptPreview);
    const sourceType = normalizeRequiredText(input.sourceType, "sourceType required");

    return this.prisma.readerNote.create({
      data: {
        userId,
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
        progressRatio,
        noteText,
        excerptPreview,
        sourceType,
      },
    });
  }

  async updateReaderNote(
    input: UpdateReaderNoteInput,
  ): Promise<ReaderNoteRecord> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const noteId = normalizeRequiredText(input.noteId, "noteId required");
    const noteText = normalizeNoteText(input.noteText);
    const excerptPreview = normalizeExcerptPreview(input.excerptPreview);
    const progressRatio = input.progressRatio !== undefined
      ? normalizeProgressRatio(input.progressRatio)
      : undefined;

    // Find the record first to verify owner
    const existing = await this.prisma.readerNote.findFirst({
      where: { id: noteId },
    });

    if (existing === null) {
      throw new Error("Note not found.");
    }

    if (existing.userId !== userId) {
      throw new Error("Owner mismatch: cannot update another user's note.");
    }

    return this.prisma.readerNote.update({
      where: { id: noteId },
      data: {
        noteText,
        excerptPreview,
        ...(progressRatio !== undefined ? { progressRatio } : {}),
      },
    });
  }

  async removeReaderNote(
    input: RemoveReaderNoteInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const noteId = normalizeRequiredText(input.noteId, "noteId required");

    try {
      // Find the record first to verify owner
      const existing = await this.prisma.readerNote.findFirst({
        where: { id: noteId },
      });

      if (existing === null) {
        return false;
      }

      if (existing.userId !== userId) {
        return false; // Owner mismatch — silently deny
      }

      await this.prisma.readerNote.delete({
        where: { id: noteId },
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

  async listReaderNotesByOwner(
    input: ListReaderNotesByOwnerInput,
  ): Promise<ReaderNoteRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.readerNote.findMany({
      where: { userId },
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  async listReaderNotesByBookChapter(
    input: ListReaderNotesByBookChapterInput,
  ): Promise<ReaderNoteRecord[]> {
    const userId = normalizeRequiredText(input.userId, "userId required");
    const bookId = normalizeRequiredText(input.bookId, "bookId required");
    const chapterId = normalizeRequiredText(input.chapterId, "chapterId required");
    const limit = normalizeListLimit(input.limit);

    return this.prisma.readerNote.findMany({
      where: { userId, bookId, chapterId },
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
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

function normalizeProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function normalizeNoteText(text: string): string {
  return text.slice(0, MAX_NOTE_TEXT_LENGTH);
}

function normalizeExcerptPreview(
  excerpt: string | null | undefined,
): string | null {
  if (excerpt === null || excerpt === undefined) return null;
  if (typeof excerpt !== "string") return null;
  const trimmed = excerpt.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_EXCERPT_PREVIEW_LENGTH);
}

function normalizeListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}
