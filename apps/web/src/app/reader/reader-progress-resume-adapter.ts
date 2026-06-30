import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
} from "@learning-agent-platform/db";
import type { BookReaderData, ReadingProgressRecord } from "@learning-agent-platform/db";

export type ReaderProgressResumeStatus = "blocked" | "empty" | "loaded" | "read_failed";

export interface ReaderProgressResumeRecordPreview {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  progressRatio: number;
  completedAt: string | null;
  updatedAt: string;
}

export interface ReaderProgressResumeAdapterInput {
  ownerId?: string | null;
  ownerLabel?: string | null;
  bookId?: string | null;
  limit?: number;
  readingProgressRepository?: ReaderProgressResumeRepositoryLike | null;
  bookRepository?: ReaderProgressResumeBookRepositoryLike | null;
}

export interface ReaderProgressResumeRepositoryLike {
  listReadingProgress(
    input: { userId: string; bookId?: string; limit?: number },
  ): Promise<ReadingProgressRecord[]> | ReadingProgressRecord[];
}

export interface ReaderProgressResumeBookRepositoryLike {
  getBookReaderData(bookId: string): Promise<BookReaderData | null> | BookReaderData | null;
}

export interface ReaderProgressResumeAdapterResult {
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  productionReady: false;
  writesDatabase: false;
  readsDatabase: boolean;
  callsRepository: boolean;
  status: ReaderProgressResumeStatus;
  ownerId: string | null;
  ownerLabel: string | null;
  bookId: string | null;
  message: string;
  items: ReaderProgressResumeRecordPreview[];
}

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 3;

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function createBlockedResult(
  message: string,
  ownerId: string | null,
  ownerLabel: string | null,
  bookId: string | null,
): ReaderProgressResumeAdapterResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: false,
    callsRepository: false,
    status: "blocked",
    ownerId,
    ownerLabel,
    bookId,
    message,
    items: [],
  };
}

function createEmptyResult(
  message: string,
  ownerId: string,
  ownerLabel: string | null,
  bookId: string | null,
  readsDatabase: boolean,
): ReaderProgressResumeAdapterResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase,
    callsRepository: readsDatabase,
    status: "empty",
    ownerId,
    ownerLabel,
    bookId,
    message,
    items: [],
  };
}

function createLoadedResult(
  message: string,
  ownerId: string,
  ownerLabel: string | null,
  bookId: string | null,
  items: ReaderProgressResumeRecordPreview[],
): ReaderProgressResumeAdapterResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: true,
    callsRepository: true,
    status: "loaded",
    ownerId,
    ownerLabel,
    bookId,
    message,
    items,
  };
}

function createReadFailedResult(
  message: string,
  ownerId: string,
  ownerLabel: string | null,
  bookId: string | null,
): ReaderProgressResumeAdapterResult {
  return {
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    productionReady: false,
    writesDatabase: false,
    readsDatabase: true,
    callsRepository: true,
    status: "read_failed",
    ownerId,
    ownerLabel,
    bookId,
    message,
    items: [],
  };
}

async function callMaybePromise<T>(
  value: Promise<T> | T,
): Promise<T> {
  return await value;
}

async function readBookContextById(
  bookRepository: ReaderProgressResumeBookRepositoryLike,
  bookId: string,
): Promise<{ bookTitle: string; chapterTitleById: Map<string, string> }> {
  const readerData = await callMaybePromise(bookRepository.getBookReaderData(bookId));

  if (readerData === null) {
    return {
      bookTitle: bookId,
      chapterTitleById: new Map<string, string>(),
    };
  }

  const chapterTitleById = new Map<string, string>();
  for (const chapter of readerData.chapters) {
    chapterTitleById.set(chapter.id, chapter.title);
  }

  return {
    bookTitle: readerData.book.title,
    chapterTitleById,
  };
}

function normalizeRecord(
  record: ReadingProgressRecord,
  bookTitle: string,
  chapterTitle: string,
): ReaderProgressResumeRecordPreview {
  return {
    bookId: record.bookId,
    bookTitle,
    chapterId: record.chapterId,
    chapterTitle,
    progressRatio: record.progressRatio,
    completedAt: record.completedAt instanceof Date
      ? record.completedAt.toISOString()
      : null,
    updatedAt: record.updatedAt instanceof Date
      ? record.updatedAt.toISOString()
      : new Date().toISOString(),
  };
}

