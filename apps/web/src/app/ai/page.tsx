import { AssistantConversationProvider } from "../_components/AssistantConversationStore";
import { MetricPill, PageHero } from "../_components/UserUiComponents";
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";
import { AiAssistantTabs } from "./AiAssistantTabs";

export default async function AiAssistantPage() {
  const session = await getCurrentAuthSession();
  const hasSession = session.hasSession;
  const displayName = session.hasSession ? session.displayName : null;

  return (
    <main className="learningPage">
      <PageHero
        eyebrow="AI 学习教练"
        title={hasSession ? (displayName ? `${displayName} 的 AI 助手` : "AI 助手") : "AI 助手"}
        subtitle="最终回答是主体；会话、模型、长期记忆和执行过程都收束为辅助入口，避免把学习体验做成调试控制台。"
      >
        <MetricPill label="回答主体" value="优先" status="success" />
        <MetricPill label="执行链" value="折叠" status="muted" />
        <MetricPill label="长期记忆" value={hasSession ? "可管理" : "需登录"} status={hasSession ? "info" : "warning"} />
      </PageHero>

      <AssistantConversationProvider>
        <AiAssistantTabs hasSession={hasSession} displayName={displayName} />
      </AssistantConversationProvider>
    </main>
  );
}
