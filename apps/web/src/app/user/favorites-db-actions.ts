/**
 * Favorites DB Actions — dev-only server actions for book favorites
 * DB persistence.
 *
 * Reads the dev session cookie, evaluates the guard, validates payload,
 * and writes/reads through the FavoriteRepository.
 *
 * ALL writes/reads are blocked unless the favorites-db-guard passes.
 *
 * @module favorites-db-actions
 * @previewOnly — dev-only; never production sync
 */

import {
  getPrismaClient,
  PrismaFavoriteRepository,
  type BookFavoriteRecord,
} from "@learning-agent-platform/db";

import {
  evaluateFavoritesDbGuard,
  type FavoritesDbGuardResult,
} from "./favorites-db-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FavoritesDbActionInput {
  bookId: string;
  bookTitle: string;
  sourceType: string;
  firstChapterId?: string | null;
  ownerId: string;
}

export interface FavoritesDbActionSuccess {
  success: true;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: true;
  bookId: string;
  ownerIdPreview: string;
  isFavorite: boolean;
  reasonCode: string;
  productionReady: false;
  createdAt?: string;
}

export interface FavoritesDbActionBlocked {
  success: false;
  devOnly: true;
  writesDatabase: false;
  callsRepository: false;
  bookId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  blockedReasons: string[];
  productionReady: false;
}

export interface FavoritesDbActionError {
  success: false;
  devOnly: true;
  writesDatabase: boolean;
  callsRepository: boolean;
  bookId: string | null;
  ownerIdPreview: string | null;
  isFavorite: boolean;
  reasonCode: string;
  message: string;
  productionReady: false;
}

export type FavoritesDbActionResult =
  | FavoritesDbActionSuccess
  | FavoritesDbActionBlocked
  | FavoritesDbActionError;

// ---------------------------------------------------------------------------
// Dangerous field patterns (defense in depth)
// ---------------------------------------------------------------------------

const DANGEROUS_FIELD_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
];

function hasDangerousFields(input: Record<string, unknown>): boolean {
  const json = JSON.stringify(input);
  return DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateFavoriteInput(
  input: FavoritesDbActionInput,
): string | null {
  if (typeof input.bookId !== "string" || input.bookId.trim().length === 0) {
    return "bookId 必须为非空字符串。";
  }
  if (typeof input.bookTitle !== "string" || input.bookTitle.trim().length === 0) {
    return "bookTitle 必须为非空字符串。";
  }
  if (typeof input.sourceType !== "string" || input.sourceType.trim().length === 0) {
    return "sourceType 必须为非空字符串。";
  }
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return "ownerId 必须为非空字符串。";
  }
  if (hasDangerousFields(input as unknown as Record<string, unknown>)) {
    return "payload 包含敏感字段，已拒绝。";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Add a book to favorites in the database.
 * Idempotent — duplicate adds are safe (upsert).
 */
export async function doAddFavoriteBook(
  input: FavoritesDbActionInput,
  guard: FavoritesDbGuardResult,
): Promise<FavoritesDbActionResult> {
  // Step 1: Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(input.bookId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false,
      reasonCode: "favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Step 2: Input validation
  const validationError = validateFavoriteInput(input);
  if (validationError !== null) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(input.bookId),
      ownerIdPreview: normalizeField(input.ownerId),
      isFavorite: false,
      reasonCode: "invalid-favorite-payload",
      blockedReasons: [validationError],
      productionReady: false,
    };
  }

  // Step 3: Write to DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaFavoriteRepository(prisma);

    const record = await repository.addFavoriteBook({
      userId: input.ownerId,
      bookId: input.bookId.trim(),
      bookTitle: input.bookTitle.trim(),
      sourceType: input.sourceType.trim(),
      firstChapterId: input.firstChapterId ?? null,
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      bookId: record.bookId,
      ownerIdPreview: record.userId,
      isFavorite: true,
      reasonCode: "favorite-added",
      productionReady: false,
      createdAt: record.createdAt.toISOString(),
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(input.bookId), normalizeField(input.ownerId));
  }
}

