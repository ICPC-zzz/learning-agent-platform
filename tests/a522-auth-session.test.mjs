import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("packages/db/prisma/schema.prisma", "utf8");
const sessionSource = readFileSync("apps/web/src/lib/session/web-auth-session.ts", "utf8");
const verifySource = readFileSync("apps/web/src/app/auth/login/email-otp-verify-actions.ts", "utf8");

test("A522 session schema stores only token hashes", () => {
  assert.match(schema, /model WebSession/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.doesNotMatch(schema, /model WebSession[\s\S]*\brawToken\b/);
});

test("A522 cookie stores the raw session token under the formal cookie name", () => {
  assert.match(sessionSource, /WEB_SESSION_COOKIE_NAME\s*=\s*"lap_session"/);
  assert.match(sessionSource, /httpOnly:\s*true/);
  assert.match(sessionSource, /sameSite:\s*"lax"/);
  assert.match(sessionSource, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.doesNotMatch(sessionSource, /cookieStore\.set\(WEB_SESSION_COOKIE_NAME,[\s\S]{0,300}userId/);
  assert.doesNotMatch(sessionSource, /cookieStore\.set\(WEB_SESSION_COOKIE_NAME,[\s\S]{0,300}role/);
});

test("A522 verify creates a database session instead of a dev session", () => {
  assert.match(verifySource, /createDatabaseSessionForUser\(userId\)/);
  assert.match(verifySource, /setWebSessionCookie\(rawToken\)/);
  assert.doesNotMatch(verifySource, /serializeDevSession/);
});
