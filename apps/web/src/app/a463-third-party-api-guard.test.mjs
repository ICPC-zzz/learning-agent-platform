/**
 * A463 — Third-Party API Guard Tests
 *
 * Tests for the unified guard behavior across all four capabilities.
 * Verifies:
 * - production blocked
 * - allow flag missing blocked
 * - required env missing blocked
 * - all configured → enabled
 * - no env values leaked in status output
 *
 * Usage: node apps/web/src/app/a463-third-party-api-guard.test.mjs
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// ---------------------------------------------------------------------------
// Guard evaluation (mirrors evaluateExternalApiDevGuard from shared package)
// ---------------------------------------------------------------------------

function parseBooleanEnv(value) {
  if (value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isConfigured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonProductionEnv(nodeEnv) {
  if (!isConfigured(nodeEnv)) return true;
  return nodeEnv.trim().toLowerCase() !== "production";
}

function evaluateExternalApiDevGuard(input) {
  const env = input.env ?? {};
  const missingEnvNames = new Set();
  const configuredEnvNames = new Set();
  const blockedReasons = [];
  const allowExternalEnabled = parseBooleanEnv(env[input.allowExternalEnvName]);

  if (!isNonProductionEnv(env.NODE_ENV)) {
    blockedReasons.push(
      input.providerLabel.toUpperCase().replace(/\s+/g, "_") +
        "_PRODUCTION_BLOCKED: NODE_ENV is production; external preview remains disabled.",
    );
  }

  if (!allowExternalEnabled) {
    missingEnvNames.add(input.allowExternalEnvName);
    blockedReasons.push(
      input.allowExternalEnvName +
        " is not enabled; external preview remains disabled.",
    );
  } else {
    configuredEnvNames.add(input.allowExternalEnvName);
  }

  for (const name of input.requiredEnvNames) {
    if (!isConfigured(env[name])) {
      missingEnvNames.add(name);
    } else {
      configuredEnvNames.add(name);
    }
  }

  if (missingEnvNames.size > 0) {
    blockedReasons.push(
      "Missing env: " + Array.from(missingEnvNames).join(", "),
    );
  }

  const allowed = blockedReasons.length === 0;
  const requiredEnvNames = [input.allowExternalEnvName, ...input.requiredEnvNames];

  return {
    providerMode: allowed ? "external-dev" : "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    allowed,
    blockedReason: blockedReasons[0] ?? null,
    requiredEnvNames,
    configuredEnvNames: Array.from(configuredEnvNames),
    missingEnvNames: Array.from(missingEnvNames),
  };
}

// ---------------------------------------------------------------------------
// Contract definitions (same as config module)
// ---------------------------------------------------------------------------

const BOOK_REQUIRED_ENV = [
  "LAP_BOOK_API_KEY",
  "LAP_BOOK_API_BASE_URL",
  "LAP_BOOK_API_PROVIDER",
];
const PROBLEM_REQUIRED_ENV = [
  "LAP_PROBLEM_API_KEY",
  "LAP_PROBLEM_API_BASE_URL",
  "LAP_PROBLEM_API_PROVIDER",
];
const PHONE_REQUIRED_ENV = [
  "LAP_SMS_PROVIDER",
  "LAP_SMS_API_BASE_URL",
  "LAP_SMS_API_KEY",
  "LAP_SMS_API_SECRET",
  "LAP_SMS_SIGN_NAME",
  "LAP_SMS_TEMPLATE_ID",
];
const EMAIL_REQUIRED_ENV = [
  "LAP_EMAIL_PROVIDER",
  "LAP_EMAIL_API_BASE_URL",
  "LAP_EMAIL_API_KEY",
  "LAP_EMAIL_FROM",
];

const ALL_CAPABILITIES = [
  { label: "Book API", allowEnv: "LAP_ALLOW_EXTERNAL_BOOK_API", required: BOOK_REQUIRED_ENV, cap: "book-api" },
  { label: "Problem API", allowEnv: "LAP_ALLOW_EXTERNAL_PROBLEM_API", required: PROBLEM_REQUIRED_ENV, cap: "problem-api" },
  { label: "Phone Auth (SMS)", allowEnv: "LAP_ALLOW_PHONE_AUTH", required: PHONE_REQUIRED_ENV, cap: "phone-auth" },
  { label: "Email Auth", allowEnv: "LAP_ALLOW_EMAIL_AUTH", required: EMAIL_REQUIRED_ENV, cap: "email-auth" },
];

// ---------------------------------------------------------------------------
// Helper to build full env map
// ---------------------------------------------------------------------------

function buildEnv(overrides = {}) {
  return {
    NODE_ENV: overrides.NODE_ENV ?? undefined,
    LAP_ALLOW_EXTERNAL_BOOK_API: overrides.LAP_ALLOW_EXTERNAL_BOOK_API ?? undefined,
    LAP_BOOK_API_KEY: overrides.LAP_BOOK_API_KEY ?? undefined,
    LAP_BOOK_API_BASE_URL: overrides.LAP_BOOK_API_BASE_URL ?? undefined,
    LAP_BOOK_API_PROVIDER: overrides.LAP_BOOK_API_PROVIDER ?? undefined,
    LAP_ALLOW_EXTERNAL_PROBLEM_API: overrides.LAP_ALLOW_EXTERNAL_PROBLEM_API ?? undefined,
    LAP_PROBLEM_API_KEY: overrides.LAP_PROBLEM_API_KEY ?? undefined,
    LAP_PROBLEM_API_BASE_URL: overrides.LAP_PROBLEM_API_BASE_URL ?? undefined,
    LAP_PROBLEM_API_PROVIDER: overrides.LAP_PROBLEM_API_PROVIDER ?? undefined,
    LAP_ALLOW_PHONE_AUTH: overrides.LAP_ALLOW_PHONE_AUTH ?? undefined,
    LAP_SMS_PROVIDER: overrides.LAP_SMS_PROVIDER ?? undefined,
    LAP_SMS_API_BASE_URL: overrides.LAP_SMS_API_BASE_URL ?? undefined,
    LAP_SMS_API_KEY: overrides.LAP_SMS_API_KEY ?? undefined,
    LAP_SMS_API_SECRET: overrides.LAP_SMS_API_SECRET ?? undefined,
    LAP_SMS_SIGN_NAME: overrides.LAP_SMS_SIGN_NAME ?? undefined,
    LAP_SMS_TEMPLATE_ID: overrides.LAP_SMS_TEMPLATE_ID ?? undefined,
    LAP_ALLOW_EMAIL_AUTH: overrides.LAP_ALLOW_EMAIL_AUTH ?? undefined,
    LAP_EMAIL_PROVIDER: overrides.LAP_EMAIL_PROVIDER ?? undefined,
    LAP_EMAIL_API_BASE_URL: overrides.LAP_EMAIL_API_BASE_URL ?? undefined,
    LAP_EMAIL_API_KEY: overrides.LAP_EMAIL_API_KEY ?? undefined,
    LAP_EMAIL_FROM: overrides.LAP_EMAIL_FROM ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("A463 Third-Party API Guard", () => {
  // -----------------------------------------------------------------------
  // Production blocked
  // -----------------------------------------------------------------------

  describe("production blocked (all capabilities)", () => {
    for (const { label, allowEnv, required } of ALL_CAPABILITIES) {
      it(`${label}: blocked in production`, () => {
        const env = buildEnv({
          NODE_ENV: "production",
          [allowEnv]: "true",
          ...Object.fromEntries(required.map((n) => [n, "dummy-value"])),
        });

        const result = evaluateExternalApiDevGuard({
          providerLabel: label,
          allowExternalEnvName: allowEnv,
          requiredEnvNames: required,
          env,
        });

        assert.equal(result.allowed, false);
        assert.ok(result.blockedReason.includes("PRODUCTION_BLOCKED"));
        assert.equal(result.productionReady, false);
      });
    }
  });

  // -----------------------------------------------------------------------
  // Allow flag missing → blocked
  // -----------------------------------------------------------------------

  describe("allow flag missing → blocked (all capabilities)", () => {
    for (const { label, allowEnv, required } of ALL_CAPABILITIES) {
      it(`${label}: blocked when allow flag is missing`, () => {
        const env = buildEnv({
          NODE_ENV: "development",
          ...Object.fromEntries(required.map((n) => [n, "dummy-value"])),
        });
        // allow flag is NOT set

        const result = evaluateExternalApiDevGuard({
          providerLabel: label,
          allowExternalEnvName: allowEnv,
          requiredEnvNames: required,
          env,
        });

        assert.equal(result.allowed, false);
        assert.ok(result.missingEnvNames.includes(allowEnv));
        assert.ok(
          result.blockedReason.includes("is not enabled"),
          `Expected 'is not enabled' in reason, got: ${result.blockedReason}`,
        );
      });
    }
  });

  // -----------------------------------------------------------------------
  // Required env missing → blocked
  // -----------------------------------------------------------------------

  describe("required env missing → blocked (all capabilities)", () => {
    for (const { label, allowEnv, required } of ALL_CAPABILITIES) {
      it(`${label}: blocked when required env is missing`, () => {
        // Only set allow flag, not the required envs
        const env = buildEnv({
          NODE_ENV: "development",
          [allowEnv]: "true",
        });

        const result = evaluateExternalApiDevGuard({
          providerLabel: label,
          allowExternalEnvName: allowEnv,
          requiredEnvNames: required,
          env,
        });

        assert.equal(result.allowed, false);
        assert.ok(result.missingEnvNames.length >= required.length);
        assert.ok(result.blockedReason.includes("Missing env"));
      });
    }
  });

  // -----------------------------------------------------------------------
  // All configured → enabled
  // -----------------------------------------------------------------------

  describe("all configured → enabled (all capabilities)", () => {
    for (const { label, allowEnv, required, cap } of ALL_CAPABILITIES) {
      it(`${label}: enabled when allow flag and all required envs are configured`, () => {
        const envOverrides = {
          NODE_ENV: "development",
          [allowEnv]: "true",
        };
        for (const name of required) {
          envOverrides[name] = "dummy-value-for-" + name;
        }

        const env = buildEnv(envOverrides);

        const result = evaluateExternalApiDevGuard({
          providerLabel: label,
          allowExternalEnvName: allowEnv,
          requiredEnvNames: required,
          env,
        });

        assert.equal(result.allowed, true, `Expected ${cap} to be allowed`);
        assert.equal(result.providerMode, "external-dev");
        assert.equal(result.blockedReason, null);
        assert.equal(result.missingEnvNames.length, 0);
        assert.ok(result.configuredEnvNames.length >= required.length + 1); // +1 for allow flag
      });
    }
  });

  // -----------------------------------------------------------------------
  // No env values leaked
  // -----------------------------------------------------------------------

  describe("no env values leaked in status output", () => {
    it("Book API: blockedReason does not contain env values", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          NODE_ENV: "development",
          LAP_ALLOW_EXTERNAL_BOOK_API: "true",
          // Missing BOOK_API_KEY — will be blocked
        }),
      });

      assert.equal(result.allowed, false);
      // blockedReason must contain env NAMES only, not values
      assert.ok(result.blockedReason.includes("LAP_BOOK_API_KEY"));
      assert.ok(!result.blockedReason.includes("dummy-value"));
    });

    it("Phone Auth: blockedReason does not contain env values", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Phone Auth (SMS)",
        allowExternalEnvName: "LAP_ALLOW_PHONE_AUTH",
        requiredEnvNames: PHONE_REQUIRED_ENV,
        env: buildEnv({
          NODE_ENV: "development",
          LAP_ALLOW_PHONE_AUTH: "true",
          // Only allow flag set, all required envs missing
        }),
      });

      assert.equal(result.allowed, false);
      assert.ok(result.blockedReason.includes("LAP_SMS_PROVIDER"));
      assert.ok(!result.blockedReason.includes("my-secret"));
    });

    it("Email Auth: blockedReason does not contain env values", () => {
      const envOverrides = {
        NODE_ENV: "development",
        LAP_ALLOW_EMAIL_AUTH: "true",
        LAP_EMAIL_PROVIDER: "sendgrid",
        LAP_EMAIL_API_BASE_URL: "https://api.sendgrid.com",
        LAP_EMAIL_API_KEY: "SG.actual-secret-key-here",
        LAP_EMAIL_FROM: "noreply@example.com",
      };

      const result = evaluateExternalApiDevGuard({
        providerLabel: "Email Auth",
        allowExternalEnvName: "LAP_ALLOW_EMAIL_AUTH",
        requiredEnvNames: EMAIL_REQUIRED_ENV,
        env: buildEnv(envOverrides),
      });

      // Should be allowed because all required are set (including API_KEY with value set)
      // Missing env should be EMPTY since all envs are configured
      assert.equal(result.missingEnvNames.length, 0);
      // blockedReason must NOT contain the actual API key value
      assert.ok(!result.blockedReason || !result.blockedReason.includes("SG.actual-secret-key"));
    });

    it("configuredEnvNames only contains env variable NAMES, not values", () => {
      const envOverrides = {
        NODE_ENV: "development",
        LAP_ALLOW_EXTERNAL_BOOK_API: "true",
        LAP_BOOK_API_KEY: "sk-actual-book-key-12345",
        LAP_BOOK_API_BASE_URL: "https://api.douban.com",
        LAP_BOOK_API_PROVIDER: "douban",
      };

      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv(envOverrides),
      });

      assert.equal(result.allowed, true);
      for (const name of result.configuredEnvNames) {
        assert.ok(!name.includes("="));
        assert.ok(!name.includes("sk-actual"));
        assert.ok(!name.includes("douban"));
        assert.ok(name.startsWith("LAP_"));
      }
    });
  });

  // -----------------------------------------------------------------------
  // Production check specific
  // -----------------------------------------------------------------------

  describe("production check", () => {
    it("production NODE_ENV blocks even with all envs configured", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          NODE_ENV: "production",
          LAP_ALLOW_EXTERNAL_BOOK_API: "true",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, false);
      assert.ok(result.blockedReason.includes("PRODUCTION_BLOCKED"));
    });

    it("missing NODE_ENV defaults to non-production (not blocked)", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          LAP_ALLOW_EXTERNAL_BOOK_API: "true",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, true);
      assert.ok(!result.blockedReason || !result.blockedReason.includes("PRODUCTION_BLOCKED"));
    });

    it("NODE_ENV=development is non-production", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          NODE_ENV: "development",
          LAP_ALLOW_EXTERNAL_BOOK_API: "true",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, true);
    });

    it("NODE_ENV=test is non-production", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          NODE_ENV: "test",
          LAP_ALLOW_EXTERNAL_BOOK_API: "true",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, true);
    });
  });

  // -----------------------------------------------------------------------
  // Allow flag parsing
  // -----------------------------------------------------------------------

  describe("allow flag parsing", () => {
    it("accepts '1' as true", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          LAP_ALLOW_EXTERNAL_BOOK_API: "1",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, true);
    });

    it("accepts 'yes' as true", () => {
      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv({
          LAP_ALLOW_EXTERNAL_BOOK_API: "yes",
          LAP_BOOK_API_KEY: "key",
          LAP_BOOK_API_BASE_URL: "https://api.example.com",
          LAP_BOOK_API_PROVIDER: "test",
        }),
      });

      assert.equal(result.allowed, true);
    });

    it("rejects 'false'", () => {
      const envOverrides = {
        LAP_ALLOW_EXTERNAL_BOOK_API: "false",
        LAP_BOOK_API_KEY: "key",
        LAP_BOOK_API_BASE_URL: "https://api.example.com",
        LAP_BOOK_API_PROVIDER: "test",
      };

      const result = evaluateExternalApiDevGuard({
        providerLabel: "Book API",
        allowExternalEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
        requiredEnvNames: BOOK_REQUIRED_ENV,
        env: buildEnv(envOverrides),
      });

      assert.equal(result.allowed, false);
    });
  });
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const PASS = "PASS";
const FAIL = "FAIL";
let total = 0;
let passed = 0;
let failed = 0;

for (const suite of describe.suites) {
  for (const test of suite.tests) {
    total++;
    try {
      await test.fn();
      passed++;
      console.log(`${PASS} [a463-guard] ${suite.name} › ${test.name}`);
    } catch (err) {
      failed++;
      console.log(`${FAIL} [a463-guard] ${suite.name} › ${test.name}`);
      console.log(`       ${err.message}`);
    }
  }
}

console.log(`\nA463 Guard: ${total} tests, ${passed} pass, ${failed} fail`);
if (failed > 0) process.exit(1);
