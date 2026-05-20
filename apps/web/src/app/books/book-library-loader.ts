import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
} from "@learning-agent-platform/db";
import type { BookListItem } from "@learning-agent-platform/db";

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
    return {
      status: "database_unavailable",
      books: [],
      message:
        "数据库不可用，因为 DATABASE_URL 未配置。当前环境无法列出已保存书籍。",
    };
  }

  try {
    const bookRepository = new PrismaBookRepository(getPrismaClient());
    const books = await bookRepository.listBooks({
      limit: normalizeLibraryLimit(input.limit),
    });

    if (books.length === 0) {
      return {
        status: "empty",
        books: [],
        message:
          "数据库可用，但暂未找到已保存书籍。",
      };
    }

    return {
      status: "loaded",
      books: books.map(mapBookListItem),
      message: `已从数据库加载 ${books.length} 本已保存书籍。`,
    };
  } catch {
    return {
      status: "read_failed",
      books: [],
      message:
        "无法从数据库读取已保存书籍。书库页面仍可打开，但不会显示数据库数据。",
    };
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
    detailHref: `/books/${encodeURIComponent(book.id)}`,
    readerHref: `/reader?bookId=${encodeURIComponent(book.id)}`,
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
