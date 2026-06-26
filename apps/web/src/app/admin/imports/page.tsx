/**
 * Admin Imports — read-only import status overview with real guard data.
 *
 * @adminDev — preview only, no write operations
 */

import { getAdminStatusSnapshot } from "../../../lib/admin-status-center";
import { StatusBadge, MissingEnvList } from "../../_components/StatusComponents";

export default function AdminImportsPage() {
  const snapshot = getAdminStatusSnapshot();
  const importItems = snapshot.items.filter((i) => i.category === "import");

  // Split into book vs problem
  const bookItems = importItems.filter((i) => i.key.startsWith("import.book"));
  const problemItems = importItems.filter((i) => i.key.startsWith("import.problem"));
  const commonItems = importItems.filter(
    (i) => !i.key.startsWith("import.book") && !i.key.startsWith("import.problem"),
  );

  return (
    <div>
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          导入管理
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)", marginTop: "4px" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
            只读预览 · 不执行写操作 · productionReady=false
          </p>
          <StatusBadge status="preview-only" variant="admin" />
        </div>
      </div>

      {/* Book/Problem import comparison */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
          Book / Problem 导入状态对比
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--lap-space-4)" }}>
          {/* Book import column */}
          <div
            style={{
              padding: "var(--lap-space-4)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--lap-radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--lap-space-3)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#cbd5e1" }}>
              Book 导入
            </h3>
            {bookItems.map((item) => (
              <ImportItemRow key={item.key} item={item} />
            ))}
            {bookItems.length === 0 && (
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>暂无数据</p>
            )}
          </div>

          {/* Problem import column */}
          <div
            style={{
              padding: "var(--lap-space-4)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--lap-radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--lap-space-3)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#cbd5e1" }}>
              Problem 导入
            </h3>
            {problemItems.map((item) => (
              <ImportItemRow key={item.key} item={item} />
            ))}
            {problemItems.length === 0 && (
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>暂无数据</p>
            )}
          </div>
        </div>
      </section>

      {/* Common import status */}
      {commonItems.length > 0 && (
        <section style={{ marginBottom: "var(--lap-space-6)" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
            通用导入状态
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--lap-space-3)" }}>
            {commonItems.map((item) => (
              <ItemCard key={item.key} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Safety notice */}
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
          导入链路安全说明
        </p>
        <p style={{ margin: "4px 0 0" }}>
          rawResponseStored=false — 所有导入预览不会将原始 API 响应落盘。
          productionReady=false — 导入链路仍为开发预览，不可用于生产环境。
          所有保存操作需 DB integration 通过后才允许。
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function ImportItemRow({ item }: { item: ReturnType<typeof getAdminStatusSnapshot>["items"][number] }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "var(--lap-space-2) 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.label}</span>
        <StatusBadge status={item.status} variant="admin" />
      </div>
      <p style={{ margin: 0, fontSize: "0.625rem", color: "#64748b", lineHeight: 1.4 }}>
        {item.safeDescription}
      </p>
      <MissingEnvList names={item.missingEnvNames} variant="admin" compact />
    </div>
  );
}

function ItemCard({ item }: { item: ReturnType<typeof getAdminStatusSnapshot>["items"][number] }) {
  return (
    <div
      style={{
        padding: "var(--lap-space-4)",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "var(--lap-radius-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <h4 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#cbd5e1", flex: 1 }}>
          {item.label}
        </h4>
        <StatusBadge status={item.status} variant="admin" />
      </div>
      <p style={{ margin: 0, fontSize: "0.6875rem", color: "#64748b", lineHeight: 1.5 }}>
        {item.safeDescription}
      </p>
      <MissingEnvList names={item.missingEnvNames} variant="admin" compact />
    </div>
  );
}
