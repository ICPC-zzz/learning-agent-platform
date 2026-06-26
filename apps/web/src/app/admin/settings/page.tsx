/**
 * Admin Settings — read-only guard matrix.
 *
 * Displays all guard/env variable names and their boolean state.
 * No values, tokens, or secrets are shown.
 *
 * @adminDev — preview only, no write operations
 */

import { getAdminStatusSnapshot } from "../../../lib/admin-status-center";
import { StatusBadge, GuardMatrix } from "../../_components/StatusComponents";
import type { GuardMatrixRow } from "../../_components/StatusComponents";

export default function AdminSettingsPage() {
  const snapshot = getAdminStatusSnapshot();

  // Build guard matrix rows from status items
  const guardRows: GuardMatrixRow[] = snapshot.items
    .filter((item) => item.status !== "preview-only" && item.status !== "unavailable")
    .map((item) => ({
      envName: item.label,
      isSet: item.status === "enabled",
      category: mapCategory(item.category),
      note: item.status === "enabled" ? undefined : item.safeDescription,
    }));

  // Also add preview-only items
  const previewRows: GuardMatrixRow[] = snapshot.items
    .filter((item) => item.status === "preview-only" || item.status === "unavailable")
    .map((item) => ({
      envName: item.label,
      isSet: false,
      category: mapCategory(item.category),
      note: item.status === "unavailable" ? "当前不可用" : "仅开发预览，未启用生产能力",
    }));

  return (
    <div>
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          系统设置
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)", marginTop: "4px" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
            只读状态矩阵 · 仅显示变量名和布尔状态 · 不显示任何值
          </p>
          <StatusBadge status="preview-only" variant="admin" />
        </div>
      </div>

      {/* Active guard matrix */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <GuardMatrix
          title="Guard 状态矩阵"
          rows={guardRows}
          variant="admin"
        />
      </section>

      {/* Preview-only matrix */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <GuardMatrix
          title="Preview-Only / Unavailable 能力"
          rows={previewRows}
          variant="admin"
          compact
        />
      </section>

      {/* Global config summary */}
      <div
        style={{
          padding: "var(--lap-space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--lap-radius-lg)",
          fontSize: "0.8125rem",
          color: "#94a3b8",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: "#cbd5e1" }}>
          全局配置摘要
        </p>
        <p style={{ margin: "4px 0 0" }}>
          以上所有 guard 配置均通过环境变量和 guard 机制控制，无法在此面板修改。
          实际配置值（API endpoint、API key、DATABASE_URL、token 等）不会在此展示。
          如需启用某能力，请在环境变量中设置对应值并重启应用。
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "0.6875rem" }}>
          productionReady=false · safeToExposeToClient=true
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──

function mapCategory(category: string): string {
  switch (category) {
    case "llm": return "AI Assistant";
    case "floating-ai": return "AI Assistant";
    case "book-api": return "External APIs";
    case "problem-api": return "External APIs";
    case "db": return "Database";
    case "import": return "Imports";
    case "agent-mcp": return "Agent Preview";
    case "ui-shell": return "UI Shell";
    default: return category;
  }
}
