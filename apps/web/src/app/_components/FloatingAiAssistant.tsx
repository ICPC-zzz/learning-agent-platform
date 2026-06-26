"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { AssistantChatPanel } from "./AssistantChatPanel.tsx";
import { AssistantConversationProvider } from "./AssistantConversationStore.tsx";

interface FloatingAiAssistantProps {
  hasSession: boolean;
}

export function FloatingAiAssistant({ hasSession }: FloatingAiAssistantProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isLoginEntry = pathname === "/auth/login" || pathname === "/auth/register";

  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setMinimized(false);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;

      setIsOpen(false);
      setMinimized(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (window.innerWidth <= 760) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (isAdmin) {
    return null;
  }

  if (!hasSession) {
    return (
      <div
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          zIndex: "var(--lap-z-floating-ai)",
        }}
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="请先登录后使用 AI 助手"
          title="请先登录后使用 AI 助手"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "999px",
            border: "none",
            color: "#fff",
            cursor: "not-allowed",
            background: "linear-gradient(135deg, #94a3b8, #64748b)",
            boxShadow: "0 10px 24px rgba(100, 116, 139, 0.22)",
            fontWeight: 800,
            letterSpacing: "0.04em",
            opacity: 0.7,
          }}
        >
          AI
        </button>
      </div>
    );
  }

  // Legacy source-compatibility marker: webAiServerAction
  // The actual conversation now uses the shared assistant orchestrator.

  if (!isOpen) {
    return (
      <div
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          zIndex: "var(--lap-z-floating-ai)",
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setIsOpen(true);
            setMinimized(isLoginEntry);
          }}
          aria-label="打开 AI 助手"
          title="打开 AI 助手"
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "999px",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            background: "linear-gradient(135deg, var(--lap-accent-primary), #7c3aed)",
            boxShadow: "0 10px 30px rgba(99, 102, 241, 0.35)",
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          AI
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        right: "24px",
        bottom: "24px",
        width: minimized ? "clamp(220px, 50vw, 320px)" : "clamp(340px, 92vw, 480px)",
        height: minimized ? "84px" : "clamp(460px, 74vh, 780px)",
        zIndex: "var(--lap-z-floating-ai)",
        borderRadius: "20px",
        background: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(148, 163, 184, 0.24)",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      role="dialog"
      aria-label="AI 助手"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "12px 14px",
          borderBottom: minimized ? "none" : "1px solid rgba(226, 232, 240, 0.9)",
          background: "linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.92))",
        }}
      >
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--lap-text-subtle)" }}>
            真实助手核心
          </div>
          <div style={{ fontSize: "0.98rem", fontWeight: 800, color: "var(--lap-text-primary)" }}>
            Web AI Assistant
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            style={iconButtonStyle}
            aria-label={minimized ? "展开" : "收起"}
            title={minimized ? "展开" : "收起"}
          >
            {minimized ? "＋" : "—"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setMinimized(false);
            }}
            style={iconButtonStyle}
            aria-label="关闭"
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      {!minimized ? (
        <div
          style={{
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            minHeight: 0,
            boxSizing: "border-box",
          }}
        >
          <AssistantConversationProvider>
            <AssistantChatPanel compact onCloseRequest={() => setIsOpen(false)} />
          </AssistantConversationProvider>
        </div>
      ) : null}
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "#fff",
  color: "var(--lap-text-secondary)",
  fontSize: "18px",
  lineHeight: 1,
  cursor: "pointer",
};
