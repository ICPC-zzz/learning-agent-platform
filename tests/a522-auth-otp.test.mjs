import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sendSource = readFileSync("apps/web/src/app/auth/login/email-otp-actions.ts", "utf8");
const verifySource = readFileSync("apps/web/src/app/auth/login/email-otp-verify-actions.ts", "utf8");
const repoSource = readFileSync("packages/db/src/repositories/email-otp-repository.ts", "utf8");

test("A522 OTP stores hashes and invalidates old active codes", () => {
  assert.match(sendSource, /hashOtpCode\(code\)/);
  assert.match(sendSource, /consumeActiveEmailOtps\(email,\s*"login"\)/);
  assert.match(repoSource, /consumeActiveEmailOtps/);
  assert.match(repoSource, /updateMany/);
});

test("A522 OTP verification consumes successful codes and limits failures", () => {
  assert.match(verifySource, /MAX_ATTEMPTS\s*=\s*5/);
  assert.match(verifySource, /markEmailOtpConsumed/);
  assert.match(verifySource, /incrementEmailOtpAttempts/);
});

test("A522 production OTP does not fall back to console codes", () => {
  assert.match(sendSource, /process\.env\.NODE_ENV !== "production" && process\.env\.LAP_AUTH_DEV_MODE === "1"/);
  const resultInterface = sendSource.match(/export interface EmailOtpSendResult \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(resultInterface, /\bcode\b/);
  assert.doesNotMatch(sendSource, /message:\s*.*code/);
});
