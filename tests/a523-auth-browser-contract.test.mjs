import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginPage = readFileSync("apps/web/src/app/auth/login/page.tsx", "utf8");
const verifySource = readFileSync("apps/web/src/app/auth/login/email-otp-verify-actions.ts", "utf8");
const middleware = readFileSync("apps/web/src/middleware.ts", "utf8");
const sessionSource = readFileSync("apps/web/src/lib/session/web-auth-session.ts", "utf8");
const logoutSource = readFileSync("apps/web/src/app/auth/logout/actions.ts", "utf8");

test("A523 login page drives email OTP send and verify actions", () => {
  assert.match(loginPage, /sendEmailOtpAction/);
  assert.match(loginPage, /verifyEmailOtpAction/);
  assert.match(loginPage, /autoComplete="one-time-code"/);
  assert.doesNotMatch(loginPage, /lap-web-dev-session/);
});

test("A523 OTP verify creates formal database session cookie", () => {
  assert.match(verifySource, /createDatabaseSessionForUser\(userId\)/);
  assert.match(verifySource, /setWebSessionCookie\(rawToken\)/);
  assert.match(verifySource, /clearLegacyDevSessionCookie\(\)/);
  assert.doesNotMatch(verifySource, /serializeDevSession/);
});

test("A523 middleware protects formal user admin and ai routes by lap_session", () => {
  assert.match(middleware, /WEB_SESSION_COOKIE_NAME = "lap_session"/);
  for (const route of ["/user", "/ai", "/admin"]) {
    assert.match(middleware, new RegExp(`"${route}"`));
  }
  assert.match(middleware, /returnTo/);
});

test("A523 cookie contract stays HttpOnly and does not store user fields", () => {
  assert.match(sessionSource, /httpOnly:\s*true/);
  assert.match(sessionSource, /sameSite:\s*"lax"/);
  assert.match(sessionSource, /hashSessionToken\(rawToken\)/);
  assert.doesNotMatch(sessionSource, /cookieStore\.set\(WEB_SESSION_COOKIE_NAME,[\s\S]{0,350}email/);
  assert.doesNotMatch(sessionSource, /cookieStore\.set\(WEB_SESSION_COOKIE_NAME,[\s\S]{0,350}role/);
  assert.doesNotMatch(sessionSource, /cookieStore\.set\(WEB_SESSION_COOKIE_NAME,[\s\S]{0,350}userId/);
});

test("A523 logout uses server-side revocation before redirect", () => {
  assert.match(logoutSource, /revokeCurrentSession\(\)/);
  assert.match(sessionSource, /revokeSessionByTokenHash\(tokenHash\)/);
  assert.match(sessionSource, /clearWebSessionCookie\(\)/);
});
