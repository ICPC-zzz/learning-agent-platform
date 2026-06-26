import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createBlockedReadingProgressDbIntegrationGuardPreview,
  evaluateReadingProgressDbIntegrationGuard,
} from "./reading-progress-db-integration-guard.ts";

function makeSafeInput(overrides) {
  var o = overrides || {};
  return Object.assign(
    {
      explicitUserAuthorization:
        o.explicitUserAuthorization !== undefined ? o.explicitUserAuthorization : false,
      allowRealDatabaseConnection:
        o.allowRealDatabaseConnection !== undefined ? o.allowRealDatabaseConnection : false,
      allowPrismaClientRuntime:
        o.allowPrismaClientRuntime !== undefined ? o.allowPrismaClientRuntime : false,
      allowDatabaseWrite:
        o.allowDatabaseWrite !== undefined ? o.allowDatabaseWrite : false,
      databaseUrlPresent:
      o.databaseUrlPresent !== undefined ? o.databaseUrlPresent : false,
      testDatabaseOnly:
        o.testDatabaseOnly !== undefined ? o.testDatabaseOnly : false,
      environmentName:
        o.environmentName !== undefined ? o.environmentName : "test",
      allowLocalDevelopmentDatabase:
        o.allowLocalDevelopmentDatabase !== undefined
          ? o.allowLocalDevelopmentDatabase
          : true,
      acknowledgedNoProductionDatabase:
        o.acknowledgedNoProductionDatabase !== undefined
          ? o.acknowledgedNoProductionDatabase
          : true,
      destructiveWriteAllowed:
        o.destructiveWriteAllowed !== undefined ? o.destructiveWriteAllowed : false,
      migrationAllowed:
        o.migrationAllowed !== undefined ? o.migrationAllowed : false,
    },
    o,
  );
}

test("default preview stays blocked and skip-by-default", function () {
  var preview = createBlockedReadingProgressDbIntegrationGuardPreview();

  assert.equal(preview.previewOnly, true);
  assert.equal(preview.implemented, true);
  assert.equal(preview.guardImplemented, true);
  assert.equal(preview.safeToExposeToClient, true);
  assert.equal(preview.canRunDbIntegrationTest, false);
  assert.equal(preview.canConnectRealDatabase, false);
  assert.equal(preview.canWriteDatabase, false);
  assert.equal(preview.mustSkipByDefault, true);
  assert.ok(preview.blockedReasons.length > 0);
  assert.ok(
    preview.blockedReasons.some(function (reason) {
      return reason.indexOf("DEFAULT_SKIP") !== -1;
    }),
  );
  assert.ok(
    preview.requiredAuthorizations.indexOf("explicitUserAuthorization=true") !== -1,
  );
  assert.ok(preview.nextSafeSteps.length >= 3);
});

test("default input is blocked and does not enable a DB integration path", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(makeSafeInput());

  assert.equal(result.status, "blocked");
  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, false);
  assert.equal(result.canWriteDatabase, false);
  assert.equal(result.mustSkipByDefault, true);
  assert.ok(result.blockedReasons.length > 0);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("explicitUserAuthorization") !== -1;
    }),
  );
});

test("missing explicit authorization stays blocked even if the other switches are on", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      environmentName: "test",
      allowLocalDevelopmentDatabase: true,
      acknowledgedNoProductionDatabase: true,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, false);
  assert.equal(result.canWriteDatabase, false);
  assert.equal(result.mustSkipByDefault, true);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("EXPLICIT_USER_AUTHORIZATION_REQUIRED") !== -1;
    }),
  );
});

test("databaseUrlPresent is required before the guard can ever allow the integration path", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      testDatabaseOnly: true,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, false);
  assert.equal(result.canWriteDatabase, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("DATABASE_URL_PRESENT_REQUIRED") !== -1;
    }),
  );
});

test("allowDatabaseWrite=false blocks the write path", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      allowDatabaseWrite: false,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, true);
  assert.equal(result.canWriteDatabase, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("ALLOW_DATABASE_WRITE_REQUIRED") !== -1;
    }),
  );
});

test("destructiveWriteAllowed=true is blocked", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      destructiveWriteAllowed: true,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, true);
  assert.equal(result.canWriteDatabase, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("DESTRUCTIVE_WRITE_NOT_ALLOWED") !== -1;
    }),
  );
});

