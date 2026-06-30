import {
  getCurrentAuthSession,
  type AuthSessionResult,
} from "../session/web-auth-session";

export interface AssistantSessionSummary {
  hasSession: boolean;
  userId: string | null;
  displayName: string | null;
  role: string | null;
  safeSummary: {
    hasSession: boolean;
    user: {
      userIdPreview: string;
      email?: string;
      displayName: string;
      role: string;
    } | null;
    sessionMode: "database" | null;
    productionReady: boolean;
    status: string;
    notice: string;
  };
}

export async function readAssistantSession(): Promise<AssistantSessionSummary> {
  const session = await getCurrentAuthSession();
  return mapAuthSessionToAssistantSession(session);
}

function mapAuthSessionToAssistantSession(session: AuthSessionResult): AssistantSessionSummary {
  if (!session.hasSession) {
    return {
      hasSession: false,
      userId: null,
      displayName: null,
      role: null,
      safeSummary: {
        hasSession: false,
        user: null,
        sessionMode: null,
        productionReady: true,
        status: "未登录",
        notice: "当前未登录。请先使用邮箱验证码登录。",
      },
    };
  }

  return {
    hasSession: true,
    userId: session.userId,
    displayName: session.displayName,
    role: session.role,
    safeSummary: {
      hasSession: true,
      user: {
        userIdPreview: session.userId,
        ...(session.email ? { email: session.email } : {}),
        displayName: session.displayName,
        role: session.role === "ADMIN" ? "管理员" : "学习者",
      },
      sessionMode: "database",
      productionReady: true,
      status: "已登录",
      notice: "当前使用正式数据库会话，用户数据按真实 User.id 隔离。",
    },
  };
}
