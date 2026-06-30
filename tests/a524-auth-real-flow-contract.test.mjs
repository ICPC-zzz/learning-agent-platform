import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sendSource = readFileSync("apps/web/src/app/auth/login/email-otp-actions.ts", "utf8");
const verifySource = readFileSync("apps/web/src/app/auth/login/email-otp-verify-actions.ts", "utf8");
const sessionSource = readFileSync("apps/web/src/lib/session/web-auth-session.ts", "utf8");

test("A524 OTP send uses centralized email config and consumes OTP on provider failure", () => {
  assert.match(sendSource, /getEmailRuntimeConfig/);
  assert.match(sendSource, /sendResendEmail/);
  assert.match(sendSource, /consumeOtpAfterProviderFailure\(otpRecordId\)/);
  assert.match(sendSource, /email_provider_send_failed/);
  assert.doesNotMatch(sendSource, /fetch\("https:\/\/api\.resend\.com\/emails"/);
});

test("A524 OTP response never exposes the generated code", () => {
  assert.match(sendSource, /const code = generateOtpCode\(\)/);
  assert.doesNotMatch(sendSource, /code,\s*devOnly/);
  assert.doesNotMatch(sendSource, /return\s*\{[\s\S]{0,250}code/);
});

test("A524 verify creates a database session cookie and clears legacy dev session", () => {
  assert.match(verifySource, /createDatabaseSessionForUser\(userId\)/);
  assert.match(verifySource, /setWebSessionCookie\(rawToken\)/);
  assert.match(verifySource, /clearLegacyDevSessionCookie\(\)/);
  assert.match(sessionSource, /httpOnly:\s*true/);
  assert.match(sessionSource, /secure:\s*process\.env\.NODE_ENV === "production"/);
});
