/**
 * Admin Dashboard — real read-only status center v1.
 *
 * Displays aggregated guard status from all subsystems using the
 * admin-status-center aggregator. All data is read-only: no write ops,
 * no env values exposed, no secrets leaked.
 *
 * Categories:
 * - AI Assistant (LLM/Floating AI)
 * - External APIs (Book/Problem)
 * - Database
 * - Imports
 * - Agent Preview
 * - UI Shell
 *
 * @adminDev — preview only, productionReady=false
 */

import { getAdminStatusSnapshot } from "../../lib/admin-status-center";
import { StatusBadge, StatusCard, MissingEnvList } from "../_components/StatusComponents";
import type { StatusGroup } from "../../lib/admin-status-center";

export default function AdminDashboardPage() {
  const snapshot = getAdminStatusSnapshot();

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#e2e8f0",
            margin: 0,
          }}
        >
          管理概览 · 状态中心
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--lap-space-3)",
            marginTop: "4px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#94a3b8",
            }}
          >
            只读状态预览 · 不执行写操作 · productionReady=false
          </p>
          <StatusBadge status="preview-only" variant="admin" />
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--lap-space-3)",
          marginBottom: "var(--lap-space-6)",
          padding: "var(--lap-space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--lap-radius-lg)",
        }}
      >
        <SummaryPill
          label="总计"
          value={snapshot.summary.total}
          color="#e2e8f0"
        />
        <SummaryPill
          label="已启用"
          value={snapshot.summary.enabled}
          color="#22c55e"
        />
        <SummaryPill
          label="已阻止"
          value={snapshot.summary.blocked}
          color="#ef4444"
        />
        <SummaryPill
          label="缺少环境变量"
          value={snapshot.summary.missingEnv}
          color="#f59e0b"
        />
        <SummaryPill
          label="开发预览"
          value={snapshot.summary.previewOnly}
          color="#818cf8"
        />
        <SummaryPill
          label="不可用"
          value={snapshot.summary.unavailable}
          color="#94a3b8"
        />
      </div>

      {/* ── Group sections ── */}
      {snapshot.groups.map((group) => (
        <StatusGroupSection key={group.label} group={group} />
      ))}

      {/* ── Safety footer ── */}
      <div
        style={{
          marginTop: "var(--lap-space-6)",
          padding: "var(--lap-space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--lap-radius-lg)",
          fontSize: "0.75rem",
          color: "#64748b",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: "#94a3b8" }}>
          安全声明
        </p>
        <p style={{ margin: "4px 0 0" }}>
          本状态中心为只读预览，不调用真实 provider / API / DB 写操作 / Agent 工具。
          所有状态仅显示环境变量名称和布尔状态，不泄露任何 secret / token / API key / DATABASE_URL 值。
          productionReady=false。
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function SummaryPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 12px",
        borderRadius: "var(--lap-radius-full)",
        background: `${color}15`,
        border: `1px solid ${color}30`,
        fontSize: "0.75rem",
        fontWeight: 600,
        color,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          minWidth: "20px",
          textAlign: "center",
          fontSize: "0.8125rem",
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusGroupSection({ group }: { group: StatusGroup }) {
  // Compute an aggregate status for the group
  const groupStatuses = group.items.map((i) => i.status);
  const hasEnabled = groupStatuses.some((s) => s === "enabled");
  const hasBlocked = groupStatuses.some((s) => s === "blocked" || s === "missing-env");
  const allPreview = groupStatuses.every((s) => s === "preview-only" || s === "unavailable");

  let groupStatus: "enabled" | "blocked" | "preview-only" = "preview-only";
  if (hasEnabled && hasBlocked) groupStatus = "blocked";
  else if (hasEnabled) groupStatus = "enabled";
  else if (hasBlocked) groupStatus = "blocked";
  else if (allPreview) groupStatus = "preview-only";

  return (
    <section style={{ marginBottom: "var(--lap-space-6)" }}>
      {/* Group header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--lap-space-3)",
          marginBottom: "var(--lap-space-4)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "#e2e8f0",
          }}
        >
          {group.label}
        </h2>
        <StatusBadge
          status={groupStatus}
          variant="admin"
        />
      </div>

      {/* Items grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--lap-space-3)",
        }}
      >
        {group.items.map((item) => (
          <StatusItemCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}

function StatusItemCard({
  item,
}: {
  item: {
    key: string;
    label: string;
    status: "enabled" | "blocked" | "missing-env" | "preview-only" | "unavailable";
    missingEnvNames: string[];
    safeDescription: string;
  };
}) {
  const bgColor = "rgba(255,255,255,0.03)";
  const borderColor = "rgba(255,255,255,0.06)";

  return (
    <div
      style={{
        padding: "var(--lap-space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-2)",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--lap-radius-md)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#cbd5e1",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={item.label}
        >
          {item.label}
        </h4>
        <StatusBadge status={item.status} variant="admin" />
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          fontSize: "0.6875rem",
          color: "#64748b",
          lineHeight: 1.5,
        }}
      >
        {item.safeDescription}
      </p>

      {/* Missing env names */}
      <MissingEnvList names={item.missingEnvNames} variant="admin" compact />

      {/* Dev-only badge */}
      <span
        style={{
          fontSize: "0.5625rem",
          color: "#475569",
          fontFamily: "var(--lap-font-mono)",
        }}
      >
        productionReady=false · safeToExposeToClient=true
      </span>
    </div>
  );
}
