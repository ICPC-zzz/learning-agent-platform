/**
 * Imported books management view model.
 *
 * Provides safe, serializable data for the /books/manage page.
 * All data is filtered by the current dev session user.
 *
 * @module imported-books-management-view-model
 * @previewOnly — dev-only, not production book management
 */

import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
  type BookListItem,
} from "@learning-agent-platform/db";

import {
  resolveImportOwnerContext,
  type ImportOwnerContext,
  createBlockedImportOwnerContext,
} from "../../import/text-import-owner-context";
import {
  evaluateImportDbPersistGuard,
  type ImportDbPersistGuardResult,
} from "../../import/text-import-db-persist-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportedBookSummary {
  id: string;
  title: string;
  author: string | undefined;
  sourceType: string;
  sourceLabel: string;
  chapterCount: number | undefined;
  updatedAtLabel: string | undefined;
  createdAtLabel: string | undefined;
  status: string | undefined;
  detailHref: string;
  readerHref: string | undefined;
  isArchived: boolean;
}

export interface ImportedBooksManagementViewModel {
  /** Page status identifier. */
  status: "loaded" | "no-session" | "db-persist-disabled" | "no-db-url" | "no-books" | "error";
  /** Human-readable message. */
  message: string;
  /** Owner context for the current request. */
  ownerContext: ImportOwnerContext;
  /** DB persist guard result. */
  dbPersistGuard: ImportDbPersistGuardResult;
  /** List of books owned by the current dev user. */
  books: ImportedBookSummary[];
  /** Total count of owned books. */
  totalCount: number;
  /** Whether the management page can perform write operations. */
  canManage: boolean;
  /** Safe to expose to client. */
  safeToExposeToClient: true;
}

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export interface BuildImportedBooksManagementViewModelInput {
  /** Raw dev session cookie value. */
  cookieValue?: string;
}

export async function buildImportedBooksManagementViewModel(
  input: BuildImportedBooksManagementViewModelInput,
): Promise<ImportedBooksManagementViewModel> {
  const dbPersistGuard = evaluateImportDbPersistGuard();

  // Resolve owner context
  let ownerContext: ImportOwnerContext;
  try {
    ownerContext = resolveImportOwnerContext(input.cookieValue);
  } catch {
    ownerContext = createBlockedImportOwnerContext("无法解析会话上下文");
  }

  // No dev session — blocked
  if (!ownerContext.hasOwner) {
    return {
      status: "no-session",
      message: ownerContext.blockedReasons.length > 0
        ? ownerContext.blockedReasons.join(" ")
        : "请先开启开发登录并登录 dev session。",
      ownerContext,
      dbPersistGuard,
      books: [],
      totalCount: 0,
      canManage: false,
      safeToExposeToClient: true,
    };
  }

  // DB persist not enabled
  if (!dbPersistGuard.enabled) {
    return {
      status: "db-persist-disabled",
      message: "DB 导入管理未启用。请设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true、LAP_ALLOW_REAL_DB_INTEGRATION=true，并配置 DATABASE_URL。",
      ownerContext,
      dbPersistGuard,
      books: [],
      totalCount: 0,
      canManage: false,
      safeToExposeToClient: true,
    };
  }

  // No DATABASE_URL
  if (!hasDatabaseUrl()) {
    return {
      status: "no-db-url",
      message: "DATABASE_URL 未配置，无法连接数据库。",
      ownerContext,
      dbPersistGuard,
      books: [],
      totalCount: 0,
      canManage: false,
      safeToExposeToClient: true,
    };
  }

  // Fetch books for the current owner
  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const ownerId = ownerContext.ownerId!;

    const books = await repository.listBooks({
      ownerId,
      limit: 100,
    });

    const summaries = books.map((book) => mapToImportedBookSummary(book));

    if (summaries.length === 0) {
      return {
        status: "no-books",
        message: "当前开发用户还没有导入书籍。请先通过 /import 导入文本并保存到数据库。",
        ownerContext,
        dbPersistGuard,
        books: [],
        totalCount: 0,
        canManage: true,
        safeToExposeToClient: true,
      };
    }

    return {
      status: "loaded",
      message: `已加载 ${summaries.length} 本导入书籍。`,
      ownerContext,
      dbPersistGuard,
      books: summaries,
      totalCount: summaries.length,
      canManage: true,
      safeToExposeToClient: true,
    };
  } catch {
    return {
      status: "error",
      message: "无法从数据库读取导入书籍列表。请检查数据库连接。",
      ownerContext,
      dbPersistGuard,
      books: [],
      totalCount: 0,
      canManage: false,
      safeToExposeToClient: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapToImportedBookSummary(book: BookListItem): ImportedBookSummary {
  const metadata = (book as any).metadata ?? {};
  const bookStatus = typeof metadata === "object" && metadata !== null
    ? (metadata as Record<string, unknown>).status
    : undefined;

  const isArchived = bookStatus === "archived";

  return {
    id: book.id,
    title: book.title,
    author: book.author ?? undefined,
    sourceType: book.sourceType,
    sourceLabel: "开发 DB 导入书籍 · dev-only · 未接生产用户书库",
    chapterCount: undefined, // Would need a separate query for chapter count
    updatedAtLabel: book.updatedAt
      ? formatDateLabel(book.updatedAt)
      : undefined,
    createdAtLabel: book.createdAt
      ? formatDateLabel(book.createdAt)
      : undefined,
    status: typeof bookStatus === "string" ? bookStatus : undefined,
    detailHref: `/books/${encodeURIComponent(book.id)}`,
    readerHref: `/reader?bookId=${encodeURIComponent(book.id)}`,
    isArchived,
  };
}

function formatDateLabel(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
