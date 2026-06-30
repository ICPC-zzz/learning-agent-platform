/**
 * Tests for the imported draft DB write guard.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import in node:test
import {
  createImportedDraftDbWriteGuardResult,
  evaluateImportedDraftDbWriteGuard,
} from "./imported-draft-db-write-guard.ts";

test("imported draft DB write guard helper is blocked by default inputs", () => {
  const result = createImportedDraftDbWriteGuardResult({
    importedDraftDbDevEnabled: false,
    allowRealDbIntegration: true,
    databaseUrlConfigured: true,
  });

  assert.equal(result.enabled, false);
  assert.equal(result.writesDatabaseAllowed, false);
  assert.equal(result.productionReady, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.blockedReasons.length > 0, true);
  assert.equal(
    result.blockedReasons.some((reason) =>
      reason.includes("LAP_IMPORTED_DRAFT_DB_DEV_ENABLED"),
    ),
    true,
  );
});

test("imported draft DB write guard helper enables only when all inputs are true", () => {
  const result = createImportedDraftDbWriteGuardResult({
    importedDraftDbDevEnabled: true,
    allowRealDbIntegration: true,
    databaseUrlConfigured: true,
  });

  assert.equal(result.enabled, true);
  assert.equal(result.writesDatabaseAllowed, true);
  assert.equal(result.blockedReasons.length, 0);
});

test("imported draft DB write guard helper blocks when real DB integration is disabled", () => {
  const result = createImportedDraftDbWriteGuardResult({
    importedDraftDbDevEnabled: true,
    allowRealDbIntegration: false,
    databaseUrlConfigured: true,
  });

  assert.equal(result.enabled, false);
  assert.equal(
    result.blockedReasons.some((reason) =>
      reason.includes("LAP_ALLOW_REAL_DB_INTEGRATION"),
    ),
    true,
  );
});

test("imported draft DB write guard helper blocks when database URL is missing", () => {
  const result = createImportedDraftDbWriteGuardResult({
    importedDraftDbDevEnabled: true,
    allowRealDbIntegration: true,
    databaseUrlConfigured: false,
  });

  assert.equal(result.enabled, false);
  assert.equal(
    result.blockedReasons.some((reason) => reason.includes("DATABASE_URL_MISSING")),
    true,
  );
});

test("evaluateImportedDraftDbWriteGuard source keeps env gate references", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("./imported-draft-db-write-guard.ts", import.meta.url), "utf8"),
  );

  assert.equal(source.includes("LAP_IMPORTED_DRAFT_DB_DEV_ENABLED"), true);
  assert.equal(source.includes("LAP_ALLOW_REAL_DB_INTEGRATION"), true);
  assert.equal(source.includes("DATABASE_URL_MISSING"), true);
  assert.equal(source.includes("createImportedDraftDbWriteGuardResult"), true);
  assert.equal(source.includes("safeToExposeToClient"), true);
  assert.equal(source.includes("writesDatabaseAllowed"), true);
  assert.equal(source.includes("productionReady: false"), true);
  assert.equal(source.includes("createBlockedImportedDraftDbWriteGuard"), true);
});
