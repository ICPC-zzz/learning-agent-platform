"use client";

/**
 * A492 Personalized Code Analysis Report
 *
 * Renders extended report with A492 sections:
 * - Problem Profile (rating, tags, confidence)
 * - Learner Profile (handle, rating, weak tags)
 * - Difficulty Fit (status, gap, advice)
 * - Personalized Code Observations
 * - Candidate Follow-up Problems
 * - Agent Event Timeline
 */

import type { A492PersonalizedResult, A492PersonalizedReport } from "@learning-agent-platform/ai-core/code-analysis/a492-types";
import { CodeAnalysisReportView } from "./CodeAnalysisReport.tsx";
import type { CodeAnalysisResult } from "@learning-agent-platform/ai-core/code-analysis/types";

export function A492PersonalizedReportView({
  result,
  onReset,
  historyMode,
}: {
  result: A492PersonalizedResult;
  onReset: () => void;
  historyMode?: boolean;
}) {
  if (!result.success || !result.report) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{ color: "#991b1b", marginBottom: "12px" }}>
          分析失败: {result.error?.safeMessage ?? "未知错误"}
        </div>
        <button onClick={onReset} style={resetButtonStyle}>
          返回
        </button>
      </div>
    );
  }

  const report = result.report;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Safety Notice */}
      <div style={safetyNoticeStyle}>
        本报告基于静态代码、用户学习数据和模型分析生成，未在真实运行环境中编译或执行。
      </div>

      {/* Section 1: Problem Profile */}
      <SectionCard title="题目画像">
        <ProblemProfileSection profile={report.problemProfile} />
      </SectionCard>

      {/* Section 2: Learner Profile */}
      {report.learnerProfile && (
        <SectionCard title="用户学习画像">
          <LearnerProfileSection profile={report.learnerProfile} />
        </SectionCard>
      )}

      {/* Section 3: Difficulty Fit */}
      {report.difficultyFit && (
        <SectionCard title="难度适配">
          <DifficultyFitSection fit={report.difficultyFit} />
        </SectionCard>
      )}

      {/* Section 4: Weak Tag Match */}
      {report.weakTagMatch && (
        <SectionCard title="薄弱标签匹配">
          <WeakTagMatchSection match={report.weakTagMatch} />
        </SectionCard>
      )}

      {/* Section 5: Base Code Analysis (A491 report) */}
      <SectionCard title="代码分析">
        {report.baseReport ? (
          <CodeAnalysisReportView
            result={{
              success: true,
              report: report.baseReport,
              timeline: { events: [], totalDurationMs: 0, modelCallCount: 0, hadFormatRepair: false },
              error: null,
              modelInfo: result.modelInfo,
            } as CodeAnalysisResult}
            onReset={() => {}}
          />
        ) : (
          <div style={{ padding: "16px", background: "#fefce8", borderRadius: "8px", color: "#92400e", fontSize: "0.85rem" }}>
            代码分析未能完成（可能因模型调用超时或 Provider 不可用）。以下展示题目画像、用户画像和个性化建议。
          </div>
        )}
      </SectionCard>

      {/* Section 6: Personalized Learning Advice */}
      {report.personalization && (
        <SectionCard title="个性化学习建议">
          <PersonalizationSection personalization={report.personalization} />
        </SectionCard>
      )}

      {/* Section 7: Candidate Problems */}
      {report.candidateProblems && report.candidateProblems.length > 0 && (
        <SectionCard title="相似题目推荐">
          <CandidatesSection candidates={report.candidateProblems} />
        </SectionCard>
      )}

      {/* Section 8: Evidence Summary */}
      <SectionCard title="证据分类">
        <EvidenceSummarySection summary={report.evidenceSummary} />
      </SectionCard>

      {/* Agent Timeline */}
      <SectionCard title="Agent 执行时间线">
        <AgentTimelineSection timeline={result.timeline} />
      </SectionCard>

      {/* Reset Button */}
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <button onClick={onReset} style={resetButtonStyle}>
          {historyMode ? "关闭" : "开始新的分析"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProblemProfileSection({ profile }: { profile: A492PersonalizedReport["problemProfile"] }) {
  const rating = profile.rating;
  const tags = profile.tags;
  const sourceLabel = (source: string) => {
    switch (source) {
      case "user_provided": return "用户填写";
      case "model_inferred": return "模型推断";
      case "rule_estimated": return "规则估算";
      case "unknown": return "未知";
      default: return source;
    }
  };

  return (
    <div>
      {/* Rating */}
      <div style={fieldRowStyle}>
        <span style={fieldLabelStyle}>题目 Rating:</span>
        <span style={fieldValueStyle}>
          {rating.value !== null ? (
            <span style={{ fontWeight: 700, color: rating.source === "user_provided" ? "#059669" : "#6366f1" }}>
              {rating.value}
            </span>
          ) : rating.range ? (
            <span>{rating.range[0]} ~ {rating.range[1]}</span>
          ) : (
            <span style={{ color: "#9ca3af" }}>未推断</span>
          )}
          {" "}
          <span style={sourceTagStyle(rating.source)}>{sourceLabel(rating.source)}</span>
        </span>
      </div>

      {rating.reasoning.length > 0 && (
        <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "#6b7280" }}>
          {rating.reasoning.map((r, i) => (
            <div key={i}>• {r}</div>
          ))}
        </div>
      )}

      {/* Tags */}
      <div style={{ marginTop: "12px" }}>
        <div style={fieldLabelStyle}>题目标签:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              ...tagChipStyle,
              background: t.source === "user_provided" ? "#d1fae5" : t.source === "rule_estimated" ? "#fef3c7" : "#eef2ff",
              border: t.source === "user_provided" ? "1px solid #6ee7b7" : t.source === "rule_estimated" ? "1px solid #fde68a" : "1px solid #c7d2fe",
              color: t.source === "user_provided" ? "#065f46" : t.source === "rule_estimated" ? "#92400e" : "#4338ca",
            }}>
              {t.tag}
              <span style={{ fontSize: "0.65rem", marginLeft: "4px", opacity: 0.7 }}>
                ({sourceLabel(t.source)})
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Required Knowledge */}
      {profile.requiredKnowledge.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <div style={fieldLabelStyle}>所需知识:</div>
          <div style={{ fontSize: "0.82rem", color: "#374151" }}>
            {profile.requiredKnowledge.join(", ")}
          </div>
        </div>
      )}

      {/* Key Constraints */}
      {profile.keyConstraints.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <div style={fieldLabelStyle}>关键约束:</div>
          <div style={{ fontSize: "0.82rem", color: "#374151" }}>
            {profile.keyConstraints.map((c, i) => <div key={i}>• {c}</div>)}
          </div>
        </div>
      )}

      {/* Uncertainty */}
      {profile.uncertaintyWarnings.length > 0 && (
        <div style={{ marginTop: "10px", padding: "8px 12px", background: "#fefce8", borderRadius: "6px", fontSize: "0.8rem", color: "#92400e" }}>
          ⚠️ {profile.uncertaintyWarnings.join("; ")}
        </div>
      )}
    </div>
  );
}

