"use server";

/**
 * Email OTP Verify + Login/Register Action.
 *
 * Verifies the 6-digit OTP code, then:
 * - If user with that email exists → log them in
 * - If user does not exist → create a new email user and log them in
 *
 * Session uses real DB user.id via A461 dev session cookie mechanism.
 *
 * Security:
 * - OTP is hashed and verified with timing-safe comparison
 * - Failed attempts increment attemptCount
 * - Expired/consumed OTPs are rejected
 * - Username auto-generated for new email users (email prefix + random suffix)
 * - No passwordHash, codeHash, or raw response returned
 *
 * @module email-otp-verify-action
 * @devOnly — A471 v1
 */

import { cookies } from "next/headers";
import { getPrismaClient, PrismaEmailOtpRepository, PrismaUserRepository } from "@learning-agent-platform/db";
import { verifyOtpCode } from "../../../lib/email-otp-code";
import { getEmailOtpGuardStatus, emailOtpGuardStatusIsSafe } from "../../../lib/web-auth-email-otp-guard";
import {
  createDevSessionData,
  serializeDevSession,
  DEV_SESSION_COOKIE_NAME,
} from "../../../lib/web-auth-dev-session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailOtpVerifyResult {
  success: boolean;
  /** Human-readable message for UI. */
  message: string;
  /** User info when login succeeds. */
  user?: {
    id: string;
    username: string;
    email: string;
    isNewUser: boolean;
  };
  /** Dev-only marker. */
  devOnly: true;
  /** Whether a session was created. */
  sessionCreated: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;
const MAX_ATTEMPTS = 5;

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim()) && email.trim().length <= 254;
}

function isValidCode(code: unknown): code is string {
  return typeof code === "string" && CODE_REGEX.test(code.trim());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeCode(code: string): string {
  return code.trim();
}

/**
 * Generate a safe username from email for new email-registered users.
 * Format: email prefix + "-" + 4 random hex chars
 * Example: "test-example" → "testexample-a1b2"
 */
function generateUsernameFromEmail(email: string): string {
  const prefix = email.split("@")[0] ?? "user";
  // Remove non-alphanumeric chars, lowercase
  const sanitized = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "user";
  // Add random suffix to avoid collisions
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${sanitized}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Verify action
// ---------------------------------------------------------------------------

/**
 * Verify an email OTP code and log in or register the user.
 *
 * @param _prevState - Unused previous state.
 * @param formData - FormData with "email" and "code" fields.
 */
export async function verifyEmailOtpAction(
  _prevState: unknown,
  formData: FormData,
): Promise<EmailOtpVerifyResult> {
  const rawEmail = formData.get("email");
  const rawCode = formData.get("code");

  // 1. Validate input format
  if (!isValidEmail(rawEmail)) {
    return {
      success: false,
      message: "请提供有效的邮箱地址。",
      devOnly: true,
      sessionCreated: false,
    };
  }
  if (!isValidCode(rawCode)) {
    return {
      success: false,
      message: "请提供6位数字验证码。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  const email = normalizeEmail(rawEmail as string);
  const code = normalizeCode(rawCode as string);

  // 2. Guard check
  const guard = getEmailOtpGuardStatus();
  if (!emailOtpGuardStatusIsSafe(guard)) {
    return {
      success: false,
      message: "邮箱验证服务当前不可用。",
      devOnly: true,
      sessionCreated: false,
    };
  }
  if (!guard.otpStorageAllowed) {
    return {
      success: false,
      message: "邮箱验证码存储功能未启用。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  // 3. Find latest active OTP
  let otpRecord;
  try {
    const prisma = getPrismaClient();
    const otpRepo = new PrismaEmailOtpRepository(prisma);
    otpRecord = await otpRepo.findLatestActiveEmailOtp(email, "login");
  } catch {
    return {
      success: false,
      message: "服务暂时不可用，请稍后再试。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  if (!otpRecord) {
    return {
      success: false,
      message: "验证码不存在或已过期。请重新发送验证码。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  // 4. Check attempt count
  if (otpRecord.attemptCount >= MAX_ATTEMPTS) {
    // Mark as consumed to prevent brute force
    try {
      const prisma = getPrismaClient();
      const otpRepo = new PrismaEmailOtpRepository(prisma);
      await otpRepo.markEmailOtpConsumed(otpRecord.id);
    } catch { /* best effort */ }
    return {
      success: false,
      message: "验证码尝试次数过多，请重新发送验证码。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  // 5. Verify the code — use repository method to get codeHash safely
  let storedCodeHash: string | null = null;
  try {
    const prisma = getPrismaClient();
    const otpRepo = new PrismaEmailOtpRepository(prisma);
    storedCodeHash = await otpRepo.getCodeHashForVerification(otpRecord.id);
  } catch {
    storedCodeHash = null;
  }

  if (!storedCodeHash) {
    // Increment attempts
    try {
      const prisma = getPrismaClient();
      const otpRepo = new PrismaEmailOtpRepository(prisma);
      await otpRepo.incrementEmailOtpAttempts(otpRecord.id);
    } catch { /* best effort */ }
    return {
      success: false,
      message: "验证码验证失败，请重试。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  const codeValid = await verifyOtpCode(code, storedCodeHash);

  if (!codeValid) {
    // Increment attempts on failure
    try {
      const prisma = getPrismaClient();
      const otpRepo = new PrismaEmailOtpRepository(prisma);
      await otpRepo.incrementEmailOtpAttempts(otpRecord.id);
    } catch { /* best effort */ }
    return {
      success: false,
      message: "验证码错误，请重试。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  // 6. Mark OTP as consumed
  try {
    const prisma = getPrismaClient();
    const otpRepo = new PrismaEmailOtpRepository(prisma);
    await otpRepo.markEmailOtpConsumed(otpRecord.id);
  } catch { /* best effort */ }

  // 7. Find or create user
  let userId: string;
  let username: string;
  let isNewUser = false;

  try {
    const prisma = getPrismaClient();
    const userRepo = new PrismaUserRepository(prisma);

    // Check if user with this email already exists
    const existingUser = await userRepo.getUserByEmail(email);

    if (existingUser) {
      // Login existing user
      userId = existingUser.id;
      username = existingUser.name ?? email;
      isNewUser = false;
    } else {
      // Create new user for this email
      const newUser = await userRepo.createUser({
        email,
        name: email.split("@")[0],
      });

      userId = newUser.id;
      username = newUser.name ?? email;
      isNewUser = true;
    }
  } catch {
    return {
      success: false,
      message: "用户登录失败，请稍后再试。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  // 8. Create dev session with real DB user.id
  try {
    const sessionData = createDevSessionData(
      userId,
      username,
      "开发用户",
    );

    const cookieStore = await cookies();
    const serialized = serializeDevSession(sessionData);

    cookieStore.set(DEV_SESSION_COOKIE_NAME, serialized, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // dev-only, not production
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  } catch {
    return {
      success: false,
      message: "会话创建失败，请稍后再试。",
      devOnly: true,
      sessionCreated: false,
    };
  }

  return {
    success: true,
    message: isNewUser ? `账号创建成功，欢迎 ${username}！` : `登录成功，欢迎回来 ${username}！`,
    user: {
      id: userId,
      username,
      email,
      isNewUser,
    },
    devOnly: true,
    sessionCreated: true,
  };
}
