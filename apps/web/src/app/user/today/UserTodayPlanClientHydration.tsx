"use client";

import { useEffect, useState } from "react";
import { buildTodayPlanView, todayPlanViewIsSafe } from "./user-today-plan-view-model";
import { loadWrongBook } from "../../../lib/local-problem-wrong-book-store";
import { loadRecentReadings } from "../../../lib/local-user-library-store";
import { loadFavorites as loadProblemFavorites, loadRecentPractice } from "../../../lib/local-user-problem-store";
import { loadReaderNotes } from "../../../lib/local-reader-annotation-store";
import { listReaderAiHistoryEntries } from "../../../lib/local-reader-ai-history-store";
import { loadReadingSessions } from "../../../lib/local-learning-activity-store";
import { loadDailyChallenge } from "../../../lib/local-daily-challenge-store";
import type { TodayPlanView, TodayPlanTask } from "../../../lib/learning-insight-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserTodayPlanClientHydrationProps {
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserTodayPlanClientHydration({
  hasSession,
}: UserTodayPlanClientHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<TodayPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafe, setIsSafe] = useState(true);

  useEffect(() => {
    try {
      const wrongBook = loadWrongBook();
      const recentReading = loadRecentReadings();
      const recentPractice = loadRecentPractice();
      const favProblems = loadProblemFavorites();
      const notes = loadReaderNotes();
      const aiHistory = listReaderAiHistoryEntries();
      const readingSessionsRaw = loadReadingSessions();

      // Map to safe summary formats
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

      // Reading session summary
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      let totalDurationSeconds = 0;
      let todayDurationSeconds = 0;
      for (var i = 0; i < readingSessionsRaw.length; i++) {
        var s = readingSessionsRaw[i];
        var dur = Math.max(0, s.durationSeconds || 0);
        totalDurationSeconds += dur;
        if (s.startedAt >= todayStart) todayDurationSeconds += dur;
      }

      const readingSessionSummary = {
        totalSessions: readingSessionsRaw.length,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
        todayDurationMinutes: Math.round(todayDurationSeconds / 60),
      };

      // A399: daily challenge state
      var dailyChallenge = null;
      try {
        dailyChallenge = loadDailyChallenge();
      } catch {
        // ignore
      }
      var hasDailyChallenge = dailyChallenge !== null && dailyChallenge.status !== "completed";
      var dailyChallengeTitle = dailyChallenge && dailyChallenge.title || null;

      const planView = buildTodayPlanView({
        hasSession: hasSession,
        wrongBookEntries: wrongBookSummaries,
        recentReading: recentReadingSummaries,
        readingSessionSummary: readingSessionSummary,
        recentPractice: recentPracticeSummaries,
        notes: noteSummaries,
        aiHistory: aiHistorySummaries,
        favoriteProblems: favProblemsSummaries,
        hasDailyChallenge: hasDailyChallenge,
        dailyChallengeTitle: dailyChallengeTitle,
      });

      const safetyCheck = todayPlanViewIsSafe(planView);

      setView(planView);
      setIsSafe(safetyCheck.safe);
      setMounted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "数据加载失败");
      setMounted(true);
    }
  }, [hasSession]);

  if (!mounted) {
    return (
      <div style={{ marginTop: "14px" }}>
        <p style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>
          正在加载今日学习计划...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: "14px", padding: "12px", backgroundColor: "#fef2f2", borderRadius: "6px" }}>
        <p style={{ color: "#dc2626", fontSize: "13px" }}>数据加载出错：{error}</p>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "6px" }}>
          开发预览 · 规则型计划 · 未调用 LLM · 未接生产账号
        </p>
      </div>
    );
  }

  if (!view || view.totalTasks === 0) {
    return (
      <div style={{ marginTop: "14px" }}>
        <div className="learningEmptyState" aria-live="polite">
          <strong>暂无今日计划</strong>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "6px" }}>
            {view ? view.message : "暂无足够本地学习数据生成计划。"}
          </p>
          <p style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
            基础建议：前往书库选择一本书开始阅读（建议 15 分钟）。前往题目中心尝试练习题。
          </p>
        </div>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "10px" }}>
          开发预览 · 规则型计划 · 未调用 LLM · 未接生产账号
        </p>
      </div>
    );
  }

  return renderTodayPlan(view.tasks, view.totalTasks, view.totalEstimatedMinutes, view.message, isSafe, view.dataSourceNotice);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderTodayPlan(
  tasks: TodayPlanTask[],
  totalTasks: number,
  totalEstimatedMinutes: number,
  message: string,
  isSafe: boolean,
  dataSourceNotice: string,
) {
  return (
    <div style={{ marginTop: "14px" }}>
      {/* Safety warning */}
      {!isSafe ? (
        <p style={{ color: "#dc2626", fontSize: "12px", marginBottom: "10px" }}>
          警告：部分数据未通过安全过滤。
        </p>
      ) : null}

      {/* Summary */}
      <div style={{ padding: "10px", backgroundColor: "#eff6ff", borderRadius: "6px", marginBottom: "12px" }}>
        <p style={{ fontSize: "13px", color: "#1e40af" }}>{message}</p>
      </div>

      {/* Task list */}
      <div>
        {tasks.map(function (task) {
          return (
            <div
              key={task.taskId}
              style={{
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                marginBottom: "8px",
                backgroundColor: task.status === "todo" ? "#fefce8" : "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                    <span style={{
                      display: "inline-block",
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      marginRight: "6px",
                      backgroundColor: task.status === "todo" ? "#dc2626" : "#2563eb",
                      color: "#ffffff",
                    }}>
                      {task.status === "todo" ? "待做" : "建议"}
                    </span>
                    {task.title}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>{task.description}</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#94a3b8", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "3px" }}>
                      约 {task.estimatedMinutes} 分钟
                    </span>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>{task.reason}</span>
                    {task.targetLink ? (
                      <a
                        href={task.targetLink}
                        style={{ fontSize: "11px", color: "#2563eb" }}
                      >
                        前往 →
                      </a>
                    ) : null}
                  </div>
                  <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>{task.devOnlyLabel}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data source labels */}
      <div style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8", lineHeight: "1.6" }}>
        <p>{dataSourceNotice}</p>
        <p style={{ marginTop: "2px" }}>客户端本地数据 · 规则型计划 · 未调用 LLM · 未接生产账号</p>
      </div>
    </div>
  );
}
