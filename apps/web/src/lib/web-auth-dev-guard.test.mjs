/**
 * Tests for web-auth-dev-guard.
 */
import assert from "node:assert/strict";
import test from "node:test";

const GUARD_URL = new URL("./web-auth-dev-guard.ts", import.meta.url).href;
const mod = await import(GUARD_URL);
const {
  getDevAuthGuardStatus,
  isDevAuthAllowed,
  getDevAuthBlockedMessage,
  guardStatusIsSafe,
} = mod;

// ---------------------------------------------------------------------------
// Guard default-disabled
// ---------------------------------------------------------------------------

test("guard reports disabled when env var not set", () => {
  // env var is not set by default in test environment
  const status = getDevAuthGuardStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.mode, "dev-only");
  assert.equal(status.productionReady, false);
  assert.equal(status.safeToExposeToClient, true);
  assert.ok(status.blockedReasons.length > 0);
});

test("guard status is safe to expose", () => {
  const status = getDevAuthGuardStatus();
  assert.equal(guardStatusIsSafe(status), true);
});

test("isDevAuthAllowed returns false by default", () => {
  assert.equal(isDevAuthAllowed(), false);
});

test("getDevAuthBlockedMessage returns non-empty when disabled", () => {
  const msg = getDevAuthBlockedMessage();
  assert.ok(msg.length > 0);
  assert.ok(msg.includes("LAP_WEB_AUTH_DEV_ENABLED"));
});

// ---------------------------------------------------------------------------
// Guard enabled via env
// ---------------------------------------------------------------------------

test("guard reports enabled when env var is true", () => {
  const prev = process.env.LAP_WEB_AUTH_DEV_ENABLED;
  process.env.LAP_WEB_AUTH_DEV_ENABLED = "true";
  try {
    const status = getDevAuthGuardStatus();
    assert.equal(status.enabled, true);
    assert.equal(status.blockedReasons.length, 0);
    assert.equal(status.mode, "dev-only");
    assert.equal(status.productionReady, false);
  } finally {
    if (prev === undefined) {
      delete process.env.LAP_WEB_AUTH_DEV_ENABLED;
    } else {
      process.env.LAP_WEB_AUTH_DEV_ENABLED = prev;
    }
  }
});

test("guard reports enabled when env var is '1'", () => {
  const prev = process.env.LAP_WEB_AUTH_DEV_ENABLED;
  process.env.LAP_WEB_AUTH_DEV_ENABLED = "1";
  try {
    assert.equal(isDevAuthAllowed(), true);
  } finally {
    if (prev === undefined) {
      delete process.env.LAP_WEB_AUTH_DEV_ENABLED;
    } else {
      process.env.LAP_WEB_AUTH_DEV_ENABLED = prev;
    }
  }
});

test("getDevAuthBlockedMessage returns empty when enabled", () => {
  const prev = process.env.LAP_WEB_AUTH_DEV_ENABLED;
  process.env.LAP_WEB_AUTH_DEV_ENABLED = "true";
  try {
    assert.equal(getDevAuthBlockedMessage(), "");
  } finally {
    if (prev === undefined) {
      delete process.env.LAP_WEB_AUTH_DEV_ENABLED;
    } else {
      process.env.LAP_WEB_AUTH_DEV_ENABLED = prev;
    }
  }
});

// ---------------------------------------------------------------------------
// Safety: guard never exposes sensitive data
// ---------------------------------------------------------------------------

test("guard status never contains DATABASE_URL", () => {
  const status = getDevAuthGuardStatus();
  const json = JSON.stringify(status).toLowerCase();
  assert.equal(json.includes("database_url"), false);
});

test("guard status never contains secret", () => {
  const status = getDevAuthGuardStatus();
  const json = JSON.stringify(status).toLowerCase();
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("password"), false);
  assert.equal(json.includes("api_key"), false);
});

test("guard blockedReasons do not contain env values", () => {
  const status = getDevAuthGuardStatus();
  for (const reason of status.blockedReasons) {
    const lower = reason.toLowerCase();
    assert.equal(lower.includes("database_url"), false);
    assert.equal(lower.includes("secret"), false);
    assert.equal(lower.includes("token"), false);
  }
});

// ---------------------------------------------------------------------------
// Guard always dev-only, never production
// ---------------------------------------------------------------------------

test("guard never claims production ready", () => {
  const status = getDevAuthGuardStatus();
  assert.equal(status.productionReady, false);
});

test("guard mode is always dev-only, even when enabled", () => {
  const prev = process.env.LAP_WEB_AUTH_DEV_ENABLED;
  process.env.LAP_WEB_AUTH_DEV_ENABLED = "true";
  try {
    const status = getDevAuthGuardStatus();
    assert.equal(status.mode, "dev-only");
    assert.equal(status.productionReady, false);
  } finally {
    if (prev === undefined) {
      delete process.env.LAP_WEB_AUTH_DEV_ENABLED;
    } else {
      process.env.LAP_WEB_AUTH_DEV_ENABLED = prev;
    }
  }
});
