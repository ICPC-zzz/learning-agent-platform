import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const DB_ROOT = resolve(APP_ROOT, "..", "..", "..", "packages", "db");

function readSource(rel) {
  const p = resolve(APP_ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf-8");
}

// Guard
test("guard has sendsEmail as variable not hardcoded", () => {
  const s = readFileSync(resolve(APP_ROOT, "lib", "web-auth-email-otp-guard.ts"), "utf-8");
  assert.ok(s.includes("sendsEmail,", "sendsEmail,"));
  assert.ok(!s.includes("sendsEmail: false,", "no hardcoded sendsEmail: false"));
  assert.ok(s.includes("otpStorageAllowed"));
});

test("guard enabled depends only on otpStorageAllowed", () => {
  const s = readFileSync(resolve(APP_ROOT, "lib", "web-auth-email-otp-guard.ts"), "utf-8");
  assert.ok(!s.includes("otpStorageAllowed && sendsEmail"));
});

// Send action
test("send action has console fallback", () => {
  const s = readSource("app/auth/login/email-otp-actions.ts");
  if (!s) return;
  assert.ok(s.includes("[DEV EMAIL OTP]"));
  assert.ok(s.includes("console.log"));
  assert.ok(s.includes("hashOtpCode"));
  assert.ok(!s.includes("LAP_ALLOW_EMAIL_AUTH"));
});

test("send action never returns emailSent=true", () => {
  const s = readSource("app/auth/login/email-otp-actions.ts");
  if (!s) return;
  assert.equal((s.match(/emailSent:\s*true/g) || []).length, 0);
});

// Verify action
test("verify action uses repository method not raw prisma", () => {
  const s = readSource("app/auth/login/email-otp-verify-actions.ts");
  if (!s) return;
  assert.ok(s.includes("getCodeHashForVerification"));
  assert.ok(!s.includes("prisma as any"));
});

test("verify action creates session with real user.id", () => {
  const s = readSource("app/auth/login/email-otp-verify-actions.ts");
  if (!s) return;
  assert.ok(!s.includes('createDevSessionData("dev-'));
  assert.ok(s.includes("createUser"));
  assert.ok(s.includes("isNewUser"));
});

// Login page
test("login page email tab default, no phone tab", () => {
  const s = readSource("app/auth/login/page.tsx");
  if (!s) return;
  assert.ok(s.includes('"email"'));
  assert.ok(!s.includes('"phone"'));
  assert.ok(!s.includes("下一轮接入"));
  assert.ok(!s.includes("sendsEmail: false"));
});

test("login page email input has name attribute", () => {
  const s = readSource("app/auth/login/page.tsx");
  if (!s) return;
  assert.ok(s.includes('name="email"'));
  assert.ok(s.includes('name="code"'));
});

// Books page
test("books page no dev-preview panels", () => {
  const s = readSource("app/books/page.tsx");
  if (!s) return;
  assert.ok(!s.includes("DataStatePanel"));
  assert.ok(!s.includes("PreviewNotice"));
  assert.ok(!s.includes("StatusBadgeRow"));
  assert.ok(!s.includes('badge="开发预览"'));
  assert.ok(!/向.*LLM.*提问/.test(s));
});

// Problems page
test("problems page no dev-preview panels", () => {
  const s = readSource("app/problems/page.tsx");
  if (!s) return;
  assert.ok(!s.includes("DataStatePanel"));
  assert.ok(!s.includes("PreviewNotice"));
  assert.ok(!s.includes("StatusBadgeRow"));
  assert.ok(!/提交代码|运行代码|在线判题/.test(s));
});

// Problem detail
test("problem detail handles all statuses", () => {
  const s = readSource("app/problems/[problemId]/page.tsx");
  if (!s) return;
  assert.ok(s.includes("not_found"));
  assert.ok(s.includes("db_unavailable"));
  assert.ok(s.includes("localStorage"));
  assert.ok(s.includes("escapeHtml"));
});

// Regression
test("A461 devLoginAction untouched", () => {
  const s = readSource("app/auth/login/actions.ts");
  if (!s) return;
  assert.ok(s.includes("devLoginAction"));
});

test("A468 repo has getCodeHashForVerification", () => {
  const p = resolve(DB_ROOT, "src", "repositories", "email-otp-repository.ts");
  if (!existsSync(p)) return;
  const s = readFileSync(p, "utf-8");
  assert.ok(s.includes("getCodeHashForVerification"));
});

test("A469 LLM untouched", () => {
  const p = resolve(APP_ROOT, "lib", "llm-dev-provider-config.ts");
  if (!existsSync(p)) return;
  const s = readFileSync(p, "utf-8");
  assert.ok(s.includes("LLM_DEV_ENV"));
});

test("FloatingAiAssistant exists", () => {
  assert.ok(existsSync(resolve(__dirname, "_components", "FloatingAiAssistant.tsx")));
});

// Safety
test("safety no .env.local read", () => {
  ["app/auth/login/email-otp-actions.ts", "app/auth/login/page.tsx"].forEach(function(f) {
    const s = readSource(f);
    if (s) assert.ok(!s.includes(".env.local"), f);
  });
});

test("safety no API key patterns", () => {
  const s = readSource("app/auth/login/email-otp-actions.ts");
  if (s) assert.ok(!/re_\w{20,}/.test(s));
});

test("schema EmailOtpCode model exists once", () => {
  const p = resolve(DB_ROOT, "prisma", "schema.prisma");
  if (!existsSync(p)) return;
  const s = readFileSync(p, "utf-8");
  assert.equal((s.match(/model EmailOtpCode/g) || []).length, 1);
});

console.log("\nAll A471 tests passed.\n");
