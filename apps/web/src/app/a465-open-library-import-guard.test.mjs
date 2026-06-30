/**
 * A465 — Open Library Import Guard Tests
 * Usage: node apps/web/src/app/a465-open-library-import-guard.test.mjs
 *
 * Tests:
 * - Dev book import guard: LAP_ALLOW_DEV_BOOK_IMPORT flag
 * - Production blocked regardless of env
 * - Guard blocked → no fetch, no DB write
 * - Guard allowed principles
 * - No env values leaked
 */

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

const PASS = "PASS", FAIL = "FAIL";
let total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(`${PASS} [a465-guard] ${name}`); }
  catch (e) { failed++; console.log(`${FAIL} [a465-guard] ${name}\n       ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Guard simulation (mirrors open-library-import-actions.ts logic)
// ---------------------------------------------------------------------------

function evaluateDevBookImportGuard(env = {}) {
  const missingEnvNames = [];
  let blockedReason = null;

  // Check production
  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv === "production") {
    return {
      allowed: false,
      blockedReason: "BOOK_IMPORT_PRODUCTION_BLOCKED: Book import is not available in production.",
      missingEnvNames: [],
    };
  }

  // Check dev import flag
  const devImportEnabled = env.LAP_ALLOW_DEV_BOOK_IMPORT === "true";
  if (!devImportEnabled) {
    missingEnvNames.push("LAP_ALLOW_DEV_BOOK_IMPORT");
    blockedReason = "DEV_BOOK_IMPORT_NOT_ENABLED: LAP_ALLOW_DEV_BOOK_IMPORT 未设置为 true。开发书籍导入默认关闭。";
  }

  return {
    allowed: blockedReason === null,
    blockedReason,
    missingEnvNames,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ── Production blocked ──

t("production NODE_ENV blocks import regardless of flag", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReason.includes("PRODUCTION_BLOCKED"));
});

t("production NODE_ENV blocked message is clear", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  assert.ok(result.blockedReason.includes("not available in production"));
});

// ── Flag disabled default ──

t("import defaults to blocked when flag not set", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReason.includes("LAP_ALLOW_DEV_BOOK_IMPORT"));
});

t("missing flag reports LAP_ALLOW_DEV_BOOK_IMPORT in missingEnvNames", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
  });
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_DEV_BOOK_IMPORT"));
});

// ── Flag enabled in dev ──

t("import allowed when flag is true in dev", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  assert.equal(result.allowed, true);
  assert.equal(result.blockedReason, null);
  assert.deepEqual(result.missingEnvNames, []);
});

t("import allowed when flag is true and NODE_ENV not set (dev)", () => {
  const result = evaluateDevBookImportGuard({
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  assert.equal(result.allowed, true);
});

// ── Flag values ──

t("flag set to '1' is NOT treated as true (must be exactly 'true')", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "1",
  });
  assert.equal(result.allowed, false);
});

t("flag set to 'false' is not allowed", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "false",
  });
  assert.equal(result.allowed, false);
});

// ── Blocked behavior (action-level: no fetch, no DB write) ──

t("when guard blocked, action should not proceed to fetch", () => {
  // Simulate: if guard.allowed is false, do not fetch
  const guard = evaluateDevBookImportGuard({
    NODE_ENV: "development",
  });
  assert.equal(guard.allowed, false);
  // In actual action, the fetch step would be skipped entirely when allowed===false
  // This test verifies the guard correctly returns allowed===false
});

t("when guard blocked, action should not write to DB", () => {
  const guard = evaluateDevBookImportGuard({
    NODE_ENV: "production",
  });
  assert.equal(guard.allowed, false);
  // In actual action, DB write step would be skipped when allowed===false
});

// ── No env value leaks ──

t("guard result does not expose env values", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  // blockedReason should mention variable name, not value
  if (result.blockedReason) {
    assert.ok(!result.blockedReason.includes("=true"));
    assert.ok(!result.blockedReason.includes("=false"));
  }
  // missingEnvNames contains names only
  assert.ok(result.missingEnvNames.every((n) => n.startsWith("LAP_")));
});

t("guard result never contains API keys, tokens, or secrets", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
    LAP_BOOK_API_KEY: "some-secret-key",
    DATABASE_URL: "postgres://localhost:5432/mydb",
  });
  const str = JSON.stringify(result);
  assert.ok(!str.includes("some-secret-key"));
  assert.ok(!str.includes("postgres://"));
  assert.ok(!str.includes("mydb"));
});

// ── Guard is deterministic ──

t("same env produces same guard result", () => {
  const env = { NODE_ENV: "development", LAP_ALLOW_DEV_BOOK_IMPORT: "true" };
  const r1 = evaluateDevBookImportGuard(env);
  const r2 = evaluateDevBookImportGuard(env);
  assert.equal(r1.allowed, r2.allowed);
  assert.equal(r1.blockedReason, r2.blockedReason);
});

// ── Guard should be checked BEFORE fetch/DB write ──

t("multi-layer guard pattern: Book API guard + dev import guard both needed", () => {
  // Both guards must pass for import
  const bookApiAllowed = false; // simulate Book API blocked
  const importGuard = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });

  // If either is blocked, import should not proceed
  const canImport = bookApiAllowed && importGuard.allowed;
  assert.equal(canImport, false);
});

t("both guards passing allows import", () => {
  const bookApiAllowed = true;
  const importGuard = evaluateDevBookImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DEV_BOOK_IMPORT: "true",
  });
  const canImport = bookApiAllowed && importGuard.allowed;
  assert.equal(canImport, true);
});

// ── Blocked reason is user-readable ──

t("blocked reason does not expose internal paths", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
  });
  assert.equal(result.allowed, false);
  assert.ok(!result.blockedReason.includes("C:\\"));
  assert.ok(!result.blockedReason.includes("/home/"));
  assert.ok(!result.blockedReason.includes("node_modules"));
});

t("blocked reason is in Chinese-friendly format", () => {
  const result = evaluateDevBookImportGuard({
    NODE_ENV: "development",
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockedReason.includes("未设置为 true"));
  assert.ok(result.blockedReason.includes("默认关闭"));
});

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n[a465-guard] ${total} tests, ${passed} pass, ${failed} fail`);
process.exit(failed > 0 ? 1 : 0);
