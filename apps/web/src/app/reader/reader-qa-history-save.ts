import "server-only";

import type { ChapterQaAnswer } from "@learning-agent-platform/ai-core";
import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaHistoryRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type {
  CreateChapterQaHistoryRecordInput,
  Prisma,
} from "@learning-agent-platform/db";

import type {
  ReaderQaHistorySaveResult,
  ReaderQaReaderIdentity,
} from "./reader-qa-history-save-types";
import { createSkippedNoAnswerHistorySaveResult } from "./reader-qa-history-save-types";

const demoUserEmail = "demo@example.com";
const contextTitleMaxChars = 200;
const contextSummaryTextMaxChars = 600;
const contextChunkIndexesMaxItems = 20;

interface SaveReaderQaHistoryBestEffortInput {
  readerIdentity: ReaderQaReaderIdentity;
  question: string;
  answer: ChapterQaAnswer;
}

export async function saveReaderQaHistoryBestEffort({
  readerIdentity,
  question,
  answer,
}: SaveReaderQaHistoryBestEffortInput): Promise<ReaderQaHistorySaveResult> {
  const normalizedQuestion = normalizeText(question);
  const normalizedAnswer = normalizeText(answer.content);

  if (normalizedAnswer === null) {
    return createSkippedNoAnswerHistorySaveResult();
  }

  if (readerIdentity.readerDataSource !== "database") {
    return {
      status: "skipped_mock_reader",
      message:
        "问答历史未保存：当前是只读演示 fallback 阅读器。",
    };
  }

  const bookId = normalizeText(readerIdentity.bookId);
  const chapterId = normalizeText(readerIdentity.chapterId);

  if (bookId === null || chapterId === null || normalizedQuestion === null) {
    return {
      status: "invalid_reader_context",
      message:
        "问答历史未保存：阅读器上下文不完整。",
    };
  }

  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return {
      status: "database_unavailable",
      message:
        "问答历史未保存：DATABASE_URL 未配置。",
    };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const historyRepository = new PrismaChapterQaHistoryRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return {
        status: "demo_user_missing",
        message:
          "问答历史未保存：未找到演示用户。",
      };
    }

    const record = await historyRepository.createQuestionAnswerRecord({
      userId: demoUser.id,
      bookId,
      chapterId,
      question: normalizedQuestion,
      answer: normalizedAnswer,
      metadata: createHistoryAnswerMetadata(answer),
    });

    return {
      status: "saved",
      message: "演示用户问答历史已保存；这不是正式 AI 问答历史能力。",
      historyRecordId: record.id,
    };
  } catch {
    return {
      status: "save_failed",
      message:
        "问答历史保存失败：database write failed without exposing provider details.",
    };
  }
}

function createHistoryAnswerMetadata(
  answer: ChapterQaAnswer,
): CreateChapterQaHistoryRecordInput["metadata"] {
  const metadata = answer.metadata;

  return {
    answerSource: metadata.answerSource,
    providerId: metadata.providerId,
    providerLabel: metadata.providerLabel,
    requestedProviderMode: metadata.requestedProviderMode,
    resolvedProviderMode: metadata.resolvedProviderMode,
    modelConfigured: metadata.modelConfigured,
    networkUsed: metadata.networkUsed,
    fallbackUsed: metadata.fallbackUsed,
    fallbackReason: metadata.fallbackReason,
    errorCategory: metadata.errorCategory,
    contextSummary: createSafeContextSummary(answer),
    contextChunkRange: createSafeContextChunkRange(answer),
  };
}

function createSafeContextSummary(answer: ChapterQaAnswer): Prisma.InputJsonValue {
  const summary = answer.metadata.contextSummary;

  return {
    bookTitle: truncateText(summary.bookTitle, contextTitleMaxChars),
    chapterTitle: truncateText(summary.chapterTitle, contextTitleMaxChars),
    currentChunkIndex: summary.currentChunkIndex,
    totalChunks: summary.totalChunks,
    usedChunkIndexes: summary.usedChunkIndexes
      .slice(0, contextChunkIndexesMaxItems)
      .map(normalizeChunkIndex),
    readingProgress: truncateText(
      summary.readingProgress,
      contextSummaryTextMaxChars,
    ),
    abilityProfile: truncateText(
      summary.abilityProfile,
      contextSummaryTextMaxChars,
    ),
    contextSource: summary.contextSource,
  };
}

function createSafeContextChunkRange(
  answer: ChapterQaAnswer,
): Prisma.InputJsonValue {
  const range = answer.metadata.contextChunkRange;

  return {
    startChunkIndex: range.startChunkIndex,
    endChunkIndex: range.endChunkIndex,
    chunkIndexes: range.chunkIndexes
      .slice(0, contextChunkIndexesMaxItems)
      .map(normalizeChunkIndex),
  };
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function truncateText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  if (maxChars <= 3) {
    return normalized.slice(0, maxChars);
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}

function normalizeChunkIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}
