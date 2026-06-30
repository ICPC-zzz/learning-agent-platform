/**
 * Web Auth Dev Session — minimal dev/test-only session helper.
 *
 * Creates, validates, and clears dev sessions. The session is stored
 * as an httpOnly cookie by Next.js server actions; this module provides
 * pure functions for working with session data.
 *
 * Session fields only contain safe summary info — no tokens, no secrets,
 * no raw cookies, no real passwords.
 *
 * Designation: **开发预览 · dev-only · 未接生产认证 · 不写DB**
 *
 * @module web-auth-dev-session
 * @previewOnly — dev/test-only, not production session management
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DevSessionMode = "dev-only";

export interface DevSessionRole {
  role: string;
}

export interface DevSessionUser {
  /** Safe preview of user identity (never a real DB primary key). */
  userIdPreview: string;
  /** Optional trusted email set only by server-side email OTP login. */
  email?: string;
  /** Display name for UI. */
  displayName: string;
  /** Role label (e.g., "开发用户"). */
  role: string;
}

export interface DevSessionData extends DevSessionUser {
  /** Always "dev-only". */
  sessionMode: DevSessionMode;
  /** ISO timestamp when session was created. */
  createdAt: string;
}

/** Safe summary exposed to UI — never includes raw cookie or token. */
export interface DevSessionSafeSummary {
  /** Whether a valid dev session exists. */
  hasSession: boolean;
  /** Session user data (null when no session). */
  user: DevSessionUser | null;
  /** Session mode (null when no session). */
  sessionMode: DevSessionMode | null;
  /** Guard status indicator. */
  productionReady: false;
  /** Descriptive status string. */
  status: string;
  /** Notice for UI display. */
  notice: string;
}

