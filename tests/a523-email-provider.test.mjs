import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sendSource = readFileSync("apps/web/src/app/auth/login/email-otp-actions.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

test("A523 email provider supports Resend production env aliases", () => {
  assert.match(sendSource, /RESEND_API_KEY/);
  assert.match(sendSource, /LAP_EMAIL_API_KEY/);
  assert.match(sendSource, /RESEND_FROM_EMAIL/);
  assert.match(sendSource, /EMAIL_FROM/);
  assert.match(sendSource, /LAP_EMAIL_FROM/);
  assert.match(sendSource, /firstConfiguredEnv\("LAP_EMAIL_FROM",\s*"RESEND_FROM_EMAIL",\s*"EMAIL_FROM"\)/);
});

test("A523 complete provider config enables real email path without dev console fallback", () => {
  assert.match(sendSource, /if\s*\(getResendConfig\(\)\)\s*\{\s*return true;\s*\}/);
  assert.match(sendSource, /process\.env\.NODE_ENV !== "production" && process\.env\.LAP_AUTH_DEV_MODE === "1"/);
  assert.doesNotMatch(sendSource, /console\.log\([\s\S]{0,80}process\.env/);
});

test("A523 provider send failure consumes the created OTP and records safe failure", () => {
  assert.match(sendSource, /let otpRecordId: string \| null = null/);
  assert.match(sendSource, /otpRecordId = otpRecord\.id/);
  assert.match(sendSource, /consumeOtpAfterProviderFailure\(otpRecordId\)/);
  assert.match(sendSource, /email_provider_send_failed/);
  assert.doesNotMatch(sendSource, /return blocked\("邮件发送失败[\s\S]{0,120}success:\s*true/);
});

test("A523 env example lists placeholders only for email provider", () => {
  for (const name of [
    "APP_BASE_URL",
    "LAP_EMAIL_AUTH_ENABLED",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "LAP_EMAIL_API_KEY",
    "LAP_EMAIL_FROM",
    "EMAIL_FROM",
  ]) {
    assert.match(envExample, new RegExp(`^${name}=`, "m"));
  }
  assert.doesNotMatch(envExample, /re_[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(envExample, /RESEND_API_KEY="[^"]{8,}"/);
});
