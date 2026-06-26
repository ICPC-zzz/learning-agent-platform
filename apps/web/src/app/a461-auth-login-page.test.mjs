import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
var D = import.meta.dirname;
var LD = join(D, "auth", "login");
var LB = join(D, "..", "lib");
var RD = join(D, "auth", "register");
function rf(p) { return readFileSync(join(LD, p), "utf8"); }
function fe(p) { return existsSync(join(LD, p)); }
var pg = rf("page.tsx");
var rp = readFileSync(join(RD, "page.tsx"), "utf8");
test("files", function() { assert.ok(fe("page.tsx")); assert.ok(fe("actions.ts")); assert.ok(existsSync(join(LB,"web-auth-login-guard.ts"))); });
test("labels", function() { assert.ok(pg.includes("dev-only")); assert.ok(pg.includes("production")&&pg.includes("false")); assert.ok(pg.includes("A461")); });
test("form", function() { assert.ok(pg.includes("username")); assert.ok(pg.includes("password")); });
test("links", function() { assert.ok(pg.includes("/auth/register")); assert.ok(pg.includes("/user")); assert.ok(pg.includes("href")); });
test("no-oauth", function() { assert.ok(!pg.toLowerCase().includes("oauth2")); assert.ok(!pg.includes("forgot")); });
test("success", function() { assert.ok(pg.includes("state.user.id")); assert.ok(pg.includes("state.user.username")); });
test("error", function() { assert.ok(pg.includes("state.reason")); });
test("safe-no-pwhash", function() { var fi=pg.indexOf("function LoginForm"); var fb=pg.slice(fi,fi+2000); assert.ok(!fb.includes("passwordHash")); });
test("safe-no-secret", function() { assert.ok(!pg.includes("secret")); assert.ok(!pg.includes("token")); assert.ok(!pg.includes("DATABASE_URL")); assert.ok(!pg.includes("LLM")); });
test("components", function() { assert.ok(pg.includes("PreviewNotice")); assert.ok(pg.includes("DataStatePanel")); assert.ok(pg.includes("\u5b89\u5168")); });
test("reg-to-login", function() { assert.ok(rp.includes("/auth/login")); });
test("session", function() { assert.ok(pg.includes("session")); });
