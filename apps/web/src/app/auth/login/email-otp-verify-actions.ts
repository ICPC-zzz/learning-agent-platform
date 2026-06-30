"use server";

import { cookies } from "next/headers";
import { getPrismaClient, PrismaEmailOtpRepository, PrismaUserRepository } from "@learning-agent-platform/db";

import { verifyOtpCode } from "../../../lib/email-otp-code";
import {
  createDatabaseSessionForUser,
  recordAuthAuditEvent,
  setWebSessionCookie,
} from "../../../lib/session/web-auth-session";
import { DEV_SESSION_COOKIE_NAME } from "../../../lib/web-auth-dev-session";

export interface EmailOtpVerifyResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
    isNewUser: boolean;
  };
  devOnly: boolean;
  productionReady: boolean;
  sessionCreated: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;
const MAX_ATTEMPTS = 5;

export async function verifyEmailOtpAction(
  _prevState: unknown,
  formData: FormData,
): Promise<EmailOtpVerifyResult> {
  const rawEmail = formData.get("email");
  const rawCode = formData.get("code");
  if (!isValidEmail(rawEmail) || !isValidCode(rawCode)) {
    await recordAuthAuditEvent({
      eventType: "auth_otp_failed",
      result: "failure",
      errorCode: "invalid_input",
    });
    return failed("邮箱或验证码格式无效。");
  }

  const email = normalizeEmail(rawEmail as string);
  const code = String(rawCode).trim();
  let otpRecord: Awaited<ReturnType<PrismaEmailOtpRepository["findLatestActiveEmailOtp"]>>;

  try {
    const otpRepo = new PrismaEmailOtpRepository(getPrismaClient());
    otpRecord = await otpRepo.findLatestActiveEmailOtp(email, "login");
  } catch {
    return failed("服务暂时不可用，请稍后再试。");
  }

  if (!otpRecord) {
    await recordAuthAuditEvent({
      eventType: "auth_otp_failed",
      result: "failure",
      errorCode: "otp_not_found",
    });
    return failed("验证码不存在或已过期。请重新发送验证码。");
  }

  if (otpRecord.attemptCount >= MAX_ATTEMPTS) {
    await consumeOtp(otpRecord.id);
    await recordAuthAuditEvent({
      eventType: "auth_otp_failed",
      result: "blocked",
      errorCode: "too_many_attempts",
    });
    return failed("验证码尝试次数过多，请重新发送验证码。");
  }

  const storedCodeHash = await getOtpHash(otpRecord.id);
  const codeValid = storedCodeHash ? await verifyOtpCode(code, storedCodeHash) : false;
  if (!codeValid) {
    await incrementOtpAttempts(otpRecord.id);
    await recordAuthAuditEvent({
      eventType: "auth_otp_failed",
      result: "failure",
      errorCode: "wrong_code",
    });
    return failed("验证码错误，请重试。");
  }

  await consumeOtp(otpRecord.id);

  let userId: string;
  let username: string;
  let isNewUser = false;
  try {
    const userRepo = new PrismaUserRepository(getPrismaClient());
    const existingUser = await userRepo.getUserByEmail(email);
    if (existingUser) {
      userId = existingUser.id;
      username = existingUser.name ?? email;
      await userRepo.updateUser(userId, { emailVerifiedAt: new Date() });
    } else {
      const newUser = await userRepo.createUser({
        email,
        name: email.split("@")[0] || "学习者",
        emailVerifiedAt: new Date(),
        role: "USER",
      });
      userId = newUser.id;
      username = newUser.name ?? email;
      isNewUser = true;
    }
  } catch {
    return failed("用户登录失败，请稍后再试。");
  }

  try {
    const { rawToken } = await createDatabaseSessionForUser(userId);
    await setWebSessionCookie(rawToken);
    await clearLegacyDevSessionCookie();
  } catch {
    return failed("会话创建失败，请稍后再试。");
  }

  await recordAuthAuditEvent({
    userId,
    eventType: "auth_otp_verified",
    result: "success",
  });

  return {
    success: true,
    message: isNewUser ? `账号创建成功，欢迎 ${username}！` : `登录成功，欢迎回来 ${username}！`,
    user: {
      id: userId,
      username,
      email,
      isNewUser,
    },
    devOnly: false,
    productionReady: true,
    sessionCreated: true,
  };
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim()) && email.trim().length <= 254;
}

function isValidCode(code: unknown): code is string {
  return typeof code === "string" && CODE_REGEX.test(code.trim());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getOtpHash(id: string): Promise<string | null> {
  try {
    return new PrismaEmailOtpRepository(getPrismaClient()).getCodeHashForVerification(id);
  } catch {
    return null;
  }
}

async function incrementOtpAttempts(id: string): Promise<void> {
  try {
    await new PrismaEmailOtpRepository(getPrismaClient()).incrementEmailOtpAttempts(id);
  } catch {
    // best effort
  }
}

async function consumeOtp(id: string): Promise<void> {
  try {
    await new PrismaEmailOtpRepository(getPrismaClient()).markEmailOtpConsumed(id);
  } catch {
    // best effort
  }
}

async function clearLegacyDevSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(DEV_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // best effort
  }
}

function failed(message: string): EmailOtpVerifyResult {
  return {
    success: false,
    message,
    devOnly: process.env.NODE_ENV !== "production",
    productionReady: false,
    sessionCreated: false,
  };
}
