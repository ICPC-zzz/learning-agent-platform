import assert from "node:assert/strict";
import test from "node:test";

const SESSION = await import("../../lib/web-auth-dev-session.ts");
const GUARD = await import("../../lib/web-auth-dev-guard.ts");

const { SESSION_STATUS, getDevUserPresets, getSafeSessionSummary } = SESSION;
const { getDevAuthGuardStatus } = GUARD;

test("guard default disabled", function() {
  assert.equal(getDevAuthGuardStatus().enabled, false);
});

test("guard enabled via env", function() {
  var prev = process.env.LAP_WEB_AUTH_DEV_ENABLED;
  process.env.LAP_WEB_AUTH_DEV_ENABLED = "true";
  try {
    assert.equal(getDevAuthGuardStatus().enabled, true);
  } finally {
    if (prev === undefined) delete process.env.LAP_WEB_AUTH_DEV_ENABLED;
    else process.env.LAP_WEB_AUTH_DEV_ENABLED = prev;
  }
});

test("safe summary no synced claim", function() {
  var payload = {
    userIdPreview: "dev-001",
    displayName: "Test",
    role: "dev",
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
  };
  var s = getSafeSessionSummary(payload);
  assert.equal(s.hasSession, true);
  assert.ok(s.notice.length > 0);
});

test("SESSION_STATUS values defined", function() {
  assert.ok(SESSION_STATUS.NO_SESSION.length > 0);
  assert.ok(SESSION_STATUS.DEV_SESSION.length > 0);
  assert.ok(SESSION_STATUS.GUARD_DISABLED.length > 0);
});

test("null session", function() {
  var s = getSafeSessionSummary(null);
  assert.equal(s.hasSession, false);
});

test("dev user presets no admin", function() {
  var presets = getDevUserPresets();
  for (var i = 0; i < presets.length; i++) {
    var label = presets[i].label.toLowerCase();
    assert.equal(label.includes("admin"), false);
  }
});
