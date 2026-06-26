import "server-only";

import {
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaChapterQaHistoryRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ChapterQaHistoryRecord } from "@learning-agent-platform/db";

import type { ReaderDataSource } from "../../lib/reader-types";
import type {
  ReaderQaHistoryReadResult,
  ReaderQaHistoryView,
} from "./reader-qa-history-types";

const demoUserEmail = "demo@example.com";
const defaultHistoryLimit = 5;
const maxHistoryLimit = 10;
const questionPreviewMaxChars = 140;
const answerPreviewMaxChars = 260;

interface LoadReaderQaHistoryInput {
  bookId?: string | null;
  chapterId?: string | null;
  readerDataSource: ReaderDataSource;
  limit?: number;
}

export async function loadReaderQaHistoryForCurrentChapter({
  bookId,
  chapterId,
  readerDataSource,
  limit,
}: LoadReaderQaHistoryInput): Promise<ReaderQaHistoryReadResult> {
  if (!getDatabaseEnvStatus().hasDatabaseUrl) {
    return createResult(
      "database_unavailable",
      "问答历史预览不可用：DATABASE_URL 未配置。",
    );
  }

  if (readerDataSource !== "database") {
    return createResult(
      "unavailable_for_mock_reader",
      "问答历史预览不可用：当前是只读演示 fallback 阅读器。",
    );
  }

  const normalizedBookId = normalizeText(bookId);
  const normalizedChapterId = normalizeText(chapterId);

  if (normalizedBookId === null || normalizedChapterId === null) {
    return createResult(
      "invalid_reader_context",
      "问答历史预览不可用：当前阅读器上下文不完整。",
    );
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const historyRepository = new PrismaChapterQaHistoryRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createResult(
        "demo_user_missing",
        "问答历史预览不可用：未找到演示用户。",
      );
    }

    const records = await historyRepository.listQuestionAnswerRecordsForUser({
      userId: demoUser.id,
      bookId: normalizedBookId,
      chapterId: normalizedChapterId,
      limit: normalizeLimit(limit),
    });

    if (records.length === 0) {
      return createResult(
        "empty",
        "当前章节暂无演示问答历史记录。",
      );
    }

    return {
      status: "loaded",
      records: records.map(mapHistoryRecordToView),
      message: `已加载 ${records.length} 条当前章节的演示问答历史记录。`,
    };
  } catch {
    return createResult(
      "read_failed",
      "问答历史预览读取失败：数据库读取失败。",
    );
  }
}

function mapHistoryRecordToView(
  record: ChapterQaHistoryRecord,
): ReaderQaHistoryView {
  const createdAt = record.createdAt.toISOString();

  return {
    id: record.id,
    questionPreview: truncateText(record.question, questionPreviewMaxChars),
    answerPreview: truncateText(record.answer, answerPreviewMaxChars),
    answerSource: record.answerSource,
    providerLabel: truncateText(record.providerLabel, 120),
    fallbackUsed: record.fallbackUsed,
    fallbackReason: record.fallbackReason,
    errorCategory: record.errorCategory,
    createdAt,
    createdAtLabel: createdAt,
  };
}

function createResult(
  status: ReaderQaHistoryReadResult["status"],
  message: string,
): ReaderQaHistoryReadResult {
  return {
    status,
    records: [],
    message,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return defaultHistoryLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxHistoryLimit);
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
