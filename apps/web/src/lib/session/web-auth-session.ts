import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import {
  getPrismaClient,
  PrismaAuthAuditRepository,
  PrismaWebSessionRepository,
  type AuthAuditEventType,
  type UserRole,
  type WebSessionRecord,
} from "@learning-agent-platform/db";

import {
  DEV_SESSION_COOKIE_NAME,
  deserializeDevSession,
} from "../web-auth-dev-session";

export const WEB_SESSION_COOKIE_NAME = "lap_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export interface CurrentAuthSession {
  hasSession: true;
  sessionId: string;
  userId: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  expiresAt: Date;
  source: "database";
}

export interface NoAuthSession {
  hasSession: false;
  userId: null;
  email: null;
  displayName: null;
  role: null;
  source: "none" | "dev-only";
  reason: "no_cookie" | "invalid" | "expired" | "revoked" | "disabled" | "dev_only";
}

export type AuthSessionResult = CurrentAuthSession | NoAuthSession;

export class AuthenticationRequiredError extends Error {
  readonly code = "auth_required";

  constructor(message = "请先登录。") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationRequiredError extends Error {
  readonly code = "permission_denied";

  constructor(message = "当前账号没有权限执行此操作。") {
    super(message);
    this.name = "AuthorizationRequiredError";
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createDatabaseSessionForUser(userId: string): Promise<{
  rawToken: string;
  session: WebSessionRecord;
}> {
  const rawToken = createSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const repository = new PrismaWebSessionRepository(getPrismaClient());
  const session = await repository.createSession({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    userAgentHash: await getSourceHash("user-agent"),
    ipHash: await getSourceHash("x-forwarded-for"),
  });
  await recordAuthAuditEvent({
    userId,
    eventType: "auth_session_created",
    result: "success",
  });
  return { rawToken, session };
}

export async function setWebSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WEB_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearWebSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WEB_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentAuthSession(): Promise<AuthSessionResult> {
  const rawToken = await readSessionCookieValue();
  if (!rawToken) {
    return readExplicitDevSessionOnly();
  }

  const tokenHash = hashSessionToken(rawToken);
  try {
    const repository = new PrismaWebSessionRepository(getPrismaClient());
    const session = await repository.findActiveSessionByTokenHash(tokenHash);
    if (!session) {
      await recordAuthAuditEvent({
        eventType: "auth_session_expired",
        result: "failure",
        errorCode: "session_not_active",
      });
      return {
        hasSession: false,
        userId: null,
        email: null,
        displayName: null,
        role: null,
        source: "none",
        reason: "expired",
      };
    }

    if (!session.user || session.user.disabledAt !== null) {
      await recordAuthAuditEvent({
        userId: session.userId,
        eventType: "auth_access_denied",
        result: "blocked",
        errorCode: "user_disabled",
      });
      return {
        hasSession: false,
        userId: null,
        email: null,
        displayName: null,
        role: null,
        source: "none",
        reason: "disabled",
      };
    }

    if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      void repository.touchSession(session.id).catch(() => undefined);
    }

    return {
      hasSession: true,
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      displayName: session.user.name ?? session.user.email ?? "学习者",
      role: session.user.role,
      expiresAt: session.expiresAt,
      source: "database",
    };
  } catch {
    return {
      hasSession: false,
      userId: null,
      email: null,
      displayName: null,
      role: null,
      source: "none",
      reason: "invalid",
    };
  }
}

export async function requireAuthenticatedUser(): Promise<CurrentAuthSession> {
  const session = await getCurrentAuthSession();
  if (!session.hasSession) {
    await recordAuthAuditEvent({
      eventType: "auth_access_denied",
      result: "blocked",
      errorCode: session.reason,
    });
    throw new AuthenticationRequiredError();
  }
  return session;
}

export async function requireAdminUser(): Promise<CurrentAuthSession> {
  const session = await requireAuthenticatedUser();
  if (session.role !== "ADMIN") {
    await recordAuthAuditEvent({
      userId: session.userId,
      eventType: "auth_admin_access_denied",
      result: "blocked",
      errorCode: "not_admin",
    });
    throw new AuthorizationRequiredError("当前账号没有管理员权限。");
  }
  return session;
}

export async function revokeCurrentSession(): Promise<boolean> {
  const rawToken = await readSessionCookieValue();
  if (!rawToken) {
    await clearWebSessionCookie();
    return false;
  }
  const tokenHash = hashSessionToken(rawToken);
  try {
    const repository = new PrismaWebSessionRepository(getPrismaClient());
    const revoked = await repository.revokeSessionByTokenHash(tokenHash);
    await recordAuthAuditEvent({
      userId: revoked?.userId ?? null,
      eventType: "auth_logout",
      result: "success",
    });
    await recordAuthAuditEvent({
      userId: revoked?.userId ?? null,
      eventType: "auth_session_revoked",
      result: "success",
    });
    return revoked !== null;
  } catch {
    await recordAuthAuditEvent({
      eventType: "auth_logout",
      result: "failure",
      errorCode: "session_revoke_failed",
    });
    return false;
  } finally {
    await clearWebSessionCookie();
  }
}

export async function recordAuthAuditEvent(input: {
  userId?: string | null;
  eventType: AuthAuditEventType;
  result: "success" | "failure" | "blocked";
  errorCode?: string | null;
}): Promise<void> {
  try {
    const repository = new PrismaAuthAuditRepository(getPrismaClient());
    await repository.recordEvent({
      userId: input.userId ?? null,
      eventType: input.eventType,
      sourceSummary: await getSafeSourceSummary(),
      result: input.result,
      errorCode: input.errorCode ?? null,
    });
  } catch {
    // Audit is best-effort and must not leak or block auth flows.
  }
}

async function readSessionCookieValue(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
    return typeof value === "string" && value.trim().length >= 32 ? value : null;
  } catch {
    return null;
  }
}

async function readExplicitDevSessionOnly(): Promise<NoAuthSession> {
  if (process.env.NODE_ENV === "production" || process.env.LAP_AUTH_DEV_MODE !== "1") {
    return {
      hasSession: false,
      userId: null,
      email: null,
      displayName: null,
      role: null,
      source: "none",
      reason: "no_cookie",
    };
  }

  try {
    const cookieStore = await cookies();
    const payload = deserializeDevSession(cookieStore.get(DEV_SESSION_COOKIE_NAME)?.value);
    if (payload) {
      return {
        hasSession: false,
        userId: null,
        email: null,
        displayName: null,
        role: null,
        source: "dev-only",
        reason: "dev_only",
      };
    }
  } catch {
    // ignored
  }

  return {
    hasSession: false,
    userId: null,
    email: null,
    displayName: null,
    role: null,
    source: "none",
    reason: "no_cookie",
  };
}

async function getSafeSourceSummary(): Promise<string | null> {
  const ua = await getHeaderValue("user-agent");
  if (!ua) return null;
  return `ua:${hashText(ua).slice(0, 12)}`;
}

async function getSourceHash(headerName: string): Promise<string | null> {
  const value = await getHeaderValue(headerName);
  return value ? hashText(value) : null;
}

async function getHeaderValue(name: string): Promise<string | null> {
  try {
    const headerStore = await headers();
    const value = headerStore.get(name);
    return value && value.trim().length > 0 ? value.trim().slice(0, 256) : null;
  } catch {
    return null;
  }
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
