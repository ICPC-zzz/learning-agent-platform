/**
 * A468 Email Login Status Test (Source-level)
 * Tests: /auth/login page content for email tab Resend/OTP/A468 indicators.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginPath = resolve(__dirname, "auth/login/page.tsx");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log("  PASS " + name); }
  catch (err) { failed++; console.log("  FAIL " + name + "\n    " + err.message); }
}

console.log("\nA468 Login Status Test\n");

let pageContent;
try { pageContent = readFileSync(loginPath, "utf-8"); } catch { console.log("Cannot read page"); }

test("Page file is readable", () => {
  if (!pageContent) throw new Error("Cannot read");
});

test("Page imports getEmailOtpGuardStatus", () => {
  if (!pageContent || !pageContent.includes("getEmailOtpGuardStatus")) throw new Error("Missing import");
});

test("Page mentions Resend", () => {
  if (!pageContent || !pageContent.includes("Resend")) throw new Error("Missing Resend");
});

test("Page shows OTP data model ready", () => {
  if (!pageContent || !pageContent.includes("数据模型就绪")) throw new Error("Missing data model ready");
});

test("Page references A468", () => {
  if (!pageContent || !pageContent.includes("A468")) throw new Error("Missing A468");
});

test("Page references A469 (next round)", () => {
  if (!pageContent || (!pageContent.includes("A469") && !pageContent.includes("下一轮接入"))) throw new Error("Missing A469/next round");
});

test("Page shows sendsEmail status", () => {
  if (!pageContent || !pageContent.includes("sendsEmail")) throw new Error("Missing sendsEmail");
});

test("Page does NOT show fake success (邮件已发送)", () => {
  if (pageContent && pageContent.includes("邮件已发送")) throw new Error("Shows fake '邮件已发送'");
});

test("Page does NOT show fake success (验证码已发送)", () => {
  if (pageContent && pageContent.includes("验证码已发送")) throw new Error("Shows fake '验证码已发送'");
});

test("Phone tab still exists", () => {
  if (!pageContent || !pageContent.includes("PhoneAuthSection")) throw new Error("Phone section missing");
});

test("Password login still exists", () => {
  if (!pageContent || !pageContent.includes("devLoginAction")) throw new Error("Password login missing");
});

test("LAP_ALLOW_DEV_EMAIL_OTP referenced in page", () => {
  if (!pageContent || !pageContent.includes("LAP_ALLOW_DEV_EMAIL_OTP")) throw new Error("Missing OTP env var reference");
});

console.log("\n" + passed + " passed, " + failed + " failed\n");
if (failed > 0) process.exit(1);
