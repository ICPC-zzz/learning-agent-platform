/**
 * Favorites DB View Model — maps DB favorite records to UI-safe views
 * for /user, Books list, Book detail, and Reader pages.
 *
 * @module favorites-db-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { BookFavoriteRecord } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbFavoriteBookView {
  bookId: string;
  bookTitle: string;
  sourceType: string;
  firstChapterId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Data source badge. */
  source: "db-favorite";
  /** Dev session owner info — NOT a real user account. */
  ownerLabel: string | null;
  notice: string;
}

export interface DbFavoritesLoadResult {
  /** Whether the favorites DB guard was enabled. */
  guardEnabled: boolean;
  /** Whether to use DB favorites (guard passed + session valid). */
  useDbFavorites: boolean;
  /** DB-mapped favorite book views. */
  items: DbFavoriteBookView[];
  /** Human-readable message for UI. */
  message: string;
  /** Owner label for display. */
  ownerLabel: string | null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map a DB favorite record to a safe UI view.
 */
export function mapFavoriteRecordToView(
  record: BookFavoriteRecord,
  ownerLabel?: string | null,
): DbFavoriteBookView {
  return {
    bookId: record.bookId,
    bookTitle: record.bookTitle,
    sourceType: record.sourceType,
    firstChapterId: record.firstChapterId ?? null,
    createdAt: record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date
      ? record.updatedAt.toISOString()
      : String(record.updatedAt),
    source: "db-favorite",
    ownerLabel: ownerLabel ?? "dev session user",
    notice: "开发 DB 收藏 · 未接生产同步 · 绑定 dev session 用户",
  };
}

/**
 * Build an empty DB favorites load result (guard disabled or no session).
 */
export function createEmptyDbFavoritesLoadResult(
  guardEnabled: boolean,
  message: string,
): DbFavoritesLoadResult {
  return {
    guardEnabled,
    useDbFavorites: false,
    items: [],
    message,
    ownerLabel: null,
  };
}

/**
 * Build a DB favorites load result with data.
 */
export function buildDbFavoritesLoadResult(
  records: readonly BookFavoriteRecord[],
  ownerLabel?: string | null,
): DbFavoritesLoadResult {
  return {
    guardEnabled: true,
    useDbFavorites: true,
    items: records.map((r) => mapFavoriteRecordToView(r, ownerLabel)),
    message:
      records.length === 0
        ? "开发 DB 收藏为空。在当前 dev session 下收藏书籍后显示。"
        : `${records.length} 条开发 DB 收藏。未接生产同步。`,
    ownerLabel: ownerLabel ?? "dev session user",
  };
}
