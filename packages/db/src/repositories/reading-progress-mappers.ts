import type {
  MarkChapterCompletedInput,
  UpsertReadingProgressInput,
} from "../types.js";

export interface CreateReadingProgressUpdateFromReaderStateInput {
  userId: string;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  lastChunkId?: string | null;
}

export interface CreateCompletedChapterProgressInput {
  userId: string;
  bookId: string;
  chapterId: string;
  lastChunkId?: string | null;
}

export function normalizeProgressRatio(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Progress ratio must be a finite number.");
  }

  return Math.min(Math.max(value, 0), 1);
}

export function createReadingProgressUpdateFromReaderState(
  input: CreateReadingProgressUpdateFromReaderStateInput,
): UpsertReadingProgressInput {
  const progressUpdate: UpsertReadingProgressInput = {
    userId: normalizeRequiredText(input.userId, "User id is required."),
    bookId: normalizeRequiredText(input.bookId, "Book id is required."),
    chapterId: normalizeRequiredText(input.chapterId, "Chapter id is required."),
    progressRatio: normalizeProgressRatio(input.progressRatio),
  };

  if (input.lastChunkId !== undefined) {
    progressUpdate.lastChunkId = normalizeOptionalText(input.lastChunkId);
  }

  return progressUpdate;
}

export function createCompletedChapterProgress(
  input: CreateCompletedChapterProgressInput,
): MarkChapterCompletedInput {
  const completedProgress: MarkChapterCompletedInput = {
    userId: normalizeRequiredText(input.userId, "User id is required."),
    bookId: normalizeRequiredText(input.bookId, "Book id is required."),
    chapterId: normalizeRequiredText(input.chapterId, "Chapter id is required."),
  };

  if (input.lastChunkId !== undefined) {
    completedProgress.lastChunkId = normalizeOptionalText(input.lastChunkId);
  }

  return completedProgress;
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
