"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CfLearningReportProps {
  report: Record<string, unknown>;
  events: Array<{ type: string; sequence: number; timestamp: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REMINDER_LABELS: Record<string, { text: string; color: string }> = {
  none: { text: "✅ 最近活跃，状态正常", color: "#16a34a" },
  light: { text: "💡 已有一周未刷题，建议抽空练习", color: "#d97706" },
  strong: { text: "⚠️ 已有两周以上未刷题，建议尽快恢复训练", color: "#ea580c" },
  restart: { text: "🔴 已超过一个月未刷题，建议从简单题重新开始", color: "#dc2626" },
};

const TREND_LABELS: Record<string, string> = {
  up: "📈 上升趋势",
  stable: "📊 基本稳定",
  down: "📉 下降趋势",
  insufficient: "📊 数据不足",
};

const CONFIDENCE_LABELS: Record<string, { text: string; color: string }> = {
  high: { text: "高", color: "#16a34a" },
  medium: { text: "中", color: "#d97706" },
  low: { text: "低", color: "#dc2626" },
};

const REC_TYPE_LABELS: Record<string, string> = {
  warmup: "热身题",
  weak_tag: "薄弱标签训练",
  challenge: "挑战题",
  unfinished_review: "未完成题回访",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CfLearningReport({ report, events }: CfLearningReportProps) {
  const profileSummary = report.profileSummary as Record<string, unknown> | undefined;
  const activity = report.activity as Record<string, unknown> | undefined;
  const progress = report.progress as Record<string, unknown> | undefined;
  const weakTags = (report.weakTags ?? []) as Array<Record<string, unknown>>;
  const ratingPlan = report.ratingPlan as Record<string, unknown> | undefined;
  const ratingGap = report.ratingGap as Record<string, unknown> | undefined;
  const recommendations = (report.recommendations ?? []) as Array<Record<string, unknown>>;
  const dataQuality = report.dataQuality as Record<string, unknown> | undefined;

  const reminderLevel = String(activity?.reminderLevel ?? "restart");
  const reminder = REMINDER_LABELS[reminderLevel] ?? REMINDER_LABELS.restart;
  const ratingTrend = String(progress?.ratingTrend ?? "insufficient");

  return (
    <div style={RS.container} suppressHydrationWarning>
      <h3 style={RS.title}>📋 学习分析报告</h3>
      <div style={RS.meta} suppressHydrationWarning>生成时间: {String(report.generatedAt ?? "").slice(0, 19).replace("T", " ")}</div>

      {/* ---- Rating Gap Warning ---- */}
      {ratingGap ? (
        <div style={{ ...RS.alert, background: "#fef3c7", borderColor: "#fcd34d", marginBottom: "14px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#92400e" }}>
            ⚠️ Rating 差距提醒
          </span>
          <div style={{ fontSize: "12px", color: "#78350f", marginTop: "4px" }}>
            CF Rating {String(ratingGap.cfRating)}，但最近练习题目平均 Rating 约 {String(ratingGap.recentAvgRating)}，差距 {String(ratingGap.gap)}。
          </div>
          <div style={{ fontSize: "12px", color: "#92400e", marginTop: "4px", lineHeight: 1.5 }}>
            {String(ratingGap.suggestion)}
          </div>
          {ratingGap.contestRecommendation ? (
            <ContestRecommendationCard rec={ratingGap.contestRecommendation as Record<string, unknown>} />
          ) : null}
        </div>
      ) : null}

      {/* ---- Profile Summary ---- */}
      <Section title="基本信息">
        <div style={RS.grid2}>
          <Card label="Handle" value={String(profileSummary?.handle ?? "-")} />
          <Card label="当前 Rating" value={String(profileSummary?.currentRating ?? "-")} />
          <Card label="最高 Rating" value={String(profileSummary?.maxRating ?? "-")} />
          {profileSummary?.effectiveRating != null && profileSummary?.effectiveRating !== profileSummary?.currentRating ? (
            <Card label="训练评级" value={String(profileSummary.effectiveRating)} color="#6366f1" />
          ) : null}
        </div>
      </Section>

      {/* ---- Activity Reminder ---- */}
      <Section title="活跃度">
        <div style={{ ...RS.alert, background: reminder.color + "12", borderColor: reminder.color + "40" }}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: reminder.color }}>
            {reminder.text}
          </span>
        </div>
        <div style={RS.grid3}>
          <Card label="距上次提交" value={activity?.daysSinceLastSubmission != null ? `${activity.daysSinceLastSubmission} 天` : "从未提交"} />
          <Card label="近7天提交" value={String(activity?.submissionsLast7Days ?? 0)} />
          <Card label="近30天提交" value={String(activity?.submissionsLast30Days ?? 0)} />
          <Card label="近30天AC" value={String(activity?.solvedLast30Days ?? 0)} />
        </div>
      </Section>

      {/* ---- Progress ---- */}
      <Section title="训练概览">
        <div style={RS.grid3}>
          <Card label="Rating趋势" value={TREND_LABELS[ratingTrend] ?? ratingTrend} />
          <Card label="已练习题" value={String(progress?.attemptedProblems ?? 0)} />
          <Card label="已完成题" value={String(progress?.solvedProblems ?? 0)} />
          <Card label="未完成题" value={String(progress?.unfinishedProblems ?? 0)} />
        </div>
      </Section>

      {/* ---- Weak Tags ---- */}
      {weakTags.length > 0 ? (
        <Section title={`薄弱标签 (${weakTags.length})`}>
          <div style={RS.tagList}>
            {weakTags.map((wt, i) => {
              const evidenceLevel = String(wt.evidenceLevel ?? "low");
              const evidenceColor = evidenceLevel === "high" ? "#16a34a" : evidenceLevel === "medium" ? "#d97706" : "#94a3b8";
              return (
                <div key={i} style={RS.tagCard}>
                  <div style={RS.tagHeader}>
                    <span style={RS.tagBadge}>{String(wt.tag)}</span>
                    <span style={{ fontSize: "11px", color: evidenceColor, fontWeight: 600 }}>
                      {evidenceLevel === "high" ? "高置信度" : evidenceLevel === "medium" ? "中置信度" : "低置信度"}
                    </span>
                  </div>
                  <div style={RS.tagStats}>
                    <span>尝试 {String(wt.attempted)} 题</span>
                    <span>完成 {String(wt.solved)} 题</span>
                    <span>完成率 {wt.completionRate != null ? `${Math.round((wt.completionRate as number) * 100)}%` : "-"}</span>
                  </div>
                  {Array.isArray(wt.reasonCodes) && (wt.reasonCodes as string[]).length > 0 ? (
                    <div style={RS.tagReasons}>
                      {(wt.reasonCodes as string[]).map((rc, j) => (
                        <span key={j} style={RS.reasonCode}>{rc}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* ---- Rating Plan ---- */}
      {ratingPlan ? (
        <Section title="推荐难度">
          <div style={RS.grid3}>
            {ratingPlan.warmup ? (
              <Card label="热身" value={`${(ratingPlan.warmup as number[])[0]} - ${(ratingPlan.warmup as number[])[1]}`} />
            ) : null}
            {ratingPlan.training ? (
              <Card label="训练" value={`${(ratingPlan.training as number[])[0]} - ${(ratingPlan.training as number[])[1]}`} />
            ) : null}
            {ratingPlan.challenge ? (
              <Card label="挑战" value={`${(ratingPlan.challenge as number[])[0]} - ${(ratingPlan.challenge as number[])[1]}`} />
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ---- Recommendations ---- */}
      {recommendations.length > 0 ? (
        <Section title={`训练题单 (${recommendations.length} 题)`}>
          <div style={RS.recList}>
            {recommendations.map((rec, i) => (
              <a
                key={i}
                href={String(rec.originalUrl ?? "#")}
                target="_blank"
                rel="noopener noreferrer"
                style={RS.recCard}
              >
                <div style={RS.recHeader}>
                  <span style={RS.recType}>
                    {REC_TYPE_LABELS[String(rec.recommendationType)] ?? String(rec.recommendationType)}
                  </span>
                  <span style={RS.recRating}>Rating {String(rec.rating)}</span>
                </div>
                <div style={RS.recName}>{String(rec.name)}</div>
                <div style={RS.recTags}>
                  {(rec.tags as string[]).map((t, j) => (
                    <span key={j} style={RS.recTag}>{t}</span>
                  ))}
                </div>
                <div style={RS.recReasons}>
                  {(rec.reasonCodes as string[]).map((rc, j) => (
                    <span key={j} style={RS.recReasonCode}>{rc}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ---- Data Quality ---- */}
      {dataQuality ? (
        <Section title="数据质量">
          <div style={RS.grid3}>
            <Card
              label="置信度"
              value={CONFIDENCE_LABELS[String(dataQuality.confidence)]?.text ?? String(dataQuality.confidence)}
              color={CONFIDENCE_LABELS[String(dataQuality.confidence)]?.color}
            />
            <Card label="数据截断" value={dataQuality.truncated ? "是" : "否"} />
            {Array.isArray(dataQuality.warnings) && (dataQuality.warnings as string[]).length > 0 ? (
              <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                {(dataQuality.warnings as string[]).map((w, i) => (
                  <div key={i} style={{ fontSize: "12px", color: "#d97706", padding: "2px 0" }}>
                    ⚠ {w}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* ---- Event Timeline (foldable, same style as review plan) ---- */}
      {events.length > 0 ? (
        <details style={{ marginTop: "8px" }}>
          <summary style={{ fontSize: "11px", color: "#94a3b8", cursor: "pointer" }}>
            执行轨迹 ({events.length} 步)
          </summary>
          <div style={{ marginTop: "6px" }}>
            {events.map((evt, i) => (
              <div key={i} style={{ fontSize: "10px", color: "#cbd5e1", padding: "1px 0" }}>
                {evt.timestamp} · {evt.message}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h4 style={RS.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={RS.card}>
      <div style={RS.cardLabel}>{label}</div>
      <div style={{ ...RS.cardValue, color: color ?? "#1e293b" }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contest recommendation card with live countdown
// ---------------------------------------------------------------------------

function ContestRecommendationCard({ rec }: { rec: Record<string, unknown> }) {
  const [timeLeft, setTimeLeft] = React.useState("");
  const [isPast, setIsPast] = React.useState(false);

  React.useEffect(() => {
    const startTime = (rec.startTimeSeconds as number) * 1000;
    function tick() {
      const now = Date.now();
      const diff = startTime - now;
      if (diff <= 0) {
        setIsPast(true);
        setTimeLeft("已开始");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (days > 0) {
        setTimeLeft(`${days} 天 ${hours} 小时 ${mins} 分`);
      } else {
        setTimeLeft(`${hours} 时 ${mins} 分 ${secs} 秒`);
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [rec.startTimeSeconds]);

  return (
    <div style={{
      background: "#fff", border: "1px solid #fcd34d", borderRadius: "8px",
      padding: "12px 14px", marginTop: "10px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
            📅 {String(rec.name)}
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
            {String(rec.type)} · {String(rec.durationHours)} 小时
          </div>
          <div style={{ fontSize: "11px", color: "#92400e", lineHeight: 1.5 }}>
            {String(rec.reason)}
          </div>
        </div>
        <div style={{
          background: isPast ? "#f1f5f9" : "#fef3c7",
          borderRadius: "8px", padding: "8px 12px", textAlign: "center",
          minWidth: "90px",
        }}>
          <div style={{ fontSize: "10px", color: "#92400e", fontWeight: 600, marginBottom: "2px" }}>
            {isPast ? "状态" : "倒计时"}
          </div>
          <div style={{ fontSize: isPast ? "13px" : "16px", fontWeight: 700, color: isPast ? "#94a3b8" : "#92400e" }}>
            {timeLeft}
          </div>
        </div>
      </div>
      <a
        href={`https://codeforces.com/contests/${rec.contestId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block", marginTop: "8px",
          fontSize: "12px", color: "#6366f1", fontWeight: 600,
          textDecoration: "none",
        }}
      >
        前往 Codeforces 比赛页面 →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const RS: Record<string, React.CSSProperties> = {
  container: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "20px",
    marginTop: "18px",
  },
  title: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 4px 0",
  },
  meta: {
    fontSize: "12px",
    color: "#94a3b8",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#475569",
    margin: "0 0 8px 0",
    paddingBottom: "6px",
    borderBottom: "1px solid #e2e8f0",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "8px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "8px",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  cardLabel: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: 600,
    marginBottom: "2px",
  },
  cardValue: {
    fontSize: "14px",
    fontWeight: 700,
  },
  alert: {
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid",
    marginBottom: "10px",
  },
  tagList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tagCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  tagHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  tagBadge: {
    display: "inline-block",
    background: "#6366f1",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "4px",
  },
  tagStats: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "4px",
  },
  tagReasons: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap" as const,
    marginTop: "4px",
  },
  reasonCode: {
    fontSize: "10px",
    color: "#d97706",
    background: "#fef3c7",
    padding: "1px 6px",
    borderRadius: "3px",
  },
  recList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  recCard: {
    display: "block",
    background: "#fff",
    border: "1px solid #c7d2fe",
    borderRadius: "8px",
    padding: "10px 12px",
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    transition: "box-shadow 0.2s",
  },
  recHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  recType: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#6366f1",
  },
  recRating: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
  },
  recName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: "6px",
  },
  recTags: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap" as const,
    marginBottom: "4px",
  },
  recTag: {
    fontSize: "10px",
    color: "#6366f1",
    background: "#eef2ff",
    padding: "1px 6px",
    borderRadius: "3px",
  },
  recReasons: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap" as const,
    marginTop: "4px",
  },
  recReasonCode: {
    fontSize: "10px",
    color: "#16a34a",
    background: "#dcfce7",
    padding: "1px 6px",
    borderRadius: "3px",
  },
};
