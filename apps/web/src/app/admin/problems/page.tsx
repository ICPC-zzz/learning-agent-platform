/**
 * Admin Problems — read-only problem import status overview with real guard data.
 *
 * @adminDev — preview only, no write operations
 */

import { getAdminStatusSnapshot } from "../../../lib/admin-status-center";
import { StatusBadge, MissingEnvList } from "../../_components/StatusComponents";

export default function AdminProblemsPage() {
  const snapshot = getAdminStatusSnapshot();
  const problemApiItems = snapshot.items.filter((i) => i.category === "problem-api");
  const importItems = snapshot.items.filter(
    (i) => i.category === "import" && i.key.startsWith("import.problem"),
  );

  return (
    <div>
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          题目管理
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)", marginTop: "4px" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
            只读预览 · 不执行写操作 · productionReady=false
          </p>
          <StatusBadge status="preview-only" variant="admin" />
        </div>
      </div>

      {/* Problem API Readiness */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
          Problem API 就绪状态
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--lap-space-3)" }}>
          {problemApiItems.map((item) => (
            <ItemCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* Import Readiness */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
          导入就绪状态
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--lap-space-3)" }}>
          {importItems.map((item) => (
            <ItemCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* imported-dev / DB / localStorage dedup note */}
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
          imported-dev / DB / localStorage 去重说明
        </p>
        <p style={{ margin: "4px 0 0" }}>
          题目导入支持双数据源：DB 导入（依赖 LAP_ALLOW_REAL_DB_INTEGRATION=true）和 localStorage 回退。
          ImportedProblemManagerClient 自动处理去重逻辑，相同 ID 的题目优先展示 DB 版本。
          Problem API 搜索预览依赖外部 API guard 通过后才允许真实调用。
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "0.6875rem" }}>
          productionReady=false · rawResponseStored=false
        </p>
      </div>
    </div>
  );
}

// ── Sub-component ──

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
