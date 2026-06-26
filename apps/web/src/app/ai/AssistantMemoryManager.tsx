"use client";

import { useEffect, useMemo, useState } from "react";

import {
  addAssistantMemoryAction,
  deleteAssistantMemoryAction,
  listAssistantMemoriesAction,
  toggleAssistantMemoryEnabledAction,
} from "../../lib/assistant/assistant-server-actions.ts";
import type {
  AssistantMemoryCategory,
  AssistantMemoryRecord,
} from "../../lib/assistant/assistant-types.ts";

const CATEGORY_OPTIONS: Array<{ value: AssistantMemoryCategory; label: string }> = [
  { value: "preference", label: "偏好" },
  { value: "goal", label: "目标" },
  { value: "learning", label: "学习" },
  { value: "project", label: "项目" },
  { value: "other", label: "其他" },
];

const MAX_CONTENT_LENGTH = 500;

export function AssistantMemoryManager({
  hasSession,
}: {
  hasSession: boolean;
}) {
  const [memories, setMemories] = useState<AssistantMemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<AssistantMemoryCategory>("other");
  const [importance, setImportance] = useState("0.4");
  const [isSaving, setIsSaving] = useState(false);

  const enabledCount = useMemo(
    () => memories.filter((memory) => memory.enabled).length,
    [memories],
  );

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listAssistantMemoriesAction();
      setMemories(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "记忆列表加载失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await addAssistantMemoryAction({
        content: trimmed,
        category,
        source: "user_created",
        enabled: true,
        importance: normalizeImportance(importance),
      });
      setContent("");
      setCategory("other");
      setImportance("0.4");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存记忆失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(memory: AssistantMemoryRecord) {
    setError(null);
    try {
      await toggleAssistantMemoryEnabledAction(memory.id, !memory.enabled);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "切换记忆状态失败。");
    }
  }

  async function handleDelete(memory: AssistantMemoryRecord) {
    setError(null);
    try {
      const deleted = await deleteAssistantMemoryAction(memory.id);
      if (!deleted) {
        throw new Error("删除记忆失败。");
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除记忆失败。");
    }
  }

  if (!hasSession) {
    return (
      <div
        style={{
          borderRadius: "16px",
          border: "1px dashed #d7deea",
          padding: "20px",
          background: "#fafbfc",
          color: "var(--lap-text-muted)",
          lineHeight: 1.7,
        }}
      >
        登录后可查看、添加、禁用和删除自己的记忆。未登录状态下不会展示任何用户记忆。
      </div>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
            记忆管理
          </p>
          <h3 style={{ margin: "4px 0 0" }}>可查看、添加、禁用、删除自己的记忆</h3>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--lap-text-muted)" }}>
            仅保存短文本记忆。content 上限 {MAX_CONTENT_LENGTH} 字符，总量上限 100 条。
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span style={pillStyle}>总数 {memories.length}</span>
          <span style={pillStyle}>启用 {enabledCount}</span>
        </div>
      </div>

      {error ? (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            padding: "12px 14px",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "14px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <strong>记忆列表</strong>
            <button type="button" onClick={() => void refresh()} style={linkButtonStyle}>
              刷新
            </button>
          </div>

          {isLoading ? (
            <div style={{ color: "var(--lap-text-muted)" }}>正在加载...</div>
          ) : memories.length === 0 ? (
            <div
              style={{
                borderRadius: "12px",
                border: "1px dashed #d7deea",
                padding: "14px",
                color: "var(--lap-text-muted)",
                lineHeight: 1.7,
              }}
            >
              还没有记忆。可以先手动添加一条常用偏好、目标或学习摘要。
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {memories.map((memory) => (
                <article
                  key={memory.id}
                  style={{
                    borderRadius: "14px",
                    border: memory.enabled ? "1px solid rgba(99, 102, 241, 0.18)" : "1px solid #e5e7eb",
                    background: memory.enabled ? "rgba(99, 102, 241, 0.05)" : "#fafbfc",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={pillStyle}>{labelForCategory(memory.category)}</span>
                      <span style={pillStyle}>{memory.enabled ? "启用" : "禁用"}</span>
                      <span style={pillStyle}>{labelForSource(memory.source)}</span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--lap-text-subtle)" }}>
                      重要度 {memory.importance.toFixed(2)}
                    </span>
                  </div>

                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {memory.content}
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => void handleToggle(memory)} style={secondaryButtonStyle}>
                      {memory.enabled ? "禁用" : "启用"}
                    </button>
                    <button type="button" onClick={() => void handleDelete(memory)} style={dangerButtonStyle}>
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <strong>手动新增</strong>
          <label style={labelStyle}>
            分类
            <select value={category} onChange={(event) => setCategory(event.target.value as AssistantMemoryCategory)} style={inputStyle}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            重要度
            <input
              value={importance}
              onChange={(event) => setImportance(event.target.value)}
              type="number"
              step="0.1"
              min="0"
              max="1"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            内容
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
              maxLength={MAX_CONTENT_LENGTH}
              placeholder="例如：我偏好先看例子再看定义；当前学习目标是掌握 BFS/DFS；最近在练习二分查找。"
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: "160px",
              }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || content.trim().length === 0}
              style={primaryButtonStyle}
            >
              {isSaving ? "保存中..." : "添加记忆"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function normalizeImportance(raw: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return 0.4;
  }
  return Math.max(0, Math.min(1, parsed));
}

function labelForCategory(value: AssistantMemoryCategory): string {
  switch (value) {
    case "preference":
      return "偏好";
    case "goal":
      return "目标";
    case "learning":
      return "学习";
    case "project":
      return "项目";
    default:
      return "其他";
  }
}

function labelForSource(value: string): string {
  return value === "assistant_suggested" ? "AI 建议" : "手动添加";
}

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

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "var(--lap-text-secondary)",
};

const inputStyle: React.CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #dbe4ee",
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: "0.92rem",
  background: "#fff",
};

const primaryButtonStyle: React.CSSProperties = {
  minWidth: "100px",
  border: "none",
  borderRadius: "999px",
  padding: "0 16px",
  height: "40px",
  background: "linear-gradient(135deg, var(--lap-accent-primary), #7c3aed)",
  color: "#fff",
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

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--lap-accent-primary)",
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};
