/**
 * User Recent Reading DB Loader — loads DB-stored reading progress
 * for the current dev session user.
 *
 * Only queries DB when the reader progress DB guard is enabled and
 * a dev session is active. Otherwise returns empty.
 *
 * @module user-recent-reading-db-loader
 * @previewOnly — dev-only; not production user system
 */

import {
  getPrismaClient,
  PrismaBookRepository,
  PrismaReadingProgressRepository,
} from "@learning-agent-platform/db";
import type { ReadingProgressRecord } from "@learning-agent-platform/db";

import { evaluateReaderProgressDbGuard } from "../reader/reader-progress-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbReadingProgressSummary {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
  progressPercent: number;
  updatedAt: string;
  source: "db-progress";
  ownerLabel: string;
}

export interface UserRecentReadingDbLoadResult {
  hasDbProgress: boolean;
  items: DbReadingProgressSummary[];
  message: string;
  guardEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load recent reading progress from DB for the current dev session user.
 *
 * @param cookieValue - The raw dev session cookie value
 * @param limit - Max items to return (default 10)
 * @returns Safe result — never leaks DB internals
 */
export async function loadUserRecentReadingDbProgress(
  cookieValue: string | undefined,
  limit: number = 10,
): Promise<UserRecentReadingDbLoadResult> {
  const guard = evaluateReaderProgressDbGuard(cookieValue);

  if (!guard.enabled || guard.sessionPayload === null) {
    return {
      hasDbProgress: false,
      items: [],
      message: guard.blockedReasons.length > 0
        ? `DB 阅读进度未启用：${guard.blockedReasons[0]}`
        : "DB 阅读进度未启用。",
      guardEnabled: false,
    };
  }

  const ownerId = guard.sessionPayload.userIdPreview;

  try {
    const prisma = getPrismaClient();
    const progressRepository = new PrismaReadingProgressRepository(prisma);
    const bookRepository = new PrismaBookRepository(prisma);

    const records = await progressRepository.listReadingProgress({
      userId: ownerId,
      limit: Math.min(Math.max(limit, 1), 50),
    });

    if (records.length === 0) {
      return {
        hasDbProgress: true,
        items: [],
        message: "当前 dev session 用户无 DB 阅读进度记录。",
        guardEnabled: true,
      };
    }

    const items = await enrichProgressWithBookInfo(records, bookRepository, ownerId);

    return {
      hasDbProgress: true,
      items,
      message: `已加载 ${items.length} 条 dev session 用户的 DB 阅读进度。`,
      guardEnabled: true,
    };
  } catch {
    return {
      hasDbProgress: true,
      items: [],
      message: "DB 阅读进度读取失败。页面仍可正常使用。",
      guardEnabled: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function enrichProgressWithBookInfo(
  records: readonly ReadingProgressRecord[],
  bookRepository: PrismaBookRepository,
  ownerLabel: string,
): Promise<DbReadingProgressSummary[]> {
  // Collect unique book IDs
  const uniqueBookIds = [...new Set(records.map((r) => r.bookId))];
  const bookTitleMap = new Map<string, string>();
  const chapterMap = new Map<string, { title: string; bookId: string }>();

  for (const bookId of uniqueBookIds) {
    try {
      const readerData = await bookRepository.getBookReaderData(bookId);
      if (readerData !== null) {
        bookTitleMap.set(bookId, readerData.book.title);
        for (const chapter of readerData.chapters) {
          chapterMap.set(chapter.id, {
            title: chapter.title,
            bookId,
          });
        }
      }
    } catch {
      // Skip failed book lookups — still return available records
    }
  }

  return records.map((record) => {
    const bookTitle = bookTitleMap.get(record.bookId) ?? record.bookId;
    const chapterInfo = chapterMap.get(record.chapterId);
    const chapterTitle = chapterInfo?.title ?? record.chapterId;

    return {
      bookId: record.bookId,
      chapterId: record.chapterId,
      bookTitle,
      chapterTitle,
      progressRatio: record.progressRatio,
      progressPercent: Math.round(record.progressRatio * 100),
      updatedAt: record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : new Date().toISOString(),
      source: "db-progress" as const,
      ownerLabel,
    };
  });
}
