/**
 * Admin AI — read-only LLM guard and assistant entry status.
 *
 * @adminDev — preview only, no write operations
 */

import { getAdminStatusSnapshot } from "../../../lib/admin-status-center";
import { StatusBadge, MissingEnvList } from "../../_components/StatusComponents";

export default function AdminAiPage() {
  const snapshot = getAdminStatusSnapshot();

  const llmItems = snapshot.items.filter((i) => i.category === "llm");

  return (
    <div>
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          AI 助手管理
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--lap-space-3)", marginTop: "4px" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94a3b8" }}>
            只读预览 · 不执行写操作 · productionReady=false
          </p>
          <StatusBadge status="preview-only" variant="admin" />
        </div>
      </div>

      {/* LLM Guard Status */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
          LLM Guard 状态
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--lap-space-3)" }}>
          {llmItems.map((item) => (
            <ItemCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* Context builder / user data summary status */}
      <section style={{ marginBottom: "var(--lap-space-6)" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 var(--lap-space-4)" }}>
          Context Builder / User Data Summary
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--lap-space-3)" }}>
          <ContextBuilderCard
            title="Context Builder"
            items={[
              { label: "页面类型检测", value: "enabled", desc: "classifyPageType() 可识别 10 种页面类型" },
              { label: "意图检测", value: "enabled", desc: "detectIntent() 可识别限制性意图" },
              { label: "页面上下文构建", value: "enabled", desc: "WebAiPageContextInput 包含路径、标题、类型" },
              { label: "限制性意图拦截", value: "enabled", desc: RESTRICTED_INTENT_LABELS_STRING },
              { label: "真实 MCP/Tools", value: "disabled", desc: "不调用真实 Agent 工具" },
            ]}
          />

          <ContextBuilderCard
            title="User Data Summary"
            items={[
              { label: "getWebAiUserDataSummary", value: "enabled", desc: "数据摘要加载器已可用" },
              { label: "空摘要回退", value: "enabled", desc: "guard blocked 或异常时返回空摘要" },
              { label: "真实用户数据", value: "guard-gated", desc: "依赖 DB integration 和 auth" },
              { label: "数据落盘", value: "disabled", desc: "不保存 user data summary 到数据库" },
            ]}
          />
        </div>
      </section>

      {/* Safety */}
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
          AI 助手安全边界
        </p>
        <p style={{ margin: "4px 0 0" }}>
          /ai 主页面为受限网页助手入口，不执行 Agent 工具（shell/file/MCP/GitHub）。
          不保存 raw prompt/response。不泄露 API key/token。
          所有 LLM 调用受 WebAiQaGuard 控制，非开发环境自动 blocked。
        </p>
      </div>
    </div>
  );
}

const RESTRICTED_INTENT_LABELS_STRING =
  "系统命令、文件操作、网络请求、MCP 工具、Agent 动作、代码执行等均为限制性意图";

// ── Sub-components ──

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

function ContextBuilderCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; desc: string }[];
}) {
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
      <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#cbd5e1" }}>
        {title}
      </h4>
      {items.map((item, i) => (
        <div
          key={item.label + i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "8px",
            padding: "4px 0",
            borderBottom:
              i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>
              {item.label}
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b", lineHeight: 1.4 }}>
              {item.desc}
            </span>
          </div>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 600,
              padding: "1px 6px",
              borderRadius: "4px",
              background:
                item.value === "enabled"
                  ? "rgba(34,197,94,0.15)"
                  : item.value === "disabled"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(245,158,11,0.15)",
              color:
                item.value === "enabled"
                  ? "#4ade80"
                  : item.value === "disabled"
                    ? "#f87171"
                    : "#fbbf24",
              flexShrink: 0,
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
