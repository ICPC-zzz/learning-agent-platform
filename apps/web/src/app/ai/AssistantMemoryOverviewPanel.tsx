"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  listAssistantMemoryOverviewAction,
} from "../../lib/assistant/assistant-server-actions.ts";
import type { AssistantChatMessage, AssistantMemoryRecord } from "../../lib/assistant/assistant-types.ts";
import { useAssistantConversation } from "../_components/AssistantConversationStore.tsx";
import { EmptyState, MetricPill } from "../_components/UserUiComponents.tsx";

const MAX_MESSAGE_PREVIEW_LENGTH = 140;
const MAX_LONG_TERM_ITEMS = 5;
const MAX_SESSION_SUMMARY_ITEMS = 3;
const MAX_WORKING_MESSAGES = 5;

export function AssistantMemoryOverviewPanel({
  hasSession,
}: {
  hasSession: boolean;
}) {
  const { conversationId, messages, draftQuestion, status, providerMode } = useAssistantConversation();
  const [records, setRecords] = useState<AssistantMemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listAssistantMemoryOverviewAction();
      setRecords(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "记忆概览加载失败。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [conversationId, messages.length, status, providerMode, refresh]);

  const sessionSummaries = useMemo(
    () =>
      records
        .filter((record) => record.memoryType === "SESSION_SUMMARY")
        .sort(sortByUpdatedAtDesc)
        .slice(0, MAX_SESSION_SUMMARY_ITEMS),
    [records],
  );

  const longTermMemories = useMemo(
    () =>
      records
        .filter((record) => record.memoryType === "RETRIEVABLE")
        .sort(sortByUpdatedAtDesc)
        .slice(0, MAX_LONG_TERM_ITEMS),
    [records],
  );

  const enabledLongTermCount = useMemo(
    () => records.filter((record) => record.memoryType === "RETRIEVABLE" && record.enabled).length,
    [records],
  );

  const workingMessages = useMemo(
    () => messages.slice(-MAX_WORKING_MESSAGES),
    [messages],
  );

  return (
    <section
      className="lap-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "18px",
        minHeight: "min(78vh, 760px)",
      }}
      aria-labelledby="assistant-memory-overview-title"
    >
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>记忆面板</p>
          <h3 id="assistant-memory-overview-title" style={titleStyle}>
            工作记忆、会话摘要和长期记忆
          </h3>
          <p style={noteStyle}>
            工作记忆来自当前聊天窗口的消息缓存；会话摘要和长期记忆来自服务端记忆层。
          </p>
        </div>

        <div style={badgeClusterStyle}>
          <MetricPill label="消息" value={messages.length} status="info" />
          <MetricPill label="摘要" value={sessionSummaries.length} status="success" />
          <MetricPill label="长期" value={longTermMemories.length} status="warning" />
        </div>
      </div>

      <div style={toolbarStyle}>
        <div style={metaStackStyle}>
          <span style={metaLabelStyle}>Conversation</span>
          <code style={codeStyle}>{shortConversationId(conversationId)}</code>
        </div>
        <div style={badgeClusterStyle}>
          <MetricPill label="启用长期" value={enabledLongTermCount} status="success" />
          <button type="button" onClick={() => void refresh()} style={refreshButtonStyle} disabled={isLoading}>
            {isLoading ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={errorStyle} role="alert">
          {error}
        </div>
      ) : null}

      {!hasSession ? (
        <div style={noticeStyle}>
          当前未登录，仍可查看本地工作记忆，但服务端会话摘要和长期记忆会显示为空。
        </div>
      ) : null}

      <div style={gridStyle}>
        <MemoryCard
          title="工作记忆"
          subtitle="当前输入框草稿与最近消息"
        >
          <div style={stackStyle}>
            <InfoRow label="草稿" value={draftQuestion.trim().length > 0 ? draftQuestion : "未输入"} />
            <InfoRow label="最近消息" value={`${messages.length} 条`} />
            <div style={timelineStyle}>
              {workingMessages.length === 0 ? (
                <EmptyState
                  title="暂无聊天记录"
                  description="在悬浮球或 /ai 页面发送一次消息后，这里会显示当前工作记忆。"
                />
              ) : (
                workingMessages.map((message) => (
                  <WorkingMessageItem key={message.id} message={message} />
                ))
              )}
            </div>
          </div>
        </MemoryCard>

        <MemoryCard
          title="会话摘要"
          subtitle="自动压缩后的 session summary"
        >
          <div style={stackStyle}>
            <InfoRow
              label="状态"
              value={sessionSummaries.length > 0 ? "已生成" : "暂无摘要"}
            />
            <div style={timelineStyle}>
              {sessionSummaries.length === 0 ? (
                <EmptyState
                  title="没有会话摘要"
                  description="完成一轮问答后，助手会自动生成并更新当前会话摘要。"
                />
              ) : (
                sessionSummaries.map((record) => (
                  <MemoryRecordItem key={record.id} record={record} kind="summary" />
                ))
              )}
            </div>
          </div>
        </MemoryCard>

        <MemoryCard
          title="长期记忆"
          subtitle="自动抽取的可检索记忆"
        >
          <div style={stackStyle}>
            <InfoRow label="可检索" value={`${longTermMemories.length} 条`} />
            <div style={timelineStyle}>
              {longTermMemories.length === 0 ? (
                <EmptyState
                  title="没有长期记忆"
                  description="助手在识别到稳定偏好、目标、学习进度或项目上下文后，会自动写入长期记忆。"
                />
              ) : (
                longTermMemories.map((record) => (
                  <MemoryRecordItem key={record.id} record={record} kind="long-term" />
                ))
              )}
            </div>
          </div>
        </MemoryCard>
      </div>
    </section>
  );
}

