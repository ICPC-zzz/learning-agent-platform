/**
 * A463 — Third-Party API Safety Boundary Tests
 * Usage: node apps/web/src/app/a463-third-party-api-safety.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  import.meta.url.replace(/^file:\/\//, "").replace(/\/apps\/web\/src\/app\/a463-third-party-api-safety\.test\.mjs$/, ""),
);

const A463_SOURCE_FILES = [
  "packages/shared/src/third-party-api-config.ts",
  "packages/shared/src/external-api-dev-guard.ts",
  "apps/web/src/lib/third-party-api-health-check.ts",
  "apps/web/src/lib/admin-status-center.ts",
  "apps/web/src/app/auth/login/page.tsx",
  "apps/web/src/app/import/book-api-preview-status.ts",
  "apps/web/src/app/problems/problem-api-status.ts",
  "docs/setup/THIRD_PARTY_API_ENV.md",
];

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/, /SG\.[A-Za-z0-9_-]{20,}/,
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9+/=]{20,}["']?/i,
  /secret\s*[:=]\s*["']?[A-Za-z0-9+/=]{20,}["']?/i,
  /LAP_SMS_API_SECRET\s*=\s*[A-Za-z0-9+/=]{10,}/,
  /LAP_SMTP_PASS\s*=\s*[A-Za-z0-9@#$%^&*]{5,}/,
  /DATABASE_URL\s*[:=]\s*["']?postgres:\/\/[^\s"']+/i,
];

function fileContainsSecrets(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) return pattern.source;
  }
  return false;
}

function fileReadsEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  return /\.env\.local/.test(content) && /readFile|dotenv|fs\./.test(content);
}

function fileHasLlCall(content) {
  return content.includes("createCompletion") || content.includes("chat.completions") || content.includes("openai.chat");
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) { total++; try { fn(); passed++; console.log(`${PASS} [a463-safety] ${name}`); } catch (e) { failed++; console.log(`${FAIL} [a463-safety] ${name}\n       ${e.message}`); } }

// ---- No .env.local reading ----

for (const relPath of A463_SOURCE_FILES) {
  t(`${relPath} does not read .env.local`, () => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    assert.ok(!fileReadsEnvLocal(fullPath), `${relPath} reads .env.local`);
  });
}

// ---- No secret leaks ----

for (const relPath of A463_SOURCE_FILES) {
  t(`${relPath} has no hardcoded secrets`, () => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    const secret = fileContainsSecrets(fullPath);
    assert.ok(!secret, `${relPath}: found ${secret}`);
  });
}

// ---- No LLM/tool/Agent calls ----

t("third-party-api-config.ts has no OpenAI/Anthropic references", () => {
  const fullPath = path.join(PROJECT_ROOT, "packages/shared/src/third-party-api-config.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!c.includes("openai"));
    assert.ok(!c.includes("anthropic"));
  }
});

t("third-party-api-health-check.ts has no LLM provider references", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/lib/third-party-api-health-check.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!fileHasLlCall(c), "Has LLM call");
  }
});

t("admin-status-center.ts phone/email code has no LLM calls", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/lib/admin-status-center.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    const phoneIdx = c.indexOf("collectPhoneAuthStatus");
    const emailIdx = c.indexOf("collectEmailAuthStatus");
    if (phoneIdx >= 0) {
      const section = c.slice(phoneIdx, emailIdx > 0 ? emailIdx : undefined);
      assert.ok(!fileHasLlCall(section), "Phone auth section has LLM call");
      assert.ok(!section.includes("fetch("), "Phone auth section calls fetch");
    }
  }
});

// ---- No SMS/email sending ----

t("health check module has no SMS send logic", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/lib/third-party-api-health-check.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!c.includes("sendSms"));
    assert.ok(!c.includes("sendMessage"));
  }
});

t("health check module has no email send logic", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/lib/third-party-api-health-check.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!c.includes("sendEmail"));
    assert.ok(!c.includes("sendMail"));
    assert.ok(!c.includes("transporter.sendMail"));
  }
});

t("login page has no enabled SMS/email send actions", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/app/auth/login/page.tsx");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    // "不会发送验证码" is a safety message, not a fake success.
    // Only flag standalone assertions that claim success.
    assert.ok(!/<button[^>]*>\s*发送验证码/.test(c), "Has '发送验证码' action button");
    assert.ok(!/<button[^>]*>\s*发送邮件/.test(c), "Has '发送邮件' action button");
    assert.ok(!c.includes("验证码已发送"), "Has '验证码已发送' fake success text");
    assert.ok(!c.includes("邮件已发送"), "Has '邮件已发送' fake success text");
  }
});

// ---- No Prisma/db push/migration ----

for (const relPath of A463_SOURCE_FILES) {
  if (relPath.includes("test.")) continue;
  t(`${relPath} does not import @prisma/client`, () => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      const c = fs.readFileSync(fullPath, "utf-8");
      assert.ok(!c.includes("@prisma/client"), `Imports @prisma/client`);
    }
  });
}

for (const relPath of A463_SOURCE_FILES) {
  if (relPath.includes("test.")) continue;
  t(`${relPath} does not reference prisma migrate/push/generate`, () => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      const c = fs.readFileSync(fullPath, "utf-8");
      assert.ok(!c.includes("prisma migrate"), `References prisma migrate`);
      assert.ok(!c.includes("prisma db push"), `References prisma db push`);
      assert.ok(!c.includes("prisma generate"), `References prisma generate`);
    }
  });
}

// ---- .env.local file references (not read) ----

for (const relPath of A463_SOURCE_FILES) {
  if (relPath.includes("THIRD_PARTY_API_ENV")) continue; // Doc is allowed to mention .env.local
  t(`${relPath} does not reference .env.local as file to read`, () => {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      const c = fs.readFileSync(fullPath, "utf-8");
      const readsFile = /readFile.*\.env\.local/i.test(c) || /dotenv.*\.env\.local/i.test(c) || /require.*\.env\.local/.test(c);
      assert.ok(!readsFile, `Attempts to read .env.local`);
    }
  });
}

// ---- Production safety ----

t("contracts have productionReady: false", () => {
  const fullPath = path.join(PROJECT_ROOT, "packages/shared/src/third-party-api-config.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    const matches = c.match(/productionReady:\s*true/g);
    assert.ok(!matches, "Found productionReady: true");
  }
});

t("contracts have devOnly: true", () => {
  const fullPath = path.join(PROJECT_ROOT, "packages/shared/src/third-party-api-config.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    const matches = c.match(/devOnly:\s*false/g);
    assert.ok(!matches, "Found devOnly: false");
  }
});

t("health check module documents @safeToExposeToClient", () => {
  const fullPath = path.join(PROJECT_ROOT, "apps/web/src/lib/third-party-api-health-check.ts");
  if (fs.existsSync(fullPath)) {
    const c = fs.readFileSync(fullPath, "utf-8");
    assert.ok(c.includes("@safeToExposeToClient"), "Missing @safeToExposeToClient doc");
  }
});

console.log(`\nA463 Safety: ${total} tests, ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
