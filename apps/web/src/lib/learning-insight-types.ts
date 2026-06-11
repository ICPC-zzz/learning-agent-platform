/**
 * Learning Insight Types — shared safe summary types for aggregating
 * user learning data across all localStorage + DB sources.
 *
 * All inputs are safe previews only: no raw prompt/response, no full
 * chapter content, no user-submitted code, no tokens or secrets.
 *
 * @module learning-insight-types
 * @previewOnly — dev-only; not production user system
 */

// ---------------------------------------------------------------------------
// Safe summary input types
// ---------------------------------------------------------------------------

export interface SafeReadingSummary {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  progressRatio: number;
  lastReadAt: string;
  sourceType: string;
}

export interface SafeReadingSessionSummary {
  totalSessions: number;
  totalDurationMinutes: number;
  todayDurationMinutes: number;
}

export interface SafeProblemPracticeSummary {
  problemId: string;
  title: string;
  difficulty: string;
  status: string;
  updatedAt: string;
}

export interface SafeProblemFavoriteSummary {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  favoritedAt: string;
}

export interface SafeWrongBookSummary {
  wrongBookId: string;
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  wrongCount: number;
  lastWrongAt: string;
  reviewStatus: string;
  notePreview: string | null;
  sourceType: string;
}

export interface SafeBookmarkSummary {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  createdAt: string;
}

export interface SafeNoteSummary {
  noteId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  noteTextPreview: string;
  createdAt: string;
}

export interface SafeAiHistorySummary {
  historyId: string;
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  questionPreview: string;
  createdAt: string;
}

export interface SafeActivitySummary {
  activityId: string;
  activityType: string;
  title: string;
  targetType: string;
  targetId: string;
  bookId: string | null;
  chapterId: string | null;
  problemId: string | null;
  occurredAt: string;
  durationSeconds: number | null;
}

/**
 * Learning status tag — computed from aggregated data, deterministic.
 */
export type LearningStatusTag =
  | "reading-active"
  | "practice-needs-improvement"
  | "wrong-book-needs-review"
  | "no-data";

export const LEARNING_STATUS_LABELS: Record<LearningStatusTag, string> = {
  "reading-active": "阅读活跃",
  "practice-needs-improvement": "刷题待加强",
  "wrong-book-needs-review": "错题待复习",
  "no-data": "暂无数据",
};

// ---------------------------------------------------------------------------
// Aggregated report types
// ---------------------------------------------------------------------------

export interface LearningReportSummary {
  /** Today's summary metrics. */
  today: {
    activityCount: number;
    readingMinutes: number;
    practiceCount: number;
    wrongAddedCount: number;
  };
  /** Last 7 days summary. */
  last7Days: {
    activityCount: number;
    readingMinutes: number;
    readingSessionCount: number;
    practiceCount: number;
    wrongAddedCount: number;
  };
  /** Reading statistics. */
  reading: {
    recentReadingCount: number;
    totalReadingMinutes: number;
    totalReadingSessions: number;
    latestChapterTitle: string | null;
    latestBookTitle: string | null;
  };
  /** Problem statistics. */
  problems: {
    recentPracticeCount: number;
    favoriteProblemsCount: number;
    wrongBookTotalCount: number;
    wrongBookNeedsReviewCount: number;
  };
  /** Annotation statistics. */
  annotations: {
    bookmarkCount: number;
    noteCount: number;
    aiHistoryCount: number;
  };
  /** Current learning status. */
  statusTag: LearningStatusTag;
  statusLabel: string;
  /** Data source note. */
  dataSourceNotice: string;
  /** Whether any data exists. */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Review recommendation types
// ---------------------------------------------------------------------------

export type RecommendationPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ReviewRecommendation {
  recommendationId: string;
  title: string;
  reason: string;
  targetType: "problem" | "chapter" | "book";
  targetId: string;
  targetLink: string;
  priority: RecommendationPriority;
  sourceType: string;
  safetyLabel: string;
}

export interface ReviewRecommendationsView {
  recommendations: ReviewRecommendation[];
  totalCount: number;
  dataSourceNotice: string;
  hasSession: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Today plan types
// ---------------------------------------------------------------------------

export type TaskStatus = "todo" | "suggested";

export interface TodayPlanTask {
  taskId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  targetType: string;
  targetId: string;
  targetLink: string;
  status: TaskStatus;
  reason: string;
  devOnlyLabel: string;
}

export interface TodayPlanView {
  tasks: TodayPlanTask[];
  totalTasks: number;
  totalEstimatedMinutes: number;
  dataSourceNotice: string;
  hasSession: boolean;
  message: string;
}