function WorkingMessageItem({ message }: { message: AssistantChatMessage }) {
  return (
    <article style={messageItemStyle}>
      <div style={messageTopStyle}>
        <span style={rolePillStyle(message.role === "user" ? "user" : "assistant")}>
          {message.role === "user" ? "你" : "AI"}
        </span>
        <span style={timestampStyle}>{formatTimestamp(message.createdAt)}</span>
      </div>
      <p style={messageTextStyle}>{truncate(message.content, MAX_MESSAGE_PREVIEW_LENGTH)}</p>
    </article>
  );
}

function MemoryRecordItem({
  record,
  kind,
}: {
  record: AssistantMemoryRecord;
  kind: "summary" | "long-term";
}) {
  return (
    <article style={messageItemStyle}>
      <div style={messageTopStyle}>
        <span style={kind === "summary" ? summaryBadgeStyle : longTermBadgeStyle}>
          {kind === "summary" ? "摘要" : "长期"}
        </span>
        <span style={timestampStyle}>{formatTimestamp(record.updatedAt)}</span>
      </div>

      <p style={messageTextStyle}>{record.content}</p>

      <div style={tagRowStyle}>
        <MiniTag>{record.category}</MiniTag>
        <MiniTag>{record.enabled ? "启用" : "禁用"}</MiniTag>
        <MiniTag>重要度 {record.importance.toFixed(2)}</MiniTag>
        <MiniTag>{record.source === "assistant_suggested" ? "AI 建议" : "手动"}</MiniTag>
      </div>

      <dl style={metaGridStyle}>
        <MetaRow label="会话" value={shortConversationId(record.sessionId ?? null)} />
        <MetaRow label="来源消息" value={shortId(record.sourceMessageId)} />
        <MetaRow label="类型" value={record.memoryType ?? "RETRIEVABLE"} />
        {kind === "summary" ? (
          <>
            <MetaRow label="问题" value={metadataText(record, "question")} />
            <MetaRow label="路由" value={metadataText(record, "route")} />
          </>
        ) : (
          <>
            <MetaRow label="记忆种类" value={metadataText(record, "memoryKind")} />
            <MetaRow label="摘录" value={metadataText(record, "sourceExcerpt")} />
          </>
        )}
      </dl>
    </article>
  );
}

function MemoryCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
      children: ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div>
        <h4 style={cardTitleStyle}>{title}</h4>
        <p style={cardSubtitleStyle}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoRowStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={metaLabelStyle}>{label}</dt>
      <dd style={metaValueStyle}>{value}</dd>
    </>
  );
}

function MiniTag({ children }: { children: ReactNode }) {
  return <span style={miniTagStyle}>{children}</span>;
}

function sortByUpdatedAtDesc(left: AssistantMemoryRecord, right: AssistantMemoryRecord): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function metadataText(record: AssistantMemoryRecord, key: string): string {
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) {
    return "无";
  }

  const value = (record.metadata as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return truncate(value, 72);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const rendered = value
      .map((item) => (typeof item === "string" ? item : ""))
      .filter((item) => item.length > 0)
      .join(", ");
    return rendered.length > 0 ? truncate(rendered, 72) : "无";
  }

  return "无";
}

function shortConversationId(value: string | null): string {
  if (!value) {
    return "无";
  }

  return shortId(value);
}

function shortId(value: string | null | undefined): string {
  if (!value) {
    return "无";
  }

  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function truncate(value: string, maxChars: number): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--lap-text-subtle)",
  fontWeight: 800,
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: "1.08rem",
  color: "var(--lap-text-primary)",
};

const noteStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "var(--lap-text-muted)",
  fontSize: "0.84rem",
  lineHeight: 1.6,
};

const badgeClusterStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
  justifyContent: "flex-end",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
};

const metaStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const metaLabelStyle: CSSProperties = {
  fontSize: "0.72rem",
  color: "var(--lap-text-subtle)",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const codeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: "999px",
  background: "var(--lap-bg-card-alt)",
  color: "var(--lap-text-secondary)",
  fontFamily: "var(--lap-font-mono)",
  fontSize: "0.78rem",
  overflowWrap: "anywhere",
};

const refreshButtonStyle: CSSProperties = {
  minWidth: "88px",
  height: "36px",
  borderRadius: "999px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  padding: "12px 14px",
  fontSize: "0.875rem",
};

const noticeStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #dbe4ee",
  background: "#f8fafc",
  color: "var(--lap-text-muted)",
  padding: "12px 14px",
  fontSize: "0.875rem",
  lineHeight: 1.6,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  alignItems: "start",
  minHeight: 0,
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: 0,
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.96rem",
  color: "var(--lap-text-primary)",
};

const cardSubtitleStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: "0.82rem",
  color: "var(--lap-text-muted)",
  lineHeight: 1.6,
};

const stackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  minHeight: 0,
};

const infoRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "#f8fafc",
};

const infoLabelStyle: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--lap-text-subtle)",
  fontWeight: 700,
};

const infoValueStyle: CSSProperties = {
  fontSize: "0.84rem",
  color: "var(--lap-text-secondary)",
  textAlign: "right",
  overflowWrap: "anywhere",
};

const timelineStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  minHeight: 0,
};

const messageItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const messageTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const timestampStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--lap-text-subtle)",
};

const messageTextStyle: CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  lineHeight: 1.7,
  color: "var(--lap-text-secondary)",
  fontSize: "0.88rem",
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  alignItems: "center",
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 10px",
  margin: 0,
};

const metaValueStyle: CSSProperties = {
  margin: 0,
  color: "var(--lap-text-muted)",
  fontSize: "0.8rem",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const miniTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "rgba(99, 102, 241, 0.08)",
  color: "var(--lap-accent-primary)",
  fontSize: "0.7rem",
  fontWeight: 700,
};

function rolePillStyle(role: "user" | "assistant"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: "999px",
    background: role === "user" ? "rgba(99, 102, 241, 0.10)" : "rgba(79, 111, 82, 0.10)",
    color: role === "user" ? "var(--lap-accent-primary)" : "#2f5135",
    fontSize: "0.7rem",
    fontWeight: 800,
  };
}

const summaryBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#eef5ef",
  color: "#243b27",
  fontSize: "0.7rem",
  fontWeight: 800,
};

const longTermBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "rgba(245, 158, 11, 0.12)",
  color: "#92400e",
  fontSize: "0.7rem",
  fontWeight: 800,
};
