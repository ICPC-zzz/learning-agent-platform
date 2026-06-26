import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = process.cwd();

describe("A462 AppNav 4 items", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/_components/AppNav.tsx", "utf-8");
  const userStart = source.indexOf("USER_NAV_ITEMS");
  const adminStart = source.indexOf("ADMIN_NAV_ITEMS");
  const userSection = source.slice(userStart, adminStart > 0 ? adminStart : undefined);
  const hrefs = userSection.match(/href:\s*["']\/[^"']+["']/g) || [];

  it("exactly 4 items", function () {
    assert.equal(hrefs.length, 4, "Expected 4, got " + hrefs.length);
  });
  it("articles", function () {
    assert.ok(source.includes("/articles") && source.includes("文章"));
  });
  it("problems", function () {
    assert.ok(source.includes("/problems") && source.includes("题目中心"));
  });
  it("ai", function () {
    assert.ok(source.includes("/ai") && source.includes("AI助手"));
  });
  it("user", function () {
    assert.ok(source.includes("/user") && source.includes("个人"));
  });
  it("removed books from user nav", function () {
    assert.ok(!userSection.includes("/books"));
  });
  it("no import/admin in user section", function () {
    assert.ok(!userSection.includes("/import"));
    assert.ok(!userSection.includes("/admin"));
  });
});

describe("A462 AppHeader", function () {
  const source = readFileSync(ROOT + "/apps/web/src/app/_components/AppHeader.tsx", "utf-8");
  it("imports USER_NAV_ITEMS", function () { assert.ok(source.includes("USER_NAV_ITEMS")); });
  it("admin link exists", function () { assert.ok(source.includes("/admin")); });
});

describe("A462 AppSidebar", function () {
  const path = ROOT + "/apps/web/src/app/_components/AppSidebar.tsx";
  it("exists", function () { assert.ok(existsSync(path)); });
  it("imports USER_NAV_ITEMS", function () {
    const source = readFileSync(path, "utf-8");
    assert.ok(source.includes("USER_NAV_ITEMS"));
  });
});

describe("A462 FloatingAiAssistant retained", function () {
  const layout = readFileSync(ROOT + "/apps/web/src/app/layout.tsx", "utf-8");
  it("layout imports FloatingAiAssistant", function () { assert.ok(layout.includes("FloatingAiAssistant")); });
  it("layout renders FloatingAiAssistant", function () { assert.ok(layout.includes("<FloatingAiAssistant")); });
  it("file exists", function () { assert.ok(existsSync(ROOT + "/apps/web/src/app/_components/FloatingAiAssistant.tsx")); });
  it("hides on admin", function () {
    const assistant = readFileSync(ROOT + "/apps/web/src/app/_components/FloatingAiAssistant.tsx", "utf-8");
    assert.ok(assistant.includes("/admin") && assistant.includes("return null"));
  });
});
