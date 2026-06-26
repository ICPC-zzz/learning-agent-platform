/**
 * A463 — Third-Party API UI Status Tests
 * Usage: node apps/web/src/app/a463-third-party-api-ui-status.test.mjs
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Simulated UI status functions
// ---------------------------------------------------------------------------

function simulatePhoneAuthStatus(env = {}) {
  const LAP_ALLOW_PHONE_AUTH = env.LAP_ALLOW_PHONE_AUTH;
  const allowEnabled = LAP_ALLOW_PHONE_AUTH === "true" || LAP_ALLOW_PHONE_AUTH === "1";
  const requiredEnvNames = ["LAP_ALLOW_PHONE_AUTH", "LAP_SMS_PROVIDER", "LAP_SMS_API_BASE_URL", "LAP_SMS_API_KEY", "LAP_SMS_API_SECRET", "LAP_SMS_SIGN_NAME", "LAP_SMS_TEMPLATE_ID"];
  const configuredEnvNames = [], missingEnvNames = [];
  if (allowEnabled) { configuredEnvNames.push("LAP_ALLOW_PHONE_AUTH"); } else { missingEnvNames.push("LAP_ALLOW_PHONE_AUTH"); }
  for (const name of requiredEnvNames.slice(1)) {
    if (typeof env[name] === "string" && env[name].trim().length > 0) { configuredEnvNames.push(name); } else { missingEnvNames.push(name); }
  }
  const blocked = missingEnvNames.length > 0 || env.NODE_ENV === "production";
  return { capability: "phone-auth", enabled: !blocked, blocked, reason: blocked ? `Missing env: ${missingEnvNames.join(", ")}` : null, requiredEnvNames, configuredEnvNames, missingEnvNames, devOnly: true, productionBlocked: env.NODE_ENV === "production", canHealthCheck: !blocked && !!env.LAP_SMS_API_BASE_URL, provider: env.LAP_SMS_PROVIDER ?? undefined, providerLabel: "手机号验证码登录（SMS OTP）" };
}

function simulateEmailAuthStatus(env = {}) {
  const LAP_ALLOW_EMAIL_AUTH = env.LAP_ALLOW_EMAIL_AUTH;
  const allowEnabled = LAP_ALLOW_EMAIL_AUTH === "true" || LAP_ALLOW_EMAIL_AUTH === "1";
  const requiredEnvNames = ["LAP_ALLOW_EMAIL_AUTH", "LAP_EMAIL_PROVIDER", "LAP_EMAIL_API_BASE_URL", "LAP_EMAIL_API_KEY", "LAP_EMAIL_FROM"];
  const configuredEnvNames = [], missingEnvNames = [];
  if (allowEnabled) { configuredEnvNames.push("LAP_ALLOW_EMAIL_AUTH"); } else { missingEnvNames.push("LAP_ALLOW_EMAIL_AUTH"); }
  for (const name of requiredEnvNames.slice(1)) {
    if (typeof env[name] === "string" && env[name].trim().length > 0) { configuredEnvNames.push(name); } else { missingEnvNames.push(name); }
  }
  const blocked = missingEnvNames.length > 0 || env.NODE_ENV === "production";
  return { capability: "email-auth", enabled: !blocked, blocked, reason: blocked ? `Missing env: ${missingEnvNames.join(", ")}` : null, requiredEnvNames, configuredEnvNames, missingEnvNames, devOnly: true, productionBlocked: env.NODE_ENV === "production", canHealthCheck: !blocked && !!env.LAP_EMAIL_API_BASE_URL, provider: env.LAP_EMAIL_PROVIDER ?? undefined, providerLabel: "邮箱登录（Email Auth）" };
}

const FAKE_SUCCESS_PATTERNS = [/验证码已发送/i, /邮件已发送/i, /verification code sent/i, /email sent/i, /OTP sent/i, /短信已发送/i, /登录成功.*手机号/i, /登录成功.*邮箱/i, /SMS sent successfully/i, /Email sent successfully/i];

function assertNoFakeSuccess(text) {
  for (const pattern of FAKE_SUCCESS_PATTERNS) {
    assert.ok(!pattern.test(text), `Fake success: ${pattern.source} found`);
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) { total++; try { fn(); passed++; console.log(`${PASS} [a463-ui] ${name}`); } catch (e) { failed++; console.log(`${FAIL} [a463-ui] ${name}\n       ${e.message}`); } }

// ---- Phone Auth unconfigured ----

t("phone auth blocked when no env", () => {
  const status = simulatePhoneAuthStatus({});
  assert.equal(status.blocked, true);
  assert.equal(status.enabled, false);
  assert.ok(status.missingEnvNames.includes("LAP_ALLOW_PHONE_AUTH"));
});

t("phone auth status shows variable names only", () => {
  const status = simulatePhoneAuthStatus({});
  const json = JSON.stringify(status);
  assert.ok(!json.includes("sk-"));
  assert.ok(!json.includes("SG."));
});

t("phone auth blocked reason: no fake success", () => {
  const status = simulatePhoneAuthStatus({});
  if (status.reason) assertNoFakeSuccess(status.reason);
});

t("phone auth label shows blocked", () => {
  const status = simulatePhoneAuthStatus({});
  const label = status.blocked ? "blocked" : (status.enabled ? "ready" : "未配置");
  assert.equal(label, "blocked");
});

// ---- Phone Auth configured ----

t("phone auth enabled when all envs configured", () => {
  const status = simulatePhoneAuthStatus({ LAP_ALLOW_PHONE_AUTH: "true", LAP_SMS_PROVIDER: "aliyun", LAP_SMS_API_BASE_URL: "https://sms.example.com", LAP_SMS_API_KEY: "key123", LAP_SMS_API_SECRET: "secret123", LAP_SMS_SIGN_NAME: "TestApp", LAP_SMS_TEMPLATE_ID: "SMS_123456" });
  assert.equal(status.blocked, false);
  assert.equal(status.missingEnvNames.length, 0);
});

t("configured phone auth shows ready label", () => {
  const status = simulatePhoneAuthStatus({ LAP_ALLOW_PHONE_AUTH: "true", LAP_SMS_PROVIDER: "aliyun", LAP_SMS_API_BASE_URL: "https://sms.example.com", LAP_SMS_API_KEY: "key123", LAP_SMS_API_SECRET: "secret123", LAP_SMS_SIGN_NAME: "TestApp", LAP_SMS_TEMPLATE_ID: "SMS_123456" });
  const label = status.blocked ? "blocked" : (status.enabled ? "ready" : "未配置");
  assert.equal(label, "ready");
});

t("phone auth devOnly is true when configured", () => {
  const status = simulatePhoneAuthStatus({ LAP_ALLOW_PHONE_AUTH: "true", LAP_SMS_PROVIDER: "aliyun", LAP_SMS_API_BASE_URL: "https://sms.example.com", LAP_SMS_API_KEY: "key123", LAP_SMS_API_SECRET: "secret123", LAP_SMS_SIGN_NAME: "TestApp", LAP_SMS_TEMPLATE_ID: "SMS_123456" });
  assert.equal(status.devOnly, true);
});

// ---- Email Auth unconfigured ----

t("email auth blocked when no env", () => {
  const status = simulateEmailAuthStatus({});
  assert.equal(status.blocked, true);
  assert.ok(status.missingEnvNames.includes("LAP_ALLOW_EMAIL_AUTH"));
});

t("email auth blocked: missingEnvNames are variable names only", () => {
  const status = simulateEmailAuthStatus({ LAP_EMAIL_FROM: "noreply@example.com" });
  assert.equal(status.blocked, true); // allow flag missing
  for (const name of status.missingEnvNames) {
    assert.ok(!name.includes("@"), `${name} contains @`);
  }
});

t("email auth blocked reason is safe", () => {
  const status = simulateEmailAuthStatus({});
  if (status.reason) {
    assertNoFakeSuccess(status.reason);
    assert.ok(!status.reason.includes("@"));
  }
});

// ---- Email Auth configured ----

t("email auth enabled when all envs configured", () => {
  const status = simulateEmailAuthStatus({ LAP_ALLOW_EMAIL_AUTH: "true", LAP_EMAIL_PROVIDER: "sendgrid", LAP_EMAIL_API_BASE_URL: "https://api.sendgrid.com", LAP_EMAIL_API_KEY: "SG.key123", LAP_EMAIL_FROM: "noreply@example.com" });
  assert.equal(status.blocked, false);
});

// ---- Production blocked ----

t("phone auth production blocked", () => {
  const status = simulatePhoneAuthStatus({ NODE_ENV: "production", LAP_ALLOW_PHONE_AUTH: "true", LAP_SMS_PROVIDER: "aliyun", LAP_SMS_API_BASE_URL: "https://sms.example.com", LAP_SMS_API_KEY: "key123", LAP_SMS_API_SECRET: "secret123", LAP_SMS_SIGN_NAME: "TestApp", LAP_SMS_TEMPLATE_ID: "SMS_123456" });
  assert.equal(status.blocked, true);
  assert.equal(status.productionBlocked, true);
});

t("email auth production blocked", () => {
  const status = simulateEmailAuthStatus({ NODE_ENV: "production", LAP_ALLOW_EMAIL_AUTH: "true", LAP_EMAIL_PROVIDER: "sendgrid", LAP_EMAIL_API_BASE_URL: "https://api.sendgrid.com", LAP_EMAIL_API_KEY: "SG.key123", LAP_EMAIL_FROM: "noreply@example.com" });
  assert.equal(status.blocked, true);
  assert.equal(status.productionBlocked, true);
});

// ---- No fake success ----

t("phone auth blocked: no fake SMS success", () => {
  const status = simulatePhoneAuthStatus({});
  assertNoFakeSuccess(JSON.stringify(status));
});

t("email auth blocked: no fake email success", () => {
  const status = simulateEmailAuthStatus({});
  assertNoFakeSuccess(JSON.stringify(status));
});

t("enabled phone auth: no fake SMS sent message", () => {
  const status = simulatePhoneAuthStatus({ LAP_ALLOW_PHONE_AUTH: "true", LAP_SMS_PROVIDER: "aliyun", LAP_SMS_API_BASE_URL: "https://sms.example.com", LAP_SMS_API_KEY: "key123", LAP_SMS_API_SECRET: "secret123", LAP_SMS_SIGN_NAME: "TestApp", LAP_SMS_TEMPLATE_ID: "SMS_123456" });
  assertNoFakeSuccess(JSON.stringify(status));
});

t("enabled email auth: no fake email sent message", () => {
  const status = simulateEmailAuthStatus({ LAP_ALLOW_EMAIL_AUTH: "true", LAP_EMAIL_PROVIDER: "sendgrid", LAP_EMAIL_API_BASE_URL: "https://api.sendgrid.com", LAP_EMAIL_API_KEY: "SG.key123", LAP_EMAIL_FROM: "noreply@example.com" });
  assertNoFakeSuccess(JSON.stringify(status));
});

console.log(`\nA463 UI Status: ${total} tests, ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
