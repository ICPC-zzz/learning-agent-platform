/**
 * Tests for web-auth-dev-session.
 */
import assert from "node:assert/strict";
import test from "node:test";

const SESSION_URL = new URL("./web-auth-dev-session.ts", import.meta.url).href;
const mod = await import(SESSION_URL);
const {
  createDevSessionData,
  createDevSessionFromPreset,
  isValidDevSessionPayload,
  getSafeSessionSummary,
  serializeDevSession,
  deserializeDevSession,
  getDevUserPresets,
  getDevUserByKey,
  SESSION_STATUS,
  DEV_SESSION_COOKIE_NAME,
} = mod;

function makeValidPayload(overrides = {}) {
  return {
    userIdPreview: "dev-001",
    displayName: "Test User",
    role: "开发用户",
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("createDevSessionData creates valid session", () => {
  const session = createDevSessionData("dev-001", "Test User", "开发用户");
  assert.equal(session.userIdPreview, "dev-001");
  assert.equal(session.sessionMode, "dev-only");
});

test("createDevSessionFromPreset returns session for valid key", () => {
  const s = createDevSessionFromPreset("dev1");
  assert.ok(s !== null);
  assert.equal(s.userIdPreview, "dev-user-001");
});

test("isValidDevSessionPayload valid", () => {
  assert.equal(isValidDevSessionPayload(makeValidPayload()), true);
});

test("isValidDevSessionPayload rejects extra fields", () => {
  assert.equal(isValidDevSessionPayload({ ...makeValidPayload(), token: "abc" }), false);
  assert.equal(isValidDevSessionPayload({ ...makeValidPayload(), secret: "xyz" }), false);
});

test("serializeDevSession round-trip", () => {
  const session = createDevSessionData("dev-001", "Test", "dev");
  const json = serializeDevSession(session);
  const payload = deserializeDevSession(json);
  assert.ok(payload !== null);
  assert.equal(payload.userIdPreview, "dev-001");
});

test("getSafeSessionSummary null returns no session", () => {
  const s = getSafeSessionSummary(null);
  assert.equal(s.hasSession, false);
  assert.equal(s.productionReady, false);
});

test("getSafeSessionSummary with session", () => {
  const s = getSafeSessionSummary(makeValidPayload());
  assert.equal(s.hasSession, true);
  assert.equal(s.productionReady, false);
  assert.ok(s.notice.includes("尚未同步"));
});

test("getSafeSessionSummary never claims production", () => {
  const s = getSafeSessionSummary(makeValidPayload());
  assert.equal(s.notice.includes("已同步账号"), false);
  assert.equal(s.notice.includes("真实登录"), false);
  assert.equal(s.notice.includes("生产可用"), false);
});

test("getSafeSessionSummary no raw cookie token", () => {
  const s = getSafeSessionSummary(makeValidPayload());
  const json = JSON.stringify(s).toLowerCase();
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("cookie"), false);
});

test("DEV_SESSION_COOKIE_NAME safe", () => {
  const name = DEV_SESSION_COOKIE_NAME.toLowerCase();
  assert.equal(name.includes("secret"), false);
  assert.equal(name.includes("token"), false);
});