/**
 * Remove a book from favorites in the database.
 * Safe if the record doesn't exist — returns success with isFavorite false.
 */
export async function doRemoveFavoriteBook(
  bookId: string,
  ownerId: string,
  guard: FavoritesDbGuardResult,
): Promise<FavoritesDbActionResult> {
  // Step 1: Guard check
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(bookId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  // Step 2: Input validation
  if (typeof bookId !== "string" || bookId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: null,
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "invalid-favorite-payload",
      blockedReasons: ["bookId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(bookId),
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  // Step 3: Remove from DB
  try {
    const prisma = getPrismaClient();
    const repository = new PrismaFavoriteRepository(prisma);

    // removeFavoriteBook is safe (returns false if not found)
    await repository.removeFavoriteBook({
      userId: ownerId.trim(),
      bookId: bookId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: true,
      callsRepository: true,
      bookId: bookId.trim(),
      ownerIdPreview: ownerId.trim(),
      isFavorite: false,
      reasonCode: "favorite-removed",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(bookId), normalizeField(ownerId));
  }
}

/**
 * Check if a book is favorited in the database.
 */
export async function doIsFavoriteBook(
  bookId: string,
  ownerId: string,
  guard: FavoritesDbGuardResult,
): Promise<FavoritesDbActionResult> {
  if (!guard.enabled) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(bookId),
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "favorites-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  if (typeof bookId !== "string" || bookId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: null,
      ownerIdPreview: normalizeField(ownerId),
      isFavorite: false,
      reasonCode: "invalid-bookId",
      blockedReasons: ["bookId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      bookId: normalizeField(bookId),
      ownerIdPreview: null,
      isFavorite: false,
      reasonCode: "no-dev-session-owner",
      blockedReasons: ["ownerId 必须为非空字符串。"],
      productionReady: false,
    };
  }

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaFavoriteRepository(prisma);

    const isFav = await repository.isFavoriteBook({
      userId: ownerId.trim(),
      bookId: bookId.trim(),
    });

    return {
      success: true,
      devOnly: true,
      writesDatabase: false,
      callsRepository: true,
      bookId: bookId.trim(),
      ownerIdPreview: ownerId.trim(),
      isFavorite: isFav,
      reasonCode: isFav ? "is-favorite" : "is-not-favorite",
      productionReady: false,
    };
  } catch (error: unknown) {
    return mapActionError(error, guard, normalizeField(bookId), normalizeField(ownerId));
  }
}

/**
 * List all favorites for the current dev session owner.
 */
export async function doListFavoritesByOwner(
  ownerId: string,
  guard: FavoritesDbGuardResult,
): Promise<BookFavoriteRecord[]> {
  if (!guard.enabled) return [];
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) return [];

  try {
    const prisma = getPrismaClient();
    const repository = new PrismaFavoriteRepository(prisma);

    return repository.listFavoritesByOwner({
      userId: ownerId.trim(),
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapActionError(
  error: unknown,
  _guard: FavoritesDbGuardResult,
  bookId: string | null,
  ownerIdPreview: string | null,
): FavoritesDbActionError {
  const brief =
    error instanceof Error ? error.constructor.name : "unknown";

  return {
    success: false,
    devOnly: true,
    writesDatabase: false,
    callsRepository: true,
    bookId,
    ownerIdPreview,
    isFavorite: false,
    reasonCode: "db-action-failed",
    message: `数据库操作失败（${brief}）。本地收藏不受影响。`,
    productionReady: false,
  };
}

function normalizeField(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Safe result check (for tests)
// ---------------------------------------------------------------------------

/**
 * Verify that an action result contains no sensitive fields.
 */
export function favoritesDbActionResultIsSafe(
  result: FavoritesDbActionResult,
): boolean {
  const json = JSON.stringify(result);
  return !DANGEROUS_FIELD_PATTERNS.some((p) => p.test(json));
}
