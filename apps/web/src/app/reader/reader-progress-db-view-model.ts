/**
 * Reader Progress DB View Model — maps DB progress records to
 * UI-safe view models for Reader page, /user, and continue reading.
 *
 * @module reader-progress-db-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { ReadingProgressRecord } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbReadingProgressView {
  hasProgress: boolean;
  bookId: string;
  chapterId: string;
  progressRatio: number;
  progressPercent: number;
  progressStatus: "not_started" | "in_progress" | "completed";
  updatedAt: string | null;
  source: "db-progress";
  /** Dev session owner info — NOT a real user account. */
  ownerLabel: string | null;
  notice: string;
}

export interface ContinueReadingView {
  hasContinueReading: boolean;
  continueHref: string | null;
  chapterTitle: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  notice: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map a DB progress record to a safe UI view.
 */
export function mapProgressRecordToView(
  record: ReadingProgressRecord,
  ownerLabel?: string | null,
): DbReadingProgressView {
  const progressPercent = Math.round(record.progressRatio * 100);
  const progressStatus =
    record.completedAt !== null || record.progressRatio >= 1
      ? "completed"
      : record.progressRatio > 0
        ? "in_progress"
        : "not_started";

  return {
    hasProgress: true,
    bookId: record.bookId,
    chapterId: record.chapterId,
    progressRatio: record.progressRatio,
    progressPercent,
    progressStatus,
    updatedAt: record.updatedAt instanceof Date
      ? record.updatedAt.toISOString()
      : null,
    source: "db-progress",
    ownerLabel: ownerLabel ?? "dev session user",
    notice: "dev-only DB 进度 · 未接生产同步 · 绑定 dev session 用户",
  };
}

/**
 * Build an empty DB progress view (no progress found).
 */
export function createEmptyDbProgressView(
  bookId: string,
  chapterId: string,
): DbReadingProgressView {
  return {
    hasProgress: false,
    bookId,
    chapterId,
    progressRatio: 0,
    progressPercent: 0,
    progressStatus: "not_started",
    updatedAt: null,
    source: "db-progress",
    ownerLabel: null,
    notice: "DB 阅读进度未启用。",
  };
}

/**
 * Build a continue reading view from DB progress records.
 */
export function buildContinueReadingView(
  records: readonly ReadingProgressRecord[],
  bookId: string,
  chapterTitle?: string | null,
): ContinueReadingView {
  if (records.length === 0) {
    return {
      hasContinueReading: false,
      continueHref: `/reader?bookId=${encodeURIComponent(bookId)}`,
      chapterTitle: chapterTitle ?? null,
      progressPercent: null,
      progressLabel: null,
      notice: "未找到该书的 DB 阅读进度。从第一章开始阅读。",
    };
  }

  const latest = records[0];
  if (!latest) {
    return {
      hasContinueReading: false,
      continueHref: `/reader?bookId=${encodeURIComponent(bookId)}`,
      chapterTitle: chapterTitle ?? null,
      progressPercent: null,
      progressLabel: null,
      notice: "未找到该书的 DB 阅读进度。",
    };
  }

  const progressPercent = Math.round(latest.progressRatio * 100);

  return {
    hasContinueReading: true,
    continueHref: `/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(latest.chapterId)}`,
    chapterTitle: chapterTitle ?? null,
    progressPercent,
    progressLabel: `继续阅读（进度 ${progressPercent}%）`,
    notice: "dev-only DB 进度 · 绑定 dev session 用户",
  };
}
