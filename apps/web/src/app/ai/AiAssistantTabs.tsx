"use client";

import { useState, useCallback } from "react";
import { AssistantChatPanel } from "../_components/AssistantChatPanel.tsx";
import { AssistantMemoryManager } from "./AssistantMemoryManager.tsx";
import { AssistantMemoryOverviewPanel } from "./AssistantMemoryOverviewPanel.tsx";
import { AssistantConversationManager } from "./AssistantConversationManager.tsx";
import { ModelConfigPanel } from "../agent/models/page";
import { CodeAnalysisPanel, type CodeAnalysisFormData } from "./CodeAnalysisPanel.tsx";
import { CodeAnalysisReportView } from "./CodeAnalysisReport.tsx";
import { A492PersonalizedReportView } from "./A492PersonalizedReport.tsx";
import { runCodeAnalysisAction } from "./code-analysis-actions.ts";
import { getServerActionRecoveryMessage } from "./server-action-recovery.ts";
import type { CodeAnalysisResult } from "@learning-agent-platform/ai-core/code-analysis/types";
import type { A492PersonalizedResult } from "@learning-agent-platform/ai-core/code-analysis/a492-types";
import { AnalysisHistoryPanel } from "./AnalysisHistoryPanel.tsx";
import { AnalysisProgressBar } from "./AnalysisProgressBar.tsx";

type TabId = "chat" | "models" | "memory" | "conversations";
type ChatMode = "conversation" | "code_analysis";

const TABS: { id: TabId; label: string }[] = [
  { id: "chat", label: "对话" },
  { id: "conversations", label: "对话管理" },
  { id: "models", label: "模型管理" },
  { id: "memory", label: "记忆管理" },
];

export function AiAssistantTabs({
  hasSession,
  displayName,
}: {
  hasSession: boolean;
  displayName?: string | null;
}) {
  const [tab, setTab] = useState<TabId>("chat");

  return (
    <div>
      {/* Tab Bar */}
      <div className="a519-tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "chat" && <ChatTab hasSession={hasSession} displayName={displayName} />}
      {tab === "conversations" && <AssistantConversationManager hasSession={hasSession} />}
      {tab === "models" && <ModelConfigPanel compact />}
      {tab === "memory" && <MemoryTab hasSession={hasSession} />}
    </div>
  );
}

function ChatTab({
  hasSession,
  displayName,
}: {
  hasSession: boolean;
  displayName?: string | null;
}) {
  const [mode, setMode] = useState<ChatMode>("conversation");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisRunId, setAnalysisRunId] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<CodeAnalysisResult | A492PersonalizedResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleCodeAnalysis = useCallback(async (data: CodeAnalysisFormData) => {
    setIsSubmitting(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    const runId = "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5);
    setAnalysisRunId(runId);

    try {
      const result = await runCodeAnalysisAction({
        problemStatement: data.problemStatement,
        sourceCode: data.sourceCode,
        selectedLanguage: data.selectedLanguage,
        errorInfo: data.errorInfo || undefined,
        testInput: data.testInput || undefined,
        actualOutput: data.actualOutput || undefined,
        expectedOutput: data.expectedOutput || undefined,
        failedCases: data.failedCases || undefined,
        userProvidedRating: data.problemRating.trim() ? parseInt(data.problemRating, 10) : undefined,
        userProvidedTags: data.problemTags.length > 0 ? data.problemTags : undefined,
        enableCfProfile: data.enableCfProfile,
        refreshCfData: data.refreshCfData,
        recommendFollowUp: data.recommendFollowUp,
        _runId: runId,
      });
      setAnalysisResult(result);
    } catch (err: unknown) {
      const recoveryMessage = getServerActionRecoveryMessage(err);
      if (recoveryMessage) {
        setAnalysisError(recoveryMessage);
        window.setTimeout(() => window.location.reload(), 300);
      } else {
        setAnalysisError(err instanceof Error ? err.message : "代码分析请求失败");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  /** Check if the result is an A492 personalized result */
  const isA492Result = (r: CodeAnalysisResult | A492PersonalizedResult): r is A492PersonalizedResult => {
    return r.success && r.report !== null && "problemProfile" in r.report;
  };

  return (
    <div>
      {/* Session status bar */}
      <div style={{
        padding: "10px 14px",
        background: hasSession ? "#eef8f0" : "#fff8e6",
        border: `1px solid ${hasSession ? "#cfe0ce" : "#f1dfaa"}`,
        borderRadius: "8px",
        marginBottom: "16px",
        fontSize: "13px",
        color: hasSession ? "#0f6b48" : "#9a5b12",
      }}>
        {hasSession
          ? `已登录${displayName ? ` · ${displayName}` : ""} — 助手可结合当前页面和长期记忆进行问答`
          : "未登录 — 仍可提问，但不会读取服务端长期记忆"}
      </div>

      {/* Mode Switch */}
      <div className="a519-tabbar">
        {([
          { id: "conversation" as const, label: "普通对话" },
          { id: "code_analysis" as const, label: "代码分析" },
        ]).map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); handleReset(); }}
            aria-selected={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "conversation" ? (
        <div className="a519-ai-grid">
          <section style={{
            height: "min(78vh, 760px)",
            minHeight: "640px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }} aria-label="assistant chat shell">
            <AssistantChatPanel compact />
          </section>
          <AssistantMemoryOverviewPanel hasSession={hasSession} />
        </div>
      ) : (
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}>
          {/* Not logged in warning */}
          {!hasSession && (
            <div style={{
              padding: "12px 16px",
              background: "#fefce8",
              border: "1px solid #fef08a",
              borderRadius: "8px",
              marginBottom: "16px",
              color: "#92400e",
              fontSize: "0.85rem",
            }}>
              未登录状态下无法使用代码分析功能，请先登录。
            </div>
          )}

          {/* Analysis in progress hint + progress bar */}
          {isSubmitting && (
            <AnalysisProgressBar
              isRunning={isSubmitting}
              runId={analysisRunId}
            />
          )}

          {analysisError && (
            <div style={{
              padding: "12px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              marginBottom: "16px",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}>
              {analysisError}
            </div>
          )}

          {/* Show report or input form */}
          {analysisResult ? (
            <div style={{
              marginBottom: "20px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
              fontSize: "0.82rem",
            }}>
              当前为单轮分析，结果尚未保存到历史记录。
            </div>
          ) : null}

          {analysisResult ? (
            isA492Result(analysisResult) ? (
              <A492PersonalizedReportView result={analysisResult} onReset={handleReset} />
            ) : (
              <CodeAnalysisReportView result={analysisResult} onReset={handleReset} />
            )
          ) : (
            <CodeAnalysisPanel onSubmit={handleCodeAnalysis} isSubmitting={isSubmitting} hasCfBinding={true} />
          )}

          {/* Analysis History */}
          <div style={{ marginTop: "28px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
            <AnalysisHistoryPanel />
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryTab({ hasSession }: { hasSession: boolean }) {
  return (
    <div>
      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
        这里只管理长期记忆。你可以添加、启用、禁用或删除自己的短文本记忆。
      </p>
      <AssistantMemoryManager hasSession={hasSession} />
    </div>
  );
}
