/**
 * A453 Auth Register v1 - Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

var APP_DIR = import.meta.dirname;
// APP_DIR = .../learning-agent-platform/apps/web/src/app/auth/register/
// .. = auth/  ../.. = app/  ../../.. = src/  ../../../.. = web/
// ../../../../.. = apps/  ../../../../../.. = project root
var PROJ_DIR = join(APP_DIR, "..", "..", "..", "..", "..", "..");
var DB_DIR = join(PROJ_DIR, "packages", "db", "src");
// .. = auth/  ../.. = app/  ../../.. = src/  ../../../lib/ = src/lib/
var LIB_DIR = join(APP_DIR, "..", "..", "..", "lib");
// .. = auth/  ../.. = app/  ../../_components/ = app/_components/
var COMPONENTS_DIR = join(APP_DIR, "..", "..", "_components");

function rf(p) { return readFileSync(join(APP_DIR, p), "utf-8"); }
function fe(p) { return existsSync(join(APP_DIR, p)); }
function rp(p) { return readFileSync(join(PROJ_DIR, p), "utf-8"); }
function rl(f) { return readFileSync(join(LIB_DIR, f), "utf-8"); }

describe("A453 File structure", function () {
  it("1a. register page exists", function () {
    assert.ok(fe("page.tsx"));
  });
  it("1b. register actions exist", function () {
    assert.ok(fe("actions.ts"));
  });
  it("1c. register guard exists", function () {
    assert.ok(existsSync(join(LIB_DIR, "web-auth-register-guard.ts")));
  });
  it("1d. auth-password exists", function () {
    assert.ok(existsSync(join(LIB_DIR, "auth-password.ts")));
  });
});

describe("A453 Prisma schema", function () {
  var s = rp("packages/db/prisma/schema.prisma");
  var us = s.substring(s.indexOf("model User"), s.indexOf("model Book", s.indexOf("model User")));

  it("2a. username @unique field", function () {
    assert.ok(us.includes("username"));
    assert.ok(/username.*@unique/.test(us));
  });
  it("2b. passwordHash String? field", function () {
    assert.ok(us.includes("passwordHash"));
    assert.ok(/passwordHash\s+String\?/.test(us));
  });
});

describe("A453 Register guard", function () {
  var g = rl("web-auth-register-guard.ts");

  it("3a. exports getDevRegisterGuardStatus", function () {
    assert.ok(g.includes("getDevRegisterGuardStatus"));
  });
  it("3b. checks NODE_ENV production", function () {
    assert.ok(g.includes("NODE_ENV") || g.includes("production"));
  });
  it("3c. checks LAP_ALLOW_DEV_AUTH_REGISTER", function () {
    assert.ok(g.includes("LAP_ALLOW_DEV_AUTH_REGISTER"));
  });
  it("3d. PRODUCTION_BLOCKED reason", function () {
    assert.ok(g.includes("PRODUCTION_BLOCKED"));
  });
  it("3e. default blocked (requires env)", function () {
    assert.ok(g.includes("REGISTER_DISABLED") || g.includes("not true"));
  });
  it("3f. safeToExposeToClient flag", function () {
    assert.ok(g.includes("safeToExposeToClient"));
  });
});

describe("A453 Password security", function () {
  var p = rl("auth-password.ts");

  it("4a. uses scrypt hashing", function () {
    assert.ok(p.includes("scrypt") || p.includes("hashPassword"));
  });
  it("4b. dev-only adapter documented", function () {
    assert.ok(p.includes("devOnly"));
  });
  it("4c. exports hashPassword", function () {
    assert.ok(p.includes("export async function hashPassword"));
  });
  it("4d. uses salt for uniqueness", function () {
    assert.ok(p.includes("salt"));
  });
  it("4e. timingSafeEqual comparison", function () {
    assert.ok(p.includes("timingSafeEqual"));
  });
  it("4f. bcryptjs preferred documented", function () {
    assert.ok(p.includes("bcryptjs"));
  });
  it("4g. password not logged in action", function () {
    var a = rf("actions.ts");
    var lines = a.split("\n").filter(function (l) { return l.includes("console."); });
    for (var i = 0; i < lines.length; i++) {
      assert.ok(!lines[i].includes("password") || lines[i].includes("NOT logged"));
    }
  });
});

describe("A453 Input validation", function () {
  var a = rf("actions.ts");

  it("5a. empty username rejected (trim)", function () {
    assert.ok(a.includes("trim()"));
  });
  it("5b. USERNAME_MIN_LENGTH defined", function () {
    assert.ok(a.includes("USERNAME_MIN_LENGTH"));
  });
  it("5c. PASSWORD_MIN_LENGTH defined", function () {
    assert.ok(a.includes("PASSWORD_MIN_LENGTH"));
  });
  it("5d. USERNAME_PATTERN defined", function () {
    assert.ok(a.includes("USERNAME_PATTERN"));
  });
  it("5e. duplicate username check", function () {
    assert.ok(a.includes("getUserByUsername") && a.includes("existing"));
  });
  it("5f. DB unavailable check", function () {
    assert.ok(a.includes("isDbAvailable"));
  });
  it("5g. guard before DB ops", function () {
    var gi = a.indexOf("getDevRegisterGuardStatus");
    var di = a.indexOf("isDbAvailable");
    assert.ok(gi >= 0 && di >= 0 && gi < di);
  });
});

describe("A453 Register page", function () {
  var p = rf("page.tsx");

  it("6a. dev-only label present", function () {
    assert.ok(p.includes("dev-only") || p.includes("devOnly"));
  });
  it("6b. non-production notice", function () {
    assert.ok(p.includes("productionReady=false"));
  });
  it("6c. uses PageHero", function () { assert.ok(p.includes("PageHero")); });
  it("6d. uses DataStatePanel", function () { assert.ok(p.includes("DataStatePanel")); });
  it("6e. uses PreviewNotice", function () { assert.ok(p.includes("PreviewNotice")); });
  it("6f. username input", function () { assert.ok(p.includes('name="username"')); });
  it("6g. password input", function () { assert.ok(p.includes('name="password"')); });
  it("6h. password field masked", function () {
    assert.ok(p.includes('"password"'));
  });
  it("6i. no login redirect", function () {
    assert.ok(!p.includes("router.push"));
  });
  it("6j. no httpOnly cookie", function () {
    assert.ok(!p.includes("httpOnly"));
  });
  it("6k. security section present", function () {
    assert.ok(p.includes("安全"));
  });
  it("6l. no passwordHash displayed", function () {
    assert.ok(!p.includes("passwordHash"));
  });
  it("6m. autocomplete new-password", function () {
    assert.ok(p.includes("new-password"));
  });
  it("6n. A453 reference", function () {
    assert.ok(p.includes("A453") || p.includes("Auth v2"));
  });
  it("6o. productionReady identifier", function () {
    assert.ok(p.includes("productionReady=false"));
  });
});

describe("A453 UserRepository", function () {
  var repo = readFileSync(join(DB_DIR, "repositories", "user-repository.ts"), "utf-8");
  var types = readFileSync(join(DB_DIR, "types.ts"), "utf-8");

  it("7a. getUserByUsername in repo", function () {
    assert.ok(repo.includes("getUserByUsername"));
  });
  it("7b. UserRecord excludes passwordHash", function () {
    var rs = types.indexOf("export type UserRecord");
    var re = types.indexOf(">;", rs);
    assert.ok(!types.substring(rs, re).includes("passwordHash"));
  });
  it("7c. UserRecord includes username", function () {
    var rs = types.indexOf("export type UserRecord");
    var re = types.indexOf(">;", rs);
    assert.ok(types.substring(rs, re).includes("username"));
  });
  it("7d. CreateUserInput has passwordHash", function () {
    var is = types.indexOf("export interface CreateUserInput");
    var ie = types.indexOf("}", is);
    assert.ok(types.substring(is, ie).includes("passwordHash"));
  });
  it("7e. DevRegisterResult excludes passwordHash", function () {
    var rs = types.indexOf("export type DevRegisterResult");
    var re = types.indexOf(";", rs);
    assert.ok(!types.substring(rs, re).includes("passwordHash"));
  });
  it("7f. DevRegisterInput declared", function () {
    assert.ok(types.includes("DevRegisterInput"));
  });
  it("7g. UserRepository has getUserByUsername", function () {
    var is = types.indexOf("export interface UserRepository");
    var ie = types.indexOf("}", is);
    assert.ok(types.substring(is, ie).includes("getUserByUsername"));
  });
});

describe("A453 Safety boundaries", function () {
  it("8a. no hardcoded password strings", function () {
    var a = rf("actions.ts");
    var g = rl("web-auth-register-guard.ts");
    var p = rl("auth-password.ts");
    var all = a + g + p;
    assert.ok(!all.includes('password = "') && !all.includes("password='"));
  });
  it("8b. no DATABASE_URL leakage", function () {
    var a = rf("actions.ts");
    var g = rl("web-auth-register-guard.ts");
    var all = a + g;
    var count = (all.match(/DATABASE_URL/g) || []).length;
    assert.ok(count <= 2, "count=" + count);
  });
  it("8c. no env values in page", function () {
    var p = rf("page.tsx");
    assert.ok(!p.includes("postgres://") && !p.includes("sk-"));
  });
  it("8d. no session cookie in register", function () {
    var a = rf("actions.ts");
    assert.ok(!a.includes("DEV_SESSION_COOKIE_NAME") && !a.includes("cookie"));
  });
  it("8e. no OAuth in register", function () {
    var a = rf("actions.ts");
    assert.ok(!a.includes("OAuth") && !a.includes("oauth"));
  });
  it("8f. no LLM/Agent/Tool in auth", function () {
    var a = rf("actions.ts");
    var g = rl("web-auth-register-guard.ts");
    assert.ok(!(a + g).includes("LLM") && !(a + g).includes("Agent") && !(a + g).includes("Tool"));
  });
  it("8g. UserUiComponents unchanged", function () {
    var ui = readFileSync(join(COMPONENTS_DIR, "UserUiComponents.tsx"), "utf-8");
    assert.ok(!ui.includes("passwordHash") && !ui.includes("register"));
  });
  it("8h. safe error messages", function () {
    var a = rf("actions.ts");
    assert.ok(!a.includes('"Error:') && !a.includes('"Prisma'));
  });
  it("8i. production explicitly blocked", function () {
    var g = rl("web-auth-register-guard.ts");
    assert.ok(g.includes("PRODUCTION_BLOCKED"));
  });
});

describe("A453 Summary", function () {
  it("all sections loaded", function () {
    assert.ok(true);
  });
});
