"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { runAssistantAction } from "../../lib/assistant/assistant-server-actions.ts";
import type {
  AssistantLearningContextSummary,
  AssistantSource,
} from "../../lib/assistant/assistant-types.ts";
import { loadRecentReadings } from "../../lib/local-user-library-store.ts";
import { loadRecentPractice } from "../../lib/local-user-problem-store.ts";
import {
  getRecentArticleReadings,
  loadRecentArticleReadings,
} from "../../lib/local-user-article-store.ts";
import { useAssistantConversation, type AssistantChatMessage } from "./AssistantConversationStore.tsx";
import { useAssistantPageContext } from "./AssistantPageContextProvider.tsx";

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
  } = useAssistantConversation();

  const contextLabel = useMemo(() => {
    const pieces = [pageContext.pageType, pageContext.title].filter(Boolean);
    return pieces.join(" / ");
  }, [pageContext.pageType, pageContext.title]);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isSubmitting, status, providerMode, error]);

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
    const conversationMessages = [...messages, userMessage].slice(-20);
    setMessages(conversationMessages);
    setDraftQuestion("");

    try {
      const localLearningContext = buildLocalLearningContext();
      const result = await runAssistantAction({
        question: trimmed,
        pageContext,
        learningContext: localLearningContext,
        conversation: {
          conversationId,
          messages: conversationMessages,
          draftQuestion: "",
        },
      });

      setStatus(result.state);
      setProviderMode(result.providerMode);

      const assistantMessage: AssistantChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: result.message,
        createdAt: new Date().toISOString(),
        actions: result.actions,
        sources: result.sources,
        usedTools: result.usedTools,
        state: result.state,
        providerMode: result.providerMode,
      };
      setMessages((prev) => [...prev, assistantMessage].slice(-20));
    } catch (err: unknown) {
      setStatus("error");
      setProviderMode("error");
      setError(err instanceof Error ? err.message : "AI 请求失败。");
    } finally {
      setIsSubmitting(false);
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
            当前页面上下文
          </p>
          <h2 style={{ margin: "4px 0 0", fontSize: compact ? "1.05rem" : "1.2rem" }}>
            {contextLabel || pageContext.route}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--lap-text-muted)" }}>
            只使用页面上下文、学习摘要和可管理记忆，不暴露原始 DOM、token 或 prompt。
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
          <span style={chipStyle}>{pageContext.pageType}</span>
          {mounted && providerMode ? <span style={chipStyle}>{providerMode}</span> : null}
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
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              width: "100%",
            }}
          >
            <div
              style={{
                maxWidth: "100%",
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                background: message.role === "user" ? "rgba(99, 102, 241, 0.10)" : "#ffffff",
                border: message.role === "user" ? "1px solid rgba(99, 102, 241, 0.20)" : "1px solid #e5e7eb",
                borderRadius: "14px",
                padding: "12px 14px",
                boxShadow: message.role === "assistant" ? "0 4px 16px rgba(15, 23, 42, 0.04)" : "none",
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--lap-text-subtle)", marginBottom: "6px" }}>
                {message.role === "user" ? "你" : "AI"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.93rem" }}>
                {message.content}
              </div>
            </div>

            {message.usedTools && message.usedTools.length > 0 ? (
              <div style={metaRowStyle}>
                <span style={metaLabelStyle}>Tools</span>
                <span style={metaTextStyle}>{message.usedTools.join(" · ")}</span>
              </div>
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
            正在处理当前页面上下文和学习摘要...
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

function createMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildLocalLearningContext(): AssistantLearningContextSummary {
  const recentPractice = loadRecentPractice();
  const bookReadings = loadRecentReadings();
  const articleReadings = getRecentArticleReadings(loadRecentArticleReadings(), 5);
  const recentProblemIds = recentPractice
    .map((entry) => entry.problemId)
    .filter((problemId) => problemId.trim().length > 0)
    .slice(0, 5);
  const latest = recentPractice[0];

  return {
    userLabel: undefined,
    hasSession: false,
    abilityBand: undefined,
    currentLevel: undefined,
    recentPracticeCount: recentPractice.length,
    recentProblemIds,
    recentAttemptSummary: latest
      ? `本地最近刷题 ${recentPractice.length} 题，最近一题是 ${latest.title}。`
      : "本地暂无最近刷题记录。",
    recentWrongBookSummary: "",
    recentReadingSummary: buildRecentReadingSummary(bookReadings, articleReadings),
    learningGoalSummary: recentPractice.length > 0
      ? "可直接跳转到最近刷过的题目或继续推荐题单。"
      : "",
    recentRouteHint: latest ? `/problems/${latest.problemId}` : undefined,
  };
}

function buildRecentReadingSummary(
  bookReadings: Array<{ bookTitle: string; chapterTitle: string }>,
  articleReadings: Array<{ title: string; sourceName: string }>,
): string {
  const pieces: string[] = [];

  if (articleReadings.length > 0) {
    const latestArticle = articleReadings[0];
    pieces.push(`最近阅读 ${articleReadings.length} 篇文章，最近一篇是《${latestArticle.title}》`);
  }

  if (bookReadings.length > 0) {
    const latestBook = bookReadings[0];
    pieces.push(`最近阅读 ${bookReadings.length} 个章节，最近一项是《${latestBook.bookTitle} / ${latestBook.chapterTitle}》`);
  }

  return pieces.join("；");
}
