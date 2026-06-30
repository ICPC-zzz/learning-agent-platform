"use server";

import { getPrismaClient, PrismaEmailOtpRepository } from "@learning-agent-platform/db";

import { getEmailRuntimeConfig } from "../../../lib/email/email-runtime-config";
import { buildOtpEmail, sendResendEmail } from "../../../lib/email/resend-provider";
import { generateOtpCode, hashOtpCode } from "../../../lib/email-otp-code";
import { recordAuthAuditEvent } from "../../../lib/session/web-auth-session";

export interface EmailOtpSendResult {
  success: boolean;
  message: string;
  emailSent: boolean;
  devOnly: boolean;
  productionReady: boolean;
  retryAfterSeconds: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 10;

const lastSendTimeByEmail = new Map<string, number>();
const lastSendTimeBySource = new Map<string, number>();

export async function sendEmailOtpAction(
  _prevState: unknown,
  formData: FormData,
): Promise<EmailOtpSendResult> {
  const rawEmail = formData.get("email");
  if (!isValidEmail(rawEmail)) {
    return blocked("请提供有效的邮箱地址。", 0);
  }

  const email = normalizeEmail(rawEmail as string);
  if (!isEmailAuthEnabled()) {
    await recordAuthAuditEvent({
      eventType: "auth_otp_requested",
      result: "blocked",
      errorCode: "email_auth_disabled",
    });
    return blocked("邮箱验证服务当前不可用。", 0);
  }

  const rateLimit = checkRateLimit(email, "request");
  if (!rateLimit.allowed) {
    return blocked(`验证码已发送，请 ${rateLimit.retryAfterSeconds} 秒后再试。`, rateLimit.retryAfterSeconds);
  }

  const emailConfig = getEmailRuntimeConfig();
  const canUseDevConsole = canUseDevOtpConsole();
  if (!emailConfig.realSendAllowed && !canUseDevConsole) {
    await recordAuthAuditEvent({
      eventType: "auth_otp_requested",
      result: "blocked",
      errorCode: toSafeAuditErrorCode("email_provider_not_configured", emailConfig.blockedReasons.join("_")),
    });
    return blocked("邮件发送服务未配置，请稍后再试。", 0);
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  if (!codeHash) {
    return blocked("验证码生成失败，请稍后再试。", 0);
  }

  let otpRecordId: string | null = null;
  try {
    const otpRepo = new PrismaEmailOtpRepository(getPrismaClient());
    await otpRepo.consumeActiveEmailOtps(email, "login");
    const otpRecord = await otpRepo.createEmailOtp({
      email,
      codeHash,
      purpose: "login",
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });
    otpRecordId = otpRecord.id;
  } catch {
    await recordAuthAuditEvent({
      eventType: "auth_otp_requested",
      result: "failure",
      errorCode: "otp_storage_failed",
    });
    return blocked("验证码服务暂时不可用，请稍后再试。", 0);
  }

  if (emailConfig.realSendAllowed) {
    const emailBody = buildOtpEmail({
      code,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
    const sent = await sendResendEmail({
      config: emailConfig,
      to: email,
      subject: emailBody.subject,
      html: emailBody.html,
      text: emailBody.text,
    });
    if (!sent.ok) {
      await consumeOtpAfterProviderFailure(otpRecordId);
      await recordAuthAuditEvent({
        eventType: "auth_otp_requested",
        result: "failure",
        errorCode: toSafeAuditErrorCode(
          "email_provider_send_failed",
          [sent.status, sent.errorCode, sent.requestId].filter(Boolean).join("_"),
        ),
      });
      return blocked("邮件发送失败，请稍后再试。", 0);
    }
    recordSendTime(email, "request");
    await recordAuthAuditEvent({
      eventType: "auth_otp_requested",
      result: "success",
    });
    return {
      success: true,
      message: "验证码已发送，请查收邮件。",
      emailSent: true,
      devOnly: false,
      productionReady: true,
      retryAfterSeconds: RATE_LIMIT_SECONDS,
    };
  }

  // Non-production, explicit dev-only mailbox substitute.
  console.log("[DEV EMAIL OTP] " + email + " code=" + code + " expires=" + OTP_EXPIRY_MINUTES + "m");
  recordSendTime(email, "request");
  await recordAuthAuditEvent({
    eventType: "auth_otp_requested",
    result: "success",
  });
  return {
    success: true,
    message: "验证码已生成，请查看受控开发控制台。",
    emailSent: false,
    devOnly: true,
    productionReady: false,
    retryAfterSeconds: RATE_LIMIT_SECONDS,
  };
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim()) && email.trim().length <= 254;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmailAuthEnabled(): boolean {
  if (getEmailRuntimeConfig().realSendAllowed) {
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    return process.env.LAP_EMAIL_AUTH_ENABLED === "1" || process.env.LAP_EMAIL_AUTH_ENABLED === "true";
  }
  return process.env.LAP_EMAIL_AUTH_ENABLED === "1"
    || process.env.LAP_EMAIL_AUTH_ENABLED === "true"
    || process.env.LAP_ALLOW_EMAIL_AUTH === "1"
    || process.env.LAP_ALLOW_EMAIL_AUTH === "true"
    || process.env.LAP_ALLOW_DEV_EMAIL_OTP === "1"
    || process.env.LAP_ALLOW_DEV_EMAIL_OTP === "true";
}

function canUseDevOtpConsole(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LAP_AUTH_DEV_MODE === "1";
}

function checkRateLimit(email: string, sourceKey: string): { allowed: boolean; retryAfterSeconds: number } {
  const emailResult = checkMapRate(lastSendTimeByEmail, email);
  if (!emailResult.allowed) return emailResult;
  return checkMapRate(lastSendTimeBySource, sourceKey);
}

function checkMapRate(map: Map<string, number>, key: string): { allowed: boolean; retryAfterSeconds: number } {
  const lastSent = map.get(key);
  if (!lastSent) return { allowed: true, retryAfterSeconds: 0 };
  const elapsed = (Date.now() - lastSent) / 1000;
  if (elapsed >= RATE_LIMIT_SECONDS) {
    map.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: false, retryAfterSeconds: Math.ceil(RATE_LIMIT_SECONDS - elapsed) };
}

function recordSendTime(email: string, sourceKey: string): void {
  lastSendTimeByEmail.set(email, Date.now());
  lastSendTimeBySource.set(sourceKey, Date.now());
}

async function consumeOtpAfterProviderFailure(otpRecordId: string | null): Promise<void> {
  if (!otpRecordId) return;
  try {
    await new PrismaEmailOtpRepository(getPrismaClient()).markEmailOtpConsumed(otpRecordId);
  } catch {
    // Best effort: provider failure must not leak details or block retry UX.
  }
}

function toSafeAuditErrorCode(prefix: string, detail: string): string {
  const safeDetail = detail.trim().replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
  return safeDetail.length > 0 ? `${prefix}:${safeDetail}` : prefix;
}

function blocked(message: string, retryAfterSeconds: number): EmailOtpSendResult {
  return {
    success: false,
    message,
    emailSent: false,
    devOnly: process.env.NODE_ENV !== "production",
    productionReady: false,
    retryAfterSeconds,
  };
}
