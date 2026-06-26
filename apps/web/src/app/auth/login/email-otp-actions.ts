"use server";

/**
 * Email OTP Send Action — sends a 6-digit verification code via Resend.
 *
 * Guard chain:
 * 1. NODE_ENV !== "production"
 * 2. LAP_ALLOW_DEV_EMAIL_OTP=true
 * 3. LAP_ALLOW_DEV_EMAIL_SEND=true (optional — enables real Resend email)
 *
 * Security:
 * - OTP is hashed before storage (never plaintext)
 * - Plaintext OTP is never returned to client
 * - Raw Resend response is never returned
 * - Resend errors are sanitized
 * - 60-second rate limit per email
 *
 * @module email-otp-send-action
 * @devOnly — A471 v1
 */

import { getEmailOtpGuardStatus, emailOtpGuardStatusIsSafe } from "../../../lib/web-auth-email-otp-guard";
import { generateOtpCode, hashOtpCode } from "../../../lib/email-otp-code";
import { getPrismaClient, PrismaEmailOtpRepository } from "@learning-agent-platform/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailOtpSendResult {
  success: boolean;
  /** Human-readable message for UI. */
  message: string;
  /** Whether email was actually sent (always false when guard blocked). */
  emailSent: false;
  /** Dev-only marker. */
  devOnly: true;
  /** Rate limit — seconds until next allowed send (0 if not limited). */
  retryAfterSeconds: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 10;

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim()) && email.trim().length <= 254;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getEnv(key: string): string | undefined {
  try { return process.env[key]; } catch { return undefined; }
}

function getResendApiKey(): string | undefined {
  return getEnv("LAP_EMAIL_API_KEY") || getEnv("RESEND_API_KEY");
}

function getFromAddress(): string | undefined {
  return getEnv("LAP_EMAIL_FROM");
}

// ---------------------------------------------------------------------------
// Rate limit check (in-memory, resets on server restart — dev-only acceptable)
// ---------------------------------------------------------------------------

const lastSendTime = new Map<string, number>();

function checkRateLimit(email: string): { allowed: boolean; retryAfterSeconds: number } {
  const normalized = normalizeEmail(email);
  const lastSent = lastSendTime.get(normalized);
  if (!lastSent) return { allowed: true, retryAfterSeconds: 0 };

  const elapsed = (Date.now() - lastSent) / 1000;
  if (elapsed >= RATE_LIMIT_SECONDS) {
    lastSendTime.delete(normalized);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(RATE_LIMIT_SECONDS - elapsed),
  };
}

function recordSendTime(email: string): void {
  lastSendTime.set(normalizeEmail(email), Date.now());
}

// ---------------------------------------------------------------------------
// Send action
// ---------------------------------------------------------------------------

/**
 * Send a 6-digit email OTP verification code via Resend.
 *
 * @param _prevState - Unused previous state (for useActionState).
 * @param formData - FormData with "email" field.
 */
export async function sendEmailOtpAction(
  _prevState: unknown,
  formData: FormData,
): Promise<EmailOtpSendResult> {
  const rawEmail = formData.get("email");

  // 1. Validate email format
  if (!isValidEmail(rawEmail)) {
    return {
      success: false,
      message: "请提供有效的邮箱地址。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  const email = normalizeEmail(rawEmail as string);

  // 2. Guard check — production blocked, env vars, etc.
  const guard = getEmailOtpGuardStatus();

  if (!emailOtpGuardStatusIsSafe(guard)) {
    return {
      success: false,
      message: "邮箱验证服务当前不可用（安全校验未通过）。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  if (guard.productionBlocked) {
    return {
      success: false,
      message: "邮箱验证服务不在生产环境提供。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  if (!guard.otpStorageAllowed) {
    return {
      success: false,
      message: "邮箱验证码存储功能未启用。请检查 LAP_ALLOW_DEV_EMAIL_OTP 配置。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  // 3. Rate limit check
  const rateLimit = checkRateLimit(email);
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: `验证码已发送，请 ${rateLimit.retryAfterSeconds} 秒后再试。`,
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  // 4. Generate OTP code (always happens, even when not sending real email)
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  if (!codeHash) {
    return {
      success: false,
      message: "验证码生成失败，请稍后再试。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  // 5. Store hashed OTP in DB
  try {
    const prisma = getPrismaClient();
    const otpRepo = new PrismaEmailOtpRepository(prisma);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await otpRepo.createEmailOtp({
      email,
      codeHash,
      purpose: "login",
      expiresAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendEmailOtpAction] OTP storage failed:", msg);
    return {
      success: false,
      message: `验证码存储失败: ${msg}`,
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }

  // 6. Try to send via Resend API (if configured), otherwise log to console
  const apiKey = getResendApiKey();
  const from = getFromAddress();

  if (!apiKey || !from) {
    // No Resend credentials — log OTP to server console for dev testing
    console.log("");
    console.log("══════════════════════════════════════════════════");
    console.log(`  [DEV EMAIL OTP] 验证码: ${code}`);
    console.log(`  收件人: ${email}`);
    console.log(`  有效期: ${OTP_EXPIRY_MINUTES} 分钟`);
    console.log("  ⚠ 未配置 Resend API key，验证码仅显示在控制台。");
    console.log("  设置 LAP_EMAIL_API_KEY + LAP_EMAIL_FROM 启用真实邮件发送。");
    console.log("══════════════════════════════════════════════════");
    console.log("");

    recordSendTime(email);

    return {
      success: true,
      message: `验证码已生成，请查看服务端控制台获取验证码。`,
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: RATE_LIMIT_SECONDS,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Learning Agent Platform - 邮箱验证码",
        html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f172a; margin: 0 0 8px 0;">邮箱验证码</h2>
          <p style="color: #475569; font-size: 16px; margin: 0 0 16px 0;">您的验证码是：</p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 16px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: 6px;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">此验证码 ${OTP_EXPIRY_MINUTES} 分钟内有效，请勿分享给他人。</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">如果您没有请求此验证码，请忽略此邮件。</p>
        </div>`,
      }),
    });

    if (!response.ok) {
      // Sanitize: do NOT return raw Resend response
      console.error(
        `[sendEmailOtpAction] Resend API error (status ${response.status}) — see server logs for details.`,
      );
      return {
        success: false,
        message: "邮件发送失败，请稍后再试。",
        emailSent: false,
        devOnly: true,
        retryAfterSeconds: 0,
      };
    }

    // Record successful send time for rate limiting
    recordSendTime(email);

    return {
      success: true,
      message: `验证码已发送至 ${email}，请查收邮件。`,
      emailSent: false, // Never return true — always "false" in dev-only
      devOnly: true,
      retryAfterSeconds: RATE_LIMIT_SECONDS,
    };
  } catch (err) {
    // Sanitize: do NOT return raw error
    console.error(
      `[sendEmailOtpAction] Resend send error — see server logs for details.`,
    );
    return {
      success: false,
      message: "邮件发送失败，请稍后再试。",
      emailSent: false,
      devOnly: true,
      retryAfterSeconds: 0,
    };
  }
}
