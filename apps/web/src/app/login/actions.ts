"use server";

/**
 * Server actions for dev auth login/logout.
 *
 * Handles httpOnly cookie creation and deletion using Next.js cookies().
 * Only works when dev auth guard is enabled.
 */

import { cookies } from "next/headers";
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";
import {
  createDevSessionFromPreset,
  serializeDevSession,
  DEV_SESSION_COOKIE_NAME,
} from "../../lib/web-auth-dev-session";

export interface DevLoginActionResult {
  success: boolean;
  message: string;
  redirectUrl?: string;
}

/**
 * Attempt a dev login with a preset dev user key.
 *
 * Only succeeds when LAP_WEB_AUTH_DEV_ENABLED=true.
 * Creates an httpOnly session cookie with safe dev session data.
 */
export async function devLoginAction(
  devUserKey: string,
): Promise<DevLoginActionResult> {
  const guard = getDevAuthGuardStatus();

  if (!guard.enabled) {
    return {
      success: false,
      message:
        "开发登录未启用。请在 .env 中设置 LAP_WEB_AUTH_DEV_ENABLED=true。",
    };
  }

  const session = createDevSessionFromPreset(devUserKey);
  if (!session) {
    return {
      success: false,
      message: `未知的开发用户: ${devUserKey}`,
    };
  }

  try {
    const cookieStore = await cookies();
    const serialized = serializeDevSession(session);

    cookieStore.set(DEV_SESSION_COOKIE_NAME, serialized, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return {
      success: true,
      message: `已以 ${session.displayName} 身份登录（开发会话）。`,
      redirectUrl: "/user",
    };
  } catch (err) {
    return {
      success: false,
      message: `Cookie 设置失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}

/**
 * Clear the dev session cookie (logout).
 */
export async function devLogoutAction(): Promise<DevLoginActionResult> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(DEV_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return {
      success: true,
      message: "已退出开发会话。",
      redirectUrl: "/user",
    };
  } catch (err) {
    return {
      success: false,
      message: `退出失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}

/**
 * Read current dev session from cookie (for server components).
 * Returns null if no valid session found.
 */
export async function getDevSessionFromCookie(): Promise<{
  hasSession: boolean;
  userIdPreview: string | null;
  displayName: string | null;
  role: string | null;
  sessionMode: string | null;
  createdAt: string | null;
} | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(DEV_SESSION_COOKIE_NAME)?.value;

    if (!raw) return null;

    const { deserializeDevSession } = await import(
      "../../lib/web-auth-dev-session"
    );
    const payload = deserializeDevSession(raw);

    if (!payload) return null;

    return {
      hasSession: true,
      userIdPreview: payload.userIdPreview,
      displayName: payload.displayName,
      role: payload.role,
      sessionMode: payload.sessionMode,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}
