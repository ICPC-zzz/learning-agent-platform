import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerSource = readFileSync("apps/web/src/lib/email/resend-provider.ts", "utf8");
const smokeSource = readFileSync("scripts/email-smoke.ts", "utf8");

test("A524 Resend provider sends html and text without raw response logging", () => {
  assert.match(providerSource, /https:\/\/api\.resend\.com\/emails/);
  assert.match(providerSource, /html: input\.html/);
  assert.match(providerSource, /text: input\.text/);
  assert.match(providerSource, /x-request-id/);
  assert.match(providerSource, /errorCode/);
  assert.doesNotMatch(providerSource, /console\.log/);
  assert.doesNotMatch(providerSource, /console\.error/);
});

test("A524 OTP email template contains CF Agent safety copy", () => {
  assert.match(providerSource, /CF Agent 邮箱验证码/);
  assert.match(providerSource, /有效时间/);
  assert.match(providerSource, /如果不是你本人操作/);
  assert.match(providerSource, /不要向他人透露验证码/);
});

test("A524 smoke email requires explicit recipient and is not an OTP send", () => {
  assert.match(smokeSource, /--to <test-email>/);
  assert.match(smokeSource, /parseToAddress/);
  assert.match(smokeSource, /普通测试邮件/);
  assert.doesNotMatch(smokeSource, /generateOtpCode/);
  assert.doesNotMatch(smokeSource, /EmailOtpRepository/);
});
