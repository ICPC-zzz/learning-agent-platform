import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
  PrismaUserRepository,
} from "@learning-agent-platform/db";
import type {
  BookReaderData,
  ReadingProgressRecord,
  ReadingProgressRepository,
  UserRepository,
} from "@learning-agent-platform/db";

import { sampleBook } from "../../lib/sample-book";
import type {
  BookDetailChapterView,
  BookDetailLoadResult,
  BookDetailReadingProgressView,
  BookDetailView,
} from "./book-detail-types";

const demoUserEmail = "demo@example.com";

interface LoadBookDetailInput {
  bookId?: string;
}

interface ChapterChunkStats {
  chunkCount: number;
  characterCount: number;
}

export async function loadBookDetail({
  bookId,
}: LoadBookDetailInput): Promise<BookDetailLoadResult> {
  const normalizedBookId = normalizeOptionalText(bookId);

  if (normalizedBookId === undefined) {
    return {
      status: "unavailable",
      book: null,
      message: "书籍详情不可用，因为缺少书籍 ID。",
    };
  }

  if (!hasDatabaseUrl()) {
    if (isSampleBookId(normalizedBookId)) {
      return createSampleBookDetailResult(
        "开发数据源不可用，因为 DATABASE_URL 未配置。当前展示演示 fallback 书籍详情；这不是生产数据。",
      );
    }

    return {
      status: "database_unavailable",
      book: null,
      message:
        "开发数据源不可用，因为 DATABASE_URL 未配置。当前环境无法读取已保存书籍详情。",
    };
  }

  try {
    const prisma = getPrismaClient();
    const bookRepository = new PrismaBookRepository(prisma);
    const readerData = await bookRepository.getBookReaderData(normalizedBookId);

    if (readerData === null) {
      if (isSampleBookId(normalizedBookId)) {
        return createSampleBookDetailResult(
          "未找到开发数据源书籍记录。当前展示演示 fallback 书籍详情；这不是生产数据。",
        );
      }

      return {
        status: "book_not_found",
        book: null,
        message:
          "未找到此 ID 对应的开发数据源书籍。该书可能尚未通过文本预览保存入口写入当前环境。",
      };
    }

    const readingProgress = await loadBookReadingProgress({
      readerData,
      readingProgressRepository: new PrismaReadingProgressRepository(prisma),
      userRepository: new PrismaUserRepository(prisma),
    });
    const book = mapBookDetail(readerData, readingProgress);

    return {
      status: "loaded",
      book,
      message: `已从当前开发数据源加载元数据、${book.chapterCount} 个章节和 ${book.chunkCount} 个 chunk。`,
    };
  } catch {
    if (isSampleBookId(normalizedBookId)) {
      return createSampleBookDetailResult(
        "无法从开发数据源读取书籍详情。当前展示演示 fallback 书籍详情；这不是生产数据。",
      );
    }

    return {
      status: "read_failed",
      book: null,
      message:
        "无法从开发数据源读取书籍详情。详情页仍可打开，但不会显示开发数据源数据。",
    };
  }
}

function mapBookDetail(
  readerData: BookReaderData,
  readingProgress: BookDetailReadingProgressView,
): BookDetailView {
  const chunkStatsByChapterId = getChunkStatsByChapterId(readerData);
  const bookId = readerData.book.id;
  const chapters: BookDetailChapterView[] = readerData.chapters.map(
    (chapter) => {
      const stats = chunkStatsByChapterId.get(chapter.id) ?? {
        chunkCount: 0,
        characterCount: 0,
      };

      return {
        id: chapter.id,
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        level: chapter.level,
        chunkCount: stats.chunkCount,
        characterCount: stats.characterCount,
        readerHref: createReaderHref(bookId, chapter.id),
      };
    },
  );
  const characterCount = readerData.chunks.reduce(
    (total, chunk) => total + getChunkCharacterCount(chunk.plainText),
    0,
  );

  return {
    id: bookId,
    title: readerData.book.title,
    subtitle: normalizeOptionalText(readerData.book.subtitle),
    author: normalizeOptionalText(readerData.book.author),
    description: normalizeOptionalText(readerData.book.description),
    language: normalizeOptionalText(readerData.book.language),
    sourceType: readerData.book.sourceType,
    sourceUrl: normalizeOptionalText(readerData.book.sourceUrl),
    tags: normalizeTags(readerData.book.tags),
    createdAtLabel: formatDateLabel(readerData.book.createdAt),
    updatedAtLabel: formatDateLabel(readerData.book.updatedAt),
    chapterCount: chapters.length,
    chunkCount: readerData.chunks.length,
    characterCount,
    readerHref: createDefaultContinueReaderHref(readerData),
    readingProgress,
    chapters,
  };
}

