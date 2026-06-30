"use server";

/**
 * Delete Book Server Action for /books Page
 *
 * Allows deleting imported/test books from the local book library.
 * Built-in sample books are protected from deletion.
 *
 * Guards:
 * - Dev auth guard (LAP_WEB_AUTH_DEV_ENABLED=true)
 * - DB persist guard (LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true)
 * - Book ownership or dev session check
 *
 * All results are safe to expose — no secrets, tokens, or raw session data.
 *
 * @module delete-book-actions
 * @previewOnly — dev-only book deletion, not for production
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getPrismaClient,
  PrismaBookRepository,
  type DeleteBookResult,
} from "@learning-agent-platform/db";
import {
  resolveImportOwnerContext,
} from "../import/text-import-owner-context";
import {
  evaluateImportDbPersistGuard,
} from "../import/text-import-db-persist-guard";
import { isDevAuthAllowed } from "../../lib/web-auth-dev-guard";
import { isSampleBookId } from "./sample-programming-books";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface DeleteBookActionResult {
  success: boolean;
  bookId: string;
  deletedChapterCount: number;
  reasonCode: string;
  message: string;
  safeToExposeToClient: true;
  devOnly: true;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Delete a book from the local book library.
 *
 * Requirements:
 * - Must have a valid dev session
 * - DB persist guard must be enabled
 * - Built-in sample books cannot be deleted
 * - Deletes chapters, chunks, and reading progress
 */
export async function deleteBookAction(
  _previousState: DeleteBookActionResult | null,
  formData: FormData,
): Promise<DeleteBookActionResult> {
  // Guard: dev auth
  if (!isDevAuthAllowed()) {
    return {
      success: false,
      bookId: "",
      deletedChapterCount: 0,
      reasonCode: "dev-auth-disabled",
      message: "开发登录未启用。请设置 LAP_WEB_AUTH_DEV_ENABLED=true。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Guard: DB persist
  const dbGuard = evaluateImportDbPersistGuard();
  if (!dbGuard.enabled) {
    return {
      success: false,
      bookId: "",
      deletedChapterCount: 0,
      reasonCode: "db-persist-disabled",
      message: "DB 持久化未启用。请设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Read session for ownership
  let ownerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const ownerContext = resolveImportOwnerContext(raw);
    if (!ownerContext.hasOwner || !ownerContext.ownerId) {
      return {
        success: false,
        bookId: "",
        deletedChapterCount: 0,
        reasonCode: "no-session",
        message: "请先通过 /login 登录。",
        safeToExposeToClient: true,
        devOnly: true,
      };
    }
    ownerId = ownerContext.ownerId;
  } catch {
    return {
      success: false,
      bookId: "",
      deletedChapterCount: 0,
      reasonCode: "session-read-failed",
      message: "无法读取会话信息。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Parse bookId
  const bookId = (formData.get("bookId") as string | null)?.trim() ?? "";

  if (!bookId) {
    return {
      success: false,
      bookId: "",
      deletedChapterCount: 0,
      reasonCode: "missing-book-id",
      message: "缺少书籍 ID。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Protect built-in sample books
  if (isSampleBookId(bookId)) {
    return {
      success: false,
      bookId,
      deletedChapterCount: 0,
      reasonCode: "builtin-protected",
      message: "内置示例书籍不能被删除。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Execute deletion
  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const result: DeleteBookResult = await repository.deleteBook({ bookId });

    try { revalidatePath("/books"); } catch { /* best-effort */ }

    return {
      success: result.deleted,
      bookId: result.bookId,
      deletedChapterCount: result.chapterCount,
      reasonCode: result.deleted ? "deleted" : "not-found",
      message: result.deleted
        ? `书籍已删除，同时删除 ${result.chapterCount} 个章节和 ${result.chunkCount} 个内容块。`
        : "未找到可删除的书籍，或书籍已经被删除。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  } catch (caughtError) {
    const safeMessage =
      caughtError instanceof Error
        ? `删除失败: ${redactSensitive(caughtError.message)}`
        : "删除失败: 未知错误";

    return {
      success: false,
      bookId,
      deletedChapterCount: 0,
      reasonCode: "delete-failed",
      message: safeMessage,
      safeToExposeToClient: true,
      devOnly: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /postgres(ql)?:\/\/[^\s]*/gi,
  /DATABASE_URL[=:]\s*[^\s]*/gi,
  /connection\s+string[=:]\s*[^\s]*/gi,
  /password[=:]\s*[^\s]*/gi,
  /secret[=:]\s*[^\s]*/gi,
  /token[=:]\s*[^\s]*/gi,
  /api[_-]?key[=:]\s*[^\s]*/gi,
];

function redactSensitive(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[已隐藏]");
  }
  return result;
}
