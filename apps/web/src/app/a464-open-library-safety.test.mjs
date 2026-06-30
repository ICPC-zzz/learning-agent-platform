/**
 * A464 — Open Library Safety Boundary Tests
 * Usage: node apps/web/src/app/a464-open-library-safety.test.mjs
 *
 * Tests:
 * - A464 source files do NOT read .env.local
 * - No hardcoded secrets or API keys
 * - No env value leaks
 * - No raw external response storage
 * - No Prisma/db push/migration
 * - No LLM/tool/Agent loop calls
 * - No Codeforces/Resend/Phone Auth modifications
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = import.meta.url.replace(/^file:\/\//, "");
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");

const A464_SOURCE_FILES = [
  "apps/web/src/lib/open-library-client.ts",
  "apps/web/src/lib/open-library-adapter.ts",
  "apps/web/src/app/books/open-library-actions.ts",
  "apps/web/src/app/books/components/OpenLibrarySearchClient.tsx",
  "apps/web/src/app/books/page.tsx",
  "apps/web/src/app/import/page.tsx",
  "apps/web/src/lib/admin-status-center.ts",
];

const A464_TEST_FILES = [
  "apps/web/src/app/a464-open-library-client.test.mjs",
  "apps/web/src/app/a464-open-library-adapter.test.mjs",
  "apps/web/src/app/a464-open-library-safety.test.mjs",
];

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(`${PASS} [a464-safety] ${name}`); }
  catch (e) { failed++; console.log(`${FAIL} [a464-safety] ${name}\n       ${e.message}`); }
}

function resolvePath(relPath) {
  return path.join(PROJECT_ROOT, relPath);
}

// ---------------------------------------------------------------------------
// Secret patterns
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { name: "OpenAI key", regex: /sk-[A-Za-z0-9]{20,}/ },
  { name: "SendGrid key", regex: /SG\.[A-Za-z0-9_-]{20,}/ },
  { name: "API key assignment", regex: /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9+/=]{20,}["']?/i },
  { name: "Secret assignment", regex: /secret\s*[:=]\s*["']?[A-Za-z0-9+/=]{20,}["']?/i },
  { name: "SMS secret", regex: /LAP_SMS_API_SECRET\s*=\s*[A-Za-z0-9+/=]{10,}/ },
  { name: "SMTP password", regex: /LAP_SMTP_PASS\s*=\s*[A-Za-z0-9@#$%^&*]{5,}/ },
  { name: "DATABASE_URL", regex: /DATABASE_URL\s*[:=]\s*["']?postgres:\/\/[^\s"']+/i },
  { name: "Bearer token", regex: /bearer\s+[A-Za-z0-9_\-.]{20,}/i },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function fileReadsEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  return /\.env\.local/.test(content) && /readFile|dotenv|fs\.read|readEnv/.test(content);
}

function fileContainsSecrets(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) return pattern.name;
  }
  return false;
}

function fileHasEnvValueLeaks(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  // Check for env value assignment patterns (not just name references)
  // This is a conservative check: process.env.XYZ = "..." or = '...' in source
  const envValuePattern = /process\.env\.\w+\s*=\s*["'][^"']+["']/;
  return envValuePattern.test(content);
}

function fileHasRawResponseStorage(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  // Checks for patterns indicating raw external response storage
  const patterns = [
    /localStorage.*setItem.*raw/i,
    /sessionStorage.*setItem.*response/i,
    /fs\.writeFile.*response/i,
    /storeRawResponse/i,
  ];
  return patterns.some(p => p.test(content));
}

function fileHasLlCall(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  const patterns = [
    /createCompletion/i,
    /chat\.completions/i,
    /openai\.chat/i,
    /ai\(/i,
    /generateText/i,
    /streamText/i,
  ];
  return patterns.some(p => p.test(content));
}

function fileHasDbWrite(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  const patterns = [
    /prisma\.\$executeRaw/i,
    /prisma\.\$queryRaw/i,
    /\.create\(/i,
    /\.upsert\(/i,
    /\.delete\(/i,
    /migration/i,
  ];
  return patterns.some(p => p.test(content));
}

function fileModifiesCodeforces(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  return /codeforces/i.test(content) && !/import/i.test(content);
}

function fileModifiesResend(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  return /resend/i.test(content) && !/import/i.test(content);
}

function fileModifiesPhone(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  return /phone.sms.otp/i.test(content) || /LAP_SMS_/i.test(content);
}

// ---------------------------------------------------------------------------
// Tests: .env.local
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} does not read .env.local`, () => {
    const fullPath = resolvePath(relPath);
    assert.ok(!fileReadsEnvLocal(fullPath), `${relPath} appears to read .env.local`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No secrets
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} has no hardcoded secrets`, () => {
    const fullPath = resolvePath(relPath);
    const secret = fileContainsSecrets(fullPath);
    assert.ok(!secret, `${relPath}: found ${secret}`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No env value leaks
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} does not leak env values`, () => {
    const fullPath = resolvePath(relPath);
    assert.ok(!fileHasEnvValueLeaks(fullPath), `${relPath} appears to hardcode an env value assignment`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No raw external response storage
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} does not store raw external responses`, () => {
    const fullPath = resolvePath(relPath);
    assert.ok(!fileHasRawResponseStorage(fullPath), `${relPath} appears to store raw external responses`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No LLM/tool/Agent calls
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} does not call LLM/tool/Agent`, () => {
    const fullPath = resolvePath(relPath);
    assert.ok(!fileHasLlCall(fullPath), `${relPath} appears to call an LLM/tool`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No DB writes (import → DB)
// ---------------------------------------------------------------------------

for (const relPath of A464_SOURCE_FILES) {
  t(`${relPath} does not write to DB`, () => {
    const fullPath = resolvePath(relPath);
    assert.ok(!fileHasDbWrite(fullPath), `${relPath} appears to write to DB`);
  });
}

// ---------------------------------------------------------------------------
// Tests: No Codeforces/Resend/Phone Auth modifications
// ---------------------------------------------------------------------------

t("No Codeforces modifications in A464 files", () => {
  for (const relPath of A464_SOURCE_FILES) {
    const fullPath = resolvePath(relPath);
    if (fileModifiesCodeforces(fullPath)) {
      assert.fail(`${relPath} appears to modify Codeforces logic`);
    }
  }
  assert.ok(true);
});

t("No Resend modifications in A464 files", () => {
  for (const relPath of A464_SOURCE_FILES) {
    const fullPath = resolvePath(relPath);
    if (fileModifiesResend(fullPath)) {
      assert.fail(`${relPath} appears to modify Resend logic`);
    }
  }
  assert.ok(true);
});

t("No Phone Auth modifications in A464 files (excluding admin-status-center)", () => {
  const excludeFiles = ["apps/web/src/lib/admin-status-center.ts"];
  for (const relPath of A464_SOURCE_FILES) {
    if (excludeFiles.includes(relPath)) continue; // admin-status-center legitimately shows all API statuses
    const fullPath = resolvePath(relPath);
    if (fileModifiesPhone(fullPath)) {
      assert.fail(`${relPath} appears to modify Phone Auth logic`);
    }
  }
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Tests: Adapter never returns raw data
// ---------------------------------------------------------------------------

t("open-library-adapter.ts does not export raw response types", () => {
  const fullPath = resolvePath("apps/web/src/lib/open-library-adapter.ts");
  if (!fs.existsSync(fullPath)) {
    // File may not exist; skip
    return;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  assert.ok(!content.includes("export function raw"));
  assert.ok(!content.includes("rawResponse"));
  assert.ok(!content.includes("_raw"));
});

// ---------------------------------------------------------------------------
// Tests: Client never leaks env values in return
// ---------------------------------------------------------------------------

t("open-library-client.ts does not include env values in return types", () => {
  const fullPath = resolvePath("apps/web/src/lib/open-library-client.ts");
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, "utf-8");
  // Check that return types don't contain env reference
  // The OpenLibraryClientResult type should NOT have env fields
  assert.ok(content.includes("_rawExposed: false"), "Client should mark raw data as not exposed");
});

// ---------------------------------------------------------------------------
// Tests: No migration/db push
// ---------------------------------------------------------------------------

t("No Prisma migration or db push in A464 files", () => {
  for (const relPath of A464_SOURCE_FILES) {
    const fullPath = resolvePath(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!content.includes("prisma migrate"), `${relPath}: contains migration command`);
    assert.ok(!content.includes("prisma db push"), `${relPath}: contains db push command`);
    assert.ok(!content.includes("prisma generate"), `${relPath}: contains generate command`);
  }
});

// ---------------------------------------------------------------------------
// Tests: No git operations in source
// ---------------------------------------------------------------------------

t("No git operations in A464 source files", () => {
  for (const relPath of A464_SOURCE_FILES) {
    const fullPath = resolvePath(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf-8");
    assert.ok(!content.includes("git add"), `${relPath}: contains 'git add'`);
    assert.ok(!content.includes("git commit"), `${relPath}: contains 'git commit'`);
    assert.ok(!content.includes("git push"), `${relPath}: contains 'git push'`);
  }
});

// ---------------------------------------------------------------------------
// Tests: External label consistency
// ---------------------------------------------------------------------------

t("All external results use '外部数据预览 · 未导入本地' label", () => {
  const adapterPath = resolvePath("apps/web/src/lib/open-library-adapter.ts");
  if (!fs.existsSync(adapterPath)) return;
  const content = fs.readFileSync(adapterPath, "utf-8");
  const occurrences = (content.match(/外部数据预览/g) || []).length;
  const importedLabelOccurrences = (content.match(/未导入本地/g) || []).length;
  assert.ok(occurrences >= 2, `Expected at least 2 occurrences of '外部数据预览', found ${occurrences}`);
  assert.ok(importedLabelOccurrences >= 2, `Expected at least 2 occurrences of '未导入本地', found ${importedLabelOccurrences}`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== A464 Safety Tests: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ""} ===`);

if (failed > 0) {
  process.exitCode = 1;
}