function createSampleBookDetailResult(message: string): BookDetailLoadResult {
  return {
    status: "mock_fallback",
    book: mapSampleBookDetail(),
    message,
  };
}

function mapSampleBookDetail(): BookDetailView {
  const chapters: BookDetailChapterView[] = sampleBook.chapters.map(
    (chapter) => {
      const chapterChunks = sampleBook.chunks.filter(
        (chunk) => chunk.chapterId === chapter.id,
      );

      return {
        id: chapter.id,
        title: chapter.title,
        orderIndex: chapter.orderIndex,
        level: chapter.level ?? 1,
        chunkCount: chapterChunks.length,
        characterCount: chapterChunks.reduce(
          (total, chunk) => total + getChunkCharacterCount(chunk.plainText),
          0,
        ),
        readerHref: createReaderHref(sampleBook.document.id, chapter.id),
      };
    },
  );
  const firstChapter = sampleBook.chapters[0];
  const readerHref =
    firstChapter === undefined
      ? createReaderHref(sampleBook.document.id)
      : createReaderHref(sampleBook.document.id, firstChapter.id);

  return {
    id: sampleBook.document.id,
    title: sampleBook.document.title,
    author: sampleBook.document.author ?? undefined,
    description:
      "这是 Web MVP 的演示 fallback 书籍，仅用于开发数据源暂无可读内容时预览 books -> reader 最短路径。",
    sourceType: "演示数据 / fallback",
    tags: ["演示数据", "fallback", "preview-only"],
    createdAtLabel: formatDateLabel(sampleBook.document.createdAt),
    chapterCount: chapters.length,
    chunkCount: sampleBook.chunks.length,
    characterCount: sampleBook.chunks.reduce(
      (total, chunk) => total + getChunkCharacterCount(chunk.plainText),
      0,
    ),
    readerHref,
    readingProgress: {
      status: "progress_empty",
      message:
        "演示 fallback 书籍不读取也不保存阅读进度；进度保存与恢复留给 A132。",
      hasSavedProgress: false,
      completedChapterCount: 0,
      totalChapterCount: chapters.length,
      continueReaderHref: readerHref,
    },
    chapters,
  };
}

function isSampleBookId(bookId: string): boolean {
  return bookId === sampleBook.document.id;
}

async function loadBookReadingProgress({
  readerData,
  readingProgressRepository,
  userRepository,
}: {
  readerData: BookReaderData;
  readingProgressRepository: ReadingProgressRepository;
  userRepository: UserRepository;
}): Promise<BookDetailReadingProgressView> {
  const defaultContinueReaderHref = createDefaultContinueReaderHref(readerData);

  try {
    const demoUser = await userRepository.getUserByEmail(demoUserEmail);

    if (demoUser === null) {
      return {
        status: "demo_user_missing",
        message:
          "阅读进度预览不可用，因为未找到演示用户。",
        hasSavedProgress: false,
        completedChapterCount: 0,
        totalChapterCount: readerData.chapters.length,
        continueReaderHref: defaultContinueReaderHref,
      };
    }

    const progressRecords = await readingProgressRepository.listReadingProgress({
      userId: demoUser.id,
      bookId: readerData.book.id,
      limit: Math.max(readerData.chapters.length, 1),
    });

    return mapReadingProgressSummary({
      defaultContinueReaderHref,
      progressRecords,
      readerData,
    });
  } catch {
    return {
      status: "read_failed",
      message:
        "无法从开发数据源读取演示阅读进度。书籍详情数据仍会显示。",
      hasSavedProgress: false,
      completedChapterCount: 0,
      totalChapterCount: readerData.chapters.length,
      continueReaderHref: defaultContinueReaderHref,
    };
  }
}

