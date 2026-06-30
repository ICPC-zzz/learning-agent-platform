"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cfBindHandleAction, cfUnbindHandleAction, cfSyncAction } from "./codeforces-server-actions";
import type { CodeforcesDashboardData } from "./codeforces-dashboard-loader";
import { generateCfLearningAnalysis } from "./cf-learning-analysis-action";
import type { CfLearningAgentActionOutput } from "./cf-learning-analysis-action";
import { generateCfWrongBookReview } from "./cf-wrongbook-review-action";
import type { CfWrongBookReviewActionOutput } from "./cf-wrongbook-review-action";
import { CfLearningReport } from "./CfLearningReport";
import {
  CfWrongBookReviewReport,
} from "./CfWrongBookReviewReport";

// localStorage key for target rating persistence
const TARGET_RATING_KEY = "cf_learning_target_rating";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CodeforcesDashboardClientProps {
  data: CodeforcesDashboardData;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#2563eb", "#1d4ed8", "#7c3aed",
];

const VERDICT_COLORS: Record<string, string> = {
  OK: "#22c55e",
  WRONG_ANSWER: "#ef4444",
  TIME_LIMIT_EXCEEDED: "#f59e0b",
  RUNTIME_ERROR: "#8b5cf6",
  COMPILATION_ERROR: "#f97316",
  MEMORY_LIMIT_EXCEEDED: "#ec4899",
  SKIPPED: "#94a3b8",
  CHALLENGED: "#dc2626",
};

// localStorage cache keys
const CACHE_LEARNING_ANALYSIS = "cf_learning_analysis_cache";
const CACHE_WRONGBOOK_REVIEW = "cf_wrongbook_review_cache";

function loadCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { data: T; savedAt: number };
    return cached.data;
  } catch { return null; }
}

function saveCache(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch { /* quota exceeded — silently skip */ }
}


// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function CodeforcesDashboardClient({ data: initialData }: CodeforcesDashboardClientProps) {
  const [data] = useState(initialData);
  const [handleInput, setHandleInput] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [bindSuccess, setBindSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [unbinding, setUnbinding] = useState(false);

  // Learning analysis state — loaded from cache if available
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CfLearningAgentActionOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Wrong book review state — loaded from cache if available
  const [wrongBookReviewRunning, setWrongBookReviewRunning] = useState(false);
  const [wrongBookReviewResult, setWrongBookReviewResult] = useState<CfWrongBookReviewActionOutput | null>(null);
  const [wrongBookReviewError, setWrongBookReviewError] = useState<string | null>(null);

  // Target rating — persisted in localStorage
  const [targetRating, setTargetRating] = useState<string>("");

  useEffect(() => {
    setAnalysisResult(loadCache<CfLearningAgentActionOutput>(CACHE_LEARNING_ANALYSIS));
    setWrongBookReviewResult(loadCache<CfWrongBookReviewActionOutput>(CACHE_WRONGBOOK_REVIEW));
    setTargetRating(localStorage.getItem(TARGET_RATING_KEY) ?? "");
  }, []);

  const saveTargetRating = useCallback((value: string) => {
    setTargetRating(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(TARGET_RATING_KEY, value);
    }
  }, []);

  const { hasAccount, account, stats, problemStats, ratingHistory, isSyncing, syncError } = data;

  // Handle bind
  async function doBind() {
    if (!handleInput.trim()) return;
    setBinding(true);
    setBindError(null);
    setBindSuccess(null);
    try {
      const result = await cfBindHandleAction(handleInput.trim());
      if (result.success) {
        setBindSuccess("绑定成功！3 秒后刷新页面...");
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setBindError(result.error ?? "绑定失败");
      }
    } catch (e) {
      setBindError(String(e));
    } finally {
      setBinding(false);
    }
  }

  // Handle unbind
  async function doUnbind() {
    if (!confirm("确定要解除 Codeforces 账号绑定吗？错题本、收藏和文章等学习数据不会丢失。")) return;
    setUnbinding(true);
    try {
      const result = await cfUnbindHandleAction();
      if (result.success) window.location.reload();
      else alert(result.error ?? "解绑失败");
    } catch (e) {
      alert(String(e));
    } finally {
      setUnbinding(false);
    }
  }

  // Handle manual sync
  async function doSync() {
    setSyncing(true);
    try {
      const result = await cfSyncAction();
      if (result.success) {
        alert(`同步完成！获取 ${result.submissionsFetched} 条提交记录${result.submissionsTruncated ? "（已达上限）" : ""}。刷新页面查看最新数据。`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert(`同步出错：${result.error ?? "未知错误"}`);
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setSyncing(false);
    }
  }

  // Handle wrong book review
  async function doWrongBookReview() {
    setWrongBookReviewRunning(true);
    setWrongBookReviewError(null);
    setWrongBookReviewResult(null);
    try {
      const result = await generateCfWrongBookReview();
      setWrongBookReviewResult(result);
      if (!result.success) {
        setWrongBookReviewError(result.errorMessage ?? "分析失败");
      } else if (typeof window !== "undefined") {
        saveCache(CACHE_WRONGBOOK_REVIEW, result);
      }
    } catch (e) {
      setWrongBookReviewError(String(e));
    } finally {
      setWrongBookReviewRunning(false);
    }
  }

  // Handle learning analysis
  async function doAnalysis() {
    setAnalysisRunning(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const parsedRating = targetRating.trim() ? Number(targetRating.trim()) : null;
      const result = await generateCfLearningAnalysis(
        parsedRating && !isNaN(parsedRating) && parsedRating >= 800 ? parsedRating : null,
      );
      setAnalysisResult(result);
      if (!result.success) {
        setAnalysisError(result.errorMessage ?? "分析失败");
      } else if (typeof window !== "undefined") {
        saveCache(CACHE_LEARNING_ANALYSIS, result);
      }
    } catch (e) {
      setAnalysisError(String(e));
    } finally {
      setAnalysisRunning(false);
    }
  }

  // --- Not bound: show bind form ---
  if (!hasAccount) {
    return (
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Codeforces 训练数据</h2>
        <div style={S.bindCard}>
          <p style={{ fontSize: "14px", color: "#475569", marginBottom: "12px" }}>
            绑定 Codeforces 账号后可查看训练统计、Rating 历史和题目完成情况。
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px" }}>
            绑定仅关联公开 Codeforces 数据，不代表本站验证了该账号的真实所有权。
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doBind(); }}
              placeholder="输入 Codeforces Handle"
              disabled={binding}
              style={S.input}
            />
            <button
              type="button"
              onClick={doBind}
              disabled={binding || !handleInput.trim()}
              style={S.btn}
            >
              {binding ? "验证中..." : "绑定"}
            </button>
          </div>
          {bindError ? <p style={{ color: "#dc2626", fontSize: "13px", marginTop: "10px" }}>{bindError}</p> : null}
          {bindSuccess ? <p style={{ color: "#16a34a", fontSize: "13px", marginTop: "10px" }}>{bindSuccess}</p> : null}
        </div>
      </section>
    );
  }

  // --- Bound: show dashboard ---
  if (!account) return null;

  const rating = account.currentRating ?? 0;
  const rankColor = rating < 1200 ? "#9ca3af" : rating < 1400 ? "#22c55e" : rating < 1600 ? "#06b6d4" : rating < 1900 ? "#3b82f6" : rating < 2100 ? "#a855f7" : rating < 2400 ? "#f59e0b" : "#ef4444";

  // --- Compute derived stats ---
  const totalSubs = stats?.totalSubmissions ?? 0;
  const solvedProblems = stats?.solvedProblems ?? 0;
  const attemptedProblems = stats?.attemptedProblems ?? 0;
  const tagEntries = computeTopTags(problemStats);
  const tagPieData = buildPieData(tagEntries.slice(0, 10));
  const verdictData = stats?.verdictCounts ?? {};
  const lastSubTime = stats?.lastSubmissionAt ?? null;
  const daysSinceLastSub = lastSubTime ? Math.floor((Date.now() - new Date(lastSubTime).getTime()) / 86400000) : null;
  const contestCount = ratingHistory.length;

  return (
    <section style={S.section}>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h2 style={S.sectionTitle}>Codeforces</h2>
          <span style={{ fontSize: "13px", color: rankColor, fontWeight: 700, background: rankColor + "1a", padding: "2px 10px", borderRadius: "999px" }}>
            {account.rank ?? "unrated"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {isSyncing || syncing ? "同步中..." : syncError ? "同步出错" : account.lastSyncedAt ? `已同步 ${new Date(account.lastSyncedAt).toLocaleString("zh-CN")}` : "未同步"}
          </span>
          <button type="button" onClick={doSync} disabled={syncing || isSyncing} style={S.miniBtn}>
            {syncing ? "..." : "刷新"}
          </button>
          <button type="button" onClick={doUnbind} disabled={unbinding} style={{ ...S.miniBtn, background: "#fff", color: "#dc2626", border: "1px solid #fca5a5" }}>
            解绑
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="number"
              value={targetRating}
              onChange={(e) => saveTargetRating(e.target.value)}
              placeholder="目标 Rating"
              disabled={analysisRunning}
              min={800}
              max={4000}
              step={100}
              style={{
                width: "90px",
                fontSize: "11px",
                padding: "4px 8px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                background: "#fff",
                color: "#0f172a",
              }}
            />
            <button type="button" onClick={doAnalysis} disabled={analysisRunning} style={{ ...S.miniBtn, background: "#0ea5e9", whiteSpace: "nowrap" }}>
              {analysisRunning ? "分析中..." : "生成学习分析"}
            </button>
            <button type="button" onClick={doWrongBookReview} disabled={wrongBookReviewRunning} style={{ ...S.miniBtn, background: "#d97706", whiteSpace: "nowrap" }}>
              {wrongBookReviewRunning ? "分析中..." : "生成错题复习计划"}
            </button>
          </div>
        </div>
      </div>

      {/* ---- 基本信息表 ---- */}
      <InfoTable account={account} rating={rating} rankColor={rankColor} lastSubTime={lastSubTime} daysSinceLastSub={daysSinceLastSub} contestCount={contestCount} ratingHistory={ratingHistory} />

      {/* ---- 概览卡片 ---- */}
      <div style={S.cardGrid}>
        <Card label="Handle" value={account.canonicalHandle} color="#6366f1" />
        <Card label="当前 Rating" value={rating.toString()} color={rankColor} />
        <Card label="最高 Rating" value={(account.maxRating ?? 0).toString()} color="#7c3aed" />
        <Card label="总提交" value={totalSubs.toLocaleString()} color="#0891b2" />
        <Card label="已 AC" value={solvedProblems.toLocaleString()} color="#16a34a" />
        <Card label="尝试中" value={(attemptedProblems - solvedProblems).toString()} color="#d97706" />
      </div>

      {/* ---- 双列布局：提交量柱状图 + 标签占比饼图 ---- */}
      {(totalSubs > 0 || tagEntries.length > 0) ? (
        <div style={S.twoCol}>
          {totalSubs > 0 ? <BarChart title="提交量与通过量" total={totalSubs} ac={stats?.acceptedSubmissions ?? 0} verdictData={verdictData} /> : null}
          {tagEntries.length > 0 ? <PieChart title="标签提交占比" data={tagPieData} /> : null}
        </div>
      ) : null}

      {/* ---- Rating 折线图 ---- */}
      {ratingHistory.length >= 2 ? (
        <ChartBlock title="Rating 变化">
          <RatingLineChart history={ratingHistory} />
        </ChartBlock>
      ) : null}

      {/* ---- 标签能力表 ---- */}
      {tagEntries.length > 0 ? (
        <ChartBlock title="标签能力详情">
          <TagTable entries={tagEntries.slice(0, 15)} />
        </ChartBlock>
      ) : null}

      {/* ---- Rating 分布 ---- */}
      {problemStats.length > 0 ? (
        <ChartBlock title="题目 Rating 分布">
          <RatingDistBar stats={problemStats} />
        </ChartBlock>
      ) : null}

      {/* ---- 空状态 ---- */}
      {totalSubs === 0 && ratingHistory.length === 0 && problemStats.length === 0 && (
        <div style={S.empty}>
          <p>尚未同步 Codeforces 数据。点击上方"刷新"获取数据。</p>
        </div>
      )}

      {/* ---- 学习分析报告 ---- */}
      {analysisRunning ? (
        <div style={S.analysisLoading}>
          <div style={{ fontSize: "14px", color: "#6366f1", fontWeight: 600, marginBottom: "8px" }}>
            🔄 正在生成学习分析...
          </div>
          {analysisResult?.safeEvents && analysisResult.safeEvents.length > 0 ? (
            <div style={{ fontSize: "12px", color: "#64748b", maxHeight: "150px", overflowY: "auto" }}>
              {analysisResult.safeEvents.map((evt, i) => (
                <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid #f1f5f9" }}>
                  {evt.message}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>初始化分析流程...</div>
          )}
        </div>
      ) : analysisError ? (
        <div style={S.analysisError}>
          <div style={{ fontSize: "14px", color: "#dc2626", fontWeight: 600, marginBottom: "6px" }}>
            分析失败
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "10px" }}>
            {analysisError}
          </div>
          <button type="button" onClick={doAnalysis} style={S.miniBtn}>
            重试
          </button>
        </div>
      ) : analysisResult?.success && analysisResult.report ? (
        <CfLearningReport report={analysisResult.report} events={analysisResult.safeEvents ?? []} />
      ) : null}

      {/* ---- Wrong Book Review Report ---- */}
      {wrongBookReviewRunning ? (
        <div style={S.analysisLoading}>
          <div style={{ fontSize: "14px", color: "#d97706", fontWeight: 600, marginBottom: "8px" }}>
            🔄 正在生成错题复习计划...
          </div>
          {wrongBookReviewResult?.safeEvents && wrongBookReviewResult.safeEvents.length > 0 ? (
            <div style={{ fontSize: "12px", color: "#64748b", maxHeight: "150px", overflowY: "auto" }}>
              {wrongBookReviewResult.safeEvents.map((evt, i) => (
                <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid #f1f5f9" }}>
                  {evt.message}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>初始化分析流程...</div>
          )}
        </div>
      ) : wrongBookReviewError ? (
        <div style={S.analysisError}>
          <div style={{ fontSize: "14px", color: "#dc2626", fontWeight: 600, marginBottom: "6px" }}>
            错题复习计划生成失败
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "10px" }}>
            {wrongBookReviewError}
          </div>
          <button type="button" onClick={doWrongBookReview} style={S.miniBtn}>
            重试
          </button>
        </div>
      ) : wrongBookReviewResult?.success && wrongBookReviewResult.report ? (
        <CfWrongBookReviewReport
          report={wrongBookReviewResult.report}
          events={wrongBookReviewResult.safeEvents ?? []}
        />
      ) : null}
    </section>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#334155", margin: "0 0 10px 0" }}>{title}</h3>
      {children}
    </div>
  );
}

// =============================================================================
// Info Table
// =============================================================================

function InfoTable({ account, rating, rankColor, lastSubTime, daysSinceLastSub, contestCount, ratingHistory }: {
  account: NonNullable<CodeforcesDashboardData["account"]>;
  rating: number;
  rankColor: string;
  lastSubTime: Date | null;
  daysSinceLastSub: number | null;
  contestCount: number;
  ratingHistory: CodeforcesDashboardData["ratingHistory"];
}) {
  const rows = [
    { label: "Handle", value: account.canonicalHandle },
    { label: "Rating", value: rating + "  (" + (account.rank ?? "unrated") + ")", color: rankColor },
    { label: "最高 Rating", value: `${account.maxRating ?? "-"}  (${account.maxRank ?? "-"})` },
    { label: "参加比赛", value: `${contestCount} 场` },
    { label: "上次比赛", value: ratingHistory.length > 0 ? formatDate(ratingHistory[ratingHistory.length - 1].ratingUpdateAt) : "无" },
    { label: "最近刷题", value: lastSubTime ? `${formatDate(lastSubTime)}（${daysSinceLastSub} 天前）` : "无" },
    { label: "Codeforces 注册", value: account.registrationAt ? formatDate(account.registrationAt) : "未知" },
  ];
  return (
    <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 0", marginBottom: "16px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={{ padding: "5px 16px", fontSize: "13px", color: "#64748b", whiteSpace: "nowrap", width: "1%" }}>{r.label}</td>
              <td style={{ padding: "5px 16px", fontSize: "13px", color: r.color ?? "#1e293b", fontWeight: 600 }}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// =============================================================================
// Pie chart (SVG) - tag submission share
// =============================================================================

function buildPieData(entries: Array<{ tag: string; count: number }>) {
  const total = entries.reduce((s, e) => s + e.count, 0) || 1;
  let cumAngle = 0;
  return entries.map((e, i) => {
    const angle = (e.count / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    return { ...e, start, angle, color: TAG_COLORS[i % TAG_COLORS.length], pct: Math.round((e.count / total) * 100) };
  });
}

function PieChart({ title, data }: { title: string; data: ReturnType<typeof buildPieData> }) {
  const R = 80;
  const W = 340;
  const H = 200;
  const CX = 95;
  const CY = 100;

  if (data.length === 0) return null;

  return (
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#334155", margin: "0 0 8px 0" }}>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "200px" }}>
        {data.map((slice) => {
          const startRad = (slice.start - 90) * Math.PI / 180;
          const endRad = (slice.start + slice.angle - 90) * Math.PI / 180;
          const x1 = CX + R * Math.cos(startRad);
          const y1 = CY + R * Math.sin(startRad);
          const x2 = CX + R * Math.cos(endRad);
          const y2 = CY + R * Math.sin(endRad);
          const largeArc = slice.angle > 180 ? 1 : 0;
          const d = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return <path key={slice.tag} d={d} fill={slice.color}><title>{`${slice.tag}: ${slice.pct}%`}</title></path>;
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: "6px" }}>
        {data.map((s) => (
          <span key={s.tag} style={{ fontSize: "11px", color: "#475569", display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: s.color, display: "inline-block" }} />
            {s.tag} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Bar chart (SVG) - submissions by verdict
// =============================================================================

function BarChart({ title, total, ac, verdictData }: { title: string; total: number; ac: number; verdictData: Record<string, number> }) {
  const entries = Object.entries(verdictData).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxV = Math.max(...entries.map(([, c]) => c), 1);
  const W = 320;
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 28, left: 10 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const barW = Math.min(48, (plotW / entries.length) * 0.65);
  const gap = plotW / entries.length;

  return (
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#334155", margin: "0 0 8px 0" }}>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "200px" }}>
        {entries.map(([verdict, count], i) => {
          const x = PAD.left + i * gap + (gap - barW) / 2;
          const h = Math.max((count / maxV) * plotH, 2);
          const color = VERDICT_COLORS[verdict] ?? "#94a3b8";
          const label = formatV(verdict);
          return (
            <g key={verdict}>
              <rect x={x} y={PAD.top + plotH - h} width={barW} height={h} fill={color} rx="3">
                <title>{`${verdict}: ${count}`}</title>
              </rect>
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight={600}>{label}</text>
              <text x={x + barW / 2} y={PAD.top + plotH - h - 4} textAnchor="middle" fontSize="9" fill="#475569">{count}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", textAlign: "center" }}>
        总计 {total} 次提交，AC {ac} 次（{Math.round((ac / Math.max(total, 1)) * 100)}%）
      </div>
    </div>
  );
}

function formatV(v: string): string {
  const m: Record<string, string> = { OK: "AC", WRONG_ANSWER: "WA", TIME_LIMIT_EXCEEDED: "TLE", RUNTIME_ERROR: "RE", COMPILATION_ERROR: "CE", MEMORY_LIMIT_EXCEEDED: "MLE" };
  return m[v] ?? v.slice(0, 8);
}

// =============================================================================
// Tag table
// =============================================================================

function TagTable({ entries }: { entries: Array<{ tag: string; solved: number; attempted: number; rate: number }> }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <th style={TH}>标签</th>
            <th style={TH}>尝试 (A)</th>
            <th style={TH}>完成 (S)</th>
            <th style={TH}>完成率</th>
            <th style={TH}>进度</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.tag} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={TD}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: TAG_COLORS[i % TAG_COLORS.length], marginRight: "6px" }} />
                {e.tag}
              </td>
              <td style={TD}>{e.attempted}</td>
              <td style={TD}>{e.solved}</td>
              <td style={TD}>{Math.round(e.rate * 100)}%</td>
              <td style={{ ...TD, width: "30%" }}>
                <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "6px", width: `${Math.round(e.rate * 100)}%`, background: e.rate >= 0.6 ? "#22c55e" : e.rate >= 0.3 ? "#f59e0b" : "#ef4444", borderRadius: "3px" }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TH: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "7px 10px", color: "#334155", whiteSpace: "nowrap" };

// =============================================================================
// Rating line chart (SVG)
// =============================================================================

function RatingLineChart({ history }: { history: Array<{ contestName: string; newRating: number; oldRating: number; ratingUpdateAt: Date | string }> }) {
  const W = 700;
  const H = 220;
  const PAD = { top: 15, right: 15, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const ratings = history.map((h) => h.newRating);
  const minR = Math.min(...ratings) - 80;
  const maxR = Math.max(...ratings) + 80;
  const range = maxR - minR || 1;

  const points = history.map((h, i) => ({
    x: PAD.left + (i / Math.max(history.length - 1, 1)) * plotW,
    y: PAD.top + plotH - ((h.newRating - minR) / range) * plotH,
    ...h,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  // Y-axis labels
  const yTicks = 4;
  const xTickCount = Math.min(history.length, 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "240px" }}>
      <defs>
        <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = PAD.top + (i / yTicks) * plotH;
        const val = Math.round(maxR - (i / yTicks) * range);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{val}</text>
          </g>
        );
      })}
      {/* Area fill */}
      {points.length > 1 ? (
        <path d={`${pathD} L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`} fill="url(#ratingGrad)" />
      ) : null}
      {/* Line */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2" />
          <title>{`${p.contestName}: ${p.oldRating}→${p.newRating}`}</title>
        </g>
      ))}
      {/* X-axis labels */}
      {history.map((h, i) => {
        const step = Math.max(1, Math.floor(history.length / xTickCount));
        if (i % step === 0 || i === history.length - 1) {
          const x = PAD.left + (i / Math.max(history.length - 1, 1)) * plotW;
          const date = new Date(h.ratingUpdateAt instanceof Date ? h.ratingUpdateAt : h.ratingUpdateAt);
          return (
            <text key={`x${i}`} x={x} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

// =============================================================================
// Rating distribution bar chart
// =============================================================================

const RATING_BUCKETS = [
  { label: "800-999", min: 800, max: 999 },
  { label: "1000-1199", min: 1000, max: 1199 },
  { label: "1200-1399", min: 1200, max: 1399 },
  { label: "1400-1599", min: 1400, max: 1599 },
  { label: "1600-1799", min: 1600, max: 1799 },
  { label: "1800-1999", min: 1800, max: 1999 },
  { label: "2000+", min: 2000, max: 9999 },
  { label: "未定级", min: -1, max: -1 },
];

function RatingDistBar({ stats }: { stats: Array<{ rating: number | null; accepted: boolean }> }) {
  const W = 560;
  const H = 200;
  const PAD = { top: 10, right: 15, bottom: 40, left: 15 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const buckets = RATING_BUCKETS.map((b) => {
    const inB = b.label === "未定级"
      ? stats.filter((s) => s.rating === null || s.rating === 0)
      : stats.filter((s) => s.rating !== null && s.rating >= b.min && s.rating <= b.max);
    return { label: b.label, attempted: inB.length, solved: inB.filter((s) => s.accepted).length };
  });

  const maxVal = Math.max(...buckets.map((b) => b.attempted), 1);
  const barW = (plotW / buckets.length) * 0.55;
  const gap = plotW / buckets.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxHeight: "220px" }}>
      {buckets.map((b, i) => {
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const attH = (b.attempted / maxVal) * plotH;
        const solH = (b.solved / maxVal) * plotH;
        return (
          <g key={b.label}>
            <rect x={x} y={PAD.top + plotH - attH} width={barW} height={attH} fill="#c7d2fe" rx="3">
              <title>{`${b.label}: 尝试 ${b.attempted}`}</title>
            </rect>
            <rect x={x + 3} y={PAD.top + plotH - solH} width={barW - 6} height={Math.max(solH, 1)} fill="#6366f1" rx="2">
              <title>{`${b.label}: 完成 ${b.solved}`}</title>
            </rect>
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={`rotate(-30,${x + barW / 2},${H - 6})`}>{b.label}</text>
            {b.attempted > 0 ? <text x={x + barW / 2} y={PAD.top + plotH - attH - 4} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight={600}>{b.attempted}</text> : null}
          </g>
        );
      })}
      <rect x={PAD.left + 4} y={H - 30} width="10" height="10" fill="#c7d2fe" rx="2" />
      <text x={PAD.left + 18} y={H - 21} fontSize="10" fill="#64748b">尝试</text>
      <rect x={PAD.left + 60} y={H - 30} width="10" height="10" fill="#6366f1" rx="2" />
      <text x={PAD.left + 74} y={H - 21} fontSize="10" fill="#64748b">完成</text>
    </svg>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function computeTopTags(stats: Array<{ tags: string[]; accepted: boolean; attempts: number }>) {
  const map = new Map<string, { solved: number; attempted: number }>();
  for (const s of stats) {
    for (const tag of s.tags) {
      const e = map.get(tag) ?? { solved: 0, attempted: 0 };
      e.attempted += 1;
      if (s.accepted) e.solved += 1;
      map.set(tag, e);
    }
  }
  return Array.from(map.entries())
    .map(([tag, d]) => ({ tag, ...d, rate: d.attempted > 0 ? d.solved / d.attempted : 0, count: d.attempted }))
    .sort((a, b) => b.attempted - a.attempted);
}

// =============================================================================
// Styles
// =============================================================================

const S = {
  section: {
    background: "var(--lap-bg-card)",
    border: "1px solid var(--lap-border-default)",
    borderRadius: "8px",
    padding: "22px",
    marginBottom: "16px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "14px",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#152234",
    margin: 0,
  } as React.CSSProperties,
  bindCard: {
    background: "#f7faf7",
    border: "1px solid #dfe7dc",
    borderRadius: "8px",
    padding: "24px 20px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  input: {
    background: "#fff",
    border: "1px solid var(--lap-border-default)",
    borderRadius: "8px",
    color: "#152234",
    fontSize: "14px",
    padding: "10px 14px",
    width: "260px",
  } as React.CSSProperties,
  btn: {
    background: "var(--lap-accent-primary)",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 22px",
  } as React.CSSProperties,
  miniBtn: {
    background: "var(--lap-accent-primary)",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 12px",
  } as React.CSSProperties,
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "10px",
    marginBottom: "16px",
  } as React.CSSProperties,
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
    marginBottom: "16px",
  } as React.CSSProperties,
  empty: {
    textAlign: "center" as const,
    padding: "24px",
    color: "#94a3b8",
    fontSize: "13px",
  } as React.CSSProperties,
  analysisLoading: {
    background: "#eef8f0",
    border: "1px solid #cfe0ce",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "16px",
  } as React.CSSProperties,
  analysisError: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "16px",
    marginTop: "16px",
  } as React.CSSProperties,
};
