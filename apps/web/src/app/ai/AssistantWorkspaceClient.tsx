"use client";

import type { CSSProperties } from "react";

import { AssistantChatPanel } from "../_components/AssistantChatPanel.tsx";
import { DataStatePanel, PageSection, PreviewNotice } from "../_components/UserUiComponents.tsx";
import { AssistantMemoryManager } from "./AssistantMemoryManager.tsx";
import { AssistantMemoryOverviewPanel } from "./AssistantMemoryOverviewPanel.tsx";

export function AssistantWorkspaceClient({
  hasSession,
  displayName,
}: {
  hasSession: boolean;
  displayName?: string | null;
}) {
  return (
    <div style={workspaceShellStyle}>
      <PageSection
        eyebrow="AI 助手"
        title="Web 端真实助手核心"
        note="共享同一套安全边界、长期记忆管理和站内导航校验。"
      >
        <DataStatePanel
          variant={hasSession ? "info" : "empty"}
          message={hasSession ? `当前会话：${displayName ?? "已登录"}` : "未登录会话"}
          description={
            hasSession
              ? "可以结合当前页面和可管理记忆进行问答。"
              : "未登录时仍可提问，但不会读取服务端记忆。"
          }
        />
      </PageSection>

      <PageSection
        eyebrow="工作区"
        title="聊天与记忆概览"
        note="左侧是会话输入和回答，右侧是长期记忆概览。"
      >
        <div style={workspaceGridStyle}>
          <section style={chatShellStyle} aria-label="assistant chat shell">
            <AssistantChatPanel compact />
          </section>
          <AssistantMemoryOverviewPanel hasSession={hasSession} />
        </div>
      </PageSection>

      <PageSection
        eyebrow="记忆"
        title="手动记忆管理"
        note="这里保留用户自己添加、启用、禁用和删除的短文本记忆。"
      >
        <AssistantMemoryManager hasSession={hasSession} />
      </PageSection>

      <PreviewNotice
        identifiers={[
          "real-orchestrator",
          "page-aware-chat",
          "long-term-memory",
          "memory-management",
          "internal-navigation",
          "no-raw-model-data",
          "no-raw-response",
        ]}
        message="AI 助手核心"
      />
    </div>
  );
}

const workspaceShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const workspaceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
  gap: "18px",
  alignItems: "stretch",
};

const chatShellStyle: CSSProperties = {
  height: "min(78vh, 760px)",
  minHeight: "640px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