function LearnerProfileSection({ profile }: { profile: NonNullable<A492PersonalizedReport["learnerProfile"]> }) {
  return (
    <div>
      <div style={fieldRowStyle}>
        <span style={fieldLabelStyle}>用户名:</span>
        <span style={{ fontWeight: 600, color: "#1e40af" }}>{profile.handle ?? "未绑定"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
        <div>
          <span style={fieldLabelStyle}>官方 Rating:</span>
          <span style={{ marginLeft: "8px", fontWeight: 600 }}>{profile.officialRating ?? "未定级"}</span>
        </div>
        <div>
          <span style={fieldLabelStyle}>预估真实 Rating:</span>
          <span style={{ marginLeft: "8px", fontWeight: 600, color: "#6366f1" }}>
            {profile.estimatedRating ?? "未知"}
            <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginLeft: "4px" }}>
              (置信度: {Math.round(profile.ratingConfidence * 100)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Weak Tags */}
      {profile.weakTags.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <div style={fieldLabelStyle}>薄弱标签:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
            {profile.weakTags.map((w, i) => (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 10px", borderRadius: "999px",
                background: w.evidenceLevel === "strong" ? "#fee2e2" : w.evidenceLevel === "moderate" ? "#fef3c7" : "#f3f4f6",
                border: "1px solid #e5e7eb", fontSize: "0.78rem",
              }}>
                {w.tag}
                <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>
                  ({Math.round(w.completionRate * 100)}%)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Review Focus */}
      {profile.reviewFocusTags.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <div style={fieldLabelStyle}>复习重点标签:</div>
          <span style={{ fontSize: "0.85rem", color: "#d97706" }}>
            {profile.reviewFocusTags.join(", ")}
          </span>
        </div>
      )}

      <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#9ca3af" }}>
        活跃度: {profile.recentActivity}
        {profile.lastSyncedAt && ` · 上次同步: ${profile.lastSyncedAt}`}
      </div>
    </div>
  );
}

