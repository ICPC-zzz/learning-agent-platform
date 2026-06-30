/**
 * A457 PDF Import Guard tests.
 *
 * Covers:
 * - production blocked
 * - env missing → blocked
 * - env allowed → enabled
 * - no env value leak
 * - isPdfImportEnabled / assertPdfImportAllowed
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import
import {
  evaluatePdfImportGuard,
  isPdfImportEnabled,
  assertPdfImportAllowed,
} from "../lib/pdf-import-guard.ts";

// ---------------------------------------------------------------------------
// evaluatePdfImportGuard
// ---------------------------------------------------------------------------

test("A457 guard: production always blocked regardless of env", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "production",
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, true);
  assert.ok(result.reason.includes("PRODUCTION_BLOCKED"));
  assert.ok(result.reason.includes("生产环境"));
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.devOnly, true);
});

test("A457 guard: production blocked even without explicit env", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "production",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, true);
});

test("A457 guard: dev env missing LAP_ALLOW_PDF_IMPORT → blocked", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.blocked, true);
  assert.equal(result.productionBlocked, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_PDF_IMPORT"));
  assert.ok(result.reason.includes("LAP_ALLOW_PDF_IMPORT"));
  assert.ok(result.reason.includes("默认关闭"));
});

test("A457 guard: dev env with LAP_ALLOW_PDF_IMPORT=true → enabled", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.blocked, false);
  assert.equal(result.productionBlocked, false);
  assert.equal(result.missingEnvNames.length, 0);
  assert.ok(result.configuredEnvNames.includes("LAP_ALLOW_PDF_IMPORT"));
  assert.ok(result.reason.includes("已启用"));
});

test("A457 guard: dev env with LAP_ALLOW_PDF_IMPORT=1 → blocked (only exact 'true' matches)", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "1",
  });

  // Note: our guard checks for exact "true" string, not "1"
  // This is intentional — consistent with other guards in the project
  assert.equal(result.enabled, false);
});

test("A457 guard: does NOT leak env value", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  // The reason should never contain "true" as a value reference
  // It should only mention the variable name
  assert.ok(!result.reason.includes("=true") || result.reason.includes("未设置"));
  assert.ok(!result.reason.includes("DATABASE_URL"));
  assert.ok(!result.reason.includes("password"));
  assert.ok(!result.reason.includes("secret"));
  assert.ok(!result.reason.includes("token"));
  assert.ok(!result.reason.includes("api_key"));
});

test("A457 guard: safeToExposeToClient always true", () => {
  const blocked = evaluatePdfImportGuard({ NODE_ENV: "production" });
  const missingEnv = evaluatePdfImportGuard({ NODE_ENV: "development" });
  const enabled = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  assert.equal(blocked.safeToExposeToClient, true);
  assert.equal(missingEnv.safeToExposeToClient, true);
  assert.equal(enabled.safeToExposeToClient, true);
});

test("A457 guard: devOnly always true", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  assert.equal(result.devOnly, true);
});

test("A457 guard: requiredEnvNames always includes LAP_ALLOW_PDF_IMPORT", () => {
  const result = evaluatePdfImportGuard({ NODE_ENV: "development" });

  assert.ok(result.requiredEnvNames.includes("LAP_ALLOW_PDF_IMPORT"));
});

// ---------------------------------------------------------------------------
// isPdfImportEnabled convenience
// ---------------------------------------------------------------------------

test("A457 guard: isPdfImportEnabled returns false when blocked", () => {
  assert.equal(
    isPdfImportEnabled({ NODE_ENV: "production" }),
    false,
  );
  assert.equal(
    isPdfImportEnabled({ NODE_ENV: "development" }),
    false,
  );
});

test("A457 guard: isPdfImportEnabled returns true when allowed", () => {
  assert.equal(
    isPdfImportEnabled({
      NODE_ENV: "development",
      LAP_ALLOW_PDF_IMPORT: "true",
    }),
    true,
  );
});

// ---------------------------------------------------------------------------
// assertPdfImportAllowed
// ---------------------------------------------------------------------------

test("A457 guard: assertPdfImportAllowed throws when blocked", () => {
  assert.throws(
    () => assertPdfImportAllowed({ NODE_ENV: "production" }),
    /PDF import blocked/,
  );

  assert.throws(
    () => assertPdfImportAllowed({ NODE_ENV: "development" }),
    /PDF import blocked/,
  );
});

test("A457 guard: assertPdfImportAllowed does not throw when allowed", () => {
  assert.doesNotThrow(() =>
    assertPdfImportAllowed({
      NODE_ENV: "development",
      LAP_ALLOW_PDF_IMPORT: "true",
    }),
  );
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("A457 guard: missing NODE_ENV treated as non-production", () => {
  const result = evaluatePdfImportGuard({
    LAP_ALLOW_PDF_IMPORT: "true",
  });

  // Without NODE_ENV, should not be production-blocked
  assert.equal(result.productionBlocked, false);
  assert.equal(result.enabled, true);
});

test("A457 guard: empty string env not treated as enabled", () => {
  const result = evaluatePdfImportGuard({
    NODE_ENV: "development",
    LAP_ALLOW_PDF_IMPORT: "",
  });

  assert.equal(result.enabled, false);
  assert.ok(result.missingEnvNames.includes("LAP_ALLOW_PDF_IMPORT"));
});
