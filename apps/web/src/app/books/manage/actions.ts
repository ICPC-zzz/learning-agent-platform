"use server";

/**
 * Server actions for managing imported books — rename and archive.
 *
 * All actions require:
 * - Dev auth guard enabled (LAP_WEB_AUTH_DEV_ENABLED=true)
 * - DB persist guard enabled (LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true etc.)
 * - Valid dev session with ownerId that matches the book's owner
 *
 * All results are safe to expose to the client — no secrets, tokens, or raw session data.
 *
 * @module imported-book-management-actions
 * @previewOnly — dev-only, not production book management
 */

import { cookies } from "next/headers";
import {
  getPrismaClient,
  PrismaBookRepository,
  type UpdateBookMetadataResult,
} from "@learning-agent-platform/db";
import {
  resolveImportOwnerContext,
  importOwnerContextIsSafe,
} from "../../import/text-import-owner-context";
import {
  evaluateImportDbPersistGuard,
  isImportDbPersistEnabled,
} from "../../import/text-import-db-persist-guard";
import { isDevAuthAllowed } from "../../../lib/web-auth-dev-guard";

// ---------------------------------------------------------------------------
// Safe result types
// ---------------------------------------------------------------------------

export interface RenameBookActionResult {
  success: boolean;
  bookId: string;
  newTitle: string | null;
  reasonCode: string;
  message: string;
  safeToExposeToClient: true;
  devOnly: true;
}

export interface ArchiveBookActionResult {
  success: boolean;
  bookId: string;
  archived: boolean;
  reasonCode: string;
  message: string;
  safeToExposeToClient: true;
  devOnly: true;
}

// ---------------------------------------------------------------------------
// Rename action
// ---------------------------------------------------------------------------

const MAX_TITLE_LENGTH = 120;
const FORBIDDEN_TITLE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
];

