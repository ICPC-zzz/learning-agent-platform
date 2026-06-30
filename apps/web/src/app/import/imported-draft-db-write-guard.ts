/**
 * Imported draft dev DB write guard.
 *
 * This guard stays disabled by default. It only enables the dev-only
 * Book/BookChapter write path when the explicit integration flags are on
 * and a database URL is configured.
 */

import { hasDatabaseUrl } from "@learning-agent-platform/db";

export interface ImportedDraftDbWriteGuardResult {
  enabled: boolean;
  mode: "dev-only";
  writesDatabaseAllowed: boolean;
  productionReady: false;
  safeToExposeToClient: true;
  blockedReasons: string[];
}

const ENV_IMPORTED_DRAFT_DB_DEV_ENABLED =
  "LAP_IMPORTED_DRAFT_DB_DEV_ENABLED";
const ENV_ALLOW_REAL_DB_INTEGRATION = "LAP_ALLOW_REAL_DB_INTEGRATION";

let cachedImportedDraftDbDevEnabled: boolean | null = null;
let cachedAllowRealDbIntegration: boolean | null = null;
let cachedHasDatabaseUrl: boolean | null = null;

function readImportedDraftDbDevEnabled(): boolean {
  if (cachedImportedDraftDbDevEnabled !== null) {
    return cachedImportedDraftDbDevEnabled;
  }

  try {
    cachedImportedDraftDbDevEnabled =
      process.env[ENV_IMPORTED_DRAFT_DB_DEV_ENABLED] === "true";
  } catch {
    cachedImportedDraftDbDevEnabled = false;
  }

  return cachedImportedDraftDbDevEnabled;
}

function readAllowRealDbIntegration(): boolean {
  if (cachedAllowRealDbIntegration !== null) {
    return cachedAllowRealDbIntegration;
  }

  try {
    cachedAllowRealDbIntegration =
      process.env[ENV_ALLOW_REAL_DB_INTEGRATION] === "true";
  } catch {
    cachedAllowRealDbIntegration = false;
  }

  return cachedAllowRealDbIntegration;
}

function readHasDatabaseUrl(): boolean {
  if (cachedHasDatabaseUrl !== null) {
    return cachedHasDatabaseUrl;
  }

  try {
    cachedHasDatabaseUrl = hasDatabaseUrl();
  } catch {
    cachedHasDatabaseUrl = false;
  }

  return cachedHasDatabaseUrl;
}

export function evaluateImportedDraftDbWriteGuard(): ImportedDraftDbWriteGuardResult {
  return createImportedDraftDbWriteGuardResult({
    importedDraftDbDevEnabled: readImportedDraftDbDevEnabled(),
    allowRealDbIntegration: readAllowRealDbIntegration(),
    databaseUrlConfigured: readHasDatabaseUrl(),
  });
}

export function createImportedDraftDbWriteGuardResult(input: {
  importedDraftDbDevEnabled: boolean;
  allowRealDbIntegration: boolean;
  databaseUrlConfigured: boolean;
}): ImportedDraftDbWriteGuardResult {
  const blockedReasons: string[] = [];

  if (!input.importedDraftDbDevEnabled) {
    blockedReasons.push(
      "IMPORTED_DRAFT_DB_DEV_DISABLED: LAP_IMPORTED_DRAFT_DB_DEV_ENABLED is not true.",
    );
  }

  if (!input.allowRealDbIntegration) {
    blockedReasons.push(
      "REAL_DB_INTEGRATION_DISABLED: LAP_ALLOW_REAL_DB_INTEGRATION is not true.",
    );
  }

  if (!input.databaseUrlConfigured) {
    blockedReasons.push(
      "DATABASE_URL_MISSING: database connection is not configured.",
    );
  }

  const enabled =
    input.importedDraftDbDevEnabled &&
    input.allowRealDbIntegration &&
    input.databaseUrlConfigured;

  return {
    enabled,
    mode: "dev-only",
    writesDatabaseAllowed: enabled,
    productionReady: false,
    safeToExposeToClient: true,
    blockedReasons,
  };
}

export function createBlockedImportedDraftDbWriteGuard(
  reason = "Imported draft dev DB write is disabled by default.",
): ImportedDraftDbWriteGuardResult {
  return {
    enabled: false,
    mode: "dev-only",
    writesDatabaseAllowed: false,
    productionReady: false,
    safeToExposeToClient: true,
    blockedReasons: [reason],
  };
}

export function isImportedDraftDbWriteEnabled(): boolean {
  return evaluateImportedDraftDbWriteGuard().enabled;
}
