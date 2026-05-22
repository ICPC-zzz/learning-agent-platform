"use server";

import { revalidatePath } from "next/cache";

import {
  createReadingProgressUpdateFromReaderState,
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";

const demoUserEmail = "demo@example.com";

export type SaveReaderProgressFailureReason =
  | "not_configured"
  | "demo_user_missing"
  | "invalid_reader_data"
  | "db_error";

export type SaveReaderProgressActionState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "success";
      message: string;
      progressRatio: number;
      savedAt: string;
    }
  | {
      status: "error";
      reason: SaveReaderProgressFailureReason;
      message: string;
    };

interface ParsedReaderProgressInput {
  bookId: string;
  chapterId: string;
  lastChunkId: string | null;
  progressRatio: number;
}

export async function saveReaderProgressAction(
  previousState: SaveReaderProgressActionState,
  formData: FormData,
): Promise<SaveReaderProgressActionState> {
  void previousState;

  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return {
      status: "error",
      reason: "not_configured",
      message: "进度保存不可用：DATABASE_URL 未配置。",
    };
  }

  const input = parseReaderProgressFormData(formData);

  if (input === null) {
    return {
      status: "error",
      reason: "invalid_reader_data",
      message: "进度保存不可用：阅读器数据不完整。",
    };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const bookRepository = new PrismaBookRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);

    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return {
        status: "error",
        reason: "demo_user_missing",
        message: "进度保存不可用：未找到演示用户。",
      };
    }

    const readerData = await bookRepository.getBookReaderData(input.bookId);

    if (readerData === null) {
      return {
        status: "error",
        reason: "invalid_reader_data",
        message: "进度保存不可用：未找到当前书籍。",
      };
    }

    const hasCurrentChapter = readerData.chapters.some(
      (item) => item.id === input.chapterId,
    );

    if (!hasCurrentChapter) {
      return {
        status: "error",
        reason: "invalid_reader_data",
        message: "进度保存不可用：未找到当前章节。",
      };
    }

    if (
      input.lastChunkId !== null &&
      !readerData.chunks.some(
        (chunk) =>
          chunk.id === input.lastChunkId &&
          chunk.bookId === input.bookId &&
          chunk.chapterId === input.chapterId,
      )
    ) {
      return {
        status: "error",
        reason: "invalid_reader_data",
        message: "进度保存不可用：当前 chunk 不属于此章节。",
      };
    }

    const progress = await readingProgressRepository.upsertReadingProgress(
      createReadingProgressUpdateFromReaderState({
        userId: demoUser.id,
        bookId: input.bookId,
        chapterId: input.chapterId,
        lastChunkId: input.lastChunkId,
        progressRatio: input.progressRatio,
      }),
    );

    revalidatePath("/reader");
    revalidatePath(`/books/${input.bookId}`);

    return {
      status: "success",
      message: `演示用户阅读进度已保存：${formatPercent(progress.progressRatio)}。该状态不代表正式账户进度闭环。`,
      progressRatio: progress.progressRatio,
      savedAt: progress.updatedAt.toISOString(),
    };
  } catch {
    return {
      status: "error",
      reason: "db_error",
      message: "进度保存不可用：数据库读取或写入失败。",
    };
  }
}

function parseReaderProgressFormData(
  formData: FormData,
): ParsedReaderProgressInput | null {
  const source = readRequiredFormText(formData, "source");

  if (source !== "database") {
    return null;
  }

  const bookId = readRequiredFormText(formData, "bookId");
  const chapterId = readRequiredFormText(formData, "chapterId");
  const progressRatioText = readRequiredFormText(formData, "progressRatio");

  if (bookId === null || chapterId === null || progressRatioText === null) {
    return null;
  }

  const progressRatio = Number(progressRatioText);

  if (
    !Number.isFinite(progressRatio) ||
    progressRatio < 0 ||
    progressRatio > 1
  ) {
    return null;
  }

  return {
    bookId,
    chapterId,
    lastChunkId: readOptionalFormText(formData, "lastChunkId"),
    progressRatio,
  };
}

function readRequiredFormText(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function readOptionalFormText(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function formatPercent(progressRatio: number): string {
  return `${Math.round(progressRatio * 100)}%`;
}