/** What gets serialized into the cookie. */
export interface DevSessionCookiePayload {
  userIdPreview: string;
  email?: string;
  displayName: string;
  role: string;
  sessionMode: DevSessionMode;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEV_SESSION_COOKIE_NAME = "lap-web-dev-session";

const DEFAULT_DEV_USERS: Record<string, DevSessionUser> = {
  dev1: {
    userIdPreview: "dev-user-001",
    displayName: "开发用户 Alpha",
    role: "开发用户",
  },
  dev2: {
    userIdPreview: "dev-user-002",
    displayName: "开发用户 Beta",
    role: "开发用户",
  },
  dev3: {
    userIdPreview: "dev-user-003",
    displayName: "开发测试用户",
    role: "开发用户",
  },
};

// ---------------------------------------------------------------------------
// Pure session creation / validation
// ---------------------------------------------------------------------------

/**
 * Create a new dev session data object.
 *
 * @param userIdPreview - Safe preview ID (NOT a real DB ID)
 * @param displayName - Display name
 * @param role - Role label
 * @returns DevSessionData with current timestamp
 */
export function createDevSessionData(
  userIdPreview: string,
  displayName: string,
  role: string,
  email?: string,
): DevSessionData {
  return {
    userIdPreview,
    ...(email ? { email: normalizeEmail(email) } : {}),
    displayName,
    role,
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create session data from a predefined dev user key.
 *
 * @param devUserKey - Key in DEFAULT_DEV_USERS (e.g., "dev1", "dev2", "dev3")
 * @returns DevSessionData or null if key not found
 */
export function createDevSessionFromPreset(
  devUserKey: string,
): DevSessionData | null {
  const user = DEFAULT_DEV_USERS[devUserKey];
  if (!user) return null;
  return createDevSessionData(user.userIdPreview, user.displayName, user.role);
}

/**
 * Validate that an object looks like a valid DevSessionCookiePayload.
 * Rejects any sensitive fields.
 */
export function isValidDevSessionPayload(
  payload: unknown,
): payload is DevSessionCookiePayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;

  if (typeof p.userIdPreview !== "string" || p.userIdPreview.length === 0) return false;
  if (p.email !== undefined && !isValidEmail(p.email)) return false;
  if (typeof p.displayName !== "string" || p.displayName.length === 0) return false;
  if (typeof p.role !== "string" || p.role.length === 0) return false;
  if (p.sessionMode !== "dev-only") return false;
  if (typeof p.createdAt !== "string" || p.createdAt.length === 0) return false;

  // Safety: reject forbidden fields
  if (hasSensitivePayloadFields(p)) return false;

  // Must have exactly the expected keys (no extras)
  const allowedKeys = [
    "userIdPreview", "email", "displayName", "role", "sessionMode", "createdAt",
  ];
  const actualKeys = Object.keys(p);
  for (const key of actualKeys) {
    if (!allowedKeys.includes(key)) return false;
  }

  const requiredKeys = ["userIdPreview", "displayName", "role", "sessionMode", "createdAt"];
  for (const key of requiredKeys) {
    if (!actualKeys.includes(key)) return false;
  }

  return true;
}

/** Convert a session payload to DevSessionData. */
export function payloadToSessionData(
  payload: DevSessionCookiePayload,
): DevSessionData {
  return {
    userIdPreview: payload.userIdPreview,
    ...(payload.email ? { email: payload.email } : {}),
    displayName: payload.displayName,
    role: payload.role,
    sessionMode: payload.sessionMode,
    createdAt: payload.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Sensitive field detection
// ---------------------------------------------------------------------------

const SENSITIVE_PAYLOAD_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\bcertificate\b/i,
  /\bprivate[_\s-]*key\b/i,
];

function hasSensitivePayloadFields(record: Record<string, unknown>): boolean {
  const json = JSON.stringify(record);
  return SENSITIVE_PAYLOAD_PATTERNS.some((p) => p.test(json));
}

// ---------------------------------------------------------------------------
// Session-safe summary (for UI consumption)
// ---------------------------------------------------------------------------

export const SESSION_STATUS = {
  NO_SESSION: "未登录",
  DEV_SESSION: "开发会话已连接",
  GUARD_DISABLED: "开发登录未启用",
} as const;

export function getSafeSessionSummary(
  sessionPayload: DevSessionCookiePayload | null,
): DevSessionSafeSummary {
  if (!sessionPayload) {
    return {
      hasSession: false,
      user: null,
      sessionMode: null,
      productionReady: false,
      status: SESSION_STATUS.NO_SESSION,
      notice: "当前未登录。数据仅保存在本地浏览器中，未同步账号。",
    };
  }

  if (!isValidDevSessionPayload(sessionPayload)) {
    return {
      hasSession: false,
      user: null,
      sessionMode: null,
      productionReady: false,
      status: SESSION_STATUS.NO_SESSION,
      notice: "会话数据无效，已自动清除。请重新登录。",
    };
  }

  const session = payloadToSessionData(sessionPayload);

  return {
    hasSession: true,
    user: {
      userIdPreview: session.userIdPreview,
      displayName: session.displayName,
      role: session.role,
    },
    sessionMode: session.sessionMode,
    productionReady: false,
    status: SESSION_STATUS.DEV_SESSION,
    notice: `当前为开发会话（${session.sessionMode}），未连接生产认证。收藏与最近阅读为本地数据，尚未同步到账号。`,
  };
}

// ---------------------------------------------------------------------------
// Serialization for cookie
// ---------------------------------------------------------------------------

/**
 * Serialize session data for cookie storage.
 * Returns a JSON string safe to store in an httpOnly cookie.
 */
export function serializeDevSession(
  session: DevSessionData,
): string {
  const payload: DevSessionCookiePayload = {
    userIdPreview: session.userIdPreview,
    ...(session.email ? { email: normalizeEmail(session.email) } : {}),
    displayName: session.displayName,
    role: session.role,
    sessionMode: session.sessionMode,
    createdAt: session.createdAt,
  };
  return JSON.stringify(payload);
}

/**
 * Deserialize a cookie value back to a payload.
 * Returns null on any error (corrupted, invalid, sensitive fields).
 */
export function deserializeDevSession(
  cookieValue: string | undefined,
): DevSessionCookiePayload | null {
  if (!cookieValue || cookieValue.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return null;
  }

  if (!isValidDevSessionPayload(parsed)) return null;

  return parsed;
}

// ---------------------------------------------------------------------------
// Dev user presets (for login form)
// ---------------------------------------------------------------------------

export function getDevUserPresets(): Array<{ key: string; label: string }> {
  return Object.entries(DEFAULT_DEV_USERS).map(([key, user]) => ({
    key,
    label: `${user.displayName} (${user.userIdPreview})`,
  }));
}

export function getDevUserByKey(key: string): DevSessionUser | null {
  return DEFAULT_DEV_USERS[key] ?? null;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string"
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    && value.trim().length <= 254;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
