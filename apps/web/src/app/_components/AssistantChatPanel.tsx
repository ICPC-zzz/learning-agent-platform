"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  archiveAssistantConversationAction,
  compressAssistantConversationAction,
  cancelAssistantTaskAction,
  createAssistantConversationAction,
  deleteAssistantConversationAction,
  getAssistantRuntimeConfigAction,
  listAssistantConversationsAction,
  listAssistantTasksAction,
  loadAssistantConversationAction,
  retryAssistantAgentTaskAction,
  retryAssistantTaskAction,
  runAssistantAction,
} from "../../lib/assistant/assistant-server-actions.ts";
import type {
  AssistantConversationListItem,
  AssistantMultiAgentTaskView,
  AssistantSource,
  AssistantStabilityInjectionMode,
  AssistantToolTimelineItem,
} from "../../lib/assistant/assistant-types.ts";
import { useAssistantConversation, type AssistantChatMessage } from "./AssistantConversationStore.tsx";
import { useAssistantPageContext } from "./AssistantPageContextProvider.tsx";
import { getServerActionRecoveryMessage } from "../ai/server-action-recovery.ts";

export function AssistantChatPanel({
  compact = false,
  onCloseRequest,
}: {
  compact?: boolean;
  onCloseRequest?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(function() { setMounted(true); }, []);
  const router = useRouter();
  const pageContext = useAssistantPageContext();
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const deploymentRecoveryStartedRef = useRef(false);
  const {
    conversationId,
    messages,
    draftQuestion,
    setDraftQuestion,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    status,
    setStatus,
    providerMode,
    setProviderMode,
    setMessages,
    contextCompression,
    setContextCompression,
    tasks,
    setTasks,
    setConversationId,
    resetConversation,
  } = useAssistantConversation();
  const [isCompressing, setIsCompressing] = useState(false);
  const [conversationList, setConversationList] = useState<AssistantConversationListItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<{
    stabilityTestModeEnabled: boolean;
    stabilityModes: AssistantStabilityInjectionMode[];
  }>({ stabilityTestModeEnabled: false, stabilityModes: ["normal"] });
  const [stabilityMode, setStabilityMode] = useState<AssistantStabilityInjectionMode>("normal");

  const contextLabel = useMemo(() => {
    const pieces = [pageContext.pageType, pageContext.title].filter(Boolean);
    return pieces.join(" / ");
  }, [pageContext.pageType, pageContext.title]);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSubmitting, status, providerMode, error]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;
    loadAssistantConversationAction(conversationId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setConversationId(result.conversation.conversationId);
        setMessages([...result.conversation.messages]);
        setTasks([...(result.tasks ?? result.conversation.tasks ?? [])]);
        setContextCompression(result.contextCompression);
        setError(null);
        void refreshConversationList();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          handleServerActionError(error, "读取服务端会话失败。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  function handleServerActionError(error: unknown, fallbackMessage: string): void {
    const recoveryMessage = getServerActionRecoveryMessage(error);
    if (!recoveryMessage) {
      setError(fallbackMessage);
      return;
    }

    setError(recoveryMessage);
    if (deploymentRecoveryStartedRef.current) {
      return;
    }
    deploymentRecoveryStartedRef.current = true;
    window.setTimeout(() => window.location.reload(), 300);
  }

  useEffect(() => {
    if (!mounted) {
      return;
    }
    let cancelled = false;
    getAssistantRuntimeConfigAction()
      .then((config) => {
        if (!cancelled) {
          setRuntimeConfig(config);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !conversationId || !hasActiveTasks(tasks)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshTasks();
    }, 1400);
    return () => window.clearInterval(timer);
  }, [conversationId, mounted, tasks]);

  async function refreshConversationList() {
    setIsLoadingConversations(true);
    try {
      const result = await listAssistantConversationsAction();
      if (result.ok) {
        setConversationList(result.active);
      }
    } catch (error: unknown) {
      handleServerActionError(error, "刷新会话列表失败。");
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function refreshTasks() {
    try {
      const result = await listAssistantTasksAction({ conversationId });
      if (result.ok) {
        setTasks([...result.tasks]);
      }
    } catch {
      // Task polling is best-effort; the next manual refresh can recover.
    }
  }

  async function loadConversation(nextConversationId: string) {
    if (isSubmitting || isCompressing || nextConversationId === conversationId) {
      return;
    }
    setError(null);
    try {
      const result = await loadAssistantConversationAction(nextConversationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversationId(result.conversation.conversationId);
      setMessages([...result.conversation.messages]);
      setTasks([...(result.tasks ?? result.conversation.tasks ?? [])]);
      setContextCompression(result.contextCompression);
      setStatus(null);
      setProviderMode(null);
    } catch (err: unknown) {
      handleServerActionError(err, "切换会话失败。");
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = draftQuestion.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const userMessage: AssistantChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const requestId = createRequestId();
    const conversationMessages = [...messages, userMessage].slice(-20);
    setMessages(conversationMessages);
    setDraftQuestion("");

    try {
      const result = await runAssistantAction({
        question: trimmed,
        pageContext,
        conversation: {
          conversationId,
          messages: conversationMessages,
          draftQuestion: "",
        },
        requestId,
        stabilityInjectionMode: runtimeConfig.stabilityTestModeEnabled ? stabilityMode : "normal",
      });
      setStatus(result.state);
      setProviderMode(result.providerMode);
      if (result.conversation) {
        setConversationId(result.conversation.conversationId);
        setMessages([...result.conversation.messages]);
        setTasks([...(result.tasks ?? result.conversation.tasks ?? [])]);
      }
      if (result.contextCompression) {
        setContextCompression(result.contextCompression);
      }
      await refreshConversationList();
      if (result.state !== "ok") {
        setError(result.message);
      }
    } catch (err: unknown) {
      setStatus("error");
      setProviderMode("error");
      handleServerActionError(err, "AI 请求失败。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualCompress() {
    if (isSubmitting || isCompressing) {
      return;
    }
    setIsCompressing(true);
    setError(null);

    try {
      const result = await compressAssistantConversationAction({ conversationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversationId(result.conversation.conversationId);
      setMessages([...result.conversation.messages]);
      setContextCompression(result.contextCompression);
      setTasks([...(result.tasks ?? result.conversation.tasks ?? [])]);
      setStatus("ok");
      setProviderMode("unavailable");
      await refreshConversationList();
    } catch (err: unknown) {
      handleServerActionError(err, "压缩执行失败。");
    } finally {
      setIsCompressing(false);
    }
  }

  async function handleNewConversation() {
    if (isSubmitting || isCompressing) {
      return;
    }
    setError(null);
    try {
      const result = await createAssistantConversationAction();
      if (!result.ok) {
        setError(result.error);
        resetConversation();
        return;
      }
      setConversationId(result.conversation.conversationId);
      setMessages([...result.conversation.messages]);
      setTasks([]);
      setDraftQuestion("");
      setStatus(null);
      setProviderMode(null);
      setContextCompression(result.contextCompression);
      await refreshConversationList();
    } catch (err: unknown) {
      handleServerActionError(err, "创建会话失败。");
    }
  }

  async function handleArchiveConversation(targetId: string) {
    if (isSubmitting || isCompressing) {
      return;
    }
    setError(null);
    try {
      const result = await archiveAssistantConversationAction({ conversationId: targetId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refreshConversationList();
      if (targetId === conversationId) {
        const created = await createAssistantConversationAction();
        if (created.ok) {
          setConversationId(created.conversation.conversationId);
          setMessages([...created.conversation.messages]);
          setTasks([]);
          setContextCompression(created.contextCompression);
          setStatus(null);
          setProviderMode(null);
          await refreshConversationList();
        }
      }
    } catch (err: unknown) {
      handleServerActionError(err, "归档会话失败。");
    }
  }

  async function handleDeleteConversation(targetId: string) {
    if (isSubmitting || isCompressing) {
      return;
    }
    const confirmed = window.confirm("确认删除这个会话及其来源长期记忆？删除后刷新也无法恢复。");
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      const result = await deleteAssistantConversationAction({ conversationId: targetId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refreshConversationList();
      if (targetId === conversationId) {
        const created = await createAssistantConversationAction();
        if (created.ok) {
          setConversationId(created.conversation.conversationId);
          setMessages([...created.conversation.messages]);
          setTasks([]);
          setContextCompression(created.contextCompression);
          setStatus(null);
          setProviderMode(null);
          await refreshConversationList();
        }
      }
    } catch (err: unknown) {
      handleServerActionError(err, "删除会话失败。");
    }
  }

  async function handleCancelTask(taskId: string) {
    setError(null);
    try {
      const result = await cancelAssistantTaskAction({ taskId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTasks((current) => replaceTask(current, result.task));
      void refreshTasks();
    } catch (error: unknown) {
      handleServerActionError(error, "取消任务失败。");
    }
  }

  async function handleRetryAgent(taskId: string, agentName: AssistantMultiAgentTaskView["canRetryAgentNames"][number]) {
    setError(null);
    try {
      const result = await retryAssistantAgentTaskAction({ taskId, agentName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTasks((current) => replaceTask(current, result.task));
      void refreshTasks();
    } catch (error: unknown) {
      handleServerActionError(error, "重试步骤失败。");
    }
  }

  async function handleRetryTask(taskId: string) {
    setError(null);
    try {
      const result = await retryAssistantTaskAction({ taskId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTasks((current) => replaceTask(current, result.task));
      void refreshTasks();
    } catch (error: unknown) {
      handleServerActionError(error, "重试任务失败。");
    }
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "12px" : "16px",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div style={conversationLayoutStyle}>
        <aside style={conversationSidebarStyle} aria-label="assistant conversation list">
          <div style={conversationSidebarHeaderStyle}>
            <div>
              <div style={contextEyebrowStyle}>当前对话</div>
              <div style={contextTitleStyle}>会话列表</div>
            </div>
            <button type="button" onClick={() => void handleNewConversation()} disabled={isSubmitting || isCompressing} style={smallHeaderButtonStyle}>
              新建
            </button>
          </div>

          <button type="button" onClick={() => void refreshConversationList()} style={conversationRefreshButtonStyle}>
            {isLoadingConversations ? "刷新中..." : "刷新列表"}
          </button>

          <div style={conversationListStyle}>
            {conversationList.length === 0 ? (
              <div style={conversationEmptyStyle}>暂无已保存会话。发送消息或点击新建后会出现。</div>
            ) : conversationList.map((item) => (
              <article
                key={item.id}
                style={item.id === conversationId ? activeConversationItemStyle : conversationItemStyle}
              >
                <button type="button" onClick={() => void loadConversation(item.id)} style={conversationSelectButtonStyle}>
                  <span style={conversationTitleStyle}>{item.title}</span>
                  <span style={conversationPreviewStyle}>{item.recentMessagePreview}</span>
                  <span style={conversationMetaStyle}>
                    {formatDateTime(item.updatedAt)} · {item.compressionCount} 次压缩 · {item.longTermMemoryCount} 条记忆
                  </span>
                </button>
                <div style={conversationActionsStyle}>
                  <button type="button" onClick={() => void handleArchiveConversation(item.id)} style={miniActionButtonStyle}>
                    归档
                  </button>
                  <button type="button" onClick={() => void handleDeleteConversation(item.id)} style={miniDangerButtonStyle}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <div style={conversationMainStyle}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
            当前页面
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: compact ? "1.05rem" : "1.2rem" }}>
            {contextLabel || pageContext.route}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--lap-text-muted)" }}>
            只结合当前页面信息和可管理记忆进行回答。
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            alignItems: "flex-end",
          }}
          suppressHydrationWarning
        >
          <button type="button" onClick={() => void handleNewConversation()} disabled={isSubmitting || isCompressing} style={smallHeaderButtonStyle}>
            新建会话
          </button>
          <button type="button" onClick={() => void handleManualCompress()} disabled={isSubmitting || isCompressing} style={smallHeaderButtonStyle}>
            {isCompressing ? "压缩中..." : "压缩上下文"}
          </button>
          <span style={chipStyle}>{pageContext.pageType}</span>
          {mounted && providerMode ? <span style={chipStyle}>{providerMode}</span> : null}
          {contextCompression ? (
            <span style={chipStyle}>
              上下文 {contextCompression.budget.percentUsed}% · {contextCompression.compressionCount} 次压缩
            </span>
          ) : null}
        </div>
      </header>

      {status && status !== "ok" ? (
        <div
          style={{
            borderRadius: "var(--lap-radius-md)",
            border: "1px solid #f0c36d",
            background: "#fff8e1",
            padding: "12px 14px",
            color: "#8a5b00",
            fontSize: "0.875rem",
          }}
        >
          {status === "blocked"
            ? "输入被安全规则拦截。"
            : status === "unavailable"
              ? "AI 服务暂时不可用。"
              : "AI 服务发生错误。"}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            borderRadius: "var(--lap-radius-md)",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "12px 14px",
            color: "#991b1b",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {runtimeConfig.stabilityTestModeEnabled ? (
        <DevelopmentStabilityControl
          value={stabilityMode}
          modes={runtimeConfig.stabilityModes}
          onChange={setStabilityMode}
        />
      ) : null}

      {tasks.length > 0 ? (
        <MultiAgentTaskTimeline
          tasks={tasks}
          onCancel={handleCancelTask}
          onRetryAgent={handleRetryAgent}
          onRetryTask={handleRetryTask}
        />
      ) : null}

      <div
        ref={messagesScrollRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          overflowY: "auto",
          flex: "1 1 auto",
          minHeight: 0,
          paddingRight: "4px",
        }}
      >
        {messages.length === 0 && !isSubmitting ? (
          <div
            style={{
              padding: "24px",
              borderRadius: "var(--lap-radius-lg)",
              border: "1px dashed rgba(99, 102, 241, 0.25)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(248,250,252,0.9))",
              color: "var(--lap-text-muted)",
              fontSize: "0.9rem",
              lineHeight: 1.7,
            }}
          >
            问我当前页面内容、最近学习、记忆管理，或者点击推荐动作直接跳转。
          </div>
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              alignSelf: message.role === "user" ? "flex-end" : message.role === "system" ? "center" : "flex-start",
              width: "100%",
            }}
          >
            <div
              style={{
                maxWidth: "100%",
                alignSelf: message.role === "user" ? "flex-end" : message.role === "system" ? "center" : "flex-start",
                background: message.role === "user"
                  ? "rgba(99, 102, 241, 0.10)"
                  : message.role === "system"
                    ? "#f8fafc"
                    : "#ffffff",
                border: message.role === "user"
                  ? "1px solid rgba(99, 102, 241, 0.20)"
                  : message.role === "system"
                    ? "1px solid #cbd5e1"
                    : "1px solid #e5e7eb",
                borderRadius: message.role === "system" ? "8px" : "14px",
                padding: "12px 14px",
                boxShadow: message.role === "assistant" ? "0 4px 16px rgba(15, 23, 42, 0.04)" : "none",
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--lap-text-subtle)", marginBottom: "6px" }}>
                {message.role === "user" ? "你" : message.role === "system" ? "系统事件" : "助手"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.93rem" }}>
                {message.content}
              </div>
            </div>

            {message.usedTools && message.usedTools.length > 0 ? (
              <div style={metaRowStyle}>
                <span style={metaLabelStyle}>工具</span>
                <span style={metaTextStyle}>{message.usedTools.map(formatToolDisplayName).join(" · ")}</span>
              </div>
            ) : null}

            {message.toolTimeline && message.toolTimeline.length > 0 ? (
              <ToolTimeline items={message.toolTimeline} />
            ) : null}

            {message.sources && message.sources.length > 0 ? (
              <div style={sourceGridStyle}>
                {message.sources.map((source) => (
                  <SourceCard key={`${message.id}-${source.url}`} source={source} />
                ))}
              </div>
            ) : null}

            {message.actions && message.actions.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {message.actions.map((action) => (
                  <button
                    key={`${message.id}-${action.route}`}
                    type="button"
                    onClick={() => router.push(action.route)}
                    style={actionButtonStyle}
                  >
                    <span style={{ fontWeight: 700 }}>{action.label}</span>
                    <span style={{ opacity: 0.72, marginLeft: "6px" }}>{action.route}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {isSubmitting ? (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "var(--lap-text-muted)",
              fontSize: "0.9rem",
            }}
          >
            正在整理当前页面信息...
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          paddingTop: "4px",
          flexShrink: 0,
        }}
      >
        <textarea
          value={draftQuestion}
          onChange={(event) => setDraftQuestion(event.target.value)}
          placeholder="输入问题，按 Enter 发送，Shift+Enter 换行"
          rows={compact ? 2 : 3}
          maxLength={1000}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "none",
            borderRadius: "14px",
            border: "1px solid #dbe4ee",
            padding: "12px 14px",
            fontFamily: "inherit",
            fontSize: "0.95rem",
            outline: "none",
            background: "#fff",
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
              当前页：{pageContext.pageType}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
              点击推荐动作后才会执行跳转。
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {onCloseRequest ? (
              <button type="button" onClick={onCloseRequest} style={secondaryButtonStyle}>
                收起
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting || draftQuestion.trim().length === 0}
              style={primaryButtonStyle}
            >
              {isSubmitting ? "发送中..." : "发送"}
            </button>
          </div>
        </div>
      </form>
        </div>
      </div>
    </section>
  );
}

function SourceCard({ source }: { source: AssistantSource }) {
  return (
    <a
      href={source.url}
      target={source.url.startsWith("/") ? undefined : "_blank"}
      rel={source.url.startsWith("/") ? undefined : "noreferrer"}
      style={sourceCardStyle}
    >
      <div style={sourceTitleStyle}>{source.title}</div>
      <div style={sourceMetaStyle}>{source.source}</div>
    </a>
  );
}

function ToolTimeline({ items }: { items: readonly AssistantToolTimelineItem[] }) {
  return (
    <div style={toolTimelineStyle} aria-label="assistant tool timeline">
      <div style={toolTimelineTitleStyle}>只读工具执行摘要</div>
      {items.map((item, index) => (
        <div key={`${item.toolName}-${index}-${item.startedAt}`} style={toolTimelineItemStyle}>
          <div style={toolTimelineTopStyle}>
            <span style={toolTimelineStatusStyle(item.status)}>
              {formatToolTimelineStatus(item.status)}
            </span>
            <strong style={toolTimelineNameStyle}>{formatToolDisplayName(item.toolName)}</strong>
          </div>
          <div style={toolTimelineMetaStyle}>
            {formatDateTime(item.startedAt)} → {formatDateTime(item.completedAt)} · 耗时：{formatDurationMs(item.durationMs ?? elapsedBetween(item.startedAt, item.completedAt))} · 来源：{item.dataSource} · {item.usedCache ? "使用缓存" : "实时/本地读取"}{item.retryable ? " · 可重试" : ""}
          </div>
          <div style={toolTimelineSummaryStyle}>{item.safetySummary}</div>
        </div>
      ))}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: "999px",
  background: "rgba(99, 102, 241, 0.10)",
  color: "var(--lap-accent-primary)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const devControlStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  padding: "8px 10px",
};

const devControlBodyStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  gap: "8px",
};

const devControlLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  color: "var(--lap-text-muted)",
  fontSize: "0.78rem",
  fontWeight: 700,
};

const devSelectStyle: React.CSSProperties = {
  height: "34px",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  color: "var(--lap-text-primary)",
  padding: "0 8px",
  minWidth: "260px",
};

const taskTimelineWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const taskCardStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  padding: "10px",
};

const taskDetailsStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const taskSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  minWidth: 0,
};

const taskTitleStyle: React.CSSProperties = {
  color: "var(--lap-text-primary)",
  fontWeight: 800,
  fontSize: "0.88rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
  flex: "1 1 auto",
};

const taskMetaInlineStyle: React.CSSProperties = {
  color: "var(--lap-text-muted)",
  fontSize: "0.74rem",
  flex: "0 0 auto",
};

const taskBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginTop: "10px",
};

const taskMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "8px",
};

const taskMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: "3px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  padding: "8px",
  color: "var(--lap-text-muted)",
  fontSize: "0.72rem",
};

const taskActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const agentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const agentRunStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  padding: "9px",
  minWidth: 0,
};

const agentRunTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7px",
  flexWrap: "wrap",
  color: "var(--lap-text-primary)",
  fontSize: "0.82rem",
};

const agentAttemptStyle: React.CSSProperties = {
  color: "var(--lap-text-subtle)",
  fontSize: "0.72rem",
};

const agentRoleStyle: React.CSSProperties = {
  color: "var(--lap-text-muted)",
  fontSize: "0.76rem",
  lineHeight: 1.45,
};

const agentTimeStyle: React.CSSProperties = {
  color: "var(--lap-text-subtle)",
  fontSize: "0.72rem",
  lineHeight: 1.45,
};

const agentTextStyle: React.CSSProperties = {
  color: "var(--lap-text-secondary)",
  fontSize: "0.75rem",
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const agentSummaryStyle: React.CSSProperties = {
  color: "var(--lap-text-secondary)",
  fontSize: "0.76rem",
  lineHeight: 1.5,
  background: "#f8fafc",
  borderRadius: "8px",
  padding: "7px",
};

const agentErrorStyle: React.CSSProperties = {
  color: "#991b1b",
  fontSize: "0.74rem",
  lineHeight: 1.45,
};

const agentInjectionStyle: React.CSSProperties = {
  color: "#8a5b00",
  background: "#fff8e1",
  border: "1px solid #f0c36d",
  borderRadius: "8px",
  padding: "6px",
  fontSize: "0.74rem",
};

const finalAnswerStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fbfdff",
  padding: "10px",
  display: "grid",
  gap: "8px",
};

const finalAnswerTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  color: "var(--lap-text-secondary)",
  fontSize: "0.84rem",
  lineHeight: 1.6,
};

const evidenceSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const evidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "8px",
};

const evidenceCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  borderRadius: "8px",
  border: "1px solid rgba(37, 99, 235, 0.16)",
  background: "#fff",
  padding: "9px",
  color: "var(--lap-text-secondary)",
  textDecoration: "none",
  fontSize: "0.74rem",
  lineHeight: 1.4,
};

const taskSectionTitleStyle: React.CSSProperties = {
  color: "var(--lap-text-primary)",
  fontSize: "0.8rem",
  fontWeight: 800,
};

const auditDetailsStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "8px",
};

const auditListStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  marginTop: "8px",
};

const auditItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "150px 150px minmax(0, 1fr)",
  gap: "8px",
  color: "var(--lap-text-muted)",
  fontSize: "0.72rem",
  lineHeight: 1.45,
};

const taskStatusOkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "#dcfce7",
  color: "#166534",
};

const taskStatusPartialStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "#fef3c7",
  color: "#92400e",
};

const taskStatusFailedStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "#fee2e2",
  color: "#991b1b",
};

const taskStatusRunningStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const conversationLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "230px minmax(0, 1fr)",
  gap: "12px",
  minHeight: 0,
  flex: "1 1 auto",
};

const conversationSidebarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  minHeight: 0,
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#fff",
  padding: "10px",
  overflow: "hidden",
};

const conversationSidebarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  alignItems: "center",
};

const conversationMainStyle: React.CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const conversationRefreshButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "8px",
  height: "32px",
  background: "#f8fafc",
  color: "var(--lap-text-secondary)",
  fontSize: "0.78rem",
  fontWeight: 700,
  cursor: "pointer",
};

const conversationListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  overflowY: "auto",
  minHeight: 0,
};

const conversationEmptyStyle: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px dashed #dbe4ee",
  padding: "10px",
  color: "var(--lap-text-muted)",
  fontSize: "0.78rem",
  lineHeight: 1.5,
};

const conversationItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: "8px",
};

const activeConversationItemStyle: React.CSSProperties = {
  ...conversationItemStyle,
  border: "1px solid rgba(99, 102, 241, 0.35)",
  background: "rgba(99, 102, 241, 0.06)",
};

const conversationSelectButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  textAlign: "left",
  cursor: "pointer",
  color: "inherit",
};

const conversationTitleStyle: React.CSSProperties = {
  color: "var(--lap-text-primary)",
  fontWeight: 800,
  fontSize: "0.84rem",
  overflowWrap: "anywhere",
};

const conversationPreviewStyle: React.CSSProperties = {
  color: "var(--lap-text-muted)",
  fontSize: "0.76rem",
  lineHeight: 1.45,
};

const conversationMetaStyle: React.CSSProperties = {
  color: "var(--lap-text-subtle)",
  fontSize: "0.7rem",
  lineHeight: 1.4,
};

const conversationActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const miniActionButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "4px 8px",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontSize: "0.72rem",
  fontWeight: 700,
  cursor: "pointer",
};

const miniDangerButtonStyle: React.CSSProperties = {
  ...miniActionButtonStyle,
  border: "1px solid #fecaca",
  color: "#b91c1c",
};

const smallHeaderButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "5px 10px",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontSize: "0.72rem",
  fontWeight: 700,
  cursor: "pointer",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  alignItems: "center",
};

const metaLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "rgba(15, 23, 42, 0.06)",
  color: "var(--lap-text-subtle)",
  fontSize: "0.72rem",
  fontWeight: 700,
};

const metaTextStyle: React.CSSProperties = {
  color: "var(--lap-text-muted)",
  fontSize: "0.82rem",
  lineHeight: 1.6,
};

const sourceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const toolTimelineStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  borderRadius: "8px",
  border: "1px solid #dbe4ee",
  background: "#f8fafc",
  padding: "10px",
};

const toolTimelineTitleStyle: React.CSSProperties = {
  color: "var(--lap-text-primary)",
  fontSize: "0.78rem",
  fontWeight: 800,
};

const toolTimelineItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: "8px",
};

const toolTimelineTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const toolTimelineNameStyle: React.CSSProperties = {
  color: "var(--lap-text-primary)",
  fontSize: "0.82rem",
};

const toolTimelineMetaStyle: React.CSSProperties = {
  color: "var(--lap-text-muted)",
  fontSize: "0.74rem",
  lineHeight: 1.5,
};

const toolTimelineSummaryStyle: React.CSSProperties = {
  color: "var(--lap-text-secondary)",
  fontSize: "0.78rem",
  lineHeight: 1.5,
};

const toolStatusOkStyle: React.CSSProperties = {
  ...metaLabelStyle,
  background: "#dcfce7",
  color: "#166534",
};

