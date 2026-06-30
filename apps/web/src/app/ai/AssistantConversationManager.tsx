"use client";

import { useEffect, useMemo, useState } from "react";

import {
  deleteAssistantConversationAction,
  listAssistantConversationsAction,
  restoreAssistantConversationAction,
} from "../../lib/assistant/assistant-server-actions.ts";
import type { AssistantConversationListItem } from "../../lib/assistant/assistant-types.ts";

export function AssistantConversationManager({
  hasSession,
}: {
  hasSession: boolean;
}) {
  const [active, setActive] = useState<AssistantConversationListItem[]>([]);
  const [archived, setArchived] = useState<AssistantConversationListItem[]>([]);
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => viewMode === "active" ? active : archived,
    [active, archived, viewMode],
  );

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listAssistantConversationsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setActive(result.active);
      setArchived(result.archived);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "会话列表加载失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function restoreConversation(conversationId: string) {
    setError(null);
    try {
      const result = await restoreAssistantConversationAction({ conversationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
      setViewMode("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "恢复会话失败。");
    }
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = window.confirm("确认删除这个会话及其来源长期记忆？删除后刷新也无法恢复。");
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const result = await deleteAssistantConversationAction({ conversationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除会话失败。");
    }
  }

  if (!hasSession) {
    return (
      <div style={emptyStyle}>
        登录后可查看、恢复和删除自己的会话。未登录状态不会展示任何服务端会话。
      </div>
    );
  }

  return (
    <section style={shellStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0 }}>对话管理</h3>
          <p style={noteStyle}>已归档会话恢复后，其来源长期记忆会同步回到当前长期记忆。</p>
        </div>
        <button type="button" onClick={() => void refresh()} style={secondaryButtonStyle}>
          {isLoading ? "刷新中..." : "刷新"}
        </button>
      </div>

      <div style={toolbarStyle}>
        <button type="button" onClick={() => setViewMode("active")} style={viewMode === "active" ? primaryMiniButtonStyle : secondaryMiniButtonStyle}>
          当前对话 {active.length}
        </button>
        <button type="button" onClick={() => setViewMode("archived")} style={viewMode === "archived" ? primaryMiniButtonStyle : secondaryMiniButtonStyle}>
          已归档 {archived.length}
        </button>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {visible.length === 0 ? (
        <div style={emptyStyle}>
          {viewMode === "active" ? "暂无当前会话。" : "暂无已归档会话。"}
        </div>
      ) : (
        <div style={listStyle}>
          {visible.map((item) => (
            <article key={item.id} style={itemStyle}>
              <div style={itemTopStyle}>
                <div>
                  <strong>{item.title}</strong>
                  <p style={previewStyle}>{item.recentMessagePreview}</p>
                </div>
                <span style={pillStyle}>{item.status === "archived" ? "已归档" : "当前"}</span>
              </div>

              <div style={metaGridStyle}>
                <Meta label="更新时间" value={formatDateTime(item.updatedAt)} />
                <Meta label="消息" value={`${item.messageCount} 条`} />
                <Meta label="压缩" value={`${item.compressionCount} 次`} />
                <Meta label="长期记忆" value={`${item.longTermMemoryCount} 条`} />
              </div>

              <div style={actionRowStyle}>
                {item.status === "archived" ? (
                  <button type="button" onClick={() => void restoreConversation(item.id)} style={secondaryButtonStyle}>
                    恢复
                  </button>
                ) : null}
                <button type="button" onClick={() => void deleteConversation(item.id)} style={dangerButtonStyle}>
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={metaLabelStyle}>{label}</span>
      <span style={metaValueStyle}>{value}</span>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

const noteStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "var(--lap-text-muted)",
  fontSize: "0.85rem",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const itemStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const itemTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

const previewStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "var(--lap-text-muted)",
  fontSize: "0.84rem",
  lineHeight: 1.55,
};

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const metaLabelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--lap-text-subtle)",
  fontSize: "0.72rem",
  marginBottom: "2px",
};

const metaValueStyle: React.CSSProperties = {
  color: "var(--lap-text-secondary)",
  fontSize: "0.84rem",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const emptyStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px dashed #dbe4ee",
  background: "#f8fafc",
  padding: "14px",
  color: "var(--lap-text-muted)",
  lineHeight: 1.7,
};

const errorStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  padding: "12px 14px",
  fontSize: "0.875rem",
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: "999px",
  background: "rgba(99, 102, 241, 0.08)",
  color: "var(--lap-accent-primary)",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const primaryMiniButtonStyle: React.CSSProperties = {
  border: "1px solid var(--lap-accent-primary)",
  borderRadius: "999px",
  padding: "6px 12px",
  background: "rgba(99, 102, 241, 0.10)",
  color: "var(--lap-accent-primary)",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryMiniButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "6px 12px",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "0 14px",
  height: "36px",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  borderRadius: "999px",
  padding: "0 14px",
  height: "36px",
  background: "#fff",
  color: "#b91c1c",
  fontWeight: 700,
  cursor: "pointer",
};
