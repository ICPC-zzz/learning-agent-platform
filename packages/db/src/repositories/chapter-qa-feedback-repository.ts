import type {
  ChapterQaFeedbackRating as PrismaChapterQaFeedbackRating,
  ChapterQaHistory as PrismaChapterQaHistory,
  PrismaClient,
} from "@prisma/client";

import type {
  ChapterQaFeedbackRecord,
  ChapterQaFeedbackRating,
  ChapterQaFeedbackRepository,
  ClearChapterQaFeedbackInput,
  GetChapterQaFeedbackInput,
  UpsertChapterQaFeedbackInput,
} from "../types.js";

const maxFeedbackNoteLength = 1000;

export class PrismaChapterQaFeedbackRepository
  implements ChapterQaFeedbackRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsertQuestionAnswerFeedback(
    input: UpsertChapterQaFeedbackInput,
  ): Promise<ChapterQaFeedbackRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const historyRecordId = normalizeRequiredText(
      input.historyRecordId,
      "History record id is required.",
    );
    const rating = normalizeFeedbackRating(input.rating);
    const feedbackAt = new Date();

    const updateResult = await this.prisma.chapterQaHistory.updateMany({
      where: {
        id: historyRecordId,
        userId,
      },
      data: {
        feedbackRating: mapFeedbackRatingToPrisma(rating),
        feedbackNote: normalizeOptionalFeedbackNote(input.note),
        feedbackAt,
      },
    });

    if (updateResult.count === 0) {
      throw new Error("Chapter Q&A history record was not found for this user.");
    }

    const record = await this.prisma.chapterQaHistory.findFirst({
      where: {
        id: historyRecordId,
        userId,
      },
    });

    const feedback = record === null ? null : mapChapterQaFeedbackRecord(record);

    if (feedback === null) {
      throw new Error("Chapter Q&A feedback could not be loaded after update.");
    }

    return feedback;
  }

  async getQuestionAnswerFeedback(
    input: GetChapterQaFeedbackInput,
  ): Promise<ChapterQaFeedbackRecord | null> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const historyRecordId = normalizeRequiredText(
      input.historyRecordId,
      "History record id is required.",
    );

    const record = await this.prisma.chapterQaHistory.findFirst({
      where: {
        id: historyRecordId,
        userId,
      },
    });

    return record === null ? null : mapChapterQaFeedbackRecord(record);
  }

  async clearQuestionAnswerFeedback(
    input: ClearChapterQaFeedbackInput,
  ): Promise<boolean> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const historyRecordId = normalizeRequiredText(
      input.historyRecordId,
      "History record id is required.",
    );

    const updateResult = await this.prisma.chapterQaHistory.updateMany({
      where: {
        id: historyRecordId,
        userId,
      },
      data: {
        feedbackRating: null,
        feedbackNote: null,
        feedbackAt: null,
      },
    });

    return updateResult.count > 0;
  }
}

function mapChapterQaFeedbackRecord(
  record: PrismaChapterQaHistory,
): ChapterQaFeedbackRecord | null {
  if (record.feedbackRating === null || record.feedbackAt === null) {
    return null;
  }

  return {
    historyRecordId: record.id,
    userId: record.userId,
    rating: mapFeedbackRatingFromPrisma(record.feedbackRating),
    note: record.feedbackNote,
    feedbackAt: record.feedbackAt,
    updatedAt: record.updatedAt,
  };
}

function mapFeedbackRatingToPrisma(
  rating: ChapterQaFeedbackRating,
): PrismaChapterQaFeedbackRating {
  switch (rating) {
    case "helpful":
      return "HELPFUL";
    case "unhelpful":
      return "UNHELPFUL";
    case "neutral":
      return "NEUTRAL";
  }

  throw new Error("Unsupported Chapter Q&A feedback rating.");
}

function mapFeedbackRatingFromPrisma(
  rating: PrismaChapterQaFeedbackRating,
): ChapterQaFeedbackRating {
  switch (rating) {
    case "HELPFUL":
      return "helpful";
    case "UNHELPFUL":
      return "unhelpful";
    case "NEUTRAL":
      return "neutral";
  }

  throw new Error("Unsupported Chapter Q&A feedback rating.");
}

function normalizeFeedbackRating(
  rating: ChapterQaFeedbackRating,
): ChapterQaFeedbackRating {
  switch (rating) {
    case "helpful":
    case "unhelpful":
    case "neutral":
      return rating;
  }

  throw new Error("Unsupported Chapter Q&A feedback rating.");
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(errorMessage);
  }

  return normalized;
}

function normalizeOptionalFeedbackNote(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.slice(0, maxFeedbackNoteLength);
}
