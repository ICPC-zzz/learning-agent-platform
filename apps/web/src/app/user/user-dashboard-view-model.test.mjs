import assert from "node:assert/strict";
import test from "node:test";

const TYPES_URL = new URL("./user-dashboard-types.ts", import.meta.url).href;
const mod = await import(TYPES_URL);
const { getUserInfoView, buildUserDashboardView, EMPTY_STATE_MESSAGES } = mod;

var SENSITIVE = [
  "DATABASE_URL", "api_key", "token", "secret", "password", "cookie",
];

function jsonHasSensitive(obj) {
  var json = JSON.stringify(obj).toLowerCase();
  for (var i = 0; i < SENSITIVE.length; i++) {
    if (json.indexOf(SENSITIVE[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

test("getUserInfoView no session returns unauthenticated", function() {
  var view = getUserInfoView(null);
  assert.equal(view.nickname, "not logged in");
  assert.equal(view.hasSession, false);
  assert.equal(view.sessionMode, null);
});

test("getUserInfoView no args returns unauthenticated", function() {
  var view = getUserInfoView();
  assert.equal(view.hasSession, false);
});

test("getUserInfoView with session returns dev session info", function() {
  var view = getUserInfoView({
    hasSession: true,
    userIdPreview: "dev-001",
    displayName: "Dev User Alpha",
    role: "dev",
    sessionMode: "dev-only",
    createdAt: "2026-06-10T00:00:00.000Z",
  });
  assert.equal(view.nickname, "Dev User Alpha");
  assert.equal(view.status, "dev session connected");
  assert.equal(view.hasSession, true);
  assert.equal(view.sessionMode, "dev-only");
});

test("buildUserDashboardView with session", function() {
  var dashboard = buildUserDashboardView({
    favorites: [],
    recentReadings: [],
    session: {
      hasSession: true,
      userIdPreview: "dev-001",
      displayName: "Dev User",
      role: "dev",
      sessionMode: "dev-only",
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(dashboard.user.nickname, "Dev User");
  assert.equal(dashboard.user.hasSession, true);
});

test("EMPTY_STATE_MESSAGES has all keys", function() {
  assert.ok("favoriteBooks" in EMPTY_STATE_MESSAGES);
  assert.ok("recentReading" in EMPTY_STATE_MESSAGES);
  assert.ok("recentProblems" in EMPTY_STATE_MESSAGES);
  assert.ok("favoriteProblems" in EMPTY_STATE_MESSAGES);
});

test("dashboard view no sensitive fields", function() {
  var dashboard = buildUserDashboardView({ favorites: [], recentReadings: [] });
  assert.equal(jsonHasSensitive(dashboard), false);
});

test("getUserInfoView no session has no sensitive fields", function() {
  assert.equal(jsonHasSensitive(getUserInfoView()), false);
});

test("getUserInfoView with session has no sensitive fields", function() {
  var view = getUserInfoView({
    hasSession: true,
    userIdPreview: "dev-001",
    displayName: "Test",
    role: "dev",
    sessionMode: "dev-only",
    createdAt: new Date().toISOString(),
  });
  assert.equal(jsonHasSensitive(view), false);
});
