import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const middleware = readFileSync("apps/web/src/middleware.ts", "utf8");
const adminLayout = readFileSync("apps/web/src/app/admin/layout.tsx", "utf8");
const userPage = readFileSync("apps/web/src/app/user/page.tsx", "utf8");

test("A522 middleware protects core authenticated routes", () => {
  for (const route of ["/user", "/ai", "/learning", "/agent", "/admin"]) {
    assert.match(middleware, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(middleware, /WEB_SESSION_COOKIE_NAME\s*=\s*"lap_session"/);
  assert.match(middleware, /returnTo/);
});

test("A522 admin layout performs server-side admin authorization", () => {
  assert.match(adminLayout, /isCurrentUserAdmin\(\)/);
  assert.match(adminLayout, /notFound\(\)/);
});

test("A522 user page requires a trusted server auth session", () => {
  assert.match(userPage, /getCurrentAuthSession\(\)/);
  assert.match(userPage, /redirect\("\/auth\/login\?returnTo=\/user"\)/);
});