function DifficultyFitSection({ fit }: { fit: NonNullable<A492PersonalizedReport["difficultyFit"]> }) {
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    far_too_easy: { color: "#065f46", bg: "#d1fae5", label: "过易" },
    easy: { color: "#065f46", bg: "#d1fae5", label: "较易" },
    appropriate: { color: "#1e40af", bg: "#dbeafe", label: "适合" },
    challenging: { color: "#92400e", bg: "#fef3c7", label: "有挑战性" },
    far_too_hard: { color: "#991b1b", bg: "#fee2e2", label: "过难" },
    unknown: { color: "#6b7280", bg: "#f3f4f6", label: "未知" },
  };
  const s = statusConfig[fit.status] ?? statusConfig.unknown;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{
          padding: "4px 14px", borderRadius: "999px", fontWeight: 600, fontSize: "0.9rem",
          background: s.bg, color: s.color,
        }}>
          {s.label}
        </span>
        {fit.ratingDifference !== null && (
          <span style={{ fontSize: "0.85rem", color: "#374151" }}>
            Rating 差距: <strong>{fit.ratingDifference > 0 ? "+" : ""}{fit.ratingDifference}</strong>
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
          置信度: {Math.round(fit.confidence * 100)}%
        </span>
      </div>

      {fit.advice.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          {fit.advice.map((a, i) => (
            <div key={i} style={{ fontSize: "0.85rem", color: "#374151", marginTop: i > 0 ? "4px" : "0" }}>
              • {a}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "8px", fontSize: "0.7rem", color: "#d1d5db" }}>
        {fit.reasonCodes.map(function(code) {
          var map: Record<string, string> = {
            diff_positive: "题目难度高于用户水平",
            diff_negative: "题目难度低于用户水平",
            basis_exact_rating: "基于精确 Rating 值",
            basis_rating_range_estimate: "基于 Rating 区间估算",
            status_far_too_easy: "过易",
            status_easy: "较易",
            status_appropriate: "适合",
            status_challenging: "有挑战性",
            status_far_too_hard: "过难",
            status_unknown: "未知",
            matches_weak_tags: "命中薄弱标签",
            weak_tag_caution: "薄弱标签预警",
            no_learner_rating: "无用户 Rating 数据",
            no_problem_rating: "无题目 Rating 数据",
            no_learner_profile: "未启用学习画像",
          };
          return (map[code] || code) + (fit.reasonCodes.indexOf(code) < fit.reasonCodes.length - 1 ? " · " : "");
        }).join("")}
      </div>
    </div>
  );
}

function WeakTagMatchSection({ match }: { match: NonNullable<A492PersonalizedReport["weakTagMatch"]> }) {
  return (
    <div>
      {match.matchedTags.length > 0 ? (
        <div style={{ padding: "10px 14px", background: "#dbeafe", borderRadius: "8px", color: "#1e40af", fontSize: "0.85rem" }}>
          命中 {match.matchedTags.length} 个薄弱标签: <strong>{match.matchedTags.join(", ")}</strong>
        </div>
      ) : (
        <div style={{ padding: "10px 14px", background: "#f3f4f6", borderRadius: "8px", color: "#6b7280", fontSize: "0.85rem" }}>
          本题标签未命中当前薄弱标签
        </div>
      )}

      {match.recommendations.map((r, i) => (
        <div key={i} style={{ marginTop: "6px", fontSize: "0.82rem", color: "#374151" }}>
          • {r}
        </div>
      ))}
    </div>
  );
}

function PersonalizationSection({ personalization }: { personalization: NonNullable<A492PersonalizedReport["personalization"]> }) {
  const basisLabel = (b: string) => {
    switch (b) {
      case "verified_fact": return "已验证事实";
      case "deterministic_statistic": return "确定性统计";
      case "user_provided": return "用户提供";
      case "model_inference": return "模型推断";
      case "needs_runtime_verification": return "待运行验证";
      default: return b;
    }
  };
  const basisColor = (b: string) => {
    switch (b) {
      case "verified_fact": return "#059669";
      case "deterministic_statistic": return "#2563eb";
      case "user_provided": return "#7c3aed";
      case "model_inference": return "#d97706";
      case "needs_runtime_verification": return "#dc2626";
      default: return "#6b7280";
    }
  };

  return (
    <div>
      {personalization.learnerSpecificObservations.map((obs, i) => (
        <div key={i} style={{ padding: "8px 0", borderBottom: i < personalization.learnerSpecificObservations.length - 1 ? "1px solid #f3f4f6" : "none" }}>
          <div style={{ fontSize: "0.85rem", color: "#374151" }}>• {obs.observation}</div>
          <div style={{ display: "flex", gap: "10px", marginTop: "3px", fontSize: "0.7rem" }}>
            <span style={{ color: basisColor(obs.basis) }}>
              [{basisLabel(obs.basis)}]
            </span>
            <span style={{ color: "#9ca3af" }}>
              置信度: {Math.round(obs.confidence * 100)}%
            </span>
          </div>
        </div>
      ))}

      {personalization.learningAdvice.length > 0 && (
        <div style={{ marginTop: "12px", padding: "10px 14px", background: "#f0fdf4", borderRadius: "8px" }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#065f46", marginBottom: "6px" }}>学习建议</div>
          {personalization.learningAdvice.map((a, i) => (
            <div key={i} style={{ fontSize: "0.82rem", color: "#374151" }}>• {a}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function CandidatesSection({ candidates }: { candidates: NonNullable<A492PersonalizedReport["candidateProblems"]> }) {
  const typeLabel = (t: string) => {
    switch (t) {
      case "prerequisite": return "热身相似题";
      case "same_tag_practice": return "同档相似题";
      case "next_challenge": return "进阶相似题";
      default: return t;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {candidates.map((c, i) => (
        <div key={i} style={{
          padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
          background: "#fafbfc", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              <a href={c.cfUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                {c.cfContestId}{c.cfIndex} — {c.name}
              </a>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              {c.rating !== null && (
                <span style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 600 }}>Rating: {c.rating}</span>
              )}
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                {c.tags.slice(0, 3).join(", ")}
              </span>
            </div>
          </div>
          <span style={{
            padding: "3px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 500,
            background: c.suggestionType === "prerequisite" ? "#dbeafe" : c.suggestionType === "same_tag_practice" ? "#d1fae5" : "#fef3c7",
            color: c.suggestionType === "prerequisite" ? "#1e40af" : c.suggestionType === "same_tag_practice" ? "#065f46" : "#92400e",
          }}>
            {typeLabel(c.suggestionType)}
          </span>
        </div>
      ))}
      <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "4px" }}>
        相似题来自本地 Codeforces 题库，按当前题标签和你的预估真实 Rating 分为热身、训练、挑战三档，已排除已完成题目。
      </div>
    </div>
  );
}

function EvidenceSummarySection({ summary }: { summary: A492PersonalizedReport["evidenceSummary"] }) {
  const items = [
    { label: "已验证事实", value: summary.verifiedFactCount, color: "#059669" },
    { label: "确定性统计", value: summary.deterministicStatisticCount, color: "#2563eb" },
    { label: "用户主动提供", value: summary.userProvidedCount, color: "#7c3aed" },
    { label: "模型推断", value: summary.modelInferenceCount, color: "#d97706" },
    { label: "待运行验证", value: summary.needsRuntimeCount, color: "#dc2626" },
  ];

  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            width: "10px", height: "10px", borderRadius: "50%", background: item.color, display: "inline-block",
          }} />
          <span style={{ fontSize: "0.8rem", color: "#374151" }}>
            {item.label}: <strong>{item.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function agentNameLabel(id: string): string {
  var map: Record<string, string> = {
    "orchestrator": "编排器",
    "problem-profiler": "题目画像",
    "learner-profiler": "学习画像",
    "code-debugger": "代码分析",
    "learning-advisor": "学习建议",
  };
  return map[id] || id;
}

function AgentTimelineSection({ timeline }: { timeline: A492PersonalizedResult["timeline"] }) {
  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return "✅";
      case "failed": return "❌";
      case "running": return "🔄";
      case "skipped": return "⏭️";
      default: return "⬜";
    }
  };

  return (
    <div>
      <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "10px" }}>
        总耗时: {(timeline.totalDurationMs / 1000).toFixed(1)}s · 模型调用: {timeline.modelCallCount}次 · 工具调用: {timeline.toolCallCount}次
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {timeline.events.map((ev, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "24px 160px 1fr 80px",
            gap: "8px", padding: "4px 8px", fontSize: "0.78rem",
            background: ev.status === "failed" ? "#fef2f2" : ev.status === "skipped" ? "#f9fafb" : "transparent",
            borderRadius: "4px", alignItems: "center",
          }}>
            <span>{statusIcon(ev.status)}</span>
            <span style={{ color: "#6366f1", fontWeight: 500 }}>{agentNameLabel(ev.agentId)}</span>
            <span style={{ color: "#374151" }}>{ev.summary}</span>
            <span style={{ color: "#9ca3af", textAlign: "right" }}>{(ev.durationMs / 1000).toFixed(1)}s</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "10px", fontSize: "0.72rem", color: "#9ca3af" }}>
        声明: Agent 执行过程基于固定工作流，非自由多 Agent 协作。
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: "10px",
      padding: "16px 20px", background: "#fff",
    }}>
      <h3 style={{
        margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700,
        color: "#111827", borderBottom: "2px solid #6366f1",
        paddingBottom: "8px", display: "inline-block",
      }}>
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const safetyNoticeStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "#fefce8",
  border: "1px solid #fef08a",
  borderRadius: "8px",
  color: "#92400e",
  fontSize: "0.82rem",
  textAlign: "center",
};

const fieldRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "8px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.82rem", fontWeight: 600, color: "#6b7280",
};

const fieldValueStyle: React.CSSProperties = {
  fontSize: "0.85rem", color: "#374151", display: "flex", alignItems: "center", gap: "8px",
};

const sourceTagStyle = (source: string): React.CSSProperties => ({
  fontSize: "0.7rem",
  padding: "1px 6px",
  borderRadius: "4px",
  background: source === "user_provided" ? "#d1fae5" : source === "model_inferred" ? "#eef2ff" : source === "rule_estimated" ? "#fef3c7" : "#f3f4f6",
  color: source === "user_provided" ? "#065f46" : source === "model_inferred" ? "#4338ca" : source === "rule_estimated" ? "#92400e" : "#6b7280",
});

const tagChipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "3px 10px", borderRadius: "999px",
  fontSize: "0.78rem", fontWeight: 500,
};

const resetButtonStyle: React.CSSProperties = {
  minWidth: "140px",
  border: "none",
  borderRadius: "999px",
  padding: "0 20px",
  height: "40px",
  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.9rem",
};
