"use client";

import React from "react";

// ---------------------------------------------------------------------------
// v2 Report types
// ---------------------------------------------------------------------------

interface ReviewRecommendation {
  problemKey: string;
  problemId: string;
  name: string;
  rating: number | null;
  tags: string[];
  originalUrl: string;
  attempts: number;
  accepted: boolean;
  lastSubmittedAt: string | null;
  lastVerdict: string | null;
  priorityLevel: "urgent" | "high" | "medium" | "low";
  recommendationType: "historical_failure" | "spaced_review" | "close_call" | "weak_tag_explore";
  zone: string;
  reasonCodes: string[];
}

export interface ReviewReportData {
  generatedAt: string;
  estimatedRating: number;
  estimationMethod: "contest_history" | "sandbox_assessment" | "rated" | "unrated";
  ratingZones: Array<{ name: string; minRating: number; maxRating: number }>;
  summary: {
    totalAcProblems: number;
    totalWaProblems: number;
    weakTagCount: number;
    activeDays: number | null;
  };
  focusTags: Array<{ tag: string; waRate: number; evidenceLevel: "high" | "medium" | "low" }>;
  recommendations: ReviewRecommendation[];
  reviewAdvice: { suggestedSessionMinutes: number; suggestedOrder: string[]; reminderLevel: string };
  dataQuality: { confidence: "high" | "medium" | "low"; warnings: string[] };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CfWrongBookReviewReportProps {
  report: ReviewReportData;
  events: Array<{ type: string; sequence: number; timestamp: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<string, string> = { "保分区": "#22c55e", "核心区": "#6366f1", "瞭望区": "#f97316" };
const PRIORITY_COLORS: Record<string, string> = { urgent: "#dc2626", high: "#f97316", medium: "#eab308", low: "#22c55e" };
const TYPE_LABELS: Record<string, string> = {
  historical_failure: "历史翻车", spaced_review: "遗忘复习",
  close_call: "险胜复盘", weak_tag_explore: "薄弱标签新题",
};
const METHOD_LABELS: Record<string, string> = {
  contest_history: "基于比赛记录", sandbox_assessment: "沙盒评估 (无比赛记录)",
  rated: "基于比赛记录",
  unrated: "沙盒评估 (无比赛记录)",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CfWrongBookReviewReport({ report, events }: CfWrongBookReviewReportProps) {
  const { summary, estimatedRating, estimationMethod, ratingZones, focusTags, recommendations, reviewAdvice, dataQuality } = report;

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h3 style={S.title}>复习计划</h3>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            {new Date(report.generatedAt).toLocaleString("zh-CN")}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#6366f1" }}>{estimatedRating}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>预估 Rating · {METHOD_LABELS[estimationMethod] ?? estimationMethod}</div>
        </div>
      </div>

      {/* Rating zones */}
      {ratingZones.length > 0 ? (
        <div style={S.zonesRow}>
          {ratingZones.map((z) => (
            <div key={z.name} style={{ ...S.zoneChip, borderColor: ZONE_COLORS[z.name] ?? "#cbd5e1", color: ZONE_COLORS[z.name] ?? "#475569" }}>
              {z.name} [{z.minRating}–{z.maxRating}]
            </div>
          ))}
        </div>
      ) : null}

      {/* Summary */}
      <div style={S.summaryGrid}>
        <MiniCard label="已 AC" value={summary.totalAcProblems} color="#22c55e" />
        <MiniCard label="未通过" value={summary.totalWaProblems} color="#dc2626" />
        <MiniCard label="薄弱标签" value={summary.weakTagCount} color="#f97316" />
      </div>

      {/* Weak tags */}
      {focusTags.length > 0 ? (
        <div style={S.section}>
          <h4 style={S.sectionTitle}>薄弱标签 (WA率 &gt; 30%)</h4>
          <div style={S.tagList}>
            {focusTags.map((ft) => (
              <span key={ft.tag} style={{ ...S.tagBadge, borderColor: ft.evidenceLevel === "high" ? "#dc2626" : ft.evidenceLevel === "medium" ? "#f97316" : "#6366f1" }}>
                {ft.tag} <span style={{ opacity: 0.7 }}>{Math.round(ft.waRate * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recommendations */}
      {recommendations.length > 0 ? (
        <div style={S.section}>
          <h4 style={S.sectionTitle}>复习题目 ({recommendations.length} 道)</h4>
          <div style={S.recList}>
            {recommendations.map((rec, i) => (
              <div key={rec.problemKey} style={{ ...S.recCard, borderLeftColor: ZONE_COLORS[rec.zone] ?? "#cbd5e1" }}>
                <div style={S.recTop}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>#{i + 1}</span>
                  <span style={{ ...S.zoneLbl, background: (ZONE_COLORS[rec.zone] ?? "#e2e8f0") + "1a", color: ZONE_COLORS[rec.zone] ?? "#475569" }}>
                    {rec.zone}
                  </span>
                  <span style={{ fontSize: "11px", color: PRIORITY_COLORS[rec.priorityLevel], fontWeight: 700 }}>
                    {rec.priorityLevel === "urgent" ? "紧急" : rec.priorityLevel === "high" ? "高" : rec.priorityLevel === "medium" ? "中" : "低"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>{TYPE_LABELS[rec.recommendationType] ?? rec.recommendationType}</span>
                </div>
                <a href={rec.originalUrl || "#"} target="_blank" rel="noopener noreferrer" style={S.recName}>
                  {rec.name}
                </a>
                <div style={S.recMeta}>
                  {rec.rating !== null ? <span style={{ fontWeight: 600, color: "#6366f1" }}>R{rec.rating}</span> : null}
                  <span style={{ color: "#94a3b8" }}>
                    {rec.attempts > 0 ? `${rec.attempts}次提交${rec.accepted ? " · 已AC" : " · 未通过"}` : "未提交"}
                  </span>
                  {rec.lastVerdict ? <span style={{ color: rec.accepted ? "#22c55e" : "#ef4444" }}>{rec.lastVerdict}</span> : null}
                </div>
                {rec.tags.length > 0 ? (
                  <div style={S.recTags}>{rec.tags.slice(0, 6).map((t) => <span key={t} style={S.recTag}>{t}</span>)}</div>
                ) : null}
                {rec.reasonCodes.length > 0 ? (
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>{rec.reasonCodes.join(" · ")}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.empty}>暂无复习推荐。请先同步 Codeforces 数据。</div>
      )}

      {/* Advice */}
      {recommendations.length > 0 ? (
        <div style={S.advice}>
          建议复习时间约 {reviewAdvice.suggestedSessionMinutes} 分钟
          {reviewAdvice.reminderLevel === "strong" ? " · 你有较多未完成题目，建议尽快安排" :
           reviewAdvice.reminderLevel === "light" ? " · 保持定期复习节奏" : ""}
        </div>
      ) : null}

      {/* Data quality */}
      <div style={S.dq}>
        <span style={{ color: dataQuality.confidence === "high" ? "#22c55e" : dataQuality.confidence === "medium" ? "#eab308" : "#ef4444", fontWeight: 600 }}>置信度：{dataQuality.confidence}</span>
        {dataQuality.warnings.map((w, i) => <div key={i} style={{ fontSize: "10px", color: "#94a3b8" }}>{w}</div>)}
      </div>

      {/* Event log */}
      {events.length > 0 ? (
        <details style={{ marginTop: "8px" }}>
          <summary style={{ fontSize: "11px", color: "#94a3b8", cursor: "pointer" }}>执行轨迹</summary>
          {events.map((e, i) => <div key={i} style={{ fontSize: "10px", color: "#cbd5e1" }}>{e.timestamp} · {e.message}</div>)}
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MiniCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
    <div style={{ fontSize: "10px", color: "#94a3b8" }}>{label}</div>
    <div style={{ fontSize: "18px", fontWeight: 700, color }}>{value}</div>
  </div>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  container: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", marginTop: "16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" },
  title: { fontSize: "17px", fontWeight: 700, color: "#0f172a", margin: 0 },
  zonesRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" },
  zoneChip: { fontSize: "12px", fontWeight: 600, padding: "3px 12px", borderRadius: "999px", border: "1px solid", background: "#f8fafc" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px", marginBottom: "14px" },
  section: { marginBottom: "14px" },
  sectionTitle: { fontSize: "14px", fontWeight: 700, color: "#334155", margin: "0 0 6px 0" },
  tagList: { display: "flex", flexWrap: "wrap", gap: "6px" },
  tagBadge: { fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", border: "1px solid", background: "#f8fafc" },
  recList: { display: "flex", flexDirection: "column", gap: "8px" },
  recCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderLeftWidth: "3px", borderRadius: "8px", padding: "10px 12px" },
  recTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" },
  zoneLbl: { fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "4px" },
  recName: { fontSize: "13px", fontWeight: 600, color: "#1e293b", textDecoration: "none", display: "block", marginBottom: "3px" },
  recMeta: { display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "11px" },
  recTags: { display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "3px" },
  recTag: { fontSize: "9px", color: "#6366f1", background: "#eef2ff", borderRadius: "3px", padding: "1px 5px" },
  empty: { textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" },
  advice: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 12px", marginTop: "10px", fontSize: "12px", color: "#166534" },
  dq: { marginTop: "8px", padding: "8px 10px", background: "#f8fafc", borderRadius: "6px", fontSize: "11px" },
};
