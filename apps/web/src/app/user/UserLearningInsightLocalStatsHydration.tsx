"use client";

import { useEffect, useState } from "react";

import { loadLearningActivities, loadReadingSessions } from "../../lib/local-learning-activity-store";
import { loadWrongBook } from "../../lib/local-problem-wrong-book-store";
import { buildDashboardLocalInsightStats, createEmptyUnifiedInput } from "../../lib/learning-insight-local-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserLearningInsightLocalStatsHydrationProps {
  /** Whether a dev session exists (from server render). */
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserLearningInsightLocalStatsHydration({
  hasSession,
}: UserLearningInsightLocalStatsHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<ReturnType<typeof buildDashboardLocalInsightStats> | null>(null);

  useEffect(() => {
    try {
      const activities = loadLearningActivities();
      const sessions = loadReadingSessions();
      const wrongBook = loadWrongBook();

      const input = createEmptyUnifiedInput(hasSession);
      input.learningActivities = activities.map(function (a) {
        return {
          activityId: a.activityId,
          activityType: a.activityType,
          title: a.title,
          targetType: a.targetType,
          targetId: a.targetId,
          bookId: a.bookId,
          chapterId: a.chapterId,
          problemId: a.problemId,
          occurredAt: a.occurredAt,
          durationSeconds: a.durationSeconds,
        };
      });
      input.readingSessions = sessions.map(function (s) {
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
      });
      input.wrongBookEntries = wrongBook.map(function (e) {
        return {
          wrongBookId: e.wrongBookId,
          problemId: e.problemId,
          title: e.title,
          difficulty: e.difficulty,
          tags: e.tags,
          wrongCount: e.wrongCount,
          lastWrongAt: e.lastWrongAt,
          reviewStatus: e.reviewStatus,
          notePreview: e.notePreview,
          sourceType: e.sourceType,
        };
      });

      const localStats = buildDashboardLocalInsightStats(input);
      setStats(localStats);
      setMounted(true);
    } catch {
      setMounted(true);
    }
  }, [hasSession]);

  // Prevent hydration mismatch — only render after client mount
  if (!mounted) {
    return null;
  }

  if (!stats) {
    return null;
  }

  // Show empty state when no local data at all
  if (stats.localActivityCount === 0 && stats.localReadingMinutes === 0 && stats.wrongBookNeedsReviewCount === 0) {
    return (
      <div style={{ marginTop: "10px", padding: "8px 10px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
        <p style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
          本地学习数据为空 · 未连接数据库 · 开发预览
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#fffbeb", borderRadius: "6px", border: "1px dashed #fcd34d" }}>
      <p style={{ fontSize: "11px", fontWeight: "600", color: "#92400e", marginBottom: "6px" }}>
        本地 fallback 补充（localStorage）
      </p>
      <div style={{ fontSize: "11px", color: "#78350f", lineHeight: "1.7" }}>
        {stats.todayTaskCount > 0 ? (
          <p>今日学习活动：{stats.todayTaskCount} 个</p>
        ) : null}
        {stats.reviewRecommendationCount > 0 ? (
          <p>待复习推荐：约 {stats.reviewRecommendationCount} 条</p>
        ) : null}
        {stats.localActivityCount > 0 ? (
          <p>本地活动总数：{stats.localActivityCount} 条</p>
        ) : null}
        {stats.localReadingMinutes > 0 ? (
          <p>本地阅读时长：{stats.localReadingMinutes} 分钟</p>
        ) : null}
        {stats.wrongBookNeedsReviewCount > 0 ? (
          <p>错题待复习：{stats.wrongBookNeedsReviewCount} 道</p>
        ) : null}
      </div>
      <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "6px" }}>
        开发预览 · 规则型统计 · 未调用 LLM · 未接生产账号
      </p>
    </div>
  );
}
