import type {
  ChapterQaAnswerSource as PrismaChapterQaAnswerSource,
  ChapterQaHistory as PrismaChapterQaHistory,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import type {
  ChapterQaHistoryAnswerSource,
  ChapterQaHistoryRecord,
  ChapterQaHistoryRepository,
  CreateChapterQaHistoryRecordInput,
  GetChapterQaHistoryRecordByIdInput,
  ListChapterQaHistoryRecordsInput,
} from "../types.js";

const defaultListChapterQaHistoryLimit = 20;
const maxListChapterQaHistoryLimit = 100;

export class PrismaChapterQaHistoryRepository
  implements ChapterQaHistoryRepository
{
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createQuestionAnswerRecord(
    input: CreateChapterQaHistoryRecordInput,
  ): Promise<ChapterQaHistoryRecord> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const bookId = normalizeRequiredText(input.bookId, "Book id is required.");
    const chapterId = normalizeRequiredText(
      input.chapterId,
      "Chapter id is required.",
    );
    const metadata = input.metadata;
    const createData: Prisma.ChapterQaHistoryCreateInput = {
      user: { connect: { id: userId } },
      book: { connect: { id: bookId } },
      chapter: { connect: { id: chapterId } },
      question: normalizeRequiredText(input.question, "Question is required."),
      answer: normalizeRequiredText(input.answer, "Answer is required."),
      answerSource: mapAnswerSourceToPrisma(metadata.answerSource),
      providerId: normalizeRequiredText(
        metadata.providerId,
        "Provider id is required.",
      ),
      providerLabel: normalizeRequiredText(
        metadata.providerLabel,
        "Provider label is required.",
      ),
      requestedProviderMode: normalizeRequiredText(
        metadata.requestedProviderMode,
        "Requested provider mode is required.",
      ),
      resolvedProviderMode: normalizeRequiredText(
        metadata.resolvedProviderMode,
        "Resolved provider mode is required.",
      ),
      modelConfigured: metadata.modelConfigured,
      networkUsed: metadata.networkUsed,
      fallbackUsed: metadata.fallbackUsed,
      fallbackReason: normalizeOptionalText(metadata.fallbackReason),
      errorCategory: normalizeOptionalText(metadata.errorCategory),
    };

    if (
      metadata.contextSummary !== undefined &&
      metadata.contextSummary !== null
    ) {
      createData.contextSummary = metadata.contextSummary;
    }

    if (
      metadata.contextChunkRange !== undefined &&
      metadata.contextChunkRange !== null
    ) {
      createData.contextChunkRange = metadata.contextChunkRange;
    }

    const record = await this.prisma.chapterQaHistory.create({
      data: createData,
    });

    return mapChapterQaHistoryRecord(record);
  }

  async listQuestionAnswerRecordsForUser(
    input: ListChapterQaHistoryRecordsInput,
  ): Promise<ChapterQaHistoryRecord[]> {
    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const limit = normalizeListChapterQaHistoryLimit(input.limit);
    const where: Prisma.ChapterQaHistoryWhereInput = { userId };

    if (input.bookId !== undefined) {
      where.bookId = normalizeRequiredText(input.bookId, "Book id is required.");
    }

    if (input.chapterId !== undefined) {
      where.chapterId = normalizeRequiredText(
        input.chapterId,
        "Chapter id is required.",
      );
    }

    const records = await this.prisma.chapterQaHistory.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    return records.map(mapChapterQaHistoryRecord);
  }

  async getQuestionAnswerRecordById(
    input: GetChapterQaHistoryRecordByIdInput,
  ): Promise<ChapterQaHistoryRecord | null> {
    const id = normalizeRequiredText(input.id, "Record id is required.");

    if (input.userId === undefined) {
      const record = await this.prisma.chapterQaHistory.findUnique({
        where: { id },
      });

      return record === null ? null : mapChapterQaHistoryRecord(record);
    }

    const userId = normalizeRequiredText(input.userId, "User id is required.");
    const record = await this.prisma.chapterQaHistory.findFirst({
      where: { id, userId },
    });

    return record === null ? null : mapChapterQaHistoryRecord(record);
  }
}

function mapChapterQaHistoryRecord(
  record: PrismaChapterQaHistory,
): ChapterQaHistoryRecord {
  return {
    id: record.id,
    userId: record.userId,
    bookId: record.bookId,
    chapterId: record.chapterId,
    question: record.question,
    answer: record.answer,
    answerSource: mapAnswerSourceFromPrisma(record.answerSource),
    providerId: record.providerId,
    providerLabel: record.providerLabel,
    requestedProviderMode: record.requestedProviderMode,
    resolvedProviderMode: record.resolvedProviderMode,
    modelConfigured: record.modelConfigured,
    networkUsed: record.networkUsed,
    fallbackUsed: record.fallbackUsed,
    fallbackReason: record.fallbackReason,
    errorCategory: record.errorCategory,
    contextSummary: record.contextSummary,
    contextChunkRange: record.contextChunkRange,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapAnswerSourceToPrisma(
  answerSource: ChapterQaHistoryAnswerSource,
): PrismaChapterQaAnswerSource {
  switch (answerSource) {
    case "mock":
      return "MOCK";
    case "real_openai":
      return "REAL_OPENAI";
    case "fallback_mock":
      return "FALLBACK_MOCK";
  }
}

function mapAnswerSourceFromPrisma(
  answerSource: PrismaChapterQaAnswerSource,
): ChapterQaHistoryAnswerSource {
  switch (answerSource) {
    case "MOCK":
      return "mock";
    case "REAL_OPENAI":
      return "real_openai";
    case "FALLBACK_MOCK":
      return "fallback_mock";
    default:
      return "mock";
  }
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

function normalizeListChapterQaHistoryLimit(
  limit: number | undefined,
): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultListChapterQaHistoryLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxListChapterQaHistoryLimit);
}
