"use client";

import { useEffect, useState } from "react";
import { buildReviewRecommendationsView, reviewRecommendationsViewIsSafe } from "./user-review-recommendations-view-model";
import { loadWrongBook } from "../../../lib/local-problem-wrong-book-store";
import { loadRecentReadings } from "../../../lib/local-user-library-store";
import { loadFavorites as loadProblemFavorites, loadRecentPractice } from "../../../lib/local-user-problem-store";
import { loadReaderBookmarks, loadReaderNotes } from "../../../lib/local-reader-annotation-store";
import { listReaderAiHistoryEntries } from "../../../lib/local-reader-ai-history-store";
import type { ReviewRecommendationsView, ReviewRecommendation } from "../../../lib/learning-insight-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserReviewRecommendationsClientHydrationProps {
  hasSession: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserReviewRecommendationsClientHydration({
  hasSession,
}: UserReviewRecommendationsClientHydrationProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ReviewRecommendationsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSafe, setIsSafe] = useState(true);

  useEffect(() => {
    try {
      const wrongBook = loadWrongBook();
      const recentReading = loadRecentReadings();
      const recentPractice = loadRecentPractice();
      const favProblems = loadProblemFavorites();
      const bookmarks = loadReaderBookmarks();
      const notes = loadReaderNotes();
      const aiHistory = listReaderAiHistoryEntries();

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

      const reviewView = buildReviewRecommendationsView({
        hasSession: hasSession,
        wrongBookEntries: wrongBookSummaries,
        recentPractice: recentPracticeSummaries,
        recentReading: recentReadingSummaries,
        bookmarks: bookmarkSummaries,
        notes: noteSummaries,
        aiHistory: aiHistorySummaries,
        favoriteProblems: favProblemsSummaries,
      });

      const safetyCheck = reviewRecommendationsViewIsSafe(reviewView);

      setView(reviewView);
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
          正在加载复习推荐数据...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: "14px", padding: "12px", backgroundColor: "#fef2f2", borderRadius: "6px" }}>
        <p style={{ color: "#dc2626", fontSize: "13px" }}>数据加载出错：{error}</p>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "6px" }}>
          开发预览 · 规则型推荐 · 未调用 LLM · 未接生产账号
        </p>
      </div>
    );
  }

  if (!view || view.totalCount === 0) {
    return (
      <div style={{ marginTop: "14px" }}>
        <div className="learningEmptyState" aria-live="polite">
          <strong>暂无复习推荐</strong>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "6px" }}>
            {view ? view.message : "暂无足够本地学习数据生成推荐。继续阅读和练习后将自动生成。数据来源：localStorage 本地存储。推荐基于确定性规则，未调用 LLM。"}
          </p>
        </div>
        <p style={{ color: "#92400e", fontSize: "12px", marginTop: "10px" }}>
          开发预览 · 规则型推荐 · 未调用 LLM · 未接生产账号
        </p>
      </div>
    );
  }

  return renderRecommendations(view.recommendations, view.totalCount, view.message, isSafe, view.dataSourceNotice);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderRecommendations(
  recommendations: ReviewRecommendation[],
  totalCount: number,
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

      {/* Recommendation list */}
      <div>
        {recommendations.map(function (rec) {
          return (
            <div
              key={rec.recommendationId}
              style={{
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                marginBottom: "8px",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                    <span style={{
                      display: "inline-block",
                      backgroundColor: priorityBadgeColor(rec.priority),
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      marginRight: "6px",
                    }}>
                      P{rec.priority}
                    </span>
                    {rec.title}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>{rec.reason}</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#94a3b8", backgroundColor: "#f1f5f9", padding: "1px 6px", borderRadius: "3px" }}>
                      {rec.sourceType}
                    </span>
                    {rec.targetLink ? (
                      <a
                        href={rec.targetLink}
                        style={{ fontSize: "11px", color: "#2563eb" }}
                      >
                        前往 →
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data source labels */}
      <div style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8", lineHeight: "1.6" }}>
        <p>{dataSourceNotice}</p>
        <p style={{ marginTop: "2px" }}>客户端本地数据 · 确定性规则计算 · 未调用 LLM · 未接生产账号</p>
      </div>
    </div>
  );
}

function priorityBadgeColor(priority: number): string {
  if (priority <= 2) return "#dc2626";
  if (priority <= 4) return "#d97706";
  if (priority <= 6) return "#2563eb";
  return "#64748b";
}
