import {
  formatReaderDuration,
  getReaderLocalStatusStorageKey,
  isReaderLocalStorageAvailable,
} from "../reader/reader-local-storage";

export interface LearningReaderLocalStatusSummary {
  schemaVersion: 1;
  source: "reader";
  previewOnly: true;
  bookId: string | null;
  chapterId: string | null;
  bookTitle: string | null;
  chapterTitle: string | null;
  progressPercent: number | null;
  progressRatio: number | null;
  noteCount: number;
  bookmarkCount: number;
  readingSeconds: number;
  updatedAt: string | null;
}

export interface LearningReaderLocalStatusReadResult {
  storageAvailable: boolean;
  summary: LearningReaderLocalStatusSummary | null;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizeCount(value: unknown): number {
  const normalized = normalizeNonNegativeNumber(value);
  if (normalized === null) {
    return 0;
  }

  return Math.floor(normalized);
}

function normalizeProgressPercent(progressPercent: unknown): number | null {
  const normalized = normalizeNonNegativeNumber(progressPercent);
  if (normalized === null) {
    return null;
  }

  return Math.min(Math.max(normalized, 0), 100);
}

function normalizeProgressRatio(progressRatio: unknown): number | null {
  const normalized = normalizeNonNegativeNumber(progressRatio);
  if (normalized === null) {
    return null;
  }

  return Math.min(Math.max(normalized, 0), 1);
}

export function parseLearningReaderLocalStatusSummary(
  value: unknown,
): LearningReaderLocalStatusSummary | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const summary = value as Record<string, unknown>;
  if (
    summary.schemaVersion !== 1 ||
    summary.source !== "reader" ||
    summary.previewOnly !== true
  ) {
    return null;
  }

  const progressPercent = normalizeProgressPercent(summary.progressPercent);
  const progressRatio = normalizeProgressRatio(summary.progressRatio);

  const resolvedProgressPercent =
    progressPercent ?? (progressRatio === null ? null : progressRatio * 100);
  const resolvedProgressRatio =
    progressRatio ?? (progressPercent === null ? null : progressPercent / 100);

  const readingSeconds =
    normalizeNonNegativeNumber(summary.readingSeconds) ??
    normalizeNonNegativeNumber(summary.sessionSeconds) ??
    0;

  return {
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    bookId: normalizeNullableString(summary.bookId),
    chapterId: normalizeNullableString(summary.chapterId),
    bookTitle: normalizeNullableString(summary.bookTitle),
    chapterTitle: normalizeNullableString(summary.chapterTitle),
    progressPercent: resolvedProgressPercent,
    progressRatio: resolvedProgressRatio,
    noteCount: normalizeCount(summary.noteCount),
    bookmarkCount: normalizeCount(summary.bookmarkCount),
    readingSeconds,
    updatedAt: normalizeNullableString(summary.updatedAt),
  };
}

export function parseLearningReaderLocalStatusSummaryRaw(
  rawValue: string | null,
): LearningReaderLocalStatusSummary | null {
  if (rawValue === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return parseLearningReaderLocalStatusSummary(parsed);
  } catch {
    return null;
  }
}

export function readLearningReaderLocalStatusSummaryFromStorage(): LearningReaderLocalStatusReadResult {
  if (!isReaderLocalStorageAvailable() || typeof window === "undefined") {
    return {
      storageAvailable: false,
      summary: null,
    };
  }

  try {
    const rawValue = window.localStorage.getItem(getReaderLocalStatusStorageKey());
    return {
      storageAvailable: true,
      summary: parseLearningReaderLocalStatusSummaryRaw(rawValue),
    };
  } catch {
    return {
      storageAvailable: false,
      summary: null,
    };
  }
}

export function formatLearningReaderLocalStatusProgress(
  summary: LearningReaderLocalStatusSummary,
): string {
  if (summary.progressPercent === null) {
    return "-";
  }

  return `${Math.round(summary.progressPercent)}%`;
}

export function formatLearningReaderLocalStatusDuration(
  summary: LearningReaderLocalStatusSummary,
): string {
  return formatReaderDuration(summary.readingSeconds);
}
