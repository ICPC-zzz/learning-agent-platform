"use client";

import { useEffect, useState } from "react";

import type { DashboardStatsView } from "./user-dashboard-stats-view-model";
import type { DashboardLearningStatsView } from "./user-dashboard-learning-stats-view-model";
import {
  buildUnifiedStatsView,
  createEmptyLocalStats,
} from "./user-dashboard-unified-stats-view-model";
import type {
  UnifiedStatsView,
  DashboardLocalStatsInput,
} from "./user-dashboard-unified-stats-view-model";
import { UserDashboardUnifiedStatsPanel } from "./UserDashboardUnifiedStatsPanel";

// localStorage store imports
import { loadLearningActivities, loadReadingSessions } from "../../lib/local-learning-activity-store";
import { loadWrongBook } from "../../lib/local-problem-wrong-book-store";
import {
  loadFavoriteBooks,
  loadRecentReadings,
} from "../../lib/local-user-library-store";
import {
  loadFavoriteProblems,
  loadRecentPractice,
} from "../../lib/local-user-problem-store";
import {
  loadReaderBookmarks,
  loadReaderNotes,
} from "../../lib/local-reader-annotation-store";
import { loadAiHistory } from "../../lib/local-reader-ai-history-store";
import {
  buildReadingSessionSummary,
  buildDashboardLocalInsightStats,
} from "../../lib/learning-insight-local-data";
import { loadDailyChallenge } from "../../lib/local-daily-challenge-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserDashboardUnifiedStatsHydrationProps {
  /** Server-side dashboard stats (from buildDashboardStatsView). */
  serverStats: DashboardStatsView;
  /** Server-side learning stats (from buildDashboardLearningStatsView). */
  serverLearningStats: DashboardLearningStatsView;
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** Optional: extra nav links / children rendered at the bottom. */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserDashboardUnifiedStatsHydration({
  serverStats,
  serverLearningStats,
  hasSession,
  children,
}: UserDashboardUnifiedStatsHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [fullView, setFullView] = useState<UnifiedStatsView | null>(null);

  // Build server-only view for initial render (no local data)
  const serverOnlyView = buildUnifiedStatsView({
    serverStats,
    serverLearningStats,
    localStats: null,
    hasSession,
  });

  useEffect(() => {
    try {
      const localStats = readAllLocalStats();
      const merged = buildUnifiedStatsView({
        serverStats,
        serverLearningStats,
        localStats,
        hasSession,
      });
      setFullView(merged);
    } catch {
      // On error, fall back to server-only view
      setFullView(serverOnlyView);
    }
    setMounted(true);
  }, []);

  const displayView = mounted && fullView ? fullView : serverOnlyView;

  return (
    <UserDashboardUnifiedStatsPanel
      unifiedStats={displayView}
      hasSession={hasSession}
    >
      {children}
    </UserDashboardUnifiedStatsPanel>
  );
}

// ---------------------------------------------------------------------------
// Local data reader
// ---------------------------------------------------------------------------

function readAllLocalStats(): DashboardLocalStatsInput {
  const localStats = createEmptyLocalStats();

  try {
    const favBooks = loadFavoriteBooks();
    localStats.favoriteBookCount = favBooks.length;
  } catch {
    // Silently ignore
  }

  try {
    const recentReadings = loadRecentReadings();
    localStats.recentReadingCount = recentReadings.length;
  } catch {
    // Silently ignore
  }

  try {
    const favProblems = loadFavoriteProblems();
    localStats.favoriteProblemCount = favProblems.length;
  } catch {
    // Silently ignore
  }

  try {
    const recentPractice = loadRecentPractice();
    localStats.recentPracticeCount = recentPractice.length;
  } catch {
    // Silently ignore
  }

  try {
    const wrongBook = loadWrongBook();
    localStats.wrongBookTotalCount = wrongBook.length;
    localStats.wrongBookNeedsReviewCount = wrongBook.filter(
      function (e) { return e.reviewStatus === "needs-review"; },
    ).length;
  } catch {
    // Silently ignore
  }

  try {
    const bookmarks = loadReaderBookmarks();
    localStats.bookmarkCount = bookmarks.length;
  } catch {
    // Silently ignore
  }

  try {
    const notes = loadReaderNotes();
    localStats.noteCount = notes.length;
  } catch {
    // Silently ignore
  }

  try {
    const aiHistory = loadAiHistory();
    localStats.aiHistoryCount = aiHistory.length;
  } catch {
    // Silently ignore
  }

  try {
    const activities = loadLearningActivities();
    localStats.learningActivityCount = activities.length;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    localStats.todayActivityCount = activities.filter(
      function (a) { return a.occurredAt >= todayStart; },
    ).length;
  } catch {
    // Silently ignore
  }

  try {
    const sessions = loadReadingSessions();
    // Use the learning-insight-local-data helper for reading session summary
    const inputForSummary = {
      readingSessions: sessions.map(function (s) {
        return {
          bookId: s.bookId,
          chapterId: s.chapterId,
          bookTitle: s.bookTitle,
          chapterTitle: s.chapterTitle,
          durationSeconds: s.durationSeconds,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          progressRatio: s.progressRatio,
        };
      }),
      learningActivities: [],
      wrongBookEntries: [],
      recentReading: [],
      recentPractice: [],
      favoriteProblems: [],
      bookmarks: [],
      notes: [],
      aiHistory: [],
      hasSession: true,
    };
    const summary = buildReadingSessionSummary(inputForSummary);
    localStats.totalReadingMinutes = summary.totalDurationMinutes;
    localStats.todayReadingMinutes = summary.todayDurationMinutes;
  } catch {
    // Silently ignore
  }

  // Today plan task count approximation (derived from available data)
  try {
    let taskEstimate = 0;
    const wrongBook = safeCall(function () { return loadWrongBook(); }, []);
    const recentReadings = safeCall(function () { return loadRecentReadings(); }, []);
    const notes = safeCall(function () { return loadReaderNotes(); }, []);
    const favProblems = safeCall(function () { return loadFavoriteProblems(); }, []);
    const aiHistory = safeCall(function () { return loadAiHistory(); }, []);

    const needsReview = wrongBook.filter(function (e: { reviewStatus: string }) { return e.reviewStatus === "needs-review"; });
    if (needsReview.length > 0) taskEstimate++;
    if (recentReadings.length > 0) taskEstimate++;
    if (notes.length > 0) taskEstimate++;
    if (favProblems.length > 0) taskEstimate++;
    if (aiHistory.length > 0) taskEstimate++;
    localStats.todayPlanTaskCount = taskEstimate;
  } catch {
    // Silently ignore
  }

  // Review recommendation count approximation
  try {
    const wrongBook = safeCall(function () { return loadWrongBook(); }, []);
    const recentPractice = safeCall(function () { return loadRecentPractice(); }, []);
    const needsReview = wrongBook.filter(function (e: { reviewStatus: string }) { return e.reviewStatus === "needs-review"; });
    const practiceNeedsReview = recentPractice.filter(function (p: { status: string }) { return p.status === "needs-review"; });
    localStats.reviewRecommendationCount = needsReview.length + practiceNeedsReview.length;
  } catch {
    // Silently ignore
  }

  // A399: daily challenge
  try {
    const dailyChallenge = loadDailyChallenge();
    if (dailyChallenge !== null) {
      localStats.dailyChallengeActive = true;
      localStats.dailyChallengeTitle = dailyChallenge.title;
      localStats.dailyChallengeStatus = dailyChallenge.status;
    }
  } catch {
    // Silently ignore
  }

  return localStats;
}

function safeCall<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