test("migrationAllowed=true is blocked", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      migrationAllowed: true,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, true);
  assert.equal(result.canWriteDatabase, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("MIGRATION_NOT_ALLOWED") !== -1;
    }),
  );
});

test("all safe conditions together allow the guard to preview a real-db test path without connecting", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      environmentName: "test",
      allowLocalDevelopmentDatabase: true,
      acknowledgedNoProductionDatabase: true,
      destructiveWriteAllowed: false,
      migrationAllowed: false,
    }),
  );

  assert.equal(result.status, "preview");
  assert.equal(result.canRunDbIntegrationTest, true);
  assert.equal(result.canConnectRealDatabase, true);
  assert.equal(result.canWriteDatabase, true);
  assert.equal(result.mustSkipByDefault, false);
  assert.equal(result.blockedReasons.length, 0);
  assert.equal(result.safeToExposeToClient, true);
});

test("production-like environments stay blocked even when the rest of the switches are enabled", function () {
  var result = evaluateReadingProgressDbIntegrationGuard(
    makeSafeInput({
      explicitUserAuthorization: true,
      allowRealDatabaseConnection: true,
      allowPrismaClientRuntime: true,
      allowDatabaseWrite: true,
      databaseUrlPresent: true,
      testDatabaseOnly: true,
      environmentName: "production",
      allowLocalDevelopmentDatabase: true,
      acknowledgedNoProductionDatabase: true,
      destructiveWriteAllowed: false,
      migrationAllowed: false,
    }),
  );

  assert.equal(result.canRunDbIntegrationTest, false);
  assert.equal(result.canConnectRealDatabase, false);
  assert.equal(result.canWriteDatabase, false);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("ENVIRONMENT_NAME_NOT_TEST_ONLY") !== -1;
    }),
  );
});

test("dangerous fields do not transit through the guard preview", function () {
  var dirtyInput = Object.create(null);
  Object.assign(dirtyInput, makeSafeInput());
  dirtyInput.token = "token-secret";
  dirtyInput.secret = "top-secret";
  dirtyInput.password = "password-secret";
  dirtyInput.cookie = "cookie-secret";
  dirtyInput.session = { id: "session-secret" };
  dirtyInput.databaseUrl = "postgres://real-db";
  dirtyInput.DATABASE_URL = "postgres://real-db-uppercase";
  dirtyInput.rawEnv = { DATABASE_URL: "postgres://real-db" };
  dirtyInput.fetch = function () {};
  dirtyInput.window = {};
  dirtyInput.localStorage = {};
  Object.defineProperty(dirtyInput, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(dirtyInput, "constructor", {
    value: "constructor-secret",
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(dirtyInput, "prototype", {
    value: "prototype-secret",
    enumerable: true,
    configurable: true,
  });

  var result = evaluateReadingProgressDbIntegrationGuard(dirtyInput);
  var serialized = JSON.stringify(result);

  assert.equal(result.status, "blocked");
  assert.equal(serialized.indexOf("token-secret"), -1);
  assert.equal(serialized.indexOf("top-secret"), -1);
  assert.equal(serialized.indexOf("password-secret"), -1);
  assert.equal(serialized.indexOf("cookie-secret"), -1);
  assert.equal(serialized.indexOf("session-secret"), -1);
  assert.equal(serialized.indexOf("postgres://real-db"), -1);
  assert.equal(serialized.indexOf("constructor-secret"), -1);
  assert.equal(serialized.indexOf("prototype-secret"), -1);
  assert.ok(
    result.blockedReasons.some(function (reason) {
      return reason.indexOf("FORBIDDEN_FIELD") !== -1;
    }),
  );
});

test("guard source stays backend-free and never touches env, fetch, or browser globals", function () {
  var dirname = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
  var filePath = path.join(dirname, "reading-progress-db-integration-guard.ts");
  if (filePath.match(/^\/[A-Z]:\//)) {
    filePath = filePath.slice(1);
  }

  var content = fs.readFileSync(filePath, "utf-8");

  assert.equal(/process\.env/.test(content), false);
  assert.equal(/fetch\s*\(/.test(content), false);
  assert.equal(/window\./.test(content), false);
  assert.equal(/localStorage\s*\./.test(content), false);
  assert.equal(/from\s+["'].*@prisma\/client/i.test(content), false);
  assert.equal(/import\s+.*PrismaClient/i.test(content), false);
});
