/**
 * A458 DOCX Import Guard tests.
 *
 * Covers:
 * - production blocked
 * - env missing → blocked
 * - env allowed → enabled
 * - no env value leak
 * - isDocxImportEnabled / assertDocxImportAllowed
 * - distinct from PDF guard (no crosstalk)
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import {
  evaluateDocxImportGuard,
  isDocxImportEnabled,
  assertDocxImportAllowed,
} from "../lib/docx-import-guard.ts";

// ---------------------------------------------------------------------------
// evaluateDocxImportGuard
// ---------------------------------------------------------------------------

test("A458 guard: production always blocked regardless of env", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, true);
  assert.ok(result.reason.includes("PRODUCTION_BLOCKED"));
  assert.ok(result.reason.includes("生产环境"));
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.devOnly, true);
});

test("A458 guard: production blocked even without explicit env", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "production",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, true);
});

test("A458 guard: dev env missing LAP_ALLOW_DOCX_IMPORT → blocked", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_DOCX_IMPORT"));
  assert.ok(result.reason.includes("LAP_ALLOW_DOCX_IMPORT"));
  assert.ok(result.reason.includes("默认关闭"));
});

test("A458 guard: dev env with LAP_ALLOW_DOCX_IMPORT=true → enabled", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.blocked, false);
  assert.equal(result.productionBlocked, false);
  assert.equal(result.missingEnvNames.length, 0);
  assert.ok(result.configuredEnvNames.includes("LAP_ALLOW_DOCX_IMPORT"));
  assert.ok(result.reason.includes("已启用"));
  assert.ok(result.reason.includes("仅纯文本提取"));
  assert.ok(result.reason.includes("不保留样式"));
});

test("A458 guard: dev env with LAP_ALLOW_DOCX_IMPORT=1 → blocked (exact match)", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "1",
  });

  // Guard checks for exact "true" string
  assert.equal(result.enabled, false);
});

test("A458 guard: does NOT leak env value", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  // The reason should never contain "true" as a value reference
  assert.ok(!result.reason.includes("=true") || result.reason.includes("未设置"));
  assert.ok(!result.reason.includes("DATABASE_URL"));
  assert.ok(!result.reason.includes("password"));
  assert.ok(!result.reason.includes("secret"));
  assert.ok(!result.reason.includes("token"));
  assert.ok(!result.reason.includes("api_key"));
});

test("A458 guard: safeToExposeToClient always true", () => {
  const blocked = evaluateDocxImportGuard({ NODE_ENV: "production" });
  const missingEnv = evaluateDocxImportGuard({ NODE_ENV: "development" });
  const enabled = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  assert.equal(blocked.safeToExposeToClient, true);
  assert.equal(missingEnv.safeToExposeToClient, true);
  assert.equal(enabled.safeToExposeToClient, true);
});

test("A458 guard: devOnly always true", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  assert.equal(result.devOnly, true);
});

test("A458 guard: requiredEnvNames always includes LAP_ALLOW_DOCX_IMPORT", () => {
  const result = evaluateDocxImportGuard({ NODE_ENV: "development" });

  assert.ok(result.requiredEnvNames.includes("LAP_ALLOW_DOCX_IMPORT"));
});

// ---------------------------------------------------------------------------
// isDocxImportEnabled convenience
// ---------------------------------------------------------------------------

test("A458 guard: isDocxImportEnabled returns false when blocked", () => {
  assert.equal(
    isDocxImportEnabled({ NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isDocxImportEnabled({ NODE_ENV: "development" }),
    false,
  );
});

test("A458 guard: isDocxImportEnabled returns true when allowed", () => {
  assert.equal(
    isDocxImportEnabled({
      NODE_ENV: "development",
      LAP_ALLOW_DOCX_IMPORT: "true",
    }),
    true,
  );
});

// ---------------------------------------------------------------------------
// assertDocxImportAllowed
// ---------------------------------------------------------------------------

test("A458 guard: assertDocxImportAllowed throws when blocked", () => {
  assert.throws(
    () => assertDocxImportAllowed({ NODE_ENV: "production" }),
    /DOCX import blocked/,
  );

  assert.throws(
    () => assertDocxImportAllowed({ NODE_ENV: "development" }),
    /DOCX import blocked/,
  );
});

test("A458 guard: assertDocxImportAllowed does not throw when allowed", () => {
  assert.doesNotThrow(() =>
    assertDocxImportAllowed({
      NODE_ENV: "development",
      LAP_ALLOW_DOCX_IMPORT: "true",
    }),
  );
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("A458 guard: missing NODE_ENV treated as non-production", () => {
  const result = evaluateDocxImportGuard({
    LAP_ALLOW_DOCX_IMPORT: "true",
  });

  assert.equal(result.productionBlocked, false);
  assert.equal(result.enabled, true);
});

test("A458 guard: empty string env not treated as enabled", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_DOCX_IMPORT: "",
  });

  assert.equal(result.enabled, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_DOCX_IMPORT"));
});

// ---------------------------------------------------------------------------
// PDF/DOCX guard independence
// ---------------------------------------------------------------------------

test("A458 guard: DOCX guard uses LAP_ALLOW_DOCX_IMPORT not PDF env", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true", // PDF guard env, not DOCX
  });

  // Should still be blocked because DOCX env is not set
  assert.equal(result.enabled, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_DOCX_IMPORT"));
});

test("A458 guard: DOCX guard reason does not mention PDF", () => {
  const result = evaluateDocxImportGuard({
    NODE_ENV: "development",
  });

  // DOCX guard reason should be about DOCX, not PDF
  assert.ok(!result.reason.includes("PDF"));
});
