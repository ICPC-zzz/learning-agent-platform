import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type { ReadingProgressRecord } from "@learning-agent-platform/db";

import type { ReaderDataSource } from "./reader-types";

const demoUserEmail = "demo@example.com";

export type ReaderProgressStatus = "not_started" | "in_progress" | "completed";

export type ReaderProgressLoadStatus =
  | "loaded"
  | "empty"
  | "fallback_readonly"
  | "demo_user_missing"
  | "database_unavailable"
  | "read_failed";

export interface ReaderProgressView {
  bookId: string;
  chapterId: string;
  progressStatus: ReaderProgressStatus;
  progressPercent: number;
  statusLabel: string;
  message: string;
  loadStatus: ReaderProgressLoadStatus;
  isDemoUser: boolean;
  isFallback: boolean;
  userLabel: string;
  lastChunkId?: string | null;
  lastReadAt?: string;
  completedAt?: string;
}

interface LoadReaderProgressViewInput {
  source: ReaderDataSource;
  bookId: string;
  chapterId: string;
}

interface LoadLatestReaderProgressChapterIdInput {
  source: ReaderDataSource;
  bookId: string;
  chapterIds: readonly string[];
}

export async function loadLatestReaderProgressChapterId({
  source,
  bookId,
  chapterIds,
}: LoadLatestReaderProgressChapterIdInput): Promise<string | null> {
  if (source !== "database" || chapterIds.length === 0 || !hasDatabaseUrl()) {
    return null;
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const progressRepository = new PrismaReadingProgressRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return null;
    }

    const validChapterIds = new Set(chapterIds);
    const recentProgressItems = await progressRepository.listReadingProgress({
      userId: demoUser.id,
      bookId,
      limit: chapterIds.length,
    });

    const latestValidProgress = recentProgressItems.find((progress) =>
      validChapterIds.has(progress.chapterId),
    );

    return latestValidProgress?.chapterId ?? null;
  } catch {
    return null;
  }
}

export async function loadReaderProgressView({
  source,
  bookId,
  chapterId,
}: LoadReaderProgressViewInput): Promise<ReaderProgressView> {
  if (source !== "database") {
    return createBaseProgressView({
      bookId,
      chapterId,
      loadStatus: "fallback_readonly",
      message:
        "当前章节来自演示 fallback 数据，只读展示，不会读取或保存真实阅读进度。",
      isDemoUser: false,
      isFallback: true,
    });
  }

  if (!hasDatabaseUrl()) {
    return createBaseProgressView({
      bookId,
      chapterId,
      loadStatus: "database_unavailable",
      message:
        "阅读进度不可用：DATABASE_URL 未配置，无法读取已保存进度。",
      isDemoUser: true,
      isFallback: false,
    });
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const progressRepository = new PrismaReadingProgressRepository(prisma);
    // Reader progress is still bound to a demo user and must not be presented as a formal account system.
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return createBaseProgressView({
        bookId,
        chapterId,
        loadStatus: "demo_user_missing",
        message:
          "阅读进度不可用：未找到演示用户 demo@example.com。",
        isDemoUser: true,
        isFallback: false,
      });
    }

    const progress = await progressRepository.getReadingProgress({
      userId: demoUser.id,
      bookId,
      chapterId,
    });

    if (progress === null) {
      return createBaseProgressView({
        bookId,
        chapterId,
        loadStatus: "empty",
        message:
          "未找到演示用户在当前章节的已保存阅读进度。",
        isDemoUser: true,
        isFallback: false,
      });
    }

    return mapReadingProgressRecord({
      bookId,
      chapterId,
      progress,
    });
  } catch {
    return createBaseProgressView({
      bookId,
      chapterId,
      loadStatus: "read_failed",
      message:
        "阅读进度读取失败：数据库查询未完成，页面仍可继续阅读。",
      isDemoUser: true,
      isFallback: false,
    });
  }
}

function mapReadingProgressRecord({
  bookId,
  chapterId,
  progress,
}: {
  bookId: string;
  chapterId: string;
  progress: ReadingProgressRecord;
}): ReaderProgressView {
  const progressPercent = Math.round(progress.progressRatio * 100);
  const progressStatus =
    progress.completedAt !== null || progress.progressRatio >= 1
      ? "completed"
      : progress.progressRatio > 0
        ? "in_progress"
        : "not_started";

  return {
    bookId,
    chapterId,
    progressStatus,
    progressPercent,
    statusLabel: getProgressStatusLabel(progressStatus),
    message:
      "已读取演示用户在当前章节的已保存阅读进度；这不是正式账户进度恢复闭环。",
    loadStatus: "loaded",
    isDemoUser: true,
    isFallback: false,
    userLabel: `演示用户 ${demoUserEmail}`,
    lastChunkId: progress.lastChunkId,
    lastReadAt: formatDateLabel(progress.updatedAt),
    completedAt: formatDateLabel(progress.completedAt),
  };
}

function createBaseProgressView({
  bookId,
  chapterId,
  loadStatus,
  message,
  isDemoUser,
  isFallback,
}: {
  bookId: string;
  chapterId: string;
  loadStatus: ReaderProgressLoadStatus;
  message: string;
  isDemoUser: boolean;
  isFallback: boolean;
}): ReaderProgressView {
  return {
    bookId,
    chapterId,
    progressStatus: "not_started",
    progressPercent: 0,
    statusLabel: getProgressStatusLabel("not_started"),
    message,
    loadStatus,
    isDemoUser,
    isFallback,
    userLabel: isDemoUser
      ? `演示用户 ${demoUserEmail}`
      : "演示 fallback 数据",
  };
}

function getProgressStatusLabel(status: ReaderProgressStatus): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "in_progress":
      return "阅读中";
    case "not_started":
      return "未开始";
  }
}

function formatDateLabel(value: Date | string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
