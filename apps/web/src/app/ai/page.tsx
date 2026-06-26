import { cookies } from "next/headers";
import {
  deserializeDevSession,
  getSafeSessionSummary,
} from "../../lib/web-auth-dev-session.ts";
import { AssistantConversationProvider } from "../_components/AssistantConversationStore";
import { AiAssistantTabs } from "./AiAssistantTabs";

export default async function AiAssistantPage() {
  let hasSession = false;
  let displayName: string | null = null;

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    const summary = getSafeSessionSummary(payload);
    hasSession = summary.hasSession;
    displayName = summary.user?.displayName ?? null;
  } catch {
    hasSession = false;
  }

  return (
    <main className="learningPage">
      <div style={{ padding: "24px 16px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            AI 助手
          </p>
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "4px 0", color: "#111827" }}>
            {hasSession ? (displayName ? `${displayName} 的 AI 助手` : "AI 助手") : "AI 助手"}
          </h2>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
            对话、模型配置与记忆管理
          </p>
        </div>

        <AssistantConversationProvider>
          <AiAssistantTabs hasSession={hasSession} displayName={displayName} />
        </AssistantConversationProvider>
      </div>
    </main>
  );
}
