import Link from "next/link";
import type { UnifiedStatsView, UnifiedStatGroup } from "./user-dashboard-unified-stats-view-model";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserDashboardUnifiedStatsPanelProps {
  /** The unified stats view model from the server-side builder. */
  unifiedStats: UnifiedStatsView;
  /** Whether a dev session exists. */
  hasSession: boolean;
  /** Optional: extra content rendered after the stats grid. */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Source badge colors and labels
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "server-dev-db": { bg: "#dbeafe", text: "#1e40af", label: "DB" },
  "local-storage-fallback": { bg: "#fef3c7", text: "#92400e", label: "localStorage" },
  "placeholder-not-connected": { bg: "#f1f5f9", text: "#64748b", label: "—" },
  "mixed": { bg: "#ede9fe", text: "#5b21b6", label: "DB+local" },
};

const GROUP_ICONS: Record<UnifiedStatGroup, string> = {
  "problems": "🧩",
  "review": "🔄",
  "ai-assist": "🤖",
  "activity-plan": "📋",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserDashboardUnifiedStatsPanel({
  unifiedStats,
  hasSession,
  children,
}: UserDashboardUnifiedStatsPanelProps) {
  const { stats, groupLabels, overallNotice, hasAnyData, serverStatsActive, localStatsActive } = unifiedStats;

  // Group stats by group
  const grouped = groupStatsByGroup(stats);

  // Build ordered group list
  const groupOrder: UnifiedStatGroup[] = ["problems", "review", "ai-assist", "activity-plan"];

  return (
    <section className="learningPanel" aria-labelledby="unified-stats-title">
      <div className="panelHeader">
        <p className="eyebrow">A398 Unified Dashboard</p>
        <h2 id="unified-stats-title">学习数据概览</h2>
        <p className="panelNote">{overallNotice}</p>
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#94a3b8", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {/* Source legend */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", backgroundColor: SOURCE_COLORS["server-dev-db"].bg, border: "1px solid " + SOURCE_COLORS["server-dev-db"].text }} /> DB
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", backgroundColor: SOURCE_COLORS["local-storage-fallback"].bg, border: "1px solid " + SOURCE_COLORS["local-storage-fallback"].text }} /> localStorage
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", backgroundColor: SOURCE_COLORS["mixed"].bg, border: "1px solid " + SOURCE_COLORS["mixed"].text }} /> mixed
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", backgroundColor: SOURCE_COLORS["placeholder-not-connected"].bg, border: "1px solid " + SOURCE_COLORS["placeholder-not-connected"].text }} /> not connected
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div style={{ marginTop: "14px", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "6px" }}>
          <p style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
            暂无学习数据。开始阅读、练习或收藏内容后将在此展示。
          </p>
        </div>
      ) : (
        <div style={{ marginTop: "14px" }}>
          {groupOrder.map(function (group) {
            const groupStats = grouped[group] || [];
            if (groupStats.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: "14px" }}>
                <h3 style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#334155",
                  marginBottom: "8px",
                  paddingBottom: "4px",
                  borderBottom: "1px solid #e2e8f0",
                }}>
                  {GROUP_ICONS[group]} {groupLabels[group]}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {groupStats.map(function (stat) {
                    const sourceInfo = SOURCE_COLORS[stat.source] || SOURCE_COLORS["placeholder-not-connected"];
                    return (
                      <div
                        key={stat.statId}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          padding: "10px",
                          backgroundColor: stat.source === "local-storage-fallback" ? "#fffbeb" : "#ffffff",
                          borderLeft: stat.source === "local-storage-fallback" ? "3px solid #fcd34d" : stat.source === "server-dev-db" ? "3px solid #93c5fd" : "3px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{
                            fontSize: "10px",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            backgroundColor: sourceInfo.bg,
                            color: sourceInfo.text,
                            fontWeight: "600",
                            lineHeight: "1.5",
                          }}>
                            {sourceInfo.label}
                          </span>
                        </div>
                        <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "2px" }}>
                          {stat.label}
                        </p>
                        <p style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "2px" }}>
                          {stat.value}
                        </p>
                        <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.4" }}>
                          {stat.description}
                        </p>
                        {stat.href ? (
                          <Link
                            href={stat.href}
                            style={{
                              display: "inline-block",
                              marginTop: "6px",
                              fontSize: "11px",
                              color: "#2563eb",
                              textDecoration: "none",
                            }}
                          >
                            查看 →
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra content — e.g., hydration component */}
      {children}

      {/* Footer notices */}
      <div style={{
        marginTop: "14px",
        padding: "10px",
        backgroundColor: "#f8fafc",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
      }}>
        <p style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.7", marginBottom: "4px" }}>
          <strong>数据来源说明：</strong>
        </p>
        <ul style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.8", paddingLeft: "16px", margin: 0 }}>
          <li>开发 DB — server-dev-db 数据为开发预览，绑定 dev session，未接生产账号</li>
          <li>localStorage fallback — 数据来自浏览器本地存储，不保存到数据库</li>
          <li>混合 — 同一指标 DB 和本地均有数据时标注 mixed</li>
          <li>规则型统计 — 所有统计基于确定性规则计算，未调用 LLM</li>
          <li>客户端本地数据 — 页面可能补充显示 localStorage 中的学习数据</li>
          <li>dev-only — 所有数据均为开发预览，未接入真实用户系统</li>
          <li>DB guard 默认关闭 — 不保存学习数据到数据库</li>
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupStatsByGroup(
  stats: UnifiedStatsView["stats"],
): Record<UnifiedStatGroup, typeof stats> {
  const result: Record<string, typeof stats> = {};
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    if (!result[s.group]) {
      result[s.group] = [];
    }
    result[s.group].push(s);
  }
  return result;
}
