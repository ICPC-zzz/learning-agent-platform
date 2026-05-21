import { getReaderDataFromDatabaseResult } from "./reader-db";
import { getReaderDataFromMock } from "./reader-mock";
import { sampleBook } from "./sample-book";
import type { ReaderPageDataLoadResult } from "./reader-types";

interface GetReaderPageDataInput {
  bookId?: string;
  chapterId?: string;
}

export async function getReaderPageData(
  input: GetReaderPageDataInput = {}
): Promise<ReaderPageDataLoadResult> {
  const bookId = normalizeOptionalText(input.bookId);

  if (bookId === undefined) {
    return {
      status: "missing_params",
      data: null,
      message:
        "阅读器缺少 bookId。请先从书库进入书籍详情页，再选择一个章节阅读。",
    };
  }

  if (bookId === sampleBook.document.id) {
    return {
      status: "loaded",
      data: getReaderDataFromMock("demo_fallback_requested"),
      message:
        "已加载演示 fallback 书籍。当前内容只用于验收最小阅读路径，不是生产数据。",
    };
  }

  const databaseResult = await getReaderDataFromDatabaseResult({
    bookId,
  });

  if (databaseResult.data !== null) {
    return {
      status: "loaded",
      data: databaseResult.data,
      message: "已从数据库加载当前书籍和章节内容。",
    };
  }

  if (databaseResult.fallbackReason === "missing_database_url") {
    return {
      status: "database_unavailable",
      data: null,
      message:
        "数据库不可用，因为 DATABASE_URL 未配置。请返回书库选择已标注的演示 fallback 书籍。",
    };
  }

  if (databaseResult.fallbackReason === "database_read_failed") {
    return {
      status: "read_failed",
      data: null,
      message:
        "无法从数据库读取当前书籍。请返回书库重新选择可阅读入口。",
    };
  }

  return {
    status: "book_not_found",
    data: null,
    message:
      "未找到此 bookId 对应的可读书籍或章节。请返回书库重新选择。",
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}
