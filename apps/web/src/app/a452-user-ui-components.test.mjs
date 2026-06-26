import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

var APP_DIR = import.meta.dirname;
var UI = join(APP_DIR, "_components", "UserUiComponents.tsx");

function rf(p) { return readFileSync(join(APP_DIR, p), "utf-8"); }
function fe(p) { return existsSync(join(APP_DIR, p)); }

describe("A452 UserUiComponents", function () {
  it("1. file exists", function () { assert.ok(existsSync(UI)); });

  var c = existsSync(UI) ? readFileSync(UI, "utf-8") : "";
  ["UserStatusBadge","PageHero","PageSection","FeatureCard","DataStatePanel","PreviewNotice","ActionCard","EmptyState","MetricPill","StatusBadgeRow","BookSourceBadge","GridCardLayout"].forEach(function (e) {
    it("exports " + e, function () { assert.ok(c.indexOf("export function " + e) >= 0, e); });
  });
});

describe("User variant isolation", function () {
  it("2a. no dark-mode", function () {
    var x = readFileSync(UI, "utf-8");
    assert.ok(x.indexOf("dark-mode") < 0);
    assert.ok(x.indexOf("--admin-") < 0);
    assert.ok(x.indexOf("AdminShell") < 0);
  });
  it("2b. Chinese labels", function () {
    var x = readFileSync(UI, "utf-8");
    assert.ok(x.indexOf("已启用") >= 0);
    assert.ok(x.indexOf("开发预览") >= 0);
  });
  it("2c. dev identifiers", function () {
    var x = readFileSync(UI, "utf-8");
    assert.ok(x.indexOf("productionReady") >= 0 || x.indexOf("imported-dev") >= 0);
  });
});

describe("AdminShell isolation", function () {
  ["books/page.tsx","problems/page.tsx","import/page.tsx","reader/page.tsx","user/page.tsx","learning/page.tsx","daily-challenge/page.tsx"].forEach(function (p) {
    it("no AdminShell in " + p, function () {
      if (!fe(p)) return;
      assert.ok(rf(p).indexOf("AdminShell") < 0);
    });
  });
});

describe("Navigation isolation", function () {
  it("4a. USER_NAV no /admin", function () {
    var x = rf("_components/AppNav.tsx");
    var a = x.indexOf("USER_NAV_ITEMS");
    var b = x.indexOf("ADMIN_NAV_ITEMS");
    assert.ok(x.slice(a, b).indexOf("/admin") < 0);
  });
  it("4b. ADMIN_NAV exists", function () {
    assert.ok(rf("_components/AppNav.tsx").indexOf("ADMIN_NAV_ITEMS") >= 0);
  });
});

describe("Page component adoption", function () {
  it("5a. /books", function () {
    var x = rf("books/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("StatusBadgeRow") >= 0);
  });
  it("5b. /problems", function () {
    var x = rf("problems/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("PageSection") >= 0);
  });
  it("5c. /import", function () {
    var x = rf("import/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("DataStatePanel") >= 0);
  });
  it("5d. /daily-challenge", function () {
    var x = rf("daily-challenge/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("PreviewNotice") >= 0);
  });
  it("5e. /learning", function () {
    var x = rf("learning/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("FeatureCard") >= 0);
  });
  it("5f. /user", function () {
    var x = rf("user/page.tsx");
    assert.ok(x.indexOf("PageHero") >= 0 || x.indexOf("PreviewNotice") >= 0);
  });
});

describe("Safe empty states", function () {
  it("6a. /books", function () {
    assert.ok(rf("books/page.tsx").indexOf("result.books.length") >= 0 || rf("books/page.tsx").indexOf("books.length") >= 0);
  });
  it("6b. /problems", function () {
    assert.ok(rf("problems/page.tsx").indexOf("productionReady") >= 0 || rf("problems/page.tsx").indexOf("PreviewNotice") >= 0);
  });
  it("6c. /import", function () {
    assert.ok(rf("import/page.tsx").indexOf("安全") >= 0 || rf("import/page.tsx").indexOf("DataStatePanel") >= 0);
  });
  it("6d. /reader", function () {
    assert.ok(rf("reader/page.tsx").indexOf("invalid_chapter") >= 0 || rf("reader/page.tsx").indexOf("chapter unavailable") >= 0);
  });
});

describe("Security", function () {
  it("7. no env leaks", function () {
    ["UserUiComponents.tsx","books/page.tsx","problems/page.tsx","import/page.tsx"].forEach(function (f) {
      var full = f.indexOf("/") >= 0 ? join(APP_DIR, f) : join(APP_DIR, "_components", f);
      if (!existsSync(full)) return;
      var x = readFileSync(full, "utf-8");
      assert.ok(x.indexOf('"sk-') < 0);
      assert.ok(x.indexOf("postgres://") < 0);
    });
  });
  it("8a. no LLM promise in import", function () {
    assert.ok(rf("import/page.tsx").indexOf("不调用") >= 0 || rf("import/page.tsx").indexOf("LLM") >= 0);
  });
  it("8b. no DB writes", function () {
    ["books/page.tsx","problems/page.tsx","learning/page.tsx"].forEach(function (p) {
      if (!fe(p)) return;
      var x = rf(p);
      assert.ok(x.indexOf("prisma.") < 0 && x.indexOf("dbPush") < 0 && x.indexOf("migrate") < 0);
    });
  });
});
