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

// Minimal scroll-progress sync (called from ReaderScrollPositionTracker)

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

// Minimal chapter-completion sync (called from ReaderChapterCompletionToggle)

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
    // Log error type for server-side diagnostics, never connection strings.
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

export interface ReaderPreviewSkippedField {
  field: string;
  reason: string;
}

export type ReaderPreviewManualSyncResult = {
  ok: boolean;
  status: "synced" | "partial" | "disabled" | "invalid" | "fallback" | "noop";
  message: string;
  syncedFields: string[];
  skippedFields: ReaderPreviewSkippedField[];
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

function pushSkippedField(
  skippedFields: ReaderPreviewSkippedField[],
  field: string,
  reason: string,
): void {
  skippedFields.push({ field, reason });
}

export async function manualSyncReaderPreviewToDbAction(
  input: ReaderPreviewManualSyncInput,
): Promise<ReaderPreviewManualSyncResult> {
  if (!input.syncEnabled) {
    return {
      ok: false,
      status: "disabled",
      message: "同步开关未开启：开发预览同步必须手动开启后再触发。",
      syncedFields: [],
      skippedFields: [],
    };
  }

  const bookId = normalizeOptionalText(input.bookId);
  const chapterId = normalizeOptionalText(input.chapterId);

  if (bookId === null || chapterId === null) {
    return {
      ok: false,
      status: "invalid",
      message: "开发预览同步不可用：缺少 bookId 或 chapterId。",
      syncedFields: [],
      skippedFields: [],
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
      syncedFields: [],
      skippedFields: [],
    };
  }

  const skippedFields: ReaderPreviewSkippedField[] = [];

  if (input.note.exists || input.note.charCount > 0) {
    pushSkippedField(
      skippedFields,
      "noteDraft.content",
      "当前 ReadingProgress schema 暂无笔记字段。为避免保存完整笔记正文，本轮仅保留本地记录。",
    );
    pushSkippedField(
      skippedFields,
      "noteDraft.charCount",
      "笔记长度仅用于同步预演摘要，当前 schema 无对应持久化字段。",
    );
  }

  if (input.timer.totalSeconds > 0) {
    pushSkippedField(
      skippedFields,
      "readingSeconds",
      "当前 ReadingProgress schema 暂无阅读计时字段（seconds）。",
    );
    pushSkippedField(
      skippedFields,
      "readingTimer.totalSeconds",
      "计时秒数当前仅用于本地记录与同步预演，不写入 ReadingProgress。",
    );
  }

  if (input.bookmark.updatedAt !== null) {
    pushSkippedField(
      skippedFields,
      "bookmark.updatedAt",
      "书签更新时间为本地字段；ReadingProgress 无对应书签时间列。",
    );
  }

  if (input.note.updatedAt !== null) {
    pushSkippedField(
      skippedFields,
      "noteDraft.updatedAt",
      "笔记更新时间为本地字段；ReadingProgress 无对应笔记时间列。",
    );
  }

  if (input.timer.updatedAt !== null) {
    pushSkippedField(
      skippedFields,
      "readingTimer.updatedAt",
      "计时更新时间为本地字段；ReadingProgress 无对应计时时间列。",
    );
  }

  if (input.latestLocalUpdatedAt !== null) {
    pushSkippedField(
      skippedFields,
      "lastReadAt",
      "当前 ReadingProgress schema 暂无 lastReadAt 字段；仅由 updatedAt 自动记录写入时间。",
    );
    pushSkippedField(
      skippedFields,
      "local.latestUpdatedAt",
      "本地聚合更新时间仅用于预演摘要，不直接写入数据库。",
    );
  }

  const bookmarkProgressRatio =
    typeof input.bookmark.scrollPercent === "number" &&
    Number.isFinite(input.bookmark.scrollPercent)
      ? clampProgressRatio(input.bookmark.scrollPercent / 100)
      : null;

  if (input.bookmark.exists && bookmarkProgressRatio === null) {
    pushSkippedField(
      skippedFields,
      "scrollProgress",
      "书签滚动百分比无效，无法映射到 ReadingProgress.progressRatio。",
    );
  }

  if (bookmarkProgressRatio === null) {
    return {
      ok: true,
      status: "noop",
      message:
        "无可安全映射字段：本次未写入数据库。本地笔记/书签/计时记录仍保留在浏览器。",
      syncedFields: [],
      skippedFields,
    };
  }

  if (input.bookmark.exists) {
    pushSkippedField(
      skippedFields,
      "scrollProgress",
      "当前 schema 无独立 scrollProgress 字段，本轮已映射到 readingProgress.progressRatio。",
    );
  }

  const envStatus = getDatabaseEnvStatus();
  if (!envStatus.hasDatabaseUrl) {
    return {
      ok: false,
      status: "fallback",
      message: "同步失败：数据库不可用。本地浏览器记录未受影响。",
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
        message: "同步失败：未找到演示用户。本地浏览器记录未受影响。",
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
    try {
      revalidatePath("/reader");
      revalidatePath(`/books/${bookId}`);
    } catch (error: unknown) {
      const brief =
        error instanceof Error
          ? `${error.constructor.name}: ${error.message.slice(0, 200)}`
          : String(error).slice(0, 200);
      console.error("[manualSyncReaderPreviewToDbAction] Revalidate failed:", brief);
    }

    const syncedFields = ["readingProgress.progressRatio", "readingProgress.updatedAt"];

    if (bookmarkProgressRatio >= 1) {
      syncedFields.push("readingProgress.completedAt");
    } else {
      pushSkippedField(
        skippedFields,
        "completed",
        "当前章节本地进度未达到 100%，本次不会写入 completedAt。",
      );
    }

    return {
      ok: true,
      status: skippedFields.length > 0 ? "partial" : "synced",
      message:
        skippedFields.length > 0
          ? "手动同步完成：已写入 ReadingProgress 可承载字段；其余字段按原因保留本地。"
          : "手动同步完成：已写入 ReadingProgress 可承载字段。本地记录仍保留。",
      syncedFields,
      skippedFields,
    };
  } catch {
    return {
      ok: false,
      status: "fallback",
      message: "同步失败：数据库写入异常。本地浏览器记录未受影响。",
      syncedFields: [],
      skippedFields,
    };
  }
}
