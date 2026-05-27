export type LearningRecentReadingProgressSource =
  | "database"
  | "empty"
  | "fallback";

export type LearningRecentReadingProgressStatus =
  | "loaded"
  | "empty"
  | "database_unavailable"
  | "demo_user_missing"
  | "read_failed"
  | "unavailable";

export interface LearningRecentReadingProgressItem {
  id: string;
  bookId: string;
  chapterId: string;
  bookLabel: string;
  chapterLabel: string;
  progressRatio: number;
  progressPercent: string;
  updatedAt?: string;
  completedAt?: string;
  latestSyncedAt?: string;
}

export interface LearningRecentReadingProgressPanelViewModel {
  status: LearningRecentReadingProgressStatus;
  source: LearningRecentReadingProgressSource;
  sourceLabel: string;
  message: string;
  limit: number;
  recentCount: number;
  items: readonly LearningRecentReadingProgressItem[];
}
