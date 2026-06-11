"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadDailyChallenge,
  persistDailyChallenge,
  clearDailyChallenge,
  createDailyChallenge,
  startChallenge,
  completeChallenge,
  markChallengeNeedsReview,
  resetChallenge,
  getTodayDateString,
} from "../../lib/local-daily-challenge-store";
import { selectDailyChallenge } from "./daily-challenge-rules";
import {
  buildDailyChallengePageView,
} from "./daily-challenge-view-model";
import { SAMPLE_PROBLEMS } from "../problems/sample-programming-problems";
import {
  loadWrongBook,
} from "../../lib/local-problem-wrong-book-store";
import {
  loadFavorites,
  loadRecentPractice,
} from "../../lib/local-user-problem-store";
import { loadLearningActivities } from "../../lib/local-learning-activity-store";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DailyChallengeClient() {
  const [pageView, setPageView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState(null);

  // Load challenge data on mount (and on each render per date change detection)
  useEffect(() => {
    const today = getTodayDateString();
    const localData = loadLocalData();
    const recommendation = getOrCreateRecommendation(localData, today);
    const challengeState = loadDailyChallenge();

    // If no state yet, but we have a recommendation, create initial state
    let state = challengeState;
    if (state === null && recommendation !== null) {
      state = createDailyChallenge({
        problemId: recommendation.problemId,
        title: recommendation.title,
        difficulty: recommendation.difficulty,
        tags: recommendation.tags,
        recommendationSource: recommendation.recommendationSource,
        recommendationReason: recommendation.recommendationReason,
      });
      persistDailyChallenge(state);
    }

    const view = buildDailyChallengePageView({
      challengeState: state,
      recommendation,
      hasError: false,
      errorMessage: null,
    });

    setPageView(view);
    setLoading(false);
  }, []);

  function loadLocalData() {
    let wrongBookEntries: WrongBookEntry[] = [];
    let favoriteProblems: ReturnType<typeof loadFavorites> = [];
    let recentPractice: ReturnType<typeof loadRecentPractice> = [];
    let learningActivityCount = 0;

    try { wrongBookEntries = loadWrongBook(); } catch { /* ignore */ }
    try { favoriteProblems = loadFavorites(); } catch { /* ignore */ }
    try { recentPractice = loadRecentPractice(); } catch { /* ignore */ }
    try { learningActivityCount = loadLearningActivities().length; } catch { /* ignore */ }

    return { wrongBookEntries, favoriteProblems, recentPractice, learningActivityCount };
  }

  function getOrCreateRecommendation(
    localData,
    dateString,
  ) {
    const rec = selectDailyChallenge({
      sampleProblems: SAMPLE_PROBLEMS,
      wrongBookEntries: localData.wrongBookEntries.map((e) => ({
        problemId: e.problemId,
        title: e.title,
        difficulty: e.difficulty,
        tags: e.tags,
        wrongCount: e.wrongCount,
        reviewStatus: e.reviewStatus,
      })),
      favoriteProblems: localData.favoriteProblems.map((f) => ({
        problemId: f.problemId,
        title: f.title,
        difficulty: f.difficulty,
        tags: f.tags,
      })),
      recentPractice: localData.recentPractice.map((r) => ({
        problemId: r.problemId,
        title: r.title,
        difficulty: r.difficulty,
        status: r.status,
        updatedAt: r.updatedAt,
      })),
      learningActivityCount: localData.learningActivityCount,
      dateString,
    });

    return rec;
  }

  function handleAction(actionId: string) {
    setActionError(null);
    const currentState = loadDailyChallenge();

    if (currentState === null) {
      setActionError("无当前挑战状态，请刷新页面。");
      return;
    }

    let newState = null;

    try {
      switch (actionId) {
        case "start":
          newState = startChallenge(currentState);
          break;
        case "complete":
          newState = completeChallenge(currentState);
          break;
        case "needs-review":
          newState = markChallengeNeedsReview(currentState);
          break;
        case "reset":
          newState = resetChallenge(currentState);
          break;
        default:
          setActionError("未知操作: " + actionId);
          return;
      }
    } catch (err) {
      setActionError("操作失败: " + (err instanceof Error ? err.message : String(err)));
      return;
    }

    if (newState === null) {
      setActionError("操作未能产生新状态");
      return;
    }

    const persisted = persistDailyChallenge(newState);
    if (!persisted) {
      setActionError("保存状态失败");
      return;
    }

    // Reload and rebuild the view
    const today = getTodayDateString();
    const localData = loadLocalData();
    const recommendation = getOrCreateRecommendation(localData, today);
    const updatedView = buildDailyChallengePageView({
      challengeState: newState,
      recommendation,
      hasError: false,
      errorMessage: null,
    });
    setPageView(updatedView);
  }

  function handleResetLocal() {
    clearDailyChallenge();
    // Reload
    const today = getTodayDateString();
    const localData = loadLocalData();
    const recommendation = getOrCreateRecommendation(localData, today);
    let state: DailyChallengeState | null = null;
    if (recommendation !== null) {
      state = createDailyChallenge({
        problemId: recommendation.problemId,
        title: recommendation.title,
        difficulty: recommendation.difficulty,
        tags: recommendation.tags,
        recommendationSource: recommendation.recommendationSource,
        recommendationReason: recommendation.recommendationReason,
      });
      persistDailyChallenge(state);
    }
    const view = buildDailyChallengePageView({
      challengeState: state,
      recommendation,
      hasError: false,
      errorMessage: null,
    });
    setPageView(view);
  }

  if (loading) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>加载中...</strong>
        <p>正在读取本地学习数据，生成今日挑战。</p>
      </div>
    );
  }

  if (pageView === null || pageView.isError) {
    return (
      <div className="learningEmptyState" aria-live="polite">
        <strong>无法加载每日挑战</strong>
        <p>{pageView?.errorMessage || "未知错误"}</p>
        <div style={{ marginTop: "12px" }}>
          <button onClick={handleResetLocal} style={{ padding: "6px 14px", cursor: "pointer" }}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const { recommendation, challengeState, statusLabel, statusDescription, availableActions, relatedLinks, safetyNotices, dataSourceNotice } = pageView;

  return (
    <div>
      {/* Challenge Card */}
      <section className="learningPanel" aria-labelledby="dc-challenge-title">
        <div className="panelHeader">
          <p className="eyebrow">Daily Challenge · A399</p>
          <h2 id="dc-challenge-title">今日挑战</h2>
          <p className="panelNote">{dataSourceNotice}</p>
        </div>

        {recommendation !== null ? (
          <div style={{ marginTop: "14px" }}>
            {/* Problem info */}
            <div style={{
              border: "2px solid #3b82f6",
              borderRadius: "10px",
              padding: "18px",
              backgroundColor: "#eff6ff",
              marginBottom: "14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  backgroundColor: statusLabel === "已完成" ? "#16a34a" :
                    statusLabel === "进行中" ? "#2563eb" :
                    statusLabel === "需要复习" ? "#dc2626" : "#64748b",
                  color: "#ffffff",
                  fontWeight: "600",
                }}>
                  {statusLabel}
                </span>
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  backgroundColor: recommendation.difficulty === "easy" || recommendation.difficulty === "入门" ? "#22c55e" :
                    recommendation.difficulty === "medium" || recommendation.difficulty === "中等" || recommendation.difficulty === "基础" ? "#eab308" :
                    "#ef4444",
                  color: "#ffffff",
                  fontWeight: "600",
                }}>
                  {recommendation.difficulty}
                </span>
                {recommendation.estimatedMinutes > 0 ? (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    预计 {recommendation.estimatedMinutes} 分钟
                  </span>
                ) : null}
              </div>

              <h3 style={{ fontSize: "20px", color: "#1e293b", marginBottom: "6px" }}>
                {recommendation.title}
              </h3>

              {recommendation.tags.length > 0 ? (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                  {recommendation.tags.map(function (tag) {
                    return (
                      <span key={tag} style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        backgroundColor: "#dbeafe",
                        color: "#1e40af",
                      }}>
                        {tag}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              {/* Recommendation reason */}
              <div style={{
                padding: "10px",
                backgroundColor: "#ffffff",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                marginBottom: "10px",
              }}>
                <p style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                  <strong>推荐理由：</strong>
                </p>
                <p style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
                  {recommendation.recommendationReason}
                </p>
                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  来源：{recommendation.recommendationSource} · 规则生成 · 未调用 LLM
                </p>
              </div>

              <p style={{ fontSize: "12px", color: "#64748b" }}>
                {statusDescription}
              </p>
            </div>

            {/* Status actions */}
            {availableActions.length > 0 ? (
              <div style={{ marginBottom: "14px" }}>
                <p style={{ fontSize: "13px", color: "#475569", marginBottom: "8px", fontWeight: "500" }}>
                  操作：
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {availableActions.map(function (action) {
                    return (
                      <button
                        key={action.actionId}
                        onClick={function () { handleAction(action.actionId); }}
                        title={action.description}
                        style={{
                          padding: "6px 14px",
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#ffffff",
                          backgroundColor:
                            action.actionId === "start" ? "#2563eb" :
                            action.actionId === "complete" ? "#16a34a" :
                            action.actionId === "needs-review" ? "#dc2626" :
                            "#64748b",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
                {actionError !== null ? (
                  <p style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>
                    {actionError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Reset local state */}
            <div style={{ marginBottom: "14px" }}>
              <button
                onClick={handleResetLocal}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  color: "#64748b",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                重置本地状态
              </button>
            </div>
          </div>
        ) : (
          <div className="learningEmptyState" aria-live="polite">
            <strong>题库暂无可用题目</strong>
            <p>内置题库为空，无法生成每日挑战。</p>
          </div>
        )}
      </section>

      {/* Related links */}
      {relatedLinks.length > 0 ? (
        <section className="learningPanel" aria-labelledby="dc-links-title">
          <div className="panelHeader">
            <h2 id="dc-links-title">相关入口</h2>
          </div>
          <div style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "8px",
          }}>
            {relatedLinks.map(function (link) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "#2563eb",
                    textDecoration: "none",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <strong>{link.label}</strong>
                  {link.description ? (
                    <span style={{ display: "block", fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                      {link.description}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Safety notices */}
      <section className="learningPanel" aria-labelledby="dc-safety-title" style={{ marginTop: "20px" }}>
        <div className="panelHeader">
          <h2 id="dc-safety-title" style={{ fontSize: "14px", color: "#94a3b8" }}>安全与预览说明</h2>
        </div>
        <ul style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px" }}>
          {safetyNotices.map(function (notice) {
            return <li key={notice}>{notice}</li>;
          })}
          <li>不保存用户代码</li>
          <li>不保存判题结果</li>
          <li>不调用 LLM / AI provider</li>
          <li>纯规则引擎 deterministic 推荐</li>
        </ul>
      </section>
    </div>
  );
}