const toolStatusFailedStyle: React.CSSProperties = {
  ...metaLabelStyle,
  background: "#fee2e2",
  color: "#991b1b",
};

const toolStatusSkippedStyle: React.CSSProperties = {
  ...metaLabelStyle,
  background: "#f1f5f9",
  color: "#475569",
};

const sourceCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(99, 102, 241, 0.16)",
  background: "rgba(255, 255, 255, 0.92)",
  textDecoration: "none",
  color: "inherit",
};

const sourceTitleStyle: React.CSSProperties = {
  fontSize: "0.86rem",
  fontWeight: 700,
  color: "var(--lap-text-primary)",
  lineHeight: 1.5,
};

const sourceMetaStyle: React.CSSProperties = {
  fontSize: "0.74rem",
  color: "var(--lap-text-subtle)",
};

const primaryButtonStyle: React.CSSProperties = {
  minWidth: "96px",
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
  minWidth: "80px",
  border: "1px solid #dbe4ee",
  borderRadius: "999px",
  padding: "0 16px",
  height: "40px",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontWeight: 700,
  cursor: "pointer",
};

const actionButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "12px",
  border: "1px solid rgba(99, 102, 241, 0.20)",
  background: "rgba(99, 102, 241, 0.08)",
  color: "var(--lap-accent-primary)",
  padding: "10px 12px",
  fontSize: "0.86rem",
  cursor: "pointer",
};

const contextEyebrowStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "var(--lap-text-subtle)",
  fontWeight: 700,
};

const contextTitleStyle: React.CSSProperties = {
  marginTop: "2px",
  fontSize: "0.96rem",
  color: "var(--lap-text-primary)",
  fontWeight: 700,
};

const summaryToggleStyle: React.CSSProperties = {
  cursor: "pointer",
  color: "var(--lap-accent-primary)",
  fontSize: "0.82rem",
  fontWeight: 700,
};

function createMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function DevelopmentStabilityControl({
  value,
  modes,
  onChange,
}: {
  value: AssistantStabilityInjectionMode;
  modes: readonly AssistantStabilityInjectionMode[];
  onChange: (mode: AssistantStabilityInjectionMode) => void;
}) {
  return (
    <details style={devControlStyle}>
      <summary style={summaryToggleStyle}>开发验收注入</summary>
      <div style={devControlBodyStyle}>
        <label style={devControlLabelStyle}>
          <span>模式</span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value as AssistantStabilityInjectionMode)}
            style={devSelectStyle}
          >
            {modes.map((mode) => (
              <option key={mode} value={mode}>{formatStabilityMode(mode)}</option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}

function MultiAgentTaskTimeline({
  tasks,
  onCancel,
  onRetryAgent,
  onRetryTask,
}: {
  tasks: readonly AssistantMultiAgentTaskView[];
  onCancel: (taskId: string) => void;
  onRetryAgent: (taskId: string, agentName: AssistantMultiAgentTaskView["canRetryAgentNames"][number]) => void;
  onRetryTask: (taskId: string) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!tasks.some(hasActiveTask)) {
      return undefined;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  return (
    <div style={taskTimelineWrapStyle} aria-label="多步骤任务执行链">
      {tasks.map((task) => (
        <article key={task.id} style={taskCardStyle}>
          {task.finalAnswer ? (
            <section style={finalAnswerStyle}>
              <div style={taskSectionTitleStyle}>最终回答</div>
              <div style={finalAnswerTextStyle}>{task.finalAnswer}</div>
            </section>
          ) : null}

        <details key={`${task.id}-${hasActiveTask(task) ? "active" : "done"}`} open={hasActiveTask(task) ? true : undefined} style={taskDetailsStyle}>
          <summary style={taskSummaryStyle}>
            <span style={statusBadgeStyle(task.status)}>{formatTaskEntryLabel(task.status)} · {formatTaskElapsed(task, nowMs)}</span>
            <span style={taskTitleStyle}>{task.userVisibleRequest}</span>
            <span style={taskMetaInlineStyle}>
              {task.completedAgentCount}/{task.agentRuns.length || 5} 步完成 · 失败 {task.failedAgentCount}
            </span>
          </summary>

          <div style={taskBodyStyle}>
            <div style={taskMetaGridStyle}>
              <TaskMetric label="创建" value={formatDateTime(task.createdAt)} />
              <TaskMetric label="开始" value={task.startedAt ? formatDateTime(task.startedAt) : "等待中"} />
              <TaskMetric label="完成" value={task.completedAt ? formatDateTime(task.completedAt) : "未完成"} />
              <TaskMetric label="尝试" value={String(task.currentAttempt)} />
              <TaskMetric label="状态" value={task.partial ? "部分成功" : formatTaskStatus(task.status)} />
              <TaskMetric label="开发注入" value={formatStabilityMode(task.stabilityInjectionMode)} />
            </div>

            <div style={taskActionRowStyle}>
              {task.canCancel ? (
                <button type="button" onClick={() => onCancel(task.id)} style={miniDangerButtonStyle}>
                  取消任务
                </button>
              ) : null}
              {task.canRetryTask ? (
                <button type="button" onClick={() => onRetryTask(task.id)} style={miniActionButtonStyle}>
                  重试任务
                </button>
              ) : null}
            </div>

            <div style={agentGridStyle}>
              {task.agentRuns.map((run) => (
                <article key={run.id} style={agentRunStyle}>
                  <div style={agentRunTopStyle}>
                    <span style={agentStatusBadgeStyle(run.status)}>{formatAgentStatus(run.status)}</span>
                    <strong>{formatAgentName(run.agentName)}</strong>
                    <span style={agentAttemptStyle}>第 {run.attempt} 次</span>
                  </div>
                  <div style={agentRoleStyle}>{run.role}</div>
                  <div style={agentTimeStyle}>
                    {run.startedAt ? formatDateTime(run.startedAt) : "未开始"}
                    {" → "}
                    {run.completedAt ? formatDateTime(run.completedAt) : "运行中"}
                  </div>
                  {run.usedTools.length > 0 ? (
                    <div style={agentTextStyle}>工具：{run.usedTools.map(formatToolDisplayName).join(" · ")}</div>
                  ) : null}
                  {run.sourceRefs.length > 0 ? (
                    <div style={agentTextStyle}>数据来源：{run.sourceRefs.slice(0, 3).join("；")}</div>
                  ) : null}
                  {run.safeOutputSummary ? (
                    <div style={agentSummaryStyle}>{run.safeOutputSummary}</div>
                  ) : null}
                  {run.errorCode ? (
                    <div style={agentErrorStyle}>错误：{run.errorCode}</div>
                  ) : null}
                  {run.developmentInjection ? (
                    <div style={agentInjectionStyle}>{run.developmentInjection}</div>
                  ) : null}
                  {task.canRetryAgentNames.includes(run.agentName) ? (
                    <button type="button" onClick={() => onRetryAgent(task.id, run.agentName)} style={miniActionButtonStyle}>
                      重试该步骤
                    </button>
                  ) : null}
                </article>
              ))}
            </div>

            {task.evidence.length > 0 ? (
              <details style={evidenceSectionStyle}>
                <summary style={summaryToggleStyle}>本次回答依据</summary>
                <div style={evidenceGridStyle}>
                  {task.evidence.map((evidence) => (
                    <a
                      key={evidence.id}
                      href={evidence.officialUrl ?? evidence.recordId ?? "#"}
                      target={evidence.officialUrl ? "_blank" : undefined}
                      rel={evidence.officialUrl ? "noreferrer" : undefined}
                      style={evidenceCardStyle}
                    >
                      <strong>{evidence.label}</strong>
                      <span>{formatEvidenceType(evidence.type)} · {evidence.cached ? "缓存/本地" : evidence.realtime ? "实时" : "记录"}</span>
                      <span>{evidence.fetchedAt ? formatDateTime(evidence.fetchedAt) : "无更新时间"}</span>
                      <span>{evidence.usedByAgentNames.map(formatAgentName).join(" · ")}</span>
                    </a>
                  ))}
                </div>
              </details>
            ) : null}

            {task.toolResultArtifacts.length > 0 ? (
              <details style={evidenceSectionStyle}>
                <summary style={summaryToggleStyle}>工具结果摘要</summary>
                <div style={auditListStyle}>
                  {task.toolResultArtifacts.map((artifact) => (
                    <div key={artifact.artifactId} style={auditItemStyle}>
                      <strong>{formatToolDisplayName(artifact.toolName)}</strong>
                      <span>{artifact.safePreview}</span>
                      <span>{artifact.size} 字符 · {artifact.sourceRefs.length} 个来源 · {formatDateTime(artifact.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <details style={auditDetailsStyle}>
              <summary style={summaryToggleStyle}>审计事件</summary>
              <div style={auditListStyle}>
                {task.auditEvents.map((event) => (
                  <div key={event.id} style={auditItemStyle}>
                    <span>{formatDateTime(event.timestamp)}</span>
                    <strong>{formatAuditEventType(event.eventType)}</strong>
                    <span>{event.safeMessage}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </details>
        </article>
      ))}
    </div>
  );
}

function TaskMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={taskMetricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function hasActiveTasks(tasks: readonly AssistantMultiAgentTaskView[]): boolean {
  return tasks.some(hasActiveTask);
}

function hasActiveTask(task: AssistantMultiAgentTaskView): boolean {
  return task.status === "queued" || task.status === "running" || task.status === "cancel_requested";
}

function replaceTask(
  current: readonly AssistantMultiAgentTaskView[],
  task: AssistantMultiAgentTaskView,
): AssistantMultiAgentTaskView[] {
  const next = current.map((item) => item.id === task.id ? task : item);
  return next.some((item) => item.id === task.id) ? next : [task, ...next];
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `assistant-request-${crypto.randomUUID()}`;
  }
  return `assistant-request-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function formatStabilityMode(mode: AssistantStabilityInjectionMode): string {
  switch (mode) {
    case "fail_upcoming_once":
      return "让近期比赛步骤失败一次";
    case "timeout_candidate_once":
      return "让候选题步骤超时一次";
    case "delay_task_for_cancel":
      return "让任务延迟，便于取消";
    case "tool_empty_once":
      return "工具返回空结果一次";
    case "tool_internal_error_once":
      return "工具内部错误一次";
    case "tool_timeout_once":
      return "工具超时一次";
    case "tool_cancel_once":
      return "工具取消一次";
    case "tool_permission_denied_once":
      return "工具权限拒绝一次";
    case "tool_large_result_once":
      return "大型工具结果一次";
    case "tool_unknown_once":
      return "未知工具一次";
    case "tool_duplicate_once":
      return "重复工具调用一次";
    case "agent_loop_max_turns":
      return "模型轮次达到上限";
    case "agent_loop_max_tool_calls":
      return "工具调用次数达到上限";
    case "tool_calling_unsupported":
      return "不支持工具调用兼容路径";
    case "context_compression_failure":
      return "上下文压缩失败";
    case "normal":
    default:
      return "正常执行";
  }
}

function formatToolDisplayName(name: string): string {
  switch (name) {
    case "resolveLearnerTrainingProfile":
      return "解析用户真实训练水平";
    case "getPersonalizedCodeforcesCandidates":
      return "查询个性化候选题目";
    case "getUpcomingCodeforcesContests":
      return "查询近期 Codeforces 比赛";
    case "recommend_codeforces_problems":
      return "推荐 Codeforces 题目";
    case "search_codeforces_problems":
      return "搜索 Codeforces 题目";
    case "search_technical_articles":
      return "搜索技术文章";
    case "get_hot_technical_articles":
      return "读取热门技术文章";
    default:
      return name;
  }
}

function formatToolTimelineStatus(status: AssistantToolTimelineItem["status"]): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "empty":
      return "没有结果";
    case "cancelled":
      return "已取消";
    case "timed_out":
      return "已超时";
    case "permission_denied":
      return "无权限";
    case "failed":
      return "执行失败";
    case "skipped":
      return "已跳过";
  }
}

function toolTimelineStatusStyle(status: AssistantToolTimelineItem["status"]): React.CSSProperties {
  if (status === "completed") {
    return toolStatusOkStyle;
  }
  if (status === "failed" || status === "timed_out" || status === "permission_denied") {
    return toolStatusFailedStyle;
  }
  return toolStatusSkippedStyle;
}

function formatAgentName(name: string): string {
  switch (name) {
    case "Orchestrator":
      return "识别用户意图";
    case "LearnerProfile":
      return "读取学习画像";
    case "CandidateRecommendation":
      return "查询候选题目";
    case "UpcomingContest":
      return "查询近期比赛";
    case "ResultAggregator":
      return "生成中文回答";
    default:
      return name;
  }
}

function formatTaskEntryLabel(status: AssistantMultiAgentTaskView["status"]): string {
  switch (status) {
    case "queued":
    case "running":
    case "cancel_requested":
      return "处理中";
    case "succeeded":
      return "已完成";
    case "partial_success":
      return "部分完成";
    case "cancelled":
      return "已取消";
    case "failed":
    case "timed_out":
      return "处理失败";
  }
}

function formatTaskElapsed(task: AssistantMultiAgentTaskView, nowMs: number): string {
  const startedAt = parseTimeMs(task.startedAt ?? task.createdAt);
  const finishedAt = parseTimeMs(task.completedAt ?? task.cancelledAt ?? undefined);
  const endAt = finishedAt ?? (hasActiveTask(task) ? nowMs : startedAt);
  return formatElapsedMs(Math.max(0, endAt - startedAt));
}

function parseTimeMs(value?: string | null): number {
  if (!value) {
    return Date.now();
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function formatElapsedMs(valueMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function elapsedBetween(startedAt: string, completedAt: string): number {
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    return 0;
  }
  return Math.max(0, completed - started);
}

function formatDurationMs(valueMs: number): string {
  if (valueMs < 1000) {
    return `${Math.max(0, Math.trunc(valueMs))}ms`;
  }
  return `${(valueMs / 1000).toFixed(1)}s`;
}

function formatEvidenceType(type: string): string {
  switch (type) {
    case "learning_report":
      return "学习分析报告";
    case "codeforces_account_snapshot":
      return "Codeforces 账号快照";
    case "local_curated_problem_pool":
      return "本地精选题库";
    case "codeforces_contest_list":
      return "Codeforces 比赛列表";
    case "cached_contest_list":
      return "缓存比赛列表";
    case "code_analysis_record":
      return "代码分析记录";
    case "review_plan":
      return "复习计划";
    case "user_long_term_memory":
      return "用户长期记忆";
    case "assistant_task":
      return "助手任务记录";
    default:
      return "任务依据";
  }
}

function formatAuditEventType(type: string): string {
  const reliableLoopLabel = formatReliableLoopAuditEventType(type);
  if (reliableLoopLabel) {
    return reliableLoopLabel;
  }

  switch (type) {
    case "task_created":
      return "任务已创建";
    case "task_started":
      return "任务已开始";
    case "task_cancel_requested":
      return "已请求取消";
    case "task_cancelled":
      return "任务已取消";
    case "task_timed_out":
      return "任务已超时";
    case "task_completed":
      return "任务已完成";
    case "task_partial_success":
      return "部分完成";
    case "task_failed":
      return "任务失败";
    case "agent_queued":
      return "步骤已排队";
    case "agent_started":
      return "步骤已开始";
    case "agent_succeeded":
      return "步骤完成";
    case "agent_failed":
      return "步骤失败";
    case "agent_timed_out":
      return "步骤超时";
    case "agent_cancelled":
      return "步骤取消";
    case "agent_retry_requested":
      return "请求重试步骤";
    case "agent_retry_started":
      return "步骤重试开始";
    case "agent_retry_succeeded":
      return "步骤重试完成";
    case "tool_started":
      return "工具开始";
    case "tool_succeeded":
      return "工具完成";
    case "tool_empty":
      return "工具没有结果";
    case "tool_timed_out":
      return "工具超时";
    case "tool_permission_denied":
      return "工具无权限";
    case "tool_failed":
      return "工具失败";
    case "tool_cancelled":
      return "工具取消";
    case "evidence_attached":
      return "已关联依据";
    case "final_answer_created":
      return "已生成最终回答";
    case "final_answer_rebuilt":
      return "已重建最终回答";
    case "duplicate_request_reused":
      return "复用重复请求";
    case "budget_warning":
      return "预算提醒";
    case "budget_blocked":
      return "预算阻止";
    default:
      return "审计事件";
  }
}

function formatReliableLoopAuditEventType(type: string): string | null {
  switch (type) {
    case "agent_loop_started":
      return "Agent Loop started";
    case "memory_context_loaded":
      return "Memory loaded";
    case "model_request_started":
      return "Model request";
    case "model_tool_calls_received":
      return "Tool calls received";
    case "tool_call_validation_failed":
      return "Tool validation failed";
    case "tool_call_queued":
      return "Tool queued";
    case "tool_call_started":
      return "Tool started";
    case "tool_call_completed":
      return "Tool completed";
    case "tool_result_budget_applied":
      return "工具结果已摘要";
    case "tool_result_artifact_stored":
      return "大型结果已保存摘要";
    case "tool_result_appended":
      return "Tool result appended";
    case "tool_result_microcompacted":
      return "较早工具结果已压缩";
    case "context_budget_warning":
      return "上下文接近上限";
    case "context_compressed":
      return "上下文已自动整理";
    case "context_compression_failed":
      return "上下文整理失败";
    case "context_compression_paused":
      return "自动整理暂时暂停";
    case "context_blocked":
      return "上下文已阻止";
    case "model_continuation_started":
      return "Model continuation";
    case "model_final_answer_received":
      return "Final answer received";
    case "agent_loop_limit_reached":
      return "Agent Loop limit";
    case "agent_loop_cancelled":
      return "Agent Loop cancelled";
    case "agent_loop_timed_out":
      return "Agent Loop timed out";
    case "agent_loop_failed":
      return "Agent Loop failed";
    case "agent_loop_completed":
      return "Agent Loop completed";
    default:
      return null;
  }
}

function formatTaskStatus(status: AssistantMultiAgentTaskView["status"]): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "运行中";
    case "partial_success":
      return "部分成功";
    case "succeeded":
      return "成功";
    case "failed":
      return "失败";
    case "cancel_requested":
      return "取消中";
    case "cancelled":
      return "已取消";
    case "timed_out":
      return "已超时";
  }
}

function formatAgentStatus(status: AssistantMultiAgentTaskView["agentRuns"][number]["status"]): string {
  switch (status) {
    case "pending":
      return "等待";
    case "running":
      return "运行中";
    case "succeeded":
      return "完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "取消";
    case "timed_out":
      return "超时";
    case "skipped":
      return "跳过";
  }
}

function statusBadgeStyle(status: AssistantMultiAgentTaskView["status"]): React.CSSProperties {
  if (status === "succeeded") {
    return taskStatusOkStyle;
  }
  if (status === "partial_success") {
    return taskStatusPartialStyle;
  }
  if (status === "failed" || status === "timed_out" || status === "cancelled") {
    return taskStatusFailedStyle;
  }
  return taskStatusRunningStyle;
}

function agentStatusBadgeStyle(status: AssistantMultiAgentTaskView["agentRuns"][number]["status"]): React.CSSProperties {
  if (status === "succeeded") {
    return toolStatusOkStyle;
  }
  if (status === "failed" || status === "timed_out" || status === "cancelled") {
    return toolStatusFailedStyle;
  }
  return toolStatusSkippedStyle;
}
