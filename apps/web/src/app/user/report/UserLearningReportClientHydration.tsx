"use client";

import { useEffect, useState } from "react";
import { buildLearningReportView, learningReportViewIsSafe } from "./user-learning-report-view-model";
import { loadLearningActivities, loadReadingSessions, summarizeReadingSessions } from "../../../lib/local-learning-activity-store";
import { loadWrongBook } from "../../../lib/local-problem-wrong-book-store";
import { listReaderAiHistoryEntries } from "../../../lib/local-reader-ai-history-store";
import { loadFavorites as loadBookFavorites, loadRecentReadings } from "../../../lib/local-user-library-store";
import { loadFavorites as loadProblemFavorites, loadRecentPractice } from "../../../lib/local-user-problem-store";
import { loadReaderBookmarks, loadReaderNotes } from "../../../lib/local-reader-annotation-store";
import type { LearningReportSummary } from "../../../lib/learning-insight-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserLearningReportClientHydrationProps {
  /** Whether the server detected a dev session. */
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserLearningReportClientHydration({
  hasSession,
}: UserLearningReportClientHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [report, setReport] = useState<LearningReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafe, setIsSafe] = useState(true);

  useEffect(() => {
    try {
      // Load all localStorage data stores
      const activities = loadLearningActivities();
      const readingSessionsRaw = loadReadingSessions();
      const wrongBook = loadWrongBook();
      const aiHistory = listReaderAiHistoryEntries();
      const recentReading = loadRecentReadings();
      const recentPractice = loadRecentPractice();
      const favProblems = loadProblemFavorites();
      const bookmarks = loadReaderBookmarks();
      const notes = loadReaderNotes();

      // Map to safe summary formats expected by the report view model
      const activitySummaries = activities.map(function (a) {
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

      const wrongBookSummaries = wrongBook.map(function (e) {
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

      const aiHistorySummaries = aiHistory.map(function (h) {
        return {
          historyId: h.historyId,
          bookId: h.bookId,
          chapterId: h.chapterId,
          bookTitle: h.bookTitle,
          chapterTitle: h.chapterTitle,
          questionPreview: h.questionPreview,
          createdAt: h.createdAt,
        };
      });

      const recentReadingSummaries = recentReading.map(function (r) {
        return {
          bookId: r.bookId,
          chapterId: r.chapterId || "",
          bookTitle: r.bookTitle,
          chapterTitle: r.chapterTitle || "",
          progressRatio: 0,
          lastReadAt: r.lastReadAt || new Date().toISOString(),
          sourceType: r.sourceType || "local-fallback",
        };
      });

      const recentPracticeSummaries = recentPractice.map(function (p) {
        return {
          problemId: p.problemId,
          title: p.title,
          difficulty: p.difficulty || "medium",
          status: p.status || "completed",
          updatedAt: p.updatedAt || new Date().toISOString(),
        };
      });

      const favProblemsSummaries = favProblems.map(function (f) {
        return {
          problemId: f.problemId,
          title: f.title,
          difficulty: f.difficulty || "medium",
          tags: f.tags || [],
          favoritedAt: f.favoritedAt || new Date().toISOString(),
        };
      });

      const bookmarkSummaries = bookmarks.map(function (b) {
        return {
          bookId: b.bookId,
          chapterId: b.chapterId,
          bookTitle: b.bookTitle,
          chapterTitle: b.chapterTitle,
          createdAt: b.createdAt,
        };
      });

      const noteSummaries = notes.map(function (n) {
        return {
          noteId: n.noteId,
          bookId: n.bookId,
          chapterId: n.chapterId,
          bookTitle: n.bookTitle,
          chapterTitle: n.chapterTitle,
          noteTextPreview: (n.noteText || "").slice(0, 200),
          createdAt: n.createdAt,
        };
      });

      // Compute reading session summary
      const sessionSummary = summarizeReadingSessions(readingSessionsRaw);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayDurationMinutes = Math.round(
        readingSessionsRaw
          .filter(function (s) { return s.startedAt >= todayStart; })
          .reduce(function (sum, s) { return sum + Math.max(0, s.durationSeconds); }, 0) / 60
      );

      const readingSessionSummary = {
        totalSessions: sessionSummary.totalSessions,
        totalDurationMinutes: sessionSummary.totalDurationMinutes,
        todayDurationMinutes: todayDurationMinutes,
      };

      // Build report view
      const reportView = buildLearningReportView({
        activities: activitySummaries,
        readingSessionSummary: readingSessionSummary,
        recentReading: recentReadingSummaries,
        recentPractice: recentPracticeSummaries,
        favoriteProblems: favProblemsSummaries,
        wrongBookEntries: wrongBookSummaries,
        bookmarks: bookmarkSummaries,
        notes: noteSummaries,
        aiHistory: aiHistorySummaries,
      });

      // Safety check
      const safetyCheck = learningReportViewIsSafe(reportView);

      setReport(reportView);
      setIsSafe(safetyCheck.safe);
      setMounted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "数据加载失败");
      setMounted(true);
    }
  }, []);

  if (!mounted) {
    return (
      <div style={{ marginTop: "14px" }}>
        <p style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>
          正在加载学习报告数据...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: "14px", padding: "12px", backgroundColor: "#fef2f2", borderRadius: "6px" }}>
        <p style={{ color: "#dc2626", fontSize: "13px" }}>数据加载出错：{error}</p>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "6px" }}>
          开发预览 · 未接生产账号 · 未调用 LLM · 规则型统计
        </p>
      </div>
    );
  }

  if (!report || !report.hasData) {
    return (
      <div style={{ marginTop: "14px" }}>
        <div className="learningEmptyState" aria-live="polite">
          <strong>暂无本地学习数据</strong>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "6px" }}>
            客户端本地数据为空。请先到 Reader 阅读书籍、到题目详情页标记题目状态、或添加笔记和书签，数据将自动在此聚合。
          </p>
        </div>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "10px" }}>
          开发预览 · 未接生产账号 · 未调用 LLM · 规则型统计
        </p>
      </div>
    );
  }

  return renderReportContent(report, isSafe);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderReportContent(
  report: LearningReportSummary,
  isSafe: boolean,
) {
  return (
    <div style={{ marginTop: "14px" }}>
      {/* Safety warning */}
      {!isSafe ? (
        <p style={{ color: "#dc2626", fontSize: "12px", marginBottom: "10px" }}>
          警告：部分数据未通过安全过滤，已截断显示。
        </p>
      ) : null}

      {/* Today summary */}
      <div style={{ padding: "12px", backgroundColor: "#f0fdf4", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#166534", marginBottom: "6px" }}>今日摘要</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          今天 {report.today.activityCount} 个学习活动
          {report.today.readingMinutes > 0 ? "，阅读 " + report.today.readingMinutes + " 分钟" : ""}
          {report.today.practiceCount > 0 ? "，练习 " + report.today.practiceCount + " 道题" : ""}
          {report.today.wrongAddedCount > 0 ? "，新增 " + report.today.wrongAddedCount + " 条错题" : ""}。
        </p>
      </div>

      {/* Last 7 days */}
      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#334155", marginBottom: "6px" }}>近 7 天动态</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          {report.last7Days.activityCount} 个活动 ·
          约 {report.last7Days.readingMinutes} 分钟阅读 ·
          {report.last7Days.practiceCount} 次练习 ·
          {report.last7Days.readingSessionCount} 次阅读 ·
          新增 {report.last7Days.wrongAddedCount} 道错题
        </p>
      </div>

      {/* Reading stats */}
      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#334155", marginBottom: "6px" }}>阅读统计</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          共 {report.reading.totalReadingSessions} 次阅读，累计 {report.reading.totalReadingMinutes} 分钟
        </p>
        {report.reading.latestBookTitle ? (
          <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
            最近阅读：《{report.reading.latestBookTitle}》
            {report.reading.latestChapterTitle ? " · " + report.reading.latestChapterTitle : ""}
          </p>
        ) : null}
      </div>

      {/* Problem stats */}
      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#334155", marginBottom: "6px" }}>题目统计</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          最近练习 {report.problems.recentPracticeCount} 题 ·
          收藏 {report.problems.favoriteProblemsCount} 题
        </p>
      </div>

      {/* Wrong book stats */}
      <div style={{ padding: "12px", backgroundColor: "#fff7ed", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#9a3412", marginBottom: "6px" }}>错题统计</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          错题本共 {report.problems.wrongBookTotalCount} 道
          {report.problems.wrongBookNeedsReviewCount > 0
            ? "，其中 " + report.problems.wrongBookNeedsReviewCount + " 道待复习"
            : ""}
        </p>
      </div>

      {/* Annotation stats */}
      <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "6px", marginBottom: "12px" }}>
        <h4 style={{ fontSize: "14px", color: "#334155", marginBottom: "6px" }}>笔记/书签/AI 历史</h4>
        <p style={{ fontSize: "12px", color: "#475569" }}>
          {report.annotations.bookmarkCount} 个书签 ·
          {report.annotations.noteCount} 条笔记 ·
          {report.annotations.aiHistoryCount} 条 AI 问答历史
        </p>
      </div>

      {/* Status tag */}
      <div style={{ padding: "10px", backgroundColor: "#eff6ff", borderRadius: "6px" }}>
        <p style={{ fontSize: "13px", color: "#1e40af" }}>
          当前学习状态：<strong>{report.statusLabel}</strong>
        </p>
      </div>

      {/* Data source labels */}
      <div style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8", lineHeight: "1.6" }}>
        <p>客户端本地数据 · 规则型统计 · 未调用 LLM · 未接生产账号</p>
        <p style={{ marginTop: "2px" }}>数据来源：localStorage 本地存储（{report.dataSourceNotice}）</p>
      </div>
    </div>
  );
}
