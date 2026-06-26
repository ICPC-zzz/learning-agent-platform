/**
 * Reusable Status Components — 统一状态展示组件
 *
 * Provides consistent status display across Admin and user-facing pages.
 * Each component supports `variant`: "admin" (dark theme) or "user" (light theme).
 *
 * Components:
 * - StatusBadge — single status indicator
 * - StatusCard — status card with items list
 * - GuardMatrix — guard variable matrix (name + boolean)
 * - MissingEnvList — missing environment variable names list
 *
 * @previewOnly — productionReady=false
 */

import type { StatusValue } from "../../lib/admin-status-center";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<StatusValue, string> = {
  enabled: "已启用",
  blocked: "已阻止",
  "missing-env": "缺少环境变量",
  "preview-only": "开发预览",
  unavailable: "不可用",
};

const STATUS_COLORS: Record<StatusValue, { bg: string; text: string; dot: string }> = {
  enabled: { bg: "#eef5ef", text: "#243b27", dot: "#22c55e" },
  blocked: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "missing-env": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  "preview-only": { bg: "#e8edf4", text: "#445064", dot: "#6366f1" },
  unavailable: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
};

// Admin variant uses slightly adjusted colors for dark backgrounds
const STATUS_COLORS_ADMIN: Record<StatusValue, { bg: string; text: string; dot: string }> = {
  enabled: { bg: "rgba(34, 197, 94, 0.15)", text: "#4ade80", dot: "#22c55e" },
  blocked: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", dot: "#ef4444" },
  "missing-env": { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", dot: "#f59e0b" },
  "preview-only": { bg: "rgba(99, 102, 241, 0.15)", text: "#a5b4fc", dot: "#818cf8" },
  unavailable: { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8", dot: "#64748b" },
};

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: StatusValue;
  variant?: "admin" | "user";
  label?: string; // Override the default label
}

export function StatusBadge({ status, variant = "admin", label }: StatusBadgeProps) {
  const colors = variant === "admin" ? STATUS_COLORS_ADMIN[status] : STATUS_COLORS[status];
  const text = label ?? STATUS_LABELS[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 10px",
        borderRadius: "var(--lap-radius-full)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
        whiteSpace: "nowrap",
        lineHeight: "1.5",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: colors.dot,
          flexShrink: 0,
        }}
      />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MissingEnvList
// ---------------------------------------------------------------------------

interface MissingEnvListProps {
  names: string[];
  variant?: "admin" | "user";
  compact?: boolean;
}

export function MissingEnvList({ names, variant = "admin", compact = false }: MissingEnvListProps) {
  if (names.length === 0) return null;

  const mutedColor = variant === "admin" ? "#94a3b8" : "var(--lap-text-muted)";
  const fontFamily = "var(--lap-font-mono)";

  if (compact) {
    return (
      <span
        style={{
          fontSize: "0.6875rem",
          color: mutedColor,
          fontFamily,
        }}
        title={names.join("、")}
      >
        缺少: {names.slice(0, 3).join(", ")}{names.length > 3 ? ` +${names.length - 3}` : ""}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        fontSize: "0.6875rem",
        fontFamily,
      }}
    >
      {names.map((name) => (
        <code
          key={name}
          style={{
            padding: "1px 5px",
            borderRadius: "3px",
            background: variant === "admin" ? "rgba(255,255,255,0.06)" : "var(--lap-bg-muted)",
            color: mutedColor,
            fontSize: "0.6875rem",
            wordBreak: "break-all",
          }}
        >
          {name}
        </code>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusCard
// ---------------------------------------------------------------------------

interface StatusCardItem {
  label: string;
  value: string;
  status?: StatusValue;
}

interface StatusCardProps {
  title: string;
  status: StatusValue;
  items: StatusCardItem[];
  href?: string;
  safeDescription?: string;
  variant?: "admin" | "user";
}

export function StatusCard({
  title,
  status,
  items,
  href,
  safeDescription,
  variant = "admin",
}: StatusCardProps) {
  const isAdmin = variant === "admin";
  const primaryColor = isAdmin ? "#e2e8f0" : "var(--lap-text-primary)";
  const mutedColor = isAdmin ? "#94a3b8" : "var(--lap-text-muted)";
  const borderColor = isAdmin ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const bgColor = isAdmin ? "rgba(255,255,255,0.04)" : "#ffffff";

  return (
    <div
      className={isAdmin ? "" : "lap-card"}
      style={{
        padding: "var(--lap-space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--lap-card-radius)",
        boxShadow: isAdmin ? "none" : "var(--lap-card-shadow)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--lap-space-2)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: primaryColor,
          }}
        >
          {title}
        </h3>
        <StatusBadge status={status} variant={variant} />
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {items.map((item, i) => (
          <div
            key={item.label + i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 0",
              borderBottom: item !== items[items.length - 1]
                ? `1px solid ${borderColor}`
                : "none",
              fontSize: "0.75rem",
              gap: "8px",
            }}
          >
            <span style={{ color: mutedColor, minWidth: 0, flex: 1 }}>{item.label}</span>
            <span
              style={{
                color: primaryColor,
                fontWeight: 500,
                fontFamily: "var(--lap-font-mono)",
                fontSize: "0.6875rem",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Safe description */}
      {safeDescription && (
        <p
          style={{
            margin: 0,
            fontSize: "0.6875rem",
            color: mutedColor,
            lineHeight: 1.5,
            paddingTop: "var(--lap-space-2)",
            borderTop: `1px solid ${borderColor}`,
          }}
        >
          {safeDescription}
        </p>
      )}

      {/* Footer link */}
      {href && (
        <a
          href={href}
          style={{
            fontSize: "0.75rem",
            color: isAdmin ? "#a5b4fc" : "var(--lap-accent-primary)",
            textDecoration: "none",
            marginTop: "auto",
            paddingTop: "var(--lap-space-2)",
            borderTop: `1px solid ${borderColor}`,
          }}
        >
          查看详情 →
        </a>
      )}

      {/* Dev-only / preview badge */}
      <div style={{ marginTop: "auto", paddingTop: "var(--lap-space-1)" }}>
        <span
          style={{
            fontSize: "0.625rem",
            color: mutedColor,
            fontFamily: "var(--lap-font-mono)",
          }}
        >
          dev-only · productionReady=false
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GuardMatrix
// ---------------------------------------------------------------------------

export interface GuardMatrixRow {
  envName: string;
  isSet: boolean;
  category: string;
  note?: string;
}

interface GuardMatrixProps {
  title: string;
  rows: GuardMatrixRow[];
  variant?: "admin" | "user";
  compact?: boolean;
}

export function GuardMatrix({ title, rows, variant = "admin", compact = false }: GuardMatrixProps) {
  const isAdmin = variant === "admin";
  const primaryColor = isAdmin ? "#e2e8f0" : "var(--lap-text-primary)";
  const mutedColor = isAdmin ? "#94a3b8" : "var(--lap-text-muted)";
  const borderColor = isAdmin ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const bgColor = isAdmin ? "rgba(255,255,255,0.04)" : "#ffffff";
  const monoFont = "var(--lap-font-mono)";

  // Group rows by category
  const grouped = new Map<string, GuardMatrixRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.category) ?? [];
    existing.push(row);
    grouped.set(row.category, existing);
  }

  return (
    <div
      className={isAdmin ? "" : "lap-card"}
      style={{
        padding: compact ? "var(--lap-space-4)" : "var(--lap-space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--lap-card-radius)",
        boxShadow: isAdmin ? "none" : "var(--lap-card-shadow)",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: compact ? "0.875rem" : "0.9375rem",
          fontWeight: 700,
          color: primaryColor,
        }}
      >
        {title}
      </h3>

      {Array.from(grouped.entries()).map(([category, categoryRows]) => (
        <div key={category} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Category header */}
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: mutedColor,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingTop: "var(--lap-space-2)",
            }}
          >
            {category}
          </div>

          {categoryRows.map((row, i) => (
            <div
              key={row.envName + i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 0",
                borderBottom:
                  i < categoryRows.length - 1 ? `1px solid ${borderColor}` : "none",
                fontSize: "0.6875rem",
                gap: "8px",
              }}
            >
              <code
                style={{
                  fontFamily: monoFont,
                  fontSize: "0.6875rem",
                  color: primaryColor,
                  wordBreak: "break-all",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {row.envName}
              </code>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  color: row.isSet ? "#22c55e" : "#f59e0b",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: row.isSet ? "#22c55e" : "#f59e0b",
                  }}
                />
                {row.isSet ? "已设置" : "未设置"}
              </span>
            </div>
          ))}

          {/* Category note */}
          {categoryRows[0]?.note && (
            <p style={{ margin: 0, fontSize: "0.625rem", color: mutedColor, lineHeight: 1.4 }}>
              {categoryRows[0].note}
            </p>
          )}
        </div>
      ))}

      {/* Footer */}
      <div
        style={{
          fontSize: "0.625rem",
          color: mutedColor,
          paddingTop: "var(--lap-space-2)",
          borderTop: `1px solid ${borderColor}`,
          fontFamily: monoFont,
        }}
      >
        仅显示变量名和布尔状态 · 不显示值 · productionReady=false
      </div>
    </div>
  );
}
