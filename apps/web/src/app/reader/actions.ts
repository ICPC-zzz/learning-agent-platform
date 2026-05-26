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

// ── Minimal scroll-progress sync (called from ReaderScrollPositionTracker) ──

export type SyncScrollProgressResult =
  | { status: "saved"; progressRatio: number }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string; message: string };

export async function syncScrollProgressAction(
  bookId: string,
  chapterId: string,
  progressRatio: number,
): Promise<SyncScrollProgressResult> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return { status: "skipped", reason: "database_unavailable" };
  }

  if (!Number.isFinite(progressRatio) || progressRatio < 0 || progressRatio > 1) {
    return { status: "skipped", reason: "invalid_progress_ratio" };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return { status: "skipped", reason: "demo_user_missing" };
    }

    const progress = await readingProgressRepository.upsertReadingProgress(
      createReadingProgressUpdateFromReaderState({
        userId: demoUser.id,
        bookId,
        chapterId,
        progressRatio,
      }),
    );

    return { status: "saved", progressRatio: progress.progressRatio };
  } catch {
    return {
      status: "error",
      reason: "db_error",
      message: "滚动进度数据库同步失败，本地进度仍然有效。",
    };
  }
}

// ── Minimal chapter-completion sync (called from ReaderChapterCompletionToggle) ──

export type SyncChapterCompletionResult =
  | { status: "saved"; completed: boolean }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string; message: string };

export async function syncChapterCompletionAction(
  bookId: string,
  chapterId: string,
  completed: boolean,
): Promise<SyncChapterCompletionResult> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return { status: "skipped", reason: "database_unavailable" };
  }

  try {
    const prisma = getPrismaClient();
    const userRepository = new PrismaUserRepository(prisma);
    const readingProgressRepository = new PrismaReadingProgressRepository(prisma);
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return { status: "skipped", reason: "demo_user_missing" };
    }

    if (completed) {
      await readingProgressRepository.markChapterCompleted({
        userId: demoUser.id,
        bookId,
        chapterId,
      });
    } else {
      await readingProgressRepository.upsertReadingProgress({
        userId: demoUser.id,
        bookId,
        chapterId,
        progressRatio: 0,
      });
    }

    return { status: "saved", completed };
  } catch (error: unknown) {
    // Log error type for server-side diagnostics — never connection strings
    const brief =
      error instanceof Error
        ? `${error.constructor.name}: ${error.message.slice(0, 200)}`
        : String(error).slice(0, 200);
    console.error("[syncChapterCompletion] DB error:", brief);
    return {
      status: "error",
      reason: "db_error",
      message: "已读状态数据库同步失败，本地状态仍然有效。",
    };
  }
}

export interface ReaderPreviewManualSyncInput {
  syncEnabled: boolean;
  bookId?: string | null;
  chapterId?: string | null;
  bookmark: {
    exists: boolean;
    scrollPercent: number | null;
    updatedAt: string | null;
  };
  note: {
    exists: boolean;
    charCount: number;
    updatedAt: string | null;
  };
  timer: {
    totalSeconds: number;
    updatedAt: string | null;
  };
  latestLocalUpdatedAt: string | null;
}

export type ReaderPreviewManualSyncResult = {
  ok: boolean;
  status: "synced" | "partial" | "disabled" | "invalid" | "fallback" | "noop";
  message: string;
  syncedFields?: string[];
  skippedFields?: string[];
};

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function clampProgressRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

export async function manualSyncReaderPreviewToDbAction(
  input: ReaderPreviewManualSyncInput,
): Promise<ReaderPreviewManualSyncResult> {
  if (!input.syncEnabled) {
    return {
      ok: false,
      status: "disabled",
      message: "同步开关未开启：开发预览同步需要手动开启后再触发。",
    };
  }

  const bookId = normalizeOptionalText(input.bookId);
  const chapterId = normalizeOptionalText(input.chapterId);

  if (bookId === null || chapterId === null) {
    return {
      ok: false,
      status: "invalid",
      message: "开发预览同步不可用：缺少 bookId 或 chapterId。",
    };
  }

  const hasAnyLocalRecord =
    input.bookmark.exists ||
    input.note.exists ||
    input.note.charCount > 0 ||
    input.timer.totalSeconds > 0 ||
    input.latestLocalUpdatedAt !== null;

  if (!hasAnyLocalRecord) {
    return {
      ok: true,
      status: "noop",
      message: "无本地记录可同步。",
    };
  }

  const skippedFields: string[] = [];

  if (input.note.exists || input.note.charCount > 0) {
    skippedFields.push("noteDraft.content");
  }

  if (input.timer.totalSeconds > 0) {
    skippedFields.push("readingTimer.totalSeconds");
  }

  if (input.bookmark.updatedAt !== null) {
    skippedFields.push("bookmark.updatedAt");
  }

  if (input.note.updatedAt !== null) {
    skippedFields.push("noteDraft.updatedAt");
  }

  if (input.timer.updatedAt !== null) {
    skippedFields.push("readingTimer.updatedAt");
  }

  if (input.latestLocalUpdatedAt !== null) {
    skippedFields.push("local.latestUpdatedAt");
  }

  const bookmarkProgressRatio =
    typeof input.bookmark.scrollPercent === "number" &&
    Number.isFinite(input.bookmark.scrollPercent)
      ? clampProgressRatio(input.bookmark.scrollPercent / 100)
      : null;

  if (input.bookmark.exists && bookmarkProgressRatio === null) {
    skippedFields.push("bookmark.scrollPercent");
  }

  if (bookmarkProgressRatio === null) {
    return {
      ok: true,
      status: "partial",
      message:
        "部分本地记录暂未同步：笔记/书签/计时仍仅保存在当前浏览器。当前章节缺少可映射的阅读进度百分比。",
      syncedFields: [],
      skippedFields,
    };
  }

  const envStatus = getDatabaseEnvStatus();
  if (!envStatus.hasDatabaseUrl) {
    return {
      ok: false,
      status: "fallback",
      message: "同步预览失败，本地记录未受影响。",
      syncedFields: [],
      skippedFields,
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
        ok: false,
        status: "fallback",
        message: "同步预览失败，本地记录未受影响。",
        syncedFields: [],
        skippedFields,
      };
    }

    const readerData = await bookRepository.getBookReaderData(bookId);
    if (
      readerData === null ||
      !readerData.chapters.some((chapter) => chapter.id === chapterId)
    ) {
      return {
        ok: false,
        status: "invalid",
        message: "开发预览同步不可用：未找到当前书籍或章节。",
        syncedFields: [],
        skippedFields,
      };
    }

    await readingProgressRepository.upsertReadingProgress({
      userId: demoUser.id,
      bookId,
      chapterId,
      progressRatio: bookmarkProgressRatio,
    });

    revalidatePath("/reader");
    revalidatePath(`/books/${bookId}`);

    const syncedFields = ["readingProgress.progressRatio"];

    return {
      ok: true,
      status: skippedFields.length > 0 ? "partial" : "synced",
      message:
        skippedFields.length > 0
          ? "开发预览同步完成：已写入可支持的阅读进度字段。本地记录仍保留。部分本地记录暂未同步：笔记/书签/计时仍仅保存在当前浏览器。"
          : "开发预览同步完成：已写入可支持的阅读进度字段。本地记录仍保留。",
      syncedFields,
      skippedFields,
    };
  } catch {
    return {
      ok: false,
      status: "fallback",
      message: "同步预览失败，本地记录未受影响。",
      syncedFields: [],
      skippedFields,
    };
  }
}
