import {
  AuthorizationRequiredError,
  getCurrentAuthSession,
  requireAdminUser,
} from "../session/web-auth-session";

export interface AdminAuthorizationResult {
  ok: boolean;
  userId: string | null;
  email: string | null;
  reason: "admin" | "no_session" | "not_admin";
}

export class AdminAuthorizationError extends Error {
  readonly code = "admin_permission_denied";

  constructor(message = "当前账号没有管理员权限。") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export async function isCurrentUserAdmin(): Promise<AdminAuthorizationResult> {
  const session = await getCurrentAuthSession();
  if (!session.hasSession) {
    return {
      ok: false,
      userId: null,
      email: null,
      reason: "no_session",
    };
  }

  return {
    ok: session.role === "ADMIN",
    userId: session.userId,
    email: session.email,
    reason: session.role === "ADMIN" ? "admin" : "not_admin",
  };
}

export async function requireAdmin(): Promise<AdminAuthorizationResult> {
  try {
    const session = await requireAdminUser();
    return {
      ok: true,
      userId: session.userId,
      email: session.email,
      reason: "admin",
    };
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      throw new AdminAuthorizationError();
    }
    throw error;
  }
}

export function toAdminActionDeniedResult() {
  return {
    success: false,
    message: "当前账号没有管理员权限，操作已拒绝。",
    errors: ["permission_denied"],
  };
}
