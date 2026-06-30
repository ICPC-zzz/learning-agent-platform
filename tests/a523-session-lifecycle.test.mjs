import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("packages/db/prisma/schema.prisma", "utf8");
const sessionSource = readFileSync("apps/web/src/lib/session/web-auth-session.ts", "utf8");
const sessionRepo = readFileSync("packages/db/src/repositories/web-session-repository.ts", "utf8");
const verifySource = readFileSync("apps/web/src/app/auth/login/email-otp-verify-actions.ts", "utf8");

test("A523 WebSession schema supports expiry revocation and hashed token lookup", () => {
  assert.match(schema, /model WebSession/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /expiresAt\s+DateTime/);
  assert.match(schema, /revokedAt\s+DateTime\?/);
  assert.doesNotMatch(schema, /model WebSession[\s\S]*rawToken/);
});

test("A523 session reads reject expired revoked and disabled users", () => {
  assert.match(sessionRepo, /expiresAt:\s*\{\s*gt:\s*now\s*\}/);
  assert.match(sessionRepo, /revokedAt:\s*null/);
  assert.match(sessionSource, /session\.user\.disabledAt !== null/);
  assert.match(sessionSource, /reason:\s*"expired"/);
  assert.match(sessionSource, /reason:\s*"disabled"/);
});

test("A523 session lifecycle can touch and revoke persisted sessions", () => {
  assert.match(sessionRepo, /touchSession/);
  assert.match(sessionRepo, /lastSeenAt/);
  assert.match(sessionRepo, /revokeSessionByTokenHash/);
  assert.match(sessionSource, /auth_session_revoked/);
  assert.match(sessionSource, /auth_logout/);
});

test("A523 OTP success consumes code before creating the session", () => {
  assert.match(verifySource, /await consumeOtp\(otpRecord\.id\);[\s\S]*createDatabaseSessionForUser\(userId\)/);
});
