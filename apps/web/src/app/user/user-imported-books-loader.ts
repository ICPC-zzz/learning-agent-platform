/**
 * Server-side loader for user page imported books count.
 *
 * Reads the dev session cookie, resolves the owner context, and queries
 * the DB for the count of books owned by the current dev user.
 *
 * Always safe — returns 0 when guards are not satisfied.
 *
 * @module user-imported-books-loader
 * @previewOnly
 */

import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaBookRepository,
} from "@learning-agent-platform/db";
import {
  resolveImportOwnerContext,
} from "../import/text-import-owner-context";
import {
  evaluateImportDbPersistGuard,
} from "../import/text-import-db-persist-guard";

export interface UserImportedBooksCountResult {
  count: number;
  canManage: boolean;
  reasonCode: string;
  message: string;
}

/**
 * Get the count of DB-persisted imported books for the current dev session user.
 *
 * @param cookieValue - Raw dev session cookie value from the request
 * @returns Safe result with count and management capability flag
 */
export async function getUserImportedBooksCount(
  cookieValue: string | undefined,
): Promise<UserImportedBooksCountResult> {
  const dbPersistGuard = evaluateImportDbPersistGuard();

  if (!dbPersistGuard.enabled) {
    return {
      count: 0,
      canManage: false,
      reasonCode: "db-persist-disabled",
      message: "DB persist not enabled.",
    };
  }

  if (!hasDatabaseUrl()) {
    return {
      count: 0,
      canManage: false,
      reasonCode: "no-db-url",
      message: "DATABASE_URL not configured.",
    };
  }

  const ownerContext = resolveImportOwnerContext(cookieValue);

  if (!ownerContext.hasOwner || !ownerContext.ownerId) {
    return {
      count: 0,
      canManage: false,
      reasonCode: "no-owner",
      message: "No dev session owner.",
    };
  }

  try {
    const repository = new PrismaBookRepository(getPrismaClient());
    const books = await repository.listBooks({
      ownerId: ownerContext.ownerId,
      limit: 200,
    });

    return {
      count: books.length,
      canManage: true,
      reasonCode: "loaded",
      message: `Found ${books.length} books.`,
    };
  } catch {
    return {
      count: 0,
      canManage: false,
      reasonCode: "db-read-failed",
      message: "Failed to read from database.",
    };
  }
}
