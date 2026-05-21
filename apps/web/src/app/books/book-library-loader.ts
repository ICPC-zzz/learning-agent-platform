import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
} from "@learning-agent-platform/db";
import type { BookListItem } from "@learning-agent-platform/db";

import { sampleBook } from "../../lib/sample-book";
import type {
  BookLibraryItemView,
  BookLibraryLoadResult,
} from "./book-library-types";

const DEFAULT_BOOK_LIBRARY_LIMIT = 20;
const MAX_BOOK_LIBRARY_LIMIT = 50;

export async function loadBookLibrary(
  input: { limit?: number } = {},
): Promise<BookLibraryLoadResult> {
  if (!hasDatabaseUrl()) {
    return createMockFallbackLibraryResult(
      "数据库不可用，因为 DATABASE_URL 未配置。当前展示 1 本演示 fallback 书籍，用于验收 books -> reader 最短阅读路径。",
    );
  }

  try {
    const bookRepository = new PrismaBookRepository(getPrismaClient());
    const books = await bookRepository.listBooks({
      limit: normalizeLibraryLimit(input.limit),
    });

    if (books.length === 0) {
      return createMockFallbackLibraryResult(
        "数据库可用，但暂未找到已保存书籍。当前展示 1 本演示 fallback 书籍，用于验收章节列表和阅读器路径。",
      );
    }

    return {
      status: "loaded",
      books: books.map(mapBookListItem),
      message: `已从数据库加载 ${books.length} 本已保存书籍。`,
    };
  } catch {
    return createMockFallbackLibraryResult(
      "无法从数据库读取已保存书籍。当前展示 1 本演示 fallback 书籍；这不是生产数据。",
    );
  }
}

function mapBookListItem(book: BookListItem): BookLibraryItemView {
  return {
    id: book.id,
    title: book.title,
    author: normalizeOptionalText(book.author),
    language: normalizeOptionalText(book.language),
    sourceType: book.sourceType,
    createdAtLabel: formatDateLabel(book.createdAt),
    updatedAtLabel: formatDateLabel(book.updatedAt),
    summary: "数据库书籍入口：进入详情页后可查看章节列表并选择章节阅读。",
    detailHref: `/books/${encodeURIComponent(book.id)}`,
  };
}

function createMockFallbackLibraryResult(
  message: string,
): BookLibraryLoadResult {
  return {
    status: "mock_fallback",
    books: [mapSampleBookListItem()],
    message,
  };
}

function mapSampleBookListItem(): BookLibraryItemView {
  return {
    id: sampleBook.document.id,
    title: sampleBook.document.title,
    author: sampleBook.document.author ?? undefined,
    sourceType: "演示数据 / fallback",
    summary:
      "演示 fallback 书籍：用于在真实数据库暂无可读数据时验收最小阅读路径。",
    chapterCount: sampleBook.chapters.length,
    chunkCount: sampleBook.chunks.length,
    createdAtLabel: formatDateLabel(sampleBook.document.createdAt),
    detailHref: `/books/${encodeURIComponent(sampleBook.document.id)}`,
  };
}

function normalizeLibraryLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_BOOK_LIBRARY_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_BOOK_LIBRARY_LIMIT);
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
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
