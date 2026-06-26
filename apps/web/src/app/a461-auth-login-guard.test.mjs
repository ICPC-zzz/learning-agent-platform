/**
 * A461 Auth Login Guard Tests
 *
 * Covers:
 * - production blocked
 * - env missing blocked
 * - env allowed + dev/test enabled
 * - no env value leak
 * - guard status safety
 */

import assert from "node:assert/strict";
import test from "node:test";

const GUARD_URL = new URL("../lib/web-auth-login-guard.ts", import.meta.url).href;
const mod = await import(GUARD_URL);
const {
  getDevLoginGuardStatus,
  isDevLoginAllowed,
  loginGuardStatusIsSafe,
} = mod;

const ENV_KEY = "LAP_ALLOW_DEV_AUTH_LOGIN";

// ---------------------------------------------------------------------------
// Default-disabled
// ---------------------------------------------------------------------------

test("guard reports disabled when env var not set", () => {
  const status = getDevLoginGuardStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.blocked, true);
  assert.equal(status.devOnly, true);
  assert.equal(status.reason.length > 0, true);
});

test("guard reports productionBlocked=false when NODE_ENV is not production", () => {
  const status = getDevLoginGuardStatus();
  assert.equal(status.productionBlocked, false);
});

test("isDevLoginAllowed returns false by default", () => {
  assert.equal(isDevLoginAllowed(), false);
});

test("guard has LAP_ALLOW_DEV_AUTH_LOGIN in requiredEnvNames", () => {
  const status = getDevLoginGuardStatus();
  assert.ok(status.requiredEnvNames.includes(ENV_KEY));
});

test("guard has LAP_ALLOW_DEV_AUTH_LOGIN in missingEnvNames when not set", () => {
  const status = getDevLoginGuardStatus();
  assert.ok(status.missingEnvNames.includes(ENV_KEY));
});

test("guard configuredEnvNames empty when env not set", () => {
  const status = getDevLoginGuardStatus();
  assert.equal(status.configuredEnvNames.length, 0);
});

test("guard reason contains LOGIN_DISABLED when env not set", () => {
  const status = getDevLoginGuardStatus();
  assert.ok(status.reason.includes("LOGIN_DISABLED"));
  assert.ok(status.reason.includes(ENV_KEY));
});

// ---------------------------------------------------------------------------
// Enabled via env
// ---------------------------------------------------------------------------

test("guard reports enabled when env var is true", () => {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = "true";
  try {
    const status = getDevLoginGuardStatus();
    assert.equal(status.enabled, true);
    assert.equal(status.blocked, false);
    assert.equal(status.reason, "");
    assert.equal(status.missingEnvNames.length, 0);
    assert.ok(status.configuredEnvNames.includes(ENV_KEY));
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
});

test("guard reports enabled when env var is '1'", () => {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = "1";
  try {
    assert.equal(isDevLoginAllowed(), true);
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
});

test("guard configuredEnvNames populated when env set", () => {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = "true";
  try {
    const status = getDevLoginGuardStatus();
    assert.ok(status.configuredEnvNames.includes(ENV_KEY));
    assert.equal(status.missingEnvNames.length, 0);
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
});

// ---------------------------------------------------------------------------
// Production blocked
// ---------------------------------------------------------------------------

test("guard blocked when NODE_ENV is production", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevLogin = process.env[ENV_KEY];
  process.env.NODE_ENV = "production";
  process.env[ENV_KEY] = "true";
  try {
    const status = getDevLoginGuardStatus();
    assert.equal(status.enabled, false);
    assert.equal(status.blocked, true);
    assert.equal(status.productionBlocked, true);
    assert.ok(status.reason.includes("PRODUCTION_BLOCKED"));
    assert.ok(status.reason.includes("NODE_ENV is production"));
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevLogin === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevLogin;
  }
});

test("guard blocked in production even with env true", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevLogin = process.env[ENV_KEY];
  process.env.NODE_ENV = "production";
  process.env[ENV_KEY] = "true";
  try {
    assert.equal(isDevLoginAllowed(), false);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevLogin === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevLogin;
  }
});

test("guard productionBlocked=true when NODE_ENV=production even with env set", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevLogin = process.env[ENV_KEY];
  process.env.NODE_ENV = "production";
  process.env[ENV_KEY] = "true";
  try {
    const status = getDevLoginGuardStatus();
    assert.equal(status.productionBlocked, true);
    assert.equal(status.enabled, false);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevLogin === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prevLogin;
  }
});

// ---------------------------------------------------------------------------
// devOnly is always true
// ---------------------------------------------------------------------------

test("guard devOnly is always true, even when enabled", () => {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = "true";
  try {
    const status = getDevLoginGuardStatus();
    assert.equal(status.devOnly, true);
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
});

// ---------------------------------------------------------------------------
// Safety: no env values leaked
// ---------------------------------------------------------------------------

test("guard status never contains DATABASE_URL", () => {
  const status = getDevLoginGuardStatus();
  const json = JSON.stringify(status).toLowerCase();
  assert.equal(json.includes("database_url"), false);
});

test("guard status never contains secret/token/password/api_key", () => {
  const status = getDevLoginGuardStatus();
  const json = JSON.stringify(status).toLowerCase();
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("password"), false);
  assert.equal(json.includes("api_key"), false);
});

test("guard reason never contains env values", () => {
  const status = getDevLoginGuardStatus();
  const lower = status.reason.toLowerCase();
  assert.equal(lower.includes("database_url"), false);
  assert.equal(lower.includes("secret"), false);
  assert.equal(lower.includes("token"), false);
  assert.equal(lower.includes("password"), false);
});

test("guard configuredEnvNames only contains env names, not values", () => {
  const prev = process.env[ENV_KEY];
  process.env[ENV_KEY] = "some-secret-value-12345";
  try {
    const status = getDevLoginGuardStatus();
    for (const name of status.configuredEnvNames) {
      assert.equal(name.includes("="), false);
      assert.equal(name.includes("secret"), false);
      assert.equal(name, ENV_KEY);
    }
  } finally {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  }
});

test("loginGuardStatusIsSafe returns true for valid status", () => {
  const status = getDevLoginGuardStatus();
  assert.equal(loginGuardStatusIsSafe(status), true);
});

test("loginGuardStatusIsSafe rejects status with secret in reason", () => {
  // Construct an unsafe status object (direct construction to test validator)
  const unsafeStatus = {
    enabled: false,
    blocked: true,
    reason: "DATABASE_URL leaked here",
    requiredEnvNames: [ENV_KEY],
    configuredEnvNames: [],
    missingEnvNames: [ENV_KEY],
    devOnly: true,
    productionBlocked: false,
  };
  assert.equal(loginGuardStatusIsSafe(unsafeStatus), false);
});

// ---------------------------------------------------------------------------
// Guard always dev-only, never claims production ready
// ---------------------------------------------------------------------------

test("guard never claims any productionReady field", () => {
  const status = getDevLoginGuardStatus();
  const json = JSON.stringify(status).toLowerCase();
  assert.equal(json.includes("productionready"), false);
});

test("guard status shape contains all required fields", () => {
  const status = getDevLoginGuardStatus();
  assert.ok("enabled" in status);
  assert.ok("blocked" in status);
  assert.ok("reason" in status);
  assert.ok("requiredEnvNames" in status);
  assert.ok("configuredEnvNames" in status);
  assert.ok("missingEnvNames" in status);
  assert.ok("devOnly" in status);
  assert.ok("productionBlocked" in status);
});