function mapReadingProgressSummary({
  defaultContinueReaderHref,
  progressRecords,
  readerData,
}: {
  defaultContinueReaderHref: string;
  progressRecords: ReadingProgressRecord[];
  readerData: BookReaderData;
}): BookDetailReadingProgressView {
  const totalChapterCount = readerData.chapters.length;
  const chapterById = new Map(
    readerData.chapters.map((chapter) => [chapter.id, chapter] as const),
  );

  if (progressRecords.length === 0) {
    return {
      status: "progress_empty",
      message:
        "未找到演示用户在此书上的阅读进度预览记录。",
      hasSavedProgress: false,
      completedChapterCount: 0,
      totalChapterCount,
      continueReaderHref: defaultContinueReaderHref,
    };
  }

  const latestProgress = progressRecords[0];
  const latestChapter =
    latestProgress === undefined
      ? undefined
      : chapterById.get(latestProgress.chapterId);
  const completedChapterCount = countCompletedChapters(
    progressRecords,
    chapterById,
  );

  if (latestProgress === undefined || latestChapter === undefined) {
    return {
      status: "progress_saved",
      message:
        "存在演示阅读进度记录，但最新章节无法匹配到此书的当前章节。",
      hasSavedProgress: true,
      currentChapterProgressLabel:
        latestProgress === undefined
          ? undefined
          : formatPercent(latestProgress.progressRatio),
      completedChapterCount,
      totalChapterCount,
      updatedAtLabel:
        latestProgress === undefined
          ? undefined
          : formatDateLabel(latestProgress.updatedAt),
      continueReaderHref: defaultContinueReaderHref,
    };
  }

  return {
    status: "progress_saved",
    message: "已找到演示用户的阅读进度预览记录。",
    hasSavedProgress: true,
    currentChapterTitle: latestChapter.title,
    currentChapterLabel: `第 ${latestChapter.orderIndex + 1} 章 / 共 ${totalChapterCount} 章`,
    currentChapterProgressLabel: formatPercent(latestProgress.progressRatio),
    completedChapterCount,
    totalChapterCount,
    updatedAtLabel: formatDateLabel(latestProgress.updatedAt),
    continueReaderHref: createReaderHref(readerData.book.id, latestChapter.id),
  };
}

function createDefaultContinueReaderHref(readerData: BookReaderData): string {
  const firstChapter = readerData.chapters[0];

  if (firstChapter === undefined) {
    return createReaderHref(readerData.book.id);
  }

  return createReaderHref(readerData.book.id, firstChapter.id);
}

function createReaderHref(bookId: string, chapterId?: string): string {
  const bookQuery = `bookId=${encodeURIComponent(bookId)}`;

  if (chapterId === undefined) {
    return `/reader?${bookQuery}`;
  }

  return `/reader?${bookQuery}&chapterId=${encodeURIComponent(chapterId)}`;
}

function countCompletedChapters(
  progressRecords: readonly ReadingProgressRecord[],
  chapterById: ReadonlyMap<string, BookReaderData["chapters"][number]>,
): number {
  const completedChapterIds = new Set<string>();

  for (const progress of progressRecords) {
    if (!chapterById.has(progress.chapterId)) {
      continue;
    }

    if (progress.completedAt !== null || progress.progressRatio >= 1) {
      completedChapterIds.add(progress.chapterId);
    }
  }

  return completedChapterIds.size;
}

function getChunkStatsByChapterId(
  readerData: BookReaderData,
): Map<string, ChapterChunkStats> {
  const statsByChapterId = new Map<string, ChapterChunkStats>();

  for (const chunk of readerData.chunks) {
    const currentStats = statsByChapterId.get(chunk.chapterId) ?? {
      chunkCount: 0,
      characterCount: 0,
    };

    statsByChapterId.set(chunk.chapterId, {
      chunkCount: currentStats.chunkCount + 1,
      characterCount:
        currentStats.characterCount + getChunkCharacterCount(chunk.plainText),
    });
  }

  return statsByChapterId;
}

function getChunkCharacterCount(plainText: string): number {
  return plainText.length;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}

function normalizeTags(tags: readonly string[] | null | undefined): string[] {
  if (tags === undefined || tags === null) {
    return [];
  }

  return tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function formatDateLabel(
  value: Date | string | null | undefined,
): string | undefined {
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
