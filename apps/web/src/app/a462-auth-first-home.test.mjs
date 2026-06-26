import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = process.cwd();

describe("A462 Auth-first home source", function () {
  it("page.tsx exists", function () {
    const p = ROOT + "/apps/web/src/app/page.tsx";
    assert.ok(existsSync(p));
    const c = readFileSync(p, "utf-8");
    assert.ok(c.includes("HomeLoginEntry"));
    assert.ok(c.includes("AuthenticatedHome"));
    assert.ok(c.includes("hasSession"));
  });
  it("HomeLoginEntry exists", function () {
    assert.ok(existsSync(ROOT + "/apps/web/src/app/_components/HomeLoginEntry.tsx"));
  });
  it("AuthenticatedHome exists", function () {
    assert.ok(existsSync(ROOT + "/apps/web/src/app/_components/AuthenticatedHome.tsx"));
  });
});

describe("A462 HomeLoginEntry options", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/_components/HomeLoginEntry.tsx", "utf-8");
  it("routes into articles", function () {
    assert.ok(source.includes('href="/articles"'));
  });
  it("keeps user center entry", function () {
    assert.ok(source.includes('href="/user"'));
  });
  it("dev-only stated", function () {
    assert.ok(source.includes("dev-only") || source.includes("寮€鍙戦瑙?"));
  });
});

describe("A462 guest auth entry", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/_components/AppHeader.tsx", "utf-8");
  it("shows login and register links", function () {
    assert.ok(source.includes('href="/auth/login"'));
    assert.ok(source.includes('href="/auth/register"'));
  });
});

describe("A462 AuthenticatedHome view", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/_components/AuthenticatedHome.tsx", "utf-8");
  it("renders four nav cards", function () {
    const navCardCount = (source.match(/NavCard/g) || []).length;
    assert.ok(navCardCount >= 4);
    assert.ok(source.includes("/articles"));
    assert.ok(source.includes("/problems"));
    assert.ok(source.includes("/ai"));
    assert.ok(source.includes("/user"));
  });
  it("no /books or /learning as main nav href", function () {
    assert.ok(!source.includes('href="/books"'));
    assert.ok(!source.includes('href="/learning"'));
  });
  it("dev-only stated", function () {
    assert.ok(source.includes("dev-only") || source.includes("寮€鍙戦瑙?"));
  });
});

describe("A462 Home old content regression", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/page.tsx", "utf-8");
  it("no old hero", function () {
    assert.ok(!source.includes("浣犵殑鏅鸿兘瀛︿範浼欎即"));
  });
  it("no admin-status import", function () {
    assert.ok(!source.includes("getAdminStatusSnapshot"));
  });
});
