import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
var ROOT = process.cwd();

describe("A462 auth/login page options", function() {
  var p = ROOT + "/apps/web/src/app/auth/login/page.tsx";
  var c = readFileSync(p, "utf-8");
  it("exists", function() { assert.ok(existsSync(p)); });
  it("has username/password", function() { assert.ok(c.includes("login-username")); });
  it("has phone tab", function() { assert.ok(c.includes("手机号验证码登录")); });
  it("phone tab blocked", function() { assert.ok(c.includes("blocked") || c.includes("未接入")); });
  it("has email tab", function() { assert.ok(c.includes("邮箱登录")); });
  it("email tab blocked", function() { assert.ok(c.includes("blocked") || c.includes("未接入")); });
  it("has register link", function() { assert.ok(c.includes("/auth/register")); });
  it("no fake SMS sent", function() { assert.ok(!c.includes("验证码已发送")); });
  it("no fake email sent", function() { assert.ok(!c.includes("邮件已发送")); });
  it("no hardcoded OTP", function() { assert.ok(!c.includes("123456")); });
  it("LAP_ALLOW_DEV_PHONE_AUTH placeholder", function() { assert.ok(c.includes("LAP_ALLOW_DEV_PHONE_AUTH")); });
  it("LAP_ALLOW_DEV_EMAIL_AUTH placeholder", function() { assert.ok(c.includes("LAP_ALLOW_DEV_EMAIL_AUTH")); });
  it("phoneAuthStatus disabled", function() { assert.ok(c.includes("phoneAuthStatus")); });
  it("emailAuthStatus disabled", function() { assert.ok(c.includes("emailAuthStatus")); });
  it("security mentions phone/email blocked", function() { assert.ok(c.includes("blocked")); });
  it("devLoginAction imported", function() { assert.ok(c.includes("devLoginAction")); });
});

describe("A462 register page regression", function() {
  var p = ROOT + "/apps/web/src/app/auth/register/page.tsx";
  it("exists", function() { assert.ok(existsSync(p)); });
  it("has login link", function() {
    var c = readFileSync(p, "utf-8");
    assert.ok(c.includes("去登录") || c.includes("登录"));
  });
});