function normalizeProgressRecords(
  records: readonly ReadingProgressRecord[],
  bookContextById: Map<string, { bookTitle: string; chapterTitleById: Map<string, string> }>,
): ReaderProgressResumeRecordPreview[] {
  return records.map((record) => {
    const bookContext = bookContextById.get(record.bookId);
    const bookTitle = bookContext?.bookTitle ?? record.bookId;
    const chapterTitle = bookContext?.chapterTitleById.get(record.chapterId) ?? record.chapterId;

    return normalizeRecord(record, bookTitle, chapterTitle);
  });
}

export async function loadReaderProgressResumeData(
  input: ReaderProgressResumeAdapterInput = {},
): Promise<ReaderProgressResumeAdapterResult> {
  const ownerId = normalizeOptionalText(input.ownerId);
  const ownerLabel = normalizeOptionalText(input.ownerLabel);
  const bookId = normalizeOptionalText(input.bookId);
  const limit = normalizeLimit(input.limit);

  if (ownerId === null) {
    return createBlockedResult(
      "没有可信的 dev session 用户，阅读恢复保持为空态。",
      null,
      ownerLabel,
      bookId,
    );
  }

  if (input.readingProgressRepository === null) {
    return createBlockedResult(
      "阅读进度仓库不可用，dev-only 只读恢复保持为空态。",
      ownerId,
      ownerLabel,
      bookId,
    );
  }

  const progressRepository =
    input.readingProgressRepository ?? (hasDatabaseUrl()
      ? new PrismaReadingProgressRepository(getPrismaClient())
      : null);

  if (progressRepository === null) {
    return createBlockedResult(
      "DATABASE_URL 未配置，dev-only 只读恢复保持为空态。",
      ownerId,
      ownerLabel,
      bookId,
    );
  }

  const bookRepository =
    input.bookRepository ??
    (hasDatabaseUrl() ? new PrismaBookRepository(getPrismaClient()) : null);

  try {
    const progressRecords = await callMaybePromise(
      progressRepository.listReadingProgress({
        userId: ownerId,
        bookId: bookId ?? undefined,
        limit,
      }),
    );

    if (progressRecords.length === 0) {
      return createEmptyResult(
        bookId === null
          ? "当前 dev session 暂无已保存的阅读进度。"
          : "当前书籍暂无可继续阅读的 dev-only 进度。",
        ownerId,
        ownerLabel,
        bookId,
        true,
      );
    }

    const uniqueBookIds = [...new Set(progressRecords.map((record) => record.bookId))];
    const bookContextById = new Map<
      string,
      { bookTitle: string; chapterTitleById: Map<string, string> }
    >();

    for (const currentBookId of uniqueBookIds) {
      try {
        if (bookRepository === null) {
          bookContextById.set(currentBookId, {
            bookTitle: currentBookId,
            chapterTitleById: new Map<string, string>(),
          });
        } else {
          const context = await readBookContextById(bookRepository, currentBookId);
          bookContextById.set(currentBookId, context);
        }
      } catch {
        bookContextById.set(currentBookId, {
          bookTitle: currentBookId,
          chapterTitleById: new Map<string, string>(),
        });
      }
    }

    const items = normalizeProgressRecords(progressRecords, bookContextById);

    return createLoadedResult(
      bookId === null
        ? `已读取 ${items.length} 条 dev-only 阅读进度，未启用生产同步。`
        : `已读取该书的 dev-only 阅读进度，未启用生产同步。`,
      ownerId,
      ownerLabel,
      bookId,
      items,
    );
  } catch (error: unknown) {
    const brief = error instanceof Error ? error.constructor.name : "unknown";
    return createReadFailedResult(
      `阅读进度只读恢复失败（${brief}），页面保持安全空态。`,
      ownerId,
      ownerLabel,
      bookId,
    );
  }
}

export function createBlockedReaderProgressResumeData(
  ownerLabel?: string | null,
): ReaderProgressResumeAdapterResult {
  return createBlockedResult(
    "阅读进度恢复未启用，保持 dev-only 安全空态。",
    null,
    normalizeOptionalText(ownerLabel),
    null,
  );
}
