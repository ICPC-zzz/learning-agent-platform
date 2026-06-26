import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
var D = import.meta.dirname;
var LB = join(D, "..", "lib");
var SU = new URL("../lib/web-auth-dev-session.ts", import.meta.url).href;
var mod = await import(SU);
var cd = mod.createDevSessionData;
var iv = mod.isValidDevSessionPayload;
var gs = mod.getSafeSessionSummary;
var se = mod.serializeDevSession;
var de = mod.deserializeDevSession;
var cn = mod.DEV_SESSION_COOKIE_NAME;
function rf(p) { return readFileSync(join(D, "auth", "login", p), "utf8"); }
function rl(f) { return readFileSync(join(LB, f), "utf8"); }

test("no pwHash in session", function() { var s=cd("a","b","c"); var j=JSON.stringify(s).toLowerCase(); assert.equal(j.includes("passwordhash"),false); assert.equal(j.includes("password"),false); });
test("real DB id", function() { var s=cd("cid_abc","u","d"); assert.equal(s.userIdPreview,"cid_abc"); assert.equal(s.sessionMode,"dev-only"); });
test("serialize no pwHash", function() { var s=cd("u1","t","d"); var j=se(s); assert.equal(j.includes("passwordHash"),false); assert.equal(j.includes("password"),false); });
test("roundtrip", function() { var s=cd("cid","u","d"); var j=se(s); var p=de(j); assert.ok(p!==null); assert.equal(p.userIdPreview,"cid"); });
test("reject pwHash field", function() { var j=JSON.stringify({userIdPreview:"u",displayName:"t",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString(),passwordHash:"x"}); assert.equal(de(j),null); });
test("reject token field", function() { var j=JSON.stringify({userIdPreview:"u",displayName:"t",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString(),token:"x"}); assert.equal(de(j),null); });
test("valid payload", function() { assert.equal(iv({userIdPreview:"u",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString()}),true); });
test("reject pwHash payload", function() { assert.equal(iv({userIdPreview:"u",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString(),passwordHash:"x"}),false); });
test("reject secret payload", function() { assert.equal(iv({userIdPreview:"u",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString(),secret:"x"}),false); });
test("reject token payload", function() { assert.equal(iv({userIdPreview:"u",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString(),token:"x"}),false); });
test("summary safe", function() { var s=gs({userIdPreview:"cid",displayName:"u",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString()}); var j=JSON.stringify(s).toLowerCase(); assert.equal(j.includes("password"),false); assert.equal(j.includes("token"),false); assert.equal(j.includes("secret"),false); assert.equal(j.includes("cookie"),false); });
test("productionReady false", function() { var s=gs({userIdPreview:"u1",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString()}); assert.equal(s.productionReady,false); });
test("null session", function() { var s=gs(null); assert.equal(s.hasSession,false); assert.equal(s.productionReady,false); });
test("summary has notice", function() { var s=gs({userIdPreview:"u1",displayName:"T",role:"d",sessionMode:"dev-only",createdAt:new Date().toISOString()}); assert.ok(s.notice.length>0); });
test("cookie name safe", function() { var n=cn.toLowerCase(); assert.equal(n.includes("secret"),false); assert.equal(n.includes("token"),false); assert.equal(n.includes("auth"),false); });
test("cookie in action", function() { var a=rf("actions.ts"); assert.ok(a.includes("DEV_SESSION_COOKIE_NAME")); });
test("user.id in action", function() { var a=rf("actions.ts"); assert.ok(a.includes("user.id")); });
test("session no pw in action", function() { var a=rf("actions.ts"); var f=a.indexOf("createDevSessionData"); var i=a.indexOf("createDevSessionData",f+1); assert.ok(i>=0); var b=a.slice(i,i+200); assert.ok(b.includes("user.id")); assert.ok(b.includes("user.username")); assert.ok(!b.includes("password")); assert.ok(!b.includes("passwordHash")); });
test("guard env key", function() { var g=rl("web-auth-login-guard.ts"); assert.ok(g.includes("LAP_ALLOW_DEV_AUTH_LOGIN")); });
test("guard blocks prod", function() { var g=rl("web-auth-login-guard.ts"); assert.ok(g.includes("PRODUCTION_BLOCKED")); assert.ok(g.includes("NODE_ENV")); });