export async function renameImportedBook(
  _previousState: RenameBookActionResult | null,
  formData: FormData,
): Promise<RenameBookActionResult> {
  // Guard checks
  if (!isDevAuthAllowed()) {
    return {
      success: false,
      bookId: "",
      newTitle: null,
      reasonCode: "dev-auth-disabled",
      message: "开发登录未启用。请设置 LAP_WEB_AUTH_DEV_ENABLED=true。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  if (!isImportDbPersistEnabled()) {
    return {
      success: false,
      bookId: "",
      newTitle: null,
      reasonCode: "db-persist-disabled",
      message: "DB 导入管理未启用。请设置 LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true 等。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Read session
  let ownerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const ownerContext = resolveImportOwnerContext(raw);
    if (!ownerContext.hasOwner || !ownerContext.ownerId) {
      return {
        success: false,
        bookId: "",
        newTitle: null,
        reasonCode: "no-session",
        message: "请先通过 /login 登录 dev session。",
        safeToExposeToClient: true,
        devOnly: true,
      };
    }
    ownerId = ownerContext.ownerId;
  } catch {
    return {
      success: false,
      bookId: "",
      newTitle: null,
      reasonCode: "session-read-failed",
      message: "无法读取会话信息。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Parse form data
  const bookId = (formData.get("bookId") as string | null)?.trim() ?? "";
  const newTitle = (formData.get("title") as string | null)?.trim() ?? "";

  if (!bookId) {
    return {
      success: false,
      bookId: "",
      newTitle: null,
      reasonCode: "missing-book-id",
      message: "缺少书籍 ID。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Validate title
  if (!newTitle || newTitle.length === 0) {
    return {
      success: false,
      bookId,
      newTitle: null,
      reasonCode: "title-empty",
      message: "书名不能为空。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  if (newTitle.length > MAX_TITLE_LENGTH) {
    return {
      success: false,
      bookId,
      newTitle: null,
      reasonCode: "title-too-long",
      message: `书名不能超过 ${MAX_TITLE_LENGTH} 个字符。当前长度: ${newTitle.length}。`,
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Security: reject forbidden patterns
  for (const pattern of FORBIDDEN_TITLE_PATTERNS) {
    if (pattern.test(newTitle)) {
      return {
        success: false,
        bookId,
        newTitle: null,
        reasonCode: "forbidden-title-content",
        message: "书名包含不允许的内容。请使用普通书名。",
        safeToExposeToClient: true,
        devOnly: true,
      };
    }
  }

  // Execute rename
  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const result: UpdateBookMetadataResult = await repository.updateBookMetadata({
      bookId,
      requestedByOwnerId: ownerId,
      title: newTitle,
    });

    return {
      success: result.success,
      bookId,
      newTitle: result.success ? newTitle : null,
      reasonCode: result.reasonCode,
      message: result.message,
      safeToExposeToClient: true,
      devOnly: true,
    };
  } catch (caughtError) {
    const safeMessage =
      caughtError instanceof Error
        ? `重命名失败: ${redactSensitive(caughtError.message)}`
        : "重命名失败: 未知错误";

    return {
      success: false,
      bookId,
      newTitle: null,
      reasonCode: "rename-failed",
      message: safeMessage,
      safeToExposeToClient: true,
      devOnly: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Archive action
// ---------------------------------------------------------------------------

export async function archiveImportedBook(
  _previousState: ArchiveBookActionResult | null,
  formData: FormData,
): Promise<ArchiveBookActionResult> {
  // Guard checks
  if (!isDevAuthAllowed()) {
    return {
      success: false,
      bookId: "",
      archived: false,
      reasonCode: "dev-auth-disabled",
      message: "开发登录未启用。请设置 LAP_WEB_AUTH_DEV_ENABLED=true。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  if (!isImportDbPersistEnabled()) {
    return {
      success: false,
      bookId: "",
      archived: false,
      reasonCode: "db-persist-disabled",
      message: "DB 导入管理未启用。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Read session
  let ownerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const ownerContext = resolveImportOwnerContext(raw);
    if (!ownerContext.hasOwner || !ownerContext.ownerId) {
      return {
        success: false,
        bookId: "",
        archived: false,
        reasonCode: "no-session",
        message: "请先通过 /login 登录 dev session。",
        safeToExposeToClient: true,
        devOnly: true,
      };
    }
    ownerId = ownerContext.ownerId;
  } catch {
    return {
      success: false,
      bookId: "",
      archived: false,
      reasonCode: "session-read-failed",
      message: "无法读取会话信息。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  const bookId = (formData.get("bookId") as string | null)?.trim() ?? "";
  const archiveValue = (formData.get("archive") as string | null)?.trim();

  if (!bookId) {
    return {
      success: false,
      bookId: "",
      archived: false,
      reasonCode: "missing-book-id",
      message: "缺少书籍 ID。",
      safeToExposeToClient: true,
      devOnly: true,
    };
  }

  // Determine archive status
  const shouldArchive = archiveValue === "true" || archiveValue === "1";
  const newStatus = shouldArchive ? "archived" : "active";

  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const result = await repository.updateBookMetadata({
      bookId,
      requestedByOwnerId: ownerId,
      status: newStatus,
    });

    return {
      success: result.success,
      bookId,
      archived: result.success ? shouldArchive : false,
      reasonCode: result.reasonCode,
      message: result.success
        ? shouldArchive
          ? "书籍已归档（软删除，数据未物理删除）。"
          : "书籍已取消归档。"
        : result.message,
      safeToExposeToClient: true,
      devOnly: true,
    };
  } catch (caughtError) {
    const safeMessage =
      caughtError instanceof Error
        ? `归档操作失败: ${redactSensitive(caughtError.message)}`
        : "归档操作失败: 未知错误";

    return {
      success: false,
      bookId,
      archived: false,
      reasonCode: "archive-failed",
      message: safeMessage,
      safeToExposeToClient: true,
      devOnly: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
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
